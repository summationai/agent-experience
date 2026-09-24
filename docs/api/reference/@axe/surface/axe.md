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

Action namespace. Default `surface`, giving `surface.observe` and `surface.act`.

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

## Functions

<a id="surfaceactions"></a>

### surfaceActions()

```ts
function surfaceActions(surface, options?): RegisteredAction<ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>, ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>, JsonValue>[];
```

Build the two AXE actions for a surface. Register both with `axe.register()`.

#### Parameters

##### surface

[`Surface`](index.md#surface)

##### options?

[`SurfaceActionsOptions`](#surfaceactionsoptions) = `{}`

#### Returns

`RegisteredAction`\<`ZodType`\<`unknown`, `unknown`, `$ZodTypeInternals`\<`unknown`, `unknown`\>\>, `ZodType`\<`unknown`, `unknown`, `$ZodTypeInternals`\<`unknown`, `unknown`\>\>, [`JsonValue`](index.md#jsonvalue)\>[]
