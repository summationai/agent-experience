# 6. Cookie-authenticated integration with CSRF protection

Phase 1, release-blocking.

## Finding

The review said the runtime accepts JSON in `text/plain` bodies from a foreign `Origin`, so an authenticated cookie request of that shape mutates state, and CORS response headers do not prevent the write.

Reproduced on `review/csrf` at `3dd4ed3` with the review's script, last case, pointed at this worktree: a `user` action on a site whose `authenticate` reads `cookie: session=alice`, called with `POST /axe/actions/test.csrf`, `content-type: text/plain`, `origin: https://other.example`, and the cookie. Result: HTTP 200, `{"status":"ok","output":{"value":"mutated"}}`. The runtime never read `Content-Type` or `Origin`.

Investigating the adapters found a second, independent defect. Both Node adapters overwrote `Content-Type` with `application/json` whenever a body parser had already consumed the body:

- `@axe/express` with `express.text()` or `express.urlencoded()` mounted: a `text/plain` or form body became a string or object, was re-serialized, and was labeled JSON. With the new core rule and the old adapter, a `text/plain` write with no `Origin` still ran (HTTP 200).
- `@axe/next` Pages API: Next's built-in parser turns `text/plain`, and a missing content type, into a string; the adapter labeled it JSON and the write ran.
- Express 4's json parser sets `req.body = {}` on a request it skipped; the adapter then sent `{}` labeled JSON instead of the real bytes.

The App Router (`axeNext`) and `axeFetch` pass the framework's `Request` through unchanged; `Origin`, `Cookie`, `Sec-Fetch-Site`, and `Content-Type` arrive as sent. The Node adapters copy every request header verbatim; only `Content-Type` was altered.

## Change

Spec: protocol §6.4, "Requests a browser can send on a page's behalf", rules [P-TRANS-1] to [P-TRANS-4], and a cross-site request forgery bullet in §19.

- [P-TRANS-1]: a `POST` to an action that is not `readOnly`, to `/axe/continue`, or to `/axe/resume` must be `application/json` or `application/<subtype>+json`; anything else, including no header, is `unsupported`, before the body is read. An unknown action name counts as not `readOnly`.
- [P-TRANS-2]: a `POST` carrying ambient credentials is `forbidden` when `Origin` is present and is neither the site's origin nor trusted (`null` never matches), or when `Origin` is absent and `Sec-Fetch-Site` is `cross-site` or `same-site`. The refusal comes before action lookup, body, identity, or token, and is identical for every path.
- [P-TRANS-3]: a request with neither `Origin` nor `Sec-Fetch-Site` is not refused by the origin rule. `GET`, `HEAD`, and `OPTIONS` are outside §6.4.
- [P-TRANS-4]: the site's origin comes from `baseUrl` (or the tenant's), never from `Host`, `Forwarded`, or `X-Forwarded-*`; trusted origins are exact; credentialed-CORS origins may be treated as trusted.

`@axe/core`:

- New module `packages/core/src/request-policy.ts`, pure functions over a `Request`: evaluateRequestPolicy, resolveRequestPolicy, classifyPost, isJsonContentType, isAcceptedOrigin, hasAmbientCredentials, normalizeOrigin. Exported from `@axe/core` with the types RequestPolicyConfig, ResolvedRequestPolicy, OriginCheck, PolicyContext.
- `createAXE({ requestPolicy })` with `requireJsonContentType` (default true), `trustedOrigins` (exact origins; `createAXE` throws on a wildcard or a path), and `originCheck` (`cookie` default, `always`, `off`). Origins in `cors.origins` with `allowCredentials` are added to the trusted set.
- `server.ts`: one field, one line in the constructor, one call near the top of `handle()` (after tenant resolution, which supplies the tenant's `baseUrl`, and after `OPTIONS`). Refusals go out through the existing error response path; no hook runs and no event is emitted, because nothing was attempted.
- Errors: `forbidden` (HTTP 403) with `details.reason` `cross_origin_refused`; `unsupported` (HTTP 400) with `details.reason` `json_required`. Both are new rows in the vocabulary's reason conventions.

Adapters: `@axe/express` toWebRequest and `axeNextPages` keep the sent `Content-Type`; the Express adapter reads the raw stream whenever no middleware consumed it (so Express 4's `{}` placeholder no longer replaces the real body); the Pages adapter reads the stream when the body was not parsed.

Conformance: `runtime.json-content-type` posts a valid envelope as `text/plain` to a mutating action and expects `unsupported`; a non-error result fails, another error code warns, `--no-mutate` skips. It is unconditional because the content-type rule does not depend on auth mode. The origin rule is covered by named tests, since a conformance run cannot know whether a site uses cookies.

Docs: `docs/auth.md` "Cookie sessions" (rules, matrix, options, SameSite, proxies, forwarded headers); `docs/security.md` threat and known gap; one paragraph in each of `docs/integrations/express.md`, `next.md`, `fetch.md`; `docs/deploying.md` CORS note and checklist line; example `docs/examples/auth/cookie-session.ts`. Vocabulary: `requestPolicy`, `requireJsonContentType`, `trustedOrigins`, `originCheck`, `cross_origin_refused`, `json_required`. `DECISIONS.md` and `CHANGELOG.md` entries.

Migration: a client that posts JSON to a mutating action, continue, or resume without `Content-Type: application/json` now gets `unsupported`. `@axe/client`, `@axe/mcp` (through the client), `@axe/testing` helpers, and the conformance runner already send it. One existing test helper (`packages/core/test/pending.test.ts`) did not and was given the header.

### Policy matrix (defaults)

| Request                                                                           | Result                          |
| --------------------------------------------------------------------------------- | ------------------------------- |
| `POST`, cookie, `Origin` = `baseUrl` origin (or tenant's), JSON                   | runs                            |
| `POST`, cookie, `Origin` in `trustedOrigins` or credentialed `cors.origins`, JSON | runs                            |
| `POST`, cookie, other `Origin` or `Origin: null`, any body type                   | `forbidden` 403                 |
| `POST`, cookie, no `Origin`, `Sec-Fetch-Site` `cross-site` or `same-site`         | `forbidden` 403                 |
| `POST`, cookie, no `Origin`, `Sec-Fetch-Site: same-origin` or absent, JSON        | runs                            |
| `POST` write, `text/plain`, form, multipart, or no content type, any credential   | `unsupported` 400               |
| `POST` `readOnly` action, no cookie, any content type                             | runs                            |
| `POST`, bearer, no `Origin`, JSON                                                 | runs                            |
| `POST`, no cookie, foreign `Origin`, JSON (public site, cross-origin agent)       | runs                            |
| `GET` manifest, definition, `/axe/state`, `pollUrl`; `OPTIONS`                    | never refused by these rules    |
| `originCheck: "always"`, no cookie, foreign `Origin`                              | `forbidden` 403                 |
| `originCheck: "off"`                                                              | origin rule skipped             |
| `requireJsonContentType: false`                                                   | content-type rule skipped       |

When both rules fail, the origin refusal wins. A write is a `POST` to a non-`readOnly` or unknown action, `/axe/continue`, or `/axe/resume`.

## Tests

All in the worktree; each refusal test was run against the original sources (sources stashed, core rebuilt) and failed, and passes with the change.

- `packages/core/test/request-policy.test.ts` (27 tests): primitives (JSON content types, origin normalization, `Origin`/`Sec-Fetch-Site` decisions, trusted-origin validation and credentialed CORS, methods and paths left alone); "cross-origin writes with cookies are refused before anything runs" (text/plain, form, multipart, missing, and JSON from a foreign origin; identical response for a known action, an unknown action, continue, and resume with valid or invalid cookies; `Origin: null`; `Sec-Fetch-Site: cross-site`; read-only POSTs checked, GETs and OPTIONS not); "intended callers keep working" (same origin, `Sec-Fetch-Site: same-origin`, trusted and credentialed-CORS origins, site origin from `baseUrl` not `Host`/`X-Forwarded-Host`/`Forwarded`, tenant `baseUrl`, bearer without `Origin`, public site cross-origin JSON, `always` and `off`); "state-changing POSTs must be JSON" (four non-JSON shapes with a bearer token, continue/resume/unknown action, read-only exempt, opt-out). Before the change: 20 of 27 failed; the 7 that passed are callers that must keep working.
- `packages/express/test/express.test.ts`, "axeExpress request policy": a real Express 5 app with `express.json()`, `express.text()`, and `express.urlencoded()` mounted, over HTTP. Cross-origin text/plain, form, and multipart with the session cookie are 403 and nothing runs; the same bodies without `Origin` but with a bearer token are 400 even though a parser consumed them; no content type is 400; a middleware that sets `req.body = {}` (Express 4's behavior) no longer hides the real body; same-origin, trusted-origin, and bearer JSON run; foreign-origin GET works. With the new core and the old adapter, the text/plain and form cases without `Origin` ran (200).
- `packages/next/test/next.test.ts`, "request policy through the Next adapters": App Router handlers called with Web `Request`s; a Pages API handler behind a Node server that parses bodies the way Next does (JSON and form to objects, everything else to a string). With the new core and the old Pages adapter, the text/plain write ran (200).
- `packages/fetch/test/fetch.test.ts`, "axeFetch request policy": through Hono.
- `packages/testing/test/conformance.test.ts`: `runtime.json-content-type` passes on the default fixture and fails with `requireJsonContentType: false`. `requirements.ts` maps [P-TRANS-1] to the check and a test, [P-TRANS-2] to [P-TRANS-4] to tests.

## Limitations

- Only a `Cookie` header counts as an ambient credential by default. HTTP authentication and client certificates are invisible to the runtime; such sites need `originCheck: "always"`.
- A browser that sends neither `Origin` nor `Sec-Fetch-Site` is treated as a server. Every current browser sends `Origin` on `POST`; very old ones may not. The JSON rule and `SameSite` cookies still apply.
- A reverse proxy that strips or rewrites `Origin` weakens the rule; the docs say to pass `Origin`, `Sec-Fetch-Site`, `Cookie`, and `Content-Type` through.
- A site served on several hostnames must list each in `trustedOrigins`; the runtime knows only `baseUrl` (and a tenant's `baseUrl`).
- `GET` endpoints are not covered. `pollUrl` runs `onPoll`, which should only report on work already started.
- Refused requests emit no event and call no hook, so a site cannot count CSRF attempts through `onEvent`; a proxy log can.
- Merging with concurrent work: any new test that posts to a mutating action, continue, or resume without `Content-Type: application/json` will now get `unsupported`. Such tests need the header.

## Status

Done on `review/csrf`.
