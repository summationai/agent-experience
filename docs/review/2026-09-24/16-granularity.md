# 16. Capability granularity evaluated

Phase 4. Branch `review/granularity`, based on `herz/surface-integration` at `d51c88e` (phases 1 and 2, item 14).

## Finding

The review said Surface generation mandates one tool per widget, that server-side caching of the generated actions does not reduce what the model reads or chooses among, and asked for a comparison with stable parameterized domain actions plus scoped observations and bound affordances, over the same business logic, keeping the per-control mode.

Verified at `d51c88e`:

- `surfaceActions` was the only bridge. It published `<ns>.observe`, `<ns>.ledger`, and one action per entry ([S-AXE-1]); `packages/surface/test/axe.test.ts` pinned a 300-row surface as a 302-action manifest and showed the set is rebuilt only when `registryVersion` moves ([S-AXE-9]). That cache saves the server's work; the manifest, `/axe/state`, and the MCP tool list still carry every action.
- `<ns>.observe` took no input (a strict empty object) and returned every row, so the only way to learn one row's availability or the revision was to read the whole table, or `axe_state`, which has one entry per action.
- The bridge's `onChange` fires whenever `registryVersion` moves, and every `register` moves it, including a re-registration of an existing id that changes nothing a tool shows. An application that re-registers a row on each edit (the documented pattern, [S-REV-5]) therefore sends a `notifications/tools/list_changed` per edit through `@axe/mcp`.
- `DECISIONS.md` ("One AXE action per control, not a generic `act`") accepted the growth with the table and relied on the cache to bound the cost.

## Change

### `domainActions` in `@axe/surface/axe`

`packages/surface/src/axe.ts`. The shared machinery (caller resolution, the act with its `surface.act` event, the ladder, continue and resume, the read side) moved into one internal core used by both public functions; `surfaceActions` behaves as before apart from the observe input below.

`domainActions(source, options)` returns a `DomainBridge` (an `ActionProvider` plus `actionFor(entryId)` and `covered(actionName)`):

- The set is `<ns>.observe`, `<ns>.ledger`, and one action per `DomainActionSpec` (`name`, `title`, `description`, `covers(entry)`, `risk`, and optionally `idempotent`, `reversible`, `auth`, `humanHandoff`, `idleReason`), fixed at creation; `onChange` never fires. Defaults when `domains` is omitted: `set-field` (fields; the bridge's field risk, idempotent), `run-control` (actions; `risk: high`, not reversible, not idempotent), `load-more` (collections; low).
- Coverage: the first spec whose `covers` is true, cached per registered entry object. An entry whose own risk is higher than the spec's, that is not reversible or idempotent when the spec says it is, or whose `name` or effect `text` fails `lintAgentText`, is not covered; `onError` hears about it once and its row stays in `observe` without an affordance.
- Input `{ entryId, text?, confirm? }`. The handler resolves the entry on the caller's surface. An entry covered by another spec (or by none) and a field without `text` are `invalid_input` before the surface and not ledgered; an unknown id goes to `surface.act` and is `not_found` in the ledger. The act is `surface.act` with the entry's own op, the envelope's `expectedRev`, and the bridge's actor. Refusals go through the same ladder code as per-control actions (`needs_input` with `requires`, `needs_human` for a handoff with a `url`, `error` otherwise), and continue and resume re-act on the saved entry id.
- Availability: available while any covered entry is actionable; otherwise the reason all covered entries share (a freeze) or `idleReason`. [S-AUTH-5] is unchanged: nothing is read for an unidentified caller.
- Observe affordances bind `{ entryId }` to the covering action, with the observed `rev` as `expectedRev`.

Three design choices were settled by the measurements rather than taken as given. The set is fixed, because tool churn is the largest per-control cost measured. The entry id is a free string, not an enum of ids, because an enum would bring the churn back. Metadata is a declared ceiling checked per entry, because a maximum derived from the entries would change the tool whenever a riskier row registered.

### Filtered, paged `<ns>.observe`

In both granularities. Input `{ object?, kind?, available?, query?, limit?, cursor? }`; the output adds `total` and `nextCursor`; the action declares `pagination` (`/cursor`, `/nextCursor`, `pageSize`). Defaults: per control 1000 rows (max 1000), so existing callers of surfaces up to 1000 rows get one page as before; per domain action 50 (max 200). The `observe` option (`pageSize`, `maxPageSize`) changes them. Rows keep registration order and their whole-observation `index`. The cursor holds the position after the page, a hash of the filters, and the ids of the last row returned and the row after it: it is refused with other filters or when malformed, and resumes after the last id, else at the next id, else at the position. `surface.observe()` is unchanged.

### Spec, vocabulary, docs

- `spec/SURFACE.md` v0.8: [S-OBS-5]; [S-AXE-1] mentions the filters; the §6 introduction; [S-AXE-10] (parameterized domain actions), [S-AXE-11] (metadata true of every covered entry), [S-AXE-12] (routing and availability), [S-AXE-13] (side by side).
- `spec/VOCABULARY.md` "Surface granularity": `entryId`, `nextCursor`, `domainActions`, `actionFor`, `idleReason`, `maxPageSize`. `packages/core/src/vocabulary.ts` regenerated; the bridge uses `WIRE.field.entryId` and `WIRE.field.nextCursor`.
- `docs/surface.md` "Choosing granularity" (the mapping, the filters, the measured table, when to use which, migration), with `docs/examples/surface/granularity.ts` (regions `domain`, `side-by-side`, `call`); pointers in `docs/live-state.md` and `docs/mcp.md`; three `DECISIONS.md` entries at the end of "Surface"; `CHANGELOG.md`; `.changeset/surface-granularity.md`; the API reference regenerated.
- `scripts/measure-granularity.mjs` (`pnpm measure:granularity`; `--check` fails when the committed report differs), writing `docs/review/2026-09-24/data/granularity.json` and `granularity.md`.

## Tests

`packages/surface/test/granularity.test.ts` (13 tests):

- publishes observe, ledger, and the declared actions; the set does not follow the registry (twenty registrations and an unregistration leave the same array, `onChange` is never called; `actionFor`, `covered`)
- observe binds each actionable row to the action that acts on it, with its entryId and the rev
- the same script through either granularity leaves the same application state, the same ledger, and the same `surface.act` event statuses and details: an edit, a stale edit (refused by the protocol, not ledgered), over-long text (`invalid_input`, ledgered), a lock, an edit on the now read-only field (`unavailable`), a collection load
- per-entry availability climbs the ladder through the parameterized action: requires then continue, a handoff with a url then resume, a handoff without a url (`unavailable` with `details.handoff`), a freeze; `humanHandoff` declared
- routing refusals: an entry another action covers, or a field without text, is `invalid_input` before the surface; an unknown id is `not_found` and ledgered; a missing `expectedRev` is `invalid_input` from the surface; a stale one is `conflict`
- an entry whose metadata exceeds the action's, or whose name fails the lint, is left uncovered and reported once; invalid and reserved spec names throw
- availability: any covered entry actionable, the shared reason, the freeze's reason, `idleReason`
- an unidentified caller's availability reads no protected surface [S-AUTH-5]
- both granularities serve one surface side by side under different namespaces, sharing the revision and the ledger
- a surface served as domain actions passes the conformance suite (no failures; `manifest.examples-validate` warns that domain actions carry no examples)
- observe filters by object, kind, availability, and text; `total`; a filtered row keeps its whole-observation index
- pages: default and cap per granularity, published as `pagination`; the cursor walks every match once; a `limit` over the cap is `invalid_input`
- a cursor survives churn by the id it names (and by the next id when the named row leaves), is refused with other filters, and is refused when forged

Against the bridge at `d51c88e` the file does not load (no `domainActions` export). The existing `axe.test.ts`, including the 300-row test and its conformance run, passes unchanged.

## Measurements

From `docs/review/2026-09-24/data/granularity.md`: scripted and deterministic, not model performance; tokens are bytes / 4, an estimate; KB are 1024 bytes. The application is a demand plan with ten controls per row (six fields, a lock switch, an approval needing consent on unapproved rows, a publish needing a human sign-off with a page, a history that can load more); a quarter of the rows are locked and a fifth unapproved. It is public (`auth: "none"`) so the anonymous manifest carries availability. MCP bytes are the JSON-RPC messages over an in-memory transport.

| Controls | Mode | Manifest | MCP tools | `tools/list` (est. tokens) | Observe, first page | Observe, all pages | Notifications / tools changed over 50 UI changes | Read before first correct act | Five tasks: calls, bytes read, succeeded |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 5 | per control | 12 KB | 12 | 13 KB (~3,200) | 2.1 KB | 2.1 KB | 46 / 129 | 15 KB | not run |
| 5 | domain | 11 KB | 10 | 11 KB (~2,800) | 2.2 KB | 2.2 KB | 0 / 19 | 14 KB | not run |
| 50 | per control | 58 KB | 56 | 72 KB (~18,400) | 18 KB | 18 KB | 46 / 155 | 75 KB | 12, 92 KB, 5 of 5 |
| 50 | domain | 11 KB | 10 | 11 KB (~2,750) | 19 KB | 19 KB | 0 / 0 | 14 KB | 12, 31 KB, 5 of 5 |
| 300 | per control | 308 KB | 297 | 401 KB (~102,600) | 109 KB | 109 KB | 46 / 156 | 404 KB | 12, 442 KB, 5 of 5 |
| 300 | domain | 11 KB | 10 | 11 KB (~2,750) | 19 KB | 113 KB | 0 / 0 | 14 KB | 12, 54 KB, 5 of 5 |
| 1000 | per control | 1014 KB | 974 | 1325 KB (~339,100) | 361 KB | 361 KB | 46 / 151 | 1328 KB | 12, 1393 KB, 5 of 5 |
| 1000 | domain | 11 KB | 10 | 11 KB (~2,750) | 19 KB | 377 KB | 0 / 0 | 14 KB | 12, 82 KB, 5 of 5 |

- Per control, one row (ten controls) registering or unregistering changes 9 or 10 tools and sends one notification; locking a row changes 7 tool descriptions (availability) and sends one. In domain mode both are 0 at 50 controls and above. At 5 controls, domain descriptions change (2 on a row register, 19 over the sequence) because a group went from idle to available; no notification is sent for those, as for any availability-only change.
- Per control, 25 to 28 of the 46 notifications came with no tool change (a re-registration that moved only `registryVersion`). An agent that lists the tools again on every notification reads 1.9 MB, 7 MB, 36 MB, and 120 MB over the 50 changes at 5, 50, 300, and 1000 controls.
- Discovery by a per-control agent that reads the whole table (the only observe before this item): 21 KB, 125 KB, 575 KB, 1839 KB.
- Bytes sent by the scripted agents differ by less than 10% across modes (1.7 KB and 1.9 KB for five tasks); the difference is in what they read.

Two actors on 300 controls, 400 trials per rate, identical in both modes:

| Person's edits per agent act (mean) | Conflict rate | Unrelated share of conflicts | Unrelated conflicts per act | ok within 3 attempts |
| ---: | ---: | ---: | ---: | ---: |
| 0.25 | 22.3% | 83.1% | 18.5% | 99.0% |
| 1 | 63.0% | 79.8% | 50.2% | 74.0% |
| 3 | 94.3% | 61.0% | 57.5% | 14.2% |

Recommendation: keep per control as the behavior of `surfaceActions` and use it for small surfaces (tens of controls), UI parity, and tool lists a person reads; use `domainActions` for large or churning surfaces and constrained contexts; migrate by serving both under different namespaces, then removing the per-control provider. The per-entry revision is written up in `DECISIONS.md` as a proposal (an optional per-entry revision on each observed row, and a per-entry precondition presented in place of the global one) and not implemented: it needs a protocol rule, since the global stale check runs before any handler; the application would have to declare which entries share state; and a filtered re-observe with retries already lands 99% of acts at a quarter of an edit per act.

## Limitations

- Scripted measurements of payloads, not model behavior. Whether a model chooses better among 10 tools and an `observe` page than among 974 named tools is not measured; the scripted agents know the control's name and pick exactly. A model-based evaluation belongs to item 17.
- One application shape, a planning grid. A surface whose controls have very different risks gets less from the default `run-control` (declared `risk: high` for all) and should declare narrower groups; that case was not measured.
- In domain mode per-entry availability is no longer in the manifest or `/axe/state`; the agent reads `observe`. The audit sees each domain action's declared ceiling, not each control's risk.
- A domain action carries no `examples`, since its entries are not known when it is built, so conformance warns on `manifest.examples-validate`.
- A domain action's tool description includes an availability snapshot, which can change without a `list_changed` notification (as per-control availability can when nothing re-registers).
- The per-control notification on a re-registration that changes no tool is measured and left as it was; comparing tool fingerprints in the in-process MCP bridge would remove it at the cost of building the tool list on each change.
- The cursor survives the removal of the last or the next row, not of both plus earlier rows; pages read at different revisions are different observations, not one snapshot.
- `query` is a substring match: "Widget 1" also finds "Widget 10" to "Widget 19", and the five-task numbers include that.
- The two-actor simulation relates conflicts by row; an application with cross-row derived state has more related conflicts than counted.
- `llms.txt` is left to the coordinator.

## Status

done

## Follow-up at merge

The measurement found that 25 to 28 of the 46 per-control `tools/list_changed` notifications over 50 UI changes announced no tool change: a re-render re-registers rows and moves `registryVersion`. The bridge's `onChange` now rebuilds and compares the published definitions and notifies only when they differ. Regenerated measurements: per-control notifications over the 50 changes fell to 18 to 21 with none empty, and re-list bytes at 1000 controls fell from about 120 MB to 50 MB. Test: `packages/surface/test/axe.test.ts` "a re-render that registers every row again, unchanged, sends no notification; a changed name does" (fails without the change). Domain mode is unchanged; its tool descriptions carry an availability snapshot that can change without a notification (listed under Limitations).
