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

<a id="webmcpapprovaldecision"></a>

### WebMcpApprovalDecision

A trusted approval UI may name the person recorded in the surface ledger.

#### Properties

<a id="actor"></a>

##### actor?

```ts
optional actor?: string;
```

<a id="approved"></a>

##### approved

```ts
approved: boolean;
```

***

<a id="webmcpapprovalrequest"></a>

### WebMcpApprovalRequest

The exact WebMCP call a trusted application approval UI presents to the person.

#### Properties

<a id="act"></a>

##### act

```ts
act: Readonly<ActRequest>;
```

<a id="entry"></a>

##### entry

```ts
entry: ObservedEntry;
```

<a id="input"></a>

##### input

```ts
input: Readonly<Record<string, unknown>>;
```

***

<a id="webmcpdiagnostic"></a>

### WebMcpDiagnostic

#### Properties

<a id="errors"></a>

##### errors

```ts
errors: object[];
```

###### message

```ts
message: string;
```

###### tool

```ts
tool: string;
```

<a id="reason"></a>

##### reason?

```ts
optional reason?: string;
```

<a id="state"></a>

##### state

```ts
state: "unavailable" | "error" | "closed" | "registering" | "ready" | "degraded";
```

<a id="supported"></a>

##### supported

```ts
supported: boolean;
```

<a id="tools"></a>

##### tools

```ts
tools: string[];
```

***

<a id="webmcphandle"></a>

### WebMcpHandle

#### Properties

<a id="reason-1"></a>

##### reason?

```ts
readonly optional reason?: string;
```

Why nothing was registered, when `supported` is false.

<a id="supported-1"></a>

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

<a id="diagnostic"></a>

##### diagnostic()

```ts
diagnostic(): WebMcpDiagnostic;
```

Registration health for development diagnostics and compatibility checks.

###### Returns

[`WebMcpDiagnostic`](#webmcpdiagnostic)

<a id="ready"></a>

##### ready()

```ts
ready(): Promise<void>;
```

Resolves when the current registration round has settled.

###### Returns

`Promise`\<`void`\>

<a id="tools-1"></a>

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

<a id="actor-1"></a>

##### actor?

```ts
optional actor?: string;
```

The `actor` recorded in the ledger for acts made through these tools. Default `webmcp`.

<a id="content"></a>

##### content?

```ts
optional content?: boolean;
```

Register `<prefix>read` and `<prefix>wait` when the surface has page content. Default true.

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

<a id="requestapproval"></a>

##### requestApproval?

```ts
optional requestApproval?: (request) => MaybePromise<boolean | WebMcpApprovalDecision>;
```

Ask the person before a high-risk action, an action that declares `confirm`, or a control
whose surface state says `approval_required`. This is trusted application UI: it must show
the exact request and resolve only from the person's interaction. Never implement it with
anything an agent can invoke. Without it, approval-sensitive calls are refused.

###### Parameters

###### request

[`WebMcpApprovalRequest`](#webmcpapprovalrequest)

###### Returns

[`MaybePromise`](index.md#maybepromise)\<`boolean` \| [`WebMcpApprovalDecision`](#webmcpapprovaldecision)\>

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

<a id="content-1"></a>

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

Register the surface's controls and observation as WebMCP tools on this page, plus page read and
wait tools when this is an auto surface, and keep them in step with the surface: every change
`subscribe` reports re-derives the set and re-registers only tools whose name, description,
schema, or hints changed.

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
