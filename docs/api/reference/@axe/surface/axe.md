[AXE API reference](../../README.md) / [@axe/surface](README.md) / axe

# axe

## Interfaces

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

<a id="get"></a>

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

<a id="auth"></a>

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

<a id="namespace"></a>

##### namespace?

```ts
optional namespace?: string;
```

Action namespace. Default `surface`, giving `surface.observe`, `surface.ledger`, and `surface.<slug>` per entry.

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

<a id="read"></a>

##### read?

```ts
optional read?: WireAuthMode;
```

The mode of `<ns>.observe` and `<ns>.ledger`, the read side ([S-AUTH-2]). Default: `auth`.

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

<a id="template"></a>

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

<a id="actions"></a>

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

<a id="get-1"></a>

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

Derive the AXE actions for a surface: `<ns>.observe`, `<ns>.ledger`, and one action per entry.
Hand the result to `axe.addProvider()`; the set follows the registry from then on.

#### Parameters

##### source

[`Surface`](index.md#surface) \| [`SurfaceResolver`](#surfaceresolver)

##### options?

[`SurfaceActionsOptions`](#surfaceactionsoptions) = `{}`

#### Returns

[`SurfaceBridge`](#surfacebridge)
