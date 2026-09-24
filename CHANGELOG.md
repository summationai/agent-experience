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

### Generate

- `@axe/generate`: derive AXE actions from definitions an application already has, so the manifest follows the definition instead of being written beside it. `fromOpenAPI` maps every OpenAPI 3.x operation to an action (name from the operationId or the method and path, flags and default risk by method, auth from the security requirements, input from parameters plus the JSON request body, output from the 2xx response, an HTTP handler that maps upstream statuses to AXE error codes) with an in-house JSON Schema → Zod converter for the common subset. `fromFunctions` takes a table of zod-typed functions; `fromTRPCRouter` reads a tRPC router structurally, without depending on tRPC. `generate` merges sources, applies per-action overrides and a policy (`exclude`, `include`, `defaultRisk`, `maxRisk`, `requireInputDescriptions`), runs the honesty lints, and returns actions, warnings, and provenance; `registerGenerated` registers the result.
- Honesty: the generator never invents a description, a risk for a mutation, a display shape, or a human URL. An operation missing one is left out with a warning naming the operation and the field, until an override supplies it.
- `axe generate <openapi.json> [--base-url] [--out axe.json] [--code axe.ts]`: prints what was generated and why anything was left out, writes a static manifest for review, and emits a starter module with one TODO per gap. JSON input only.
- Docs: `docs/generating.md`. Vocabulary: `axe generate` and the `@axe/generate` API names.

### Website

- `site/`: a static marketing and documentation site built from `docs/`, `spec/`, and the root Markdown files. Runs from `file://` with no network; `site/dist/` is committed and reproducible. Landing page with the escalation-ladder demo (real envelopes), the search → present → select demo (real `toHTML()` output), an embedded `axe audit` report, and a docs hub generated from `docs/README.md`. Tests: reproducible build, offline load in Chromium/Firefox/WebKit, link check, demo behavior, responsive screenshots, Lighthouse ≥ 95.
