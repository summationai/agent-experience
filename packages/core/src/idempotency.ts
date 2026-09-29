/**
 * Operation claims: the store behind idempotency keys (spec §12.1), single-use continuation and
 * resume tokens, and poll terminalization (spec §12.2).
 *
 * Every operation the runtime must run at most once is claimed before it runs. `claim` is atomic:
 * of any number of simultaneous callers with the same key, exactly one is told `acquired` and runs
 * the operation; the others see `in_progress` (and are answered with a retryable `conflict`) or,
 * once the first has finished, `completed` with the stored envelope. A claim is a lease: when its
 * holder dies before calling `complete` or `release`, the next caller with the same fingerprint
 * takes it over once `leaseSeconds` have passed. A claim never makes a business mutation atomic;
 * see docs/deploying.md, "Operations, claims, and crashes".
 */
import type { Result } from "./types";
import { ExpiringMap } from "./retention";
import type { RetentionOptions } from "./retention";

/** A completed operation: the fingerprint it ran with and the envelope it produced. */
export interface IdempotencyRecord {
  /**
   * Hash of what makes a retry the same operation: the canonical `input` for an action call, the
   * `kind` and `payload` for a continuation. A claim with another fingerprint is a conflict.
   */
  fingerprint: string;
  result: Result;
  /** Epoch milliseconds when the operation completed. */
  createdAt: number;
}

/** What `claim` is asked to record. */
export interface ClaimRequest {
  fingerprint: string;
  /** A random id for this attempt; `complete` and `release` are fenced on it. */
  owner: string;
  /** How long the claim holds before another caller with the same fingerprint may take it over. */
  leaseSeconds: number;
  /** How long the key is remembered at all (the idempotency window). */
  ttlSeconds: number;
}

/** The answer to `claim`. */
export type ClaimOutcome =
  | { outcome: "acquired" }
  | { outcome: "in_progress"; fingerprint: string; leaseExpiresAt: number }
  | { outcome: "completed"; record: IdempotencyRecord };

/**
 * Storage for operation claims. Keys arrive already scoped by operation type, tenant, action, and
 * acting principal. Every method must be atomic with respect to every other caller sharing the
 * store, across processes: a `get` followed by a `set` is not a claim. See `MemoryIdempotencyStore`
 * (one process) and `SqliteIdempotencyStore` in `@summationai/axe-core/node` (a shared SQLite file, and the
 * SQL to port to another database).
 */
export interface IdempotencyStore {
  /** The completed record under `key`, or undefined when there is none, it expired, or it is still in progress. */
  get(key: string): Promise<IdempotencyRecord | undefined>;
  /**
   * Atomically: when `key` is absent or expired, record an in-progress claim and return `acquired`.
   * When it holds an in-progress claim whose lease has passed and whose fingerprint equals the
   * request's, take it over and return `acquired`. Otherwise return what is there.
   */
  claim(key: string, request: ClaimRequest): Promise<ClaimOutcome>;
  /**
   * Record the result of the claim `owner` holds, kept for `ttlSeconds`. Returns false, and stores
   * nothing, when `owner` no longer holds the claim (its lease was taken over).
   */
  complete(
    key: string,
    owner: string,
    record: IdempotencyRecord,
    ttlSeconds: number,
  ): Promise<boolean>;
  /** Drop the in-progress claim `owner` holds, so the key can be used again. A no-op otherwise. */
  release(key: string, owner: string): Promise<void>;
}

type MemoryEntry =
  | {
      state: "in_progress";
      fingerprint: string;
      owner: string;
      leaseExpiresAt: number;
      expiresAt: number;
    }
  | { state: "completed"; record: IdempotencyRecord; expiresAt: number };

/**
 * In-memory `IdempotencyStore`. Every method runs without awaiting between its read and its write,
 * so claims are atomic among all runtimes in one process that share the instance. Nothing survives
 * a restart and nothing is shared with another process.
 *
 * Retention is bounded ([P-LIM-4]): expired entries are swept on writes at most once per
 * `sweepIntervalMs`, and at `maxEntries` the oldest completed entries (and claims whose lease has
 * passed) are evicted first. An evicted completed entry shortens the idempotency window for that
 * key: a retry after eviction runs the handler again. A claim whose lease is still running is never
 * evicted; when every entry is one, `claim` throws. No timer runs, so nothing keeps a process alive.
 */
export class MemoryIdempotencyStore implements IdempotencyStore {
  private readonly map: ExpiringMap<MemoryEntry>;
  private readonly now: () => number;

  /** `now` is the clock for leases and expiry, injectable for tests. See `RetentionOptions`. */
  constructor(options: RetentionOptions = {}) {
    this.map = new ExpiringMap<MemoryEntry>("MemoryIdempotencyStore", options);
    this.now = this.map.now;
  }

  async get(key: string): Promise<IdempotencyRecord | undefined> {
    const entry = this.map.get(key);
    return entry?.state === "completed" ? entry.record : undefined;
  }

  async claim(key: string, request: ClaimRequest): Promise<ClaimOutcome> {
    const now = this.now();
    const entry = this.map.get(key);
    if (entry?.state === "completed") return { outcome: "completed", record: entry.record };
    if (entry && !(entry.leaseExpiresAt <= now && entry.fingerprint === request.fingerprint)) {
      return {
        outcome: "in_progress",
        fingerprint: entry.fingerprint,
        leaseExpiresAt: entry.leaseExpiresAt,
      };
    }
    this.map.set(
      key,
      {
        state: "in_progress",
        fingerprint: request.fingerprint,
        owner: request.owner,
        leaseExpiresAt: now + request.leaseSeconds * 1000,
        expiresAt: now + Math.max(request.ttlSeconds, request.leaseSeconds) * 1000,
      },
      this.evictable,
    );
    return { outcome: "acquired" };
  }

  async complete(
    key: string,
    owner: string,
    record: IdempotencyRecord,
    ttlSeconds: number,
  ): Promise<boolean> {
    const entry = this.map.get(key);
    if (entry?.state !== "in_progress" || entry.owner !== owner) return false;
    this.map.set(
      key,
      { state: "completed", record, expiresAt: this.now() + ttlSeconds * 1000 },
      this.evictable,
    );
    return true;
  }

  async release(key: string, owner: string): Promise<void> {
    const entry = this.map.get(key);
    if (entry?.state === "in_progress" && entry.owner === owner) this.map.delete(key);
  }

  /** Drop every expired entry now; returns how many. Writes do this on their own; see `sweepIntervalMs`. */
  sweep(): number {
    return this.map.sweep();
  }

  /** Drop every entry. Later calls throw. There is no timer to stop. */
  close(): void {
    this.map.close();
  }

  /** Number of entries held, completed or in progress (expired ones not yet swept included), for tests. */
  get size(): number {
    return this.map.size;
  }

  /** Completed entries, and claims whose lease has passed, may be evicted; a running claim may not. */
  private readonly evictable = (entry: MemoryEntry): boolean =>
    entry.state === "completed" || entry.leaseExpiresAt <= this.now();
}

/** Default idempotency window: 24 hours. */
export const DEFAULT_IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

/** Default operation lease: how long a claim holds before a retry may take it over. */
export const DEFAULT_OPERATION_LEASE_SECONDS = 60;

/** The claim key for an action call's `idempotencyKey`. */
export function idempotencyStorageKey(parts: {
  tenant: string | null;
  action: string;
  principal: string | null;
  key: string;
}): string {
  return [parts.tenant ?? "", parts.action, parts.principal ?? "", parts.key]
    .map(encodeURIComponent)
    .join("|");
}

/** The claim key for one use of a token: `continue`, `resume`, or `poll`. */
export function tokenOperationKey(
  operation: "continue" | "resume" | "poll",
  tenant: string | null,
  tokenId: string,
): string {
  return ["~" + operation, tenant ?? "", tokenId].map(encodeURIComponent).join("|");
}

/** Whether a value implements the claim interface (and is not a pre-claim get/set store). */
export function isClaimStore(store: unknown): store is IdempotencyStore {
  const s = store as Partial<IdempotencyStore> | null;
  return (
    !!s &&
    typeof s.get === "function" &&
    typeof s.claim === "function" &&
    typeof s.complete === "function" &&
    typeof s.release === "function"
  );
}
