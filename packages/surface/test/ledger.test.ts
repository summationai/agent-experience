/**
 * The ledger as the one history ([S-LED-1], [S-LED-8], [S-AXE-14]): changes the application
 * records itself with `record`, and refusals the AXE runtime makes before the bridge's handler
 * runs, recorded by the bridge. Found demoing the Plan Board over MCP: an approval made outside
 * `act` left a revision gap, and a stale edit refused by the server was missing from the ledger
 * whose description said every refusal was in it.
 */
import { describe, expect, it } from "vitest";
import { createAXE } from "@summationai/axe-core";
import type { AuthConfig, AXEActionEvent } from "@summationai/axe-core";
import type { ErrorResult, OkResult } from "@summationai/axe-core/types";
import { createSurface } from "../src/index";
import type { LedgerEntry, Surface } from "../src/index";
import { domainActions, scopedSurfaces, surfaceActions } from "../src/axe";
import type { SurfaceResolver } from "../src/axe";

const BASE = "http://localhost:5173";
const SECRET = "0123456789abcdef0123456789abcdef";

const authenticate: NonNullable<AuthConfig["authenticate"]> = (req) => {
  const m = /^Bearer user:(.+)$/.exec(req.headers.get("Authorization") ?? "");
  return m ? { onBehalfOf: m[1]! } : null;
};
const as = (user: string) => ({ Authorization: `Bearer user:${user}` });

/** A month with a demand field, a lock, and a publish button that is always unavailable. */
function board(options: Parameters<typeof createSurface>[0] = {}) {
  const s = createSurface({ app: "plan", ...options });
  const st = { demand: 100, locked: false, approved: false, pin: "" };
  const sync = () => {
    s.register({
      id: "demand:2026-03",
      kind: "field",
      role: "textbox",
      name: "March demand",
      value: String(st.demand),
      edit: {
        maxLength: 8,
        set: (text) => {
          st.demand = Number(text);
          s.bump();
        },
      },
    });
    s.register({
      id: "pin",
      kind: "field",
      role: "textbox",
      name: "Approval PIN",
      value: st.pin,
      sensitive: true,
      edit: {
        maxLength: 8,
        set: (text) => {
          st.pin = text;
          s.bump();
        },
      },
    });
    s.register({
      id: "lock:2026-03",
      kind: "action",
      role: "button",
      name: "Lock March",
      state: st.approved
        ? { available: true }
        : { available: false, reason: "March needs the planner's approval" },
      effect: { mutates: "locks", risk: "medium", idempotent: true, reversible: true },
      handler: () => {
        st.locked = true;
        s.bump();
      },
    });
    s.register({
      id: "boom",
      kind: "action",
      role: "button",
      name: "Recalculate the plan",
      effect: { mutates: "plan", risk: "low" },
      handler: () => {
        throw new Error("recalculation failed");
      },
    });
  };
  sync();
  /** The person approves March in the page: the application's change, outside `act`. */
  const approve = (actor: string): LedgerEntry => {
    const revBefore = s.currentRev();
    st.approved = true;
    sync();
    s.bump({ what: "approve:2026-03" });
    return s.record({
      op: "APPROVE",
      target: "lock:2026-03",
      actor,
      changed: ["lock:2026-03"],
      revBefore,
    });
  };
  return { s, st, approve };
}

function serve(
  source: Surface | SurfaceResolver,
  provider: "control" | "domain",
  config: { revision?: Surface; auth?: "user" | "none"; template?: Surface } = {},
) {
  const events: AXEActionEvent[] = [];
  const axe = createAXE({
    name: "Plan",
    description: "A demand plan: observe the months, change a month's demand, lock a month.",
    baseUrl: BASE,
    auth: { modes: ["none", "user"], authenticate },
    secret: SECRET,
    onActionEvent: (e) => void events.push(e),
    ...(config.revision ? { revision: config.revision.currentRev } : {}),
  });
  const options = {
    namespace: "plan",
    auth: config.auth ?? "user",
    ...(config.template ? { template: config.template } : {}),
  };
  const bridge =
    provider === "control" ? surfaceActions(source, options) : domainActions(source, options);
  axe.addProvider(bridge);
  const post = async (path: string, body: unknown, headers: Record<string, string> = {}) =>
    (await (
      await axe.handle(
        new Request(`${BASE}${path}`, {
          method: "POST",
          headers: { "content-type": "application/json", ...headers },
          body: JSON.stringify(body),
        }),
      )
    ).json()) as unknown;
  const act = (
    name: string,
    input: unknown,
    expectedRev: number | undefined,
    headers: Record<string, string> = {},
  ) =>
    post(
      `/axe/actions/${name}`,
      {
        input,
        idempotencyKey: crypto.randomUUID(),
        ...(expectedRev === undefined ? {} : { expectedRev }),
      },
      headers,
    );
  const ledger = async (headers: Record<string, string>) =>
    (
      (await post("/axe/actions/plan.ledger", { input: {} }, headers)) as OkResult<{
        ledgerSeq: number;
        entries: LedgerEntry[];
      }>
    ).output;
  const flush = () => new Promise((r) => setTimeout(r, 0));
  return { axe, bridge, post, act, ledger, events, flush };
}

describe("record: a change the application made outside act [S-LED-8]", () => {
  it("appends an entry marked source application, advances ledgerSeq, and does not move the revision", () => {
    const { s, approve } = board();
    s.bump(); // rev 1
    const listened: number[] = [];
    s.onChange((e) => listened.push(e.rev));
    const entry = approve("dana");
    // The application moved the revision itself (1 -> 2); record spans it and moves nothing.
    expect(entry).toMatchObject({
      seq: 1,
      op: "APPROVE",
      target: "lock:2026-03",
      actor: "dana",
      revBefore: 1,
      revAfter: 2,
      status: "ok",
      changed: ["lock:2026-03"],
      source: "application",
    });
    expect(s.currentRev()).toBe(2);
    expect(listened).toEqual([2]);
    expect(s.observe().ledgerSeq).toBe(1);
    expect(s.ledger()).toEqual([entry]);
    // revBefore defaults to the revision when record is called.
    const later = s.record({ op: "PUSH", target: null, actor: "server" });
    expect(later).toMatchObject({ seq: 2, revBefore: 2, revAfter: 2, changed: [], status: "ok" });
    expect(s.currentRev()).toBe(2);
  });

  it("applies the text policy and never keeps a sensitive field's text", () => {
    const hashed = board({ ledger: { text: "hash" } }).s;
    const e1 = hashed.record({ op: "NOTE", target: "demand:2026-03", actor: "dana", text: "hi" });
    expect(e1.text).toBeUndefined();
    expect(e1.textHash).toMatch(/^[0-9a-f]{64}$/);
    const redacted = board({ ledger: { redact: (t) => t.replace(/\d/g, "#") } }).s;
    expect(
      redacted.record({ op: "NOTE", target: "demand:2026-03", actor: "dana", text: "call 555" })
        .text,
    ).toBe("call ###");
    const { s } = board();
    const secret = s.record({ op: "TYPE_TEXT", target: "pin", actor: "dana", text: "4321" });
    expect("text" in secret || "textHash" in secret).toBe(false);
    // A target that is not an entry is treated as sensitive while a sensitive entry is registered.
    const loose = s.record({ op: "NOTE", target: "elsewhere", actor: "dana", text: "4321" });
    expect("text" in loose).toBe(false);
    expect(JSON.stringify(s.ledger())).not.toContain("4321");
  });

  it("records a refusal the surface never saw: changed empty, both revisions the current one", () => {
    const { s } = board();
    s.bump();
    const e = s.record({
      op: "TYPE_TEXT",
      target: "demand:2026-03",
      actor: "dana's agent",
      status: "conflict",
      revBefore: 0,
      expectedRev: 0,
    });
    expect(e).toMatchObject({ status: "conflict", revBefore: 1, revAfter: 1, changed: [] });
    expect(e.expectedRev).toBe(0);
    expect(() =>
      s.record({ op: "X", target: null, actor: "a", status: "conflict", changed: ["pin"] }),
    ).toThrow(/changed nothing/);
    expect(() => s.record({ op: "", target: null, actor: "a" })).toThrow(TypeError);
    expect(() =>
      s.record({ op: "X", target: null, actor: "a", status: "nope" as "conflict" }),
    ).toThrow(TypeError);
  });

  it("leaves the entries act writes exactly as they were: no source, no expectedRev", async () => {
    const { s } = board();
    await s.act({ op: "TYPE_TEXT", target: "demand:2026-03", text: "5", expectedRev: 0 });
    await s.act({ op: "CLICK", target: "lock:2026-03", expectedRev: 1 });
    const keys = s.ledger().map((e) => Object.keys(e).sort());
    expect(keys).toEqual([
      ["actor", "at", "changed", "op", "revAfter", "revBefore", "seq", "status", "target", "text"],
      ["actor", "at", "changed", "op", "revAfter", "revBefore", "seq", "status", "target"],
    ]);
  });
});

describe("the bridge records refusals the runtime made before the surface [S-AXE-14]", () => {
  it("a stale expectedRev refused by the server appears once, as conflict, with the caller as actor", async () => {
    const { s } = board();
    const { act, ledger, flush, events } = serve(s, "control", { revision: s });
    const ok = (await act("plan.demand-2026-03", { text: "250" }, 0, as("dana"))) as OkResult<{
      seq: number;
    }>;
    expect(ok.status).toBe("ok");
    const stale = (await act(
      "plan.demand-2026-03",
      { text: "300" },
      0,
      as("dana's agent"),
    )) as ErrorResult;
    expect(stale.error.code).toBe("conflict");
    expect(stale.error.message).toContain("you saw revision 0");
    const { entries, ledgerSeq } = await ledger(as("dana"));
    expect(ledgerSeq).toBe(2);
    expect(entries.map(({ at: _at, ...e }) => e)).toEqual([
      {
        seq: 1,
        op: "TYPE_TEXT",
        target: "demand:2026-03",
        actor: "dana",
        revBefore: 0,
        revAfter: 1,
        status: "ok",
        text: "250",
        changed: ["demand:2026-03"],
      },
      {
        seq: 2,
        op: "TYPE_TEXT",
        target: "demand:2026-03",
        actor: "dana's agent",
        revBefore: 1,
        revAfter: 1,
        status: "conflict",
        text: "300",
        changed: [],
        source: "server",
        expectedRev: 0,
      },
    ]);
    // No new action event: the server's request events already carry the refusal.
    await flush();
    expect(events.map((e) => e.status)).toEqual(["ok"]);
  });

  it("a refusal the surface made itself is in the ledger exactly once, and so is a handler that threw", async () => {
    const { s } = board();
    const { act } = serve(s, "control", { revision: s });
    const blocked = (await act("plan.lock-2026-03", {}, 0, as("dana"))) as ErrorResult;
    expect(blocked.error.code).toBe("unavailable");
    expect(blocked.error.details?.["seq"]).toBe(1);
    const threw = (await act("plan.boom", {}, 0, as("dana"))) as ErrorResult;
    expect(threw.error.code).toBe("internal");
    expect(s.ledger().map((e) => [e.target, e.status, e.source])).toEqual([
      ["lock:2026-03", "unavailable", undefined],
      ["boom", "internal", undefined],
    ]);
  });

  it("an anonymous or unauthorized call to a protected surface leaves no entry", async () => {
    const { s } = board();
    const { act, post } = serve(s, "control", { revision: s });
    s.bump();
    const anon = (await act("plan.demand-2026-03", { text: "1" }, 0)) as ErrorResult;
    expect(anon.error.code).toBe("unauthorized");
    const bad = (await act("plan.demand-2026-03", { text: "1" }, 0, {
      Authorization: "Bearer nobody",
    })) as ErrorResult;
    expect(bad.error.code).toBe("unauthorized");
    const ledgerAnon = (await post("/axe/actions/plan.ledger", { input: {} })) as ErrorResult;
    expect(ledgerAnon.error.code).toBe("unauthorized");
    expect(s.ledger()).toEqual([]);
  });

  it("domain mode takes the target from entryId, and the op from that entry", async () => {
    const { s } = board();
    const { act } = serve(s, "domain", { revision: s });
    s.bump();
    const stale = (await act(
      "plan.set-field",
      { entryId: "demand:2026-03", text: "9" },
      0,
      as("dana's agent"),
    )) as ErrorResult;
    expect(stale.error.code).toBe("conflict");
    const lost = (await act("plan.run-control", { entryId: 7 }, 1, as("dana"))) as ErrorResult;
    expect(lost.error.code).toBe("invalid_input");
    expect(s.ledger().map(({ at: _at, ...e }) => e)).toEqual([
      {
        seq: 1,
        op: "TYPE_TEXT",
        target: "demand:2026-03",
        actor: "dana's agent",
        revBefore: 1,
        revAfter: 1,
        status: "conflict",
        text: "9",
        changed: [],
        source: "server",
        expectedRev: 0,
      },
      // An input without a usable entryId names the action it called.
      {
        seq: 2,
        op: "CLICK",
        target: "plan.run-control",
        actor: "dana",
        revBefore: 1,
        revAfter: 1,
        status: "invalid_input",
        changed: [],
        source: "server",
        expectedRev: 1,
      },
    ]);
  });

  it("with a resolver, the refusal lands on the caller's own surface", async () => {
    const template = board().s;
    const scopes = scopedSurfaces({ create: () => board().s });
    // Each caller's surface has its own revision; the server's provider resolves the caller.
    const axe = createAXE({
      name: "Plan",
      description: "A demand plan: observe the months, change a month's demand, lock a month.",
      baseUrl: BASE,
      auth: { modes: ["user"], authenticate },
      secret: SECRET,
      revision: async (ctx) =>
        (await scopes.resolve({
          identity: ctx.identity ?? null,
          tenant: ctx.tenant,
          siteKey: null,
          request: ctx.request,
        }))!.currentRev(),
    });
    axe.addProvider(surfaceActions(scopes.resolve, { namespace: "plan", template }));
    const call = async (user: string, expectedRev: number) =>
      (await (
        await axe.handle(
          new Request(`${BASE}/axe/actions/plan.demand-2026-03`, {
            method: "POST",
            headers: { "content-type": "application/json", ...as(user) },
            body: JSON.stringify({
              input: { text: "5" },
              idempotencyKey: crypto.randomUUID(),
              expectedRev,
            }),
          }),
        )
      ).json()) as { status: string; error?: { code: string } };
    expect((await call("dana", 0)).status).toBe("ok");
    expect((await call("dana", 0)).error?.code).toBe("conflict");
    expect((await call("lee", 0)).status).toBe("ok");
    const key = (u: string) => JSON.stringify([null, u]);
    expect(
      scopes
        .get(key("dana"))!
        .ledger()
        .map((e) => [e.actor, e.status]),
    ).toEqual([
      ["dana", "ok"],
      ["dana", "conflict"],
    ]);
    expect(
      scopes
        .get(key("lee"))!
        .ledger()
        .map((e) => [e.actor, e.status]),
    ).toEqual([["lee", "ok"]]);
    expect(template.ledger()).toEqual([]);
  });

  it("the ledger has no gap across a person's approval and an agent's stale attempt", async () => {
    const { s, approve } = board();
    const { act } = serve(s, "control", { revision: s });
    await act("plan.demand-2026-03", { text: "7" }, 0, as("dana")); // 0 -> 1
    approve("dana"); // 1 -> 2, recorded
    await act("plan.demand-2026-03", { text: "8" }, 1, as("dana's agent")); // stale
    await act("plan.lock-2026-03", {}, 2, as("dana's agent")); // 2 -> 3
    const entries = s.ledger();
    expect(entries.map((e) => [e.actor, e.op, e.status, e.revBefore, e.revAfter])).toEqual([
      ["dana", "TYPE_TEXT", "ok", 0, 1],
      ["dana", "APPROVE", "ok", 1, 2],
      ["dana's agent", "TYPE_TEXT", "conflict", 2, 2],
      ["dana's agent", "CLICK", "ok", 2, 3],
    ]);
    // Every revision move is an entry: each change starts where the previous one ended.
    const changes = entries.filter((e) => e.status === "ok");
    for (let i = 1; i < changes.length; i++)
      expect(changes[i]!.revBefore).toBe(changes[i - 1]!.revAfter);
  });

  it("the provider hook is idempotent per request and ignores results a handler produced", async () => {
    const { s } = board();
    const { bridge } = serve(s, "control", { revision: s });
    bridge.actions();
    const request = new Request(`${BASE}/axe/actions/plan.demand-2026-03`, { method: "POST" });
    const ctx = {
      endpoint: "action" as const,
      action: "plan.demand-2026-03",
      request,
      context: { onBehalfOf: "dana" },
      tenant: null,
      identity: { onBehalfOf: "dana" },
      siteKey: null,
      input: { text: "1" },
      expectedRev: 0,
      handled: false,
    };
    const refused = {
      status: "error" as const,
      error: { code: "conflict" as const, message: "stale", retryable: true },
    };
    await bridge.onResult(ctx, refused);
    await bridge.onResult(ctx, refused);
    await bridge.onResult({ ...ctx, request: new Request(BASE), handled: true }, refused);
    await bridge.onResult({ ...ctx, request: new Request(BASE), action: "plan.ledger" }, refused);
    expect(s.ledger()).toHaveLength(1);
  });
});
