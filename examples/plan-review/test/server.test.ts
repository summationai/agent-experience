// The reference app's server behavior, without a browser or a port: the app's own endpoints
// (lib/ui-api.ts) and the AXE runtime (lib/axe.ts) called in process with Web Requests.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { AXEClient } from "@summationai/axe-client";
import { createMcpServer } from "@summationai/axe-mcp";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { BASE_URL, getAXE, resetAXE } from "../lib/axe";
import { pageSurface } from "../lib/browser-surface";
import { handleUi } from "../lib/ui-api";
import { agentTokenFor, store } from "../lib/store";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const TRUSTED = "http://127.0.0.1:3000";
const EVIL = "https://evil.example";

beforeEach(() => {
  store.reset();
  resetAXE();
});
afterEach(() => {
  vi.useRealTimers();
});

const flush = () => new Promise((r) => setTimeout(r, 0));

/** A person in a browser: signs in through the app's own endpoint and keeps the cookie. */
async function person(user: string, tenant: string, origin = BASE_URL) {
  const res = await handleUi(
    new Request(`${BASE_URL}/api/login`, {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ user, tenant }),
    }),
  );
  expect(res.status).toBe(200);
  const cookie = res.headers.get("set-cookie")!.split(";")[0]!;
  const call = async (
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) => {
    const r = await handleUi(
      new Request(`${BASE_URL}/api${path}`, {
        method,
        headers: { cookie, origin, "content-type": "application/json", ...headers },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      }),
    );
    return { status: r.status, body: (await r.json()) as Json };
  };
  return {
    cookie,
    call,
    state: async () => (await call("GET", "/state")).body,
    rev: async () => ((await call("GET", "/state")).body.plan as Json).rev as number,
    post: (path: string, body: unknown) => call("POST", path, body),
  };
}

async function axeFetch(
  path: string,
  init: RequestInit & { headers?: Record<string, string> } = {},
) {
  const res = await getAXE().handle(new Request(`${BASE_URL}${path}`, init));
  return { status: res.status, body: (await res.json()) as Json };
}

/** An agent acting for `user` in `tenant` with the token the site issued. */
function agent(user: string, tenant: string) {
  const headers = {
    authorization: `Bearer ${agentTokenFor(user, tenant)}`,
    "user-agent": "PlanTestAgent/1.0",
    "content-type": "application/json",
  };
  const post = (path: string, body: unknown) =>
    axeFetch(path, { method: "POST", headers, body: JSON.stringify(body) });
  return {
    invoke: (name: string, input: unknown, opts: { expectedRev?: number; key?: string } = {}) =>
      post(`/axe/actions/${name}`, {
        input,
        idempotencyKey: opts.key ?? randomUUID(),
        ...(opts.expectedRev !== undefined ? { expectedRev: opts.expectedRev } : {}),
      }),
    resume: (resumeToken: string, extra: Json = {}) =>
      post("/axe/resume", { resumeToken, ...extra }),
    state: () => axeFetch("/axe/state", { headers }),
    read: async () =>
      ((await post("/axe/actions/plan.read", { input: {} })).body.output as Json).plan as Json,
  };
}

function handoffIdOf(url: string): string {
  return decodeURIComponent(new URL(url).pathname.split("/").pop()!);
}

describe("sign-in and the request policy", () => {
  it("login: a session cookie per user and tenant; other origins and non-JSON posts are refused on both doors", async () => {
    const alice = await person("alice", "acme");
    expect((await alice.state()).session).toMatchObject({
      user: "alice",
      tenant: "acme",
      role: "approver",
    });
    // Unknown membership.
    const bad = await handleUi(
      new Request(`${BASE_URL}/api/login`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE_URL },
        body: JSON.stringify({ user: "mallory", tenant: "acme" }),
      }),
    );
    expect(bad.status).toBe(401);
    // A forged sign-in from another site.
    const forged = await handleUi(
      new Request(`${BASE_URL}/api/login`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: EVIL },
        body: JSON.stringify({ user: "alice", tenant: "acme" }),
      }),
    );
    expect(forged.status).toBe(403);
    // A cross-site write with the victim's cookie, on the app's own endpoint and on AXE.
    const rev = await alice.rev();
    const csrf = await alice.call(
      "POST",
      "/plan/values",
      { expectedRev: rev, cells: [{ item: "Widgets", month: "2027-01", value: 1 }] },
      { origin: EVIL },
    );
    expect(csrf.status).toBe(403);
    const plain = await alice.call(
      "POST",
      "/plan/submit",
      { expectedRev: rev },
      { "content-type": "text/plain" },
    );
    expect(plain.status).toBe(415);
    const axeCsrf = await axeFetch("/axe/actions/plan.set-value", {
      method: "POST",
      headers: { cookie: alice.cookie, origin: EVIL, "content-type": "application/json" },
      body: JSON.stringify({
        input: { item: "Widgets", month: "2027-01", value: 1 },
        idempotencyKey: "x",
        expectedRev: rev,
      }),
    });
    expect(axeCsrf.status).toBe(403);
    expect(axeCsrf.body.error.details.reason).toBe("cross_origin_refused");
    expect(await alice.rev()).toBe(rev);
    // The same session from the app's own origin, and from the configured trusted origin, works.
    const own = await axeFetch("/axe/actions/plan.set-value", {
      method: "POST",
      headers: { cookie: alice.cookie, origin: TRUSTED, "content-type": "application/json" },
      body: JSON.stringify({
        input: { item: "Widgets", month: "2027-01", value: 1 },
        idempotencyKey: "y",
        expectedRev: rev,
      }),
    });
    expect(own.body.status).toBe("ok");
    // Anonymous callers see the action set and nothing from a plan.
    const anon = await axeFetch("/axe/actions/plan.read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: {} }),
    });
    expect(anon.body.error.code).toBe("unauthorized");
  });

  it("tenant scope: the same person on another team is another scope, for plans, tokens, and approvals", async () => {
    const acme = agent("alice", "acme");
    const globex = agent("alice", "globex");
    expect((await acme.read()).id).toBe("acme-fy27-h1");
    expect((await globex.read()).id).toBe("globex-fy27-h1");
    // bob asks for a lock on acme; alice's globex session cannot see or approve it.
    const bob = agent("bob", "acme");
    let rev = (await bob.read()).rev as number;
    rev = (await bob.invoke("plan.submit", { planId: "acme-fy27-h1" }, { expectedRev: rev })).body
      .rev;
    const ask = await bob.invoke("plan.approve", { planId: "acme-fy27-h1" }, { expectedRev: rev });
    const id = handoffIdOf(ask.body.handoff.url);
    const aliceGlobex = await person("alice", "globex");
    expect((await aliceGlobex.post(`/approvals/${id}`, { decision: "approve" })).status).toBe(404);
    // The resume token is bound to bob on acme.
    const stolen = await globex.resume(ask.body.handoff.resumeToken);
    expect(stolen.body.error.code).toBe("not_found");
  });
});

describe("two people, one plan", () => {
  it("two users editing the same plan: one conflict, one success, nothing lost silently", async () => {
    const alice = await person("alice", "acme");
    const bobsAgent = agent("bob", "acme");
    const seen = await alice.rev();
    const seenByAgent = (await bobsAgent.read()).rev;
    expect(seenByAgent).toBe(seen);
    const saved = await alice.post("/plan/values", {
      expectedRev: seen,
      cells: [{ item: "Gaskets", month: "2027-03", value: 1500 }],
    });
    expect(saved.status).toBe(200);
    const stale = await bobsAgent.invoke(
      "plan.set-value",
      { item: "Gaskets", month: "2027-03", value: 900 },
      { expectedRev: seenByAgent },
    );
    expect(stale.body.error).toMatchObject({
      code: "conflict",
      details: { expectedRev: seen, currentRev: seen + 1 },
    });
    expect(store.plan("acme")!.values["Gaskets|2027-03"]).toBe(1500);
    // Two tabs of the app at the same revision: the second save is refused, not merged.
    const bob = await person("bob", "acme");
    const r = await bob.rev();
    const [t1, t2] = await Promise.all([
      alice.post("/plan/values", {
        expectedRev: r,
        cells: [{ item: "Widgets", month: "2027-02", value: 1 }],
      }),
      bob.post("/plan/values", {
        expectedRev: r,
        cells: [{ item: "Widgets", month: "2027-02", value: 2 }],
      }),
    ]);
    expect([t1.status, t2.status].sort()).toEqual([200, 409]);
    expect(store.plan("acme")!.values["Widgets|2027-02"]).toBe(1);
  });

  it("a person's change between the agent's observe and act is refused; the agent re-reads and continues", async () => {
    const alice = await person("alice", "acme");
    const a = agent("bob", "acme");
    const observed = (await a.state()).body;
    expect(observed.actions["plan.set-value"]).toEqual({ available: true });
    await alice.post("/plan/values", {
      expectedRev: observed.rev,
      cells: [{ item: "Brackets", month: "2027-06", value: 42 }],
    });
    const acted = await a.invoke(
      "plan.set-value",
      { item: "Brackets", month: "2027-06", value: 7 },
      { expectedRev: observed.rev },
    );
    expect(acted.body.error.code).toBe("conflict");
    expect(acted.body.rev).toBe(observed.rev + 1);
    const again = await a.invoke(
      "plan.set-value",
      { item: "Brackets", month: "2027-06", value: 7 },
      { expectedRev: acted.body.rev },
    );
    expect(again.body.status).toBe("ok");
    // A person submits: the agent's availability says why it can no longer edit, and the call is refused.
    await alice.post("/plan/submit", { expectedRev: again.body.rev });
    const now = (await a.state()).body;
    expect(now.actions["plan.set-value"]).toEqual({
      available: false,
      reason:
        "The plan is submitted for approval; an approver must reopen it before values can change",
    });
    const refused = await a.invoke(
      "plan.set-value",
      { item: "Brackets", month: "2027-06", value: 8 },
      { expectedRev: now.rev },
    );
    expect(refused.body.error.code).toBe("unavailable");
    // Writes without a revision are refused: every write presents what it read.
    const blind = await a.invoke("plan.submit", { planId: "acme-fy27-h1" });
    expect(blind.body.error.code).toBe("invalid_input");
  });

  it("a lost response is recovered by retrying with the same idempotency key; the edit applies once", async () => {
    const a = agent("bob", "acme");
    const rev = (await a.read()).rev;
    const first = await a.invoke(
      "plan.set-value",
      { item: "Widgets", month: "2027-04", value: 2222 },
      { expectedRev: rev, key: "lost-1" },
    );
    expect(first.body.status).toBe("ok");
    const historyLength = store.audit("acme").length;
    // The response never arrived; the agent retries the same call with the same key.
    const retry = await a.invoke(
      "plan.set-value",
      { item: "Widgets", month: "2027-04", value: 2222 },
      { expectedRev: rev, key: "lost-1" },
    );
    expect(retry.body).toEqual(first.body);
    expect(store.audit("acme")).toHaveLength(historyLength);
    expect(store.rev("acme")).toBe(rev + 1);
    // The same key for a different edit is a conflict, not a second operation.
    const other = await a.invoke(
      "plan.set-value",
      { item: "Widgets", month: "2027-04", value: 3 },
      { expectedRev: rev + 1, key: "lost-1" },
    );
    expect(other.body.error.code).toBe("conflict");
  });
});

describe("approval: preview, a person's approval, execution, receipt", () => {
  async function submitted() {
    const a = agent("bob", "acme");
    const rev = (await a.read()).rev;
    const s = await a.invoke("plan.submit", { planId: "acme-fy27-h1" }, { expectedRev: rev });
    expect(s.body.status).toBe("ok");
    return { a, rev: s.body.rev as number };
  }

  it("the agent's request becomes a page a person approves; the resume locks the plan and returns a receipt; the history tells one story", async () => {
    const { a, rev } = await submitted();
    const ask = await a.invoke("plan.approve", { planId: "acme-fy27-h1" }, { expectedRev: rev });
    expect(ask.body.status).toBe("needs_human");
    expect(ask.body.handoff.reason).toBe("approval_required");
    expect(ask.body.handoff.url).toMatch(`${BASE_URL}/approvals/`);
    const id = handoffIdOf(ask.body.handoff.url);
    expect(store.plan("acme")!.status).toBe("submitted");
    // Resuming before anyone approved runs nothing.
    const early = await a.resume(ask.body.handoff.resumeToken);
    expect(early.body.error.details.handoffStatus).toBe("open");
    // The approval page shows the exact call, the bound state, and who asked.
    const view = await getAXE().getHandoff(id, { tenant: "acme" });
    expect(view).toMatchObject({
      action: "plan.approve",
      status: "open",
      onBehalfOf: "bob",
      approval: {
        input: { planId: "acme-fy27-h1" },
        state: { planId: "acme-fy27-h1", rev, status: "submitted" },
        agent: { name: "PlanTestAgent", version: "1.0" },
      },
    });
    // bob is a planner on acme: he cannot approve his own agent's request.
    const bob = await person("bob", "acme");
    expect((await bob.post(`/approvals/${id}`, { decision: "approve" })).status).toBe(403);
    // alice, an approver, approves with her own session.
    const alice = await person("alice", "acme");
    const ok = await alice.post(`/approvals/${id}`, { decision: "approve" });
    expect(ok.body.view.status).toBe("approved");
    const done = await a.resume(ask.body.handoff.resumeToken);
    expect(done.body.status).toBe("ok");
    const receipt = done.body.output.receipt;
    expect(receipt).toMatchObject({
      operation: "plan.approve",
      planId: "acme-fy27-h1",
      requestedFor: "bob",
      actor: "agent for bob",
      approvedBy: "alice",
      revBefore: rev,
      revAfter: rev + 1,
      changes: [{ field: "status", from: "submitted", to: "locked" }],
    });
    expect(JSON.stringify(receipt)).not.toMatch(/demo-agent|plan_review_session/);
    expect(store.plan("acme")!.status).toBe("locked");
    // A lost response to the resume: the same token returns the same receipt; nothing runs again.
    expect((await a.resume(ask.body.handoff.resumeToken)).body).toEqual(done.body);
    await flush();
    const story = store.audit("acme").map((e) => `${e.actor}: ${e.event}`);
    expect(story).toEqual([
      "agent for bob: plan.submit",
      "agent for bob: approval.requested",
      "alice: approval.approved",
      "agent for bob: plan.lock",
    ]);
    // The approved plan can be undone only by the app's own action: an approver reopens it.
    expect((await a.state()).body.actions["plan.set-value"].available).toBe(false);
    const reopened = await alice.post("/plan/reopen", { expectedRev: rev + 1 });
    expect(reopened.status).toBe(200);
    expect(store.plan("acme")!.status).toBe("draft");
  });

  it("an agent's confirm or approve flag is not consent", async () => {
    const { a, rev } = await submitted();
    const ask = await a.invoke(
      "plan.approve",
      { planId: "acme-fy27-h1", confirm: true, approved: true },
      { expectedRev: rev },
    );
    expect(ask.body.status).toBe("needs_human");
    const r = await a.resume(ask.body.handoff.resumeToken, {
      confirm: true,
      approved: true,
      approvedBy: "alice",
    });
    expect(r.body.error.details.handoffStatus).toBe("open");
    expect(store.plan("acme")!.status).toBe("submitted");
  });

  it("a change to the plan after the request voids the approval; the agent is told to ask again", async () => {
    const { a, rev } = await submitted();
    const ask = await a.invoke("plan.approve", { planId: "acme-fy27-h1" }, { expectedRev: rev });
    const id = handoffIdOf(ask.body.handoff.url);
    const alice = await person("alice", "acme");
    // alice reopens and edits: the plan the agent asked about is gone.
    await alice.post("/plan/reopen", { expectedRev: rev });
    const approve = await alice.post(`/approvals/${id}`, { decision: "approve" });
    expect(approve.status).toBe(409);
    expect(approve.body.reason).toBe("state_changed");
    const r = await a.resume(ask.body.handoff.resumeToken);
    expect(r.body.error).toMatchObject({
      code: "conflict",
      retryable: false,
      details: { handoffStatus: "invalidated" },
    });
    // Approved first, then changed: refused at resume, nothing runs.
    const s2 = await a.invoke("plan.submit", { planId: "acme-fy27-h1" }, { expectedRev: rev + 1 });
    const ask2 = await a.invoke(
      "plan.approve",
      { planId: "acme-fy27-h1" },
      { expectedRev: s2.body.rev },
    );
    const id2 = handoffIdOf(ask2.body.handoff.url);
    expect((await alice.post(`/approvals/${id2}`, { decision: "approve" })).status).toBe(200);
    await alice.post("/plan/reopen", { expectedRev: s2.body.rev });
    const r2 = await a.resume(ask2.body.handoff.resumeToken);
    expect(r2.body.error.details.handoffStatus).toBe("invalidated");
    expect(store.plan("acme")!.status).toBe("draft");
    await flush();
    expect(store.audit("acme").filter((e) => e.event === "approval.invalidated")).toHaveLength(2);
  });

  it("takeover: freezing cancels waiting and approved requests and pauses agents; committed work is undone only by reopening", async () => {
    const { a, rev } = await submitted();
    const ask = await a.invoke("plan.approve", { planId: "acme-fy27-h1" }, { expectedRev: rev });
    const id = handoffIdOf(ask.body.handoff.url);
    const alice = await person("alice", "acme");
    await alice.post(`/approvals/${id}`, { decision: "approve" });
    expect((await alice.post("/plan/freeze", { frozen: true })).status).toBe(200);
    const r = await a.resume(ask.body.handoff.resumeToken);
    expect(r.body.error).toMatchObject({
      code: "conflict",
      details: { handoffStatus: "cancelled" },
    });
    const st = (await a.state()).body;
    expect(st.actions["plan.approve"]).toEqual({
      available: false,
      reason: "alice froze the plan; agents cannot change it until a person unfreezes it",
    });
    // A person can still act while agents are paused.
    expect((await alice.post("/plan/lock", { expectedRev: st.rev })).status).toBe(200);
    expect((await alice.post("/plan/freeze", { frozen: false })).status).toBe(200);
    // A lock that already ran cannot be cancelled; the undo is reopening.
    const view = await getAXE().getHandoff(id, { tenant: "acme" });
    expect(view!.status).toBe("cancelled");
    expect(store.plan("acme")!.status).toBe("locked");
  });

  it("the person who asked, or an approver, can cancel a request; the agent is told and nothing runs", async () => {
    const { a, rev } = await submitted();
    const ask = await a.invoke("plan.approve", { planId: "acme-fy27-h1" }, { expectedRev: rev });
    const id = handoffIdOf(ask.body.handoff.url);
    const bob = await person("bob", "acme");
    const c = await bob.post(`/approvals/${id}`, { decision: "cancel", reason: "wrong half" });
    expect(c.body.view.status).toBe("cancelled");
    const r = await a.resume(ask.body.handoff.resumeToken);
    expect(r.body.error.details.handoffStatus).toBe("cancelled");
    expect(store.plan("acme")!.status).toBe("submitted");
    await flush();
    // The cancellation reason stays with the request, out of the history and the events.
    expect(JSON.stringify(store.audit("acme"))).not.toContain("wrong half");
  });

  it("an expired approval request is refused and the agent is told to start again", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-01-04T09:00:00Z"));
    const { a, rev } = await submitted();
    const ask = await a.invoke("plan.approve", { planId: "acme-fy27-h1" }, { expectedRev: rev });
    const id = handoffIdOf(ask.body.handoff.url);
    const alice = await person("alice", "acme");
    await alice.post(`/approvals/${id}`, { decision: "approve" });
    vi.setSystemTime(new Date("2027-01-04T10:00:01Z"));
    const r = await a.resume(ask.body.handoff.resumeToken);
    expect(r.body.error.code).toBe("not_found");
    expect(r.body.error.message).toContain("start the action again");
    expect((await alice.post(`/approvals/${id}`, { decision: "approve" })).status).toBe(404);
    expect(store.plan("acme")!.status).toBe("submitted");
  });
});

describe("reconnect", () => {
  it("a new AXE client re-discovers the site and continues the approved request", async () => {
    const token = agentTokenFor("bob", "acme");
    const routed = (input: RequestInfo | URL, init?: RequestInit) =>
      getAXE().handle(new Request(input as string, init));
    const first = await AXEClient.discover(BASE_URL, { auth: token, fetch: routed });
    const rev = ((await first.invoke("plan.read", {})) as Json).rev;
    const sub = (await first.invoke(
      "plan.submit",
      { planId: "acme-fy27-h1" },
      { expectedRev: rev },
    )) as Json;
    const ask = (await first.invoke(
      "plan.approve",
      { planId: "acme-fy27-h1" },
      { expectedRev: sub.rev },
    )) as Json;
    expect(ask.status).toBe("needs_human");
    // The agent process goes away with only the resume token saved. A person approves meanwhile.
    const alice = await person("alice", "acme");
    await alice.post(`/approvals/${handoffIdOf(ask.handoff.url)}`, { decision: "approve" });
    const second = await AXEClient.discover(BASE_URL, { auth: token, fetch: routed });
    const done = (await second.resume(ask.handoff.resumeToken)) as Json;
    expect(done.status).toBe("ok");
    expect(done.output.receipt.approvedBy).toBe("alice");
  });

  it("an MCP client reconnects on a new connection and resumes with axe_resume", async () => {
    const token = agentTokenFor("bob", "acme");
    const connect = async () => {
      const derived = await createMcpServer(getAXE(), { client: { auth: token } });
      const [c, s] = InMemoryTransport.createLinkedPair();
      await derived.server.connect(s);
      const client = new Client({ name: "reconnect-test", version: "0" });
      await client.connect(c);
      return client;
    };
    const text = (r: Json) =>
      (r.content as { text?: string }[]).map((c) => c.text ?? "").join("\n");
    const one = await connect();
    const tools = (await one.listTools()).tools.map((t) => t.name);
    expect(tools).toEqual(
      expect.arrayContaining([
        "plan_read",
        "plan_set-value",
        "plan_submit",
        "plan_approve",
        "axe_resume",
      ]),
    );
    const rev = store.rev("acme");
    await one.callTool({
      name: "plan_submit",
      arguments: { planId: "acme-fy27-h1", expectedRev: rev },
    });
    const asked = text(
      await one.callTool({
        name: "plan_approve",
        arguments: { planId: "acme-fy27-h1", expectedRev: rev + 1 },
      }),
    );
    const resumeToken = /resumeToken "([^"]+)"/.exec(asked)![1]!;
    const url = /Send them to: (\S+)/.exec(asked)![1]!;
    await one.close();
    const alice = await person("alice", "acme");
    await alice.post(`/approvals/${handoffIdOf(url)}`, { decision: "approve" });
    const two = await connect();
    const done = text(await two.callTool({ name: "axe_resume", arguments: { resumeToken } }));
    expect(done).toContain('"approvedBy": "alice"');
    expect(store.plan("acme")!.status).toBe("locked");
    await two.close();
  });
});

describe("execution modes", () => {
  it("the built @summationai/axe-surface/react uses @summationai/axe-surface's registry instead of carrying a second one", () => {
    // Before the fix, dist/react.js inlined index.ts: the hooks' default target was a second
    // module-level surface that `surface.expose(window)` never showed.
    const dist = dirname(createRequire(import.meta.url).resolve("@summationai/axe-surface/react"));
    for (const [file, index] of [
      ["react.js", "./index.js"],
      ["react.cjs", "./index.cjs"],
    ] as const) {
      const code = readFileSync(join(dist, file), "utf8");
      expect(code, file).toContain(index);
      expect(code, file).not.toMatch(/function createSurface\(/);
    }
  });

  it("browser-local capabilities are never served over HTTP: the page's registry and the server's actions are separate", async () => {
    // A page instance registers a browser-local control. In a browser this runs in the tab.
    pageSurface.register({
      id: "scroll:2027-03",
      kind: "action",
      role: "button",
      name: "Scroll to March 2027",
      effect: { mutates: "view", risk: "low", reversible: true, idempotent: true },
      handler: () => undefined,
    });
    try {
      const manifest = await axeFetch("/.well-known/axe.json", {
        headers: { authorization: `Bearer ${agentTokenFor("bob", "acme")}` },
      });
      const names = (manifest.body.actions as Json[]).map((x) => x.name);
      expect(names).toEqual([
        "plan.read",
        "plan.set-value",
        "plan.submit",
        "plan.approve",
        "plan.history",
      ]);
      expect(JSON.stringify(manifest.body)).not.toContain("Scroll to");
      const tryIt = await agent("bob", "acme").invoke("page.scroll-2027-03", {});
      expect(tryIt.body.error.code).toBe("not_found");
    } finally {
      pageSurface.unregister("scroll:2027-03");
    }
  });
});
