import { describe, expect, it } from "vitest";
import { createAXE } from "@axe/core";
import { kinds, accept } from "@axe/core/kinds";
import type {
  AXEActionEvent,
  NeedsInputResult,
  NeedsHumanResult,
  OkResult,
  ErrorResult,
  Manifest,
} from "@axe/core/types";
import { ManifestSchema } from "@axe/core/schemas";
import { createSurface } from "../src/index";
import { surfaceActions } from "../src/axe";
import { board } from "./fixtures/board";

function serve(surface: ReturnType<typeof createSurface>) {
  const events: AXEActionEvent[] = [];
  const axe = createAXE({
    name: "Fantasy Draft",
    description:
      "A draft board: observe which players can be drafted right now and draft, undo, or flag them under one revision.",
    baseUrl: "http://localhost:5173",
    auth: {
      modes: ["none", "user"],
      authenticate: async (req) => {
        const m = /^Bearer user:(.+)$/.exec(req.headers.get("Authorization") ?? "");
        return m ? { onBehalfOf: m[1]! } : null;
      },
    },
    secret: "0123456789abcdef0123456789abcdef",
    onActionEvent: (e) => void events.push(e),
  });
  for (const a of surfaceActions(surface)) axe.register(a);
  const call = async (path: string, body: unknown, headers: Record<string, string> = {}) => {
    const res = await axe.handle(
      new Request(`http://localhost:5173${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
      }),
    );
    return (await res.json()) as unknown;
  };
  /** Action events are delivered on a later microtask; wait for them. */
  const flush = () => new Promise((r) => setTimeout(r, 0));
  return { axe, call, events, flush };
}

describe("surfaceActions: a surface served as an AXE manifest", () => {
  it("produces a valid manifest with observe (read, display, affordances), act (mutating), and ledger (read)", () => {
    const b = board();
    const { axe } = serve(b.surface);
    const m: Manifest = axe.describe();
    expect(ManifestSchema.safeParse(m).success).toBe(true);
    expect(m.actions.map((a) => [a.name, a.readOnly, a.risk])).toEqual([
      ["surface.observe", true, "none"],
      ["surface.act", false, "medium"],
      ["surface.ledger", true, "none"],
    ]);
    expect(m.actions[0]!.display?.kind).toBe("list");
    expect(m.actions[2]!.display?.kind).toBe("list");
  });

  it("observe returns the live table with dynamic affordances bound to act", async () => {
    const b = board();
    const { call } = serve(b.surface);
    const r = (await call("/axe/actions/surface.observe", { input: {} })) as OkResult<{
      rev: number;
      entries: { id: string; _axe?: { affordances: { action: string; input: unknown }[] } }[];
    }>;
    expect(r.status).toBe("ok");
    const gibbs = r.output.entries.find((e) => e.id === "pick:me:Gibbs")!;
    expect(gibbs._axe?.affordances[0]).toEqual({
      action: "surface.act",
      title: "Draft Gibbs",
      input: { target: "pick:me:Gibbs", op: "CLICK", expectedRev: 0 },
      primary: true,
    });
  });

  it("act runs the handler as the authenticated user, and a stale rev is conflict", async () => {
    const b = board();
    const { call } = serve(b.surface);
    const ok = (await call(
      "/axe/actions/surface.act",
      { input: { target: "pick:me:Gibbs", op: "CLICK", expectedRev: 0 }, idempotencyKey: "k1" },
      { Authorization: "Bearer user:dana" },
    )) as OkResult<{ actor: string; rev: number }>;
    expect(ok.status).toBe("ok");
    expect(ok.output.actor).toBe("dana");
    expect(b.log[0]).toMatchObject({ p: "Gibbs", actor: "dana" });
    const stale = (await call("/axe/actions/surface.act", {
      input: { target: "pick:me:Robinson", op: "CLICK", expectedRev: 0 },
      idempotencyKey: "k2",
    })) as ErrorResult;
    expect(stale.error.code).toBe("conflict");
    expect(stale.error.details).toMatchObject({ rev: 1, expectedRev: 0 });
    // Idempotent replay of the same key returns the original result without re-running the handler.
    const replay = (await call(
      "/axe/actions/surface.act",
      { input: { target: "pick:me:Gibbs", op: "CLICK", expectedRev: 0 }, idempotencyKey: "k1" },
      { Authorization: "Bearer user:dana" },
    )) as OkResult<{ rev: number }>;
    expect(replay).toEqual(ok);
    expect(b.log).toHaveLength(1);
  });

  it("an unavailable control with requires becomes needs_input; continuing fulfills and re-acts", async () => {
    const s = createSurface({ app: "planning-app" });
    let approved = false;
    let locked = false;
    s.register({
      id: "lock:march",
      kind: "action",
      role: "button",
      name: "Lock March",
      object: "month:2026-03",
      state: {
        available: false,
        reason: "approval required",
        requires: {
          accepts: [accept(kinds.consent.terms, { description: "Record the approval." })],
          fulfill: () => {
            approved = true;
            refresh();
          },
        },
      },
      effect: { mutates: "locks", idempotent: true, reversible: true, risk: "high" },
      handler: () => {
        locked = true;
        s.bump();
      },
    });
    const refresh = () => {
      const e = s.get("lock:march");
      if (e && e.kind === "action")
        s.register({ ...e, state: approved ? { available: true } : e.state! });
    };
    const { call, events, flush } = serve(s);
    const ni = (await call("/axe/actions/surface.act", {
      input: { target: "lock:march", op: "CLICK", expectedRev: 0 },
      idempotencyKey: "k",
    })) as NeedsInputResult;
    expect(ni.status).toBe("needs_input");
    expect(ni.accepts[0]!.kind).toBe("consent.terms");
    const done = (await call("/axe/continue", {
      continuationToken: ni.continuationToken,
      kind: "consent.terms",
      payload: {
        policyUrl: "https://plan.example/policy",
        policyVersion: "2026-03",
        scope: "month-lock",
        acceptedAt: "2026-03-01T00:00:00Z",
      },
    })) as OkResult<{ changed: string[] }>;
    expect(done.status).toBe("ok");
    expect(locked).toBe(true);
    expect(done.output.changed).toEqual(["lock:march"]);
    // Both the refused first attempt and the re-act after continue are ledgered and emitted.
    expect(s.ledger().map((e) => [e.seq, e.status])).toEqual([
      [1, "unavailable"],
      [2, "ok"],
    ]);
    await flush();
    expect(events.map((e) => [e.action, e.status, e.errorCode, e.details.seq])).toEqual([
      ["surface.act", "error", "unavailable", 1],
      ["surface.act", "ok", null, 2],
    ]);
  });

  it("an unavailable control with only a handoff becomes needs_human; resume re-acts", async () => {
    const s = createSurface();
    let signed = false;
    s.register({
      id: "sign",
      kind: "action",
      role: "button",
      name: "Sign the lease",
      object: "lease:1",
      state: {
        available: false,
        reason: "in-person signature required",
        handoff: {
          reason: "signature_required",
          instructions: "Sign at the leasing office.",
          url: "https://plan.example/leases/1",
          whatAgentShouldSayToUser: "The lease has to be signed in person.",
        },
      },
      effect: { mutates: "lease", risk: "high" },
      handler: () => {
        signed = true;
        s.bump();
      },
    });
    const { call } = serve(s);
    const nh = (await call("/axe/actions/surface.act", {
      input: { target: "sign", op: "CLICK", expectedRev: 0 },
      idempotencyKey: "k",
    })) as NeedsHumanResult;
    expect(nh.status).toBe("needs_human");
    expect(nh.handoff.url).toContain("axe_handoff=");
    // The human signs: the application makes the control available, then the agent resumes.
    const e = s.get("sign");
    if (e && e.kind === "action") s.register({ ...e, state: { available: true } });
    const done = (await call("/axe/resume", { resumeToken: nh.handoff.resumeToken })) as OkResult<{
      id: string;
    }>;
    expect(done.status).toBe("ok");
    expect(signed).toBe(true);
  });

  it("plain refusals stay errors with the reason", async () => {
    const b = board();
    b.setDrafting(false);
    const { call } = serve(b.surface);
    const r = (await call("/axe/actions/surface.act", {
      input: { target: "pick:me:Gibbs", op: "CLICK", expectedRev: 1 },
      idempotencyKey: "k",
    })) as ErrorResult;
    expect(r.error.code).toBe("unavailable");
    expect(r.error.message).toContain("draft not started");
  });

  it("emits one action event per act, run or refused, naming the actor and the ledger seq [S-AXE-4]", async () => {
    const b = board();
    const { call, events, flush } = serve(b.surface);
    await call(
      "/axe/actions/surface.act",
      { input: { target: "pick:me:Gibbs", op: "CLICK", expectedRev: 0 }, idempotencyKey: "k1" },
      { Authorization: "Bearer user:dana" },
    );
    await call("/axe/actions/surface.act", {
      input: { target: "pick:me:Robinson", op: "CLICK", expectedRev: 0 },
      idempotencyKey: "k2",
    });
    await flush();
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      schemaVersion: 1,
      ts: expect.any(String),
      action: "surface.act",
      event: "surface.act",
      status: "ok",
      errorCode: null,
      actor: "dana",
      details: {
        seq: 1,
        op: "CLICK",
        target: "pick:me:Gibbs",
        revBefore: 0,
        revAfter: 1,
        changed: ["pick:me:Gibbs"],
      },
      tenant: null,
    });
    expect(events[1]).toMatchObject({
      status: "error",
      errorCode: "conflict",
      actor: "agent",
      details: { seq: 2, target: "pick:me:Robinson", revBefore: 1, revAfter: 1, changed: [] },
    });
  });

  it("ledger is a read-only action with display; since and limit select entries", async () => {
    const b = board();
    const { call, axe } = serve(b.surface);
    await call(
      "/axe/actions/surface.act",
      { input: { target: "pick:me:Gibbs", op: "CLICK", expectedRev: 0 }, idempotencyKey: "k1" },
      { Authorization: "Bearer user:dana" },
    );
    await call("/axe/actions/surface.act", {
      input: { target: "pick:me:Robinson", op: "CLICK", expectedRev: 0 },
      idempotencyKey: "k2",
    });
    type Out = OkResult<{
      ledgerSeq: number;
      entries: { seq: number; actor: string; status: string; target: unknown }[];
    }>;
    const all = (await call("/axe/actions/surface.ledger", { input: {} })) as Out;
    expect(all.status).toBe("ok");
    expect(all.output.ledgerSeq).toBe(2);
    expect(all.output.entries.map((e) => [e.seq, e.actor, e.status])).toEqual([
      [1, "dana", "ok"],
      [2, "agent", "conflict"],
    ]);
    const since = (await call("/axe/actions/surface.ledger", { input: { since: 1 } })) as Out;
    expect(since.output.entries.map((e) => e.seq)).toEqual([2]);
    const last = (await call("/axe/actions/surface.ledger", { input: { limit: 1 } })) as Out;
    expect(last.output.entries.map((e) => e.seq)).toEqual([2]);
    const bad = (await call("/axe/actions/surface.ledger", {
      input: { since: -1 },
    })) as ErrorResult;
    expect(bad.error.code).toBe("invalid_input");
    const ledger = axe.describe().actions.find((a) => a.name === "surface.ledger")!;
    expect(ledger.readOnly).toBe(true);
    expect(ledger.display?.item?.id).toBe("/seq");
  });
});
