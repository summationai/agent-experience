[AXE API reference](../../README.md) / [@summationai/axe-relay](README.md) / client

# client

## Interfaces

<a id="connectrelayoptions"></a>

### ConnectRelayOptions

#### Properties

<a id="approvals"></a>

##### approvals?

```ts
optional approvals?: RelayApprovalChannel;
```

Where the person decides an act that needs approval: `page` (the indicator's Approve and
Deny, or your own UI), `agent` (the relay asks through the calling agent's MCP client, and
tells this tab the answer), or `both` (whichever answers first). Default `page` when
attended, `agent` when unattended. Only with `agent` or `both` does the tab accept a decision
from the relay.

<a id="approvalttlms"></a>

##### approvalTtlMs?

```ts
optional approvalTtlMs?: number;
```

How long an approval request stays open, in ms. Default 300000 (five minutes).

<a id="backoff"></a>

##### backoff?

```ts
optional backoff?: object;
```

Reconnect backoff. Default: from 500 ms, doubling, at most 30000 ms, with jitter.

###### initialMs?

```ts
optional initialMs?: number;
```

###### maxMs?

```ts
optional maxMs?: number;
```

<a id="describe"></a>

##### describe?

```ts
optional describe?: () => object;
```

What the agent's tab list shows for this page. Default: `document.title` and `location.pathname` (never the query).

###### Returns

`object`

###### path

```ts
path: string;
```

###### title

```ts
title: string;
```

<a id="gettoken"></a>

##### getToken?

```ts
optional getToken?: () => string | Promise<string>;
```

Returns a fresh relay token; called on every connection and before the current one expires,
so the connection outlives any one token. Prefer it to `token`.

###### Returns

`string` \| `Promise`\<`string`\>

<a id="indicator"></a>

##### indicator?

```ts
optional indicator?: boolean | Element;
```

The in-page indicator: `true` (the default when attended) renders a small fixed panel in the
page's corner, an `Element` renders it inside that element, and `false` (the default when
unattended) renders nothing, in which case your own UI must show `onStatus` and offer
`stop()`, `approve()`, and `deny()` when a person is looking.

<a id="mode"></a>

##### mode?

```ts
optional mode?: RelayMode;
```

`attended` (the default): a person is looking at this tab. `unattended`: the tab runs in a
hidden browser session a host started for the person (`injectedRelay()` says so), so the
indicator is off by default and approvals go to the agent's MCP client.

<a id="onstatus"></a>

##### onStatus?

```ts
optional onStatus?: (status) => void;
```

Told after every change of `RelayStatus`.

###### Parameters

###### status

[`RelayStatus`](#relaystatus)

###### Returns

`void`

<a id="requireapproval"></a>

##### requireApproval?

```ts
optional requireApproval?: (row) => boolean;
```

Which acts wait for the person's approval in the page. Default: an action whose effect is
`risk: "high"` or declares `confirm`. Return false to let an entry run without approval.

###### Parameters

###### row

`ObservedEntry`

###### Returns

`boolean`

<a id="storage"></a>

##### storage?

```ts
optional storage?: Pick<Storage, "getItem" | "setItem"> | null;
```

Where the tab id is kept across reloads. Default `sessionStorage`; `null` keeps it in memory.

<a id="token"></a>

##### token?

```ts
optional token?: string;
```

A relay token your backend minted for the signed-in person (`mintRelayToken`).

<a id="url"></a>

##### url

```ts
url: string;
```

The relay's tab endpoint: `wss://relay.example.com/tab`. An `http(s)` URL is converted, and a bare origin gets `/tab`.

<a id="websocket"></a>

##### WebSocket?

```ts
optional WebSocket?: {
(url, protocols?): WebSocket;
  CLOSED: 3;
  CLOSING: 2;
  CONNECTING: 0;
  OPEN: 1;
  prototype: WebSocket;
};
```

The WebSocket constructor. Default: the global one.

###### Parameters

###### url

`string` \| `URL`

###### protocols?

`string` \| `string`[]

###### Returns

`WebSocket`

###### CLOSED

```ts
readonly CLOSED: 3;
```

###### CLOSING

```ts
readonly CLOSING: 2;
```

###### CONNECTING

```ts
readonly CONNECTING: 0;
```

###### OPEN

```ts
readonly OPEN: 1;
```

###### prototype

```ts
prototype: WebSocket;
```

***

<a id="injectedrelayconfig"></a>

### InjectedRelayConfig

What a host puts in `window.__AXE_RELAY__`.

#### Properties

<a id="gettoken-1"></a>

##### getToken?

```ts
optional getToken?: () => string | Promise<string>;
```

Optional: a function (an exposed binding) that returns a fresh token, for sessions that outlive one.

###### Returns

`string` \| `Promise`\<`string`\>

<a id="indicator-1"></a>

##### indicator?

```ts
optional indicator?: boolean;
```

Show the in-page indicator. Default: on when attended, off when unattended.

<a id="mode-1"></a>

##### mode

```ts
mode: RelayMode;
```

<a id="token-1"></a>

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

<a id="relayapproval"></a>

### RelayApproval

An act waiting for the person's decision in the page.

#### Properties

<a id="entryid"></a>

##### entryId

```ts
entryId: string;
```

<a id="expiresat"></a>

##### expiresAt

```ts
expiresAt: number;
```

When the request lapses, ms since the epoch.

<a id="id"></a>

##### id

```ts
id: string;
```

<a id="name"></a>

##### name

```ts
name: string;
```

The control's name, in the application's words.

<a id="state"></a>

##### state

```ts
state: "approved" | "pending" | "denied";
```

<a id="text"></a>

##### text?

```ts
optional text?: string;
```

The text the act carries, when it has one and the entry is not sensitive.

***

<a id="relayconnection"></a>

### RelayConnection

What `connectRelay` returns.

#### Properties

<a id="tabid"></a>

##### tabId

```ts
readonly tabId: string;
```

#### Methods

<a id="approve"></a>

##### approve()

```ts
approve(id): boolean;
```

Approve a pending act; the agent's next identical call runs it. Returns false for an unknown id.

###### Parameters

###### id

`string`

###### Returns

`boolean`

<a id="deny"></a>

##### deny()

```ts
deny(id): boolean;
```

Deny a pending act; the agent's next identical call is refused. Returns false for an unknown id.

###### Parameters

###### id

`string`

###### Returns

`boolean`

<a id="disconnect"></a>

##### disconnect()

```ts
disconnect(): void;
```

Dispose this page connection without revoking access; a later connection may reattach.

###### Returns

`void`

<a id="rekey"></a>

##### rekey()

```ts
rekey(token?): void;
```

The signed-in person or the tenant changed in the page (a tenant switch without a reload):
leave the relay under the old identity, dropping every pending approval, and connect again
with `token` or a fresh `getToken()`. The relay forgets the old tab record and revokes its
token, so no agent of the old principal or tenant reaches the page afterwards.

###### Parameters

###### token?

`string`

###### Returns

`void`

<a id="status"></a>

##### status()

```ts
status(): RelayStatus;
```

###### Returns

[`RelayStatus`](#relaystatus)

<a id="stop"></a>

##### stop()

```ts
stop(): void;
```

Disconnect for good (the Stop button): the relay revokes the token and refuses further acts.

###### Returns

`void`

***

<a id="relaystatus"></a>

### RelayStatus

What `onStatus` receives and `connection.status()` returns.

#### Properties

<a id="approvals-1"></a>

##### approvals

```ts
approvals: RelayApproval[];
```

Acts waiting for the person's approval.

<a id="pairingcode"></a>

##### pairingCode

```ts
pairingCode: string | null;
```

The development pairing code to give the agent, while in `pairing`.

<a id="principal"></a>

##### principal

```ts
principal: string | null;
```

The person the relay recognized from the token; null before `ready`.

<a id="reason"></a>

##### reason

```ts
reason: string | null;
```

Why the relay refused or the connection stopped, when it said.

<a id="state-1"></a>

##### state

```ts
state: RelayState;
```

<a id="tabid-1"></a>

##### tabId

```ts
tabId: string;
```

This browser tab's id; kept across reloads in `sessionStorage`.

## Type Aliases

<a id="relayapprovalchannel"></a>

### RelayApprovalChannel

```ts
type RelayApprovalChannel = "page" | "agent" | "both";
```

Where the person decides an act that needs approval: `page`, the tab's own agent panel;
`agent`, the calling agent's MCP client (elicitation), with the relay's approval page for
sensitive acts; `both`, whichever answers first.

***

<a id="relaymode"></a>

### RelayMode

```ts
type RelayMode = "attended" | "unattended";
```

`attended`: a person is looking at the tab (the default). `unattended`: the tab runs in a hidden
browser session a host started for the person (`@summationai/axe-host`), and no one is looking at it.

***

<a id="relaystate"></a>

### RelayState

```ts
type RelayState = 
  | "connecting"
  | "pairing"
  | "connected"
  | "acting"
  | "reconnecting"
  | "disconnected"
  | "stopped"
  | "refused";
```

Where the connection stands. `connecting`: opening the first connection. `pairing`: connected
in development mode and waiting for an agent to pair with the code shown. `connected`: an agent
may act. `acting`: an agent has read or acted through this tab. `reconnecting`: the connection
dropped and the client is retrying. `disconnected`: the application disposed this connection
without revoking the tab (for example, a component unmounted). `stopped`: the person pressed
Stop (or `stop()` was called). `refused`: the relay refused the page (origin, tenant, or token),
and the client does not retry.

## Variables

<a id="injected_relay_global"></a>

### INJECTED\_RELAY\_GLOBAL

```ts
const INJECTED_RELAY_GLOBAL: "__AXE_RELAY__" = "__AXE_RELAY__";
```

The global an optional host sets before page code runs: `window.__AXE_RELAY__`.

***

<a id="local_mcp_service_url"></a>

### LOCAL\_MCP\_SERVICE\_URL

```ts
const LOCAL_MCP_SERVICE_URL: "http://127.0.0.1:4717" = "http://127.0.0.1:4717";
```

Default origin of the company-side MCP service while it is run locally.

***

<a id="relay_protocol"></a>

### RELAY\_PROTOCOL

```ts
const RELAY_PROTOCOL: "axe-relay.v1" = "axe-relay.v1";
```

The WebSocket subprotocol and message version.

## Functions

<a id="connectrelay"></a>

### connectRelay()

```ts
function connectRelay(surface, options): RelayConnection;
```

Connect this page's surface to a relay so an authorized agent can observe and act on it.
Returns at once; the connection opens, authenticates, and reconnects in the background.

#### Parameters

##### surface

`Surface`

##### options

[`ConnectRelayOptions`](#connectrelayoptions)

#### Returns

[`RelayConnection`](#relayconnection)

***

<a id="devtoken"></a>

### devToken()

```ts
function devToken(relayUrl): () => Promise<string>;
```

A `getToken` for local development: asks the local MCP service (or the lower-level
`axe relay --dev` process) for a development token. The relay serves it on loopback only, to
allowed origins only; never use this in production, where an authenticated service issues a
token for the signed-in person.

#### Parameters

##### relayUrl

`string`

#### Returns

() => `Promise`\<`string`\>

***

<a id="injectedrelay"></a>

### injectedRelay()

```ts
function injectedRelay(): ConnectRelayOptions | null;
```

A scoped provider connection as `connectRelay` options: either `window.__AXE_RELAY__` from an
optional host, or a one-time browser handoff persisted in this tab's session storage. Reads at
call time, never at import. Neither path uses pairing.

#### Returns

[`ConnectRelayOptions`](#connectrelayoptions) \| `null`

***

<a id="localmcpservice"></a>

### localMcpService()

```ts
function localMcpService(serviceUrl?): ConnectRelayOptions;
```

Connection options for the local Agent Experience MCP service. The website receives a
short-lived development tab token from the service; desktop agents authenticate separately at
its `/mcp` endpoint and pair with the code shown in the page.

#### Parameters

##### serviceUrl?

`string` = `LOCAL_MCP_SERVICE_URL`

#### Returns

[`ConnectRelayOptions`](#connectrelayoptions)

***

<a id="relayoptions"></a>

### relayOptions()

```ts
function relayOptions(fallback): ConnectRelayOptions;
```

`injectedRelay()` when a host injected a connection, else `fallback` (your attended relay, such
as the development one). The injected connection replaces the fallback's `url`, token,
`mode`, `approvals`, and `indicator`; the fallback's other options (`onStatus`,
`requireApproval`, `describe`, ...) are kept. `connectRelay(surface, relayOptions(dev))`.

#### Parameters

##### fallback

[`ConnectRelayOptions`](#connectrelayoptions)

#### Returns

[`ConnectRelayOptions`](#connectrelayoptions)

***

<a id="tabendpoint"></a>

### tabEndpoint()

```ts
function tabEndpoint(url): string;
```

The relay's tab endpoint from what the application passed.

#### Parameters

##### url

`string`

#### Returns

`string`
