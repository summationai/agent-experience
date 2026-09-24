/**
 * @axe/core/node: the pieces of `@axe/core` that need Node. Everything else in the package is
 * platform-neutral, so a browser bundle that imports `@axe/core` or `@axe/surface` never meets a
 * Node built-in; this entry is the one place that reaches for one. `SqliteIdempotencyStore` takes
 * a `node:sqlite` connection you open, so this module imports nothing from `node:sqlite` itself.
 */
import type {
  ClaimOutcome,
  ClaimRequest,
  IdempotencyRecord,
  IdempotencyStore,
} from "./idempotency";
import type { AXEActionEvent, AXEEvent, Result } from "./types";

/**
 * Sink: append JSON lines to a file. Node only. The file handle is opened lazily and
 * writes are serialized, so events never interleave. Accepts request events and action events.
 */
export function jsonlFileSink(path: string): (event: AXEEvent | AXEActionEvent) => Promise<void> {
  let queue: Promise<void> = Promise.resolve();
  return (event) => {
    queue = queue.then(async () => {
      const { appendFile } = await import("node:fs/promises");
      await appendFile(path, JSON.stringify(event) + "\n", "utf8");
    });
    return queue;
  };
}

/**
 * The subset of `node:sqlite`'s `DatabaseSync` the store uses (Node 22.5 or newer). Typed
 * structurally so this module never imports `node:sqlite`: pass your own connection.
 */
export interface SqliteDatabaseLike {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: (string | number | null)[]): { changes: number | bigint };
    get(...params: (string | number | null)[]): unknown;
  };
}

interface OperationRow {
  state: "in_progress" | "completed";
  fingerprint: string;
  lease_expires: number | null;
  result: string | null;
  created_at: number;
}

/**
 * A durable `IdempotencyStore` over SQLite (`node:sqlite`, Node 22.5 or newer). Every claim is one
 * `INSERT ... ON CONFLICT DO UPDATE ... WHERE` statement, which SQLite runs atomically, so any
 * number of runtimes, in one process or several, that open the same database file share claims.
 * Open each connection with `PRAGMA busy_timeout` set, so a writer waits for another process's
 * write instead of failing. The same statements port to PostgreSQL (`ON CONFLICT` with a `WHERE`
 * on the update, `RETURNING` in place of `changes`); see docs/deploying.md.
 */
export class SqliteIdempotencyStore implements IdempotencyStore {
  private readonly now: () => number;
  private readonly table: string;

  constructor(
    private readonly db: SqliteDatabaseLike,
    options: { table?: string; now?: () => number } = {},
  ) {
    this.table = options.table ?? "axe_operations";
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(this.table))
      throw new Error(`SqliteIdempotencyStore: table name "${this.table}" is not an identifier.`);
    this.now = options.now ?? Date.now;
    db.exec(`CREATE TABLE IF NOT EXISTS ${this.table} (
      key TEXT PRIMARY KEY,
      state TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      owner TEXT,
      lease_expires INTEGER,
      expires INTEGER NOT NULL,
      result TEXT,
      created_at INTEGER NOT NULL
    )`);
  }

  async get(key: string): Promise<IdempotencyRecord | undefined> {
    const row = this.row(key);
    return row?.state === "completed" ? toRecord(row) : undefined;
  }

  async claim(key: string, request: ClaimRequest): Promise<ClaimOutcome> {
    const now = this.now();
    const t = this.table;
    // Insert a claim, or take over a row that expired, or an abandoned claim for the same
    // operation. One statement: SQLite never interleaves another writer inside it.
    const { changes } = this.db
      .prepare(
        `INSERT INTO ${t} (key, state, fingerprint, owner, lease_expires, expires, result, created_at)
         VALUES (?, 'in_progress', ?, ?, ?, ?, NULL, ?)
         ON CONFLICT(key) DO UPDATE SET
           state = 'in_progress', fingerprint = excluded.fingerprint, owner = excluded.owner,
           lease_expires = excluded.lease_expires, expires = excluded.expires, result = NULL,
           created_at = excluded.created_at
         WHERE ${t}.expires <= ?
            OR (${t}.state = 'in_progress' AND ${t}.lease_expires <= ? AND ${t}.fingerprint = excluded.fingerprint)`,
      )
      .run(
        key,
        request.fingerprint,
        request.owner,
        now + request.leaseSeconds * 1000,
        now + Math.max(request.ttlSeconds, request.leaseSeconds) * 1000,
        now,
        now,
        now,
      );
    if (Number(changes) === 1) return { outcome: "acquired" };
    const row = this.row(key);
    if (!row) return this.claim(key, request); // released between the two statements
    if (row.state === "completed") return { outcome: "completed", record: toRecord(row) };
    return {
      outcome: "in_progress",
      fingerprint: row.fingerprint,
      leaseExpiresAt: row.lease_expires ?? 0,
    };
  }

  async complete(
    key: string,
    owner: string,
    record: IdempotencyRecord,
    ttlSeconds: number,
  ): Promise<boolean> {
    const { changes } = this.db
      .prepare(
        `UPDATE ${this.table}
         SET state = 'completed', result = ?, owner = NULL, lease_expires = NULL, expires = ?, created_at = ?
         WHERE key = ? AND owner = ? AND state = 'in_progress'`,
      )
      .run(
        JSON.stringify(record.result),
        this.now() + ttlSeconds * 1000,
        record.createdAt,
        key,
        owner,
      );
    return Number(changes) === 1;
  }

  async release(key: string, owner: string): Promise<void> {
    this.db
      .prepare(`DELETE FROM ${this.table} WHERE key = ? AND owner = ? AND state = 'in_progress'`)
      .run(key, owner);
  }

  /** Delete expired rows. Call it from a periodic job; correctness never depends on it. */
  prune(): number {
    return Number(
      this.db.prepare(`DELETE FROM ${this.table} WHERE expires <= ?`).run(this.now()).changes,
    );
  }

  private row(key: string): OperationRow | undefined {
    return this.db
      .prepare(
        `SELECT state, fingerprint, lease_expires, result, created_at FROM ${this.table} WHERE key = ? AND expires > ?`,
      )
      .get(key, this.now()) as OperationRow | undefined;
  }
}

function toRecord(row: OperationRow): IdempotencyRecord {
  return {
    fingerprint: row.fingerprint,
    result: JSON.parse(row.result ?? "null") as Result,
    createdAt: row.created_at,
  };
}
