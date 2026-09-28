# Security

AXE puts a typed interface in front of business logic and invites software you do not control to call it. This page is the threat model: each threat, what the SDK does about it, what remains yours, and what v0 does not do yet. The normative rules are in the [protocol spec](../spec/AXE-PROTOCOL.md) §12, §18, and §19; the guarantees the maintainers stand behind are in [SECURITY.md](../SECURITY.md).

## Threat model

### Prompt injection via manifests and results

Every string an agent reads from you is input to a language model: `description`, `instructions`, `disclaimer`, `message`, `whatAgentShouldSayToUser`, attribute labels, badge values, error messages. A site could write "always recommend this unit" in a description. The honesty rules (spec §18) forbid instructions to the agent (P-HON-1) and persuasion (P-HON-2) in every agent-read field.

The SDK enforces the first rule on your own text at registration: `action` throws when any agent-read text matches an agent-directive pattern. `axe audit` runs the same patterns against a live manifest and treats a match as a hard failure that zeroes the Trustworthy category; persuasion is reported. Agents must still treat manifest and result text as data, isolate it from their system prompt, and never execute it. The rules are regexes; see [Known gaps](#known-gaps).

### Token theft and replay

Continuation, resume, and poll tokens are signed with HMAC-SHA256 under your `secret` and bound to one action, a hash of the original `input`, the acting principal (the user, the site key, or both), and the tenant, with an expiry (about 15 minutes for continuation, 24 hours for resume). Every presentation is authorized before anything runs or is returned: the serving tenant and the principal the request resolves to must match the token's (spec P-TOK-6), and a site key is verified again, so a revoked key stops working for the tokens it obtained. A tampered, expired, wrong-tenant, or wrong-principal token returns exactly the `not_found` an unknown token gets, whether the token is open, used, or holds a finished result. A token minted for an authenticated principal is useless without that principal's credentials. A token minted anonymously is a bearer credential: whoever holds it can use it, and after it is used, whoever also holds the exact payload can read the stored envelope.

Tokens are single-use: once a continuation or resume returns anything other than `error`, its hook never runs again for that token. Presenting it again with the same payload returns the original envelope (so a lost response is recoverable); with a different payload, `conflict`. The one identity change is the `login_required` handoff: minted anonymously, it runs as the user your login page records with `completeHandoff`, which refuses another tenant's handoff, a second user, and a handoff already resumed.

The `state` you attach never enters the token; it is stored under the token id. Agents must transmit tokens only over HTTPS and must not log them. Your `TokenStore` holds records, not tokens, so a leaked store exposes state, not credentials.

### Replay of mutations

Network retries and agent loops repeat requests, sometimes simultaneously. Every mutating action requires an `idempotencyKey`; the runtime claims the key atomically in the `IdempotencyStore` before the handler runs, so of any number of simultaneous requests with one key, on any number of instances sharing the store, one runs. The others get a retryable `conflict` with `operationStatus: "in_progress"`, and afterwards the stored result. A replay with different input returns `conflict`. Keys are scoped by tenant, action, and acting principal, so two users, or two partners, who pick the same key cannot collide. Continuation and resume tokens and poll results use the same claims.

This is at-most-one-run-at-a-time plus replay, not exactly-once effects. A handler that errors releases its claim and may run again on retry; a process that dies after your commit and before the result is stored leaves a claim that a retry takes over when its lease passes, and the handler runs again. Make external effects idempotent with the `operationId` handlers receive ([Deploying](deploying.md#operations-claims-and-crashes)).

### Agents as a DDoS vector

A manifest is an invitation, not a promise of unlimited capacity. An agent loop can hit a search action thousands of times a minute with no malice at all. Declare `policies.rateLimit`; the runtime advertises it with `RateLimit-Policy` on every response. Enforcement is yours, at the edge, keyed by API key in `site` mode and by client IP or agent vendor otherwise, returning 429 with `Retry-After`, which agents must honor. For slow work return `pending` and let the agent poll rather than holding connections open. `policies.agents` refuses named vendors before any handler runs.

Volume is one side; the size of each request is the other. The runtime refuses a body over `maxBodyBytes` (1 MiB by default) before reading it in full, refuses nesting deeper than 64 levels before hashing or validating it, and caps what its in-memory stores hold so abandoned flows cannot grow memory without bound ([Deploying](deploying.md#limits-and-retention)). A schema `pattern` is your regular expression running on the agent's text in a backtracking engine; a nested repetition such as `(\w+\s?)*` can take seconds on a short crafted string. The lint warns on that shape ([Schemas](schemas.md#patterns)); rewrite such patterns rather than rely on the body limit.

The same applies in the other direction when you run an agent: a site can stall a response, send an endless body, or answer `retryAfter: 0` forever. `@axe/client` times out every request, caps every response, and budgets polling ([For agent builders](for-agent-builders.md#timeouts-cancellation-and-budgets)).

### Over-permissioned actions

The runtime authenticates; it does not authorize. It establishes `onBehalfOf` from your `authenticate` function or the adapter's `context` and puts it in the handler's `context`, never from the request body (P-INV-3). Your handler must apply the same checks your UI applies: does this user own this application, may this partner order this item. An action that skips those checks because "only the agent calls it" is the most likely real vulnerability in an AXE integration. See [Auth](auth.md).

### Sensitive payloads

A requirement marked `sensitive` will be answered with bank details, identity documents, or card tokens. The SDK never logs payloads and never puts them, or any input or output, in events. Once `onContinue` receives the validated payload it is in your code: pass it to your payment provider or verification vendor, and do not persist it, log it, or put it in token `state`, which is plain JSON in your `TokenStore`. Agents must confirm with the user before sending it.

### HTML in results

Site output is data. The reference renderers in `@axe/client/present` escape every string and validate every URL before emitting it; `toHTML` contains one static script, identical for every render, that reads only data attributes. No markup from a site executes in an agent surface, and no site should rely on markup reaching a user.

### Cloaking and parity

P-HON-3 requires that data returned to an agent be what a human sees at `display.item.url` at the same moment. `axe audit` prints the URLs to compare and, with a browser, fetches each human page and looks for the price and availability values from the agent response. A miss is reported as a question mark, not a deduction, because the check cannot prove parity. Agents are expected to run the same comparison over time.

### Cross-site request forgery

A site that signs its users in with cookies is reachable from every page those users visit. Browsers attach the cookie to requests that another origin's page makes, and send a `POST` with a `text/plain`, form, or multipart body, or none, without a preflight. CORS headers decide whether that page reads the response; the write has already happened.

The runtime refuses these requests before anything runs (spec [P-TRANS-1] to [P-TRANS-4]). A `POST` to a state-changing endpoint must be `application/json`, which a browser will not send cross-origin without your server's consent, or it gets `unsupported`. A `POST` that carries a `Cookie` header must come from the origin of your `baseUrl`, an origin in `trustedOrigins`, or an origin you allow credentialed CORS for, or it gets `forbidden`, the same response for every path. Requests with no `Origin` and no `Sec-Fetch-Site` are server-to-server calls and pass the origin rule. Your origin is taken from configuration, never from `Host` or forwarded headers.

<!-- include: examples/auth/cookie-session.ts#config -->
```ts
const axe = createAXE({
  name: "Fieldstone Outfitters",
  description:
    "Track orders and start returns for purchases from Fieldstone Outfitters, an online outdoor-clothing shop. Requires the customer to be signed in.",
  // The site's own origin for the origin rule comes from here, never from Host or
  // X-Forwarded-Host.
  baseUrl: "https://shop.fieldstone.example",
  auth: {
    modes: ["none", "user"],
    userLoginUrl: "https://shop.fieldstone.example/login",
    // A browser on the shop's pages sends the session cookie; an agent sends a bearer token.
    authenticate: (request) => {
      const bearer = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
      if (bearer) return tokens.has(bearer) ? { onBehalfOf: tokens.get(bearer)! } : null;
      const sid = /(?:^|;\s*)fo_session=([^;]+)/.exec(request.headers.get("cookie") ?? "")?.[1];
      return sid && sessions.has(sid) ? { onBehalfOf: sessions.get(sid)! } : null;
    },
  },
  // The defaults already require JSON on writes and check Origin on any POST that carries a
  // Cookie. What a cookie site adds is the list of other origins whose pages may call it with
  // the shop's cookie: here, the help-center widget on a sibling domain.
  requestPolicy: {
    trustedOrigins: ["https://help.fieldstone.example"],
  },
  // Credentialed CORS lets the widget read responses. An origin listed here with
  // allowCredentials is trusted by the request policy as well.
  cors: { origins: ["https://help.fieldstone.example"], allowCredentials: true },
  secret: process.env.AXE_SECRET,
});
```
<!-- /include -->

What remains yours: set `SameSite=Lax` or `Strict` on session cookies as a second layer; list every hostname you serve pages from in `trustedOrigins`; keep `GET` handlers free of writes (the rules cover `POST` only); and if your browsers hold ambient credentials other than cookies, set `originCheck` to `always`. [Auth](auth.md#cookie-sessions) has the full matrix and the proxy assumptions.

### Multi-tenant isolation

On a platform, one runtime serves many tenants. Tokens are bound to the tenant id and checked against the tenant serving each request, and idempotency keys are prefixed with it, so a continuation, resume, or poll token minted for one tenant is `not_found` on another, even for a user id that exists on both, and keys never collide across tenants. Every event carries `tenant`. Your handlers must still confine `onBehalfOf` to the tenant it belongs to; the runtime cannot check that.

### Credential forwarding from the agent side

The threats above face the site. This one faces the agent. A manifest discovered at one origin can name a `baseUrl`, `live.url`, or `pollUrl` on another, and a naive client sends its bearer token wherever it is told. Redirects are the same problem one hop later: Node's `fetch` drops `Authorization` on a cross-origin redirect but forwards every other header, so an API key in a custom header reaches the redirect target.

`@axe/client` binds `auth` and `headers` to the origin it discovered from plus the origins in `trust.origins`. Other origins are refused, or contacted without credentials when `allowCrossOrigin` is set. Redirects are followed by hand and each hop is checked again; credentials never cross an origin on a redirect, and an https-to-http redirect is refused. Plain http is allowed only for loopback origins you chose. The table is in [For agent builders](for-agent-builders.md#where-the-client-sends-credentials).

The MCP server derived by `@axe/mcp` exposes polling to a model as the `axe_poll` tool. A tool argument is model-supplied, so prompt-injected text could name any URL; the tool polls only a `pollUrl` the server itself returned in a `pending` result.

An MCP server served over HTTP is used by many people at once. `serveHttp` authenticates every request (not only the one that opened a session), binds each session to the principal that opened it, and resolves the AXE identity for every tool call from that request's verified token through `clientFor`; it refuses to start when one user's credentials would act for every caller. The MCP access token itself is not forwarded to the site unless it was issued for the site too. Issued poll URLs are remembered per session or per principal. See [MCP](mcp.md#authentication-over-http).

### Request forgery from a host-side agent

An agent that runs on a server (an MCP server on a company network, a backend worker) fetches URLs that sites choose, from a network position the sites do not have. That is server-side request forgery: a manifest pointing `live.url` at `http://10.0.0.5/admin` or `https://169.254.169.254/` asks your host to fetch its own internal services.

The client's defaults narrow this. Without `trust.origins` or `allowCrossOrigin` it contacts only the origin you discovered from. With `allowCrossOrigin` it refuses host names that are loopback, link-local, or private by their spelling. `trust.destinationPolicy` gates every outbound URL, redirects included, so the operator can bind the client to an allowlist:

<!-- include: examples/security/agent-destinations.ts#egress -->
```ts
import { AXEClient } from "@axe/client";
import type { DestinationRequest } from "@axe/client";

// A client running inside an MCP server on a company network. The site is untrusted, and the
// server's network access is not the site's to borrow. Every outbound URL, redirects included,
// passes through destinationPolicy after the built-in origin and scheme checks.
const allowedHosts = new Set(["oakridge-rentals.example", "api.oakridge-rentals.example"]);

function destinationPolicy(request: DestinationRequest): boolean {
  const { protocol, hostname } = new URL(request.url);
  return protocol === "https:" && allowedHosts.has(hostname);
}

export const client = await AXEClient.discover("https://oakridge-rentals.example", {
  auth: () => process.env.OAKRIDGE_TOKEN,
  trust: {
    origins: ["https://api.oakridge-rentals.example"],
    // https everywhere, loopback included: this host is a server, not a laptop.
    allowHttp: false,
    destinationPolicy,
  },
});
```
<!-- /include -->

URL checks do not stop request forgery. They see names, not addresses: a public name can resolve to a private address, and DNS rebinding can change the answer between a check and the connection. Only a check at connection time sees the address actually used. Run a host-side client behind an egress policy (a forward proxy or firewall that refuses private ranges and metadata endpoints), or inject a `fetch` whose connector refuses private addresses after resolution. Treat `destinationPolicy` as the application-level half of that boundary, not all of it.
### Surfaces served over HTTP

A surface holds field values, domain objects, and the text agents typed. In the browser (`expose`) that is the page's own data and adds no reader. Served through `@axe/surface/axe` it is published to whoever the server admits, so the bridge declares `auth` on every action it generates and defaults to `user`: a server that lists no `user` mode, including the public default, refuses the bridge rather than serving it, and a public surface is an explicit `auth: "none"`. Anonymous callers of a protected surface are refused by the runtime before the surface sees them, and the manifest and anonymous `/axe/state` never read it. A server hosting many users' surfaces resolves one per caller from a template (`scopedSurfaces`), so one user's values, reasons, and ledger never reach another. Fields marked `sensitive` never publish their value or keep their typed text, and the ledger's text policy (`keep`, `hash`, `omit`, `redact`) covers the rest. What each handler lets a caller do inside the application is still the handler's check. See [Surface](surface.md#who-can-observe-and-act).

### A live tab reached through the relay

`@axe/relay` lets an agent outside the browser act in a signed-in person's open tab ([Relay](relay.md), spec [S-RELAY-1] to [S-RELAY-13]). It puts a page that holds a live session within reach of software the person does not see, so each threat has a mitigation:

| Threat | Mitigation |
| --- | --- |
| Another person's agent reaches the tab | The tab's token names its principal and tenant; an agent's verified identity (OAuth `identify`, the stdio principal, or a development pairing) must name the same. Another person's tab id is `not_found`. |
| A stolen session cookie, or the relay as a cookie sink | The page never sends its session to the relay. It sends a relay token your backend minted for this purpose, with its own signing key and audience. |
| A stolen relay token | It lives minutes (at most a day), and the connection closes when it lapses unless the page renews it for the same person. Stop and `rekey` revoke it. The relay accepts it only from an allowed origin. |
| Another site's page connects a tab | The upgrade is refused unless `Origin` is on the allowlist; patterns are exact origins, `https://*.<domain>`, and `http://localhost:*`. |
| The agent acts without the person knowing | The page shows an indicator while connected, with Stop. Stop revokes the token and refuses every later act. |
| A consequential act the person did not want | High-risk and `confirm` controls wait for Approve in the page (attended) or in the agent's MCP client or the relay's approval page (unattended), bound to the entry, text, and revision, used once. |
| The model approves its own act | An unattended approval is an MCP elicitation, which the client shows to the person and the model cannot answer, or the relay's approval page, which checks the person's own session. No tool argument (`confirm`, text, anything) counts as a decision. |
| A leaked approval link | Single use, short-lived (five minutes by default), bound to one approval, one principal and tenant, and one request; it answers only the person `approvals.identify` recognizes, needs a nonce from the page it served, refuses a cross-origin post, and cannot be framed. |
| A stale or cross-tab revision applies to the wrong state | The page's own check refuses it; presented revisions are offset per tab and per page instance, so one read before a reload or from another tab never matches. |
| Private values leave the page | `sensitive` fields carry no value in any frame; the ledger keeps none of their text. |
| An act without a record | The page's ledger records every forwarded act with the actor `<principal> (agent via relay)`; the relay's `onEvent` records connections, refusals, Stop, and pairing. |
| A web page reaches a development relay (DNS rebinding, drive-by) | `devPairing` listens on loopback only, refuses a non-loopback peer or `Host`, needs the development key or stdio on `/mcp`, and an agent pairs only with the code the person reads from the tab. Wrong codes are rate limited. |
| Prompt injection from page text | Names, reasons, values, and the tab's title reach the agent as data; the MCP server's instructions say so, as for any AXE result. |

**Unattended mode.** When a host runs the application in a hidden browser session for a person, no one watches the tab, so approvals move to the agent's UI. An elicitation is rendered by the person's MCP client, and the MCP specification requires that the model cannot answer it; a form decision is therefore the person's as far as that client is trustworthy. For sensitive acts the relay sends the person to its own approval page (URL mode), which puts the decision outside the client, on a page that establishes who the person is from their own session. A client that declares no elicitation gets the old `approval_required` refusal with instructions, never an act run on the model's say-so. A tab accepts a decision from the relay only if the page connected with `approvals: "agent"` or `"both"` (an unattended tab does); an attended tab ignores it, so a relay compromise alone does not approve anything in a tab a person is watching. Every decision is recorded in the tab's ledger with who made it and where, and in the relay's `onEvent` (`approval.decided`). The person ends the session by telling the agent (`relay_stop`), from the host's own control (`relay.stop`), or by revoking the agent's OAuth grant.

What remains yours: minting relay tokens only for the signed-in person in a request your session authenticated, a signing key used for nothing else, `origins` that match your application, TLS (`wss://`) in front of the relay, and routing a person's tabs and agents to one relay process. A script already running in your page can press Approve, as it can click any control; the gate protects against the agent, not against the page.

### A hosted browser acting as the person

In unattended mode `@axe/host` runs the application in a headless browser on your server, signed in as the person the agent authenticated as ([Unattended mode](host.md), [S-HOST-1] to [S-HOST-9]). That browser holds a real session and acts with it, from your network.

| Threat | Mitigation |
| --- | --- |
| An agent drives another person's session | A session is for exactly the principal and tenant the agent's verified token names; the host mints the page's relay token for that identity only, and the relay serves an agent only its own person's tab. |
| One person's cookies or storage reach another | One browser context per identity; nothing is shared but the browser process. A tenant change is another session. |
| The hidden page is paired by someone else | There is no pairing: the host opens the tab itself for the signed-in identity. The connection is injected only into frames of the application's origin, and the renewal function mints only for them. |
| The application session leaks | What `sessionFor` returns is never logged, put in an event, or returned by a tool; headers go only to the application's origin; relay tokens are short-lived and renew in-band. |
| Request forgery through navigation (a link to an internal address, a redirect) | Navigations to origins other than the application's and `allowedOrigins` are refused and the page stays; `restrict: "all"` refuses every other request; cloud metadata addresses are never reachable; service workers are blocked so nothing fetches around the rules. |
| A consequential act nobody approved | Nobody sees the hidden page, so approvals go to the person in the agent's UI (elicitation); without it the act does not run. |
| Browsers exhaust the host | `maxSessions` (least recently used closed first) and `idleMs`. |
| A local web page drives a development host | Loopback only, loopback `Host` required, a development key on `/mcp`, and the watch page behind a random path. |

What remains yours: issuing the application session in `sessionFor` only for the identity the verified token names, short-lived and scoped to what an agent may do; an egress policy for the host (subresource requests to other origins are allowed unless `restrict: "all"`); and keeping the development storage state (`axe host login`) out of version control.

## What the SDK mitigates

| Threat                               | Mechanism                                                                                                                              | Where                                      |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Forged or altered tokens             | HMAC-SHA256 over type, id, action, input hash, user, tenant, expiry; verified before the store is read                                 | `@axe/core`, `TokenSigner`                 |
| Token reuse                          | Atomic claim per token use; a repeat returns the stored envelope, a different payload `conflict`; unknown, tampered, expired, wrong-tenant, or wrong-principal tokens return `not_found` | `@axe/core`, continue, resume, and poll    |
| Token use by the wrong caller        | Tenant and principal checked on every presentation before any hook or stored result; site keys re-verified                             | `@axe/core`, token endpoints               |
| Private poll results                 | A poll is authorized as the call that produced it, terminal results included                                                           | `@axe/core`, poll endpoint                 |
| State leakage through tokens         | `state` stored server-side under the token id, never encoded in the token                                                              | `@axe/core`, `TokenStore`                  |
| Weak or missing secret               | `secret` under 16 characters throws at startup; an absent one produces a random per-process secret and a console warning               | `@axe/core`, `createAXE`                   |
| Identity spoofing in the body        | `context` is sanitized on read; `onBehalfOf` is overwritten with the identity from `authenticate` or the adapter                       | `@axe/core`, request pipeline              |
| Duplicate mutations                  | `idempotencyKey` required for mutating actions; atomic claim before the handler; replay returns the stored result, different input returns `conflict` | `@axe/core`, `IdempotencyStore`            |
| Malformed input                      | Zod validation before any handler; `invalid_input` with a JSON Pointer per problem; `_axe` stripped before output validation           | `@axe/core`, action pipeline               |
| Oversized or deeply nested bodies    | `maxBodyBytes` enforced from `Content-Length` and while streaming, 413 before parsing; nesting over 64 levels refused; raw Node streams read only to the limit | `@axe/core`, `@axe/express`, `@axe/next`   |
| Unbounded store growth               | In-memory stores sweep expired entries and cap `maxEntries` without evicting a running claim; `SqliteIdempotencyStore.prune()` | `@axe/core`, `@axe/core/node`              |
| Schema constructs silently ignored   | The JSON Schema validator refuses values under keywords, formats, patterns, and refs it cannot apply; own members only; the lint reports each construct; refined Zod nodes marked `x-axe-refined` | `@axe/core/json-schema`, `@axe/core/lint`  |
| A site that stalls, floods, or sends garbage to an agent | Per-request timeout and caller signal, response size cap, polling budget with a one-second floor, every document checked before use | `@axe/client`                              |
| Internal details reaching agents     | Thrown errors replaced by a generic `internal` error and delivered to `onError`; output that fails its schema is replaced the same way | `@axe/core`, `onError`                     |
| Prompt injection from your own text  | Agent-directive patterns rejected when `action` is called; audit hard failure on live manifests                                        | `@axe/core/lint`, `axe audit`              |
| Unwanted agents                      | `policies.agents` allow and deny lists enforced per request; deny wins                                                                 | `@axe/core`, request pipeline              |
| Cross-origin browser calls           | CORS off unless `cors` is configured; no CORS headers emitted otherwise                                                                | `@axe/core`, `cors`                        |
| Cross-site request forgery           | Non-JSON writes refused; cookie-carrying POSTs from untrusted origins refused before any body, identity, or token is read | `@axe/core`, `requestPolicy` |
| Markup or script in rendered results | Every value escaped, every URL required to be http or https, one static script reading data attributes                                 | `@axe/client/present`, `toHTML`            |
| Agent credentials sent to other origins | Credentials bound to the discovery origin plus `trust.origins`; redirects checked per hop; no credentials across origins; https downgrade refused | `@axe/client`, `trust` |
| Model-chosen poll URLs | `axe_poll` polls only a `pollUrl` the server returned | `@axe/mcp` |
| One MCP endpoint shared by many users | Per-request token verification; sessions bound to their principal; per-call AXE identity from `clientFor`; shared credentials refused; poll URLs scoped per session or principal | `@axe/mcp`, `serveHttp` |
| Payloads in telemetry                | The event type has no field for input, output, payload, or `onBehalfOf`                                                                | `@axe/core/events`                         |
| Cross-tenant token and key reuse     | Tenant id in token bindings and idempotency key prefixes                                                                               | `@axe/core`, tokens and idempotency        |
| Anonymous or cross-user surface reads | Bridge actions default to `auth: "user"`; per-caller surfaces from a template; `sensitive` fields and the ledger text policy | `@axe/surface/axe`, `@axe/surface`        |

Each row is pinned by tests in the SDK's own suites, run by `pnpm -r test`. The [review checklist](review/2026-09-24/README.md) names the tests per property, with what each one fails on without the change: token binding (item 01), atomic operations (02), client trust (03), poll authorization (04), Surface authorization (05), CSRF (06), site principals (07), write preconditions (08), MCP HTTP identity (09), capability freshness (10), mounted React behavior (11), and limits and schema boundaries (12). A test pins the code path it exercises, in this repository; it does not show that a deployment configured the mechanism, and it does not test your handlers. `axe conformance` and `axe audit` observe a few of these from outside (tampered tokens, principal binding with `--auth`, error hygiene, request policy); they are not a security test of your site.

## What your site must provide

The production configuration below shows the shape.

<!-- include: examples/security/production-config.ts#config -->
```ts
// Refuse to start without a real secret. Tokens signed with a per-process random secret
// stop verifying on restart, and a short or shared secret is forgeable.
const secret = process.env.AXE_SECRET;
if (!secret) throw new Error("AXE_SECRET is not set. Generate one with `openssl rand -hex 32`.");

export const axe = createAXE({
  name: "Oakridge Rentals",
  description:
    "Search available apartments, schedule tours, submit rental applications with a holding deposit, and check application status.",
  baseUrl: "https://oakridge-rentals.example",
  humanFallbackUrl: "https://oakridge-rentals.example",
  auth: { modes: ["none", "user"], userLoginUrl: "https://oakridge-rentals.example/login" },
  policies: {
    rateLimit: { requestsPerMinute: 60 },
    termsUrl: "https://oakridge-rentals.example/terms",
    dataRetention:
      "Continuation state is kept for 15 minutes, handoff state for 24 hours, and idempotency records for 24 hours.",
  },
  contact: { email: "agents@oakridge-rentals.example" },
  secret,
  tokenStore: new KvTokenStore(kv),
  idempotencyStore,
  // `cors` is omitted on purpose: no browser-based agent calls this origin, so no CORS headers are emitted.
  onError: (ctx, error) => {
    // The agent has already received a generic `internal` error. Log the cause with the
    // action and endpoint. Never log ctx.request's body: it may hold a sensitive payload.
    console.error(
      JSON.stringify({ action: ctx.action, endpoint: ctx.endpoint, error: String(error) }),
    );
  },
});
```
<!-- /include -->

**HTTPS.** The protocol requires it and `createAXE` rejects a non-loopback `baseUrl` that is not https. Terminate TLS in front of the runtime and make sure the adapter sees the right scheme behind a proxy.

**A real `secret`.** At least 16 characters; 32 random bytes from `openssl rand -hex 32` is the recommendation. Load it from your secret manager and share it across every instance serving the same site. Rotating it invalidates outstanding tokens.

**Authorization in handlers.** Check ownership and permission against `context.onBehalfOf` (or the partner resolved from the API key) exactly as your UI does. Return `fail` with `forbidden` when the check fails.

**Rate limiting at the edge.** Declare `policies.rateLimit`; enforce it in your gateway or proxy with 429 and `Retry-After`. The runtime does not count requests.

**Durable stores.** The default `TokenStore` and `IdempotencyStore` are in-memory. With more than one instance, a continuation minted on one process is unknown to the next, and two instances cannot see each other's claims. The token store needs get and set with TTLs; the idempotency store must claim atomically, and a get/set implementation is refused at startup:

<!-- include: examples/security/production-config.ts#stores -->
```ts
// Token records hold `state` and the accepted schemas; they are plain JSON, keyed by a random id.
// A get/set store with TTLs is enough for them.
class KvTokenStore implements TokenStore {
  constructor(private readonly kv: Kv) {}
  async get(id: string): Promise<TokenRecord | undefined> {
    const raw = await this.kv.get(`axe:token:${id}`);
    return raw ? (JSON.parse(raw) as TokenRecord) : undefined;
  }
  async set(id: string, record: TokenRecord, ttlSeconds: number): Promise<void> {
    await this.kv.set(`axe:token:${id}`, JSON.stringify(record), ttlSeconds);
  }
  async delete(id: string): Promise<void> {
    await this.kv.del(`axe:token:${id}`);
  }
}

// Operation claims (idempotency keys, token uses, poll results) must be atomic across every
// instance. A get/set store is refused at startup. This is the SQLite reference adapter; for
// Redis or PostgreSQL, see docs/deploying.md, "Secrets and stores".
const { DatabaseSync } = (await import("node:sqlite" as string)) as {
  DatabaseSync: new (path: string) => SqliteDatabaseLike;
};
const idempotencyStore = new SqliteIdempotencyStore(new DatabaseSync("/var/lib/oakridge/axe.db"));
```
<!-- /include -->

**No payload logging.** Request logging that captures bodies will capture `/axe/continue` payloads. Exclude that path from body logging, or log only method, path, status, and latency for AXE routes.

**Parity.** The values you return for an agent must match what a human sees at `display.item.url`. If your human pages show personalized prices, make the agent result carry the same, or declare the tolerance through `freshness`.

**A reachable `humanFallbackUrl`.** Agents send users there when nothing else works. The audit checks that it responds.

## Known gaps

These are true of v0. The first two are deferred with reasons in [ROADMAP.md](../ROADMAP.md); the rest are limits to plan around.

- **No manifest signing.** Manifest integrity rests on HTTPS. An attacker who can serve content on your origin can serve a different manifest.
- **No agent attestation.** `context.agent` and `User-Agent` are self-reported. `policies.agents` matches those strings; it does not verify them.
- **Honesty rules are heuristics.** The agent-directive and persuasion checks are regular expressions over known phrasings. Novel phrasing passes both registration and the audit. A passing audit is not proof that a manifest is safe to follow.
- **Conformance and audit are not security reviews.** A conformant site with a high score can still leak data across users or tenants through its own handlers. See [What a score does not mean](audit.md#what-a-score-does-not-mean).
- **Parity is a spot-check.** The audit looks for agent-returned values as text on the human page. Dynamic pages, formatted numbers, and personalized prices defeat it in either direction.
- **Zod refinements are not enforced on continue.** Stored `accepts` schemas are JSON Schema so they can live in any `TokenStore`, and payloads are validated against that. A refinement on a custom kind's Zod schema is not applied to `/axe/continue`; put the constraint in `onContinue`. The published schema marks the node `x-axe-refined`, which tells the agent a matching payload may still be refused; it does not make the runtime apply the refinement.
- **The backtracking check is a heuristic.** It finds a repeated group whose body ends in a repetition; overlapping alternatives such as `(a|aa)+` pass it. Patterns run in the platform's backtracking engine with no time limit.
- **Store caps shorten the idempotency window under load.** An in-memory store at `maxEntries` evicts completed records oldest first, and a retry of an evicted operation runs the handler again. A durable store has no cap and needs `prune()` or TTLs.
- **Idempotency is not exactly-once.** The SDK guarantees one run at a time per operation and a replayed result once it completes. A handler that fails, or a process that dies between your commit and the stored result, can run again on retry; the Redis store can also lose a claim on failover. External effects need the `operationId` or your own downstream idempotency.
- **Anonymous tokens are bearer credentials.** A token minted without a principal can be used by anyone who holds it. Put `user` or `site` auth on actions whose follow-ups carry private data.
- **`completeHandoff` is read-modify-write on the `TokenStore`.** Two simultaneous completions of one handoff can both succeed; the last write wins. It is called by your own landing page, once per human.
- **In-memory stores lose everything on restart.** Every open continuation, handoff, and idempotency record disappears and agents receive `not_found`. Use durable stores in production.
- **Agent-side URL checks see names, not addresses.** `trust` and `destinationPolicy` cannot stop DNS rebinding or a public name that resolves to a private address. A host-side agent needs an egress policy as well.
- **The origin rule relies on browsers sending `Origin` or `Sec-Fetch-Site`.** Every current browser sends `Origin` on `POST`. A browser old enough to send neither is treated like a server-to-server caller; the JSON rule and `SameSite` cookies still apply. The rule sees cookies only; other ambient credentials need `originCheck` set to `always`.
- **The relay is in memory, in one process.** Tab records, pairings, and revocations reset when it restarts; a revoked token that has not expired is accepted again after a restart. Keep token lifetimes short.
- **`toHTML` allows inline script in its CSP.** The rendered page's Content-Security-Policy meta tag permits inline script and styles so its one static script and stylesheet work without external files. A surface embedding the page should apply its own stricter policy.

## Reporting

Report vulnerabilities in the SDK, the adapters, the CLI, or the protocol as described in [SECURITY.md](../SECURITY.md). Issues in sites built with the SDK or agents built with the client belong to their operators.

## Next steps

- [Auth](auth.md): the three modes and how identity reaches your handlers.
- [Human handoff](human-handoff.md): the token lifecycle and the landing page.
- [Deploying](deploying.md): CORS, caching, rate limiting, and observability in production.
- [Audit](audit.md#honesty-rules): every honesty check and what it catches.
````
