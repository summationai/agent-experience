import { describe, expect, it } from "vitest";
import { createSurface } from "../src/index";
import type { ActResult, LedgerEntry, LedgerQuery } from "../src/index";
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
      seq: 1,
    });
    expect(b.log).toEqual([{ p: "Gibbs", actor: "agent", rev: 1 }]);
  });

  it("stale revision is conflict and applies nothing [S-ACT-2]", async () => {
    const b = board();
    const r = await b.surface.act({ op: "CLICK", target: "pick:me:Gibbs", expectedRev: 5 });
    expect(codeOf(r)).toBe("conflict");
    if (r.status === "error") {
      expect(r.error.retryable).toBe(true);
      expect(r.error.details).toEqual({ rev: 0, expectedRev: 5, seq: 1 });
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

describe("target validation [S-ACT-6] [S-ACT-7] [S-ACT-8]", () => {
  // The first trial found an act with a null target landing on a disabled row. Anything that is
  // not a non-empty id or a non-negative integer index is refused before any lookup.
  const badTargets: [string, unknown][] = [
    ["null", null],
    ["undefined", undefined],
    ["empty string", ""],
    ["negative index", -1],
    ["fraction", 1.5],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["boolean", true],
    ["object", { id: "undo" }],
    ["array", [1]],
  ];

  it.each(badTargets)("%s is invalid_input naming target, and no handler runs", async (_l, t) => {
    const b = board();
    b.setDrafting(false); // every pick row is now unavailable: the shape the defect needed
    const v = b.surface.observe();
    const r = await b.surface.act({ op: "CLICK", target: t as never, expectedRev: v.rev });
    expect(codeOf(r)).toBe("invalid_input");
    if (r.status === "error") {
      expect(r.error.details?.issues?.[0]?.path).toBe("/target");
      expect(r.error.retryable).toBe(false);
    }
    expect(b.log).toEqual([]);
    expect(b.surface.currentRev()).toBe(v.rev);
  });

  it("an index resolves only to the row whose index it is; unavailable rows have none", async () => {
    const s = createSurface();
    const ran: string[] = [];
    // Registration order puts the disabled row first, so a positional lookup would hit it.
    s.register({
      id: "disabled",
      kind: "action",
      role: "button",
      name: "Disabled",
      state: { available: false, reason: "not yours" },
      effect: { mutates: "x" },
      handler: () => ran.push("disabled"),
    });
    s.register({
      id: "enabled",
      kind: "action",
      role: "button",
      name: "Enabled",
      state: { available: true },
      effect: { mutates: "x" },
      handler: () => ran.push("enabled"),
    });
    const v = s.observe();
    expect(v.entries.map((e) => [e.id, e.index])).toEqual([
      ["disabled", null],
      ["enabled", 1],
    ]);
    expect(codeOf(await s.act({ op: "CLICK", target: 1, expectedRev: v.rev }))).toBe("ok");
    expect(ran).toEqual(["enabled"]);
    // Out of range in either direction is not_found; 0 is never an index.
    expect(codeOf(await s.act({ op: "CLICK", target: 0, expectedRev: v.rev }))).toBe("not_found");
    expect(codeOf(await s.act({ op: "CLICK", target: 2, expectedRev: v.rev }))).toBe("not_found");
    expect(ran).toEqual(["enabled"]);
  });

  it("a stale revision is conflict before the target is looked at, even for a target that does not exist", async () => {
    const b = board();
    const v = b.surface.observe();
    b.human("Gibbs");
    // The rows shifted: index 1 now names a different player. The guard runs first.
    const shifted = await b.surface.act({ op: "CLICK", target: 1, expectedRev: v.rev });
    expect(codeOf(shifted)).toBe("conflict");
    const missing = await b.surface.act({ op: "CLICK", target: 99, expectedRev: v.rev });
    expect(codeOf(missing)).toBe("conflict");
    const unknownId = await b.surface.act({ op: "CLICK", target: "nope", expectedRev: v.rev });
    expect(codeOf(unknownId)).toBe("conflict");
    expect(b.log.map((e) => e.actor)).toEqual(["user"]);
  });

  it("an id that names an unavailable entry is unavailable with the reason, not not_found", async () => {
    const b = board();
    b.setDrafting(false);
    const v = b.surface.observe();
    expect(b.idx("Draft Gibbs")).toBeNull();
    const r = await b.surface.act({ op: "CLICK", target: "pick:me:Gibbs", expectedRev: v.rev });
    expect(codeOf(r)).toBe("unavailable");
    if (r.status === "error") expect(r.error.details?.reason).toBe("draft not started");
    expect(b.log).toEqual([]);
  });
});

describe("freeze and thaw [S-REV-5] [S-FRZ-1..4]", () => {
  it("freeze hides availability with the reason, refuses acts, and moves the revision; thaw restores and moves it again", async () => {
    const s = createSurface();
    let clicks = 0;
    let typed = "";
    let more = 0;
    s.register({
      id: "save",
      kind: "action",
      role: "button",
      name: "Save plan",
      state: { available: true },
      effect: { mutates: "plan" },
      handler: () => {
        clicks++;
      },
    });
    s.register({
      id: "cell",
      kind: "field",
      role: "textbox",
      name: "March demand",
      value: "4.2M",
      edit: {
        maxLength: 10,
        set: (t) => {
          typed = t;
        },
      },
    });
    s.register({
      id: "grid",
      kind: "collection",
      role: "grid",
      name: "Months",
      more: () => {
        more++;
      },
    });
    const before = s.observe();
    expect(before.frozen).toBeUndefined();
    expect(before.entries.map((e) => e.index)).toEqual([1, 2, 3]);

    const thaw = s.freeze("saving");
    const during = s.observe();
    expect(during.rev).toBe(before.rev + 1);
    expect(during.frozen).toEqual({ reason: "saving" });
    expect(during.entries.map((e) => e.index)).toEqual([null, null, null]);
    expect(during.entries[0]!.state).toEqual({ available: false, reason: "saving" });
    expect(during.entries[1]!.edit).toEqual({
      op: "TYPE_TEXT",
      maxLength: null,
      readOnly: true,
      reason: "saving",
    });
    expect(during.entries[1]!.value).toBe("4.2M");

    for (const req of [
      { op: "CLICK", target: "save" },
      { op: "TYPE_TEXT", target: "cell", text: "5M" },
      { op: "SCROLL_DOWN", target: "grid" },
    ] as const) {
      const r = await s.act({ ...req, expectedRev: during.rev });
      expect(codeOf(r)).toBe("unavailable");
      if (r.status === "error") {
        expect(r.error.message).toContain("saving");
        expect(r.error.details?.reason).toBe("saving");
        expect(r.error.retryable).toBe(true);
      }
    }
    // An index observed before the freeze is caught by the revision guard, not resolved.
    expect(codeOf(await s.act({ op: "CLICK", target: 1, expectedRev: before.rev }))).toBe(
      "conflict",
    );
    // During the freeze no row carries an index, so a number finds nothing.
    expect(codeOf(await s.act({ op: "CLICK", target: 1, expectedRev: during.rev }))).toBe(
      "not_found",
    );
    expect([clicks, typed, more]).toEqual([0, "", 0]);

    thaw();
    const after = s.observe();
    expect(after.rev).toBe(during.rev + 1);
    expect(after.frozen).toBeUndefined();
    expect(after.entries.map((e) => e.index)).toEqual([1, 2, 3]);
    expect(after.entries[1]!.edit?.maxLength).toBe(10);
    expect(codeOf(await s.act({ op: "CLICK", target: "save", expectedRev: after.rev }))).toBe("ok");
    expect(clicks).toBe(1);
    // A second thaw of the same freeze is a no-op: no revision move, no listener.
    const seen: number[] = [];
    s.onChange((e) => seen.push(e.rev));
    thaw();
    expect(seen).toEqual([]);
  });

  it("nested freezes are counted: the newest reason shows, and the surface thaws with the last release", () => {
    const s = createSurface();
    s.register({
      id: "a",
      kind: "action",
      role: "button",
      name: "A",
      state: { available: true },
      effect: { mutates: "x" },
      handler() {},
    });
    const events: Record<string, unknown>[] = [];
    s.onChange((e) => events.push(e));
    const thawSave = s.freeze("saving");
    const thawModal = s.freeze("a dialog is open");
    expect(s.observe().frozen).toEqual({ reason: "a dialog is open" });
    thawModal();
    expect(s.observe().frozen).toEqual({ reason: "saving" });
    expect(s.observe().entries[0]!.index).toBeNull();
    thawSave();
    expect(s.observe().frozen).toBeUndefined();
    expect(s.observe().entries[0]!.index).toBe(1);
    expect(s.currentRev()).toBe(4);
    expect(events.map((e) => e.rev)).toEqual([1, 2, 3, 4]);
    expect(events[0]!.frozen).toBe("saving");
    expect(events[3]!.thawed).toBe("saving");
    // Releasing out of order works too: the outer freeze lifting first leaves the inner reason.
    const outer = s.freeze("saving");
    const inner = s.freeze("loading");
    outer();
    expect(s.observe().frozen).toEqual({ reason: "loading" });
    inner();
    expect(s.observe().frozen).toBeUndefined();
  });

  it("an application freezes while a save is in flight, so a second actor's act is refused instead of running into the frozen UI", async () => {
    // The planning-grid shape: cells disable during a save; the saved value comes back from the
    // server; the surface must report the freeze at the revision the other actor observes.
    const s = createSurface({ app: "planning" });
    const stored: Record<string, string> = { "cell:2026-03": "4.2M" };
    const writes: [string, string][] = [];
    let release!: () => void;
    const persist = () => new Promise<void>((resolve) => (release = resolve));
    const registerCell = (id: string) =>
      s.register({
        id,
        kind: "field",
        role: "textbox",
        name: `${id} demand`,
        value: stored[id] ?? null,
        edit: {
          set: async (text, actor) => {
            writes.push([text, actor]);
            const thaw = s.freeze("saving");
            try {
              await persist();
              stored[id] = text;
              registerCell(id);
            } finally {
              thaw();
            }
          },
        },
      });
    registerCell("cell:2026-03");

    const userView = s.observe();
    const userAct = s.act({
      op: "TYPE_TEXT",
      target: "cell:2026-03",
      text: "4.6M",
      expectedRev: userView.rev,
      actor: "user",
    });
    // The save is in flight. An agent arriving now sees the freeze and is refused.
    const agentView = s.observe();
    expect(agentView.frozen).toEqual({ reason: "saving" });
    expect(agentView.entries[0]!.edit?.readOnly).toBe(true);
    expect(agentView.entries[0]!.edit?.reason).toBe("saving");
    expect(agentView.entries[0]!.value).toBe("4.2M");
    const refused = await s.act({
      op: "TYPE_TEXT",
      target: "cell:2026-03",
      text: "9M",
      expectedRev: agentView.rev,
      actor: "agent",
    });
    expect(codeOf(refused)).toBe("unavailable");
    if (refused.status === "error") expect(refused.error.details?.reason).toBe("saving");
    // An agent that observed before the save planned against a revision that has since moved.
    expect(
      codeOf(
        await s.act({
          op: "TYPE_TEXT",
          target: "cell:2026-03",
          text: "9M",
          expectedRev: userView.rev,
          actor: "agent",
        }),
      ),
    ).toBe("conflict");

    release();
    const done = await userAct;
    expect(codeOf(done)).toBe("ok");
    expect(writes).toEqual([["4.6M", "user"]]);
    const after = s.observe();
    expect(after.frozen).toBeUndefined();
    expect(after.rev).toBe(userView.rev + 2);
    expect(after.entries[0]!.value).toBe("4.6M");
    expect(after.entries[0]!.edit?.readOnly).toBe(false);
    const agentAct = s.act({
      op: "TYPE_TEXT",
      target: "cell:2026-03",
      text: "4.8M",
      expectedRev: after.rev,
      actor: "agent",
    });
    expect(s.observe().frozen).toEqual({ reason: "saving" });
    release();
    expect(codeOf(await agentAct)).toBe("ok");
    expect(s.observe().frozen).toBeUndefined();
    expect(writes).toEqual([
      ["4.6M", "user"],
      ["4.8M", "agent"],
    ]);
  });
});

describe("the ledger [S-LED-1..7]", () => {
  const at = "2026-10-01T00:00:00.000Z";

  it("records every act: ok with the revisions it spanned, refusals with the code and nothing changed [S-LED-1] [S-LED-3] [S-LED-4] [S-LED-5]", async () => {
    const b = board({ now: () => new Date(at) });
    const v = b.surface.observe();
    expect(v.ledgerSeq).toBe(0);
    const ok = await b.surface.act({
      op: "CLICK",
      target: b.idx("Draft Gibbs")!,
      expectedRev: v.rev,
      actor: "dana",
    });
    expect(okOf(ok)?.seq).toBe(1);
    const stale = await b.surface.act({
      op: "CLICK",
      target: "pick:me:Robinson",
      expectedRev: v.rev,
    });
    expect(codeOf(stale)).toBe("conflict");
    if (stale.status === "error") expect(stale.error.details?.seq).toBe(2);
    expect(codeOf(await b.surface.act({ op: "CLICK", target: "nope", expectedRev: 1 }))).toBe(
      "not_found",
    );
    b.setDrafting(false);
    expect(
      codeOf(await b.surface.act({ op: "CLICK", target: "pick:me:Chase", expectedRev: 2 })),
    ).toBe("unavailable");
    expect(b.surface.ledger()).toEqual([
      {
        seq: 1,
        at,
        op: "CLICK",
        // An index target is recorded as the id it resolved to.
        target: "pick:me:Gibbs",
        actor: "dana",
        revBefore: 0,
        revAfter: 1,
        status: "ok",
        changed: ["pick:me:Gibbs"],
      },
      {
        seq: 2,
        at,
        op: "CLICK",
        target: "pick:me:Robinson",
        actor: "agent",
        revBefore: 1,
        revAfter: 1,
        status: "conflict",
        changed: [],
      },
      {
        seq: 3,
        at,
        op: "CLICK",
        target: "nope",
        actor: "agent",
        revBefore: 1,
        revAfter: 1,
        status: "not_found",
        changed: [],
      },
      {
        seq: 4,
        at,
        op: "CLICK",
        target: "pick:me:Chase",
        actor: "agent",
        revBefore: 2,
        revAfter: 2,
        status: "unavailable",
        changed: [],
      },
    ]);
    expect(b.surface.observe().ledgerSeq).toBe(4);
    // The handler saw the same actor the ledger names.
    expect(b.log).toEqual([{ p: "Gibbs", actor: "dana", rev: 1 }]);
  });

  it("since, actor, and limit select entries, oldest first [S-LED-2]", async () => {
    const s = createSurface();
    let n = 0;
    s.register({
      id: "inc",
      kind: "action",
      role: "button",
      name: "Increment",
      state: { available: true },
      effect: { mutates: "n" },
      handler: () => {
        n++;
        s.bump();
      },
    });
    for (const actor of ["agent", "user", "agent", "agent", "user"])
      await s.act({ op: "CLICK", target: "inc", expectedRev: s.currentRev(), actor });
    const seqs = (q?: LedgerQuery) => s.ledger(q).map((e) => e.seq);
    expect(n).toBe(5);
    expect(seqs()).toEqual([1, 2, 3, 4, 5]);
    expect(seqs({ since: 3 })).toEqual([4, 5]);
    expect(seqs({ since: 5 })).toEqual([]);
    expect(seqs({ actor: "user" })).toEqual([2, 5]);
    // Without since, limit keeps the newest; with since, the oldest after it, so a reader pages forward.
    expect(seqs({ limit: 2 })).toEqual([4, 5]);
    expect(seqs({ since: 1, limit: 2 })).toEqual([2, 3]);
    expect(seqs({ since: 0, actor: "user", limit: 1 })).toEqual([2]);
    expect(s.ledger()[0]).toMatchObject({ revBefore: 0, revAfter: 1 });
    expect(s.ledger()[4]).toMatchObject({ revBefore: 4, revAfter: 5 });
  });

  it("keeps only the most recent `ledger.max` entries; seq never restarts [S-LED-6]", async () => {
    const s = createSurface({ ledger: { max: 3 } });
    s.register({
      id: "noop",
      kind: "action",
      role: "button",
      name: "Do nothing",
      state: { available: true },
      effect: { mutates: "nothing", idempotent: true },
      handler: () => {},
    });
    for (let i = 0; i < 5; i++) await s.act({ op: "CLICK", target: "noop", expectedRev: 0 });
    expect(s.ledger().map((e) => e.seq)).toEqual([3, 4, 5]);
    expect(s.observe().ledgerSeq).toBe(5);
    expect(s.ledger()[0]).toMatchObject({ status: "ok", changed: [], revBefore: 0, revAfter: 0 });
  });

  it("a handler that throws is recorded as internal and the error still propagates [S-LED-4]", async () => {
    const s = createSurface();
    s.register({
      id: "boom",
      kind: "action",
      role: "button",
      name: "Explode",
      state: { available: true },
      effect: { mutates: "everything", risk: "high" },
      handler: () => {
        throw new Error("db down");
      },
    });
    await expect(
      s.act({ op: "CLICK", target: "boom", expectedRev: 0, actor: "u" }),
    ).rejects.toThrow("db down");
    expect(s.ledger()).toMatchObject([
      { seq: 1, target: "boom", actor: "u", status: "internal", changed: [] },
    ]);
  });

  it("records the text a field was given; reset clears the ledger", async () => {
    const s = createSurface();
    s.register({ id: "note", kind: "field", role: "textbox", name: "Note", edit: { set() {} } });
    await s.act({ op: "TYPE_TEXT", target: "note", expectedRev: 0, text: "hello" });
    expect(s.ledger()[0]).toMatchObject({ op: "TYPE_TEXT", text: "hello", status: "ok" });
    s.reset();
    expect(s.ledger()).toEqual([]);
    expect(s.observe().ledgerSeq).toBe(0);
  });

  it("expose publishes the ledger beside observe, act, and rev [S-DOM-2]", async () => {
    const b = board();
    const host: {
      __surface?: {
        act: (r: unknown) => Promise<ActResult>;
        ledger: (q?: LedgerQuery) => LedgerEntry[];
      };
    } = {};
    b.surface.expose(host);
    await host.__surface!.act({ op: "CLICK", target: "pick:me:Chase", expectedRev: 0 });
    expect(host.__surface!.ledger().map((e) => [e.seq, e.target, e.status])).toEqual([
      [1, "pick:me:Chase", "ok"],
    ]);
    expect(host.__surface!.ledger({ since: 1 })).toEqual([]);
  });
});
