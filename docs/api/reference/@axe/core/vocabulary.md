[AXE API reference](../../README.md) / [@axe/core](README.md) / vocabulary

# vocabulary

## Type Aliases

### Wire

```ts
type Wire = typeof WIRE;
```

Defined in: [packages/core/src/vocabulary.ts:675](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L675)

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
  | "checkVocabularyDrift";
```

Defined in: [packages/core/src/vocabulary.ts:719](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L719)

Union of every `api` name.

***

### WireAuthMode

```ts
type WireAuthMode = "none" | "site" | "user";
```

Defined in: [packages/core/src/vocabulary.ts:697](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L697)

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

Defined in: [packages/core/src/vocabulary.ts:715](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L715)

Union of every `cli` name.

***

### WireCompare

```ts
type WireCompare = "higher-better" | "lower-better" | "neutral";
```

Defined in: [packages/core/src/vocabulary.ts:703](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L703)

Union of every `compare` name.

***

### WireDisplayKind

```ts
type WireDisplayKind = "list" | "item" | "table" | "status" | "document";
```

Defined in: [packages/core/src/vocabulary.ts:699](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L699)

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

Defined in: [packages/core/src/vocabulary.ts:691](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L691)

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
  | "expected"
  | "schemaVersion"
  | "ts"
  | "latencyMs"
  | "ladder"
  | "errorCode"
  | "tenant";
```

Defined in: [packages/core/src/vocabulary.ts:717](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L717)

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

Defined in: [packages/core/src/vocabulary.ts:701](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L701)

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

Defined in: [packages/core/src/vocabulary.ts:681](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L681)

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

Defined in: [packages/core/src/vocabulary.ts:709](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L709)

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

Defined in: [packages/core/src/vocabulary.ts:693](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L693)

Union of every `ladder` name.

***

### WireLink

```ts
type WireLink = "axe-manifest";
```

Defined in: [packages/core/src/vocabulary.ts:683](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L683)

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

Defined in: [packages/core/src/vocabulary.ts:679](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L679)

Union of every `path` name.

***

### WirePeriod

```ts
type WirePeriod = "once" | "hour" | "day" | "month" | "year";
```

Defined in: [packages/core/src/vocabulary.ts:705](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L705)

Union of every `period` name.

***

### WireProtocol

```ts
type WireProtocol = "axe/0.1";
```

Defined in: [packages/core/src/vocabulary.ts:677](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L677)

Union of every `protocol` name.

***

### WireQuery

```ts
type WireQuery = "axe_handoff";
```

Defined in: [packages/core/src/vocabulary.ts:687](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L687)

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

Defined in: [packages/core/src/vocabulary.ts:711](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L711)

Union of every `reason` name.

***

### WireRisk

```ts
type WireRisk = "none" | "low" | "medium" | "high";
```

Defined in: [packages/core/src/vocabulary.ts:695](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L695)

Union of every `risk` name.

***

### WireRobots

```ts
type WireRobots = "AXE-Manifest" | "AXE-Index";
```

Defined in: [packages/core/src/vocabulary.ts:685](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L685)

Union of every `robots` name.

***

### WireStatus

```ts
type WireStatus = "ok" | "needs_input" | "needs_human" | "pending" | "error";
```

Defined in: [packages/core/src/vocabulary.ts:689](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L689)

Union of every `status` name.

***

### WireTone

```ts
type WireTone = "formal" | "neutral" | "casual";
```

Defined in: [packages/core/src/vocabulary.ts:707](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L707)

Union of every `tone` name.

***

### WireTool

```ts
type WireTool = "axe_continue" | "axe_resume" | "axe_manifest" | "axe_poll";
```

Defined in: [packages/core/src/vocabulary.ts:713](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L713)

Union of every `tool` name.

## Variables

### api

```ts
const api: Readonly<{
  accept: "accept";
  action: "action";
  authenticate: "authenticate";
  axeExpress: "axeExpress";
  axeFetch: "axeFetch";
  axeNext: "axeNext";
  axeNextPages: "axeNextPages";
  checkVocabularyDrift: "checkVocabularyDrift";
  completeHandoff: "completeHandoff";
  confirm: "confirm";
  consoleSink: "consoleSink";
  continue: "continue";
  cors: "cors";
  createAXE: "createAXE";
  createMcpServer: "createMcpServer";
  createTestClient: "createTestClient";
  describe: "describe";
  discover: "discover";
  fetchHandler: "fetchHandler";
  fulfillers: "fulfillers";
  handler: "handler";
  idempotencyStore: "idempotencyStore";
  index: "index";
  invoke: "invoke";
  jsonlFileSink: "jsonlFileSink";
  kinds: "kinds";
  lintAgentText: "lintAgentText";
  lintManifest: "lintManifest";
  manifest: "manifest";
  needsInput: "needsInput";
  onContinue: "onContinue";
  onError: "onError";
  onEvent: "onEvent";
  onPoll: "onPoll";
  onRequest: "onRequest";
  onResult: "onResult";
  onResume: "onResume";
  otelSink: "otelSink";
  poll: "poll";
  present: "present";
  register: "register";
  resolveDisplay: "resolveDisplay";
  resume: "resume";
  run: "run";
  runAudit: "runAudit";
  runConformance: "runConformance";
  secret: "secret";
  serveHttp: "serveHttp";
  serveStdio: "serveStdio";
  state: "state";
  toHTML: "toHTML";
  tokenStore: "tokenStore";
  toMarkdown: "toMarkdown";
  verifySiteKey: "verifySiteKey";
}>;
```

Defined in: [packages/core/src/vocabulary.ts:534](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L534)

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

Defined in: [packages/core/src/vocabulary.ts:136](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L136)

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

Defined in: [packages/core/src/vocabulary.ts:276](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L276)

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

Defined in: [packages/core/src/vocabulary.ts:184](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L184)

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

Defined in: [packages/core/src/vocabulary.ts:146](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L146)

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

Defined in: [packages/core/src/vocabulary.ts:84](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L84)

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

Defined in: [packages/core/src/vocabulary.ts:294](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L294)

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

Defined in: [packages/core/src/vocabulary.ts:160](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L160)

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

Defined in: [packages/core/src/vocabulary.ts:32](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L32)

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

Defined in: [packages/core/src/vocabulary.ts:218](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L218)

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

Defined in: [packages/core/src/vocabulary.ts:106](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L106)

`ladder` names.

***

### link

```ts
const link: Readonly<{
  manifestRel: "axe-manifest";
}>;
```

Defined in: [packages/core/src/vocabulary.ts:50](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L50)

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

Defined in: [packages/core/src/vocabulary.ts:14](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L14)

`path` names.

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

Defined in: [packages/core/src/vocabulary.ts:194](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L194)

`period` names.

***

### protocol

```ts
const protocol: Readonly<{
  version: "axe/0.1";
}>;
```

Defined in: [packages/core/src/vocabulary.ts:8](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L8)

`protocol` names.

***

### query

```ts
const query: Readonly<{
  handoff: "axe_handoff";
}>;
```

Defined in: [packages/core/src/vocabulary.ts:64](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L64)

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

Defined in: [packages/core/src/vocabulary.ts:250](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L250)

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

Defined in: [packages/core/src/vocabulary.ts:124](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L124)

`risk` names.

***

### robots

```ts
const robots: Readonly<{
  index: "AXE-Index";
  manifest: "AXE-Manifest";
}>;
```

Defined in: [packages/core/src/vocabulary.ts:56](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L56)

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

Defined in: [packages/core/src/vocabulary.ts:70](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L70)

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

Defined in: [packages/core/src/vocabulary.ts:208](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L208)

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

Defined in: [packages/core/src/vocabulary.ts:264](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L264)

`tool` names.

***

### WIRE

```ts
const WIRE: Readonly<{
  api: Readonly<{
     accept: "accept";
     action: "action";
     authenticate: "authenticate";
     axeExpress: "axeExpress";
     axeFetch: "axeFetch";
     axeNext: "axeNext";
     axeNextPages: "axeNextPages";
     checkVocabularyDrift: "checkVocabularyDrift";
     completeHandoff: "completeHandoff";
     confirm: "confirm";
     consoleSink: "consoleSink";
     continue: "continue";
     cors: "cors";
     createAXE: "createAXE";
     createMcpServer: "createMcpServer";
     createTestClient: "createTestClient";
     describe: "describe";
     discover: "discover";
     fetchHandler: "fetchHandler";
     fulfillers: "fulfillers";
     handler: "handler";
     idempotencyStore: "idempotencyStore";
     index: "index";
     invoke: "invoke";
     jsonlFileSink: "jsonlFileSink";
     kinds: "kinds";
     lintAgentText: "lintAgentText";
     lintManifest: "lintManifest";
     manifest: "manifest";
     needsInput: "needsInput";
     onContinue: "onContinue";
     onError: "onError";
     onEvent: "onEvent";
     onPoll: "onPoll";
     onRequest: "onRequest";
     onResult: "onResult";
     onResume: "onResume";
     otelSink: "otelSink";
     poll: "poll";
     present: "present";
     register: "register";
     resolveDisplay: "resolveDisplay";
     resume: "resume";
     run: "run";
     runAudit: "runAudit";
     runConformance: "runConformance";
     secret: "secret";
     serveHttp: "serveHttp";
     serveStdio: "serveStdio";
     state: "state";
     toHTML: "toHTML";
     tokenStore: "tokenStore";
     toMarkdown: "toMarkdown";
     verifySiteKey: "verifySiteKey";
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

Defined in: [packages/core/src/vocabulary.ts:650](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L650)

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

Defined in: [packages/core/src/vocabulary.ts:722](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/vocabulary.ts#L722)

All entries as a flat list, for tooling.
