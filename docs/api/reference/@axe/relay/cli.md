[AXE API reference](../../README.md) / [@axe/relay](README.md) / cli

# cli

## Interfaces

<a id="relaycliio"></a>

### RelayCliIo

#### Properties

<a id="env"></a>

##### env?

```ts
optional env?: Record<string, string | undefined>;
```

<a id="stderr"></a>

##### stderr?

```ts
optional stderr?: (line) => void;
```

###### Parameters

###### line

`string`

###### Returns

`void`

<a id="stdout"></a>

##### stdout?

```ts
optional stdout?: (line) => void;
```

###### Parameters

###### line

`string`

###### Returns

`void`

<a id="until"></a>

##### until?

```ts
optional until?: Promise<void>;
```

Resolves when the process should stop (tests); default: SIGINT, SIGTERM, or stdio closing.

## Variables

<a id="default_dev_port"></a>

### DEFAULT\_DEV\_PORT

```ts
const DEFAULT_DEV_PORT: 4717 = 4717;
```

## Functions

<a id="runrelaycli"></a>

### runRelayCli()

```ts
function runRelayCli(argv, io?): Promise<number>;
```

Run `axe relay`. Resolves with the exit code when the relay stops.

#### Parameters

##### argv

`string`[]

##### io?

[`RelayCliIo`](#relaycliio) = `{}`

#### Returns

`Promise`\<`number`\>
