# 7. Site-key principals resolved consistently

## Finding

The review: the initial action bound tokens to `site:<id>`, but continue, resume, and poll resolved only user identity, so a continuation obtained with a valid site key failed `not_found` when continued with the same key. A verdict of `true` (or an object without `id`) produced no site principal at all.

Reproduced at 3dd4ed3 with the review script (`site-auth continuation`): `{"status":"error","error":{"code":"not_found",...}}`. Code reading: follow-ups passed `siteKey: null` to hooks; a `true` verdict left the principal `null`, so every `true` key shared the anonymous scope for tokens and idempotency keys; a `site:x` principal string could collide with a user whose id was `site:x`; a revoked key was never re-checked on follow-ups.

## Change

- `packages/core/src/server.ts`: `verifySite(request, action)` is the one site-key check for invoke, continue, resume, poll, `/axe/state`, and the unknown-action replay. It returns `missing`, `invalid`, `forbidden` (allowlist), or a `SiteKeyContext`.
- `SiteKeyContext` (`packages/core/src/principal.ts`, exported from `@axe/core`): `{ id, actions?, derived? }`. `id` is the verdict's `id`, or `key-` + HMAC-SHA256 of the presented key under the server `secret` when the verdict has none (`derived: true`). The raw key is never stored.
- Principal for a `site` action: the site id plus the user when `authenticate` also returns one; every follow-up must match both (item 1's authorizeToken). Follow-ups re-verify the key and check the allowlist against the token's action, so a revoked or narrowed key gets `not_found`.
- Handlers: `siteKey` is now non-null for every `site` call and its follow-ups (`onContinue`, `onResume`, `onPoll`); availability hooks receive `siteKey` (`AvailabilityContext.siteKey`, optional); the revision provider receives `identity` and `siteKey` (`RevisionContext`, optional), for the Surface authorization work (item 5).
- Spec: [P-TOK-7]; [P-AUTH-2] cross-reference.
- Docs: `docs/auth.md` (site mode rewritten), `docs/examples/auth/site-keys.ts` (reads `siteKey.id` instead of re-deriving the partner). DECISIONS: "A site key without an id is scoped by a keyed hash of the key".

## Tests

`packages/core/test/token-binding.test.ts`; all fail on 3dd4ed3 except the last, which guards behavior that already worked:

- "a workflow started with a site key continues with the same key and the handler sees its id"
- "another partner, a revoked key, a narrowed key, or no key gets the unknown-token response"
- "keys verified as `true` or without an id are scoped by a keyed hash, never shared, never stored raw" (also: one `idempotencyKey` from two `true` keys is two operations)
- "a site key with a forwarded user binds both: the same key with another user, or without the user, is refused"
- "a resume token obtained with one site key is not_found with another key, open or consumed"
- "availability hooks and the revision provider see the resolved site principal"
- "a disallowed action is forbidden and a revoked key unauthorized on invoke [P-AUTH-2]" (guard; passes on 3dd4ed3 too)

## Limitations

- A derived id changes when the key or the `secret` rotates; that key's open tokens and idempotency records are orphaned. Return an `id` from `verifySiteKey` to avoid it.
- `verifySiteKey` runs on every follow-up and, for `/axe/state`, once per `site` action that declares availability; cache inside it if it is expensive.
- If `authenticate` treats an API key as a user token, every `site` call carries the key as a user too. Documented; the SDK cannot tell the two apart.

## Status

done
