# Surface: live state for agents

The protocol in [Concepts](concepts.md) is outside-in: a site declares actions for the world's agents, with discovery, requirements, and handoff. Surface is the inside-out half: a running application publishes its live controls, with availability and reasons, under one revision, and an agent acts through the application's own handlers. `@axe/surface` implements it and `@axe/surface/axe` serves any surface as an AXE manifest, so the two halves share kinds, risk metadata, the result envelope, and the ladder. The normative text is [`spec/SURFACE.md`](../spec/SURFACE.md).

## Why a second shape

Hand-written actions beside a human UI drift the first time a button changes, and a static manifest cannot say what can be done right now. Surface came out of two trials on business applications: a draft board whose state lives in the browser, and a planning grid whose state lives on a server with a protected mutation protocol. In both, the agent view came out of the same components and handlers the humans use, so drift is impossible rather than detected, the agent knows why a control is unavailable before it tries, and a person and an agent can work on the same application at once because every act carries the revision the agent saw.

Three rules are the whole design:

1. **Surface reports; it never decides.** Availability is whatever the application computed to disable its own control.
2. **Same door.** An act runs the control's own handler, so authorization, validation, and persistence stay where they are.
3. **One revision.** Every observation carries it, every act presents it, and a stale act applies nothing.

## Registering controls

Every control that matters registers one entry: a stable `id`, a `kind` (`action`, `field`, or `collection`), a `role`, a `name` that states the outcome, the `object` it belongs to, its `state`, its `effect`, and the handler the control itself calls.

<!-- include: examples/surface/board.ts#create -->
```ts
import { createSurface } from "@axe/surface";

export const surface = createSurface({ app: "fantasy-draft" });
```
<!-- /include -->

<!-- include: examples/surface/board.ts#register -->
```ts
interface Player {
  id: string;
  player: string;
  pos: string;
}

export function registerRow(
  p: Player,
  ctx: {
    drafting: boolean;
    drafted: Record<string, "me" | "other">;
    seatable: boolean;
    takeMine: (p: Player, actor: string) => void;
  },
) {
  const taken = !!ctx.drafted[p.id];
  const takenBy = ctx.drafted[p.id] === "me" ? "you" : "another team";
  surface.register({
    id: `pick:me:${p.id}`,
    kind: "action",
    role: "button",
    name: `Draft ${p.player} (${p.pos})`,
    object: `player:${p.id}`,
    // Availability mirrors the button's own disabled logic, in the app's own words.
    state: !ctx.drafting
      ? { available: false, reason: "draft not started" }
      : taken
        ? { available: false, reason: `already drafted by ${takenBy}` }
        : !ctx.seatable
          ? { available: false, reason: `no roster slot left for a ${p.pos}` }
          : { available: true },
    effect: { mutates: "draft", idempotent: false, reversible: true, risk: "medium" },
    handler: (actor) => ctx.takeMine(p, actor),
  });
}
```
<!-- /include -->

`effect` is AXE's risk metadata: `mutates` names the state that changes, and `idempotent`, `reversible`, and `risk` mean what they mean on an [action](designing-actions.md#choosing-risk). `confirm` makes the act require explicit confirmation; `text` is the prompt for free text the handler takes ("reason for the lock").

Fields register a `value` and an `edit` descriptor (read-only with a reason, or editable with a `maxLength` and an optional `schema`). The schema is a JSON Schema for the text, or a Zod schema: the surface validates a Zod schema by calling its `safeParse` and never imports Zod itself, so a browser bundle of `@axe/surface` carries none. To publish a Zod schema in `observe()` the surface needs a converter: pass `toJsonSchema` from `@axe/core` as `createSurface({ toJsonSchema })` (or `configure({ toJsonSchema })`); registering a Zod schema without one throws with that instruction. The same converter renders the `requires` schemas below, which `accept()` from `@axe/core/kinds` builds with Zod. A JSON Schema needs nothing. Collections register `total`, `loaded`, `filter`, and `sort`, and are actionable when they can load more.

Each of them also receives the act's context as its last argument (`ActContext`: the entry `id`, the `op`, the `expectedRev` the agent presented, and the `actor`), for a write that has to carry the revision; see [Writing under a precondition](#writing-under-a-precondition). A handler, a field's `set`, or a collection's `more` may return `{ changed, rev }` (or a promise of it): `changed` names the entries the act moved and `rev` is the application's revision after the change. The surface folds both into the act result and the ledger. An application that bumps the revision itself can return nothing: `changed` is then the entry when the revision moved during the handler.

## The revision

The revision has one owner at a time. When state lives in the browser, the surface owns the counter: call `bump` after every change an agent could observe, whoever made it, and `seedRev` from persisted state on load. When the server already has a revision, the application owns it: adopt it with `setRev`, and the surface's stale check is the first of two, the server refusing a stale expected revision again. The surface remembers which it is (`revisionMode()`, `surface` or `app`) from the last of `bump` and `setRev`, or you pin it with `createSurface({ revision: "app" })`. The mode decides what a freeze does to the revision ([Transient states](#transient-states)); everything else is the same in both.

<!-- include: examples/surface/board.ts#revision -->
```ts
// State lives in the browser, so the app owns the counter: bump after every change an agent could
// observe, whoever made it, and expose observe/act for browser agents.
export function afterDraftChange(): void {
  surface.bump({ what: "draft" });
}
surface.expose(typeof window !== "undefined" ? window : null);
```
<!-- /include -->

`expose` publishes `observe`, `act`, `ledger`, and `rev` on the page for browser-driving agents. It is browser-local: anything running in the page can already read what the page shows and call its handlers, so `expose` gives no one access they did not have, and it needs no auth. Serving the same surface over HTTP is different; see [Who can observe and act](#who-can-observe-and-act). The names those agents read on the page come from the same entries; see [Accessible names](#accessible-names). In the first trial, two of three gains came from the names alone.

In a browser with WebMCP, the page can also offer the same controls to the browser's own agent as tools: `exposeWebMcp(surface)` from `@axe/surface/webmcp`, a separate entry that registers nothing where the browser has no WebMCP. See [WebMCP](webmcp.md).

## Observe and act

`observe` returns the live table: every entry with its `index` (a position among the rows that can be acted on now, `null` otherwise), its `state` with a `reason` when unavailable, its `effect`, current `value` for fields, plus `objects` the application chooses to show and the `rev`.

`act` takes `op`, `target` (the entry id, or its index at the same rev), optional `text` and `confirm`, and the `expectedRev` the agent observed. It returns the [result envelope](concepts.md#the-result-envelope): `ok` with `{ rev, id, actor, changed, seq }`, or `error` with `conflict` when the revision moved (nothing applied), `not_found` for an unknown target, `invalid_input` for a wrong op, missing confirm, or text that fails `maxLength` or the field's schema, and `unavailable` with the reason for a control the application has disabled. `changed` is what the handler reported, or the entry itself when the revision moved during the handler; for an application whose revision arrives from the server after the handler it is empty unless the handler reports it, so an agent re-observes rather than reading `changed` as the whole story. A `target` must be a non-empty id or a non-negative integer index; anything else (`null`, a fraction, a boolean) is `invalid_input` before any lookup, an index only ever resolves to the row that carried it at `expectedRev` and never to a row without one, and an id that names a disabled control is `unavailable` with its reason rather than `not_found`.

<!-- include: examples/surface/agent.ts#loop -->
```ts
import type { Surface } from "@axe/surface";

export async function draftBestAvailable(
  surface: Surface,
  prefer: (names: string[]) => string | undefined,
): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const view = surface.observe();
    const choices = view.entries.filter(
      (e) => e.kind === "action" && e.index !== null && e.id.startsWith("pick:me:"),
    );
    const name = prefer(choices.map((e) => e.name));
    const chosen = choices.find((e) => e.name === name);
    if (!chosen) return "nothing to draft";
    const result = await surface.act({
      op: "CLICK",
      target: chosen.id,
      expectedRev: view.rev,
      actor: "agent",
    });
    if (result.status === "ok") return `drafted ${chosen.name} at rev ${result.output.rev}`;
    // Someone else moved first: the act applied nothing. Look again.
    if (result.error.code === "conflict") continue;
    return `refused: ${result.error.message}`;
  }
  return "the board kept changing; gave up";
}
```
<!-- /include -->

Acts on one surface run one at a time, in the order `act` was called. Every check above runs when `act` is called, so a refusal comes back at once, even while another act's handler is still running. An act that passes them while another is in flight waits its turn, and when it reaches execution the surface checks it again: if the act ahead of it moved the revision, or a person did (`bump`, `setRev`), it is `conflict`; if the application froze in the meantime, or the control became unavailable, it is `unavailable`; in every case its handler does not run. So two acts presenting the same `expectedRev` cannot both commit when the first one moves the revision, and an act presenting a revision that a predecessor has since moved is `conflict`, as a retry after a lost response is. `observe`, `availability`, and `ledger` never wait: while a handler runs they report the state before it commits.

Two participants on one application collide safely: a human change between the agent's observe and act is caught as `conflict`; a retried act after a lost response is refused because the revision moved; an index that shifted cannot land on the row that slid into the slot; two acts from one observation are ordered and the second is checked against the first one's result. The tests in `packages/surface/test` pin each of those.

## Writing under a precondition

The surface's checks guard one surface. Two tabs of a server-state application each have their own surface, and both can pass their own check at the same revision; no queue in a browser can order writes on a server. There the write itself has to be the gate: the handler takes the `expectedRev` from its context and passes it into the transaction or conditional write, and when the write finds a newer revision it refuses. It refuses by throwing a `SurfaceConflict` (with the server's `currentRev` when it knows it) or by returning `{ conflict: { currentRev } }`. The surface returns `conflict` with `expectedRev` and `currentRev` in `details`, records a refusal in the ledger, and adopts nothing from the handler: the application's newer revision arrives the way it always does, through `setRev` on the next refresh. A handler that refuses must have written nothing.

<!-- include: examples/surface/precondition.ts#precondition -->
```ts
import { createSurface, SurfaceConflict } from "@axe/surface";

interface Plan {
  revision: number;
  cells: Record<string, string>;
}

// Stands in for the server: one branch revision, and a write that applies only at the expected
// revision (UPDATE ... SET value = $1, revision = revision + 1 WHERE revision = $expected).
const server: Plan = { revision: 129, cells: {} };
async function writeCell(id: string, value: string, expected: number): Promise<number | null> {
  if (server.revision !== expected) return null;
  server.cells[id] = value;
  server.revision += 1;
  return server.revision;
}

export const surface = createSurface({ app: "planning-app", revision: "app" });
surface.setRev(server.revision);

surface.register({
  id: "cell:demand:2026-03",
  kind: "field",
  role: "textbox",
  name: "Demand, March 2026",
  edit: {
    maxLength: 40,
    // The third argument is the act's context: the entry id and the expectedRev it presented.
    set: async (text, _actor, { id, expectedRev }) => {
      const rev = await writeCell(id, text, expectedRev);
      if (rev === null)
        throw new SurfaceConflict("The plan changed on the server.", {
          currentRev: server.revision,
        });
      // Report what changed and the revision the write produced; the surface adopts it.
      return { changed: [id], rev };
    },
  },
});
```
<!-- /include -->

To the caller, both gates look the same: `conflict`, nothing applied, observe again.

<!-- include: examples/surface/precondition.ts#outcome -->
```ts
export async function typeDemand(text: string): Promise<string> {
  const view = surface.observe();
  const result = await surface.act({
    op: "TYPE_TEXT",
    target: "cell:demand:2026-03",
    text,
    expectedRev: view.rev,
  });
  if (result.status === "ok") return `saved at rev ${result.output.rev}`;
  // Refused by the surface (another act or a person moved first) or by the server's write:
  // either way nothing was applied, and the ledger records a conflict.
  if (result.error.code === "conflict") return "someone moved first; observe again";
  return result.error.message;
}
```
<!-- /include -->

Three more rules keep the revision honest when handlers are asynchronous:

- A commit whose revision arrives later (the handler reports no `rev`, so the revision has not moved yet) still closes the acts that were waiting behind it at that revision: they are `conflict`, with a message saying the application has not reported its new revision. An agent that observes again and acts is accepted, so nothing waits on a revision that may never move. A handler that returns `changed: []` said it changed nothing, and the next act runs.
- A `rev` a handler reports that is older than the surface's revision when it settles (a newer one arrived with `setRev` while it ran) is not adopted. The act is still `ok`, `output.rev` is the current revision, and the ledger entry carries the report as `ignoredRev`.
- A handler that never settles holds back every later act, and a handler must not await an `act` on its own surface, which would wait for itself.

Per-entry revisions are not part of the contract: one revision per application is what the trials needed, and the server's conditional write can be as fine-grained as the application's own data model. See `DECISIONS.md`.

## Transient states

Availability is only as current as the last registration. Re-register an entry (or `reconcile`) whenever anything that feeds its `state`, `value`, or `edit` changes, and that includes transient states: a save in flight, data loading, a modal open. The first staging trial found a grid that disabled its cells during a save while the surface still reported them editable, and an agent typed into the frozen UI. For a state that spans the whole surface, `freeze(reason)` does it in one call: every entry reports unavailable with that reason, fields go read-only, no row carries an index, `observe` carries a top-level `frozen: { reason }`, acts return `unavailable` with the reason, and `onChange` listeners hear about the freeze and the `thaw`. Freezes nest; the surface thaws when the last one is released.

What a freeze does to the revision follows the [revision mode](#the-revision). When the surface owns it, `freeze` and `thaw` each move it, so an act planned before the freeze is `conflict`. When the application owns it, neither moves it: a freeze is not a change of the application's state, and a counter the surface moved on its own would run ahead of the server's until the next `setRev`, refusing agents for a change that never happened. An act planned before the freeze is then `unavailable` while frozen and accepted after the thaw exactly when the application's revision did not move.

<!-- include: examples/surface/save.ts#freeze -->
```ts
import { surface } from "./board";

export async function save(persist: () => Promise<void>): Promise<void> {
  const thaw = surface.freeze("saving");
  try {
    await persist();
  } finally {
    thaw();
  }
}
```
<!-- /include -->

## The ledger

The ledger is the application's one history, in memory, oldest first. It holds three things and nothing else:

- **Acts through the surface, run or refused.** Every call to `act` writes exactly one entry: `{ seq, at, op, target, actor, revBefore, revAfter, status, changed }`, with the `text` it carried under the text policy ([Sensitive values and the ledger's text](#sensitive-values-and-the-ledgers-text)). A refusal has an error code as its `status`, an empty `changed`, and `revAfter` equal to `revBefore`. Every act result carries its entry's `seq`.
- **Changes the application recorded itself**, marked `source: "application"`. A change made outside `act` (a person's own control that is not a registered entry, an approval, a push from the server) moves the revision but writes no entry, so an agent reading the ledger would find a revision it cannot account for. `record` appends one.
- **Calls the server refused before the surface**, marked `source: "server"`, when the surface is served through the bridge ([Serving a surface](#serving-a-surface-as-an-axe-manifest)): a stale `expectedRev`, refused by the protocol before the handler runs, is recorded as `conflict` with the entry id, the op, the caller as `actor`, and the `expectedRev` the caller presented.

`ledger({ since })` returns what came after a `ledgerSeq` an agent observed; `actor` filters and `limit` caps. Entries `act` writes carry no `source`.

<!-- include: examples/surface/ledger.ts#ledger -->
```ts
import { surface } from "./board";

// After observe() returned { rev, ledgerSeq }, an agent asks what happened after that snapshot.
export function whatHappenedSince(ledgerSeq: number): string[] {
  return surface
    .ledger({ since: ledgerSeq })
    .map((e) =>
      e.status === "ok"
        ? `#${e.seq} ${e.actor} ${e.op} ${e.target} (rev ${e.revBefore} -> ${e.revAfter})`
        : `#${e.seq} ${e.actor} ${e.op} ${e.target}: refused, ${e.status}, nothing applied`,
    );
}

// The person's view of the agent's work: newest twenty entries by the agent.
export function agentActivity() {
  return surface.ledger({ actor: "agent", limit: 20 });
}
```
<!-- /include -->

`record({ op, target, actor, changed?, text?, revBefore?, status? })` runs no handler and does not move the revision: the application makes its change and moves the revision (`bump`, `setRev`), then records it, passing the revision it read before as `revBefore` so the entry spans the move. `revAfter` is the revision when `record` is called; `op` is the application's own word (`APPROVE`, `UNDO`), not limited to the ops of `act`. The text policy and the sensitive rule apply as they do to an act. A refusal the surface never saw is recorded with an error code as `status` and `changed: []`; both revisions are then the current one.

<!-- include: examples/surface/ledger.ts#record -->
```ts
// The commissioner undoes a pick from the page's own admin menu, which is not a registered control,
// so the change never passes through act. Make the change, move the revision, then record it with
// the revision read before, so the entry spans the move and the ledger has no gap.
export function undoPickFromAdminMenu(playerId: string, undo: () => void): void {
  const revBefore = surface.currentRev();
  undo();
  surface.bump({ what: `undo:${playerId}` });
  surface.record({
    op: "UNDO",
    target: `pick:me:${playerId}`,
    actor: "commissioner",
    changed: [`pick:me:${playerId}`],
    revBefore,
  });
}
// The entry: { op: "UNDO", actor: "commissioner", revBefore: 7, revAfter: 8, status: "ok",
// source: "application", ... }. record runs no handler and does not move the revision itself.
```
<!-- /include -->

The ledger holds nothing else. A call the runtime refuses for a caller it did not admit (no credentials on a protected surface, a site key outside its allowlist), or before it knew the caller or the action (a malformed envelope, an oversized body), is only in the server's request events. Retention is bounded (`createSurface({ ledger: { max } })`, default 1000 entries); for a durable trail, sink the action events below, or the application's own store.

## Saying what would unblock a control

An unavailable action can declare `requires`, the same `accepts` list an AXE `needs_input` carries, with a `fulfill` the application runs when an agent supplies one of the kinds; and a `handoff` for a step only a human can take. A handoff has a `url` when a page names the step; when the step is taken inside the application itself (unlock a version from a menu) there is no page, so leave `url` out rather than invent one. Standalone, `act` reports both in `error.details`. Through the AXE bridge they become the ladder, except that a handoff without a `url` cannot become `needs_human` (there is nowhere to resume from) and stays an `unavailable` error whose `details.handoff` still says what would unblock the control.

<!-- include: examples/surface/requires.ts#lock -->
```ts
import { createSurface } from "@axe/surface";
import { toJsonSchema } from "@axe/core";
import { kinds, accept } from "@axe/core/kinds";

const plan = { approved: false, locked: false, revision: 129 };
// The server owns the revision (adopted as is with setRev), and the kinds below carry Zod
// schemas, so the converter that publishes them is passed in; the surface does not import Zod.
export const surface = createSurface({ app: "planning-app", revision: "app", toJsonSchema });
surface.setRev(plan.revision);

function registerLock() {
  surface.register({
    id: "lock:2026-03",
    kind: "action",
    role: "button",
    name: "Lock March",
    object: "month:2026-03",
    state: plan.approved
      ? { available: true }
      : {
          available: false,
          reason: "approval required",
          requires: {
            accepts: [
              accept(kinds.consent.terms, {
                description: "Record the planner's approval of the March lock.",
              }),
            ],
            fulfill: () => {
              plan.approved = true;
              registerLock();
            },
          },
          handoff: {
            reason: "approval_required",
            instructions: "Approve the March lock in the planning app.",
            url: "https://plan.example/locks/2026-03",
            whatAgentShouldSayToUser:
              "The March lock needs your approval in the planning app before I can apply it.",
          },
        },
    effect: {
      mutates: "locks",
      idempotent: true,
      reversible: true,
      risk: "high",
      text: "reason for the lock",
    },
    handler: (_actor, text) => {
      plan.locked = true;
      void text;
      plan.revision += 1;
      // Report what changed and the revision the server assigned; the surface adopts both.
      return { changed: ["lock:2026-03"], rev: plan.revision };
    },
  });
}
registerLock();
```
<!-- /include -->

## Serving a surface as an AXE manifest

Every entry becomes its own AXE action, and every action the bridge generates is protected by default: its `auth` is `user`, so only a caller your server authenticates can observe, read the ledger, or act. The next section covers the other modes and one surface per user. An agent reading the manifest, or the tool list of the derived MCP server, sees "Draft Jahmyr Gibbs (RB)" and "Lock March", each with its own `availability` and reason, not one `act` tool with a `target` parameter. `surfaceActions` returns an action provider: hand it to `addProvider` and the set follows the registry from then on, so a row that registers or unregisters as the page changes is in or out of the manifest, `/axe/state`, and the MCP tools on the next request.

<!-- include: examples/surface/serve.ts#serve -->
```ts
import { createAXE } from "@axe/core";
import { surfaceActions } from "@axe/surface/axe";
import { surface } from "./board";

export const axe = createAXE({
  name: "Fantasy Draft",
  description:
    "A draft board: observe which players can be drafted right now, then draft, undo, or flag them under one revision.",
  baseUrl: "https://draft.example",
  auth: { modes: ["none", "user"], userLoginUrl: "https://draft.example/login" },
  secret: process.env.AXE_SECRET,
  // The surface's revision is the site's: every envelope carries rev, and a stale expectedRev is
  // refused before any handler runs.
  revision: surface.currentRev,
});

// One action per entry, plus board.observe and board.ledger. The set follows the registry: a row
// that registers or unregisters is in or out of the manifest on the next request. `auth: "user"`
// is the default, written out: an anonymous caller can neither observe nor act, and the server
// above must list `user` in its modes or it refuses the bridge.
export const bridge = surfaceActions(surface, { namespace: "board", auth: "user" });
axe.addProvider(bridge);

export const handler = axe.fetchHandler();
```
<!-- /include -->

The provider's set is `<ns>.observe` (read-only, filtered and paged as [Choosing granularity](#choosing-granularity) describes, with `display` over the entries and, per actionable row, a dynamic [affordance](presenting-results.md#affordances) that names the row's own action and carries the observation's `rev` as `expectedRev`), `<ns>.ledger` (read-only, `{ since?, limit? }` in, `{ ledgerSeq, entries }` out, with `display`), and one action per entry:

- The action's `title` is the entry's `name`; its `description` is composed from the kind, the `object`, and the `effect`.
- An action entry carries its `effect`'s `idempotent`, `reversible`, and `risk`. Its input requires `confirm: true` when the effect declares `confirm`, and takes an optional `text` described by the effect's `text` prompt.
- A field entry is `idempotent`; its `risk` and `reversible` come from the `fields` option (defaults `medium` and false); its input is `{ text }`, a string. The `maxLength` is named in the input's description and enforced by the surface, as is the field's own schema, so a refusal is in the ledger; the bridge's input schemas describe the shape only.
- A collection entry that can load more is a low-risk action with no input that asks it to load more. A collection without `more` has no action; it stays a row of `observe`.
- Every entry action's `availability` is the entry's live state: an action's reason with `requires` and `handoff`, a field's read-only reason, and the freeze's reason for everything while the surface is frozen. `/axe/state` serves it per control.

Names are `<ns>.<slug>`: the entry id lowercased, runs of other characters replaced by one hyphen, `e-` prefixed when the result starts with a digit, and a short hash appended only when two ids share a slug. `pick:me:Gibbs` under the `board` namespace is `board.pick-me-gibbs`. The bridge keeps the map both ways for its lifetime:

<!-- include: examples/surface/serve.ts#names -->
```ts
// Entry ids are not action names; the bridge maps them both ways, and the map is stable.
bridge.actionNameFor("pick:me:Gibbs"); // "board.pick-me-gibbs"
bridge.entryIdFor("board.pick-me-gibbs"); // "pick:me:Gibbs"
```
<!-- /include -->

`entrySlug(id)` gives the plain slug alone. Every name fits the action-name grammar, so MCP tool names follow (`board_pick-me-gibbs`).

Refusals map onto the ladder: an unavailable control with `requires` returns `needs_input` with those kinds (and the declared `handoff` as `fallback` when it has a `url`); one with only a `handoff` that has a `url` returns `needs_human`; a stale revision is `conflict` with `expectedRev` and `currentRev` in `details`; everything else stays an `error` with the application's reason, including a freeze and a handoff without a `url`, which never climb the ladder. On `/axe/continue` the application's `fulfill` runs and the act is retried at the current revision; on `/axe/resume` the act is retried. The `actor` recorded is the authenticated `onBehalfOf`, else `agent`.

The bridge validates only the shape of a request at the protocol layer (a string `text`, a boolean `confirm`, no unknown keys) and leaves the surface's own checks (`maxLength`, the field's schema, a required `confirm`) to the surface, so an over-length edit or a missing confirmation is refused by the surface, ledgered as `invalid_input`, and emitted as a `surface.act` event. What the runtime refuses before the bridge's handler runs (a stale `expectedRev`, a `text` that is not a string, a missing `idempotencyKey`) the bridge records in the caller's [ledger](#the-ledger) as well, marked `source: "server"`, once, and without a new action event. The server hands the bridge each of its results through the action provider's `onResult`, with a `ProviderResultContext` that says who the runtime authenticated and whether a handler produced the result; `addProvider` wires it, so there is nothing to pass to `createAXE`. Only a caller the runtime admitted under the action's `auth` mode is recorded: an anonymous call to a protected surface writes nothing, and a public surface records an anonymous caller as `agent`, as it records that caller's acts. A refusal the surface made itself is already in the ledger with its `seq` and is not recorded again.

Pass `revision: surface.currentRev` to `createAXE` and the surface's revision becomes the site's ([Live state and revisions](live-state.md)): every envelope carries `rev`, the revision the agent observed travels as the request envelope's `expectedRev` and is checked by the protocol before the handler runs, and `/axe/state` reports it. The entry's action passes the same `expectedRev` to `act`, so the protocol's check is the first gate and the surface's the second: two requests that both pass the server's check at one revision are ordered by the surface, and the later one is checked again when its turn comes. The handler receives the same value for its own write. The entry actions take no `expectedRev` in their input; a request without one is refused by the surface as `invalid_input`, because every act presents the revision the agent saw.

The set is rebuilt only when the registry changed shape (`registryVersion` moved: a register, an unregister, a `reconcile`); a `bump` alone reuses the previous set, and a re-registered row rebuilds only its own action. Invocation resolves the action name through a map, so hundreds of rows cost hundreds of small lookups on `/axe/state` and one lookup per act. An entry whose name fails the honesty lint (an instruction aimed at the agent) is not published; the bridge's `onError` option hears about it and the row stays in `observe`. A retried `idempotencyKey` for an action whose row has since left the board (the pick that was just drafted) is still answered from the idempotency store, so a lost response is recoverable.

## Choosing granularity

`surfaceActions` publishes one action per control. `domainActions` publishes a small, fixed set of parameterized actions instead: each covers the entries the application selects and takes the entry id as input. Both run the same handlers through `surface.act`, with the same revision guard, ladder, ledger, and `surface.act` events; only the shape of the manifest and the tool list differs. Neither is deleted in favor of the other: the numbers below say where each fits.

<!-- include: examples/surface/granularity.ts#domain -->
```ts
import { createAXE } from "@axe/core";
import { domainActions, surfaceActions } from "@axe/surface/axe";
import { surface } from "./board";

export const axe = createAXE({
  name: "Fantasy Draft",
  description:
    "A draft board: observe which players can be drafted right now, then draft, undo, or flag them under one revision.",
  baseUrl: "https://draft.example",
  auth: { modes: ["user"], userLoginUrl: "https://draft.example/login" },
  secret: process.env.AXE_SECRET,
  revision: surface.currentRev,
});

// A fixed set of actions: draft.observe, draft.ledger, draft.pick, draft.undo. The manifest and
// the MCP tool list stay the same whatever the board holds; the rows, their availability, and
// the action for each come from draft.observe, which pages 50 rows at a time.
export const domain = domainActions(surface, {
  namespace: "draft",
  domains: [
    {
      name: "pick",
      title: "Draft a player",
      description:
        "Drafts one player from the board for your team, as the row's Draft button would.",
      // Which entries this action acts on: the application's own grouping.
      covers: (entry) => entry.id.startsWith("pick:me:"),
      // True of every pick; an entry with a higher risk would be left uncovered and reported.
      risk: "medium",
      reversible: true,
    },
    {
      name: "undo",
      title: "Undo the last pick",
      description: "Puts the most recent pick back on the board.",
      covers: (entry) => entry.id === "undo",
      risk: "medium",
    },
  ],
});
axe.addProvider(domain);
```
<!-- /include -->

How the mapping works ([S-AXE-10] to [S-AXE-13] in [`spec/SURFACE.md`](../spec/SURFACE.md)):

- **Coverage.** A registered entry belongs to the first spec whose `covers(entry)` returns true, decided once per registered entry object. `actionFor(id)` and `covered(name)` report the map. Without `domains`, the defaults are `set-field` (every field), `run-control` (every action entry) and `load-more` (every collection).
- **Metadata holds for every covered entry.** A spec declares `risk`, `idempotent`, and `reversible` for the whole group. An entry whose own risk is higher, or that is not reversible or idempotent when the spec says it is, is not covered: `onError` hears about it and its row stays in `observe` without an affordance. The default `run-control` is declared `risk: "high"`, not reversible, not idempotent, so every control fits; declare narrower groups to publish narrower metadata.
- **Input.** `{ entryId, text?, confirm? }`. The op is the entry's own (`TYPE_TEXT` for a field, `TOGGLE` for a switch, `CLICK` otherwise, `SCROLL_DOWN` for a collection). An `entryId` another action covers, or a field without `text`, is `invalid_input` before the surface, as an unknown action name would be, so it is not ledgered; an id no entry carries goes on to the surface and is `not_found` in the ledger.
- **Availability.** A parameterized action is available while at least one entry it covers can be acted on; otherwise its `availability` carries the reason every covered entry shares (a freeze) or its `idleReason`. Per-entry availability is on each `observe` row, and an act on an unavailable entry is refused exactly as its own action would be: `needs_input` with its `requires`, `needs_human` for a handoff with a `url`, `unavailable` otherwise. A parameterized action cannot derive `humanHandoff` from its entries, so the spec declares it when a covered control can hand off.
- **Revision and ledger.** Identical. The envelope's `expectedRev` goes to `act` unchanged; the ledger records the entry id as `target` and the op; the `surface.act` event names the domain action.
- **Affordances.** Every actionable `observe` row carries an affordance naming the action that acts on it, with `entryId` bound and the observed `rev` as `expectedRev`.

`<ns>.observe` takes filters and pages in both modes: `object` (exact), `kind`, `available` (rows with an `index`, or without), `query` (case-insensitive text in the name, id, or object), `limit`, and `cursor`. Rows keep registration order, keep the `index` they have in the whole observation, and the output carries `total` (rows matching the filters) and `nextCursor` while more match. The page size is published as the action's `pagination`: 50 rows by default and at most 200 for `domainActions`, 1000 and 1000 for `surfaceActions`, so a per-control surface of up to 1000 rows is still one call; the `observe` option (`pageSize`, `maxPageSize`) changes either. A cursor names the last row returned and the one after it, so a row that leaves between pages does not shift the next page; pages read at different revisions are different observations, and an act presents the `rev` of the page it read. `surface.observe()` is unchanged.

<!-- include: examples/surface/granularity.ts#call -->
```ts
// An agent reads one page of rows about one player, then acts on the row with its id and the rev
// it observed. The observe row carries the same call as an affordance with entryId bound.
export async function draftGibbs(post: (path: string, body: unknown) => Promise<unknown>) {
  const page = (await post("/axe/actions/draft.observe", {
    input: { query: "Gibbs", available: true, limit: 10 },
  })) as { output: { entries: { id: string }[] }; rev: number };
  const row = page.output.entries[0];
  if (!row) return undefined;
  return post("/axe/actions/draft.pick", {
    input: { entryId: row.id },
    expectedRev: page.rev,
    idempotencyKey: crypto.randomUUID(),
  });
}
```
<!-- /include -->

### What the measurements say

`node scripts/measure-granularity.mjs` serves one demand-plan application both ways and measures real payloads: the manifest, the derived MCP server's JSON-RPC messages, and `observe` output. The numbers are scripted and deterministic, not model performance; token counts are an estimate, bytes / 4. The full report, with the method, is [`docs/review/2026-09-24/data/granularity.md`](review/2026-09-24/data/granularity.md).

| Controls | Mode | MCP tools | `tools/list` | Est. tokens | Notifications over 50 UI changes | Read before first correct act | Five tasks: bytes read |
| -------: | ---- | --------: | -----------: | ----------: | -------------------------------: | ----------------------------: | ---------------------: |
|        5 | per control | 12 | 13 KB | ~3,200 | 18 | 15 KB | not run |
|        5 | domain | 10 | 11 KB | ~2,800 | 0 | 14 KB | not run |
|       50 | per control | 56 | 72 KB | ~18,400 | 20 | 75 KB | 92 KB |
|       50 | domain | 10 | 11 KB | ~2,750 | 0 | 14 KB | 31 KB |
|      300 | per control | 297 | 401 KB | ~102,600 | 21 | 404 KB | 442 KB |
|      300 | domain | 10 | 11 KB | ~2,750 | 0 | 14 KB | 54 KB |
|     1000 | per control | 974 | 1325 KB | ~339,100 | 19 | 1328 KB | 1393 KB |
|     1000 | domain | 10 | 11 KB | ~2,750 | 0 | 14 KB | 82 KB |

Both scripted agents completed all five tasks at every size, verified against the application's state. The per-control tool list grows by about 1.4 KB per control; the domain list is constant. Per control, the bridge sends `notifications/tools/list_changed` only when a published tool definition changed ([S-OBS-4]); a re-render that re-registers rows unchanged sends nothing. Even so, an agent that lists the tools again on each notification reads about 17 MB (KB and MB here are 1024-based) over the 50 changes at 300 controls. Server-side caching of the built actions ([S-AXE-9]) makes none of that smaller for the agent.

### When to use which

- **Per control** when the surface is small (tens of controls), when the tool list should read like the page (a human reviewing an agent's tools sees "Lock March"), when each control's own risk, reversibility, and `humanHandoff` should be on its own action for the audit, and when the rows rarely come and go. At 5 controls the two modes cost about the same.
- **Domain actions** when the surface is large or churns (grids, boards with rows that come and go, pages that re-register on every edit), when the agent's context is the constraint, or when the MCP client pays for every `tools/list_changed`. The price: the agent reads `observe` before it acts (one filtered page), a group's metadata is the ceiling of its entries, and per-control availability is no longer in the manifest.
- **Migrating.** Serve both side by side under different namespaces while agents move over, then drop the per-control provider. Per-control names are sticky per entry id for the life of the bridge; domain action names are fixed by the application, so they are the more stable of the two across deploys.

<!-- include: examples/surface/granularity.ts#side-by-side -->
```ts
// While agents move over, serve the per-control actions beside them under another namespace.
// Tool names in each namespace stay stable; both share the surface's revision and ledger.
axe.addProvider(surfaceActions(surface, { namespace: "board" }));

domain.actionFor("pick:me:Gibbs"); // "draft.pick"
domain.covered("draft.undo"); // ["undo"]
```
<!-- /include -->

Neither granularity changes the revision. It is global, and in a scripted run where a person edits one field per agent think time on a 300-control surface, 63% of the agent's first attempts were refused as `conflict`, 80% of those for an edit on another row; with a filtered re-observe and up to three attempts, 74% landed. [DECISIONS.md](../DECISIONS.md) ("Surface", granularity) has the proposal for a per-entry precondition and why it is not implemented.

## Who can observe and act

A surface in the browser is the page's own data. Served over HTTP, it is whatever the server lets through: `observe` returns every field value and the domain objects you pass to `setObjects`, and the ledger keeps the text agents typed. So the bridge declares an `auth` mode on every action it generates, and the AXE runtime enforces it before any bridge handler runs ([Auth](auth.md)).

- `auth` is `user` unless you say otherwise. Each mode the bridge uses must be listed in the server's `auth.modes`, or the server refuses the bridge on its first request with an error naming the mode. `createAXE` without `auth` is public (`{ modes: ["none"] }`), so serving a surface from a server you forgot to configure fails loudly instead of publishing it.
- `auth: "none"` makes the surface public over HTTP. Write it only for data you would put on the open web, and say why in a comment next to it. `auth: "site"` admits partner keys through `verifySiteKey`.
- `read` sets the mode of `<ns>.observe` and `<ns>.ledger` apart from the controls, and `authFor(entry)` sets one entry's mode (return undefined to keep `auth`).

<!-- include: examples/surface/access.ts#modes -->
```ts
// A public read side over protected controls, with one control anyone may use. Every mode used
// must be in the server's auth.modes; `none` here publishes every value observe returns.
export function publicBoard(surface: Surface) {
  return surfaceActions(surface, {
    namespace: "board",
    auth: "user",
    read: "none",
    authFor: (entry) => (entry.id === "refresh" ? "none" : undefined),
  });
}

// A demo or a test harness that is deliberately public says so.
export function demoBridge(surface: Surface) {
  // Public on purpose: a sandbox board with no real data.
  return surfaceActions(surface, { namespace: "demo", auth: "none" });
}
```
<!-- /include -->

An anonymous call to a protected action is refused by the runtime, not by the surface: `unauthorized` without credentials, or a `login_required` handoff when the server has a `userLoginUrl`, and a site key outside its allowlist is `forbidden`. Nothing reaches the surface, the ledger, or the action events. An entry's `state.reason` stays what the application says about the control; it is never used to say "sign in first".

The manifest at `/.well-known/axe.json` is cacheable and computed for nobody in particular. For a protected entry it shows the action (its name, the entry's `name` as its title, its effect) and an `availability` of `{ available: true }`, the protocol's report for an action that makes no claim, because the bridge does not read the surface for a caller the runtime has not identified. `/axe/state` reads the surface once the caller is signed in and reports each control's reason for that caller. Entry names are therefore public in the manifest of a protected surface; if they carry private data ("Set salary for Dana Reyes"), use one surface per caller with a template, below.

### One surface per user or tenant

A server that holds surfaces for many people must not serve one person's state to another. Pass a resolver in place of the surface, and a `template`: the application's shape, the controls every caller has, named without anyone's data. `scopedSurfaces` builds the resolver. Its default key is the tenant id plus the principal (the user's `onBehalfOf`, else the site key's id), so two users, two partners, or one user on two tenants never share a surface; it creates a surface on the first request in a scope and drops the least recently used beyond `max` and any left idle longer than `idleMs`.

<!-- include: examples/surface/access.ts#scoped -->
```ts
// One surface per signed-in user (and per tenant, on a platform). The template is the
// application's shape: the controls every user has, named without anyone's data. It is what the
// manifest and the MCP tool list show.
const template = createSurface({ app: "notes" });
registerNotes(template, "", async () => undefined);

// Each user's surface holds that user's values and runs that user's handlers.
const scopes = scopedSurfaces({
  create: (_key, { identity }) => {
    const userId = identity!.onBehalfOf;
    const s = createSurface({ app: "notes", revision: "app", ledger: { text: "hash" } });
    registerNotes(s, loadNotes(userId).note, (text) => saveNote(userId, text));
    return s;
  },
  max: 500, // surfaces kept; the least recently used goes first
  idleMs: 15 * 60 * 1000, // a surface unused this long is dropped
});

export const axe = createAXE({
  name: "Notes",
  description:
    "Private notes: read and edit the signed-in user's note and see what an agent changed in it.",
  baseUrl: "https://notes.example",
  auth: {
    modes: ["user"],
    authenticate: async (request) => {
      const session = await verifySession(request);
      return session ? { onBehalfOf: session.userId } : null;
    },
  },
  secret: process.env.AXE_SECRET,
  // No `revision`: each user's surface has its own, and its own guard checks expectedRev.
});
axe.addProvider(surfaceActions(scopes.resolve, { namespace: "notes", template }));
```
<!-- /include -->

What each caller sees:

| Endpoint                            | Anonymous                                                  | A signed-in caller                                               |
| ----------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------- |
| `/.well-known/axe.json`             | the template's actions, each `{ available: true }`         | the same document; manifests are shared and cached               |
| `/axe/state`                        | every action `{ available: true }`; no surface is read     | each control's availability and reason from the caller's surface |
| `<ns>.observe`, `<ns>.ledger`       | `unauthorized`                                             | the caller's own table, values, revision, and ledger             |
| an entry's action                   | `unauthorized` (or a login handoff)                        | runs against the caller's surface; an id it lacks is `not_found` |

A row in a caller's surface whose id is not in the template appears in that caller's `observe`, without an action. With a resolver, leave `revision` off `createAXE`: the server's revision provider does not see who is calling, and each caller's surface checks the `expectedRev` it is given against its own revision.

### Sensitive values and the ledger's text

A field registered with `sensitive: true` keeps its value to the application: its row in `observe()` says `sensitive: true` and carries no `value` (locally, through `expose`, and through `<ns>.observe`), `describeEntry` says `value hidden`, and the ledger never keeps the text typed into it, whether the act ran or was refused. The DOM mirror never carries a value for any field.

<!-- include: examples/surface/access.ts#sensitive -->
```ts
function registerNotes(
  s: Surface,
  note: string,
  save: (text: string) => Promise<number | undefined>,
): void {
  s.register({
    id: "note",
    kind: "field",
    role: "textbox",
    name: "Private note",
    value: note,
    edit: {
      maxLength: 2000,
      set: async (text) => {
        const rev = await save(text);
        return rev === undefined ? undefined : { changed: ["note"], rev };
      },
    },
  });
  s.register({
    id: "account",
    kind: "field",
    role: "textbox",
    name: "Account number for payouts",
    // Never in observe(), describeEntry, the ledger's text, or an action event.
    sensitive: true,
    value: "",
    edit: { set: async () => undefined },
  });
}
```
<!-- /include -->

For everything else, `createSurface({ ledger: { text } })` chooses what the ledger keeps of an act's text: `keep` (the default), `hash` (`textHash`, a SHA-256 that links equal texts but does not hide guessable ones), or `omit`; `ledger.redact(text, entryId)` rewrites kept text, for example to mask an account number inside a note. `surface.act` action events never carry text or values; the bridge's `redactEvent` rewrites their `details` when an entry id is itself personal. `setObjects` is yours: keep private data out of it, or protect the read side.

## Accessible names

In the first trial, two of three gains against browser agents came from the accessible names alone: a button named "Draft Jahmyr Gibbs (RB)" is chosen for the right reason, while one that reads "Draft" is a guess. Surface makes the mirror the default rather than advice. Names state the outcome in the application's own words and never the widget: "Draft Jahmyr Gibbs (RB)", not "Draft button"; "Lock March", not "Lock". The role is `role` and the state is `state`, so a name never says "disabled". The same string is the control's accessible name and the `name` an agent sees in `observe()` ([S-DOM-1] in the spec).

`surfaceAttributes(entry)` returns the attributes the control carries, from a registered entry or an observed row: `aria-label` (the entry name), `data-surface-id`, `data-surface-kind`, `data-surface-object` when the entry has one, and on an unavailable action `aria-disabled` with the reason in `data-surface-reason`; a read-only field carries `aria-readonly` and its reason. Collections carry the common set only. Set them on the element that receives the interaction and keep the application's own `disabled` logic: the helper sets `aria-disabled`, which reports without disabling and leaves the control focusable, so a screen reader reaches the reason.

That helper reads the entry alone, which is right for a one-time render and wrong for a control that stays on screen: it knows nothing of a freeze, and it only says what to set, so a cell that became editable again would keep the previous render's reason. For controls you re-render while the surface lives, use `surface.attributesFor(id)`. It reads the live availability, the same one `observe()` and the bridge report, and returns `{ set, remove }`: `set` carries the freeze's reason as `aria-disabled` or `aria-readonly` while frozen, and `remove` lists every attribute in `SURFACE_ATTRIBUTES` that is not in `set`. Apply both after each render and after each `subscribe` notification and the mirror can never disagree with `observe()`. `subscribe(listener)` fires after every change a reader could see: a registration or removal, `bump`, `setRev` (where the application owns the revision and never bumps), a freeze, and a thaw. `onChange` fires only on `bump`, `freeze`, and `thaw`, so it misses a row re-registered with a new reason under an application-owned revision.

<!-- include: examples/surface/dom.ts#follow -->
```ts
// Keep one control's mirror current outside React: `subscribe` fires after every change a reader
// could see, registration and an application-owned `setRev` included. Returns the unsubscribe.
export function follow(element: Element, id: string): () => void {
  mirror(element, id);
  return surface.subscribe(() => mirror(element, id));
}
```
<!-- /include -->

<!-- include: examples/surface/dom.ts#mirror -->
```ts
// Re-rendering a control that stays on screen: read the live availability, so a freeze shows
// with its reason and a reason from the previous render is removed.
export function mirror(element: Element, id: string): void {
  const update = surface.attributesFor(id);
  if (!update) return;
  for (const name of update.remove) element.removeAttribute(name);
  for (const [name, value] of Object.entries(update.set)) element.setAttribute(name, value);
}
```
<!-- /include -->

<!-- include: examples/surface/dom.ts#attributes -->
```ts
import { describeEntry, surfaceAttributes, surfaceSelector } from "@axe/surface";
import type { Entry } from "@axe/surface";
import { surface } from "./board";

// Rendering by hand: carry every attribute the helper returns on the element that receives the
// interaction. The application keeps its own disabled logic; the mirror only reports it.
export function renderButton(entry: Entry, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  for (const [attribute, value] of Object.entries(surfaceAttributes(entry)))
    button.setAttribute(attribute, value);
  button.disabled = entry.kind === "action" && entry.state?.available === false;
  button.textContent = "Draft";
  button.addEventListener("click", onClick);
  return button;
}
```
<!-- /include -->

`surfaceSelector(id)` returns a CSS selector for that element with the id quoted and escaped, so a browser agent or a test goes from an observed row to the control with one query, whatever the id contains ([S-DOM-3]). Ids are stable, so a selector from one observation still finds the control after the revision moves.

<!-- include: examples/surface/dom.ts#selector -->
```ts
// A browser agent or a test goes from an observed row to its control with one query, whatever
// the id contains.
export function controlFor(id: string): Element | null {
  return document.querySelector(surfaceSelector(id));
}
```
<!-- /include -->

`describeEntry(entry)` returns one line for a screen reader or an agent log: `Draft Jahmyr Gibbs (RB): unavailable, already drafted by another team; mutates draft, reversible, risk medium`. It is not rendered by default; applications that want it put it in `aria-description` or log it beside each act ([S-DOM-4]).

<!-- include: examples/surface/dom.ts#describe -->
```ts
// One line per entry, for an agent log or as the control's aria-description.
export function logSurface(): void {
  for (const row of surface.observe().entries) console.log(describeEntry(row));
}
```
<!-- /include -->

## Using it from React

`useSurface(entry, deps)` keeps one entry registered while a component is mounted and refreshes it in place when `deps` change, so an agent's index does not jump because a sibling re-rendered. Transient states belong in `deps`: the `saving` or `loading` flag, the open modal, whatever the component uses to disable its own control; left out, the surface keeps reporting the control available after the UI has frozen it. For a state that spans the page, wrap it in `freeze` instead. Render one small registering component per row of a list, so a row that scrolls away leaves the table the moment it leaves the page. Applications that render HTML outside React (a legacy grid) instead re-scan after each render and call `reconcile` to drop rows the scan did not keep.

`useSurfaceProps(entry, deps)` registers the same way and returns the [accessible-name attributes](#accessible-names) as props: `aria-label`, `data-surface-id`, `data-surface-kind`, `data-surface-object`, and `aria-disabled` or `aria-readonly` as booleans with `data-surface-reason`. The props follow the surface's live availability, so a frozen surface shows on every mounted control and the component re-renders when that changes. Spread them onto the element that receives the interaction and keep your own `disabled`; `deps` are the values the entry was computed from, as with `useSurface`.

```tsx
import { useSurfaceProps } from "@axe/surface/react";

function DraftButton({ player, available, reason, onDraft }: RowProps) {
  const props = useSurfaceProps(
    {
      id: `pick:me:${player.id}`,
      kind: "action",
      role: "button",
      name: `Draft ${player.player} (${player.pos})`,
      object: `player:${player.id}`,
      state: available ? { available: true } : { available: false, reason },
      effect: { mutates: "draft", reversible: true },
      handler: (actor) => onDraft(player, actor),
    },
    [player.id, available, reason],
  );
  return (
    <button {...props} disabled={!available} onClick={() => onDraft(player, "user")}>
      Draft
    </button>
  );
}
```

The rendered button reads `aria-label="Draft Jahmyr Gibbs (RB)"` with `data-surface-id="pick:me:gibbs"`, and when the pick is taken, `aria-disabled="true"` with `data-surface-reason="already drafted by another team"`: the same words the agent gets from `observe()`.

What the hooks own, as mounted tests pin it:

- The registration belongs to the entry's `id` and the target surface. Change either and the hook unregisters the old pair and registers the new one; unmount removes the current pair. Give each mounted control its own id: two components registering one id share a row, and the first to unmount removes it.
- An act runs the handler of the latest render, and so do `edit.set`, `more`, and `requires.fulfill`. Functions do not belong in `deps`, and a new closure alone does not re-register. `deps` are for the values the entry reports: availability, reason, name, value.
- A re-render with the same `deps` registers nothing, and a refresh replaces the row in place, so a sibling re-rendering never moves an agent's index.
- Registration runs in a layout effect, so the control is in the table, and its props read the live availability, before the browser paints. Strict Mode's extra unmount and mount leave the same table in render order.
- `useSurfaceProps` follows the surface through `subscribe`, so a freeze, a thaw, or a registration made outside the component (another writer, `reconcile`) re-renders the control, and an attribute that no longer applies, such as `aria-disabled` or `data-surface-reason` after the control became available, is gone from the element.

## Where a surface runs

A surface lives in the JavaScript realm that created it ([S-MODE-1] to [S-MODE-4]). That gives two modes, and an application uses them on purpose:

- **Browser-local.** A surface created in the page, with entries registered by the page's components through `useSurface` or `useSurfaceProps`, belongs to that tab and that page instance. Its handlers close over the page's state and act with the page's session. Code in the page reaches it through `expose(window)` or an in-page adapter; nothing else does. When a component unmounts or the person navigates away, its entries leave the table, and nothing changes on the server.
- **Server-side.** A surface created in a server process, or hand-written `action()`s, lives as long as the process and is served through AXE with `surfaceActions`, scoped to the caller's user and tenant by the runtime (`scopedSurfaces` gives one surface per caller). It must not depend on anything a browser registered.

Importing the same module in a Next route handler and in a page does not make one surface: the route gets its own, empty. The SDK has no broker that carries entries, acts, or sessions between a page and a server, between tabs, or between devices. State several people or agents share belongs on the server, changed through server-side capabilities that write conditionally; a page surface in `app` revision mode adopts the server's revision with `setRev`, so an agent in the page and an agent on the server present the same `expectedRev`.

The [reference application](reference-app.md) has both: the plan's domain actions on the server, the page's drafts, Save, scrolling, and dialog on a page surface, and a table of who owns what.

## What Surface does not do

It does not authorize inside the application: the bridge's `auth` decides which callers reach the surface at all, and the handlers still decide what each caller may do. It does not decide anything, run without the application (the handlers are the application's), or replace the manifest for actions that have no control on screen. `surface.observe()` returns every row; the bridge's `<ns>.observe` filters and pages ([Choosing granularity](#choosing-granularity)), but nothing limits a local caller to the visible window of a long list. The revision is per application instance, and there is no shared registry between tabs or between a page and a server (see [Where a surface runs](#where-a-surface-runs)). It does not bundle Zod: `@axe/surface` and `@axe/surface/react` bundle for the browser at about 26 kB minified, and the bundle test in `packages/surface/test` keeps them free of Node built-ins and of Zod; `@axe/surface/axe` is the server side and carries Zod through `@axe/core`. While the packages are unpublished, [Consume from a checkout](deploying.md#consume-from-a-checkout) says how to install them from tarballs.

## Next steps

- [Concepts](concepts.md) for the envelope and the ladder the bridge maps onto.
- [Requirements and kinds](requirements-and-kinds.md) for the kinds `requires` can name.
- [`spec/SURFACE.md`](../spec/SURFACE.md) for the numbered rules.
