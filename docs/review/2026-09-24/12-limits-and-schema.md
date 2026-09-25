# 12. Resource limits, schema boundaries, retention

Phase 2. Branch `review/limits`, based on `herz/surface-integration` at `ce6ef1d` (phase 1 merged).

Every finding below was reproduced on `ce6ef1d` before any change, with a script against the built packages and then with the regression tests listed under each sub-item. "Fails before" means the test was run with the package's `src/` stashed (`git stash push -- packages/<pkg>/src`) and failed; "guard" means it passed before too and pins behavior the change must keep.

## (a) Retention

### Finding

- `MemoryTokenStore` and `MemoryIdempotencyStore` dropped an expired entry only when that key was read again. Continuation, handoff, and poll tokens an agent abandons, and idempotency keys (unique by design), are never read again: 1000 claims with a 1-second TTL, then a write 10 seconds later, left 1001 entries. `MemoryTokenStore` also read `Date.now` directly, so it could not be tested with a clock.
- `SqliteIdempotencyStore.prune()` existed, undocumented, without a cutoff or an index on `expires`.
- Other in-memory structures, checked: the server's per-request `callers` map is a `WeakMap` keyed by `Request` (released with the request); handoff records live in the `TokenStore` (now bounded); Surface's ledger is already bounded (`ledger.max`, default 1000) and `scopedSurfaces` has `idleMs` and `onEvict`. `@axe/mcp`'s issued-poll-URL set is bounded to the most recent 1000 (owned by the MCP item; not edited here). `AXE.changeListeners` grows only with the application's own `onActionsChanged` calls, each of which returns an unsubscribe.

### Change

- `packages/core/src/retention.ts` (new): `ExpiringMap`, shared by both memory stores. Options (`RetentionOptions`): `now` (injectable clock), `maxEntries` (default 10000, `DEFAULT_MAX_ENTRIES`), `sweepIntervalMs` (default 60000, `DEFAULT_SWEEP_INTERVAL_MS`). A write sweeps expired entries when the interval has passed or the map is full; at `maxEntries` the oldest evictable entries go first. No timer, so nothing keeps a process alive.
- `MemoryIdempotencyStore(options)`: a claim whose lease is running is never evicted (that would let the operation run twice); completed records and claims past their lease are. When every entry is a running claim, `claim` throws rather than evict one. `sweep()` and `close()` (drops everything; later calls throw).
- `MemoryTokenStore(options)`: same options, `sweep()`, `close()`. An evicted token answers `not_found`.
- `SqliteIdempotencyStore.prune(before = now)`: refuses a future cutoff; `CREATE INDEX IF NOT EXISTS <table>_expires`; the SQL for a job outside Node is documented.
- Spec [P-LIM-4]. Docs: `docs/deploying.md` "Limits and retention" (with `docs/examples/deploying/limits.ts#memory` and `#prune`), checklist lines.

### Tests

`packages/core/test/limits.test.ts`, all failing before:

- "MemoryTokenStore sweeps expired records on a later write, whether or not they are read again"
- "MemoryTokenStore evicts the oldest record at maxEntries"
- "MemoryIdempotencyStore sweeps abandoned unique keys, and evicts completed entries before a running claim" (also: full of running claims throws; a claim past its lease becomes evictable)
- "sweep() and close(): close drops every entry and later use fails"
- "the stores refuse a maxEntries that is not a positive integer"
- "a server on the default stores keeps a bounded number of tokens for abandoned continuations" (200 abandoned continuations, `maxEntries: 50`, 50 held)
- "SqliteIdempotencyStore.prune ... deletes rows that expired before the given time and keeps live ones; a future time is refused" (skipped where `node:sqlite` is missing; run on Node 24.21)

### Limitations

- A store at `maxEntries` shortens the idempotency window for the evicted keys: a retry of an evicted completed operation runs the handler again. Production multi-instance deployments use a shared store anyway.
- Sweeping happens on writes; an idle process keeps its expired entries until the next write (its memory is not growing).
- `prune()` must be scheduled by the site; the SDK does not start a job.

## (b) Body limits

### Finding

- The core read every body with `request.text()`: a 5 MiB body to a read-only action returned 200 after buffering all of it. There was no limit anywhere in `@axe/core`.
- A body of 100000 nested arrays (about 200 KB) crashed `handle()` with `RangeError: Maximum call stack size exceeded` in canonicalJson (the fingerprint hash), before any schema ran; the adapters turned it into a 500 or an unhandled rejection.
- `@axe/express` and `@axe/next` (Pages) read an unread Node stream to its end with no limit before calling the core.
- `@axe/client` read every response with `res.json()`, unbounded.
- Found by the new conformance checks against the getting-started Express server: behind `express.json()`, a 20000-level body parsed fine and then overflowed `JSON.stringify` in the adapter (HTTP 500); the Next Pages adapter did the same and never answered. And `express.json()` in front refuses a large body with its own HTML 413, which is no AXE envelope.

### Change

- `createAXE({ maxBodyBytes })`, default 1 MiB (`DEFAULT_MAX_BODY_BYTES`), exposed as `axe.maxBodyBytes`; a non-positive or fractional value throws at startup. readBody refuses a `Content-Length` above the limit without reading; otherwise it reads the `Request` stream with a counter and cancels it once past the limit. Refusal: `invalid_input`, `retryable: false`, `details: { reason: "payload_too_large", maxBodyBytes }`, HTTP 413, before JSON parsing, identity, tokens, or hooks. It takes precedence over an unknown action name. Decision: reuse `invalid_input` with a reason rather than add an error code (DECISIONS.md).
- Nesting: a parsed body deeper than 64 levels (`MAX_JSON_DEPTH`) is `invalid_input` with an issue at `""`; the depth check is iterative.
- Express and Next Pages: the raw stream is read only up to `maxBodyBytes + 1` bytes (nothing when `Content-Length` is larger), the core answers 413, and the adapter sets `Connection: close` instead of draining. A body a parser already consumed is bounded by that parser (`express.json()` 100 kB, Next 1 MB), then by `maxBodyBytes` on the re-serialized value. `toWebRequest(req, origin, { maxBodyBytes })`. A parsed body too deep for `JSON.stringify` is replaced by a body nested just past the core's limit, so the core answers `invalid_input` instead of the adapter failing. The getting-started Express example now mounts `axeExpress` before `express.json()`, and `docs/integrations/express.md` recommends that order.
- Client: `maxResponseBytes` (default 4 MiB) enforced from `Content-Length` and while reading, in `send()` (sub-item c).
- Vocabulary: reason `payload_too_large`, field and API `maxBodyBytes`. Spec [P-LIM-1], [P-LIM-2]; [P-INV-6] amended for 413. `spec/KINDS.md` notes the interaction with `document.base64`.
- Conformance: `runtime.body-limit` (streams up to 32 MiB of never-valid JSON, so no handler can run; passes on 413 with the envelope and reason, warns on a 413 without an envelope, which is a proxy or body parser in front) and `runtime.nesting-limit`.

### Tests

- `packages/core/test/limits.test.ts`, all failing before: "a Content-Length above maxBodyBytes is refused with 413 and payload_too_large before anything is read", "a body without Content-Length is read only up to the limit, then the stream is cancelled", "the default limit is 1 MiB: 2 MiB is refused, a body under the limit runs", "continue and resume bodies are bounded too, and an unknown action does not hide the refusal", "createAXE refuses a maxBodyBytes that is not a positive integer", "a deeply nested body is invalid_input, not a crash". Guard: "nesting at the limit is accepted".
- `packages/express/test/express.test.ts`: "a raw body whose Content-Length exceeds the limit is refused with 413 before it is read", "a chunked raw body is read only past the limit, then refused with 413 without waiting for the rest". The client sends headers and the first chunk and never the rest; before the change the adapter waited for the end of the body and both tests timed out.
- `packages/next/test/next.test.ts`: "an unparsed raw body is read only past maxBodyBytes and refused with 413, declared or chunked" (timed out before); "a deeply nested body Next already parsed is invalid_input, not a 500" (timed out before, with a `RangeError` in the handler).
- `packages/express/test/express.test.ts`: "a deeply nested body parsed by express.json() is invalid_input, not a 500 [P-LIM-2]" (500 before).
- `packages/testing/test/conformance.test.ts`: "runtime.body-limit passes by default and fails when the server reads a 32 MiB body in full".
- Updated: `packages/core/test/tokens.test.ts` "enforces the 10 MiB decoded-size limit on document.base64 payloads" now sets `maxBodyBytes: 16 MiB`, since a 10 MiB document is about 14 MiB of base64.

### Limitations

- The default 1 MiB caps inline `document.base64` at about 750 KiB; sites that accept larger ones raise `maxBodyBytes`.
- One limit for every endpoint; there is no per-action limit.
- The adapters close the connection after a 413 on an unread body; a client that pipelines requests on that connection must reconnect.
- The body limit bounds, but does not remove, regular-expression cost (sub-item e).

## (c) Client timeouts, cancellation, polling budgets

### Finding

- No timeout: a site that never answered, or stalled after the headers, hung `invoke` forever.
- `signal` existed on `invoke`/`continue`/`resume`/`poll`/`state` but not on `discover` or `AXEClient.discover`; discovery swallowed every error per candidate, so an abort would have moved on to the next URL.
- `poll()` slept `retryAfter * 1000` ms: a site answering `retryAfter: 0` (or a non-number, giving `NaN`) was polled in a tight loop until `maxWaitMs` (with fake timers, ten seconds of polling made far more than ten requests). There was no attempt limit, and `run()` gave each poll its own `maxWaitMs`, so a ladder with several `pending` rungs could poll for maxSteps × `maxWaitMs`.

### Change

All in `packages/client/src/index.ts`, inside the module `send()` (so the trust checks still run on every hop), `ClientOptions`, `PollOptions`, `DiscoverOptions`, and method signatures; nothing reordered.

- `timeoutMs` (default 30000) per request: one `AbortController` per call, aborted by the caller's signal or an `unref`'d timer that covers every redirect hop and the body read (the returned response's body is wrapped; the timer is cleared when it ends, errors, or is cancelled). A timeout is `AXEClientError` "timed out after N ms"; an abort is "was aborted"; an already-aborted signal sends nothing.
- `signal` on `discover(url, { signal })` and `AXEClient.discover(url, options, { signal })`; an aborted discovery rethrows instead of trying the next candidate. Discovery also takes `timeoutMs` and `maxResponseBytes`, and cancels the body of a candidate it skips.
- `maxResponseBytes` (default 4 MiB): see (b).
- `maxPollAttempts` (default 60) and `maxWaitMs` (default 60000) form one budget; `run()` shares it across every poll of the run, starting at the first poll. Each wait is `retryAfter` clamped to at least 1000 ms and at most what is left of `maxWaitMs`.
- Vocabulary: `timeoutMs`, `maxResponseBytes`, `maxPollAttempts`. Spec [P-LIM-3]. Docs: `docs/for-agent-builders.md` "Timeouts, cancellation, and budgets" with `docs/examples/for-agent-builders/limits.ts`.

### Tests

`packages/client/test/limits.test.ts`, with Vitest fake timers (no sleeps). Failing before: "a request that never answers fails with a timeout after timeoutMs", "a body that stalls after the headers is covered by the same timeout", "the default timeout is 30 seconds, and a finished request leaves no timer behind", "aborting mid-request rejects with an AXEClientError", "an already-aborted signal sends nothing, on invoke, continue, resume, poll, state, run, and discover", "aborting discovery stops it instead of trying the next candidate", "a site that says retryAfter 0 is polled at most once a second, not in a loop", "maxPollAttempts bounds the number of polls, default 60", "run() shares one budget across every poll of the run", and the three "response size" tests (before the change the unbounded read ran the worker out of memory). Guard: "a long retryAfter is clamped to what is left of maxWaitMs".

### Limitations

- The timeout is per request, not per `run()`; a run's total time is bounded by maxSteps, the polling budget, and the per-request timeout together.
- `AXEClientError` has no machine-readable reason field; callers distinguish a timeout from an abort by message or by checking their own signal.
- Retries after `rate_limited`/`unavailable` keep their existing rule (`retries`, `maxRetryAfterMs`).

## (d) Malformed untrusted input on the client

### Finding

isResult checked only that `status` was one of the five values, and looksLikeManifest only `protocol`, `baseUrl`, and that `actions` was an array. Reproduced with a mocked site:

- `{ "status": "needs_input", ... }` without `accepts`: `run()` crashed with a `TypeError` inside `fulfill` (`accepts` is not iterable).
- `ok` without `output`, `error` without `error`, `needs_human` without `handoff.url`, `pending` with `retryAfter: "soon"` (a polling loop, see c), a numeric `error.code`, an object `rev`: all returned to the caller as if valid, reaching the agent loop and `present()`.
- A manifest with `actions: [null]` crashed `client.action(name)`; `policies.agents.deny: "acme"` crashed `allowed()` for a client with a vendor; a live-state document `{ "actions": null }` was returned from `state()`.
- `__proto__` keys: `JSON.parse` makes them own data properties, and the client never merged server objects, so nothing was polluted; but getPointer in `@axe/core/display` (used by `present`) followed `"/constructor"` and `"/__proto__"` into the prototype chain.

### Change

- `packages/client/src/index.ts`: resultProblem, manifestProblem, liveStateProblem, compact hand checks of own members, per status: `needs_input` requires `reason`, `message`, `continuationToken`, `expiresAt`, and a non-empty `accepts` of `{ kind, title, description, schema, sensitive, instructions? }`; `needs_human` a full handoff; `pending` a string `pollUrl` and a finite `retryAfter`; `error` `{ code, message, retryable, details? }`; `rev` a string or finite number. Manifests: `protocol`, `name`, `description`, `baseUrl`, and each action's `name`, `title`, `description`, `input`, `output`, `readOnly`, with `display`, `affordances`, `live`, and `policies.agents` typed when present. A failure is `AXEClientError` naming the member ("... is not an AXE result envelope: accepts must be a non-empty array"); discovery lists rejected candidates under "Not usable".
- Decision: hand checks rather than `@axe/core/schemas`, which would pull Zod into the dependency-free client (DECISIONS.md). Bundle: 12.1 kB to 16.0 kB minified with (c) and (d); budget raised from 15 kB to 18 kB in `bundle-size.test.ts`.
- `packages/core/src/pointer.ts`: getPointer and schema stepping follow own members only.
- Huge arrays are bounded by `maxResponseBytes`; deeply nested JSON parses (V8's parser is iterative) and nothing in the client or `present` recurses on it.

### Tests

`packages/client/test/limits.test.ts`, "malformed documents from a site are AXEClientError": the invoke-and-run cases for ok without output, needs_input without accepts, a null accepts entry, needs_human without `handoff.url`, pending with a string `retryAfter`, pending without `pollUrl`, error without error, a numeric code, an object `rev`; "discover() rejects malformed manifests and says why"; "state() rejects a live-state document with the wrong shape" (all failing before). Guards: an array body, an unknown status, a status only through `__proto__`, "__proto__ keys in an output stay data: nothing is polluted and present() works", "a deeply nested output does not crash run() or present()".

### Limitations

- The checks cover the members the client and `present` read, not the whole manifest schema; a manifest with a malformed `display` object inside a valid action is accepted and handled by `resolveDisplay`'s own defensiveness.
- A manifest passed to `new AXEClient` directly is not checked; the caller chose it.

## (e) JSON Schema subset audit

### Finding

Reproduced against `validateJsonSchema` on `ce6ef1d`:

- Prototype chain: `additionalProperties: false` accepted `{"__proto__": 1, "constructor": 2, "toString": 3}` (the `key in props` test found them on `Object.prototype`, and the validator then "validated" against `Object.prototype` itself); `required: ["toString"]` was satisfied by `{}`.
- `{ "$ref": "#" }`, or two `$defs` referring to each other: `RangeError` (stack overflow). `{ "$ref": "#anchor" }` threw from the pointer parser.
- `pattern: "("`: `SyntaxError` thrown out of the validator; on `/axe/continue` it escaped `handle()`.
- `format: "ipv4"` (and any unknown format): silently accepted `"not-an-ip"`.
- `patternProperties`, `propertyNames`, `minProperties`, `if`/`then`/`else`, `uniqueItems`, `contains`, `dependentRequired`, `unevaluatedProperties`, and every other unimplemented keyword: silently ignored, so the value passed.
- `multipleOf` used an absolute tolerance of 1e-9 on the quotient.
- `@axe/generate`: a `format` replaced the string schema, dropping `minLength`, `maxLength`, and `pattern` (`{ format: "email", maxLength: 20 }` accepted any length); an `additionalProperties` schema beside `properties` became `.loose()` (anything); a pattern that did not compile was dropped silently; unknown formats and unsupported keywords were dropped without a warning.
- `toJsonSchema` (Zod 4's converter with `unrepresentable: "any"`): `.refine`/`.superRefine` are dropped, `z.custom` and `z.date()` become `{}`, and `z.preprocess` publishes the inner schema; the manifest claimed a looser schema than the server enforced, silently.
- Fingerprints: phase 1 hashed the parsed input. With `z.string().transform((s) => new Date(s))`, every input hashed as `{}`: reusing an `idempotencyKey` with a different date returned the first date's result instead of `conflict` ([P-IDEM-3] violated). replayForUnknown hashed the raw input, inconsistent with the rest. A login handoff stored the parsed input and parsed it again at resume, so a transform ran twice (the resume failed with `invalid_input`).

### Change

- `packages/core/src/json-schema.ts`, rewritten: own members only; unknown keywords, array `items`, formats neither checked nor carried by a `pattern` (directly or in an `allOf` member), patterns that do not compile (tried with `u`, then without), non-local and plain-name refs, `$ref` loops that consume nothing (tracked per value location), and recursion past 128 levels are issues, never throws. Implemented: `patternProperties`, `propertyNames`, `minProperties`, `maxProperties`, `dependentRequired`, `dependentSchemas`, `uniqueItems`, `contains`, `minContains`, `maxContains`, `if`/`then`/`else`; formats `ipv4` and `jwt`; exact decimal `multipleOf` (BigInt on the shortest decimal form). Compiled patterns are cached (512). New exports: `SUPPORTED_SCHEMA_KEYWORDS`, compilePattern, `isBacktrackingPattern`, `schemaProblems`, `SchemaProblem`.
- `packages/core/src/zod-json-schema.ts`: for `io: "input"`, a node with a custom check, a custom or unrepresentable type, or a preprocess carries `"x-axe-refined": true` (via Zod's `override` hook). Transforms, defaults, and coercion are not marked (reasons in `docs/schemas.md`).
- `packages/core/src/lint.ts`: lintSchema; rules `unsupported-schema` (error), `backtracking-pattern` (warning), `refined-schema` (warning, input only), run by `lintAction` and so by `axe validate` and `axe audit`. Decision for refinements: mark in the manifest and warn through the lint, not reject at registration (DECISIONS.md).
- ReDoS: `isBacktrackingPattern` flags a group repeated without bound whose body ends in an unbounded repetition with nothing required after it; none of Zod's built-in format patterns trip it. The body limit bounds input length. Documented, not enforced at runtime.
- Fingerprint: `server.ts` hashes `input` as sent (canonical JSON) for the idempotency fingerprint and token binding, and a login handoff stores the raw input. Consistent with replayForUnknown.
- `packages/generate/src/json-schema-to-zod.ts`: length and pattern apply with a format; an `additionalProperties` schema beside `properties` is a `.catchall()`; unchecked formats (except `byte`, `binary`, `password`), bad patterns, and 19 unsupported keywords each produce an `unsupported-schema` warning naming the path.
- Validator dependency: Ajv measured and rejected (DECISIONS.md, `docs/schemas.md`): see the table below.
- Spec §5.4 [P-SCHEMA-1] to [P-SCHEMA-6]; vocabulary section "JSON Schema keywords", field `x-axe-refined`, API `schemaProblems`, `validateJsonSchema`, `lintAction`, `isBacktrackingPattern`. New page `docs/schemas.md` (in `docs/README.md` and `site/build.mjs` HUB_GROUPS), with `docs/examples/schemas/refined.ts`; `docs/requirements-and-kinds.md`, `docs/designing-actions.md` (anti-pattern), `docs/security.md`.
- Incidental: `packages/testing/src/drift.ts` kept unknown names in a plain object, so a docs code span reading `constructor` crashed the drift check (`unknown[name].push is not a function`); it now uses a prototype-less object.

### The supported subset

| Keyword | Validator | Zod to JSON Schema | `@axe/generate` |
| --- | --- | --- | --- |
| `type`, `enum`, `const` | checked | emitted | converted (primitive `enum`/`const` only) |
| `properties`, `required`, `additionalProperties` | checked, own members | emitted | converted; schema-valued `additionalProperties` is a record or catchall |
| `patternProperties`, `propertyNames` | checked | `propertyNames` for record keys | warning, dropped |
| `minProperties`, `maxProperties`, `dependentRequired`, `dependentSchemas` | checked | not emitted | warning, dropped |
| `items` (schema), `minItems`, `maxItems` | checked | emitted | converted |
| `prefixItems` | checked | emitted for tuples | warning, dropped |
| `uniqueItems`, `contains`, `minContains`, `maxContains` | checked | not emitted | warning, dropped |
| `minLength`, `maxLength` | checked (code points) | emitted | converted, also with a format |
| `pattern` | ECMAScript; uncompilable refuses | emitted | converted; uncompilable warns |
| `format` | date, date-time, time, duration, email, uri, uuid, ipv4, jwt; others only via a pattern, else refused | emitted with a pattern for most | date-time, date, time, email, uri/url, uuid; others warn |
| numeric bounds, `multipleOf` | checked; `multipleOf` exact on decimals | emitted | converted |
| `allOf`, `anyOf`, `oneOf`, `not` | checked | emitted | `allOf` object merge; `anyOf`/`oneOf` union (exclusivity not enforced); `not` warns |
| `if`, `then`, `else` | checked | not emitted | warning, dropped |
| `$ref`, `$defs` | local only; loops that consume nothing refuse | recursion only | local; recursion becomes unknown with a warning |
| `unevaluated*`, `$dynamicRef`, `dependencies`, `additionalItems`, array `items`, anything else | refuses | never emitted | warning, dropped |
| annotations, `x-` keywords | ignored | `description`, `default`, `x-axe-refined` | `description`, `default` used |

Measured sizes (esbuild, minified, browser, Node 24): `@axe/core/json-schema` 10072 bytes (3566 gzipped); Ajv 8.20 draft 2020-12 entry 133746 (40273); with `ajv-formats` 148303 (43816). The Surface browser bundle (`@axe/surface` and `/react`) went from 25290 to 30351 bytes with the new validator, under its 50 kB bound; the client bundle does not include the validator.

### Tests

`packages/core/test/schema-boundaries.test.ts`, all failing before except "a recursive schema still validates a recursive value" (guard): "__proto__, constructor, and toString are ordinary keys: additionalProperties: false refuses them", "a required key is not satisfied by the prototype chain", "a $ref cannot resolve through the prototype chain", "a $ref loop that consumes nothing is an issue, not a stack overflow", "a value nested deeper than the validator follows is an issue, not a stack overflow", "a pattern that does not compile refuses the value instead of throwing", "a format the validator cannot check refuses the value unless a pattern carries it", "a keyword the validator does not implement refuses the value; annotations and x- keys are ignored", "non-local refs and plain-name fragments are unresolvable", "implements the 2020-12 keywords it used to ignore", "the keyword lists are published", "is exact on the decimal values as written", "flags quantified groups whose body ends in a loose repetition, and not Zod's built-in patterns", "schemaProblems reports what the validator would refuse, with paths", "toJsonSchema marks every input node the server checks beyond JSON Schema with x-axe-refined", "the lint warns for each refined node, and the validator ignores the annotation", "the lint reports an unsupported construct in an action schema as an error", "the same key with a different date is conflict, even though both parse to a Date", "the fingerprint is the input as sent: a default filled in by the schema is a different request", "a login resume parses the input as sent once, so a transform does not run twice", "a payload schema whose pattern does not compile is invalid_input, not a crash".

`packages/generate/test/json-schema-to-zod.test.ts`: "never drops a constraint silently: length and pattern stay with a format, and what is dropped is named" (fails before); "falls back to unknown with a warning naming the path for what it does not handle" updated for the extra `not` warning.

### Limitations

- Zod refinements on `accepts[].schema` are still not applied on `/axe/continue` (the stored schema is JSON); `x-axe-refined` tells the agent, and the site checks in `onContinue`.
- The backtracking check is a heuristic (overlapping alternatives pass), and patterns run with no time limit.
- `$id` inside a schema does not change the base for `$ref`; refs resolve against the document root.
- `oneOf` from `@axe/generate` is converted as a union, so a value matching two alternatives is accepted there (the JSON validator enforces exactly one).
- Migration: a retry across the upgrade whose raw input differs from its parsed input (a stripped unknown member, a spelled-out default) gets `conflict` once. A hand-written JSON Schema that used an unsupported keyword, or a format with no checker and no pattern, now refuses every payload instead of ignoring it; `schemaProblems` or the lint finds these.

## Status

done
