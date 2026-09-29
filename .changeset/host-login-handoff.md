---
"@summationai/axe-host": minor
"@summationai/axe-core": patch
---

Let an application session exchange hand sign-in to the person with `SessionLoginRequired`. Hosted MCP sessions now return an identity-bound, expiring application login handoff and replay the original tool call after `axe_resume`, without sending passwords through the agent or MCP service.
