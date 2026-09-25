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
handle(request, adapter?): Promise<Response>;
```

Serve one AXE request. The second argument is the adapter context: an `identity` or `tenant`
established by the caller, used instead of the site's own `authenticate` (see `CallerContext`).

###### Parameters

###### request

`Request`

###### adapter?

`AdapterContext`

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

<a id="client-2"></a>

##### client?

```ts
optional client?: ClientOptions;
```

Options for the underlying AXE client (auth, agent identification, fetch). Over HTTP with
`serveHttp`, `auth` and `headers` here are one identity shared by every MCP client; see
`ServeHttpOptions.clientFor` for per-caller identity.

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
