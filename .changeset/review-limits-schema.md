---
"@axe/core": minor
"@axe/client": minor
"@axe/express": patch
"@axe/next": patch
"@axe/generate": patch
"@axe/testing": minor
---

Bound request bodies (`maxBodyBytes`, 413 `payload_too_large`), nesting, and in-memory store retention (`maxEntries`, `sweepIntervalMs`, `sweep()`, `close()`, `SqliteIdempotencyStore.prune`); make the JSON Schema validator fail closed on what it cannot apply and mark refined Zod nodes `x-axe-refined`; fingerprint `input` as sent; add client timeouts, signals, response limits, polling budgets, and document checks; name every constraint `@axe/generate` drops.
