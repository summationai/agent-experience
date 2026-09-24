[AXE API reference](../README.md) / @axe/mcp

# @axe/mcp

## Interfaces

<a id="axelike"></a>

### AxeLike

Anything with `handle(Request)`: an `AXE` instance from `@axe/core`.

#### Methods

<a id="describe"></a>

##### describe()

```ts
describe(): Manifest;
```

###### Returns

[`Manifest`](client/index.md#manifest-1)

<a id="describelive"></a>

##### describeLive()?

```ts
optional describeLive(): Promise<Manifest>;
```

When present, the manifest with `live.rev` and availability rendered (an `AXE` instance has it).

###### Returns

`Promise`\<[`Manifest`](client/index.md#manifest-1)\>

<a id="handle"></a>

##### handle()

```ts
handle(request): Promise<Response>;
```

###### Parameters

###### request

`Request`

###### Returns

`Promise`\<`Response`\>

***

<a id="derivedmcpserver"></a>

### DerivedMcpServer

#### Properties

<a id="client"></a>

##### client

```ts
client: AXEClient;
```

<a id="manifest"></a>

##### manifest

```ts
manifest: Manifest;
```

<a id="server"></a>

##### server

```ts
server: Server;
```

<a id="tools"></a>

##### tools

```ts
tools: object[];
```

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

<a id="mcpserveroptions"></a>

### McpServerOptions

#### Properties

<a id="client-1"></a>

##### client?

```ts
optional client?: ClientOptions;
```

Options for the underlying AXE client (auth, agent identification, fetch).

<a id="name"></a>

##### name?

```ts
optional name?: string;
```

Server name reported to MCP clients. Defaults to the manifest name.

<a id="pollbudgetms"></a>

##### pollBudgetMs?

```ts
optional pollBudgetMs?: number;
```

How long `pending` results are polled inside a tool call before returning. Default 20000 ms.

<a id="version"></a>

##### version?

```ts
optional version?: string;
```

***

<a id="servehttpoptions"></a>

### ServeHttpOptions

#### Properties

<a id="sessionidgenerator"></a>

##### sessionIdGenerator?

```ts
optional sessionIdGenerator?: () => string;
```

Stateless mode (default) needs no session id. Set to `() => crypto.randomUUID()` for stateful sessions.

###### Returns

`string`

## Functions

<a id="createmcpserver"></a>

### createMcpServer()

```ts
function createMcpServer(source, options?): Promise<DerivedMcpServer>;
```

Create an MCP server from an AXE server instance, a manifest object, or a URL to discover.

#### Parameters

##### source

`string` \| [`AxeLike`](#axelike) \| [`Manifest`](client/index.md#manifest-1)

##### options?

[`McpServerOptions`](#mcpserveroptions) = `{}`

#### Returns

`Promise`\<[`DerivedMcpServer`](#derivedmcpserver)\>

***

<a id="formatresult"></a>

### formatResult()

```ts
function formatResult(
   result, 
   action, 
   brand
): object;
```

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

<a id="servehttp"></a>

### serveHttp()

```ts
function serveHttp(derived, options?): (request) => Promise<Response>;
```

A fetch handler for the Streamable HTTP transport. Mount it at `/mcp` in any Web-standard framework.

#### Parameters

##### derived

[`DerivedMcpServer`](#derivedmcpserver)

##### options?

[`ServeHttpOptions`](#servehttpoptions) = `{}`

#### Returns

(`request`) => `Promise`\<`Response`\>

***

<a id="servestdio"></a>

### serveStdio()

```ts
function serveStdio(derived): Promise<void>;
```

Connect the server to stdio (for Claude Desktop, Claude Code, and `axe mcp`).

#### Parameters

##### derived

[`DerivedMcpServer`](#derivedmcpserver)

#### Returns

`Promise`\<`void`\>

***

<a id="toolnamefor"></a>

### toolNameFor()

```ts
function toolNameFor(actionName): string;
```

MCP tool name for an AXE action: dots become underscores (`units.search` → `units_search`).

#### Parameters

##### actionName

`string`

#### Returns

`string`
