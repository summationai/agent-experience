[AXE API reference](../../README.md) / [@axe/core](README.md) / types

# types

## Interfaces

<a id="accept"></a>

### Accept

#### Properties

<a id="description"></a>

##### description

```ts
description: string;
```

<a id="instructions"></a>

##### instructions?

```ts
optional instructions?: string;
```

<a id="kind"></a>

##### kind

```ts
kind: string;
```

<a id="schema"></a>

##### schema

```ts
schema: JsonSchema;
```

<a id="sensitive"></a>

##### sensitive

```ts
sensitive: boolean;
```

<a id="title"></a>

##### title

```ts
title: string;
```

***

<a id="actiondefinition"></a>

### ActionDefinition

An action as it appears in the manifest.

#### Properties

<a id="affordances"></a>

##### affordances?

```ts
optional affordances?: Affordance[];
```

<a id="auth"></a>

##### auth

```ts
auth: WireAuthMode;
```

<a id="deprecated"></a>

##### deprecated?

```ts
optional deprecated?: Deprecation;
```

<a id="description-1"></a>

##### description

```ts
description: string;
```

<a id="display"></a>

##### display?

```ts
optional display?: Display;
```

<a id="examples"></a>

##### examples?

```ts
optional examples?: ActionExample[];
```

<a id="freshness"></a>

##### freshness?

```ts
optional freshness?: Freshness;
```

<a id="humanhandoff"></a>

##### humanHandoff?

```ts
optional humanHandoff?: object;
```

###### reasons

```ts
reasons: string[];
```

<a id="idempotent"></a>

##### idempotent

```ts
idempotent: boolean;
```

<a id="input"></a>

##### input

```ts
input: JsonSchema;
```

<a id="name"></a>

##### name

```ts
name: string;
```

<a id="output"></a>

##### output

```ts
output: JsonSchema;
```

<a id="pagination"></a>

##### pagination?

```ts
optional pagination?: Pagination;
```

<a id="readonly"></a>

##### readOnly

```ts
readOnly: boolean;
```

<a id="reversible"></a>

##### reversible

```ts
reversible: boolean;
```

<a id="risk"></a>

##### risk

```ts
risk: WireRisk;
```

<a id="title-1"></a>

##### title

```ts
title: string;
```

***

<a id="actionexample"></a>

### ActionExample

#### Properties

<a id="input-1"></a>

##### input

```ts
input: JsonValue;
```

<a id="output-1"></a>

##### output

```ts
output: JsonValue;
```

***

<a id="affordance"></a>

### Affordance

A statically declared affordance. `input` values are JSON Pointers relative to the item.

#### Properties

<a id="action"></a>

##### action

```ts
action: string;
```

<a id="input-2"></a>

##### input

```ts
input: Record<string, JsonPointer>;
```

<a id="primary"></a>

##### primary?

```ts
optional primary?: boolean;
```

<a id="title-2"></a>

##### title

```ts
title: string;
```

***

<a id="agentidentification"></a>

### AgentIdentification

#### Properties

<a id="contact"></a>

##### contact?

```ts
optional contact?: string;
```

<a id="name-1"></a>

##### name

```ts
name: string;
```

<a id="vendor"></a>

##### vendor?

```ts
optional vendor?: string;
```

<a id="version"></a>

##### version?

```ts
optional version?: string;
```

***

<a id="agentpolicy"></a>

### AgentPolicy

#### Properties

<a id="allow"></a>

##### allow?

```ts
optional allow?: string[];
```

<a id="deny"></a>

##### deny?

```ts
optional deny?: string[];
```

***

<a id="attributedisplay"></a>

### AttributeDisplay

#### Properties

<a id="compare"></a>

##### compare?

```ts
optional compare?: WireCompare;
```

<a id="format"></a>

##### format?

```ts
optional format?: WireFormat;
```

<a id="label"></a>

##### label

```ts
label: string;
```

<a id="path"></a>

##### path

```ts
path: string;
```

***

<a id="axeevent"></a>

### AXEEvent

#### Properties

<a id="action-1"></a>

##### action

```ts
action: string;
```

<a id="agent"></a>

##### agent

```ts
agent: EventAgent | null;
```

<a id="errorcode"></a>

##### errorCode

```ts
errorCode: WireError | null;
```

<a id="kind-1"></a>

##### kind

```ts
kind: string | null;
```

<a id="ladder"></a>

##### ladder

```ts
ladder: WireLadder;
```

<a id="latencyms"></a>

##### latencyMs

```ts
latencyMs: number;
```

<a id="schemaversion"></a>

##### schemaVersion

```ts
schemaVersion: 1;
```

<a id="status"></a>

##### status

```ts
status: WireStatus;
```

<a id="tenant"></a>

##### tenant

```ts
tenant: string | null;
```

<a id="ts"></a>

##### ts

```ts
ts: string;
```

***

<a id="axereserved"></a>

### AxeReserved

The reserved `_axe` member on an output or item.

#### Properties

<a id="affordances-1"></a>

##### affordances?

```ts
optional affordances?: DynamicAffordance[];
```

***

<a id="brand"></a>

### Brand

#### Properties

<a id="accentcolor"></a>

##### accentColor?

```ts
optional accentColor?: string;
```

<a id="logourl"></a>

##### logoUrl?

```ts
optional logoUrl?: string;
```

<a id="name-2"></a>

##### name?

```ts
optional name?: string;
```

<a id="tone"></a>

##### tone?

```ts
optional tone?: WireTone;
```

***

<a id="contact-1"></a>

### Contact

#### Properties

<a id="email"></a>

##### email?

```ts
optional email?: string;
```

<a id="url"></a>

##### url?

```ts
optional url?: string;
```

***

<a id="continuerequest"></a>

### ContinueRequest

#### Properties

<a id="continuationtoken"></a>

##### continuationToken

```ts
continuationToken: string;
```

<a id="kind-2"></a>

##### kind

```ts
kind: string;
```

<a id="payload"></a>

##### payload

```ts
payload: JsonValue;
```

***

<a id="deprecation"></a>

### Deprecation

#### Properties

<a id="replacedby"></a>

##### replacedBy?

```ts
optional replacedBy?: string;
```

<a id="since"></a>

##### since

```ts
since: string;
```

***

<a id="display-1"></a>

### Display

#### Properties

<a id="disclaimer"></a>

##### disclaimer?

```ts
optional disclaimer?: string;
```

<a id="emptymessage"></a>

##### emptyMessage?

```ts
optional emptyMessage?: string;
```

<a id="item"></a>

##### item?

```ts
optional item?: ItemDisplay;
```

<a id="items"></a>

##### items?

```ts
optional items?: string;
```

<a id="kind-3"></a>

##### kind

```ts
kind: WireDisplayKind;
```

<a id="suggestedcomparison"></a>

##### suggestedComparison?

```ts
optional suggestedComparison?: string[];
```

***

<a id="dynamicaffordance"></a>

### DynamicAffordance

A dynamic affordance returned under `_axe`. `input` values are concrete.

#### Properties

<a id="action-2"></a>

##### action

```ts
action: string;
```

<a id="input-3"></a>

##### input

```ts
input: Record<string, JsonValue>;
```

<a id="primary-1"></a>

##### primary?

```ts
optional primary?: boolean;
```

<a id="title-3"></a>

##### title

```ts
title: string;
```

***

<a id="errorbody"></a>

### ErrorBody

#### Properties

<a id="code"></a>

##### code

```ts
code: WireError;
```

<a id="details"></a>

##### details?

```ts
optional details?: JsonObject & object;
```

###### Type Declaration

###### issues?

```ts
optional issues?: ValidationIssue[];
```

<a id="message"></a>

##### message

```ts
message: string;
```

<a id="retryable"></a>

##### retryable

```ts
retryable: boolean;
```

***

<a id="errorresult"></a>

### ErrorResult

#### Properties

<a id="error"></a>

##### error

```ts
error: ErrorBody;
```

<a id="status-1"></a>

##### status

```ts
status: "error";
```

***

<a id="eventagent"></a>

### EventAgent

#### Properties

<a id="name-3"></a>

##### name?

```ts
optional name?: string;
```

<a id="vendor-1"></a>

##### vendor?

```ts
optional vendor?: string;
```

<a id="version-1"></a>

##### version?

```ts
optional version?: string;
```

***

<a id="flow"></a>

### Flow

#### Properties

<a id="description-2"></a>

##### description

```ts
description: string;
```

<a id="name-4"></a>

##### name

```ts
name: string;
```

<a id="steps"></a>

##### steps

```ts
steps: string[];
```

<a id="title-4"></a>

##### title

```ts
title: string;
```

***

<a id="freshness-1"></a>

### Freshness

#### Properties

<a id="cachettlseconds"></a>

##### cacheTtlSeconds?

```ts
optional cacheTtlSeconds?: number;
```

<a id="validuntil"></a>

##### validUntil?

```ts
optional validUntil?: string;
```

***

<a id="handoff"></a>

### Handoff

#### Properties

<a id="expiresat"></a>

##### expiresAt

```ts
expiresAt: string;
```

<a id="instructions-1"></a>

##### instructions

```ts
instructions: string;
```

<a id="reason"></a>

##### reason

```ts
reason: string;
```

<a id="resumetoken"></a>

##### resumeToken

```ts
resumeToken: string;
```

<a id="url-1"></a>

##### url

```ts
url: string;
```

<a id="whatagentshouldsaytouser"></a>

##### whatAgentShouldSayToUser

```ts
whatAgentShouldSayToUser: string;
```

***

<a id="indexsite"></a>

### IndexSite

#### Properties

<a id="manifesturl"></a>

##### manifestUrl

```ts
manifestUrl: string;
```

<a id="name-5"></a>

##### name

```ts
name: string;
```

<a id="tags"></a>

##### tags?

```ts
optional tags?: string[];
```

<a id="updatedat"></a>

##### updatedAt

```ts
updatedAt: string;
```

***

<a id="itemdisplay"></a>

### ItemDisplay

#### Properties

<a id="attributes"></a>

##### attributes?

```ts
optional attributes?: AttributeDisplay[];
```

<a id="badges"></a>

##### badges?

```ts
optional badges?: string[];
```

<a id="id"></a>

##### id

```ts
id: string;
```

<a id="image"></a>

##### image?

```ts
optional image?: string | string[];
```

<a id="price"></a>

##### price?

```ts
optional price?: PriceDisplay;
```

<a id="subtitle"></a>

##### subtitle?

```ts
optional subtitle?: string;
```

<a id="summary"></a>

##### summary?

```ts
optional summary?: string;
```

<a id="title-5"></a>

##### title

```ts
title: string;
```

<a id="url-2"></a>

##### url?

```ts
optional url?: string;
```

***

<a id="manifest"></a>

### Manifest

#### Properties

<a id="actions"></a>

##### actions

```ts
actions: ActionDefinition[];
```

<a id="auth-1"></a>

##### auth

```ts
auth: ManifestAuth;
```

<a id="baseurl"></a>

##### baseUrl

```ts
baseUrl: string;
```

<a id="brand-1"></a>

##### brand?

```ts
optional brand?: Brand;
```

<a id="contact-2"></a>

##### contact?

```ts
optional contact?: Contact;
```

<a id="description-3"></a>

##### description

```ts
description: string;
```

<a id="flows"></a>

##### flows?

```ts
optional flows?: Flow[];
```

<a id="humanfallbackurl"></a>

##### humanFallbackUrl?

```ts
optional humanFallbackUrl?: string;
```

<a id="indexurl"></a>

##### indexUrl?

```ts
optional indexUrl?: string;
```

<a id="name-6"></a>

##### name

```ts
name: string;
```

<a id="policies"></a>

##### policies?

```ts
optional policies?: Policies;
```

<a id="protocol"></a>

##### protocol

```ts
protocol: string;
```

<a id="updatedat-1"></a>

##### updatedAt?

```ts
optional updatedAt?: string;
```

***

<a id="manifestauth-1"></a>

### ManifestAuth

#### Properties

<a id="modes"></a>

##### modes

```ts
modes: WireAuthMode[];
```

<a id="userloginurl"></a>

##### userLoginUrl?

```ts
optional userLoginUrl?: string;
```

***

<a id="needshumanresult"></a>

### NeedsHumanResult

#### Properties

<a id="handoff-1"></a>

##### handoff

```ts
handoff: Handoff;
```

<a id="status-2"></a>

##### status

```ts
status: "needs_human";
```

***

<a id="needsinputresult"></a>

### NeedsInputResult

#### Properties

<a id="accepts"></a>

##### accepts

```ts
accepts: Accept[];
```

<a id="continuationtoken-1"></a>

##### continuationToken

```ts
continuationToken: string;
```

<a id="expiresat-1"></a>

##### expiresAt

```ts
expiresAt: string;
```

<a id="fallback"></a>

##### fallback?

```ts
optional fallback?: Handoff;
```

<a id="message-1"></a>

##### message

```ts
message: string;
```

<a id="reason-1"></a>

##### reason

```ts
reason: string;
```

<a id="status-3"></a>

##### status

```ts
status: "needs_input";
```

***

<a id="okresult"></a>

### OkResult

#### Type Parameters

##### O

`O` = [`JsonValue`](#jsonvalue)

#### Properties

<a id="output-2"></a>

##### output

```ts
output: O;
```

<a id="status-4"></a>

##### status

```ts
status: "ok";
```

***

<a id="pagination-1"></a>

### Pagination

#### Properties

<a id="cursorin"></a>

##### cursorIn

```ts
cursorIn: string;
```

<a id="cursorout"></a>

##### cursorOut

```ts
cursorOut: string;
```

<a id="pagesize"></a>

##### pageSize

```ts
pageSize: object;
```

###### default

```ts
default: number;
```

###### max

```ts
max: number;
```

***

<a id="pendingresult"></a>

### PendingResult

#### Properties

<a id="expiresat-2"></a>

##### expiresAt?

```ts
optional expiresAt?: string;
```

<a id="pollurl"></a>

##### pollUrl

```ts
pollUrl: string;
```

<a id="retryafter"></a>

##### retryAfter

```ts
retryAfter: number;
```

<a id="status-5"></a>

##### status

```ts
status: "pending";
```

***

<a id="platformindex"></a>

### PlatformIndex

#### Properties

<a id="next"></a>

##### next?

```ts
optional next?: string;
```

<a id="platform"></a>

##### platform

```ts
platform: object;
```

###### name

```ts
name: string;
```

###### url

```ts
url: string;
```

<a id="protocol-1"></a>

##### protocol

```ts
protocol: string;
```

<a id="sites"></a>

##### sites

```ts
sites: IndexSite[];
```

***

<a id="policies-1"></a>

### Policies

#### Properties

<a id="agents"></a>

##### agents?

```ts
optional agents?: AgentPolicy;
```

<a id="dataretention"></a>

##### dataRetention?

```ts
optional dataRetention?: string;
```

<a id="ratelimit"></a>

##### rateLimit?

```ts
optional rateLimit?: RateLimitPolicy;
```

<a id="termsurl"></a>

##### termsUrl?

```ts
optional termsUrl?: string;
```

***

<a id="pricedisplay"></a>

### PriceDisplay

#### Properties

<a id="amount"></a>

##### amount

```ts
amount: string;
```

<a id="currency"></a>

##### currency

```ts
currency: string;
```

<a id="period"></a>

##### period?

```ts
optional period?: WirePeriod;
```

***

<a id="ratelimitpolicy"></a>

### RateLimitPolicy

#### Properties

<a id="burst"></a>

##### burst?

```ts
optional burst?: number;
```

<a id="requestsperminute"></a>

##### requestsPerMinute

```ts
requestsPerMinute: number;
```

***

<a id="requestcontext"></a>

### RequestContext

#### Properties

<a id="agent-1"></a>

##### agent?

```ts
optional agent?: AgentIdentification;
```

<a id="locale"></a>

##### locale?

```ts
optional locale?: string;
```

<a id="onbehalfof"></a>

##### onBehalfOf?

```ts
optional onBehalfOf?: string;
```

<a id="sessionid"></a>

##### sessionId?

```ts
optional sessionId?: string;
```

<a id="timezone"></a>

##### timezone?

```ts
optional timezone?: string;
```

***

<a id="requestenvelope"></a>

### RequestEnvelope

#### Type Parameters

##### I

`I` = [`JsonValue`](#jsonvalue)

#### Properties

<a id="context"></a>

##### context?

```ts
optional context?: RequestContext;
```

<a id="idempotencykey"></a>

##### idempotencyKey?

```ts
optional idempotencyKey?: string;
```

<a id="input-4"></a>

##### input

```ts
input: I;
```

***

<a id="resumerequest"></a>

### ResumeRequest

#### Properties

<a id="resumetoken-1"></a>

##### resumeToken

```ts
resumeToken: string;
```

***

<a id="validationissue"></a>

### ValidationIssue

#### Properties

<a id="expected"></a>

##### expected?

```ts
optional expected?: string;
```

<a id="message-2"></a>

##### message

```ts
message: string;
```

<a id="path-1"></a>

##### path

```ts
path: string;
```

## Type Aliases

<a id="attributeformat"></a>

### AttributeFormat

```ts
type AttributeFormat = WireFormat;
```

***

<a id="authmode"></a>

### AuthMode

```ts
type AuthMode = WireAuthMode;
```

***

<a id="brandtone-1"></a>

### BrandTone

```ts
type BrandTone = WireTone;
```

***

<a id="comparedirection"></a>

### CompareDirection

```ts
type CompareDirection = WireCompare;
```

***

<a id="displaykind-1"></a>

### DisplayKind

```ts
type DisplayKind = WireDisplayKind;
```

***

<a id="errorcode-1"></a>

### ErrorCode

```ts
type ErrorCode = WireError;
```

***

<a id="jsonobject"></a>

### JsonObject

```ts
type JsonObject = object;
```

A JSON object.

#### Index Signature

```ts
[key: string]: JsonValue
```

***

<a id="jsonpointer"></a>

### JsonPointer

```ts
type JsonPointer = string;
```

An RFC 6901 JSON Pointer, for example `/units` or `/price/amount`.

***

<a id="jsonschema"></a>

### JsonSchema

```ts
type JsonSchema = object;
```

A JSON Schema document (draft 2020-12). Kept loose on purpose; the SDK generates these.

#### Index Signature

```ts
[key: string]: unknown
```

***

<a id="jsonvalue"></a>

### JsonValue

```ts
type JsonValue = 
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | {
[key: string]: JsonValue;
};
```

A JSON value.

***

<a id="ladder-1"></a>

### Ladder

```ts
type Ladder = WireLadder;
```

***

<a id="priceperiod"></a>

### PricePeriod

```ts
type PricePeriod = WirePeriod;
```

***

<a id="result"></a>

### Result

```ts
type Result<O> = 
  | OkResult<O>
  | NeedsInputResult
  | NeedsHumanResult
  | PendingResult
  | ErrorResult;
```

The result envelope: every AXE response body is one of these.

#### Type Parameters

##### O

`O` = [`JsonValue`](#jsonvalue)

***

<a id="resultstatus"></a>

### ResultStatus

```ts
type ResultStatus = WireStatus;
```

***

<a id="risk-1"></a>

### Risk

```ts
type Risk = WireRisk;
```
