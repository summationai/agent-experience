// Unattended mode in a real browser: the host runs the fixture application in headless Chromium
// (Playwright) for each identity an MCP client authenticates as, and the client drives the
// application's own controls through its easy-mode surface. Skipped with a message when no
// Chromium build is installed (`npx playwright install chromium`).
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createHost } from "../src/index";
import type { Host, HostEvent, HostOptions } from "../src/index";
import {
  agentAuth,
  chromiumMissing,
  httpAgent,
  observe,
  row,
  startFixture,
  until,
} from "./helpers";
import type { Agent, Approver, Fixture } from "./helpers";

let missing: string | null = null;
let fixture: Fixture;
beforeAll(async () => {
  missing = await chromiumMissing();
  if (missing)
    console.warn(`[host browser tests] skipped: no Chromium for Playwright (${missing})`);
  fixture = await startFixture();
});
afterAll(async () => {
  await fixture?.close();
});

const cleanup: (() => unknown)[] = [];
afterEach(async () => {
  while (cleanup.length) await Promise.resolve(cleanup.pop()!()).catch(() => undefined);
});

const ALICE = { principal: "alice", tenant: "acme" };
const BOB = { principal: "bob", tenant: "acme" };

interface Started {
  host: Host;
  mcpUrl: string;
  events: HostEvent[];
  agent(token: string, approve?: Approver): Promise<Agent>;
}

async function start(options: Partial<HostOptions> = {}): Promise<Started> {
  const events: HostEvent[] = [];
  const host = createHost({
    appUrl: fixture.url,
    agentAuth,
    // Each identity's own session cookie, as a production sessionFor would mint it.
    sessionFor: ({ principal, tenant }) => ({
      cookies: [{ name: "session", value: principal }],
      headers: { "x-app-session": `${principal}@${tenant}` },
      localStorage: { [fixture.origin]: { greeting: `hello ${principal}` } },
    }),
    onEvent: (e) => events.push(e),
    ...options,
  });
  cleanup.push(() => host.close());
  const address = await host.listen();
  return {
    host,
    mcpUrl: address.mcpUrl,
    events,
    async agent(token, approve) {
      const a = await httpAgent(address.mcpUrl, token, approve);
      cleanup.push(() => a.close());
      return a;
    },
  };
}

describe("unattended mode in Chromium", () => {
  it("the agent's first tool call starts the hidden session, and it acts through the app's own controls", async (ctx) => {
    if (missing) return ctx.skip();
    const { host, agent: open, events } = await start();
    const alice = await open("agent-alice");
    const { tools } = await alice.client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain("host_screenshot");
    expect(names).toContain("surface_observe");
    // [S-HOST-3] No pairing: the tab is the agent's by identity.
    expect(names).not.toContain("relay_pair");
    // Nothing runs before a tool call.
    expect(host.sessions()).toEqual([]);

    const tabs = await alice.call("relay_tabs");
    expect(tabs.result.status, tabs.text).toBe("ok");
    const listed = (
      tabs.result.output as { tabs: { tabId: string; state: string; origin: string }[] }
    ).tabs;
    expect(listed).toHaveLength(1);
    expect(listed[0]!.state).toBe("connected");
    expect(listed[0]!.origin).toBe(fixture.origin);
    expect(host.sessions()).toMatchObject([{ principal: "alice", tenant: "acme", state: "ready" }]);
    expect(events.map((e) => e.type)).toContain("session.ready");

    const page = host.page(ALICE)!;
    expect(
      await page.evaluate(
        () => (window as unknown as { hostFixture: { mode: string } }).hostFixture.mode,
      ),
    ).toBe("unattended");

    // The app session sessionFor returned: the cookie, the header (app origin only), localStorage.
    const { rev, rows } = await observe(alice);
    expect(row(rows, "Display name").value).toBe("alice");
    expect(row(rows, "Greeting").value).toBe("hello alice");
    const pageLoad = fixture.seen.find((s) => s.path === "/" && s.session === "alice");
    expect(pageLoad?.header).toBe("alice@acme");

    const add = await alice.call("surface_run-control", {
      entryId: row(rows, "Add one").id,
      expectedRev: rev,
    });
    expect(add.result.status, add.text).toBe("ok");
    expect(await page.locator("#count").textContent()).toBe("1");

    const after = await observe(alice);
    const set = await alice.call("surface_set-field", {
      entryId: row(after.rows, "Display name").id,
      text: "Alice Liddell",
      expectedRev: after.rev,
    });
    expect(set.result.status, set.text).toBe("ok");
    expect(await page.locator("#name").inputValue()).toBe("Alice Liddell");

    // Every act is in the tab's ledger under the agent's principal.
    const ledger = await alice.call("surface_ledger");
    expect(ledger.text).toContain("alice (agent via relay)");
    // [S-HOST-4] No tool carries the relay token or the session.
    for (const t of [tabs, add, set, ledger]) {
      expect(t.text).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
      expect(t.text).not.toContain("x-app-session");
    }
  });

  it("two identities get two isolated contexts, and neither reaches the other's tab", async (ctx) => {
    if (missing) return ctx.skip();
    const { host, agent: open } = await start();
    const alice = await open("agent-alice");
    const bob = await open("agent-bob");
    const [a, b] = await Promise.all([observe(alice), observe(bob)]);
    expect(row(a.rows, "Display name").value).toBe("alice");
    expect(row(b.rows, "Display name").value).toBe("bob");

    const cookiesA = await host.page(ALICE)!.context().cookies();
    const cookiesB = await host.page(BOB)!.context().cookies();
    expect(cookiesA.map((c) => c.value)).toEqual(["alice"]);
    expect(cookiesB.map((c) => c.value)).toEqual(["bob"]);
    expect(host.page(ALICE)!.context()).not.toBe(host.page(BOB)!.context());

    // Alice's agent lists only Alice's tab, and Bob's tab id is unknown to it.
    const tabsA = (await alice.call("relay_tabs")).result.output as { tabs: { tabId: string }[] };
    const tabsB = (await bob.call("relay_tabs")).result.output as { tabs: { tabId: string }[] };
    expect(tabsA.tabs).toHaveLength(1);
    expect(tabsA.tabs[0]!.tabId).not.toBe(tabsB.tabs[0]!.tabId);
    const steal = await alice.call("relay_select-tab", { tabId: tabsB.tabs[0]!.tabId });
    expect(steal.result.error?.code).toBe("not_found");

    const add = await alice.call("surface_run-control", {
      entryId: row(a.rows, "Add one").id,
      expectedRev: a.rev,
    });
    expect(add.result.status, add.text).toBe("ok");
    expect(await host.page(ALICE)!.locator("#count").textContent()).toBe("1");
    expect(await host.page(BOB)!.locator("#count").textContent()).toBe("0");

    // Another tenant is another session.
    const globex = await open("agent-alice-globex");
    await observe(globex);
    expect(
      host
        .sessions()
        .map((s) => `${s.principal}@${s.tenant}`)
        .sort(),
    ).toEqual(["alice@acme", "alice@globex", "bob@acme"]);
  });

  it("an idle session closes, and the next tool call starts it again", async (ctx) => {
    if (missing) return ctx.skip();
    const { host, agent: open, events } = await start({ idleMs: 2500 });
    const alice = await open("agent-alice");
    await observe(alice);
    expect(events.filter((e) => e.type === "session.ready")).toHaveLength(1);
    // The session leaves the list just before its closed event is recorded; wait for both.
    await until(
      () => host.sessions().length === 0 && events.some((e) => e.type === "session.closed"),
      15_000,
    );
    expect(events).toContainEqual({
      type: "session.closed",
      principal: "alice",
      tenant: "acme",
      reason: "idle",
    });
    const again = await observe(alice);
    expect(row(again.rows, "Add one")).toBeTruthy();
    expect(events.filter((e) => e.type === "session.ready")).toHaveLength(2);
  });

  it("a crashed page is started again on the next call, on the same relay tab", async (ctx) => {
    if (missing) return ctx.skip();
    const { host, agent: open, events } = await start();
    const alice = await open("agent-alice");
    await observe(alice);
    const tabId = host.sessions()[0]!.tabId;
    const page = host.page(ALICE)!;
    const cdp = await page.context().newCDPSession(page);
    // The renderer dies mid-command, so the command never answers.
    void cdp.send("Page.crash").catch(() => undefined);
    await until(() => events.some((e) => e.type === "session.crashed"));
    const again = await observe(alice);
    expect(row(again.rows, "Add one")).toBeTruthy();
    expect(host.sessions()).toMatchObject([{ tabId, state: "ready" }]);
    // The relay reattached the agent's tab rather than listing a second one.
    const tabs = (await alice.call("relay_tabs")).result.output as {
      tabs: { tabId: string; state: string }[];
    };
    expect(tabs.tabs).toEqual([expect.objectContaining({ tabId, state: "connected" })]);

    // A context closed from outside is started again too.
    await host.page(ALICE)!.context().close();
    expect(row((await observe(alice)).rows, "Add one")).toBeTruthy();
  });

  it("a navigation to another origin is refused and the page stays; navigation within the app works", async (ctx) => {
    if (missing) return ctx.skip();
    const { host, agent: open, events } = await start();
    const alice = await open("agent-alice");
    const { rev, rows } = await observe(alice);
    const leave = await alice.call("surface_run-control", {
      entryId: row(rows, "Partner site").id,
      expectedRev: rev,
    });
    expect(leave.result.status, leave.text).toBe("ok");
    await until(() => events.some((e) => e.type === "request.blocked"));
    expect(events.find((e) => e.type === "request.blocked")).toEqual({
      type: "request.blocked",
      principal: "alice",
      tenant: "acme",
      origin: fixture.foreign,
      navigation: true,
    });
    expect(fixture.foreignHits).toEqual([]);
    expect(new URL(host.page(ALICE)!.url()).origin).toBe(fixture.origin);
    const still = await observe(alice);
    expect(row(still.rows, "Add one")).toBeTruthy();

    // The page's own link within the app: a new page, the same session and tab.
    const tabId = host.sessions()[0]!.tabId;
    // The click runs and the page navigates (the answer is asserted in the next test).
    await alice.call("surface_run-control", {
      entryId: row(still.rows, "Other page").id,
      expectedRev: still.rev,
    });
    await until(() => host.page(ALICE)!.url().endsWith("/other"));
    await until(async () => {
      const t = (await alice.call("relay_tabs")).result.output as {
        tabs: { tabId: string; path: string; state: string }[];
      };
      return (
        t.tabs.length === 1 && t.tabs[0]!.path === "/other" && t.tabs[0]!.state === "connected"
      );
    });
    expect(host.sessions()[0]!.tabId).toBe(tabId);
  });

  it("a click that navigates is reported as having run, never as nothing applied, and is not retried", async (ctx) => {
    if (missing) return ctx.skip();
    const { host, agent: open } = await start();
    const alice = await open("agent-alice", () => ({
      action: "accept",
      content: { approve: true },
    }));
    const truthful = (r: Awaited<ReturnType<typeof alice.call>>) => {
      expect(r.text).not.toMatch(/nothing (was )?applied/i);
      expect(r.result.error?.code).not.toBe("conflict");
      if (r.result.status === "ok") {
        expect((r.result.output as { navigated?: boolean }).navigated).toBe(true);
      } else {
        expect(r.result.error).toMatchObject({
          code: "unavailable",
          retryable: false,
          details: { reason: "outcome_unknown" },
        });
      }
    };

    // A link.
    const first = await observe(alice);
    const loads = () => fixture.seen.filter((s) => s.path === "/other" && s.session === "alice");
    const before = loads().length;
    const link = await alice.call("surface_run-control", {
      entryId: row(first.rows, "Other page").id,
      expectedRev: first.rev,
    });
    truthful(link);
    await until(() => host.page(ALICE)!.url().endsWith("/other"));
    expect(loads().length - before).toBe(1);

    // A form that posts and reloads: submitted exactly once.
    await until(async () =>
      (await observe(alice).catch(() => null))?.rows.some((r) => r.name === "Send report"),
    );
    const second = await observe(alice);
    const posts = () => fixture.seen.filter((s) => s.path === "/submitted" && s.method === "POST");
    const submit = await alice.call("surface_run-control", {
      entryId: row(second.rows, "Send report").id,
      expectedRev: second.rev,
    });
    truthful(submit);
    await until(() => host.page(ALICE)!.url().endsWith("/submitted"));
    await new Promise((r) => setTimeout(r, 1500));
    expect(posts()).toHaveLength(1);
  });

  it("host_screenshot returns the hidden page as a PNG", async (ctx) => {
    if (missing) return ctx.skip();
    const { agent: open } = await start();
    const alice = await open("agent-alice");
    const shot = await alice.call("host_screenshot");
    expect(shot.isError, shot.text).toBe(false);
    const image = shot.content.find((c) => c.type === "image")!;
    expect(image.mimeType).toBe("image/png");
    expect(Buffer.from(image.data!, "base64").subarray(1, 4).toString()).toBe("PNG");
    expect(shot.text).toContain("/");
  });

  it("the injected relay configuration is only in the application's origin", async (ctx) => {
    if (missing) return ctx.skip();
    const { host, agent: open } = await start({ allowedOrigins: [fixture.foreign] });
    await observe(await open("agent-alice"));
    const page = host.page(ALICE)!;
    const config = await page.evaluate(() => {
      const c = (window as unknown as Record<string, Record<string, unknown>>)["__AXE_RELAY__"]!;
      return {
        url: c["url"],
        mode: c["mode"],
        indicator: c["indicator"],
        token: typeof c["token"],
      };
    });
    expect(config).toMatchObject({ mode: "unattended", indicator: false, token: "string" });
    expect(String(config.url)).toMatch(/^ws:\/\/127\.0\.0\.1:\d+\/tab$/);
    // The page can renew in-band: getToken mints a fresh token for the same identity.
    const renewed = await page.evaluate(() =>
      (window as unknown as Record<string, { getToken: () => Promise<string> }>)[
        "__AXE_RELAY__"
      ]!.getToken(),
    );
    expect(renewed.split(".")).toHaveLength(3);
    // A frame of another origin gets no configuration, and cannot mint a token.
    await page.evaluate((src) => {
      const f = document.createElement("iframe");
      f.src = src;
      document.body.append(f);
    }, `${fixture.foreign}/frame`);
    const frame = await until(() => page.frames().find((f) => f.url().startsWith(fixture.foreign)));
    await frame.waitForLoadState("domcontentloaded");
    expect(await frame.evaluate(() => "__AXE_RELAY__" in window)).toBe(false);
    const minted = await frame.evaluate(async () => {
      try {
        const mint = (window as unknown as Record<string, () => Promise<string>>)[
          "__axeHostRelayToken"
        ];
        return typeof mint === "function" ? await mint() : "no binding";
      } catch {
        return "refused";
      }
    });
    expect(minted === "refused" || minted === "no binding").toBe(true);
  });

  it("maxSessions closes the least recently used session", async (ctx) => {
    if (missing) return ctx.skip();
    const { host, agent: open, events } = await start({ maxSessions: 1 });
    await observe(await open("agent-alice"));
    await observe(await open("agent-bob"));
    expect(host.sessions().map((s) => s.principal)).toEqual(["bob"]);
    expect(events).toContainEqual({
      type: "session.closed",
      principal: "alice",
      tenant: "acme",
      reason: "evicted",
    });
  });

  it("a high-risk control waits for the person's approval in the agent's client, never in the hidden page", async (ctx) => {
    if (missing) return ctx.skip();
    const { host, agent: open } = await start();
    // A client that declares no elicitation: the act does not run, and the agent is told why.
    const plain = await open("agent-alice");
    const first = await observe(plain);
    const refused = await plain.call("surface_run-control", {
      entryId: row(first.rows, "Delete everything").id,
      expectedRev: first.rev,
    });
    expect(refused.result.status).not.toBe("ok");
    const deleted = () =>
      host.page(ALICE)!.evaluate(() => (window as { deleted?: boolean }).deleted ?? false);
    expect(await deleted()).toBe(false);

    // A client with form elicitation: the person approves there, and the act runs in that call.
    const asked: string[] = [];
    const approving = await open("agent-alice", (params) => {
      asked.push(params.message);
      return { action: "accept", content: { approve: true } };
    });
    const now = await observe(approving);
    const done = await approving.call("surface_run-control", {
      entryId: row(now.rows, "Delete everything").id,
      expectedRev: now.rev,
    });
    expect(done.result.status, done.text).toBe("ok");
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain("Delete everything");
    expect(await deleted()).toBe(true);
  });

  it("Stop: the agent's relay_stop ends the session; the owner's stop holds the identity until resume", async (ctx) => {
    if (missing) return ctx.skip();
    const { host, agent: open, events } = await start();
    const alice = await open("agent-alice");
    await observe(alice);
    const stopped = await alice.call("relay_stop");
    expect(stopped.result.status, stopped.text).toBe("ok");
    await until(() => events.some((e) => e.type === "session.closed" && e.reason === "stopped"));
    expect(host.sessions()).toEqual([]);
    // The agent ended its own session: its next call starts a new one.
    expect(row((await observe(alice)).rows, "Add one")).toBeTruthy();

    await host.stop(ALICE);
    expect(host.sessions()).toEqual([]);
    const held = await alice.call("surface_observe");
    expect(held.result.error?.details?.["reason"]).toBe("host_session_stopped");
    expect(host.sessions()).toEqual([]);
    host.resume(ALICE);
    expect(row((await observe(alice)).rows, "Add one")).toBeTruthy();
  });

  it("when sessionFor refuses, the agent is told and no page opens", async (ctx) => {
    if (missing) return ctx.skip();
    const { host, agent: open, events } = await start({ sessionFor: () => null });
    const alice = await open("agent-alice");
    const r = await alice.call("surface_observe");
    expect(r.result.status).toBe("error");
    expect(r.result.error?.details?.["reason"]).toBe("host_session_unavailable");
    expect(r.text).toContain("sessionFor refused");
    expect(host.sessions()).toEqual([]);
    expect(events).toContainEqual({
      type: "session.failed",
      principal: "alice",
      tenant: "acme",
      reason: "sessionFor refused",
    });
    // A sessionFor that throws: the message (which could hold a credential) is not passed on.
    const { agent: open2 } = await start({
      sessionFor: () => {
        throw new Error("secret-token-123 expired");
      },
    });
    const r2 = await (await open2("agent-alice")).call("surface_observe");
    expect(r2.text).not.toContain("secret-token-123");
  });
});
