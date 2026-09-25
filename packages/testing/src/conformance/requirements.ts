/**
 * Where every numbered requirement in spec/AXE-PROTOCOL.md is verified: by a conformance
 * check id (runs against any URL) or by a named test in a package. A test asserts that
 * every `[P-...]` identifier in the spec appears here.
 */
export type Coverage = { check: string } | { test: string };

export const REQUIREMENTS: Readonly<Record<string, readonly Coverage[]>> = Object.freeze({
  "P-VER-1": [{ check: "manifest.protocol" }],
  "P-VER-2": [{ check: "runtime.protocol-header" }],
  "P-VER-3": [{ check: "runtime.protocol-header" }],
  "P-VER-4": [{ check: "runtime.unknown-fields-ignored" }],
  "P-VER-5": [{ check: "runtime.unsupported-version" }],
  "P-DISC-1": [{ check: "discovery.well-known" }],
  "P-DISC-2": [{ check: "discovery.alias" }],
  "P-DISC-3": [{ check: "discovery.headers" }],
  "P-DISC-13": [
    { test: "@axe/core carries an ETag and answers a matching If-None-Match with 304 [P-DISC-13]" },
    { test: "@axe/client refresh() revalidates with If-None-Match and reports added, removed" },
    { test: "@axe/client run() refetches the manifest once for an action it does not know" },
  ],
  "P-DISC-4": [
    { test: "@axe/client discover: falls back to the AXE-Manifest header, then the link tag" },
  ],
  "P-DISC-5": [
    { test: "@axe/client discover: falls back to the AXE-Manifest header, then the link tag" },
  ],
  "P-DISC-6": [{ check: "discovery.hints" }],
  "P-DISC-7": [{ test: "@axe/client discover" }],
  "P-DISC-8": [{ check: "manifest.index" }],
  "P-DISC-9": [{ check: "manifest.index" }],
  "P-DISC-10": [{ check: "manifest.index" }],
  "P-DISC-11": [{ check: "manifest.agents-policy" }],
  "P-DISC-12": [
    { check: "manifest.agents-policy" },
    { test: "@axe/client refuses to call a site whose policies deny the vendor" },
  ],
  "P-MAN-1": [{ check: "manifest.schema" }],
  "P-MAN-2": [{ check: "manifest.https" }],
  "P-MAN-3": [{ check: "manifest.honesty" }],
  "P-ACT-1": [{ check: "manifest.schema" }],
  "P-ACT-2": [{ check: "manifest.unique-names" }],
  "P-ACT-3": [{ check: "manifest.truthful-metadata" }],
  "P-ACT-4": [{ check: "manifest.object-schemas" }],
  "P-ACT-5": [{ check: "manifest.examples-validate" }],
  "P-ACT-6": [{ check: "manifest.reserved-key" }],
  "P-ACT-7": [{ check: "manifest.description-length" }, { check: "manifest.honesty" }],
  "P-INV-1": [{ check: "runtime.missing-input" }],
  "P-INV-2": [{ check: "runtime.invalid-input" }],
  "P-INV-3": [{ test: "@axe/core onBehalfOf in the body is ignored" }],
  "P-INV-4": [{ check: "runtime.get-definition" }],
  "P-INV-5": [{ check: "runtime.unknown-action" }],
  "P-INV-6": [{ check: "runtime.unknown-action" }, { check: "runtime.invalid-input" }],
  "P-INV-7": [{ test: "@axe/client narrows on status, never HTTP status" }],
  "P-INV-8": [
    { test: "@axe/core onRequest can short-circuit with rate_limited and Retry-After is set" },
  ],
  "P-INV-9": [{ check: "runtime.cors" }],
  "P-TRANS-1": [
    { check: "runtime.json-content-type" },
    { test: "@axe/core request policy: state-changing POSTs must be JSON" },
  ],
  "P-TRANS-2": [
    {
      test: "@axe/core request policy: cross-origin writes with cookies are refused before anything runs",
    },
  ],
  "P-TRANS-3": [{ test: "@axe/core request policy: intended callers keep working" }],
  "P-TRANS-4": [{ test: "@axe/core request policy: intended callers keep working" }],
  "P-RES-1": [{ check: "runtime.envelope-schema" }],
  "P-RES-2": [{ check: "ladder.needs-human-avoidable" }],
  "P-REQ-1": [{ check: "ladder.needs-input-shape" }],
  "P-REQ-2": [{ check: "ladder.needs-input-shape" }],
  "P-REQ-3": [{ check: "ladder.sensitive-kinds" }],
  "P-REQ-4": [{ check: "manifest.honesty" }],
  "P-REQ-5": [{ check: "ladder.needs-input-shape" }],
  "P-REQ-6": [{ check: "ladder.fallback-resume" }],
  "P-REQ-7": [{ check: "ladder.continue-valid" }],
  "P-REQ-8": [{ check: "ladder.continue-invalid" }],
  "P-REQ-9": [
    { check: "ladder.continue-replay" },
    {
      test: "@axe/core concurrent uses of one continuation token run onContinue once; a lost response is recovered; an altered payload conflicts",
    },
  ],
  "P-REQ-10": [{ test: "@axe/core events contain no payloads" }],
  "P-HAND-1": [{ check: "ladder.handoff-shape" }],
  "P-HAND-2": [{ check: "ladder.needs-human-avoidable" }],
  "P-HAND-3": [{ check: "manifest.honesty" }],
  "P-HAND-4": [{ check: "runtime.resume-endpoint" }, { check: "ladder.fallback-resume" }],
  "P-HAND-5": [
    { test: "@axe/core a gated handoff refuses resume until completeHandoff is called" },
  ],
  "P-HAND-6": [{ check: "ladder.resume-replay" }],
  "P-HAND-7": [
    {
      test: "@axe/core login handoff: returns login_required, then runs the action as the signed-in user",
    },
  ],
  "P-PEND-1": [{ test: "@axe/core pending and poll" }],
  "P-PEND-2": [{ test: "@axe/core pending and poll" }],
  "P-PEND-3": [{ test: "@axe/client poll honors maxWaitMs" }],
  "P-POLL-1": [
    {
      test: "@axe/core a user-authenticated terminal result is not returned anonymously or to another user",
    },
    { test: "@axe/core a site-authenticated terminal result needs the same site key" },
    {
      test: "@axe/core the terminal result of an action that has since been removed is still authorized",
    },
    {
      test: "@axe/core a poll token minted on tenant A is not_found on tenant B, pending and terminal",
    },
  ],
  "P-POLL-2": [
    {
      test: "@axe/core concurrent polls run onPoll once; the other poll is pending; both then see one terminal result",
    },
  ],
  "P-ERR-1": [{ check: "runtime.envelope-schema" }],
  "P-ERR-2": [{ check: "runtime.error-hygiene" }],
  "P-ERR-3": [{ check: "runtime.invalid-input" }],
  "P-TOK-1": [{ test: "@axe/client treats tokens as opaque strings" }],
  "P-TOK-2": [{ test: "@axe/core tokens bound to a user are rejected for another user" }],
  "P-TOK-3": [
    { check: "runtime.token-tamper" },
    { check: "runtime.continue-endpoint" },
    { check: "runtime.resume-endpoint" },
  ],
  "P-TOK-4": [
    { test: "@axe/core token record holds state; wire token carries only binding fields" },
  ],
  "P-TOK-5": [{ check: "ladder.token-ttl" }],
  "P-TOK-6": [
    { check: "ladder.token-principal" },
    {
      test: "@axe/core a continuation minted on tenant A is not_found on tenant B for the same local user id, and nothing runs",
    },
    {
      test: "@axe/core a resume token minted on tenant A is not_found on tenant B, before and after use",
    },
    {
      test: "@axe/core wrong user and anonymous presentations get exactly the unknown-token response, and nothing runs",
    },
    {
      test: "@axe/core the login handoff is the one identity transition: anonymous to the user the site recorded",
    },
    { test: "@axe/core completeHandoff refuses a handoff minted for another tenant" },
  ],
  "P-TOK-7": [
    {
      test: "@axe/core a workflow started with a site key continues with the same key and the handler sees its id",
    },
    {
      test: "@axe/core another partner, a revoked key, a narrowed key, or no key gets the unknown-token response",
    },
    {
      test: "@axe/core keys verified as `true` or without an id are scoped by a keyed hash, never shared, never stored raw",
    },
    {
      test: "@axe/core a site key with a forwarded user binds both: the same key with another user, or without the user, is refused",
    },
    {
      test: "@axe/core a resume token obtained with one site key is not_found with another key, open or consumed",
    },
  ],
  "P-IDEM-1": [{ check: "runtime.idempotency-required" }],
  "P-IDEM-2": [{ check: "runtime.idempotency-replay" }],
  "P-IDEM-3": [{ check: "runtime.idempotency-conflict" }],
  "P-IDEM-4": [{ test: "@axe/core DEFAULT_IDEMPOTENCY_TTL_SECONDS is 24 hours" }],
  "P-OP-1": [
    { check: "ladder.continue-replay" },
    { check: "ladder.resume-replay" },
    {
      test: "@axe/core run once; the concurrent caller gets a retryable conflict with Retry-After, then the stored envelope",
    },
    { test: "@axe/core two runtime instances sharing the stores run the operation once" },
    {
      test: "@axe/core two runtimes on one database run a call once, and a crash after the business commit is recovered by operationId",
    },
  ],
  "P-OP-2": [
    {
      test: "@axe/core run once; the concurrent caller gets a retryable conflict with Retry-After, then the stored envelope",
    },
  ],
  "P-OP-3": [
    {
      test: "@axe/core a handler that throws releases the claim: the retry runs again and its success is stored",
    },
    {
      test: "@axe/core an abandoned claim blocks retries until its lease passes, then the same operation takes it over",
    },
  ],
  "P-OP-4": [
    {
      test: "@axe/core a crash after the business commit and before the result is stored: the retry re-runs, and operationId keeps the effect single",
    },
  ],
  "P-LIM-1": [
    { check: "runtime.body-limit" },
    {
      test: "@axe/core a body without Content-Length is read only up to the limit, then the stream is cancelled",
    },
  ],
  "P-LIM-2": [
    { check: "runtime.nesting-limit" },
    { test: "@axe/core a deeply nested body is invalid_input, not a crash" },
  ],
  "P-LIM-3": [
    { test: "@axe/client a request that never answers fails with a timeout after timeoutMs" },
    { test: "@axe/client a body without Content-Length is read up to the limit, then cancelled" },
    {
      test: "@axe/client a site that says retryAfter 0 is polled at most once a second, not in a loop",
    },
    { test: "@axe/client discover() rejects malformed manifests and says why" },
  ],
  "P-LIM-4": [
    {
      test: "@axe/core MemoryIdempotencyStore sweeps abandoned unique keys, and evicts completed entries before a running claim",
    },
    {
      test: "@axe/core MemoryTokenStore sweeps expired records on a later write, whether or not they are read again",
    },
  ],
  "P-SCHEMA-1": [{ test: "@axe/core a required key is not satisfied by the prototype chain" }],
  "P-SCHEMA-2": [
    {
      test: "@axe/core a keyword the validator does not implement refuses the value; annotations and x- keys are ignored",
    },
    { test: "@axe/core a $ref loop that consumes nothing is an issue, not a stack overflow" },
  ],
  "P-SCHEMA-3": [{ test: "@axe/core is exact on the decimal values as written" }],
  "P-SCHEMA-4": [
    {
      test: "@axe/core flags quantified groups whose body ends in a loose repetition, and not Zod's built-in patterns",
    },
  ],
  "P-SCHEMA-5": [
    {
      test: "@axe/core toJsonSchema marks every input node the server checks beyond JSON Schema with x-axe-refined",
    },
  ],
  "P-SCHEMA-6": [
    {
      test: "@axe/core the same key with a different date is conflict, even though both parse to a Date",
    },
  ],
  "P-DISP-1": [{ check: "manifest.display-pointers" }],
  "P-DISP-2": [{ check: "manifest.display-pointers" }, { check: "runtime.example-roundtrip" }],
  "P-DISP-3": [{ check: "manifest.display-pointers" }],
  "P-DISP-4": [{ test: "@axe/client toMarkdown and toHTML always include the disclaimer" }],
  "P-DISP-5": [{ test: "@axe/client toHTML escapes everything" }],
  "P-DISP-6": [{ test: "@axe/client toHTML ignores unsafe URLs" }],
  "P-DISP-7": [{ check: "manifest.schema" }],
  "P-AFF-1": [{ check: "manifest.affordances" }],
  "P-AFF-2": [{ check: "manifest.affordances" }],
  "P-AFF-3": [{ test: "@axe/core resolveDisplay binds partial inputs" }],
  "P-AFF-4": [{ test: "@axe/core dynamic _axe.affordances replace static ones" }],
  "P-AFF-5": [{ check: "manifest.reserved-key" }],
  "P-AFF-6": [{ test: "@axe/core resolveDisplay tolerates affordance spam" }],
  "P-AFF-7": [{ check: "manifest.pagination" }, { check: "runtime.pagination-roundtrip" }],
  "P-AFF-8": [{ check: "manifest.freshness" }],
  "P-AFF-9": [{ check: "manifest.structured-filters" }],
  "P-FLOW-1": [{ check: "manifest.flows" }],
  "P-AUTH-1": [{ check: "manifest.auth-modes" }],
  "P-AUTH-2": [
    { test: "@axe/core site auth: missing key is unauthorized, disallowed key is forbidden" },
  ],
  "P-AUTH-3": [{ test: "@axe/core handlers see the authenticated identity" }],
  "P-AUTH-4": [{ test: "@axe/core login handoff" }],
  "P-AUTH-5": [{ test: "@axe/core onBehalfOf in the body is ignored" }],
  "P-AGENT-1": [{ test: "@axe/client sends User-Agent and context.agent" }],
  "P-AGENT-2": [{ check: "runtime.rate-limit-header" }],
  "P-AGENT-3": [{ test: "@axe/client honors Retry-After on rate_limited" }],
  "P-AGENT-4": [
    { test: "@axe/client refuses a discovered manifest whose baseUrl is on another origin" },
    { test: "@axe/client sends credentials to a cross-origin baseUrl listed in trust.origins" },
  ],
  "P-AGENT-5": [
    { test: "@axe/client refuses live.url and pollUrl on unauthorized origins" },
    { test: "@axe/client allowCrossOrigin contacts other https origins without auth or headers" },
    {
      test: "@axe/client does not follow an AXE-Manifest header or link tag to an unauthorized origin",
    },
  ],
  "P-AGENT-6": [
    { test: "@axe/client does not follow a redirect to an unauthorized origin" },
    { test: "@axe/client refuses an https-to-http redirect" },
  ],
  "P-AGENT-7": [{ test: "@axe/client allows http only for loopback origins the caller chose" }],
  "P-AGENT-8": [
    { test: "@axe/client destinationPolicy sees every outbound URL, redirects included" },
  ],
  "P-AGENT-9": [{ test: "@axe/mcp axe_poll polls only a pollUrl this server returned" }],
  "P-MCP-1": [
    { test: "@axe/mcp stateless: a real HTTP client initializes, lists tools, and calls tools" },
    { test: "@axe/mcp sessions: separate clients get separate sessions" },
    { test: "@axe/mcp sessions: an idle session expires with 404, and the client re-initializes" },
  ],
  "P-MCP-2": [
    {
      test: "@axe/mcp two authenticated users are isolated: each call reaches AXE as its own principal",
    },
    {
      test: "@axe/mcp a URL source: every call reaches the AXE site with the caller's own credential",
    },
    { test: "@axe/mcp acts as an OAuth resource server: 401 with resource metadata" },
    { test: "@axe/mcp refuses to share one identity among HTTP callers unless told to" },
  ],
  "P-MCP-3": [
    {
      test: "@axe/mcp two authenticated users are isolated: each call reaches AXE as its own principal",
    },
    { test: "@axe/mcp sessions: separate clients get separate sessions" },
  ],
  "P-MCP-4": [
    {
      test: "@axe/mcp a newly registered action becomes discoverable and callable; the session is told",
    },
    {
      test: "@axe/mcp within the refresh bound, tools/list shows an added action and drops a removed one",
    },
    {
      test: "@axe/mcp a call to a tool added since the last fetch refreshes once and runs; a removed tool",
    },
  ],
  "P-MCP-5": [
    {
      test: "@axe/mcp an uncertain call retried with the same idempotencyKey runs the handler once; a second",
    },
    { test: "@axe/mcp axe_continue and axe_resume take expectedRev; a stale one applies nothing" },
  ],
  "P-HON-1": [{ check: "manifest.honesty" }],
  "P-HON-2": [{ check: "manifest.honesty" }],
  "P-HON-3": [{ check: "audit.parity" }],
  "P-HON-4": [{ check: "manifest.affordances" }],
  "P-HON-5": [{ check: "ladder.fake-kinds" }],
  "P-HON-6": [{ check: "ladder.consent-scope" }],
  "P-HON-7": [{ check: "manifest.truthful-metadata" }],
  "P-LIVE-1": [
    { check: "live.stale-conflict" },
    { test: "@axe/core expectedRev is ignored by a site without a revision" },
  ],
  "P-LIVE-2": [
    { check: "live.rev-on-envelopes" },
    { test: "@axe/core rev is stamped on every envelope when a revision provider exists" },
  ],
  "P-LIVE-3": [
    { check: "live.stale-conflict" },
    { check: "live.fresh-accepted" },
    {
      test: "@axe/core a stale expectedRev is conflict with expectedRev and currentRev, and nothing is applied",
    },
  ],
  "P-LIVE-4": [
    {
      test: "@axe/core an idempotent replay wins over a stale expectedRev, and a stale call does not burn the key",
    },
  ],
  "P-LIVE-5": [{ check: "live.reasons" }],
  "P-LIVE-6": [
    { check: "live.availability-honored" },
    { test: "@axe/core handlers receive availability and refuse with unavailable()" },
  ],
  "P-LIVE-7": [
    { check: "live.state-endpoint" },
    { test: "@axe/core the manifest advertises live and renders the anonymous availability" },
  ],
  "P-LIVE-8": [
    { check: "live.state-endpoint" },
    { test: "@axe/core /axe/state is served per caller with no-store" },
  ],
  "P-LIVE-9": [{ test: "@axe/core handlers receive availability and refuse with unavailable()" }],
  "P-LIVE-10": [{ test: "@axe/core revisions are compared for equality only" }],
});
