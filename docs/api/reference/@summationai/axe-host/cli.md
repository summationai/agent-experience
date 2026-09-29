[AXE API reference](../../README.md) / [@summationai/axe-host](README.md) / cli

# cli

## Interfaces

<a id="hostcliio"></a>

### HostCliIo

#### Properties

<a id="cwd"></a>

##### cwd?

```ts
optional cwd?: string;
```

Where relative paths resolve. Default `process.cwd()`.

<a id="self"></a>

##### self?

```ts
optional self?: object;
```

How to run this command again, for the printed agent configuration. Default: this node and script.

###### args

```ts
args: string[];
```

###### command

```ts
command: string;
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

<a id="stdin"></a>

##### stdin?

```ts
optional stdin?: ReadableStream | null;
```

Where `login` waits for Enter; null waits only for the window to close (or `until`).

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

<a id="default_host_port"></a>

### DEFAULT\_HOST\_PORT

```ts
const DEFAULT_HOST_PORT: 4718 = 4718;
```

***

<a id="default_state_file"></a>

### DEFAULT\_STATE\_FILE

```ts
const DEFAULT_STATE_FILE: ".axe/host-state.json" = ".axe/host-state.json";
```

## Functions

<a id="runhostcli"></a>

### runHostCli()

```ts
function runHostCli(argv, io?): Promise<number>;
```

Run `axe host`. Resolves with the exit code when it stops.

#### Parameters

##### argv

`string`[]

##### io?

[`HostCliIo`](#hostcliio) = `{}`

#### Returns

`Promise`\<`number`\>
