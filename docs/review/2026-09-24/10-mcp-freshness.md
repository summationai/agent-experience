# 10. Remote capability freshness and stable retries

Phase 2. Branch `review/mcp`.

## Finding

The review said `createMcpServer(url)` and `AXEClient` keep the initial manifest (only the in-process source updates), and that each MCP mutation gets a fresh idempotency key, so retrying an uncertain tool call can duplicate an operation.

Reproduced at `ce6ef1d`:

- `AXEClient` had no way to fetch the manifest again; `manifest()` returned the constructor's object for the client's life. `createMcpServer(url)` derived tools once; `tools/list` returned that list forever and declared no list-changed capability. An action registered on the site afterwards was "Unknown tool"; a removed one stayed listed and failed with `not_found` on every call.
- The manifest route sent `Cache-Control: max-age=300` but no validator, so revalidation meant a full download.
- The tool-call handler passed a fresh `crypto.randomUUID()` as the `idempotencyKey` of every mutating call. A host that retried after a timeout produced a second operation, and there was no argument through which a model or host could supply a stable key. Passing one as an extra argument failed input validation on strict schemas.
- `axe_continue` and `axe_resume` did not accept `expectedRev` ([P-LIVE-1] allows it on both).

## Change

`packages/client/src/index.ts`, in a separate "Manifest freshness" section at the end of `AXEClient` plus helpers after it (touches elsewhere: one `ClientOptions` field, `discover()` records the fetch URL and caching headers, the constructor reads them, `run()` looks up an unknown action after one refresh):

- `refresh()`: conditional `GET` of the manifest URL it was found at (`If-None-Match` when the site sent an `ETag`); 304 keeps the copy; 200 replaces it after checking `baseUrl` against the destination policy (`AXETrustError` otherwise, old copy kept). Concurrent calls share one request. Returns `ManifestChange { changed, added, removed, modified, manifest }`.
- `isManifestStale()`, `ensureFresh()`: the bound is `min(manifestMaxAgeMs ?? 300000, Cache-Control max-age)`; `no-cache`/`no-store` mean 0.
- `onManifestChange(listener)`.
- `run()` refreshes once for an unknown action name.

`packages/core/src/server.ts` (manifest route only): `ETag` over the rendered manifest (canonical-JSON SHA-256) and 304 for a matching `If-None-Match`.

`packages/mcp/src/index.ts`:

- URL and manifest sources: `manifestNow()` calls `ensureFresh()` on every `tools/list` and tool call; a failed refresh keeps the copy. An unknown tool name forces one refresh, then runs the tool if it now exists. A `not_found` from the site forces one refresh; if the action is gone, the call returns "no longer offered: the site removed the action". The server declares the list-changed capability and sends `notifications/tools/list_changed` to every connected session when the derived tool list changes (compared as built tools, so a new `live.rev` alone sends nothing). `DerivedMcpServer.refresh()` refetches now and resolves to whether tools changed.
- Retries: every tool for a non-`readOnly` action accepts optional `idempotencyKey` (1 to 256 characters, unless the action's input uses the name), sent as the envelope key; absent, a fresh UUID per call. The server instructions explain it. `axe_continue` and `axe_resume` accept `expectedRev` when the manifest carries `live` and forward it; their descriptions say a repeat with the same token returns the original result.

Spec: [P-DISC-13] (ETag, 304, agent revalidation past max-age, refetch for a missing action); [P-MCP-4] (bounded freshness, triggers, notification, removed tools); [P-MCP-5] (optional key, fresh key otherwise, `expectedRev` on follow-ups).

Docs: `docs/mcp.md` "Freshness of a remote manifest", "Retries and operation keys", mapping rows (`idempotencyKey`, `live`, changing action sets), "What does not map" (idempotency; the handoff and presentation bullets now name MCP elicitation and MCP Apps as the counterparts this bridge does not use yet); `docs/for-agent-builders.md` "Keeping the manifest fresh" with `docs/examples/for-agent-builders/refresh.ts`. Vocabulary: `manifestMaxAgeMs`, `onManifestChange`.

Migration: none required. Mutating tools' input schemas gain an optional property; hosts that validate tool arguments strictly see one more allowed field.

### Freshness contract

A remote bridge never derives tools from a manifest older than `min(manifestMaxAgeMs, site max-age)` (default five minutes; a `@axe/core` site sends 300 s unless `manifestCacheSeconds` says otherwise), checked at each `tools/list` and tool call. A new action is callable by name at once (one refresh on the miss) and listed within the bound, or at once after `refresh()`, which also notifies sessions. A removed action is dropped within the bound, or at its first call (`not_found` triggers one refresh and a "removed" error). Each call triggers at most one forced refresh; concurrent refreshes coalesce; revalidation is a conditional request.

### Retry contract

With `idempotencyKey`, a repeat with the same key and arguments returns the stored envelope and the handler does not run again; while the first is running the repeat gets a retryable `conflict` with `operationStatus: "in_progress"`; the same key with other arguments gets a non-retryable `conflict`. Keys are scoped to action, principal, and tenant by the site ([P-IDEM-2], [P-OP-1]). Without a key, each call is a new operation even with identical arguments. Recovery is repeating the call; there is no status tool. Continuations and resumes are keyed by their tokens.

## Tests

`packages/mcp/test/freshness.test.ts` (real AXE site on 127.0.0.1, `createMcpServer(url)`, `serveHttp` with sessions, SDK client over HTTP; barriers are promises the test resolves):

- a newly registered action becomes discoverable and callable; the session is told the tool list changed (waits for the client's server-to-client stream, then `refresh()`, then the notification)
- within the refresh bound, tools/list shows an added action and drops a removed one (`manifestMaxAgeMs: 0`)
- a call to a tool added since the last fetch refreshes once and runs; a removed tool says it was removed
- an uncertain call retried with the same idempotencyKey runs the handler once; a second call without a key runs again (the first call is held in the handler and aborted by the host; a retry during it gets `in_progress`; after the held request is answered the retry replays; different arguments conflict)
- axe_continue and axe_resume take expectedRev; a stale one applies nothing and keeps the token

`packages/client/test/freshness.test.ts`: refresh() revalidates with If-None-Match and reports added, removed, and modified actions; a removed action and a changed schema are reported; isManifestStale follows Cache-Control max-age and manifestMaxAgeMs; run() refetches the manifest once for an action it does not know; a refreshed manifest cannot move credentials to another origin.

`packages/core/test/manifest.test.ts`: carries an ETag and answers a matching If-None-Match with 304 [P-DISC-13].

With `packages/mcp/src/index.ts`, `packages/client/src/index.ts`, and `packages/core/src/server.ts` restored to `ce6ef1d` (client and core rebuilt), all eleven new tests fail.

## Limitations

- No background refresh inside the package; without calls or `refresh()`, an idle session hears about a change only when something triggers a refresh. The docs show a timer calling `refresh()`.
- Stateless HTTP clients cannot receive `tools/list_changed`.
- The bound is only as short as the site's max-age allows; a site that sends a long max-age delays removal until a call fails.
- A `not_found` from a handler (for a missing record, not a missing action) also triggers one conditional refresh; with an ETag it costs a 304.
- An in-process source without `onActionsChanged` still uses its creation-time manifest, as before.
- Recovery depends on the site's idempotency window (24 hours by default) and on the model or host choosing the key before the first attempt; a call made without a key cannot be recovered after its response is lost.
- The key is only as good as its reuse: a model that invents a new key on retry creates a second operation. The tool description and server instructions say so.

## Status

done
