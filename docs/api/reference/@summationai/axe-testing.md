[AXE API reference](../README.md) / @summationai/axe-testing

# @summationai/axe-testing

## Interfaces

<a id="auditcategory"></a>

### AuditCategory

#### Properties

<a id="checks"></a>

##### checks

```ts
checks: AuditCheck[];
```

<a id="id"></a>

##### id

```ts
id: string;
```

<a id="max"></a>

##### max

```ts
max: number;
```

<a id="score"></a>

##### score

```ts
score: number;
```

0 when the category is not scored.

<a id="scored"></a>

##### scored

```ts
scored: boolean;
```

False when every check in the category skipped. An unscored category earns nothing and is
left out of the total, which is then scaled to 100 over the categories that were scored.

<a id="title"></a>

##### title

```ts
title: string;
```

***

<a id="auditcheck"></a>

### AuditCheck

#### Properties

<a id="category"></a>

##### category

```ts
category: string;
```

<a id="detail"></a>

##### detail

```ts
detail: string;
```

<a id="docs"></a>

##### docs

```ts
docs: string;
```

<a id="earned"></a>

##### earned

```ts
earned: number;
```

Fraction earned, 0..1. Always 0 for a skipped check, which is excluded from the score.

<a id="id-1"></a>

##### id

```ts
id: string;
```

<a id="status"></a>

##### status

```ts
status: "pass" | "fail" | "skip" | "partial";
```

<a id="title-1"></a>

##### title

```ts
title: string;
```

<a id="weight"></a>

##### weight

```ts
weight: number;
```

***

<a id="auditfix"></a>

### AuditFix

#### Properties

<a id="category-1"></a>

##### category

```ts
category: string;
```

<a id="check"></a>

##### check

```ts
check: string;
```

<a id="detail-1"></a>

##### detail

```ts
detail: string;
```

<a id="docs-1"></a>

##### docs

```ts
docs: string;
```

<a id="points"></a>

##### points

```ts
points: number;
```

Points of the total score recoverable by fixing this check completely.

<a id="title-2"></a>

##### title

```ts
title: string;
```

***

<a id="auditoptions"></a>

### AuditOptions

#### Extends

- [`ConformanceOptions`](#conformanceoptions)

#### Properties

<a id="auth"></a>

##### auth?

```ts
optional auth?: string;
```

Bearer token for `user` or `site` actions, so the ladder can be exercised.

###### Inherited from

[`ConformanceOptions`](#conformanceoptions).[`auth`](#auth-1)

<a id="browser"></a>

##### browser?

```ts
optional browser?: boolean;
```

Fetch each parity URL and look for the agent-facing price/availability values on the page.

<a id="fetch"></a>

##### fetch?

```ts
optional fetch?: (input, init?) => Promise<Response>;
```

###### Parameters

###### input

`string` \| `URL`

###### init?

`RequestInit`

###### Returns

`Promise`\<`Response`\>

###### Inherited from

[`ConformanceOptions`](#conformanceoptions).[`fetch`](#fetch-1)

<a id="headers"></a>

##### headers?

```ts
optional headers?: Record<string, string>;
```

###### Inherited from

[`ConformanceOptions`](#conformanceoptions).[`headers`](#headers-1)

<a id="ladder"></a>

##### ladder?

```ts
optional ladder?: object;
```

Explicit action + input known to return `needs_input`, when examples do not.

###### action

```ts
action: string;
```

###### input

```ts
input: JsonValue;
```

###### Inherited from

[`ConformanceOptions`](#conformanceoptions).[`ladder`](#ladder-1)

<a id="minscore"></a>

##### minScore?

```ts
optional minScore?: number;
```

Fail below this score (used by the CLI exit code).

<a id="nomutate"></a>

##### noMutate?

```ts
optional noMutate?: boolean;
```

Skip checks that call mutating actions.

###### Inherited from

[`ConformanceOptions`](#conformanceoptions).[`noMutate`](#nomutate-1)

<a id="timeoutms"></a>

##### timeoutMs?

```ts
optional timeoutMs?: number;
```

Per-request timeout. Default 15000 ms.

###### Inherited from

[`ConformanceOptions`](#conformanceoptions).[`timeoutMs`](#timeoutms-1)

<a id="vendor"></a>

##### vendor?

```ts
optional vendor?: string;
```

Vendor to present in `context.agent`.

###### Inherited from

[`ConformanceOptions`](#conformanceoptions).[`vendor`](#vendor-1)

***

<a id="auditreport"></a>

### AuditReport

#### Properties

<a id="categories"></a>

##### categories

```ts
categories: AuditCategory[];
```

<a id="conformance"></a>

##### conformance

```ts
conformance: ConformanceReport;
```

<a id="fixes"></a>

##### fixes

```ts
fixes: AuditFix[];
```

<a id="generatedat"></a>

##### generatedAt

```ts
generatedAt: string;
```

<a id="hardfailure"></a>

##### hardFailure

```ts
hardFailure: string | null;
```

<a id="parity"></a>

##### parity

```ts
parity: object;
```

###### checked

```ts
checked: boolean;
```

###### note

```ts
note: string;
```

###### targets

```ts
targets: ParityTarget[];
```

<a id="score-1"></a>

##### score

```ts
score: number;
```

<a id="url"></a>

##### url

```ts
url: string;
```

***

<a id="axelike"></a>

### AxeLike

The subset of an `AXE` instance the helpers need.

#### Methods

<a id="describe"></a>

##### describe()

```ts
describe(): Manifest;
```

###### Returns

[`Manifest`](axe-client/index.md#manifest-1)

<a id="handle"></a>

##### handle()

```ts
handle(request, adapter?): Promise<Response>;
```

###### Parameters

###### request

`Request`

###### adapter?

###### identity?

  \| \{
  `onBehalfOf`: `string`;
\}
  \| `null`

###### Returns

`Promise`\<`Response`\>

***

<a id="check-1"></a>

### Check

#### Properties

<a id="detail-2"></a>

##### detail

```ts
detail: string;
```

<a id="docs-2"></a>

##### docs

```ts
docs: string;
```

Doc section that explains the fix.

<a id="id-2"></a>

##### id

```ts
id: string;
```

<a id="requirements"></a>

##### requirements

```ts
requirements: string[];
```

Spec requirement ids this check verifies.

<a id="status-1"></a>

##### status

```ts
status: CheckStatus;
```

<a id="title-3"></a>

##### title

```ts
title: string;
```

***

<a id="conformanceoptions"></a>

### ConformanceOptions

#### Extended by

- [`AuditOptions`](#auditoptions)

#### Properties

<a id="auth-1"></a>

##### auth?

```ts
optional auth?: string;
```

Bearer token for `user` or `site` actions, so the ladder can be exercised.

<a id="fetch-1"></a>

##### fetch?

```ts
optional fetch?: (input, init?) => Promise<Response>;
```

###### Parameters

###### input

`string` \| `URL`

###### init?

`RequestInit`

###### Returns

`Promise`\<`Response`\>

<a id="headers-1"></a>

##### headers?

```ts
optional headers?: Record<string, string>;
```

<a id="ladder-1"></a>

##### ladder?

```ts
optional ladder?: object;
```

Explicit action + input known to return `needs_input`, when examples do not.

###### action

```ts
action: string;
```

###### input

```ts
input: JsonValue;
```

<a id="nomutate-1"></a>

##### noMutate?

```ts
optional noMutate?: boolean;
```

Skip checks that call mutating actions.

<a id="timeoutms-1"></a>

##### timeoutMs?

```ts
optional timeoutMs?: number;
```

Per-request timeout. Default 15000 ms.

<a id="vendor-1"></a>

##### vendor?

```ts
optional vendor?: string;
```

Vendor to present in `context.agent`.

***

<a id="conformancereport"></a>

### ConformanceReport

#### Properties

<a id="checks-1"></a>

##### checks

```ts
checks: Check[];
```

<a id="failed"></a>

##### failed

```ts
failed: number;
```

<a id="manifest"></a>

##### manifest

```ts
manifest: Manifest | null;
```

<a id="manifesturl"></a>

##### manifestUrl

```ts
manifestUrl: string | null;
```

<a id="observations"></a>

##### observations

```ts
observations: Observations;
```

Observations the audit reuses.

<a id="ok"></a>

##### ok

```ts
ok: boolean;
```

True when no check failed.

<a id="passed"></a>

##### passed

```ts
passed: number;
```

<a id="skipped"></a>

##### skipped

```ts
skipped: number;
```

<a id="url-1"></a>

##### url

```ts
url: string;
```

<a id="warnings"></a>

##### warnings

```ts
warnings: number;
```

***

<a id="driftoptions"></a>

### DriftOptions

#### Properties

<a id="allowlistpath"></a>

##### allowlistPath?

```ts
optional allowlistPath?: string;
```

Path to the allowlist JSON, relative to root. Default `spec/drift-allowlist.json`.

<a id="docpaths"></a>

##### docPaths?

```ts
optional docPaths?: string[];
```

Doc directories to scan. Default `spec`, `docs`, and `README.md`; `docs/api` is skipped.

<a id="maxallowlist"></a>

##### maxAllowlist?

```ts
optional maxAllowlist?: number;
```

Maximum allowlist entries before the check fails. Default 15.

<a id="root"></a>

##### root

```ts
root: string;
```

Repository root containing `spec/`, `docs/`, `packages/`, `README.md`.

<a id="sitepaths"></a>

##### sitePaths?

```ts
optional sitePaths?: string[];
```

Site source directories: `.html` files contribute their `<code>` spans, `.js` files their string literals.

***

<a id="driftreport"></a>

### DriftReport

#### Properties

<a id="allowlist"></a>

##### allowlist

```ts
allowlist: string[];
```

<a id="literals"></a>

##### literals

```ts
literals: object[];
```

Source files with literal wire names that should use WIRE.

###### file

```ts
file: string;
```

###### literal

```ts
literal: string;
```

<a id="missingfromtypes"></a>

##### missingFromTypes

```ts
missingFromTypes: string[];
```

`field`/`api` entries missing from every public .d.ts.

<a id="ok-1"></a>

##### ok

```ts
ok: boolean;
```

<a id="unknown"></a>

##### unknown

```ts
unknown: Record<string, string[]>;
```

Tokens that look like wire names but are not in the vocabulary: token → files.

<a id="unmentioned"></a>

##### unmentioned

```ts
unmentioned: string[];
```

Vocabulary entries never mentioned in any doc.

<a id="unused"></a>

##### unused

```ts
unused: string[];
```

Vocabulary entries never used in any source file.

***

<a id="observations-1"></a>

### Observations

#### Properties

<a id="calls"></a>

##### calls

```ts
calls: object[];
```

Actions called live and whether each returned a non-error status.

###### action

```ts
action: string;
```

###### status

```ts
status: string;
```

<a id="hintfound"></a>

##### hintFound

```ts
hintFound: "header" | "robots" | "link" | null;
```

<a id="idempotencyreplayworked"></a>

##### idempotencyReplayWorked

```ts
idempotencyReplayWorked: boolean | null;
```

Whether a mutating action with a usable idempotency path was found.

<a id="livestate"></a>

##### liveState

```ts
liveState: LiveState | null;
```

The `/axe/state` document, when the manifest advertises live state and the endpoint answered.

<a id="needshuman"></a>

##### needsHuman

```ts
needsHuman: object[];
```

Every `needs_human` seen.

###### action

```ts
action: string;
```

###### reason

```ts
reason: string;
```

<a id="needsinput"></a>

##### needsInput

```ts
needsInput: object[];
```

Every `needs_input` seen, with the action that produced it.

###### action

```ts
action: string;
```

###### result

```ts
result: NeedsInputResult;
```

<a id="outputs"></a>

##### outputs

```ts
outputs: object[];
```

Per-action outputs from live example runs, for display and parity checks.

###### action

```ts
action: string;
```

###### output

```ts
output: unknown;
```

<a id="tokentamperrejected"></a>

##### tokenTamperRejected

```ts
tokenTamperRejected: boolean | null;
```

***

<a id="paritytarget"></a>

### ParityTarget

#### Properties

<a id="action"></a>

##### action

```ts
action: string;
```

<a id="expect"></a>

##### expect

```ts
expect: Record<string, string>;
```

Values an auditor should find on the human page.

<a id="found"></a>

##### found?

```ts
optional found?: Record<string, boolean>;
```

Filled in with `--browser`.

<a id="itemid"></a>

##### itemId

```ts
itemId: string;
```

<a id="url-2"></a>

##### url

```ts
url: string;
```

***

<a id="testclientoptions"></a>

### TestClientOptions

#### Extends

- `ClientOptions`

#### Properties

<a id="agent"></a>

##### agent?

```ts
optional agent?: AgentIdentification;
```

Sent as `context.agent` and as the `User-Agent` when possible.

###### Inherited from

```ts
ClientOptions.agent
```

<a id="auth-2"></a>

##### auth?

```ts
optional auth?: string | (() => MaybePromise<string | undefined>);
```

Bearer token, or a function returning one, sent in `Authorization` to origins in the
credential audience only (see `trust`).

###### Inherited from

```ts
ClientOptions.auth
```

<a id="confirm"></a>

##### confirm?

```ts
optional confirm?: (request) => MaybePromise<boolean>;
```

Called before any `sensitive` payload is sent. Without it, sensitive options are skipped.

###### Parameters

###### request

`ConfirmRequest`

###### Returns

`MaybePromise`\<`boolean`\>

###### Inherited from

```ts
ClientOptions.confirm
```

<a id="fetch-2"></a>

##### fetch?

```ts
optional fetch?: FetchLike;
```

###### Inherited from

```ts
ClientOptions.fetch
```

<a id="fulfillers"></a>

##### fulfillers?

```ts
optional fulfillers?: Fulfiller[];
```

###### Inherited from

```ts
ClientOptions.fulfillers
```

<a id="headers-2"></a>

##### headers?

```ts
optional headers?: Record<string, string>;
```

Extra headers. Treated as credentials: sent only to origins in the credential audience
(the discovery origin plus `trust.origins`), never on a cross-origin redirect.

###### Inherited from

```ts
ClientOptions.headers
```

<a id="identity"></a>

##### identity?

```ts
optional identity?: 
  | {
  onBehalfOf: string;
}
  | null;
```

Act as this user without going through your `authenticate` function.

<a id="locale"></a>

##### locale?

```ts
optional locale?: string;
```

###### Inherited from

```ts
ClientOptions.locale
```

<a id="manifestmaxagems"></a>

##### manifestMaxAgeMs?

```ts
optional manifestMaxAgeMs?: number;
```

Longest time, in ms, a fetched manifest is used before `ensureFresh()` revalidates it. The
effective bound is the smaller of this and the manifest response's `Cache-Control` max-age
(`no-cache` and `no-store` mean 0). Default 300000. See "Manifest freshness".

###### Inherited from

```ts
ClientOptions.manifestMaxAgeMs
```

<a id="maxresponsebytes"></a>

##### maxResponseBytes?

```ts
optional maxResponseBytes?: number;
```

Largest response body the client reads, in bytes. A larger `Content-Length` is refused
before reading; a body without one is read up to the limit, then cancelled. Default 4194304
(4 MiB).

###### Inherited from

```ts
ClientOptions.maxResponseBytes
```

<a id="maxretryafterms"></a>

##### maxRetryAfterMs?

```ts
optional maxRetryAfterMs?: number;
```

Longest `Retry-After` the client will honor automatically, in ms. Default 30000.

###### Inherited from

```ts
ClientOptions.maxRetryAfterMs
```

<a id="retries"></a>

##### retries?

```ts
optional retries?: number;
```

Retries after `rate_limited`/`unavailable`. Default 1.

###### Inherited from

```ts
ClientOptions.retries
```

<a id="sessionid"></a>

##### sessionId?

```ts
optional sessionId?: string;
```

###### Inherited from

```ts
ClientOptions.sessionId
```

<a id="timeoutms-2"></a>

##### timeoutMs?

```ts
optional timeoutMs?: number;
```

Abort one request after this many milliseconds, redirects and reading the body included.
Default 30000. Each retry and each poll is a new request with its own timeout.

###### Inherited from

```ts
ClientOptions.timeoutMs
```

<a id="timezone"></a>

##### timezone?

```ts
optional timezone?: string;
```

###### Inherited from

```ts
ClientOptions.timezone
```

<a id="trust"></a>

##### trust?

```ts
optional trust?: TrustOptions;
```

Which destinations the client may contact and which receive credentials. See `TrustOptions`.

###### Inherited from

```ts
ClientOptions.trust
```

## Type Aliases

<a id="checkstatus-1"></a>

### CheckStatus

```ts
type CheckStatus = "pass" | "fail" | "warn" | "skip";
```

***

<a id="coverage"></a>

### Coverage

```ts
type Coverage = 
  | {
  check: string;
}
  | {
  test: string;
};
```

Where every numbered requirement in spec/AXE-PROTOCOL.md is verified: by a conformance
check id (runs against any URL) or by a named test in a package. A test asserts that
every `[P-...]` identifier in the spec appears here.

## Variables

<a id="requirements-1"></a>

### REQUIREMENTS

```ts
const REQUIREMENTS: Readonly<Record<string, readonly Coverage[]>>;
```

***

<a id="sample_payloads"></a>

### SAMPLE\_PAYLOADS

```ts
const SAMPLE_PAYLOADS: Readonly<Record<string, JsonValue>>;
```

A valid sample payload for every well-known kind, for exercising `/axe/continue` in tests and conformance.

***

<a id="weights"></a>

### WEIGHTS

```ts
const WEIGHTS: Weights;
```

***

<a id="well_known_kind_names"></a>

### WELL\_KNOWN\_KIND\_NAMES

```ts
const WELL_KNOWN_KIND_NAMES: readonly string[];
```

Names of every well-known kind.

## Functions

<a id="checkvocabularydrift"></a>

### checkVocabularyDrift()

```ts
function checkVocabularyDrift(options): DriftReport;
```

#### Parameters

##### options

[`DriftOptions`](#driftoptions)

#### Returns

[`DriftReport`](#driftreport)

***

<a id="createtestclient"></a>

### createTestClient()

```ts
function createTestClient(axe, options?): AXEClient;
```

An `AXEClient` bound to an in-process server: no network, no port. Pass `identity`
to act as a signed-in user.

#### Parameters

##### axe

[`AxeLike`](#axelike)

##### options?

[`TestClientOptions`](#testclientoptions) = `{}`

#### Returns

`AXEClient`

***

<a id="formataudithtml"></a>

### formatAuditHtml()

```ts
function formatAuditHtml(report): string;
```

Self-contained HTML report suitable for attaching to a pull request.

#### Parameters

##### report

[`AuditReport`](#auditreport)

#### Returns

`string`

***

<a id="formataudittable"></a>

### formatAuditTable()

```ts
function formatAuditTable(report, options?): string;
```

Terminal table.

#### Parameters

##### report

[`AuditReport`](#auditreport)

##### options?

###### color?

`boolean`

#### Returns

`string`

***

<a id="formatconformancetable"></a>

### formatConformanceTable()

```ts
function formatConformanceTable(report, options?): string;
```

Plain-text table for terminals.

#### Parameters

##### report

[`ConformanceReport`](#conformancereport)

##### options?

###### color?

`boolean`

#### Returns

`string`

***

<a id="formatdriftreport"></a>

### formatDriftReport()

```ts
function formatDriftReport(r): string;
```

Human-readable summary.

#### Parameters

##### r

[`DriftReport`](#driftreport)

#### Returns

`string`

***

<a id="graphconnectivity"></a>

### graphConnectivity()

```ts
function graphConnectivity(m): object;
```

Actions reachable from a read action or from another action's affordances.

#### Parameters

##### m

[`Manifest`](axe-client/index.md#manifest-1)

#### Returns

`object`

##### deadEndReads

```ts
deadEndReads: string[];
```

##### orphanTransactions

```ts
orphanTransactions: string[];
```

***

<a id="htmlcodespans"></a>

### htmlCodeSpans()

```ts
function htmlCodeSpans(html): string[];
```

`<code>` contents of an HTML file, decoded; build markers and generated blocks are ignored.

#### Parameters

##### html

`string`

#### Returns

`string`[]

***

<a id="inlinecodespans"></a>

### inlineCodeSpans()

```ts
function inlineCodeSpans(markdown): string[];
```

Inline code spans, with fenced blocks removed first.

#### Parameters

##### markdown

`string`

#### Returns

`string`[]

***

<a id="invokeaction"></a>

### invokeAction()

```ts
function invokeAction<O>(
   axe, 
   name, 
   input, 
   options?
): Promise<Result<O>>;
```

Invoke one action in-process and return the raw result envelope. Adds an idempotency
key for mutating actions.

#### Type Parameters

##### O

`O` = [`JsonValue`](axe-client/index.md#jsonvalue)

#### Parameters

##### axe

[`AxeLike`](#axelike)

##### name

`string`

##### input

`unknown`

##### options?

###### headers?

`Record`\<`string`, `string`\>

###### idempotencyKey?

`string`

###### identity?

  \| \{
  `onBehalfOf`: `string`;
\}
  \| `null`

#### Returns

`Promise`\<[`Result`](axe-client/index.md#result)\<`O`\>\>

***

<a id="jsstringliterals"></a>

### jsStringLiterals()

```ts
function jsStringLiterals(source): string[];
```

String literals of a JavaScript file (single, double, and template without expressions).

#### Parameters

##### source

`string`

#### Returns

`string`[]

***

<a id="runaudit"></a>

### runAudit()

```ts
function runAudit(url, options?): Promise<AuditReport>;
```

Run the audit. Runs the conformance suite first and reuses its observations.

#### Parameters

##### url

`string`

##### options?

[`AuditOptions`](#auditoptions) = `{}`

#### Returns

`Promise`\<[`AuditReport`](#auditreport)\>

***

<a id="runconformance"></a>

### runConformance()

```ts
function runConformance(url, options?): Promise<ConformanceReport>;
```

Run the conformance suite against a site.

#### Parameters

##### url

`string`

##### options?

[`ConformanceOptions`](#conformanceoptions) = `{}`

#### Returns

`Promise`\<[`ConformanceReport`](#conformancereport)\>

***

<a id="samplepayload"></a>

### samplePayload()

```ts
function samplePayload(kind): JsonValue | undefined;
```

Sample payload for a kind, or undefined for custom kinds.

#### Parameters

##### kind

`string`

#### Returns

[`JsonValue`](axe-client/index.md#jsonvalue) \| `undefined`

***

<a id="wirelikenames"></a>

### wireLikeNames()

```ts
function wireLikeNames(span): WireLikeName[];
```

#### Parameters

##### span

`string`

#### Returns

`WireLikeName`[]
