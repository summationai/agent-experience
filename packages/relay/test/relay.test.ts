// End to end over real transports: a jsdom page runs a Surface and connectRelay (the bundled
// browser client over the window's own WebSocket) against a relay listening on a free loopback
// port, and the MCP SDK's Client calls the relay's tools over Streamable HTTP.
import { afterEach, describe, expect, it } from "vitest";
import { mintRelayToken } from "../src/token";
import {
  APP_ORIGIN,
  SECRET,
  SENSITIVE_VALUE,
  httpAgent,
  openPage,
  registerPlan,
  startRelay,
  until,
  noJsdom,
} from "./helpers";
import type { Agent, Page, Running } from "./helpers";

const cleanup: (() => unknown)[] = [];
afterEach(async () => {
  while (cleanup.length) await Promise.resolve(cleanup.pop()!()).catch(() => undefined);
});

async function relay(options: Parameters<typeof startRelay>[0] = {}): Promise<Running> {
  const r = await startRelay(options);
  cleanup.push(() => r.relay.close());
  return r;
}

async function page(options: Parameters<typeof openPage>[0] = {}): Promise<Page> {
  const p = await openPage(options);
  cleanup.push(() => p.close());
  registerPlan(p);
  return p;
}

async function agent(r: Running, token: string): Promise<Agent> {
  const a = await httpAgent(r.address.mcpUrl, token);
  cleanup.push(() => a.close());
  return a;
}

const tokenFor = (principal: string, tenant = "acme", ttl = 600) =>
  mintRelayToken({ principal, tenant, ttl }, SECRET);

async function connected(r: Running, p: Page, principal = "alice", tenant = "acme") {
  const conn = p.connect({ url: r.address.tabUrl, getToken: () => tokenFor(principal, tenant) });
  await p.status((s) => s.state === "connected");
  // The relay has the tab's first snapshot.
  await until(() => r.relay.tabs({ principal, tenant })[0]?.rev !== undefined);
  return conn;
}

describe.skipIf(noJsdom)("relay: list, observe, act", () => {
  it("reports the live Surface profile and refuses a connector/profile mismatch", async () => {
    const matching = await relay({ application: { id: "plan-app", name: "Plan App" } });
    const matchingPage = await page();
    matchingPage.surface.setProfile({
      id: "plan-app",
      name: "Plan App",
      authentication: { state: "signed-in" },
      context: { kind: "workspace", id: "acme", name: "Acme" },
    });
    await connected(matching, matchingPage);
    const a = await agent(matching, "agent-alice");
    const listed = await a.call("relay_tabs");
    expect((listed.result.output?.["tabs"] as Record<string, unknown>[])[0]).toMatchObject({
      application: {
        id: "plan-app",
        name: "Plan App",
        authentication: { state: "signed-in" },
        context: { kind: "workspace", id: "acme", name: "Acme" },
      },
    });

    const mismatching = await relay({ application: { id: "expected-app" } });
    const wrongPage = await page();
    wrongPage.surface.setProfile({ id: "wrong-app", name: "Wrong App" });
    wrongPage.connect({
      url: mismatching.address.tabUrl,
      getToken: () => tokenFor("bob", "acme"),
    });
    await until(
      () => mismatching.relay.tabs({ principal: "bob", tenant: "acme" })[0]?.state === "stopped",
    );
    expect(mismatching.relay.tabs({ principal: "bob", tenant: "acme" })[0]).toMatchObject({
      state: "stopped",
    });
  });

  it("an agent lists the person's tab, observes it, and acts; the page's own handler runs and the ledger names the agent", async () => {
    const r = await relay();
    const p = await page();
    await connected(r, p);
    const a = await agent(r, "agent-alice");

    const tools = (await a.client.listTools()).tools.map((t) => t.name);
    expect(tools).toEqual(
      expect.arrayContaining([
        "relay_tabs",
        "relay_select-tab",
        "surface_observe",
        "surface_ledger",
        "surface_set-field",
        "surface_run-control",
        "surface_load-more",
      ]),
    );
    expect(tools).not.toContain("relay_pair");

    const tabs = await a.call("relay_tabs");
    const listed = tabs.result.output!["tabs"] as {
      tabId: string;
      title: string;
      origin: string;
      state: string;
    }[];
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ title: "Plan", origin: APP_ORIGIN, state: "connected" });

    const seen = await a.call("surface_observe");
    expect(seen.result.status).toBe("ok");
    const view = seen.result.output as { rev: number; entries: { id: string }[] };
    expect(view.entries.map((e) => e.id)).toEqual([
      "plan:name",
      "account:token",
      "plan:submit",
      "plan:delete",
      "plan:rows",
    ]);

    const done = await a.call("surface_run-control", {
      entryId: "plan:submit",
      expectedRev: view.rev,
    });
    expect(done.result.status, done.text).toBe("ok");
    expect(p.calls).toEqual(["submit:alice (agent via relay)"]);
    expect(done.result.output).toMatchObject({
      id: "plan:submit",
      actor: "alice (agent via relay)",
      rev: view.rev + 1,
    });

    const set = await a.call("surface_set-field", {
      entryId: "plan:name",
      text: "Q4 plan",
      expectedRev: view.rev + 1,
    });
    expect(set.result.status, set.text).toBe("ok");
    expect(p.surface.get("plan:name")).toMatchObject({ value: "Q4 plan" });

    const more = await a.call("surface_load-more", {
      entryId: "plan:rows",
      expectedRev: view.rev + 2,
    });
    expect(more.result.status, more.text).toBe("ok");

    // The tab's own ledger has every act with the agent's actor; the relay's ledger tool mirrors it.
    expect(p.surface.ledger().map((e) => [e.target, e.actor, e.status])).toEqual([
      ["plan:submit", "alice (agent via relay)", "ok"],
      ["plan:name", "alice (agent via relay)", "ok"],
      ["plan:rows", "alice (agent via relay)", "ok"],
    ]);
    const ledger = await a.call("surface_ledger");
    const entries = ledger.result.output!["entries"] as { target: string; actor: string }[];
    expect(entries.map((e) => e.target)).toEqual(["plan:submit", "plan:name", "plan:rows"]);
    // The page shows the indicator, now in its acting state.
    await p.status((s) => s.state === "acting");
    expect(p.indicator()?.textContent).toContain("An agent is acting in this tab");
    expect(p.indicator()?.querySelector('[data-action="stop"]')).not.toBeNull();
    // Its host is marked so an auto-derived surface never reads the person's Stop/Approve/Deny.
    expect(
      p.window.document
        .querySelector("[data-axe-relay-indicator]")
        ?.hasAttribute("data-surface-ignore"),
    ).toBe(true);
  });
});

describe.skipIf(noJsdom)("relay: zero-backend browser handoff", () => {
  it("defers login until relay_tabs and resumes the same session after identity changes", async () => {
    const identities = new Map<string, { principal: string; tenant: string }>();
    let loginSession: string | undefined;
    const r = await relay({
      deferredAgentAuth: {
        identify: (sessionId) => identities.get(sessionId) ?? null,
        login: (sessionId) => {
          loginSession = sessionId;
          return { url: "https://relay.example/login" };
        },
      },
      handoff: { appUrl: `${APP_ORIGIN}/plan`, pageUrl: "https://relay.example" },
    });
    const a = await httpAgent(r.address.mcpUrl);
    cleanup.push(() => a.close());
    expect(loginSession).toBeUndefined();

    const offered = await a.call("relay_tabs");
    expect(offered.result.status).toBe("needs_human");
    expect(loginSession).toBeTruthy();
    const loginHandoff = offered.result as unknown as {
      handoff: { reason: string; resumeToken: string };
    };
    expect(loginHandoff.handoff.reason).toBe("application_login_required");

    const who = { principal: "alice", tenant: "acme" };
    identities.set(loginSession!, who);
    const browserUrl = r.relay.browserHandoff(who)!;
    const handoffToken = new URL(browserUrl).pathname.split("/").at(-1)!;
    const exchange = await fetch(new URL("/connect/exchange", r.address.url), {
      method: "POST",
      headers: { Origin: APP_ORIGIN, "Content-Type": "text/plain;charset=UTF-8" },
      body: handoffToken,
    });
    const session = (await exchange.json()) as { token: string };
    const p = await page();
    p.connect({ url: r.address.tabUrl, token: session.token });
    await p.status((status) => status.state === "connected");

    const resumed = await a.call("axe_resume", {
      resumeToken: loginHandoff.handoff.resumeToken,
    });
    expect(resumed.result.status, resumed.text).toBe("ok");
    expect(resumed.result.output?.["principal"]).toBe("alice");
    expect(resumed.result.output?.["tabs"]).toHaveLength(1);
  });

  it("opens the app and exchanges a one-time agent-bound link for a tab session", async () => {
    const r = await relay({
      handoff: {
        appUrl: `${APP_ORIGIN}/plan`,
        pageUrl: "https://relay.example",
        linkTtlMs: 60_000,
      },
    });
    const a = await agent(r, "agent-alice");

    const offered = await a.call("relay_tabs");
    expect(offered.result.status).toBe("needs_human");
    const handoff = (offered.result as unknown as { handoff: { url: string } }).handoff;
    const path = new URL(handoff.url).pathname;
    expect(path).toMatch(/^\/connect\/[A-Za-z0-9_-]+$/);

    const landing = await fetch(new URL(path, r.address.url));
    expect(landing.status).toBe(200);
    const html = await landing.text();
    expect(html).toContain("summationai-axe-relay-handoff:");
    expect(html).toContain(`${APP_ORIGIN}/plan`);
    const token = path.split("/").at(-1)!;

    const exchange = await fetch(new URL("/connect/exchange", r.address.url), {
      method: "POST",
      headers: { Origin: APP_ORIGIN, "Content-Type": "text/plain;charset=UTF-8" },
      body: token,
    });
    expect(exchange.status).toBe(200);
    const session = (await exchange.json()) as { token: string };
    expect(session.token).toBeTruthy();
    expect(
      (
        await fetch(new URL("/connect/exchange", r.address.url), {
          method: "POST",
          headers: { Origin: APP_ORIGIN, "Content-Type": "text/plain;charset=UTF-8" },
          body: token,
        })
      ).status,
    ).toBe(403);

    const p = await page();
    p.connect({ url: r.address.tabUrl, token: session.token });
    await p.status((status) => status.state === "connected");
    const tabs = await a.call("relay_tabs");
    expect(tabs.result.status).toBe("ok");
    expect(tabs.result.output!["tabs"]).toHaveLength(1);
  });

  it("lets the installed browser helper consume a handoff without application backend code", async () => {
    const r = await relay({
      handoff: { appUrl: `${APP_ORIGIN}/plan`, pageUrl: "https://relay.example" },
    });
    const a = await agent(r, "agent-alice");
    const offered = await a.call("relay_tabs");
    const path = new URL((offered.result as unknown as { handoff: { url: string } }).handoff.url)
      .pathname;
    const handoffToken = path.split("/").at(-1)!;
    const p = await page({
      storage: {
        "axe-relay:handoff": JSON.stringify({ service: r.address.url, handoffToken }),
      },
    });
    (p.window as unknown as { fetch: typeof fetch }).fetch = (input, init) =>
      fetch(input, {
        ...init,
        headers: { ...Object.fromEntries(new Headers(init?.headers)), Origin: APP_ORIGIN },
      });
    const options = p.api.injectedRelay();
    expect(options).not.toBeNull();
    p.connect(options!);
    await p.status((status) => status.state === "connected");
    expect((await a.call("relay_tabs")).result.status).toBe("ok");
  });
});

async function observe(a: Agent): Promise<{
  rev: number;
  entries: { id: string; name: string }[];
  objects: Record<string, unknown>;
}> {
  const r = await a.call("surface_observe");
  expect(r.result.status, r.text).toBe("ok");
  return r.result.output as never;
}

describe.skipIf(noJsdom)("relay: the page's surface decides", () => {
  it("a stale revision is a conflict and applies nothing, including a person's change between observe and act", async () => {
    const r = await relay();
    const p = await page();
    await connected(r, p);
    const a = await agent(r, "agent-alice");
    const first = await observe(a);
    // The person changes something in the page: the revision moves.
    p.surface.bump();
    const stale = await a.call("surface_run-control", {
      entryId: "plan:submit",
      expectedRev: first.rev,
    });
    expect(stale.result.status).toBe("error");
    expect(stale.result.error!.code).toBe("conflict");
    expect(p.calls).toEqual([]);
    const again = await observe(a);
    expect(again.rev).toBeGreaterThan(first.rev);
    const ok = await a.call("surface_run-control", {
      entryId: "plan:submit",
      expectedRev: again.rev,
    });
    expect(ok.result.status, ok.text).toBe("ok");
    // Presenting the same revision twice cannot apply twice.
    const twice = await a.call("surface_run-control", {
      entryId: "plan:submit",
      expectedRev: again.rev,
    });
    expect(twice.result.error!.code).toBe("conflict");
    expect(p.calls).toEqual(["submit:alice (agent via relay)"]);
  });

  it("an unavailable control is refused with the application's reason", async () => {
    const r = await relay();
    const p = await page();
    p.surface.register({
      id: "plan:lock",
      kind: "action",
      role: "button",
      name: "Lock the plan",
      state: { available: false, reason: "the plan has unsaved changes" },
      effect: { mutates: "plan" },
      handler: () => p.calls.push("lock"),
    });
    await connected(r, p);
    const a = await agent(r, "agent-alice");
    const v = await observe(a);
    const res = await a.call("surface_run-control", { entryId: "plan:lock", expectedRev: v.rev });
    expect(res.result.error!.code).toBe("unavailable");
    expect(res.text).toContain("the plan has unsaved changes");
    expect(p.calls).toEqual([]);
  });

  it("a high-risk act waits for the person's approval in the page; Deny refuses it", async () => {
    const r = await relay();
    const p = await page();
    await connected(r, p);
    const a = await agent(r, "agent-alice");
    const v = await observe(a);
    const args = { entryId: "plan:delete", expectedRev: v.rev };
    const asked = await a.call("surface_run-control", args);
    expect(asked.result.status).toBe("error");
    expect(asked.result.error!.code).toBe("unavailable");
    expect(asked.result.error!.details!["reason"]).toBe("approval_required");
    expect(asked.text).toContain("needs the person's approval");
    expect(p.calls).toEqual([]);
    // The page shows the request with the control's own name.
    const pending = await p.status((s) => s.approvals.length === 1);
    expect(pending.approvals[0]).toMatchObject({ entryId: "plan:delete", name: "Delete the plan" });
    expect(p.indicator()?.textContent).toContain("The agent asks to: Delete the plan");
    // Asking again before the person decides changes nothing.
    const still = await a.call("surface_run-control", args);
    expect(still.result.error!.details!["reason"]).toBe("approval_required");
    expect(p.calls).toEqual([]);
    p.click('[data-action="approve"]');
    const ran = await a.call("surface_run-control", args);
    expect(ran.result.status, ran.text).toBe("ok");
    expect(p.calls).toEqual(["delete:alice (agent via relay)"]);
    // An approval is used once: the next delete asks again, and Deny refuses it.
    const v2 = await observe(a);
    const args2 = { entryId: "plan:delete", expectedRev: v2.rev };
    expect((await a.call("surface_run-control", args2)).result.error!.details!["reason"]).toBe(
      "approval_required",
    );
    await p.status((s) => s.approvals.length === 1);
    p.click('[data-action="deny"]');
    const denied = await a.call("surface_run-control", args2);
    expect(denied.result.error!.code).toBe("forbidden");
    expect(denied.result.error!.details!["reason"]).toBe("approval_denied");
    expect(p.calls).toEqual(["delete:alice (agent via relay)"]);
    // An approval is bound to the revision it was asked at: when the page moves on before the
    // person approves, the approval does not carry over to an act at the new revision.
    const v3 = await observe(a);
    await a.call("surface_run-control", { entryId: "plan:delete", expectedRev: v3.rev });
    const open = await p.status((s) => s.approvals.length === 1);
    p.surface.bump();
    p.click('[data-action="approve"]');
    const v4 = await observe(a);
    const rebound = await a.call("surface_run-control", {
      entryId: "plan:delete",
      expectedRev: v4.rev,
    });
    expect(rebound.result.error!.details!["reason"]).toBe("approval_required");
    expect(open.approvals[0]!.id).not.toBe(
      (
        await p.status(
          (s) => s.approvals.length === 1 && s.approvals[0]!.id !== open.approvals[0]!.id,
        )
      ).approvals[0]!.id,
    );
    expect(p.calls).toEqual(["delete:alice (agent via relay)"]);
  });

  it("Stop in the page disconnects, refuses every later act, and revokes the token", async () => {
    const events: string[] = [];
    const r = await relay({ onEvent: (e) => events.push(e.type) });
    const p = await page();
    const token = await tokenFor("alice");
    p.connect({ url: r.address.tabUrl, token });
    await p.status((s) => s.state === "connected");
    const a = await agent(r, "agent-alice");
    const v = await observe(a);
    p.click('[data-action="stop"]');
    await p.status((s) => s.state === "stopped");
    expect(p.indicator()).toBeNull();
    await until(() => r.relay.tabs({ principal: "alice", tenant: "acme" })[0]?.state === "stopped");
    const refused = await a.call("surface_run-control", {
      entryId: "plan:submit",
      expectedRev: v.rev,
    });
    expect(refused.result.error!.code).toBe("forbidden");
    expect(refused.text).toContain("stopped agent access");
    expect(p.calls).toEqual([]);
    expect(events).toContain("tab.stopped");
    // The same token cannot connect the tab again.
    const p2 = await page();
    p2.connect({ url: r.address.tabUrl, token });
    const s = await p2.status((x) => x.state === "refused");
    expect(s.reason).toContain("invalid or expired");
  });

  it("framework cleanup disconnects without revoking the tab or its token", async () => {
    const events: string[] = [];
    const r = await relay({ onEvent: (e) => events.push(e.type) });
    const p = await page();
    const token = await tokenFor("alice");
    const connection = p.connect({ url: r.address.tabUrl, token });
    await p.status((s) => s.state === "connected");
    const tabId = connection.tabId;

    connection.disconnect();
    await p.status((s) => s.state === "disconnected");
    await until(
      () => r.relay.tabs({ principal: "alice", tenant: "acme" })[0]?.state === "reconnecting",
    );
    expect(events).toContain("tab.disconnected");
    expect(events).not.toContain("tab.stopped");

    const reconnected = p.connect({ url: r.address.tabUrl, token });
    await p.status((s) => s.state === "connected");
    expect(reconnected.tabId).toBe(tabId);
    expect(r.relay.tabs({ principal: "alice", tenant: "acme" })).toHaveLength(1);
  });

  it("a reloaded page reattaches to the same tab, and a revision observed before the reload is refused", async () => {
    const r = await relay();
    const p = await page();
    const conn = await connected(r, p);
    const a = await agent(r, "agent-alice");
    const start = await observe(a);
    expect(
      (await a.call("surface_run-control", { entryId: "plan:submit", expectedRev: start.rev }))
        .result.status,
    ).toBe("ok");
    const before = await observe(a);
    const tabId = conn.tabId;
    // Reload: the page unloads, and a new page instance with the same sessionStorage starts
    // a new surface at rev 0.
    p.window.dispatchEvent(new p.window.Event("pagehide"));
    await until(
      () => r.relay.tabs({ principal: "alice", tenant: "acme" })[0]?.state === "reconnecting",
    );
    const reloaded = await page({ storage: { "axe-relay:tab-id": tabId } });
    const conn2 = await connected(r, reloaded);
    expect(conn2.tabId).toBe(tabId);
    expect(r.relay.tabs({ principal: "alice", tenant: "acme" })).toHaveLength(1);
    const old = await a.call("surface_run-control", {
      entryId: "plan:submit",
      expectedRev: before.rev,
    });
    expect(old.result.error!.code).toBe("conflict");
    expect(reloaded.calls).toEqual([]);
    const after = await observe(a);
    expect(after.rev).toBeGreaterThan(before.rev);
    const ok = await a.call("surface_run-control", {
      entryId: "plan:submit",
      expectedRev: after.rev,
    });
    expect(ok.result.status, ok.text).toBe("ok");
    expect(reloaded.calls).toEqual(["submit:alice (agent via relay)"]);
    // The ledger the agent reads continues across the reload: the entry from before it, then the
    // act on the new page, with a sequence number that keeps increasing. The stale act was
    // refused by the runtime's own revision check before it reached the page [S-AXE-4]; the bridge
    // records that refusal on the caller's surface ([S-AXE-14]), and the relay forwards it to the
    // page, so it is in the new page's ledger too, marked `source: "server"`.
    const ledger = await a.call("surface_ledger");
    const rows = ledger.result.output!["entries"] as {
      seq: number;
      status: string;
      source?: string;
    }[];
    expect(rows.map((e) => e.status)).toEqual(["ok", "conflict", "ok"]);
    expect(rows[1]!.source).toBe("server");
    expect(rows[2]!.seq).toBeGreaterThan(rows[1]!.seq);
    expect(rows[1]!.seq).toBeGreaterThan(rows[0]!.seq);
    // The new page's own ledger holds only what happened on it: the refusal, then the act.
    expect(reloaded.surface.ledger().map((e) => e.status)).toEqual(["conflict", "ok"]);
  });

  it("an act sent while the tab is reloading waits for it and runs on the new page", async () => {
    const r = await relay();
    const p = await page();
    const conn = await connected(r, p);
    const a = await agent(r, "agent-alice");
    await observe(a);
    p.window.dispatchEvent(new p.window.Event("pagehide"));
    await until(
      () => r.relay.tabs({ principal: "alice", tenant: "acme" })[0]?.state === "reconnecting",
    );
    // The agent's list says the tab is reconnecting; its next read waits for the new page.
    const reading = observe(a);
    const reloaded = await page({ storage: { "axe-relay:tab-id": conn.tabId } });
    await connected(r, reloaded);
    const v = await reading;
    expect(v.entries.map((e) => e.id)).toContain("plan:submit");
  });
});

describe.skipIf(noJsdom)("relay: who reaches which tab", () => {
  it("two principals are isolated: one agent cannot list, select, observe, or act on another person's tab", async () => {
    const r = await relay();
    const pa = await page();
    const pb = await page({ url: `${APP_ORIGIN}/other` });
    pb.surface.register({
      id: "bob:only",
      kind: "action",
      role: "button",
      name: "Bob's control",
      effect: { mutates: "bob" },
      handler: () => pb.calls.push("bob"),
    });
    await connected(r, pa, "alice");
    const connB = await connected(r, pb, "bob");
    const alice = await agent(r, "agent-alice");
    const bob = await agent(r, "agent-bob");
    const aliceTabs = (await alice.call("relay_tabs")).result.output!["tabs"] as {
      tabId: string;
      path: string;
    }[];
    expect(aliceTabs.map((t) => t.path)).toEqual(["/plan"]);
    const bobTabs = (await bob.call("relay_tabs")).result.output!["tabs"] as {
      tabId: string;
      path: string;
    }[];
    expect(bobTabs.map((t) => t.tabId)).toEqual([connB.tabId]);
    const pick = await alice.call("relay_select-tab", { tabId: connB.tabId });
    expect(pick.result.error!.code).toBe("not_found");
    const v = await observe(alice);
    expect(v.entries.map((e) => e.id)).not.toContain("bob:only");
    const act = await alice.call("surface_run-control", {
      entryId: "bob:only",
      expectedRev: v.rev,
    });
    expect(act.result.error!.code).toBe("not_found");
    expect(pb.calls).toEqual([]);
  });

  it("a tab of a tenant the relay does not serve is refused, and an agent of another tenant sees none of the person's tabs", async () => {
    const events: { type: string; reason?: string }[] = [];
    const r = await relay({ tenants: ["acme", "globex"], onEvent: (e) => events.push(e) });
    const wrong = await page();
    wrong.connect({ url: r.address.tabUrl, token: await tokenFor("alice", "initech") });
    const s = await wrong.status((x) => x.state === "refused");
    expect(s.reason).toContain("tenant");
    const p = await page();
    await connected(r, p, "alice", "acme");
    // The same person signed in to another tenant is another principal to the relay.
    const other = await agent(r, "agent-alice-globex");
    const tabs = await other.call("relay_tabs");
    expect(tabs.result.output!["tabs"]).toEqual([]);
    const v = await observe(other);
    expect(v.entries).toEqual([]);
    expect(JSON.stringify(v.objects)).toContain("No browser tab is connected");
    const act = await other.call("surface_run-control", {
      entryId: "plan:submit",
      expectedRev: v.rev,
    });
    expect(act.result.status).toBe("error");
    expect(p.calls).toEqual([]);
  });

  it("an expired token, a token signed with another key, and a token for another audience are refused", async () => {
    const r = await relay();
    const expired = await mintRelayToken(
      { principal: "alice", tenant: "acme", ttl: 60, now: Date.now() - 3_600_000 },
      SECRET,
    );
    const forged = await mintRelayToken(
      { principal: "alice", tenant: "acme" },
      "another-secret-0123456789abcdef-0123456",
    );
    const audience = await mintRelayToken(
      { principal: "alice", tenant: "acme", audience: "billing" },
      SECRET,
    );
    for (const token of [expired, forged, audience]) {
      const p = await page();
      p.connect({ url: r.address.tabUrl, token });
      const s = await p.status((x) => x.state === "refused");
      expect(s.reason).toContain("invalid or expired");
    }
    expect(r.relay.tabs({ principal: "alice", tenant: "acme" })).toEqual([]);
  });

  it("a page from an origin outside the allowlist cannot connect a tab", async () => {
    const refused: string[] = [];
    const r = await relay({
      origins: ["https://*.example.com", "http://localhost:*"],
      onEvent: (e) => e.type === "tab.refused" && refused.push(e.reason),
    });
    const evil = await page({ url: "http://evil.test:5173/plan" });
    const conn = evil.connect({ url: r.address.tabUrl, token: await tokenFor("alice") });
    await until(() => refused.length > 0);
    expect(refused[0]).toContain("origin http://evil.test:5173 is not allowed");
    conn.stop();
    expect(r.relay.tabs({ principal: "alice", tenant: "acme" })).toEqual([]);
    // Any port on localhost is allowed by the pattern.
    const ok = await page({ url: "http://localhost:3999/plan" });
    await connected(r, ok);
  });

  it("several tabs: the default is the most recently active and stays pinned; relay_select-tab chooses another, whose revisions differ", async () => {
    const r = await relay();
    const first = await page({ url: `${APP_ORIGIN}/first` });
    const second = await page({ url: `${APP_ORIGIN}/second` });
    const c1 = await connected(r, first);
    await until(() => r.relay.tabs({ principal: "alice", tenant: "acme" }).length === 1);
    const c2 = await connected(r, second);
    await until(() => r.relay.tabs({ principal: "alice", tenant: "acme" }).length === 2);
    // The second tab is the most recently active.
    const a = await agent(r, "agent-alice");
    const v2 = await observe(a);
    const listed = (await a.call("relay_tabs")).result.output!["tabs"] as {
      tabId: string;
      selected: boolean;
    }[];
    expect(listed.find((t) => t.selected)?.tabId).toBe(c2.tabId);
    // Activity in the first tab does not move an agent that already acted on the second.
    first.window.dispatchEvent(new first.window.Event("focus"));
    await until(() => r.relay.tabs({ principal: "alice", tenant: "acme" })[0]?.tabId === c1.tabId);
    expect((await observe(a)).rev).toBe(v2.rev);
    const chosen = await a.call("relay_select-tab", { tabId: c1.tabId });
    expect(chosen.result.status, chosen.text).toBe("ok");
    const v1 = await observe(a);
    expect(v1.rev).not.toBe(v2.rev);
    // A revision read from the second tab never passes the first tab's check.
    const cross = await a.call("surface_run-control", {
      entryId: "plan:submit",
      expectedRev: v2.rev,
    });
    expect(cross.result.error!.code).toBe("conflict");
    const ok = await a.call("surface_run-control", { entryId: "plan:submit", expectedRev: v1.rev });
    expect(ok.result.status, ok.text).toBe("ok");
    expect(first.calls).toEqual(["submit:alice (agent via relay)"]);
    expect(second.calls).toEqual([]);
  });

  it("rekey after a tenant switch in the page: the old tenant's agent loses the tab, the new tenant's agent reaches it", async () => {
    const r = await relay();
    const p = await page();
    let tenant = "acme";
    const conn = p.connect({ url: r.address.tabUrl, getToken: () => tokenFor("alice", tenant) });
    await p.status((s) => s.state === "connected");
    const acme = await agent(r, "agent-alice");
    const globex = await agent(r, "agent-alice-globex");
    await observe(acme);
    tenant = "globex";
    conn.rekey();
    await until(() => r.relay.tabs({ principal: "alice", tenant: "globex" }).length === 1);
    expect(r.relay.tabs({ principal: "alice", tenant: "acme" })).toEqual([]);
    expect((await acme.call("relay_tabs")).result.output!["tabs"]).toEqual([]);
    const lost = await observe(acme);
    expect(lost.entries).toEqual([]);
    const v = await observe(globex);
    expect(v.entries.map((e) => e.id)).toContain("plan:submit");
    const ok = await globex.call("surface_run-control", {
      entryId: "plan:submit",
      expectedRev: v.rev,
    });
    expect(ok.result.status, ok.text).toBe("ok");
  });
});

describe.skipIf(noJsdom)("relay: what crosses the wire", () => {
  it("a sensitive field's value never appears in a frame or a tool result", async () => {
    const r = await relay();
    const p = await page();
    await connected(r, p);
    const a = await agent(r, "agent-alice");
    const texts: string[] = [];
    const v = await a.call("surface_observe");
    texts.push(v.text, JSON.stringify(v.result));
    const rev = (v.result.output as { rev: number }).rev;
    const row = (
      v.result.output as { entries: { id: string; sensitive?: boolean; value?: unknown }[] }
    ).entries.find((e) => e.id === "account:token");
    expect(row).toMatchObject({ sensitive: true });
    expect(row).not.toHaveProperty("value");
    for (const call of [
      a.call("surface_run-control", { entryId: "plan:submit", expectedRev: rev }),
      a.call("surface_ledger"),
      a.call("relay_tabs"),
      a.call("axe_state"),
    ]) {
      const res = await call;
      texts.push(res.text, JSON.stringify(res.result));
    }
    expect(r.frames.length).toBeGreaterThan(3);
    for (const f of r.frames) expect(f.data).not.toContain(SENSITIVE_VALUE);
    for (const t of texts) expect(t).not.toContain(SENSITIVE_VALUE);
    // The page still has it.
    expect(p.surface.get("account:token")).toMatchObject({ value: SENSITIVE_VALUE });
  });

  it("the page renews its token in-band before it expires, and the connection stays up", async () => {
    const r = await relay();
    const p = await page();
    let minted = 0;
    p.connect({
      url: r.address.tabUrl,
      getToken: () => {
        minted += 1;
        return mintRelayToken({ principal: "alice", tenant: "acme", ttl: 3 }, SECRET);
      },
    });
    await p.status((s) => s.state === "connected");
    await until(
      () => r.frames.some((f) => f.direction === "out" && f.data.includes('"t":"renewed"')),
      8000,
    );
    expect(minted).toBeGreaterThanOrEqual(2);
    expect(p.statuses.filter((s) => s.state === "reconnecting")).toEqual([]);
  });

  it("a token that is not renewed ends the connection when it expires", async () => {
    const r = await relay();
    const p = await page();
    p.connect({
      url: r.address.tabUrl,
      token: await mintRelayToken({ principal: "alice", tenant: "acme", ttl: 2 }, SECRET),
    });
    await p.status((s) => s.state === "connected");
    const s = await p.status((x) => x.state === "refused", 8000);
    expect(s.reason).toContain("expired");
  });
});

describe.skipIf(noJsdom)("relay: the rest of the bridge comes along", () => {
  it("a control that declares requires climbs the ladder: needs_input, axe_continue runs the page's fulfill, and the act runs", async () => {
    const r = await relay();
    const p = await page();
    let reason: string | null = null;
    const registerLock = () =>
      p.surface.register({
        id: "plan:lock",
        kind: "action",
        role: "button",
        name: "Lock the plan",
        state: reason
          ? { available: true }
          : {
              available: false,
              reason: "a reason for the lock is required",
              requires: {
                accepts: [
                  {
                    kind: "x-acme.lock-reason",
                    description: "Why the plan is locked, in a sentence",
                    sensitive: false,
                    schema: {
                      type: "object",
                      properties: { text: { type: "string" } },
                      required: ["text"],
                    },
                  },
                ],
                fulfill: (_kind, payload, actor) => {
                  reason = String((payload as { text: string }).text);
                  p.calls.push(`fulfill:${reason}:${actor}`);
                  registerLock();
                  p.surface.bump();
                },
              },
            },
        effect: { mutates: "plan", reversible: true },
        handler: (actor) => {
          p.calls.push(`lock:${actor}`);
          p.surface.bump();
        },
      });
    registerLock();
    await connected(r, p);
    const a = await agent(r, "agent-alice");
    const v = await observe(a);
    const asked = await a.call("surface_run-control", { entryId: "plan:lock", expectedRev: v.rev });
    expect(asked.result.status, asked.text).toBe("needs_input");
    const token = (asked.result as unknown as { continuationToken: string }).continuationToken;
    const cont = await a.call("axe_continue", {
      continuationToken: token,
      kind: "x-acme.lock-reason",
      payload: { text: "month end" },
    });
    expect(cont.result.status, cont.text).toBe("ok");
    expect(p.calls).toEqual([
      "fulfill:month end:alice (agent via relay)",
      "lock:alice (agent via relay)",
    ]);
  });

  it("attach() serves tabs and /mcp on an application's own server and leaves its other routes and upgrades alone", async () => {
    const { createServer } = await import("node:http");
    const { createRelay } = await import("../src/server");
    const { agentAuth } = await import("./helpers");
    const server = createServer((req, res) => {
      if (req.url === "/app") return void res.end("the app");
    });
    let otherUpgrades = 0;
    server.on("upgrade", (req, socket) => {
      if (req.url !== "/hmr") return;
      otherUpgrades += 1;
      socket.end("HTTP/1.1 418 Teapot\r\nConnection: close\r\n\r\n");
    });
    const rel = createRelay({ secret: SECRET, origins: [APP_ORIGIN], agentAuth: agentAuth! });
    rel.attach(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    cleanup.push(() => new Promise<void>((resolve) => server.close(() => resolve())));
    cleanup.push(() => rel.close());
    const port = (server.address() as { port: number }).port;
    expect(await (await fetch(`http://127.0.0.1:${port}/app`)).text()).toBe("the app");
    const hmr = new WebSocket(`ws://127.0.0.1:${port}/hmr`);
    await new Promise((resolve) => hmr.addEventListener("error", resolve));
    expect(otherUpgrades).toBe(1);
    const p = await page();
    p.connect({ url: `ws://127.0.0.1:${port}/tab`, getToken: () => tokenFor("alice") });
    await p.status((s) => s.state === "connected");
    const a = await httpAgent(`http://127.0.0.1:${port}/mcp`, "agent-alice");
    cleanup.push(() => a.close());
    expect(((await a.call("relay_tabs")).result.output!["tabs"] as unknown[]).length).toBe(1);
  });
});
