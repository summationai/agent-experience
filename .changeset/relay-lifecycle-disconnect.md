---
"@summationai/axe-relay": minor
"axe": patch
---

Add `RelayConnection.disconnect()` for component and route cleanup without revoking the tab. Generated React integrations now reserve `stop()` for an explicit decision to end agent access, preventing ordinary unmounts and React development remounts from permanently stopping hidden sessions. Rerunning `axe surface init` safely migrates the obsolete generated cleanup call without overwriting application edits.
