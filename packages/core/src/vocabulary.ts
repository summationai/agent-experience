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
  /** `GET` returns the live state: the current `rev` and every action's `availability`. Served with `Cache-Control: no-store`. */
  state: "/axe/state",
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

/** `entryKind` names. */
export const entryKind = /* @__PURE__ */ Object.freeze({
  /** A control that does something when activated: a button, a switch. */
  action: "action",
  /** A value the user can edit: an input, a cell. */
  field: "field",
  /** A list or grid that can load more. */
  collection: "collection",
} as const);

/** `op` names. */
export const op = /* @__PURE__ */ Object.freeze({
  /** Activate an action entry. */
  click: "CLICK",
  /** Activate a switch-role action entry. */
  toggle: "TOGGLE",
  /** Set a field entry's value. */
  typeText: "TYPE_TEXT",
  /** Ask a collection entry to load more. */
  scrollDown: "SCROLL_DOWN",
} as const);

/** `field` names. */
export const field = /* @__PURE__ */ Object.freeze({
  /** The application name the surface belongs to. */
  app: "app",
  /** When the snapshot was taken; when the ledger entry was written. */
  at: "at",
  /** The indexed table of controls. */
  entries: "entries",
  /** Domain objects the application chooses to show alongside the table. */
  objects: "objects",
  /** Position among entries that can be acted on now; null otherwise. */
  index: "index",
  /** The control's ARIA-style role: `button`, `switch`, `textbox`, `grid`. */
  role: "role",
  /** Stable identifier of the domain object the control belongs to. */
  object: "object",
  /** `{ available, reason?, requires?, handoff? }` for action entries. */
  state: "state",
  /** `{ mutates, idempotent, reversible, risk, confirm?, text? }`. */
  effect: "effect",
  /** Name of the state the action changes. */
  mutates: "mutates",
  /** The action requires explicit confirmation. */
  confirm: "confirm",
  /** Free text passed to a handler; the prompt for it. */
  text: "text",
  /** `{ op, maxLength?, readOnly, reason?, schema? }` for field entries. */
  edit: "edit",
  /** Longest accepted text. */
  maxLength: "maxLength",
  /** A field entry's current value. */
  value: "value",
  /** Items in a collection. */
  total: "total",
  /** Items currently rendered. */
  loaded: "loaded",
  /** The collection's active filter. */
  filter: "filter",
  /** The collection's active sort. */
  sort: "sort",
  /** The operation to perform. */
  op: "op",
  /** Entry id or index to act on; in the ledger, the id it resolved to. */
  target: "target",
  /** Who is acting: `agent`, `user`, or an identity. */
  actor: "actor",
  /** Entry ids whose state the act changed. */
  changed: "changed",
  /** The ledger entry's sequence number: 1-based, increasing by one per act. */
  seq: "seq",
  /** The latest ledger `seq`; ask `since` it for what happened after a snapshot. */
  ledgerSeq: "ledgerSeq",
  /** The revision when the act arrived. */
  revBefore: "revBefore",
  /** The revision when the entry was written; equals `revBefore` for a refusal. */
  revAfter: "revAfter",
  /** Cap on the number of ledger entries returned. */
  limit: "limit",
  /** Present while the application holds a freeze: `{ reason }`. */
  frozen: "frozen",
  /** A revision the handler reported that was older than the surface's, so not adopted. */
  ignoredRev: "ignoredRev",
  /** `{ currentRev? }`: the handler's own precondition failed; the act is `conflict` and nothing is adopted. */
  handlerConflict: "conflict",
  /** SHA-256 of the act's text, hex, under the ledger's `hash` text policy. */
  textHash: "textHash",
  /** Only on ledger entries `act` did not write: `application` (from `record`) or `server` (refused before it). */
  source: "source",
  /** An observed entry's guarantee tier: `derived` or `annotated`; absent means declared [S-AUTO-1]. */
  tier: "tier",
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
  /** The human-facing page for an item, a handoff, a contact, or a document; on `live`, the state endpoint. */
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
  /** Short machine-readable code for why input or a human is needed; on `availability` and `unavailable` details, plain language for why an action cannot be done right now. */
  reason: "reason",
  /** Agent-facing explanation. */
  message: "message",
  /** Ordered alternatives that satisfy the requirement. */
  accepts: "accepts",
  /** JSON Schema for the payload of this kind. */
  schema: "schema",
  /** On `accepts`: agents MUST confirm with the user before sending. On a Surface field: its value is private and never published. */
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
  /** `{ reason, instructions, url, resumeToken, expiresAt, whatAgentShouldSayToUser }`; without the token members on `availability`. */
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
  /** On a `conflict` from `/axe/resume`: `open` before the human finished or approved, `cancelled` after a person cancelled the handoff, `invalidated` after the state an approval was bound to changed ([P-APPR-4] to [P-APPR-6]). */
  handoffStatus: "handoffStatus",
  /** The id of the handoff an approval event is about: the `axe_handoff` value, and the id `getHandoff`, `approveHandoff`, and `cancelHandoff` take. */
  handoffId: "handoffId",
  /** `in_progress` on a retryable `conflict` returned while another request is running the same operation ([P-OP-2]). */
  operationStatus: "operationStatus",
  /** The server's request body limit in bytes, on a `payload_too_large` refusal ([P-LIM-1]). */
  maxBodyBytes: "maxBodyBytes",
  /** `true` on a schema node the server checks more strictly than JSON Schema can say (a Zod refinement, custom type, or preprocess); a value that matches may still be refused with `invalid_input` ([P-SCHEMA-5]). */
  axeRefined: "x-axe-refined",
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
  /** `{ rev?, url? }`: the site publishes live state and a revision. */
  live: "live",
  /** `{ available, reason?, requires?, handoff? }`: whether the action can be done right now, and why not. */
  availability: "availability",
  /** Whether the action or control can be done right now. */
  available: "available",
  /** `accepts`-shaped list of kinds that would make the action available. */
  requires: "requires",
  /** The site's single revision: an opaque string or number that moves with every observable change. */
  rev: "rev",
  /** The revision the agent observed; the call is refused with `conflict` if it moved. On a dynamic affordance, the revision to present when following it. */
  expectedRev: "expectedRev",
  /** The site's revision at the time a stale `expectedRev` was refused. */
  currentRev: "currentRev",
  /** What an action event records, as a dotted name in the action's namespace. */
  event: "event",
  /** The id of the row a parameterized action acts on, from `<ns>.observe`. */
  entryId: "entryId",
  /** Present when more rows match the filters; passed back as `cursor` for the next page. */
  nextCursor: "nextCursor",
  /** Where a derived name came from: `aria-label`, `label`, `text`, `placeholder`, `icon`, `href`, and so on. */
  nameFrom: "nameFrom",
  /** Configuration rules that matched no control: `stale` on their route, or `unmatched` anywhere yet. */
  staleConfig: "staleConfig",
} as const);

/** `domAttribute` names. */
export const domAttribute = /* @__PURE__ */ Object.freeze({
  /** The entry id on the element that receives the interaction; one element per entry. */
  surfaceId: "data-surface-id",
  /** The entry kind: `action`, `field`, or `collection`. */
  surfaceKind: "data-surface-kind",
  /** The entry's `object`, when it has one. */
  surfaceObject: "data-surface-object",
  /** Why the control is unavailable or read only, in the application's words. */
  surfaceReason: "data-surface-reason",
  /** The entry name as the control's accessible name: the outcome, never the widget. */
  label: "aria-label",
  /** `true` on an unavailable action; the application keeps its own `disabled`. */
  disabled: "aria-disabled",
  /** `true` on a read-only field. */
  readOnly: "aria-readonly",
} as const);

/** `markup` names. */
export const markup = /* @__PURE__ */ Object.freeze({
  /** A subtree an auto-derived surface never reads: the application's own agent UI, the relay's indicator. */
  ignore: "data-surface-ignore",
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
  /** Emitted by the SDK when a credentialed POST comes from an origin the site does not accept ([P-TRANS-2]). */
  crossOriginRefused: "cross_origin_refused",
  /** Emitted by the SDK when a POST to a state-changing endpoint is not `application/json` ([P-TRANS-1]). */
  jsonRequired: "json_required",
  /** Emitted by the SDK, with HTTP 413, when a request body is larger than `maxBodyBytes` ([P-LIM-1]). */
  payloadTooLarge: "payload_too_large",
  /** The default reason of an approval request made with `requestApproval` ([P-APPR-1]). */
  approvalRequired: "approval_required",
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
  /** Fetch `/axe/state`: the current revision and what can be done right now. */
  state: "axe_state",
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
  /** Derive actions from an OpenAPI document; files for review. */
  generate: "axe generate",
  /** Run the relay that lets an agent drive a signed-in tab. */
  relay: "axe relay",
  /** Add Surface to an existing app: `init`, `coverage`, `prompt`. */
  surface: "axe surface",
  /** Detect the app, print the smallest diff that mounts Surface behind a flag, apply it. */
  surfaceInit: "axe surface init",
  /** Open the app headless and report what agents see: gaps and config suggestions. */
  surfaceCoverage: "axe surface coverage",
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
  /** Core: server-side object attached to a token and delivered back to hooks. Client: fetch `/axe/state`. */
  state: "state",
  /** Record that the human finished a handoff, optionally binding identity. */
  completeHandoff: "completeHandoff",
  /** Result helper: a `needs_human` approval request for this exact call, resumed only after a person approves it on the site ([P-APPR-1]). */
  requestApproval: "requestApproval",
  /** Action option: the state an approval is bound to, re-read at approval and at resume; a change voids the approval ([P-APPR-6]). */
  approvalState: "approvalState",
  /** What the site's own handoff or approval page may show: action, principal, tenant, status, and for an approval the input and bound state. */
  getHandoff: "getHandoff",
  /** Record a person's approval of an approval request, from the site's own session-authenticated page ([P-APPR-3]). */
  approveHandoff: "approveHandoff",
  /** Record that a person cancelled a handoff that has not been used; a later resume is refused ([P-APPR-5]). */
  cancelHandoff: "cancelHandoff",
  /** On `onResume`'s `approval`: who approved, as the site named them to `approveHandoff`. */
  approvedBy: "approvedBy",
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
  /** Hook called with every result envelope; on an `ActionProvider`, called with the results of its own actions. */
  onResult: "onResult",
  /** Passed to a provider's `onResult`: the hook context plus `identity`, `siteKey`, `input`, `expectedRev`, and `handled`. */
  providerResultContext: "ProviderResultContext",
  /** Hook called when a handler throws. */
  onError: "onError",
  /** Hook receiving every analytics event; sinks attach here. */
  onEvent: "onEvent",
  /** Event sink that prints one JSON line per event to stdout. */
  consoleSink: "consoleSink",
  /** Event sink that appends JSON lines to a file. Node only, so it has its own subpath. */
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
  /** Config: returns the site's current revision; enables `rev` on envelopes, the `expectedRev` check, and `/axe/state`. */
  revision: "revision",
  /** Return the manifest with `live.rev` and each action's `availability` computed for a request. */
  describeLive: "describeLive",
  /** Add an `ActionProvider`: a source of actions consulted whenever actions are enumerated or looked up by name. */
  addProvider: "addProvider",
  /** Subscribe to changes in the set of actions: a registration, a new provider, or a provider's own change. */
  onActionsChanged: "onActionsChanged",
  /** Helper that turns an `Availability` into an `unavailable` error with `details`. */
  unavailable: "unavailable",
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
  /** Render a `/axe/state` document as Markdown: what can be done now, and why not. */
  stateToMarkdown: "stateToMarkdown",
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
  /** Create a surface: the registry, revision, observe, and act. */
  createSurface: "createSurface",
  /** Remove one entry. */
  unregister: "unregister",
  /** Drop entries under a prefix that a re-scan did not keep. */
  reconcile: "reconcile",
  /** Advance the revision after a change, notifying listeners. */
  bump: "bump",
  /** Adopt a persisted revision if it is ahead. */
  seedRev: "seedRev",
  /** Adopt the application's own revision as is. */
  setRev: "setRev",
  /** Read the revision. */
  currentRev: "currentRev",
  /** Subscribe to revision changes. */
  onChange: "onChange",
  /** Provide the domain objects included in every snapshot. */
  setObjects: "setObjects",
  /** Take an indexed snapshot of the live table. */
  observe: "observe",
  /** Run one control's own handler under the revision guard; returns a result envelope. */
  act: "act",
  /** Publish observe and act on a host object for browser agents. */
  expose: "expose",
  /** React hook that keeps one entry registered while mounted. */
  useSurface: "useSurface",
  /** Derive an action provider from a surface: observe, ledger, and one action per entry. */
  surfaceActions: "surfaceActions",
  /** The AXE action name for an entry id: `<ns>.<slug>`, stable for the life of the bridge. */
  actionNameFor: "actionNameFor",
  /** The exact entry id an action name was issued for, or undefined. */
  entryIdFor: "entryIdFor",
  /** The plain slug of an entry id, before collision handling. */
  entrySlug: "entrySlug",
  /** Every registered entry, in registration order. */
  entries: "entries",
  /** Counter moved by register, unregister, reconcile, and reset; a bump alone leaves it. */
  registryVersion: "registryVersion",
  /** One entry's live availability as the bridge publishes it, honoring a freeze. */
  availability: "availability",
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
  /** Config: the content-type and origin rules applied to POSTs before anything runs ([P-TRANS-1] to [P-TRANS-4]). */
  requestPolicy: "requestPolicy",
  /** Request policy option: refuse non-JSON bodies on state-changing endpoints (default true). */
  requireJsonContentType: "requireJsonContentType",
  /** Request policy option: origins besides `baseUrl`'s whose browser requests may carry cookies. */
  trustedOrigins: "trustedOrigins",
  /** Request policy option: `cookie` (default), `always`, or `off`; when the origin rule applies. */
  originCheck: "originCheck",
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
  /** Client and discover option: which destinations the client may contact and which receive credentials (spec §17.1). */
  trust: "trust",
  /** Trust option: contact other https origins a site names, without credentials (default false). */
  allowCrossOrigin: "allowCrossOrigin",
  /** Trust option: plain http policy; `"localhost"` (default) allows it only for authorized loopback origins. */
  allowHttp: "allowHttp",
  /** Trust option: callback that gates every outbound URL, redirects included; return false to refuse. */
  destinationPolicy: "destinationPolicy",
  /** Whether the client may contact a URL, and with credentials, without sending anything. */
  checkDestination: "checkDestination",
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
  /** Hook receiving action events, the ledger lines handlers record with `emit`. */
  onActionEvent: "onActionEvent",
  /** Handler context: record an action event for the `onActionEvent` sinks. */
  emit: "emit",
  /** Read the ledger, oldest first (`since`, `actor`, `limit`): acts run and refused, recorded changes, refusals before the surface. */
  ledger: "ledger",
  /** Append a change the application made outside `act`, or a refusal the surface never saw; runs no handler, moves no revision. */
  record: "record",
  /** Mark every entry unavailable with a reason during a transient state; returns thaw. */
  freeze: "freeze",
  /** Release one freeze; the last release restores the entries and moves the revision. */
  thaw: "thaw",
  /** The attributes a rendered control carries for an entry (name, id, kind, reason). */
  surfaceAttributes: "surfaceAttributes",
  /** CSS selector that finds the rendered control for an entry id. */
  surfaceSelector: "surfaceSelector",
  /** One plain-text line for an entry: name, availability and reason, effect. */
  describeEntry: "describeEntry",
  /** React hook that registers an entry and returns its live attributes as props. */
  useSurfaceProps: "useSurfaceProps",
  /** The DOM mirror for one registered entry from its live availability: attributes to set and to remove. */
  attributesFor: "attributesFor",
  /** Listen for every change a reader could see, registration and `setRev` included; a React external-store subscription. */
  subscribe: "subscribe",
  /** Who moves the revision: `surface` (`bump`) or `app` (`setRev`). */
  revisionMode: "revisionMode",
  /** Every attribute the DOM mirror may set, from the `domAttribute` table. */
  surfaceAttributeNames: "SURFACE_ATTRIBUTES",
  /** Converts a Zod schema to JSON Schema; also the converter option a surface publishes Zod schemas through. */
  toJsonSchema: "toJsonSchema",
  /** Error a handler throws when its own conditional write finds a newer revision; `act` returns `conflict` and applies nothing. */
  surfaceConflict: "SurfaceConflict",
  /** `{ id, op, expectedRev, actor }`, passed to a handler, setter, or `more`, so the write can carry the presented revision. */
  actContext: "ActContext",
  /** One surface per tenant and principal, created on first use, evicted when idle or over `max`. */
  scopedSurfaces: "scopedSurfaces",
  /** Bridge option: the auth mode of one entry's action, overriding `auth`. */
  authFor: "authFor",
  /** Bridge option: rewrite the details of each `surface.act` event before it is emitted. */
  redactEvent: "redactEvent",
  /** `scopedSurfaces` option: evict a surface unused for this long (default 30 minutes). */
  idleMs: "idleMs",
  /** `scopedSurfaces` option: called with each evicted surface. */
  onEvict: "onEvict",
  /** The scope key `scopedSurfaces` computes for a caller: tenant and principal. */
  keyFor: "keyFor",
  /** Durable `IdempotencyStore` over `node:sqlite` (Node 22.5 or newer); claims are single SQL statements. */
  sqliteIdempotencyStore: "SqliteIdempotencyStore",
  /** Config: how long an operation claim holds before a retry of the same operation may take it over (default 60). */
  operationLeaseSeconds: "operationLeaseSeconds",
  /** Handler context member: a stable id for the operation, the same on every retry, for downstream idempotency. */
  operationId: "operationId",
  /** Config: the largest request body the runtime reads, in bytes (default 1048576); larger is refused with 413 ([P-LIM-1]). */
  maxBodyBytes: "maxBodyBytes",
  /** `MemoryTokenStore` and `MemoryIdempotencyStore` option: most entries held; the oldest evictable are dropped at the limit (default 10000, [P-LIM-4]). */
  maxEntries: "maxEntries",
  /** `MemoryTokenStore` and `MemoryIdempotencyStore` option: least time between two sweeps of expired entries on writes (default 60000). */
  sweepIntervalMs: "sweepIntervalMs",
  /** `SqliteIdempotencyStore` method: delete rows that expired before a time; run it from a periodic job ([P-LIM-4]). */
  prune: "prune",
  /** Report what the SDK's JSON Schema validator would refuse to apply in a schema, and patterns shaped for catastrophic backtracking ([P-SCHEMA-2]). */
  schemaProblems: "schemaProblems",
  /** Client and discover option: abort one request, redirects and body included, after this many milliseconds (default 30000). */
  timeoutMs: "timeoutMs",
  /** Client and discover option: largest response body the client reads, in bytes (default 4194304). */
  maxResponseBytes: "maxResponseBytes",
  /** `poll` and `run` option: most poll requests before the last `pending` is returned (default 60). */
  maxPollAttempts: "maxPollAttempts",
  /** Validate a value against a JSON Schema in the supported subset; never throws, refuses what it cannot apply ([P-SCHEMA-2]). */
  validateJsonSchema: "validateJsonSchema",
  /** Apply every lint rule to one action definition, the schema rules included. */
  lintAction: "lintAction",
  /** Whether a pattern has the nested-repetition shape that backtracks catastrophically ([P-SCHEMA-4]). */
  isBacktrackingPattern: "isBacktrackingPattern",
  /** `serveHttp` option: each verified caller's AXE identity (`CallerContext`), asked on every tool call. */
  clientFor: "clientFor",
  /** `serveHttp` session option: close a session with no request for this long (default 30 minutes). */
  idleTimeoutMs: "idleTimeoutMs",
  /** `serveHttp` session option: open sessions at most; past it a new `initialize` gets 503 (default 1000). */
  maxSessions: "maxSessions",
  /** The number of open sessions on a `serveHttp` handler. */
  sessionCount: "sessionCount",
  /** Deprecated `serveHttp` option: a session id generator; setting it turns sessions on. */
  sessionIdGenerator: "sessionIdGenerator",
  /** `serveHttp` option: browser origins allowed besides the endpoint's own; others get 403. */
  allowedOrigins: "allowedOrigins",
  /** `serveHttp` auth option: scopes every access token needs; otherwise 403 `insufficient_scope`. */
  requiredScopes: "requiredScopes",
  /** `serveHttp` auth option: the protected-resource metadata URL sent in `WWW-Authenticate`. */
  resourceMetadataUrl: "resourceMetadataUrl",
  /** The verified access token (the MCP SDK's `AuthInfo`) of one HTTP request; passed to `clientFor`. */
  authInfo: "authInfo",
  /** RFC 9728 metadata for an MCP endpoint: the document, its path and URL, and a handler. */
  protectedResourceMetadata: "protectedResourceMetadata",
  /** Client option: longest a manifest is used before revalidation; a shorter site max-age wins (default 300000). */
  manifestMaxAgeMs: "manifestMaxAgeMs",
  /** Subscribe to manifest refreshes that changed the actions; returns an unsubscribe function. */
  onManifestChange: "onManifestChange",
  /** Register a surface's controls and an observe tool as WebMCP tools, feature-detected; returns a handle. */
  exposeWebMcp: "exposeWebMcp",
  /** The WebMCP object (`document.modelContext`); an `exposeWebMcp` option to pass one or `null`. */
  modelContext: "modelContext",
  /** The draft's method that registers one tool; unregistered by aborting the signal passed with it. */
  registerTool: "registerTool",
  /** Tool annotation for an effect that cannot be undone; set on a control that is not reversible. */
  consequentialHint: "consequentialHint",
  /** The flat JSON Schema of a form-mode elicitation; built by `@axe/mcp` from a kind's payload schema. */
  requestedSchema: "requestedSchema",
  /** Whether an accepted kind may never be collected in a form: flagged sensitive, a payment, identity, or credential kind. */
  isSensitiveAccept: "isSensitiveAccept",
  /** The MCP form-mode schema for a kind's payload schema, or null when it has no flat rendering. */
  toFormSchema: "toFormSchema",
  /** Tool annotation: the tool changes nothing; set on the observe tool. */
  readOnlyHint: "readOnlyHint",
  /** Tool annotation: the result carries text the agent should treat as untrusted; set on every surface tool. */
  untrustedContentHint: "untrustedContentHint",
  /** Derive an action provider from a surface as a fixed set of parameterized actions, plus observe and ledger. */
  domainActions: "domainActions",
  /** The domain action that acts on an entry id now, or undefined. */
  actionFor: "actionFor",
  /** A domain action's `availability` reason when no entry it covers can be acted on. */
  idleReason: "idleReason",
  /** The largest `limit` `<ns>.observe` accepts; published as `pagination.pageSize.max`. */
  maxPageSize: "maxPageSize",
  /** Connect a page's surface to a relay for the signed-in person; shows the indicator, answers observes and acts. */
  connectRelay: "connectRelay",
  /** `connectRelay` option: returns a fresh relay token, on every connection and before the current one expires. */
  getToken: "getToken",
  /** `connectRelay` option: told after every change of the connection's status, approvals included. */
  onStatus: "onStatus",
  /** `connectRelay` option: which rows wait for the person's approval; default high risk or `confirm`. */
  requireApproval: "requireApproval",
  /** Create a relay: tab connections, a mirror per tab served through `domainActions`, MCP over HTTP and stdio. */
  createRelay: "createRelay",
  /** `createRelay` option: check a tab's token yourself and name its principal and tenant. */
  authenticateTab: "authenticateTab",
  /** `createRelay` option: the OAuth `verifier` for agents over HTTP and `identify`, the principal a token speaks for. */
  agentAuth: "agentAuth",
  /** `createRelay` option: local development on loopback, with pairing codes and development tokens. */
  devPairing: "devPairing",
  /** `createRelay` option: how long a read waits for a fresh snapshot before serving the last one. */
  syncTimeoutMs: "syncTimeoutMs",
  /** `createRelay` option: how long an act waits for a reconnecting (reloading) tab. */
  reconnectGraceMs: "reconnectGraceMs",
  /** `createRelay` option: how long a disconnected or stopped tab stays listed. */
  tabRetentionMs: "tabRetentionMs",
  /** Mint a relay token (HS256 JWT: `sub`, `org`, `aud`, `exp`) for the signed-in person, in the backend. */
  mintRelayToken: "mintRelayToken",
  /** Check a relay token's signature, audience, and expiry; returns its principal, tenant, and claims or null. */
  verifyRelayToken: "verifyRelayToken",
  /** Derive entries from the rendered page and keep them current; returns a handle with `coverage()` and `stop()`. */
  autoSurface: "autoSurface",
  /** The coverage report of an auto surface as Markdown. */
  formatCoverage: "formatCoverage",
  /** The problems of a `SurfaceConfig` as plain sentences; empty when it is sound. */
  checkConfig: "checkConfig",
  /** The generic domain actions of a derived surface: configured groups, `navigate`, `set-field`, `run-control`, `load-more`. */
  autoDomains: "autoDomains",
  /** The recommended AXE bridge for an auto surface: `domainActions` over `autoDomains`. */
  autoActions: "autoActions",
  /** React hook: start `autoSurface` on mount, re-scan on route changes, stop on unmount. */
  useAutoSurface: "useAutoSurface",
  /** The handle of the nearest `SurfaceProvider`, or null before it has started. */
  useAutoSurfaceHandle: "useAutoSurfaceHandle",
  /** The element an auto entry was derived from, when it is on the page. */
  elementFor: "elementFor",
  /** What the scan recorded about an entry: its key, source, name source and confidence, risk, and policy. */
  metaFor: "metaFor",
  /** How long DOM changes are coalesced before a re-scan. */
  debounceMs: "debounceMs",
  /** How long the page must go without a DOM change before an act reports. */
  quietMs: "quietMs",
  /** Action source: one candidate per OpenAPI 3.x operation, with an HTTP handler. */
  fromOpenAPI: "fromOpenAPI",
  /** Action source: a table of zod-typed functions keyed by action name. */
  fromFunctions: "fromFunctions",
  /** Action source: a tRPC router's queries and mutations, read structurally. */
  fromTRPCRouter: "fromTRPCRouter",
  /** Register every generated action on a server. */
  registerGenerated: "registerGenerated",
  /** One line per generator warning. */
  formatWarnings: "formatWarnings",
  /** Convert the common JSON Schema subset to Zod, warning on the rest. */
  jsonSchemaToZod: "jsonSchemaToZod",
  /** Policy: risk for candidates whose source did not decide. */
  defaultRisk: "defaultRisk",
  /** Policy: leave out actions above this risk. */
  maxRisk: "maxRisk",
  /** Policy: leave out actions whose input fields lack descriptions. */
  requireInputDescriptions: "requireInputDescriptions",
  /** OpenAPI option: keep operations the document marks deprecated. */
  includeDeprecated: "includeDeprecated",
  /** tRPC option: build the router context from the AXE handler context. */
  createContext: "createContext",
} as const);

/** `schema` names. */
export const schema = /* @__PURE__ */ Object.freeze({
  /** Members not named by `properties` or `patternProperties`. */
  additionalProperties: "additionalProperties",
  /** Members whose names match a pattern. */
  patternProperties: "patternProperties",
  /** A schema every member name must match. */
  propertyNames: "propertyNames",
  /** Fewest members. */
  minProperties: "minProperties",
  /** Most members. */
  maxProperties: "maxProperties",
  /** Members required when another is present. */
  dependentRequired: "dependentRequired",
  /** A schema applied when a member is present. */
  dependentSchemas: "dependentSchemas",
  /** Schemas for the first array items, in order (tuples). */
  prefixItems: "prefixItems",
  /** Fewest array items. */
  minItems: "minItems",
  /** Most array items. */
  maxItems: "maxItems",
  /** No two array items deeply equal. */
  uniqueItems: "uniqueItems",
  /** Fewest items matching `contains`. */
  minContains: "minContains",
  /** Most items matching `contains`. */
  maxContains: "maxContains",
  /** Shortest string, in code points. */
  minLength: "minLength",
  /** Number strictly above. */
  exclusiveMinimum: "exclusiveMinimum",
  /** Number strictly below. */
  exclusiveMaximum: "exclusiveMaximum",
  /** Number an exact decimal multiple of ([P-SCHEMA-3]). */
  multipleOf: "multipleOf",
  /** Every schema must match. */
  allOf: "allOf",
  /** At least one schema must match. */
  anyOf: "anyOf",
  /** Exactly one schema must match. */
  oneOf: "oneOf",
  /** Ignored by the validator. */
  writeOnly: "writeOnly",
  /** Refuses every value in the SDK's validator ([P-SCHEMA-2]). */
  unevaluatedProperties: "unevaluatedProperties",
  /** Refuses every value in the SDK's validator ([P-SCHEMA-2]). */
  unevaluatedItems: "unevaluatedItems",
  /** Draft 7; refuses every value in the SDK's validator ([P-SCHEMA-2]). */
  additionalItems: "additionalItems",
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
  entryKind,
  op,
  field,
  domAttribute,
  markup,
  reason,
  tool,
  cli,
  payload,
  api,
  schema,
} as const);

export type Wire = typeof WIRE;
/** Union of every `protocol` name. */
export type WireProtocol = "axe/0.1";
/** Union of every `path` name. */
export type WirePath = "/.well-known/axe.json" | "/axe/manifest" | "/.well-known/axe-index.json" | "/axe/actions" | "/axe/continue" | "/axe/resume" | "/axe/poll" | "/axe/state";
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
/** Union of every `entryKind` name. */
export type WireEntryKind = "action" | "field" | "collection";
/** Union of every `op` name. */
export type WireOp = "CLICK" | "TOGGLE" | "TYPE_TEXT" | "SCROLL_DOWN";
/** Union of every `field` name. */
export type WireField = "app" | "at" | "entries" | "objects" | "index" | "role" | "object" | "state" | "effect" | "mutates" | "confirm" | "text" | "edit" | "maxLength" | "value" | "total" | "loaded" | "filter" | "sort" | "op" | "target" | "actor" | "changed" | "seq" | "ledgerSeq" | "revBefore" | "revAfter" | "limit" | "frozen" | "ignoredRev" | "conflict" | "textHash" | "source" | "tier" | "protocol" | "name" | "description" | "baseUrl" | "humanFallbackUrl" | "auth" | "modes" | "userLoginUrl" | "actions" | "flows" | "steps" | "policies" | "rateLimit" | "requestsPerMinute" | "burst" | "termsUrl" | "dataRetention" | "agents" | "allow" | "deny" | "contact" | "email" | "brand" | "logoUrl" | "accentColor" | "tone" | "indexUrl" | "updatedAt" | "platform" | "sites" | "manifestUrl" | "tags" | "next" | "title" | "input" | "output" | "readOnly" | "idempotent" | "reversible" | "risk" | "examples" | "display" | "affordances" | "pagination" | "cursorIn" | "cursorOut" | "pageSize" | "default" | "max" | "freshness" | "cacheTtlSeconds" | "validUntil" | "humanHandoff" | "reasons" | "deprecated" | "since" | "replacedBy" | "kind" | "items" | "item" | "id" | "subtitle" | "summary" | "image" | "url" | "price" | "amount" | "currency" | "period" | "attributes" | "label" | "path" | "format" | "compare" | "badges" | "suggestedComparison" | "emptyMessage" | "disclaimer" | "action" | "primary" | "_axe" | "context" | "onBehalfOf" | "locale" | "timezone" | "agent" | "version" | "vendor" | "sessionId" | "idempotencyKey" | "status" | "reason" | "message" | "accepts" | "schema" | "sensitive" | "instructions" | "continuationToken" | "expiresAt" | "fallback" | "payload" | "handoff" | "resumeToken" | "whatAgentShouldSayToUser" | "pollUrl" | "retryAfter" | "error" | "code" | "retryable" | "details" | "issues" | "handoffStatus" | "handoffId" | "operationStatus" | "maxBodyBytes" | "x-axe-refined" | "expected" | "schemaVersion" | "ts" | "latencyMs" | "ladder" | "errorCode" | "tenant" | "live" | "availability" | "available" | "requires" | "rev" | "expectedRev" | "currentRev" | "event" | "entryId" | "nextCursor" | "nameFrom" | "staleConfig";
/** Union of every `domAttribute` name. */
export type WireDomAttribute = "data-surface-id" | "data-surface-kind" | "data-surface-object" | "data-surface-reason" | "aria-label" | "aria-disabled" | "aria-readonly";
/** Union of every `markup` name. */
export type WireMarkup = "data-surface-ignore";
/** Union of every `reason` name. */
export type WireReason = "login_required" | "payment_required" | "consent_required" | "identity_required" | "document_required" | "cross_origin_refused" | "json_required" | "payload_too_large" | "approval_required";
/** Union of every `tool` name. */
export type WireTool = "axe_continue" | "axe_resume" | "axe_manifest" | "axe_poll" | "axe_state";
/** Union of every `cli` name. */
export type WireCli = "axe init" | "axe validate" | "axe inspect" | "axe preview" | "axe conformance" | "axe audit" | "axe mcp" | "axe generate" | "axe relay" | "axe surface" | "axe surface init" | "axe surface coverage";
/** Union of every `payload` name. */
export type WirePayload = "token" | "provider" | "brand" | "last4" | "expMonth" | "expYear" | "billingPostalCode" | "accountHolderName" | "routingNumber" | "accountNumber" | "accountType" | "authorizedAt" | "authorizationText" | "referenceNumber" | "sentAt" | "bankName" | "companyName" | "billingEmail" | "purchaseOrderNumber" | "netTermsDays" | "taxId" | "documentType" | "documentNumber" | "issuingCountry" | "fullName" | "dateOfBirth" | "expiresOn" | "mimeType" | "filename" | "sizeBytes" | "contentBase64" | "phone" | "canReceiveSms" | "line1" | "line2" | "city" | "region" | "postalCode" | "country" | "policyUrl" | "policyVersion" | "scope" | "acceptedAt" | "acceptedBy";
/** Union of every `api` name. */
export type WireApi = "createAXE" | "action" | "register" | "describe" | "fetchHandler" | "handler" | "needsInput" | "onContinue" | "onResume" | "onPoll" | "state" | "completeHandoff" | "requestApproval" | "approvalState" | "getHandoff" | "approveHandoff" | "cancelHandoff" | "approvedBy" | "resolveDisplay" | "kinds" | "accept" | "lintAgentText" | "lintManifest" | "onRequest" | "onResult" | "ProviderResultContext" | "onError" | "onEvent" | "consoleSink" | "jsonlFileSink" | "otelSink" | "tokenStore" | "idempotencyStore" | "secret" | "cors" | "authenticate" | "verifySiteKey" | "index" | "revision" | "describeLive" | "addProvider" | "onActionsChanged" | "unavailable" | "discover" | "manifest" | "invoke" | "continue" | "resume" | "poll" | "run" | "fulfillers" | "confirm" | "present" | "toMarkdown" | "toHTML" | "stateToMarkdown" | "createMcpServer" | "serveStdio" | "serveHttp" | "axeExpress" | "axeNext" | "axeNextPages" | "axeFetch" | "runConformance" | "runAudit" | "createTestClient" | "checkVocabularyDrift" | "createSurface" | "unregister" | "reconcile" | "bump" | "seedRev" | "setRev" | "currentRev" | "onChange" | "setObjects" | "observe" | "act" | "expose" | "useSurface" | "surfaceActions" | "actionNameFor" | "entryIdFor" | "entrySlug" | "entries" | "registryVersion" | "availability" | "withMimeTypes" | "customKind" | "suggestedReason" | "ttlSeconds" | "requireCompletion" | "appendHandoffId" | "completion" | "identity" | "claims" | "siteKey" | "requireIdempotencyKey" | "idempotencyTtlSeconds" | "manifestCacheSeconds" | "allowCredentials" | "requestPolicy" | "requireJsonContentType" | "trustedOrigins" | "originCheck" | "combineSinks" | "parseUserAgent" | "isOk" | "isNeedsInput" | "isNeedsHuman" | "isPending" | "isError" | "allowed" | "retries" | "maxRetryAfterMs" | "maxWaitMs" | "trust" | "allowCrossOrigin" | "allowHttp" | "destinationPolicy" | "checkDestination" | "toolNameFor" | "formatResult" | "pollBudgetMs" | "isAxePath" | "toWebRequest" | "sendWebResponse" | "invokeAction" | "samplePayload" | "formatConformanceTable" | "formatAuditTable" | "formatAuditHtml" | "formatDriftReport" | "onActionEvent" | "emit" | "ledger" | "record" | "freeze" | "thaw" | "surfaceAttributes" | "surfaceSelector" | "describeEntry" | "useSurfaceProps" | "attributesFor" | "subscribe" | "revisionMode" | "SURFACE_ATTRIBUTES" | "toJsonSchema" | "SurfaceConflict" | "ActContext" | "scopedSurfaces" | "authFor" | "redactEvent" | "idleMs" | "onEvict" | "keyFor" | "SqliteIdempotencyStore" | "operationLeaseSeconds" | "operationId" | "maxBodyBytes" | "maxEntries" | "sweepIntervalMs" | "prune" | "schemaProblems" | "timeoutMs" | "maxResponseBytes" | "maxPollAttempts" | "validateJsonSchema" | "lintAction" | "isBacktrackingPattern" | "clientFor" | "idleTimeoutMs" | "maxSessions" | "sessionCount" | "sessionIdGenerator" | "allowedOrigins" | "requiredScopes" | "resourceMetadataUrl" | "authInfo" | "protectedResourceMetadata" | "manifestMaxAgeMs" | "onManifestChange" | "exposeWebMcp" | "modelContext" | "registerTool" | "consequentialHint" | "requestedSchema" | "isSensitiveAccept" | "toFormSchema" | "readOnlyHint" | "untrustedContentHint" | "domainActions" | "actionFor" | "idleReason" | "maxPageSize" | "connectRelay" | "getToken" | "onStatus" | "requireApproval" | "createRelay" | "authenticateTab" | "agentAuth" | "devPairing" | "syncTimeoutMs" | "reconnectGraceMs" | "tabRetentionMs" | "mintRelayToken" | "verifyRelayToken" | "autoSurface" | "formatCoverage" | "checkConfig" | "autoDomains" | "autoActions" | "useAutoSurface" | "useAutoSurfaceHandle" | "elementFor" | "metaFor" | "debounceMs" | "quietMs" | "fromOpenAPI" | "fromFunctions" | "fromTRPCRouter" | "registerGenerated" | "formatWarnings" | "jsonSchemaToZod" | "defaultRisk" | "maxRisk" | "requireInputDescriptions" | "includeDeprecated" | "createContext";
/** Union of every `schema` name. */
export type WireSchema = "additionalProperties" | "patternProperties" | "propertyNames" | "minProperties" | "maxProperties" | "dependentRequired" | "dependentSchemas" | "prefixItems" | "minItems" | "maxItems" | "uniqueItems" | "minContains" | "maxContains" | "minLength" | "exclusiveMinimum" | "exclusiveMaximum" | "multipleOf" | "allOf" | "anyOf" | "oneOf" | "writeOnly" | "unevaluatedProperties" | "unevaluatedItems" | "additionalItems";

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
  { category: "path", key: "state", name: "/axe/state" },
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
  { category: "entryKind", key: "action", name: "action" },
  { category: "entryKind", key: "field", name: "field" },
  { category: "entryKind", key: "collection", name: "collection" },
  { category: "op", key: "click", name: "CLICK" },
  { category: "op", key: "toggle", name: "TOGGLE" },
  { category: "op", key: "typeText", name: "TYPE_TEXT" },
  { category: "op", key: "scrollDown", name: "SCROLL_DOWN" },
  { category: "field", key: "app", name: "app" },
  { category: "field", key: "at", name: "at" },
  { category: "field", key: "entries", name: "entries" },
  { category: "field", key: "objects", name: "objects" },
  { category: "field", key: "index", name: "index" },
  { category: "field", key: "role", name: "role" },
  { category: "field", key: "object", name: "object" },
  { category: "field", key: "state", name: "state" },
  { category: "field", key: "effect", name: "effect" },
  { category: "field", key: "mutates", name: "mutates" },
  { category: "field", key: "confirm", name: "confirm" },
  { category: "field", key: "text", name: "text" },
  { category: "field", key: "edit", name: "edit" },
  { category: "field", key: "maxLength", name: "maxLength" },
  { category: "field", key: "value", name: "value" },
  { category: "field", key: "total", name: "total" },
  { category: "field", key: "loaded", name: "loaded" },
  { category: "field", key: "filter", name: "filter" },
  { category: "field", key: "sort", name: "sort" },
  { category: "field", key: "op", name: "op" },
  { category: "field", key: "target", name: "target" },
  { category: "field", key: "actor", name: "actor" },
  { category: "field", key: "changed", name: "changed" },
  { category: "field", key: "seq", name: "seq" },
  { category: "field", key: "ledgerSeq", name: "ledgerSeq" },
  { category: "field", key: "revBefore", name: "revBefore" },
  { category: "field", key: "revAfter", name: "revAfter" },
  { category: "field", key: "limit", name: "limit" },
  { category: "field", key: "frozen", name: "frozen" },
  { category: "field", key: "ignoredRev", name: "ignoredRev" },
  { category: "field", key: "handlerConflict", name: "conflict" },
  { category: "field", key: "textHash", name: "textHash" },
  { category: "field", key: "source", name: "source" },
  { category: "field", key: "tier", name: "tier" },
  { category: "domAttribute", key: "surfaceId", name: "data-surface-id" },
  { category: "domAttribute", key: "surfaceKind", name: "data-surface-kind" },
  { category: "domAttribute", key: "surfaceObject", name: "data-surface-object" },
  { category: "domAttribute", key: "surfaceReason", name: "data-surface-reason" },
  { category: "domAttribute", key: "label", name: "aria-label" },
  { category: "domAttribute", key: "disabled", name: "aria-disabled" },
  { category: "domAttribute", key: "readOnly", name: "aria-readonly" },
  { category: "markup", key: "ignore", name: "data-surface-ignore" },
  { category: "reason", key: "loginRequired", name: "login_required" },
  { category: "reason", key: "paymentRequired", name: "payment_required" },
  { category: "reason", key: "consentRequired", name: "consent_required" },
  { category: "reason", key: "identityRequired", name: "identity_required" },
  { category: "reason", key: "documentRequired", name: "document_required" },
  { category: "reason", key: "crossOriginRefused", name: "cross_origin_refused" },
  { category: "reason", key: "jsonRequired", name: "json_required" },
  { category: "reason", key: "payloadTooLarge", name: "payload_too_large" },
  { category: "reason", key: "approvalRequired", name: "approval_required" },
  { category: "tool", key: "continue", name: "axe_continue" },
  { category: "tool", key: "resume", name: "axe_resume" },
  { category: "tool", key: "manifest", name: "axe_manifest" },
  { category: "tool", key: "poll", name: "axe_poll" },
  { category: "tool", key: "state", name: "axe_state" },
  { category: "cli", key: "init", name: "axe init" },
  { category: "cli", key: "validate", name: "axe validate" },
  { category: "cli", key: "inspect", name: "axe inspect" },
  { category: "cli", key: "preview", name: "axe preview" },
  { category: "cli", key: "conformance", name: "axe conformance" },
  { category: "cli", key: "audit", name: "axe audit" },
  { category: "cli", key: "mcp", name: "axe mcp" },
  { category: "cli", key: "generate", name: "axe generate" },
  { category: "cli", key: "relay", name: "axe relay" },
  { category: "cli", key: "surface", name: "axe surface" },
  { category: "cli", key: "surfaceInit", name: "axe surface init" },
  { category: "cli", key: "surfaceCoverage", name: "axe surface coverage" },
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
  { category: "field", key: "handoffId", name: "handoffId" },
  { category: "field", key: "operationStatus", name: "operationStatus" },
  { category: "field", key: "maxBodyBytes", name: "maxBodyBytes" },
  { category: "field", key: "axeRefined", name: "x-axe-refined" },
  { category: "field", key: "expected", name: "expected" },
  { category: "field", key: "schemaVersion", name: "schemaVersion" },
  { category: "field", key: "ts", name: "ts" },
  { category: "field", key: "latencyMs", name: "latencyMs" },
  { category: "field", key: "ladder", name: "ladder" },
  { category: "field", key: "errorCode", name: "errorCode" },
  { category: "field", key: "tenant", name: "tenant" },
  { category: "field", key: "live", name: "live" },
  { category: "field", key: "availability", name: "availability" },
  { category: "field", key: "available", name: "available" },
  { category: "field", key: "requires", name: "requires" },
  { category: "field", key: "rev", name: "rev" },
  { category: "field", key: "expectedRev", name: "expectedRev" },
  { category: "field", key: "currentRev", name: "currentRev" },
  { category: "field", key: "event", name: "event" },
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
  { category: "api", key: "requestApproval", name: "requestApproval" },
  { category: "api", key: "approvalState", name: "approvalState" },
  { category: "api", key: "getHandoff", name: "getHandoff" },
  { category: "api", key: "approveHandoff", name: "approveHandoff" },
  { category: "api", key: "cancelHandoff", name: "cancelHandoff" },
  { category: "api", key: "approvedBy", name: "approvedBy" },
  { category: "api", key: "resolveDisplay", name: "resolveDisplay" },
  { category: "api", key: "kinds", name: "kinds" },
  { category: "api", key: "accept", name: "accept" },
  { category: "api", key: "lintAgentText", name: "lintAgentText" },
  { category: "api", key: "lintManifest", name: "lintManifest" },
  { category: "api", key: "onRequest", name: "onRequest" },
  { category: "api", key: "onResult", name: "onResult" },
  { category: "api", key: "providerResultContext", name: "ProviderResultContext" },
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
  { category: "api", key: "revision", name: "revision" },
  { category: "api", key: "describeLive", name: "describeLive" },
  { category: "api", key: "addProvider", name: "addProvider" },
  { category: "api", key: "onActionsChanged", name: "onActionsChanged" },
  { category: "api", key: "unavailable", name: "unavailable" },
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
  { category: "api", key: "stateToMarkdown", name: "stateToMarkdown" },
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
  { category: "api", key: "createSurface", name: "createSurface" },
  { category: "api", key: "unregister", name: "unregister" },
  { category: "api", key: "reconcile", name: "reconcile" },
  { category: "api", key: "bump", name: "bump" },
  { category: "api", key: "seedRev", name: "seedRev" },
  { category: "api", key: "setRev", name: "setRev" },
  { category: "api", key: "currentRev", name: "currentRev" },
  { category: "api", key: "onChange", name: "onChange" },
  { category: "api", key: "setObjects", name: "setObjects" },
  { category: "api", key: "observe", name: "observe" },
  { category: "api", key: "act", name: "act" },
  { category: "api", key: "expose", name: "expose" },
  { category: "api", key: "useSurface", name: "useSurface" },
  { category: "api", key: "surfaceActions", name: "surfaceActions" },
  { category: "api", key: "actionNameFor", name: "actionNameFor" },
  { category: "api", key: "entryIdFor", name: "entryIdFor" },
  { category: "api", key: "entrySlug", name: "entrySlug" },
  { category: "api", key: "entries", name: "entries" },
  { category: "api", key: "registryVersion", name: "registryVersion" },
  { category: "api", key: "availability", name: "availability" },
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
  { category: "api", key: "requestPolicy", name: "requestPolicy" },
  { category: "api", key: "requireJsonContentType", name: "requireJsonContentType" },
  { category: "api", key: "trustedOrigins", name: "trustedOrigins" },
  { category: "api", key: "originCheck", name: "originCheck" },
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
  { category: "api", key: "trust", name: "trust" },
  { category: "api", key: "allowCrossOrigin", name: "allowCrossOrigin" },
  { category: "api", key: "allowHttp", name: "allowHttp" },
  { category: "api", key: "destinationPolicy", name: "destinationPolicy" },
  { category: "api", key: "checkDestination", name: "checkDestination" },
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
  { category: "api", key: "onActionEvent", name: "onActionEvent" },
  { category: "api", key: "emit", name: "emit" },
  { category: "api", key: "ledger", name: "ledger" },
  { category: "api", key: "record", name: "record" },
  { category: "api", key: "freeze", name: "freeze" },
  { category: "api", key: "thaw", name: "thaw" },
  { category: "api", key: "surfaceAttributes", name: "surfaceAttributes" },
  { category: "api", key: "surfaceSelector", name: "surfaceSelector" },
  { category: "api", key: "describeEntry", name: "describeEntry" },
  { category: "api", key: "useSurfaceProps", name: "useSurfaceProps" },
  { category: "api", key: "attributesFor", name: "attributesFor" },
  { category: "api", key: "subscribe", name: "subscribe" },
  { category: "api", key: "revisionMode", name: "revisionMode" },
  { category: "api", key: "surfaceAttributeNames", name: "SURFACE_ATTRIBUTES" },
  { category: "api", key: "toJsonSchema", name: "toJsonSchema" },
  { category: "api", key: "surfaceConflict", name: "SurfaceConflict" },
  { category: "api", key: "actContext", name: "ActContext" },
  { category: "api", key: "scopedSurfaces", name: "scopedSurfaces" },
  { category: "api", key: "authFor", name: "authFor" },
  { category: "api", key: "redactEvent", name: "redactEvent" },
  { category: "api", key: "idleMs", name: "idleMs" },
  { category: "api", key: "onEvict", name: "onEvict" },
  { category: "api", key: "keyFor", name: "keyFor" },
  { category: "api", key: "sqliteIdempotencyStore", name: "SqliteIdempotencyStore" },
  { category: "api", key: "operationLeaseSeconds", name: "operationLeaseSeconds" },
  { category: "api", key: "operationId", name: "operationId" },
  { category: "api", key: "maxBodyBytes", name: "maxBodyBytes" },
  { category: "api", key: "maxEntries", name: "maxEntries" },
  { category: "api", key: "sweepIntervalMs", name: "sweepIntervalMs" },
  { category: "api", key: "prune", name: "prune" },
  { category: "api", key: "schemaProblems", name: "schemaProblems" },
  { category: "api", key: "timeoutMs", name: "timeoutMs" },
  { category: "api", key: "maxResponseBytes", name: "maxResponseBytes" },
  { category: "api", key: "maxPollAttempts", name: "maxPollAttempts" },
  { category: "api", key: "validateJsonSchema", name: "validateJsonSchema" },
  { category: "api", key: "lintAction", name: "lintAction" },
  { category: "api", key: "isBacktrackingPattern", name: "isBacktrackingPattern" },
  { category: "schema", key: "additionalProperties", name: "additionalProperties" },
  { category: "schema", key: "patternProperties", name: "patternProperties" },
  { category: "schema", key: "propertyNames", name: "propertyNames" },
  { category: "schema", key: "minProperties", name: "minProperties" },
  { category: "schema", key: "maxProperties", name: "maxProperties" },
  { category: "schema", key: "dependentRequired", name: "dependentRequired" },
  { category: "schema", key: "dependentSchemas", name: "dependentSchemas" },
  { category: "schema", key: "prefixItems", name: "prefixItems" },
  { category: "schema", key: "minItems", name: "minItems" },
  { category: "schema", key: "maxItems", name: "maxItems" },
  { category: "schema", key: "uniqueItems", name: "uniqueItems" },
  { category: "schema", key: "minContains", name: "minContains" },
  { category: "schema", key: "maxContains", name: "maxContains" },
  { category: "schema", key: "minLength", name: "minLength" },
  { category: "schema", key: "exclusiveMinimum", name: "exclusiveMinimum" },
  { category: "schema", key: "exclusiveMaximum", name: "exclusiveMaximum" },
  { category: "schema", key: "multipleOf", name: "multipleOf" },
  { category: "schema", key: "allOf", name: "allOf" },
  { category: "schema", key: "anyOf", name: "anyOf" },
  { category: "schema", key: "oneOf", name: "oneOf" },
  { category: "schema", key: "writeOnly", name: "writeOnly" },
  { category: "schema", key: "unevaluatedProperties", name: "unevaluatedProperties" },
  { category: "schema", key: "unevaluatedItems", name: "unevaluatedItems" },
  { category: "schema", key: "additionalItems", name: "additionalItems" },
  { category: "api", key: "clientFor", name: "clientFor" },
  { category: "api", key: "idleTimeoutMs", name: "idleTimeoutMs" },
  { category: "api", key: "maxSessions", name: "maxSessions" },
  { category: "api", key: "sessionCount", name: "sessionCount" },
  { category: "api", key: "sessionIdGenerator", name: "sessionIdGenerator" },
  { category: "api", key: "allowedOrigins", name: "allowedOrigins" },
  { category: "api", key: "requiredScopes", name: "requiredScopes" },
  { category: "api", key: "resourceMetadataUrl", name: "resourceMetadataUrl" },
  { category: "api", key: "authInfo", name: "authInfo" },
  { category: "api", key: "protectedResourceMetadata", name: "protectedResourceMetadata" },
  { category: "api", key: "manifestMaxAgeMs", name: "manifestMaxAgeMs" },
  { category: "api", key: "onManifestChange", name: "onManifestChange" },
  { category: "api", key: "exposeWebMcp", name: "exposeWebMcp" },
  { category: "api", key: "modelContext", name: "modelContext" },
  { category: "api", key: "registerTool", name: "registerTool" },
  { category: "api", key: "consequentialHint", name: "consequentialHint" },
  { category: "api", key: "requestedSchema", name: "requestedSchema" },
  { category: "api", key: "isSensitiveAccept", name: "isSensitiveAccept" },
  { category: "api", key: "toFormSchema", name: "toFormSchema" },
  { category: "api", key: "readOnlyHint", name: "readOnlyHint" },
  { category: "api", key: "untrustedContentHint", name: "untrustedContentHint" },
  { category: "field", key: "entryId", name: "entryId" },
  { category: "field", key: "nextCursor", name: "nextCursor" },
  { category: "api", key: "domainActions", name: "domainActions" },
  { category: "api", key: "actionFor", name: "actionFor" },
  { category: "api", key: "idleReason", name: "idleReason" },
  { category: "api", key: "maxPageSize", name: "maxPageSize" },
  { category: "api", key: "connectRelay", name: "connectRelay" },
  { category: "api", key: "getToken", name: "getToken" },
  { category: "api", key: "onStatus", name: "onStatus" },
  { category: "api", key: "requireApproval", name: "requireApproval" },
  { category: "api", key: "createRelay", name: "createRelay" },
  { category: "api", key: "authenticateTab", name: "authenticateTab" },
  { category: "api", key: "agentAuth", name: "agentAuth" },
  { category: "api", key: "devPairing", name: "devPairing" },
  { category: "api", key: "syncTimeoutMs", name: "syncTimeoutMs" },
  { category: "api", key: "reconnectGraceMs", name: "reconnectGraceMs" },
  { category: "api", key: "tabRetentionMs", name: "tabRetentionMs" },
  { category: "api", key: "mintRelayToken", name: "mintRelayToken" },
  { category: "api", key: "verifyRelayToken", name: "verifyRelayToken" },
  { category: "api", key: "autoSurface", name: "autoSurface" },
  { category: "api", key: "formatCoverage", name: "formatCoverage" },
  { category: "api", key: "checkConfig", name: "checkConfig" },
  { category: "api", key: "autoDomains", name: "autoDomains" },
  { category: "api", key: "autoActions", name: "autoActions" },
  { category: "api", key: "useAutoSurface", name: "useAutoSurface" },
  { category: "api", key: "useAutoSurfaceHandle", name: "useAutoSurfaceHandle" },
  { category: "api", key: "elementFor", name: "elementFor" },
  { category: "api", key: "metaFor", name: "metaFor" },
  { category: "field", key: "nameFrom", name: "nameFrom" },
  { category: "field", key: "staleConfig", name: "staleConfig" },
  { category: "api", key: "debounceMs", name: "debounceMs" },
  { category: "api", key: "quietMs", name: "quietMs" },
  { category: "api", key: "fromOpenAPI", name: "fromOpenAPI" },
  { category: "api", key: "fromFunctions", name: "fromFunctions" },
  { category: "api", key: "fromTRPCRouter", name: "fromTRPCRouter" },
  { category: "api", key: "registerGenerated", name: "registerGenerated" },
  { category: "api", key: "formatWarnings", name: "formatWarnings" },
  { category: "api", key: "jsonSchemaToZod", name: "jsonSchemaToZod" },
  { category: "api", key: "defaultRisk", name: "defaultRisk" },
  { category: "api", key: "maxRisk", name: "maxRisk" },
  { category: "api", key: "requireInputDescriptions", name: "requireInputDescriptions" },
  { category: "api", key: "includeDeprecated", name: "includeDeprecated" },
  { category: "api", key: "createContext", name: "createContext" },
]);
