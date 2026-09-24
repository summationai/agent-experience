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
- Two defects from the first staging trial pinned as contract rules with tests: `act` refuses any `target` that is not a non-empty id or a non-negative integer index as `invalid_input` before any lookup, an index never resolves to a row without one, and the revision guard runs before resolution ([S-ACT-6..8]); applications must re-register on transient states ([S-REV-5]), with `freeze(reason)` / `thaw` as the first-class helper: every entry unavailable with the reason, `observe().frozen`, acts `unavailable`, revision moved on both ends, nested freezes counted ([S-FRZ-1..4]).
- DOM mirror: `surfaceAttributes`, `surfaceSelector`, and `describeEntry` in `@axe/surface`, and `useSurfaceProps` in `@axe/surface/react`, so the accessible name a browser agent or screen reader reads is the entry name by construction. Spec §7 is now a rule set: [S-DOM-1] (name wording and the attribute set), [S-DOM-3] (the selector contract), [S-DOM-4] (the one-line description); a `domAttribute` vocabulary category names the attributes.
- Ledger (`spec/SURFACE.md` [S-LED-1..7]): every `act`, run or refused, appends `{ seq, at, op, target, actor, revBefore, revAfter, status, text?, changed }`; `ledger({ since, actor, limit })` reads it oldest first under bounded retention (`ledger.max`, default 1000); `observe()` carries `ledgerSeq` and every act result its `seq`; `expose` publishes `ledger`. The bridge adds `<ns>.ledger` (read-only, with `display`) and emits one action event (`surface.act`) per act on the server's `onActionEvent` sinks ([S-AXE-4]). In `@axe/core`: action events (`spec/EVENTS.md` [E-5..7], `schemas/action-event.schema.json`), `emit` on the handler context, `onActionEvent` on `createAXE`, and `consoleSink`/`jsonlFileSink` accept them.

### Live state

- Protocol §21 (additive, still `axe/0.1`): a site MAY publish a revision. Every result envelope gains optional top-level `rev`; requests to `/axe/actions/{name}`, `/axe/continue`, and `/axe/resume` gain optional `expectedRev`; a stale `expectedRev` is `conflict` with `details: { expectedRev, currentRev }` and nothing applied, checked after the idempotency replay and before the handler or a login handoff. Actions gain optional `availability` (`{ available, reason?, requires?, handoff? }`), the manifest gains `live: { rev?, url? }`, and `GET /axe/state` serves `{ rev?, actions }` per caller with `Cache-Control: no-store`. `unavailable` errors MAY carry `details: { reason, requires?, handoff? }`. Rules P-LIVE-1 to P-LIVE-10; `spec/schemas/state.schema.json`.
- `@axe/core`: `createAXE({ revision })`, `action({ availability })`, handler context `availability` and `expectedRev`, `unavailable()` helper, `describeLive()`, lint rule `unavailable-without-reason`.
- `@axe/client`: `expectedRev` on `invoke`, `continue`, `resume`, and `run` (tracked through the ladder), `state()`, `live()`, `stateToMarkdown`; `present` carries `rev` into `toMarkdown` and `toHTML`.
- `@axe/mcp`: `axe_state` tool when the manifest carries `live`, `expectedRev` argument on action tools, availability in tool descriptions, stale `conflict` and `unavailable` explained.
- `@axe/testing`: six `live.*` conformance checks (skipped without `live`), audit check `actionable.live-state`.
- `@axe/surface`: a stale act's `details` are `{ expectedRev, currentRev }` (was `{ rev, expectedRev }`); `surfaceActions` reads the envelope's `expectedRev` and accepts `input.expectedRev` as a deprecated fallback; pass `revision: surface.currentRev` to `createAXE`.

### Website

- `site/`: a static marketing and documentation site built from `docs/`, `spec/`, and the root Markdown files. Runs from `file://` with no network; `site/dist/` is committed and reproducible. Landing page with the escalation-ladder demo (real envelopes), the search → present → select demo (real `toHTML()` output), an embedded `axe audit` report, and a docs hub generated from `docs/README.md`. Tests: reproducible build, offline load in Chromium/Firefox/WebKit, link check, demo behavior, responsive screenshots, Lighthouse ≥ 95.
