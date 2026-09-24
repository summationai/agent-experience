# Roadmap

What v0 deliberately leaves out, why, and what v0 does instead. Items are not ordered by priority; the ordering will come from what early integrators hit first.

## Server-side flow state machines

**Deferred because** a state machine on the server means the site must persist agent sessions, define transitions, and handle abandonment, which is the kind of quarter-long integration AXE exists to avoid. **v0 instead** chains actions through affordances: each result says what can happen next for each item, with inputs pre-bound. `flows[]` documents the intended path without enforcing it. Continuation and resume tokens carry the only state a multi-step interaction needs, scoped to one action.

## OAuth 2.1 authorization server

**Deferred because** running an authorization server (client registration, consent screens, refresh tokens, device flow) is its own product, and most sites already have one or use a vendor. **v0 instead** supports pass-through of a bearer token the human already granted the agent, and a `login_required` handoff to the site's own login page that binds a resume token to the authenticated user. `docs/auth.md` shows where an OAuth server plugs in: `authenticate` validates its access tokens, and `userLoginUrl` becomes its authorization endpoint.

## Payment execution and tokenization

**Deferred because** moving money is regulated and already solved by payment service providers; the SDK should never hold card numbers. **v0 instead** defines payment _kinds_ (`payment.card` as a PSP token, `payment.ach-debit` as an authorization, `payment.wire-confirmation`, `payment.invoice`) so an agent wallet can hand the site a credential it can charge through its existing PSP. The SDK validates the payload shape and never logs it.

## Governance for the well-known kind registry

**Deferred because** a registry needs more than one implementation before rules about adding to it are meaningful. **v0 instead** ships thirteen kinds in five namespaces, documents the constraints a new kind must meet (`spec/KINDS.md`), and reserves the `x-<org>.` prefix for site-defined kinds. Proposals are pull requests that touch the spec, the code, the vocabulary, and the generated schema together.

## Site-hosted embeddable result cards

**Deferred because** executing site-supplied HTML inside an agent surface is a prompt-injection and XSS vector, and the agent, not the site, knows its rendering surface. **v0 instead** is data-only: `display` describes which fields matter and how to compare them; the agent renders. Two reference renderers (`toMarkdown`, `toHTML`) show what a faithful rendering looks like. A sandboxed card specification is worth revisiting once agent surfaces converge on one.

## Saved searches and alerts

**Deferred because** they require server-side per-user state and a push channel. **v0 instead** makes re-running a search cheap (structured filters, `freshness`, pagination), so an agent can poll on the user's behalf.

## Signed manifests and agent identity attestation

**Deferred because** the trust model is not yet clear: who signs, who verifies, and what a signature proves about behavior. **v0 instead** relies on HTTPS for manifest integrity, `context.agent` and `User-Agent` for agent self-identification, and `policies.agents` for allow and deny lists. Reputation is built from observed behavior (parity, handoff rate, error rate), as the spec says plainly.

## Multi-language SDKs

**Deferred because** the protocol needs to settle before three implementations chase it. **v0 instead** keeps the wire protocol plain JSON over HTTPS with published JSON Schemas for every document, so a Python or Go server is a small amount of glue: serve a manifest, validate input against JSON Schema, sign HMAC tokens, return envelopes. Nothing in the protocol depends on TypeScript or Zod.

## Hosted registry, directory, or crawler

**Deferred because** a directory is a product with its own operational and trust questions. **v0 instead** defines `axe-index.json` so platforms can publish their tenants, and `robots.txt` directives so crawlers can find manifests.

## Hosted analytics dashboard

**Deferred because** every team already has a place to put events. **v0 instead** defines the event schema (`spec/EVENTS.md`), ships console, JSON-lines, and OpenTelemetry sinks, and documents the day-one queries in `docs/analytics.md`.

## Platform plugins (Shopify, WordPress/WooCommerce, Squarespace, Mindbody, Yardi)

**Deferred because** each is a distribution effort with its own review process. **v0 instead** makes the multi-tenant core (`tenant` resolver, per-tenant manifests, `axe-index.json`) so that each plugin is a thin shell: one action set, one resolver, one index.

## Agent-side reputation or trust-signal format

**Deferred because** the signals agents will actually use are not known yet. **v0 instead** exposes the raw material: `display.item.url` for parity checks, `examples[]` against live responses, and the audit's honesty checks.

## Browser-extension fallback

**Deferred because** driving the human UI is what AXE replaces; a fallback that does it well is a separate project. **v0 instead** provides `humanFallbackUrl` and structured handoffs so the human does the one step that needs a browser.

## Streaming results

**Deferred because** the result envelope is a single JSON document and every consumer (MCP, plain fetch) handles that today. **v0 instead** provides `pending` with polling for long-running work and pagination for large result sets.

## Webhooks and push

**Deferred because** push requires agents to run servers and sites to manage subscriptions. **v0 instead** uses `pending` polling for asynchronous work; `docs/deploying.md` notes where a webhook would attach later.
