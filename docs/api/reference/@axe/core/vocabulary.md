[AXE API reference](../../README.md) / [@axe/core](README.md) / vocabulary

# vocabulary

## Type Aliases

### Wire

```ts
type Wire = typeof WIRE;
```

Defined in: [packages/core/src/vocabulary.ts:844](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L844)

***

### WireApi

```ts
type WireApi = 
  | "createAXE"
  | "action"
  | "register"
  | "describe"
  | "fetchHandler"
  | "handler"
  | "needsInput"
  | "onContinue"
  | "onResume"
  | "onPoll"
  | "state"
  | "completeHandoff"
  | "resolveDisplay"
  | "kinds"
  | "accept"
  | "lintAgentText"
  | "lintManifest"
  | "onRequest"
  | "onResult"
  | "onError"
  | "onEvent"
  | "consoleSink"
  | "jsonlFileSink"
  | "otelSink"
  | "tokenStore"
  | "idempotencyStore"
  | "secret"
  | "cors"
  | "authenticate"
  | "verifySiteKey"
  | "index"
  | "discover"
  | "manifest"
  | "invoke"
  | "continue"
  | "resume"
  | "poll"
  | "run"
  | "fulfillers"
  | "confirm"
  | "present"
  | "toMarkdown"
  | "toHTML"
  | "createMcpServer"
  | "serveStdio"
  | "serveHttp"
  | "axeExpress"
  | "axeNext"
  | "axeNextPages"
  | "axeFetch"
  | "runConformance"
  | "runAudit"
  | "createTestClient"
  | "checkVocabularyDrift"
  | "withMimeTypes"
  | "customKind"
  | "suggestedReason"
  | "ttlSeconds"
  | "requireCompletion"
  | "appendHandoffId"
  | "completion"
  | "identity"
  | "claims"
  | "siteKey"
  | "requireIdempotencyKey"
  | "idempotencyTtlSeconds"
  | "manifestCacheSeconds"
  | "allowCredentials"
  | "combineSinks"
  | "parseUserAgent"
  | "isOk"
  | "isNeedsInput"
  | "isNeedsHuman"
  | "isPending"
  | "isError"
  | "allowed"
  | "retries"
  | "maxRetryAfterMs"
  | "maxWaitMs"
  | "toolNameFor"
  | "formatResult"
  | "pollBudgetMs"
  | "isAxePath"
  | "toWebRequest"
  | "sendWebResponse"
  | "invokeAction"
  | "samplePayload"
  | "formatConformanceTable"
  | "formatAuditTable"
  | "formatAuditHtml"
  | "formatDriftReport";
```

Defined in: [packages/core/src/vocabulary.ts:890](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L890)

Union of every `api` name.

***

### WireAuthMode

```ts
type WireAuthMode = "none" | "site" | "user";
```

Defined in: [packages/core/src/vocabulary.ts:866](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L866)

Union of every `authMode` name.

***

### WireCli

```ts
type WireCli = 
  | "axe init"
  | "axe validate"
  | "axe inspect"
  | "axe preview"
  | "axe conformance"
  | "axe audit"
  | "axe mcp";
```

Defined in: [packages/core/src/vocabulary.ts:884](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L884)

Union of every `cli` name.

***

### WireCompare

```ts
type WireCompare = "higher-better" | "lower-better" | "neutral";
```

Defined in: [packages/core/src/vocabulary.ts:872](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L872)

Union of every `compare` name.

***

### WireDisplayKind

```ts
type WireDisplayKind = "list" | "item" | "table" | "status" | "document";
```

Defined in: [packages/core/src/vocabulary.ts:868](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L868)

Union of every `displayKind` name.

***

### WireError

```ts
type WireError = 
  | "invalid_input"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "unavailable"
  | "internal"
  | "unsupported";
```

Defined in: [packages/core/src/vocabulary.ts:860](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L860)

Union of every `error` name.

***

### WireField

```ts
type WireField = 
  | "protocol"
  | "name"
  | "description"
  | "baseUrl"
  | "humanFallbackUrl"
  | "auth"
  | "modes"
  | "userLoginUrl"
  | "actions"
  | "flows"
  | "steps"
  | "policies"
  | "rateLimit"
  | "requestsPerMinute"
  | "burst"
  | "termsUrl"
  | "dataRetention"
  | "agents"
  | "allow"
  | "deny"
  | "contact"
  | "email"
  | "brand"
  | "logoUrl"
  | "accentColor"
  | "tone"
  | "indexUrl"
  | "updatedAt"
  | "platform"
  | "sites"
  | "manifestUrl"
  | "tags"
  | "next"
  | "title"
  | "input"
  | "output"
  | "readOnly"
  | "idempotent"
  | "reversible"
  | "risk"
  | "examples"
  | "display"
  | "affordances"
  | "pagination"
  | "cursorIn"
  | "cursorOut"
  | "pageSize"
  | "default"
  | "max"
  | "freshness"
  | "cacheTtlSeconds"
  | "validUntil"
  | "humanHandoff"
  | "reasons"
  | "deprecated"
  | "since"
  | "replacedBy"
  | "kind"
  | "items"
  | "item"
  | "id"
  | "subtitle"
  | "summary"
  | "image"
  | "url"
  | "price"
  | "amount"
  | "currency"
  | "period"
  | "attributes"
  | "label"
  | "path"
  | "format"
  | "compare"
  | "badges"
  | "suggestedComparison"
  | "emptyMessage"
  | "disclaimer"
  | "action"
  | "primary"
  | "_axe"
  | "context"
  | "onBehalfOf"
  | "locale"
  | "timezone"
  | "agent"
  | "version"
  | "vendor"
  | "sessionId"
  | "idempotencyKey"
  | "status"
  | "reason"
  | "message"
  | "accepts"
  | "schema"
  | "sensitive"
  | "instructions"
  | "continuationToken"
  | "expiresAt"
  | "fallback"
  | "payload"
  | "handoff"
  | "resumeToken"
  | "whatAgentShouldSayToUser"
  | "pollUrl"
  | "retryAfter"
  | "error"
  | "code"
  | "retryable"
  | "details"
  | "issues"
  | "handoffStatus"
  | "expected"
  | "schemaVersion"
  | "ts"
  | "latencyMs"
  | "ladder"
  | "errorCode"
  | "tenant";
```

Defined in: [packages/core/src/vocabulary.ts:886](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L886)

Union of every `field` name.

***

### WireFormat

```ts
type WireFormat = 
  | "text"
  | "number"
  | "currency"
  | "date"
  | "datetime"
  | "boolean"
  | "area"
  | "distance"
  | "duration"
  | "list";
```

Defined in: [packages/core/src/vocabulary.ts:870](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L870)

Union of every `format` name.

***

### WireHeader

```ts
type WireHeader = 
  | "AXE-Protocol"
  | "AXE-Manifest"
  | "Retry-After"
  | "RateLimit-Policy"
  | "Authorization"
  | "User-Agent"
  | "Content-Type";
```

Defined in: [packages/core/src/vocabulary.ts:850](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L850)

Union of every `header` name.

***

### WireKind

```ts
type WireKind = 
  | "payment.card"
  | "payment.ach-debit"
  | "payment.wire-confirmation"
  | "payment.invoice"
  | "identity.government-id"
  | "identity.date-of-birth"
  | "identity.ssn-last-4"
  | "document.url"
  | "document.base64"
  | "contact.email"
  | "contact.phone"
  | "contact.address"
  | "consent.terms"
  | "x-";
```

Defined in: [packages/core/src/vocabulary.ts:878](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L878)

Union of every `kind` name.

***

### WireLadder

```ts
type WireLadder = 
  | "ok"
  | "needs_input"
  | "continued"
  | "needs_human"
  | "resumed"
  | "pending"
  | "error";
```

Defined in: [packages/core/src/vocabulary.ts:862](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L862)

Union of every `ladder` name.

***

### WireLink

```ts
type WireLink = "axe-manifest";
```

Defined in: [packages/core/src/vocabulary.ts:852](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L852)

Union of every `link` name.

***

### WirePath

```ts
type WirePath = 
  | "/.well-known/axe.json"
  | "/axe/manifest"
  | "/.well-known/axe-index.json"
  | "/axe/actions"
  | "/axe/continue"
  | "/axe/resume"
  | "/axe/poll";
```

Defined in: [packages/core/src/vocabulary.ts:848](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L848)

Union of every `path` name.

***

### WirePayload

```ts
type WirePayload = 
  | "token"
  | "provider"
  | "brand"
  | "last4"
  | "expMonth"
  | "expYear"
  | "billingPostalCode"
  | "accountHolderName"
  | "routingNumber"
  | "accountNumber"
  | "accountType"
  | "authorizedAt"
  | "authorizationText"
  | "referenceNumber"
  | "sentAt"
  | "bankName"
  | "companyName"
  | "billingEmail"
  | "purchaseOrderNumber"
  | "netTermsDays"
  | "taxId"
  | "documentType"
  | "documentNumber"
  | "issuingCountry"
  | "fullName"
  | "dateOfBirth"
  | "expiresOn"
  | "mimeType"
  | "filename"
  | "sizeBytes"
  | "contentBase64"
  | "phone"
  | "canReceiveSms"
  | "line1"
  | "line2"
  | "city"
  | "region"
  | "postalCode"
  | "country"
  | "policyUrl"
  | "policyVersion"
  | "scope"
  | "acceptedAt"
  | "acceptedBy";
```

Defined in: [packages/core/src/vocabulary.ts:888](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L888)

Union of every `payload` name.

***

### WirePeriod

```ts
type WirePeriod = "once" | "hour" | "day" | "month" | "year";
```

Defined in: [packages/core/src/vocabulary.ts:874](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L874)

Union of every `period` name.

***

### WireProtocol

```ts
type WireProtocol = "axe/0.1";
```

Defined in: [packages/core/src/vocabulary.ts:846](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L846)

Union of every `protocol` name.

***

### WireQuery

```ts
type WireQuery = "axe_handoff";
```

Defined in: [packages/core/src/vocabulary.ts:856](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L856)

Union of every `query` name.

***

### WireReason

```ts
type WireReason = 
  | "login_required"
  | "payment_required"
  | "consent_required"
  | "identity_required"
  | "document_required";
```

Defined in: [packages/core/src/vocabulary.ts:880](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L880)

Union of every `reason` name.

***

### WireRisk

```ts
type WireRisk = "none" | "low" | "medium" | "high";
```

Defined in: [packages/core/src/vocabulary.ts:864](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L864)

Union of every `risk` name.

***

### WireRobots

```ts
type WireRobots = "AXE-Manifest" | "AXE-Index";
```

Defined in: [packages/core/src/vocabulary.ts:854](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L854)

Union of every `robots` name.

***

### WireStatus

```ts
type WireStatus = "ok" | "needs_input" | "needs_human" | "pending" | "error";
```

Defined in: [packages/core/src/vocabulary.ts:858](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L858)

Union of every `status` name.

***

### WireTone

```ts
type WireTone = "formal" | "neutral" | "casual";
```

Defined in: [packages/core/src/vocabulary.ts:876](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L876)

Union of every `tone` name.

***

### WireTool

```ts
type WireTool = "axe_continue" | "axe_resume" | "axe_manifest" | "axe_poll";
```

Defined in: [packages/core/src/vocabulary.ts:882](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L882)

Union of every `tool` name.

## Variables

### api

```ts
const api: Readonly<{
  accept: "accept";
  action: "action";
  allowCredentials: "allowCredentials";
  allowed: "allowed";
  appendHandoffId: "appendHandoffId";
  authenticate: "authenticate";
  axeExpress: "axeExpress";
  axeFetch: "axeFetch";
  axeNext: "axeNext";
  axeNextPages: "axeNextPages";
  checkVocabularyDrift: "checkVocabularyDrift";
  claims: "claims";
  combineSinks: "combineSinks";
  completeHandoff: "completeHandoff";
  completion: "completion";
  confirm: "confirm";
  consoleSink: "consoleSink";
  continue: "continue";
  cors: "cors";
  createAXE: "createAXE";
  createMcpServer: "createMcpServer";
  createTestClient: "createTestClient";
  customKind: "customKind";
  describe: "describe";
  discover: "discover";
  fetchHandler: "fetchHandler";
  formatAuditHtml: "formatAuditHtml";
  formatAuditTable: "formatAuditTable";
  formatConformanceTable: "formatConformanceTable";
  formatDriftReport: "formatDriftReport";
  formatResult: "formatResult";
  fulfillers: "fulfillers";
  handler: "handler";
  idempotencyStore: "idempotencyStore";
  idempotencyTtlSeconds: "idempotencyTtlSeconds";
  identity: "identity";
  index: "index";
  invoke: "invoke";
  invokeAction: "invokeAction";
  isAxePath: "isAxePath";
  isError: "isError";
  isNeedsHuman: "isNeedsHuman";
  isNeedsInput: "isNeedsInput";
  isOk: "isOk";
  isPending: "isPending";
  jsonlFileSink: "jsonlFileSink";
  kinds: "kinds";
  lintAgentText: "lintAgentText";
  lintManifest: "lintManifest";
  manifest: "manifest";
  manifestCacheSeconds: "manifestCacheSeconds";
  maxRetryAfterMs: "maxRetryAfterMs";
  maxWaitMs: "maxWaitMs";
  needsInput: "needsInput";
  onContinue: "onContinue";
  onError: "onError";
  onEvent: "onEvent";
  onPoll: "onPoll";
  onRequest: "onRequest";
  onResult: "onResult";
  onResume: "onResume";
  otelSink: "otelSink";
  parseUserAgent: "parseUserAgent";
  poll: "poll";
  pollBudgetMs: "pollBudgetMs";
  present: "present";
  register: "register";
  requireCompletion: "requireCompletion";
  requireIdempotencyKey: "requireIdempotencyKey";
  resolveDisplay: "resolveDisplay";
  resume: "resume";
  retries: "retries";
  run: "run";
  runAudit: "runAudit";
  runConformance: "runConformance";
  samplePayload: "samplePayload";
  secret: "secret";
  sendWebResponse: "sendWebResponse";
  serveHttp: "serveHttp";
  serveStdio: "serveStdio";
  siteKey: "siteKey";
  state: "state";
  suggestedReason: "suggestedReason";
  toHTML: "toHTML";
  tokenStore: "tokenStore";
  toMarkdown: "toMarkdown";
  toolNameFor: "toolNameFor";
  toWebRequest: "toWebRequest";
  ttlSeconds: "ttlSeconds";
  verifySiteKey: "verifySiteKey";
  withMimeTypes: "withMimeTypes";
}>;
```

Defined in: [packages/core/src/vocabulary.ts:628](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L628)

`api` names.

***

### authMode

```ts
const authMode: Readonly<{
  none: "none";
  site: "site";
  user: "user";
}>;
```

Defined in: [packages/core/src/vocabulary.ts:136](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L136)

`authMode` names.

***

### cli

```ts
const cli: Readonly<{
  audit: "axe audit";
  conformance: "axe conformance";
  init: "axe init";
  inspect: "axe inspect";
  mcp: "axe mcp";
  preview: "axe preview";
  validate: "axe validate";
}>;
```

Defined in: [packages/core/src/vocabulary.ts:276](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L276)

`cli` names.

***

### compare

```ts
const compare: Readonly<{
  higherBetter: "higher-better";
  lowerBetter: "lower-better";
  neutral: "neutral";
}>;
```

Defined in: [packages/core/src/vocabulary.ts:184](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L184)

`compare` names.

***

### displayKind

```ts
const displayKind: Readonly<{
  document: "document";
  item: "item";
  list: "list";
  status: "status";
  table: "table";
}>;
```

Defined in: [packages/core/src/vocabulary.ts:146](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L146)

`displayKind` names.

***

### error

```ts
const error: Readonly<{
  conflict: "conflict";
  forbidden: "forbidden";
  internal: "internal";
  invalidInput: "invalid_input";
  notFound: "not_found";
  rateLimited: "rate_limited";
  unauthorized: "unauthorized";
  unavailable: "unavailable";
  unsupported: "unsupported";
}>;
```

Defined in: [packages/core/src/vocabulary.ts:84](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L84)

`error` names.

***

### field

```ts
const field: Readonly<{
  accentColor: "accentColor";
  accepts: "accepts";
  action: "action";
  actions: "actions";
  affordances: "affordances";
  agent: "agent";
  agents: "agents";
  allow: "allow";
  amount: "amount";
  attributes: "attributes";
  auth: "auth";
  axeReserved: "_axe";
  badges: "badges";
  baseUrl: "baseUrl";
  brand: "brand";
  burst: "burst";
  cacheTtlSeconds: "cacheTtlSeconds";
  code: "code";
  compare: "compare";
  contact: "contact";
  context: "context";
  continuationToken: "continuationToken";
  currency: "currency";
  cursorIn: "cursorIn";
  cursorOut: "cursorOut";
  dataRetention: "dataRetention";
  default: "default";
  deny: "deny";
  deprecated: "deprecated";
  description: "description";
  details: "details";
  disclaimer: "disclaimer";
  display: "display";
  email: "email";
  emptyMessage: "emptyMessage";
  error: "error";
  errorCode: "errorCode";
  examples: "examples";
  expected: "expected";
  expiresAt: "expiresAt";
  fallback: "fallback";
  flows: "flows";
  format: "format";
  freshness: "freshness";
  handoff: "handoff";
  handoffStatus: "handoffStatus";
  humanFallbackUrl: "humanFallbackUrl";
  humanHandoff: "humanHandoff";
  id: "id";
  idempotencyKey: "idempotencyKey";
  idempotent: "idempotent";
  image: "image";
  indexUrl: "indexUrl";
  input: "input";
  instructions: "instructions";
  issues: "issues";
  item: "item";
  items: "items";
  kind: "kind";
  label: "label";
  ladder: "ladder";
  latencyMs: "latencyMs";
  locale: "locale";
  logoUrl: "logoUrl";
  manifestUrl: "manifestUrl";
  max: "max";
  message: "message";
  modes: "modes";
  name: "name";
  next: "next";
  onBehalfOf: "onBehalfOf";
  output: "output";
  pageSize: "pageSize";
  pagination: "pagination";
  path: "path";
  payload: "payload";
  period: "period";
  platform: "platform";
  policies: "policies";
  pollUrl: "pollUrl";
  price: "price";
  primary: "primary";
  protocol: "protocol";
  rateLimit: "rateLimit";
  readOnly: "readOnly";
  reason: "reason";
  reasons: "reasons";
  replacedBy: "replacedBy";
  requestsPerMinute: "requestsPerMinute";
  resumeToken: "resumeToken";
  retryable: "retryable";
  retryAfter: "retryAfter";
  reversible: "reversible";
  risk: "risk";
  schema: "schema";
  schemaVersion: "schemaVersion";
  sensitive: "sensitive";
  sessionId: "sessionId";
  since: "since";
  sites: "sites";
  status: "status";
  steps: "steps";
  subtitle: "subtitle";
  suggestedComparison: "suggestedComparison";
  summary: "summary";
  tags: "tags";
  tenant: "tenant";
  termsUrl: "termsUrl";
  timezone: "timezone";
  title: "title";
  tone: "tone";
  ts: "ts";
  updatedAt: "updatedAt";
  url: "url";
  userLoginUrl: "userLoginUrl";
  validUntil: "validUntil";
  vendor: "vendor";
  version: "version";
  whatAgentShouldSayToUser: "whatAgentShouldSayToUser";
}>;
```

Defined in: [packages/core/src/vocabulary.ts:294](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L294)

`field` names.

***

### format

```ts
const format: Readonly<{
  area: "area";
  boolean: "boolean";
  currency: "currency";
  date: "date";
  datetime: "datetime";
  distance: "distance";
  duration: "duration";
  list: "list";
  number: "number";
  text: "text";
}>;
```

Defined in: [packages/core/src/vocabulary.ts:160](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L160)

`format` names.

***

### header

```ts
const header: Readonly<{
  authorization: "Authorization";
  contentType: "Content-Type";
  manifest: "AXE-Manifest";
  protocol: "AXE-Protocol";
  rateLimitPolicy: "RateLimit-Policy";
  retryAfter: "Retry-After";
  userAgent: "User-Agent";
}>;
```

Defined in: [packages/core/src/vocabulary.ts:32](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L32)

`header` names.

***

### kind

```ts
const kind: Readonly<{
  consentTerms: "consent.terms";
  contactAddress: "contact.address";
  contactEmail: "contact.email";
  contactPhone: "contact.phone";
  customPrefix: "x-";
  documentBase64: "document.base64";
  documentUrl: "document.url";
  identityDateOfBirth: "identity.date-of-birth";
  identityGovernmentId: "identity.government-id";
  identitySsnLast4: "identity.ssn-last-4";
  paymentAchDebit: "payment.ach-debit";
  paymentCard: "payment.card";
  paymentInvoice: "payment.invoice";
  paymentWireConfirmation: "payment.wire-confirmation";
}>;
```

Defined in: [packages/core/src/vocabulary.ts:218](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L218)

`kind` names.

***

### ladder

```ts
const ladder: Readonly<{
  continued: "continued";
  error: "error";
  needsHuman: "needs_human";
  needsInput: "needs_input";
  ok: "ok";
  pending: "pending";
  resumed: "resumed";
}>;
```

Defined in: [packages/core/src/vocabulary.ts:106](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L106)

`ladder` names.

***

### link

```ts
const link: Readonly<{
  manifestRel: "axe-manifest";
}>;
```

Defined in: [packages/core/src/vocabulary.ts:50](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L50)

`link` names.

***

### path

```ts
const path: Readonly<{
  actions: "/axe/actions";
  continue: "/axe/continue";
  index: "/.well-known/axe-index.json";
  manifest: "/.well-known/axe.json";
  manifestAlias: "/axe/manifest";
  poll: "/axe/poll";
  resume: "/axe/resume";
}>;
```

Defined in: [packages/core/src/vocabulary.ts:14](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L14)

`path` names.

***

### payload

```ts
const payload: Readonly<{
  acceptedAt: "acceptedAt";
  acceptedBy: "acceptedBy";
  accountHolderName: "accountHolderName";
  accountNumber: "accountNumber";
  accountType: "accountType";
  authorizationText: "authorizationText";
  authorizedAt: "authorizedAt";
  bankName: "bankName";
  billingEmail: "billingEmail";
  billingPostalCode: "billingPostalCode";
  brand: "brand";
  canReceiveSms: "canReceiveSms";
  city: "city";
  companyName: "companyName";
  contentBase64: "contentBase64";
  country: "country";
  dateOfBirth: "dateOfBirth";
  documentNumber: "documentNumber";
  documentType: "documentType";
  expiresOn: "expiresOn";
  expMonth: "expMonth";
  expYear: "expYear";
  filename: "filename";
  fullName: "fullName";
  issuingCountry: "issuingCountry";
  last4: "last4";
  line1: "line1";
  line2: "line2";
  mimeType: "mimeType";
  netTermsDays: "netTermsDays";
  phone: "phone";
  policyUrl: "policyUrl";
  policyVersion: "policyVersion";
  postalCode: "postalCode";
  provider: "provider";
  purchaseOrderNumber: "purchaseOrderNumber";
  referenceNumber: "referenceNumber";
  region: "region";
  routingNumber: "routingNumber";
  scope: "scope";
  sentAt: "sentAt";
  sizeBytes: "sizeBytes";
  taxId: "taxId";
  token: "token";
}>;
```

Defined in: [packages/core/src/vocabulary.ts:536](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L536)

`payload` names.

***

### period

```ts
const period: Readonly<{
  day: "day";
  hour: "hour";
  month: "month";
  once: "once";
  year: "year";
}>;
```

Defined in: [packages/core/src/vocabulary.ts:194](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L194)

`period` names.

***

### protocol

```ts
const protocol: Readonly<{
  version: "axe/0.1";
}>;
```

Defined in: [packages/core/src/vocabulary.ts:8](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L8)

`protocol` names.

***

### query

```ts
const query: Readonly<{
  handoff: "axe_handoff";
}>;
```

Defined in: [packages/core/src/vocabulary.ts:64](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L64)

`query` names.

***

### reason

```ts
const reason: Readonly<{
  consentRequired: "consent_required";
  documentRequired: "document_required";
  identityRequired: "identity_required";
  loginRequired: "login_required";
  paymentRequired: "payment_required";
}>;
```

Defined in: [packages/core/src/vocabulary.ts:250](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L250)

`reason` names.

***

### risk

```ts
const risk: Readonly<{
  high: "high";
  low: "low";
  medium: "medium";
  none: "none";
}>;
```

Defined in: [packages/core/src/vocabulary.ts:124](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L124)

`risk` names.

***

### robots

```ts
const robots: Readonly<{
  index: "AXE-Index";
  manifest: "AXE-Manifest";
}>;
```

Defined in: [packages/core/src/vocabulary.ts:56](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L56)

`robots` names.

***

### status

```ts
const status: Readonly<{
  error: "error";
  needsHuman: "needs_human";
  needsInput: "needs_input";
  ok: "ok";
  pending: "pending";
}>;
```

Defined in: [packages/core/src/vocabulary.ts:70](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L70)

`status` names.

***

### tone

```ts
const tone: Readonly<{
  casual: "casual";
  formal: "formal";
  neutral: "neutral";
}>;
```

Defined in: [packages/core/src/vocabulary.ts:208](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L208)

`tone` names.

***

### tool

```ts
const tool: Readonly<{
  continue: "axe_continue";
  manifest: "axe_manifest";
  poll: "axe_poll";
  resume: "axe_resume";
}>;
```

Defined in: [packages/core/src/vocabulary.ts:264](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L264)

`tool` names.

***

### WIRE

```ts
const WIRE: Readonly<{
  api: Readonly<{
     accept: "accept";
     action: "action";
     allowCredentials: "allowCredentials";
     allowed: "allowed";
     appendHandoffId: "appendHandoffId";
     authenticate: "authenticate";
     axeExpress: "axeExpress";
     axeFetch: "axeFetch";
     axeNext: "axeNext";
     axeNextPages: "axeNextPages";
     checkVocabularyDrift: "checkVocabularyDrift";
     claims: "claims";
     combineSinks: "combineSinks";
     completeHandoff: "completeHandoff";
     completion: "completion";
     confirm: "confirm";
     consoleSink: "consoleSink";
     continue: "continue";
     cors: "cors";
     createAXE: "createAXE";
     createMcpServer: "createMcpServer";
     createTestClient: "createTestClient";
     customKind: "customKind";
     describe: "describe";
     discover: "discover";
     fetchHandler: "fetchHandler";
     formatAuditHtml: "formatAuditHtml";
     formatAuditTable: "formatAuditTable";
     formatConformanceTable: "formatConformanceTable";
     formatDriftReport: "formatDriftReport";
     formatResult: "formatResult";
     fulfillers: "fulfillers";
     handler: "handler";
     idempotencyStore: "idempotencyStore";
     idempotencyTtlSeconds: "idempotencyTtlSeconds";
     identity: "identity";
     index: "index";
     invoke: "invoke";
     invokeAction: "invokeAction";
     isAxePath: "isAxePath";
     isError: "isError";
     isNeedsHuman: "isNeedsHuman";
     isNeedsInput: "isNeedsInput";
     isOk: "isOk";
     isPending: "isPending";
     jsonlFileSink: "jsonlFileSink";
     kinds: "kinds";
     lintAgentText: "lintAgentText";
     lintManifest: "lintManifest";
     manifest: "manifest";
     manifestCacheSeconds: "manifestCacheSeconds";
     maxRetryAfterMs: "maxRetryAfterMs";
     maxWaitMs: "maxWaitMs";
     needsInput: "needsInput";
     onContinue: "onContinue";
     onError: "onError";
     onEvent: "onEvent";
     onPoll: "onPoll";
     onRequest: "onRequest";
     onResult: "onResult";
     onResume: "onResume";
     otelSink: "otelSink";
     parseUserAgent: "parseUserAgent";
     poll: "poll";
     pollBudgetMs: "pollBudgetMs";
     present: "present";
     register: "register";
     requireCompletion: "requireCompletion";
     requireIdempotencyKey: "requireIdempotencyKey";
     resolveDisplay: "resolveDisplay";
     resume: "resume";
     retries: "retries";
     run: "run";
     runAudit: "runAudit";
     runConformance: "runConformance";
     samplePayload: "samplePayload";
     secret: "secret";
     sendWebResponse: "sendWebResponse";
     serveHttp: "serveHttp";
     serveStdio: "serveStdio";
     siteKey: "siteKey";
     state: "state";
     suggestedReason: "suggestedReason";
     toHTML: "toHTML";
     tokenStore: "tokenStore";
     toMarkdown: "toMarkdown";
     toolNameFor: "toolNameFor";
     toWebRequest: "toWebRequest";
     ttlSeconds: "ttlSeconds";
     verifySiteKey: "verifySiteKey";
     withMimeTypes: "withMimeTypes";
  }>;
  authMode: Readonly<{
     none: "none";
     site: "site";
     user: "user";
  }>;
  cli: Readonly<{
     audit: "axe audit";
     conformance: "axe conformance";
     init: "axe init";
     inspect: "axe inspect";
     mcp: "axe mcp";
     preview: "axe preview";
     validate: "axe validate";
  }>;
  compare: Readonly<{
     higherBetter: "higher-better";
     lowerBetter: "lower-better";
     neutral: "neutral";
  }>;
  displayKind: Readonly<{
     document: "document";
     item: "item";
     list: "list";
     status: "status";
     table: "table";
  }>;
  error: Readonly<{
     conflict: "conflict";
     forbidden: "forbidden";
     internal: "internal";
     invalidInput: "invalid_input";
     notFound: "not_found";
     rateLimited: "rate_limited";
     unauthorized: "unauthorized";
     unavailable: "unavailable";
     unsupported: "unsupported";
  }>;
  field: Readonly<{
     accentColor: "accentColor";
     accepts: "accepts";
     action: "action";
     actions: "actions";
     affordances: "affordances";
     agent: "agent";
     agents: "agents";
     allow: "allow";
     amount: "amount";
     attributes: "attributes";
     auth: "auth";
     axeReserved: "_axe";
     badges: "badges";
     baseUrl: "baseUrl";
     brand: "brand";
     burst: "burst";
     cacheTtlSeconds: "cacheTtlSeconds";
     code: "code";
     compare: "compare";
     contact: "contact";
     context: "context";
     continuationToken: "continuationToken";
     currency: "currency";
     cursorIn: "cursorIn";
     cursorOut: "cursorOut";
     dataRetention: "dataRetention";
     default: "default";
     deny: "deny";
     deprecated: "deprecated";
     description: "description";
     details: "details";
     disclaimer: "disclaimer";
     display: "display";
     email: "email";
     emptyMessage: "emptyMessage";
     error: "error";
     errorCode: "errorCode";
     examples: "examples";
     expected: "expected";
     expiresAt: "expiresAt";
     fallback: "fallback";
     flows: "flows";
     format: "format";
     freshness: "freshness";
     handoff: "handoff";
     handoffStatus: "handoffStatus";
     humanFallbackUrl: "humanFallbackUrl";
     humanHandoff: "humanHandoff";
     id: "id";
     idempotencyKey: "idempotencyKey";
     idempotent: "idempotent";
     image: "image";
     indexUrl: "indexUrl";
     input: "input";
     instructions: "instructions";
     issues: "issues";
     item: "item";
     items: "items";
     kind: "kind";
     label: "label";
     ladder: "ladder";
     latencyMs: "latencyMs";
     locale: "locale";
     logoUrl: "logoUrl";
     manifestUrl: "manifestUrl";
     max: "max";
     message: "message";
     modes: "modes";
     name: "name";
     next: "next";
     onBehalfOf: "onBehalfOf";
     output: "output";
     pageSize: "pageSize";
     pagination: "pagination";
     path: "path";
     payload: "payload";
     period: "period";
     platform: "platform";
     policies: "policies";
     pollUrl: "pollUrl";
     price: "price";
     primary: "primary";
     protocol: "protocol";
     rateLimit: "rateLimit";
     readOnly: "readOnly";
     reason: "reason";
     reasons: "reasons";
     replacedBy: "replacedBy";
     requestsPerMinute: "requestsPerMinute";
     resumeToken: "resumeToken";
     retryable: "retryable";
     retryAfter: "retryAfter";
     reversible: "reversible";
     risk: "risk";
     schema: "schema";
     schemaVersion: "schemaVersion";
     sensitive: "sensitive";
     sessionId: "sessionId";
     since: "since";
     sites: "sites";
     status: "status";
     steps: "steps";
     subtitle: "subtitle";
     suggestedComparison: "suggestedComparison";
     summary: "summary";
     tags: "tags";
     tenant: "tenant";
     termsUrl: "termsUrl";
     timezone: "timezone";
     title: "title";
     tone: "tone";
     ts: "ts";
     updatedAt: "updatedAt";
     url: "url";
     userLoginUrl: "userLoginUrl";
     validUntil: "validUntil";
     vendor: "vendor";
     version: "version";
     whatAgentShouldSayToUser: "whatAgentShouldSayToUser";
  }>;
  format: Readonly<{
     area: "area";
     boolean: "boolean";
     currency: "currency";
     date: "date";
     datetime: "datetime";
     distance: "distance";
     duration: "duration";
     list: "list";
     number: "number";
     text: "text";
  }>;
  header: Readonly<{
     authorization: "Authorization";
     contentType: "Content-Type";
     manifest: "AXE-Manifest";
     protocol: "AXE-Protocol";
     rateLimitPolicy: "RateLimit-Policy";
     retryAfter: "Retry-After";
     userAgent: "User-Agent";
  }>;
  kind: Readonly<{
     consentTerms: "consent.terms";
     contactAddress: "contact.address";
     contactEmail: "contact.email";
     contactPhone: "contact.phone";
     customPrefix: "x-";
     documentBase64: "document.base64";
     documentUrl: "document.url";
     identityDateOfBirth: "identity.date-of-birth";
     identityGovernmentId: "identity.government-id";
     identitySsnLast4: "identity.ssn-last-4";
     paymentAchDebit: "payment.ach-debit";
     paymentCard: "payment.card";
     paymentInvoice: "payment.invoice";
     paymentWireConfirmation: "payment.wire-confirmation";
  }>;
  ladder: Readonly<{
     continued: "continued";
     error: "error";
     needsHuman: "needs_human";
     needsInput: "needs_input";
     ok: "ok";
     pending: "pending";
     resumed: "resumed";
  }>;
  link: Readonly<{
     manifestRel: "axe-manifest";
  }>;
  path: Readonly<{
     actions: "/axe/actions";
     continue: "/axe/continue";
     index: "/.well-known/axe-index.json";
     manifest: "/.well-known/axe.json";
     manifestAlias: "/axe/manifest";
     poll: "/axe/poll";
     resume: "/axe/resume";
  }>;
  payload: Readonly<{
     acceptedAt: "acceptedAt";
     acceptedBy: "acceptedBy";
     accountHolderName: "accountHolderName";
     accountNumber: "accountNumber";
     accountType: "accountType";
     authorizationText: "authorizationText";
     authorizedAt: "authorizedAt";
     bankName: "bankName";
     billingEmail: "billingEmail";
     billingPostalCode: "billingPostalCode";
     brand: "brand";
     canReceiveSms: "canReceiveSms";
     city: "city";
     companyName: "companyName";
     contentBase64: "contentBase64";
     country: "country";
     dateOfBirth: "dateOfBirth";
     documentNumber: "documentNumber";
     documentType: "documentType";
     expiresOn: "expiresOn";
     expMonth: "expMonth";
     expYear: "expYear";
     filename: "filename";
     fullName: "fullName";
     issuingCountry: "issuingCountry";
     last4: "last4";
     line1: "line1";
     line2: "line2";
     mimeType: "mimeType";
     netTermsDays: "netTermsDays";
     phone: "phone";
     policyUrl: "policyUrl";
     policyVersion: "policyVersion";
     postalCode: "postalCode";
     provider: "provider";
     purchaseOrderNumber: "purchaseOrderNumber";
     referenceNumber: "referenceNumber";
     region: "region";
     routingNumber: "routingNumber";
     scope: "scope";
     sentAt: "sentAt";
     sizeBytes: "sizeBytes";
     taxId: "taxId";
     token: "token";
  }>;
  period: Readonly<{
     day: "day";
     hour: "hour";
     month: "month";
     once: "once";
     year: "year";
  }>;
  protocol: Readonly<{
     version: "axe/0.1";
  }>;
  query: Readonly<{
     handoff: "axe_handoff";
  }>;
  reason: Readonly<{
     consentRequired: "consent_required";
     documentRequired: "document_required";
     identityRequired: "identity_required";
     loginRequired: "login_required";
     paymentRequired: "payment_required";
  }>;
  risk: Readonly<{
     high: "high";
     low: "low";
     medium: "medium";
     none: "none";
  }>;
  robots: Readonly<{
     index: "AXE-Index";
     manifest: "AXE-Manifest";
  }>;
  status: Readonly<{
     error: "error";
     needsHuman: "needs_human";
     needsInput: "needs_input";
     ok: "ok";
     pending: "pending";
  }>;
  tone: Readonly<{
     casual: "casual";
     formal: "formal";
     neutral: "neutral";
  }>;
  tool: Readonly<{
     continue: "axe_continue";
     manifest: "axe_manifest";
     poll: "axe_poll";
     resume: "axe_resume";
  }>;
}>;
```

Defined in: [packages/core/src/vocabulary.ts:818](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L818)

Every wire-level name in the AXE protocol, grouped by category.
Use these constants instead of string literals for paths, headers, statuses,
error codes, ladder values, kinds, MCP tool names, and CLI command names.

***

### WIRE\_ENTRIES

```ts
const WIRE_ENTRIES: ReadonlyArray<{
  category: string;
  key: string;
  name: string;
}>;
```

Defined in: [packages/core/src/vocabulary.ts:893](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/vocabulary.ts#L893)

All entries as a flat list, for tooling.
