# FAQ

Direct answers to the questions integrators and agent builders ask first. Where another standard does a job better, this page says so and shows how AXE defers to it or sits beside it.

### How is this different from MCP?

They solve different problems and compose. AXE is a site's declaration and HTTP protocol: a manifest at `/.well-known/axe.json`, actions invoked with plain JSON, a result envelope with an escalation ladder, and presentation hints. The Model Context Protocol is a transport and tool protocol between a model host and a server; it says how tools are listed and called, not what a business exposes or how it is found.

`@axe/mcp` derives an MCP server from any manifest: each action becomes a tool with the same JSON Schema, `needs_input` results list the accepted kinds and point at `axe_continue`, `needs_human` results carry the handoff text and point at `axe_resume`, and `pending` points at `axe_poll`. `axe mcp <url>` runs it over stdio; `serveHttp` mounts it on the Streamable HTTP transport.

What MCP alone does not give a site: discovery at a domain (there is no well-known path for "the MCP server for this business"), an escalation ladder (a tool either returns or errors), `display` hints, and human handoff semantics (no `resumeToken`, no `whatAgentShouldSayToUser`). If your only consumer is one MCP client, write the tool directly. If you want every agent to find you, write the manifest and derive the tools. Details in [MCP](mcp.md).

### How is this different from OpenAPI?

OpenAPI describes HTTP endpoints for developers: paths, verbs, parameters, response codes. AXE describes capabilities for agents: what an action does in a model-readable `description`, what it commits the user to (`risk`, `reversible`, `idempotent`), what it needs to finish (`accepts` with typed kinds), how to present its output (`display`), and what to do when a human must act (`handoff`).

You can generate an OpenAPI document from a manifest trivially: one `POST /axe/actions/{name}` operation per action, with the action's `input` and `output` schemas as the request and response bodies. The reverse loses the parts that matter: an OpenAPI document has no place for risk metadata, presentation, requirements a wallet can fulfill, or a resume token, and its `description` fields were written for a human reading a reference page. Keep OpenAPI for developers; AXE is a second, smaller surface for agents. The OpenAPI document is still a good place to start from: [`@axe/generate`](generating.md) derives the parts that carry over (names, flags, schemas, the HTTP call) and asks you for the rest instead of guessing.

### How is this different from llms.txt?

`llms.txt` is prose for a model to read: what a site is, where the important pages are, in Markdown. AXE is typed actions for a model to call. They complement each other and you should publish both if you have both: link the manifest from `llms.txt`, and put `humanFallbackUrl` and `contact` in the manifest so an agent that starts from either finds the other. A site with nothing to do beyond reading should stop at `llms.txt`; see [when not to use AXE yet](why-axe.md#when-you-should-not-use-axe-yet).

### How is this different from schema.org and JSON-LD?

schema.org describes things on pages: an event, an organization, an offer, marked up so a crawler can extract them. AXE describes actions: search, book, upload, apply, return. The well-known kind registry in [`spec/KINDS.md`](../spec/KINDS.md) is the analogue of schema.org vocabulary for requirement payloads: `contact.address`, `identity.government-id`, and `payment.ach-debit` are shared shapes so an agent's wallet and a site agree without negotiation. A site can carry both: keep JSON-LD on the pages for crawlers, and point `display.item.url` at those pages so agent-facing and human-facing data are the same thing.

### How is this different from Agent Protocol and A2A?

Agent Protocol and Agent2Agent are agent-to-agent: one agent delegates a task to another, with task lifecycles, artifacts, and messaging. AXE is site-to-agent: a business declares what it does and an agent calls it directly. An A2A agent that represents a business can wrap that business's AXE manifest, and an orchestrating agent can reach several AXE sites in one task. AXE assumes only that the caller can make HTTP requests and read JSON.

### Is this just SEO for agents?

In shape, yes, and the shape is deliberate. A discoverable declaration, agent-read descriptions, a shared vocabulary, presentation hints, an audit score, a conformance report, and opt-in directives: the [Why AXE](why-axe.md#the-seo-analogy-once) table maps each to its 2000s counterpart.

What the shape implies is a second thing the design takes seriously: SEO produced keyword stuffing, cloaking, and link farms, because a number could be moved by lying. So the protocol has [honesty rules](../spec/AXE-PROTOCOL.md#18-agent-facing-honesty): no instructions to the agent in any agent-read text, no superlatives, parity with the human page, at most six affordances per item, no custom kinds that duplicate well-known ones, consent scoped to what the action needs, truthful metadata. `axe audit` enforces what can be enforced and zeroes the Trustworthy category on an agent-directed imperative. The rest is the agents' job, as the next two answers explain.

### Will agents actually use it?

Adoption is the open question, and nobody can promise it. What makes it likely: discovery is one `GET` to a fixed path, so an agent framework can add AXE support in an afternoon; every manifest is an MCP server without extra work, so the agents people already run can use it today; and a structured `needs_input` or `needs_human` is strictly better for an agent than a screenshot of a form it could not complete.

What v0 does not solve: there is no directory or crawler, so an agent finds a site by starting from its URL, and there is no signed manifest or agent identity attestation. Platforms can publish an index at `/.well-known/axe-index.json` so their tenants are enumerable, and `robots.txt` can carry `AXE-Manifest` and `AXE-Index` lines for crawlers that look. The rest is in [ROADMAP.md](../ROADMAP.md).

### What stops a site from lying to agents?

Four things, in decreasing order of certainty.

1. **Registration and linting.** The SDK refuses a mutating action declared `readOnly`, an example that fails its own schema, a `display` pointer that resolves to nothing, and agent-read text that instructs the agent. `axe validate` runs the same checks in CI.
2. **Audit detection.** `axe audit` flags persuasion, affordance spam, structurally identical custom kinds, and consent bundles, and treats agent-directed imperatives and false `readOnly` as hard failures.
3. **Parity spot-check.** The audit prints the values an agent received next to `display.item.url` and, with a browser, looks for them on the human page. Cloaking is surfaced, not scored, because a false accusation on a dynamic page would teach teams to ignore the section.
4. **Reputation, which belongs to the agent.** There is no central authority. [Spec §18.3](../spec/AXE-PROTOCOL.md#183-reputation) says it plainly: agents build trust from observed parity, handoff rate, error rate, and whether `examples` match live responses, the way search engines built ranking from observed quality. A site that lies is ranked against by the agents it lies to.

### Do I need to rewrite my backend?

No. An action's `handler` is a function; it calls whatever your booking, admissions, leasing, or order code already does. Nothing in AXE requires a new database, a session store, or a state machine; the one interface you may implement is the [idempotency store](concepts.md#idempotency) for multi-instance deployments. Disclosure is progressive: start with one read-only action, as [Getting started](getting-started.md) does, and add a mutating action, a requirement, or a handoff when you are ready. Nothing shipped earlier changes.

### Does AXE process payments?

No, and it never holds card numbers. Payment kinds carry a credential your payment service provider can charge: `payment.card` is a PSP-issued token, `payment.ach-debit` is an authorization with the NACHA-required text, `payment.wire-confirmation` is a reference number after the fact, `payment.invoice` is billing details for net terms. Your `onContinue` hands the payload to the PSP you already use. The SDK validates the shape and never logs the payload. Payment execution and tokenization are out of scope by design; see [ROADMAP.md](../ROADMAP.md).

### What about authentication and OAuth?

Three modes: `none` for public reads, `site` for an API key you issue to an agent operator (your `verifySiteKey` function decides), and `user` for acting on behalf of a specific person. In `user` mode an agent can pass through a bearer token the person already granted it, mapped to `onBehalfOf` by your `authenticate` function; when no identity can be established, the server returns a `login_required` handoff to your `userLoginUrl`, and the resume token is bound to whoever signs in. The claimed identity in the request body is never trusted.

No OAuth 2.1 authorization server ships in v0. Most sites have one or use a vendor, and running one is its own product. [Auth](auth.md) shows where yours plugs in: its access tokens go through `authenticate`, its authorization endpoint becomes `userLoginUrl`.

### Can I use it from Python or Go?

The wire protocol is plain JSON over HTTPS with published JSON Schemas for the manifest, the request, the result envelope, the index, the event, and every kind, under [`spec/schemas/`](../spec/schemas/). A server in another language serves a manifest, validates input against JSON Schema, signs HMAC-SHA256 tokens, and returns envelopes. An agent client is a `GET` and a `POST`. Nothing depends on TypeScript or Zod. SDKs for other languages are deferred until the protocol settles; see [ROADMAP.md](../ROADMAP.md). `axe conformance` runs against any URL, so a port proves itself the same way the reference does.

### How do I opt a specific agent out?

Declare it in `policies.agents`. `deny` wins over `allow`; an absent `allow` permits every vendor not denied. Matching is exact and case-insensitive against `context.agent.vendor`.

```json
{
  "policies": {
    "agents": { "deny": ["ScrapeCo"] }
  }
}
```

Agents must not call actions on a site whose policy denies their vendor; servers built with the SDK also enforce it and return `forbidden`. The directives in `robots.txt` are discovery hints only and say nothing about access; the policy is the mechanism. See [spec §3.4](../spec/AXE-PROTOCOL.md#34-opting-out).

## Next steps

- [Why AXE](why-axe.md): the problem, the analogy, and when to wait.
- [MCP](mcp.md): the derived server and its limits.
- [Auth](auth.md): the three modes and the v1 OAuth path.
- [Security](security.md): the threat model and what your site must still do.
