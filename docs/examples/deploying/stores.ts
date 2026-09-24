// #region all
import { createAXE } from "@axe/core";
import type { IdempotencyRecord, IdempotencyStore, TokenRecord, TokenStore } from "@axe/core";

// #region kv
// The subset of a Redis-style client the stores need. ioredis and node-redis both have this shape.
interface KV {
  get(k: string): Promise<string | null>;
  set(k: string, v: string, mode: "EX", ttl: number): Promise<unknown>;
  del(k: string): Promise<unknown>;
}
// #endregion kv

// #region stores
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

export function kvIdempotencyStore(kv: KV, prefix = "axe:idem:"): IdempotencyStore {
  return {
    async get(key) {
      const raw = await kv.get(prefix + key);
      return raw ? (JSON.parse(raw) as IdempotencyRecord) : undefined;
    },
    async set(key, record, ttlSeconds) {
      await kv.set(prefix + key, JSON.stringify(record), "EX", Math.max(1, Math.ceil(ttlSeconds)));
    },
  };
}
// #endregion stores

// Replace with your Redis client. This in-memory stand-in has the same shape.
const kv: KV = (() => {
  const entries = new Map<string, { value: string; expiresAt: number }>();
  return {
    async get(k) {
      const e = entries.get(k);
      if (!e || e.expiresAt < Date.now()) {
        entries.delete(k);
        return null;
      }
      return e.value;
    },
    async set(k, v, _mode, ttl) {
      entries.set(k, { value: v, expiresAt: Date.now() + ttl * 1000 });
    },
    async del(k) {
      entries.delete(k);
    },
  };
})();

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
  idempotencyStore: kvIdempotencyStore(kv),
  // The idempotency window. Default 24 hours; the store receives it as the TTL on every record.
  idempotencyTtlSeconds: 60 * 60 * 24,
});
// #endregion config
// #endregion all
