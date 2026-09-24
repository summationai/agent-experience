[AXE API reference](../../README.md) / [@axe/core](README.md) / node

# node

## Classes

<a id="sqliteidempotencystore"></a>

### SqliteIdempotencyStore

A durable `IdempotencyStore` over SQLite (`node:sqlite`, Node 22.5 or newer). Every claim is one
`INSERT ... ON CONFLICT DO UPDATE ... WHERE` statement, which SQLite runs atomically, so any
number of runtimes, in one process or several, that open the same database file share claims.
Open each connection with `PRAGMA busy_timeout` set, so a writer waits for another process's
write instead of failing. The same statements port to PostgreSQL (`ON CONFLICT` with a `WHERE`
on the update, `RETURNING` in place of `changes`); see docs/deploying.md. The default table is
`axe_operations_v1`; the suffix is the layout version, so a later layout gets a new table rather
than altering this one.

#### Implements

- [`IdempotencyStore`](index.md#idempotencystore-1)

#### Constructors

<a id="constructor"></a>

##### Constructor

```ts
new SqliteIdempotencyStore(db, options?): SqliteIdempotencyStore;
```

###### Parameters

###### db

[`SqliteDatabaseLike`](#sqlitedatabaselike)

###### options?

###### now?

() => `number`

###### table?

`string`

###### Returns

[`SqliteIdempotencyStore`](#sqliteidempotencystore)

#### Methods

<a id="claim"></a>

##### claim()

```ts
claim(key, request): Promise<ClaimOutcome>;
```

Atomically: when `key` is absent or expired, record an in-progress claim and return `acquired`.
When it holds an in-progress claim whose lease has passed and whose fingerprint equals the
request's, take it over and return `acquired`. Otherwise return what is there.

###### Parameters

###### key

`string`

###### request

[`ClaimRequest`](index.md#claimrequest)

###### Returns

`Promise`\<[`ClaimOutcome`](index.md#claimoutcome)\>

###### Implementation of

[`IdempotencyStore`](index.md#idempotencystore-1).[`claim`](index.md#claim-1)

<a id="complete"></a>

##### complete()

```ts
complete(
   key, 
   owner, 
   record, 
   ttlSeconds
): Promise<boolean>;
```

Record the result of the claim `owner` holds, kept for `ttlSeconds`. Returns false, and stores
nothing, when `owner` no longer holds the claim (its lease was taken over).

###### Parameters

###### key

`string`

###### owner

`string`

###### record

[`IdempotencyRecord`](index.md#idempotencyrecord)

###### ttlSeconds

`number`

###### Returns

`Promise`\<`boolean`\>

###### Implementation of

[`IdempotencyStore`](index.md#idempotencystore-1).[`complete`](index.md#complete-1)

<a id="get"></a>

##### get()

```ts
get(key): Promise<IdempotencyRecord | undefined>;
```

The completed record under `key`, or undefined when there is none, it expired, or it is still in progress.

###### Parameters

###### key

`string`

###### Returns

`Promise`\<[`IdempotencyRecord`](index.md#idempotencyrecord) \| `undefined`\>

###### Implementation of

[`IdempotencyStore`](index.md#idempotencystore-1).[`get`](index.md#get-3)

<a id="prune"></a>

##### prune()

```ts
prune(): number;
```

Delete expired rows. Call it from a periodic job; correctness never depends on it.

###### Returns

`number`

<a id="release"></a>

##### release()

```ts
release(key, owner): Promise<void>;
```

Drop the in-progress claim `owner` holds, so the key can be used again. A no-op otherwise.

###### Parameters

###### key

`string`

###### owner

`string`

###### Returns

`Promise`\<`void`\>

###### Implementation of

[`IdempotencyStore`](index.md#idempotencystore-1).[`release`](index.md#release-1)

## Interfaces

<a id="sqlitedatabaselike"></a>

### SqliteDatabaseLike

The subset of `node:sqlite`'s `DatabaseSync` the store uses (Node 22.5 or newer). Typed
structurally so this module never imports `node:sqlite`: pass your own connection.

#### Methods

<a id="exec"></a>

##### exec()

```ts
exec(sql): void;
```

###### Parameters

###### sql

`string`

###### Returns

`void`

<a id="prepare"></a>

##### prepare()

```ts
prepare(sql): object;
```

###### Parameters

###### sql

`string`

###### Returns

`object`

###### get()

```ts
get(...params): unknown;
```

###### Parameters

###### params

...(`string` \| `number` \| `null`)[]

###### Returns

`unknown`

###### run()

```ts
run(...params): object;
```

###### Parameters

###### params

...(`string` \| `number` \| `null`)[]

###### Returns

`object`

###### changes

```ts
changes: number | bigint;
```

## Functions

<a id="jsonlfilesink"></a>

### jsonlFileSink()

```ts
function jsonlFileSink(path): (event) => Promise<void>;
```

Sink: append JSON lines to a file. Node only. The file handle is opened lazily and
writes are serialized, so events never interleave. Accepts request events and action events.

#### Parameters

##### path

`string`

#### Returns

(`event`) => `Promise`\<`void`\>
