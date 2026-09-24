/**
 * `SqliteIdempotencyStore` over `node:sqlite` (Node 22.5 or newer, without a flag from 22.13).
 * On Node 20, and on a Node 22 that needs `--experimental-sqlite`, the import fails and the suite
 * is skipped with a message; nothing else in `@axe/core` depends on it.
 */
import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAXE, action, z, MemoryTokenStore } from "../src/index";
import { SqliteIdempotencyStore } from "../src/node";
import type { SqliteDatabaseLike } from "../src/node";
import type { ErrorResult, OkResult } from "../src/types";

type SqliteModule = { DatabaseSync: new (path: string) => SqliteDatabaseLike & { close(): void } };
let sqlite: SqliteModule | undefined;
try {
  sqlite = (await import("node:sqlite" as string)) as SqliteModule;
} catch {
  console.warn(
    `[axe] node:sqlite is not available on Node ${process.versions.node}; skipping the SqliteIdempotencyStore suite.`,
  );
}

const SECRET = "0123456789abcdef0123456789abcdef";
const BASE = "https://review.example";

describe.skipIf(!sqlite)("SqliteIdempotencyStore (node:sqlite)", () => {
  async function tempDb() {
    const dir = await mkdtemp(join(tmpdir(), "axe-sqlite-"));
    const path = join(dir, "axe.db");
    const open = () => {
      const db = new sqlite!.DatabaseSync(path);
      db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
      return db;
    };
    return { dir, open };
  }

  it("claims atomically across two connections to one file, and takes over only the same fingerprint", async () => {
    const { dir, open } = await tempDb();
    let now = 1_000;
    const a = new SqliteIdempotencyStore(open(), { now: () => now });
    const b = new SqliteIdempotencyStore(open(), { now: () => now });
    const req = (owner: string, fingerprint = "f") => ({
      fingerprint,
      owner,
      leaseSeconds: 10,
      ttlSeconds: 100,
    });
    const both = await Promise.all([a.claim("k", req("a")), b.claim("k", req("b"))]);
    expect(both.map((o) => o.outcome).sort()).toEqual(["acquired", "in_progress"]);
    const result = { status: "ok" as const, output: { n: 1 } };
    expect(await b.complete("k", "b", { fingerprint: "f", result, createdAt: now }, 100)).toBe(
      false,
    );
    now += 11_000;
    expect((await b.claim("k", req("b", "other"))).outcome).toBe("in_progress");
    expect((await b.claim("k", req("b"))).outcome).toBe("acquired");
    expect(await a.complete("k", "a", { fingerprint: "f", result, createdAt: now }, 100)).toBe(
      false,
    );
    expect(await b.complete("k", "b", { fingerprint: "f", result, createdAt: now }, 100)).toBe(
      true,
    );
    expect(await a.claim("k", req("z"))).toEqual({
      outcome: "completed",
      record: { fingerprint: "f", result, createdAt: now },
    });
    await a.release("k", "z");
    expect(await a.get("k")).toEqual({ fingerprint: "f", result, createdAt: now });
    now += 101_000;
    expect(await a.get("k")).toBeUndefined();
    expect(a.prune()).toBe(1);
    await rm(dir, { recursive: true, force: true });
  });

  it("two runtimes on one database run a call once, and a crash after the business commit is recovered by operationId", async () => {
    const { dir, open } = await tempDb();
    let now = 1_000_000;
    const setup = open();
    setup.exec(`CREATE TABLE orders (operation_id TEXT PRIMARY KEY, number TEXT NOT NULL)`);
    const tokenStore = new MemoryTokenStore();
    let crashAfterCommit = false;
    let handlerRuns = 0;
    const runtime = () => {
      const db = open();
      const store = new SqliteIdempotencyStore(db, { now: () => now });
      const idempotencyStore = {
        get: store.get.bind(store),
        claim: store.claim.bind(store),
        release: store.release.bind(store),
        complete: async (...args: Parameters<typeof store.complete>) => {
          if (crashAfterCommit) {
            crashAfterCommit = false;
            throw new Error("process died before the result was stored");
          }
          return store.complete(...args);
        },
      };
      const axe = createAXE({
        name: "Review",
        description: "Review test application for checking action execution and authentication.",
        baseUrl: BASE,
        secret: SECRET,
        tokenStore,
        idempotencyStore,
        operationLeaseSeconds: 30,
      });
      axe.register(
        action("orders.place", {
          title: "Place order",
          description: "Places a test order in the business table and returns its order number.",
          risk: "low",
          input: z.object({ sku: z.string() }),
          output: z.object({ orderNumber: z.string() }),
          handler: async ({ operationId }) => {
            handlerRuns++;
            // The business write and its operation id commit together; a second run of the same
            // operation finds the row instead of placing a second order.
            db.exec("BEGIN IMMEDIATE");
            db.prepare(
              `INSERT INTO orders (operation_id, number)
               VALUES (?, 'PO-' || (SELECT COUNT(*) + 1 FROM orders))
               ON CONFLICT (operation_id) DO NOTHING`,
            ).run(operationId!);
            const row = db
              .prepare(`SELECT number FROM orders WHERE operation_id = ?`)
              .get(operationId!) as { number: string };
            db.exec("COMMIT");
            return { orderNumber: row.number };
          },
        }),
      );
      return axe;
    };
    const one = runtime();
    const two = runtime();
    const call = (axe: ReturnType<typeof createAXE>, key: string) =>
      axe.handle(
        new Request(`${BASE}/axe/actions/orders.place`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ input: { sku: "A" }, idempotencyKey: key }),
        }),
      );

    const first = (await (await call(one, "k1")).json()) as OkResult<{ orderNumber: string }>;
    expect(await (await call(two, "k1")).json()).toEqual(first);
    expect(handlerRuns).toBe(1);

    crashAfterCommit = true;
    await expect(call(one, "k2")).rejects.toThrow("process died");
    const early = (await (await call(two, "k2")).json()) as ErrorResult;
    expect(early.error.details?.["operationStatus"]).toBe("in_progress");
    now += 31_000;
    const recovered = (await (await call(two, "k2")).json()) as OkResult<{ orderNumber: string }>;
    expect(recovered.output.orderNumber).toBe("PO-2");
    expect(handlerRuns).toBe(3);
    expect(setup.prepare(`SELECT COUNT(*) AS n FROM orders`).get()).toEqual({ n: 2 });
    await rm(dir, { recursive: true, force: true });
  });
});
