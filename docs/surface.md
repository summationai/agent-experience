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

A handler, a field's `set`, or a collection's `more` may return `{ changed, rev }` (or a promise of it): `changed` names the entries the act moved and `rev` is the application's revision after the change. The surface folds both into the act result and the ledger. An application that bumps the revision itself can return nothing: `changed` is then the entry when the revision moved during the handler.

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

`expose` publishes `observe`, `act`, `ledger`, and `rev` on the page for browser-driving agents. The names those agents read on the page come from the same entries; see [Accessible names](#accessible-names). In the first trial, two of three gains came from the names alone.

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

Two participants on one application collide safely: a human change between the agent's observe and act is caught as `conflict`; a retried act after a lost response is refused because the revision moved; an index that shifted cannot land on the row that slid into the slot. The tests in `packages/surface/test` pin each of those.

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

The ledger records acts made through the surface. A change a person makes through the application's own controls shows up as a revision move, not as an entry, unless the application routes it through `act`. It is the application's live record, in memory; for a durable trail, sink the action events below.

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

Every entry becomes its own AXE action. An agent reading the manifest, or the tool list of the derived MCP server, sees "Draft Jahmyr Gibbs (RB)" and "Lock March", each with its own `availability` and reason, not one `act` tool with a `target` parameter. `surfaceActions` returns an action provider: hand it to `addProvider` and the set follows the registry from then on, so a row that registers or unregisters as the page changes is in or out of the manifest, `/axe/state`, and the MCP tools on the next request.

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
// that registers or unregisters is in or out of the manifest on the next request.
export const bridge = surfaceActions(surface, { namespace: "board" });
axe.addProvider(bridge);

export const handler = axe.fetchHandler();
```
<!-- /include -->

The provider's set is `<ns>.observe` (read-only, with `display` over the entries and, per actionable row, a dynamic [affordance](presenting-results.md#affordances) that names the row's own action and carries the observation's `rev` as `expectedRev`), `<ns>.ledger` (read-only, `{ since?, limit? }` in, `{ ledgerSeq, entries }` out, with `display`), and one action per entry:

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

The ledger is a complete record of what reached the surface. The bridge validates only the shape of a request at the protocol layer (a string `text`, a boolean `confirm`, no unknown keys) and leaves the surface's own checks (`maxLength`, the field's schema, a required `confirm`) to the surface, so an over-length edit or a missing confirmation is refused by the surface, ledgered as `invalid_input`, and emitted as a `surface.act` event. What the protocol refuses before the surface (a malformed envelope, a stale `expectedRev`) is in the server's request events instead.

Pass `revision: surface.currentRev` to `createAXE` and the surface's revision becomes the site's ([Live state and revisions](live-state.md)): every envelope carries `rev`, the revision the agent observed travels as the request envelope's `expectedRev` and is checked by the protocol before the handler runs, and `/axe/state` reports it. The entry actions take no `expectedRev` in their input; a request without one is refused by the surface as `invalid_input`, because every act presents the revision the agent saw.

The set is rebuilt only when the registry changed shape (`registryVersion` moved: a register, an unregister, a `reconcile`); a `bump` alone reuses the previous set, and a re-registered row rebuilds only its own action. Invocation resolves the action name through a map, so hundreds of rows cost hundreds of small lookups on `/axe/state` and one lookup per act. An entry whose name fails the honesty lint (an instruction aimed at the agent) is not published; the bridge's `onError` option hears about it and the row stays in `observe`. A retried `idempotencyKey` for an action whose row has since left the board (the pick that was just drafted) is still answered from the idempotency store, so a lost response is recoverable.

## Accessible names

In the first trial, two of three gains against browser agents came from the accessible names alone: a button named "Draft Jahmyr Gibbs (RB)" is chosen for the right reason, while one that reads "Draft" is a guess. Surface makes the mirror the default rather than advice. Names state the outcome in the application's own words and never the widget: "Draft Jahmyr Gibbs (RB)", not "Draft button"; "Lock March", not "Lock". The role is `role` and the state is `state`, so a name never says "disabled". The same string is the control's accessible name and the `name` an agent sees in `observe()` ([S-DOM-1] in the spec).

`surfaceAttributes(entry)` returns the attributes the control carries, from a registered entry or an observed row: `aria-label` (the entry name), `data-surface-id`, `data-surface-kind`, `data-surface-object` when the entry has one, and on an unavailable action `aria-disabled` with the reason in `data-surface-reason`; a read-only field carries `aria-readonly` and its reason. Collections carry the common set only. Set them on the element that receives the interaction and keep the application's own `disabled` logic: the helper sets `aria-disabled`, which reports without disabling and leaves the control focusable, so a screen reader reaches the reason.

That helper reads the entry alone, which is right for a one-time render and wrong for a control that stays on screen: it knows nothing of a freeze, and it only says what to set, so a cell that became editable again would keep the previous render's reason. For controls you re-render while the surface lives, use `surface.attributesFor(id)`. It reads the live availability, the same one `observe()` and the bridge report, and returns `{ set, remove }`: `set` carries the freeze's reason as `aria-disabled` or `aria-readonly` while frozen, and `remove` lists every attribute in `SURFACE_ATTRIBUTES` that is not in `set`. Apply both after each render and after each `onChange` and the mirror can never disagree with `observe()`.

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

## What Surface does not do

It does not decide anything, run without the application (the handlers are the application's), or replace the manifest for actions that have no control on screen. It does not yet default `observe` to the visible window of a long list; scope by a field until it does. The revision is per application instance; two tabs of one user still resolve as the application's state store resolves them today. It does not bundle Zod: `@axe/surface` and `@axe/surface/react` bundle for the browser at about 21 kB minified, and the bundle test in `packages/surface/test` keeps them free of Node built-ins and of Zod; `@axe/surface/axe` is the server side and carries Zod through `@axe/core`. While the packages are unpublished, [Consume from a checkout](deploying.md#consume-from-a-checkout) says how to install them from tarballs.

## Next steps

- [Concepts](concepts.md) for the envelope and the ladder the bridge maps onto.
- [Requirements and kinds](requirements-and-kinds.md) for the kinds `requires` can name.
- [`spec/SURFACE.md`](../spec/SURFACE.md) for the numbered rules.
