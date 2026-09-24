# Decisions

Every non-obvious judgment call made while building AXE v0, with the reasoning. Entries are grouped by area and dated. When a decision is revisited, the original entry is edited in place and the change is noted, so this file reads as the current state of the design rather than as a changelog.

If you disagree with something here, open an issue that quotes the entry. Most of these are reversible before 1.0.

## Repository and tooling

**The project was built in an `axe/` folder of a larger monorepo and then moved to its own repository, `summationai/agent-experience`.** It was self-contained from the start (its own `package.json`, lockfile, CI workflow, and lint configuration), so the move was a history-preserving extraction of that subtree with `axe/` as the new root and no code changes beyond repository URLs. The fresh-clone verification script handles both layouts: it archives the current `git` subtree when the project sits in a subdirectory and the whole repository otherwise.

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

## Implementation (added during the build)

**`@axe/core/types` is a zod-free subpath.** The wire types live in `types.ts` with no runtime imports so that `@axe/client` and `@axe/mcp` can import them without pulling Zod into an agent's bundle. `@axe/core/display`, `/vocabulary`, and `/lint` are likewise zod-free.

**Generated vocabulary exports one frozen object per category, plus `WIRE`.** Agent-side packages `import * as WIRE from "@axe/core/vocabulary"` so bundlers drop the categories they do not use (`field` and `api` are the large ones and are only needed for docs tooling). Server-side code uses `import { WIRE }`. Both read as `WIRE.status.ok`. All `Object.freeze` calls carry `@__PURE__` so tree-shaking works. This is what keeps `@axe/client` under 15 kB.

**Stored `accepts[]` schemas are JSON Schema, and `/axe/continue` validates with the SDK's own validator.** A pluggable `TokenStore` (Redis, KV) can only hold JSON, so Zod schemas cannot travel with the token record. The wire form is JSON Schema anyway, so the server converts once at `needs_input` time and validates the payload against the stored JSON Schema on continue. The same validator runs in the conformance suite and the audit, which never hold Zod schemas. Consequence: Zod refinements (`.refine()`) on a kind schema are not enforced on continue; document the JSON-Schema-expressible subset as the contract.

**`_axe` stays on the wire; validation uses a stripped copy.** Agents need dynamic affordances, so the runtime validates the output with `_axe` removed and then sends the original output unchanged.

**Mutating actions require an idempotency key by default (`requireIdempotencyKey: true`).** The brief's fifth principle says mutating actions require idempotency keys. A curl user hits this immediately, and the error message says exactly what to add. Sites can turn it off; the conformance suite then warns instead of failing.

**Idempotency key presence is checked before the login handoff.** Otherwise an anonymous agent would receive a `login_required` handoff, send the human to log in, and only then learn its request was malformed. The key is stored with the login record and reused when the action re-runs after sign-in.

**Login handoffs are gated on `completeHandoff`; site handoffs are not, unless they ask.** The runtime's own `login_required` handoff cannot know whether the human signed in without the site telling it, so resume returns `conflict` with `handoffStatus: "open"` until the login page calls `completeHandoff(id, { onBehalfOf })`. A site-authored handoff resumes straight into `onResume` by default, because the site's own code can check the real-world state; `requireCompletion: true` opts into the same gate.

**Handoff ids are the token id, passed as `axe_handoff` in the URL.** The human's browser sees the id, never the signed resume token. Knowing the id lets a page call `completeHandoff`, which is a server-side call the site controls, and nothing else.

**Continue and resume re-establish identity and compare it with the token's binding.** A token minted for user A presented with user B's credentials, or anonymously, is `not_found`, not `forbidden`, so the response does not confirm that the token exists.

**`@axe/mcp` uses the low-level `Server` from the MCP SDK, not `McpServer.registerTool`.** `registerTool` takes Zod schemas; a remote manifest gives JSON Schema. The low-level `tools/list` handler accepts JSON Schema directly. Tool arguments are validated with the SDK's own JSON Schema validator before the action is invoked, so the model gets the same `invalid_input` shape either way.

**MCP tool calls poll `pending` results for up to 20 seconds before returning.** Most models handle one tool result better than a poll loop. Past the budget the result says to call `axe_poll`.

**The CLI loads `axe.ts` with `tsx`'s programmatic API.** Node 20 cannot strip types. `tsx` is the one dependency the CLI carries beyond the workspace packages; `node:util.parseArgs` and `node:readline` cover argument parsing and prompts.

**The CLI is ESM-only.** It uses `import.meta` and `tsx/esm/api`; nobody `require()`s a CLI.

**`axe conformance` calls mutating actions.** It is meant to run against staging: it invokes each mutating action's example, replays it, and exercises continue, resume, and tamper checks. `--no-mutate` skips those, and a `policies.agents` deny for the conformance vendor forces the same.

**Audit weights: hard failures zero their category, and the fix list is sorted by recoverable points.** A team should be able to read the top three fixes and know what to do this afternoon.

**The audit's cloaking section fetches `display.item.url` and looks for the agent-facing values as text.** This is a spot-check, reported as `✓` or `?` per value, never a deduction. Pages render numbers in many formats; a false accusation would teach teams to ignore the section.

**Screenshots of `toHTML()` are generated by `scripts/render-previews.mjs` with Playwright against the apartments example.** They are committed so the docs render on GitHub without a build step, and regenerated whenever the renderer changes.

**API reference is generated into `docs/api/reference/` so the hand-written `docs/api/README.md` survives regeneration.** TypeDoc's `cleanOutputDir` would otherwise delete the orientation page. The Zod re-export is marked `@hidden` so the reference does not include all of Zod.

**The drift test scans inline code spans in `spec/`, `docs/` (excluding `docs/api/`), and the README.** Example action names (`units.search`) and custom kinds (`x-oakridge.…`) are exempt by classification, not by allowlist. Dotted paths such as `policies.rateLimit` are checked segment by segment for camelCase segments only.

**Drift classification details.** snake_case tokens are only an error when they are within edit distance 2 of a vocabulary status, error code, ladder value, reason, or query name (`need_input`, `not_founds`), because site-specific reason codes and example ids (`u_204`) are legitimate. camelCase tokens are strict. Kind payload field names are vocabulary (`payload` category) because they are wire names agents must spell exactly. Enumeration members count as "used in source" when the whole enumeration is consumed (`z.enum(Object.values(WIRE.risk))`).

**Handlers receive `identity` and `siteKey`, and tokens are scoped to the acting principal.** Documentation review found that `Identity.claims` and the `id` returned by `verifySiteKey` were declared but never reached handlers. Both now arrive on every handler context. When a `site` call carries no user identity, the key's `id` (as `site:<id>`) scopes idempotency keys and tokens so two partners reusing the same `idempotencyKey` never collide; `context.onBehalfOf` remains the end user only.

**Runtime agent-read text is checked for agent-directed instructions.** Registration already rejects them in static text; text built at runtime (`message`, `instructions`, `whatAgentShouldSayToUser`, `accepts[].description`) is checked when the result is materialized. A match becomes an `internal` error and an `onError` report, so a site bug never reaches an agent as an instruction.

**`document.base64` payloads are capped at 10 MiB decoded, enforced on `/axe/continue`.** The spec said so; the code now does. Larger documents use `document.url`.

**Prettier does not format `docs/**/*.md` or the README.** It reformatted included code blocks (and turned fences into four backticks), which made every include stale. The include script owns those blocks.

## Site

**The site is a build output of the docs, not a second copy of them.** `site/build.mjs` renders `docs/**`, `spec/*.md`, and the root Markdown files with one template; the landing page pulls code from `docs/examples/` and prose from `docs/why-axe.md` through include markers, the docs hub and sidebar come from the ordered list in `docs/README.md`, and the demo data is produced by running `docs/examples/apartments/site.ts` in-process. Changing a sentence on the landing page means changing the doc it comes from.

**`site/dist/` is committed.** The deliverable is a directory someone double-clicks. Reproducibility is a test: two builds must hash identically, and the committed output must match a fresh build. The clock and `crypto.randomUUID` are pinned while the fixtures run so tokens, ids, and expiry timestamps are the same on every build; the audit report's timestamp is replaced with a fixed phrase.

**The Open Graph image is the one non-reproducible byte sequence.** It is rendered by a browser, and text rasterization differs across machines. It is excluded from the reproducibility hash and from the CI freshness diff. Rendering it deterministically would require bundling a font and a pure rasterizer, which is more machinery than one social card justifies.

**Mermaid is rendered with `beautiful-mermaid`, a pure-JavaScript renderer.** It is synchronous, has no DOM dependency, and produces identical SVG on every machine, which the mermaid CLI (headless Chromium, system fonts) does not. Its Google Fonts `@import` is stripped so the SVG makes no network request; the diagram uses the system font stack through CSS variables so it inverts with the theme. Each diagram carries an ASCII rendering and its source behind a disclosure as the text alternative.

**Shiki runs at build time and emits classes, not inline styles.** Dual-theme inline styles cost about 45 bytes per token. Identical light/dark color pairs become short class names (`t0…tN`, assigned in a deterministic order) with the pairs emitted once as CSS custom properties; two rules switch between them for the theme. Consecutive same-style tokens are merged.

**The page script is inlined and minified; data loads on intent.** Lighthouse's simulated LCP counts every script the page requests, deferred or not, so an external `site.js` plus the demo data would have cost ten points. The script is inlined (one classic `<script>`, no module, works from `file://`); the ladder envelopes and the rendered search (`fixtures.js`) load when the demos come within 800 px of the viewport or are interacted with; the search index (`search-index.js`) loads when the search control is hovered, focused, or opened. Both are classic scripts injected by the page, never `fetch()`, so `file://` works. A reader who never scrolls never downloads them. The brief's "embedded as a `<script type="application/json">`" became a shared deferred data script for this reason; nothing is fetched.

**The stylesheet is one file with landing-only and docs-only regions.** Each page type inlines only the regions it needs plus the shared ones. Inline CSS removes a render-blocking request; region splitting keeps the inlined bytes down.

**The rendered search is a sandboxed `srcdoc` iframe.** It is the unmodified output of `toHTML()`, including the renderer's one static script. `sandbox="allow-scripts"` lets that script dispatch `axe:select`; the iframe posts the selection to the parent, which binds the unit id into the ladder demo. The only alternative that keeps the output unmodified is an iframe.

**Lighthouse runs against a local port with gzip, best of up to three runs.** Lighthouse does not audit `file://` URLs; the test serves `dist/` on a loopback port for the run only, compressed the way any static host would serve it, because Lighthouse's simulated network time is a function of transfer size. Simulated metrics vary run to run by a point or two, so the test takes the best of up to three runs, which is Lighthouse's own recommendation for stable scores. Both audited pages score 96 on performance and 96 to 97 on accessibility at the time of writing.

**Screenshot baselines are compared only on the platform that produced them.** Font rasterization differs between macOS and Linux; the baselines record their platform, and the comparison is skipped elsewhere rather than failing on noise. `--update-screenshots` regenerates them.

**TypeDoc output is rendered like any other Markdown, with unresolvable links unwrapped.** TypeDoc links to Node's types and to source lines; sources are disabled (they embedded a commit hash and pointed at the wrong repository), and links to symbols the reference does not contain become plain text so the link checker stays strict for everything else.

**Root README badges are dropped from the site.** They are images from shields.io; the site is offline-complete. The alt text is rendered instead.
