---
"@summationai/axe-core": minor
"@summationai/axe-host": minor
"@summationai/axe": patch
---

The agent web's pages are answered from the site's own origin. `agentSiteHandler` without `agentUrl` (the new default) passes `/agent`, `/agent/start`, and `/agent/s/...` through to the service, and `axe host --agent-web` writes its links for `<site>/agent`, so an agent never follows a link to another origin: an agent's safeguards flagged the jump from the site to the service as a possible exfiltration, and a person reading the link sees only the site's address. The service stays on loopback, and local development with a tunnel needs one tunnel, for the site. Setting `agentUrl` keeps the redirect to the service's own origin. `axe surface init` reads the dev port from the app's `dev` script.
