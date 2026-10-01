---
"@summationai/axe": patch
"@summationai/axe-relay": patch
---

Every CLI command the docs, the integration prompt, and the CLIs' own hints give is `npx @summationai/axe@latest …`. npx reuses a cached copy of an unversioned package, so a developer who ran `npx @summationai/axe` once kept running that CLI after later releases; a fresh install of the admin app ran a cached build from earlier the same day and generated an older integration.
