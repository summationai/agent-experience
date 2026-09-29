/**
 * Bounded, expiring in-memory maps for the default stores (spec [P-LIM-4]).
 *
 * A map that only drops an expired entry when that key is read again grows without bound: most
 * keys (idempotency keys, token ids) are unique and never read after they expire. `ExpiringMap`
 * sweeps expired entries at most once per `sweepIntervalMs` on writes (no timer, so nothing keeps
 * a process alive), and evicts the oldest evictable entries when `maxEntries` is reached.
 */

/** Retention options shared by `MemoryTokenStore` and `MemoryIdempotencyStore`. */
export interface RetentionOptions {
  /** The clock, in epoch milliseconds. Injectable for tests. Default `Date.now`. */
  now?: () => number;
  /**
   * Most entries kept at once. A write at the limit first sweeps expired entries, then evicts the
   * oldest entries that may be evicted. Default 10000.
   */
  maxEntries?: number;
  /** Least time between two sweeps of expired entries, in milliseconds. Default 60000. */
  sweepIntervalMs?: number;
}

/** Default `maxEntries` for the in-memory stores. */
export const DEFAULT_MAX_ENTRIES = 10_000;
/** Default `sweepIntervalMs` for the in-memory stores. */
export const DEFAULT_SWEEP_INTERVAL_MS = 60_000;

/** @internal */
export class ExpiringMap<V extends { expiresAt: number }> {
  readonly now: () => number;
  private readonly map = new Map<string, V>();
  private readonly maxEntries: number;
  private readonly sweepIntervalMs: number;
  private lastSweep: number;
  private closed = false;

  constructor(
    private readonly owner: string,
    options: RetentionOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.sweepIntervalMs = options.sweepIntervalMs ?? DEFAULT_SWEEP_INTERVAL_MS;
    if (!Number.isInteger(this.maxEntries) || this.maxEntries < 1)
      throw new Error(`${owner}: maxEntries must be a positive integer.`);
    if (!(this.sweepIntervalMs >= 0))
      throw new Error(`${owner}: sweepIntervalMs must be zero or more.`);
    this.lastSweep = this.now();
  }

  /** The live entry under `key`; an expired one is dropped. */
  get(key: string): V | undefined {
    this.open();
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.map.delete(key);
      return undefined;
    }
    return entry;
  }

  /**
   * Store `value` as the newest entry. `evictable` says which older entries may be dropped to make
   * room; when none may, the write throws rather than dropping something that must be kept.
   */
  set(key: string, value: V, evictable: (entry: V) => boolean = () => true): void {
    this.open();
    this.map.delete(key);
    const now = this.now();
    if (now - this.lastSweep >= this.sweepIntervalMs || this.map.size >= this.maxEntries)
      this.sweep();
    if (this.map.size >= this.maxEntries) {
      for (const [k, v] of this.map) {
        if (this.map.size < this.maxEntries) break;
        if (evictable(v)) this.map.delete(k);
      }
      if (this.map.size >= this.maxEntries)
        throw new Error(
          `${this.owner}: ${this.map.size} entries are held and none may be evicted (maxEntries ${this.maxEntries}). Raise maxEntries or use a shared store; see docs/deploying.md, "Limits and retention".`,
        );
    }
    this.map.set(key, value);
  }

  delete(key: string): void {
    this.open();
    this.map.delete(key);
  }

  /** Drop every expired entry now. Returns how many were dropped. */
  sweep(): number {
    this.open();
    const now = this.now();
    this.lastSweep = now;
    let dropped = 0;
    for (const [k, v] of this.map) {
      if (v.expiresAt <= now) {
        this.map.delete(k);
        dropped++;
      }
    }
    return dropped;
  }

  get size(): number {
    return this.map.size;
  }

  /** Drop everything; later calls throw. */
  close(): void {
    this.map.clear();
    this.closed = true;
  }

  private open(): void {
    if (this.closed) throw new Error(`${this.owner} is closed.`);
  }
}
