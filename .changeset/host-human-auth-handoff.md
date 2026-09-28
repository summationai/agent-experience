---
"@axe/host": minor
"@axe/relay": minor
---

Add a provider-owned, session-bound human authentication view for unattended browsers. A Surface
that reports `signed-out` now pauses the original tool request, lets the verified person interact
with that exact private browser context without putting credentials in MCP, and resumes once a
fresh Surface observation reports `signed-in`. Provider deployments authenticate the handoff page
through OAuth; loopback development uses its configured local identity.

Render native, aligned inputs over visible application fields so people type directly into the
sign-in form and use its buttons and scrolling normally, without a separate remote-control toolbar.
On successful sign-in, replace the remote page with a completion state, focus its opener when
available, and close the handoff window automatically when the browser permits it.

Add `Relay.refresh` so hosts can verify fresh profile state across sign-in navigations.
