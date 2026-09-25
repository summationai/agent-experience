/**
 * The operation lifecycle (spec §12.2, [P-OP-1] to [P-OP-4]): every idempotency key, continuation,
 * resume, and poll is claimed atomically before it runs. Concurrency is driven by barriers the
 * test resolves, never by timers.
 */
import { describe, expect, it } from "vitest";
import { createAXE, action, z, MemoryIdempotencyStore, MemoryTokenStore } from "../src/index";
import type { AXEConfig, IdempotencyRecord, IdempotencyStore, ClaimRequest } from "../src/index";
import type { ErrorResult, NeedsInputResult, OkResult, PendingResult, Result } from "../src/types";
import { WIRE } from "../src/vocabulary";

const SECRET = "0123456789abcdef0123456789abcdef";
const BASE = "https://review.example";

function gate() {
  let open!: () => void;
  const opened = new Promise<void>((r) => (open = r));
  return { opened, open };
}

async function post(axe: ReturnType<typeof createAXE>, path: string, body: unknown) {
  const res = await axe.handle(
    new Request(BASE + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  return { res, body: (await res.json()) as Result };
}

const requirement = {
  reason: "more_info",
  message: "Provide a test value.",
  accepts: [
    { kind: "x-review.value", description: "Test value", schema: z.string(), sensitive: false },
  ],
};

/** A server whose handlers wait on barriers the test opens. */
function server(overrides: Partial<AXEConfig> = {}) {
  const runs = { write: 0, cont: 0, poll: 0 };
  const barriers = { entered: gate(), release: gate() };
  let failNext = false;
  const axe = createAXE({
    name: "Review",
    description: "Review test application for checking action execution and authentication.",
    baseUrl: BASE,
    secret: SECRET,
    ...overrides,
  });
  axe.register(
    action("test.write", {
      title: "Write",
      description: "Performs a test write and returns which attempt produced the observed result.",
      risk: "low",
      input: z.object({ n: z.number() }),
      output: z.object({ attempt: z.number() }),
      handler: async () => {
        const attempt = ++runs.write;
        barriers.entered.open();
        await barriers.release.opened;
        if (failNext) {
          failNext = false;
          throw new Error("downstream failed");
        }
        return { attempt };
      },
    }),
  );
  axe.register(
    action("test.ask", {
      title: "Ask",
      description: "Asks for a test value, then records it and returns which attempt recorded it.",
      risk: "low",
      input: z.object({}),
      output: z.object({ attempt: z.number(), value: z.string() }),
      handler: async ({ needsInput }) => needsInput(requirement),
      onContinue: async ({ payload }) => {
        const attempt = ++runs.cont;
        barriers.entered.open();
        await barriers.release.opened;
        return { attempt, value: String(payload) };
      },
    }),
  );
  axe.register(
    action("test.wait", {
      title: "Wait",
      description:
        "Starts slow test work; polling completes it once, with an effect, and returns it.",
      risk: "low",
      input: z.object({}),
      output: z.object({ attempt: z.number() }),
      handler: async ({ pending }) => pending({ retryAfter: 1 }),
      onPoll: async () => {
        const attempt = ++runs.poll;
        barriers.entered.open();
        await barriers.release.opened;
        return { attempt };
      },
    }),
  );
  return {
    axe,
    runs,
    barriers,
    reset() {
      barriers.entered = gate();
      barriers.release = gate();
    },
    failOnce() {
      failNext = true;
    },
  };
}

describe("concurrent calls with one idempotency key [P-OP-1] [P-OP-2]", () => {
  it("run once; the concurrent caller gets a retryable conflict with Retry-After, then the stored envelope", async () => {
    const s = server();
    const first = post(s.axe, "/axe/actions/test.write", { input: { n: 1 }, idempotencyKey: "k" });
    await s.barriers.entered.opened;
    const second = await post(s.axe, "/axe/actions/test.write", {
      input: { n: 1 },
      idempotencyKey: "k",
    });
    const busy = second.body as ErrorResult;
    expect(busy.error.code).toBe(WIRE.error.conflict);
    expect(busy.error.retryable).toBe(true);
    expect(busy.error.details?.["operationStatus"]).toBe("in_progress");
    expect(second.res.headers.get(WIRE.header.retryAfter)).toMatch(/^[1-5]$/);
    // A different input while the first runs is the non-retryable conflict of [P-IDEM-3].
    const altered = (
      await post(s.axe, "/axe/actions/test.write", { input: { n: 2 }, idempotencyKey: "k" })
    ).body as ErrorResult;
    expect(altered.error.code).toBe(WIRE.error.conflict);
    expect(altered.error.retryable).toBe(false);
    s.barriers.release.open();
    const done = (await first).body as OkResult<{ attempt: number }>;
    expect(done).toEqual({ status: "ok", output: { attempt: 1 } });
    // The lost-response retry: same envelope, handler not run again.
    expect(
      (await post(s.axe, "/axe/actions/test.write", { input: { n: 1 }, idempotencyKey: "k" })).body,
    ).toEqual(done);
    expect(
      (
        (await post(s.axe, "/axe/actions/test.write", { input: { n: 2 }, idempotencyKey: "k" }))
          .body as ErrorResult
      ).error.code,
    ).toBe(WIRE.error.conflict);
    expect(s.runs.write).toBe(1);
  });

  it("two runtime instances sharing the stores run the operation once", async () => {
    const tokenStore = new MemoryTokenStore();
    const idempotencyStore = new MemoryIdempotencyStore();
    const a = server({ tokenStore, idempotencyStore });
    const b = server({ tokenStore, idempotencyStore });
    const first = post(a.axe, "/axe/actions/test.write", { input: { n: 1 }, idempotencyKey: "k" });
    await a.barriers.entered.opened;
    const onB = (
      await post(b.axe, "/axe/actions/test.write", { input: { n: 1 }, idempotencyKey: "k" })
    ).body as ErrorResult;
    expect(onB.error.details?.["operationStatus"]).toBe("in_progress");
    a.barriers.release.open();
    b.barriers.release.open();
    const done = (await first).body;
    expect(
      (await post(b.axe, "/axe/actions/test.write", { input: { n: 1 }, idempotencyKey: "k" })).body,
    ).toEqual(done);
    expect(a.runs.write + b.runs.write).toBe(1);

    // A continuation minted on one instance and presented to both at once runs once.
    const ni = (await post(a.axe, "/axe/actions/test.ask", { input: {}, idempotencyKey: "c" }))
      .body as NeedsInputResult;
    const body = {
      continuationToken: ni.continuationToken,
      kind: "x-review.value",
      payload: "yes",
    };
    a.reset();
    b.reset();
    const c1 = post(a.axe, "/axe/continue", body);
    await a.barriers.entered.opened;
    const c2 = (await post(b.axe, "/axe/continue", body)).body as ErrorResult;
    expect(c2.error.details?.["operationStatus"]).toBe("in_progress");
    a.barriers.release.open();
    const ok = (await c1).body;
    expect(ok).toEqual({ status: "ok", output: { attempt: 1, value: "yes" } });
    expect((await post(b.axe, "/axe/continue", body)).body).toEqual(ok);
    expect(a.runs.cont + b.runs.cont).toBe(1);
  });
});

describe("token uses [P-OP-1] [P-REQ-9]", () => {
  it("concurrent uses of one continuation token run onContinue once; a lost response is recovered; an altered payload conflicts", async () => {
    const s = server();
    const ni = (await post(s.axe, "/axe/actions/test.ask", { input: {}, idempotencyKey: "k" }))
      .body as NeedsInputResult;
    const body = {
      continuationToken: ni.continuationToken,
      kind: "x-review.value",
      payload: "yes",
    };
    const first = post(s.axe, "/axe/continue", body);
    await s.barriers.entered.opened;
    const second = (await post(s.axe, "/axe/continue", body)).body as ErrorResult;
    expect(second.error.code).toBe(WIRE.error.conflict);
    expect(second.error.retryable).toBe(true);
    const alteredWhileBusy = (await post(s.axe, "/axe/continue", { ...body, payload: "no" }))
      .body as ErrorResult;
    expect(alteredWhileBusy.error.retryable).toBe(false);
    s.barriers.release.open();
    const done = (await first).body;
    expect((await post(s.axe, "/axe/continue", body)).body).toEqual(done);
    const altered = (await post(s.axe, "/axe/continue", { ...body, payload: "no" }))
      .body as ErrorResult;
    expect(altered.error.code).toBe(WIRE.error.conflict);
    expect(s.runs.cont).toBe(1);
  });
});

describe("failure paths [P-OP-3]", () => {
  it("a handler that throws releases the claim: the retry runs again and its success is stored", async () => {
    const s = server();
    s.barriers.release.open();
    s.failOnce();
    const failed = (
      await post(s.axe, "/axe/actions/test.write", { input: { n: 1 }, idempotencyKey: "k" })
    ).body as ErrorResult;
    expect(failed.error.code).toBe(WIRE.error.internal);
    const retried = (
      await post(s.axe, "/axe/actions/test.write", { input: { n: 1 }, idempotencyKey: "k" })
    ).body;
    expect(retried).toEqual({ status: "ok", output: { attempt: 2 } });
    expect(
      (await post(s.axe, "/axe/actions/test.write", { input: { n: 1 }, idempotencyKey: "k" })).body,
    ).toEqual(retried);
    expect(s.runs.write).toBe(2);
  });

  it("an error whose outcome is unknown is stored: a retry with the same key is answered with it and does not run", async () => {
    let runs = 0;
    const axe = createAXE({
      name: "Review",
      description: "Review test application for checking action execution and authentication.",
      baseUrl: BASE,
      secret: SECRET,
    });
    axe.register(
      action("test.send", {
        title: "Send",
        description: "Sends a test message whose delivery may not be confirmed before the reply.",
        risk: "low",
        input: z.object({ n: z.number() }),
        output: z.object({ attempt: z.number() }),
        handler: ({ fail }) => {
          runs += 1;
          return fail(WIRE.error.unavailable, "The page unloaded while acting.", {
            retryable: false,
            details: { reason: WIRE.reason.outcomeUnknown },
          });
        },
      }),
    );
    const body = { input: { n: 1 }, idempotencyKey: "unknown-1" };
    const first = (await post(axe, "/axe/actions/test.send", body)).body as ErrorResult;
    expect(first.error).toMatchObject({ code: "unavailable", retryable: false });
    const second = (await post(axe, "/axe/actions/test.send", body)).body;
    expect(second).toEqual(first);
    expect(runs).toBe(1);
  });

  it("an abandoned claim blocks retries until its lease passes, then the same operation takes it over", async () => {
    let now = 1_000_000;
    const idempotencyStore = new MemoryIdempotencyStore({ now: () => now });
    const s = server({ idempotencyStore, operationLeaseSeconds: 30 });
    s.barriers.release.open();
    // A process that claimed the key and died: its claim is in the shared store, nothing else.
    const { idempotencyStorageKey } = await import("../src/idempotency");
    const { hashJson } = await import("../src/tokens");
    const key = idempotencyStorageKey({
      tenant: null,
      action: "test.write",
      principal: null,
      key: "k",
    });
    const fingerprint = await hashJson({ n: 1 });
    expect(
      (
        await idempotencyStore.claim(key, {
          fingerprint,
          owner: "dead",
          leaseSeconds: 30,
          ttlSeconds: 86400,
        })
      ).outcome,
    ).toBe("acquired");
    const blocked = (
      await post(s.axe, "/axe/actions/test.write", { input: { n: 1 }, idempotencyKey: "k" })
    ).body as ErrorResult;
    expect(blocked.error.details?.["operationStatus"]).toBe("in_progress");
    now += 31_000;
    // Another operation under the same key never takes over an abandoned claim.
    const other = (
      await post(s.axe, "/axe/actions/test.write", { input: { n: 2 }, idempotencyKey: "k" })
    ).body as ErrorResult;
    expect(other.error.retryable).toBe(false);
    const taken = (
      await post(s.axe, "/axe/actions/test.write", { input: { n: 1 }, idempotencyKey: "k" })
    ).body;
    expect(taken).toEqual({ status: "ok", output: { attempt: 1 } });
    // The dead owner can no longer settle the claim it lost.
    expect(
      await idempotencyStore.complete(
        key,
        "dead",
        { fingerprint, result: taken, createdAt: now },
        60,
      ),
    ).toBe(false);
  });

  it("a crash after the business commit and before the result is stored: the retry re-runs, and operationId keeps the effect single", async () => {
    let now = 1_000_000;
    const inner = new MemoryIdempotencyStore({ now: () => now });
    let crash = true;
    const idempotencyStore: IdempotencyStore = {
      get: (k) => inner.get(k),
      claim: (k, r: ClaimRequest) => inner.claim(k, r),
      release: (k, o) => inner.release(k, o),
      complete: async (k, o, rec: IdempotencyRecord, ttl) => {
        if (crash) {
          crash = false;
          throw new Error("process died before the result was stored");
        }
        return inner.complete(k, o, rec, ttl);
      },
    };
    // The business table: one order per operation, written under a unique operationId.
    const orders = new Map<string, string>();
    let handlerRuns = 0;
    const axe = createAXE({
      name: "Review",
      description: "Review test application for checking action execution and authentication.",
      baseUrl: BASE,
      secret: SECRET,
      idempotencyStore,
      operationLeaseSeconds: 30,
    });
    axe.register(
      action("orders.place", {
        title: "Place order",
        description: "Places a test order and returns its number; the order is keyed by operation.",
        risk: "low",
        input: z.object({ sku: z.string() }),
        output: z.object({ orderNumber: z.string() }),
        handler: async ({ operationId }) => {
          handlerRuns++;
          // INSERT ... ON CONFLICT (operation_id) DO NOTHING, then read back.
          if (!orders.has(operationId!)) orders.set(operationId!, `PO-${orders.size + 1}`);
          return { orderNumber: orders.get(operationId!)! };
        },
      }),
    );
    const call = () =>
      axe.handle(
        new Request(`${BASE}/axe/actions/orders.place`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ input: { sku: "A" }, idempotencyKey: "k" }),
        }),
      );
    await expect(call()).rejects.toThrow("process died");
    const early = (await (await call()).json()) as ErrorResult;
    expect(early.error.details?.["operationStatus"]).toBe("in_progress");
    now += 31_000;
    const retried = (await (await call()).json()) as OkResult<{ orderNumber: string }>;
    expect(retried.output.orderNumber).toBe("PO-1");
    expect(handlerRuns).toBe(2);
    expect(orders.size).toBe(1);
    expect(await (await call()).json()).toEqual(retried);
    expect(handlerRuns).toBe(2);
  });

  it("a get/set store is refused at startup", () => {
    const legacy = {
      get: async () => undefined,
      set: async () => {},
    } as unknown as IdempotencyStore;
    expect(() => server({ idempotencyStore: legacy })).toThrow(/claim/);
  });
});

describe("poll terminalization [P-POLL-2]", () => {
  it("concurrent polls run onPoll once; the other poll is pending; both then see one terminal result", async () => {
    const s = server();
    const p = (await post(s.axe, "/axe/actions/test.wait", { input: {}, idempotencyKey: "k" }))
      .body as PendingResult;
    const first = s.axe.handle(new Request(p.pollUrl));
    await s.barriers.entered.opened;
    const second = await s.axe.handle(new Request(p.pollUrl));
    expect(second.headers.get(WIRE.header.retryAfter)).toMatch(/^\d+$/);
    expect(((await second.json()) as PendingResult).status).toBe("pending");
    s.barriers.release.open();
    const done = await (await first).json();
    expect(done).toEqual({ status: "ok", output: { attempt: 1 } });
    expect(await (await s.axe.handle(new Request(p.pollUrl))).json()).toEqual(done);
    expect(s.runs.poll).toBe(1);
  });
});

describe("MemoryIdempotencyStore", () => {
  it("claims atomically, fences settlement by owner, and takes over only the same fingerprint after the lease", async () => {
    let now = 0;
    const store = new MemoryIdempotencyStore({ now: () => now });
    const req = (owner: string, fingerprint = "f"): ClaimRequest => ({
      fingerprint,
      owner,
      leaseSeconds: 10,
      ttlSeconds: 100,
    });
    const outcomes = await Promise.all([store.claim("k", req("a")), store.claim("k", req("b"))]);
    expect(outcomes.map((o) => o.outcome).sort()).toEqual(["acquired", "in_progress"]);
    const result: Result = { status: "ok", output: {} };
    expect(await store.complete("k", "b", { fingerprint: "f", result, createdAt: 0 }, 100)).toBe(
      false,
    );
    now = 11_000;
    expect((await store.claim("k", req("c", "other"))).outcome).toBe("in_progress");
    expect((await store.claim("k", req("c"))).outcome).toBe("acquired");
    expect(await store.complete("k", "a", { fingerprint: "f", result, createdAt: now }, 100)).toBe(
      false,
    );
    expect(await store.complete("k", "c", { fingerprint: "f", result, createdAt: now }, 100)).toBe(
      true,
    );
    expect(await store.get("k")).toEqual({ fingerprint: "f", result, createdAt: now });
    now += 101_000;
    expect(await store.get("k")).toBeUndefined();
    expect((await store.claim("k", req("d", "new"))).outcome).toBe("acquired");
    await store.release("k", "d");
    expect(store.size).toBe(0);
  });
});
