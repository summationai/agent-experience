[AXE API reference](../../README.md) / [@axe/relay](README.md) / server

# server

## Classes

<a id="tabmirror"></a>

### TabMirror

#### Constructors

<a id="constructor"></a>

##### Constructor

```ts
new TabMirror(
   link, 
   ledgerMax?, 
   base?
): TabMirror;
```

###### Parameters

###### link

[`TabLink`](#tablink)

###### ledgerMax?

`number` = `1000`

###### base?

`number` = `0`

The first revision this mirror presents. The relay gives each tab a random base,
so a revision read from one tab never matches another tab's.

###### Returns

[`TabMirror`](#tabmirror)

#### Properties

<a id="surface"></a>

##### surface

```ts
readonly surface: Surface;
```

#### Methods

<a id="apply"></a>

##### apply()

```ts
apply(observation, ledger): void;
```

Adopt a snapshot from the tab: its observation and the ledger entries after `since()`.

###### Parameters

###### observation

`Observation`

###### ledger

`LedgerEntry`[]

###### Returns

`void`

<a id="begininstance"></a>

##### beginInstance()

```ts
beginInstance(instance, tabRev): void;
```

A new page instance connected: revisions and seqs continue above everything presented so far.

###### Parameters

###### instance

`string`

###### tabRev

`number`

###### Returns

`void`

<a id="hasview"></a>

##### hasView()

```ts
hasView(): boolean;
```

###### Returns

`boolean`

<a id="noterev"></a>

##### noteRev()

```ts
noteRev(tabRev): void;
```

A change notification from the tab: the revision moved (the table is refreshed on the next read).

###### Parameters

###### tabRev

`number`

###### Returns

`void`

<a id="rev"></a>

##### rev()

```ts
rev(): number;
```

###### Returns

`number`

<a id="since"></a>

##### since()

```ts
since(): number;
```

The tab's seq the relay has seen, to ask for the ledger after it.

###### Returns

`number`

<a id="totabrev"></a>

##### toTabRev()

```ts
toTabRev(rev): number;
```

The tab's revision for a mirrored one.

###### Parameters

###### rev

`number`

###### Returns

`number`

<a id="translate"></a>

##### translate()

```ts
translate(result): ActResult;
```

Translate the revisions in an envelope from the tab back to mirrored ones.

###### Parameters

###### result

`ActResult`

###### Returns

`ActResult`

## Interfaces

<a id="relay"></a>

### Relay

#### Properties

<a id="axe"></a>

##### axe

```ts
readonly axe: AXE;
```

The AXE server the tools are derived from.

<a id="devagentkey"></a>

##### devAgentKey

```ts
readonly devAgentKey: string | null;
```

The development bearer key for `/mcp`, when `devPairing` is on.

#### Methods

<a id="attach"></a>

##### attach()

```ts
attach(server): void;
```

Serve on an existing Node HTTP server: upgrades on `/tab` and requests on `/mcp` and `/dev/token`.

###### Parameters

###### server

`Server`

###### Returns

`void`

<a id="browserhandoff"></a>

##### browserHandoff()

```ts
browserHandoff(who): string | null;
```

Mint a one-time browser handoff for an already authenticated principal.

###### Parameters

###### who

[`RelayPrincipal`](#relayprincipal)

###### Returns

`string` \| `null`

<a id="close"></a>

##### close()

```ts
close(): Promise<void>;
```

###### Returns

`Promise`\<`void`\>

<a id="handle"></a>

##### handle()

```ts
handle(request, context?): Promise<Response>;
```

The HTTP routes (`/mcp`, `/dev/token`, `/health`) as a fetch handler, for a framework that gives you Web `Request`s.

###### Parameters

###### request

`Request`

###### context?

###### remoteAddress?

`string`

###### Returns

`Promise`\<`Response`\>

<a id="handleagent"></a>

##### handleAgent()

```ts
handleAgent(
   request, 
   adapter, 
   call?
): Promise<Response>;
```

Serve one AXE request of an agent tool call, as the relay's own MCP front does: `adapter`
from `relayAgentContext`, and `call` (the `AxeLike.handle` third argument), which carries
approvals to the agent's client. For a front end that serves the relay's tools itself
(`@axe/host`); pass it `createMcpServer` as the `AxeLike`'s `handle`.

###### Parameters

###### request

`Request`

###### adapter

`AdapterContext`

###### call?

`ToolCallContext`

###### Returns

`Promise`\<`Response`\>

<a id="listen"></a>

##### listen()

```ts
listen(options?): Promise<RelayAddress>;
```

Start an HTTP server for tabs (`/tab`), agents (`/mcp`), and development tokens.

###### Parameters

###### options?

[`RelayListenOptions`](#relaylistenoptions)

###### Returns

`Promise`\<[`RelayAddress`](#relayaddress)\>

<a id="refresh"></a>

##### refresh()

```ts
refresh(who, tabId): Promise<RelayTabInfo | null>;
```

Ask one connected tab for a fresh observation, then return its current public metadata.

###### Parameters

###### who

[`RelayPrincipal`](#relayprincipal)

###### tabId

`string`

###### Returns

`Promise`\<[`RelayTabInfo`](#relaytabinfo) \| `null`\>

<a id="servestdio"></a>

##### serveStdio()

```ts
serveStdio(options?): Promise<DerivedMcpServer>;
```

The MCP server over stdio, for one local agent (`claude mcp add ... -- axe relay --dev --stdio`).

###### Parameters

###### options?

###### as?

[`RelayPrincipal`](#relayprincipal)

###### Returns

`Promise`\<`DerivedMcpServer`\>

<a id="stop"></a>

##### stop()

```ts
stop(who, tabId?): number;
```

End agent access to one tab of `who` (or all of them, without `tabId`), as Stop does: the
token is revoked, every later act is refused, and the page is told (a host then closes its
session). For a host's own "stop" control. Returns how many tabs it stopped.

###### Parameters

###### who

[`RelayPrincipal`](#relayprincipal)

###### tabId?

`string`

###### Returns

`number`

<a id="tabs"></a>

##### tabs()

```ts
tabs(who): RelayTabInfo[];
```

The tabs of one principal, most recently active first.

###### Parameters

###### who

[`RelayPrincipal`](#relayprincipal)

###### Returns

[`RelayTabInfo`](#relaytabinfo)[]

***

<a id="relayaddress"></a>

### RelayAddress

#### Properties

<a id="host"></a>

##### host

```ts
host: string;
```

<a id="mcpurl"></a>

##### mcpUrl

```ts
mcpUrl: string;
```

Where agents connect over HTTP: `http://host:port/mcp`.

<a id="port"></a>

##### port

```ts
port: number;
```

<a id="taburl"></a>

##### tabUrl

```ts
tabUrl: string;
```

Where tabs connect: `ws://host:port/tab`.

<a id="url"></a>

##### url

```ts
url: string;
```

`http://host:port`

***

<a id="relayagentauth"></a>

### RelayAgentAuth

How the relay authenticates the agent side over HTTP: an OAuth 2.1 resource server.

#### Properties

<a id="identify"></a>

##### identify

```ts
identify: (authInfo) => MaybePromise<RelayPrincipal | null>;
```

The principal and tenant a verified token speaks for, or null to refuse it.

###### Parameters

###### authInfo

[`AuthInfo`](../mcp.md#authinfo)

###### Returns

[`MaybePromise`](#maybepromise)\<[`RelayPrincipal`](#relayprincipal) \| `null`\>

<a id="requiredscopes"></a>

##### requiredScopes?

```ts
optional requiredScopes?: string[];
```

<a id="resource"></a>

##### resource?

```ts
optional resource?: string;
```

This endpoint's canonical URL (RFC 8707 resource).

<a id="resourcemetadataurl"></a>

##### resourceMetadataUrl?

```ts
optional resourceMetadataUrl?: string;
```

<a id="verifier"></a>

##### verifier

```ts
verifier: OAuthTokenVerifier;
```

Verifies the bearer access token on every MCP request (`@axe/mcp`'s `auth.verifier`).

***

<a id="relayapprovaloptions"></a>

### RelayApprovalOptions

Approvals asked through the agent, for tabs that take them from the agent (an unattended tab,
or one connected with `approvals: "agent"` or `"both"`).

#### Properties

<a id="identify-1"></a>

##### identify?

```ts
optional identify?: (request) => MaybePromise<RelayPrincipal | null>;
```

Who opened an approval page: the principal and tenant of the person's own session on this
request (a cookie your identity provider set for the relay's domain, for instance), or null.
The page accepts a decision only from the principal and tenant the approval is for. Without
it the relay serves no approval page outside development, and never offers URL mode.
In development (`devPairing`), the default trusts any loopback caller.

###### Parameters

###### request

`Request`

###### Returns

[`MaybePromise`](#maybepromise)\<[`RelayPrincipal`](#relayprincipal) \| `null`\>

<a id="linkttlms"></a>

##### linkTtlMs?

```ts
optional linkTtlMs?: number;
```

How long an approval link works, in ms. Default 300000 (five minutes).

<a id="pageurl"></a>

##### pageUrl?

```ts
optional pageUrl?: string;
```

The public origin approval pages are linked under. Default `baseUrl` (or the address `listen` bound). Must be `https`, or `http` on a loopback host.

<a id="sensitive"></a>

##### sensitive?

```ts
optional sensitive?: (row, request) => boolean;
```

Which acts are decided on the approval page (URL mode) rather than in a form in the client:
default, an act on a sensitive entry. A form shows its text to the MCP client; a page the
relay serves does not.

###### Parameters

###### row

`ObservedEntry`

###### request

`ActRequest`

###### Returns

`boolean`

***

<a id="relaydeferredagentauth"></a>

### RelayDeferredAgentAuth

#### Properties

<a id="identify-2"></a>

##### identify

```ts
identify: (sessionId) => MaybePromise<RelayPrincipal | null>;
```

Resolve the identity already established for this MCP session, or null before login.

###### Parameters

###### sessionId

`string`

###### Returns

[`MaybePromise`](#maybepromise)\<[`RelayPrincipal`](#relayprincipal) \| `null`\>

<a id="login"></a>

##### login

```ts
login: (sessionId) => MaybePromise<{
  instructions?: string;
  ttlSeconds?: number;
  url: string;
  whatAgentShouldSayToUser?: string;
}>;
```

Begin contextual login only after this session calls `relay_tabs`.

###### Parameters

###### sessionId

`string`

###### Returns

[`MaybePromise`](#maybepromise)\<\{
  `instructions?`: `string`;
  `ttlSeconds?`: `number`;
  `url`: `string`;
  `whatAgentShouldSayToUser?`: `string`;
\}\>

***

<a id="relayhandoffoptions"></a>

### RelayHandoffOptions

#### Properties

<a id="appurl"></a>

##### appUrl

```ts
appUrl: string;
```

The application page the MCP client opens. Sign-in redirects may happen before Surface loads.

<a id="linkttlms-1"></a>

##### linkTtlMs?

```ts
optional linkTtlMs?: number;
```

How long an unopened connection link works. Default: ten minutes.

<a id="pageurl-1"></a>

##### pageUrl?

```ts
optional pageUrl?: string;
```

Public origin serving `/connect/*`. Default: `baseUrl`'s origin.

<a id="sessionttlms"></a>

##### sessionTtlMs?

```ts
optional sessionTtlMs?: number;
```

Lifetime of the tab credential issued after the link opens. Default: twelve hours.

***

<a id="relaylistenoptions"></a>

### RelayListenOptions

#### Properties

<a id="host-1"></a>

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

<a id="relayoptions"></a>

### RelayOptions

#### Properties

<a id="acttimeoutms"></a>

##### actTimeoutMs?

```ts
optional actTimeoutMs?: number;
```

How long to wait for a tab to answer an act, in ms. Default 30000.

<a id="agentauth"></a>

##### agentAuth?

```ts
optional agentAuth?: RelayAgentAuth;
```

How agents authenticate over HTTP. Without it (and without `devPairing`) `/mcp` is not served.

<a id="application"></a>

##### application?

```ts
optional application?: object;
```

Trusted provider-registry identity for this application. A Surface that reports another id
is refused. Profiles are optional for compatibility with older application packages.

###### id

```ts
id: string;
```

###### name?

```ts
optional name?: string;
```

<a id="approvals"></a>

##### approvals?

```ts
optional approvals?: RelayApprovalOptions;
```

Approvals asked through the agent's MCP client (elicitation) and the relay's approval page.

<a id="audience"></a>

##### audience?

```ts
optional audience?: string;
```

The `aud` relay tokens must carry. Default `axe-relay`.

<a id="authenticatetab"></a>

##### authenticateTab?

```ts
optional authenticateTab?: (token, context) => MaybePromise<RelayPrincipal & object | null>;
```

Authenticate a tab yourself instead of with a relay token signed by `secret`: return the
principal and tenant the token speaks for, or null to refuse. Never accept a session cookie
here; the page sends only what your backend minted for this purpose.

###### Parameters

###### token

`string`

###### context

[`TabAuthContext`](#tabauthcontext)

###### Returns

[`MaybePromise`](#maybepromise)\<[`RelayPrincipal`](#relayprincipal) & `object` \| `null`\>

<a id="baseurl"></a>

##### baseUrl?

```ts
optional baseUrl?: string;
```

The relay's public URL, as the AXE manifest names it. Default `http://localhost`.

<a id="content"></a>

##### content?

```ts
optional content?: boolean;
```

Serve `surface_read` and `surface_wait` (the page's content, and waiting for slow work) when
`domains` does not name them. They answer from a tab running an auto surface and are
unavailable, with the reason, in any other. Default true.

<a id="deferredagentauth"></a>

##### deferredAgentAuth?

```ts
optional deferredAgentAuth?: RelayDeferredAgentAuth;
```

Authenticate after first use instead of at MCP initialization. The anonymous transport session
is isolated by its random MCP session id; `relay_tabs` offers the contextual login URL, and
subsequent calls use the identity `identify` established for that same session.

<a id="description"></a>

##### description?

```ts
optional description?: string;
```

<a id="devagentkey-1"></a>

##### devAgentKey?

```ts
optional devAgentKey?: string;
```

The bearer key `/mcp` accepts in development. Default: random per process (printed by the CLI).

<a id="devpairing"></a>

##### devPairing?

```ts
optional devPairing?: boolean;
```

Local development only: agents pair with a tab by typing the code its indicator shows, and
the relay serves development tokens at `POST /dev/token`. Refused unless the relay listens on
loopback; every request must come from loopback with a loopback `Host`.

<a id="devprincipal"></a>

##### devPrincipal?

```ts
optional devPrincipal?: RelayPrincipal;
```

The principal development tokens name. Default `{ principal: "dev", tenant: "dev" }`.

<a id="domains"></a>

##### domains?

```ts
optional domains?: DomainSpec[];
```

The parameterized actions for every tab. Default: `domainActions`' own set (`set-field`,
`run-control`, `load-more`). `autoDomains()` from `@axe/surface/auto` fits here.

<a id="handoff"></a>

##### handoff?

```ts
optional handoff?: RelayHandoffOptions;
```

Zero-backend tab connection. When an authenticated agent has no tab, `relay_tabs` hands the
person a short-lived URL. That page opens `appUrl`; the installed browser package exchanges
the one-time handoff for a tab credential and connects without a pairing code.

<a id="name"></a>

##### name?

```ts
optional name?: string;
```

Name and description of the MCP server.

<a id="namespace"></a>

##### namespace?

```ts
optional namespace?: string;
```

Namespace of the tab's tools: `surface` gives `surface_observe`, `surface_set-field`, ...

<a id="onevent"></a>

##### onEvent?

```ts
optional onEvent?: (event) => void;
```

The relay's audit stream.

###### Parameters

###### event

[`RelayEvent`](#relayevent)

###### Returns

`void`

<a id="onframe"></a>

##### onFrame?

```ts
optional onFrame?: (direction, tabId, data) => void;
```

Every frame in and out of a tab connection, for debugging and tests.

###### Parameters

###### direction

`"in"` \| `"out"`

###### tabId

`string` \| `null`

###### data

`string`

###### Returns

`void`

<a id="origins"></a>

##### origins?

```ts
optional origins?: string[] | ((origin) => boolean);
```

The page origins allowed to connect a tab. Each is an exact origin (`https://app.example.com`),
a subdomain pattern (`https://*.example.com`, which does not match the apex), or any port
(`http://localhost:*`); or pass a function. Required unless `devPairing` is on, where the
default is any port on `http://localhost`, `http://127.0.0.1`, and `http://[::1]`.

<a id="reconnectgracems"></a>

##### reconnectGraceMs?

```ts
optional reconnectGraceMs?: number;
```

How long an act waits for a reconnecting tab (a reload), in ms. Default 10000.

<a id="secret"></a>

##### secret?

```ts
optional secret?: string;
```

The HMAC secret relay tokens are signed with (`mintRelayToken`), at least 32 characters.
Required unless `authenticateTab` is given or `devPairing` is on (which uses a random
per-process secret for its development tokens).

<a id="synctimeoutms"></a>

##### syncTimeoutMs?

```ts
optional syncTimeoutMs?: number;
```

How long to wait for a fresh snapshot before serving the last one, in ms. Default 5000.

<a id="tabretentionms"></a>

##### tabRetentionMs?

```ts
optional tabRetentionMs?: number;
```

How long a disconnected or stopped tab stays listed, in ms. Default 600000.

<a id="tenants"></a>

##### tenants?

```ts
optional tenants?: string[];
```

Tenants this relay serves; a tab or an agent of any other tenant is refused. Default: any.

***

<a id="relayprincipal"></a>

### RelayPrincipal

Who a relay token speaks for: one signed-in person in one tenant.

#### Extended by

- [`MintRelayTokenInput`](token.md#mintrelaytokeninput)
- [`RelayTokenClaims`](token.md#relaytokenclaims)

#### Properties

<a id="principal"></a>

##### principal

```ts
principal: string;
```

<a id="tenant"></a>

##### tenant

```ts
tenant: string;
```

***

<a id="relaytabinfo"></a>

### RelayTabInfo

A tab as `relay_tabs` and `relay.tabs()` list it.

#### Properties

<a id="application-1"></a>

##### application?

```ts
optional application?: SurfaceProfile;
```

Structured identity and live context reported by the application's Surface.

<a id="connectedat"></a>

##### connectedAt

```ts
connectedAt: string;
```

<a id="lastactiveat"></a>

##### lastActiveAt

```ts
lastActiveAt: string;
```

<a id="mode"></a>

##### mode

```ts
mode: RelayMode;
```

`unattended`: a hidden session a host runs for the person; approvals come through the agent.

<a id="origin"></a>

##### origin

```ts
origin: string;
```

<a id="path"></a>

##### path

```ts
path: string;
```

<a id="rev-1"></a>

##### rev

```ts
rev: number;
```

<a id="selected"></a>

##### selected

```ts
selected: boolean;
```

<a id="state"></a>

##### state

```ts
state: "connected" | "reconnecting" | "stopped";
```

<a id="tabid"></a>

##### tabId

```ts
tabId: string;
```

<a id="title"></a>

##### title

```ts
title: string;
```

***

<a id="tabauthcontext"></a>

### TabAuthContext

What `authenticateTab` receives besides the token.

#### Properties

<a id="origin-1"></a>

##### origin

```ts
origin: string;
```

The page's origin, already checked against `origins`.

***

<a id="tablink"></a>

### TabLink

How the mirror reaches its tab. Implemented by the relay's tab record.

#### Methods

<a id="act"></a>

##### act()

```ts
act(request): Promise<{
  ledger?: LedgerEntry[];
  observation?: Observation;
  result: ActResult;
}>;
```

Forward an act, with `expectedRev` in the mirror's revisions: the link translates it with
`toTabRev` once the tab is connected (a reload changes the translation), and resolves with
the tab's envelope and fresh snapshot, in the tab's revisions.

###### Parameters

###### request

`ActRequest`

###### Returns

`Promise`\<\{
  `ledger?`: `LedgerEntry`[];
  `observation?`: `Observation`;
  `result`: `ActResult`;
\}\>

<a id="fulfill"></a>

##### fulfill()

```ts
fulfill(
   entryId, 
   kind, 
   payload, 
   actor
): Promise<void>;
```

Run a `requires.fulfill` in the page.

###### Parameters

###### entryId

`string`

###### kind

`string`

###### payload

[`JsonValue`](../client/index.md#jsonvalue)

###### actor

`string`

###### Returns

`Promise`\<`void`\>

<a id="read"></a>

##### read()?

```ts
optional read(options): Promise<PageRead>;
```

Read the page's content in the tab ([S-AUTO-14]); revisions in the tab's terms.

###### Parameters

###### options

`ReadOptions`

###### Returns

`Promise`\<`PageRead`\>

<a id="record"></a>

##### record()

```ts
record(change): Promise<void>;
```

Append a change or refusal to the page's own ledger ([S-LED-8]), with revisions already in
the tab's terms. The page records it under its relay actor; the entry returns in the reply.

###### Parameters

###### change

`RecordRequest`

###### Returns

`Promise`\<`void`\>

<a id="wait"></a>

##### wait()?

```ts
optional wait(condition, options): Promise<WaitResult>;
```

Wait on the page in the tab ([S-AUTO-15]); revisions in the tab's terms.

###### Parameters

###### condition

`WireWaitCondition`

###### options

###### pollMs?

`number`

###### timeoutMs?

`number`

###### Returns

`Promise`\<`WaitResult`\>

## Type Aliases

<a id="maybepromise"></a>

### MaybePromise

```ts
type MaybePromise<T> = T | Promise<T>;
```

A value, or a promise of one.

#### Type Parameters

##### T

`T`

***

<a id="relayevent"></a>

### RelayEvent

```ts
type RelayEvent = 
  | {
  origin: string;
  principal: string;
  tabId: string;
  tenant: string;
  type: "tab.connected";
}
  | {
  origin: string | null;
  reason: string;
  type: "tab.refused";
}
  | {
  principal: string;
  tabId: string;
  tenant: string;
  type: "tab.disconnected";
}
  | {
  by: "page" | "agent" | "owner";
  principal: string;
  tabId: string;
  tenant: string;
  type: "tab.stopped";
}
  | {
  decision: "approve" | "deny";
  entryId: string;
  principal: string;
  tabId: string;
  tenant: string;
  type: "approval.decided";
  via: "agent-form" | "approval-page";
}
  | {
  agent: string;
  principal: string;
  tenant: string;
  type: "agent.paired";
}
  | {
  agent: string;
  type: "pairing.failed";
};
```

One line of the relay's own audit stream (connections, refusals, Stop, pairing).

#### Union Members

##### Type Literal

```ts
{
  origin: string;
  principal: string;
  tabId: string;
  tenant: string;
  type: "tab.connected";
}
```

***

##### Type Literal

```ts
{
  origin: string | null;
  reason: string;
  type: "tab.refused";
}
```

***

##### Type Literal

```ts
{
  principal: string;
  tabId: string;
  tenant: string;
  type: "tab.disconnected";
}
```

***

##### Type Literal

```ts
{
  by: "page" | "agent" | "owner";
  principal: string;
  tabId: string;
  tenant: string;
  type: "tab.stopped";
}
```

###### by

```ts
by: "page" | "agent" | "owner";
```

Who stopped it: the person in the page, the agent (`relay_stop`), or the relay's owner (`relay.stop`).

###### principal

```ts
principal: string;
```

###### tabId

```ts
tabId: string;
```

###### tenant

```ts
tenant: string;
```

###### type

```ts
type: "tab.stopped";
```

***

##### Type Literal

```ts
{
  decision: "approve" | "deny";
  entryId: string;
  principal: string;
  tabId: string;
  tenant: string;
  type: "approval.decided";
  via: "agent-form" | "approval-page";
}
```

###### decision

```ts
decision: "approve" | "deny";
```

###### entryId

```ts
entryId: string;
```

###### principal

```ts
principal: string;
```

###### tabId

```ts
tabId: string;
```

###### tenant

```ts
tenant: string;
```

###### type

```ts
type: "approval.decided";
```

###### via

```ts
via: "agent-form" | "approval-page";
```

Where the person decided: a form in the agent's MCP client, or the relay's approval page.

***

##### Type Literal

```ts
{
  agent: string;
  principal: string;
  tenant: string;
  type: "agent.paired";
}
```

***

##### Type Literal

```ts
{
  agent: string;
  type: "pairing.failed";
}
```

## Variables

<a id="relay_close"></a>

### RELAY\_CLOSE

```ts
const RELAY_CLOSE: object;
```

WebSocket close codes the relay uses (4000 to 4999 are application codes).

#### Type Declaration

<a id="badmessage"></a>

##### badMessage

```ts
readonly badMessage: 4400 = 4400;
```

A message the relay could not read, or the wrong order of messages.

<a id="forbidden"></a>

##### forbidden

```ts
readonly forbidden: 4403 = 4403;
```

The origin, tenant, or token is not allowed here. Retrying will not help.

<a id="hellotimeout"></a>

##### helloTimeout

```ts
readonly helloTimeout: 4408 = 4408;
```

No `hello` arrived in time.

<a id="replaced"></a>

##### replaced

```ts
readonly replaced: 4409 = 4409;
```

Another connection took this tab id (a duplicated tab). The client picks a new id.

<a id="stopped"></a>

##### stopped

```ts
readonly stopped: 4410 = 4410;
```

The person pressed Stop.

<a id="unauthorized"></a>

##### unauthorized

```ts
readonly unauthorized: 4401 = 4401;
```

The relay token is missing, invalid, or expired. A fresh token may succeed.

## Functions

<a id="createrelay"></a>

### createRelay()

```ts
function createRelay(options?): Relay;
```

Create a relay. See `RelayOptions` and docs/relay.md.

#### Parameters

##### options?

[`RelayOptions`](#relayoptions) = `{}`

#### Returns

[`Relay`](#relay)

***

<a id="isloopbackaddress"></a>

### isLoopbackAddress()

```ts
function isLoopbackAddress(address): boolean;
```

Whether a socket address is loopback.

#### Parameters

##### address

`string` \| `null` \| `undefined`

#### Returns

`boolean`

***

<a id="originmatcher"></a>

### originMatcher()

```ts
function originMatcher(patterns): (origin) => boolean;
```

An origin allowlist from patterns: exact origins, `https://*.example.com` (subdomains only, not
the apex), and `http://localhost:*` (any port). Anything else is refused when the relay is
created, so a typo never widens the list.

#### Parameters

##### patterns

`string`[]

#### Returns

(`origin`) => `boolean`

***

<a id="relayactor"></a>

### relayActor()

```ts
function relayActor(principal): string;
```

The actor a tab records for an act from the relay.

#### Parameters

##### principal

`string`

#### Returns

`string`

***

<a id="relayagentcontext"></a>

### relayAgentContext()

```ts
function relayAgentContext(
   agent, 
   who, 
   baseUrl?
): AdapterContext;
```

The adapter context the relay's AXE server (`relay.axe`) expects for an agent acting as `who`,
for a front end that serves the relay's tools itself (`@axe/host` does). `agent` keys the
agent's tab selection; give each agent its own. Never build it from anything but the agent's
own verified identity: it decides which tabs the agent reaches ([S-RELAY-3]).

#### Parameters

##### agent

`string`

##### who

[`RelayPrincipal`](#relayprincipal)

##### baseUrl?

`string` = `"http://localhost"`

#### Returns

`AdapterContext`

## References

<a id="max_relay_token_ttl"></a>

### MAX\_RELAY\_TOKEN\_TTL

Re-exports [MAX_RELAY_TOKEN_TTL](token.md#max_relay_token_ttl)

***

<a id="mintrelaytoken"></a>

### mintRelayToken

Re-exports [mintRelayToken](token.md#mintrelaytoken)

***

<a id="mintrelaytokeninput"></a>

### MintRelayTokenInput

Re-exports [MintRelayTokenInput](token.md#mintrelaytokeninput)

***

<a id="relay_audience"></a>

### RELAY\_AUDIENCE

Re-exports [RELAY_AUDIENCE](token.md#relay_audience)

***

<a id="relay_protocol"></a>

### RELAY\_PROTOCOL

Re-exports [RELAY_PROTOCOL](client.md#relay_protocol)

***

<a id="relayapprovalchannel"></a>

### RelayApprovalChannel

Re-exports [RelayApprovalChannel](client.md#relayapprovalchannel)

***

<a id="relayclaimvalue"></a>

### RelayClaimValue

Re-exports [RelayClaimValue](token.md#relayclaimvalue)

***

<a id="relaymode"></a>

### RelayMode

Re-exports [RelayMode](client.md#relaymode)

***

<a id="relaytokenclaims"></a>

### RelayTokenClaims

Re-exports [RelayTokenClaims](token.md#relaytokenclaims)

***

<a id="verifyrelaytoken"></a>

### verifyRelayToken

Re-exports [verifyRelayToken](token.md#verifyrelaytoken)

***

<a id="verifyrelaytokenoptions"></a>

### VerifyRelayTokenOptions

Re-exports [VerifyRelayTokenOptions](token.md#verifyrelaytokenoptions)
