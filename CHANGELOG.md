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
- Ledger (`spec/SURFACE.md` [S-LED-1..7]): every `act`, run or refused, appends `{ seq, at, op, target, actor, revBefore, revAfter, status, text?, changed }`; `ledger({ since, actor, limit })` reads it oldest first under bounded retention (`ledger.max`, default 1000); `observe()` carries `ledgerSeq` and every act result its `seq`; `expose` publishes `ledger`. The bridge adds `<ns>.ledger` (read-only, with `display`) and emits one action event (`surface.act`) per act on the server's `onActionEvent` sinks ([S-AXE-4]). In `@axe/core`: action events (`spec/EVENTS.md` [E-5..7], `schemas/action-event.schema.json`), `emit` on the handler context, `onActionEvent` on `createAXE`, and `consoleSink`/`jsonlFileSink` accept them.

### Website

- `site/`: a static marketing and documentation site built from `docs/`, `spec/`, and the root Markdown files. Runs from `file://` with no network; `site/dist/` is committed and reproducible. Landing page with the escalation-ladder demo (real envelopes), the search → present → select demo (real `toHTML()` output), an embedded `axe audit` report, and a docs hub generated from `docs/README.md`. Tests: reproducible build, offline load in Chromium/Firefox/WebKit, link check, demo behavior, responsive screenshots, Lighthouse ≥ 95.
