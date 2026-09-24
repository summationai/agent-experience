// Write preconditions (spec [S-ACT-9] to [S-ACT-11], [S-REV-7], [S-AXE-4]): acts on one surface run
// one at a time and are checked again when they reach execution; a handler carries the presented
// expectedRev into its own conditional write and may refuse with a conflict; a stale report never
// overwrites a newer revision. Every interleaving below is driven by barriers the test resolves.
import { describe, expect, it } from "vitest";
import { createAXE } from "@axe/core";
import type { ErrorResult, OkResult } from "@axe/core/types";
import { createSurface, SurfaceConflict } from "../src/index";
import type { ActContext, ActResult, Surface } from "../src/index";
import { surfaceActions } from "../src/axe";

const codeOf = (r: ActResult) => (r.status === "error" ? r.error.code : r.status);

/** A promise the test resolves when it chooses. */
function barrier<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

/** An action whose handler signals that it started and then waits for the test's gate. */
function gated(s: Surface, id: string, after: (context: ActContext) => unknown = () => undefined) {
  const started = barrier();
  const gate = barrier();
  const calls: ActContext[] = [];
  s.register({
    id,
    kind: "action",
    role: "button",
    name: `Run ${id}`,
    effect: { mutates: "record" },
    handler: async (_actor, _text, context) => {
      calls.push(context);
      started.resolve();
      await gate.promise;
      return after(context);
    },
  });
  return { started, gate, calls };
}

describe("ordering: one act at a time, checked again at execution [S-ACT-9]", () => {
  it("two acts presenting the same expectedRev cannot both commit: the second waits, is re-checked, and is conflict with nothing applied", async () => {
    const s = createSurface();
    const save = gated(s, "save", () => void s.bump());
    const first = s.act({ op: "CLICK", target: "save", expectedRev: 0 });
    const second = s.act({ op: "CLICK", target: "save", expectedRev: 0 });
    await save.started.promise;
    // Reads do not wait on the queue: the table is at rev 0 with nothing recorded yet.
    const view = s.observe();
    expect([view.rev, view.ledgerSeq]).toEqual([0, 0]);
    save.gate.resolve();
    const [a, b] = await Promise.all([first, second]);
    expect(codeOf(a)).toBe("ok");
    expect(codeOf(b)).toBe("conflict");
    expect((b as ErrorResult).error.details).toMatchObject({ expectedRev: 0, currentRev: 1 });
    expect(save.calls).toHaveLength(1);
    expect(s.currentRev()).toBe(1);
    expect(s.ledger().map((e) => [e.status, e.revBefore, e.revAfter, e.changed])).toEqual([
      ["ok", 0, 1, ["save"]],
      ["conflict", 1, 1, []],
    ]);
    // After the predecessor committed, the old expectedRev stays conflict [S-REV-2].
    expect(codeOf(await s.act({ op: "CLICK", target: "save", expectedRev: 0 }))).toBe("conflict");
  });

  it("a completion cannot land out of order: the second handler starts only after the first settled, so its report cannot be overwritten by an older one", async () => {
    const s = createSurface({ revision: "app" });
    s.setRev(1);
    let server = 1;
    const one = gated(s, "one", () => ({ changed: ["one"], rev: ++server }));
    const two = gated(s, "two", () => ({ changed: ["two"], rev: ++server }));
    const first = s.act({ op: "CLICK", target: "one", expectedRev: 1 });
    const second = s.act({ op: "CLICK", target: "two", expectedRev: 1 });
    await one.started.promise;
    // The second handler is queued, not running: releasing its gate first changes nothing.
    two.gate.resolve();
    await Promise.resolve();
    expect(two.calls).toHaveLength(0);
    one.gate.resolve();
    expect(codeOf(await first)).toBe("ok");
    expect(codeOf(await second)).toBe("conflict");
    expect(two.calls).toHaveLength(0);
    expect(s.currentRev()).toBe(2);
    expect(server).toBe(2);
  });

  it("a human change between claim and execution refuses the queued act: nothing applied, the ledger says conflict at the new revision", async () => {
    const s = createSurface({ revision: "app" });
    s.setRev(3);
    const one = gated(s, "one", () => ({ changed: [] }));
    const two = gated(s, "two");
    const first = s.act({ op: "CLICK", target: "one", expectedRev: 3 });
    const second = s.act({ op: "CLICK", target: "two", expectedRev: 3, actor: "agent" });
    await one.started.promise;
    // The person saves through the application's own control; the server's revision arrives.
    s.setRev(4);
    one.gate.resolve();
    expect(codeOf(await first)).toBe("ok");
    const refused = await second;
    expect(codeOf(refused)).toBe("conflict");
    expect((refused as ErrorResult).error.details).toMatchObject({ expectedRev: 3, currentRev: 4 });
    expect(two.calls).toHaveLength(0);
    expect(s.ledger()[1]).toMatchObject({
      target: "two",
      status: "conflict",
      revBefore: 4,
      revAfter: 4,
      changed: [],
    });
  });

  it("a human bump in surface mode between claim and execution is conflict too", async () => {
    const s = createSurface();
    const one = gated(s, "one");
    const two = gated(s, "two");
    const first = s.act({ op: "CLICK", target: "one", expectedRev: 0 });
    const second = s.act({ op: "CLICK", target: "two", expectedRev: 0 });
    await one.started.promise;
    s.bump({ by: "user" });
    one.gate.resolve();
    expect(codeOf(await first)).toBe("ok");
    expect(codeOf(await second)).toBe("conflict");
    expect(two.calls).toHaveLength(0);
  });

  it("a freeze while an act waits refuses it as unavailable with the freeze's reason; its handler never runs", async () => {
    // App mode: the freeze does not move the revision, so only the execution-time check sees it.
    const s = createSurface({ revision: "app" });
    s.setRev(7);
    const one = gated(s, "one", () => ({ changed: [] }));
    const two = gated(s, "two");
    const first = s.act({ op: "CLICK", target: "one", expectedRev: 7 });
    const second = s.act({ op: "CLICK", target: "two", expectedRev: 7 });
    await one.started.promise;
    const thaw = s.freeze("saving");
    one.gate.resolve();
    expect(codeOf(await first)).toBe("ok");
    const refused = await second;
    expect(codeOf(refused)).toBe("unavailable");
    expect((refused as ErrorResult).error.details).toMatchObject({
      reason: "saving",
      frozen: { reason: "saving" },
    });
    expect(two.calls).toHaveLength(0);
    thaw();
    // After the thaw an act at the unchanged revision is accepted: the application vouches for it.
    two.gate.resolve();
    expect(codeOf(await s.act({ op: "CLICK", target: "two", expectedRev: 7 }))).toBe("ok");
  });

  it("an act refused at the claim does not wait behind an act in flight", async () => {
    const s = createSurface();
    const one = gated(s, "one", () => void s.bump());
    const first = s.act({ op: "CLICK", target: "one", expectedRev: 0 });
    await one.started.promise;
    // Stale, unknown, and malformed acts are answered while the first handler is still running.
    expect(codeOf(await s.act({ op: "CLICK", target: "one", expectedRev: 9 }))).toBe("conflict");
    expect(codeOf(await s.act({ op: "CLICK", target: "nope", expectedRev: 0 }))).toBe("not_found");
    expect(one.calls).toHaveLength(1);
    one.gate.resolve();
    expect(codeOf(await first)).toBe("ok");
  });
});

describe("a commit that leaves an app-owned revision in place [S-ACT-10]", () => {
  it("closes the claims taken before it at that revision, and accepts an act claimed after it", async () => {
    // A cell commit whose revision arrives later with setRev: the handler reports nothing.
    const s = createSurface({ revision: "app" });
    s.setRev(20);
    const cell = gated(s, "cell:a");
    const other = gated(s, "cell:b");
    const first = s.act({ op: "CLICK", target: "cell:a", expectedRev: 20 });
    const second = s.act({ op: "CLICK", target: "cell:b", expectedRev: 20 });
    await cell.started.promise;
    cell.gate.resolve();
    expect(codeOf(await first)).toBe("ok");
    const refused = await second;
    expect(codeOf(refused)).toBe("conflict");
    expect(refused.status === "error" && refused.error.message).toContain(
      "has not reported its new revision",
    );
    expect(other.calls).toHaveLength(0);
    // Not a deadlock: an agent that observes again (still rev 20) and acts is accepted.
    other.gate.resolve();
    expect(codeOf(await s.act({ op: "CLICK", target: "cell:b", expectedRev: 20 }))).toBe("ok");
  });

  it("a predecessor that reports changed: [] changed nothing, so the act queued behind it runs", async () => {
    const s = createSurface({ revision: "app" });
    s.setRev(20);
    const noop = gated(s, "noop", () => ({ changed: [] }));
    const next = gated(s, "next", () => ({ changed: ["next"], rev: 21 }));
    const first = s.act({ op: "CLICK", target: "noop", expectedRev: 20 });
    const second = s.act({ op: "CLICK", target: "next", expectedRev: 20 });
    await noop.started.promise;
    noop.gate.resolve();
    next.gate.resolve();
    expect(codeOf(await first)).toBe("ok");
    expect(codeOf(await second)).toBe("ok");
    expect(s.currentRev()).toBe(21);
  });
});

describe("stale handler reports [S-REV-7]", () => {
  it("a reported rev lower than the revision at completion is not adopted; the ledger records it as ignoredRev", async () => {
    const s = createSurface({ revision: "app" });
    s.setRev(10);
    const save = gated(s, "save", () => ({ changed: ["save"], rev: 11 }));
    const pending = s.act({ op: "CLICK", target: "save", expectedRev: 10 });
    await save.started.promise;
    // A newer server revision arrives (another client's save) before the handler's answer.
    s.setRev(12);
    save.gate.resolve();
    const done = await pending;
    expect(codeOf(done)).toBe("ok");
    expect((done as OkResult<{ rev: number; changed: string[] }>).output).toMatchObject({
      rev: 12,
      changed: ["save"],
    });
    expect(s.currentRev()).toBe(12);
    expect(s.ledger()[0]).toMatchObject({
      status: "ok",
      revBefore: 10,
      revAfter: 12,
      ignoredRev: 11,
    });
  });
});

describe("the handler's own precondition [S-ACT-11]", () => {
  it("receives the presented expectedRev and the entry id; a reported conflict is conflict with currentRev, a refusal in the ledger, nothing adopted", async () => {
    const s = createSurface({ revision: "app" });
    s.setRev(40);
    const seen: ActContext[] = [];
    s.register({
      id: "lock:2026-03",
      kind: "action",
      role: "button",
      name: "Lock March",
      effect: { mutates: "locks" },
      handler: (_actor, _text, context) => {
        seen.push(context);
        return { conflict: { currentRev: 43 }, changed: ["lock:2026-03"], rev: 44 };
      },
    });
    const r = await s.act({ op: "CLICK", target: "lock:2026-03", expectedRev: 40 });
    expect(seen).toEqual([{ id: "lock:2026-03", op: "CLICK", expectedRev: 40, actor: "agent" }]);
    expect(codeOf(r)).toBe("conflict");
    expect((r as ErrorResult).error.retryable).toBe(true);
    expect((r as ErrorResult).error.details).toMatchObject({
      expectedRev: 40,
      currentRev: 43,
      seq: 1,
    });
    expect(s.currentRev()).toBe(40);
    expect(s.ledger()[0]).toMatchObject({
      status: "conflict",
      revBefore: 40,
      revAfter: 40,
      changed: [],
    });
  });

  it("a thrown SurfaceConflict is the same refusal, not internal; the field setter and the collection receive the context too", async () => {
    const s = createSurface({ revision: "app" });
    s.setRev(5);
    const contexts: ActContext[] = [];
    s.register({
      id: "cell",
      kind: "field",
      role: "textbox",
      name: "March demand",
      edit: {
        set: (_text, _actor, context) => {
          contexts.push(context);
          throw new SurfaceConflict("the plan moved on", { currentRev: 6 });
        },
      },
    });
    s.register({
      id: "grid",
      kind: "collection",
      role: "grid",
      name: "Plan grid",
      more: (context) => {
        contexts.push(context);
        throw new SurfaceConflict();
      },
    });
    const r = await s.act({ op: "TYPE_TEXT", target: "cell", text: "4.6M", expectedRev: 5 });
    expect(codeOf(r)).toBe("conflict");
    expect((r as ErrorResult).error.details).toMatchObject({ expectedRev: 5, currentRev: 6 });
    const g = await s.act({ op: "SCROLL_DOWN", target: "grid", expectedRev: 5 });
    // Without a reported revision, currentRev is the surface's own.
    expect((g as ErrorResult).error.details).toMatchObject({ expectedRev: 5, currentRev: 5 });
    expect(contexts.map((c) => [c.id, c.op, c.expectedRev])).toEqual([
      ["cell", "TYPE_TEXT", 5],
      ["grid", "SCROLL_DOWN", 5],
    ]);
    expect(s.ledger().map((e) => e.status)).toEqual(["conflict", "conflict"]);
    expect(s.currentRev()).toBe(5);
  });
});

describe("two instances of the planning shape [S-ACT-11]", () => {
  /** The server: one branch revision, and a write that applies only at the expected revision. */
  function planStore() {
    const store = {
      revision: 5,
      cells: { "cell:demand:2026-03": "4.2M" } as Record<string, string>,
    };
    const writes: string[] = [];
    const conditionalWrite = (id: string, value: string, expected: number) => {
      // UPDATE cells SET value = $value, revision = revision + 1 WHERE revision = $expected
      if (store.revision !== expected)
        throw new SurfaceConflict("The plan changed on the server.", {
          currentRev: store.revision,
        });
      store.cells[id] = value;
      store.revision += 1;
      writes.push(value);
      return { changed: [id], rev: store.revision };
    };
    return { store, writes, conditionalWrite };
  }

  /** One browser tab: its own surface, app-owned revision adopted from the server. */
  function tab(server: ReturnType<typeof planStore>, gate: Promise<void>, started: () => void) {
    const s = createSurface({ app: "planning-app", revision: "app" });
    s.setRev(server.store.revision);
    s.register({
      id: "cell:demand:2026-03",
      kind: "field",
      role: "textbox",
      name: "Demand, March 2026",
      edit: {
        maxLength: 40,
        set: async (text, _actor, { id, expectedRev }) => {
          started();
          await gate; // the round trip to the server
          return server.conditionalWrite(id, text, expectedRev);
        },
      },
    });
    return s;
  }

  it("both tabs pass their own gates at rev 5; the server's conditional write lets one commit and the other is conflict with nothing applied", async () => {
    const server = planStore();
    const gate = barrier();
    let startedCount = 0;
    const bothStarted = barrier();
    const onStart = () => {
      if (++startedCount === 2) bothStarted.resolve();
    };
    const a = tab(server, gate.promise, onStart);
    const b = tab(server, gate.promise, onStart);
    const fromA = a.act({
      op: "TYPE_TEXT",
      target: "cell:demand:2026-03",
      text: "4.6M",
      expectedRev: 5,
    });
    const fromB = b.act({
      op: "TYPE_TEXT",
      target: "cell:demand:2026-03",
      text: "5.1M",
      expectedRev: 5,
    });
    await bothStarted.promise;
    gate.resolve();
    const [ra, rb] = await Promise.all([fromA, fromB]);
    expect([codeOf(ra), codeOf(rb)]).toEqual(["ok", "conflict"]);
    expect(server.writes).toEqual(["4.6M"]);
    expect(server.store.revision).toBe(6);
    expect((ra as OkResult<{ rev: number }>).output.rev).toBe(6);
    expect((rb as ErrorResult).error.details).toMatchObject({ expectedRev: 5, currentRev: 6 });
    // The losing tab adopted nothing from the refusal: its revision arrives on its next refresh.
    expect(b.currentRev()).toBe(5);
    expect(b.ledger()).toMatchObject([
      { status: "conflict", revBefore: 5, revAfter: 5, changed: [], text: "5.1M" },
    ]);
    expect(a.ledger()).toMatchObject([
      { status: "ok", revBefore: 5, revAfter: 6, changed: ["cell:demand:2026-03"] },
    ]);
  });
});

describe("through AXE: the server's check is the first gate, the surface's queue the second [S-AXE-4]", () => {
  it("two concurrent invocations with the same envelope expectedRev: one commits, one is conflict, the handler runs once and sees the envelope's expectedRev", async () => {
    const s = createSurface();
    const seen: ActContext[] = [];
    const started = barrier();
    const gate = barrier();
    s.register({
      id: "save",
      kind: "action",
      role: "button",
      name: "Save record",
      effect: { mutates: "record" },
      handler: async (_actor, _text, context) => {
        seen.push(context);
        started.resolve();
        await gate.promise;
        s.bump();
      },
    });
    const axe = createAXE({
      name: "Review",
      description: "A record editor served through a surface, for checking write ordering.",
      baseUrl: "https://review.example",
      secret: "0123456789abcdef0123456789abcdef",
      revision: s.currentRev,
    });
    axe.addProvider(surfaceActions(s));
    // Know, without sleeping, that the second request has reached the surface and claimed.
    const secondClaimed = barrier();
    const act = s.act.bind(s);
    let claims = 0;
    s.act = (request, options) => {
      const out = act(request, options);
      if (++claims === 2) secondClaimed.resolve();
      return out;
    };
    const post = async () =>
      (await (
        await axe.handle(
          new Request("https://review.example/axe/actions/surface.save", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              input: {},
              idempotencyKey: crypto.randomUUID(),
              expectedRev: 0,
            }),
          }),
        )
      ).json()) as { status: string; rev?: number; error?: { code: string; details?: unknown } };
    const first = post();
    const second = post();
    await started.promise;
    await secondClaimed.promise;
    gate.resolve();
    const results = await Promise.all([first, second]);
    expect(results.map((r) => r.error?.code ?? r.status).sort()).toEqual(["conflict", "ok"]);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ id: "save", expectedRev: 0 });
    const refused = results.find((r) => r.status === "error")!;
    expect(refused.error!.details).toMatchObject({ expectedRev: 0, currentRev: 1 });
    expect(refused.rev).toBe(1);
    expect(s.ledger().map((e) => e.status)).toEqual(["ok", "conflict"]);
  });
});
