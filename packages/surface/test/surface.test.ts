import { describe, expect, it } from "vitest";
import { createSurface } from "../src/index";
import type { ActResult } from "../src/index";
import { kinds, accept } from "@axe/core/kinds";
import { z } from "@axe/core";
import { board } from "./fixtures/board";

const okOf = (r: ActResult) => (r.status === "ok" ? r.output : undefined);
const codeOf = (r: ActResult) => (r.status === "error" ? r.error.code : r.status);

describe("registry and observe", () => {
  it("indexes only what can be acted on and keeps the rest with a reason [S-OBS-1] [S-OBS-2]", () => {
    const s = createSurface({ app: "fantasy-draft", now: () => new Date("2026-10-01T00:00:00Z") });
    s.register({
      id: "pick:me:a",
      kind: "action",
      role: "button",
      name: "Draft a",
      object: "player:a",
      state: { available: true },
      effect: { mutates: "draft", undoable: true },
      handler: () => {},
    });
    s.register({
      id: "pick:me:b",
      kind: "action",
      role: "button",
      name: "Draft b",
      state: { available: false, reason: "already drafted by you" },
      effect: { mutates: "draft" },
      handler: () => {},
    });
    s.register({
      id: "note",
      kind: "field",
      role: "textbox",
      name: "Note",
      value: "hi",
      edit: { maxLength: 5, set() {} },
    });
    s.register({
      id: "board",
      kind: "collection",
      role: "grid",
      name: "Players",
      total: 300,
      loaded: 24,
    });
    const v = s.observe();
    expect(v.protocol).toBe("axe/0.1");
    expect(v.app).toBe("fantasy-draft");
    expect(v.at).toBe("2026-10-01T00:00:00.000Z");
    expect(v.entries.map((e) => [e.id, e.index])).toEqual([
      ["pick:me:a", 1],
      ["pick:me:b", null],
      ["note", 2],
      ["board", null],
    ]);
    expect(v.entries[1]!.state).toEqual({ available: false, reason: "already drafted by you" });
    // Legacy `undoable` maps onto AXE's `reversible`; defaults are truthful and explicit.
    expect(v.entries[0]!.effect).toEqual({
      mutates: "draft",
      readOnly: false,
      idempotent: false,
      reversible: true,
      risk: "medium",
    });
    expect(v.entries[3]!.total).toBe(300);
    expect(v.entries[2]!.edit).toEqual({
      op: "TYPE_TEXT",
      maxLength: 5,
      readOnly: false,
      reason: null,
    });
  });

  it("validates entries at registration with actionable errors", () => {
    const s = createSurface();
    expect(() =>
      s.register({
        id: "x",
        kind: "action",
        role: "button",
        name: "X",
        effect: { mutates: "y" },
      } as never),
    ).toThrow(/needs a handler/);
    expect(() =>
      s.register({ id: "x", kind: "action", role: "button", name: "X", handler() {} } as never),
    ).toThrow(/effect.mutates/);
    expect(() =>
      s.register({ id: "f", kind: "field", role: "textbox", name: "F", edit: {} } as never),
    ).toThrow(/edit.set/);
    expect(() => s.register({ id: "z", kind: "nope" } as never)).toThrow(/kind must be/);
  });

  it("names can be functions; a collection with `more` is actionable; reconcile drops stale rows", () => {
    const s = createSurface();
    let n = 0;
    s.register({
      id: "c",
      kind: "collection",
      role: "grid",
      name: () => `Players (${n})`,
      more: () => {
        n++;
      },
    });
    s.register({
      id: "cell:a",
      kind: "field",
      role: "textbox",
      name: "A",
      edit: { readOnly: true, reason: "derived" },
    });
    s.register({ id: "cell:b", kind: "field", role: "textbox", name: "B", edit: { set() {} } });
    expect(s.observe().entries.map((e) => e.index)).toEqual([1, null, 2]);
    expect(s.observe().entries[1]!.edit).toEqual({
      op: "TYPE_TEXT",
      maxLength: null,
      readOnly: true,
      reason: "derived",
    });
    s.reconcile("cell:", new Set(["cell:b"]));
    expect(s.observe().entries.map((e) => e.id)).toEqual(["c", "cell:b"]);
    expect(s.observe().entries[0]!.name).toBe("Players (0)");
  });

  it("revision: seedRev only moves forward, setRev adopts as is, bump notifies", () => {
    const s = createSurface();
    s.seedRev(41);
    s.seedRev(3);
    expect(s.currentRev()).toBe(41);
    s.setRev(7);
    expect(s.currentRev()).toBe(7);
    const seen: number[] = [];
    const off = s.onChange((e) => seen.push(e.rev));
    expect(s.bump({ what: "pick" })).toBe(8);
    off();
    s.bump();
    expect(seen).toEqual([8]);
  });
});

describe("act returns the AXE result envelope", () => {
  it("ok on an available action, with actor and changed ids [S-ACT-1]", async () => {
    const b = board();
    const v = b.surface.observe();
    const r = await b.surface.act({
      op: "CLICK",
      target: "pick:me:Gibbs",
      expectedRev: v.rev,
      actor: "agent",
    });
    expect(okOf(r)).toEqual({
      rev: 1,
      id: "pick:me:Gibbs",
      actor: "agent",
      changed: ["pick:me:Gibbs"],
    });
    expect(b.log).toEqual([{ p: "Gibbs", actor: "agent", rev: 1 }]);
  });

  it("stale revision is conflict and applies nothing [S-ACT-2]", async () => {
    const b = board();
    const r = await b.surface.act({ op: "CLICK", target: "pick:me:Gibbs", expectedRev: 5 });
    expect(codeOf(r)).toBe("conflict");
    if (r.status === "error") {
      expect(r.error.retryable).toBe(true);
      expect(r.error.details).toEqual({ rev: 0, expectedRev: 5 });
    }
    expect(b.log).toEqual([]);
  });

  it("missing expectedRev and unknown ops are invalid_input with paths [S-ACT-3]", async () => {
    const b = board();
    const r1 = await b.surface.act({ op: "CLICK", target: "undo" } as never);
    expect(codeOf(r1)).toBe("invalid_input");
    if (r1.status === "error") expect(r1.error.details?.issues?.[0]?.path).toBe("/expectedRev");
    const r2 = await b.surface.act({ op: "HOVER" as never, target: "undo", expectedRev: 0 });
    expect(codeOf(r2)).toBe("invalid_input");
  });

  it("unknown target is not_found; wrong op for the kind is invalid_input", async () => {
    const b = board();
    expect(codeOf(await b.surface.act({ op: "CLICK", target: "nope", expectedRev: 0 }))).toBe(
      "not_found",
    );
    expect(codeOf(await b.surface.act({ op: "CLICK", target: 99, expectedRev: 0 }))).toBe(
      "not_found",
    );
    expect(
      codeOf(await b.surface.act({ op: "TYPE_TEXT", target: "undo", expectedRev: 0, text: "x" })),
    ).toBe("invalid_input");
  });

  it("unavailable actions are refused with the reason, and carry requires/handoff when declared [S-ACT-4]", async () => {
    const s = createSurface();
    let approved = false;
    s.register({
      id: "lock:march",
      kind: "action",
      role: "button",
      name: "Lock March",
      object: "month:2026-03",
      state: approved
        ? { available: true }
        : {
            available: false,
            reason: "approval required",
            requires: {
              accepts: [
                accept(kinds.consent.terms, {
                  description: "Record the planner's approval of the lock.",
                }),
              ],
              fulfill: () => {
                approved = true;
              },
            },
            handoff: {
              reason: "approval_required",
              instructions: "Approve the lock in the planning app.",
              url: "https://plan.example/locks/2026-03",
              whatAgentShouldSayToUser: "The March lock needs your approval in the planning app.",
            },
          },
      effect: {
        mutates: "locks",
        idempotent: true,
        reversible: true,
        risk: "high",
        text: "reason for the lock",
      },
      handler: () => {},
    });
    const v = s.observe();
    expect(v.entries[0]!.state?.requires?.[0]?.kind).toBe("consent.terms");
    expect(v.entries[0]!.state?.handoff?.url).toBe("https://plan.example/locks/2026-03");
    expect(v.entries[0]!.effect?.text).toBe("reason for the lock");
    const r = await s.act({ op: "CLICK", target: "lock:march", expectedRev: v.rev });
    expect(codeOf(r)).toBe("unavailable");
    if (r.status === "error") {
      expect(r.error.message).toContain("approval required");
      expect((r.error.details?.requires as unknown[]).length).toBe(1);
    }
  });

  it("confirm is required when the effect declares it", async () => {
    const s = createSurface();
    let calls = 0;
    s.register({
      id: "reset",
      kind: "action",
      role: "button",
      name: "Reset the draft",
      state: { available: true },
      effect: { mutates: "draft", confirm: true, risk: "high" },
      handler: () => {
        calls++;
      },
    });
    expect(codeOf(await s.act({ op: "CLICK", target: "reset", expectedRev: 0 }))).toBe(
      "invalid_input",
    );
    expect(calls).toBe(0);
    expect(
      codeOf(await s.act({ op: "CLICK", target: "reset", expectedRev: 0, confirm: true })),
    ).toBe("ok");
    expect(calls).toBe(1);
  });

  it("fields: maxLength, schema validation, read-only refusal, and set with actor", async () => {
    const s = createSurface();
    const seen: [string, string][] = [];
    s.register({
      id: "cell",
      kind: "field",
      role: "textbox",
      name: "March demand",
      value: "4.2M",
      edit: {
        maxLength: 10,
        schema: z.string().regex(/^[0-9.]+M$/),
        set: (t, actor) => {
          seen.push([t, actor]);
          s.bump();
        },
      },
    });
    s.register({
      id: "derived",
      kind: "field",
      role: "textbox",
      name: "Gross margin",
      value: "31%",
      edit: { readOnly: true, reason: "derived from sales and cost" },
    });
    expect(
      codeOf(await s.act({ op: "TYPE_TEXT", target: "cell", expectedRev: 0, text: "4.6M" })),
    ).toBe("ok");
    expect(seen).toEqual([["4.6M", "agent"]]);
    const long = await s.act({
      op: "TYPE_TEXT",
      target: "cell",
      expectedRev: 1,
      text: "x".repeat(11),
    });
    expect(codeOf(long)).toBe("invalid_input");
    const bad = await s.act({ op: "TYPE_TEXT", target: "cell", expectedRev: 1, text: "four" });
    expect(codeOf(bad)).toBe("invalid_input");
    if (bad.status === "error") expect(bad.error.details?.issues?.[0]?.path).toBe("/text");
    const ro = await s.act({ op: "TYPE_TEXT", target: "derived", expectedRev: 1, text: "1" });
    expect(codeOf(ro)).toBe("unavailable");
    if (ro.status === "error") expect(ro.error.message).toContain("derived from sales and cost");
  });

  it("collections load more with SCROLL_DOWN; handlers run through the supplied runner", async () => {
    const s = createSurface();
    let loaded = 24;
    s.register({
      id: "board",
      kind: "collection",
      role: "grid",
      name: "Players",
      total: 300,
      loaded,
      more: () => {
        loaded += 24;
        s.bump();
      },
    });
    const ran: string[] = [];
    const r = await s.act(
      { op: "SCROLL_DOWN", target: "board", expectedRev: 0 },
      {
        run: (fn) => {
          ran.push("run");
          return fn();
        },
      },
    );
    expect(okOf(r)?.changed).toEqual(["board"]);
    expect(ran).toEqual(["run"]);
    expect(loaded).toBe(48);
  });

  it("expose publishes observe, act, and rev on a host", async () => {
    const b = board();
    const host: {
      __surface?: {
        observe: () => unknown;
        act: (r: unknown) => Promise<ActResult>;
        rev: () => number;
      };
    } = {};
    b.surface.expose(host);
    expect(host.__surface!.rev()).toBe(0);
    const r = await host.__surface!.act({ op: "CLICK", target: "pick:me:Chase", expectedRev: 0 });
    expect(codeOf(r)).toBe("ok");
    expect(host.__surface!.rev()).toBe(1);
  });
});

describe("two participants on one application [S-REV-1..4]", () => {
  it("a human move between the agent's observe and act is caught; the agent continues from the new board", async () => {
    const b = board();
    const seen = b.surface.observe();
    const gibbs = seen.entries.find((e) => e.name === "Draft Gibbs")!.index!;
    b.human("Gibbs");
    const r = await b.surface.act({
      op: "CLICK",
      target: gibbs,
      expectedRev: seen.rev,
      actor: "agent",
    });
    expect(codeOf(r)).toBe("conflict");
    expect(b.log.map((e) => `${e.p}:${e.actor}`)).toEqual(["Gibbs:user"]);
    const again = b.surface.observe();
    expect(b.idx("Draft Gibbs")).toBeNull();
    const r2 = await b.surface.act({
      op: "CLICK",
      target: b.idx("Draft Robinson")!,
      expectedRev: again.rev,
      actor: "agent",
    });
    expect(codeOf(r2)).toBe("ok");
    expect(b.log.map((e) => e.p)).toEqual(["Robinson", "Gibbs"]);
  });

  it("a lost response retried with the same rev applies at most once", async () => {
    const b = board();
    const v = b.surface.observe();
    const t = b.idx("Draft Gibbs")!;
    const first = await b.surface.act({ op: "CLICK", target: t, expectedRev: v.rev });
    const retry = await b.surface.act({ op: "CLICK", target: t, expectedRev: v.rev });
    expect(codeOf(first)).toBe("ok");
    expect(codeOf(retry)).toBe("conflict");
    expect(b.log).toHaveLength(1);
  });

  it("an index shift is caught, not misapplied", async () => {
    const b = board();
    const v = b.surface.observe();
    const t = b.idx("Draft Gibbs")!;
    b.human("Gibbs");
    const r = await b.surface.act({ op: "CLICK", target: t, expectedRev: v.rev });
    expect(codeOf(r)).toBe("conflict");
    expect(b.taken.has("Robinson")).toBe(false);
  });

  it("a human undo is visible to the agent as a rev move and a returning row; the ledger names who acted", async () => {
    const b = board();
    let v = b.surface.observe();
    expect(
      codeOf(
        await b.surface.act({
          op: "CLICK",
          target: b.idx("Draft Gibbs")!,
          expectedRev: v.rev,
          actor: "agent",
        }),
      ),
    ).toBe("ok");
    v = b.surface.observe();
    expect(b.idx("Draft Gibbs")).toBeNull();
    expect(
      codeOf(
        await b.surface.act({ op: "CLICK", target: "undo", expectedRev: v.rev, actor: "user" }),
      ),
    ).toBe("ok");
    const after = b.surface.observe();
    expect(after.rev).toBe(v.rev + 1);
    expect(b.idx("Draft Gibbs")).not.toBeNull();
    b.human("Chase");
    v = b.surface.observe();
    await b.surface.act({
      op: "CLICK",
      target: b.idx("Draft Robinson")!,
      expectedRev: v.rev,
      actor: "agent",
    });
    expect(b.log.map((e) => `${e.p}:${e.actor}`)).toEqual(["Robinson:agent", "Chase:user"]);
    expect(b.log.every((e) => typeof e.rev === "number")).toBe(true);
  });
});
