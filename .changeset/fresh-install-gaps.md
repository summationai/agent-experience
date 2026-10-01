---
"@summationai/axe": patch
"@summationai/axe-core": patch
---

From a fresh agent's install of the admin app: the README and the CLI's README lead with `surface init --agent-web` and say what a coding agent does when its permissions refuse `npx` (ask the person to run one command, rather than rebuild the generated files). The generated `agentEntry` call waits for `AXE_AGENT_WEB_SECRET`, and `agentSiteHandler` without a secret has no pages, so an app with the integration but no agent web set up answers as before (no redirect, `/agent` a 404). The prompt's sign-in return path expires after ten minutes, notes the yarn age gate, and lists the navigation Surface already reads, so integrators do not add rules for it.
