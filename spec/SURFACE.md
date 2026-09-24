# AXE Surface

**Version:** `axe/0.1`, Surface contract v0.3. Normative for `@axe/surface`; companion to [`AXE-PROTOCOL.md`](./AXE-PROTOCOL.md). Names are in [`VOCABULARY.md`](./VOCABULARY.md) under the Surface tables.

Changes: v0.3 serves every entry as its own AXE action ([S-AXE-1], [S-AXE-6] to [S-AXE-9]) and removes the generic `<ns>.act` of v0.2, which was never released. v0.2 added the ledger, the DOM mirror, freezes, and the ladder mapping.

AXE as specified in `AXE-PROTOCOL.md` is outside-in: a site declares actions for the world's agents, with discovery, requirements, handoff, and resume. Surface is inside-out: a running application publishes its **live** state, with reasons and one revision, and an agent acts through the application's own controls. The two meet at a seam defined in §6: every control on the surface is served as its own AXE action, with the control's availability as the action's, and its refusals map onto the escalation ladder.

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

**[S-OBS-3]** Three reads serve consumers that derive something per entry without taking a whole observation. `entries()` returns the registered entries in registration order. `registryVersion()` is a counter that moves on every `register`, `unregister`, `reconcile`, and `reset`, and on nothing else: a `bump` alone leaves it, so a consumer can tell "the table changed shape" from "the revision moved". `availability(id)` returns one entry's live availability as `observe()` would report it: an action's `state` with `requires` as `accepts` entries, a field's read-only `reason`, `cannot load more` for a collection without `more`, and the freeze's reason for every kind while frozen ([S-FRZ-1]); undefined for an unknown id.

**[S-ACT-1]** `act({ op, target, text?, expectedRev, actor?, confirm? })` returns an AXE result envelope. On success it returns `ok` with `{ rev, id, actor, changed, seq }`, where `changed` lists the entry ids whose state the act moved and `seq` is the ledger entry the act wrote (§5.1).

**[S-ACT-2]** When `expectedRev` differs from the current revision, `act` MUST return `error` with `code: "conflict"`, `retryable: true`, and `details: { expectedRev, currentRev, seq }` (the protocol's stale shape, [P-LIVE-3], plus the ledger `seq` of the refusal), and MUST apply nothing.

**[S-ACT-3]** A missing `expectedRev`, an unknown `op`, an `op` that does not fit the entry's kind, a `confirm` that is required and absent, text longer than `maxLength`, or text that fails the field's schema is `invalid_input` with `details.issues`. An unknown `target` is `not_found`.

**[S-ACT-4]** An unavailable action or a read-only field is `error` with `code: "unavailable"` and `details.reason`; when the entry declares `requires` or `handoff`, those are included in `details`.

**[S-ACT-5]** `target` is an entry id or an index from an observation at the same revision. Ids are stable and SHOULD be preferred.

**[S-ACT-6]** `target` MUST be a non-empty string (an id) or a non-negative integer (an index). Any other value, including a missing or `null` target, an empty string, a negative or fractional number, `NaN`, a boolean, or an object, is `invalid_input` with an issue at `/target`, and no handler runs.

**[S-ACT-7]** An index MUST resolve only to the entry whose `index` in the observation at `expectedRev` is that number. An entry whose `index` is `null` MUST NOT be reachable by number, whatever position it holds in the table; a number that no entry carries is `not_found`. The revision guard of [S-ACT-2] MUST run before the target is resolved, so an index observed at an older revision is `conflict` and can never land on the row that slid into its slot.

**[S-ACT-8]** A string `target` that names a registered entry which cannot be acted on (an unavailable action, a read-only field, a collection that cannot load more) is `unavailable` with `details.reason` per [S-ACT-4], not `not_found`. `not_found` is reserved for a target no entry carries.

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

**[S-LED-6]** Retention MAY be bounded, and is by default: the surface keeps the most recent 1000 entries (`createSurface({ ledger: { max } })`). Dropping old entries MUST NOT renumber the rest, and `ledgerSeq` still reports the latest `seq`. The ledger is the application's live record, in memory; a durable audit trail is fed from the action events on the bridge ([S-AXE-5]) or by the application.

**[S-LED-7]** The ledger records acts made through the surface. A change made through the application's own controls appears as a revision move ([S-REV-3]), not as an entry, unless the application routes it through `act`.

**[S-REV-5]** The application MUST re-register (or `reconcile`) whenever anything that feeds an entry's `state`, `value`, or `edit` changes, including transient states: a save in flight, data loading, a modal open. An observation MUST reflect the application's state as of its `rev`. A surface that reports a control available while the application has disabled it is a defect; §5.1 is the shortest way to avoid it for a state that spans the surface.

### 5.2 Transient states

**[S-FRZ-1]** `freeze(reason)` marks the whole surface unavailable for a transient state and returns `thaw`. While frozen, every action reports `{ available: false, reason }` with the freeze's reason in place of its own state (and no `requires` or `handoff`), every field is read-only with that `reason`, no collection can load more, and no entry carries an `index`. Field values remain visible.

**[S-FRZ-2]** `freeze` moves the revision, and so does `thaw`. `observe()` carries a top-level `frozen: { reason }` while frozen and omits it otherwise.

**[S-FRZ-3]** An act during a freeze is `error` with `code: "unavailable"`, `retryable: true`, and `details.reason` (also `details.frozen`), whatever the entry's own state, and no handler runs. A numeric target during a freeze is `not_found`, since no row carries an index; an act planned before the freeze is `conflict` under [S-ACT-2].

**[S-FRZ-4]** Freezes nest and are counted: the newest reason is the one reported, the surface thaws when the last freeze is released, and releasing the same freeze twice does nothing.

## 6. The seam: every control as an AXE action

The reviewer who designed Surface put it in one line: each available Surface entry can be published as an AXE action, so discovery, MCP, kinds, and the audit come for free. An agent reading the manifest or an MCP tool list sees "Draft Jahmyr Gibbs (RB)" and "Lock March", each with its own availability and reason, not one `act` tool with a `target` parameter. The first cut of this seam had that generic action; it is gone.

**[S-AXE-1]** `surfaceActions(surface, { namespace })` returns an action provider (the SDK's `ActionProvider`, registered with `addProvider`) whose set is, in order: `<ns>.observe` (read-only, `risk: none`, `display` over `entries`, and a dynamic affordance per actionable row that names the row's own action with `input: {}` and the observation's `rev` as the affordance's `expectedRev`), `<ns>.ledger` (read-only, `risk: none`, input `{ since?, limit? }`, output `{ ledgerSeq, entries }` with `display` over the entries), and one action per registered entry ([S-AXE-6]), in registration order. Contract v0.2's generic `<ns>.act` is removed; its `target`, `op`, and `input.expectedRev` have no successor, since each action names its entry and op and the revision travels on the envelope ([S-AXE-4]).

**[S-AXE-2]** Refusals map onto the ladder: an unavailable action with `requires` becomes `needs_input` with those `accepts` (and the declared `handoff` as `fallback` when present); one with only a `handoff` becomes `needs_human`; a stale revision is `error` `conflict`; other refusals stay `error` with their reason. A refusal during a freeze ([S-FRZ-3]) is `error` `unavailable` with the freeze's reason and never climbs the ladder, since there is nothing to fulfill or hand off until the freeze lifts. On `/axe/continue`, the application's `fulfill` runs and the act is retried at the current revision; on `/axe/resume`, the act is retried at the current revision. The `state` a continuation or resume carries is the act request, with the entry id as `target`, so a later act lands on the same control whatever the action set has become.

**[S-AXE-3]** The `actor` recorded for an act that arrives through AXE is the authenticated `onBehalfOf` when there is one, else `agent`.

**[S-AXE-4]** Served through AXE, the surface's revision is the site's revision (protocol §21): the server is created with `revision: surface.currentRev`, so every envelope carries `rev`, the protocol's stale check ([P-LIVE-3]) runs before the handler, and `/axe/state` reports the revision. The revision the agent observed travels as the request envelope's `expectedRev` and nowhere else; an entry's action takes none in its `input`. A request without `expectedRev` reaches the surface, which refuses it as `invalid_input` under [S-ACT-3]: every act presents the revision the agent saw.

**[S-AXE-5]** For every act that goes through an entry's action, `/axe/continue`, or `/axe/resume`, run or refused, the bridge MUST emit one action event (`EVENTS.md`, "Action events") named `surface.act`, with `action` the entry's action name, `status` and `errorCode` as the surface returned them, `actor` as recorded in the ledger, and `details: { seq, op, target, revBefore, revAfter, changed }`. Action events reach the server's `onActionEvent` sinks, not its analytics sinks, because they name the actor.

**[S-AXE-6] The action for an entry.** Its `title` is the entry `name` ([S-ENT-1]: the outcome, in the application's words). Its `description` is composed from the kind, the name, the `object`, and the effect, and stays within [P-ACT-7]'s bounds whatever the name's length; it does not carry the availability, which is live ([S-AXE-8]). `readOnly` is false for every kind: an action runs a handler, a field runs a setter, and a collection load changes the view. For an `action` entry, `idempotent`, `reversible`, and `risk` are the `effect`'s ([S-EFF-1]); `input` requires `confirm` (a literal `true`) when the effect declares `confirm`, and takes an optional `text` described by the effect's `text` prompt when it declares one. For a `field` entry, `idempotent` is true (setting the same text twice sets it once), `reversible` and `risk` are the bridge's field options (defaults false and `medium`), and `input` is `{ text }`, required, bounded by `maxLength` or validated by the field's own schema when it has one; a read-only field keeps the same shape and is unavailable ([S-AXE-8]). For a `collection` entry, `idempotent` and `reversible` are false, `risk` is `low`, and `input` is empty. Every entry action's `output` is the act output of [S-ACT-1]: `{ rev, id, actor, changed, seq }`. An action entry that declares a `handoff` at registration declares `humanHandoff: { reasons: [handoff.reason] }`. The op the action performs is fixed by the entry: `TOGGLE` for a `switch`, `CLICK` for any other action role, `TYPE_TEXT` for a field, `SCROLL_DOWN` for a collection.

**[S-AXE-7] Names.** An entry's action is `<ns>.<slug>`. The plain slug of an id is the id lowercased, with every run of characters outside `a-z0-9` replaced by one hyphen, leading and trailing hyphens dropped, and `e-` prefixed when the result is empty or starts with a digit, so `pick:me:Gibbs` is `pick-me-gibbs`, `cell:2026-03` is `cell-2026-03`, and `2026-03` is `e-2026-03`. When the plain slug is `observe`, `ledger`, or `act`, or is already held by a different id, the slug is the plain slug, a hyphen, and a short hash of the exact id (FNV-1a, base 36), with a counter appended in the vanishing case of a second collision. The bridge keeps the map in both directions for its lifetime: `actionNameFor(entryId)` always returns the same name for the same id, an id that leaves and returns keeps its name, and `entryIdFor(actionName)` returns the exact id an action was issued for, or undefined for a name the bridge never issued. `entrySlug(id)` exposes the plain slug alone. Every name produced fits [P-ACT-1]'s pattern.

**[S-AXE-8] Availability.** Every entry action declares an `availability` hook ([P-LIVE-5]) that returns `surface.availability(id)` ([S-OBS-3]): an action's `state` with its `reason`, `requires`, and `handoff`; `{ available: false, reason }` for a read-only field and for a collection that cannot load more; and, while the surface is frozen, `{ available: false, reason }` with the freeze's reason for every entry ([S-FRZ-1]). The manifest carries it as rendered and `/axe/state` serves it live, so an agent sees per control what it can do right now and why not the rest without calling `<ns>.observe`. The hook reads one entry; it MUST NOT take a whole observation, so `/axe/state` over hundreds of rows costs hundreds of lookups, not hundreds of tables.

**[S-AXE-9] Churn and scale.** The action set follows the registry: an entry registered or unregistered is in or out of the manifest, `/axe/state`, and the derived MCP tool list on the next request, without re-registering anything with the server. The set is rebuilt only when `registryVersion()` moved; a `bump` alone reuses the previous set, and within a rebuild an entry object already published keeps its action. Name lookup on invocation is by map, not by scan, so a surface with hundreds of rows invokes in constant time. An entry whose text fails the honesty lint ([P-HON-1]) at build time is not published as an action: the bridge reports it through its `onError` option (default: one warning per entry) and the entry keeps its row in `<ns>.observe`, without an affordance. A retried `idempotencyKey` for an action whose entry has since left the registry (a pick that leaves the board when drafted) is answered from the idempotency store by the server before the name is declared unknown ([P-IDEM-2]), so a lost response is still recoverable.

## 7. Browser agents

Browser-driving agents and screen readers read a control's accessible name, not its registration. Surface mirrors each entry onto the element that receives its interaction, so the page, `observe()`, and the screen reader all read the same outcome-stating name. Two of three gains in the first trial came from the names alone.

**[S-DOM-1] The DOM mirror.** The rules below hold for every entry that has a control on screen.

1. An entry's `name` states the outcome in the application's own words ("Draft Jahmyr Gibbs (RB)", "Lock March", "Load more players"). It MUST NOT name the widget ("button", "Draft button"), repeat the `role`, or carry the state ("disabled", "already drafted"): the role is `role`, the state is `state`. The same string is the control's accessible name and the `name` in `observe()`.
2. The element that receives the entry's interaction (the button, the input, the scrolling container) carries these attributes, and no other element in the document carries its `data-surface-id`:

   | Attribute             | Value                                    | When                                     |
   | --------------------- | ---------------------------------------- | ---------------------------------------- |
   | `aria-label`          | the entry `name`                         | always                                   |
   | `data-surface-id`     | the entry `id`                           | always; exactly one element per entry    |
   | `data-surface-kind`   | `action`, `field`, or `collection`       | always                                   |
   | `data-surface-object` | the entry `object`                       | when the entry has one                   |
   | `aria-disabled`       | `true`                                   | an action whose `state` is not available |
   | `aria-readonly`       | `true`                                   | a read-only field                        |
   | `data-surface-reason` | the `reason`, in the application's words | with `aria-disabled` or `aria-readonly`  |

   Collections carry the common set only.

3. `surfaceAttributes(entry)` returns that set as strings from a registered entry or an observed row; `useSurfaceProps(entry, deps)` (`@axe/surface/react`) registers the entry like `useSurface` and returns the set as props, with `aria-disabled` and `aria-readonly` as booleans. An application that uses either MUST render every attribute returned on that element and MUST NOT replace `aria-label` or `data-surface-id` with other values. An application that renders by hand SHOULD carry the same set.
4. The mirror reports; it does not disable [S-RULE-1]. The helper sets `aria-disabled`, never `disabled`, so the application keeps its own disabling logic, and an `aria-disabled` control stays focusable, so a screen reader reaches the reason beside it.

**[S-DOM-2]** `expose(window)` publishes `observe`, `act`, `ledger`, and `rev` at `window.__surface` for agents that drive the page.

**[S-DOM-3] The selector contract.** `surfaceSelector(id)` returns `[data-surface-id="<id>"]` with the id as a double-quoted CSS string: backslashes and double quotes are escaped with a backslash, a newline becomes `\a `, and everything else (colons, spaces, dots, brackets) is left as it is. On a page that follows [S-DOM-1], `document.querySelector(surfaceSelector(row.id))` MUST return the control for `row.id` from any observation, whatever the id contains. Ids are stable [S-ACT-5], so a selector computed from one observation still finds the control after the revision moves; a stale selector is never an error, a stale act is [S-ACT-2].

**[S-DOM-4] One-line description.** `describeEntry(entry)` returns one line of plain text: the `name`, a colon, then the entry's availability in the application's words (`available`, or `unavailable, <reason>`; for a field `editable` or `read only, <reason>`, followed by its value and length; for a collection what is loaded and whether it can load more), and for an action a semicolon and its effect (`mutates <state>`, `idempotent` when set, `reversible` or `not reversible`, `risk <level>`, `confirm required` when set): "Draft Jahmyr Gibbs (RB): unavailable, already drafted by another team; mutates draft, reversible, risk medium". It is agent-read text [S-AV-4]. Applications MAY render it as `aria-description` on the control or log it beside each act; the helper does not render it by default.

## Provenance

[S-ACT-6] to [S-ACT-8], [S-REV-5], and the rules of §5.2 came from two defects found on a real planning application in the first staging trial, both in the seam between Surface and the application: an act whose `target` was `null` matched a row that was not actionable, and the table kept reporting cells editable while the application had frozen editing during a save, so an act ran into the frozen UI. Both were fixed in the application and became rules of the contract here, so the next application does not find them again.
