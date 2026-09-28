# Agent Experience MCP service

This directory is the company-side service for agents. It is a standalone Node process with four modes:

- **Local attended mode (the default):** a website's open tab connects its page-held Surface to `/tab`; a desktop agent connects to `/mcp` and pairs with that tab.
- **Local unattended mode (`AXE_MCP_MODE=local-unattended`, recommended for the Summation demo):** the first relevant tool call starts a hidden browser on this laptop. Login, organization selection, tenant selection, and application work all happen through Surface; no browser window or pairing code appears.
- **Hosted unattended mode (`AXE_MCP_MODE=hosted`, production target):** this service runs an isolated headless browser for each verified person. The current implementation gets its initial application session from a broker; a provider-owned account/session service can own that boundary later without changing the browser package installation.
- **Browser-handoff mode (`AXE_MCP_MODE=handoff`, attended fallback):** the provider opens the application in the person's ordinary browser and the installed package connects that tab after sign-in. It needs no application session broker, but the browser is visible.

Customer applications never run an MCP server. All modes install only the browser client in the customer app. Local unattended mode is loopback-only and intended to validate the interaction model; production hosted mode still needs a provider-owned answer for acquiring an application session.

The default mode remains the older pairing diagnostic. For the product-shaped local demo, use local unattended mode below. Hosted mode is the production service shape: OAuth for the agent and a short-lived application session. The relay protocol and tools stay the same.

## Run the hidden Summation demo

Install Chromium once, run the local Summation web app, and start the provider service:

```sh
pnpm exec playwright install chromium
export AXE_HOST_APP_URL=http://localhost:5173/login
export AXE_MCP_AGENT_KEY=axd_agent_experience_local
pnpm mcp:unattended-dev
```

The service binds to `http://127.0.0.1:4717/mcp`. It does not start Chromium until the first tool call, and Chromium remains headless. Configure the desktop client with `Authorization: Bearer axd_agent_experience_local`. For Claude Desktop through `mcp-remote`, pass the header value through an environment variable because some desktop releases split arguments containing spaces:

```json
{
  "command": "npx",
  "args": [
    "-y",
    "mcp-remote@latest",
    "http://127.0.0.1:4717/mcp",
    "--allow-http",
    "--header",
    "Authorization:${AXE_AUTH_HEADER}"
  ],
  "env": {
    "AXE_AUTH_HEADER": "Bearer axd_agent_experience_local"
  }
}
```

Ask for a concrete Summation task. The agent starts with `relay_tabs`, then uses the login, organization, and tenant controls reported by `surface_observe` before continuing to the requested data. A password control is sensitive: the agent may set a credential deliberately supplied for this local demo, but must never read, repeat, log, or persist it. Set `AXE_HOST_STATE_PATH` to a private Playwright storage-state file if you prefer to capture login once with `axe host login`.

When a consequential action needs a person's approval, a client with MCP elicitation shows it directly. A client without elicitation receives a one-time loopback `approvalUrl`; the agent must show that ordinary clickable link in chat. The person approves or denies on the small relay-owned page, never in the hidden application browser, and the agent retries the identical call. The local page trusts the one configured loopback identity; a deployed service must identify the person from the provider's authenticated web session.

The Summation package must mount one conditional provider above tenant resolution. An ordinary signed-out tab stays unexposed; an injected hidden session connects on `/login`, `/login/organizations`, and `TenantSwitchModal`, then remains connected into the authenticated app. Because sensitive fields are correctly read-only by default, the local experiment also needs the narrowly scoped `/login** input[type="password"]` editable rule documented in the install prompt; its value remains redacted everywhere. See [`internal/install-surface-in-summation-web-app.md`](../internal/install-surface-in-summation-web-app.md).

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

Set `AXE_MCP_MODE=handoff`, the application's normal URL, the public MCP URL, and the provider OAuth variables documented in [`.env.example`](.env.example). For a laptop-only demo, the loopback-restricted `AXE_HOST_AUTH_MODE=local` alternative below opens the application's own login instead:

```sh
pnpm --filter @axe/mcp-service build
AXE_MCP_MODE=handoff node mcp/dist/index.js
```

The MCP transport initializes anonymously, so merely starting ChatGPT or Claude does not open a browser. When the person asks to use the application, the agent calls `relay_tabs`. Its first `needs_human` handoff opens a contextual Agent Experience page explaining the connection; only the person's **Continue to Summation** action starts provider OAuth. The OAuth callback binds that account to the requesting MCP session and redirects through a short-lived `/connect/<token>` page to `AXE_HOST_APP_URL`. After any normal application sign-in redirect, `@axe/relay/client` exchanges the handoff directly with this service and connects the page-held Surface.

The token is not an application credential, never enters the application URL, and can be exchanged only once from the configured application origin. The application adds no API route. Keep `/connect/*` out of access logs, terminate TLS at the public endpoint, and use shared handoff state or sticky routing before adding multiple service instances.

## Run the production unattended browser host

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

Run Summation's web app at `http://localhost:5173`. The laptop-only handoff mode opens that app's own local `/login` page, so it uses the local accounts and data without staging OAuth, a local sum-api change, or another backend integration. Then export:

```sh
export AXE_HOST_APP_URL=http://localhost:5173/login
export AXE_HOST_PUBLIC_MCP_URL=http://127.0.0.1:4717/mcp
export AXE_HOST_AUTH_MODE=local
export HOST=127.0.0.1
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

Restarting Claude should not open any browser page. In a fresh conversation, ask Claude to use Summation. Its first `relay_tabs` call offers the local Summation page through the relay handoff. Sign in with the local app's credentials there, never in chat; the installed package connects that signed-in tab automatically. There is no startup login, staging account, pairing code, bearer key, local sum-api change, new sum-api route, or credential entered into chat. `AXE_HOST_AUTH_MODE=local` is deliberately refused unless the service, MCP URL, and app URL are all loopback; use OAuth for any deployed endpoint.

## ChatGPT plugin

[`plugins/agent-experience`](../plugins/agent-experience/README.md) packages the hosted MCP endpoint with agent instructions. Configure it with the deployed HTTPS URL, test it in ChatGPT developer mode, then submit it to the universal plugin directory. A consumer installs the named plugin once; account connection is requested contextually only after they ask to use a supported application. They never configure an MCP server or learn what MCP is.
