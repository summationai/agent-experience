# ChatGPT consumer path

The seamless path for a nontechnical person is an ordinary public ChatGPT plugin backed by the provider-operated Agent Experience service. “No MCP setup” is achievable for the user; “no MCP transport” is not, because ChatGPT needs a registered, authenticated way to call code outside the conversation.

The product should never ask the user to understand that distinction. Its language is: **Install Agent Experience**, then **Connect your account**.

## What happens

1. The application developer installs `@axe/surface` and the browser-only part of `@axe/relay`, mounts `SurfaceProvider`, and enables the injected-host path. Their application does not run or deploy MCP.
2. The provider deploys [`mcp/`](../mcp/README.md) at one stable public HTTPS `/mcp` URL and publishes [`plugins/agent-experience`](../plugins/agent-experience/README.md) against it.
3. The person installs the plugin from ChatGPT's directory. On first use, ChatGPT discovers the service's OAuth metadata and asks the person to connect their account.
4. A tool call reaches the provider service with that person's access token. The service verifies it and maps its claims to one principal and tenant. When no application tab is connected, `relay_tabs` returns an identity-bound, short-lived handoff URL.
5. ChatGPT's URL flow opens the handoff. The relay places a one-time bootstrap in the new tab's `window.name` and redirects to the application's ordinary page. The person signs in there if necessary; the browser never sends the bootstrap to the application server.
6. The already-installed `@axe/relay/client` consumes the bootstrap, exchanges it directly with the provider relay, and connects the page-held Surface. No pairing code or customer backend endpoint is involved.
7. The plugin instructions make the model call `surface_read` and `surface_observe`, then act with Surface tools. Consequential controls use the page or ChatGPT approval flow.

```text
ChatGPT on phone
  └─ installed Agent Experience plugin + OAuth consent
       └─ provider HTTPS /mcp
            ├─ verify access token
            ├─ issue identity-bound one-time browser handoff
            └─ signed-in application tab
                 └─ installed package + page-held Surface
```

The page remains authoritative for live controls, revisions, handlers, and its ledger. The provider owns transport, OAuth verification, the one-time handoff, and relay-session lifetime. The application keeps its existing login and user authorization unchanged.

## The application contract

The developer installs the browser packages and mounts the generated Surface provider. That is the whole integration boundary: there is no application MCP server, relay-token endpoint, browser-session broker, OAuth-token exchange, or shared secret.

The handoff is a capability from the provider relay, not an application credential. It is bound to the authenticated agent identity, expires quickly, is consumed once, and is transferred through `window.name` so it does not enter application URLs, request logs, or referrers. Its exchange succeeds only from the configured application origin. The resulting relay token reaches only the Surface in that tab and grants no direct application API access.

The person enters credentials only on the application's normal page. The provider and model never receive them.

## What the user must still approve

The website cannot silently enroll itself in a person's ChatGPT account. Plugin installation and OAuth consent are platform trust decisions, just like installing an app and signing in. After public distribution, those are taps in normal ChatGPT UI—not developer mode, a URL, a secret, or a server configuration.

Use a clear “Use in ChatGPT” entry point from the product after publication, but do not imply that opening the website alone grants ChatGPT access. Enterprise administrators may also control plugin availability.

## Fallbacks

- Development pairing remains a diagnostic-only local loop. Production browser handoff replaces the code with the client-opened, identity-bound link.
- Browser-native WebMCP can remove the remote transport when the agent actually runs in a compatible browser host. It does not currently provide a general ChatGPT iOS path to another app's authenticated session.
- The optional `@axe/host` path can still run a cloud browser for applications that deliberately provide a session broker. It is not the default installation contract.

## Operational boundary

Handoffs and relay records are currently process memory. Keep the service behind TLS, apply origin checks and rate limits, avoid request-path logging for `/connect/*`, and use sticky routing or shared state before running multiple instances. Revoking the OAuth grant ends new agent access; the person can end a connected tab with Stop or by closing it.
