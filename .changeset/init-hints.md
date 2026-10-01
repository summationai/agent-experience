---
"@summationai/axe": patch
---

`axe surface init` prints the GitHub Packages and tarball install hints only when the @summationai scope is not already mapped to a registry (`.npmrc` or `npmScopes` in `.yarnrc.yml`, here or above), and a dry run says the agent web settings will be added when init applies, not that they were added.
