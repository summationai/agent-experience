// An act the page never answers: its click navigated the page (a link, a form that posts and
// reloads) or the page went away mid-act. The agent is told the truth: a navigation the tab saw
// begin is `ok` with `navigated: true`; any other loss is an unknown outcome (`unavailable`,
// `outcome_unknown`, not retryable), never auto-retried, never "nothing applied", and a retry
// with the same idempotency key is answered with the stored outcome instead of running again.
import { afterEach, describe, expect, it } from "vitest";
import { mintRelayToken } from "../src/token";
import { SECRET, httpAgent, noJsdom, openPage, startRelay, until } from "./helpers";
import type { Agent, Page, Running } from "./helpers";

const cleanup: (() => unknown)[] = [];
afterEach(async () => {
  while (cleanup.length) await Promise.resolve(cleanup.pop()!()).catch(() => undefined);
});

async function hostedPage(r: Running, storage?: Record<string, string>): Promise<Page> {
  const token = await mintRelayToken({ principal: "alice", tenant: "acme", ttl: 600 }, SECRET);
  const p = await openPage({
    inject: { url: r.address.tabUrl, token, mode: "unattended" },
    ...(storage ? { storage } : {}),
  });
  cleanup.push(() => p.close());
  return p;
}

async function connected(r: Running, p: Page): Promise<void> {
  p.connect(p.api.injectedRelay()!);
  await p.status((s) => s.state === "connected");
  await until(() => r.relay.tabs({ principal: "alice", tenant: "acme" })[0]?.state === "connected");
}

/** A medium-risk control whose handler does `onClick` and never settles (the page is leaving). */
function registerLeaving(p: Page, onClick: () => void): void {
  p.surface.register({
    id: "plan:send",
    kind: "action",
    role: "button",
    name: "Send the report",
    object: "plan",
    effect: { mutates: "plan", risk: "medium", reversible: false },
    handler: (actor) => {
      p.calls.push(`send:${actor}`);
      onClick();
      return new Promise<void>(() => undefined);
    },
  });
}

async function rev(a: Agent): Promise<number> {
  const v = await a.call("surface_observe");
  expect(v.result.status, v.text).toBe("ok");
  return (v.result.output as { rev: number }).rev;
}

describe.skipIf(noJsdom)("an act the page does not answer", () => {
  it("a click that begins a navigation is answered ok with navigated: true before the page unloads", async () => {
    const r = await startRelay({});
    cleanup.push(() => r.relay.close());
    const p = await hostedPage(r);
    registerLeaving(p, () => {
      // What a link or a form submit does: the navigation begins, then the document is hidden.
      p.window.dispatchEvent(new p.window.Event("beforeunload"));
      p.window.dispatchEvent(new p.window.Event("pagehide"));
    });
    await connected(r, p);
    const a = await httpAgent(r.address.mcpUrl, "agent-alice");
    cleanup.push(() => a.close());
    const done = await a.call("surface_run-control", {
      entryId: "plan:send",
      expectedRev: await rev(a),
    });
    expect(done.result.status, done.text).toBe("ok");
    expect(done.result.output).toMatchObject({ navigated: true, id: "plan:send" });
    expect(done.text).not.toMatch(/nothing (was )?applied/i);
    expect(p.calls).toEqual(["send:alice (agent via relay)"]);
  });

  it("a page lost mid-act is an unknown outcome: not retryable, not retried, replayed for the same key", async () => {
    const r = await startRelay({});
    cleanup.push(() => r.relay.close());
    const p = await hostedPage(r);
    // The page goes away with no navigation it could see (a crash, a closed browser).
    registerLeaving(p, () => setTimeout(() => p.close(), 0));
    await connected(r, p);
    const tabIdKey = "axe-relay:tab-id";
    const tabId = p.window.sessionStorage.getItem(tabIdKey)!;
    const a = await httpAgent(r.address.mcpUrl, "agent-alice");
    cleanup.push(() => a.close());
    const at = await rev(a);
    const args = { entryId: "plan:send", expectedRev: at, idempotencyKey: "send-report-once-0001" };
    const started = Date.now();
    const lost = await a.call("surface_run-control", args);
    expect(lost.result.status, lost.text).toBe("error");
    expect(lost.result.error).toMatchObject({
      code: "unavailable",
      retryable: false,
      details: { reason: "outcome_unknown", cause: "tab_disconnected" },
    });
    expect(lost.text).not.toMatch(/nothing (was )?applied/i);
    expect(lost.text).toMatch(/may have taken effect/);
    // Answered at once, with no automatic retry (a retry waits a second first).
    expect(Date.now() - started).toBeLessThan(900);
    expect(p.calls).toEqual(["send:alice (agent via relay)"]);

    // The page comes back (a reload of the same tab); the agent retries with the same key.
    const again = await hostedPage(r, { [tabIdKey]: tabId });
    registerLeaving(again, () => undefined);
    await connected(r, again);
    const replay = await a.call("surface_run-control", args);
    expect(replay.result.error).toMatchObject({ details: { reason: "outcome_unknown" } });
    expect(again.calls).toEqual([]);
  });
});
