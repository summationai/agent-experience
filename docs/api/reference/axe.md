[AXE API reference](README.md) / axe

# axe

## Interfaces

### CommandContext

Defined in: [index.ts:42](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/cli/src/index.ts#L42)

#### Properties

##### args

```ts
args: string[];
```

Defined in: [index.ts:43](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/cli/src/index.ts#L43)

##### stderr

```ts
stderr: (line) => void;
```

Defined in: [index.ts:45](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/cli/src/index.ts#L45)

###### Parameters

###### line

`string`

###### Returns

`void`

##### stdout

```ts
stdout: (line) => void;
```

Defined in: [index.ts:44](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/cli/src/index.ts#L44)

###### Parameters

###### line

`string`

###### Returns

`void`

## Functions

### run()

```ts
function run(argv, io?): Promise<number>;
```

Defined in: [index.ts:60](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/cli/src/index.ts#L60)

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
