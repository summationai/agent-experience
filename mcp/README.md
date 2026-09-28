# Agent Experience provider service

This directory is the provider-operated Node service. Customer applications install only the browser packages; they do not run an MCP server.

The service follows the repository’s [application/provider boundary](../docs/architecture.md): the connector registry owns trusted bootstrap and security configuration, each running application describes its live behavior through Surface, and the MCP runtime contains no application-specific workflow.

## Modes

- `hosted`: production unattended mode. One public MCP endpoint searches and selects registered applications, then runs the selected application in an identity-isolated hidden browser.
- `local-unattended`: loopback development version of the hidden-browser flow.
- `handoff`: attended fallback that opens the application in the person’s browser after a contextual login handoff.
- default: older loopback attended/pairing diagnostic.

Hosted mode exposes generic `apps_search` and `app_connect` tools beside `relay_tabs`, `surface_read`, `surface_observe`, `surface_wait`, and the Surface action tools. A registry with one connector selects it automatically, so existing prompts can begin with `relay_tabs`.

## Connector registry

A connector contains only trusted facts needed before a page exists:

```json
{
  "default": "example-app",
  "connectors": [
    {
      "id": "example-app",
      "displayName": "Example App",
      "aliases": ["example"],
      "description": "A factual description used for application discovery.",
      "appUrl": "https://app.example.com/",
      "startPath": "/",
      "allowedOrigins": ["https://app.example.com", "https://login.example.com"],
      "surfaceId": "example-app",
      "identity": {
        "principalClaim": "sub",
        "contextClaim": "org"
      },
      "session": { "strategy": "none" }
    }
  ]
}
```

Set `AXE_CONNECTORS_FILE` to this JSON file. Secrets are referenced by environment-variable name and stay outside the registry. Connector ids and aliases must be unique. `surfaceId` must match the application’s `SurfaceProfile.id`; a conflicting live profile is refused.

For a one-application deployment, the existing `AXE_HOST_APP_URL`, `AXE_HOST_SESSION_BROKER_*`, and claim variables are converted into an in-memory connector. Name it with:

```sh
AXE_CONNECTOR_ID=example-app
AXE_CONNECTOR_NAME="Example App"
AXE_CONNECTOR_ALIASES=example
AXE_CONNECTOR_SURFACE_ID=example-app
```

Application controls, routes, login fields, account/workspace choices, tables, reports, risks, and approval rules never belong in this registry or in MCP instructions. The application reports them through Surface.

`session.strategy: "none"` is the zero-backend default: the browser starts at `appUrl`, Surface reports `signed-out`, and the provider's secure human-session page handles login. A connector may instead use `strategy: "broker"` with `brokerUrl`, `brokerAuth`, and (for service auth) `brokerTokenEnv` to start silently with a short-lived application session.

## Production hosted service

Configure the provider-wide MCP authentication boundary and either a connector file or the single-connector variables in [`.env.example`](.env.example), then build and run:

```sh
pnpm --filter @axe/mcp-service build
AXE_MCP_MODE=hosted node mcp/dist/index.js
```

The public HTTPS URL must end in `/mcp`. It is the OAuth resource identifier, the audience validated by token introspection, and the endpoint packaged into the consumer plugin.

OAuth verification is provider-wide. Configure RFC 7662 introspection with `AXE_HOST_OAUTH_INTROSPECTION_URL` and client credentials, or an authenticated JSON identity endpoint with `AXE_HOST_OAUTH_USERINFO_URL`.

The secure human-session page authenticates its browser separately because ordinary URL navigation does not carry the MCP bearer token. It uses OAuth authorization code with PKCE against the same authorization server, then checks that identity against the principal and context bound to the hosted session. Dynamic client registration is the default; when the authorization server does not support it, set `AXE_HOST_BROWSER_OAUTH_CLIENT_ID` to a pre-registered public client whose redirect URI is `<provider-origin>/human-auth/callback`.

An optional broker connector receives:

```json
{
  "principal": "verified-user-id",
  "tenant": "verified-application-context",
  "scopes": ["surface:read", "surface:act"]
}
```

It returns `cookies`, `headers`, `localStorage`, or an inline Playwright `storageState`. With service authentication the configured provider credential is used; with caller authentication the already verified OAuth bearer is forwarded. The broker must authorize from its authenticated caller, issue a short-lived session, and treat the body’s identity values as advisory.

When the identity is valid but the application account is not connected, the broker may return `401` or `403` with:

```json
{
  "loginUrl": "https://app.example.com/agent-login?request=opaque-single-use-value",
  "instructions": "Sign in to the application in this window.",
  "whatAgentShouldSayToUser": "Please connect your application account so I can continue.",
  "expiresAt": "2026-09-28T17:30:00.000Z"
}
```

The service converts that response into an `application_login_required` handoff and resumes the original call after sign-in. Passwords never cross MCP or the model.

Install Chromium in the service image with `npx playwright install chromium --with-deps`. Browser and MCP sessions are in memory; use sticky routing or shared session routing before scaling horizontally.

## Local hidden-browser test

Run any integrated application on loopback and start:

```sh
pnpm exec playwright install chromium
export AXE_CONNECTOR_ID=example-app
export AXE_CONNECTOR_NAME="Example App"
export AXE_CONNECTOR_SURFACE_ID=example-app
export AXE_HOST_APP_URL=http://localhost:5173/login
export AXE_MCP_AGENT_KEY=axd_agent_experience_local
pnpm mcp:unattended-dev
```

Connect the desktop client to `http://127.0.0.1:4717/mcp` with `Authorization: Bearer axd_agent_experience_local`. Chromium starts lazily on the first `relay_tabs` call and remains private. If the Surface reports `authentication.state: "signed-out"`, that call returns a secure loopback URL showing the exact private browser session so the person can complete the application's normal login. Credentials never pass through the model or MCP. After the page reports completion, `axe_resume` continues the original call. Account/workspace selection remains normal Surface state and controls.

The agent must present any returned approval link to the person and retry the identical Surface call after the decision. It must not open or approve the link itself.

## Attended handoff and pairing diagnostics

`AXE_MCP_MODE=handoff` opens an application page through a contextual, no-pairing handoff. `AXE_HOST_AUTH_MODE=local` is restricted to loopback and is useful for local accounts; deployed handoff mode requires OAuth.

The default `pnpm mcp:dev` mode deliberately keeps the older pairing flow for protocol diagnostics. It is loopback-only and not a product deployment.

## Consumer plugin

[`plugins/agent-experience`](../plugins/agent-experience/README.md) points agent clients at one stable hosted `/mcp` endpoint. Account connection begins only after a relevant request. End users never configure an MCP server or pairing code.
