# ChatGPT consumer path

The seamless path for a nontechnical person is an ordinary public ChatGPT plugin backed by the provider-operated Agent Experience service. “No MCP setup” is achievable for the user; “no MCP transport” is not, because ChatGPT needs a registered, authenticated way to call code outside the conversation.

The product should never ask the user to understand that distinction. Its language is: **Install Agent Experience**, then **Connect your account**.

## What happens

1. The application developer installs `@axe/surface` and the browser-only part of `@axe/relay`, mounts `SurfaceProvider`, and enables the injected-host path. Their application does not run or deploy MCP.
2. The provider deploys [`mcp/`](../mcp/README.md) at one stable public HTTPS `/mcp` URL and publishes [`plugins/agent-experience`](../plugins/agent-experience/README.md) against it.
3. The person installs the plugin from ChatGPT's directory. On first use, ChatGPT discovers the service's OAuth metadata and asks the person to connect their account.
4. A tool call reaches the provider service with that person's access token. The service verifies it, maps its claims to one principal and tenant, and asks the integrated application's session broker for a short-lived app session.
5. `@axe/host` starts one isolated browser context for that identity, opens the real application, and injects its private relay before the page loads. The already-installed Surface package registers the application's controls.
6. The plugin instructions make the model call `relay_tabs`, `surface_read`, and `surface_observe`, then act with Surface tools. Consequential controls use ChatGPT's approval/elicitation UI. The person never needs an open browser tab or pairing code.

```text
ChatGPT on phone
  └─ installed Agent Experience plugin + OAuth consent
       └─ provider HTTPS /mcp
            ├─ verify access token
            ├─ exchange identity → short-lived app session
            └─ isolated hosted browser
                 └─ application page + package-held Surface
```

The page remains authoritative for live controls, revisions, handlers, and its ledger. The provider owns transport, OAuth verification, browser isolation, and session lifetime. The application owns user authorization and the short-lived application credential.

## The one additional application contract

A remote browser cannot inherit cookies from Safari on the user's phone. The integrated application must therefore expose a private session-broker endpoint to the provider, or offer an equivalent identity-provider token exchange. This is the unavoidable difference between controlling an already open tab and running unattended.

The broker receives an authenticated provider request containing only the verified `principal`, `tenant`, and scopes. It returns a short-lived cookie, scoped header, or storage state accepted by the application. It never receives the ChatGPT/MCP access token, and it may refuse any identity or scope. See the exact request and response in [`mcp/README.md`](../mcp/README.md#run-the-hosted-service).

This keeps the install burden where it belongs: one small backend integration for the developer who adopts the package, not MCP setup for every end user.

## What the user must still approve

The website cannot silently enroll itself in a person's ChatGPT account. Plugin installation and OAuth consent are platform trust decisions, just like installing an app and signing in. After public distribution, those are taps in normal ChatGPT UI—not developer mode, a URL, a secret, or a server configuration.

Use a clear “Use in ChatGPT” entry point from the product after publication, but do not imply that opening the website alone grants ChatGPT access. Enterprise administrators may also control plugin availability.

## Fallbacks

- The attended relay remains the best local development loop and an option for expert desktop use. It proves the page Surface without production identity work.
- Browser-native WebMCP can remove the remote transport when the agent actually runs in a compatible browser host. It does not currently provide a general ChatGPT iOS path to another app's authenticated session.
- Generic cloud browser automation can open public pages, but it does not guarantee Surface discovery, authenticated state, approval semantics, or the structured tool contract.

## Operational boundary

Hosted browser and MCP sessions are currently process memory. Run Chromium in a sandboxed service, cap sessions and idle time, apply egress controls, keep session credentials out of logs, and route a person's requests to the process that owns their session. Revoking the OAuth grant ends agent access; short-lived application sessions limit the remaining credential window.
