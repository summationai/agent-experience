import { createAXE, MemoryIdempotencyStore, MemoryTokenStore } from "@summationai/axe-core";
import { SqliteIdempotencyStore } from "@summationai/axe-core/node";
import type { SqliteDatabaseLike } from "@summationai/axe-core/node";

// #region body
export const axe = createAXE({
  name: "Northgate University Admissions",
  description:
    "Check application status, upload transcripts and recommendation letters, and schedule campus visits.",
  baseUrl: "https://admissions.northgate.example",
  secret: process.env.AXE_SECRET,
  // The largest request body the runtime reads. Default 1 MiB. Transcripts arrive inline as
  // document.base64 (up to 10 MiB decoded, about 14 MiB encoded), so this site raises it.
  maxBodyBytes: 16 * 1024 * 1024,
});
// #endregion body

// #region memory
// A single process: bound what the in-memory stores hold. Expired entries are swept on writes at
// most once a minute, and at maxEntries the oldest are evicted (a running claim never is).
export const tokenStore = new MemoryTokenStore({ maxEntries: 50_000 });
export const idempotencyStore = new MemoryIdempotencyStore({
  maxEntries: 50_000,
  sweepIntervalMs: 30_000,
});
// On shutdown, in tests, or when a worker is recycled: drop everything they hold.
process.once("SIGTERM", () => {
  tokenStore.close();
  idempotencyStore.close();
});
// #endregion memory

// #region prune
// A durable store keeps expired rows until something deletes them. Reads already ignore them, so
// this bounds the table, nothing more. Run it from a timer or your job scheduler.
const { DatabaseSync } = (await import("node:sqlite" as string)) as {
  DatabaseSync: new (path: string) => SqliteDatabaseLike;
};
const db = new DatabaseSync("/var/lib/northgate/axe.db");
db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
export const operations = new SqliteIdempotencyStore(db);
const pruning = setInterval(() => {
  const removed = operations.prune(); // rows that expired before now
  if (removed > 0) console.log(`[axe] pruned ${removed} expired operation records`);
}, 5 * 60_000);
pruning.unref(); // the job must not keep the process alive
// #endregion prune
