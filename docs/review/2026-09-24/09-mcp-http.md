# 9. MCP HTTP lifecycle and request identity

Phase 2. Branch `review/mcp`, based on `herz/surface-integration` at `ce6ef1d` (phase 1 merged).

## Finding

The review said `serveHttp` reuses one stateless `WebStandardStreamableHTTPServerTransport`, so the second request throws, and that the AXE client is configured once when the MCP server is created, so the HTTP caller's identity never becomes the AXE identity.

Reproduced at `ce6ef1d` with the SDK's `Client` and `StreamableHTTPClientTransport` against `serveHttp(await createMcpServer(axe))` behind a `node:http` listener on 127.0.0.1:

- Stateless (the default): the first client already failed. `initialize` got 200, and the client's second HTTP request (`notifications/initialized`) got 500, "Stateless transport cannot be reused across requests. Create a new transport per request." No client could list tools.
- Stateful (`sessionIdGenerator` set): the first client worked; the second client's `initialize` got 400, "Invalid Request: Server already initialized". One transport and one `Server` served the whole process.
- Identity: `createMcpServer(source, { client: { auth } })` built one `AXEClient`; every tool call from every HTTP caller used it. `serveHttp` had no authentication hook and never read `extra.authInfo`.
- The `axe_poll` memory of issued URLs (item 3) was one set per `Server`, so with any fix that shared a server, one client could poll another's URL.

Current official guidance, checked against the MCP specification 2025-11-25 (authorization, transports, security best practices) and the installed SDK 1.30.1: a stateless transport answers one request; a server that assigns `Mcp-Session-Id` answers 404 for a terminated session and the client must re-initialize; servers must validate `Origin`; an HTTP MCP server is an OAuth 2.1 resource server that verifies audience-bound access tokens on every request and serves RFC 9728 metadata; servers must not use sessions for authentication, should bind sessions to the user, and must not pass the received token through to upstream APIs.

## Change

`packages/mcp/src/index.ts`:

- **Bridge and per-connection servers.** `createMcpServer` builds a bridge (the AXE client, the manifest and its freshness, list-change subscriptions) and one MCP `Server` for its own connection (stdio, or a transport the caller connects). `serveHttp` builds further servers from the same bridge.
- **Stateless (default).** A fresh `Server` and transport per HTTP request, JSON response mode, disposed after the response. `GET` and `DELETE` get 405 (clients accept 405 for the stream).
- **Sessions (`sessions: true | SessionOptions`).** A new session per `initialize`, stored by `Mcp-Session-Id` with the principal that opened it. Unknown, deleted, or expired ids get 404 (`-32001 Session not found`); a request without an id that is not `initialize` gets 400. `DELETE` closes the session. Idle expiry after `idleTimeoutMs` (default 30 minutes; checked on access and by an unref'd sweep); `maxSessions` (default 1000; 503 past it); a session id generator and an injectable clock for tests. `close()` and `sessionCount` on the handler. `sessionIdGenerator` is kept, deprecated, and turns sessions on.
- **Authentication (`auth`).** `verifier` is the SDK's `OAuthTokenVerifier`; the bearer token is verified on every request. 401 with `WWW-Authenticate: Bearer` (with `resource_metadata` and `scope` when configured) for a missing, invalid, expired, or wrong-`resource` token; 403 `insufficient_scope` for missing `requiredScopes`. `principal` (default `extra.sub`, else a SHA-256 of the token) keys sessions and poll scopes. A caller that authenticates in front of the handler can pass `{ authInfo }` as the handler's second argument.
- **Per-call identity (`clientFor`).** Called for every tool call with that request's `AuthInfo` (the SDK passes it as `extra.authInfo`). It returns a `CallerContext`: `identity`/`tenant` for an in-process `AXE` source (passed as the runtime's adapter context, so the site's `authenticate` is bypassed exactly as a framework adapter would), or `client` options for a URL or manifest source. Callers never inherit `auth` or `headers` from `createMcpServer`'s options. `AxeLike.handle` takes the optional adapter context.
- **Guards.** `serveHttp` throws when `createMcpServer` was given `client.auth` or `client.headers` without `clientFor` (unless `allowSharedCredentials: true`), and when `auth` is given without `clientFor`. `Origin` other than the endpoint's own and not in `allowedOrigins` gets 403.
- **Poll scope.** `IssuedPollUrls` is per session in stateful mode and per principal (bounded LRU of 1000 principals) in stateless mode; stdio and `createMcpServer`'s own server keep one set.
- **`protectedResourceMetadata(options)`** returns the RFC 9728 document, its path (`/.well-known/oauth-protected-resource` + endpoint path), URL, and a handler. No authorization server is built.
- `axe_poll` fetches at once (it used to wait one second before its first fetch, and never fetched with a zero budget).

Public API added: `ServeHttpOptions.sessions`, `.auth`, `.clientFor`, `.allowedOrigins`, `.allowSharedCredentials`; `SessionOptions`; `HttpAuthOptions`; `CallerContext`; `McpHttpHandler`; `protectedResourceMetadata`, `ProtectedResourceOptions`; re-exported types `AuthInfo`, `OAuthTokenVerifier`. `serveHttp` still takes the object `createMcpServer` returns.

Spec: §22 "MCP mapping", [P-MCP-1] (lifecycle), [P-MCP-2] (per-request authentication, session binding, per-caller identity, no token passthrough), [P-MCP-3] (poll scope); §19 bullet. Mapped to tests in `packages/testing/src/conformance/requirements.ts`.

Docs: `docs/mcp.md` sections "HTTP: requests, sessions, and cleanup", "Authentication over HTTP" (with "Over stdio"), limits; examples `docs/examples/mcp/oauth.ts` (resource server, in-process identity, metadata route) and `docs/examples/mcp/remote.ts` (URL source with per-caller token exchange); `docs/security.md` paragraph and mitigation row. Vocabulary: `clientFor`, `idleTimeoutMs`, `maxSessions`, `sessionCount`, `sessionIdGenerator`, `allowedOrigins`, `requiredScopes`, `resourceMetadataUrl`, `authInfo`, `protectedResourceMetadata`. `CHANGELOG.md`, `DECISIONS.md` ("MCP over HTTP"), `.changeset/mcp-http-freshness.md`.

Migration: `serveHttp(derived)` with `createMcpServer(..., { client: { auth } })` now throws; add `clientFor` (per-caller identity) or `allowSharedCredentials: true` (one-user endpoint). Stateless deployments need no change and now work.

### Session and identity model

A stateless request gets its own MCP server; a session gets one MCP server for its life. Neither holds identity: every HTTP request's bearer token is verified, and every tool call asks `clientFor` who the caller is from that request's `AuthInfo`, so the AXE call carries that caller's credential (URL source) or identity (in-process). A session is bound to the principal that opened it; another principal naming it gets the same 404 as an unknown id. Issued poll URLs are remembered per session, or per principal without sessions.

## Tests

`packages/mcp/test/http.test.ts`, every test with the SDK `Client` + `StreamableHTTPClientTransport` over a real `node:http` listener on 127.0.0.1 (`test/listen.ts`, streaming responses); fixtures in `test/fixtures.ts` (a notes site that records the principal of every handler, continuation, resume, and poll; a token verifier standing in for an external authorization server):

- stateless: a real HTTP client initializes, lists tools, and calls tools, and so does a second client (plus three concurrent clients)
- sessions: separate clients get separate sessions; continue, resume, and poll follow-ups work; DELETE closes the session
- sessions: an idle session expires with 404, and the client re-initializes (injected clock, no timers)
- two authenticated users are isolated: each call reaches AXE as its own principal, and neither can continue, poll, or join the other's work (stateful and stateless)
- a URL source: every call reaches the AXE site with the caller's own credential (and the MCP token never reaches the site)
- acts as an OAuth resource server: 401 with resource metadata, 403 for scope, refused audience, and the metadata document (also the 403 for a foreign `Origin`)
- refuses to share one identity among HTTP callers unless told to

With `packages/mcp/src/index.ts` restored to `ce6ef1d`, all seven fail (the first with the reuse error above). Stdio is still covered end to end by `packages/cli/test/cli.test.ts` "mcp serves the site over stdio to a real MCP client" (a spawned `axe mcp` process), and the in-memory tests in `packages/mcp/test/mcp.test.ts` pass unchanged.

## Limitations

- Sessions live in one process's memory. Behind a load balancer, stateful mode needs session affinity; stateless mode needs none. No `EventStore` is configured, so a dropped server-to-client stream is not replayed.
- Stateless mode has no server-to-client stream; `tools/list_changed` cannot reach those clients (they see changes on their next `tools/list`).
- Anonymous callers (no `auth`) share one principal; in stateless anonymous mode they share one poll-URL scope. Use sessions or authentication where that matters.
- The default principal without `extra.sub` is a hash of the token, so a refreshed token without `sub` looks like a new principal and its session gets 404; set `sub` in the verifier or pass `principal`.
- Audience validation is the verifier's job; `resource` is a second check only for verifiers that report `AuthInfo.resource`.
- `clientFor` runs on every tool call; a token exchange there should be cached by the host.
- MCP elicitation and MCP Apps are not used (item 14).

## Status

done
