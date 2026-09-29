/**
 * Resource limits and retention (spec §6.5, [P-LIM-1] to [P-LIM-4]): request bodies are bounded
 * before they are buffered or parsed, deep nesting is refused instead of exhausting the stack, and
 * the default in-memory stores do not grow without bound. Clocks are injected; nothing sleeps.
 */
import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAXE, action, z, MemoryIdempotencyStore, MemoryTokenStore } from "../src/index";
import type { AXEConfig, TokenRecord } from "../src/index";
import { SqliteIdempotencyStore } from "../src/node";
import type { SqliteDatabaseLike } from "../src/node";
import type { ErrorResult, OkResult, Result } from "../src/types";
import { WIRE } from "../src/vocabulary";

const SECRET = "0123456789abcdef0123456789abcdef";
const BASE = "https://limits.example";

function server(overrides: Partial<AXEConfig> = {}) {
  const runs = { echo: 0 };
  const axe = createAXE({
    name: "Limits",
    description: "Review test application for checking request limits and store retention.",
    baseUrl: BASE,
    secret: SECRET,
    ...overrides,
  });
  axe.register(
    action("test.echo", {
      title: "Echo",
      description: "Accepts any value and returns true, so the review can check request limits.",
      risk: "low",
      input: z.object({ v: z.unknown() }),
      output: z.object({ ok: z.boolean() }),
      handler: async () => {
        runs.echo++;
        return { ok: true };
      },
    }),
  );
  return { axe, runs };
}

async function post(
  axe: ReturnType<typeof createAXE>,
  path: string,
  body: BodyInit,
  headers: Record<string, string> = {},
) {
  const res = await axe.handle(
    new Request(BASE + path, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body,
      ...(body instanceof ReadableStream ? { duplex: "half" } : {}),
    } as RequestInit),
  );
  return { res, body: (await res.json()) as Result };
}

/** A body stream that serves `total` bytes in `chunk`-byte pieces and counts what was pulled. */
function countingStream(prefix: string, total: number, chunk = 64 * 1024) {
  const enc = new TextEncoder();
  const stats = { pulled: 0, cancelled: false };
  let sentPrefix = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (!sentPrefix) {
        sentPrefix = true;
        const p = enc.encode(prefix);
        stats.pulled += p.byteLength;
        controller.enqueue(p);
        return;
      }
      if (stats.pulled >= total) {
        controller.close();
        return;
      }
      const n = Math.min(chunk, total - stats.pulled);
      stats.pulled += n;
      controller.enqueue(enc.encode("x".repeat(n)));
    },
    cancel() {
      stats.cancelled = true;
    },
  });
  return { stream, stats };
}

describe("request body limit [P-LIM-1]", () => {
  it("a Content-Length above maxBodyBytes is refused with 413 and payload_too_large before anything is read", async () => {
    const { axe, runs } = server({ maxBodyBytes: 1024 });
    const { stream, stats } = countingStream('{"input":{"v":"', 10 * 1024 * 1024);
    const { res, body } = await post(axe, "/axe/actions/test.echo", stream, {
      "content-length": String(10 * 1024 * 1024),
    });
    expect(res.status).toBe(413);
    const err = (body as ErrorResult).error;
    expect(err.code).toBe(WIRE.error.invalidInput);
    expect(err.retryable).toBe(false);
    expect(err.details).toMatchObject({
      reason: WIRE.reason.payloadTooLarge,
      maxBodyBytes: 1024,
    });
    expect(runs.echo).toBe(0);
    // At most what the stream had queued before the check; never the declared 10 MiB.
    expect(stats.pulled).toBeLessThan(256 * 1024);
  });

  it("a body without Content-Length is read only up to the limit, then the stream is cancelled", async () => {
    const { axe, runs } = server({ maxBodyBytes: 100 * 1024 });
    const { stream, stats } = countingStream('{"input":{"v":"', 50 * 1024 * 1024, 16 * 1024);
    const { res, body } = await post(axe, "/axe/actions/test.echo", stream);
    expect(res.status).toBe(413);
    expect((body as ErrorResult).error.details?.["reason"]).toBe(WIRE.reason.payloadTooLarge);
    expect(runs.echo).toBe(0);
    expect(stats.cancelled).toBe(true);
    expect(stats.pulled).toBeLessThan(200 * 1024);
  });

  it("the default limit is 1 MiB: 2 MiB is refused, a body under the limit runs", async () => {
    const { axe, runs } = server();
    expect(axe.maxBodyBytes).toBe(1024 * 1024);
    const big = await post(
      axe,
      "/axe/actions/test.echo",
      JSON.stringify({ input: { v: "x".repeat(2 * 1024 * 1024) }, idempotencyKey: "a" }),
    );
    expect(big.res.status).toBe(413);
    const small = await post(
      axe,
      "/axe/actions/test.echo",
      JSON.stringify({ input: { v: "x".repeat(1000) }, idempotencyKey: "b" }),
    );
    expect(small.res.status).toBe(200);
    expect((small.body as OkResult).output).toEqual({ ok: true });
    expect(runs.echo).toBe(1);
  });

  it("continue and resume bodies are bounded too, and an unknown action does not hide the refusal", async () => {
    const { axe } = server({ maxBodyBytes: 512 });
    const pad = "x".repeat(2048);
    for (const path of ["/axe/continue", "/axe/resume", "/axe/actions/nope.gone"]) {
      const { res, body } = await post(axe, path, JSON.stringify({ pad }));
      expect(res.status, path).toBe(413);
      expect((body as ErrorResult).error.details?.["reason"], path).toBe(
        WIRE.reason.payloadTooLarge,
      );
    }
  });

  it("createAXE refuses a maxBodyBytes that is not a positive integer", () => {
    for (const bad of [0, -1, 1.5, Number.NaN]) {
      expect(() => server({ maxBodyBytes: bad }), String(bad)).toThrow(/maxBodyBytes/);
    }
  });
});

describe("request nesting limit [P-LIM-2]", () => {
  it("a deeply nested body is invalid_input, not a crash", async () => {
    const { axe, runs } = server();
    const n = 100_000;
    const deep = `{"input":{"v":${"[".repeat(n)}${"]".repeat(n)}},"idempotencyKey":"d"}`;
    const { res, body } = await post(axe, "/axe/actions/test.echo", deep);
    expect(res.status).toBe(400);
    expect((body as ErrorResult).error.code).toBe(WIRE.error.invalidInput);
    expect((body as ErrorResult).error.details?.issues?.[0]?.message).toContain("64");
    expect(runs.echo).toBe(0);
  });

  it("nesting at the limit is accepted", async () => {
    const { axe, runs } = server();
    // body (1) > input (2) > v (3) ... 64 levels in all.
    const n = 62;
    const ok = `{"input":{"v":${"[".repeat(n)}${"]".repeat(n)}},"idempotencyKey":"e"}`;
    const { res } = await post(axe, "/axe/actions/test.echo", ok);
    expect(res.status).toBe(200);
    expect(runs.echo).toBe(1);
  });
});

const tokenRecord = (id: string): TokenRecord => ({
  id,
  type: "continuation",
  action: "test.echo",
  inputHash: "h",
  principal: null,
  tenant: null,
  expiresAt: 0,
  state: undefined,
});

describe("retention of the in-memory stores [P-LIM-4]", () => {
  it("MemoryTokenStore sweeps expired records on a later write, whether or not they are read again", async () => {
    let now = 0;
    const store = new MemoryTokenStore({ now: () => now, sweepIntervalMs: 60_000 });
    for (let i = 0; i < 500; i++) await store.set(`t${i}`, tokenRecord(`t${i}`), 60);
    expect(store.size).toBe(500);
    now = 61_000;
    await store.set("fresh", tokenRecord("fresh"), 60);
    expect(store.size).toBe(1);
    expect(await store.get("fresh")).toBeDefined();
    expect(await store.get("t0")).toBeUndefined();
  });

  it("MemoryTokenStore evicts the oldest record at maxEntries", async () => {
    const store = new MemoryTokenStore({ now: () => 0, maxEntries: 3 });
    for (const id of ["a", "b", "c", "d"]) await store.set(id, tokenRecord(id), 60);
    expect(store.size).toBe(3);
    expect(await store.get("a")).toBeUndefined();
    expect(await store.get("d")).toBeDefined();
  });

  it("MemoryIdempotencyStore sweeps abandoned unique keys, and evicts completed entries before a running claim", async () => {
    let now = 0;
    const store = new MemoryIdempotencyStore({ now: () => now, sweepIntervalMs: 1000 });
    const claim = (key: string, lease = 1, ttl = 1) =>
      store.claim(key, { fingerprint: "f", owner: key, leaseSeconds: lease, ttlSeconds: ttl });
    for (let i = 0; i < 1000; i++) await claim(`k${i}`);
    expect(store.size).toBe(1000);
    now = 5000;
    await claim("fresh");
    expect(store.size).toBe(1);

    const small = new MemoryIdempotencyStore({ now: () => now, maxEntries: 2 });
    const smallClaim = (key: string) =>
      small.claim(key, { fingerprint: "f", owner: key, leaseSeconds: 60, ttlSeconds: 3600 });
    await smallClaim("running");
    await smallClaim("done");
    await small.complete(
      "done",
      "done",
      { fingerprint: "f", result: { status: "ok", output: {} }, createdAt: now },
      3600,
    );
    // Full: the completed entry goes, the running claim stays.
    expect((await smallClaim("next")).outcome).toBe("acquired");
    expect(await small.get("done")).toBeUndefined();
    expect((await smallClaim("running")).outcome).toBe("in_progress");
    // Only running claims left: a new claim is refused rather than dropping one of them.
    await expect(smallClaim("another")).rejects.toThrow(/none may be evicted/);
    // Once a lease passes, that claim may be evicted.
    now += 61_000;
    expect((await smallClaim("another")).outcome).toBe("acquired");
  });

  it("sweep() and close(): close drops every entry and later use fails", async () => {
    let now = 0;
    const tokens = new MemoryTokenStore({ now: () => now });
    const ops = new MemoryIdempotencyStore({ now: () => now });
    await tokens.set("a", tokenRecord("a"), 1);
    await ops.claim("a", { fingerprint: "f", owner: "o", leaseSeconds: 1, ttlSeconds: 1 });
    now = 2000;
    expect(tokens.sweep()).toBe(1);
    expect(ops.sweep()).toBe(1);
    await tokens.set("b", tokenRecord("b"), 60);
    tokens.close();
    ops.close();
    expect(tokens.size).toBe(0);
    await expect(tokens.get("b")).rejects.toThrow(/closed/);
    await expect(ops.get("a")).rejects.toThrow(/closed/);
  });

  it("the stores refuse a maxEntries that is not a positive integer", () => {
    expect(() => new MemoryTokenStore({ maxEntries: 0 })).toThrow(/maxEntries/);
    expect(() => new MemoryIdempotencyStore({ maxEntries: 2.5 })).toThrow(/maxEntries/);
  });

  it("a server on the default stores keeps a bounded number of tokens for abandoned continuations", async () => {
    let now = Date.now();
    const tokenStore = new MemoryTokenStore({ now: () => now, maxEntries: 50 });
    const axe = createAXE({
      name: "Limits",
      description: "Review test application for checking request limits and store retention.",
      baseUrl: BASE,
      secret: SECRET,
      tokenStore,
    });
    axe.register(
      action("test.ask", {
        title: "Ask",
        description: "Asks for a value that the review never supplies, to leave a token behind.",
        readOnly: true,
        risk: "none",
        input: z.object({ n: z.number() }),
        output: z.object({ ok: z.boolean() }),
        handler: async ({ needsInput }) =>
          needsInput({
            reason: "more_info",
            message: "Provide a test value.",
            accepts: [
              {
                kind: "x-review.value",
                description: "Test value",
                schema: z.string(),
                sensitive: false,
              },
            ],
          }),
      }),
    );
    for (let i = 0; i < 200; i++) {
      now += 10;
      await post(axe, "/axe/actions/test.ask", JSON.stringify({ input: { n: i } }));
    }
    expect(tokenStore.size).toBe(50);
  });
});

type SqliteModule = { DatabaseSync: new (path: string) => SqliteDatabaseLike & { close(): void } };
let sqlite: SqliteModule | undefined;
try {
  sqlite = (await import("node:sqlite" as string)) as SqliteModule;
} catch {
  // Skipped below with a message in the suite title.
}

describe.skipIf(!sqlite)(
  "SqliteIdempotencyStore.prune [P-LIM-4] (needs node:sqlite; skipped where absent)",
  () => {
    it("deletes rows that expired before the given time and keeps live ones; a future time is refused", async () => {
      const dir = await mkdtemp(join(tmpdir(), "axe-prune-"));
      const db = new sqlite!.DatabaseSync(join(dir, "axe.db"));
      try {
        let now = 1_000_000;
        const store = new SqliteIdempotencyStore(db, { now: () => now });
        const claim = (key: string, ttl: number) =>
          store.claim(key, { fingerprint: "f", owner: key, leaseSeconds: ttl, ttlSeconds: ttl });
        await claim("short", 1);
        await claim("long", 3600);
        now += 10_000;
        expect(store.prune(now - 5_000)).toBe(1);
        expect(store.prune()).toBe(0);
        expect((await claim("long", 3600)).outcome).toBe("in_progress");
        expect(() => store.prune(now + 1)).toThrow(/no later than now/);
      } finally {
        db.close();
        await rm(dir, { recursive: true, force: true });
      }
    });
  },
);
