[AXE API reference](../README.md) / @summationai/axe

# `axe`

CLI for installing and validating Agent Experience Surface.

Give a coding agent the self-contained installation prompt:

```sh
npx @summationai/axe surface prompt
```

Or install directly in a supported React Router, Next.js, Vite/React, React, or plain HTML application:

```sh
npx @summationai/axe surface init --dry-run
npx @summationai/axe surface init --yes --install
```

The default output supports browser-native WebMCP and a provider-injected hosted connection. The consuming application does not run an MCP server. See the repository [getting-started guide](https://github.com/summationai/agent-experience/blob/main/docs/getting-started.md) and [application/provider boundary](https://github.com/summationai/agent-experience/blob/main/docs/architecture.md).

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
