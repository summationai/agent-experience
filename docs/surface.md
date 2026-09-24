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

Fields register a `value` and an `edit` descriptor (read-only with a reason, or editable with a `maxLength` and an optional schema). Collections register `total`, `loaded`, `filter`, and `sort`, and are actionable when they can load more.

## The revision

When state lives in the browser, the application owns the counter: call `bump` after every change an agent could observe, whoever made it, and `seedRev` from persisted state on load. When the server already has a revision, adopt it with `setRev`; the surface's stale check is then the first of two, and the server refuses a stale expected revision again.

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

`expose` publishes `observe`, `act`, `ledger`, and `rev` on the page for browser-driving agents. Mirror entry names to `aria-label` and mark controls with a `data-surface-id` attribute; in the first trial, two of three gains came from the names alone.

## Observe and act

`observe` returns the live table: every entry with its `index` (a position among the rows that can be acted on now, `null` otherwise), its `state` with a `reason` when unavailable, its `effect`, current `value` for fields, plus `objects` the application chooses to show and the `rev`.

`act` takes `op`, `target` (the entry id, or its index at the same rev), optional `text` and `confirm`, and the `expectedRev` the agent observed. It returns the [result envelope](concepts.md#the-result-envelope): `ok` with `{ rev, id, actor, changed }`, or `error` with `conflict` when the revision moved (nothing applied), `not_found` for an unknown target, `invalid_input` for a wrong op, missing confirm, or text that fails `maxLength` or the field's schema, and `unavailable` with the reason for a control the application has disabled.

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

## The ledger

Every call to `act` writes one entry to the surface's ledger, whether the handler ran or the act was refused: `{ seq, at, op, target, actor, revBefore, revAfter, status, text?, changed }`. `status` is `ok` when the handler ran, otherwise the error code the act came back with, and a refusal has an empty `changed` and equal revisions, so it reads as what it was: an attempt that applied nothing. `seq` counts up from 1 and is never reused; `observe()` carries the latest as `ledgerSeq`, and every act result carries its own (`output.seq`, or `error.details.seq`). `ledger({ since, actor, limit })` reads it oldest first. The surface keeps the most recent 1000 entries by default (`createSurface({ ledger: { max } })`); dropping old entries never renumbers the rest.

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

The ledger records acts made through the surface. A change a person makes through the application's own controls shows up as a revision move, not as an entry, unless the application routes it through `act`. It is the application's live record, in memory; for a durable trail, sink the action events below.

## Saying what would unblock a control

An unavailable action can declare `requires`, the same `accepts` list an AXE `needs_input` carries, with a `fulfill` the application runs when an agent supplies one of the kinds; and a `handoff` for a step only a human can take. Standalone, `act` reports both in `error.details`. Through the AXE bridge they become the ladder.

<!-- include: examples/surface/requires.ts#lock -->
```ts
import { createSurface } from "@axe/surface";
import { kinds, accept } from "@axe/core/kinds";

const plan = { approved: false, locked: false, revision: 129 };
export const surface = createSurface({ app: "planning-app" });
surface.setRev(plan.revision); // the server owns the revision; adopt it as is

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
      surface.setRev(plan.revision);
    },
  });
}
registerLock();
```
<!-- /include -->

## Serving a surface as an AXE manifest

`surfaceActions` derives three actions: `<ns>.observe` (read-only, with `display` over the entries and a dynamic [affordance](presenting-results.md#affordances) per actionable row that binds `target`, `op`, and `expectedRev` into `<ns>.act`), `<ns>.act` (mutating, revision-guarded), and `<ns>.ledger` (read-only, `{ since?, limit? }` in, `{ ledgerSeq, entries }` out, with `display`). Register all three and everything else in these docs applies: discovery, MCP, `axe conformance`, `axe audit`, events.

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
});

for (const a of surfaceActions(surface, { namespace: "board" })) axe.register(a);

export const handler = axe.fetchHandler();
```
<!-- /include -->

Refusals map onto the ladder: an unavailable control with `requires` returns `needs_input` with those kinds (and the declared `handoff` as `fallback`); one with only a `handoff` returns `needs_human`; a stale revision is `conflict`; everything else stays an `error` with the application's reason. On `/axe/continue` the application's `fulfill` runs and the act is retried at the current revision; on `/axe/resume` the act is retried. The `actor` recorded is the authenticated `onBehalfOf`, else `agent`.

### Action events

Analytics events ([Analytics](analytics.md)) say that `board.act` was called and how it went; they carry no actor and no payload by design. The bridge also emits one action event per act, run or refused, named `surface.act`, with the `actor`, the `status` and `errorCode` the surface returned, and `details: { seq, op, target, revBefore, revAfter, changed }`. Action events go to the server's `onActionEvent` sinks, a channel apart from `onEvent`, because they name people. A handler of your own emits them with `emit` on its context. The normative text is in [`spec/EVENTS.md`](../spec/EVENTS.md) under "Action events".

<!-- include: examples/surface/events.ts#events -->
```ts
import { createAXE, jsonlFileSink } from "@axe/core";
import type { AXEActionEvent } from "@axe/core/types";
import { surfaceActions } from "@axe/surface/axe";
import { surface } from "./board";

declare function notifyCommissioner(message: string): void;

export const axe = createAXE({
  name: "Fantasy Draft",
  description:
    "A draft board: observe which players can be drafted right now, then draft, undo, or flag them under one revision.",
  baseUrl: "https://draft.example",
  auth: { modes: ["none", "user"], userLoginUrl: "https://draft.example/login" },
  secret: process.env.AXE_SECRET,
  onActionEvent: [
    jsonlFileSink("/var/log/draft/ledger.jsonl"),
    (e: AXEActionEvent) => {
      if (e.status === "error")
        notifyCommissioner(
          `${e.actor ?? "an agent"} was refused (${e.errorCode}) at #${e.details.seq}`,
        );
    },
  ],
});

for (const a of surfaceActions(surface, { namespace: "board" })) axe.register(a);
```
<!-- /include -->

## Using it from React

`useSurface(entry, deps)` keeps one entry registered while a component is mounted and refreshes it in place when `deps` change, so an agent's index does not jump because a sibling re-rendered. Render one small registering component per row of a list, so a row that scrolls away leaves the table the moment it leaves the page. Applications that render HTML outside React (a legacy grid) instead re-scan after each render and call `reconcile` to drop rows the scan did not keep.

## What Surface does not do

It does not decide anything, run without the application (the handlers are the application's), or replace the manifest for actions that have no control on screen. It does not yet default `observe` to the visible window of a long list; scope by a field until it does. The revision is per application instance; two tabs of one user still resolve as the application's state store resolves them today.

## Next steps

- [Concepts](concepts.md) for the envelope and the ladder the bridge maps onto.
- [Requirements and kinds](requirements-and-kinds.md) for the kinds `requires` can name.
- [`spec/SURFACE.md`](../spec/SURFACE.md) for the numbered rules.
