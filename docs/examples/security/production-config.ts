/**
 * Oakridge Rentals: the production shape of `createAXE`. A real secret, durable stores
 * shared by every instance, an error hook that logs causes without bodies, and no CORS.
 */
import { createAXE } from "@axe/core";
import type { IdempotencyRecord, IdempotencyStore, TokenRecord, TokenStore } from "@axe/core";

// Stand-in for your Redis or KV client. Any store with get, set-with-TTL, and delete works.
interface Kv {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}
const memory = new Map<string, { value: string; expires: number }>();
const kv: Kv = {
  async get(key) {
    const entry = memory.get(key);
    return entry && entry.expires > Date.now() ? entry.value : null;
  },
  async set(key, value, ttlSeconds) {
    memory.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
  },
  async del(key) {
    memory.delete(key);
  },
};

// #region stores
// Token records hold `state`, the accepted schemas, and the consumed flag. Idempotency
// records hold the original result. Both are plain JSON; both keys are already scoped by
// tenant, action, and acting user before they reach you.
class KvTokenStore implements TokenStore {
  constructor(private readonly kv: Kv) {}
  async get(id: string): Promise<TokenRecord | undefined> {
    const raw = await this.kv.get(`axe:token:${id}`);
    return raw ? (JSON.parse(raw) as TokenRecord) : undefined;
  }
  async set(id: string, record: TokenRecord, ttlSeconds: number): Promise<void> {
    await this.kv.set(`axe:token:${id}`, JSON.stringify(record), ttlSeconds);
  }
  async delete(id: string): Promise<void> {
    await this.kv.del(`axe:token:${id}`);
  }
}

class KvIdempotencyStore implements IdempotencyStore {
  constructor(private readonly kv: Kv) {}
  async get(key: string): Promise<IdempotencyRecord | undefined> {
    const raw = await this.kv.get(`axe:idem:${key}`);
    return raw ? (JSON.parse(raw) as IdempotencyRecord) : undefined;
  }
  async set(key: string, record: IdempotencyRecord, ttlSeconds: number): Promise<void> {
    await this.kv.set(`axe:idem:${key}`, JSON.stringify(record), ttlSeconds);
  }
}
// #endregion stores

// #region config
// Refuse to start without a real secret. Tokens signed with a per-process random secret
// stop verifying on restart, and a short or shared secret is forgeable.
const secret = process.env.AXE_SECRET;
if (!secret) throw new Error("AXE_SECRET is not set. Generate one with `openssl rand -hex 32`.");

export const axe = createAXE({
  name: "Oakridge Rentals",
  description:
    "Search available apartments, schedule tours, submit rental applications with a holding deposit, and check application status.",
  baseUrl: "https://oakridge-rentals.example",
  humanFallbackUrl: "https://oakridge-rentals.example",
  auth: { modes: ["none", "user"], userLoginUrl: "https://oakridge-rentals.example/login" },
  policies: {
    rateLimit: { requestsPerMinute: 60 },
    termsUrl: "https://oakridge-rentals.example/terms",
    dataRetention:
      "Continuation state is kept for 15 minutes, handoff state for 24 hours, and idempotency records for 24 hours.",
  },
  contact: { email: "agents@oakridge-rentals.example" },
  secret,
  tokenStore: new KvTokenStore(kv),
  idempotencyStore: new KvIdempotencyStore(kv),
  // `cors` is omitted on purpose: no browser-based agent calls this origin, so no CORS headers are emitted.
  onError: (ctx, error) => {
    // The agent has already received a generic `internal` error. Log the cause with the
    // action and endpoint. Never log ctx.request's body: it may hold a sensitive payload.
    console.error(
      JSON.stringify({ action: ctx.action, endpoint: ctx.endpoint, error: String(error) }),
    );
  },
});
// #endregion config
