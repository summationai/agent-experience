# ChatGPT consumer path

The seamless path for a nontechnical person is an ordinary public ChatGPT plugin backed by the provider-operated Agent Experience service. “No MCP setup” and “no visible browser automation” are achievable for the user; “no MCP transport” is not, because ChatGPT needs a registered, authenticated way to call code outside the conversation.

The product should never ask the user to understand that distinction. Its language is: **Install Agent Experience**, then, only when their request needs it, **Connect to Acme Analytics** (using the application's actual name).

## What happens

1. The application developer installs `@axe/surface` and the browser-only part of `@axe/relay`, mounts `SurfaceProvider`, and enables the injected-host path. Their application does not run or deploy MCP.
2. The provider deploys [`mcp/`](../mcp/README.md) at one stable public HTTPS `/mcp` URL and publishes [`plugins/agent-experience`](../plugins/agent-experience/README.md) against it.
3. The person installs the plugin from ChatGPT's directory. MCP initialization is anonymous and silent; opening ChatGPT does not start OAuth or open a browser.
4. After the person asks to use an application, the plugin searches the trusted connector registry, selects the match, and calls `relay_tabs`. The provider authenticates the agent identity and starts or resumes an isolated hidden session for that connector.
5. The provider uses a short-lived application session when a connector has one. Otherwise it starts the application signed out; the Surface reports that state and the provider offers a secure, session-bound view of the exact private browser for the person to complete the application's existing login. No application backend change is required.
6. The host injects an identity-bound relay before application code runs. The root-mounted Surface stays connected on login, organization selection, tenant selection, and authenticated routes. The visible session page closes after the exceptional human step; ordinary agent work remains inside ChatGPT.
7. The model calls `surface_read` and `surface_observe`, advances any chooser, and completes the task with Surface tools. Consequential controls use ChatGPT's approval flow.

```text
ChatGPT on phone
  └─ installed Agent Experience plugin (silent until a relevant request)
       └─ provider HTTPS /mcp
            ├─ provider identity + application-session exchange
            └─ isolated hidden application browser
                 └─ installed package + page-held Surface
```

The page remains authoritative for its live profile, authentication and context state, controls, revisions, handlers, and ledger. The provider registry owns trusted discovery and bootstrap facts: application URL, allowed origins, identity mapping, and session strategy. The generic MCP runtime owns transport, agent identity, routing, and hidden-browser lifetime; it contains no application workflows or selectors. The application keeps its existing login and user authorization unchanged.

> The provider registry says where an application is and how it may be connected securely. The application's Surface says what the application currently is and what the agent can do there. The MCP contains no application-specific behavior.

## The application contract

The developer installs the browser packages, mounts the generated Surface provider above authentication and context resolution, and connects its profile to the application's existing auth state. That remains the complete application integration boundary: there is no application MCP server, customer-operated relay, auth callback, session broker, or remote-browser service. A connector may add a provider-owned session broker later to make sign-in silent, but it is an optimization rather than a prerequisite.

The injected relay token is a capability from the provider host, not an application credential. It is bound to the authenticated agent identity and tenant, expires quickly, and reaches only the Surface in that isolated browser. It grants no direct application API access.

Credentials are entered only on the application's page inside the provider's secure session view, or through a provider-owned account connection. They are never requested in model-visible chat or set through an agent Surface action.

## What the user must still approve

The website cannot silently enroll itself in a person's ChatGPT account. Plugin installation and OAuth consent are platform trust decisions, just like installing an app and signing in. After public distribution, those are taps in normal ChatGPT UI—not developer mode, a URL, a secret, or a server configuration.

Use a clear “Use in ChatGPT” entry point from the product after publication, but do not imply that opening the website alone grants ChatGPT access. Enterprise administrators may also control plugin availability.

## Fallbacks

- Development pairing remains a diagnostic-only local loop. `local-unattended` validates the hidden-browser interaction shape without claiming a production identity boundary.
- Browser-native WebMCP can remove the remote transport when the agent actually runs in a compatible browser host. It does not currently provide a general ChatGPT iOS path to another app's authenticated session.
- The secure session-bound browser handoff is available when no provider-owned application session exists. It is visible only for the human-only authentication step; the agent's actual task remains unattended. The older attended relay remains diagnostic-only.

## Operational boundary

Hosted browser sessions and relay records are currently process memory. Keep the service behind TLS, apply origin checks and rate limits, and use sticky routing or shared state before running multiple instances. Revoking the OAuth grant ends new agent access; the person can stop a hosted session through the agent approval/UI boundary.
