[AXE API reference](../README.md) / @axe/fetch

# @axe/fetch

## Interfaces

### FetchAdapterOptions

Defined in: [index.ts:13](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/fetch/src/index.ts#L13)

#### Type Parameters

##### Env

`Env` = `unknown`

#### Properties

##### context?

```ts
optional context?: (request, env?) => MaybePromise<AdapterContext | undefined>;
```

Defined in: [index.ts:15](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/fetch/src/index.ts#L15)

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

Defined in: [index.ts:19](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/fetch/src/index.ts#L19)

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

Defined in: [index.ts:28](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/fetch/src/index.ts#L28)

Whether a URL path is one AXE serves, so routers can delegate only those.

#### Parameters

##### pathname

`string`

#### Returns

`boolean`
