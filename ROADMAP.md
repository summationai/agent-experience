# Roadmap

Two parts. **Priorities** is what comes next, in order, and why. **Deferred** is what v0 deliberately leaves out, with the reason and what v0 does instead.

The order follows the product direction set in the [2026-09-24 review](docs/review/2026-09-24/README.md): make the SDK a reliable way to expose an application's existing capabilities to people and agents, with consistent behavior, explicit permissions, understandable state, and recoverable execution, reached through agent interfaces that already exist (MCP, WebMCP, browser agents). Wider adoption of the AXE protocol is not the goal in itself.

Each priority is labeled:

- **Open SDK primitive**: belongs in this repository, under its license, usable without any service.
- **Commercial hypothesis**: a possible hosted offering built on the primitives. It is a hypothesis to test with pilot users, not a plan, and nothing in this repository depends on it. No pilot has run yet; [docs/pilot-plan.md](docs/pilot-plan.md) describes one.

This repository will not build a hosted registry, billing, an identity provider, a payment platform, or hosted analytics as part of this roadmap.

## Priorities

1. [Capability and permissions inspector](#capability-and-permissions-inspector)
2. [Outcome-based regression evaluation](#outcome-based-regression-evaluation)
3. [Durable execution and observability](#durable-execution-and-observability)
4. [Human review and receipts](#human-review-and-receipts)
5. [Selective discovery](#selective-discovery)
6. [Native adapters](#native-adapters)

### Capability and permissions inspector

**Why.** The first question a team asks before letting an agent act is "what can it do, as whom, right now?" Today the answer is spread across the manifest, each action's `auth`, the Surface bridge's auth options, the tenant resolver, and live availability. An answer that has to be assembled by reading code is one nobody checks before a release.

**What exists.** `axe inspect` prints the manifest and the affordance graph (`packages/cli/src/commands/inspect.ts`). `GET /axe/state` reports availability and reasons per caller (spec §21). The Surface bridge assigns an auth mode per entry and for the read side (`auth` and `authFor` in `packages/surface/src/axe.ts`; review item 05). Principals are resolved in one place (`packages/core/src/principal.ts`; review item 07).

**Next step.** An `axe inspect --as <principal>` mode, and the same as a library function in `@summationai/axe-testing`: for a given credential (anonymous, a site key, a user token) and tenant, list each action and Surface entry with its auth mode, whether this caller may call it, its availability and reason, its risk metadata, and whether it requires approval. Snapshot-testable, so a pull request that widens what an anonymous caller can do shows up as a diff.

**Label.** Open SDK primitive. A hosted view across many apps and environments is a commercial hypothesis.

### Outcome-based regression evaluation

**Why.** Conformance and the audit check the wire and the text; neither shows that a task still completes after a UI change. A renamed control, a moved availability rule, or a new required field can break an agent's path while every check stays green. Outcome checks catch that.

**What exists.** The scripted evaluation harness from review item 17 runs tasks against the reference app and scores outcomes ([docs/evaluation.md](docs/evaluation.md), [item 17](docs/review/2026-09-24/17-evaluation.md)). It is scripted, so it measures whether the application's interface still supports the task, not how well a model performs. The reference app's Node and browser suites (`examples/plan-review`) pin the paths it depends on.

**Next step.** Run the harness as a CI gate on changes to the reference app's UI and to `@summationai/axe-surface`, with a checked-in baseline of task outcomes and a failure that names the task and the step that broke. Then document how an integrator writes tasks for their own app.

**Label.** The harness and the CI gate: open SDK primitive. Hosted evaluation (model-driven runs across agents and model versions, trend history, comparison between releases): commercial hypothesis.

### Durable execution and observability

**Why.** Operations that survive a restart, and a record of what agents did that lands in the application's own audit log, are preconditions for letting agents write to anything that matters. The in-memory defaults lose every open continuation, handoff, and idempotency record on restart.

**What exists.** `IdempotencyStore` and `TokenStore` interfaces with atomic claims (review item 02); `SqliteIdempotencyStore` in `@summationai/axe-core/node`, single host; a Redis pattern in [Deploying](docs/deploying.md#secrets-and-stores); retention limits (item 12). Events (spec/EVENTS.md) with console, JSON-lines, and OpenTelemetry sinks, including spans when `otelSink` is given a tracer. Action events for Surface acts and the approval lifecycle. The Surface ledger (spec/SURFACE.md [S-LED-1] to [S-LED-7]).

**Next step.** A PostgreSQL adapter for both stores, tested with the same barrier-driven concurrency suite as SQLite; a documented recipe for writing action events and the ledger into an application's existing audit table; trace context carried from the incoming request through the handler and the MCP bridge, so one agent task is one trace.

**Label.** Store adapters, event mapping, and tracing: open SDK primitive. Hosted operational visibility (a console of agent operations, handoffs, and failures across apps): commercial hypothesis.

### Human review and receipts

**Why.** In applications where people and agents share work, the useful unit is often "the agent proposes, a person approves". One approval per call does not scale to an agent that prepares twenty changes, to approvals that should go to a delegate, or to rules like "changes under a threshold need no review".

**What exists.** `requestApproval`, `approveHandoff`, and `cancelHandoff` bind an approval to the exact call, principal, tenant, and state; approval events; receipts as the approved operation's output ([Human oversight](docs/human-oversight.md), review item 15). The reference app's approval page.

**Next step.** Batching: one approval for a set of pending calls, each still bound to its own input and state, with partial approval. Then delegation (an approver names who may decide in their place) and a policy hook the application implements to decide which calls need review. Decisions become atomic, which needs a compare-and-set on `TokenStore` (documented as a limit today).

**Label.** Open SDK primitive. A hosted review queue with notifications is a commercial hypothesis.

### Selective discovery

**Why.** Publishing a manifest and waiting for agents to find it does not work: no agent is obliged to look. Discovery that works is discovery the application's owner controls: the MCP server configuration a team hands its agents, a registry the customer runs, WebMCP tools on the page the user is already on.

**What exists.** `/.well-known/axe.json`, `robots.txt` directives, and `axe-index.json` for AXE clients and platforms. `axe mcp <url>` and `serveHttp` for MCP clients, with RFC 9728 metadata. `exposeWebMcp` for pages (`@summationai/axe-surface/webmcp`, review item 14).

**Next step.** A command that prints a ready MCP server configuration for common hosts from a manifest URL, with the auth it needs; documentation of a customer-run registry built on `axe-index.json` (a file the customer serves, not a service this repository runs); and filtering, so a configuration exposes only the actions a given agent should see.

**Label.** Open SDK primitive. A hosted registry is not planned (see [Deferred](#hosted-registry-directory-or-crawler)).

### Native adapters

**Why.** Surface's promise, that an agent sees what a person sees because both come from the same components, holds only where there is a binding for the UI toolkit. Today that is React.

**What exists.** `@summationai/axe-surface` is framework-independent; `@summationai/axe-surface/react` binds it to React (review item 11). Server adapters for Express, Next, and Web-standard handlers.

**Next step.** One more UI binding, chosen by what the first pilot uses (Vue, Svelte, or Angular), written against the same mounted-behavior tests as React. Native mobile and desktop toolkits after that, if a pilot needs them.

**Label.** Open SDK primitive.

## Deferred

What v0 deliberately leaves out, why, and what v0 does instead.

### Server-side flow state machines

**Deferred because** a state machine on the server means the site must persist agent sessions, define transitions, and handle abandonment, which is the kind of quarter-long integration AXE exists to avoid. **v0 instead** chains actions through affordances: each result says what can happen next for each item, with inputs pre-bound. `flows[]` documents the intended path without enforcing it. Continuation and resume tokens carry the only state a multi-step interaction needs, scoped to one action.

### OAuth 2.1 authorization server

**Deferred because** running an authorization server (client registration, consent screens, refresh tokens, device flow) is its own product, and most sites already have one or use a vendor. **v0 instead** supports pass-through of a bearer token the human already granted the agent, and a `login_required` handoff to the site's own login page that binds a resume token to the authenticated user. `@summationai/axe-mcp` over HTTP is an OAuth resource server: it verifies access tokens your authorization server issued and publishes the metadata that points clients at it. `docs/auth.md` shows where an OAuth server plugs in: `authenticate` validates its access tokens, and `userLoginUrl` becomes its authorization endpoint.

### Payment execution and tokenization

**Deferred because** moving money is regulated and already solved by payment service providers; the SDK should never hold card numbers. **v0 instead** defines payment _kinds_ (`payment.card` as a PSP token, `payment.ach-debit` as an authorization, `payment.wire-confirmation`, `payment.invoice`): payload shapes for a credential the site charges through its existing PSP. The SDK validates the shape and never logs it. A valid shape is not an accepted payment, and no agent wallet is known to produce these kinds today.

### Governance for the well-known kind registry

**Deferred because** a registry needs more than one implementation before rules about adding to it are meaningful. **v0 instead** ships thirteen kinds in five namespaces, documents the constraints a new kind must meet (`spec/KINDS.md`), and reserves the `x-<org>.` prefix for site-defined kinds. Proposals are pull requests that touch the spec, the code, the vocabulary, and the generated schema together.

### Site-hosted embeddable result cards

**Deferred because** executing site-supplied HTML inside an agent surface is a prompt-injection and XSS vector, and the agent, not the site, knows its rendering surface. **v0 instead** is data-only: `display` describes which fields matter and how to compare them; the agent renders. Two reference renderers (`toMarkdown`, `toHTML`) show what a faithful rendering looks like, and `@summationai/axe-mcp` shows the escaped `toHTML` output in an MCP Apps view, with scripts removed, for hosts that negotiate the extension.

### Saved searches and alerts

**Deferred because** they require server-side per-user state and a push channel. **v0 instead** makes re-running a search cheap (structured filters, `freshness`, pagination), so an agent can poll on the user's behalf.

### Signed manifests and agent identity attestation

**Deferred because** the trust model is not yet clear: who signs, who verifies, and what a signature proves about behavior. **v0 instead** relies on HTTPS for manifest integrity, `context.agent` and `User-Agent` for agent self-identification, and `policies.agents` for allow and deny lists. Reputation is built from observed behavior (parity, handoff rate, error rate), as the spec says plainly.

### Multi-language SDKs

**Deferred because** the protocol needs to settle before three implementations chase it. **v0 instead** keeps the wire protocol plain JSON over HTTPS with published JSON Schemas for every document, so a Python or Go server is a small amount of glue: serve a manifest, validate input against JSON Schema, sign HMAC tokens, return envelopes. Nothing in the protocol depends on TypeScript or Zod.

### Hosted registry, directory, or crawler

**Deferred because** a directory is a product with its own operational and trust questions, and discovery by publishing and hoping is not the value path (see [Selective discovery](#selective-discovery)). **v0 instead** defines `axe-index.json` so platforms can publish their tenants, and `robots.txt` directives so crawlers can find manifests.

### Hosted analytics dashboard

**Deferred because** every team already has a place to put events. **v0 instead** defines the event schema (`spec/EVENTS.md`), ships console, JSON-lines, and OpenTelemetry sinks, and documents the day-one queries in `docs/analytics.md`. Operational visibility across apps is listed above as a commercial hypothesis, not as work in this repository.

### Platform plugins (Shopify, WordPress/WooCommerce, Squarespace, Mindbody, Yardi)

**Deferred because** each is a distribution effort with its own review process. **v0 instead** makes the multi-tenant core (`tenant` resolver, per-tenant manifests, `axe-index.json`) so that each plugin is a thin shell: one action set, one resolver, one index.

### Agent-side reputation or trust-signal format

**Deferred because** the signals agents will actually use are not known yet. **v0 instead** exposes the raw material: `display.item.url` for parity checks, `examples[]` against live responses, and the audit's honesty checks.

### Browser-extension fallback

**Deferred because** an extension that drives arbitrary human UIs well is a separate project. **v0 instead** gives browser agents what the application knows: a Surface's controls carry their names, states, and reasons in the DOM, `expose` publishes the registry on the page, and `exposeWebMcp` registers the controls as WebMCP tools where the browser supports it. For a step only a person can take, `humanFallbackUrl` and structured handoffs send the person to it.

### Streaming results

**Deferred because** the result envelope is a single JSON document and every consumer (MCP, plain fetch) handles that today. **v0 instead** provides `pending` with polling for long-running work and pagination for large result sets.

### Webhooks and push

**Deferred because** push requires agents to run servers and sites to manage subscriptions. **v0 instead** uses `pending` polling for asynchronous work; `docs/deploying.md` notes where a webhook would attach later.
