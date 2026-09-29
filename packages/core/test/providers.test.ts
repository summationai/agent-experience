import { describe, expect, it, vi } from "vitest";
import { action, createAXE, z } from "../src/index";
import type { ActionProvider, RegisteredAction } from "../src/index";
import type { ErrorResult, LiveState, OkResult } from "../src/types";
import { ManifestSchema } from "../src/schemas";

const BASE = "http://localhost:3000";

function site(revision?: () => number) {
  return createAXE({
    name: "Grid",
    description: "A planning grid whose cells register and unregister as the page changes.",
    baseUrl: BASE,
    auth: { modes: ["none"] },
    secret: "0123456789abcdef0123456789abcdef",
    ...(revision ? { revision } : {}),
  });
}

function cell(name: string, title: string, available = true): RegisteredAction {
  return action(name, {
    title,
    description: `Approves the ${title} cell of the plan and returns the cell it approved.`,
    risk: "low",
    idempotent: true,
    reversible: true,
    input: z.object({}).strict(),
    output: z.object({ cell: z.string() }),
    availability: () =>
      available ? { available: true } : { available: false, reason: "the month is locked" },
    handler: async () => ({ cell: name }),
  }) as unknown as RegisteredAction;
}

/** A provider over a mutable list, with the O(1) lookup and change notification a real registry has. */
function registry(initial: RegisteredAction[]) {
  const map = new Map(initial.map((a) => [a.name, a]));
  const listeners = new Set<() => void>();
  const provider: ActionProvider = {
    actions: () => [...map.values()],
    get: (name) => map.get(name),
    onChange: (fn) => {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
  };
  const set = (a: RegisteredAction) => {
    map.set(a.name, a);
    for (const fn of listeners) fn();
  };
  const remove = (name: string) => {
    map.delete(name);
    for (const fn of listeners) fn();
  };
  return { provider, set, remove };
}

const call = async (axe: ReturnType<typeof site>, path: string, body?: unknown) => {
  const res = await axe.handle(
    new Request(`${BASE}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
  return { res, json: (await res.json()) as unknown };
};

describe("action providers: a dynamic set of actions", () => {
  it("provided actions appear after registered ones in the manifest, /axe/state, and GET /axe/actions/{name}, and can be invoked", async () => {
    const axe = site(() => 7);
    axe.register(cell("grid.refresh", "Refresh"));
    const { provider, set, remove } = registry([cell("grid.cell-2026-03", "March")]);
    axe.addProvider(provider);
    const manifest = await axe.describeLive();
    expect(ManifestSchema.safeParse(manifest).success).toBe(true);
    expect(manifest.actions.map((a) => a.name)).toEqual(["grid.refresh", "grid.cell-2026-03"]);
    expect(manifest.actions[1]!.availability).toEqual({ available: true });
    const state = (await call(axe, "/axe/state")).json as LiveState;
    expect(state).toEqual({
      rev: 7,
      actions: { "grid.refresh": { available: true }, "grid.cell-2026-03": { available: true } },
    });
    const def = await call(axe, "/axe/actions/grid.cell-2026-03");
    expect((def.json as { name: string }).name).toBe("grid.cell-2026-03");
    const ok = (
      await call(axe, "/axe/actions/grid.cell-2026-03", { input: {}, idempotencyKey: "k1" })
    ).json as OkResult<{ cell: string }>;
    expect(ok.status).toBe("ok");
    expect(ok.output.cell).toBe("grid.cell-2026-03");
    // The set follows the provider: on the next request the manifest and the state reflect it.
    set(cell("grid.cell-2026-04", "April", false));
    remove("grid.cell-2026-03");
    expect(axe.describe().actions.map((a) => a.name)).toEqual([
      "grid.refresh",
      "grid.cell-2026-04",
    ]);
    const after = (await call(axe, "/axe/state")).json as LiveState;
    expect(after.actions["grid.cell-2026-04"]).toEqual({
      available: false,
      reason: "the month is locked",
    });
    expect(after.actions["grid.cell-2026-03"]).toBeUndefined();
    const gone = (
      await call(axe, "/axe/actions/grid.cell-2026-03", { input: {}, idempotencyKey: "k2" })
    ).json as ErrorResult;
    expect(gone.error.code).toBe("not_found");
    expect((await call(axe, "/axe/actions/grid.cell-2026-03")).res.status).toBe(404);
  });

  it("a retried idempotencyKey is answered from the store even after the action left the set [P-IDEM-2]", async () => {
    const axe = site();
    const { provider, remove } = registry([cell("grid.cell-2026-03", "March")]);
    axe.addProvider(provider);
    const body = { input: {}, idempotencyKey: "k1" };
    const first = (await call(axe, "/axe/actions/grid.cell-2026-03", body)).json;
    remove("grid.cell-2026-03");
    const replay = (await call(axe, "/axe/actions/grid.cell-2026-03", body)).json;
    expect(replay).toEqual(first);
    // A new attempt (a new key, or different input) is not found.
    const fresh = (
      await call(axe, "/axe/actions/grid.cell-2026-03", { input: {}, idempotencyKey: "k2" })
    ).json as ErrorResult;
    expect(fresh.error.code).toBe("not_found");
    const other = (
      await call(axe, "/axe/actions/grid.cell-2026-03", { input: { x: 1 }, idempotencyKey: "k1" })
    ).json as ErrorResult;
    expect(other.error.code).toBe("not_found");
  });

  it("looks provided actions up through get() without enumerating them", async () => {
    const axe = site();
    const { provider } = registry(
      Array.from({ length: 50 }, (_, i) => cell(`grid.c-${i}`, `Cell ${i}`)),
    );
    const actions = vi.spyOn(provider, "actions");
    axe.addProvider(provider);
    const ok = (await call(axe, "/axe/actions/grid.c-17", { input: {}, idempotencyKey: "k" }))
      .json as OkResult<{ cell: string }>;
    expect(ok.output.cell).toBe("grid.c-17");
    expect(actions).not.toHaveBeenCalled();
    expect(axe.getAction("grid.c-3")?.name).toBe("grid.c-3");
    expect(actions).not.toHaveBeenCalled();
    // A provider without get() is scanned instead.
    const bare = site();
    bare.addProvider({ actions: () => [cell("grid.only", "Only")] });
    expect(bare.getAction("grid.only")?.name).toBe("grid.only");
    expect(bare.getAction("grid.missing")).toBeUndefined();
  });

  it("keeps the server's invariants: unique names across register() and providers, auth modes within manifest modes", () => {
    const axe = site();
    axe.register(cell("grid.refresh", "Refresh"));
    const { provider, set } = registry([cell("grid.refresh", "Refresh again")]);
    axe.addProvider(provider);
    expect(() => axe.describe()).toThrow(/grid\.refresh.*unique/);
    set(cell("grid.ok", "Ok"));
    expect(() => axe.register(cell("grid.ok", "Ok twice"))).toThrow(/already registered/);
    const needsUser = action("grid.sign", {
      title: "Sign",
      description:
        "Signs the plan on behalf of the signed-in planner and returns the signature id.",
      risk: "high",
      auth: "user",
      input: z.object({}),
      output: z.object({ id: z.string() }),
      handler: async () => ({ id: "s" }),
    }) as unknown as RegisteredAction;
    const other = site();
    other.addProvider({ actions: () => [needsUser] });
    expect(() => other.describe()).toThrow(/auth "user" is not in manifest auth.modes/);
    // Two providers offering the same object are one action, not a collision.
    const shared = cell("grid.shared", "Shared");
    const two = site();
    two.addProvider({ actions: () => [shared] });
    two.addProvider({ actions: () => [shared] });
    expect(two.describe().actions.map((a) => a.name)).toEqual(["grid.shared"]);
  });

  it("onActionsChanged fires on register, addProvider, and a provider's own change", () => {
    const axe = site();
    const changes = vi.fn();
    const off = axe.onActionsChanged(changes);
    axe.register(cell("grid.refresh", "Refresh"));
    expect(changes).toHaveBeenCalledTimes(1);
    const { provider, set } = registry([]);
    axe.addProvider(provider);
    expect(changes).toHaveBeenCalledTimes(2);
    set(cell("grid.c", "C"));
    expect(changes).toHaveBeenCalledTimes(3);
    off();
    set(cell("grid.d", "D"));
    expect(changes).toHaveBeenCalledTimes(3);
  });

  it("a provider with availability hooks makes the site live even without a revision", async () => {
    const axe = site();
    expect(axe.hasLive()).toBe(false);
    axe.addProvider({ actions: () => [cell("grid.c", "C", false)] });
    expect(axe.hasLive()).toBe(true);
    expect(axe.describe().live?.url).toBe(`${BASE}/axe/state`);
    const state = (await call(axe, "/axe/state")).json as LiveState;
    expect(state.actions["grid.c"]).toEqual({ available: false, reason: "the month is locked" });
  });
});

describe("a provider's onResult [S-AXE-14]", () => {
  it("hears every result of its own actions with the call's input, expectedRev, and whether a handler produced it", async () => {
    let rev = 1;
    const axe = site(() => rev);
    axe.register(cell("grid.refresh", "Refresh"));
    const { provider } = registry([cell("grid.cell-2026-03", "March")]);
    const heard: {
      action: string;
      handled: boolean;
      input?: unknown;
      expectedRev?: unknown;
      status: string;
      code?: string;
      identity: unknown;
    }[] = [];
    provider.onResult = (ctx, result) => {
      heard.push({
        action: ctx.action,
        handled: ctx.handled,
        ...(ctx.input !== undefined ? { input: ctx.input } : {}),
        ...(ctx.expectedRev !== undefined ? { expectedRev: ctx.expectedRev } : {}),
        status: result.status,
        ...(result.status === "error" ? { code: result.error.code } : {}),
        identity: ctx.identity,
      });
    };
    axe.addProvider(provider);
    const envelope = (expectedRev: number, input: unknown = {}) => ({
      input,
      idempotencyKey: crypto.randomUUID(),
      expectedRev,
    });
    await call(axe, "/axe/actions/grid.cell-2026-03", envelope(1));
    rev = 2;
    const stale = (await call(axe, "/axe/actions/grid.cell-2026-03", envelope(1))).json;
    expect((stale as ErrorResult).error.code).toBe("conflict");
    await call(axe, "/axe/actions/grid.cell-2026-03", envelope(2, { extra: true }));
    // A registered action's results never reach a provider.
    await call(axe, "/axe/actions/grid.refresh", envelope(2));
    expect(heard).toEqual([
      {
        action: "grid.cell-2026-03",
        handled: true,
        input: {},
        expectedRev: 1,
        status: "ok",
        identity: null,
      },
      {
        action: "grid.cell-2026-03",
        handled: false,
        input: {},
        expectedRev: 1,
        status: "error",
        code: "conflict",
        identity: null,
      },
      {
        action: "grid.cell-2026-03",
        handled: false,
        input: { extra: true },
        expectedRev: 2,
        status: "error",
        code: "invalid_input",
        identity: null,
      },
    ]);
  });

  it("a provider hook that throws leaves the response unchanged", async () => {
    const axe = site();
    const { provider } = registry([cell("grid.cell-2026-03", "March")]);
    provider.onResult = () => {
      throw new Error("sink down");
    };
    axe.addProvider(provider);
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { json } = await call(axe, "/axe/actions/grid.cell-2026-03", {
      input: {},
      idempotencyKey: "k",
    });
    expect((json as OkResult<{ cell: string }>).output.cell).toBe("grid.cell-2026-03");
    expect(spy).toHaveBeenCalledWith("[axe] provider onResult hook failed", expect.any(Error));
    spy.mockRestore();
  });
});
