# Agent Experience MCP service

This directory is the company-side service for agents. It is a standalone Node process with three modes:

- **Local attended mode (the default):** a website's open tab connects its page-held Surface to `/tab`; a desktop agent connects to `/mcp` and pairs with that tab.
- **Browser-handoff mode (`AXE_MCP_MODE=handoff`, recommended):** ChatGPT connects to the public `/mcp` endpoint with OAuth. When no tab is connected, the client opens an identity-bound one-time URL; after ordinary application sign-in, the installed browser package connects the tab automatically. There is no pairing code or customer backend endpoint.
- **Hosted unattended mode (`AXE_MCP_MODE=hosted`, optional):** this service runs an isolated headless browser. It is only for applications that deliberately provide a short-lived application-session broker.

Customer applications never run an MCP server. Browser-handoff mode installs only the browser client: it needs no relay-token route, session exchange, shared secret, or other backend integration. The optional unattended path has a different tradeoff and is not the default developer contract.

The default configuration is deliberately local-development only. It binds to loopback, uses a development bearer key, and pairs an agent with a website tab using the code displayed in that tab. Hosted mode is the production service shape: OAuth for the agent and a short-lived, application-issued browser session. The relay protocol and tools stay the same.

## Run locally

From the repository root:

```sh
pnpm install
pnpm mcp:dev
```

Defaults:

- Website tab endpoint: `ws://127.0.0.1:4717/tab`
- Desktop-agent MCP endpoint: `http://127.0.0.1:4717/mcp`
- Health: `http://127.0.0.1:4717/health`
- Setup metadata: `http://127.0.0.1:4717/.well-known/agent-experience.json`
- Local bearer key: `axd_agent_experience_local`

Override the loopback host, port, key, and browser-origin allowlist with `AXE_MCP_HOST`, `AXE_MCP_PORT`, `AXE_MCP_AGENT_KEY`, and the comma-separated `AXE_MCP_ALLOWED_ORIGINS`. While development pairing is enabled, the service refuses a non-loopback host and must not be deployed publicly.

## Connect an agent

For Codex:

```sh
export AXE_MCP_AGENT_KEY=axd_agent_experience_local
codex mcp add agent-experience \
  --url http://127.0.0.1:4717/mcp \
  --bearer-token-env-var AXE_MCP_AGENT_KEY
```

Other MCP clients use the same Streamable HTTP URL and `Authorization: Bearer <AXE_MCP_AGENT_KEY>`.

Open an integrated website. Its Surface indicator shows a pairing code. Tell the agent the code; the server instructions lead it through `relay_tabs`, `relay_pair`, `surface_read`, `surface_observe`, `surface_wait`, and the Surface action tools. Generic browser automation is not needed once those tools are available.

## Build and run

```sh
pnpm --filter @axe/mcp-service build
pnpm mcp:start
```

The build output is `mcp/dist/`. The service depends on workspace packages during development but produces an ordinary Node entry point and owns no customer application code or session state beyond its in-memory relay records.

## Run the browser-handoff service

Set `AXE_MCP_MODE=handoff`, the application's normal URL, the public MCP URL, and the provider OAuth variables documented in [`.env.example`](.env.example):

```sh
pnpm --filter @axe/mcp-service build
AXE_MCP_MODE=handoff node mcp/dist/index.js
```

`relay_tabs` returns a standard `needs_human` handoff when the authenticated person has no connected tab. An MCP client with URL elicitation opens the relay's short-lived `/connect/<token>` page. That page transfers the bootstrap through `window.name` and immediately redirects to `AXE_HOST_APP_URL`; after any normal sign-in redirect, `@axe/relay/client` exchanges the handoff directly with this service and connects the page-held Surface.

The token is not an application credential, never enters the application URL, and can be exchanged only once from the configured application origin. The application adds no API route. Keep `/connect/*` out of access logs, terminate TLS at the public endpoint, and use shared handoff state or sticky routing before adding multiple service instances.

## Optional: run the unattended browser host

Set `AXE_MCP_MODE=hosted` and the `AXE_HOST_*` variables documented in [`.env.example`](.env.example), then run the same built entry point:

```sh
pnpm --filter @axe/mcp-service build
AXE_MCP_MODE=hosted node mcp/dist/index.js
```

The public URL must terminate TLS and forward to this process. `AXE_HOST_PUBLIC_MCP_URL` is the canonical HTTPS `/mcp` resource registered with the authorization server and packaged into the ChatGPT plugin; it is intentionally separate from the process's internal listen address.

Hosted mode uses two server-to-server integrations:

1. **OAuth token verification.** With RFC 7662, `AXE_HOST_OAUTH_INTROSPECTION_URL` verifies every bearer token and returns `active`, identity claims, `scope`, `exp`, and an `aud` containing the exact public MCP URL. For an application that issues opaque user-session credentials, set `AXE_HOST_OAUTH_USERINFO_URL` instead; the host calls it with the bearer token and reads the configured (dotted, if needed) principal and tenant claims from its JSON response. Protected-resource metadata tells the MCP client which authorization server to use, so account connection happens in the client's normal browser flow.
2. **Application session broker.** `AXE_HOST_SESSION_BROKER_URL` accepts a `POST` with `{ principal, tenant, scopes }` and returns the short-lived Playwright session shape below. In the default `service` mode it authenticates with `AXE_HOST_SESSION_BROKER_TOKEN`, and the MCP access token is not forwarded. `AXE_HOST_SESSION_BROKER_AUTH=caller` is for an application that issued the opaque OAuth token itself: the already verified token authenticates the exchange, and no separate broker secret is needed.

```json
{
  "cookies": [
    {
      "name": "app_session",
      "value": "short-lived-signed-value",
      "url": "https://app.customer.example",
      "expires": 1790000000,
      "httpOnly": true,
      "secure": true,
      "sameSite": "Lax"
    }
  ]
}
```

In `service` mode, the broker authenticates this service with `Authorization: Bearer <AXE_HOST_SESSION_BROKER_TOKEN>` and must independently verify the named user and tenant. In `caller` mode, it must derive the user from the forwarded OAuth credential and never authorize from the advisory identity fields in the body. It should issue a narrowly scoped session with a short expiry and return `403` with no login response to refuse permanently. It may return `cookies`, `headers`, `localStorage`, or `storageState`; those credentials are placed only into that identity's isolated browser context and are never returned through MCP.

When the identity is valid but has not connected an application account, return `401` or `403` with this JSON instead:

```json
{
  "loginUrl": "https://app.customer.example/agent-login?request=opaque-one-time-code",
  "instructions": "Sign in to the application in this window, then return to ChatGPT.",
  "whatAgentShouldSayToUser": "Please connect your application account so I can continue.",
  "expiresAt": "2026-09-28T17:30:00.000Z"
}
```

`loginUrl` is required; the other fields are optional. It must be an absolute HTTP(S) URL and `expiresAt`, when present, must be in the future. The opaque request in that URL is the application's responsibility: bind it to the broker request's verified `principal` and `tenant`, require the person to authenticate on the application's own page, make it short-lived and single-use, and never put a password in the URL. After successful sign-in, later broker calls for that identity must return the session shape above.

The MCP service turns this response into an `application_login_required` human handoff. A URL-capable agent client can open it in its normal consent UI; otherwise the model relays the same link. When the person returns, `axe_resume` asks the broker again and replays the exact original tool call only if a session is now available. Resume tokens are random, expire with the login request, are bound to the verified MCP principal and tenant, and replay the stored result rather than running the operation twice. The username and password go only to the application login page and never cross MCP, the model, or this service.

Install Chromium in the service image (`npx playwright install chromium --with-deps`). Size `AXE_HOST_MAX_SESSIONS` for the memory cost of one real application page per active user, and use sticky routing if multiple service instances share the public endpoint because MCP and hosted browser sessions are in memory.

The included container starts directly in browser-handoff mode and does not install Chromium. Build it from the repository root so workspace packages are available:

```sh
docker build -f mcp/Dockerfile -t agent-experience-mcp .
docker run --env-file /path/to/hosted.env -p 8080:8080 agent-experience-mcp
```

Put a TLS terminator in front of port 8080 and keep OAuth verifier secrets in the deployment platform's secret store, not in the image or an environment file committed to source control. If you deliberately deploy the optional unattended mode, use a separate image that also runs `playwright install chromium --with-deps` and stores its session-broker secret there.

## Local Summation browser-handoff demo (no pairing, no Summation backend change)

This path exercises the production browser-handoff architecture from Claude Desktop. Unlike `pnpm mcp:dev`, it does not expose `relay_pair`, and unlike unattended host mode it needs no Summation session broker.

Run Summation's web app at `http://localhost:5173` and sum-api at `http://localhost:9092`, with its OAuth routes enabled and issuer set to its reachable origin. Then export:

```sh
export AXE_HOST_APP_URL=http://localhost:5173
export AXE_HOST_PUBLIC_MCP_URL=http://127.0.0.1:4717/mcp
export AXE_HOST_AUTHORIZATION_SERVERS=http://localhost:9092
export AXE_HOST_SCOPES=agent:read
export AXE_HOST_OAUTH_USERINFO_URL=http://localhost:9092/v1/me
export AXE_HOST_PRINCIPAL_CLAIM=identity.user_id
export AXE_HOST_TENANT_CLAIM=identity.org_id
pnpm mcp:handoff-dev
```

Configure Claude Desktop without a static authorization header:

```json
{
  "mcpServers": {
    "agent-experience": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote@latest",
        "http://127.0.0.1:4717/mcp",
        "--allow-http"
      ]
    }
  }
}
```

On the first connection, the MCP OAuth challenge causes the client to open Summation's browser login. After OAuth, Claude calls `relay_tabs`; because no tab is connected, its URL flow opens Summation through the relay handoff. The installed package connects that signed-in tab automatically. There is no pairing code, bearer key, new sum-api route, or credential entered into chat.

## ChatGPT plugin

[`plugins/agent-experience`](../plugins/agent-experience/README.md) packages the hosted MCP endpoint with agent instructions. Configure it with the deployed HTTPS URL, test it in ChatGPT developer mode, then submit it to the universal plugin directory. A consumer installs the named plugin once and signs in when ChatGPT prompts; they never configure an MCP server or learn what MCP is.
