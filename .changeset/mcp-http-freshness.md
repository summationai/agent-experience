---
"@axe/mcp": minor
"@axe/client": minor
"@axe/core": minor
---

MCP over HTTP serves many clients (a server and transport per request or per session, principal-bound sessions, idle expiry, DELETE), authenticates each request as an OAuth resource server, and gives every tool call its caller's own AXE identity (`clientFor`). Remote manifests refresh within a bound (`AXEClient.refresh`, `manifestMaxAgeMs`, ETag revalidation) and notify MCP sessions when tools change. Mutating MCP tools take an optional `idempotencyKey` for safe retries.
