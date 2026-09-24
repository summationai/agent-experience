---
"@axe/core": minor
"@axe/testing": minor
---

Token uses are authorized by tenant and principal; site-key principals are resolved the same way on every endpoint; polls are authorized before returning results; `IdempotencyStore` becomes an atomic operation-claim store (breaking) with `SqliteIdempotencyStore` in `@axe/core/node`. See docs/deploying.md, "Migrating a store".
