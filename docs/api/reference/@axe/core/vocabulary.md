[AXE API reference](../../README.md) / [@axe/core](README.md) / vocabulary

# vocabulary

## Type Aliases

<a id="wire"></a>

### Wire

```ts
type Wire = typeof WIRE;
```

***

<a id="wireapi"></a>

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
  | "requestApproval"
  | "approvalState"
  | "getHandoff"
  | "approveHandoff"
  | "cancelHandoff"
  | "approvedBy"
  | "resolveDisplay"
  | "kinds"
  | "accept"
  | "lintAgentText"
  | "lintManifest"
  | "onRequest"
  | "onResult"
  | "ProviderResultContext"
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
  | "revision"
  | "describeLive"
  | "addProvider"
  | "onActionsChanged"
  | "unavailable"
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
  | "stateToMarkdown"
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
  | "createSurface"
  | "unregister"
  | "reconcile"
  | "bump"
  | "seedRev"
  | "setRev"
  | "currentRev"
  | "onChange"
  | "setObjects"
  | "observe"
  | "act"
  | "expose"
  | "useSurface"
  | "surfaceActions"
  | "actionNameFor"
  | "entryIdFor"
  | "entrySlug"
  | "entries"
  | "registryVersion"
  | "availability"
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
  | "requestPolicy"
  | "requireJsonContentType"
  | "trustedOrigins"
  | "originCheck"
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
  | "trust"
  | "allowCrossOrigin"
  | "allowHttp"
  | "destinationPolicy"
  | "checkDestination"
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
  | "formatDriftReport"
  | "onActionEvent"
  | "emit"
  | "ledger"
  | "record"
  | "freeze"
  | "thaw"
  | "surfaceAttributes"
  | "surfaceSelector"
  | "describeEntry"
  | "useSurfaceProps"
  | "attributesFor"
  | "subscribe"
  | "revisionMode"
  | "SURFACE_ATTRIBUTES"
  | "toJsonSchema"
  | "SurfaceConflict"
  | "ActContext"
  | "scopedSurfaces"
  | "authFor"
  | "redactEvent"
  | "idleMs"
  | "onEvict"
  | "keyFor"
  | "SqliteIdempotencyStore"
  | "operationLeaseSeconds"
  | "operationId"
  | "maxBodyBytes"
  | "maxEntries"
  | "sweepIntervalMs"
  | "prune"
  | "schemaProblems"
  | "timeoutMs"
  | "maxResponseBytes"
  | "maxPollAttempts"
  | "validateJsonSchema"
  | "lintAction"
  | "isBacktrackingPattern"
  | "clientFor"
  | "idleTimeoutMs"
  | "maxSessions"
  | "sessionCount"
  | "sessionIdGenerator"
  | "allowedOrigins"
  | "requiredScopes"
  | "resourceMetadataUrl"
  | "authInfo"
  | "protectedResourceMetadata"
  | "manifestMaxAgeMs"
  | "onManifestChange"
  | "exposeWebMcp"
  | "modelContext"
  | "registerTool"
  | "consequentialHint"
  | "requestedSchema"
  | "isSensitiveAccept"
  | "toFormSchema"
  | "readOnlyHint"
  | "untrustedContentHint"
  | "domainActions"
  | "actionFor"
  | "idleReason"
  | "maxPageSize"
  | "connectRelay"
  | "getToken"
  | "onStatus"
  | "requireApproval"
  | "createRelay"
  | "authenticateTab"
  | "agentAuth"
  | "devPairing"
  | "syncTimeoutMs"
  | "reconnectGraceMs"
  | "tabRetentionMs"
  | "mintRelayToken"
  | "verifyRelayToken"
  | "injectedRelay"
  | "relayOptions"
  | "approvals"
  | "linkTtlMs"
  | "approvalUrl"
  | "tabId"
  | "ToolCallContext"
  | "completeElicitation"
  | "createHost"
  | "sessionFor"
  | "storageStateSession"
  | "cookieSession"
  | "storageState"
  | "localStorage"
  | "startPath"
  | "navigationTimeoutMs"
  | "tokenTtlSeconds"
  | "executablePath"
  | "relayUrl"
  | "relaySecret"
  | "closeSession"
  | "relayEvent"
  | "extraTools"
  | "handleAgent"
  | "relayAgentContext"
  | "autoSurface"
  | "formatCoverage"
  | "checkConfig"
  | "autoDomains"
  | "autoActions"
  | "useAutoSurface"
  | "useAutoSurfaceHandle"
  | "elementFor"
  | "metaFor"
  | "debounceMs"
  | "quietMs"
  | "fromOpenAPI"
  | "fromFunctions"
  | "fromTRPCRouter"
  | "registerGenerated"
  | "formatWarnings"
  | "jsonSchemaToZod"
  | "defaultRisk"
  | "maxRisk"
  | "requireInputDescriptions"
  | "includeDeprecated"
  | "createContext";
```

Union of every `api` name.

***

<a id="wireauthmode"></a>

### WireAuthMode

```ts
type WireAuthMode = "none" | "site" | "user";
```

Union of every `authMode` name.

***

<a id="wirecli"></a>

### WireCli

```ts
type WireCli = 
  | "axe init"
  | "axe validate"
  | "axe inspect"
  | "axe preview"
  | "axe conformance"
  | "axe audit"
  | "axe mcp"
  | "axe generate"
  | "axe relay"
  | "axe host"
  | "axe surface"
  | "axe surface init"
  | "axe surface coverage";
```

Union of every `cli` name.

***

<a id="wirecompare"></a>

### WireCompare

```ts
type WireCompare = "higher-better" | "lower-better" | "neutral";
```

Union of every `compare` name.

***

<a id="wiredisplaykind"></a>

### WireDisplayKind

```ts
type WireDisplayKind = "list" | "item" | "table" | "status" | "document";
```

Union of every `displayKind` name.

***

<a id="wiredomattribute"></a>

### WireDomAttribute

```ts
type WireDomAttribute = 
  | "data-surface-id"
  | "data-surface-kind"
  | "data-surface-object"
  | "data-surface-reason"
  | "aria-label"
  | "aria-disabled"
  | "aria-readonly";
```

Union of every `domAttribute` name.

***

<a id="wireentrykind"></a>

### WireEntryKind

```ts
type WireEntryKind = "action" | "field" | "collection";
```

Union of every `entryKind` name.

***

<a id="wireerror"></a>

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

Union of every `error` name.

***

<a id="wirefield"></a>

### WireField

```ts
type WireField = 
  | "app"
  | "at"
  | "entries"
  | "objects"
  | "index"
  | "role"
  | "object"
  | "state"
  | "effect"
  | "mutates"
  | "confirm"
  | "text"
  | "edit"
  | "maxLength"
  | "value"
  | "total"
  | "loaded"
  | "filter"
  | "sort"
  | "op"
  | "target"
  | "actor"
  | "changed"
  | "seq"
  | "ledgerSeq"
  | "revBefore"
  | "revAfter"
  | "limit"
  | "frozen"
  | "ignoredRev"
  | "conflict"
  | "textHash"
  | "source"
  | "tier"
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
  | "handoffId"
  | "operationStatus"
  | "maxBodyBytes"
  | "x-axe-refined"
  | "expected"
  | "schemaVersion"
  | "ts"
  | "latencyMs"
  | "ladder"
  | "errorCode"
  | "tenant"
  | "live"
  | "availability"
  | "available"
  | "requires"
  | "rev"
  | "expectedRev"
  | "currentRev"
  | "event"
  | "entryId"
  | "nextCursor"
  | "nameFrom"
  | "staleConfig";
```

Union of every `field` name.

***

<a id="wireformat"></a>

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

Union of every `format` name.

***

<a id="wireheader"></a>

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

Union of every `header` name.

***

<a id="wirekind"></a>

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

Union of every `kind` name.

***

<a id="wireladder"></a>

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

Union of every `ladder` name.

***

<a id="wirelink"></a>

### WireLink

```ts
type WireLink = "axe-manifest";
```

Union of every `link` name.

***

<a id="wiremarkup"></a>

### WireMarkup

```ts
type WireMarkup = "data-surface-ignore";
```

Union of every `markup` name.

***

<a id="wireop"></a>

### WireOp

```ts
type WireOp = "CLICK" | "TOGGLE" | "TYPE_TEXT" | "SCROLL_DOWN";
```

Union of every `op` name.

***

<a id="wirepath"></a>

### WirePath

```ts
type WirePath = 
  | "/.well-known/axe.json"
  | "/axe/manifest"
  | "/.well-known/axe-index.json"
  | "/axe/actions"
  | "/axe/continue"
  | "/axe/resume"
  | "/axe/poll"
  | "/axe/state";
```

Union of every `path` name.

***

<a id="wirepayload"></a>

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

Union of every `payload` name.

***

<a id="wireperiod"></a>

### WirePeriod

```ts
type WirePeriod = "once" | "hour" | "day" | "month" | "year";
```

Union of every `period` name.

***

<a id="wireprotocol"></a>

### WireProtocol

```ts
type WireProtocol = "axe/0.1";
```

Union of every `protocol` name.

***

<a id="wirequery"></a>

### WireQuery

```ts
type WireQuery = "axe_handoff";
```

Union of every `query` name.

***

<a id="wirereason"></a>

### WireReason

```ts
type WireReason = 
  | "login_required"
  | "payment_required"
  | "consent_required"
  | "identity_required"
  | "document_required"
  | "cross_origin_refused"
  | "json_required"
  | "payload_too_large"
  | "approval_required";
```

Union of every `reason` name.

***

<a id="wirerisk"></a>

### WireRisk

```ts
type WireRisk = "none" | "low" | "medium" | "high";
```

Union of every `risk` name.

***

<a id="wirerobots"></a>

### WireRobots

```ts
type WireRobots = "AXE-Manifest" | "AXE-Index";
```

Union of every `robots` name.

***

<a id="wireschema"></a>

### WireSchema

```ts
type WireSchema = 
  | "additionalProperties"
  | "patternProperties"
  | "propertyNames"
  | "minProperties"
  | "maxProperties"
  | "dependentRequired"
  | "dependentSchemas"
  | "prefixItems"
  | "minItems"
  | "maxItems"
  | "uniqueItems"
  | "minContains"
  | "maxContains"
  | "minLength"
  | "exclusiveMinimum"
  | "exclusiveMaximum"
  | "multipleOf"
  | "allOf"
  | "anyOf"
  | "oneOf"
  | "writeOnly"
  | "unevaluatedProperties"
  | "unevaluatedItems"
  | "additionalItems";
```

Union of every `schema` name.

***

<a id="wirestatus"></a>

### WireStatus

```ts
type WireStatus = "ok" | "needs_input" | "needs_human" | "pending" | "error";
```

Union of every `status` name.

***

<a id="wiretone"></a>

### WireTone

```ts
type WireTone = "formal" | "neutral" | "casual";
```

Union of every `tone` name.

***

<a id="wiretool"></a>

### WireTool

```ts
type WireTool = 
  | "axe_continue"
  | "axe_resume"
  | "axe_manifest"
  | "axe_poll"
  | "axe_state";
```

Union of every `tool` name.

## Variables

<a id="api"></a>

### api

```ts
const api: Readonly<{
  accept: "accept";
  act: "act";
  actContext: "ActContext";
  action: "action";
  actionFor: "actionFor";
  actionNameFor: "actionNameFor";
  addProvider: "addProvider";
  agentAuth: "agentAuth";
  allowCredentials: "allowCredentials";
  allowCrossOrigin: "allowCrossOrigin";
  allowed: "allowed";
  allowedOrigins: "allowedOrigins";
  allowHttp: "allowHttp";
  appendHandoffId: "appendHandoffId";
  approvals: "approvals";
  approvalState: "approvalState";
  approvalUrl: "approvalUrl";
  approvedBy: "approvedBy";
  approveHandoff: "approveHandoff";
  attributesFor: "attributesFor";
  authenticate: "authenticate";
  authenticateTab: "authenticateTab";
  authFor: "authFor";
  authInfo: "authInfo";
  autoActions: "autoActions";
  autoDomains: "autoDomains";
  autoSurface: "autoSurface";
  availability: "availability";
  axeExpress: "axeExpress";
  axeFetch: "axeFetch";
  axeNext: "axeNext";
  axeNextPages: "axeNextPages";
  bump: "bump";
  cancelHandoff: "cancelHandoff";
  checkConfig: "checkConfig";
  checkDestination: "checkDestination";
  checkVocabularyDrift: "checkVocabularyDrift";
  claims: "claims";
  clientFor: "clientFor";
  closeSession: "closeSession";
  combineSinks: "combineSinks";
  completeElicitation: "completeElicitation";
  completeHandoff: "completeHandoff";
  completion: "completion";
  confirm: "confirm";
  connectRelay: "connectRelay";
  consequentialHint: "consequentialHint";
  consoleSink: "consoleSink";
  continue: "continue";
  cookieSession: "cookieSession";
  cors: "cors";
  createAXE: "createAXE";
  createContext: "createContext";
  createHost: "createHost";
  createMcpServer: "createMcpServer";
  createRelay: "createRelay";
  createSurface: "createSurface";
  createTestClient: "createTestClient";
  currentRev: "currentRev";
  customKind: "customKind";
  debounceMs: "debounceMs";
  defaultRisk: "defaultRisk";
  describe: "describe";
  describeEntry: "describeEntry";
  describeLive: "describeLive";
  destinationPolicy: "destinationPolicy";
  devPairing: "devPairing";
  discover: "discover";
  domainActions: "domainActions";
  elementFor: "elementFor";
  emit: "emit";
  entries: "entries";
  entryIdFor: "entryIdFor";
  entrySlug: "entrySlug";
  executablePath: "executablePath";
  expose: "expose";
  exposeWebMcp: "exposeWebMcp";
  extraTools: "extraTools";
  fetchHandler: "fetchHandler";
  formatAuditHtml: "formatAuditHtml";
  formatAuditTable: "formatAuditTable";
  formatConformanceTable: "formatConformanceTable";
  formatCoverage: "formatCoverage";
  formatDriftReport: "formatDriftReport";
  formatResult: "formatResult";
  formatWarnings: "formatWarnings";
  freeze: "freeze";
  fromFunctions: "fromFunctions";
  fromOpenAPI: "fromOpenAPI";
  fromTRPCRouter: "fromTRPCRouter";
  fulfillers: "fulfillers";
  getHandoff: "getHandoff";
  getToken: "getToken";
  handleAgent: "handleAgent";
  handler: "handler";
  idempotencyStore: "idempotencyStore";
  idempotencyTtlSeconds: "idempotencyTtlSeconds";
  identity: "identity";
  idleMs: "idleMs";
  idleReason: "idleReason";
  idleTimeoutMs: "idleTimeoutMs";
  includeDeprecated: "includeDeprecated";
  index: "index";
  injectedRelay: "injectedRelay";
  invoke: "invoke";
  invokeAction: "invokeAction";
  isAxePath: "isAxePath";
  isBacktrackingPattern: "isBacktrackingPattern";
  isError: "isError";
  isNeedsHuman: "isNeedsHuman";
  isNeedsInput: "isNeedsInput";
  isOk: "isOk";
  isPending: "isPending";
  isSensitiveAccept: "isSensitiveAccept";
  jsonlFileSink: "jsonlFileSink";
  jsonSchemaToZod: "jsonSchemaToZod";
  keyFor: "keyFor";
  kinds: "kinds";
  ledger: "ledger";
  linkTtlMs: "linkTtlMs";
  lintAction: "lintAction";
  lintAgentText: "lintAgentText";
  lintManifest: "lintManifest";
  localStorage: "localStorage";
  manifest: "manifest";
  manifestCacheSeconds: "manifestCacheSeconds";
  manifestMaxAgeMs: "manifestMaxAgeMs";
  maxBodyBytes: "maxBodyBytes";
  maxEntries: "maxEntries";
  maxPageSize: "maxPageSize";
  maxPollAttempts: "maxPollAttempts";
  maxResponseBytes: "maxResponseBytes";
  maxRetryAfterMs: "maxRetryAfterMs";
  maxRisk: "maxRisk";
  maxSessions: "maxSessions";
  maxWaitMs: "maxWaitMs";
  metaFor: "metaFor";
  mintRelayToken: "mintRelayToken";
  modelContext: "modelContext";
  navigationTimeoutMs: "navigationTimeoutMs";
  needsInput: "needsInput";
  observe: "observe";
  onActionEvent: "onActionEvent";
  onActionsChanged: "onActionsChanged";
  onChange: "onChange";
  onContinue: "onContinue";
  onError: "onError";
  onEvent: "onEvent";
  onEvict: "onEvict";
  onManifestChange: "onManifestChange";
  onPoll: "onPoll";
  onRequest: "onRequest";
  onResult: "onResult";
  onResume: "onResume";
  onStatus: "onStatus";
  operationId: "operationId";
  operationLeaseSeconds: "operationLeaseSeconds";
  originCheck: "originCheck";
  otelSink: "otelSink";
  parseUserAgent: "parseUserAgent";
  poll: "poll";
  pollBudgetMs: "pollBudgetMs";
  present: "present";
  protectedResourceMetadata: "protectedResourceMetadata";
  providerResultContext: "ProviderResultContext";
  prune: "prune";
  quietMs: "quietMs";
  readOnlyHint: "readOnlyHint";
  reconcile: "reconcile";
  reconnectGraceMs: "reconnectGraceMs";
  record: "record";
  redactEvent: "redactEvent";
  register: "register";
  registerGenerated: "registerGenerated";
  registerTool: "registerTool";
  registryVersion: "registryVersion";
  relayAgentContext: "relayAgentContext";
  relayEvent: "relayEvent";
  relayOptions: "relayOptions";
  relaySecret: "relaySecret";
  relayUrl: "relayUrl";
  requestApproval: "requestApproval";
  requestedSchema: "requestedSchema";
  requestPolicy: "requestPolicy";
  requireApproval: "requireApproval";
  requireCompletion: "requireCompletion";
  requiredScopes: "requiredScopes";
  requireIdempotencyKey: "requireIdempotencyKey";
  requireInputDescriptions: "requireInputDescriptions";
  requireJsonContentType: "requireJsonContentType";
  resolveDisplay: "resolveDisplay";
  resourceMetadataUrl: "resourceMetadataUrl";
  resume: "resume";
  retries: "retries";
  revision: "revision";
  revisionMode: "revisionMode";
  run: "run";
  runAudit: "runAudit";
  runConformance: "runConformance";
  samplePayload: "samplePayload";
  schemaProblems: "schemaProblems";
  scopedSurfaces: "scopedSurfaces";
  secret: "secret";
  seedRev: "seedRev";
  sendWebResponse: "sendWebResponse";
  serveHttp: "serveHttp";
  serveStdio: "serveStdio";
  sessionCount: "sessionCount";
  sessionFor: "sessionFor";
  sessionIdGenerator: "sessionIdGenerator";
  setObjects: "setObjects";
  setRev: "setRev";
  siteKey: "siteKey";
  sqliteIdempotencyStore: "SqliteIdempotencyStore";
  startPath: "startPath";
  state: "state";
  stateToMarkdown: "stateToMarkdown";
  storageState: "storageState";
  storageStateSession: "storageStateSession";
  subscribe: "subscribe";
  suggestedReason: "suggestedReason";
  surfaceActions: "surfaceActions";
  surfaceAttributeNames: "SURFACE_ATTRIBUTES";
  surfaceAttributes: "surfaceAttributes";
  surfaceConflict: "SurfaceConflict";
  surfaceSelector: "surfaceSelector";
  sweepIntervalMs: "sweepIntervalMs";
  syncTimeoutMs: "syncTimeoutMs";
  tabId: "tabId";
  tabRetentionMs: "tabRetentionMs";
  thaw: "thaw";
  timeoutMs: "timeoutMs";
  toFormSchema: "toFormSchema";
  toHTML: "toHTML";
  toJsonSchema: "toJsonSchema";
  tokenStore: "tokenStore";
  tokenTtlSeconds: "tokenTtlSeconds";
  toMarkdown: "toMarkdown";
  toolCallContext: "ToolCallContext";
  toolNameFor: "toolNameFor";
  toWebRequest: "toWebRequest";
  trust: "trust";
  trustedOrigins: "trustedOrigins";
  ttlSeconds: "ttlSeconds";
  unavailable: "unavailable";
  unregister: "unregister";
  untrustedContentHint: "untrustedContentHint";
  useAutoSurface: "useAutoSurface";
  useAutoSurfaceHandle: "useAutoSurfaceHandle";
  useSurface: "useSurface";
  useSurfaceProps: "useSurfaceProps";
  validateJsonSchema: "validateJsonSchema";
  verifyRelayToken: "verifyRelayToken";
  verifySiteKey: "verifySiteKey";
  withMimeTypes: "withMimeTypes";
}>;
```

`api` names.

***

<a id="authmode"></a>

### authMode

```ts
const authMode: Readonly<{
  none: "none";
  site: "site";
  user: "user";
}>;
```

`authMode` names.

***

<a id="cli"></a>

### cli

```ts
const cli: Readonly<{
  audit: "axe audit";
  conformance: "axe conformance";
  generate: "axe generate";
  host: "axe host";
  init: "axe init";
  inspect: "axe inspect";
  mcp: "axe mcp";
  preview: "axe preview";
  relay: "axe relay";
  surface: "axe surface";
  surfaceCoverage: "axe surface coverage";
  surfaceInit: "axe surface init";
  validate: "axe validate";
}>;
```

`cli` names.

***

<a id="compare"></a>

### compare

```ts
const compare: Readonly<{
  higherBetter: "higher-better";
  lowerBetter: "lower-better";
  neutral: "neutral";
}>;
```

`compare` names.

***

<a id="displaykind"></a>

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

`displayKind` names.

***

<a id="domattribute"></a>

### domAttribute

```ts
const domAttribute: Readonly<{
  disabled: "aria-disabled";
  label: "aria-label";
  readOnly: "aria-readonly";
  surfaceId: "data-surface-id";
  surfaceKind: "data-surface-kind";
  surfaceObject: "data-surface-object";
  surfaceReason: "data-surface-reason";
}>;
```

`domAttribute` names.

***

<a id="entrykind"></a>

### entryKind

```ts
const entryKind: Readonly<{
  action: "action";
  collection: "collection";
  field: "field";
}>;
```

`entryKind` names.

***

<a id="error"></a>

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

`error` names.

***

<a id="field"></a>

### field

```ts
const field: Readonly<{
  accentColor: "accentColor";
  accepts: "accepts";
  action: "action";
  actions: "actions";
  actor: "actor";
  affordances: "affordances";
  agent: "agent";
  agents: "agents";
  allow: "allow";
  amount: "amount";
  app: "app";
  at: "at";
  attributes: "attributes";
  auth: "auth";
  availability: "availability";
  available: "available";
  axeRefined: "x-axe-refined";
  axeReserved: "_axe";
  badges: "badges";
  baseUrl: "baseUrl";
  brand: "brand";
  burst: "burst";
  cacheTtlSeconds: "cacheTtlSeconds";
  changed: "changed";
  code: "code";
  compare: "compare";
  confirm: "confirm";
  contact: "contact";
  context: "context";
  continuationToken: "continuationToken";
  currency: "currency";
  currentRev: "currentRev";
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
  edit: "edit";
  effect: "effect";
  email: "email";
  emptyMessage: "emptyMessage";
  entries: "entries";
  entryId: "entryId";
  error: "error";
  errorCode: "errorCode";
  event: "event";
  examples: "examples";
  expected: "expected";
  expectedRev: "expectedRev";
  expiresAt: "expiresAt";
  fallback: "fallback";
  filter: "filter";
  flows: "flows";
  format: "format";
  freshness: "freshness";
  frozen: "frozen";
  handlerConflict: "conflict";
  handoff: "handoff";
  handoffId: "handoffId";
  handoffStatus: "handoffStatus";
  humanFallbackUrl: "humanFallbackUrl";
  humanHandoff: "humanHandoff";
  id: "id";
  idempotencyKey: "idempotencyKey";
  idempotent: "idempotent";
  ignoredRev: "ignoredRev";
  image: "image";
  index: "index";
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
  ledgerSeq: "ledgerSeq";
  limit: "limit";
  live: "live";
  loaded: "loaded";
  locale: "locale";
  logoUrl: "logoUrl";
  manifestUrl: "manifestUrl";
  max: "max";
  maxBodyBytes: "maxBodyBytes";
  maxLength: "maxLength";
  message: "message";
  modes: "modes";
  mutates: "mutates";
  name: "name";
  nameFrom: "nameFrom";
  next: "next";
  nextCursor: "nextCursor";
  object: "object";
  objects: "objects";
  onBehalfOf: "onBehalfOf";
  op: "op";
  operationStatus: "operationStatus";
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
  requires: "requires";
  resumeToken: "resumeToken";
  retryable: "retryable";
  retryAfter: "retryAfter";
  rev: "rev";
  revAfter: "revAfter";
  revBefore: "revBefore";
  reversible: "reversible";
  risk: "risk";
  role: "role";
  schema: "schema";
  schemaVersion: "schemaVersion";
  sensitive: "sensitive";
  seq: "seq";
  sessionId: "sessionId";
  since: "since";
  sites: "sites";
  sort: "sort";
  source: "source";
  staleConfig: "staleConfig";
  state: "state";
  status: "status";
  steps: "steps";
  subtitle: "subtitle";
  suggestedComparison: "suggestedComparison";
  summary: "summary";
  tags: "tags";
  target: "target";
  tenant: "tenant";
  termsUrl: "termsUrl";
  text: "text";
  textHash: "textHash";
  tier: "tier";
  timezone: "timezone";
  title: "title";
  tone: "tone";
  total: "total";
  ts: "ts";
  updatedAt: "updatedAt";
  url: "url";
  userLoginUrl: "userLoginUrl";
  validUntil: "validUntil";
  value: "value";
  vendor: "vendor";
  version: "version";
  whatAgentShouldSayToUser: "whatAgentShouldSayToUser";
}>;
```

`field` names.

***

<a id="format"></a>

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

`format` names.

***

<a id="header"></a>

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

`header` names.

***

<a id="kind"></a>

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

`kind` names.

***

<a id="ladder"></a>

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

`ladder` names.

***

<a id="link"></a>

### link

```ts
const link: Readonly<{
  manifestRel: "axe-manifest";
}>;
```

`link` names.

***

<a id="markup"></a>

### markup

```ts
const markup: Readonly<{
  ignore: "data-surface-ignore";
}>;
```

`markup` names.

***

<a id="op"></a>

### op

```ts
const op: Readonly<{
  click: "CLICK";
  scrollDown: "SCROLL_DOWN";
  toggle: "TOGGLE";
  typeText: "TYPE_TEXT";
}>;
```

`op` names.

***

<a id="path"></a>

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
  state: "/axe/state";
}>;
```

`path` names.

***

<a id="payload"></a>

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

`payload` names.

***

<a id="period"></a>

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

`period` names.

***

<a id="protocol"></a>

### protocol

```ts
const protocol: Readonly<{
  version: "axe/0.1";
}>;
```

`protocol` names.

***

<a id="query"></a>

### query

```ts
const query: Readonly<{
  handoff: "axe_handoff";
}>;
```

`query` names.

***

<a id="reason"></a>

### reason

```ts
const reason: Readonly<{
  approvalRequired: "approval_required";
  consentRequired: "consent_required";
  crossOriginRefused: "cross_origin_refused";
  documentRequired: "document_required";
  identityRequired: "identity_required";
  jsonRequired: "json_required";
  loginRequired: "login_required";
  payloadTooLarge: "payload_too_large";
  paymentRequired: "payment_required";
}>;
```

`reason` names.

***

<a id="risk"></a>

### risk

```ts
const risk: Readonly<{
  high: "high";
  low: "low";
  medium: "medium";
  none: "none";
}>;
```

`risk` names.

***

<a id="robots"></a>

### robots

```ts
const robots: Readonly<{
  index: "AXE-Index";
  manifest: "AXE-Manifest";
}>;
```

`robots` names.

***

<a id="schema"></a>

### schema

```ts
const schema: Readonly<{
  additionalItems: "additionalItems";
  additionalProperties: "additionalProperties";
  allOf: "allOf";
  anyOf: "anyOf";
  dependentRequired: "dependentRequired";
  dependentSchemas: "dependentSchemas";
  exclusiveMaximum: "exclusiveMaximum";
  exclusiveMinimum: "exclusiveMinimum";
  maxContains: "maxContains";
  maxItems: "maxItems";
  maxProperties: "maxProperties";
  minContains: "minContains";
  minItems: "minItems";
  minLength: "minLength";
  minProperties: "minProperties";
  multipleOf: "multipleOf";
  oneOf: "oneOf";
  patternProperties: "patternProperties";
  prefixItems: "prefixItems";
  propertyNames: "propertyNames";
  unevaluatedItems: "unevaluatedItems";
  unevaluatedProperties: "unevaluatedProperties";
  uniqueItems: "uniqueItems";
  writeOnly: "writeOnly";
}>;
```

`schema` names.

***

<a id="status"></a>

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

`status` names.

***

<a id="tone"></a>

### tone

```ts
const tone: Readonly<{
  casual: "casual";
  formal: "formal";
  neutral: "neutral";
}>;
```

`tone` names.

***

<a id="tool"></a>

### tool

```ts
const tool: Readonly<{
  continue: "axe_continue";
  manifest: "axe_manifest";
  poll: "axe_poll";
  resume: "axe_resume";
  state: "axe_state";
}>;
```

`tool` names.

***

<a id="wire-1"></a>

### WIRE

```ts
const WIRE: Readonly<{
  api: Readonly<{
     accept: "accept";
     act: "act";
     actContext: "ActContext";
     action: "action";
     actionFor: "actionFor";
     actionNameFor: "actionNameFor";
     addProvider: "addProvider";
     agentAuth: "agentAuth";
     allowCredentials: "allowCredentials";
     allowCrossOrigin: "allowCrossOrigin";
     allowed: "allowed";
     allowedOrigins: "allowedOrigins";
     allowHttp: "allowHttp";
     appendHandoffId: "appendHandoffId";
     approvals: "approvals";
     approvalState: "approvalState";
     approvalUrl: "approvalUrl";
     approvedBy: "approvedBy";
     approveHandoff: "approveHandoff";
     attributesFor: "attributesFor";
     authenticate: "authenticate";
     authenticateTab: "authenticateTab";
     authFor: "authFor";
     authInfo: "authInfo";
     autoActions: "autoActions";
     autoDomains: "autoDomains";
     autoSurface: "autoSurface";
     availability: "availability";
     axeExpress: "axeExpress";
     axeFetch: "axeFetch";
     axeNext: "axeNext";
     axeNextPages: "axeNextPages";
     bump: "bump";
     cancelHandoff: "cancelHandoff";
     checkConfig: "checkConfig";
     checkDestination: "checkDestination";
     checkVocabularyDrift: "checkVocabularyDrift";
     claims: "claims";
     clientFor: "clientFor";
     closeSession: "closeSession";
     combineSinks: "combineSinks";
     completeElicitation: "completeElicitation";
     completeHandoff: "completeHandoff";
     completion: "completion";
     confirm: "confirm";
     connectRelay: "connectRelay";
     consequentialHint: "consequentialHint";
     consoleSink: "consoleSink";
     continue: "continue";
     cookieSession: "cookieSession";
     cors: "cors";
     createAXE: "createAXE";
     createContext: "createContext";
     createHost: "createHost";
     createMcpServer: "createMcpServer";
     createRelay: "createRelay";
     createSurface: "createSurface";
     createTestClient: "createTestClient";
     currentRev: "currentRev";
     customKind: "customKind";
     debounceMs: "debounceMs";
     defaultRisk: "defaultRisk";
     describe: "describe";
     describeEntry: "describeEntry";
     describeLive: "describeLive";
     destinationPolicy: "destinationPolicy";
     devPairing: "devPairing";
     discover: "discover";
     domainActions: "domainActions";
     elementFor: "elementFor";
     emit: "emit";
     entries: "entries";
     entryIdFor: "entryIdFor";
     entrySlug: "entrySlug";
     executablePath: "executablePath";
     expose: "expose";
     exposeWebMcp: "exposeWebMcp";
     extraTools: "extraTools";
     fetchHandler: "fetchHandler";
     formatAuditHtml: "formatAuditHtml";
     formatAuditTable: "formatAuditTable";
     formatConformanceTable: "formatConformanceTable";
     formatCoverage: "formatCoverage";
     formatDriftReport: "formatDriftReport";
     formatResult: "formatResult";
     formatWarnings: "formatWarnings";
     freeze: "freeze";
     fromFunctions: "fromFunctions";
     fromOpenAPI: "fromOpenAPI";
     fromTRPCRouter: "fromTRPCRouter";
     fulfillers: "fulfillers";
     getHandoff: "getHandoff";
     getToken: "getToken";
     handleAgent: "handleAgent";
     handler: "handler";
     idempotencyStore: "idempotencyStore";
     idempotencyTtlSeconds: "idempotencyTtlSeconds";
     identity: "identity";
     idleMs: "idleMs";
     idleReason: "idleReason";
     idleTimeoutMs: "idleTimeoutMs";
     includeDeprecated: "includeDeprecated";
     index: "index";
     injectedRelay: "injectedRelay";
     invoke: "invoke";
     invokeAction: "invokeAction";
     isAxePath: "isAxePath";
     isBacktrackingPattern: "isBacktrackingPattern";
     isError: "isError";
     isNeedsHuman: "isNeedsHuman";
     isNeedsInput: "isNeedsInput";
     isOk: "isOk";
     isPending: "isPending";
     isSensitiveAccept: "isSensitiveAccept";
     jsonlFileSink: "jsonlFileSink";
     jsonSchemaToZod: "jsonSchemaToZod";
     keyFor: "keyFor";
     kinds: "kinds";
     ledger: "ledger";
     linkTtlMs: "linkTtlMs";
     lintAction: "lintAction";
     lintAgentText: "lintAgentText";
     lintManifest: "lintManifest";
     localStorage: "localStorage";
     manifest: "manifest";
     manifestCacheSeconds: "manifestCacheSeconds";
     manifestMaxAgeMs: "manifestMaxAgeMs";
     maxBodyBytes: "maxBodyBytes";
     maxEntries: "maxEntries";
     maxPageSize: "maxPageSize";
     maxPollAttempts: "maxPollAttempts";
     maxResponseBytes: "maxResponseBytes";
     maxRetryAfterMs: "maxRetryAfterMs";
     maxRisk: "maxRisk";
     maxSessions: "maxSessions";
     maxWaitMs: "maxWaitMs";
     metaFor: "metaFor";
     mintRelayToken: "mintRelayToken";
     modelContext: "modelContext";
     navigationTimeoutMs: "navigationTimeoutMs";
     needsInput: "needsInput";
     observe: "observe";
     onActionEvent: "onActionEvent";
     onActionsChanged: "onActionsChanged";
     onChange: "onChange";
     onContinue: "onContinue";
     onError: "onError";
     onEvent: "onEvent";
     onEvict: "onEvict";
     onManifestChange: "onManifestChange";
     onPoll: "onPoll";
     onRequest: "onRequest";
     onResult: "onResult";
     onResume: "onResume";
     onStatus: "onStatus";
     operationId: "operationId";
     operationLeaseSeconds: "operationLeaseSeconds";
     originCheck: "originCheck";
     otelSink: "otelSink";
     parseUserAgent: "parseUserAgent";
     poll: "poll";
     pollBudgetMs: "pollBudgetMs";
     present: "present";
     protectedResourceMetadata: "protectedResourceMetadata";
     providerResultContext: "ProviderResultContext";
     prune: "prune";
     quietMs: "quietMs";
     readOnlyHint: "readOnlyHint";
     reconcile: "reconcile";
     reconnectGraceMs: "reconnectGraceMs";
     record: "record";
     redactEvent: "redactEvent";
     register: "register";
     registerGenerated: "registerGenerated";
     registerTool: "registerTool";
     registryVersion: "registryVersion";
     relayAgentContext: "relayAgentContext";
     relayEvent: "relayEvent";
     relayOptions: "relayOptions";
     relaySecret: "relaySecret";
     relayUrl: "relayUrl";
     requestApproval: "requestApproval";
     requestedSchema: "requestedSchema";
     requestPolicy: "requestPolicy";
     requireApproval: "requireApproval";
     requireCompletion: "requireCompletion";
     requiredScopes: "requiredScopes";
     requireIdempotencyKey: "requireIdempotencyKey";
     requireInputDescriptions: "requireInputDescriptions";
     requireJsonContentType: "requireJsonContentType";
     resolveDisplay: "resolveDisplay";
     resourceMetadataUrl: "resourceMetadataUrl";
     resume: "resume";
     retries: "retries";
     revision: "revision";
     revisionMode: "revisionMode";
     run: "run";
     runAudit: "runAudit";
     runConformance: "runConformance";
     samplePayload: "samplePayload";
     schemaProblems: "schemaProblems";
     scopedSurfaces: "scopedSurfaces";
     secret: "secret";
     seedRev: "seedRev";
     sendWebResponse: "sendWebResponse";
     serveHttp: "serveHttp";
     serveStdio: "serveStdio";
     sessionCount: "sessionCount";
     sessionFor: "sessionFor";
     sessionIdGenerator: "sessionIdGenerator";
     setObjects: "setObjects";
     setRev: "setRev";
     siteKey: "siteKey";
     sqliteIdempotencyStore: "SqliteIdempotencyStore";
     startPath: "startPath";
     state: "state";
     stateToMarkdown: "stateToMarkdown";
     storageState: "storageState";
     storageStateSession: "storageStateSession";
     subscribe: "subscribe";
     suggestedReason: "suggestedReason";
     surfaceActions: "surfaceActions";
     surfaceAttributeNames: "SURFACE_ATTRIBUTES";
     surfaceAttributes: "surfaceAttributes";
     surfaceConflict: "SurfaceConflict";
     surfaceSelector: "surfaceSelector";
     sweepIntervalMs: "sweepIntervalMs";
     syncTimeoutMs: "syncTimeoutMs";
     tabId: "tabId";
     tabRetentionMs: "tabRetentionMs";
     thaw: "thaw";
     timeoutMs: "timeoutMs";
     toFormSchema: "toFormSchema";
     toHTML: "toHTML";
     toJsonSchema: "toJsonSchema";
     tokenStore: "tokenStore";
     tokenTtlSeconds: "tokenTtlSeconds";
     toMarkdown: "toMarkdown";
     toolCallContext: "ToolCallContext";
     toolNameFor: "toolNameFor";
     toWebRequest: "toWebRequest";
     trust: "trust";
     trustedOrigins: "trustedOrigins";
     ttlSeconds: "ttlSeconds";
     unavailable: "unavailable";
     unregister: "unregister";
     untrustedContentHint: "untrustedContentHint";
     useAutoSurface: "useAutoSurface";
     useAutoSurfaceHandle: "useAutoSurfaceHandle";
     useSurface: "useSurface";
     useSurfaceProps: "useSurfaceProps";
     validateJsonSchema: "validateJsonSchema";
     verifyRelayToken: "verifyRelayToken";
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
     generate: "axe generate";
     host: "axe host";
     init: "axe init";
     inspect: "axe inspect";
     mcp: "axe mcp";
     preview: "axe preview";
     relay: "axe relay";
     surface: "axe surface";
     surfaceCoverage: "axe surface coverage";
     surfaceInit: "axe surface init";
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
  domAttribute: Readonly<{
     disabled: "aria-disabled";
     label: "aria-label";
     readOnly: "aria-readonly";
     surfaceId: "data-surface-id";
     surfaceKind: "data-surface-kind";
     surfaceObject: "data-surface-object";
     surfaceReason: "data-surface-reason";
  }>;
  entryKind: Readonly<{
     action: "action";
     collection: "collection";
     field: "field";
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
     actor: "actor";
     affordances: "affordances";
     agent: "agent";
     agents: "agents";
     allow: "allow";
     amount: "amount";
     app: "app";
     at: "at";
     attributes: "attributes";
     auth: "auth";
     availability: "availability";
     available: "available";
     axeRefined: "x-axe-refined";
     axeReserved: "_axe";
     badges: "badges";
     baseUrl: "baseUrl";
     brand: "brand";
     burst: "burst";
     cacheTtlSeconds: "cacheTtlSeconds";
     changed: "changed";
     code: "code";
     compare: "compare";
     confirm: "confirm";
     contact: "contact";
     context: "context";
     continuationToken: "continuationToken";
     currency: "currency";
     currentRev: "currentRev";
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
     edit: "edit";
     effect: "effect";
     email: "email";
     emptyMessage: "emptyMessage";
     entries: "entries";
     entryId: "entryId";
     error: "error";
     errorCode: "errorCode";
     event: "event";
     examples: "examples";
     expected: "expected";
     expectedRev: "expectedRev";
     expiresAt: "expiresAt";
     fallback: "fallback";
     filter: "filter";
     flows: "flows";
     format: "format";
     freshness: "freshness";
     frozen: "frozen";
     handlerConflict: "conflict";
     handoff: "handoff";
     handoffId: "handoffId";
     handoffStatus: "handoffStatus";
     humanFallbackUrl: "humanFallbackUrl";
     humanHandoff: "humanHandoff";
     id: "id";
     idempotencyKey: "idempotencyKey";
     idempotent: "idempotent";
     ignoredRev: "ignoredRev";
     image: "image";
     index: "index";
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
     ledgerSeq: "ledgerSeq";
     limit: "limit";
     live: "live";
     loaded: "loaded";
     locale: "locale";
     logoUrl: "logoUrl";
     manifestUrl: "manifestUrl";
     max: "max";
     maxBodyBytes: "maxBodyBytes";
     maxLength: "maxLength";
     message: "message";
     modes: "modes";
     mutates: "mutates";
     name: "name";
     nameFrom: "nameFrom";
     next: "next";
     nextCursor: "nextCursor";
     object: "object";
     objects: "objects";
     onBehalfOf: "onBehalfOf";
     op: "op";
     operationStatus: "operationStatus";
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
     requires: "requires";
     resumeToken: "resumeToken";
     retryable: "retryable";
     retryAfter: "retryAfter";
     rev: "rev";
     revAfter: "revAfter";
     revBefore: "revBefore";
     reversible: "reversible";
     risk: "risk";
     role: "role";
     schema: "schema";
     schemaVersion: "schemaVersion";
     sensitive: "sensitive";
     seq: "seq";
     sessionId: "sessionId";
     since: "since";
     sites: "sites";
     sort: "sort";
     source: "source";
     staleConfig: "staleConfig";
     state: "state";
     status: "status";
     steps: "steps";
     subtitle: "subtitle";
     suggestedComparison: "suggestedComparison";
     summary: "summary";
     tags: "tags";
     target: "target";
     tenant: "tenant";
     termsUrl: "termsUrl";
     text: "text";
     textHash: "textHash";
     tier: "tier";
     timezone: "timezone";
     title: "title";
     tone: "tone";
     total: "total";
     ts: "ts";
     updatedAt: "updatedAt";
     url: "url";
     userLoginUrl: "userLoginUrl";
     validUntil: "validUntil";
     value: "value";
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
  markup: Readonly<{
     ignore: "data-surface-ignore";
  }>;
  op: Readonly<{
     click: "CLICK";
     scrollDown: "SCROLL_DOWN";
     toggle: "TOGGLE";
     typeText: "TYPE_TEXT";
  }>;
  path: Readonly<{
     actions: "/axe/actions";
     continue: "/axe/continue";
     index: "/.well-known/axe-index.json";
     manifest: "/.well-known/axe.json";
     manifestAlias: "/axe/manifest";
     poll: "/axe/poll";
     resume: "/axe/resume";
     state: "/axe/state";
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
     approvalRequired: "approval_required";
     consentRequired: "consent_required";
     crossOriginRefused: "cross_origin_refused";
     documentRequired: "document_required";
     identityRequired: "identity_required";
     jsonRequired: "json_required";
     loginRequired: "login_required";
     payloadTooLarge: "payload_too_large";
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
  schema: Readonly<{
     additionalItems: "additionalItems";
     additionalProperties: "additionalProperties";
     allOf: "allOf";
     anyOf: "anyOf";
     dependentRequired: "dependentRequired";
     dependentSchemas: "dependentSchemas";
     exclusiveMaximum: "exclusiveMaximum";
     exclusiveMinimum: "exclusiveMinimum";
     maxContains: "maxContains";
     maxItems: "maxItems";
     maxProperties: "maxProperties";
     minContains: "minContains";
     minItems: "minItems";
     minLength: "minLength";
     minProperties: "minProperties";
     multipleOf: "multipleOf";
     oneOf: "oneOf";
     patternProperties: "patternProperties";
     prefixItems: "prefixItems";
     propertyNames: "propertyNames";
     unevaluatedItems: "unevaluatedItems";
     unevaluatedProperties: "unevaluatedProperties";
     uniqueItems: "uniqueItems";
     writeOnly: "writeOnly";
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
     state: "axe_state";
  }>;
}>;
```

Every wire-level name in the AXE protocol, grouped by category.
Use these constants instead of string literals for paths, headers, statuses,
error codes, ladder values, kinds, MCP tool names, and CLI command names.

***

<a id="wire_entries"></a>

### WIRE\_ENTRIES

```ts
const WIRE_ENTRIES: ReadonlyArray<{
  category: string;
  key: string;
  name: string;
}>;
```

All entries as a flat list, for tooling.
