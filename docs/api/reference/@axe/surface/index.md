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

Load more. Present makes the collection actionable with `SCROLL_DOWN`.

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
  schema?:   | JsonSchema
     | {
     safeParse: unknown;
   };
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
  schema?:   | JsonSchema
     | {
     safeParse: unknown;
   };
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
optional schema?: 
  | JsonSchema
  | {
  safeParse: unknown;
};
```

Validate the typed text before `set` runs. A Zod schema or a JSON Schema for a string.

###### set

```ts
set: (text, actor) => unknown;
```

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

<a id="handoffspec"></a>

### HandoffSpec

A handoff the application declares for a control only a human can activate.

#### Properties

<a id="instructions-1"></a>

##### instructions

```ts
instructions: string;
```

<a id="reason"></a>

##### reason

```ts
reason: string;
```

<a id="url"></a>

##### url

```ts
url: string;
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

<a id="changed-1"></a>

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

<a id="rev-1"></a>

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

<a id="rev-2"></a>

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
optional handoff?: Omit<Handoff, "resumeToken" | "expiresAt">;
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

<a id="bump"></a>

##### bump()

```ts
bump(meta?): number;
```

Advance the revision after a change and notify listeners.

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

###### Returns

`void`

<a id="currentrev"></a>

##### currentRev()

```ts
currentRev(): number;
```

###### Returns

`number`

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

<a id="reset"></a>

##### reset()

```ts
reset(): void;
```

Forget everything. Tests.

###### Returns

`void`

<a id="seedrev"></a>

##### seedRev()

```ts
seedRev(n): void;
```

Adopt a persisted revision if it is ahead of the current one.

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

The application owns the counter: adopt its value as is.

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

<a id="availability"></a>

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

<a id="risk-1"></a>

### Risk

```ts
type Risk = WireRisk;
```

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

Advance the revision after a change and notify listeners.

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

Adopt a persisted revision if it is ahead of the current one.

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

The application owns the counter: adopt its value as is.

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
