# Decisions

Every non-obvious judgment call made while building AXE v0, with the reasoning. Entries are grouped by area and dated. When a decision is revisited, the original entry is edited in place and the change is noted, so this file reads as the current state of the design rather than as a changelog.

If you disagree with something here, open an issue that quotes the entry. Most of these are reversible before 1.0.

## Repository and tooling

**The project lives in `axe/` inside an existing monorepo.** The working directory for this build was an empty `axe/` folder in a larger repository on a dedicated branch. The project is built as a fully self-contained pnpm workspace rooted at `axe/` (its own `package.json`, lockfile, CI workflow, and lint configuration) so it can be moved to its own repository with `git subtree split` or a copy, with no edits. The "fresh clone" verification step extracts the `axe/` tree from git into a temporary directory and runs the full build there, which is what a clone of a standalone repo would see. The GitHub Actions workflow in `.github/workflows/ci.yml` is written for a standalone repository root.

**pnpm 10 via corepack, TypeScript 5.9, Vitest 4, tsup 8, Turborepo 2.** TypeScript 7 (the native port) was available but the tsup, typedoc, and typescript-eslint chain still pins `< 6.1`, so 5.9 is the version that works everywhere without surprises. Vitest 4 is the latest line with a stable Node 20 story.

**Zod 4, and no `zod-to-json-schema`.** Zod 4 ships `z.toJSONSchema()` natively, targeting draft 2020-12, which is exactly the dialect the protocol specifies. `@axe/core` therefore has exactly one runtime dependency. The brief allowed `zod-to-json-schema`; not needing it is better.

**Node 20 as the floor.** Everything the SDK needs from the platform exists in Node 20: global `Request`, `Response`, `fetch`, `crypto.subtle`, `util.parseArgs`. `@types/node` is pinned to the 20 line so nothing newer leaks into the public API. The CLI uses `tsx` to load an integrator's `axe.ts`, because Node 20 cannot strip types itself.

**No argument-parsing or prompt library in the CLI.** `node:util.parseArgs` and `node:readline` cover every command. One fewer dependency in the tool integrators run in CI.

**ESM-first, CJS emitted by tsup for every package.** Next, Express, and older Jest setups still load CJS. Each package publishes `exports` with `import` and `require` conditions and separate `.d.ts`/`.d.cts` files.

## Vocabulary and drift prevention

**`spec/VOCABULARY.md` is the single source; `packages/core/src/vocabulary.ts` is generated from it.** The table has five columns: category, key, name, where it appears, meaning. A script (`scripts/gen-vocabulary.mjs`) parses the table and emits a frozen nested object `WIRE.<category>.<key>`. A test regenerates and diffs, so a hand edit to the TypeScript file fails CI. Markdown was chosen as the source because the spec is what reviewers read; the code is derived.

**`WIRE` is nested by category, not a flat list of constants.** `WIRE.path.manifest`, `WIRE.header.protocol`, `WIRE.status.needsInput`, `WIRE.field.continuationToken`. Flat `WIRE.FIELD_CONTINUATION_TOKEN` was considered and rejected as harder to read at call sites.

**Field names are enforced through TypeScript types, not `WIRE.field.*` at every property access.** Writing `envelope[WIRE.field.continuationToken]` everywhere would make the code unreadable and would defeat type narrowing. Instead, the drift test loads every package's `.d.ts` and asserts each vocabulary field appears as a property with exactly that spelling. Paths, headers, statuses, error codes, ladder values, kind names, MCP tool names, and CLI command names are used only through `WIRE`, and a source-scan test fails on any string literal in `packages/*/src` that starts with `/axe/`, `/.well-known/axe`, `AXE-`, or `axe_` outside the generated vocabulary file.

**The drift test scans inline code spans, not fenced blocks.** Fenced TypeScript is typechecked from `docs/examples`, which is a stronger guarantee than pattern matching. Fenced JSON blocks contain example data (`rentUsd`, `bedrooms`) that is legitimately not vocabulary. Inline spans are where prose refers to a wire name, and that is where spelling drift happens.

**Dotted kebab-case names are treated as wire names only when the namespace is a well-known kind namespace (`payment.`, `identity.`, `document.`, `contact.`, `consent.`) or the custom-kind prefix `x-`.** Action names such as `units.search` are integrator-chosen examples, not protocol vocabulary, and would otherwise force a long allowlist.

**SDK API identifiers are in the vocabulary too, under the `api` category.** `createAXE`, `register`, `fetchHandler`, `needsInput`, `handoff`, `resolveDisplay`, and so on are camelCase and would be flagged by the drift test's camelCase rule. Rather than allowlist them, they are vocabulary: the docs must spell them the way the `.d.ts` files do. This is consistent with the goal of the test, which is that no reader is ever told a name that does not exist.

## Protocol

**Error details are nested: `{ status: "error", error: { code, message, retryable, details } }`.** The brief describes the error case as "structured `{ code, message, retryable, details }`" and the human case as `{ handoff: {...} }`. Nesting both keeps the envelope's top level to `status` plus one status-specific member, which is easier to narrow in every language.

**`pending` was added to the event `ladder` enum.** The brief's list omitted it. Without it a long-running action has no event, and the analytics funnel would show those calls as missing rather than as in-flight.

**`payment.wire-instructions` from the brief became `payment.wire-confirmation`.** Well-known kinds name what the agent _submits_. For a wire transfer the site supplies instructions in `accepts[].instructions` and the agent submits a confirmation (reference number, amount, date). The brief's own worked example already used `payment.wire-confirmation`; this resolves the inconsistency in favor of the example.

**Tokens are HMAC-SHA256 signed and the server keeps state; the wire token carries no state.** Format: `base64url(header).base64url(payload).base64url(signature)`, where payload holds the token type, a random id, the action name, a hash of the originating input, the `onBehalfOf` identity if any, and expiry. Server-side `state` is stored in a `TokenStore` keyed by id. Encrypting state into the token was considered and rejected: it makes tokens large, leaks size information about state, and makes "single use" impossible without a store anyway.

**Tokens are single-use by default, with an opt-in for multi-use continuation tokens.** A `needs_input` that offers three alternatives should not require three separate tokens, but a token that has been _consumed by a successful continue_ must not be replayable. The store marks a token consumed when the handler returns `ok`, `needs_human`, `pending`, or a further `needs_input` (which mints a new token). A `continue` that fails validation does not consume the token, so the agent can fix the payload and retry.

**Idempotency keys are scoped to `(action, idempotencyKey, onBehalfOf)`.** Two users sharing a key must not collide. A replay with a different input hash returns a `conflict` error rather than the cached result, because silently returning a result for different input is how double bookings hide.

**Default idempotency window is 24 hours; the store interface takes a TTL so integrators can change it.**

**Affordance target validation is two-phase.** Pointers into an action's own output schema are validated at `register()`. References to other actions are validated when the target is already registered, and any still-unresolved references are validated at finalization (first request or `describe()`). Requiring registration order would make large action sets painful to maintain.

**The `_axe` key is stripped from `output` and from every item before output validation and before display resolution reads dynamic affordances.** It may not appear in the declared output schema; registration rejects that.

**MCP tool names replace `.` with `_` and keep `-`.** `units.search` becomes `units_search`. `axe_continue` and `axe_resume` are reserved; an action whose derived name collides with a reserved name is rejected at MCP server creation with an error naming the action.

**`policies.agents` uses exact vendor string match, case-insensitive.** Wildcards were considered and deferred; a vendor list in v0 is short.

## Presentation

**`display` is validated against the JSON Schema, not against the Zod type.** Pointers are resolved by walking `properties`, `items`, `$ref`/`$defs`, `anyOf`/`oneOf`/`allOf`. Walking the Zod internals would tie the SDK to Zod's private API.

**`toHTML()` emits no inline script from site data and no event handlers as attributes.** One static `<script>` block, authored in the SDK and identical for every render, attaches click handlers that read `data-*` attributes and dispatch `axe:select`. Every string from the site is HTML-escaped; every URL is validated to be `https:` or `http:` before being emitted as an `href` or `src`.

## Analytics

**Events carry no PII and no payloads by construction.** The event type has no field for input, output, or payload. `onBehalfOf` is not on the event. `agent` is the self-identification the agent sent, which is not the end user.

**The OpenTelemetry sink is structurally typed.** It accepts any object with a `createCounter`/`createHistogram` meter shape and an optional tracer, so `@axe/core` has no dependency on `@opentelemetry/api`. The doc shows passing the real API objects.

## Audit

**Weights live in one JSON file (`packages/testing/src/audit/weights.json`).** Categories: Discoverable 20, Describable 25, Presentable 15, Actionable 20, Trustworthy 20. Each check has a weight within its category; the category score is the weighted fraction passed, scaled to the category total. Agent-directed imperatives are a hard failure that zeroes the Trustworthy category regardless of other checks, because a manifest that tries to steer the agent is not trustworthy no matter how well it does elsewhere.

**Cloaking is not scored, only surfaced.** The audit cannot prove parity without a browser and a semantic diff of the human page. It prints the URLs to compare and, with `--browser`, fetches them and looks for the price and availability strings from the agent response in the human page. A miss is reported as a warning, not a score deduction, because false positives on dynamic pages would teach teams to ignore the section.
