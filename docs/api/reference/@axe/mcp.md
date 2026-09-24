[AXE API reference](../README.md) / @axe/mcp

# @axe/mcp

## Interfaces

### AxeLike

Defined in: [packages/mcp/src/index.ts:20](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/mcp/src/index.ts#L20)

Anything with `handle(Request)`: an `AXE` instance from `@axe/core`.

#### Methods

##### describe()

```ts
describe(): Manifest;
```

Defined in: [packages/mcp/src/index.ts:22](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/mcp/src/index.ts#L22)

###### Returns

[`Manifest`](client/index.md#manifest-1)

##### handle()

```ts
handle(request): Promise<Response>;
```

Defined in: [packages/mcp/src/index.ts:21](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/mcp/src/index.ts#L21)

###### Parameters

###### request

`Request`

###### Returns

`Promise`\<`Response`\>

***

### DerivedMcpServer

Defined in: [packages/mcp/src/index.ts:35](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/mcp/src/index.ts#L35)

#### Properties

##### client

```ts
client: AXEClient;
```

Defined in: [packages/mcp/src/index.ts:37](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/mcp/src/index.ts#L37)

##### manifest

```ts
manifest: Manifest;
```

Defined in: [packages/mcp/src/index.ts:38](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/mcp/src/index.ts#L38)

##### server

```ts
server: Server;
```

Defined in: [packages/mcp/src/index.ts:36](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/mcp/src/index.ts#L36)

##### tools

```ts
tools: object[];
```

Defined in: [packages/mcp/src/index.ts:39](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/mcp/src/index.ts#L39)

###### \_meta?

```ts
optional _meta?: object;
```

###### Index Signature

```ts
[key: string]: unknown
```

###### annotations?

```ts
optional annotations?: object;
```

###### annotations.destructiveHint?

```ts
optional destructiveHint?: boolean;
```

###### annotations.idempotentHint?

```ts
optional idempotentHint?: boolean;
```

###### annotations.openWorldHint?

```ts
optional openWorldHint?: boolean;
```

###### annotations.readOnlyHint?

```ts
optional readOnlyHint?: boolean;
```

###### annotations.title?

```ts
optional title?: string;
```

###### description?

```ts
optional description?: string;
```

###### execution?

```ts
optional execution?: object;
```

###### execution.taskSupport?

```ts
optional taskSupport?: "optional" | "required" | "forbidden";
```

###### icons?

```ts
optional icons?: object[];
```

###### inputSchema

```ts
inputSchema: object;
```

###### Index Signature

```ts
[key: string]: unknown
```

###### inputSchema.properties?

```ts
optional properties?: object;
```

###### Index Signature

```ts
[key: string]: object
```

###### inputSchema.required?

```ts
optional required?: string[];
```

###### inputSchema.type

```ts
type: "object";
```

###### name

```ts
name: string;
```

###### outputSchema?

```ts
optional outputSchema?: object;
```

###### Index Signature

```ts
[key: string]: unknown
```

###### outputSchema.properties?

```ts
optional properties?: object;
```

###### Index Signature

```ts
[key: string]: object
```

###### outputSchema.required?

```ts
optional required?: string[];
```

###### outputSchema.type

```ts
type: "object";
```

###### title?

```ts
optional title?: string;
```

***

### McpServerOptions

Defined in: [packages/mcp/src/index.ts:25](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/mcp/src/index.ts#L25)

#### Properties

##### client?

```ts
optional client?: ClientOptions;
```

Defined in: [packages/mcp/src/index.ts:30](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/mcp/src/index.ts#L30)

Options for the underlying AXE client (auth, agent identification, fetch).

##### name?

```ts
optional name?: string;
```

Defined in: [packages/mcp/src/index.ts:27](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/mcp/src/index.ts#L27)

Server name reported to MCP clients. Defaults to the manifest name.

##### pollBudgetMs?

```ts
optional pollBudgetMs?: number;
```

Defined in: [packages/mcp/src/index.ts:32](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/mcp/src/index.ts#L32)

How long `pending` results are polled inside a tool call before returning. Default 20000 ms.

##### version?

```ts
optional version?: string;
```

Defined in: [packages/mcp/src/index.ts:28](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/mcp/src/index.ts#L28)

***

### ServeHttpOptions

Defined in: [packages/mcp/src/index.ts:368](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/mcp/src/index.ts#L368)

#### Properties

##### sessionIdGenerator?

```ts
optional sessionIdGenerator?: () => string;
```

Defined in: [packages/mcp/src/index.ts:370](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/mcp/src/index.ts#L370)

Stateless mode (default) needs no session id. Set to `() => crypto.randomUUID()` for stateful sessions.

###### Returns

`string`

## Functions

### createMcpServer()

```ts
function createMcpServer(source, options?): Promise<DerivedMcpServer>;
```

Defined in: [packages/mcp/src/index.ts:57](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/mcp/src/index.ts#L57)

Create an MCP server from an AXE server instance, a manifest object, or a URL to discover.

#### Parameters

##### source

`string` \| [`AxeLike`](#axelike) \| [`Manifest`](client/index.md#manifest-1)

##### options?

[`McpServerOptions`](#mcpserveroptions) = `{}`

#### Returns

`Promise`\<[`DerivedMcpServer`](#derivedmcpserver)\>

***

### formatResult()

```ts
function formatResult(
   result, 
   action, 
   brand
): object;
```

Defined in: [packages/mcp/src/index.ts:273](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/mcp/src/index.ts#L273)

Render a result envelope as MCP tool content. Exported for tests and custom bridges.

#### Parameters

##### result

[`Result`](client/index.md#result)

##### action

[`ActionDefinition`](client/index.md#actiondefinition) \| `undefined`

##### brand

`Brand` \| `undefined`

#### Returns

`object`

##### \_meta?

```ts
optional _meta?: object;
```

###### Index Signature

```ts
[key: string]: unknown
```

###### \_meta.io.modelcontextprotocol/related-task?

```ts
optional io.modelcontextprotocol/related-task?: object;
```

If specified, this request is related to the provided task.

###### \_meta.io.modelcontextprotocol/related-task.taskId

```ts
taskId: string;
```

###### \_meta.progressToken?

```ts
optional progressToken?: string | number;
```

If specified, the caller is requesting out-of-band progress notifications for this request (as represented by notifications/progress). The value of this parameter is an opaque token that will be attached to any subsequent notifications. The receiver is not obligated to provide these notifications.

##### content

```ts
content: (
  | {
  _meta?: {
   [key: string]: unknown;
  };
  annotations?: {
     audience?: ("user" | "assistant")[];
     lastModified?: string;
     priority?: number;
  };
  text: string;
  type: "text";
}
  | {
  _meta?: {
   [key: string]: unknown;
  };
  annotations?: {
     audience?: ("user" | "assistant")[];
     lastModified?: string;
     priority?: number;
  };
  data: string;
  mimeType: string;
  type: "image";
}
  | {
  _meta?: {
   [key: string]: unknown;
  };
  annotations?: {
     audience?: ("user" | "assistant")[];
     lastModified?: string;
     priority?: number;
  };
  data: string;
  mimeType: string;
  type: "audio";
}
  | {
  _meta?: {
   [key: string]: unknown;
  };
  annotations?: {
     audience?: ("user" | "assistant")[];
     lastModified?: string;
     priority?: number;
  };
  description?: string;
  icons?: object[];
  mimeType?: string;
  name: string;
  size?: number;
  title?: string;
  type: "resource_link";
  uri: string;
}
  | {
  _meta?: {
   [key: string]: unknown;
  };
  annotations?: {
     audience?: ("user" | "assistant")[];
     lastModified?: string;
     priority?: number;
  };
  resource:   | {
     _meta?: {
      [key: string]: unknown;
     };
     mimeType?: string;
     text: string;
     uri: string;
   }
     | {
     _meta?: {
      [key: string]: unknown;
     };
     blob: string;
     mimeType?: string;
     uri: string;
   };
  type: "resource";
})[];
```

##### isError?

```ts
optional isError?: boolean;
```

##### structuredContent?

```ts
optional structuredContent?: object;
```

###### Index Signature

```ts
[key: string]: unknown
```

***

### serveHttp()

```ts
function serveHttp(derived, options?): (request) => Promise<Response>;
```

Defined in: [packages/mcp/src/index.ts:376](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/mcp/src/index.ts#L376)

A fetch handler for the Streamable HTTP transport. Mount it at `/mcp` in any Web-standard framework.

#### Parameters

##### derived

[`DerivedMcpServer`](#derivedmcpserver)

##### options?

[`ServeHttpOptions`](#servehttpoptions) = `{}`

#### Returns

(`request`) => `Promise`\<`Response`\>

***

### serveStdio()

```ts
function serveStdio(derived): Promise<void>;
```

Defined in: [packages/mcp/src/index.ts:364](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/mcp/src/index.ts#L364)

Connect the server to stdio (for Claude Desktop, Claude Code, and `axe mcp`).

#### Parameters

##### derived

[`DerivedMcpServer`](#derivedmcpserver)

#### Returns

`Promise`\<`void`\>

***

### toolNameFor()

```ts
function toolNameFor(actionName): string;
```

Defined in: [packages/mcp/src/index.ts:43](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/mcp/src/index.ts#L43)

MCP tool name for an AXE action: dots become underscores (`units.search` → `units_search`).

#### Parameters

##### actionName

`string`

#### Returns

`string`
