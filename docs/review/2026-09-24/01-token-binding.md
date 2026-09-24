# 1. Tenant and principal binding for every token endpoint

## Finding

The review: loadToken compared the token's signed binding with the stored record but never with the request. A continuation minted under tenant A ran under tenant B and received B in its handler context; resume, poll, completed-result replay, and handoff completion were to be checked for the same boundary.

Reproduced at 3dd4ed3 with the review script (`cross tenant continuation`): `{"status":"ok","output":{"value":"B"}}`. Code reading confirmed the same gap on `/axe/resume` and poll (no tenant check at all), that a token minted anonymously could be continued by any signed-in caller (the principal check was skipped when the record had no user), that principal mismatches returned a different `not_found` message than unknown tokens, and that `completeHandoff` took any handoff id with no tenant or user check.

## Change

- `packages/core/src/tokens.ts`: `loadToken(signer, store, token, type, tenant)` rejects a token whose signed tenant is not the serving tenant; every failure is one `{ kind: "invalid" }`. `TokenRecord.onBehalfOf` became `principal`; consumedAt and `terminal` were removed (single use lives in the idempotency store, see item 2).
- `packages/core/src/principal.ts` (new): principalOf / parsePrincipal, one encoding (`site:<id>`, `user:<id>`, or both) for tokens, idempotency keys, and claims.
- `packages/core/src/server.ts`: `authorizeToken(record, request, adapter)` is the one check for continue, resume, and poll. It re-resolves the principal from the request (re-verifying a site key) and requires an exact match, including "none" for a token minted anonymously. It runs before any hook, any claim lookup, and any stored-result replay. All refusals use `unknownToken(type)`, byte-identical to an unknown token.
- The login handoff is the one identity transition: the resume must come from an anonymous caller or from the user recorded by `completeHandoff`; any other principal gets `not_found`.
- `completeHandoff(id, { onBehalfOf?, data?, tenant? })` returns `false` for another tenant's handoff, an expired or used one, a different user on a user-bound handoff, and a second user on a login handoff.
- Spec: [P-TOK-2] and [P-TOK-3] amended, [P-TOK-6] added, [P-AUTH-2] cross-reference; §19 updated.
- Docs: `docs/auth.md`, `docs/security.md`, `docs/human-handoff.md`, `docs/requirements-and-kinds.md`, `docs/concepts.md`. DECISIONS: "One principal encoding for every scope", "Every token refusal is the unknown-token `not_found`".
- Migration: `TokenRecord.onBehalfOf` → `principal`; tokens minted before the upgrade return `not_found` (docs/deploying.md, "Migrating a store"). `completeHandoff` callers on a multi-tenant server must pass `tenant`.

## Tests

`packages/core/test/token-binding.test.ts`; every test below fails on 3dd4ed3 (checked by restoring `packages/core/src` from 3dd4ed3) and passes now:

- tenant binding, with the local user id `alice` on both tenants: "a continuation minted on tenant A is not_found on tenant B for the same local user id, and nothing runs"; "a resume token minted on tenant A is not_found on tenant B, before and after use"; "a poll token minted on tenant A is not_found on tenant B, pending and terminal"; "completeHandoff refuses a handoff minted for another tenant".
- principal binding: "wrong user and anonymous presentations get exactly the unknown-token response, and nothing runs" (also after use); "a token minted anonymously is not usable by a signed-in caller"; "the login handoff is the one identity transition"; "completeHandoff refuses a different user on a handoff bound to a user".
- Each refusal is compared with toEqual against the response to a garbage token (status and body), so the refusals are non-enumerating by assertion.
- Conformance: new `ladder.token-principal` (with `--auth`, the continuation token presented without the credential must be `not_found`; side-effect free because it offers a kind that is not accepted).

## Limitations

- A token minted anonymously is a bearer credential. After use, whoever holds it and the exact payload can read the stored envelope (the lost-response recovery of item 2). Put `user` or `site` auth on actions whose follow-ups carry private data.
- `completeHandoff` is a read-modify-write on the `TokenStore`; two simultaneous completions of one handoff by different users can both return `true`, and the last write wins. It is called by the site's own landing page.
- The runtime authorizes the token, not the business object: handlers still authorize `onBehalfOf` within `tenant`.

## Status

done
