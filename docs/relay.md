# Relay: an agent in a live tab

A surface lives in the browser tab that created it ([Surface](surface.md), "Where a surface runs"). An agent outside the browser, such as Claude Code, cannot reach it: the controls are closures over that page's state, acting with that page's session. `@axe/relay` is the SDK's broker for exactly this: the page connects to a relay server, the relay presents the page's surface to agents over MCP, and every act runs in the page, through the page's own `surface.act`.

```mermaid
flowchart LR
  P[Person] <--> T[Tab: the app's page<br/>surface + connectRelay]
  T <-- WebSocket, relay token --> R[Relay<br/>mirror per tab]
  R <-- MCP: stdio or HTTP + OAuth --> A[Agent]
```

Two modes. **Unattended** (the default for agents): the person signs in to the agent's own UI (MCP OAuth), a host runs a hidden browser session of the application for them (`@axe/host`), the application's real UI runs there with easy mode, and that hidden tab connects to the relay with no pairing. The person never touches the website, so they approve consequential acts in the agent's UI. **Attended**: the person has the tab open, sees the indicator, and approves in the page.

The relay reuses the rest of the SDK: each tab is served through `domainActions` from `@axe/surface/axe` on a `createAXE` server, and `@axe/mcp` derives the tools. The revision check, the escalation ladder, the ledger, and the action events are the ones you already have. The normative rules are [S-RELAY-1] to [S-RELAY-13] in [spec/SURFACE.md](../spec/SURFACE.md) §9.1.

## Four steps

1. Add the packages: `pnpm add @axe/surface @axe/relay`.
2. In the page, register the controls on a surface (or let `@axe/surface/auto` do it) and connect it:

<!-- include: examples/relay/page.ts#connect -->
```ts
// Your backend mints a short-lived relay token for the signed-in person (see the next example);
// the page asks for one on every connection and before the current one expires.
const relay = connectRelay(surface, {
  url: "wss://relay.yogastudio.example/tab",
  getToken: async () => {
    const res = await fetch("/api/relay-token", { method: "POST", credentials: "same-origin" });
    if (!res.ok) throw new Error("not signed in");
    return ((await res.json()) as { token: string }).token;
  },
});
```
<!-- /include -->

3. In your backend, mint the relay token for the signed-in person:

<!-- include: examples/relay/backend.ts#mint -->
```ts
// A signing key used for nothing else, shared with the relay (RELAY_TOKEN_SECRET, at least 32
// characters). The token names the person (sub) and the tenant (org), lives ten minutes, and goes
// to your own page in a response body, never in a URL.
app.post("/api/relay-token", async (req, res) => {
  const user = currentUser(req);
  if (!user) return void res.status(401).json({ error: "sign in" });
  const token = await mintRelayToken(
    { principal: user.id, tenant: user.studioId, ttl: 600, claims: { mid: user.memberId } },
    process.env["RELAY_TOKEN_SECRET"]!,
  );
  res.set("Cache-Control", "no-store").json({ token });
});
```
<!-- /include -->

4. Run a relay and connect the agent to it (below: development in one command, production with OAuth).

## Local development

Start the relay on loopback:

```sh
npx axe relay --dev
```

It prints the three things to do, with the port filled in:

```text
axe relay: listening for tabs on ws://127.0.0.1:4717/tab

1. In your page (development builds only):
     import { connectRelay, devToken } from "@axe/relay/client";
     connectRelay(surface, { url: "ws://127.0.0.1:4717/tab", getToken: devToken("http://127.0.0.1:4717") });

2. Connect Claude Code to this relay (HTTP):
     claude mcp add --transport http surface http://127.0.0.1:4717/mcp --header "Authorization: Bearer axd_…"
   Or let Claude Code start the relay itself (stop this one first):
     claude mcp add surface -- npx axe relay --dev --stdio

3. Open the page. The tab shows a pairing code; tell the agent: "pair with code XXXX-XXXX".
```

In the page, connect with the development token helper:

<!-- include: examples/relay/page.ts#dev -->
```ts
// Local development against `npx axe relay --dev`: the relay hands out development tokens on
// loopback, and the tab shows a pairing code for the agent.
if (location.hostname === "localhost") {
  connectRelay(surface, {
    url: "ws://127.0.0.1:4717/tab",
    getToken: devToken("http://127.0.0.1:4717"),
  });
}
```
<!-- /include -->

Then, in Claude Code, say "pair with code 7K2M-Q9XD" (the code your tab shows). The agent calls `relay_pair`, and from then on `surface_observe` and the other tools act on your tab. The indicator changes from the code to "An agent can act in this tab", and to "An agent is acting in this tab" once it has.

The stdio form (`claude mcp add surface -- npx axe relay --dev --stdio`) needs no key: Claude Code starts the relay and speaks MCP on its standard input and output. Only one relay can hold port 4717; a second one exits with a message (pass `--port` to both the relay and the page).

What development mode does, and does not allow:

- `devPairing` listens on loopback only; `--host 0.0.0.0` is refused. Every request must come from a loopback address with a loopback `Host` header, so a web page cannot reach the relay through DNS rebinding.
- Tabs connect from any port on `http://localhost`, `http://127.0.0.1`, or `http://[::1]` (`--origin` replaces the list). Development tokens name the principal `dev` in the tenant `dev`.
- `/mcp` needs the development key the relay printed, or stdio. An agent reaches no tab until it pairs with the code shown in one. Five wrong codes lock that agent out for a minute.
- Serve the page over `http://localhost` in development. A page served over `https` that connects to `ws://127.0.0.1` can be blocked as mixed content or stopped by the browser's local network access prompt; use `wss://` for anything that is not local.

## Unattended mode

A host that opens the application in a hidden browser session for a person sets `window.__AXE_RELAY__` with an init script before any page script runs: `{ url, token, mode: "unattended" }`, where `token` is a relay token the host minted for that person. `injectedRelay()` reads it (at call time, never at import, so server rendering is unaffected) and returns `connectRelay` options, or null in a normal browser. `relayOptions(fallback)` returns the injected options when present and your attended options otherwise, so one line covers both:

<!-- include: examples/relay/page.ts#unattended -->
```ts
// One line for both modes: in a hidden session a host opened for the person, the host injected
// the connection (`window.__AXE_RELAY__`: no pairing, no indicator, approvals in the agent's
// client); in a normal browser, the attended development relay below.
export function connectEitherWay(s: Surface): RelayConnection {
  return connectRelay(
    s,
    relayOptions({ url: "ws://127.0.0.1:4717/tab", getToken: devToken("http://127.0.0.1:4717") }),
  );
}
```
<!-- /include -->

What changes when the tab is unattended:

- No pairing. The host minted the token for the person the session is for, and the agent reaches the tab through its own verified identity (OAuth `identify`, or a stdio relay started for that principal). A development relay still shows pairing codes, which nobody sees in a hidden tab; use a relay with `agentAuth` or `--stdio --principal`.
- No indicator by default (`indicator` is off; the host can pass `indicator: true`). The tab takes approvals from the agent (`approvals: "agent"`), so the relay asks the person in the agent's UI, below.
- Stop from the indicator is absent. The person stops the session by telling the agent (it calls `relay_stop`), from the host's own watch page (the host calls `relay.stop(who)`), or by revoking the agent's OAuth grant, after which the agent reaches no tab at all.

The injected connection replaces the fallback's `url`, token, `mode`, `approvals`, and `indicator`, and keeps its other options (`onStatus`, `requireApproval`, `describe`). A host may also inject `getToken` (an exposed function) for a session that outlives one token.

## What the agent sees

| Tool                  | What it does                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| `relay_tabs`          | Your tabs of the application, most recently active first, and which one the surface tools act on.         |
| `relay_select-tab`    | Choose another of your tabs. Revisions differ between tabs, so observe again after choosing.               |
| `relay_pair`          | Development only: pair with the code the tab shows.                                                        |
| `relay_stop`          | End agent access to a tab, as the person's Stop does; a host closes its hidden session.                    |
| `surface_observe`     | The tab's controls under one revision: what can be done now, why not the rest, values, filtered and paged. |
| `surface_set-field`   | Set a field through the page's own setter.                                                                 |
| `surface_run-control` | Run a button or switch through the page's own handler.                                                     |
| `surface_load-more`   | Ask a list to load more.                                                                                   |
| `surface_ledger`      | Every act and refusal on the tab, with who asked and the revisions it spanned.                             |

These are `domainActions`' default set: a fixed tool list whatever the page holds. Pass `domains` to `createRelay` for the application's own parameterized actions (for example the set `@axe/surface/auto` builds). The usual `axe_state`, `axe_continue`, and `axe_resume` tools are there too, so a control that declares `requires` or a handoff climbs the ladder exactly as it does on a server.

The first surface tool call pins a tab: by default the most recently active one, and it stays the agent's tab until the agent chooses another with `relay_select-tab`. A tab another tab became active in front of does not change under the agent.

## Approvals and Stop

A high-risk control (an effect with `risk: "high"`) or one whose effect declares `confirm` does not run on the agent's first call. In an attended tab the page shows "The agent asks to: Delete the plan" with Approve and Deny, and the agent receives `unavailable` with `details.reason: "approval_required"` and a sentence to say to the person. After the person approves, the agent's next identical call (same entry, text, and `expectedRev`) runs it once. Deny makes that call `forbidden` with `approval_denied`. An approval lapses after five minutes, and a new revision needs a new one. Change the rule with `requireApproval`:

<!-- include: examples/relay/page.ts#approval -->
```ts
// Only high-risk controls wait for the person; a control that declares confirm runs without it.
export const strict = connectRelay(surface, {
  url: "wss://relay.yogastudio.example/tab",
  getToken: () => "token-from-your-backend",
  requireApproval: (row) => row.effect?.risk === "high",
});
```
<!-- /include -->

### Approvals in the agent

A tab that takes approvals from the agent (unattended, or `approvals: "agent"` or `"both"`) does not wait for a panel nobody sees. When it holds an act, the relay asks the person through MCP elicitation on the calling agent's own session, in the same tool call:

| The client declares | The act | What the person sees | Then |
| --- | --- | --- | --- |
| form elicitation | not sensitive | A confirm in the agent's UI: "Approve “Lock January” on Plan Board? It changes locks, risk high." with the act's exact text | Approve runs the act in the same tool call. Decline or dismiss refuses it (`forbidden`, `approval_denied`). |
| URL elicitation | sensitive, or the client has no form mode | An offer to open the relay's approval page, `/approve/<id>`: single use, short-lived (`linkTtlMs`, five minutes), bound to the approval, the person, and the request | The tool call waits for the decision on the page, then runs or refuses the act. Declining to open the page refuses it. |
| no elicitation | any | Nothing | The agent gets `approval_required` with instructions, and the approval page link (`details.approvalUrl`) when the relay serves one. After the person approves there, the agent's identical call runs once. |

On a decision the relay tells the tab (`approve` or `deny`), the tab grants its gates exactly as the panel's Approve does (the relay gate and an auto-derived surface's own gate), records the decision in its ledger (`op: "approve"` or `"deny"`, actor `<principal> (approved in the agent's MCP client)` or `(approved on the relay's approval page)`), and the relay sends the act again, which the page's own checks decide. The approval stays bound to the entry, op, text, and `expectedRev`, and is used once. A tool call the client cancels while the person decides runs nothing; the decision stays with the tab for the agent's identical retry.

An act is sensitive when it targets a sensitive entry, or when `approvals.sensitive` says so. The approval page needs to know who opened it: `approvals.identify(request)` returns the principal and tenant of the person's own session on the relay's domain, and the page refuses anyone else. Without `identify` (outside development) the relay serves no approval page and never offers URL mode:

<!-- include: examples/relay/server.ts#approvals -->
```ts
// Approvals asked through the agent (unattended tabs). A form in the agent's MCP client needs
// nothing here. The approval page (URL mode, for sensitive acts) needs to know who opened it:
// the person's own session on the relay's domain, never anything the agent sent.
declare function sessionFromCookie(request: Request): { userId: string; studioId: string } | null;

export const unattended = createRelay({
  secret: process.env["RELAY_TOKEN_SECRET"]!,
  origins: ["https://app.yogastudio.example"],
  agentAuth: {
    verifier,
    identify: (authInfo) =>
      typeof authInfo.extra?.["sub"] === "string" && typeof authInfo.extra?.["org"] === "string"
        ? { principal: authInfo.extra["sub"], tenant: authInfo.extra["org"] }
        : null,
  },
  baseUrl: "https://relay.yogastudio.example",
  approvals: {
    identify: (request) => {
      const s = sessionFromCookie(request);
      return s ? { principal: s.userId, tenant: s.studioId } : null;
    },
    // Links work once, for five minutes by default.
    linkTtlMs: 300_000,
    // Decided on the page rather than in a form: anything touching payments.
    sensitive: (row) => row.object === "billing",
  },
});

// A host's own Stop control (its watch page) ends the person's sessions.
export function stopFor(userId: string, studioId: string): number {
  return unattended.stop({ principal: userId, tenant: studioId });
}
```
<!-- /include -->

An elicitation is shown to the person by their MCP client; the model cannot answer it (the MCP specification requires the client to put it before the user). So a form decision is the person's as far as the client is trustworthy. The approval page moves the decision to a page the relay serves, outside the client, which is why sensitive acts go there. The relay never accepts an approval from a tool argument: `confirm: true`, text, or anything else the model sends is not a decision.

An attended page can take approvals from both places, whichever answers first:

<!-- include: examples/relay/page.ts#both -->
```ts
// A person is looking, but may also approve from the agent's client: whichever answers first.
export const either = connectRelay(surface, {
  url: "wss://relay.yogastudio.example/tab",
  getToken: () => "token-from-your-backend",
  approvals: "both",
});
```
<!-- /include -->

### Stop

Stop disconnects the tab, revokes its token at the relay, and refuses every later act on that tab with `forbidden`; the agent is told the person stopped it. Stop lasts for the page: a reload connects again only if your page calls `connectRelay` again. Leaving or reloading the page is not Stop: the relay keeps the tab for a reconnect, and an act sent while it reloads waits for the new page.

To render the indicator with your own design system, turn it off and drive yours from `onStatus`; your UI must then show that an agent is connected and offer Stop, Approve, and Deny:

<!-- include: examples/relay/page.ts#own-indicator -->
```ts
// Render the indicator with your own design system: turn the built-in one off and drive yours
// from onStatus. Your UI must show that an agent is connected and offer Stop and the approvals.
export function connectWithOwnIndicator(
  s: Surface,
  render: (status: RelayStatus, controls: RelayConnection) => void,
): RelayConnection {
  const connection: RelayConnection = connectRelay(s, {
    url: "wss://relay.yogastudio.example/tab",
    getToken: () =>
      fetch("/api/relay-token", { method: "POST" }).then(
        async (r) => ((await r.json()) as { token: string }).token,
      ),
    indicator: false,
    onStatus: (status) => render(status, connection),
  });
  return connection;
}
```
<!-- /include -->


The indicator is kept out of an auto-derived surface: its host carries `data-surface-ignore`, and `@axe/surface/auto` never reads it. An agent cannot press Approve, Deny, or Stop. If you render your own indicator, mark its root `data-surface-ignore` too.
## Tenant switches and server rendering

When the person changes tenant (or signs in as someone else) without a reload, call `rekey`. The client leaves the relay under the old identity, which drops the tab's record and revokes its token, then connects with a fresh token:

<!-- include: examples/relay/page.ts#rekey -->
```ts
// The person switched studios (tenants) without a reload: leave under the old identity and
// connect again with a token for the new one. No agent of the old tenant reaches the page after.
export function onStudioSwitched(): void {
  relay.rekey();
}
```
<!-- /include -->

Importing `@axe/relay/client` touches no `window`, `document`, or `WebSocket`, so a page rendered on the server can load it in an effect:

<!-- include: examples/relay/page.ts#dynamic -->
```ts
// With server-side rendering, load the client in an effect: importing it touches no window,
// document, or WebSocket, and connecting happens only in the browser.
export async function startRelayInBrowser(s: Surface): Promise<() => void> {
  const { connectRelay: connect, devToken: dev } = await import("@axe/relay/client");
  const connection = connect(s, {
    url: "ws://127.0.0.1:4717/tab",
    getToken: dev("http://127.0.0.1:4717"),
  });
  return () => connection.stop();
}
```
<!-- /include -->

## Production

The browser side needs only `@axe/relay` (its `client` and `token` entries import nothing at runtime). A relay server also needs its optional peer dependencies: install `@axe/mcp`, `@modelcontextprotocol/sdk`, and `ws` next to `@axe/relay` where the server runs. A web application that only connects its tabs installs none of them, which also keeps it clear of registry age gates on those packages.

A production relay authenticates both sides: tabs with relay tokens your backend minted, agents with OAuth access tokens.

<!-- include: examples/relay/server.ts#production -->
```ts
const relay = createRelay({
  // The key the backend mints relay tokens with.
  secret: process.env["RELAY_TOKEN_SECRET"]!,
  // The pages that may connect a tab: exact origins, subdomains, or any port on localhost.
  origins: ["https://app.yogastudio.example", "https://*.yogastudio.example"],
  // Agents: an OAuth 2.1 resource server. `identify` says who a verified token speaks for; an
  // agent reaches only the tabs of that principal and tenant.
  agentAuth: {
    verifier,
    requiredScopes: ["relay"],
    resource: "https://relay.yogastudio.example/mcp",
    identify: (authInfo) => {
      const sub = authInfo.extra?.["sub"];
      const org = authInfo.extra?.["org"];
      return typeof sub === "string" && typeof org === "string"
        ? { principal: sub, tenant: org }
        : null;
    },
  },
  onEvent: (event) => console.info("[relay]", JSON.stringify(event)),
});

// Behind a TLS terminator: tabs connect to wss://relay.yogastudio.example/tab and agents to
// https://relay.yogastudio.example/mcp.
await relay.listen({ host: "0.0.0.0", port: 8080 });
```
<!-- /include -->

- The relay token is a JSON Web Token signed with HMAC-SHA256: `sub` is the principal, `org` the tenant, `aud` is `axe-relay` (the relay's `audience` option), and it lives at most a day. `mintRelayToken` makes one; any JWT library that signs HS256 does too. `verifyRelayToken` checks one. Or pass `authenticateTab` to check tokens your own way.
- `origins` takes exact origins, `https://*.example.com` (subdomains, not the apex), and `http://localhost:*` (any port), or a function. Mirror your application's own rule; a pattern outside these forms is an error when the relay is created.
- `tenants` restricts the relay to some tenants; a tab or an agent of another is refused.
- `attach(server)` serves the relay on a Node HTTP server you already run; `handle(request)` serves `/mcp` from a framework that gives you Web requests (the tab endpoint needs the server's upgrade event).
- The relay holds tabs in memory, in one process. Run one relay process per deployment, or route each person to one (their tabs and their agent must reach the same process).
- `axe relay --stdio --principal <p> --tenant <t> --origin <url>`, with `AXE_RELAY_SECRET` set, runs a relay for one local agent acting as one named principal.

## Connecting agents

- **Claude Code**, development: `claude mcp add surface -- npx axe relay --dev --stdio`, or `claude mcp add --transport http surface http://127.0.0.1:4717/mcp --header "Authorization: Bearer <key>"` for a relay you started.
- **Claude Code**, production: `claude mcp add --transport http surface https://relay.yogastudio.example/mcp`; Claude Code finds the authorization server from the protected-resource metadata (see [MCP](mcp.md), "OAuth") and signs the person in.
- **Other MCP clients**: the same URL over Streamable HTTP with a bearer token, or the stdio command. The server's instructions tell the agent to call `relay_tabs` first.

## Security model

The relay puts a live, signed-in page within reach of an agent, so it states what it guarantees ([S-RELAY-1] to [S-RELAY-13]) and [Security](security.md) lists the threats:

- The page is authoritative. An act runs through the page's `surface.act` with the page's act queue, revision check, availability, and handler; the relay decides nothing about the application.
- A tab authenticates with a relay token your backend minted for the signed-in person, from an allowed origin. The page's session cookie never goes to the relay.
- An agent reaches only the tabs whose token named its own principal and tenant. Another principal's tab id is as unknown as a made-up one.
- Tokens expire; the page renews in-band, and a connection whose token lapses is closed. Stop revokes the token.
- Every act is in the tab's ledger with the actor `<principal> (agent via relay)`.
- A sensitive field's value never leaves the page: the observation, the ledger, and the frames carry no value for it. The application's `objects` do cross; keep private data out of them.
- High-risk acts wait for the person's approval: in the page when attended, in the agent's MCP client (elicitation) or on the relay's single-use approval page when unattended. No tool argument is ever an approval.
- Revisions are the tab's, offset so that a revision read before a reload, or from another tab, never passes the check.

## Limits

- A tab is one page instance; nothing survives the page but what the application persists. The agent's view is as fresh as its last read: every surface tool call first asks the tab for its current table.
- The relay is in memory and in one process: tab records, pairings, and revocations reset on restart.
- The approval gate is in the page: a script already running in the page can press Approve, as it could click any control.
- In unattended mode the relay is trusted to carry the person's decision to the tab: a tab that takes approvals from the agent accepts `approve` from its relay connection. An attended tab (`approvals: "page"`, the default) accepts none.
- A form approval is only as trustworthy as the MCP client that renders it. A client that times out long tool calls may give up while the person decides; the decision then waits in the tab for the agent's retry.
- Page text (names, reasons, values, the tab's title and path) reaches the agent as data; the MCP instructions tell it never to treat that text as instructions.

## Next steps

- [Surface](surface.md): registering controls the relay then serves.
- [MCP](mcp.md): the derived server, HTTP sessions, and OAuth.
- [Security](security.md): the relay's threats and mitigations.
