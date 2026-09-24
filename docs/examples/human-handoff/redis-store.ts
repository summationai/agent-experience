/**
 * A TokenStore backed by Redis, for deployments with more than one server process.
 * The client type is structural so this file does not depend on a Redis library;
 * ioredis satisfies it as written.
 */
// #region all
import type { TokenRecord, TokenStore } from "@axe/core";

/** The three calls this store needs from a Redis client. */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "EX", ttlSeconds: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

export class RedisTokenStore implements TokenStore {
  constructor(
    private readonly redis: RedisLike,
    private readonly prefix = "axe:token:",
  ) {}

  async get(id: string): Promise<TokenRecord | undefined> {
    const raw = await this.redis.get(this.prefix + id);
    return raw === null ? undefined : (JSON.parse(raw) as TokenRecord);
  }

  // The runtime passes the remaining lifetime on every write, including the write that marks
  // a token consumed, so the key expires exactly when the token does.
  async set(id: string, record: TokenRecord, ttlSeconds: number): Promise<void> {
    await this.redis.set(
      this.prefix + id,
      JSON.stringify(record),
      "EX",
      Math.max(1, Math.ceil(ttlSeconds)),
    );
  }

  async delete(id: string): Promise<void> {
    await this.redis.del(this.prefix + id);
  }
}
// #endregion all
