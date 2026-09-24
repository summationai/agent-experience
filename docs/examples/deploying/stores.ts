// #region all
import { action, createAXE, z } from "@axe/core";
import type {
  ClaimOutcome,
  IdempotencyRecord,
  IdempotencyStore,
  TokenRecord,
  TokenStore,
} from "@axe/core";
import { SqliteIdempotencyStore } from "@axe/core/node";
import type { SqliteDatabaseLike } from "@axe/core/node";

// #region kv
// The subset of a Redis-style client the stores need. ioredis and node-redis both have this shape.
interface KV {
  get(k: string): Promise<string | null>;
  set(k: string, v: string, mode: "EX", ttl: number): Promise<unknown>;
  del(k: string): Promise<unknown>;
  /** EVAL: runs a Lua script atomically on the Redis server. */
  eval(script: string, numKeys: number, ...args: string[]): Promise<unknown>;
}
// #endregion kv

// #region stores
// Token records are written once when a token is minted and again when completeHandoff records
// a completion. Single use lives in the idempotency store, so a plain get/set is enough here.
export function kvTokenStore(kv: KV, prefix = "axe:token:"): TokenStore {
  return {
    async get(id) {
      const raw = await kv.get(prefix + id);
      return raw ? (JSON.parse(raw) as TokenRecord) : undefined;
    },
    async set(id, record, ttlSeconds) {
      await kv.set(prefix + id, JSON.stringify(record), "EX", Math.max(1, Math.ceil(ttlSeconds)));
    },
    async delete(id) {
      await kv.del(prefix + id);
    },
  };
}

// Claims must be atomic, so each operation is one Lua script: Redis runs a script without
// interleaving any other command. A GET followed by a SET would let two requests both claim.
const CLAIM = `
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local raw = redis.call('GET', KEYS[1])
if raw then
  local e = cjson.decode(raw)
  if e.state == 'completed' then return raw end
  if not (e.leaseExpiresAt <= now and e.fingerprint == ARGV[1]) then return raw end
end
redis.call('SET', KEYS[1], cjson.encode({ state = 'in_progress', fingerprint = ARGV[1],
  owner = ARGV[2], leaseExpiresAt = now + tonumber(ARGV[3]) }), 'PX', ARGV[4])
return false`;
const COMPLETE = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local e = cjson.decode(raw)
if e.state ~= 'in_progress' or e.owner ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3])
return 1`;
const RELEASE = `
local raw = redis.call('GET', KEYS[1])
if raw then
  local e = cjson.decode(raw)
  if e.state == 'in_progress' and e.owner == ARGV[1] then redis.call('DEL', KEYS[1]) end
end
return 0`;

export function redisIdempotencyStore(kv: KV, prefix = "axe:op:"): IdempotencyStore {
  type Stored =
    | { state: "in_progress"; fingerprint: string; leaseExpiresAt: number }
    | { state: "completed"; record: IdempotencyRecord };
  return {
    async get(key) {
      const raw = await kv.get(prefix + key);
      const e = raw ? (JSON.parse(raw) as Stored) : undefined;
      return e?.state === "completed" ? e.record : undefined;
    },
    async claim(key, { fingerprint, owner, leaseSeconds, ttlSeconds }): Promise<ClaimOutcome> {
      const raw = await kv.eval(
        CLAIM,
        1,
        prefix + key,
        fingerprint,
        owner,
        String(leaseSeconds * 1000),
        String(Math.max(ttlSeconds, leaseSeconds) * 1000),
      );
      if (typeof raw !== "string") return { outcome: "acquired" };
      const e = JSON.parse(raw) as Stored;
      return e.state === "completed"
        ? { outcome: "completed", record: e.record }
        : { outcome: "in_progress", fingerprint: e.fingerprint, leaseExpiresAt: e.leaseExpiresAt };
    },
    async complete(key, owner, record, ttlSeconds) {
      const stored: Stored = { state: "completed", record };
      const n = await kv.eval(
        COMPLETE,
        1,
        prefix + key,
        owner,
        JSON.stringify(stored),
        String(ttlSeconds * 1000),
      );
      return n === 1;
    },
    async release(key, owner) {
      await kv.eval(RELEASE, 1, prefix + key, owner);
    },
  };
}
// #endregion stores

// #region sqlite
// Or the reference adapter: one SQLite file shared by every runtime on the host (Node 22.5+).
// @types/node 22 or newer types `node:sqlite` directly; the cast keeps this file on the Node 20 types.
const { DatabaseSync } = (await import("node:sqlite" as string)) as {
  DatabaseSync: new (path: string) => SqliteDatabaseLike;
};
const db = new DatabaseSync("/var/lib/oakridge/axe.db");
db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
export const sqliteStore = new SqliteIdempotencyStore(db);
// #endregion sqlite

// Replace with your Redis client. This stand-in only satisfies the types.
declare const kv: KV;

// #region config
export const axe = createAXE({
  name: "Oakridge Rentals",
  description:
    "Search available apartments, schedule tours, and submit rental applications with a holding deposit.",
  baseUrl: "https://oakridge-rentals.example",
  humanFallbackUrl: "https://oakridge-rentals.example",
  auth: { modes: ["none", "user"], userLoginUrl: "https://oakridge-rentals.example/login" },
  // At least 16 characters, from your secret manager. Rotating it invalidates outstanding tokens.
  secret: process.env.AXE_SECRET,
  tokenStore: kvTokenStore(kv),
  idempotencyStore: redisIdempotencyStore(kv),
  // The idempotency window. Default 24 hours; the store receives it as the TTL on every record.
  idempotencyTtlSeconds: 60 * 60 * 24,
  // How long a claim holds before a retry of the same call may run it again. Above your slowest handler.
  operationLeaseSeconds: 60,
});
// #endregion config

// #region operation
// The claim guarantees one handler run at a time and replays a stored result. It cannot undo a
// crash between your commit and the SDK storing the result: the retry runs the handler again.
// Make that second run find the first one's work, by writing the operationId in the same
// transaction as the change (or passing it to your payment provider as its idempotency key).
axe.register(
  action("deposits.pay", {
    title: "Pay the holding deposit",
    description:
      "Charges the refundable holding deposit for a submitted application and returns the receipt number.",
    risk: "high",
    input: z.object({ applicationId: z.string().describe("Application id, for example APP-8812") }),
    output: z.object({ receipt: z.string() }),
    handler: async ({ input, operationId }) => {
      db.exec("BEGIN IMMEDIATE");
      try {
        db.prepare(
          `INSERT INTO deposits (operation_id, application_id, receipt)
           VALUES (?, ?, 'R-' || lower(hex(randomblob(4))))
           ON CONFLICT (operation_id) DO NOTHING`,
        ).run(operationId!, input.applicationId);
        const row = db
          .prepare(`SELECT receipt FROM deposits WHERE operation_id = ?`)
          .get(operationId!) as { receipt: string };
        db.exec("COMMIT");
        return { receipt: row.receipt };
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  }),
);
// #endregion operation
// #endregion all
