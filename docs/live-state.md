# Live state and revisions: what can be done now, and the state I saw

A manifest is static and an action is a function. That is enough for a site whose actions are always available and whose records are edited by one party at a time. It is not enough for a planning grid a team edits all day, or a draft board where a person and an agent pick from the same pool: the agent finds out what it can do by calling, and two edits to the same record race. This page covers the two additions that fix that, both optional: a **revision** the site reports on every envelope and the agent presents on every call, and an **availability** each action can declare, served uncached at `/axe/state`. The normative text is [§21 of the protocol](../spec/AXE-PROTOCOL.md#21-live-state-and-revisions).

Sites that publish neither are unaffected. Agents that never send `expectedRev` are unaffected.

## The revision

One value for the whole site: a string or a number that moves with every change an agent could observe, whoever made it. Agents compare it for equality and nothing else.

Give `createAXE` a `revision` function and three things happen: every result envelope carries `rev`; a request whose `expectedRev` differs from the current revision is refused with `conflict` before anything runs; and `/axe/state` is served.

<!-- include: examples/live-state/axe.ts#create -->
```ts
export const axe = createAXE({
  name: "Ember Yoga",
  description:
    "Book and cancel spots in Ember Yoga classes for the signed-in member, and see which classes have room right now.",
  baseUrl: "https://ember-yoga.example",
  auth: { modes: ["none", "user"], userLoginUrl: "https://ember-yoga.example/login" },
  secret: process.env.AXE_SECRET,
  // The site's revision: one value for the whole studio. With it, every envelope carries `rev`,
  // a request whose `expectedRev` differs is refused with `conflict` before anything runs, and
  // `/axe/state` is served.
  revision: () => studio.revision,
});
```
<!-- /include -->

`rev` rides at the top level of every envelope, whatever the status. On `ok` it is the revision the change produced, so the agent can use it as the next `expectedRev` without another read:

```json
{ "status": "ok", "output": { "bookingId": "b_1", "spotsLeft": 1 }, "rev": 42 }
```

Why one site-wide value rather than an ETag per resource: an action touches several records, an agent observes a whole result at once, and the only question that matters before acting is "has anything I saw moved". One number answers it; a set of ETags asks the agent to know the site's data model. [`DECISIONS.md`](../DECISIONS.md#live-state) has the longer form.

## The state I saw

An agent that has read something sends the revision it read at as `expectedRev` in the request envelope, next to `input` and `idempotencyKey`. If a person changed the record in between, the site is at a later revision and answers:

```json
{
  "status": "error",
  "error": {
    "code": "conflict",
    "message": "The site changed since you observed it (you saw revision 41, it is now 42). Nothing was applied; read the current state and decide again.",
    "retryable": true,
    "details": { "expectedRev": 41, "currentRev": 42 }
  },
  "rev": 42
}
```

Nothing was applied: the check runs before the handler, before `onContinue` and `onResume`, and before a login handoff is minted. A stale continue or resume does not consume its token. The agent reads again and decides again; `retryable` is true because the same request may well succeed once the agent has seen the new state.

`/axe/continue` and `/axe/resume` accept `expectedRev` with the same meaning. The client's `run()` tracks it through the ladder for you: pass `expectedRev` once and each continuation carries the `rev` of the result it continues from. A dynamic affordance may carry `expectedRev` as well: the revision the item was observed at, to present when following it ([P-AFF-4]).

### Idempotency and revisions together

They answer different questions. The `idempotencyKey` says "this is the same attempt"; `expectedRev` says "this is the state I saw". So:

- A retry with the **same key and input** is answered from the stored envelope, whatever `expectedRev` it carries. It is the same attempt; the answer already exists.
- A call with a **new key and a stale `expectedRev`** is refused with `conflict`. A lost response cannot be double-applied by retrying with a fresh key.
- A stale call **does not store anything for its key**, so the agent can reuse the key once it has read the current state.
- When the original call was answered with a `login_required` handoff, the revision it carried is re-checked when the action runs after sign-in, unless the resume presents a fresher one. The action has not run yet, so the agent's claim still stands.

## Availability: unavailable, because

Each action can declare `availability`: a function of the caller that returns `{ available: true }` or `{ available: false, reason }`, with `reason` in the site's own words. An unavailable action may add `requires`, the same `accepts` list a `needs_input` carries, naming what would make it available; and a `handoff` for a step only a human can take. The handoff's `url` may be left out when the step happens inside the site's own interface and no page names it; such a handoff is reported here and in an `unavailable` error's `details`, and never returned as `needs_human`, which needs a page to resume from.

<!-- include: examples/live-state/axe.ts#availability -->
```ts
axe.register(
  action("classes.book", {
    title: "Book a class",
    description:
      "Reserves one spot in a class for the signed-in member and uses one credit from their pass. Returns the booking id. Cancellation is free until two hours before the class.",
    risk: "medium",
    idempotent: true,
    reversible: true,
    auth: "user",
    input: z.object({ classId: z.string().describe("Class id, e.g. 'yin-tue-1800'") }).strict(),
    output: z.object({ bookingId: z.string(), spotsLeft: z.number().int() }),
    examples: [{ input: { classId: "yin-tue-1800" }, output: { bookingId: "b_1", spotsLeft: 1 } }],
    // Whether this member can book right now, in the studio's own words. The manifest shows the
    // anonymous view; `/axe/state` computes it for the caller; the handler receives the same value.
    availability: ({ identity }) => {
      const credits = identity ? (studio.passes.get(identity.onBehalfOf) ?? 0) : 0;
      const open = [...studio.classes.values()].some((c) => c.spots > c.roster.size);
      if (!open) return { available: false, reason: "every class this week is full" };
      if (identity && credits === 0) {
        return {
          available: false,
          reason: "no credits left on the member's pass",
          requires: [
            accept(kinds.payment.card, {
              description: "Buy a 5-class pass ($90) to book.",
            }),
          ],
          handoff: {
            reason: "payment_required",
            instructions: "Buy a class pass on the account page.",
            url: "https://ember-yoga.example/account/passes",
            whatAgentShouldSayToUser:
              "Your Ember Yoga pass has no credits left. Buy a pass on their site and I'll book the class.",
          },
        };
      }
      return { available: true };
    },
```
<!-- /include -->

The runtime renders it into the manifest (computed for an anonymous caller, since manifests are cached and shared), serves it per caller at `/axe/state`, and delivers the same value to the handler as `availability`. It does not refuse the call for you. The handler stays the one door, so authorization and business logic stay where they are; it refuses with `unavailable`, which carries the reason and what would change it in `error.details`, or climbs the ladder with `needsInput` using `requires` as `accepts`.

<!-- include: examples/live-state/axe.ts#handler -->
```ts
handler: async ({ input, identity, availability, expectedRev, unavailable, fail }) => {
  // The runtime already refused a stale `expectedRev` with `conflict`; here it is fresh (or absent).
  void expectedRev;
  // The handler is the one door: it refuses for the reason the manifest shows.
  if (availability && !availability.available) return unavailable(availability);
  const cls = studio.classes.get(input.classId);
  if (!cls) return fail("not_found", `No class "${input.classId}".`);
  if (cls.roster.size >= cls.spots)
    return unavailable({ available: false, reason: `${cls.title} is full` });
  cls.roster.add(identity!.onBehalfOf);
  studio.passes.set(identity!.onBehalfOf, studio.passes.get(identity!.onBehalfOf)! - 1);
  studio.touch(); // the ok envelope carries the new revision
  return { bookingId: `b_${cls.roster.size}`, spotsLeft: cls.spots - cls.roster.size };
},
```
<!-- /include -->

An action reported unavailable must not complete with `ok`; `axe conformance` calls one and checks. A reason is required whenever `available` is false, and it is agent-read text: `axe validate` reports a missing reason, and an instruction aimed at the agent in a reason is rejected the way it is everywhere else.

## The state endpoint

`GET /axe/state` returns the current revision and every action's availability, computed for the caller the request authenticates as, with `Cache-Control: no-store`:

```json
{
  "rev": 41,
  "actions": {
    "classes.search": { "available": true },
    "classes.book": {
      "available": false,
      "reason": "no credits left on the member's pass",
      "requires": [{ "kind": "payment.card", "title": "Payment card", "description": "Buy a 5-class pass ($90) to book.", "schema": { "type": "object" }, "sensitive": true }],
      "handoff": {
        "reason": "payment_required",
        "instructions": "Buy a class pass on the account page.",
        "url": "https://ember-yoga.example/account/passes",
        "whatAgentShouldSayToUser": "Your Ember Yoga pass has no credits left. Buy a pass on their site and I'll book the class."
      }
    }
  }
}
```

Every action in the manifest is listed; one that declares no availability is `{ available: true }`. The manifest advertises the endpoint under `live`:

```json
{ "live": { "rev": 41, "url": "https://ember-yoga.example/axe/state" } }
```

Caching: the manifest stays cacheable, so its `live.rev` and any `availability` it carries are a snapshot of the anonymous view. The state endpoint is the live view and is never cached; it varies by `Authorization` because availability may depend on who is asking (a member with no credits, a planner without approval).

## The agent side

Read, act with the revision you read at, and read again if someone moved first.

<!-- include: examples/live-state/agent.ts#loop -->
```ts
export async function bookWhenOpen(client: AXEClient, classId: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    // What can be done right now, and why not the rest, for this member. Never cached.
    const state = await client.state();
    const booking = state.actions["classes.book"];
    if (booking && !booking.available) {
      // The site said why, in its own words; relay that, and what would change it.
      const unblock = booking.requires?.map((r) => r.kind).join(" or ");
      return `Can't book yet: ${booking.reason}.${unblock ? ` It would need ${unblock}.` : ""}`;
    }
    // Act on the state we saw. A change by the front desk in between is refused, not applied.
    const result = await client.invoke<{ bookingId: string }>(
      "classes.book",
      { classId },
      { expectedRev: state.rev },
    );
    if (isOk(result))
      return `Booked ${result.output.bookingId} (studio now at revision ${result.rev}).`;
    if (isError(result) && result.error.code === "conflict") continue; // read again, decide again
    if (isError(result)) return `${result.error.code}: ${result.error.message}`;
    return `The site needs more: ${result.status}.`;
  }
  return "The studio kept changing; try again in a moment.";
}

/** A one-screen summary of the live state for the user or the model. */
export async function summarize(client: AXEClient): Promise<string> {
  return stateToMarkdown(await client.state(), client.manifest());
}
```
<!-- /include -->

`client.state()` fetches `/axe/state` (throwing when the site publishes none), `invoke` and `run` take `expectedRev`, and `present` carries a result's `rev` into `toMarkdown` and `toHTML` as an "as of" line. The derived MCP server adds an `axe_state` tool when the manifest carries `live`, accepts `expectedRev` on every action tool, explains a stale `conflict` and an `unavailable` in terms the model can act on, and puts each action's manifest-time availability in its tool description.

## Surface

[Surface](surface.md) already keeps one revision per application and refuses stale acts. Served through AXE, every control is its own action with the control's live state as its `availability`, so `/axe/state` answers per control. Served as parameterized domain actions instead (`domainActions`), `/axe/state` answers per domain action and each control's availability is on its `observe` row ([Choosing granularity](surface.md#choosing-granularity)). Make the surface's revision the site's: the protocol's stale check then runs before the handler, every envelope carries `rev`, and the revision the agent observed travels as the envelope's `expectedRev`; the per-row affordances that `observe` returns carry it as `expectedRev` too.

A comparison before the handler is not concurrency control on its own: two requests can both pass it at the same revision before either handler has changed anything. With a surface there are two gates behind it. The surface runs its acts one at a time and checks each again when it reaches execution, so a second request with the same `expectedRev` is `conflict` once the first has moved the revision. For state on a server, which other instances of the application can write, the handler receives the `expectedRev` and passes it into its own conditional write, refusing with a `SurfaceConflict` when the server has moved on; see [Writing under a precondition](surface.md#writing-under-a-precondition). A site without a surface has the same obligation in its handler, which receives `expectedRev` in its context.

<!-- include: examples/live-state/surface.ts#serve -->
```ts
import { createAXE } from "@summationai/axe-core";
import { createSurface } from "@summationai/axe-surface";
import { surfaceActions } from "@summationai/axe-surface/axe";

export const surface = createSurface({ app: "fantasy-draft" });

export const axe = createAXE({
  name: "Fantasy Draft",
  description:
    "A draft board: observe which players can be drafted right now, then draft, undo, or flag them under one revision.",
  baseUrl: "https://draft.example",
  auth: { modes: ["none", "user"], userLoginUrl: "https://draft.example/login" },
  secret: process.env.AXE_SECRET,
  // The surface already keeps one revision for the application; make it the site's. Every
  // envelope now carries `rev`, and an act whose envelope `expectedRev` is stale is refused by the
  // protocol before the surface's own check runs.
  revision: surface.currentRev,
});

// Every entry is its own action, with the entry's live state as its availability. Only signed-in
// callers observe and act (`auth: "user"`, the default, written out).
axe.addProvider(surfaceActions(surface, { namespace: "board", auth: "user" }));
```
<!-- /include -->

## Conformance and audit

When the manifest carries `live`, `axe conformance` runs six checks under `live.*`: the state endpoint's shape and `Cache-Control: no-store`, `rev` on every envelope, a stale `expectedRev` refused with `conflict` and both revisions in `details`, the current `rev` accepted, a reason on every unavailable action, and an unavailable action not completing with `ok`. They skip on sites without `live`. `axe audit` scores them as `actionable.live-state`, worth two points within Actionable, skipped (not penalized) when the site publishes no live state. The [conformance page](testing-and-conformance.md#live) lists each check.

## Next steps

- [Surface](surface.md): live controls with reasons, served as actions.
- [Concepts](concepts.md#idempotency): idempotency, which revisions complement.
- [Protocol §21](../spec/AXE-PROTOCOL.md#21-live-state-and-revisions): every rule, numbered.
