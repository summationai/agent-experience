# Changelog

All packages version together. Entries are generated from changesets on release; this file also records protocol-level changes by hand.

## 0.1.0 (unreleased)

Initial release of the Body Spray SDK and the `axe/0.1` protocol.

- `spec/`: AXE-PROTOCOL.md, KINDS.md, EVENTS.md, VOCABULARY.md, generated JSON Schemas.
- `@axe/core`: `createAXE`, `action`, result envelope, escalation ladder with signed tokens, idempotency, auth modes with login handoff, multi-tenant manifests and platform index, display and affordance validation, well-known kinds, honesty lints, events and sinks.
- `@axe/client`: discovery, invoke/continue/resume/poll, `run()` with fulfillers, `present`/`toMarkdown`/`toHTML`.
- `@axe/mcp`: derived MCP server over stdio and Streamable HTTP.
- `@axe/express`, `@axe/next`, `@axe/fetch`: adapters.
- `@axe/testing`: conformance suite, AXE audit, vocabulary drift check, test helpers.
- `axe` CLI: init, validate, inspect, preview, conformance, audit, mcp.

### Surface

- `spec/SURFACE.md`: the Surface contract (v0.2), ported from the sumapps trials and rewritten on top of the AXE envelope: live controls with `state.reason`, `effect` as AXE risk metadata, one revision per application, refusals as `conflict` / `not_found` / `invalid_input` / `unavailable`, and `requires` (AXE kinds) plus `handoff` on unavailable controls.
- `@axe/surface`: `createSurface` (registry, `observe`, `act`, revision, ledger, `expose`), `@axe/surface/react` (`useSurface`), and `@axe/surface/axe` (`surfaceActions`: any surface becomes an AXE manifest with `<ns>.observe` and `<ns>.act`, refusals mapped onto the ladder, `continue` running the application's `fulfill`).
- Vocabulary: a "Surface" section in `spec/VOCABULARY.md` (entry kinds, ops, field names, API names) so the drift test covers the new package.

### Live state

- Protocol §21 (additive, still `axe/0.1`): a site MAY publish a revision. Every result envelope gains optional top-level `rev`; requests to `/axe/actions/{name}`, `/axe/continue`, and `/axe/resume` gain optional `expectedRev`; a stale `expectedRev` is `conflict` with `details: { expectedRev, currentRev }` and nothing applied, checked after the idempotency replay and before the handler or a login handoff. Actions gain optional `availability` (`{ available, reason?, requires?, handoff? }`), the manifest gains `live: { rev?, url? }`, and `GET /axe/state` serves `{ rev?, actions }` per caller with `Cache-Control: no-store`. `unavailable` errors MAY carry `details: { reason, requires?, handoff? }`. Rules P-LIVE-1 to P-LIVE-10; `spec/schemas/state.schema.json`.
- `@axe/core`: `createAXE({ revision })`, `action({ availability })`, handler context `availability` and `expectedRev`, `unavailable()` helper, `describeLive()`, lint rule `unavailable-without-reason`.
- `@axe/client`: `expectedRev` on `invoke`, `continue`, `resume`, and `run` (tracked through the ladder), `state()`, `live()`, `stateToMarkdown`; `present` carries `rev` into `toMarkdown` and `toHTML`.
- `@axe/mcp`: `axe_state` tool when the manifest carries `live`, `expectedRev` argument on action tools, availability in tool descriptions, stale `conflict` and `unavailable` explained.
- `@axe/testing`: six `live.*` conformance checks (skipped without `live`), audit check `actionable.live-state`.
- `@axe/surface`: a stale act's `details` are `{ expectedRev, currentRev }` (was `{ rev, expectedRev }`); `surfaceActions` reads the envelope's `expectedRev` and accepts `input.expectedRev` as a deprecated fallback; pass `revision: surface.currentRev` to `createAXE`.

### Website

- `site/`: a static marketing and documentation site built from `docs/`, `spec/`, and the root Markdown files. Runs from `file://` with no network; `site/dist/` is committed and reproducible. Landing page with the escalation-ladder demo (real envelopes), the search → present → select demo (real `toHTML()` output), an embedded `axe audit` report, and a docs hub generated from `docs/README.md`. Tests: reproducible build, offline load in Chromium/Firefox/WebKit, link check, demo behavior, responsive screenshots, Lighthouse ≥ 95.
