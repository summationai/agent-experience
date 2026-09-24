/**
 * Idempotency (spec §12.1): replaying a key for the same action, user, and input
 * within the window returns the original result; a different input is a conflict.
 */
import type { Result } from "./types";

export interface IdempotencyRecord {
  inputHash: string;
  result: Result;
  createdAt: number;
}

/**
 * Storage for idempotency records. Keys are already scoped by tenant, action, and
 * acting user. Implement with Redis `SET ... EX` or a table with a TTL index.
 */
export interface IdempotencyStore {
  get(key: string): Promise<IdempotencyRecord | undefined>;
  set(key: string, record: IdempotencyRecord, ttlSeconds: number): Promise<void>;
}

/** In-memory `IdempotencyStore`. Suitable for a single process. */
export class MemoryIdempotencyStore implements IdempotencyStore {
  private readonly map = new Map<string, { record: IdempotencyRecord; expires: number }>();

  async get(key: string): Promise<IdempotencyRecord | undefined> {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expires <= Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return entry.record;
  }

  async set(key: string, record: IdempotencyRecord, ttlSeconds: number): Promise<void> {
    this.map.set(key, { record, expires: Date.now() + ttlSeconds * 1000 });
  }

  get size(): number {
    return this.map.size;
  }
}

/** Default idempotency window: 24 hours. */
export const DEFAULT_IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

export function idempotencyStorageKey(parts: {
  tenant: string | null;
  action: string;
  onBehalfOf: string | null;
  key: string;
}): string {
  return [parts.tenant ?? "", parts.action, parts.onBehalfOf ?? "", parts.key]
    .map(encodeURIComponent)
    .join("|");
}
