# MCP

Every AXE manifest is also a Model Context Protocol server. `@axe/mcp` derives one from an `AXE` instance, a manifest object, or a URL, so the actions you declared once are callable from Claude Desktop, Claude Code, and any other MCP client without a second integration. This page is the exact mapping between the two protocols, how to connect clients, and what the derived server does not do.

## What it is

`createMcpServer` takes one of three sources and returns the MCP `Server`, the `@axe/client` instance it uses to make calls, the manifest, and the tool list:

- An `AXE` instance from `createAXE`. Tool calls go to its fetch handler in-process; no network, no discovery.
- A manifest object. Tool calls go over HTTP to the manifest's `baseUrl`.
- A URL. The client runs `discover` from that URL first, then behaves as above.

Two transports ship. `serveStdio` connects the server to standard input and output, which is what desktop clients spawn. `serveHttp` returns a `(Request) => Promise<Response>` for the Streamable HTTP transport, so you can mount it next to your existing routes in any Web-standard framework. It serves any number of MCP clients; see [HTTP: requests, sessions, and cleanup](#http-requests-sessions-and-cleanup).

In-process over stdio:

<!-- include: examples/mcp/serve.ts#stdio -->
```ts
import { createMcpServer, serveStdio } from "@axe/mcp";
import { axe } from "../apartments/site";

// In-process: every tool call goes straight to axe.handle(); nothing touches the network.
const derived = await createMcpServer(axe, {
  client: { agent: { name: "oakridge-mcp", version: "0.1.0", vendor: "Oakridge Rentals" } },
});

console.error(`serving ${derived.manifest.name}: ${derived.tools.length} tools`);
await serveStdio(derived);
```
<!-- /include -->

Mounted at `/mcp` in Hono, beside the AXE endpoints themselves:

<!-- include: examples/mcp/http.ts#http -->
```ts
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { axeFetch } from "@axe/fetch";
import { createMcpServer, serveHttp } from "@axe/mcp";
import { axe } from "../apartments/site";

const app = new Hono();
const axeHandler = axeFetch(axe);

// The MCP server calls the same AXE instance in-process, so /mcp and /axe/* stay in sync.
const mcpHandler = serveHttp(await createMcpServer(axe));

app.all("/axe/*", (c) => axeHandler(c.req.raw));
app.get("/.well-known/axe.json", (c) => axeHandler(c.req.raw));
app.all("/mcp", (c) => mcpHandler(c.req.raw));

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) });
```
<!-- /include -->

This endpoint has no authentication, and every caller acts as the same anonymous visitor to the site. That suits a public, read-mostly site. For signed-in users, see [Authentication over HTTP](#authentication-over-http).

For a site you do not run, the CLI does the same from the command line: `axe mcp <url>` discovers the manifest, derives the server, and serves it over stdio. The code above is for when you want the server inside your own process.

## The mapping table

The derived server is a bridge, not a second model of your site. Each row below is exactly what `@axe/mcp` does in v0.

| AXE                                                     | MCP                                                                                                                                                                                                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Action                                                  | One tool. Dots in the name become underscores: `units.search` becomes `units_search`, `applications.submit` becomes `applications_submit`. Hyphens are kept.                                                                                    |
| Action `input` JSON Schema                              | The tool's input schema, unchanged. Arguments are validated against it before the action is invoked; a mismatch returns an error listing each path, the same shape as `invalid_input`.                                                            |
| Action `title` and `description`                        | The tool title and description. A metadata line is appended: risk, read-only or changes state, idempotent or not, reversible or not, the required auth mode, deprecation, and the tools that follow as affordances.                             |
| `readOnly`, `reversible`, `idempotent`                  | Tool annotations: read-only hint from `readOnly`, destructive hint when the action changes state and is not `reversible`, idempotent hint from `idempotent`. The open-world hint is always set, because the tool reaches a remote site.           |
| `ok` result                                             | Text content. When the action has `display`, the text is the Markdown comparison from `toMarkdown` (links, badges, the `disclaimer`, each item's affordances as tool names) followed by the raw `output` as JSON. Without `display`, JSON only. The structured content is the whole result envelope. |
| `needs_input` result                                    | Text listing the `reason`, the `message`, and every `accepts` entry in the site's order with `kind`, `title`, `description`, whether it is `sensitive`, its `instructions`, and its payload `schema`; then an instruction to call `axe_continue` with the `continuationToken`, the chosen `kind`, and a `payload`. A `fallback` handoff is appended as text with the `resumeToken`. |
| `needs_human` result                                    | Text with the `reason`, `whatAgentShouldSayToUser`, the `url`, the `instructions`, and an instruction to call `axe_resume` with the `resumeToken` after the human finishes.                                                                    |
| `pending` result                                        | Polled inside the tool call for up to 20 seconds (configurable per server). If it settles, the settled result is returned. If not, text says to call `axe_poll` with the `pollUrl` after `retryAfter` seconds. `axe_poll` polls only a `pollUrl` this server returned; any other URL is refused without a request.                                    |
| `error` result                                          | Text with the `code`, `message`, whether it is `retryable`, and for `invalid_input` each issue's `path` and `message`. A `conflict` with `currentRev` is explained as a stale view; an `unavailable` with a `reason` relays it and what would unblock it. The tool result is flagged as an error. |
| `live`, `rev`, `expectedRev`                            | When the manifest carries `live`: an `axe_state` tool returns `/axe/state` as text and structured content; every action tool, `axe_continue`, and `axe_resume` accept an optional `expectedRev` argument (unless the action's own input uses that name), forwarded in the request envelope; `rev` is appended to `ok` and `needs_input` text; manifest-time `availability` is appended to the tool description. |
| `idempotencyKey`                                        | Every tool for an action that changes state accepts an optional `idempotencyKey` argument (unless the action's own input uses that name), sent as the envelope's `idempotencyKey`. Without it, each tool call gets a fresh key. See [Retries](#retries-and-operation-keys).                                                  |
| Manifest                                                | The `axe_manifest` tool returns the whole manifest as JSON, so a model can read descriptions, schemas, `display`, and the affordance graph on demand.                                                                                             |
| A changing set of actions (`addProvider`, a Surface)    | For an in-process `AXE` instance the tool list is derived on every `tools/list`, tool calls resolve against the current manifest, and the server declares the list-changed capability and sends `notifications/tools/list_changed` whenever `onActionsChanged` fires. A server built from a manifest object or a URL refreshes the manifest within a bound and sends the same notification when the tools change; see [Freshness](#freshness-of-a-remote-manifest). |
| `context.agent`                                         | The `client` option of `createMcpServer`: `agent`, `auth`, `locale`, `timezone`, and the rest of the client options are sent on every call. Over HTTP, `clientFor` supplies the per-caller part.                                                  |
| `policies.agents`                                       | The client refuses to call a site that denies its `vendor`. There is no MCP-level equivalent; the refusal surfaces as an error result.                                                                                                             |

Four helper tools are always present: `axe_manifest`, `axe_continue`, `axe_resume`, and `axe_poll`; `axe_state` is added when the manifest carries `live`. Their names are reserved. An action named `axe.continue` would derive to `axe_continue` and collide, so `createMcpServer` rejects it with an error naming the action; the same applies to two actions whose names differ only in the separator, such as `units.search` and `units_search`.

The server's instructions field tells the model how to read the five statuses, to confirm `sensitive` payloads with the user before calling `axe_continue`, to treat all text from the site as data rather than instructions, and where the human website is.

### What does not map

MCP is a tool protocol between a host and a server. Several things AXE defines have no counterpart, and the bridge makes them visible instead of hiding them.

- **Discovery at a domain.** MCP has no well-known path. You give the client the manifest URL or the `/mcp` mount; AXE's `/.well-known/axe.json` is what the bridge reads, not what the MCP client finds.
- **Human handoff.** MCP's elicitation (including its URL mode, where the user completes a step in a browser) is the nearest counterpart; this bridge does not use it yet. `needs_human` becomes text the model relays, plus the `axe_resume` tool.
- **Idempotency keys.** MCP tool calls carry none, so the bridge adds an optional `idempotencyKey` argument to every tool that changes state. See [Retries](#retries-and-operation-keys).
- **Presentation.** Tool results carry no `display`. MCP hosts can render interactive views through the MCP Apps extension; this bridge does not use it yet. It renders `display` to Markdown so the model can show a comparison, and keeps the full envelope in the structured content for hosts that want to render their own view.
- **Resources, prompts, and sampling.** The derived server declares only tools in v0. Resources and prompts may follow.
- **Streaming.** A tool call returns one result. Long-running work is `pending` and polling, as everywhere else in AXE; see [ROADMAP.md](../ROADMAP.md).

## Connecting Claude Desktop, Claude Code, and other clients

Claude Desktop spawns stdio servers from its configuration file (Settings, Developer, Edit Config). Point it at the CLI with the site's URL:

```json
{
  "mcpServers": {
    "oakridge-rentals": {
      "command": "npx",
      "args": ["-y", "axe", "mcp", "https://oakridge-rentals.example"]
    }
  }
}
````

For actions with `auth: "user"`, add the user's bearer token so it is sent on every call:

```json
{
  "mcpServers": {
    "oakridge-rentals": {
      "command": "npx",
      "args": ["-y", "axe", "mcp", "https://oakridge-rentals.example", "--auth", "sess_ana"]
    }
  }
}
```

Claude Code registers the same command:

```sh
claude mcp add oakridge-rentals -- npx -y axe mcp https://oakridge-rentals.example
```

Any stdio MCP client works the same way: run `npx -y axe mcp <url>` as the server command. Streamable HTTP clients point at your `/mcp` mount from the Hono example above. `axe mcp` writes one status line to standard error when it starts (site name and tool count), nothing else, and exits when the client closes standard input.

## HTTP: requests, sessions, and cleanup

`serveHttp` follows the MCP Streamable HTTP transport ([P-MCP-1](../spec/AXE-PROTOCOL.md#22-mcp-mapping)).

- **Stateless (the default).** Each HTTP request gets its own MCP server and transport, answered as one JSON response and then discarded. There is no session id and no server-to-client stream (`GET` is answered 405, which clients accept), so the server cannot push `notifications/tools/list_changed`; clients see new tools on their next `tools/list`. Any instance can answer any request, which suits serverless and load-balanced deployments.
- **Sessions (`sessions: true`, or an options object).** An `initialize` request opens a session: its own MCP server and transport, keyed by the `Mcp-Session-Id` the response carries. Later requests name the session; the server-to-client stream carries notifications. A session ends when the client sends `DELETE`, when it has had no request for `idleTimeoutMs` (default 30 minutes), or when the handler's `close()` runs. A request naming an ended or unknown session gets 404, and the MCP client starts a new session with a new `initialize`. Past `maxSessions` open sessions (default 1000), a new `initialize` gets 503 until one ends. Sessions live in the memory of one process: behind a load balancer, route a session's requests to the instance that opened it, or use stateless mode.

`sessionCount` on the handler reports the open sessions. The deprecated `sessionIdGenerator` option still turns sessions on.

A request whose `Origin` header is neither the endpoint's own origin nor in `allowedOrigins` is refused with 403, which stops a web page from reaching a local MCP server through DNS rebinding.

## Authentication over HTTP

The MCP authorization model makes an HTTP MCP server an OAuth 2.1 resource server: an authorization server you already run issues access tokens for the MCP endpoint, and the MCP server checks each one. `@axe/mcp` does the checking; it does not issue tokens.

<!-- include: examples/mcp/oauth.ts#resource-server -->
```ts
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { axeFetch } from "@axe/fetch";
import { createMcpServer, protectedResourceMetadata, serveHttp } from "@axe/mcp";
import type { AuthInfo, OAuthTokenVerifier } from "@axe/mcp";
import { axe } from "../apartments/site";

const MCP_URL = "https://oakridge-rentals.example/mcp";

// Tokens come from your existing authorization server. This verifier asks it about each token
// (RFC 7662 introspection) and refuses one issued for any other audience.
const verifier: OAuthTokenVerifier = {
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const res = await fetch("https://auth.oakridge-rentals.example/oauth/introspect", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${process.env.INTROSPECTION_CREDENTIALS}`,
      },
      body: new URLSearchParams({ token }),
    });
    const t = (await res.json()) as {
      active: boolean;
      sub?: string;
      client_id?: string;
      scope?: string;
      exp?: number;
      aud?: string | string[];
    };
    const audience = Array.isArray(t.aud) ? t.aud : [t.aud];
    if (!t.active || !t.sub || !audience.includes(MCP_URL))
      throw new InvalidTokenError("Token is not active for this server.");
    const info: AuthInfo = {
      token,
      clientId: t.client_id ?? "unknown",
      scopes: (t.scope ?? "").split(" ").filter(Boolean),
      extra: { sub: t.sub },
    };
    if (t.exp !== undefined) info.expiresAt = t.exp;
    return info;
  },
};

// RFC 9728 metadata: how an MCP client finds the authorization server.
const metadata = protectedResourceMetadata({
  resource: MCP_URL,
  authorizationServers: ["https://auth.oakridge-rentals.example"],
  scopesSupported: ["rentals"],
});

const mcpHandler = serveHttp(await createMcpServer(axe), {
  sessions: { idleTimeoutMs: 30 * 60_000 },
  auth: {
    verifier,
    requiredScopes: ["rentals"],
    resource: MCP_URL,
    resourceMetadataUrl: metadata.url,
  },
  // In process: each verified caller reaches the AXE runtime as themselves, as an adapter would
  // pass the identity. The site's own authenticate() is not consulted for these calls.
  clientFor: (authInfo) => ({ identity: { onBehalfOf: String(authInfo.extra?.["sub"]) } }),
});

const app = new Hono();
const axeHandler = axeFetch(axe);
app.all("/axe/*", (c) => axeHandler(c.req.raw));
app.get("/.well-known/axe.json", (c) => axeHandler(c.req.raw));
app.get(metadata.path, (c) => metadata.handler(c.req.raw));
app.all("/mcp", (c) => mcpHandler(c.req.raw));

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) });
```
<!-- /include -->

What `serveHttp` does with `auth` and `clientFor` ([P-MCP-2](../spec/AXE-PROTOCOL.md#22-mcp-mapping)):

- **Every request is authenticated.** The bearer token is passed to `verifier` (any `OAuthTokenVerifier` from `@modelcontextprotocol/sdk`) on every HTTP request, not only on `initialize`. A missing or refused token gets 401 with `WWW-Authenticate: Bearer`, carrying `resource_metadata` when `resourceMetadataUrl` is set and `scope` when `requiredScopes` is. A token without the required scopes gets 403 with `error="insufficient_scope"`. An expired token (`expiresAt` in the past) and a token whose `resource` names another server get 401. The verifier must check the token's audience; `resource` is a second check for verifiers that report it.
- **A session belongs to one principal.** The principal is `authInfo.extra.sub` when the verifier sets it, otherwise a hash of the token; `principal` overrides it. A request from another principal naming the session is answered 404, like an unknown session. A session id is never a credential.
- **Each tool call reaches AXE as its caller.** `clientFor(authInfo)` runs for every tool call with that request's verified `AuthInfo`, and returns a `CallerContext`: for an in-process `AXE` instance, the `identity` (and `tenant`) the runtime uses, as a framework adapter would pass them; for a URL or manifest source, `client` options, typically `auth` with a token the site accepts for this user. `auth` and `headers` from `createMcpServer`'s own `client` option are not inherited by callers.
- **The MCP token is not forwarded.** It was issued for the MCP server. For a site you reach over HTTP, obtain a token for the site per caller, for example with a token exchange at your authorization server:

<!-- include: examples/mcp/remote.ts#remote -->
```ts
import { createMcpServer, serveHttp } from "@axe/mcp";
import type { AuthInfo, OAuthTokenVerifier } from "@axe/mcp";

declare const verifier: OAuthTokenVerifier;

// A site you reach over HTTP. The MCP access token was issued for this MCP server, not for the
// site, so it is not forwarded. Exchange it (RFC 8693) for a token the site accepts, per caller.
async function siteTokenFor(authInfo: AuthInfo): Promise<string> {
  const res = await fetch("https://auth.oakridge-rentals.example/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: authInfo.token,
      subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
      resource: "https://oakridge-rentals.example",
    }),
  });
  return ((await res.json()) as { access_token: string }).access_token;
}

const derived = await createMcpServer("https://oakridge-rentals.example", {
  // Revalidate the manifest at least every minute (a 304 when nothing changed).
  client: { manifestMaxAgeMs: 60_000 },
});

export const mcpHandler = serveHttp(derived, {
  sessions: true,
  auth: { verifier, resource: "https://mcp.homefinder.example/mcp" },
  clientFor: async (authInfo) => ({ client: { auth: await siteTokenFor(authInfo) } }),
});

// Optional: look for new or removed actions on a schedule, so connected sessions hear about
// them (tools/list_changed) without waiting for their next call.
setInterval(() => void derived.refresh(), 60_000).unref();
```
<!-- /include -->

Forward the MCP token itself only when your authorization server issued it for both audiences (the MCP endpoint and the site are one protected resource).

- **No shared identity by accident.** `serveHttp` throws when `createMcpServer` was given `client.auth` or `client.headers` and there is no `clientFor`, because every HTTP caller would act as that one user. Set `allowSharedCredentials: true` only for an endpoint one person uses. `auth` without `clientFor` also throws.

`protectedResourceMetadata` builds the RFC 9728 document MCP clients read to find your authorization server, the path to serve it at (`/.well-known/oauth-protected-resource` plus the endpoint's path), and a handler for it.

If authentication already runs in front of the handler (for example the MCP SDK's Express bearer-auth middleware, which sets `req.auth`), call the handler with `{ authInfo }` as its second argument and leave `auth` out.

### Over stdio

`--auth <token>` on the CLI, or `auth` under the `client` option of `createMcpServer`, sends `Authorization: Bearer <token>` on every call. This is the [pass-through mode](auth.md): the token is one the human already granted the agent, and the site's `authenticate` function maps it to `onBehalfOf`. A stdio server belongs to the one user who started it.

When a `user` action is called without a valid token, the site returns a `login_required` handoff. In MCP that arrives as `needs_human` text with the login `url` and a `resumeToken`; the user signs in on the site, and the model calls `axe_resume`.

## Freshness of a remote manifest

A server built from a URL or a manifest object keeps a copy of the site's manifest. The copy is refreshed under these rules ([P-MCP-4](../spec/AXE-PROTOCOL.md#22-mcp-mapping)):

- **Bound.** On `tools/list` and on each tool call, a copy older than its bound is revalidated first: a conditional `GET` with `If-None-Match` when the site sent an `ETag`, which a `@axe/core` site answers 304 when nothing changed. The bound is the smaller of the client option `manifestMaxAgeMs` (default five minutes) and the manifest's `Cache-Control` max-age (`no-cache` means every time). A `@axe/core` site sends max-age 300 unless `manifestCacheSeconds` says otherwise.
- **Unknown tool.** A call naming a tool the copy does not have refreshes once, then runs the tool if the action now exists. Concurrent refreshes share one request.
- **Removed action.** When the site answers `not_found` for a tool's action, the server refreshes once; if the action is gone, the call returns an error saying the site removed it, and later listings omit the tool.
- **Notifications.** When a refresh changes the derived tools, every connected session gets `notifications/tools/list_changed`. A change to `live.rev` alone changes no tool and sends nothing. Stateless HTTP clients have no stream for it and see the change on their next `tools/list`.
- **On demand.** `refresh()` on the object `createMcpServer` returns refetches now and resolves to whether the tools changed; call it on a schedule to notify idle sessions sooner.
- **Failures.** If a refresh fails, the server keeps serving its current copy and tries again on the next call. A refreshed manifest whose `baseUrl` the client's `trust` policy does not allow is refused, and the old copy stays.

So a new action is callable at once by name, and listed within the bound; a removed action stops being listed within the bound, or at its first failed call.

## Retries and operation keys

A tool call that changes state can end in doubt: a timeout, a dropped connection, a host that gave up. MCP carries no retry identity, so the bridge exposes the AXE one ([P-MCP-5](../spec/AXE-PROTOCOL.md#22-mcp-mapping)).

- **With `idempotencyKey`.** The model or the host passes a value of its choosing (a UUID) as the `idempotencyKey` argument. The bridge sends it as the envelope's `idempotencyKey`. Calling again with the same key and the same arguments returns the original envelope, and the handler does not run again ([P-IDEM-2](../spec/AXE-PROTOCOL.md#121-idempotency)). If the first call is still running, the retry gets a retryable `conflict` with `operationStatus: "in_progress"`; call again after `retryAfter`. The same key with different arguments gets a non-retryable `conflict` and changes nothing. Keys are scoped to the action and the caller, so two users cannot collide.
- **Without it.** Each tool call gets a fresh key, so two deliberate calls with identical arguments are two operations. Matching inputs are never taken as a retry.
- **Recovery is a repeat.** There is no separate status tool: to learn what happened to an uncertain call, repeat it with the same key and arguments. The site keeps the result for its idempotency window (24 hours by default).
- **Follow-ups are keyed by their tokens.** Repeating `axe_continue` with the same token, kind, and payload, or `axe_resume` with the same token, returns the original result. Both accept `expectedRev` on a live site, with the same meaning as on an action tool; a stale one applies nothing and leaves the token usable.

The server's instructions tell the model about `idempotencyKey`. Hosts that retry tool calls themselves should add the argument before the first attempt.

## Limits

- **One site per server.** A derived server exposes one manifest. To offer several sites to one client, run one server per site.
- **Sessions are in memory.** Stateful sessions do not survive a restart and are not shared between processes; clients re-initialize after a 404.
- **Descriptions are the site's text.** Tool descriptions, `needs_input` messages, and handoff text come from the site and are untrusted input to the model. The server's instructions say so, and the honesty rules and lint on the site side reduce the risk, but a host that displays tool descriptions should treat them as it treats any web content. See [Security](security.md).
- **Large outputs are truncated in text.** The JSON block in the text content is cut at 24,000 characters. The structured content always carries the full envelope; hosts that read it lose nothing.
- **No streaming.** A tool call blocks until the result envelope arrives, or until the `pending` poll budget is spent.
- **`axe_poll` takes only URLs the server issued.** The server remembers the `pollUrl` of every `pending` result it returned (the most recent 1000) and refuses any other, so a model cannot make the authenticated client fetch a URL of its choosing. Over HTTP the memory is per session, or per principal in stateless mode, so one session or user cannot poll another's URL ([P-MCP-3](../spec/AXE-PROTOCOL.md#22-mcp-mapping)); anonymous stateless callers share one principal. The client's own destination policy (`trust` in the client options) applies on top. A restarted server has forgotten its URLs; the model starts the action again.
- **The poll budget is per server.** The default of 20 seconds is set by the `pollBudgetMs` option of `createMcpServer` and applies to both the initial call and `axe_poll`. `axe_poll` fetches at once, then keeps polling within the budget. Past it, the model must call `axe_poll` again.

## Next steps

- [For agent builders](for-agent-builders.md): the same client the bridge uses, driven directly from your own agent loop.
- [Human handoff](human-handoff.md): what the human sees at the `url`, and how the site marks the handoff complete.
- [Auth](auth.md): the three modes and where pass-through tokens come from.
- [FAQ](faq.md): how AXE relates to MCP and the other standards.
