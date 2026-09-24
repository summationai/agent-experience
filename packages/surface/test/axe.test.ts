import { describe, expect, it } from "vitest";
import { createAXE } from "@axe/core";
import { kinds, accept } from "@axe/core/kinds";
import type {
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
  return { axe, call };
}

describe("surfaceActions: a surface served as an AXE manifest", () => {
  it("produces a valid manifest with observe (read, display, affordances) and act (mutating)", () => {
    const b = board();
    const { axe } = serve(b.surface);
    const m: Manifest = axe.describe();
    expect(ManifestSchema.safeParse(m).success).toBe(true);
    expect(m.actions.map((a) => [a.name, a.readOnly, a.risk])).toEqual([
      ["surface.observe", true, "none"],
      ["surface.act", false, "medium"],
    ]);
    expect(m.actions[0]!.display?.kind).toBe("list");
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
    const { call } = serve(s);
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
});
