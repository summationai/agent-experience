---
"@summationai/axe": patch
---

`axe surface init` finds a taken agent web port by binding it, so a sandbox that refuses network connections no longer makes a busy port look free (a third fresh install got 4719, the web app's agent web, although a dry run had chosen 4721). Install hints name the CLI's own version instead of 1.0.0, and the CLI's README says it is part of the Body Spray SDK.
