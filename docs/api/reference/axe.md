[AXE API reference](README.md) / axe

# axe

## Interfaces

<a id="commandcontext"></a>

### CommandContext

#### Properties

<a id="args"></a>

##### args

```ts
args: string[];
```

<a id="stderr"></a>

##### stderr

```ts
stderr: (line) => void;
```

###### Parameters

###### line

`string`

###### Returns

`void`

<a id="stdout"></a>

##### stdout

```ts
stdout: (line) => void;
```

###### Parameters

###### line

`string`

###### Returns

`void`

## Functions

<a id="run"></a>

### run()

```ts
function run(argv, io?): Promise<number>;
```

Run the CLI with the given argv (without node and script). Returns the exit code.

#### Parameters

##### argv

`string`[]

##### io?

###### stderr?

(`l`) => `void`

###### stdout?

(`l`) => `void`

#### Returns

`Promise`\<`number`\>
