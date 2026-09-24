// GENERATED FILE. Do not edit.
// Source: spec/VOCABULARY.md. Regenerate with `pnpm gen:vocabulary`.

// Each category is its own export so bundlers can drop the ones a package does not use.
// `import * as WIRE from "@axe/core/vocabulary"` and `import { WIRE }` both read as WIRE.<category>.<key>.

/** `protocol` names. */
export const protocol = /* @__PURE__ */ Object.freeze({
  /** The protocol version implemented by this SDK. Format `axe/<major>.<minor>`. */
  version: "axe/0.1",
} as const);

/** `path` names. */
export const path = /* @__PURE__ */ Object.freeze({
  /** Primary manifest location. `GET` returns the manifest. */
  manifest: "/.well-known/axe.json",
  /** Secondary manifest location for hosts that cannot serve `.well-known`. */
  manifestAlias: "/axe/manifest",
  /** Platform index of tenant manifests. */
  index: "/.well-known/axe-index.json",
  /** Prefix for action invocation. `POST /axe/actions/{name}` invokes; `GET` returns the definition. */
  actions: "/axe/actions",
  /** `POST` to satisfy a `needs_input` requirement. */
  continue: "/axe/continue",
  /** `POST` after a human handoff completes. */
  resume: "/axe/resume",
  /** Prefix for the SDK's default `pending` poll URLs: `GET /axe/poll/{token}`. */
  poll: "/axe/poll",
} as const);

/** `header` names. */
export const header = /* @__PURE__ */ Object.freeze({
  /** Protocol version. Servers send it on every response; agents may send it on requests. */
  protocol: "AXE-Protocol",
  /** Absolute URL of the manifest, for sites that cannot serve `.well-known`. */
  manifest: "AXE-Manifest",
  /** Seconds to wait, on `429` and on `pending` results. */
  retryAfter: "Retry-After",
  /** Declared rate limit, emitted when `policies.rateLimit` is set, e.g. `60;w=60`. */
  rateLimitPolicy: "RateLimit-Policy",
  /** `Bearer <token>` for `site` and `user` auth modes. */
  authorization: "Authorization",
  /** Agent self-identification, e.g. `AcmeAgent/2.1 (+https://acme.example/agent; axe/0.1)`. */
  userAgent: "User-Agent",
  /** Always `application/json` for AXE requests and responses. */
  contentType: "Content-Type",
} as const);

/** `link` names. */
export const link = /* @__PURE__ */ Object.freeze({
  /** `<link rel="axe-manifest" href="...">` points to the manifest. */
  manifestRel: "axe-manifest",
} as const);

/** `robots` names. */
export const robots = /* @__PURE__ */ Object.freeze({
  /** `AXE-Manifest: <url>` directive. A hint, not access control. */
  manifest: "AXE-Manifest",
  /** `AXE-Index: <url>` directive pointing at a platform index. */
  index: "AXE-Index",
} as const);

/** `query` names. */
export const query = /* @__PURE__ */ Object.freeze({
  /** Query parameter the SDK appends to a handoff URL carrying the handoff id. */
  handoff: "axe_handoff",
} as const);

/** `status` names. */
export const status = /* @__PURE__ */ Object.freeze({
  /** The action completed. `output` is present. */
  ok: "ok",
  /** The action needs something the agent may be able to provide. `accepts` lists the options. */
  needsInput: "needs_input",
  /** A human must act on the site. `handoff` is present. */
  needsHuman: "needs_human",
  /** Long-running work. Poll `pollUrl` after `retryAfter` seconds. */
  pending: "pending",
  /** The action failed. `error` is present. */
  error: "error",
} as const);

/** `error` names. */
export const error = /* @__PURE__ */ Object.freeze({
  /** Input or payload failed schema validation. `details.issues` names each path. */
  invalidInput: "invalid_input",
  /** Credentials are missing or invalid for the action's `auth` mode. */
  unauthorized: "unauthorized",
  /** Credentials are valid but this principal may not perform the action. */
  forbidden: "forbidden",
  /** Unknown action, unknown token, or a referenced entity does not exist. */
  notFound: "not_found",
  /** State conflict: idempotency key reused with different input, token already consumed, handoff not yet completed. */
  conflict: "conflict",
  /** Too many requests. `Retry-After` is set. */
  rateLimited: "rate_limited",
  /** Temporarily unavailable. Retry later. */
  unavailable: "unavailable",
  /** Unexpected server failure. */
  internal: "internal",
  /** Unsupported protocol major version or unsupported feature. */
  unsupported: "unsupported",
} as const);

/** `ladder` names. */
export const ladder = /* @__PURE__ */ Object.freeze({
  /** An action or continuation completed with `ok`. */
  ok: "ok",
  /** An action returned `needs_input`. */
  needsInput: "needs_input",
  /** A `/axe/continue` request was processed (the resulting `status` is on the same event). */
  continued: "continued",
  /** An action or continuation returned `needs_human`. */
  needsHuman: "needs_human",
  /** A `/axe/resume` request was processed. */
  resumed: "resumed",
  /** An action returned `pending`. */
  pending: "pending",
  /** An action, continuation, or resume returned `error`. */
  error: "error",
} as const);

/** `risk` names. */
export const risk = /* @__PURE__ */ Object.freeze({
  /** Reading public data. Nothing changes. */
  none: "none",
  /** Small, easily reversed change (save a search, add to a waitlist). */
  low: "low",
  /** Commits the user to something reversible (a booking with free cancellation). */
  medium: "medium",
  /** Money, legal commitment, identity, or hard-to-reverse effects. */
  high: "high",
} as const);

/** `authMode` names. */
export const authMode = /* @__PURE__ */ Object.freeze({
  /** No credentials required. */
  none: "none",
  /** The agent authenticates with an API key. */
  site: "site",
  /** The agent acts for an authenticated end user. */
  user: "user",
} as const);

/** `displayKind` names. */
export const displayKind = /* @__PURE__ */ Object.freeze({
  /** A list of comparable items at `display.items`. */
  list: "list",
  /** A single item described by `display.item`. */
  item: "item",
  /** A list best shown as rows and columns. */
  table: "table",
  /** The state of one thing (an order, an application). */
  status: "status",
  /** A long text or file the agent should summarize or link. */
  document: "document",
} as const);

/** `format` names. */
export const format = /* @__PURE__ */ Object.freeze({
  /** Plain text. */
  text: "text",
  /** A number, no unit. */
  number: "number",
  /** Money; the value is a number and the currency comes from `price` or the attribute label. */
  currency: "currency",
  /** ISO 8601 date. */
  date: "date",
  /** ISO 8601 date-time. */
  datetime: "datetime",
  /** True or false. */
  boolean: "boolean",
  /** Area in square feet unless the label says otherwise. */
  area: "area",
  /** Distance; the unit is stated in the label. */
  distance: "distance",
  /** ISO 8601 duration or minutes as a number. */
  duration: "duration",
  /** An array of short strings. */
  list: "list",
} as const);

/** `compare` names. */
export const compare = /* @__PURE__ */ Object.freeze({
  /** Larger values are preferable when comparing. */
  higherBetter: "higher-better",
  /** Smaller values are preferable when comparing. */
  lowerBetter: "lower-better",
  /** No ordering preference. */
  neutral: "neutral",
} as const);

/** `period` names. */
export const period = /* @__PURE__ */ Object.freeze({
  /** One-time price. */
  once: "once",
  /** Price per hour. */
  hour: "hour",
  /** Price per day. */
  day: "day",
  /** Price per month. */
  month: "month",
  /** Price per year. */
  year: "year",
} as const);

/** `tone` names. */
export const tone = /* @__PURE__ */ Object.freeze({
  /** Formal register when the agent speaks for the site. */
  formal: "formal",
  /** Neutral register. */
  neutral: "neutral",
  /** Casual register. */
  casual: "casual",
} as const);

/** `kind` names. */
export const kind = /* @__PURE__ */ Object.freeze({
  /** A tokenized payment card from the agent's wallet. */
  paymentCard: "payment.card",
  /** Authorization for a one-time ACH debit. */
  paymentAchDebit: "payment.ach-debit",
  /** Confirmation that a wire was sent per `accepts[].instructions`. */
  paymentWireConfirmation: "payment.wire-confirmation",
  /** Request to be invoiced on net terms. */
  paymentInvoice: "payment.invoice",
  /** Government-issued identity document details. */
  identityGovernmentId: "identity.government-id",
  /** Date of birth. */
  identityDateOfBirth: "identity.date-of-birth",
  /** Last four digits of a US Social Security number. */
  identitySsnLast4: "identity.ssn-last-4",
  /** A document the site can fetch from a URL. */
  documentUrl: "document.url",
  /** A document uploaded inline as base64. */
  documentBase64: "document.base64",
  /** An email address. */
  contactEmail: "contact.email",
  /** A phone number. */
  contactPhone: "contact.phone",
  /** A postal address. */
  contactAddress: "contact.address",
  /** Acknowledgment of a specific policy version and scope. */
  consentTerms: "consent.terms",
  /** Prefix for site-defined kinds: `x-<org>.<name>`. */
  customPrefix: "x-",
} as const);

/** `reason` names. */
export const reason = /* @__PURE__ */ Object.freeze({
  /** Emitted by the SDK when a `user` action is called without identity. */
  loginRequired: "login_required",
  /** Recommended reason string when `accepts` are payment kinds. */
  paymentRequired: "payment_required",
  /** Recommended reason string when `accepts` are consent kinds. */
  consentRequired: "consent_required",
  /** Recommended reason string when `accepts` are identity kinds. */
  identityRequired: "identity_required",
  /** Recommended reason string when `accepts` are document kinds. */
  documentRequired: "document_required",
} as const);

/** `tool` names. */
export const tool = /* @__PURE__ */ Object.freeze({
  /** Satisfy a `needs_input` requirement with a chosen `kind` and `payload`. */
  continue: "axe_continue",
  /** Resume after a human handoff with a `resumeToken`. */
  resume: "axe_resume",
  /** Return the site's manifest so the model can read descriptions and the affordance graph. */
  manifest: "axe_manifest",
  /** Poll a `pending` result's `pollUrl` until it settles. */
  poll: "axe_poll",
} as const);

/** `cli` names. */
export const cli = /* @__PURE__ */ Object.freeze({
  /** Scaffold an `axe.ts` for a framework. */
  init: "axe init",
  /** Load an `axe.ts`, validate the manifest, lint descriptions. */
  validate: "axe validate",
  /** Discover and print a manifest and its affordance graph. */
  inspect: "axe inspect",
  /** Call a read action and render the result to HTML. */
  preview: "axe preview",
  /** Run the conformance suite against a URL. */
  conformance: "axe conformance",
  /** Produce the AXE Score and fix list. */
  audit: "axe audit",
  /** Serve any AXE site as an MCP server over stdio. */
  mcp: "axe mcp",
} as const);

/** `field` names. */
export const field = /* @__PURE__ */ Object.freeze({
  /** Protocol version string. */
  protocol: "protocol",
  /** Identifier or display name, depending on context. */
  name: "name",
  /** Agent-facing text. Subject to the honesty rules. */
  description: "description",
  /** Absolute origin (and optional prefix) that `/axe/...` paths are relative to. */
  baseUrl: "baseUrl",
  /** The normal website for humans. */
  humanFallbackUrl: "humanFallbackUrl",
  /** Manifest: supported modes and login URL. Action: required mode. */
  auth: "auth",
  /** Array of supported auth modes. */
  modes: "modes",
  /** Where a human logs in and consents during a `login_required` handoff. */
  userLoginUrl: "userLoginUrl",
  /** Array of action definitions. */
  actions: "actions",
  /** Optional named paths through the affordance graph. */
  flows: "flows",
  /** Ordered action names in a flow. */
  steps: "steps",
  /** Rate limit, terms, retention, and agent allow/deny. */
  policies: "policies",
  /** `{ requestsPerMinute, burst? }`. */
  rateLimit: "rateLimit",
  /** Sustained request budget per agent identity. */
  requestsPerMinute: "requestsPerMinute",
  /** Short-term allowance above the sustained rate. */
  burst: "burst",
  /** Terms that govern agent access. */
  termsUrl: "termsUrl",
  /** Plain-language note on how long submitted data is kept. */
  dataRetention: "dataRetention",
  /** `{ allow?, deny? }` lists of agent vendors. Deny wins. */
  agents: "agents",
  /** Vendors permitted. `*` means all. */
  allow: "allow",
  /** Vendors refused. */
  deny: "deny",
  /** `{ email?, url? }` for the site; a URL or email for an agent. */
  contact: "contact",
  /** Contact email address. */
  email: "email",
  /** Rendering hints: `name`, `logoUrl`, `accentColor`, `tone`. */
  brand: "brand",
  /** Absolute HTTPS URL of a logo. */
  logoUrl: "logoUrl",
  /** CSS hex color. */
  accentColor: "accentColor",
  /** `formal`, `neutral`, or `casual`. */
  tone: "tone",
  /** Platform index this site belongs to. */
  indexUrl: "indexUrl",
  /** ISO 8601 timestamp of the last change. */
  updatedAt: "updatedAt",
  /** `{ name, url }` of the hosting platform. */
  platform: "platform",
  /** Array of `{ name, manifestUrl, updatedAt, tags? }`. */
  sites: "sites",
  /** Absolute URL of a tenant's manifest. */
  manifestUrl: "manifestUrl",
  /** Free-form labels for filtering an index. */
  tags: "tags",
  /** URL of the next index page, or absent. */
  next: "next",
  /** Short human-readable label. */
  title: "title",
  /** Input schema, input value, or bound input. */
  input: "input",
  /** Output schema or output value. */
  output: "output",
  /** The action changes nothing. */
  readOnly: "readOnly",
  /** Repeating with the same `idempotencyKey` has no additional effect. */
  idempotent: "idempotent",
  /** The effect can be undone through another action or by the site. */
  reversible: "reversible",
  /** `none`, `low`, `medium`, `high`. */
  risk: "risk",
  /** Array of `{ input, output }` pairs that validate against the schemas. */
  examples: "examples",
  /** Presentation hints for the output. */
  display: "display",
  /** Follow-up actions with bound inputs. Static on the action, dynamic under `_axe`. */
  affordances: "affordances",
  /** `{ cursorIn, cursorOut, pageSize }`. */
  pagination: "pagination",
  /** JSON Pointer into `input` for the cursor. */
  cursorIn: "cursorIn",
  /** JSON Pointer into `output` for the next cursor. */
  cursorOut: "cursorOut",
  /** `{ default, max }`. */
  pageSize: "pageSize",
  /** Items per page when unspecified. */
  default: "default",
  /** Largest page the action will return. */
  max: "max",
  /** `{ cacheTtlSeconds?, validUntil? }`. */
  freshness: "freshness",
  /** How long an agent may cache the output. */
  cacheTtlSeconds: "cacheTtlSeconds",
  /** JSON Pointer into `output` for a per-response expiry timestamp. */
  validUntil: "validUntil",
  /** `{ reasons }`: whether and why the action may return `needs_human`. */
  humanHandoff: "humanHandoff",
  /** Reason strings the action may emit. */
  reasons: "reasons",
  /** `{ since, replacedBy? }`. */
  deprecated: "deprecated",
  /** Date or version the deprecation began. */
  since: "since",
  /** Name of the replacement action. */
  replacedBy: "replacedBy",
  /** Display kind, requirement kind, or the kind used to continue. */
  kind: "kind",
  /** JSON Pointer into `output` locating the array of items. */
  items: "items",
  /** Pointer map describing one item. */
  item: "item",
  /** JSON Pointer to a stable identifier the agent echoes back. */
  id: "id",
  /** JSON Pointer to a secondary line. */
  subtitle: "subtitle",
  /** JSON Pointer to a one-paragraph summary. */
  summary: "summary",
  /** JSON Pointer (or array of pointers) to absolute image URLs. */
  image: "image",
  /** The human-facing page for an item, a handoff, a contact, or a document. */
  url: "url",
  /** `{ amount, currency, period? }`. */
  price: "price",
  /** JSON Pointer to a numeric amount, or a numeric amount. */
  amount: "amount",
  /** JSON Pointer or literal ISO 4217 code. */
  currency: "currency",
  /** `once`, `hour`, `day`, `month`, `year`. */
  period: "period",
  /** Ordered `{ label, path, format?, compare? }` entries. */
  attributes: "attributes",
  /** Column heading for an attribute. */
  label: "label",
  /** JSON Pointer to the attribute value; or the path of a validation issue. */
  path: "path",
  /** How to render the attribute. */
  format: "format",
  /** Which direction is better. */
  compare: "compare",
  /** JSON Pointers to short strings. */
  badges: "badges",
  /** Attribute labels to lead with. */
  suggestedComparison: "suggestedComparison",
  /** What the agent tells the user when there are no items. */
  emptyMessage: "emptyMessage",
  /** Text that MUST accompany any rendering. */
  disclaimer: "disclaimer",
  /** Name of the target or invoked action. */
  action: "action",
  /** The one affordance to offer most prominently. */
  primary: "primary",
  /** Reserved key for dynamic `affordances`. Stripped before validation. */
  axeReserved: "_axe",
  /** `{ onBehalfOf?, locale?, timezone?, agent?, sessionId? }`. */
  context: "context",
  /** Opaque end-user identity established by the site's auth. */
  onBehalfOf: "onBehalfOf",
  /** BCP 47 language tag. */
  locale: "locale",
  /** IANA time zone name. */
  timezone: "timezone",
  /** `{ name, version, vendor, contact? }`. */
  agent: "agent",
  /** Agent software version. */
  version: "version",
  /** Organization operating the agent; matched against `policies.agents`. */
  vendor: "vendor",
  /** Agent-chosen id correlating calls in one task. */
  sessionId: "sessionId",
  /** Client-chosen key; replay returns the original result. */
  idempotencyKey: "idempotencyKey",
  /** Result discriminator. */
  status: "status",
  /** Short machine-readable code for why input or a human is needed. */
  reason: "reason",
  /** Agent-facing explanation. */
  message: "message",
  /** Ordered alternatives that satisfy the requirement. */
  accepts: "accepts",
  /** JSON Schema for the payload of this kind. */
  schema: "schema",
  /** Agents MUST confirm with the user before sending. */
  sensitive: "sensitive",
  /** Agent-read text to relay (accepts) or what the human must do (handoff). */
  instructions: "instructions",
  /** Signed, opaque token identifying the open requirement. */
  continuationToken: "continuationToken",
  /** ISO 8601 expiry of the token. */
  expiresAt: "expiresAt",
  /** Embedded handoff to use when no `accepts` entry can be satisfied. */
  fallback: "fallback",
  /** The value satisfying the chosen kind. */
  payload: "payload",
  /** `{ reason, instructions, url, resumeToken, expiresAt, whatAgentShouldSayToUser }`. */
  handoff: "handoff",
  /** Signed, opaque token to resume after the human acts. */
  resumeToken: "resumeToken",
  /** How the agent should frame the handoff to its user. */
  whatAgentShouldSayToUser: "whatAgentShouldSayToUser",
  /** Absolute URL to `GET` for the eventual result. */
  pollUrl: "pollUrl",
  /** Seconds to wait before polling. */
  retryAfter: "retryAfter",
  /** `{ code, message, retryable, details? }`. */
  error: "error",
  /** One of the error codes. */
  code: "code",
  /** Whether an identical retry could succeed. */
  retryable: "retryable",
  /** Structured extra data; `issues` for `invalid_input`. */
  details: "details",
  /** Array of `{ path, message, expected? }` validation problems. */
  issues: "issues",
  /** `open` on a `conflict` returned by `/axe/resume` before the human finished. */
  handoffStatus: "handoffStatus",
  /** What the schema wanted at `path`. */
  expected: "expected",
  /** Event schema version, currently `1`. */
  schemaVersion: "schemaVersion",
  /** ISO 8601 timestamp of the event. */
  ts: "ts",
  /** Server-side processing time. */
  latencyMs: "latencyMs",
  /** Where on the escalation ladder this request landed. */
  ladder: "ladder",
  /** `error.code` when `status` is `error`. */
  errorCode: "errorCode",
  /** Tenant id on multi-tenant platforms. */
  tenant: "tenant",
} as const);

/** `payload` names. */
export const payload = /* @__PURE__ */ Object.freeze({
  /** PSP-issued single-use or network token. */
  token: "token",
  /** Payment service provider identifier. */
  provider: "provider",
  /** Card network, lowercase. (Also `manifest.brand`, listed under fields.) */
  brand: "brand",
  /** Last four digits. */
  last4: "last4",
  /** Expiry month, 1–12. */
  expMonth: "expMonth",
  /** Four-digit expiry year. */
  expYear: "expYear",
  /** Billing postal code. */
  billingPostalCode: "billingPostalCode",
  /** Name on the bank account. */
  accountHolderName: "accountHolderName",
  /** ABA routing number. */
  routingNumber: "routingNumber",
  /** Bank account number. */
  accountNumber: "accountNumber",
  /** `checking` or `savings`. */
  accountType: "accountType",
  /** When the user authorized the debit. */
  authorizedAt: "authorizedAt",
  /** The exact authorization text the user agreed to. */
  authorizationText: "authorizationText",
  /** Bank reference, IMAD, or OMAD. */
  referenceNumber: "referenceNumber",
  /** When the wire was sent. */
  sentAt: "sentAt",
  /** Sending bank. */
  bankName: "bankName",
  /** Company to invoice. */
  companyName: "companyName",
  /** Accounts-payable email. */
  billingEmail: "billingEmail",
  /** Purchase order reference. */
  purchaseOrderNumber: "purchaseOrderNumber",
  /** Requested payment terms in days. */
  netTermsDays: "netTermsDays",
  /** VAT or EIN. */
  taxId: "taxId",
  /** `passport`, `drivers-license`, `national-id`, or `residence-permit`. */
  documentType: "documentType",
  /** Document number. */
  documentNumber: "documentNumber",
  /** ISO 3166-1 alpha-2 country. */
  issuingCountry: "issuingCountry",
  /** Name as printed on the document. */
  fullName: "fullName",
  /** Date of birth. */
  dateOfBirth: "dateOfBirth",
  /** Document expiry date. */
  expiresOn: "expiresOn",
  /** MIME type of the document. */
  mimeType: "mimeType",
  /** File name. */
  filename: "filename",
  /** Size in bytes. */
  sizeBytes: "sizeBytes",
  /** Base64-encoded content. */
  contentBase64: "contentBase64",
  /** E.164 phone number. */
  phone: "phone",
  /** Whether the number receives SMS. */
  canReceiveSms: "canReceiveSms",
  /** Address line 1. */
  line1: "line1",
  /** Address line 2. */
  line2: "line2",
  /** City. */
  city: "city",
  /** State, province, or prefecture. */
  region: "region",
  /** Postal code. */
  postalCode: "postalCode",
  /** ISO 3166-1 alpha-2 country. */
  country: "country",
  /** The policy document agreed to. */
  policyUrl: "policyUrl",
  /** Exact version identifier or date. */
  policyVersion: "policyVersion",
  /** What the consent covers. */
  scope: "scope",
  /** When consent was given. */
  acceptedAt: "acceptedAt",
  /** Who consented, when the site requires it. */
  acceptedBy: "acceptedBy",
} as const);

/** `api` names. */
export const api = /* @__PURE__ */ Object.freeze({
  /** Create a server instance from site configuration. */
  createAXE: "createAXE",
  /** Define an action with schemas, metadata, and handlers. */
  action: "action",
  /** Add an action to a server. */
  register: "register",
  /** Return the manifest object, optionally for a tenant. */
  describe: "describe",
  /** Get a `(Request) => Promise<Response>` for the whole protocol surface. */
  fetchHandler: "fetchHandler",
  /** The function that runs when an action is invoked. */
  handler: "handler",
  /** Helper passed to handlers that mints a `needs_input` result. */
  needsInput: "needsInput",
  /** Action hook that receives a validated continuation. */
  onContinue: "onContinue",
  /** Action hook that runs after a human handoff. */
  onResume: "onResume",
  /** Action hook that produces the current result for a `pending` action. */
  onPoll: "onPoll",
  /** Server-side object attached to a token and delivered back to hooks. */
  state: "state",
  /** Record that the human finished a handoff, optionally binding identity. */
  completeHandoff: "completeHandoff",
  /** Apply `display` pointers to an output and return a `PresentedResult`. */
  resolveDisplay: "resolveDisplay",
  /** Typed definitions of every well-known kind. */
  kinds: "kinds",
  /** Build an `accepts[]` entry from a kind definition. */
  accept: "accept",
  /** Apply the honesty rules to one string. */
  lintAgentText: "lintAgentText",
  /** Apply all lint rules to a manifest. */
  lintManifest: "lintManifest",
  /** Hook called before an action runs; may short-circuit with a result. */
  onRequest: "onRequest",
  /** Hook called with every result envelope. */
  onResult: "onResult",
  /** Hook called when a handler throws. */
  onError: "onError",
  /** Hook receiving every analytics event; sinks attach here. */
  onEvent: "onEvent",
  /** Event sink that prints one JSON line per event to stdout. */
  consoleSink: "consoleSink",
  /** Event sink that appends JSON lines to a file. */
  jsonlFileSink: "jsonlFileSink",
  /** Event sink that records OpenTelemetry metrics and spans. */
  otelSink: "otelSink",
  /** Configuration slot for a `TokenStore` implementation. */
  tokenStore: "tokenStore",
  /** Configuration slot for an `IdempotencyStore` implementation. */
  idempotencyStore: "idempotencyStore",
  /** HMAC secret used to sign tokens. */
  secret: "secret",
  /** Opt-in CORS configuration. */
  cors: "cors",
  /** Site-supplied function that turns a request into an `onBehalfOf` identity. */
  authenticate: "authenticate",
  /** Site-supplied function that validates a `site` mode bearer key. */
  verifySiteKey: "verifySiteKey",
  /** Configuration for serving a platform index. */
  index: "index",
  /** Find a manifest from any URL. */
  discover: "discover",
  /** Return the loaded manifest. */
  manifest: "manifest",
  /** Call an action and return the result envelope. */
  invoke: "invoke",
  /** Satisfy a `needs_input` requirement. */
  continue: "continue",
  /** Resume after a handoff. */
  resume: "resume",
  /** Poll a `pending` result until it settles. */
  poll: "poll",
  /** Drive the whole escalation ladder with registered fulfillers. */
  run: "run",
  /** Client option: providers keyed by kind. */
  fulfillers: "fulfillers",
  /** Client callback invoked before sending a `sensitive` payload. */
  confirm: "confirm",
  /** Turn an `ok` result into a `PresentedResult`. */
  present: "present",
  /** Render a `PresentedResult` as a Markdown comparison table. */
  toMarkdown: "toMarkdown",
  /** Render a `PresentedResult` as a self-contained HTML page. */
  toHTML: "toHTML",
  /** Derive an MCP server from an AXE server or manifest URL. */
  createMcpServer: "createMcpServer",
  /** Connect an MCP server to stdio. */
  serveStdio: "serveStdio",
  /** Get a fetch handler for the Streamable HTTP transport. */
  serveHttp: "serveHttp",
  /** Express and Connect middleware. */
  axeExpress: "axeExpress",
  /** App Router route handlers. */
  axeNext: "axeNext",
  /** Pages API route handler. */
  axeNextPages: "axeNextPages",
  /** Web-standard fetch handler with context injection. */
  axeFetch: "axeFetch",
  /** Run the conformance suite against a URL. */
  runConformance: "runConformance",
  /** Produce an AXE Score report for a URL. */
  runAudit: "runAudit",
  /** In-process client bound to an AXE server for unit tests. */
  createTestClient: "createTestClient",
  /** The drift test as a function, for use in other repositories. */
  checkVocabularyDrift: "checkVocabularyDrift",
  /** Restrict a document kind to specific MIME types. */
  withMimeTypes: "withMimeTypes",
  /** Define a site-specific kind under `x-<org>.`. */
  customKind: "customKind",
  /** Conventional `reason` string for a kind's namespace. */
  suggestedReason: "suggestedReason",
  /** Token lifetime option on `needsInput`, `handoff`, and `pending`. */
  ttlSeconds: "ttlSeconds",
  /** Handoff option: refuse resume until `completeHandoff` is called. */
  requireCompletion: "requireCompletion",
  /** Handoff option: append `axe_handoff` to the URL (default true). */
  appendHandoffId: "appendHandoffId",
  /** What `completeHandoff` recorded, delivered to `onResume`. */
  completion: "completion",
  /** Handler context member: the authenticated identity with `claims`, or null. */
  identity: "identity",
  /** Extra site-defined data on an `Identity`, visible to handlers, never on the wire. */
  claims: "claims",
  /** Handler context member: what `verifySiteKey` returned for a `site` call. */
  siteKey: "siteKey",
  /** Config: reject mutating calls without `idempotencyKey` (default true). */
  requireIdempotencyKey: "requireIdempotencyKey",
  /** Config: idempotency window (default 86400). */
  idempotencyTtlSeconds: "idempotencyTtlSeconds",
  /** Config: `Cache-Control` max-age for the manifest (default 300). */
  manifestCacheSeconds: "manifestCacheSeconds",
  /** CORS option: send `Access-Control-Allow-Credentials`. */
  allowCredentials: "allowCredentials",
  /** Fan events out to several sinks, isolating failures. */
  combineSinks: "combineSinks",
  /** Parse the recommended `User-Agent` form into an event agent. */
  parseUserAgent: "parseUserAgent",
  /** Narrow a result to `ok`. */
  isOk: "isOk",
  /** Narrow a result to `needs_input`. */
  isNeedsInput: "isNeedsInput",
  /** Narrow a result to `needs_human`. */
  isNeedsHuman: "isNeedsHuman",
  /** Narrow a result to `pending`. */
  isPending: "isPending",
  /** Narrow a result to `error`. */
  isError: "isError",
  /** Whether `policies.agents` permits this client's vendor. */
  allowed: "allowed",
  /** Client option: retries after `rate_limited` or `unavailable` (default 1). */
  retries: "retries",
  /** Client option: longest `Retry-After` honored automatically. */
  maxRetryAfterMs: "maxRetryAfterMs",
  /** Poll option: give up after this long. */
  maxWaitMs: "maxWaitMs",
  /** MCP tool name for an action (dots become underscores). */
  toolNameFor: "toolNameFor",
  /** Render a result envelope as MCP tool content. */
  formatResult: "formatResult",
  /** How long a tool call polls `pending` before returning (default 20000). */
  pollBudgetMs: "pollBudgetMs",
  /** Whether a path is one AXE serves. */
  isAxePath: "isAxePath",
  /** Convert a Node request to a Web `Request`. */
  toWebRequest: "toWebRequest",
  /** Write a Web `Response` to a Node response. */
  sendWebResponse: "sendWebResponse",
  /** Invoke an action in-process and return the envelope. */
  invokeAction: "invokeAction",
  /** A valid sample payload for a well-known kind. */
  samplePayload: "samplePayload",
  /** Terminal table for a conformance report. */
  formatConformanceTable: "formatConformanceTable",
  /** Terminal table for an audit report. */
  formatAuditTable: "formatAuditTable",
  /** Self-contained HTML audit report. */
  formatAuditHtml: "formatAuditHtml",
  /** Human-readable drift report. */
  formatDriftReport: "formatDriftReport",
} as const);

/**
 * Every wire-level name in the AXE protocol, grouped by category.
 * Use these constants instead of string literals for paths, headers, statuses,
 * error codes, ladder values, kinds, MCP tool names, and CLI command names.
 */
export const WIRE = /* @__PURE__ */ Object.freeze({
  protocol,
  path,
  header,
  link,
  robots,
  query,
  status,
  error,
  ladder,
  risk,
  authMode,
  displayKind,
  format,
  compare,
  period,
  tone,
  kind,
  reason,
  tool,
  cli,
  field,
  payload,
  api,
} as const);

export type Wire = typeof WIRE;
/** Union of every `protocol` name. */
export type WireProtocol = "axe/0.1";
/** Union of every `path` name. */
export type WirePath = "/.well-known/axe.json" | "/axe/manifest" | "/.well-known/axe-index.json" | "/axe/actions" | "/axe/continue" | "/axe/resume" | "/axe/poll";
/** Union of every `header` name. */
export type WireHeader = "AXE-Protocol" | "AXE-Manifest" | "Retry-After" | "RateLimit-Policy" | "Authorization" | "User-Agent" | "Content-Type";
/** Union of every `link` name. */
export type WireLink = "axe-manifest";
/** Union of every `robots` name. */
export type WireRobots = "AXE-Manifest" | "AXE-Index";
/** Union of every `query` name. */
export type WireQuery = "axe_handoff";
/** Union of every `status` name. */
export type WireStatus = "ok" | "needs_input" | "needs_human" | "pending" | "error";
/** Union of every `error` name. */
export type WireError = "invalid_input" | "unauthorized" | "forbidden" | "not_found" | "conflict" | "rate_limited" | "unavailable" | "internal" | "unsupported";
/** Union of every `ladder` name. */
export type WireLadder = "ok" | "needs_input" | "continued" | "needs_human" | "resumed" | "pending" | "error";
/** Union of every `risk` name. */
export type WireRisk = "none" | "low" | "medium" | "high";
/** Union of every `authMode` name. */
export type WireAuthMode = "none" | "site" | "user";
/** Union of every `displayKind` name. */
export type WireDisplayKind = "list" | "item" | "table" | "status" | "document";
/** Union of every `format` name. */
export type WireFormat = "text" | "number" | "currency" | "date" | "datetime" | "boolean" | "area" | "distance" | "duration" | "list";
/** Union of every `compare` name. */
export type WireCompare = "higher-better" | "lower-better" | "neutral";
/** Union of every `period` name. */
export type WirePeriod = "once" | "hour" | "day" | "month" | "year";
/** Union of every `tone` name. */
export type WireTone = "formal" | "neutral" | "casual";
/** Union of every `kind` name. */
export type WireKind = "payment.card" | "payment.ach-debit" | "payment.wire-confirmation" | "payment.invoice" | "identity.government-id" | "identity.date-of-birth" | "identity.ssn-last-4" | "document.url" | "document.base64" | "contact.email" | "contact.phone" | "contact.address" | "consent.terms" | "x-";
/** Union of every `reason` name. */
export type WireReason = "login_required" | "payment_required" | "consent_required" | "identity_required" | "document_required";
/** Union of every `tool` name. */
export type WireTool = "axe_continue" | "axe_resume" | "axe_manifest" | "axe_poll";
/** Union of every `cli` name. */
export type WireCli = "axe init" | "axe validate" | "axe inspect" | "axe preview" | "axe conformance" | "axe audit" | "axe mcp";
/** Union of every `field` name. */
export type WireField = "protocol" | "name" | "description" | "baseUrl" | "humanFallbackUrl" | "auth" | "modes" | "userLoginUrl" | "actions" | "flows" | "steps" | "policies" | "rateLimit" | "requestsPerMinute" | "burst" | "termsUrl" | "dataRetention" | "agents" | "allow" | "deny" | "contact" | "email" | "brand" | "logoUrl" | "accentColor" | "tone" | "indexUrl" | "updatedAt" | "platform" | "sites" | "manifestUrl" | "tags" | "next" | "title" | "input" | "output" | "readOnly" | "idempotent" | "reversible" | "risk" | "examples" | "display" | "affordances" | "pagination" | "cursorIn" | "cursorOut" | "pageSize" | "default" | "max" | "freshness" | "cacheTtlSeconds" | "validUntil" | "humanHandoff" | "reasons" | "deprecated" | "since" | "replacedBy" | "kind" | "items" | "item" | "id" | "subtitle" | "summary" | "image" | "url" | "price" | "amount" | "currency" | "period" | "attributes" | "label" | "path" | "format" | "compare" | "badges" | "suggestedComparison" | "emptyMessage" | "disclaimer" | "action" | "primary" | "_axe" | "context" | "onBehalfOf" | "locale" | "timezone" | "agent" | "version" | "vendor" | "sessionId" | "idempotencyKey" | "status" | "reason" | "message" | "accepts" | "schema" | "sensitive" | "instructions" | "continuationToken" | "expiresAt" | "fallback" | "payload" | "handoff" | "resumeToken" | "whatAgentShouldSayToUser" | "pollUrl" | "retryAfter" | "error" | "code" | "retryable" | "details" | "issues" | "handoffStatus" | "expected" | "schemaVersion" | "ts" | "latencyMs" | "ladder" | "errorCode" | "tenant";
/** Union of every `payload` name. */
export type WirePayload = "token" | "provider" | "brand" | "last4" | "expMonth" | "expYear" | "billingPostalCode" | "accountHolderName" | "routingNumber" | "accountNumber" | "accountType" | "authorizedAt" | "authorizationText" | "referenceNumber" | "sentAt" | "bankName" | "companyName" | "billingEmail" | "purchaseOrderNumber" | "netTermsDays" | "taxId" | "documentType" | "documentNumber" | "issuingCountry" | "fullName" | "dateOfBirth" | "expiresOn" | "mimeType" | "filename" | "sizeBytes" | "contentBase64" | "phone" | "canReceiveSms" | "line1" | "line2" | "city" | "region" | "postalCode" | "country" | "policyUrl" | "policyVersion" | "scope" | "acceptedAt" | "acceptedBy";
/** Union of every `api` name. */
export type WireApi = "createAXE" | "action" | "register" | "describe" | "fetchHandler" | "handler" | "needsInput" | "onContinue" | "onResume" | "onPoll" | "state" | "completeHandoff" | "resolveDisplay" | "kinds" | "accept" | "lintAgentText" | "lintManifest" | "onRequest" | "onResult" | "onError" | "onEvent" | "consoleSink" | "jsonlFileSink" | "otelSink" | "tokenStore" | "idempotencyStore" | "secret" | "cors" | "authenticate" | "verifySiteKey" | "index" | "discover" | "manifest" | "invoke" | "continue" | "resume" | "poll" | "run" | "fulfillers" | "confirm" | "present" | "toMarkdown" | "toHTML" | "createMcpServer" | "serveStdio" | "serveHttp" | "axeExpress" | "axeNext" | "axeNextPages" | "axeFetch" | "runConformance" | "runAudit" | "createTestClient" | "checkVocabularyDrift" | "withMimeTypes" | "customKind" | "suggestedReason" | "ttlSeconds" | "requireCompletion" | "appendHandoffId" | "completion" | "identity" | "claims" | "siteKey" | "requireIdempotencyKey" | "idempotencyTtlSeconds" | "manifestCacheSeconds" | "allowCredentials" | "combineSinks" | "parseUserAgent" | "isOk" | "isNeedsInput" | "isNeedsHuman" | "isPending" | "isError" | "allowed" | "retries" | "maxRetryAfterMs" | "maxWaitMs" | "toolNameFor" | "formatResult" | "pollBudgetMs" | "isAxePath" | "toWebRequest" | "sendWebResponse" | "invokeAction" | "samplePayload" | "formatConformanceTable" | "formatAuditTable" | "formatAuditHtml" | "formatDriftReport";

/** All entries as a flat list, for tooling. */
export const WIRE_ENTRIES: ReadonlyArray<{ readonly category: string; readonly key: string; readonly name: string }> = /* @__PURE__ */ Object.freeze([
  { category: "protocol", key: "version", name: "axe/0.1" },
  { category: "path", key: "manifest", name: "/.well-known/axe.json" },
  { category: "path", key: "manifestAlias", name: "/axe/manifest" },
  { category: "path", key: "index", name: "/.well-known/axe-index.json" },
  { category: "path", key: "actions", name: "/axe/actions" },
  { category: "path", key: "continue", name: "/axe/continue" },
  { category: "path", key: "resume", name: "/axe/resume" },
  { category: "path", key: "poll", name: "/axe/poll" },
  { category: "header", key: "protocol", name: "AXE-Protocol" },
  { category: "header", key: "manifest", name: "AXE-Manifest" },
  { category: "header", key: "retryAfter", name: "Retry-After" },
  { category: "header", key: "rateLimitPolicy", name: "RateLimit-Policy" },
  { category: "header", key: "authorization", name: "Authorization" },
  { category: "header", key: "userAgent", name: "User-Agent" },
  { category: "header", key: "contentType", name: "Content-Type" },
  { category: "link", key: "manifestRel", name: "axe-manifest" },
  { category: "robots", key: "manifest", name: "AXE-Manifest" },
  { category: "robots", key: "index", name: "AXE-Index" },
  { category: "query", key: "handoff", name: "axe_handoff" },
  { category: "status", key: "ok", name: "ok" },
  { category: "status", key: "needsInput", name: "needs_input" },
  { category: "status", key: "needsHuman", name: "needs_human" },
  { category: "status", key: "pending", name: "pending" },
  { category: "status", key: "error", name: "error" },
  { category: "error", key: "invalidInput", name: "invalid_input" },
  { category: "error", key: "unauthorized", name: "unauthorized" },
  { category: "error", key: "forbidden", name: "forbidden" },
  { category: "error", key: "notFound", name: "not_found" },
  { category: "error", key: "conflict", name: "conflict" },
  { category: "error", key: "rateLimited", name: "rate_limited" },
  { category: "error", key: "unavailable", name: "unavailable" },
  { category: "error", key: "internal", name: "internal" },
  { category: "error", key: "unsupported", name: "unsupported" },
  { category: "ladder", key: "ok", name: "ok" },
  { category: "ladder", key: "needsInput", name: "needs_input" },
  { category: "ladder", key: "continued", name: "continued" },
  { category: "ladder", key: "needsHuman", name: "needs_human" },
  { category: "ladder", key: "resumed", name: "resumed" },
  { category: "ladder", key: "pending", name: "pending" },
  { category: "ladder", key: "error", name: "error" },
  { category: "risk", key: "none", name: "none" },
  { category: "risk", key: "low", name: "low" },
  { category: "risk", key: "medium", name: "medium" },
  { category: "risk", key: "high", name: "high" },
  { category: "authMode", key: "none", name: "none" },
  { category: "authMode", key: "site", name: "site" },
  { category: "authMode", key: "user", name: "user" },
  { category: "displayKind", key: "list", name: "list" },
  { category: "displayKind", key: "item", name: "item" },
  { category: "displayKind", key: "table", name: "table" },
  { category: "displayKind", key: "status", name: "status" },
  { category: "displayKind", key: "document", name: "document" },
  { category: "format", key: "text", name: "text" },
  { category: "format", key: "number", name: "number" },
  { category: "format", key: "currency", name: "currency" },
  { category: "format", key: "date", name: "date" },
  { category: "format", key: "datetime", name: "datetime" },
  { category: "format", key: "boolean", name: "boolean" },
  { category: "format", key: "area", name: "area" },
  { category: "format", key: "distance", name: "distance" },
  { category: "format", key: "duration", name: "duration" },
  { category: "format", key: "list", name: "list" },
  { category: "compare", key: "higherBetter", name: "higher-better" },
  { category: "compare", key: "lowerBetter", name: "lower-better" },
  { category: "compare", key: "neutral", name: "neutral" },
  { category: "period", key: "once", name: "once" },
  { category: "period", key: "hour", name: "hour" },
  { category: "period", key: "day", name: "day" },
  { category: "period", key: "month", name: "month" },
  { category: "period", key: "year", name: "year" },
  { category: "tone", key: "formal", name: "formal" },
  { category: "tone", key: "neutral", name: "neutral" },
  { category: "tone", key: "casual", name: "casual" },
  { category: "kind", key: "paymentCard", name: "payment.card" },
  { category: "kind", key: "paymentAchDebit", name: "payment.ach-debit" },
  { category: "kind", key: "paymentWireConfirmation", name: "payment.wire-confirmation" },
  { category: "kind", key: "paymentInvoice", name: "payment.invoice" },
  { category: "kind", key: "identityGovernmentId", name: "identity.government-id" },
  { category: "kind", key: "identityDateOfBirth", name: "identity.date-of-birth" },
  { category: "kind", key: "identitySsnLast4", name: "identity.ssn-last-4" },
  { category: "kind", key: "documentUrl", name: "document.url" },
  { category: "kind", key: "documentBase64", name: "document.base64" },
  { category: "kind", key: "contactEmail", name: "contact.email" },
  { category: "kind", key: "contactPhone", name: "contact.phone" },
  { category: "kind", key: "contactAddress", name: "contact.address" },
  { category: "kind", key: "consentTerms", name: "consent.terms" },
  { category: "kind", key: "customPrefix", name: "x-" },
  { category: "reason", key: "loginRequired", name: "login_required" },
  { category: "reason", key: "paymentRequired", name: "payment_required" },
  { category: "reason", key: "consentRequired", name: "consent_required" },
  { category: "reason", key: "identityRequired", name: "identity_required" },
  { category: "reason", key: "documentRequired", name: "document_required" },
  { category: "tool", key: "continue", name: "axe_continue" },
  { category: "tool", key: "resume", name: "axe_resume" },
  { category: "tool", key: "manifest", name: "axe_manifest" },
  { category: "tool", key: "poll", name: "axe_poll" },
  { category: "cli", key: "init", name: "axe init" },
  { category: "cli", key: "validate", name: "axe validate" },
  { category: "cli", key: "inspect", name: "axe inspect" },
  { category: "cli", key: "preview", name: "axe preview" },
  { category: "cli", key: "conformance", name: "axe conformance" },
  { category: "cli", key: "audit", name: "axe audit" },
  { category: "cli", key: "mcp", name: "axe mcp" },
  { category: "field", key: "protocol", name: "protocol" },
  { category: "field", key: "name", name: "name" },
  { category: "field", key: "description", name: "description" },
  { category: "field", key: "baseUrl", name: "baseUrl" },
  { category: "field", key: "humanFallbackUrl", name: "humanFallbackUrl" },
  { category: "field", key: "auth", name: "auth" },
  { category: "field", key: "modes", name: "modes" },
  { category: "field", key: "userLoginUrl", name: "userLoginUrl" },
  { category: "field", key: "actions", name: "actions" },
  { category: "field", key: "flows", name: "flows" },
  { category: "field", key: "steps", name: "steps" },
  { category: "field", key: "policies", name: "policies" },
  { category: "field", key: "rateLimit", name: "rateLimit" },
  { category: "field", key: "requestsPerMinute", name: "requestsPerMinute" },
  { category: "field", key: "burst", name: "burst" },
  { category: "field", key: "termsUrl", name: "termsUrl" },
  { category: "field", key: "dataRetention", name: "dataRetention" },
  { category: "field", key: "agents", name: "agents" },
  { category: "field", key: "allow", name: "allow" },
  { category: "field", key: "deny", name: "deny" },
  { category: "field", key: "contact", name: "contact" },
  { category: "field", key: "email", name: "email" },
  { category: "field", key: "brand", name: "brand" },
  { category: "field", key: "logoUrl", name: "logoUrl" },
  { category: "field", key: "accentColor", name: "accentColor" },
  { category: "field", key: "tone", name: "tone" },
  { category: "field", key: "indexUrl", name: "indexUrl" },
  { category: "field", key: "updatedAt", name: "updatedAt" },
  { category: "field", key: "platform", name: "platform" },
  { category: "field", key: "sites", name: "sites" },
  { category: "field", key: "manifestUrl", name: "manifestUrl" },
  { category: "field", key: "tags", name: "tags" },
  { category: "field", key: "next", name: "next" },
  { category: "field", key: "title", name: "title" },
  { category: "field", key: "input", name: "input" },
  { category: "field", key: "output", name: "output" },
  { category: "field", key: "readOnly", name: "readOnly" },
  { category: "field", key: "idempotent", name: "idempotent" },
  { category: "field", key: "reversible", name: "reversible" },
  { category: "field", key: "risk", name: "risk" },
  { category: "field", key: "examples", name: "examples" },
  { category: "field", key: "display", name: "display" },
  { category: "field", key: "affordances", name: "affordances" },
  { category: "field", key: "pagination", name: "pagination" },
  { category: "field", key: "cursorIn", name: "cursorIn" },
  { category: "field", key: "cursorOut", name: "cursorOut" },
  { category: "field", key: "pageSize", name: "pageSize" },
  { category: "field", key: "default", name: "default" },
  { category: "field", key: "max", name: "max" },
  { category: "field", key: "freshness", name: "freshness" },
  { category: "field", key: "cacheTtlSeconds", name: "cacheTtlSeconds" },
  { category: "field", key: "validUntil", name: "validUntil" },
  { category: "field", key: "humanHandoff", name: "humanHandoff" },
  { category: "field", key: "reasons", name: "reasons" },
  { category: "field", key: "deprecated", name: "deprecated" },
  { category: "field", key: "since", name: "since" },
  { category: "field", key: "replacedBy", name: "replacedBy" },
  { category: "field", key: "kind", name: "kind" },
  { category: "field", key: "items", name: "items" },
  { category: "field", key: "item", name: "item" },
  { category: "field", key: "id", name: "id" },
  { category: "field", key: "subtitle", name: "subtitle" },
  { category: "field", key: "summary", name: "summary" },
  { category: "field", key: "image", name: "image" },
  { category: "field", key: "url", name: "url" },
  { category: "field", key: "price", name: "price" },
  { category: "field", key: "amount", name: "amount" },
  { category: "field", key: "currency", name: "currency" },
  { category: "field", key: "period", name: "period" },
  { category: "field", key: "attributes", name: "attributes" },
  { category: "field", key: "label", name: "label" },
  { category: "field", key: "path", name: "path" },
  { category: "field", key: "format", name: "format" },
  { category: "field", key: "compare", name: "compare" },
  { category: "field", key: "badges", name: "badges" },
  { category: "field", key: "suggestedComparison", name: "suggestedComparison" },
  { category: "field", key: "emptyMessage", name: "emptyMessage" },
  { category: "field", key: "disclaimer", name: "disclaimer" },
  { category: "field", key: "action", name: "action" },
  { category: "field", key: "primary", name: "primary" },
  { category: "field", key: "axeReserved", name: "_axe" },
  { category: "field", key: "context", name: "context" },
  { category: "field", key: "onBehalfOf", name: "onBehalfOf" },
  { category: "field", key: "locale", name: "locale" },
  { category: "field", key: "timezone", name: "timezone" },
  { category: "field", key: "agent", name: "agent" },
  { category: "field", key: "version", name: "version" },
  { category: "field", key: "vendor", name: "vendor" },
  { category: "field", key: "sessionId", name: "sessionId" },
  { category: "field", key: "idempotencyKey", name: "idempotencyKey" },
  { category: "field", key: "status", name: "status" },
  { category: "field", key: "reason", name: "reason" },
  { category: "field", key: "message", name: "message" },
  { category: "field", key: "accepts", name: "accepts" },
  { category: "field", key: "schema", name: "schema" },
  { category: "field", key: "sensitive", name: "sensitive" },
  { category: "field", key: "instructions", name: "instructions" },
  { category: "field", key: "continuationToken", name: "continuationToken" },
  { category: "field", key: "expiresAt", name: "expiresAt" },
  { category: "field", key: "fallback", name: "fallback" },
  { category: "field", key: "payload", name: "payload" },
  { category: "field", key: "handoff", name: "handoff" },
  { category: "field", key: "resumeToken", name: "resumeToken" },
  { category: "field", key: "whatAgentShouldSayToUser", name: "whatAgentShouldSayToUser" },
  { category: "field", key: "pollUrl", name: "pollUrl" },
  { category: "field", key: "retryAfter", name: "retryAfter" },
  { category: "field", key: "error", name: "error" },
  { category: "field", key: "code", name: "code" },
  { category: "field", key: "retryable", name: "retryable" },
  { category: "field", key: "details", name: "details" },
  { category: "field", key: "issues", name: "issues" },
  { category: "field", key: "handoffStatus", name: "handoffStatus" },
  { category: "field", key: "expected", name: "expected" },
  { category: "field", key: "schemaVersion", name: "schemaVersion" },
  { category: "field", key: "ts", name: "ts" },
  { category: "field", key: "latencyMs", name: "latencyMs" },
  { category: "field", key: "ladder", name: "ladder" },
  { category: "field", key: "errorCode", name: "errorCode" },
  { category: "field", key: "tenant", name: "tenant" },
  { category: "payload", key: "token", name: "token" },
  { category: "payload", key: "provider", name: "provider" },
  { category: "payload", key: "brand", name: "brand" },
  { category: "payload", key: "last4", name: "last4" },
  { category: "payload", key: "expMonth", name: "expMonth" },
  { category: "payload", key: "expYear", name: "expYear" },
  { category: "payload", key: "billingPostalCode", name: "billingPostalCode" },
  { category: "payload", key: "accountHolderName", name: "accountHolderName" },
  { category: "payload", key: "routingNumber", name: "routingNumber" },
  { category: "payload", key: "accountNumber", name: "accountNumber" },
  { category: "payload", key: "accountType", name: "accountType" },
  { category: "payload", key: "authorizedAt", name: "authorizedAt" },
  { category: "payload", key: "authorizationText", name: "authorizationText" },
  { category: "payload", key: "referenceNumber", name: "referenceNumber" },
  { category: "payload", key: "sentAt", name: "sentAt" },
  { category: "payload", key: "bankName", name: "bankName" },
  { category: "payload", key: "companyName", name: "companyName" },
  { category: "payload", key: "billingEmail", name: "billingEmail" },
  { category: "payload", key: "purchaseOrderNumber", name: "purchaseOrderNumber" },
  { category: "payload", key: "netTermsDays", name: "netTermsDays" },
  { category: "payload", key: "taxId", name: "taxId" },
  { category: "payload", key: "documentType", name: "documentType" },
  { category: "payload", key: "documentNumber", name: "documentNumber" },
  { category: "payload", key: "issuingCountry", name: "issuingCountry" },
  { category: "payload", key: "fullName", name: "fullName" },
  { category: "payload", key: "dateOfBirth", name: "dateOfBirth" },
  { category: "payload", key: "expiresOn", name: "expiresOn" },
  { category: "payload", key: "mimeType", name: "mimeType" },
  { category: "payload", key: "filename", name: "filename" },
  { category: "payload", key: "sizeBytes", name: "sizeBytes" },
  { category: "payload", key: "contentBase64", name: "contentBase64" },
  { category: "payload", key: "phone", name: "phone" },
  { category: "payload", key: "canReceiveSms", name: "canReceiveSms" },
  { category: "payload", key: "line1", name: "line1" },
  { category: "payload", key: "line2", name: "line2" },
  { category: "payload", key: "city", name: "city" },
  { category: "payload", key: "region", name: "region" },
  { category: "payload", key: "postalCode", name: "postalCode" },
  { category: "payload", key: "country", name: "country" },
  { category: "payload", key: "policyUrl", name: "policyUrl" },
  { category: "payload", key: "policyVersion", name: "policyVersion" },
  { category: "payload", key: "scope", name: "scope" },
  { category: "payload", key: "acceptedAt", name: "acceptedAt" },
  { category: "payload", key: "acceptedBy", name: "acceptedBy" },
  { category: "api", key: "createAXE", name: "createAXE" },
  { category: "api", key: "action", name: "action" },
  { category: "api", key: "register", name: "register" },
  { category: "api", key: "describe", name: "describe" },
  { category: "api", key: "fetchHandler", name: "fetchHandler" },
  { category: "api", key: "handler", name: "handler" },
  { category: "api", key: "needsInput", name: "needsInput" },
  { category: "api", key: "onContinue", name: "onContinue" },
  { category: "api", key: "onResume", name: "onResume" },
  { category: "api", key: "onPoll", name: "onPoll" },
  { category: "api", key: "state", name: "state" },
  { category: "api", key: "completeHandoff", name: "completeHandoff" },
  { category: "api", key: "resolveDisplay", name: "resolveDisplay" },
  { category: "api", key: "kinds", name: "kinds" },
  { category: "api", key: "accept", name: "accept" },
  { category: "api", key: "lintAgentText", name: "lintAgentText" },
  { category: "api", key: "lintManifest", name: "lintManifest" },
  { category: "api", key: "onRequest", name: "onRequest" },
  { category: "api", key: "onResult", name: "onResult" },
  { category: "api", key: "onError", name: "onError" },
  { category: "api", key: "onEvent", name: "onEvent" },
  { category: "api", key: "consoleSink", name: "consoleSink" },
  { category: "api", key: "jsonlFileSink", name: "jsonlFileSink" },
  { category: "api", key: "otelSink", name: "otelSink" },
  { category: "api", key: "tokenStore", name: "tokenStore" },
  { category: "api", key: "idempotencyStore", name: "idempotencyStore" },
  { category: "api", key: "secret", name: "secret" },
  { category: "api", key: "cors", name: "cors" },
  { category: "api", key: "authenticate", name: "authenticate" },
  { category: "api", key: "verifySiteKey", name: "verifySiteKey" },
  { category: "api", key: "index", name: "index" },
  { category: "api", key: "discover", name: "discover" },
  { category: "api", key: "manifest", name: "manifest" },
  { category: "api", key: "invoke", name: "invoke" },
  { category: "api", key: "continue", name: "continue" },
  { category: "api", key: "resume", name: "resume" },
  { category: "api", key: "poll", name: "poll" },
  { category: "api", key: "run", name: "run" },
  { category: "api", key: "fulfillers", name: "fulfillers" },
  { category: "api", key: "confirm", name: "confirm" },
  { category: "api", key: "present", name: "present" },
  { category: "api", key: "toMarkdown", name: "toMarkdown" },
  { category: "api", key: "toHTML", name: "toHTML" },
  { category: "api", key: "createMcpServer", name: "createMcpServer" },
  { category: "api", key: "serveStdio", name: "serveStdio" },
  { category: "api", key: "serveHttp", name: "serveHttp" },
  { category: "api", key: "axeExpress", name: "axeExpress" },
  { category: "api", key: "axeNext", name: "axeNext" },
  { category: "api", key: "axeNextPages", name: "axeNextPages" },
  { category: "api", key: "axeFetch", name: "axeFetch" },
  { category: "api", key: "runConformance", name: "runConformance" },
  { category: "api", key: "runAudit", name: "runAudit" },
  { category: "api", key: "createTestClient", name: "createTestClient" },
  { category: "api", key: "checkVocabularyDrift", name: "checkVocabularyDrift" },
  { category: "api", key: "withMimeTypes", name: "withMimeTypes" },
  { category: "api", key: "customKind", name: "customKind" },
  { category: "api", key: "suggestedReason", name: "suggestedReason" },
  { category: "api", key: "ttlSeconds", name: "ttlSeconds" },
  { category: "api", key: "requireCompletion", name: "requireCompletion" },
  { category: "api", key: "appendHandoffId", name: "appendHandoffId" },
  { category: "api", key: "completion", name: "completion" },
  { category: "api", key: "identity", name: "identity" },
  { category: "api", key: "claims", name: "claims" },
  { category: "api", key: "siteKey", name: "siteKey" },
  { category: "api", key: "requireIdempotencyKey", name: "requireIdempotencyKey" },
  { category: "api", key: "idempotencyTtlSeconds", name: "idempotencyTtlSeconds" },
  { category: "api", key: "manifestCacheSeconds", name: "manifestCacheSeconds" },
  { category: "api", key: "allowCredentials", name: "allowCredentials" },
  { category: "api", key: "combineSinks", name: "combineSinks" },
  { category: "api", key: "parseUserAgent", name: "parseUserAgent" },
  { category: "api", key: "isOk", name: "isOk" },
  { category: "api", key: "isNeedsInput", name: "isNeedsInput" },
  { category: "api", key: "isNeedsHuman", name: "isNeedsHuman" },
  { category: "api", key: "isPending", name: "isPending" },
  { category: "api", key: "isError", name: "isError" },
  { category: "api", key: "allowed", name: "allowed" },
  { category: "api", key: "retries", name: "retries" },
  { category: "api", key: "maxRetryAfterMs", name: "maxRetryAfterMs" },
  { category: "api", key: "maxWaitMs", name: "maxWaitMs" },
  { category: "api", key: "toolNameFor", name: "toolNameFor" },
  { category: "api", key: "formatResult", name: "formatResult" },
  { category: "api", key: "pollBudgetMs", name: "pollBudgetMs" },
  { category: "api", key: "isAxePath", name: "isAxePath" },
  { category: "api", key: "toWebRequest", name: "toWebRequest" },
  { category: "api", key: "sendWebResponse", name: "sendWebResponse" },
  { category: "api", key: "invokeAction", name: "invokeAction" },
  { category: "api", key: "samplePayload", name: "samplePayload" },
  { category: "api", key: "formatConformanceTable", name: "formatConformanceTable" },
  { category: "api", key: "formatAuditTable", name: "formatAuditTable" },
  { category: "api", key: "formatAuditHtml", name: "formatAuditHtml" },
  { category: "api", key: "formatDriftReport", name: "formatDriftReport" },
]);
