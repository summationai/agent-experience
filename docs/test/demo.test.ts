// The Plan Board demo's scripted sequence, run against the real script on a free port: a person
// and an agent share the board, the agent is refused once for a stale revision, the person
// approves March outside `act`, and the ledger holds every revision move and the refusal.
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

type Entry = {
  seq: number;
  op: string;
  target: string | null;
  actor: string;
  revBefore: number;
  revAfter: number;
  status: string;
  changed: string[];
  source?: string;
  expectedRev?: number;
};

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const port = (srv.address() as { port: number }).port;
      srv.close(() => resolve(port));
    });
  });
}

let child: ChildProcess | undefined;
let base = "";

beforeAll(async () => {
  const port = await freePort();
  base = `http://localhost:${port}`;
  child = spawn(process.execPath, ["--import", "tsx", "docs/examples/demo/plan-board.ts"], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise<void>((resolve, reject) => {
    let out = "";
    const timer = setTimeout(() => reject(new Error(`demo did not start:\n${out}`)), 30_000);
    const onData = (chunk: Buffer) => {
      out += chunk.toString();
      if (out.includes("Plan Board on")) {
        clearTimeout(timer);
        resolve();
      }
    };
    child!.stdout!.on("data", onData);
    child!.stderr!.on("data", (c: Buffer) => (out += c.toString()));
    child!.once("exit", (code) => reject(new Error(`demo exited (${code}):\n${out}`)));
  });
}, 40_000);

afterAll(() => {
  child?.kill();
});

const post = async (path: string, token: string, body: unknown) =>
  (await (
    await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
  ).json()) as {
    status: string;
    rev?: number;
    output?: Record<string, unknown>;
    error?: { code: string };
  };
const act = (token: string, name: string, input: unknown, expectedRev: number) =>
  post(`/axe/actions/${name}`, token, { input, expectedRev, idempotencyKey: crypto.randomUUID() });
const AGENT = "dana-agent";
const PERSON = "dana-browser";

describe("the Plan Board demo's ledger", () => {
  it("holds the approval and the stale refusal, with no unexplained revision gap", async () => {
    expect((await act(AGENT, "plan.demand-2026-01", { text: "4500000" }, 0)).status).toBe("ok"); // 0 -> 1
    expect((await act(PERSON, "plan.demand-2026-02", { text: "3800000" }, 1)).status).toBe("ok"); // 1 -> 2
    // The agent changes February from the revision it read before the person's edit.
    const stale = await act(AGENT, "plan.demand-2026-02", { text: "4000000" }, 1);
    expect(stale.error?.code).toBe("conflict");
    expect((await act(AGENT, "plan.demand-2026-02", { text: "4000000" }, 2)).status).toBe("ok"); // 2 -> 3
    // Locking March needs the person's approval: handed back to the human.
    const blocked = await act(AGENT, "plan.lock-2026-03", { text: "quarter close" }, 3);
    expect(blocked.status).toBe("needs_human");
    // The agent cannot approve; the person does, outside `act`.
    expect((await post("/demo/approve/2026-03", AGENT, {})).status).toBeUndefined();
    const approved = (await (
      await fetch(`${base}/demo/approve/2026-03`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${PERSON}` },
        body: "{}",
      })
    ).json()) as { ok: boolean };
    expect(approved.ok).toBe(true); // 3 -> 4
    expect((await act(AGENT, "plan.lock-2026-03", { text: "quarter close" }, 4)).status).toBe("ok"); // 4 -> 5

    const read = await post("/axe/actions/plan.ledger", PERSON, { input: {} });
    const entries = (read.output as { entries: Entry[] }).entries;
    const rows = entries.map((e) => [
      e.seq,
      e.actor,
      e.op,
      e.target,
      e.status,
      `${e.revBefore}->${e.revAfter}`,
      e.source ?? "act",
    ]);
    expect(rows).toEqual([
      [1, "dana's agent", "TYPE_TEXT", "demand:2026-01", "ok", "0->1", "act"],
      [2, "dana", "TYPE_TEXT", "demand:2026-02", "ok", "1->2", "act"],
      [3, "dana's agent", "TYPE_TEXT", "demand:2026-02", "conflict", "2->2", "server"],
      [4, "dana's agent", "TYPE_TEXT", "demand:2026-02", "ok", "2->3", "act"],
      [5, "dana's agent", "CLICK", "lock:2026-03", "unavailable", "3->3", "act"],
      [6, "dana", "APPROVE", "lock:2026-03", "ok", "3->4", "application"],
      [7, "dana's agent", "CLICK", "lock:2026-03", "ok", "4->5", "act"],
    ]);
    expect(entries[2]!.expectedRev).toBe(1);
    // No gap: every change starts at the revision the previous change ended at, from 0 to now.
    let at = 0;
    for (const e of entries) {
      expect(e.revBefore).toBe(at);
      at = e.revAfter;
    }
    const board = await post("/axe/actions/plan.observe", PERSON, { input: {} });
    expect((board.output as { rev: number }).rev).toBe(at);
  });
});
