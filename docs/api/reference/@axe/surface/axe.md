[AXE API reference](../../README.md) / [@axe/surface](README.md) / axe

# axe

## Interfaces

<a id="domainactionsoptions"></a>

### DomainActionsOptions

#### Extends

- `Omit`\<[`SurfaceActionsOptions`](#surfaceactionsoptions), `"authFor"`\>

#### Properties

<a id="actor"></a>

##### actor?

```ts
optional actor?: (context) => string;
```

Actor recorded for acts that arrive through AXE. Default: the authenticated `onBehalfOf`, else `agent`.

###### Parameters

###### context

###### onBehalfOf?

`string`

###### Returns

`string`

###### Inherited from

[`SurfaceActionsOptions`](#surfaceactionsoptions).[`actor`](#actor-1)

<a id="auth"></a>

##### auth?

```ts
optional auth?: WireAuthMode;
```

Who may call the actions the bridge generates ([S-AUTH-1]): `user` (the default), `site`, or
`none`. Every mode used must be in the server's `auth.modes`, or the server refuses the
provider on its first request, so a public server cannot serve a surface by accident. `none`
makes the surface public over HTTP: pass it only for data you would publish on the open web.

###### Inherited from

[`SurfaceActionsOptions`](#surfaceactionsoptions).[`auth`](#auth-2)

<a id="domains"></a>

##### domains?

```ts
optional domains?: DomainActionSpec[];
```

The parameterized actions, in the order they are published. Fixed for the life of the
bridge: the manifest and the MCP tool list do not change as rows register and unregister.
Default: `set-field` (every field), `run-control` (every action entry, declared `risk: "high"`,
not reversible, not idempotent, so every control fits), and `load-more` (every collection).

<a id="fields"></a>

##### fields?

```ts
optional fields?: object;
```

Metadata declared for field entries, which carry no `effect` of their own. Default `risk: "medium"`, `reversible: false`.

###### reversible?

```ts
optional reversible?: boolean;
```

###### risk?

```ts
optional risk?: "low" | "medium" | "high";
```

###### Inherited from

[`SurfaceActionsOptions`](#surfaceactionsoptions).[`fields`](#fields-1)

<a id="namespace"></a>

##### namespace?

```ts
optional namespace?: string;
```

Action namespace. Default `surface`, giving `surface.observe`, `surface.ledger`, and `surface.<slug>` per entry.

###### Inherited from

[`SurfaceActionsOptions`](#surfaceactionsoptions).[`namespace`](#namespace-1)

<a id="observe"></a>

##### observe?

```ts
optional observe?: ObservePageOptions;
```

Page size of `<ns>.observe` ([S-OBS-5]). Default for `surfaceActions`: 1000 rows per page
and at most 1000, so a surface of up to 1000 rows is one page as before; for
`domainActions`: 50 rows per page and at most 200.

###### Inherited from

[`SurfaceActionsOptions`](#surfaceactionsoptions).[`observe`](#observe-1)

<a id="onerror"></a>

##### onError?

```ts
optional onError?: (error, entryId) => void;
```

Called when an entry cannot be published as an action (its text fails the honesty lint, for
example). The entry stays in `<ns>.observe`; it has no action of its own. Default: `console.warn`, once per entry.

###### Parameters

###### error

`unknown`

###### entryId

`string`

###### Returns

`void`

###### Inherited from

[`SurfaceActionsOptions`](#surfaceactionsoptions).[`onError`](#onerror-1)

<a id="read"></a>

##### read?

```ts
optional read?: WireAuthMode;
```

The mode of `<ns>.observe` and `<ns>.ledger`, the read side ([S-AUTH-2]). Default: `auth`.

###### Inherited from

[`SurfaceActionsOptions`](#surfaceactionsoptions).[`read`](#read-1)

<a id="redactevent"></a>

##### redactEvent?

```ts
optional redactEvent?: (details, context) => Record<string, JsonValue>;
```

Rewrites the `details` of each `surface.act` action event before it is emitted ([S-PRV-3]).
The bridge already leaves out text and values; use this to drop or mask ids that are
themselves personal (an entry id built from an email address, for example).

###### Parameters

###### details

`Record`\<`string`, [`JsonValue`](index.md#jsonvalue)\>

###### context

###### action

`string`

###### entryId

`string`

###### Returns

`Record`\<`string`, [`JsonValue`](index.md#jsonvalue)\>

###### Inherited from

[`SurfaceActionsOptions`](#surfaceactionsoptions).[`redactEvent`](#redactevent-1)

<a id="run"></a>

##### run?

```ts
optional run?: (fn) => unknown;
```

How the application runs handlers (for example React's `flushSync`).

###### Parameters

###### fn

() => `unknown`

###### Returns

`unknown`

###### Inherited from

[`SurfaceActionsOptions`](#surfaceactionsoptions).[`run`](#run-1)

<a id="template"></a>

##### template?

```ts
optional template?: Surface;
```

With a resolver in place of a surface ([S-AUTH-4]): the surface whose entries define the
action set, the same for every caller, as the manifest shows it. Its entries are the
application's shape (names without anyone's data); each caller's own surface supplies the
state, the values, and the handlers. Required with a resolver, ignored with a surface.

###### Inherited from

[`SurfaceActionsOptions`](#surfaceactionsoptions).[`template`](#template-1)

***

<a id="domainactionspec"></a>

### DomainActionSpec

One parameterized action of `domainActions` ([S-AXE-10]): a stable name, the application's own
title and description, the entries it acts on, and risk metadata that holds for every one of
them. The action takes `{ entryId, text?, confirm? }` and runs the entry's own op through
`surface.act`, exactly as the entry's per-control action would.

#### Properties

<a id="auth-1"></a>

##### auth?

```ts
optional auth?: WireAuthMode;
```

Auth mode of this action; default the bridge's `auth`.

<a id="covers"></a>

##### covers

```ts
covers: (entry) => boolean;
```

Which entries the action acts on. Asked once per registered entry object; an entry that more
than one spec covers belongs to the first. Select by `kind`, by `object` or id prefix, or by
`effect.mutates`: whatever makes a group the application would name.

###### Parameters

###### entry

[`Entry`](index.md#entry)

###### Returns

`boolean`

<a id="description"></a>

##### description

```ts
description: string;
```

Composed into the action's description, before the bridge's sentence on `entryId` and refusals.

<a id="humanhandoff"></a>

##### humanHandoff?

```ts
optional humanHandoff?: object;
```

The handoff reasons a covered control may return as `needs_human` (protocol `humanHandoff`).
The per-control action derives it from the entry; a parameterized action cannot know its
entries in advance, so the application declares it.

###### reasons

```ts
reasons: string[];
```

<a id="idempotent"></a>

##### idempotent?

```ts
optional idempotent?: boolean;
```

True only when every covered entry is idempotent; an entry that is not is left uncovered. Default false.

<a id="idlereason"></a>

##### idleReason?

```ts
optional idleReason?: string;
```

The `availability` reason when no entry the action covers can be acted on now (and the
surface is not frozen, when the freeze's reason is reported instead). Default: "nothing on
the page can be changed this way right now".

<a id="name"></a>

##### name

```ts
name: string;
```

The name under the namespace: `set-demand` is served as `<ns>.set-demand`. Lowercase letters, digits, hyphens.

<a id="reversible"></a>

##### reversible?

```ts
optional reversible?: boolean;
```

True only when every covered entry is reversible; an entry that is not is left uncovered. Default false.

<a id="risk"></a>

##### risk

```ts
risk: "low" | "medium" | "high";
```

The highest risk of any entry the action acts on. An entry whose own risk is higher is not
covered: it is reported through `onError` and keeps its row in `<ns>.observe` without an
affordance, so the published risk is never lower than a control's own ([P-HON-7]).

<a id="title"></a>

##### title

```ts
title: string;
```

What the action does, in the application's words ("Set a month's demand").

***

<a id="domainbridge"></a>

### DomainBridge

What `domainActions()` returns: an `ActionProvider` for `axe.addProvider()`, plus the coverage map.

#### Extends

- `ActionProvider`

#### Methods

<a id="actionfor"></a>

##### actionFor()

```ts
actionFor(entryId): string | undefined;
```

The action that acts on this entry now, or undefined when no spec covers it (or the id is unknown).

###### Parameters

###### entryId

`string`

###### Returns

`string` \| `undefined`

<a id="actions"></a>

##### actions()

```ts
actions(): readonly RegisteredAction<ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>, ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>, JsonValue>[];
```

`<ns>.observe`, `<ns>.ledger`, then the domain actions in declaration order.

###### Returns

readonly `RegisteredAction`\<`ZodType`\<`unknown`, `unknown`, `$ZodTypeInternals`\<`unknown`, `unknown`\>\>, `ZodType`\<`unknown`, `unknown`, `$ZodTypeInternals`\<`unknown`, `unknown`\>\>, [`JsonValue`](index.md#jsonvalue)\>[]

###### Overrides

```ts
ActionProvider.actions
```

<a id="covered"></a>

##### covered()

```ts
covered(actionName): string[];
```

The ids of the registered entries an action covers, in registration order.

###### Parameters

###### actionName

`string`

###### Returns

`string`[]

<a id="get"></a>

##### get()

```ts
get(name): 
  | RegisteredAction<ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>, ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>, JsonValue>
  | undefined;
```

One action by name, or undefined. Lets the server invoke without scanning `actions()`;
without it the server scans, which is fine for a handful of actions and not for hundreds.

###### Parameters

###### name

`string`

###### Returns

  \| `RegisteredAction`\<`ZodType`\<`unknown`, `unknown`, `$ZodTypeInternals`\<`unknown`, `unknown`\>\>, `ZodType`\<`unknown`, `unknown`, `$ZodTypeInternals`\<`unknown`, `unknown`\>\>, [`JsonValue`](index.md#jsonvalue)\>
  \| `undefined`

###### Overrides

```ts
ActionProvider.get
```

<a id="onchange"></a>

##### onChange()

```ts
onChange(listener): () => void;
```

The set never changes shape; the listener is accepted and never called.

###### Parameters

###### listener

() => `void`

###### Returns

() => `void`

###### Overrides

```ts
ActionProvider.onChange
```

<a id="onresult"></a>

##### onResult()

```ts
onResult(ctx, result): Promise<void>;
```

As `SurfaceBridge.onResult` ([S-AXE-14]): records a refusal the runtime made before a domain
action's handler ran, with the input's `entryId` as the target when it has one (else the
action name) and the op that entry's own action would use.

###### Parameters

###### ctx

`ProviderResultContext`

###### result

[`Result`](index.md#result)

###### Returns

`Promise`\<`void`\>

###### Overrides

```ts
ActionProvider.onResult
```

***

<a id="observepageoptions"></a>

### ObservePageOptions

Page size of `<ns>.observe` ([S-OBS-5]). `pageSize` is the number of rows returned when the
call gives no `limit`; `maxPageSize` is the largest `limit` accepted. Both are published in
the action's `pagination`.

#### Properties

<a id="maxpagesize"></a>

##### maxPageSize?

```ts
optional maxPageSize?: number;
```

<a id="pagesize"></a>

##### pageSize?

```ts
optional pageSize?: number;
```

***

<a id="observequery"></a>

### ObserveQuery

The filters and paging `<ns>.observe` accepts ([S-OBS-5]). Every member is optional.

#### Properties

<a id="available"></a>

##### available?

```ts
optional available?: boolean;
```

`true`: only rows that can be acted on now (those with an `index`); `false`: only rows that cannot.

<a id="cursor"></a>

##### cursor?

```ts
optional cursor?: string;
```

The `nextCursor` of the previous page, with the same filters.

<a id="kind"></a>

##### kind?

```ts
optional kind?: EntryKind;
```

<a id="limit"></a>

##### limit?

```ts
optional limit?: number;
```

Rows per page, at most the bridge's `maxPageSize`.

<a id="object"></a>

##### object?

```ts
optional object?: string;
```

Only rows whose `object` is exactly this.

<a id="query"></a>

##### query?

```ts
optional query?: string;
```

Case-insensitive substring of the row's `name`, `id`, or `object`.

***

<a id="scopedsurfaces"></a>

### ScopedSurfaces

What `scopedSurfaces()` returns: the resolver for `surfaceActions`, plus the cache it keeps.

#### Properties

<a id="resolve"></a>

##### resolve

```ts
resolve: SurfaceResolver;
```

#### Methods

<a id="delete"></a>

##### delete()

```ts
delete(key): boolean;
```

Evict a scope now (a user signed out, a tenant was removed).

###### Parameters

###### key

`string`

###### Returns

`boolean`

<a id="get-1"></a>

##### get()

```ts
get(key): Surface | undefined;
```

The live surface for a key, without creating one or refreshing its lifetime.

###### Parameters

###### key

`string`

###### Returns

[`Surface`](index.md#surface) \| `undefined`

<a id="keyfor"></a>

##### keyFor()

```ts
keyFor(context): string | null;
```

The scope key for a caller, as `resolve` computes it.

###### Parameters

###### context

[`SurfaceContext`](#surfacecontext)

###### Returns

`string` \| `null`

<a id="size"></a>

##### size()

```ts
size(): number;
```

How many surfaces are live.

###### Returns

`number`

***

<a id="scopedsurfacesoptions"></a>

### ScopedSurfacesOptions

#### Properties

<a id="create"></a>

##### create

```ts
create: (key, context) => Surface;
```

Create the surface for a scope the first time a caller in it arrives, or again after eviction.

###### Parameters

###### key

`string`

###### context

[`SurfaceContext`](#surfacecontext)

###### Returns

[`Surface`](index.md#surface)

<a id="idlems"></a>

##### idleMs?

```ts
optional idleMs?: number;
```

A surface unused for this long is evicted. Default 30 minutes.

<a id="key"></a>

##### key?

```ts
optional key?: (context) => string | null;
```

The scope a caller belongs to, or null for a caller with none (then the bridge refuses it).
Default: the tenant id and the principal (the user's `onBehalfOf`, else `site:<key id>`), so
two users, two partners, or one user on two tenants never share a surface.

###### Parameters

###### context

[`SurfaceContext`](#surfacecontext)

###### Returns

`string` \| `null`

<a id="max"></a>

##### max?

```ts
optional max?: number;
```

At most this many surfaces are kept; the least recently used is evicted first. Default 1000.

<a id="now"></a>

##### now?

```ts
optional now?: () => number;
```

Clock, in milliseconds; injectable for tests.

###### Returns

`number`

<a id="onevict"></a>

##### onEvict?

```ts
optional onEvict?: (key, surface) => void;
```

Called with each evicted surface, for example to persist what it holds.

###### Parameters

###### key

`string`

###### surface

[`Surface`](index.md#surface)

###### Returns

`void`

***

<a id="surfaceactionsoptions"></a>

### SurfaceActionsOptions

#### Properties

<a id="actor-1"></a>

##### actor?

```ts
optional actor?: (context) => string;
```

Actor recorded for acts that arrive through AXE. Default: the authenticated `onBehalfOf`, else `agent`.

###### Parameters

###### context

###### onBehalfOf?

`string`

###### Returns

`string`

<a id="auth-2"></a>

##### auth?

```ts
optional auth?: WireAuthMode;
```

Who may call the actions the bridge generates ([S-AUTH-1]): `user` (the default), `site`, or
`none`. Every mode used must be in the server's `auth.modes`, or the server refuses the
provider on its first request, so a public server cannot serve a surface by accident. `none`
makes the surface public over HTTP: pass it only for data you would publish on the open web.

<a id="authfor"></a>

##### authFor?

```ts
optional authFor?: (entry) => WireAuthMode | undefined;
```

The mode of one entry's action, overriding `auth` for it ([S-AUTH-2]); undefined keeps `auth`.

###### Parameters

###### entry

[`Entry`](index.md#entry)

###### Returns

`WireAuthMode` \| `undefined`

<a id="fields-1"></a>

##### fields?

```ts
optional fields?: object;
```

Metadata declared for field entries, which carry no `effect` of their own. Default `risk: "medium"`, `reversible: false`.

###### reversible?

```ts
optional reversible?: boolean;
```

###### risk?

```ts
optional risk?: "low" | "medium" | "high";
```

<a id="namespace-1"></a>

##### namespace?

```ts
optional namespace?: string;
```

Action namespace. Default `surface`, giving `surface.observe`, `surface.ledger`, and `surface.<slug>` per entry.

<a id="observe-1"></a>

##### observe?

```ts
optional observe?: ObservePageOptions;
```

Page size of `<ns>.observe` ([S-OBS-5]). Default for `surfaceActions`: 1000 rows per page
and at most 1000, so a surface of up to 1000 rows is one page as before; for
`domainActions`: 50 rows per page and at most 200.

<a id="onerror-1"></a>

##### onError?

```ts
optional onError?: (error, entryId) => void;
```

Called when an entry cannot be published as an action (its text fails the honesty lint, for
example). The entry stays in `<ns>.observe`; it has no action of its own. Default: `console.warn`, once per entry.

###### Parameters

###### error

`unknown`

###### entryId

`string`

###### Returns

`void`

<a id="read-1"></a>

##### read?

```ts
optional read?: WireAuthMode;
```

The mode of `<ns>.observe` and `<ns>.ledger`, the read side ([S-AUTH-2]). Default: `auth`.

<a id="redactevent-1"></a>

##### redactEvent?

```ts
optional redactEvent?: (details, context) => Record<string, JsonValue>;
```

Rewrites the `details` of each `surface.act` action event before it is emitted ([S-PRV-3]).
The bridge already leaves out text and values; use this to drop or mask ids that are
themselves personal (an entry id built from an email address, for example).

###### Parameters

###### details

`Record`\<`string`, [`JsonValue`](index.md#jsonvalue)\>

###### context

###### action

`string`

###### entryId

`string`

###### Returns

`Record`\<`string`, [`JsonValue`](index.md#jsonvalue)\>

<a id="run-1"></a>

##### run?

```ts
optional run?: (fn) => unknown;
```

How the application runs handlers (for example React's `flushSync`).

###### Parameters

###### fn

() => `unknown`

###### Returns

`unknown`

<a id="template-1"></a>

##### template?

```ts
optional template?: Surface;
```

With a resolver in place of a surface ([S-AUTH-4]): the surface whose entries define the
action set, the same for every caller, as the manifest shows it. Its entries are the
application's shape (names without anyone's data); each caller's own surface supplies the
state, the values, and the handlers. Required with a resolver, ignored with a surface.

***

<a id="surfacebridge"></a>

### SurfaceBridge

What `surfaceActions()` returns: an `ActionProvider` for `axe.addProvider()`, plus the name map.

#### Extends

- `ActionProvider`

#### Methods

<a id="actionnamefor"></a>

##### actionNameFor()

```ts
actionNameFor(entryId): string;
```

The AXE action name for an entry id, `<ns>.<slug>` ([S-AXE-7]). Stable for the life of the bridge.

###### Parameters

###### entryId

`string`

###### Returns

`string`

<a id="actions-1"></a>

##### actions()

```ts
actions(): readonly RegisteredAction<ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>, ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>, JsonValue>[];
```

`<ns>.observe`, `<ns>.ledger`, then one action per registered entry, in registration order.

###### Returns

readonly `RegisteredAction`\<`ZodType`\<`unknown`, `unknown`, `$ZodTypeInternals`\<`unknown`, `unknown`\>\>, `ZodType`\<`unknown`, `unknown`, `$ZodTypeInternals`\<`unknown`, `unknown`\>\>, [`JsonValue`](index.md#jsonvalue)\>[]

###### Overrides

```ts
ActionProvider.actions
```

<a id="entryidfor"></a>

##### entryIdFor()

```ts
entryIdFor(actionName): string | undefined;
```

The entry id an action name resolves to, or undefined when the bridge never issued it.

###### Parameters

###### actionName

`string`

###### Returns

`string` \| `undefined`

<a id="get-2"></a>

##### get()

```ts
get(name): 
  | RegisteredAction<ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>, ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>, JsonValue>
  | undefined;
```

One action by name, or undefined. Lets the server invoke without scanning `actions()`;
without it the server scans, which is fine for a handful of actions and not for hundreds.

###### Parameters

###### name

`string`

###### Returns

  \| `RegisteredAction`\<`ZodType`\<`unknown`, `unknown`, `$ZodTypeInternals`\<`unknown`, `unknown`\>\>, `ZodType`\<`unknown`, `unknown`, `$ZodTypeInternals`\<`unknown`, `unknown`\>\>, [`JsonValue`](index.md#jsonvalue)\>
  \| `undefined`

###### Overrides

```ts
ActionProvider.get
```

<a id="onchange-1"></a>

##### onChange()

```ts
onChange(listener): () => void;
```

Fires when entries were registered or unregistered since the last revision move; a `bump` alone does not fire it.

###### Parameters

###### listener

() => `void`

###### Returns

() => `void`

###### Overrides

```ts
ActionProvider.onChange
```

<a id="onresult-1"></a>

##### onResult()

```ts
onResult(ctx, result): Promise<void>;
```

Called by the server for every result of the bridge's actions ([S-AXE-14]); `addProvider`
wires it, so there is nothing to pass to `createAXE`. A refusal the runtime made before an
entry action's handler ran (a stale `expectedRev` under [S-AXE-4], an input that fails the
schema, a missing `idempotencyKey`) is recorded in the caller's ledger with `source: "server"`,
the entry id and op the act would have had, and the actor of [S-AXE-3], when the runtime
admitted the caller under the action's `auth` mode. Everything else is left alone: an act the
surface saw is already in the ledger, and an unidentified caller of a protected action writes
nothing.

###### Parameters

###### ctx

`ProviderResultContext`

###### result

[`Result`](index.md#result)

###### Returns

`Promise`\<`void`\>

###### Overrides

```ts
ActionProvider.onResult
```

***

<a id="surfacecontext"></a>

### SurfaceContext

Who is asking, as the AXE runtime established it: the input to a `SurfaceResolver` and to a
scope key. `identity` is the authenticated user (null when anonymous), `siteKey` what
`verifySiteKey` returned for a `site` action (null otherwise, and always null in an
availability check), `request` the request being served (null when the manifest is described
outside one).

#### Properties

<a id="identity"></a>

##### identity

```ts
identity: Identity | null;
```

<a id="request"></a>

##### request

```ts
request: Request | null;
```

<a id="sitekey"></a>

##### siteKey

```ts
siteKey: 
  | {
  actions?: string[];
  id?: string;
}
  | null;
```

<a id="tenant"></a>

##### tenant

```ts
tenant: TenantInfo | null;
```

## Type Aliases

<a id="surfaceresolver"></a>

### SurfaceResolver

```ts
type SurfaceResolver = (context) => MaybePromise<Surface | null | undefined>;
```

Returns the surface for the caller ([S-AUTH-4]), or null or undefined when the caller has none.
Called at most once per request; `scopedSurfaces` returns one with a bounded cache.

#### Parameters

##### context

[`SurfaceContext`](#surfacecontext)

#### Returns

[`MaybePromise`](index.md#maybepromise)\<[`Surface`](index.md#surface) \| `null` \| `undefined`\>

## Variables

<a id="surface_act_event"></a>

### SURFACE\_ACT\_EVENT

```ts
const SURFACE_ACT_EVENT: "surface.act" = "surface.act";
```

Action event name for every act that goes through the bridge.

## Functions

<a id="domainactions"></a>

### domainActions()

```ts
function domainActions(source, options?): DomainBridge;
```

Derive the AXE actions for a surface as a fixed set of parameterized domain actions
([S-AXE-10]): `<ns>.observe`, `<ns>.ledger`, and one action per `DomainActionSpec`, each taking
`{ entryId, text?, confirm? }`. Every act goes through `surface.act` with the entry's own op,
the envelope's `expectedRev`, and the same ladder, ledger, and action events as the
per-control actions of `surfaceActions`. The set does not change as rows come and go, so the
manifest and the MCP tool list stay the same size whatever the table holds; the rows, their
availability, and the action that acts on each come from `<ns>.observe`.

Both granularities can serve one surface side by side under different namespaces.

#### Parameters

##### source

[`Surface`](index.md#surface) \| [`SurfaceResolver`](#surfaceresolver)

##### options?

[`DomainActionsOptions`](#domainactionsoptions) = `{}`

#### Returns

[`DomainBridge`](#domainbridge)

***

<a id="entryslug"></a>

### entrySlug()

```ts
function entrySlug(entryId): string;
```

The plain slug of an entry id ([S-AXE-7]): lowercase; every run of characters outside `a-z0-9`
becomes one hyphen; leading and trailing hyphens are dropped; a slug that is empty or starts with
a digit is prefixed with `e-` so it fits the action-name grammar ([P-ACT-1]).

#### Parameters

##### entryId

`string`

#### Returns

`string`

***

<a id="scopedsurfaces-1"></a>

### scopedSurfaces()

```ts
function scopedSurfaces(options): ScopedSurfaces;
```

One surface per scope, created on first use and evicted when idle or when the cache is full
([S-AUTH-4]). Pass `resolve` to `surfaceActions` with a `template`.

#### Parameters

##### options

[`ScopedSurfacesOptions`](#scopedsurfacesoptions)

#### Returns

[`ScopedSurfaces`](#scopedsurfaces)

***

<a id="surfaceactions"></a>

### surfaceActions()

```ts
function surfaceActions(source, options?): SurfaceBridge;
```

Derive the AXE actions for a surface, one per control: `<ns>.observe`, `<ns>.ledger`, and one
action per entry. Hand the result to `axe.addProvider()`; the set follows the registry from
then on.

#### Parameters

##### source

[`Surface`](index.md#surface) \| [`SurfaceResolver`](#surfaceresolver)

##### options?

[`SurfaceActionsOptions`](#surfaceactionsoptions) = `{}`

#### Returns

[`SurfaceBridge`](#surfacebridge)
