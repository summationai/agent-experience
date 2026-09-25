[AXE API reference](../../README.md) / [@axe/host](README.md) / index

# index

## Interfaces

<a id="appsession"></a>

### AppSession

What a hosted session starts with, returned by `sessionFor`. Every part is optional; they
combine (the storage state first, then `cookies` and `localStorage` over it).

#### Properties

<a id="cookies"></a>

##### cookies?

```ts
optional cookies?: SessionCookie[];
```

Cookies to set, such as the application's session cookie.

<a id="headers"></a>

##### headers?

```ts
optional headers?: Record<string, string>;
```

Headers sent with every request to the application's origin, and to no other origin.

<a id="localstorage"></a>

##### localStorage?

```ts
optional localStorage?: Record<string, Record<string, string>>;
```

`localStorage` entries by origin: `{ "https://app.example.com": { key: "value" } }`.

<a id="storagestate"></a>

##### storageState?

```ts
optional storageState?: string | StorageState;
```

A Playwright storage state: a file path or the object (`axe host login` writes one).

***

<a id="host"></a>

### Host

#### Properties

<a id="devagentkey"></a>

##### devAgentKey

```ts
readonly devAgentKey: string | null;
```

Development: the bearer key `/mcp` accepts.

<a id="relay"></a>

##### relay

```ts
readonly relay: Relay;
```

The relay the hosted pages connect to.

#### Methods

<a id="close"></a>

##### close()

```ts
close(): Promise<void>;
```

###### Returns

`Promise`\<`void`\>

<a id="closesession"></a>

##### closeSession()

```ts
closeSession(who): Promise<boolean>;
```

Close the identity's session; the next tool call starts a new one. Resolves false when none was running.

###### Parameters

###### who

`RelayPrincipal`

###### Returns

`Promise`\<`boolean`\>

<a id="handle"></a>

##### handle()

```ts
handle(request, context?): Promise<Response>;
```

The HTTP routes (`/mcp`, protected-resource metadata, `/health`, and in development the watch page) as a fetch handler.

###### Parameters

###### request

`Request`

###### context?

###### remoteAddress?

`string`

###### Returns

`Promise`\<`Response`\>

<a id="listen"></a>

##### listen()

```ts
listen(options?): Promise<HostAddress>;
```

Serve the HTTP routes on a new server.

###### Parameters

###### options?

[`HostListenOptions`](#hostlistenoptions)

###### Returns

`Promise`\<[`HostAddress`](#hostaddress)\>

<a id="page"></a>

##### page()

```ts
page(who): Page | null;
```

The Playwright page of a running session, for diagnostics and tests; null when none runs.

###### Parameters

###### who

`RelayPrincipal`

###### Returns

`Page` \| `null`

<a id="relayevent"></a>

##### relayEvent()

```ts
relayEvent(event): void;
```

With a `Relay` you run: pass its `onEvent` events here, so Stop in the relay closes the session.

###### Parameters

###### event

`RelayEvent`

###### Returns

`void`

<a id="resume"></a>

##### resume()

```ts
resume(who): void;
```

Allow sessions for an identity `stop` held.

###### Parameters

###### who

`RelayPrincipal`

###### Returns

`void`

<a id="screenshot"></a>

##### screenshot()

```ts
screenshot(who, options?): Promise<Buffer<ArrayBufferLike>>;
```

A PNG of the identity's page, starting the session if needed.

###### Parameters

###### who

`RelayPrincipal`

###### options?

###### fullPage?

`boolean`

###### Returns

`Promise`\<`Buffer`\<`ArrayBufferLike`\>\>

<a id="servestdio"></a>

##### serveStdio()

```ts
serveStdio(options?): Promise<DerivedMcpServer>;
```

The MCP server over stdio, acting for `as` (default in development: the development identity).

###### Parameters

###### options?

###### as?

`RelayPrincipal`

###### Returns

`Promise`\<`DerivedMcpServer`\>

<a id="session"></a>

##### session()

```ts
session(who, authInfo?): Promise<HostSessionInfo>;
```

Start the identity's session if it is not running (or has crashed), and resolve when its
page's surface is connected to the relay. Every tool call does this first.

###### Parameters

###### who

`RelayPrincipal`

###### authInfo?

[`AuthInfo`](../mcp.md#authinfo) \| `null`

###### Returns

`Promise`\<[`HostSessionInfo`](#hostsessioninfo)\>

<a id="sessions"></a>

##### sessions()

```ts
sessions(): HostSessionInfo[];
```

The running sessions.

###### Returns

[`HostSessionInfo`](#hostsessioninfo)[]

<a id="stop"></a>

##### stop()

```ts
stop(who): Promise<void>;
```

Stop, for the person or the owner: revoke the session's relay token, close the session, and
start none for this identity again until `resume(who)` (or a restart of the host).

###### Parameters

###### who

`RelayPrincipal`

###### Returns

`Promise`\<`void`\>

***

<a id="hostaddress"></a>

### HostAddress

#### Properties

<a id="host-1"></a>

##### host

```ts
host: string;
```

<a id="mcpurl"></a>

##### mcpUrl

```ts
mcpUrl: string;
```

Where agents connect over HTTP.

<a id="port"></a>

##### port

```ts
port: number;
```

<a id="url"></a>

##### url

```ts
url: string;
```

<a id="watchurl"></a>

##### watchUrl

```ts
watchUrl: string | null;
```

Development: the page that shows the hidden session, polling screenshots.

***

<a id="hostbrowseroptions"></a>

### HostBrowserOptions

How the host starts Chromium.

#### Properties

<a id="args"></a>

##### args?

```ts
optional args?: string[];
```

Extra Chromium command-line switches.

<a id="executablepath"></a>

##### executablePath?

```ts
optional executablePath?: string;
```

A Chromium or Chrome executable, instead of Playwright's download.

<a id="headless"></a>

##### headless?

```ts
optional headless?: boolean;
```

Default true. `false` shows the windows, for debugging.

<a id="launch"></a>

##### launch?

```ts
optional launch?: () => Promise<Browser>;
```

Start the browser yourself (a remote browser, a custom build). Default: Playwright's
`chromium.launch` from `playwright-core`, which needs a Chromium it can find
(`npx playwright install chromium`, or `executablePath`).

###### Returns

`Promise`\<`Browser`\>

***

<a id="hostdevoptions"></a>

### HostDevOptions

Local development: loopback only, one configured identity, a key for `/mcp`, a watch page.

#### Properties

<a id="agentkey"></a>

##### agentKey?

```ts
optional agentKey?: string;
```

The bearer key `/mcp` accepts. Default: random per process.

<a id="identity"></a>

##### identity?

```ts
optional identity?: RelayPrincipal;
```

Who the agent acts as. Default `{ principal: "dev", tenant: "dev" }`.

***

<a id="hostlistenoptions"></a>

### HostListenOptions

#### Properties

<a id="host-2"></a>

##### host?

```ts
optional host?: string;
```

Default `127.0.0.1`.

<a id="port-1"></a>

##### port?

```ts
optional port?: number;
```

Default 0 (any free port).

***

<a id="hostoptions"></a>

### HostOptions

#### Properties

<a id="agentauth"></a>

##### agentAuth?

```ts
optional agentAuth?: RelayAgentAuth;
```

How agents authenticate over HTTP: an OAuth 2.1 resource server (`verifier`, and `identify`,
the principal and tenant a verified token speaks for). Without it (and without `dev`), `/mcp`
is not served and only stdio (`serveStdio({ as })`) reaches the host.

<a id="allowedorigins"></a>

##### allowedOrigins?

```ts
optional allowedOrigins?: string[];
```

Origins, besides `appUrl`'s, a hosted page may navigate to (exact origins, `https://*.example.com`,
`http://localhost:*`), such as an identity provider's sign-in page. Every other navigation is
refused and the page stays where it was.

<a id="appurl"></a>

##### appUrl

```ts
appUrl: string;
```

The application: its origin is the one origin the hosted pages run on by default.

<a id="browser"></a>

##### browser?

```ts
optional browser?: HostBrowserOptions;
```

<a id="description"></a>

##### description?

```ts
optional description?: string;
```

<a id="dev"></a>

##### dev?

```ts
optional dev?: boolean | HostDevOptions;
```

Local development. See `HostDevOptions`; `axe host --dev` turns it on.

<a id="idlems"></a>

##### idleMs?

```ts
optional idleMs?: number;
```

A session with no tool call for this long is closed; the next call starts it again. Default 900000 (15 minutes).

<a id="maxsessions"></a>

##### maxSessions?

```ts
optional maxSessions?: number;
```

Sessions running at once; starting one more closes the least recently used. Default 20.

<a id="name"></a>

##### name?

```ts
optional name?: string;
```

Name and description of the MCP server.

<a id="navigationtimeoutms"></a>

##### navigationTimeoutMs?

```ts
optional navigationTimeoutMs?: number;
```

How long the first page may take to load and connect its surface, in ms. Default 30000.

<a id="onevent"></a>

##### onEvent?

```ts
optional onEvent?: (event) => void;
```

The host's audit stream: sessions started, closed, and refused navigations. Never cookies or tokens.

###### Parameters

###### event

[`HostEvent`](#hostevent)

###### Returns

`void`

<a id="protectedresource"></a>

##### protectedResource?

```ts
optional protectedResource?: ProtectedResourceOptions;
```

Serve RFC 9728 protected-resource metadata so MCP clients find your authorization server
(`resource` is the `/mcp` URL). Its URL is sent in `WWW-Authenticate` challenges.

<a id="relay-1"></a>

##### relay?

```ts
optional relay?: Relay | Partial<RelayOptions>;
```

The relay the hosted pages connect to. Default: one the host creates in-process on loopback,
accepting tabs from `appUrl`'s origin only. Pass `RelayOptions` to adjust it (`domains`,
`namespace`, timeouts), or a `Relay` you run, with `relayUrl` and `relaySecret`.

<a id="relaysecret"></a>

##### relaySecret?

```ts
optional relaySecret?: string;
```

With a `Relay` instance: the secret it verifies relay tokens with.

<a id="relayurl"></a>

##### relayUrl?

```ts
optional relayUrl?: string;
```

With a `Relay` instance: the tab endpoint the hosted pages connect to (`ws://127.0.0.1:4717/tab`).

<a id="restrict"></a>

##### restrict?

```ts
optional restrict?: "navigations" | "all";
```

`navigations` (the default): refuse navigations outside the allowed origins, top-level and in
frames. `all`: refuse every request outside them (scripts, images, `fetch`), for an application
that loads nothing from elsewhere.

<a id="sessionfor"></a>

##### sessionFor?

```ts
optional sessionFor?: SessionFor;
```

The application session for an identity (cookies, a storage state, headers). Default: none,
for an application that needs no sign-in. See `storageStateSession` and `cookieSession`.

<a id="startpath"></a>

##### startPath?

```ts
optional startPath?: string;
```

The path each session opens first, relative to `appUrl`. Default: `appUrl` itself.

<a id="tokenttlseconds"></a>

##### tokenTtlSeconds?

```ts
optional tokenTtlSeconds?: number;
```

Lifetime of each relay token the host mints, in seconds. Default 600; the page renews in-band.

<a id="viewport"></a>

##### viewport?

```ts
optional viewport?: object;
```

The viewport of each hosted page. Default 1280 by 800.

###### height

```ts
height: number;
```

###### width

```ts
width: number;
```

***

<a id="hostsessioninfo"></a>

### HostSessionInfo

A running hosted session, as `host.sessions()` lists it.

#### Properties

<a id="lastusedat"></a>

##### lastUsedAt

```ts
lastUsedAt: string;
```

<a id="path"></a>

##### path

```ts
path: string;
```

The page's path (never its query).

<a id="principal"></a>

##### principal

```ts
principal: string;
```

<a id="startedat"></a>

##### startedAt

```ts
startedAt: string;
```

<a id="state"></a>

##### state

```ts
state: "starting" | "ready" | "down";
```

<a id="tabid"></a>

##### tabId

```ts
tabId: string;
```

The relay tab id of the session's page (stable across restarts of the session).

<a id="tenant"></a>

##### tenant

```ts
tenant: string;
```

***

<a id="injectedrelayconfig"></a>

### InjectedRelayConfig

What a host puts in `window.__AXE_RELAY__`.

#### Properties

<a id="gettoken"></a>

##### getToken?

```ts
optional getToken?: () => string | Promise<string>;
```

Optional: a function (an exposed binding) that returns a fresh token, for sessions that outlive one.

###### Returns

`string` \| `Promise`\<`string`\>

<a id="indicator"></a>

##### indicator?

```ts
optional indicator?: boolean;
```

Show the in-page indicator. Default: on when attended, off when unattended.

<a id="mode"></a>

##### mode

```ts
mode: RelayMode;
```

<a id="token"></a>

##### token

```ts
token: string;
```

A relay token the host minted for the person the session is for.

<a id="url-1"></a>

##### url

```ts
url: string;
```

The relay's tab endpoint.

***

<a id="sessioncookie"></a>

### SessionCookie

A cookie for the session's browser context. Without `url` or `domain`, it is set for the application's origin.

#### Properties

<a id="domain"></a>

##### domain?

```ts
optional domain?: string;
```

<a id="expires"></a>

##### expires?

```ts
optional expires?: number;
```

Seconds since the epoch; omit for a session cookie.

<a id="httponly"></a>

##### httpOnly?

```ts
optional httpOnly?: boolean;
```

<a id="name-1"></a>

##### name

```ts
name: string;
```

<a id="path-1"></a>

##### path?

```ts
optional path?: string;
```

<a id="samesite"></a>

##### sameSite?

```ts
optional sameSite?: "Strict" | "Lax" | "None";
```

<a id="secure"></a>

##### secure?

```ts
optional secure?: boolean;
```

<a id="url-2"></a>

##### url?

```ts
optional url?: string;
```

<a id="value"></a>

##### value

```ts
value: string;
```

***

<a id="sessionrequest"></a>

### SessionRequest

What `sessionFor` receives.

#### Extends

- [`HostIdentity`](#hostidentity)

#### Properties

<a id="authinfo"></a>

##### authInfo

```ts
authInfo: AuthInfo | null;
```

The agent's verified access token, as the MCP endpoint's verifier returned it (HTTP), or null
(stdio and development, where the identity is configured rather than signed in). Use it to
exchange for an application session; never put it in the page.

<a id="principal-1"></a>

##### principal

```ts
principal: string;
```

###### Inherited from

```ts
HostIdentity.principal
```

<a id="tenant-1"></a>

##### tenant

```ts
tenant: string;
```

###### Inherited from

```ts
HostIdentity.tenant
```

***

<a id="storagestate-1"></a>

### StorageState

A Playwright storage state: cookies and each origin's `localStorage`.

#### Properties

<a id="cookies-1"></a>

##### cookies

```ts
cookies: object[];
```

###### domain

```ts
domain: string;
```

###### expires

```ts
expires: number;
```

###### httpOnly

```ts
httpOnly: boolean;
```

###### name

```ts
name: string;
```

###### path

```ts
path: string;
```

###### sameSite

```ts
sameSite: "Strict" | "Lax" | "None";
```

###### secure

```ts
secure: boolean;
```

###### value

```ts
value: string;
```

<a id="origins"></a>

##### origins

```ts
origins: object[];
```

###### localStorage

```ts
localStorage: object[];
```

###### origin

```ts
origin: string;
```

## Type Aliases

<a id="hostclosereason"></a>

### HostCloseReason

```ts
type HostCloseReason = "idle" | "evicted" | "closed" | "crashed" | "stopped" | "shutdown";
```

Why a session closed. `stopped`: Stop, by the agent (`relay_stop`), the person, or the owner.

***

<a id="hostevent"></a>

### HostEvent

```ts
type HostEvent = 
  | {
  principal: string;
  tenant: string;
  type: "session.starting";
}
  | {
  ms: number;
  principal: string;
  tenant: string;
  type: "session.ready";
}
  | {
  principal: string;
  reason: string;
  tenant: string;
  type: "session.failed";
}
  | {
  principal: string;
  reason: HostCloseReason;
  tenant: string;
  type: "session.closed";
}
  | {
  principal: string;
  tenant: string;
  type: "session.crashed";
}
  | {
  navigation: boolean;
  origin: string;
  principal: string;
  tenant: string;
  type: "request.blocked";
}
  | {
  event: RelayEvent;
  type: "relay";
};
```

One line of the host's audit stream. Carries no cookie, header, token, or query string.

#### Union Members

##### Type Literal

```ts
{
  principal: string;
  tenant: string;
  type: "session.starting";
}
```

***

##### Type Literal

```ts
{
  ms: number;
  principal: string;
  tenant: string;
  type: "session.ready";
}
```

***

##### Type Literal

```ts
{
  principal: string;
  reason: string;
  tenant: string;
  type: "session.failed";
}
```

***

##### Type Literal

```ts
{
  principal: string;
  reason: HostCloseReason;
  tenant: string;
  type: "session.closed";
}
```

***

##### Type Literal

```ts
{
  principal: string;
  tenant: string;
  type: "session.crashed";
}
```

***

##### Type Literal

```ts
{
  navigation: boolean;
  origin: string;
  principal: string;
  tenant: string;
  type: "request.blocked";
}
```

###### navigation

```ts
navigation: boolean;
```

###### origin

```ts
origin: string;
```

The refused origin, never the full URL.

###### principal

```ts
principal: string;
```

###### tenant

```ts
tenant: string;
```

###### type

```ts
type: "request.blocked";
```

***

##### Type Literal

```ts
{
  event: RelayEvent;
  type: "relay";
}
```

***

<a id="hostidentity"></a>

### HostIdentity

```ts
type HostIdentity = RelayPrincipal;
```

Who a hosted session is for: one principal in one tenant, as the agent's sign-in named them.

***

<a id="sessionfor-1"></a>

### SessionFor

```ts
type SessionFor = (request) => 
  | AppSession
  | null
| Promise<AppSession | null>;
```

Turns the agent's identity into the application session its hosted browser starts with. Return
null (or throw) to refuse: the agent is told its session could not start, and nothing runs.

#### Parameters

##### request

[`SessionRequest`](#sessionrequest)

#### Returns

  \| [`AppSession`](#appsession)
  \| `null`
  \| `Promise`\<[`AppSession`](#appsession) \| `null`\>

## Variables

<a id="injected_relay_global"></a>

### INJECTED\_RELAY\_GLOBAL

```ts
const INJECTED_RELAY_GLOBAL: "__AXE_RELAY__" = "__AXE_RELAY__";
```

The global a host (`@axe/host`) sets with an init script, before any page script runs, when it
opens the application in a hidden browser session for a person: `window.__AXE_RELAY__`.

## Functions

<a id="cookiesession"></a>

### cookieSession()

```ts
function cookieSession(cookies): SessionFor;
```

Cookies from your own code, for each identity: `cookieSession(async ({ principal, tenant,
authInfo }) => [{ name: "session", value: await mintSessionFor(principal, tenant) }])`. Return
null to refuse.

#### Parameters

##### cookies

(`request`) => 
  \| [`SessionCookie`](#sessioncookie)[]
  \| `Promise`\<[`SessionCookie`](#sessioncookie)[] \| `null`\>
  \| `null`

#### Returns

[`SessionFor`](#sessionfor-1)

***

<a id="createhost"></a>

### createHost()

```ts
function createHost(options): Host;
```

Create a session host. See `HostOptions` and docs/host.md.

#### Parameters

##### options

[`HostOptions`](#hostoptions)

#### Returns

[`Host`](#host)

***

<a id="storagestatesession"></a>

### storageStateSession()

```ts
function storageStateSession(path): SessionFor;
```

Development: every identity gets the storage state saved at `path` (by `axe host login`). The
file holds a signed-in person's cookies: keep it out of version control, and never use this in
production, where each identity must get its own session.

#### Parameters

##### path

`string`

#### Returns

[`SessionFor`](#sessionfor-1)
