# Glossary

Every term in these docs, alphabetically, linking to the page that defines it. Code-font names are spelled as [`spec/VOCABULARY.md`](../spec/VOCABULARY.md) spells them.

**action** — One thing an agent can do on a site: a namespaced name such as `classes.search`, agent-facing `title` and `description`, `input` and `output` schemas, safety metadata (`readOnly`, `idempotent`, `reversible`, `risk`, `auth`), and a handler. See [Concepts](concepts.md#action).

**affordance** — A follow-up action that makes sense for an item in a result, with inputs pre-bound. A _static_ affordance is declared under `affordances` with JSON Pointer bindings. A _dynamic_ affordance is returned at runtime under `_axe` with concrete inputs. See [Presenting results](presenting-results.md#affordances).

**agent** — Software acting for a user by reading a manifest and calling actions: a chat assistant with tools, an MCP client, a batch process. Agents identify themselves in `context.agent` and the `User-Agent` header. See [For agent builders](for-agent-builders.md).

**agent-read text** — Every string a model reads from a manifest or result: descriptions, titles, `message`, `instructions`, `disclaimer`, labels, badges, error messages. Subject to the honesty rules and linted at registration. See [spec §18.1](../spec/AXE-PROTOCOL.md#181-agent-read-text).

**audit** — `axe audit`, or `runAudit` behind it. Fetches a live site, scores it across five categories (Discoverable, Describable, Presentable, Actionable, Trustworthy), and prints a fix list ordered by impact. See [Audit](audit.md).

**availability** — The optional `availability` an action declares: `{ available: true }` or `{ available: false, reason, requires?, handoff? }`, computed for the caller when the manifest or `/axe/state` is rendered. A report, not a gate: the handler still refuses, with `unavailable`. See [Live state and revisions](live-state.md#availability-unavailable-because).

**AXE Score** — The 0 to 100 number an audit produces. One hard failure, agent-directed text, zeroes it regardless of the rest. See [Audit](audit.md).

**brand hints** — The optional `brand` object on a manifest: `name`, `logoUrl`, `accentColor`, `tone`. Renderers may use them and must treat them as hints. See [spec §13.2](../spec/AXE-PROTOCOL.md#132-brand-hints).

**conformance** — Whether a live server satisfies every numbered requirement of the spec. `axe conformance` runs the suite against a URL and reports pass, fail, warn, or skip per check. See [Testing and conformance](testing-and-conformance.md#reading-the-report).

**continuation token** — The signed, opaque `continuationToken` in a `needs_input` result, sent back to `/axe/continue` with a `kind` and `payload`. Single-use, valid about 15 minutes. See [Requirements and kinds](requirements-and-kinds.md).

**display** — The optional `display` object on an action: where the list is, the item's `id`, `title`, `url`, `price`, `attributes`, and the `disclaimer` that must accompany any rendering. Data about data, never markup. See [Presenting results](presenting-results.md#annotating-an-output-schema).

**drift test** — The `@summationai/axe-testing` check (`checkVocabularyDrift`) that scans every Markdown page for inline code spans that look like wire names and fails when one is not in the vocabulary. See [Testing and conformance](testing-and-conformance.md).

**escalation ladder** — The order a site responds in when an action cannot complete: `ok`; otherwise ask the agent for something it may hold (`needs_input`); otherwise hand off to the human (`needs_human`). See [Concepts](concepts.md#the-escalation-ladder).

**event** — The one record emitted per handled request: action, `status`, `ladder`, vendor, `latencyMs`, `kind`, `errorCode`, `tenant`. No payloads, no identities. Delivered to the sinks passed to `onEvent`. See [Analytics](analytics.md).

**flow** — A named path through the affordance graph, declared under `flows` with action names as `steps`. Carries no state and imposes no order. See [Concepts](concepts.md#flows).

**fulfiller** — On the agent side, an object that produces a payload for one or more kinds: a wallet, a credential store. `AXEClient` consults its `fulfillers` on `needs_input`. See [For agent builders](for-agent-builders.md).

**handoff** — A structured request that a human do one thing on the site: `reason`, `instructions`, a `url` landing on the step, a `resumeToken`, `expiresAt`, and `whatAgentShouldSayToUser`. Returned as `needs_human` or attached to `needs_input` as `fallback`. See [Human handoff](human-handoff.md).

**honesty rules** — The seven rules in spec §18 for agent-read text and metadata: no instructions to the agent, no persuasion, parity with the human site, affordance restraint, no fake kinds, scoped consent, truthful metadata. See [Audit](audit.md#honesty-rules).

**idempotency key** — The `idempotencyKey` sent with every mutating call. Replaying it with the same input returns the original result without re-running the handler; with different input, `conflict`. See [Concepts](concepts.md#idempotency).

**index** — Also _platform index_. The paginated list of tenant manifests a platform serves at `/.well-known/axe-index.json`: `platform`, `sites` with a `manifestUrl` each, `next` for the following page. Tenant manifests point back with `indexUrl`. See [Platforms](platforms.md#publish-axe-indexjson).

**kind** — The namespaced name of what a requirement asks for. _Well-known_ kinds come from [`spec/KINDS.md`](../spec/KINDS.md), so an agent's wallet can fulfill them automatically. _Custom_ kinds are yours, named `x-<org>.<name>`. See [Requirements and kinds](requirements-and-kinds.md).

**live state** — The optional `live` member of a manifest and the document at `/axe/state`: the site's current `rev` and every action's `availability`, served uncached and per caller. See [Live state and revisions](live-state.md).

**manifest** — The JSON document at `/.well-known/axe.json` an agent reads first: `name`, `description`, `baseUrl`, `auth`, every action, `policies`, `contact`, `brand`. Generated by `describe`, never written by hand. See [Concepts](concepts.md#manifest).

**`needs_human`** — The result status meaning only a human can do the next step. Carries a `handoff`. See [Human handoff](human-handoff.md).

**`needs_input`** — The result status meaning the agent may be able to supply what is missing. Carries `reason`, `message`, an ordered `accepts` list, a `continuationToken`, and an optional `fallback`. See [Requirements and kinds](requirements-and-kinds.md).

**`pending`** — The result status for work that outlasts a request. Carries `pollUrl` and `retryAfter`; the agent polls until a terminal result appears. Produced with `pending`, completed by `onPoll`. See [Concepts](concepts.md#the-result-envelope).

**pointer** — An RFC 6901 JSON Pointer such as `/units` or `/price/amount`. Every `display` location and static affordance binding is one. See [Presenting results](presenting-results.md).

**presented result** — An `ok` result with its `display` applied: items with resolved title, URL, price, attributes, badges, and affordances, ready for `toMarkdown` or `toHTML`. Produced by `present` in `@summationai/axe-client/present`. See [Presenting results](presenting-results.md).

**primary affordance** — The one affordance per item marked `primary`: the default next step. At most one per item. See [Presenting results](presenting-results.md#affordances).

**protocol version** — `axe/0.1`, carried in the manifest `protocol` field, the index, and the `AXE-Protocol` header. Minor versions are compatible; a different major is `unsupported`. See [spec §2](../spec/AXE-PROTOCOL.md#2-versioning).

**requirement** — One entry in `accepts`: a `kind`, `title`, `description`, JSON `schema`, whether it is `sensitive`, and optional `instructions` the agent relays. Built with `accept`. See [Requirements and kinds](requirements-and-kinds.md).

**reserved key `_axe`** — The one member name a site may not use for its own data in an output or item. It carries protocol extensions, today dynamic affordances, and is stripped before display resolution. See [Presenting results](presenting-results.md#affordances).

**result envelope** — The single JSON object every response is: a `status` of `ok`, `needs_input`, `needs_human`, `pending`, or `error`, plus that status's members. Agents branch on `status`, never on the HTTP code. See [Concepts](concepts.md#the-result-envelope).

**resume token** — The signed, opaque `resumeToken` in a handoff. After the human acts, the agent posts it to `/axe/resume` and `onResume` runs with the original state. Single-use, valid about 24 hours. See [Human handoff](human-handoff.md).

**revision** — One opaque value (`rev`) for the whole site that moves with every change an agent could observe, whoever made it. Returned on every result envelope; presented by the agent as `expectedRev`; a mismatch is `conflict` with `expectedRev` and `currentRev` in `details`, and nothing applied. See [Live state and revisions](live-state.md#the-revision).

**risk** — The declared consequence level of an action: `none`, `low`, `medium`, `high`. Agents decide how much to confirm from it; declaring it truthfully is an honesty rule. See [Designing actions](designing-actions.md#choosing-risk).

**sensitive** — The `sensitive` flag on a requirement: the payload is a credential, payment instrument, or personal data. Agents confirm before sending it; it is never logged or put in events. See [Security](security.md).

**site** — In prose, the organization exposing an AXE surface. As the `site` auth mode, the agent itself authenticates with an API key in `Authorization`, checked by `verifySiteKey`. See [Auth](auth.md).

**state** — The JSON value a handler attaches to `needsInput`, `handoff`, or `pending`. It never crosses the wire: stored server-side under the token id and delivered to `onContinue`, `onResume`, or `onPoll`. See [Concepts](concepts.md#handoff-and-resume).

**tenant** — One site among many on a platform: a `TenantInfo` with a stable `id`, its own `baseUrl`, and overrides for the manifest fields that differ between sites. Resolved per request, passed to every handler, recorded on every event as `tenant`. See [Platforms](platforms.md).

**vendor** — The organization operating an agent, sent as `context.agent.vendor`. What `policies.agents` matches for `allow` and `deny`, and what events record. See [spec §17](../spec/AXE-PROTOCOL.md#17-agent-identification-and-rate-limits).

**`whatAgentShouldSayToUser`** — The handoff field that tells the agent how to frame the human step in its own voice: what is needed, why, and that it will continue afterward. Agent-read text, never instructions to the agent. See [Human handoff](human-handoff.md).

## Next steps

- [Concepts](concepts.md) puts these terms together in order.
- [`spec/VOCABULARY.md`](../spec/VOCABULARY.md) is the exact spelling of every name.
- [Protocol spec](../spec/AXE-PROTOCOL.md) is the normative definition behind each entry.
