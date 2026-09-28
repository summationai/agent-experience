[AXE API reference](../README.md) / @axe/mcp

# @axe/mcp

## Interfaces

<a id="authinfo"></a>

### AuthInfo

Information about a validated access token, provided to request handlers.

#### Properties

<a id="clientid"></a>

##### clientId

```ts
clientId: string;
```

The client ID associated with this token.

<a id="expiresat"></a>

##### expiresAt?

```ts
optional expiresAt?: number;
```

When the token expires (in seconds since epoch).

<a id="extra"></a>

##### extra?

```ts
optional extra?: Record<string, unknown>;
```

Additional data associated with the token.
This field should be used for any additional data that needs to be attached to the auth info.

<a id="resource"></a>

##### resource?

```ts
optional resource?: URL;
```

The RFC 8707 resource server identifier for which this token is valid.
If set, this MUST match the MCP server's resource identifier (minus hash fragment).

<a id="scopes"></a>

##### scopes

```ts
scopes: string[];
```

Scopes associated with this token.

<a id="token"></a>

##### token

```ts
token: string;
```

The access token.

***

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
handle(
   request, 
   adapter?, 
   call?
): Promise<Response>;
```

Serve one AXE request. The second argument is the adapter context: an `identity` or `tenant`
established by the caller, used instead of the site's own `authenticate` (see `CallerContext`).

###### Parameters

###### request

`Request`

###### adapter?

`AdapterContext`

###### call?

[`ToolCallContext`](#toolcallcontext)

###### Returns

`Promise`\<`Response`\>

<a id="onactionschanged"></a>

##### onActionsChanged()?

```ts
optional onActionsChanged(listener): () => void;
```

When present, the set of actions can change while the server runs (an `AXE` instance with an
action provider). The tool list is then derived on every `tools/list`, and each change is
forwarded to connected clients as `notifications/tools/list_changed`.

###### Parameters

###### listener

() => `void`

###### Returns

() => `void`

***

<a id="callercontext"></a>

### CallerContext

Who the AXE site sees for one MCP caller over HTTP. Returned by `ServeHttpOptions.clientFor`
for each verified caller.

#### Properties

<a id="client"></a>

##### client?

```ts
optional client?: ClientOptions;
```

AXE client options for this caller, merged over `createMcpServer`'s `client` option, whose
`auth` and `headers` are not inherited. For a URL or manifest source, set `auth` to a
credential the AXE site accepts for this user (for example a token obtained by token exchange).

<a id="identity"></a>

##### identity?

```ts
optional identity?: Identity | null;
```

In-process source only: the identity the AXE runtime uses for this caller, as a framework
adapter would pass it. The site's `authenticate` is not consulted.

<a id="tenant"></a>

##### tenant?

```ts
optional tenant?: TenantInfo | null;
```

In-process source only: the tenant, as a framework adapter would pass it.

***

<a id="derivedmcpserver"></a>

### DerivedMcpServer

#### Properties

<a id="client-1"></a>

##### client

```ts
client: AXEClient;
```

<a id="manifest"></a>

##### manifest

```ts
manifest: Manifest;
```

The manifest when the server was created. The tool list is re-derived from the current manifest on every `tools/list`.

<a id="server"></a>

##### server

```ts
server: Server;
```

An MCP server for one connection (stdio, or a transport you connect yourself). `serveHttp` builds its own per session or request.

<a id="tools"></a>

##### tools

```ts
tools: object[];
```

The tools when the server was created.

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
optional taskSupport?: "required" | "optional" | "forbidden";
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

#### Methods

<a id="refresh"></a>

##### refresh()

```ts
refresh(): Promise<boolean>;
```

Fetch the site's manifest again now (a URL or manifest source; an in-process source is always
current) and tell connected MCP clients when the tool list changed. Resolves to whether it did.

###### Returns

`Promise`\<`boolean`\>

***

<a id="elicitationmodes"></a>

### ElicitationModes

The client's declared elicitation modes (spec: `{}` means form only).

#### Properties

<a id="form"></a>

##### form

```ts
form: boolean;
```

<a id="url"></a>

##### url

```ts
url: boolean;
```

***

<a id="extratool"></a>

### ExtraTool

A tool answered by your own code (`McpServerOptions.extraTools`).

#### Properties

<a id="definition"></a>

##### definition

```ts
definition: object;
```

The MCP tool definition: name, description, input schema, annotations.

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
optional taskSupport?: "required" | "optional" | "forbidden";
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

#### Methods

<a id="call"></a>

##### call()

```ts
call(args, context): Promise<{
[key: string]: unknown;
  _meta?: {
   [key: string]: unknown;
     io.modelcontextprotocol/related-task?: {
        taskId: string;
     };
     progressToken?: string | number;
  };
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
  isError?: boolean;
  structuredContent?: {
   [key: string]: unknown;
  };
}>;
```

###### Parameters

###### args

`Record`\<`string`, `unknown`\>

###### context

[`ExtraToolContext`](#extratoolcontext)

###### Returns

`Promise`\<\{
\[`key`: `string`\]: `unknown`;
  `_meta?`: \{
   \[`key`: `string`\]: `unknown`;
     `io.modelcontextprotocol/related-task?`: \{
        `taskId`: `string`;
     \};
     `progressToken?`: `string` \| `number`;
  \};
  `content`: (
     \| \{
     `_meta?`: \{
      \[`key`: `string`\]: `unknown`;
     \};
     `annotations?`: \{
        `audience?`: (`"user"` \| `"assistant"`)[];
        `lastModified?`: `string`;
        `priority?`: `number`;
     \};
     `text`: `string`;
     `type`: `"text"`;
   \}
     \| \{
     `_meta?`: \{
      \[`key`: `string`\]: `unknown`;
     \};
     `annotations?`: \{
        `audience?`: (`"user"` \| `"assistant"`)[];
        `lastModified?`: `string`;
        `priority?`: `number`;
     \};
     `data`: `string`;
     `mimeType`: `string`;
     `type`: `"image"`;
   \}
     \| \{
     `_meta?`: \{
      \[`key`: `string`\]: `unknown`;
     \};
     `annotations?`: \{
        `audience?`: (`"user"` \| `"assistant"`)[];
        `lastModified?`: `string`;
        `priority?`: `number`;
     \};
     `data`: `string`;
     `mimeType`: `string`;
     `type`: `"audio"`;
   \}
     \| \{
     `_meta?`: \{
      \[`key`: `string`\]: `unknown`;
     \};
     `annotations?`: \{
        `audience?`: (`"user"` \| `"assistant"`)[];
        `lastModified?`: `string`;
        `priority?`: `number`;
     \};
     `description?`: `string`;
     `icons?`: `object`[];
     `mimeType?`: `string`;
     `name`: `string`;
     `size?`: `number`;
     `title?`: `string`;
     `type`: `"resource_link"`;
     `uri`: `string`;
   \}
     \| \{
     `_meta?`: \{
      \[`key`: `string`\]: `unknown`;
     \};
     `annotations?`: \{
        `audience?`: (`"user"` \| `"assistant"`)[];
        `lastModified?`: `string`;
        `priority?`: `number`;
     \};
     `resource`:   \| \{
        `_meta?`: \{
         \[`key`: `string`\]: `unknown`;
        \};
        `mimeType?`: `string`;
        `text`: `string`;
        `uri`: `string`;
      \}
        \| \{
        `_meta?`: \{
         \[`key`: `string`\]: `unknown`;
        \};
        `blob`: `string`;
        `mimeType?`: `string`;
        `uri`: `string`;
      \};
     `type`: `"resource"`;
  \})[];
  `isError?`: `boolean`;
  `structuredContent?`: \{
   \[`key`: `string`\]: `unknown`;
  \};
\}\>

***

<a id="extratoolcontext"></a>

### ExtraToolContext

What an extra tool's `call` receives besides its arguments.

#### Properties

<a id="authinfo-1"></a>

##### authInfo?

```ts
optional authInfo?: AuthInfo;
```

The request's verified access token, over HTTP with `serveHttp`'s `auth`.

<a id="caller"></a>

##### caller?

```ts
optional caller?: CallerContext;
```

What `clientFor` returned for this caller, over HTTP.

***

<a id="formatoptions"></a>

### FormatOptions

#### Properties

<a id="presentation"></a>

##### presentation?

```ts
optional presentation?: boolean;
```

EXPERIMENTAL. Attach the `toHTML` rendering of a `display` result for the MCP Apps view.

***

<a id="formschema"></a>

### FormSchema

A form-mode `requestedSchema` for a kind's payload schema, and whether the payload was wrapped.

#### Properties

<a id="requestedschema"></a>

##### requestedSchema

```ts
requestedSchema: object;
```

###### properties

```ts
properties: Record<string, Schema>;
```

###### required?

```ts
optional required?: string[];
```

###### type

```ts
type: "object";
```

<a id="wrapped"></a>

##### wrapped

```ts
wrapped: boolean;
```

The kind's payload is a single primitive, collected as the property `value`.

***

<a id="httpauthoptions"></a>

### HttpAuthOptions

Serve `/mcp` as an OAuth 2.1 resource server: verify an access token another server issued.

#### Properties

<a id="principal"></a>

##### principal?

```ts
optional principal?: (authInfo) => string;
```

The stable principal a token speaks for. Sessions and issued poll URLs are bound to it.
Default: `authInfo.extra.sub` when it is a string, otherwise a hash of the token itself.

###### Parameters

###### authInfo

[`AuthInfo`](#authinfo)

###### Returns

`string`

<a id="requiredscopes"></a>

##### requiredScopes?

```ts
optional requiredScopes?: string[];
```

Scopes every request needs; a token without them gets 403 `insufficient_scope`.

<a id="resource-1"></a>

##### resource?

```ts
optional resource?: string;
```

This server's canonical URL (the RFC 8707 resource, e.g. `https://example.com/mcp`). A token
whose `AuthInfo.resource` is set and differs is refused.

<a id="resourcemetadataurl"></a>

##### resourceMetadataUrl?

```ts
optional resourceMetadataUrl?: string;
```

Where the protected-resource metadata is served; sent in `WWW-Authenticate` on 401 and 403. See `protectedResourceMetadata`.

<a id="verifier"></a>

##### verifier

```ts
verifier: OAuthTokenVerifier;
```

Checks an access token and returns what it grants. Throw the SDK's `InvalidTokenError` for a
token that is unknown, expired, revoked, or not issued for this server (audience). Any
`OAuthTokenVerifier` from `@modelcontextprotocol/sdk` works.

***

<a id="mcphttphandler"></a>

### McpHttpHandler()

A fetch handler for `/mcp`, with session management.

```ts
McpHttpHandler(request, options?): Promise<Response>;
```

Serve one request. Pass `authInfo` when authentication already ran in front of the handler
(the SDK's `requireBearerAuth` middleware sets `req.auth`); `auth` in the options is then not needed.

#### Parameters

##### request

`Request`

##### options?

###### authInfo?

[`AuthInfo`](#authinfo)

#### Returns

`Promise`\<`Response`\>

#### Properties

<a id="sessioncount"></a>

##### sessionCount

```ts
readonly sessionCount: number;
```

Open sessions (stateful mode).

#### Methods

<a id="close"></a>

##### close()

```ts
close(): Promise<void>;
```

Close every session and stop the idle sweep.

###### Returns

`Promise`\<`void`\>

***

<a id="mcpserveroptions"></a>

### McpServerOptions

#### Properties

<a id="apps"></a>

##### apps?

```ts
optional apps?: boolean;
```

EXPERIMENTAL. Offer the MCP Apps view (`ui://axe/presentation`) for actions with `display`,
only to a host that declared the `io.modelcontextprotocol/ui` extension. `false` turns it
off. Default on.

<a id="client-2"></a>

##### client?

```ts
optional client?: ClientOptions;
```

Options for the underlying AXE client (auth, agent identification, fetch). Over HTTP with
`serveHttp`, `auth` and `headers` here are one identity shared by every MCP client; see
`ServeHttpOptions.clientFor` for per-caller identity.

<a id="elicitation"></a>

##### elicitation?

```ts
optional elicitation?: 
  | boolean
  | {
  timeoutMs?: number;
};
```

MCP elicitation for the ladder, used only with a client that declared the `elicitation`
capability (and a transport that can carry a server request: stdio, in-memory, or HTTP
sessions, not stateless HTTP). A `needs_input` whose preferred kind is not sensitive and fits
the form subset is asked for in a form and continued; a sensitive kind or a `needs_human`
step is offered as the site's page in URL mode when the client supports it. `false` turns it
off. Default: on, with `timeoutMs` 600000 (ten minutes) for the user to answer.

<a id="extratools"></a>

##### extraTools?

```ts
optional extraTools?: ExtraTool[];
```

Tools served beside the derived ones, answered by your own code with any MCP content (an
image, say) instead of an AXE result. A name that a derived tool also uses is an error. Each
call receives the request's verified `authInfo` (HTTP with `auth`) and the caller `clientFor`
returned for it; over stdio both are absent. Identify the caller from them, never from the
arguments.

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

<a id="oauthtokenverifier"></a>

### OAuthTokenVerifier

Slim implementation useful for token verification

#### Methods

<a id="verifyaccesstoken"></a>

##### verifyAccessToken()

```ts
verifyAccessToken(token): Promise<AuthInfo>;
```

Verifies an access token and returns information about it.

###### Parameters

###### token

`string`

###### Returns

`Promise`\<[`AuthInfo`](#authinfo)\>

***

<a id="protectedresourceoptions"></a>

### ProtectedResourceOptions

What `protectedResourceMetadata` needs: this server and the authorization servers that issue its tokens.

#### Properties

<a id="authorizationservers"></a>

##### authorizationServers

```ts
authorizationServers: string[];
```

Issuer URLs of the authorization servers whose tokens this server accepts. At least one.

<a id="resource-2"></a>

##### resource

```ts
resource: string;
```

This MCP server's canonical URL, e.g. `https://example.com/mcp`.

<a id="resourcedocumentation"></a>

##### resourceDocumentation?

```ts
optional resourceDocumentation?: string;
```

<a id="resourcename"></a>

##### resourceName?

```ts
optional resourceName?: string;
```

<a id="scopessupported"></a>

##### scopesSupported?

```ts
optional scopesSupported?: string[];
```

***

<a id="servehttpoptions"></a>

### ServeHttpOptions

#### Properties

<a id="allowedorigins"></a>

##### allowedOrigins?

```ts
optional allowedOrigins?: string[];
```

Browser origins allowed to call the endpoint, besides the endpoint's own. A request whose
`Origin` is neither is refused with 403 (DNS rebinding protection).

<a id="allowsharedcredentials"></a>

##### allowSharedCredentials?

```ts
optional allowSharedCredentials?: boolean;
```

Allow `createMcpServer`'s `client.auth` or `client.headers` to act for every HTTP caller.
Default false: `serveHttp` refuses that configuration unless `clientFor` is given.

<a id="anonymoussessionclientfor"></a>

##### anonymousSessionClientFor?

```ts
optional anonymousSessionClientFor?: (sessionId) => MaybePromise<CallerContext>;
```

Give each unauthenticated stateful MCP session its own caller identity. This is for services
that defer account login until a tool actually needs it: transport initialization stays
anonymous, while the cryptographically random MCP session id isolates the later login and
every page it can reach. Requires `sessions` and cannot be combined with transport `auth` or
`clientFor`.

###### Parameters

###### sessionId

`string`

###### Returns

`MaybePromise`\<[`CallerContext`](#callercontext)\>

<a id="auth"></a>

##### auth?

```ts
optional auth?: HttpAuthOptions;
```

Verify a bearer access token on every request. Without it, pass `authInfo` to the handler yourself or serve anonymously.

<a id="clientfor"></a>

##### clientFor?

```ts
optional clientFor?: (authInfo) => MaybePromise<CallerContext>;
```

Who the AXE site sees for a verified caller: called with the request's `AuthInfo` for every
tool call. Required with `auth`. Never return one user's credential for another.

###### Parameters

###### authInfo

[`AuthInfo`](#authinfo)

###### Returns

`MaybePromise`\<[`CallerContext`](#callercontext)\>

<a id="sessionidgenerator"></a>

##### ~~sessionIdGenerator?~~

```ts
optional sessionIdGenerator?: () => string;
```

###### Returns

`string`

###### Deprecated

Use `sessions: { generateId }`. Setting it turns sessions on.

<a id="sessions"></a>

##### sessions?

```ts
optional sessions?: boolean | SessionOptions;
```

Stateful sessions keyed by `Mcp-Session-Id` (`true` or options), or stateless (default): a
fresh server and transport per HTTP request, no session id, no server-to-client stream.

***

<a id="sessionoptions"></a>

### SessionOptions

#### Properties

<a id="clock"></a>

##### clock?

```ts
optional clock?: () => number;
```

Clock for idle expiry, in ms. Default `Date.now`.

###### Returns

`number`

<a id="generateid"></a>

##### generateId?

```ts
optional generateId?: () => string;
```

Session id generator. Default `crypto.randomUUID()`.

###### Returns

`string`

<a id="idletimeoutms"></a>

##### idleTimeoutMs?

```ts
optional idleTimeoutMs?: number;
```

A session with no request for this long is closed; its next request gets 404 and the client re-initializes. Default 1800000 (30 minutes).

<a id="maxsessions"></a>

##### maxSessions?

```ts
optional maxSessions?: number;
```

Open sessions at most. A new session past the limit is refused with 503 until one closes. Default 1000.

***

<a id="toolcallcontext"></a>

### ToolCallContext

The MCP tool call an in-process AXE request is serving, passed as `AxeLike.handle`'s third
argument. It lets the in-process server ask the user something through the client, within the
same tool call, in the same session and as the same caller (the relay asks for approvals this
way). Absent outside a tool call and for a URL or manifest source.

#### Properties

<a id="elicitation-1"></a>

##### elicitation

```ts
elicitation: ElicitationModes;
```

The elicitation modes the client declared; none when elicitation is off or the transport cannot carry a server request.

<a id="signal"></a>

##### signal

```ts
signal: AbortSignal;
```

Aborted when the client cancels the tool call or the connection closes.

#### Methods

<a id="completeelicitation"></a>

##### completeElicitation()

```ts
completeElicitation(elicitationId): Promise<void>;
```

Tell the client that a URL-mode elicitation is finished (`notifications/elicitation/complete`).

###### Parameters

###### elicitationId

`string`

###### Returns

`Promise`\<`void`\>

<a id="elicit"></a>

##### elicit()

```ts
elicit(params): Promise<{
[key: string]: unknown;
  _meta?: {
   [key: string]: unknown;
     io.modelcontextprotocol/related-task?: {
        taskId: string;
     };
     progressToken?: string | number;
  };
  action: "accept" | "cancel" | "decline";
  content?: {
   [key: string]: string | number | boolean | string[];
  };
}>;
```

Send an elicitation request to the client, related to this tool call. The client shows it to
the user; the model cannot answer it. Rejects when the client cannot take it (a timeout, a
stateless exchange, an undeclared mode).

###### Parameters

###### params

  \| \{
  `_meta?`: \{
   \[`key`: `string`\]: `unknown`;
     `io.modelcontextprotocol/related-task?`: \{
        `taskId`: `string`;
     \};
     `progressToken?`: `string` \| `number`;
  \};
  `message`: `string`;
  `mode?`: `"form"`;
  `requestedSchema`: \{
     `properties`: \{
      \[`key`: `string`\]: 
        \| \{
        `default?`: `string`;
        `description?`: `string`;
        `enum`: `string`[];
        `enumNames?`: `string`[];
        `title?`: `string`;
        `type`: `"string"`;
      \}
        \| \{
        `default?`: `string`;
        `description?`: `string`;
        `enum`: `string`[];
        `title?`: `string`;
        `type`: `"string"`;
      \}
        \| \{
        `default?`: `string`;
        `description?`: `string`;
        `oneOf`: `object`[];
        `title?`: `string`;
        `type`: `"string"`;
      \}
        \| \{
        `default?`: `string`[];
        `description?`: `string`;
        `items`: \{
           `enum`: `string`[];
           `type`: `"string"`;
        \};
        `maxItems?`: `number`;
        `minItems?`: `number`;
        `title?`: `string`;
        `type`: `"array"`;
      \}
        \| \{
        `default?`: `string`[];
        `description?`: `string`;
        `items`: \{
           `anyOf`: `object`[];
        \};
        `maxItems?`: `number`;
        `minItems?`: `number`;
        `title?`: `string`;
        `type`: `"array"`;
      \}
        \| \{
        `default?`: `boolean`;
        `description?`: `string`;
        `title?`: `string`;
        `type`: `"boolean"`;
      \}
        \| \{
        `default?`: `string`;
        `description?`: `string`;
        `format?`: `"email"` \| `"uri"` \| `"date"` \| `"date-time"`;
        `maxLength?`: `number`;
        `minLength?`: `number`;
        `title?`: `string`;
        `type`: `"string"`;
      \}
        \| \{
        `default?`: `number`;
        `description?`: `string`;
        `maximum?`: `number`;
        `minimum?`: `number`;
        `title?`: `string`;
        `type`: `"number"` \| `"integer"`;
      \};
     \};
     `required?`: `string`[];
     `type`: `"object"`;
  \};
  `task?`: \{
     `ttl?`: `number`;
  \};
\}
  \| \{
  `_meta?`: \{
   \[`key`: `string`\]: `unknown`;
     `io.modelcontextprotocol/related-task?`: \{
        `taskId`: `string`;
     \};
     `progressToken?`: `string` \| `number`;
  \};
  `elicitationId`: `string`;
  `message`: `string`;
  `mode`: `"url"`;
  `task?`: \{
     `ttl?`: `number`;
  \};
  `url`: `string`;
\}

###### Returns

`Promise`\<\{
\[`key`: `string`\]: `unknown`;
  `_meta?`: \{
   \[`key`: `string`\]: `unknown`;
     `io.modelcontextprotocol/related-task?`: \{
        `taskId`: `string`;
     \};
     `progressToken?`: `string` \| `number`;
  \};
  `action`: `"accept"` \| `"cancel"` \| `"decline"`;
  `content?`: \{
   \[`key`: `string`\]: `string` \| `number` \| `boolean` \| `string`[];
  \};
\}\>

## Type Aliases

<a id="calltoolresult"></a>

### CallToolResult

```ts
type CallToolResult = Infer<typeof CallToolResultSchema>;
```

***

<a id="tool"></a>

### Tool

```ts
type Tool = Infer<typeof ToolSchema>;
```

## Variables

<a id="apps_extension"></a>

### APPS\_EXTENSION

```ts
const APPS_EXTENSION: "io.modelcontextprotocol/ui" = "io.modelcontextprotocol/ui";
```

A minimal MCP Apps view for AXE `display` (review item 14, 2026-09-24). EXPERIMENTAL.

The installed MCP SDK (1.30.1) has no types for the Apps extension, so this module implements
the wire shape from the extension's specification (SEP-1865, "MCP Apps", stable version
2026-01-26, read 2026-09-24 at github.com/modelcontextprotocol/ext-apps and
apps.extensions.modelcontextprotocol.io):

- A host that renders Apps declares `capabilities.extensions["io.modelcontextprotocol/ui"]`
  with `mimeTypes` including `text/html;profile=mcp-app`. Servers SHOULD check it before
  offering UI; the bridge offers nothing to a host that did not declare it.
- A UI resource has a `ui://` URI and that MIME type, and is read with `resources/read`
  (`text`). A tool points at it with `_meta.ui.resourceUri`.
- The view is an iframe that speaks JSON-RPC over `postMessage`: it sends `ui/initialize`,
  then `ui/notifications/initialized`, and receives `ui/notifications/tool-result` with the
  tool's `CallToolResult`. The host's default CSP allows inline script and style and no
  network (`connect-src 'none'`, images from `'self'` and `data:` only).

The view here is one static page for every `display` action. Each `ok` result of such an
action carries the `toHTML` rendering in `_meta["axe/presentation"].html`; the view parses it
with `DOMParser` (which runs no script), drops scripts, event-handler attributes, the affordance
buttons (they have no effect inside a host), and anything but the page's `<style>` and
`<main>`, and shows it. The text content stays the Markdown
rendering, which is what a host without Apps shows ([P-MCP-8]).

***

<a id="apps_mime_type"></a>

### APPS\_MIME\_TYPE

```ts
const APPS_MIME_TYPE: "text/html;profile=mcp-app" = "text/html;profile=mcp-app";
```

***

<a id="presentation_meta_key"></a>

### PRESENTATION\_META\_KEY

```ts
const PRESENTATION_META_KEY: "axe/presentation" = "axe/presentation";
```

***

<a id="presentation_uri"></a>

### PRESENTATION\_URI

```ts
const PRESENTATION_URI: "ui://axe/presentation" = "ui://axe/presentation";
```

***

<a id="presentation_view_html"></a>

### PRESENTATION\_VIEW\_HTML

```ts
const PRESENTATION_VIEW_HTML: "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>Result</title>\n<style>body{margin:0;font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}#axe-root>pre{white-space:pre-wrap;padding:16px;margin:0}</style>\n</head>\n<body>\n<div id=\"axe-root\"><p style=\"padding:16px;margin:0\">Waiting for the result.</p></div>\n<script>(function(){\nvar nextId=1,pending={},hostCaps={};\nvar root=document.getElementById(\"axe-root\");\nfunction post(m){window.parent.postMessage(m,\"*\")}\nfunction request(method,params){var id=nextId++;post({jsonrpc:\"2.0\",id:id,method:method,params:params});return new Promise(function(res,rej){pending[id]={res:res,rej:rej}})}\nfunction textOf(result){var c=(result&&result.content)||[];var out=[];for(var i=0;i<c.length;i++){if(c[i]&&c[i].type===\"text\")out.push(String(c[i].text||\"\"))}return out.join(\"\n\")}\nfunction clean(node){var all=node.querySelectorAll(\"*\");for(var i=0;i<all.length;i++){var el=all[i];var names=[];for(var j=0;j<el.attributes.length;j++){var n=el.attributes[j].name;if(/^on/i.test(n)||n===\"srcdoc\")names.push(n)}for(var k=0;k<names.length;k++)el.removeAttribute(names[k]);var href=el.getAttribute(\"href\");if(href&&!/^https?:/i.test(href))el.removeAttribute(\"href\");var src=el.getAttribute(\"src\");if(src&&!/^https?:/i.test(src))el.removeAttribute(\"src\")}}\nfunction render(result){var meta=result&&result._meta&&result._meta[\"axe/presentation\"];var html=meta&&typeof meta.html===\"string\"?meta.html:null;if(!html){var pre=document.createElement(\"pre\");pre.textContent=textOf(result)||\"No result.\";root.replaceChildren(pre);return}\nvar doc=new DOMParser().parseFromString(html,\"text/html\");var dead=doc.querySelectorAll(\"script,iframe,object,embed,form,link,meta,base,.axe-actions\");for(var i=0;i<dead.length;i++)dead[i].remove();\nvar main=doc.querySelector(\"main\");if(!main){root.textContent=textOf(result);return}clean(main);\nvar styles=doc.querySelectorAll(\"style\");var head=document.head;var old=head.querySelectorAll(\"style[data-axe]\");for(var s=0;s<old.length;s++)old[s].remove();for(var t=0;t<styles.length;t++){var st=document.createElement(\"style\");st.setAttribute(\"data-axe\",\"\");st.textContent=styles[t].textContent;head.appendChild(st)}\nroot.replaceChildren(document.importNode(main,true))}\nwindow.addEventListener(\"message\",function(e){if(e.source!==window.parent)return;var m=e.data;if(!m||m.jsonrpc!==\"2.0\")return;\nif(m.id!=null&&pending[m.id]&&((\"result\" in m)||(\"error\" in m))){var p=pending[m.id];delete pending[m.id];if(\"error\" in m)p.rej(m.error);else p.res(m.result);return}\nif(m.method===\"ui/notifications/tool-result\")render(m.params||{})});\ndocument.addEventListener(\"click\",function(e){var a=e.target&&e.target.closest?e.target.closest(\"a[href]\"):null;if(!a||!hostCaps.openLinks)return;e.preventDefault();request(\"ui/open-link\",{url:a.href}).catch(function(){})});\nrequest(\"ui/initialize\",{protocolVersion:\"2026-01-26\",appCapabilities:{},clientInfo:{name:\"axe-presentation\",version:\"0.1.0\"}}).then(function(r){hostCaps=(r&&r.hostCapabilities)||{};post({jsonrpc:\"2.0\",method:\"ui/notifications/initialized\",params:{}})},function(){})\n})();</script>\n</body>\n</html>\n";
```

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
   brand, 
   options?
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

##### options?

[`FormatOptions`](#formatoptions) = `{}`

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

<a id="issensitiveaccept"></a>

### isSensitiveAccept()

```ts
function isSensitiveAccept(accept): boolean;
```

#### Parameters

##### accept

`Pick`\<[`Accept`](client/index.md#accept), `"kind"` \| `"sensitive"`\>

#### Returns

`boolean`

***

<a id="protectedresourcemetadata"></a>

### protectedResourceMetadata()

```ts
function protectedResourceMetadata(options): object;
```

RFC 9728 protected-resource metadata for an MCP endpoint, which MCP clients read to find the
authorization server. Returns the document, the path and URL to serve it at
(`/.well-known/oauth-protected-resource` plus the endpoint's path), and a fetch handler for it.
This package does not issue tokens.

#### Parameters

##### options

[`ProtectedResourceOptions`](#protectedresourceoptions)

#### Returns

`object`

##### handler

```ts
handler: (request) => Response;
```

###### Parameters

###### request

`Request`

###### Returns

`Response`

##### metadata

```ts
metadata: object;
```

###### Index Signature

```ts
[key: string]: unknown
```

###### metadata.authorization\_details\_types\_supported?

```ts
optional authorization_details_types_supported?: string[];
```

###### metadata.authorization\_servers?

```ts
optional authorization_servers?: string[];
```

###### metadata.bearer\_methods\_supported?

```ts
optional bearer_methods_supported?: string[];
```

###### metadata.dpop\_bound\_access\_tokens\_required?

```ts
optional dpop_bound_access_tokens_required?: boolean;
```

###### metadata.dpop\_signing\_alg\_values\_supported?

```ts
optional dpop_signing_alg_values_supported?: string[];
```

###### metadata.jwks\_uri?

```ts
optional jwks_uri?: string;
```

###### metadata.resource

```ts
resource: string;
```

###### metadata.resource\_documentation?

```ts
optional resource_documentation?: string;
```

###### metadata.resource\_name?

```ts
optional resource_name?: string;
```

###### metadata.resource\_policy\_uri?

```ts
optional resource_policy_uri?: string;
```

###### metadata.resource\_signing\_alg\_values\_supported?

```ts
optional resource_signing_alg_values_supported?: string[];
```

###### metadata.resource\_tos\_uri?

```ts
optional resource_tos_uri?: string;
```

###### metadata.scopes\_supported?

```ts
optional scopes_supported?: string[];
```

###### metadata.tls\_client\_certificate\_bound\_access\_tokens?

```ts
optional tls_client_certificate_bound_access_tokens?: boolean;
```

##### path

```ts
path: string;
```

##### url

```ts
url: string;
```

***

<a id="servehttp"></a>

### serveHttp()

```ts
function serveHttp(derived, options?): McpHttpHandler;
```

A fetch handler for the Streamable HTTP transport. Mount it at `/mcp` in any Web-standard
framework. Stateless by default; see `ServeHttpOptions` for sessions and authentication.

#### Parameters

##### derived

[`DerivedMcpServer`](#derivedmcpserver)

##### options?

[`ServeHttpOptions`](#servehttpoptions) = `{}`

#### Returns

[`McpHttpHandler`](#mcphttphandler)

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

<a id="toformschema"></a>

### toFormSchema()

```ts
function toFormSchema(schema): FormSchema | null;
```

The form subset of a payload schema, or null when any part of it has no form rendering (a
nested object, an array of objects, a union, a reference). Keywords outside the subset that
only narrow a value (a format other than the four, for instance) are dropped; the site
validates the payload again on `/axe/continue`.

#### Parameters

##### schema

`JsonSchema`

#### Returns

[`FormSchema`](#formschema) \| `null`

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
