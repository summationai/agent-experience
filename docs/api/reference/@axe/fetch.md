[AXE API reference](../README.md) / @axe/fetch

# @axe/fetch

## Interfaces

### FetchAdapterOptions

Defined in: [index.ts:14](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/fetch/src/index.ts#L14)

#### Type Parameters

##### Env

`Env` = `unknown`

#### Properties

##### context?

```ts
optional context?: (request, env?) => MaybePromise<AdapterContext | undefined>;
```

Defined in: [index.ts:16](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/fetch/src/index.ts#L16)

Inject the platform's session or tenant. Receives the request and whatever extra argument the platform passes (Workers `env`, Hono `Context`).

###### Parameters

###### request

`Request`

###### env?

`Env`

###### Returns

`MaybePromise`\<`AdapterContext` \| `undefined`\>

## Functions

### axeFetch()

```ts
function axeFetch<Env>(axe, options?): (request, env?) => Promise<Response>;
```

Defined in: [index.ts:20](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/fetch/src/index.ts#L20)

A fetch handler for the whole AXE surface.

#### Type Parameters

##### Env

`Env` = `unknown`

#### Parameters

##### axe

`AXE`

##### options?

[`FetchAdapterOptions`](#fetchadapteroptions)\<`Env`\> = `{}`

#### Returns

(`request`, `env?`) => `Promise`\<`Response`\>

***

### isAxePath()

```ts
function isAxePath(pathname): boolean;
```

Defined in: [index.ts:32](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/fetch/src/index.ts#L32)

#### Parameters

##### pathname

`string`

#### Returns

`boolean`
