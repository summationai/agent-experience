[AXE API reference](../../README.md) / [@axe/surface](README.md) / webmcp

# webmcp

## Interfaces

<a id="modelcontextlike"></a>

### ModelContextLike

The part of `document.modelContext` this module calls.

#### Methods

<a id="registertool"></a>

##### registerTool()

```ts
registerTool(tool, options?): unknown;
```

###### Parameters

###### tool

[`WebMcpTool`](#webmcptool)

###### options?

###### signal?

`AbortSignal`

###### Returns

`unknown`

***

<a id="webmcphandle"></a>

### WebMcpHandle

#### Properties

<a id="reason"></a>

##### reason?

```ts
readonly optional reason?: string;
```

Why nothing was registered, when `supported` is false.

<a id="supported"></a>

##### supported

```ts
readonly supported: boolean;
```

Whether a WebMCP object was found and tools are being registered.

#### Methods

<a id="close"></a>

##### close()

```ts
close(): void;
```

Unregister every tool and stop following the surface. Calling it twice is harmless.

###### Returns

`void`

<a id="ready"></a>

##### ready()

```ts
ready(): Promise<void>;
```

Resolves when the current registration round has settled.

###### Returns

`Promise`\<`void`\>

<a id="tools"></a>

##### tools()

```ts
tools(): string[];
```

Tool names registered right now.

###### Returns

`string`[]

***

<a id="webmcpoptions"></a>

### WebMcpOptions

#### Properties

<a id="actor"></a>

##### actor?

```ts
optional actor?: string;
```

The `actor` recorded in the ledger for acts made through these tools. Default `webmcp`.

<a id="modelcontext"></a>

##### modelContext?

```ts
optional modelContext?: ModelContextLike | null;
```

The WebMCP object to register with. Default: `document.modelContext` when it has
`registerTool`. Pass `null` to disable, or an object of your own (tests, a polyfill).

<a id="observe"></a>

##### observe?

```ts
optional observe?: boolean;
```

Register the observe tool (`<prefix>observe`). Default true.

<a id="onerror"></a>

##### onError?

```ts
optional onError?: (error, toolName) => void;
```

Called when the browser refuses a registration. Default: ignore.

###### Parameters

###### error

`unknown`

###### toolName

`string`

###### Returns

`void`

<a id="prefix"></a>

##### prefix?

```ts
optional prefix?: string;
```

Prefix for every tool name. Default `surface_`.

<a id="run"></a>

##### run?

```ts
optional run?: (fn) => unknown;
```

Wraps each handler run, as `surface.act`'s `run` option (React's `act`, a zone).

###### Parameters

###### fn

() => `unknown`

###### Returns

`unknown`

<a id="unavailable"></a>

##### unavailable?

```ts
optional unavailable?: "omit" | "describe";
```

What to do with a control that is unavailable right now: `describe` (default) registers its
tool with the reason in the description, so the agent can tell the user why; `omit` leaves it
out until it becomes available.

***

<a id="webmcptool"></a>

### WebMcpTool

A tool as `registerTool` takes it.

#### Properties

<a id="annotations"></a>

##### annotations?

```ts
optional annotations?: WebMcpToolAnnotations;
```

<a id="description"></a>

##### description

```ts
description: string;
```

<a id="execute"></a>

##### execute

```ts
execute: (input, options?) => Promise<unknown>;
```

###### Parameters

###### input

`Record`\<`string`, `unknown`\>

###### options?

###### signal?

`AbortSignal`

###### Returns

`Promise`\<`unknown`\>

<a id="inputschema"></a>

##### inputSchema

```ts
inputSchema: Record<string, unknown>;
```

<a id="name"></a>

##### name

```ts
name: string;
```

<a id="title"></a>

##### title?

```ts
optional title?: string;
```

***

<a id="webmcptoolannotations-1"></a>

### WebMcpToolAnnotations

Tool annotations the draft defines. All are hints to the agent.

#### Properties

<a id="consequentialhint"></a>

##### consequentialHint?

```ts
optional consequentialHint?: boolean;
```

<a id="readonlyhint"></a>

##### readOnlyHint?

```ts
optional readOnlyHint?: boolean;
```

<a id="untrustedcontenthint"></a>

##### untrustedContentHint?

```ts
optional untrustedContentHint?: boolean;
```

***

<a id="webmcptoolresult"></a>

### WebMcpToolResult

What a tool's `execute` resolves to: text for the agent, and the surface's own envelope.

#### Properties

<a id="content"></a>

##### content

```ts
content: object[];
```

###### text

```ts
text: string;
```

###### type

```ts
type: "text";
```

<a id="iserror"></a>

##### isError?

```ts
optional isError?: boolean;
```

<a id="structuredcontent"></a>

##### structuredContent

```ts
structuredContent: Record<string, unknown>;
```

## Functions

<a id="exposewebmcp"></a>

### exposeWebMcp()

```ts
function exposeWebMcp(surface, options?): WebMcpHandle;
```

Register the surface's controls, and an observe tool, as WebMCP tools on this page, and keep
them in step with the surface: every change `subscribe` reports re-derives the set and
re-registers only tools whose name, description, schema, or hints changed.

Feature-detected: without a WebMCP object nothing is registered and the handle says
`supported: false` with the reason. Browser-driving agents can still use `surface.expose()`,
and server-side agents the AXE bridge (`@axe/surface/axe`) and `@axe/mcp`.

#### Parameters

##### surface

[`Surface`](index.md#surface)

##### options?

[`WebMcpOptions`](#webmcpoptions) = `{}`

#### Returns

[`WebMcpHandle`](#webmcphandle)

***

<a id="webmcptoolnames"></a>

### webMcpToolNames()

```ts
function webMcpToolNames(ids, prefix?): Map<string, string>;
```

Tool names for entry ids: stable for an id, unique within one call, never the observe name.

#### Parameters

##### ids

readonly `string`[]

##### prefix?

`string` = `"surface_"`

#### Returns

`Map`\<`string`, `string`\>
