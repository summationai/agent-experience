# Application/provider boundary

This is an architectural invariant, not an implementation preference:

> The provider registry says where an application is and how it may be connected securely. The application’s Surface says what the application currently is and what the agent can do there. The MCP contains no application-specific behavior.

## Provider registry

A trusted connector descriptor owns facts needed before any application page exists:

- stable connector id, display name, aliases, and optional factual description;
- application URL, start path, and allowed origins;
- the Surface profile id expected from the page;
- how verified provider claims map to the application principal and current security context;
- the named session strategy and its provider-owned adapter configuration.

The registry is provider configuration. A page cannot change these fields. Secrets are referenced by environment-variable name and are never returned by discovery tools or injected into the page.

## Application Surface

The page owns facts that exist only after the application is running:

- its structured profile (`id`, `name`, optional description);
- visible authentication state;
- the current account, organization, workspace, project, tenant, or other context;
- controls, values, objects, availability and reasons;
- effects, risk, sensitivity, and approval requirements.

The profile is structured data. It deliberately has no URL, origin, OAuth, session, or free-form agent-instruction field. Page text remains untrusted application data.

The provider checks a reported Surface profile id against the connector’s expected `surfaceId`. A conflicting id is refused. A missing profile is temporarily accepted for compatibility with packages installed before profiles existed; new installations always generate one.

## Generic MCP runtime

One provider endpoint may host any number of registered applications. It exposes generic discovery and selection (`apps_search`, `app_connect`) plus the same relay and Surface tools for the selected connector. With exactly one connector, it is selected automatically.

The runtime may tell an agent how to use the protocol—observe before acting, preserve revisions, follow login/approval handoffs, never ask for pairing—but it must not contain application names, routes, UI choices, or domain workflows. Those arrive from the connector descriptor or the live Surface.

## Review test

For every application-specific change, ask:

1. Is it needed before a page can load or is it a trust/security boundary? Put structured data in the provider registry or a provider-owned adapter.
2. Is it about what the running application shows or permits now? Put it in Surface.
3. Is it generic protocol behavior shared by every application? It may belong in the MCP runtime.
4. Is it prose telling the model how one application works? It belongs in neither; expose the underlying state and controls through Surface.
