# 8. State preconditions meaningful at the write boundary

Phase 1, release-blocking.

## Finding

The review said a preflight revision comparison is not concurrency control, and that the `app` revision mode does not change that. Reproduced on `herz/surface-integration` at `3dd4ed3` with the review script's case "concurrent same Surface revision": a surface with one action whose asynchronous handler awaits and then calls `bump()`, and two `act()` calls presenting `expectedRev: 0` started together. Result: `calls: 2`, both statuses `ok`, final `rev: 2`, and a ledger of `ok 0→1` and `ok 0→2`, both claiming `revBefore: 0`. `act()` compared `expectedRev` with the revision and then awaited the handler; nothing held the revision in between, so the second act passed the same comparison.

The same gap existed end to end through `@axe/surface/axe`: the server's stale check ([P-LIVE-3]) runs before the handler, so two requests with the same envelope `expectedRev` both reached `surface.act`, where both passed again. Across two instances of a server-state application (two tabs of the planning grid), no check in the browser can order writes on the server, and handlers had no way to receive the presented revision or to refuse under their own precondition. A handler's late `HandlerReport.rev` was adopted unconditionally, so an older report could roll back a newer revision adopted with `setRev` while the handler ran.

## Change

`packages/surface/src/index.ts`, inside `act()` and new exports:

- Ordering ([S-ACT-9]). `act()` runs every pre-handler check at the call (the claim): shape, the revision guard, target resolution, a freeze, availability, confirm, `maxLength`, schema. A refusal is ledgered and returned at once. An act that passes joins a per-surface FIFO. On an idle surface it starts its handler within the call, as before. A queued act runs all the checks again when it reaches execution, so a predecessor's commit or a person's `bump`/`setRev` gives `conflict`, and a freeze or a control that became unavailable gives `unavailable`. In every case no handler runs. `observe()`, `availability()`, and `ledger()` do not wait. `revBefore` in the ledger is the revision when the act was last checked.
- A commit that leaves the revision in place ([S-ACT-10]). A claim epoch moves on every commit that may have changed state. A commit provably changed nothing only when the revision did not move and either the handler reported `changed: []` or the revision is surface-owned. It also moves when a handler throws. A queued act whose epoch moved is `conflict` even though the app-owned revision has not moved yet. An act claimed after the commit is accepted, so a re-observing agent never deadlocks.
- The handler's own precondition ([S-ACT-11]). New `ActContext` (`{ id, op, expectedRev, actor }`) passed as the last argument to `handler(actor, text, context)`, `set(text, actor, context)`, and `more(context)`. New `SurfaceConflict` error class (optional `currentRev`). New `HandlerReport.conflict` (`{ currentRev? }`). Either one maps to `error` `conflict`, `retryable: true`, `details: { expectedRev, currentRev, seq }`, a ledger refusal (`changed: []`), and nothing adopted. A thrown `SurfaceConflict` is not recorded as `internal`.
- Stale reports ([S-REV-6]). A reported `rev` lower than the revision when the handler settles is not adopted. The act stays `ok` with the current revision, and the ledger entry carries `ignoredRev`.

`packages/surface/src/axe.ts`: the entry action already passed the envelope's `expectedRev` to `act`. A comment now states the two-gate contract, and `ignoredRev` is added to the `<ns>.ledger` output schema. The auth and scoping code was not touched.

Spec: `spec/SURFACE.md` is now contract v0.5, with new rules [S-ACT-9], [S-ACT-10], [S-ACT-11], and [S-REV-6]. [S-ENT-2] to [S-ENT-4] get the handler signatures. [S-ACT-1] adds the `conflict` member and the stale-rev exception. [S-REV-1] says the second gate is the write itself. [S-LED-1] and [S-LED-5] cover `ignoredRev` and `revBefore`. [S-AXE-4] states the two gates. There is also a v0.5 provenance paragraph. Vocabulary: `SurfaceConflict`, `ActContext`, `ignoredRev`, and the handler report's `conflict`. Docs: `docs/surface.md` ("Observe and act", new "Writing under a precondition" with `docs/examples/surface/precondition.ts`, and the bridge paragraph) and `docs/live-state.md` (the two gates). CHANGELOG and DECISIONS are updated; DECISIONS records why a queue rather than a reservation, and why there are no per-entry revisions.

Migration for server-state adapters (the planning grid's `surface-grid.js`): the lock and unlock callbacks should pass `context.expectedRev` into the command as the protected protocol's `expected_revision`. When the server refuses for a stale revision, they should throw `SurfaceConflict` with the server's `branch_revision` as `currentRev` (or return `{ conflict: { currentRev } }`) instead of resolving normally. They keep returning `{ changed, rev }` on success. The cell commit reports no revision today. Under [S-ACT-10] an agent's second edit from the same observation is now `conflict` until it observes again. To avoid that, the commit can report `{ changed: [id], rev }` once the save lands. Either way it should carry `expectedRev` into the burst queue, so the server can refuse a stale edit.

## Tests

`packages/surface/test/preconditions.test.ts`, 13 tests, all interleavings driven by barriers the test resolves, no sleeps:

- two acts presenting the same expectedRev cannot both commit: the second waits, is re-checked, and is conflict with nothing applied (also: observe does not wait; the ledger records `ok 0→1` then `conflict 1→1`)
- a completion cannot land out of order: the second handler starts only after the first settled
- a human change between claim and execution refuses the queued act (app mode, `setRev`)
- a human bump in surface mode between claim and execution is conflict too
- a freeze while an act waits refuses it as unavailable with the freeze's reason; its handler never runs; after the thaw an act at the unchanged revision is accepted
- an act refused at the claim does not wait behind an act in flight
- [S-ACT-10]: closes the claims taken before it at that revision, and accepts an act claimed after it; a predecessor that reports `changed: []` lets the queued act run
- [S-REV-6]: a reported rev lower than the revision at completion is not adopted; the ledger records `ignoredRev`
- [S-ACT-11]: the handler receives the context; a reported conflict is conflict with `currentRev`, a refusal in the ledger, nothing adopted; a thrown `SurfaceConflict` is the same refusal for a field setter and a collection
- two instances of the planning shape: both tabs pass their own gates at rev 5; the fake store's conditional write lets one commit and the other is conflict, with nothing applied and the losing tab's revision unchanged
- through AXE: two concurrent `axe.handle(new Request(...))` invocations with the same envelope `expectedRev`: one `ok`, one `conflict` (with `rev` 1 on the envelope); the handler runs once and sees the envelope's `expectedRev`

Proved with `git stash push -- packages/surface/src`: 11 of 13 fail on the original code. The two that pass are no-regression checks (a `changed: []` predecessor lets the next act run; a refusal at the claim does not wait). All 89 existing surface tests pass unchanged, including the freeze-during-save test, which depends on an idle surface starting its handler within the call.

## Limitations

- The queue orders acts on one surface in one JavaScript realm. Two instances of the application, or a surface and a direct write to the backend, are ordered only by the handler's conditional write. The surface cannot make a handler do one. A handler that ignores `context.expectedRev` has the old behavior across instances.
- A handler that never settles holds back every later act on that surface (reads still answer). There is no timeout. A handler that awaits `act` on its own surface deadlocks, and the spec forbids it.
- [S-ACT-10] is conservative. In app mode, a handler that reports nothing closes the claims queued behind it, even when its write was unrelated. Reporting `changed: []` or `rev` avoids that.
- A `SurfaceConflict` or `{ conflict }` must mean nothing was written. The surface trusts the handler on that ([S-RULE-1]).
- A continuation or resume through the bridge re-acts at the revision current when `/axe/continue` or `/axe/resume` runs. If another act commits before its turn, it is now `conflict` rather than running on the newer state.
- `ignoredRev` compares surface revisions as integers. The protocol's revision stays opaque to agents.

## Status

Done on `review/surface-preconditions`. Verified with `pnpm gen:vocabulary -- --check`, `pnpm -r build`, `pnpm check:snippets`, `pnpm lint`, `pnpm -r typecheck`, `pnpm -r test`, `node scripts/ci-conformance.mjs`, and `pnpm docs:api`.
