# 4. Terminal poll results authorized before return

## Finding

The review: pollEndpoint returned `record.terminal` before authenticating, so a user-authenticated operation's private result was readable anonymously by anyone with the poll URL.

Reproduced at 3dd4ed3 with the review script (`anonymous terminal poll`): `{"status":"ok","output":{"value":"private result"}}` for an anonymous GET after alice's poll completed. Code reading: the same early return skipped the tenant check (there was none) and served terminal results of removed actions to anyone.

## Change

- `packages/core/src/server.ts` pollEndpoint: loadToken (signature, binding, serving tenant), then authorizeToken (principal, with the site key re-verified), then the operation claim and any stored terminal result, then the action lookup. A refused poll gets `unknownToken("poll")`, identical to an unknown token.
- The terminal result moved from `TokenRecord.terminal` to the operation claim `~poll|<tenant>|<id>` in the `IdempotencyStore` (item 2), so concurrent polls run `onPoll` once and later polls replay the stored result after authorization.
- `onPoll` receives `identity`, `siteKey`, and `operationId`; the hook context carries the caller's `onBehalfOf`.
- Spec: [P-POLL-1] (authorization before any result, removed actions included) and [P-POLL-2] (one `onPoll` at a time, first terminal result stored).
- Docs: `docs/security.md` (mitigation table), `docs/auth.md`.

## Tests

In `packages/core/test/token-binding.test.ts` and `operations.test.ts`; all fail on 3dd4ed3 and pass now:

- "a user-authenticated terminal result is not returned anonymously or to another user" (also checks `onPoll` did not run for the refused poll, and the body carries no private data).
- "a site-authenticated terminal result needs the same site key" (no key, another partner's key, a revoked key).
- "the terminal result of an action that has since been removed is still authorized" (provider removes the action after completion).
- "a poll token minted on tenant A is not_found on tenant B, pending and terminal".
- "concurrent polls run onPoll once; the other poll is pending; both then see one terminal result".

## Limitations

- A custom `pollUrl` returned from `pending({ pollUrl })` is the site's own endpoint; the SDK does not authorize it.
- Poll tokens minted anonymously remain bearer URLs.
- No conformance check: a conformance run rarely reaches a `pending` result, so [P-POLL-1] is covered by named tests.

## Status

done
