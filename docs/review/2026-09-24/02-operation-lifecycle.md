# 2. Atomic idempotency and token consumption; operation lifecycle

## Finding

The review: two simultaneous requests with one `idempotencyKey` both executed and returned `ok`; two simultaneous uses of one continuation token did the same. The get/set store interfaces could not guarantee atomic acquisition across instances, poll terminalization raced, and a continuation or resume whose response was lost could not be recovered.

Reproduced at 3dd4ed3 with the review script: `concurrent same idempotency key {"calls":2,"statuses":["ok","ok"]}` and `concurrent same continuation token {"calls":2,"statuses":["ok","ok"]}`. Code reading confirmed the same read-then-write on resume (consumedAt) and poll (`record.terminal`, so `onPoll` could run twice with effects), and that a repeated successful continue or resume answered `conflict` with no way to learn the outcome.

## Change

- `IdempotencyStore` (`packages/core/src/idempotency.ts`) is now an operation-claim store: `get(key)`, `claim(key, { fingerprint, owner, leaseSeconds, ttlSeconds })` returning `acquired` / `in_progress` / `completed`, `complete(key, owner, record, ttl)` fenced on the owner, `release(key, owner)`. `IdempotencyRecord` is `{ fingerprint, result, createdAt }`. `MemoryIdempotencyStore` implements it without an `await` between read and write (atomic among runtimes sharing the instance in one process) and takes an injectable clock.
- One lifecycle for four operation types (`packages/core/src/server.ts` claimOperation / settleOperation):
  - action call: key `(tenant, action, principal, idempotencyKey)`, fingerprint = hash of canonical `input`;
  - continuation: key `~continue|tenant|tokenId`, fingerprint = hash of `{ kind, payload }`;
  - resume: key `~resume|tenant|tokenId`; the login resume also claims the original call's key under the signed-in user;
  - poll: key `~poll|tenant|tokenId`.
  The token's own binding covers the action, input hash, principal, and tenant.
- Rules ([P-OP-1] to [P-OP-4]): same fingerprint and completed → stored envelope, nothing runs. Different fingerprint, running or completed → `conflict` (non-retryable). Running → `conflict`, `retryable: true`, `details: { operationStatus: "in_progress", retryAfter }`, and `Retry-After` (poll: `pending`). Non-error result → stored for the idempotency window. `error` (a thrown handler included) → claim released, nothing stored, so a retry runs again; a stale `expectedRev` also releases. A terminal poll result is stored whatever its status. A claim is a lease (`operationLeaseSeconds`, default 60): after it passes, only a request with the same fingerprint may take it over. A lost lease is reported to `onError`.
- Lost responses: a repeated continue (same kind and payload) or resume returns the original envelope ([P-REQ-9], [P-HAND-6] amended; conformance `ladder.continue-replay` and `ladder.resume-replay` now expect the original envelope).
- `operationId` on every handler context (hash of the claim key): stable across retries and instances, for downstream idempotency.
- Durable reference adapter: `SqliteIdempotencyStore` in `@summationai/axe-core/node` over a caller-supplied `node:sqlite` connection (typed structurally; `@summationai/axe-core` never imports `node:sqlite`). Each claim is one `INSERT ... ON CONFLICT DO UPDATE ... WHERE`; default table `axe_operations_v1`.
- Redis: `docs/examples/deploying/stores.ts` implements claim, complete, and release as Lua scripts, typechecked but not executed, and the docs state the failover limit. No get/set Redis store is presented as safe.
- `createAXE` refuses an `idempotencyStore` without `claim`/`complete`/`release`.
- Spec: §12.2 [P-OP-1] to [P-OP-4]; [P-IDEM-2], [P-REQ-9], [P-HAND-6], [P-TOK-3] amended; [P-POLL-2].
- Docs: `docs/deploying.md` ("Secrets and stores", "Operations, claims, and crashes", "Migrating a store", checklist), `docs/security.md`, `docs/concepts.md`, `docs/requirements-and-kinds.md`, `docs/human-handoff.md`, `docs/testing-and-conformance.md`. Vocabulary: `operationStatus`, `operationLeaseSeconds`, `operationId`, `SqliteIdempotencyStore`. DECISIONS: "The idempotency store claims; it does not get and set", "The SDK promises one run at a time and a replayed result, not exactly-once effects", "`SqliteIdempotencyStore` is the reference adapter"; the single-use and idempotency-scope entries were revised in place.

### Migration for store adapters

Breaking, with no shim, because a shim over get/set would keep the race. A custom `IdempotencyStore` must implement `claim`/`complete`/`release` atomically (conditional insert or a server-side script); the record field inputHash is now `fingerprint`. `TokenStore` keeps its interface (`get`/`set`/`delete`); `TokenRecord.onBehalfOf` is now `principal`, and consumedAt and `terminal` are gone. A store that keeps records as opaque JSON needs no code change. Tokens minted before the upgrade return `not_found`.

## Tests

Barrier-driven (promises the test resolves, no timers), in `packages/core/test/operations.test.ts` and `sqlite-store.test.ts`. All fail on 3dd4ed3 (the concurrency tests time out there because the second caller also enters the handler) except the one marked as a guard:

- "run once; the concurrent caller gets a retryable conflict with Retry-After, then the stored envelope" (also: altered input while running and after completion is `conflict`; the lost-response retry replays)
- "two runtime instances sharing the stores run the operation once" (action call, and a continuation minted on one instance presented to both)
- "concurrent uses of one continuation token run onContinue once; a lost response is recovered; an altered payload conflicts"
- "a handler that throws releases the claim: the retry runs again and its success is stored" (guard for the documented rule; errors were already not stored at 3dd4ed3)
- "an abandoned claim blocks retries until its lease passes, then the same operation takes it over" (and a different input never takes it over; the dead owner cannot settle)
- "a crash after the business commit and before the result is stored: the retry re-runs, and operationId keeps the effect single"
- "a get/set store is refused at startup"
- "concurrent polls run onPoll once; the other poll is pending; both then see one terminal result"
- "MemoryIdempotencyStore claims atomically, fences settlement by owner, and takes over only the same fingerprint after the lease"
- SQLite (skipped with a message where `node:sqlite` is missing, as on Node 20; verified under Node 20.20.2 and Node 24.21.0): "claims atomically across two connections to one file, and takes over only the same fingerprint"; "two runtimes on one database run a call once, and a crash after the business commit is recovered by operationId" (the business row and the operation id commit in one `BEGIN IMMEDIATE` transaction with `ON CONFLICT DO NOTHING`).
- Updated: `ladder.test.ts` "needs_input → continue → ok, consuming the token" and "needs_input → fallback handoff → resume → ok" now assert replay of the original envelope and `conflict` for an altered payload.

## Limitations

- Not exactly-once. A handler that errors runs again on retry; a crash between the business commit and the stored result, or a handler that outlives its lease, leads to a second run. `operationId` plus a unique constraint or a provider idempotency key is the site's half.
- `MemoryIdempotencyStore` is atomic only within one process.
- The Redis scripts are atomic on one primary; asynchronous replication can lose a claim or a result on failover. They are typechecked, not executed in CI.
- The PostgreSQL port of the SQLite statements is described, not tested.
- A request answered `in_progress` for a long handler must keep retrying; there is no push.
- A continuation replay requires the identical payload; an agent that lost the payload as well as the response cannot recover the envelope.

## Status

done
