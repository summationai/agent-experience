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

<a id="namespace"></a>

##### namespace?

```ts
optional namespace?: string;
```

Action namespace. Default `surface`, giving `surface.observe`, `surface.act`, and `surface.ledger`.

<a id="risk"></a>

##### risk?

```ts
optional risk?: "low" | "medium" | "high";
```

Risk to declare for `act`. Default `medium`; declare `high` when the surface can move money or sign.

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

## Variables

<a id="surface_act_event"></a>

### SURFACE\_ACT\_EVENT

```ts
const SURFACE_ACT_EVENT: "surface.act" = "surface.act";
```

Action event name for every act that goes through the bridge.

## Functions

<a id="surfaceactions"></a>

### surfaceActions()

```ts
function surfaceActions(surface, options?): RegisteredAction<ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>, ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>, JsonValue>[];
```

Build the three AXE actions for a surface. Register all of them with `axe.register()`.

#### Parameters

##### surface

[`Surface`](index.md#surface)

##### options?

[`SurfaceActionsOptions`](#surfaceactionsoptions) = `{}`

#### Returns

`RegisteredAction`\<`ZodType`\<`unknown`, `unknown`, `$ZodTypeInternals`\<`unknown`, `unknown`\>\>, `ZodType`\<`unknown`, `unknown`, `$ZodTypeInternals`\<`unknown`, `unknown`\>\>, [`JsonValue`](index.md#jsonvalue)\>[]
