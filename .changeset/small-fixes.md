---
"@summationai/axe": patch
"@summationai/axe-surface": patch
---

`SurfaceProfile` and `SurfaceProfileSource` are exported from `@summationai/axe-surface/auto`, where a generated `surface.config` already imports `SurfaceConfig`. `axe surface init`'s next steps report the profile and `agent-site.server` as done once the integrator has wired them, instead of repeating the instructions.
