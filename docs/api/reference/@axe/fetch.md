[AXE API reference](../README.md) / @axe/fetch

# @axe/fetch

## Interfaces

<a id="fetchadapteroptions"></a>

### FetchAdapterOptions

#### Type Parameters

##### Env

`Env` = `unknown`

#### Properties

<a id="context"></a>

##### context?

```ts
optional context?: (request, env?) => MaybePromise<AdapterContext | undefined>;
```

Inject the platform's session or tenant. Receives the request and whatever extra argument the platform passes (Workers `env`, Hono `Context`).

###### Parameters

###### request

`Request`

###### env?

`Env`

###### Returns

`MaybePromise`\<`AdapterContext` \| `undefined`\>

## Functions

<a id="axefetch"></a>

### axeFetch()

```ts
function axeFetch<Env>(axe, options?): (request, env?) => Promise<Response>;
```

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

<a id="isaxepath"></a>

### isAxePath()

```ts
function isAxePath(pathname): boolean;
```

#### Parameters

##### pathname

`string`

#### Returns

`boolean`
