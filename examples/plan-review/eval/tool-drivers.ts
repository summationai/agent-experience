// Variants v3 and v4: an agent that calls MCP tools. v3 talks to the basic tool set (no
// revision, no availability, no handoff, no idempotency key). v4 talks to the MCP server that
// @axe/mcp derives from the app's AXE manifest (the same thing `axe mcp <url>` serves): it reads
// availability and the revision from axe_state, presents expectedRev on every write, passes an
// idempotency key it can repeat, and follows needs_human through axe_resume.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { createMcpServer } from "@axe/mcp";
import { cellKey } from "../lib/model";
import { agentTokenFor } from "../lib/store";
import { basicMcpServer } from "./basic-mcp";
import type { FetchFaults, Meter } from "./meter";
import { MeteredTransport, countingFetch } from "./meter";
import type { Change, Driver, LockRequest, Observation, WriteResult } from "./policy";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

interface ToolResult {
  text: string;
  structured: Json | undefined;
  isError: boolean;
  /** The call itself failed (no result reached the agent). */
  failed: boolean;
}

async function connect(server: Server, meter: Meter): Promise<Client> {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: "axe-eval-scripted-agent", version: "0.0.0" });
  await client.connect(new MeteredTransport(clientSide, meter));
  await client.listTools();
  return client;
}

async function call(client: Client, name: string, args: Json): Promise<ToolResult> {
  try {
    const r = (await client.callTool({ name, arguments: args })) as Json;
    const text = ((r.content ?? []) as { text?: string }[]).map((c) => c.text ?? "").join("\n");
    return {
      text,
      structured: r.structuredContent as Json | undefined,
      isError: !!r.isError,
      failed: false,
    };
  } catch (e) {
    return { text: (e as Error).message, structured: undefined, isError: true, failed: true };
  }
}

function parse(text: string): Json | undefined {
  try {
    return JSON.parse(text) as Json;
  } catch {
    return undefined;
  }
}

export interface ToolDriverOptions {
  base: string;
  meter: Meter;
  faults?: FetchFaults;
  /** Stable per run, so a restarted or retrying agent repeats the same idempotency keys. */
  runKey: string;
}

const TOKEN = agentTokenFor("bob", "acme");

/** v3: the basic tools. */
export async function openBasicDriver(o: ToolDriverOptions): Promise<Driver> {
  const server = basicMcpServer({
    base: o.base,
    token: TOKEN,
    fetch: countingFetch(o.meter, o.faults),
  });
  const client = await connect(server, o.meter);
  let writeAttempts = 0;
  let last: { name: string; args: Json } | null = null;

  const toWrite = (r: ToolResult): WriteResult => {
    if (!r.isError) return { kind: "ok" };
    if (r.failed || r.text.startsWith("Request failed")) return { kind: "lost" };
    return { kind: "refused", reason: String(parse(r.text)?.["error"] ?? r.text) };
  };
  const mutate = async (name: string, args: Json) => {
    writeAttempts++;
    last = { name, args };
    return toWrite(await call(client, name, args));
  };

  return {
    get writeAttempts() {
      return writeAttempts;
    },
    async observe(): Promise<Observation> {
      const r = await call(client, "get_plan", {});
      const plan = parse(r.text)?.["plan"] as Json;
      return {
        values: plan["values"] as Record<string, number>,
        status: plan["status"],
        editBlocked: null,
      };
    },
    async write(changes: Change[], _obs, beforeCommit, afterStep): Promise<WriteResult> {
      await beforeCommit();
      for (const c of changes) {
        const r = await mutate("set_value", { item: c.item, month: c.month, value: c.value });
        await afterStep();
        if (r.kind !== "ok") return r;
      }
      return { kind: "ok" };
    },
    async retryLast() {
      if (!last) return null;
      const { name, args } = last;
      return mutate(name, args);
    },
    async afterConflict() {},
    async recover() {},
    async submit() {
      return mutate("submit_plan", {});
    },
    async requestLock(): Promise<LockRequest> {
      const r = await mutate("lock_plan", {});
      return r.kind === "refused"
        ? r
        : { kind: "refused", reason: r.kind === "ok" ? "locked" : `lock_plan: ${r.kind}` };
    },
    async close() {
      await client.close();
    },
  };
}

/** v4: the MCP server derived from the AXE manifest. */
export async function openAxeDriver(o: ToolDriverOptions): Promise<Driver> {
  const derived = await createMcpServer(o.base, {
    client: {
      auth: TOKEN,
      fetch: countingFetch(o.meter, o.faults),
      agent: { name: "axe-eval-scripted-agent", version: "0.0.0" },
    },
  });
  const client = await connect(derived.server, o.meter);
  let writeAttempts = 0;
  let rev: number | undefined;
  let planId = "";
  let last: { name: string; args: Json } | null = null;

  const toWrite = (r: ToolResult): WriteResult => {
    const s = r.structured;
    if (r.failed || !s || typeof s["status"] !== "string") return { kind: "lost" };
    if (typeof s["rev"] === "number") rev = s["rev"];
    if (s["status"] === "ok") return { kind: "ok" };
    const err = s["error"] as Json | undefined;
    if (err?.["code"] === "conflict") return { kind: "conflict" };
    return {
      kind: "refused",
      reason: String(
        (err?.["details"] as Json | undefined)?.["reason"] ?? err?.["message"] ?? s["status"],
      ),
    };
  };
  const mutate = async (name: string, args: Json) => {
    writeAttempts++;
    last = { name, args };
    const r = await call(client, name, args);
    return { result: toWrite(r), raw: r };
  };

  return {
    get writeAttempts() {
      return writeAttempts;
    },
    async observe(cells): Promise<Observation> {
      const state = (await call(client, "axe_state", {})).structured as Json;
      const plan = (((await call(client, "plan_read", {})).structured as Json)["output"] as Json)[
        "plan"
      ] as Json;
      rev = plan["rev"] as number;
      planId = plan["id"] as string;
      const values: Record<string, number> = {};
      for (const row of plan["rows"] as { item: string; values: Record<string, number> }[])
        for (const [m, v] of Object.entries(row.values)) values[cellKey(row.item, m)] = v;
      const edit = (state["actions"] as Json)["plan.set-value"] as Json | undefined;
      const blocked = cells.length > 0 && edit && edit["available"] === false;
      return {
        values,
        status: plan["status"] as string,
        editBlocked: blocked ? String(edit["reason"] ?? "") : null,
      };
    },
    async write(changes: Change[], _obs, beforeCommit, afterStep): Promise<WriteResult> {
      await beforeCommit();
      for (const c of changes) {
        const { result } = await mutate("plan_set-value", {
          item: c.item,
          month: c.month,
          value: c.value,
          expectedRev: rev,
          idempotencyKey: `${o.runKey}:set:${c.item}:${c.month}:${c.value}`,
        });
        await afterStep();
        if (result.kind !== "ok") return result;
      }
      return { kind: "ok" };
    },
    async retryLast() {
      if (!last) return null;
      const { name, args } = last;
      return (await mutate(name, args)).result; // the same idempotencyKey and expectedRev
    },
    async afterConflict() {},
    async recover() {},
    async submit() {
      return (
        await mutate("plan_submit", {
          planId,
          expectedRev: rev,
          idempotencyKey: `${o.runKey}:submit`,
        })
      ).result;
    },
    async requestLock(): Promise<LockRequest> {
      const { result, raw } = await mutate("plan_approve", {
        planId,
        expectedRev: rev,
        idempotencyKey: `${o.runKey}:approve`,
      });
      const s = raw.structured;
      if (s?.["status"] !== "needs_human")
        return {
          kind: "refused",
          reason: result.kind === "refused" ? result.reason : String(s?.["status"]),
        };
      const handoff = s["handoff"] as Json;
      const handoffId = decodeURIComponent(
        new URL(handoff["url"] as string).pathname.split("/").pop()!,
      );
      return {
        kind: "handoff",
        handoffId,
        resume: async () => {
          const r = await call(client, "axe_resume", { resumeToken: handoff["resumeToken"] });
          return toWrite(r);
        },
      };
    },
    async close() {
      await client.close();
    },
  };
}
