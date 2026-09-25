// Unattended mode over real transports: a jsdom page whose host injected `window.__AXE_RELAY__`
// connects with no pairing, and the person approves consequential acts in the agent's own MCP
// client (elicitation: form, URL, or none), over Streamable HTTP sessions (the MCP SDK's Client)
// and over stdio (the relay as a child process).
import { afterEach, describe, expect, it } from "vitest";
import { join } from "node:path";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { ElicitRequest, ElicitResult } from "@modelcontextprotocol/sdk/types.js";
import { mintRelayToken } from "../src/token";
import type { RelayEvent } from "../src/server";
import {
  APP_ORIGIN,
  SECRET,
  elicitingClient,
  httpAgent,
  noJsdom,
  openPage,
  registerPlan,
  startRelay,
  until,
  wrap,
} from "./helpers";
import type { Agent, Elicitor, Page, Running } from "./helpers";

const cleanup: (() => unknown)[] = [];
afterEach(async () => {
  while (cleanup.length) await Promise.resolve(cleanup.pop()!()).catch(() => undefined);
});

async function relay(options: Parameters<typeof startRelay>[0] = {}): Promise<Running> {
  const r = await startRelay(options);
  cleanup.push(() => r.relay.close());
  return r;
}

async function agent(r: Running, token: string, elicit?: Elicitor): Promise<Agent> {
  const a = await httpAgent(r.address.mcpUrl, token, elicit);
  cleanup.push(() => a.close());
  return a;
}

/** The planning page plus "Lock January": a high-risk control that takes text. */
function registerLock(p: Page): void {
  p.surface.configure({ app: "Plan Board" });
  p.surface.register({
    id: "plan:lock-jan",
    kind: "action",
    role: "button",
    name: "Lock January",
    object: "plan",
    effect: { mutates: "locks", risk: "high", text: "Why lock it" },
    handler: (actor, text) => {
      p.calls.push(`lock:${text ?? ""}:${actor}`);
      p.surface.bump();
    },
  });
}

/** A page a host opened for alice: the connection is injected, and the fallback is never used. */
async function unattendedPage(
  r: Running,
  extra: { principal?: string; body?: string } = {},
): Promise<Page> {
  const token = await mintRelayToken(
    { principal: extra.principal ?? "alice", tenant: "acme", ttl: 600 },
    SECRET,
  );
  const p = await openPage({
    inject: { url: r.address.tabUrl, token, mode: "unattended" },
    ...(extra.body ? { body: extra.body } : {}),
  });
  cleanup.push(() => p.close());
  return p;
}

function connectInjected(p: Page): void {
  // The generated application code: the injected connection when a host set one, else the
  // attended development relay (which does not exist here, so using it would fail the test).
  p.connect(
    p.api.relayOptions({ url: "ws://127.0.0.1:9/tab", getToken: () => "never-used" }) as never,
  );
}

async function ready(r: Running, p: Page, principal = "alice"): Promise<void> {
  await p.status((s) => s.state === "connected");
  await until(() => r.relay.tabs({ principal, tenant: "acme" })[0]?.rev !== undefined);
}

async function observe(a: Agent): Promise<number> {
  const v = await a.call("surface_observe");
  expect(v.result.status, v.text).toBe("ok");
  return (v.result.output as { rev: number }).rev;
}

/** A client that answers every elicitation with `result` and remembers what it was asked. */
function person(
  modes: Elicitor["modes"],
  result:
    ElicitResult | ((params: ElicitRequest["params"]) => ElicitResult | Promise<ElicitResult>),
): Elicitor & { asked: ElicitRequest["params"][] } {
  const asked: ElicitRequest["params"][] = [];
  return {
    modes,
    asked,
    answer: (params) => {
      asked.push(params);
      return typeof result === "function" ? result(params) : result;
    },
  };
}

describe.skipIf(noJsdom)("unattended: injected connection", () => {
  it("a page with window.__AXE_RELAY__ connects with no pairing and no indicator; relay_tabs says unattended", async () => {
    const r = await relay();
    const p = await unattendedPage(r);
    registerPlan(p);
    const injected = p.api.injectedRelay();
    expect(injected).toMatchObject({ url: r.address.tabUrl, mode: "unattended", indicator: false });
    connectInjected(p);
    await ready(r, p);
    expect(p.statuses.some((s) => s.state === "pairing")).toBe(false);
    expect(p.indicator()).toBeNull();
    const a = await agent(r, "agent-alice");
    const tabs = (await a.call("relay_tabs")).result.output!["tabs"] as { mode: string }[];
    expect(tabs).toHaveLength(1);
    expect(tabs[0]!.mode).toBe("unattended");
    // A medium-risk act runs at once, as ever.
    const rev = await observe(a);
    const done = await a.call("surface_run-control", { entryId: "plan:submit", expectedRev: rev });
    expect(done.result.status, done.text).toBe("ok");
    expect(p.calls).toEqual(["submit:alice (agent via relay)"]);
  });
});

describe.skipIf(noJsdom)("unattended: the tab's page", () => {
  it("relay_tabs follows a client-side route change (found driving a Next app headless)", async () => {
    const r = await relay();
    const p = await unattendedPage(r);
    registerPlan(p);
    connectInjected(p);
    await ready(r, p);
    expect(r.relay.tabs({ principal: "alice", tenant: "acme" })[0]!.path).toBe("/plan");
    // A router's pushState, then the surface re-registers what the new route shows.
    p.window.history.pushState({}, "", "/history");
    p.window.document.title = "History";
    p.surface.bump();
    await until(() => r.relay.tabs({ principal: "alice", tenant: "acme" })[0]!.path === "/history");
    const a = await agent(r, "agent-alice");
    const tabs = (await a.call("relay_tabs")).result.output!["tabs"] as {
      path: string;
      title: string;
    }[];
    expect(tabs[0]).toMatchObject({ path: "/history", title: "History" });
  });
});

describe.skipIf(noJsdom)("unattended: approvals in the agent's client (HTTP sessions)", () => {
  it("form elicitation: the person approves in the client, the act runs once in the same tool call, and the ledger names who approved", async () => {
    const r = await relay();
    const p = await unattendedPage(r);
    registerPlan(p);
    registerLock(p);
    connectInjected(p);
    await ready(r, p);
    const client = person({ form: true }, { action: "accept", content: { approve: true } });
    const a = await agent(r, "agent-alice", client);
    const rev = await observe(a);
    const res = await a.call("surface_run-control", {
      entryId: "plan:lock-jan",
      text: "quarter closed",
      expectedRev: rev,
    });
    expect(res.result.status, res.text).toBe("ok");
    expect(p.calls).toEqual(["lock:quarter closed:alice (agent via relay)"]);
    expect(client.asked).toHaveLength(1);
    const q = client.asked[0]! as { mode?: string; message: string; requestedSchema?: unknown };
    expect(q.mode ?? "form").toBe("form");
    expect(q.message).toContain(
      "Approve “Lock January” on Plan Board? It changes locks, risk high",
    );
    expect(q.message).toContain("“quarter closed”");
    // The page's own ledger: the person's decision, then the act under the agent's actor.
    const ledger = p.surface.ledger();
    const approved = ledger.find((e) => e.op === "approve");
    expect(approved).toMatchObject({
      target: "plan:lock-jan",
      actor: "alice (approved in the agent's MCP client)",
      status: "ok",
    });
    const ran = ledger.find((e) => e.target === "plan:lock-jan" && e.op !== "approve");
    expect(ran).toMatchObject({ actor: "alice (agent via relay)", status: "ok" });
    expect(ran!.seq).toBeGreaterThan(approved!.seq);
    // Single use: the next lock asks again.
    const rev2 = await observe(a);
    await a.call("surface_run-control", {
      entryId: "plan:lock-jan",
      text: "again",
      expectedRev: rev2,
    });
    expect(client.asked).toHaveLength(2);
  });

  it("form elicitation: decline and cancel refuse the act (forbidden, approval_denied), nothing runs, and the refusal is recorded", async () => {
    const events: RelayEvent[] = [];
    const r = await relay({ onEvent: (e) => events.push(e) });
    const p = await unattendedPage(r);
    registerPlan(p);
    connectInjected(p);
    await ready(r, p);
    let answer: ElicitResult = { action: "decline" };
    const client = person({ form: true }, () => answer);
    const a = await agent(r, "agent-alice", client);
    const rev = await observe(a);
    const denied = await a.call("surface_run-control", {
      entryId: "plan:delete",
      expectedRev: rev,
    });
    expect(denied.result.error!.code).toBe("forbidden");
    expect(denied.result.error!.details!["reason"]).toBe("approval_denied");
    expect(p.calls).toEqual([]);
    expect(p.surface.ledger().find((e) => e.op === "deny")).toMatchObject({
      target: "plan:delete",
      actor: "alice (declined in the agent's MCP client)",
    });
    expect(events.find((e) => e.type === "approval.decided")).toMatchObject({
      decision: "deny",
      via: "agent-form",
    });
    // Dismissing the form, or answering without ticking Approve, is a refusal too.
    answer = { action: "cancel" };
    const cancelled = await a.call("surface_run-control", {
      entryId: "plan:delete",
      expectedRev: await observe(a),
    });
    expect(cancelled.result.error!.details!["reason"]).toBe("approval_denied");
    answer = { action: "accept", content: { approve: false } };
    const unticked = await a.call("surface_run-control", {
      entryId: "plan:delete",
      expectedRev: await observe(a),
    });
    expect(unticked.result.error!.details!["reason"]).toBe("approval_denied");
    expect(p.calls).toEqual([]);
  });

  it("a client that declares no elicitation gets approval_required with instructions, and no approval can come from tool arguments", async () => {
    const r = await relay();
    const p = await unattendedPage(r);
    registerPlan(p);
    connectInjected(p);
    await ready(r, p);
    const a = await agent(r, "agent-alice");
    const rev = await observe(a);
    const args = { entryId: "plan:delete", expectedRev: rev };
    const asked = await a.call("surface_run-control", args);
    expect(asked.result.error!.code).toBe("unavailable");
    expect(asked.result.error!.details!["reason"]).toBe("approval_required");
    expect(asked.result.error!.details!["channel"]).toBe("agent");
    expect(asked.text).toContain("declares no elicitation support");
    // No approval page is configured, so there is no link.
    expect(asked.result.error!.details!["approvalUrl"]).toBeUndefined();
    // Asking again, or claiming approval in the arguments, runs nothing.
    const again = await a.call("surface_run-control", { ...args, confirm: true });
    expect(again.result.status).toBe("error");
    expect(p.calls).toEqual([]);
  });
});

describe.skipIf(noJsdom)("unattended: the relay's approval page (URL mode)", () => {
  // Who opened the page: a stand-in for the person's own session on the relay's domain.
  const identify = (request: Request) => {
    const who = request.headers.get("x-person");
    return who ? { principal: who, tenant: "acme" } : null;
  };

  async function openLink(url: string, who: string | null) {
    const res = await fetch(url, { headers: who ? { "x-person": who } : {} });
    return { status: res.status, body: await res.text() };
  }

  async function decide(url: string, who: string, body: string, decision: "approve" | "deny") {
    const nonce = /name="nonce" value="([^"]+)"/.exec(body)![1]!;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "x-person": who,
        "content-type": "application/x-www-form-urlencoded",
        origin: new URL(url).origin,
      },
      body: new URLSearchParams({ nonce, decision }).toString(),
    });
    return { status: res.status, body: await res.text() };
  }

  it("a sensitive act goes to the approval page: another principal is refused, the person approves once, the act runs, and the link is closed", async () => {
    const events: RelayEvent[] = [];
    const r = await relay({
      approvals: { identify, sensitive: (row) => row.id === "plan:delete" },
      onEvent: (e) => events.push(e),
    });
    const p = await unattendedPage(r);
    registerPlan(p);
    connectInjected(p);
    await ready(r, p);
    let offered: (url: string) => void = () => undefined;
    const link = new Promise<string>((resolve) => (offered = resolve));
    // The client declares both modes; a sensitive act still goes to the page, never a form.
    const client = person({ form: true, url: true }, (params) => {
      offered((params as { url: string }).url);
      return { action: "accept" };
    });
    const a = await agent(r, "agent-alice", client);
    const rev = await observe(a);
    const call = a.call("surface_run-control", { entryId: "plan:delete", expectedRev: rev });
    const url = await link;
    expect(client.asked[0]).toMatchObject({ mode: "url" });
    expect(url).toMatch(new RegExp(`^${r.address.url}/approve/[A-Za-z0-9_-]+$`));
    // Nobody signed in, and another person, are refused; nothing ran.
    expect((await openLink(url, null)).status).toBe(401);
    const bob = await openLink(url, "bob");
    expect(bob.status).toBe(403);
    expect(p.calls).toEqual([]);
    const page = await openLink(url, "alice");
    expect(page.status).toBe(200);
    expect(page.body).toContain("Approve “Delete the plan”");
    // A decision posted without the page's nonce is refused.
    const forged = await fetch(url, {
      method: "POST",
      headers: { "x-person": "alice", "content-type": "application/x-www-form-urlencoded" },
      body: "nonce=wrong&decision=approve",
    });
    expect(forged.status).toBe(400);
    const approved = await decide(url, "alice", page.body, "approve");
    expect(approved.status, approved.body).toBe(200);
    const res = await call;
    expect(res.result.status, res.text).toBe("ok");
    expect(p.calls).toEqual(["delete:alice (agent via relay)"]);
    expect(p.surface.ledger().find((e) => e.op === "approve")).toMatchObject({
      actor: "alice (approved on the relay's approval page)",
    });
    expect(events.find((e) => e.type === "approval.decided")).toMatchObject({
      via: "approval-page",
      decision: "approve",
    });
    // Single use: the link is closed now, even for the person.
    expect((await openLink(url, "alice")).status).toBe(410);
    expect((await decide(url, "alice", page.body, "approve")).status).toBe(410);
    expect(p.calls).toHaveLength(1);
  });

  it("a client that declares URL mode only is sent to the page for any act; an expired link is refused and nothing runs", async () => {
    const r = await relay({ approvals: { identify, linkTtlMs: 300 } });
    const p = await unattendedPage(r);
    registerPlan(p);
    connectInjected(p);
    await ready(r, p);
    let url = "";
    const client = person({ url: true }, (params) => {
      url = (params as { url: string }).url;
      return { action: "accept" };
    });
    const a = await agent(r, "agent-alice", client);
    const rev = await observe(a);
    const res = await a.call("surface_run-control", { entryId: "plan:delete", expectedRev: rev });
    expect(client.asked[0]).toMatchObject({ mode: "url" });
    expect(res.result.error!.details!["reason"]).toBe("approval_timeout");
    const expired = await openLink(url, "alice");
    expect(expired.status).toBe(410);
    expect(expired.body).toContain("expired");
    expect(p.calls).toEqual([]);
  });

  it("without elicitation, the fallback carries the approval link; the person approves there and the agent's retry runs once", async () => {
    const r = await relay({ approvals: { identify } });
    const p = await unattendedPage(r);
    registerPlan(p);
    connectInjected(p);
    await ready(r, p);
    const a = await agent(r, "agent-alice");
    const rev = await observe(a);
    const args = { entryId: "plan:delete", expectedRev: rev };
    const asked = await a.call("surface_run-control", args);
    const url = asked.result.error!.details!["approvalUrl"] as string;
    expect(url).toContain("/approve/");
    const page = await openLink(url, "alice");
    expect((await decide(url, "alice", page.body, "approve")).status).toBe(200);
    const ran = await a.call("surface_run-control", args);
    expect(ran.result.status, ran.text).toBe("ok");
    expect(p.calls).toEqual(["delete:alice (agent via relay)"]);
  });
});

describe.skipIf(noJsdom)("unattended: the derived gate and Stop from the agent", () => {
  it("an autoSurface control held for approval is granted through the same path: one form, one click", async () => {
    const r = await relay();
    const p = await unattendedPage(r, {
      body: '<main><h1>Account</h1><button id="del" type="button">Delete account</button></main>',
    });
    const clicks: string[] = [];
    p.window.document.getElementById("del")!.addEventListener("click", () => clicks.push("del"));
    const handle = p.api.autoSurface({ surface: p.surface });
    cleanup.push(() => handle.stop());
    const row = p.surface.observe().entries.find((e) => e.name === "Delete account")!;
    expect(row.kind === "action" && row.state?.handoff?.reason).toBe("approval_required");
    connectInjected(p);
    await ready(r, p);
    const client = person({ form: true }, { action: "accept", content: { approve: true } });
    const a = await agent(r, "agent-alice", client);
    const rev = await observe(a);
    const res = await a.call("surface_run-control", { entryId: row.id, expectedRev: rev });
    expect(res.result.status, res.text).toBe("ok");
    expect(clicks).toEqual(["del"]);
    expect(client.asked).toHaveLength(1);
  });

  it("relay_stop ends the session: the page stops, later acts are forbidden, and the event says the agent stopped it", async () => {
    const events: RelayEvent[] = [];
    const r = await relay({ onEvent: (e) => events.push(e) });
    const p = await unattendedPage(r);
    registerPlan(p);
    connectInjected(p);
    await ready(r, p);
    const a = await agent(r, "agent-alice");
    const rev = await observe(a);
    const stopped = await a.call("relay_stop");
    expect(stopped.result.status, stopped.text).toBe("ok");
    expect((stopped.result.output!["stopped"] as { state: string }).state).toBe("stopped");
    await p.status((s) => s.state === "stopped");
    const refused = await a.call("surface_run-control", {
      entryId: "plan:submit",
      expectedRev: rev,
    });
    expect(refused.result.error!.code).toBe("forbidden");
    expect(p.calls).toEqual([]);
    expect(events.find((e) => e.type === "tab.stopped")).toMatchObject({ by: "agent" });
  });

  it("relay.stop(who) ends a person's sessions for the relay's owner (a host's own Stop)", async () => {
    const r = await relay();
    const p = await unattendedPage(r);
    registerPlan(p);
    connectInjected(p);
    await ready(r, p);
    expect(r.relay.stop({ principal: "alice", tenant: "acme" })).toBe(1);
    await p.status((s) => s.state === "stopped");
    expect(r.relay.tabs({ principal: "alice", tenant: "acme" })[0]!.state).toBe("stopped");
  });
});

describe.skipIf(noJsdom)("unattended: approvals over stdio", () => {
  it("the relay as a child process for alice: form elicitation over stdio approves a high-risk act in one tool call", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [
        "--import",
        "tsx",
        join(__dirname, "../src/bin.ts"),
        "--stdio",
        "--port",
        "0",
        "--principal",
        "alice",
        "--tenant",
        "acme",
        "--origin",
        APP_ORIGIN,
      ],
      cwd: join(__dirname, ".."),
      env: { ...(process.env as Record<string, string>), AXE_RELAY_SECRET: SECRET },
      stderr: "pipe",
    });
    const listening = new Promise<string>((resolve, reject) => {
      let buf = "";
      transport.stderr!.on("data", (chunk: Buffer) => {
        buf += chunk.toString();
        const m = /listening for tabs on (ws:\/\/\S+)/.exec(buf);
        if (m) resolve(m[1]!);
      });
      setTimeout(() => reject(new Error(`the relay did not start: ${buf}`)), 20_000).unref();
    });
    const client = person({ form: true }, { action: "accept", content: { approve: true } });
    const mcp = elicitingClient("stdio-unattended", client);
    await mcp.connect(transport);
    cleanup.push(() => mcp.close());
    const a = wrap(mcp, () => mcp.close());
    const tabUrl = await listening;
    const token = await mintRelayToken({ principal: "alice", tenant: "acme" }, SECRET);
    const p = await openPage({ inject: { url: tabUrl, token, mode: "unattended" } });
    cleanup.push(() => p.close());
    registerPlan(p);
    connectInjected(p);
    await p.status((s) => s.state === "connected");
    const rev = await observe(a);
    const res = await a.call("surface_run-control", { entryId: "plan:delete", expectedRev: rev });
    expect(res.result.status, res.text).toBe("ok");
    expect(p.calls).toEqual(["delete:alice (agent via relay)"]);
    expect(client.asked).toHaveLength(1);
    expect(p.surface.ledger().some((e) => e.op === "approve")).toBe(true);
  });
});
