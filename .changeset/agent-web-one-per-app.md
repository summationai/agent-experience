---
"@summationai/axe": patch
"@summationai/axe-core": patch
"@summationai/axe-host": patch
---

Two applications on one machine no longer cross wires. The site's pass-through proves itself to the agent web with the shared secret, and the agent web refuses another site's secret ("This agent web serves a different site"), instead of showing that site's agent this one's pages and sign-in links. `axe surface init --agent-web` writes the first agent web port from 4719 that no other application in the repository claims and nothing listens on, and says which.
