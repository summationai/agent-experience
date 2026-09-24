# AXE Surface

**Version:** `axe/0.1`, Surface contract v0.2. Normative for `@axe/surface`; companion to [`AXE-PROTOCOL.md`](./AXE-PROTOCOL.md). Names are in [`VOCABULARY.md`](./VOCABULARY.md) under the Surface tables.

AXE as specified in `AXE-PROTOCOL.md` is outside-in: a site declares actions for the world's agents, with discovery, requirements, handoff, and resume. Surface is inside-out: a running application publishes its **live** state, with reasons and one revision, and an agent acts through the application's own controls. The two meet at a seam defined in §6: a surface is served as three AXE actions, and its refusals map onto the escalation ladder.

Surface came out of two trials on business applications with opposite shapes (state in the browser; state on the server with a protected mutation protocol). Its rules are the ones those trials needed and no more.

## 1. Terms

- **Surface**: an application's registry of its own controls, plus a revision.
- **Entry**: one registered control. Kinds: `action` (a button, a switch), `field` (an input, a cell), `collection` (a list or grid that can load more).
- **Revision** (`rev`): one integer for the whole application, moved by every change an agent could observe, whoever made it.
- **Observation**: an indexed snapshot of the entries at a revision, with domain objects.
- **Act**: running one entry's own handler, guarded by the revision the agent observed.
- **Actor**: who acted: `agent`, `user`, or an identity the application supplies.
- **Ledger**: the surface's record of every act and every refusal, in order, with the actor and the revisions each spanned.

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

**[S-OBS-1]** `observe()` returns `{ protocol, app, rev, at, entries, objects, ledgerSeq }`. Each entry row carries `index`, `id`, `kind`, `role`, `name`, `object`, `rev`, and its kind's members. `index` is a 1-based position among rows that can be acted on now, and `null` otherwise. `ledgerSeq` is the latest ledger sequence number (§5.1).

**[S-OBS-2]** Unavailable actions, read-only fields, and collections that cannot load more remain in `entries` with their reasons. Agents learn why not before attempting.

**[S-ACT-1]** `act({ op, target, text?, expectedRev, actor?, confirm? })` returns an AXE result envelope. On success it returns `ok` with `{ rev, id, actor, changed, seq }`, where `changed` lists the entry ids whose state the act moved and `seq` is the ledger entry the act wrote (§5.1).

**[S-ACT-2]** When `expectedRev` differs from the current revision, `act` MUST return `error` with `code: "conflict"`, `retryable: true`, and `details: { rev, expectedRev, seq }`, and MUST apply nothing.

**[S-ACT-3]** A missing `expectedRev`, an unknown `op`, an `op` that does not fit the entry's kind, a `confirm` that is required and absent, text longer than `maxLength`, or text that fails the field's schema is `invalid_input` with `details.issues`. An unknown `target` is `not_found`.

**[S-ACT-4]** An unavailable action or a read-only field is `error` with `code: "unavailable"` and `details.reason`; when the entry declares `requires` or `handoff`, those are included in `details`.

**[S-ACT-5]** `target` is an entry id or an index from an observation at the same revision. Ids are stable and SHOULD be preferred.

**[S-REV-1]** Applications whose state lives in the browser call `bump()` after every change an agent could observe, whoever made it; applications with a server revision adopt it with `setRev()`. In the second case the surface's stale check is the first of two: the server refuses a stale expected revision again.

**[S-REV-2]** A retried act with the same `expectedRev` after a successful act MUST be refused (the revision moved), so a lost response cannot double-apply.

**[S-REV-3]** An act by one participant is visible to every other participant as a revision move; a human's change between an agent's observe and act is caught by [S-ACT-2].

**[S-REV-4]** Every act and every refusal is recorded in the surface's ledger (§5.1), so every change names who made it and at which revision, and every attempt that changed nothing says so.

### 5.1 The ledger

The first Surface left the record of who acted to the application, and its own critique was that the person never sees the agent's work: no ledger, no attribution, no replay. The surface is the one place every act passes through with the actor and both revisions in hand, so it keeps the record.

**[S-LED-1]** A surface MUST keep a ledger. Every call to `act` MUST append exactly one entry, whether the handler ran, the handler threw, or the act was refused. An entry is `{ seq, at, op, target, actor, revBefore, revAfter, status, text?, changed }`: `at` is when it was written; `op` is the op as requested; `target` is the entry id the act resolved to, or the target as requested when it did not resolve; `text` is present when the request carried it.

**[S-LED-2]** `seq` starts at 1 and increases by one per entry; a `seq` is never reused, including after entries are dropped ([S-LED-6]). `ledger()` returns entries oldest first. `ledger({ since })` returns the entries whose `seq` is greater than `since`, so an agent that observed `ledgerSeq` can ask what happened after it looked. `actor` filters to one actor. `limit` caps the count: the oldest `limit` entries after `since` when `since` is given, so a reader can page forward, otherwise the newest `limit`.

**[S-LED-3]** `actor` is the actor the request carried (default `agent`; through AXE, [S-AXE-3]), recorded for refusals as much as for acts that ran, and it is the same value the handler received. The surface MUST NOT substitute its own idea of who acted.

**[S-LED-4]** A refusal MUST be recorded as a refusal: `status` is the error code the act returned (`conflict`, `not_found`, `invalid_input`, `unavailable`), `changed` is empty, and `revAfter` equals `revBefore`. A handler that threw is recorded with `status: "internal"` before the error propagates. A ledger MUST NOT present a refusal as a change, and MUST NOT omit it: an agent that was refused at rev 9 after observing rev 7 did nothing, and the record has to say so rather than leave a gap.

**[S-LED-5]** `revBefore` is the revision when the act arrived and `revAfter` the revision when the entry was written, after the handler ran; `changed` is as in [S-ACT-1]. `status` is `ok` only when the handler ran and returned. Every act result carries the `seq` of its entry: `output.seq` for `ok`, `error.details.seq` for a refusal.

**[S-LED-6]** Retention MAY be bounded, and is by default: the surface keeps the most recent 1000 entries (`createSurface({ ledger: { max } })`). Dropping old entries MUST NOT renumber the rest, and `ledgerSeq` still reports the latest `seq`. The ledger is the application's live record, in memory; a durable audit trail is fed from the action events on the bridge ([S-AXE-4]) or by the application.

**[S-LED-7]** The ledger records acts made through the surface. A change made through the application's own controls appears as a revision move ([S-REV-3]), not as an entry, unless the application routes it through `act`.

## 6. The seam: a surface as AXE actions

**[S-AXE-1]** `surfaceActions(surface)` derives three AXE actions: `<ns>.observe` (read-only, `risk: none`, with `display` over `entries` and a dynamic affordance per actionable row bound to `<ns>.act` with `target`, `op`, and `expectedRev`), `<ns>.act` (mutating, revision-guarded), and `<ns>.ledger` (read-only, `risk: none`, input `{ since?, limit? }`, output `{ ledgerSeq, entries }` with `display` over the entries).

**[S-AXE-2]** Refusals map onto the ladder: an unavailable action with `requires` becomes `needs_input` with those `accepts` (and the declared `handoff` as `fallback` when present); one with only a `handoff` becomes `needs_human`; a stale revision is `error` `conflict`; other refusals stay `error` with their reason. On `/axe/continue`, the application's `fulfill` runs and the act is retried at the current revision; on `/axe/resume`, the act is retried at the current revision.

**[S-AXE-3]** The `actor` recorded for an act that arrives through AXE is the authenticated `onBehalfOf` when there is one, else `agent`.

**[S-AXE-4]** For every act that goes through `<ns>.act`, `/axe/continue`, or `/axe/resume`, run or refused, the bridge MUST emit one action event (`EVENTS.md`, "Action events") named `surface.act`, with `status` and `errorCode` as the surface returned them, `actor` as recorded in the ledger, and `details: { seq, op, target, revBefore, revAfter, changed }`. Action events reach the server's `onActionEvent` sinks, not its analytics sinks, because they name the actor.

## 7. Browser agents

**[S-DOM-1]** Applications SHOULD mirror entry names to the DOM as accessible names (`aria-label`) and mark controls with `data-surface-id`, so browser-driving agents and screen readers read the same outcome-stating names. Two of three gains in the first trial came from the names alone.

**[S-DOM-2]** `expose(window)` publishes `observe`, `act`, `ledger`, and `rev` at `window.__surface` for agents that drive the page.
