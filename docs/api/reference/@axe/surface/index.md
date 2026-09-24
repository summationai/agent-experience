[AXE API reference](../../README.md) / [@axe/surface](README.md) / index

# index

## Interfaces

<a id="accept"></a>

### Accept

#### Properties

<a id="description"></a>

##### description

```ts
description: string;
```

<a id="instructions"></a>

##### instructions?

```ts
optional instructions?: string;
```

<a id="kind"></a>

##### kind

```ts
kind: string;
```

<a id="schema"></a>

##### schema

```ts
schema: JsonSchema;
```

<a id="sensitive"></a>

##### sensitive

```ts
sensitive: boolean;
```

<a id="title"></a>

##### title

```ts
title: string;
```

***

<a id="actionentry"></a>

### ActionEntry

#### Properties

<a id="effect"></a>

##### effect

```ts
effect: Effect;
```

<a id="handler"></a>

##### handler

```ts
handler: (actor, text?) => unknown;
```

The control's own handler. May return a `HandlerReport`.

###### Parameters

###### actor

`string`

###### text?

`string`

###### Returns

`unknown`

<a id="id"></a>

##### id

```ts
id: string;
```

<a id="kind-1"></a>

##### kind

```ts
kind: "action";
```

<a id="name"></a>

##### name

```ts
name: string | (() => string);
```

<a id="object"></a>

##### object?

```ts
optional object?: string;
```

<a id="role"></a>

##### role

```ts
role: string;
```

<a id="state"></a>

##### state?

```ts
optional state?: Availability;
```

***

<a id="actoutput"></a>

### ActOutput

#### Properties

<a id="actor"></a>

##### actor

```ts
actor: string;
```

<a id="changed"></a>

##### changed

```ts
changed: string[];
```

<a id="id-1"></a>

##### id

```ts
id: string;
```

<a id="rev"></a>

##### rev

```ts
rev: number;
```

<a id="seq"></a>

##### seq

```ts
seq: number;
```

The ledger entry this act wrote.

***

<a id="actrequest"></a>

### ActRequest

#### Properties

<a id="actor-1"></a>

##### actor?

```ts
optional actor?: string;
```

<a id="confirm"></a>

##### confirm?

```ts
optional confirm?: boolean;
```

<a id="expectedrev"></a>

##### expectedRev

```ts
expectedRev: number;
```

The revision the agent observed. Required.

<a id="op"></a>

##### op

```ts
op: Op;
```

<a id="target"></a>

##### target

```ts
target: string | number;
```

Entry id (preferred) or the `index` from the observation the agent is acting on.

<a id="text"></a>

##### text?

```ts
optional text?: string;
```

***

<a id="collectionentry"></a>

### CollectionEntry

#### Properties

<a id="filter"></a>

##### filter?

```ts
optional filter?: JsonValue;
```

<a id="id-2"></a>

##### id

```ts
id: string;
```

<a id="kind-2"></a>

##### kind

```ts
kind: "collection";
```

<a id="loaded"></a>

##### loaded?

```ts
optional loaded?: number | null;
```

<a id="more"></a>

##### more?

```ts
optional more?: () => unknown;
```

Load more. Present makes the collection actionable with `SCROLL_DOWN`. May return a `HandlerReport`.

###### Returns

`unknown`

<a id="name-1"></a>

##### name

```ts
name: string | (() => string);
```

<a id="object-1"></a>

##### object?

```ts
optional object?: string;
```

<a id="role-1"></a>

##### role

```ts
role: string;
```

<a id="sort"></a>

##### sort?

```ts
optional sort?: JsonValue;
```

<a id="total"></a>

##### total?

```ts
optional total?: number | null;
```

***

<a id="effect-1"></a>

### Effect

What a control does, in AXE's terms. `undoable` is accepted as a legacy alias of `reversible`.

#### Properties

<a id="confirm-1"></a>

##### confirm?

```ts
optional confirm?: boolean;
```

The act must carry `confirm: true`.

<a id="idempotent"></a>

##### idempotent?

```ts
optional idempotent?: boolean;
```

Repeating the action has no additional effect. Default false.

<a id="mutates"></a>

##### mutates

```ts
mutates: string;
```

Name of the state this action changes, for example `draft`, `locks`, `prefs`.

<a id="reversible"></a>

##### reversible?

```ts
optional reversible?: boolean;
```

The effect can be undone by the user or the application. Default false.

<a id="risk"></a>

##### risk?

```ts
optional risk?: WireRisk;
```

AXE risk level. Default `medium`.

<a id="text-1"></a>

##### text?

```ts
optional text?: string;
```

The handler takes free text; this is the prompt for it ("reason for the lock").

<a id="undoable"></a>

##### ~~undoable?~~

```ts
optional undoable?: boolean;
```

###### Deprecated

Use `reversible`.

***

<a id="fieldentry"></a>

### FieldEntry

#### Properties

<a id="edit"></a>

##### edit

```ts
edit: 
  | {
  op?: "TYPE_TEXT";
  readOnly: true;
  reason?: string;
}
  | {
  maxLength?: number;
  op?: "TYPE_TEXT";
  readOnly?: false;
  schema?: SchemaLike | JsonSchema;
  set: (text, actor) => unknown;
};
```

###### Union Members

###### Type Literal

```ts
{
  op?: "TYPE_TEXT";
  readOnly: true;
  reason?: string;
}
```

***

###### Type Literal

```ts
{
  maxLength?: number;
  op?: "TYPE_TEXT";
  readOnly?: false;
  schema?: SchemaLike | JsonSchema;
  set: (text, actor) => unknown;
}
```

###### maxLength?

```ts
optional maxLength?: number;
```

###### op?

```ts
optional op?: "TYPE_TEXT";
```

###### readOnly?

```ts
optional readOnly?: false;
```

###### schema?

```ts
optional schema?: SchemaLike | JsonSchema;
```

Validate the typed text before `set` runs: a JSON Schema for a string, or a Zod schema
(anything with `safeParse`). A Zod schema needs `toJsonSchema` configured on the surface
so `observe()` can publish it; the surface itself stays free of Zod.

###### set

```ts
set: (text, actor) => unknown;
```

The control's own setter. May return a `HandlerReport`.

###### Parameters

###### text

`string`

###### actor

`string`

###### Returns

`unknown`

<a id="id-3"></a>

##### id

```ts
id: string;
```

<a id="kind-3"></a>

##### kind

```ts
kind: "field";
```

<a id="name-2"></a>

##### name

```ts
name: string | (() => string);
```

<a id="object-2"></a>

##### object?

```ts
optional object?: string;
```

<a id="role-2"></a>

##### role

```ts
role: string;
```

<a id="value"></a>

##### value?

```ts
optional value?: JsonValue;
```

***

<a id="frozen"></a>

### Frozen

The transient state a `freeze` reports on every entry.

#### Properties

<a id="reason"></a>

##### reason

```ts
reason: string;
```

***

<a id="handlerreport"></a>

### HandlerReport

What a handler, a field's `set`, or a collection's `more` may return (or resolve to) to tell the
surface what it did: `changed`, the entry ids whose state moved, and `rev`, the application's
revision after the change, adopted as `setRev(rev)` would adopt it before the act result is
built. Applications with a server revision report both here, since their revision arrives after
the handler; the surface otherwise infers `changed` only from a revision that moved during the
handler. Any other return value is ignored.

#### Properties

<a id="changed-1"></a>

##### changed?

```ts
optional changed?: string[];
```

<a id="rev-1"></a>

##### rev?

```ts
optional rev?: number;
```

***

<a id="handoffspec"></a>

### HandoffSpec

A handoff the application declares for a control only a human can activate. `url` is the page
where the person takes the step; leave it out when the step is taken inside the application
itself (a menu, a dialog) and no page names it. Without a `url` the handoff is reported in
`act`'s `error.details.handoff` and in the bridge's `availability`, and never becomes
`needs_human`, whose resume needs a page to come back from.

#### Properties

<a id="instructions-1"></a>

##### instructions

```ts
instructions: string;
```

<a id="reason-1"></a>

##### reason

```ts
reason: string;
```

<a id="url"></a>

##### url?

```ts
optional url?: string;
```

<a id="whatagentshouldsaytouser"></a>

##### whatAgentShouldSayToUser

```ts
whatAgentShouldSayToUser: string;
```

***

<a id="ledgerentry"></a>

### LedgerEntry

One line of the ledger: an act that ran, or a refusal, with who asked and which revisions it spanned (spec [S-LED-*]).

#### Properties

<a id="actor-2"></a>

##### actor

```ts
actor: string;
```

<a id="at"></a>

##### at

```ts
at: string;
```

When the entry was written.

<a id="changed-2"></a>

##### changed

```ts
changed: string[];
```

Entry ids whose state the act moved; empty for a refusal.

<a id="op-1"></a>

##### op

```ts
op: string;
```

The `op` as requested.

<a id="revafter"></a>

##### revAfter

```ts
revAfter: number;
```

The revision when the entry was written: after the handler ran, or unchanged for a refusal.

<a id="revbefore"></a>

##### revBefore

```ts
revBefore: number;
```

The revision when the act arrived.

<a id="seq-1"></a>

##### seq

```ts
seq: number;
```

1-based, increasing by one per act; never reused.

<a id="status"></a>

##### status

```ts
status: WireError | "ok";
```

`ok` when the handler ran and returned; otherwise the error code the act was refused with (`internal` when the handler threw).

<a id="target-1"></a>

##### target

```ts
target: string | number | null;
```

The entry id the act resolved to; for a refusal before the target resolved, the target as requested.

<a id="text-2"></a>

##### text?

```ts
optional text?: string;
```

***

<a id="ledgerquery"></a>

### LedgerQuery

#### Properties

<a id="actor-3"></a>

##### actor?

```ts
optional actor?: string;
```

Only entries by this actor.

<a id="limit"></a>

##### limit?

```ts
optional limit?: number;
```

At most this many entries: the oldest after `since` when `since` is given (so a reader can page forward), else the newest.

<a id="since"></a>

##### since?

```ts
optional since?: number;
```

Only entries with `seq` greater than this, oldest first, so an agent can ask what happened since it looked.

***

<a id="observation"></a>

### Observation

#### Properties

<a id="app"></a>

##### app

```ts
app: string;
```

<a id="at-1"></a>

##### at

```ts
at: string;
```

<a id="entries"></a>

##### entries

```ts
entries: ObservedEntry[];
```

<a id="frozen-1"></a>

##### frozen?

```ts
optional frozen?: Frozen;
```

Present while the application holds a `freeze`: every entry is unavailable for this reason.

<a id="ledgerseq"></a>

##### ledgerSeq

```ts
ledgerSeq: number;
```

The latest ledger `seq`, so an agent can ask `ledger({ since })` for what happened since it looked.

<a id="objects"></a>

##### objects

```ts
objects: Record<string, JsonValue>;
```

<a id="protocol"></a>

##### protocol

```ts
protocol: string;
```

<a id="rev-2"></a>

##### rev

```ts
rev: number;
```

***

<a id="observedentry"></a>

### ObservedEntry

One row of `observe()`.

#### Properties

<a id="edit-1"></a>

##### edit?

```ts
optional edit?: object;
```

###### maxLength

```ts
maxLength: number | null;
```

###### op

```ts
op: "TYPE_TEXT";
```

###### readOnly

```ts
readOnly: boolean;
```

###### reason

```ts
reason: string | null;
```

###### schema?

```ts
optional schema?: JsonSchema;
```

<a id="effect-2"></a>

##### effect?

```ts
optional effect?: object;
```

###### confirm?

```ts
optional confirm?: boolean;
```

###### idempotent

```ts
idempotent: boolean;
```

###### mutates

```ts
mutates: string;
```

###### readOnly

```ts
readOnly: false;
```

###### reversible

```ts
reversible: boolean;
```

###### risk

```ts
risk: WireRisk;
```

###### text?

```ts
optional text?: string;
```

<a id="filter-1"></a>

##### filter?

```ts
optional filter?: JsonValue;
```

<a id="id-4"></a>

##### id

```ts
id: string;
```

<a id="index"></a>

##### index

```ts
index: number | null;
```

<a id="kind-4"></a>

##### kind

```ts
kind: EntryKind;
```

<a id="loaded-1"></a>

##### loaded?

```ts
optional loaded?: number | null;
```

<a id="name-3"></a>

##### name

```ts
name: string;
```

<a id="object-3"></a>

##### object

```ts
object: string | null;
```

<a id="rev-3"></a>

##### rev

```ts
rev: number;
```

<a id="role-3"></a>

##### role

```ts
role: string;
```

<a id="sort-1"></a>

##### sort?

```ts
optional sort?: JsonValue;
```

<a id="state-1"></a>

##### state?

```ts
optional state?: object;
```

###### available

```ts
available: boolean;
```

###### handoff?

```ts
optional handoff?: HandoffSpec;
```

###### reason

```ts
reason: string | null;
```

###### requires?

```ts
optional requires?: Accept[];
```

<a id="total-1"></a>

##### total?

```ts
optional total?: number | null;
```

<a id="value-1"></a>

##### value?

```ts
optional value?: JsonValue;
```

***

<a id="schemalike"></a>

### SchemaLike

The structural shape of a validation schema the surface accepts beside a JSON Schema: anything
with `safeParse`, which is a Zod schema. The surface never imports Zod; it calls `safeParse` to
validate and uses the `toJsonSchema` you configure to publish the schema in `observe()`.

#### Methods

<a id="safeparse"></a>

##### safeParse()

```ts
safeParse(value): object;
```

###### Parameters

###### value

`unknown`

###### Returns

`object`

###### error?

```ts
optional error?: object;
```

###### error.issues

```ts
issues: object[];
```

###### success

```ts
success: boolean;
```

***

<a id="surface"></a>

### Surface

#### Methods

<a id="act"></a>

##### act()

```ts
act(request, options?): Promise<ActResult>;
```

###### Parameters

###### request

[`ActRequest`](#actrequest)

###### options?

###### run?

(`fn`) => `unknown`

###### Returns

`Promise`\<[`ActResult`](#actresult)\>

<a id="attributesfor"></a>

##### attributesFor()

```ts
attributesFor(id): SurfaceAttributeUpdate | undefined;
```

The DOM mirror for one registered entry as it stands now ([S-DOM-1]): `set`, the attributes
the control carries, computed from `availability(id)` so a freeze shows as `aria-disabled` or
`aria-readonly` with the freeze's reason; and `remove`, every canonical Surface attribute
(`SURFACE_ATTRIBUTES`) not in `set`, so a renderer that applies both never leaves last
render's reason behind. Undefined for an unknown id.

###### Parameters

###### id

`string`

###### Returns

[`SurfaceAttributeUpdate`](#surfaceattributeupdate) \| `undefined`

<a id="availability"></a>

##### availability()

```ts
availability(id): EntryAvailability | undefined;
```

The live availability of one entry as the AXE bridge publishes it ([S-AXE-6]): an action's own
`state` (with `requires` as `accepts` entries), a field's read-only reason, whether a collection
can load more, and the freeze's reason for every kind while frozen. Undefined for an unknown id.

###### Parameters

###### id

`string`

###### Returns

[`EntryAvailability`](#entryavailability) \| `undefined`

<a id="bump"></a>

##### bump()

```ts
bump(meta?): number;
```

Advance the revision after a change and notify listeners. Marks the revision `surface`-owned unless pinned.

###### Parameters

###### meta?

`Record`\<`string`, [`JsonValue`](#jsonvalue)\>

###### Returns

`number`

<a id="configure"></a>

##### configure()

```ts
configure(options): void;
```

###### Parameters

###### options

###### app?

`string`

###### toJsonSchema?

[`SchemaConverter`](#schemaconverter)

###### Returns

`void`

<a id="currentrev"></a>

##### currentRev()

```ts
currentRev(): number;
```

###### Returns

`number`

<a id="entries-1"></a>

##### entries()

```ts
entries(): Entry[];
```

Every registered entry, in registration order.

###### Returns

[`Entry`](#entry)[]

<a id="expose"></a>

##### expose()

```ts
expose(host?, options?): void;
```

Publish `observe`, `act`, `ledger`, and `rev` on a host object (`window.__surface`) for browser agents.

###### Parameters

###### host?

`object` \| `null`

###### options?

###### run?

(`fn`) => `unknown`

###### Returns

`void`

<a id="freeze"></a>

##### freeze()

```ts
freeze(reason): Thaw;
```

Report every entry unavailable with `reason` while a transient state lasts (a save in flight,
a modal open), and notify `onChange` listeners now and again on `thaw`. In `surface` revision
mode the revision moves on both ends, so an act planned before the freeze is refused as
`conflict`; in `app` mode it stays with the application's revision, so such an act is
`unavailable` while frozen and accepted afterwards exactly when the application's revision did
not move. Freezes nest: the surface thaws when the last one is released.

###### Parameters

###### reason

`string`

###### Returns

[`Thaw`](#thaw)

<a id="get"></a>

##### get()

```ts
get(id): Entry | undefined;
```

Look up a registered entry.

###### Parameters

###### id

`string`

###### Returns

[`Entry`](#entry) \| `undefined`

<a id="ledger"></a>

##### ledger()

```ts
ledger(query?): LedgerEntry[];
```

The ledger: every act and every refusal, oldest first. See `LedgerQuery` for `since`, `actor`, and `limit`.

###### Parameters

###### query?

[`LedgerQuery`](#ledgerquery)

###### Returns

[`LedgerEntry`](#ledgerentry)[]

<a id="observe"></a>

##### observe()

```ts
observe(): Observation;
```

###### Returns

[`Observation`](#observation)

<a id="onchange"></a>

##### onChange()

```ts
onChange(fn): () => void;
```

###### Parameters

###### fn

(`event`) => `void`

###### Returns

() => `void`

<a id="reconcile"></a>

##### reconcile()

```ts
reconcile(prefix, keep): void;
```

Drop every entry whose id starts with `prefix` and is not in `keep`. Adapters that re-scan a rendered region use this.

###### Parameters

###### prefix

`string`

###### keep

`Set`\<`string`\>

###### Returns

`void`

<a id="register"></a>

##### register()

```ts
register(entry): void;
```

###### Parameters

###### entry

[`Entry`](#entry)

###### Returns

`void`

<a id="registryversion"></a>

##### registryVersion()

```ts
registryVersion(): number;
```

A counter that moves on every `register`, `unregister`, `reconcile`, and `reset`, and on nothing
else: a `bump` alone leaves it. Consumers that derive something per entry (the AXE bridge's one
action per control) rebuild when it changes and reuse their work when it has not.

###### Returns

`number`

<a id="reset"></a>

##### reset()

```ts
reset(): void;
```

Forget everything. Tests.

###### Returns

`void`

<a id="revisionmode"></a>

##### revisionMode()

```ts
revisionMode(): RevisionMode;
```

Who moves the revision right now: `surface` (`bump`) or `app` (`setRev`).

###### Returns

[`RevisionMode`](#revisionmode-1)

<a id="seedrev"></a>

##### seedRev()

```ts
seedRev(n): void;
```

Adopt a persisted revision if it is ahead of the current one. Leaves the revision mode alone.

###### Parameters

###### n

`number`

###### Returns

`void`

<a id="setobjects"></a>

##### setObjects()

```ts
setObjects(fn): void;
```

###### Parameters

###### fn

() => `Record`\<`string`, [`JsonValue`](#jsonvalue)\>

###### Returns

`void`

<a id="setrev"></a>

##### setRev()

```ts
setRev(n): void;
```

The application owns the counter: adopt its value as is. Marks the revision `app`-owned unless pinned.

###### Parameters

###### n

`number`

###### Returns

`void`

<a id="unregister"></a>

##### unregister()

```ts
unregister(id): void;
```

###### Parameters

###### id

`string`

###### Returns

`void`

***

<a id="surfaceattributeupdate"></a>

### SurfaceAttributeUpdate

What `attributesFor(id)` returns: attributes to set, and canonical attributes to remove.

#### Properties

<a id="remove"></a>

##### remove

```ts
remove: string[];
```

<a id="set"></a>

##### set

```ts
set: SurfaceAttributes;
```

***

<a id="surfaceoptions"></a>

### SurfaceOptions

#### Properties

<a id="app-1"></a>

##### app?

```ts
optional app?: string;
```

<a id="ledger-1"></a>

##### ledger?

```ts
optional ledger?: object;
```

Ledger retention. `max` is the number of most recent entries kept; default 1000.

###### max?

```ts
optional max?: number;
```

<a id="now"></a>

##### now?

```ts
optional now?: () => Date;
```

Clock for `observe().at`; injectable for deterministic tests and builds.

###### Returns

`Date`

<a id="revision"></a>

##### revision?

```ts
optional revision?: RevisionMode;
```

Pin who moves the revision (`RevisionMode`). Omitted, the mode follows the last of `bump()`
(`surface`) and `setRev()` (`app`), starting as `surface`.

<a id="tojsonschema"></a>

##### toJsonSchema?

```ts
optional toJsonSchema?: SchemaConverter;
```

Converts a Zod schema to JSON Schema for `observe()`: pass `toJsonSchema` from `@axe/core`.
Required only when an entry carries a Zod schema (`edit.schema`, `requires.accepts[].schema`);
the surface does not import Zod itself, so a browser bundle without Zod stays without it.

## Type Aliases

<a id="actresult"></a>

### ActResult

```ts
type ActResult = 
  | OkResult<ActOutput>
  | ErrorResult;
```

`act()` returns the AXE result envelope: `ok`, or `error` with `conflict` (stale), `not_found`, `invalid_input`, or `unavailable`. Every result carries the `seq` of its ledger entry (`output.seq`, or `error.details.seq`).

***

<a id="availability-1"></a>

### Availability

```ts
type Availability = 
  | {
  available: true;
  reason?: null;
}
  | {
  available: false;
  handoff?: HandoffSpec;
  reason: string;
  requires?: {
     accepts: AcceptInput[];
     fulfill: (kind, payload, actor) => MaybePromise<void>;
  };
};
```

Why a control is unavailable, and what would change that.

#### Union Members

##### Type Literal

```ts
{
  available: true;
  reason?: null;
}
```

***

##### Type Literal

```ts
{
  available: false;
  handoff?: HandoffSpec;
  reason: string;
  requires?: {
     accepts: AcceptInput[];
     fulfill: (kind, payload, actor) => MaybePromise<void>;
  };
}
```

###### available

```ts
available: false;
```

###### handoff?

```ts
optional handoff?: HandoffSpec;
```

A step only a human can take on the application.

###### reason

```ts
reason: string;
```

Plain language, in the application's own words: "already drafted by another team".

###### requires?

```ts
optional requires?: object;
```

Kinds an agent could supply to make the control available, and how to apply one.

###### requires.accepts

```ts
accepts: AcceptInput[];
```

###### requires.fulfill

```ts
fulfill: (kind, payload, actor) => MaybePromise<void>;
```

###### Parameters

###### kind

`string`

###### payload

[`JsonValue`](#jsonvalue)

###### actor

`string`

###### Returns

[`MaybePromise`](#maybepromise)\<`void`\>

***

<a id="entry"></a>

### Entry

```ts
type Entry = 
  | ActionEntry
  | FieldEntry
  | CollectionEntry;
```

***

<a id="entryavailability"></a>

### EntryAvailability

```ts
type EntryAvailability = 
  | {
  available: true;
}
  | {
  available: false;
  handoff?: WireHandoffSpec;
  reason: string;
  requires?: Accept[];
};
```

What `availability(id)` returns: the wire shape of an unavailable-with-reason report.

***

<a id="entrykind"></a>

### EntryKind

```ts
type EntryKind = "action" | "field" | "collection";
```

***

<a id="jsonvalue"></a>

### JsonValue

```ts
type JsonValue = 
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | {
[key: string]: JsonValue;
};
```

A JSON value.

***

<a id="maybepromise"></a>

### MaybePromise

```ts
type MaybePromise<T> = T | Promise<T>;
```

#### Type Parameters

##### T

`T`

***

<a id="op-2"></a>

### Op

```ts
type Op = "CLICK" | "TOGGLE" | "TYPE_TEXT" | "SCROLL_DOWN";
```

***

<a id="result"></a>

### Result

```ts
type Result<O> = 
  | OkResult<O>
  | NeedsInputResult
  | NeedsHumanResult
  | PendingResult
  | ErrorResult;
```

The result envelope: every AXE response body is one of these.

#### Type Parameters

##### O

`O` = [`JsonValue`](#jsonvalue)

***

<a id="revisionmode-1"></a>

### RevisionMode

```ts
type RevisionMode = "surface" | "app";
```

Who moves the revision. `surface`: the application calls `bump()` after every change, and
`freeze`/`thaw` move the revision too. `app`: the application adopts its own revision with
`setRev()` (a server counter), and `freeze`/`thaw` leave it alone, since a freeze is not a change
of the application's state. Unless pinned by `createSurface({ revision })`, the mode follows the
last call: `bump()` makes it `surface`, `setRev()` makes it `app`.

***

<a id="risk-1"></a>

### Risk

```ts
type Risk = WireRisk;
```

***

<a id="schemaconverter"></a>

### SchemaConverter

```ts
type SchemaConverter = (schema, io) => JsonSchema;
```

Renders a Zod schema as JSON Schema for `observe()`. `toJsonSchema` from `@axe/core` fits as it
is; the parameter is typed `never` so that a converter over any concrete schema type fits too.

#### Parameters

##### schema

`never`

##### io

`"input"`

#### Returns

`JsonSchema`

***

<a id="surfaceattributes"></a>

### SurfaceAttributes

```ts
type SurfaceAttributes = Record<string, string>;
```

Attributes a rendered control carries, as `surfaceAttributes` returns them. Values are strings; React callers use `useSurfaceProps`.

***

<a id="thaw"></a>

### Thaw

```ts
type Thaw = () => void;
```

Releases one `freeze`. Calling it more than once is harmless.

#### Returns

`void`

## Variables

<a id="act-1"></a>

### act

```ts
act: (request, options?) => Promise<ActResult>;
```

#### Parameters

##### request

[`ActRequest`](#actrequest)

##### options?

###### run?

(`fn`) => `unknown`

#### Returns

`Promise`\<[`ActResult`](#actresult)\>

***

<a id="bump-1"></a>

### bump

```ts
bump: (meta?) => number;
```

Advance the revision after a change and notify listeners. Marks the revision `surface`-owned unless pinned.

#### Parameters

##### meta?

`Record`\<`string`, [`JsonValue`](#jsonvalue)\>

#### Returns

`number`

***

<a id="configure-1"></a>

### configure

```ts
configure: (options) => void;
```

#### Parameters

##### options

###### app?

`string`

###### toJsonSchema?

[`SchemaConverter`](#schemaconverter)

#### Returns

`void`

***

<a id="currentrev-1"></a>

### currentRev

```ts
currentRev: () => number;
```

#### Returns

`number`

***

<a id="expose-1"></a>

### expose

```ts
expose: (host?, options?) => void;
```

Publish `observe`, `act`, `ledger`, and `rev` on a host object (`window.__surface`) for browser agents.

#### Parameters

##### host?

`object` \| `null`

##### options?

###### run?

(`fn`) => `unknown`

#### Returns

`void`

***

<a id="freeze-1"></a>

### freeze

```ts
freeze: (reason) => Thaw;
```

Report every entry unavailable with `reason` while a transient state lasts (a save in flight,
a modal open), and notify `onChange` listeners now and again on `thaw`. In `surface` revision
mode the revision moves on both ends, so an act planned before the freeze is refused as
`conflict`; in `app` mode it stays with the application's revision, so such an act is
`unavailable` while frozen and accepted afterwards exactly when the application's revision did
not move. Freezes nest: the surface thaws when the last one is released.

#### Parameters

##### reason

`string`

#### Returns

[`Thaw`](#thaw)

***

<a id="ledger-2"></a>

### ledger

```ts
ledger: (query?) => LedgerEntry[];
```

The ledger: every act and every refusal, oldest first. See `LedgerQuery` for `since`, `actor`, and `limit`.

#### Parameters

##### query?

[`LedgerQuery`](#ledgerquery)

#### Returns

[`LedgerEntry`](#ledgerentry)[]

***

<a id="observe-1"></a>

### observe

```ts
observe: () => Observation;
```

#### Returns

[`Observation`](#observation)

***

<a id="onchange-1"></a>

### onChange

```ts
onChange: (fn) => () => void;
```

#### Parameters

##### fn

(`event`) => `void`

#### Returns

() => `void`

***

<a id="reconcile-1"></a>

### reconcile

```ts
reconcile: (prefix, keep) => void;
```

Drop every entry whose id starts with `prefix` and is not in `keep`. Adapters that re-scan a rendered region use this.

#### Parameters

##### prefix

`string`

##### keep

`Set`\<`string`\>

#### Returns

`void`

***

<a id="register-1"></a>

### register

```ts
register: (entry) => void;
```

#### Parameters

##### entry

[`Entry`](#entry)

#### Returns

`void`

***

<a id="seedrev-1"></a>

### seedRev

```ts
seedRev: (n) => void;
```

Adopt a persisted revision if it is ahead of the current one. Leaves the revision mode alone.

#### Parameters

##### n

`number`

#### Returns

`void`

***

<a id="setobjects-1"></a>

### setObjects

```ts
setObjects: (fn) => void;
```

#### Parameters

##### fn

() => `Record`\<`string`, [`JsonValue`](#jsonvalue)\>

#### Returns

`void`

***

<a id="setrev-1"></a>

### setRev

```ts
setRev: (n) => void;
```

The application owns the counter: adopt its value as is. Marks the revision `app`-owned unless pinned.

#### Parameters

##### n

`number`

#### Returns

`void`

***

<a id="surface-1"></a>

### surface

```ts
const surface: Surface;
```

Convenience: a module-level surface with the same function names as the original `lib/surface.js`.

***

<a id="surface_attributes"></a>

### SURFACE\_ATTRIBUTES

```ts
const SURFACE_ATTRIBUTES: readonly string[];
```

Every attribute the DOM mirror may set ([S-DOM-1]), from the vocabulary's `domAttribute` table.

***

<a id="unregister-1"></a>

### unregister

```ts
unregister: (id) => void;
```

#### Parameters

##### id

`string`

#### Returns

`void`

## Functions

<a id="createsurface"></a>

### createSurface()

```ts
function createSurface(options?): Surface;
```

Create a surface. Applications usually create one per page and call `expose()`.

#### Parameters

##### options?

[`SurfaceOptions`](#surfaceoptions) = `{}`

#### Returns

[`Surface`](#surface)

***

<a id="describeentry"></a>

### describeEntry()

```ts
function describeEntry(entry): string;
```

One plain-text line about an entry, for a screen reader or an agent log [S-DOM-4]:
`Draft Jahmyr Gibbs (RB): unavailable, already drafted by another team; mutates draft, reversible, risk medium`.

#### Parameters

##### entry

[`Entry`](#entry) \| [`ObservedEntry`](#observedentry)

#### Returns

`string`

***

<a id="surfaceattributes-1"></a>

### surfaceAttributes()

```ts
function surfaceAttributes(entry): SurfaceAttributes;
```

The attributes the control for `entry` carries [S-DOM-1], read from the entry itself: `aria-label`
(the entry name, so browser agents and screen readers read the outcome), `data-surface-id`,
`data-surface-kind`, `data-surface-object` when the entry has one, `aria-disabled="true"` plus
`data-surface-reason` on an unavailable action, and `aria-readonly="true"` plus
`data-surface-reason` on a read-only field. Collections carry the common set only. Set them on
the element that receives the interaction; `surfaceSelector(id)` finds it again.

This is the static reading: it knows the entry's own `state` and `edit` and nothing of a freeze,
and it returns only what to set. For a control that is re-rendered while the surface lives, use
`surface.attributesFor(id)`, which reads the live availability and also says what to remove.

#### Parameters

##### entry

[`Entry`](#entry) \| [`ObservedEntry`](#observedentry)

#### Returns

[`SurfaceAttributes`](#surfaceattributes)

***

<a id="surfaceselector"></a>

### surfaceSelector()

```ts
function surfaceSelector(id): string;
```

A CSS selector for the control that carries `data-surface-id` equal to `id` [S-DOM-3]. The id
is quoted and escaped, so ids with colons, spaces, quotes, or backslashes work as they are.

#### Parameters

##### id

`string`

#### Returns

`string`
