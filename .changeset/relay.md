---
"@summationai/axe-relay": minor
"axe": minor
"@summationai/axe-core": patch
---

`@summationai/axe-relay`, the SDK's broker between a signed-in person's live tab and an agent outside the browser: `connectRelay` in the page (indicator, Stop, approvals, renewal, reconnect, `rekey`), `createRelay` on the server (a mirror per tab served through `domainActions` and `@summationai/axe-mcp` over HTTP with OAuth or stdio), and HS256 relay tokens (`mintRelayToken`, `verifyRelayToken`). `axe relay --dev` runs a development relay with pairing codes. `@summationai/axe-core`'s vocabulary gains the relay names.
