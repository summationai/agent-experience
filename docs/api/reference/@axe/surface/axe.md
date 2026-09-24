[AXE API reference](../../README.md) / [@axe/surface](README.md) / axe

# axe

## Interfaces

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

<a id="surfaceactions"></a>

### surfaceActions()

```ts
function surfaceActions(surface, options?): SurfaceBridge;
```

Derive the AXE actions for a surface: `<ns>.observe`, `<ns>.ledger`, and one action per entry.
Hand the result to `axe.addProvider()`; the set follows the registry from then on.

#### Parameters

##### surface

[`Surface`](index.md#surface)

##### options?

[`SurfaceActionsOptions`](#surfaceactionsoptions) = `{}`

#### Returns

[`SurfaceBridge`](#surfacebridge)
