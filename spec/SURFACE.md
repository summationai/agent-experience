# AXE Surface

**Version:** `axe/0.1`, Surface contract v0.2. Normative for `@axe/surface`; companion to [`AXE-PROTOCOL.md`](./AXE-PROTOCOL.md). Names are in [`VOCABULARY.md`](./VOCABULARY.md) under the Surface tables.

AXE as specified in `AXE-PROTOCOL.md` is outside-in: a site declares actions for the world's agents, with discovery, requirements, handoff, and resume. Surface is inside-out: a running application publishes its **live** state, with reasons and one revision, and an agent acts through the application's own controls. The two meet at a seam defined in §6: a surface is served as two AXE actions, and its refusals map onto the escalation ladder.

Surface came out of two trials on business applications with opposite shapes (state in the browser; state on the server with a protected mutation protocol). Its rules are the ones those trials needed and no more.

## 1. Terms

- **Surface**: an application's registry of its own controls, plus a revision.
- **Entry**: one registered control. Kinds: `action` (a button, a switch), `field` (an input, a cell), `collection` (a list or grid that can load more).
- **Revision** (`rev`): one integer for the whole application, moved by every change an agent could observe, whoever made it.
- **Observation**: an indexed snapshot of the entries at a revision, with domain objects.
- **Act**: running one entry's own handler, guarded by the revision the agent observed.
- **Actor**: who acted: `agent`, `user`, or an identity the application supplies.

## 2. The three rules

**[S-RULE-1] Surface reports; it never decides.** An entry's availability and reason are whatever the application computed to enable or disable its own control. The surface performs no authorization, validation, or business logic of its own beyond the checks in §5.

**[S-RULE-2] Same door.** An act runs the control's own handler, the one a click or keystroke runs, so authorization, validation, and persistence stay where they are. The surface introduces no second path to state.

**[S-RULE-3] One revision.** Every observation and every entry carries the application's revision; every act presents the revision the agent observed; an act whose revision has moved applies nothing.

## 3. Entries

**[S-ENT-1]** Every entry has a stable `id`, a `kind`, a `role`, a `name` that states the outcome in the application's own words ("Draft Jahmyr Gibbs (RB)", "Lock March"), and optionally the `object` it belongs to.

**[S-ENT-2]** An `action` entry has `state` (§4), `effect` (§3.1), and a handler `(actor, text?)`.

**[S-ENT-3]** A `field` entry has a `value` and an `edit` descriptor: read-only with a `reason`, or editable with an optional `maxLength`, an optional JSON Schema for the text, and a setter `(text, actor)`.

**[S-ENT-4]** A `collection` entry has `total`, `loaded`, `filter`, and `sort`, and is actionable only when it can load more.

**[S-ENT-5]** Entries are kept in registration order. Replacing an entry by id keeps its position, so an index observed for one row does not move because a sibling refreshed. Unregistering removes the row; `reconcile(prefix, keep)` removes every row under a prefix that a re-scan did not keep.

### 3.1 Effect

**[S-EFF-1]** `effect` carries AXE's risk metadata: `mutates` (the name of the state the action changes), `idempotent`, `reversible`, and `risk` (`none` is never valid for an action; the default is `medium`). `undoable` is a deprecated alias of `reversible`. `confirm: true` means the act must carry `confirm: true`. `text` is the prompt for free text the handler accepts.

**[S-EFF-2]** Effect metadata MUST be truthful (protocol [P-HON-7]). An action that changes state MUST NOT be presented as read-only; the surface has no read-only action kind for that reason.

## 4. Availability

**[S-AV-1]** An action's `state` is `{ available: true }` or `{ available: false, reason }`. `reason` is plain language in the application's words, present whenever `available` is false.

**[S-AV-2]** An unavailable action MAY declare `requires`: an ordered list of `accepts`-shaped entries (protocol §8, kinds from `KINDS.md`) that would make it available, with a `fulfill(kind, payload, actor)` the application runs when an agent supplies one.

**[S-AV-3]** An unavailable action MAY declare a `handoff` (`reason`, `instructions`, `url`, `whatAgentShouldSayToUser`; protocol §9.1 without the token fields) for a step only a human can take.

**[S-AV-4]** Availability text (`name`, `reason`, `instructions`, `whatAgentShouldSayToUser`) is agent-read text and is subject to protocol §18.

## 5. Observe and act

**[S-OBS-1]** `observe()` returns `{ protocol, app, rev, at, entries, objects }`. Each entry row carries `index`, `id`, `kind`, `role`, `name`, `object`, `rev`, and its kind's members. `index` is a 1-based position among rows that can be acted on now, and `null` otherwise.

**[S-OBS-2]** Unavailable actions, read-only fields, and collections that cannot load more remain in `entries` with their reasons. Agents learn why not before attempting.

**[S-ACT-1]** `act({ op, target, text?, expectedRev, actor?, confirm? })` returns an AXE result envelope. On success it returns `ok` with `{ rev, id, actor, changed }`, where `changed` lists the entry ids whose state the act moved.

**[S-ACT-2]** When `expectedRev` differs from the current revision, `act` MUST return `error` with `code: "conflict"`, `retryable: true`, and `details: { rev, expectedRev }`, and MUST apply nothing.

**[S-ACT-3]** A missing `expectedRev`, an unknown `op`, an `op` that does not fit the entry's kind, a `confirm` that is required and absent, text longer than `maxLength`, or text that fails the field's schema is `invalid_input` with `details.issues`. An unknown `target` is `not_found`.

**[S-ACT-4]** An unavailable action or a read-only field is `error` with `code: "unavailable"` and `details.reason`; when the entry declares `requires` or `handoff`, those are included in `details`.

**[S-ACT-5]** `target` is an entry id or an index from an observation at the same revision. Ids are stable and SHOULD be preferred.

**[S-ACT-6]** `target` MUST be a non-empty string (an id) or a non-negative integer (an index). Any other value, including a missing or `null` target, an empty string, a negative or fractional number, `NaN`, a boolean, or an object, is `invalid_input` with an issue at `/target`, and no handler runs.

**[S-ACT-7]** An index MUST resolve only to the entry whose `index` in the observation at `expectedRev` is that number. An entry whose `index` is `null` MUST NOT be reachable by number, whatever position it holds in the table; a number that no entry carries is `not_found`. The revision guard of [S-ACT-2] MUST run before the target is resolved, so an index observed at an older revision is `conflict` and can never land on the row that slid into its slot.

**[S-ACT-8]** A string `target` that names a registered entry which cannot be acted on (an unavailable action, a read-only field, a collection that cannot load more) is `unavailable` with `details.reason` per [S-ACT-4], not `not_found`. `not_found` is reserved for a target no entry carries.

**[S-REV-1]** Applications whose state lives in the browser call `bump()` after every change an agent could observe, whoever made it; applications with a server revision adopt it with `setRev()`. In the second case the surface's stale check is the first of two: the server refuses a stale expected revision again.

**[S-REV-2]** A retried act with the same `expectedRev` after a successful act MUST be refused (the revision moved), so a lost response cannot double-apply.

**[S-REV-3]** An act by one participant is visible to every other participant as a revision move; a human's change between an agent's observe and act is caught by [S-ACT-2].

**[S-REV-4]** The application SHOULD record `actor` and `rev` on the state an act produced (a ledger), so every change names who made it and at which revision.

**[S-REV-5]** The application MUST re-register (or `reconcile`) whenever anything that feeds an entry's `state`, `value`, or `edit` changes, including transient states: a save in flight, data loading, a modal open. An observation MUST reflect the application's state as of its `rev`. A surface that reports a control available while the application has disabled it is a defect; §5.1 is the shortest way to avoid it for a state that spans the surface.

### 5.1 Transient states

**[S-FRZ-1]** `freeze(reason)` marks the whole surface unavailable for a transient state and returns `thaw`. While frozen, every action reports `{ available: false, reason }` with the freeze's reason in place of its own state (and no `requires` or `handoff`), every field is read-only with that `reason`, no collection can load more, and no entry carries an `index`. Field values remain visible.

**[S-FRZ-2]** `freeze` moves the revision, and so does `thaw`. `observe()` carries a top-level `frozen: { reason }` while frozen and omits it otherwise.

**[S-FRZ-3]** An act during a freeze is `error` with `code: "unavailable"`, `retryable: true`, and `details.reason` (also `details.frozen`), whatever the entry's own state, and no handler runs. A numeric target during a freeze is `not_found`, since no row carries an index; an act planned before the freeze is `conflict` under [S-ACT-2].

**[S-FRZ-4]** Freezes nest and are counted: the newest reason is the one reported, the surface thaws when the last freeze is released, and releasing the same freeze twice does nothing.

## 6. The seam: a surface as AXE actions

**[S-AXE-1]** `surfaceActions(surface)` derives two AXE actions: `<ns>.observe` (read-only, `risk: none`, with `display` over `entries` and a dynamic affordance per actionable row bound to `<ns>.act` with `target`, `op`, and `expectedRev`) and `<ns>.act` (mutating, revision-guarded).

**[S-AXE-2]** Refusals map onto the ladder: an unavailable action with `requires` becomes `needs_input` with those `accepts` (and the declared `handoff` as `fallback` when present); one with only a `handoff` becomes `needs_human`; a stale revision is `error` `conflict`; other refusals stay `error` with their reason. On `/axe/continue`, the application's `fulfill` runs and the act is retried at the current revision; on `/axe/resume`, the act is retried at the current revision.

**[S-AXE-3]** The `actor` recorded for an act that arrives through AXE is the authenticated `onBehalfOf` when there is one, else `agent`.

## 7. Browser agents

**[S-DOM-1]** Applications SHOULD mirror entry names to the DOM as accessible names (`aria-label`) and mark controls with `data-surface-id`, so browser-driving agents and screen readers read the same outcome-stating names. Two of three gains in the first trial came from the names alone.

**[S-DOM-2]** `expose(window)` publishes `observe`, `act`, and `rev` at `window.__surface` for agents that drive the page.

## Provenance

[S-ACT-6] to [S-ACT-8], [S-REV-5], and the rules of §5.1 came from two defects found on a real planning application in the first staging trial, both in the seam between Surface and the application: an act whose `target` was `null` matched a row that was not actionable, and the table kept reporting cells editable while the application had frozen editing during a save, so an act ran into the frozen UI. Both were fixed in the application and became rules of the contract here, so the next application does not find them again.
