[AXE API reference](../../README.md) / [@axe/client](README.md) / index

# index

## Classes

<a id="axeclient"></a>

### AXEClient

#### Constructors

<a id="constructor"></a>

##### Constructor

```ts
new AXEClient(manifestDoc, options?): AXEClient;
```

Build a client from a manifest. Credentials are anchored at the origin `discover()` found the
manifest on, or, for a manifest you obtained yourself, at its `baseUrl` origin: the client
trusts a manifest you hand it. Add origins with `trust.origins`.

###### Parameters

###### manifestDoc

[`Manifest`](#manifest-1)

###### options?

[`ClientOptions`](#clientoptions) = `{}`

###### Returns

[`AXEClient`](#axeclient)

#### Methods

<a id="action"></a>

##### action()

```ts
action(name): ActionDefinition | undefined;
```

One action's definition, or undefined.

###### Parameters

###### name

`string`

###### Returns

[`ActionDefinition`](#actiondefinition) \| `undefined`

<a id="allowed"></a>

##### allowed()

```ts
allowed(): boolean;
```

Whether this client's vendor is allowed by `policies.agents`. Agents MUST check before calling.

###### Returns

`boolean`

<a id="checkdestination"></a>

##### checkDestination()

```ts
checkDestination(url): DestinationDecision;
```

Whether the destination policy lets this client contact `url`, and with credentials. Checks
scheme and origin only; `trust.destinationPolicy` runs at request time. Useful before
showing or opening a URL a site returned, such as a handoff `url`.

###### Parameters

###### url

`string`

###### Returns

[`DestinationDecision`](#destinationdecision)

<a id="continue"></a>

##### continue()

```ts
continue<O>(
   continuationToken, 
   kind, 
   payload, 
   options?
): Promise<Result<O>>;
```

Satisfy a `needs_input` requirement.

###### Type Parameters

###### O

`O` = [`JsonValue`](#jsonvalue)

###### Parameters

###### continuationToken

`string`

###### kind

`string`

###### payload

[`JsonValue`](#jsonvalue)

###### options?

[`InvokeOptions`](#invokeoptions) = `{}`

###### Returns

`Promise`\<[`Result`](#result)\<`O`\>\>

<a id="ensurefresh"></a>

##### ensureFresh()

```ts
ensureFresh(options?): Promise<ManifestChange | undefined>;
```

`refresh()` when the manifest is stale; otherwise nothing.

###### Parameters

###### options?

###### signal?

`AbortSignal`

###### Returns

`Promise`\<[`ManifestChange`](#manifestchange) \| `undefined`\>

<a id="invoke"></a>

##### invoke()

```ts
invoke<O>(
   name, 
   input, 
   options?
): Promise<Result<O>>;
```

Invoke an action. Generates an idempotency key for mutating actions when none is given.

###### Type Parameters

###### O

`O` = [`JsonValue`](#jsonvalue)

###### Parameters

###### name

`string`

###### input

`unknown`

###### options?

[`InvokeOptions`](#invokeoptions) = `{}`

###### Returns

`Promise`\<[`Result`](#result)\<`O`\>\>

<a id="ismanifeststale"></a>

##### isManifestStale()

```ts
isManifestStale(now?): boolean;
```

Whether the manifest is older than its bound: the smaller of `manifestMaxAgeMs` (default five
minutes) and the `Cache-Control` max-age the site sent with it.

###### Parameters

###### now?

`number` = `...`

###### Returns

`boolean`

<a id="live"></a>

##### live()

```ts
live(): Live | undefined;
```

The manifest's `live` member, when the site publishes live state.

###### Returns

[`Live`](#live-1) \| `undefined`

<a id="manifest"></a>

##### manifest()

```ts
manifest(): Manifest;
```

The manifest this client was built from.

###### Returns

[`Manifest`](#manifest-1)

<a id="onmanifestchange"></a>

##### onManifestChange()

```ts
onManifestChange(listener): () => void;
```

Called after every refresh that changed the manifest. Returns an unsubscribe function.

###### Parameters

###### listener

(`change`) => `void`

###### Returns

() => `void`

<a id="poll"></a>

##### poll()

```ts
poll<O>(pendingResult, options?): Promise<Result<O>>;
```

Poll a `pending` result until it settles or `maxWaitMs` passes (then the last `pending` is returned).

###### Type Parameters

###### O

`O` = [`JsonValue`](#jsonvalue)

###### Parameters

###### pendingResult

[`PendingResult`](#pendingresult)

###### options?

[`PollOptions`](#polloptions) = `{}`

###### Returns

`Promise`\<[`Result`](#result)\<`O`\>\>

<a id="refresh"></a>

##### refresh()

```ts
refresh(options?): Promise<ManifestChange>;
```

Fetch the manifest again, conditionally (`If-None-Match` when the site sent an `ETag`), and
replace this client's copy when it changed. Concurrent calls share one request. The new
manifest's `baseUrl` must pass the destination policy, or the old manifest is kept and
`AXETrustError` is thrown. Listeners from `onManifestChange` hear about a change.

###### Parameters

###### options?

###### signal?

`AbortSignal`

###### Returns

`Promise`\<[`ManifestChange`](#manifestchange)\>

<a id="resume"></a>

##### resume()

```ts
resume<O>(resumeToken, options?): Promise<Result<O>>;
```

Resume after a human handoff.

###### Type Parameters

###### O

`O` = [`JsonValue`](#jsonvalue)

###### Parameters

###### resumeToken

`string`

###### options?

[`InvokeOptions`](#invokeoptions) = `{}`

###### Returns

`Promise`\<[`Result`](#result)\<`O`\>\>

<a id="run"></a>

##### run()

```ts
run<O>(
   name, 
   input, 
   options?
): Promise<RunOutcome<O>>;
```

Drive the whole escalation ladder: invoke, satisfy each `needs_input` from
registered fulfillers (confirming sensitive payloads), poll pending work, and
surface a handoff only when nothing else works.

When `expectedRev` is passed, the revision is tracked through the ladder: the first call
carries it, and each continuation carries the `rev` of the result it continues from, so a
change by someone else between two rungs is caught as `conflict` rather than applied blind.

###### Type Parameters

###### O

`O` = [`JsonValue`](#jsonvalue)

###### Parameters

###### name

`string`

###### input

`unknown`

###### options?

[`RunOptions`](#runoptions) = `{}`

###### Returns

`Promise`\<[`RunOutcome`](#runoutcome)\<`O`\>\>

<a id="state"></a>

##### state()

```ts
state(options?): Promise<LiveState>;
```

What can be done right now, and why not the rest: `GET /axe/state` (never cached), computed for
the caller `auth` identifies. Throws `AXEClientError` when the site publishes no live state.

###### Parameters

###### options?

###### signal?

`AbortSignal`

###### Returns

`Promise`\<[`LiveState`](#livestate)\>

<a id="discover"></a>

##### discover()

```ts
static discover(
   url, 
   options?, 
   call?
): Promise<AXEClient>;
```

Discover and construct in one step. Throws `AXETrustError` when the manifest's `baseUrl` is on
an origin `trust` does not authorize: a manifest cannot redirect your credentials elsewhere.

###### Parameters

###### url

`string`

###### options?

[`ClientOptions`](#clientoptions) = `{}`

###### call?

###### signal?

`AbortSignal`

###### Returns

`Promise`\<[`AXEClient`](#axeclient)\>

***

<a id="axeclienterror"></a>

### AXEClientError

Thrown for transport-level failures: the network, a timeout or an abort, a response larger than
`maxResponseBytes`, and a body that is not JSON or not a well-formed AXE document. Protocol
errors are returned as `error` results.

#### Extends

- `Error`

#### Extended by

- [`AXETrustError`](#axetrusterror)

#### Constructors

<a id="constructor-1"></a>

##### Constructor

```ts
new AXEClientError(message, cause?): AXEClientError;
```

###### Parameters

###### message

`string`

###### cause?

`unknown`

###### Returns

[`AXEClientError`](#axeclienterror)

###### Overrides

```ts
Error.constructor
```

#### Properties

<a id="cause"></a>

##### cause

```ts
readonly cause: unknown;
```

###### Overrides

```ts
Error.cause
```

<a id="message"></a>

##### message

```ts
message: string;
```

###### Inherited from

```ts
Error.message
```

<a id="name"></a>

##### name

```ts
name: string;
```

###### Inherited from

```ts
Error.name
```

<a id="stack"></a>

##### stack?

```ts
optional stack?: string;
```

###### Inherited from

```ts
Error.stack
```

<a id="stacktracelimit"></a>

##### stackTraceLimit

```ts
static stackTraceLimit: number;
```

The `Error.stackTraceLimit` property specifies the number of stack frames
collected by a stack trace (whether generated by `new Error().stack` or
`Error.captureStackTrace(obj)`).

The default value is `10` but may be set to any valid JavaScript number. Changes
will affect any stack trace captured _after_ the value has been changed.

If set to a non-number value, or set to a negative number, stack traces will
not capture any frames.

###### Inherited from

```ts
Error.stackTraceLimit
```

#### Methods

<a id="capturestacktrace"></a>

##### captureStackTrace()

```ts
static captureStackTrace(targetObject, constructorOpt?): void;
```

Creates a `.stack` property on `targetObject`, which when accessed returns
a string representing the location in the code at which
`Error.captureStackTrace()` was called.

```js
const myObject = {};
Error.captureStackTrace(myObject);
myObject.stack;  // Similar to `new Error().stack`
```

The first line of the trace will be prefixed with
`${myObject.name}: ${myObject.message}`.

The optional `constructorOpt` argument accepts a function. If given, all frames
above `constructorOpt`, including `constructorOpt`, will be omitted from the
generated stack trace.

The `constructorOpt` argument is useful for hiding implementation
details of error generation from the user. For instance:

```js
function a() {
  b();
}

function b() {
  c();
}

function c() {
  // Create an error without stack trace to avoid calculating the stack trace twice.
  const { stackTraceLimit } = Error;
  Error.stackTraceLimit = 0;
  const error = new Error();
  Error.stackTraceLimit = stackTraceLimit;

  // Capture the stack trace above function b
  Error.captureStackTrace(error, b); // Neither function c, nor b is included in the stack trace
  throw error;
}

a();
```

###### Parameters

###### targetObject

`object`

###### constructorOpt?

`Function`

###### Returns

`void`

###### Inherited from

```ts
Error.captureStackTrace
```

<a id="preparestacktrace"></a>

##### prepareStackTrace()

```ts
static prepareStackTrace(err, stackTraces): any;
```

###### Parameters

###### err

`Error`

###### stackTraces

`CallSite`[]

###### Returns

`any`

###### See

https://v8.dev/docs/stack-trace-api#customizing-stack-traces

###### Inherited from

```ts
Error.prepareStackTrace
```

***

<a id="axetrusterror"></a>

### AXETrustError

Thrown when the destination policy refuses a request. Nothing was sent to `url`.

#### Extends

- [`AXEClientError`](#axeclienterror)

#### Constructors

<a id="constructor-2"></a>

##### Constructor

```ts
new AXETrustError(
   message, 
   url, 
   kind
): AXETrustError;
```

###### Parameters

###### message

`string`

###### url

`string`

###### kind

[`DestinationKind`](#destinationkind)

###### Returns

[`AXETrustError`](#axetrusterror)

###### Overrides

[`AXEClientError`](#axeclienterror).[`constructor`](#constructor-1)

#### Properties

<a id="cause-1"></a>

##### cause

```ts
readonly cause: unknown;
```

###### Inherited from

[`AXEClientError`](#axeclienterror).[`cause`](#cause)

<a id="kind"></a>

##### kind

```ts
readonly kind: DestinationKind;
```

<a id="message-1"></a>

##### message

```ts
message: string;
```

###### Inherited from

[`AXEClientError`](#axeclienterror).[`message`](#message)

<a id="name-1"></a>

##### name

```ts
name: string;
```

###### Inherited from

[`AXEClientError`](#axeclienterror).[`name`](#name)

<a id="stack-1"></a>

##### stack?

```ts
optional stack?: string;
```

###### Inherited from

[`AXEClientError`](#axeclienterror).[`stack`](#stack)

<a id="url"></a>

##### url

```ts
readonly url: string;
```

<a id="stacktracelimit-1"></a>

##### stackTraceLimit

```ts
static stackTraceLimit: number;
```

The `Error.stackTraceLimit` property specifies the number of stack frames
collected by a stack trace (whether generated by `new Error().stack` or
`Error.captureStackTrace(obj)`).

The default value is `10` but may be set to any valid JavaScript number. Changes
will affect any stack trace captured _after_ the value has been changed.

If set to a non-number value, or set to a negative number, stack traces will
not capture any frames.

###### Inherited from

[`AXEClientError`](#axeclienterror).[`stackTraceLimit`](#stacktracelimit)

#### Methods

<a id="capturestacktrace-1"></a>

##### captureStackTrace()

```ts
static captureStackTrace(targetObject, constructorOpt?): void;
```

Creates a `.stack` property on `targetObject`, which when accessed returns
a string representing the location in the code at which
`Error.captureStackTrace()` was called.

```js
const myObject = {};
Error.captureStackTrace(myObject);
myObject.stack;  // Similar to `new Error().stack`
```

The first line of the trace will be prefixed with
`${myObject.name}: ${myObject.message}`.

The optional `constructorOpt` argument accepts a function. If given, all frames
above `constructorOpt`, including `constructorOpt`, will be omitted from the
generated stack trace.

The `constructorOpt` argument is useful for hiding implementation
details of error generation from the user. For instance:

```js
function a() {
  b();
}

function b() {
  c();
}

function c() {
  // Create an error without stack trace to avoid calculating the stack trace twice.
  const { stackTraceLimit } = Error;
  Error.stackTraceLimit = 0;
  const error = new Error();
  Error.stackTraceLimit = stackTraceLimit;

  // Capture the stack trace above function b
  Error.captureStackTrace(error, b); // Neither function c, nor b is included in the stack trace
  throw error;
}

a();
```

###### Parameters

###### targetObject

`object`

###### constructorOpt?

`Function`

###### Returns

`void`

###### Inherited from

[`AXEClientError`](#axeclienterror).[`captureStackTrace`](#capturestacktrace)

<a id="preparestacktrace-1"></a>

##### prepareStackTrace()

```ts
static prepareStackTrace(err, stackTraces): any;
```

###### Parameters

###### err

`Error`

###### stackTraces

`CallSite`[]

###### Returns

`any`

###### See

https://v8.dev/docs/stack-trace-api#customizing-stack-traces

###### Inherited from

[`AXEClientError`](#axeclienterror).[`prepareStackTrace`](#preparestacktrace)

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

<a id="kind-1"></a>

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

<a id="availability"></a>

##### availability?

```ts
optional availability?: Availability;
```

Computed at render time: whether the action can be done right now (the anonymous view in the manifest).

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

<a id="name-2"></a>

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

<a id="clientoptions"></a>

### ClientOptions

#### Properties

<a id="agent"></a>

##### agent?

```ts
optional agent?: AgentIdentification;
```

Sent as `context.agent` and as the `User-Agent` when possible.

<a id="auth-1"></a>

##### auth?

```ts
optional auth?: string | (() => MaybePromise<string | undefined>);
```

Bearer token, or a function returning one, sent in `Authorization` to origins in the
credential audience only (see `trust`).

<a id="confirm"></a>

##### confirm?

```ts
optional confirm?: (request) => MaybePromise<boolean>;
```

Called before any `sensitive` payload is sent. Without it, sensitive options are skipped.

###### Parameters

###### request

[`ConfirmRequest`](#confirmrequest)

###### Returns

`MaybePromise`\<`boolean`\>

<a id="fetch"></a>

##### fetch?

```ts
optional fetch?: FetchLike;
```

<a id="fulfillers"></a>

##### fulfillers?

```ts
optional fulfillers?: Fulfiller[];
```

<a id="headers"></a>

##### headers?

```ts
optional headers?: Record<string, string>;
```

Extra headers. Treated as credentials: sent only to origins in the credential audience
(the discovery origin plus `trust.origins`), never on a cross-origin redirect.

<a id="locale"></a>

##### locale?

```ts
optional locale?: string;
```

<a id="manifestmaxagems"></a>

##### manifestMaxAgeMs?

```ts
optional manifestMaxAgeMs?: number;
```

Longest time, in ms, a fetched manifest is used before `ensureFresh()` revalidates it. The
effective bound is the smaller of this and the manifest response's `Cache-Control` max-age
(`no-cache` and `no-store` mean 0). Default 300000. See "Manifest freshness".

<a id="maxresponsebytes"></a>

##### maxResponseBytes?

```ts
optional maxResponseBytes?: number;
```

Largest response body the client reads, in bytes. A larger `Content-Length` is refused
before reading; a body without one is read up to the limit, then cancelled. Default 4194304
(4 MiB).

<a id="maxretryafterms"></a>

##### maxRetryAfterMs?

```ts
optional maxRetryAfterMs?: number;
```

Longest `Retry-After` the client will honor automatically, in ms. Default 30000.

<a id="retries"></a>

##### retries?

```ts
optional retries?: number;
```

Retries after `rate_limited`/`unavailable`. Default 1.

<a id="sessionid"></a>

##### sessionId?

```ts
optional sessionId?: string;
```

<a id="timeoutms"></a>

##### timeoutMs?

```ts
optional timeoutMs?: number;
```

Abort one request after this many milliseconds, redirects and reading the body included.
Default 30000. Each retry and each poll is a new request with its own timeout.

<a id="timezone"></a>

##### timezone?

```ts
optional timezone?: string;
```

<a id="trust"></a>

##### trust?

```ts
optional trust?: TrustOptions;
```

Which destinations the client may contact and which receive credentials. See `TrustOptions`.

***

<a id="confirmrequest"></a>

### ConfirmRequest

Passed to `confirm` before a sensitive payload is sent.

#### Properties

<a id="accept-1"></a>

##### accept

```ts
accept: Accept;
```

<a id="action-1"></a>

##### action

```ts
action: string;
```

<a id="message-2"></a>

##### message

```ts
message: string;
```

<a id="payload"></a>

##### payload

```ts
payload: JsonValue;
```

The payload the fulfiller produced. Show the user a summary, never log it.

***

<a id="destinationdecision"></a>

### DestinationDecision

The built-in part of the destination check for one URL.

#### Properties

<a id="allowed-1"></a>

##### allowed

```ts
allowed: boolean;
```

<a id="credentialed"></a>

##### credentialed

```ts
credentialed: boolean;
```

Whether `auth` and `headers` would be sent.

<a id="reason"></a>

##### reason?

```ts
optional reason?: string;
```

***

<a id="destinationrequest"></a>

### DestinationRequest

What `trust.destinationPolicy` receives for every outbound request, redirects included.

#### Properties

<a id="credentialed-1"></a>

##### credentialed

```ts
credentialed: boolean;
```

Whether the client will attach `auth` and `headers` to this request.

<a id="kind-2"></a>

##### kind

```ts
kind: DestinationKind;
```

<a id="redirectedfrom"></a>

##### redirectedFrom?

```ts
optional redirectedFrom?: string;
```

Set when this request follows a redirect: the URL that redirected.

<a id="url-1"></a>

##### url

```ts
url: string;
```

***

<a id="discoveroptions"></a>

### DiscoverOptions

#### Properties

<a id="fetch-1"></a>

##### fetch?

```ts
optional fetch?: FetchLike;
```

<a id="headers-1"></a>

##### headers?

```ts
optional headers?: Record<string, string>;
```

Sent only to the discovery origin and `trust.origins`, like `ClientOptions.headers`.

<a id="maxresponsebytes-1"></a>

##### maxResponseBytes?

```ts
optional maxResponseBytes?: number;
```

Like `ClientOptions.maxResponseBytes`. Default 4194304.

<a id="signal"></a>

##### signal?

```ts
optional signal?: AbortSignal;
```

Abort discovery: every request it makes.

<a id="timeoutms-1"></a>

##### timeoutMs?

```ts
optional timeoutMs?: number;
```

Per request, like `ClientOptions.timeoutMs`. Default 30000.

<a id="trust-1"></a>

##### trust?

```ts
optional trust?: TrustOptions;
```

Which origins discovery may follow a header or link hint to. See `TrustOptions`.

***

<a id="errorresult"></a>

### ErrorResult

#### Properties

<a id="error"></a>

##### error

```ts
error: ErrorBody;
```

<a id="rev"></a>

##### rev?

```ts
optional rev?: Revision;
```

The site's current revision, when it has one. On a stale `conflict` it equals `details.currentRev`.

<a id="status"></a>

##### status

```ts
status: "error";
```

***

<a id="fulfiller"></a>

### Fulfiller

Provides payloads for one or more kinds: a wallet for `payment.*`, a credential
store for `identity.*`, a profile for `contact.*`. Return `undefined` when this
fulfiller cannot satisfy the request; the client moves to the next option.

#### Properties

<a id="kinds"></a>

##### kinds

```ts
kinds: readonly string[];
```

#### Methods

<a id="fulfill"></a>

##### fulfill()

```ts
fulfill(request): MaybePromise<JsonValue | undefined>;
```

###### Parameters

###### request

[`FulfillRequest`](#fulfillrequest)

###### Returns

`MaybePromise`\<[`JsonValue`](#jsonvalue) \| `undefined`\>

***

<a id="fulfillrequest"></a>

### FulfillRequest

What a fulfiller receives for one `accepts[]` entry.

#### Properties

<a id="accept-2"></a>

##### accept

```ts
accept: Accept;
```

<a id="accepts"></a>

##### accepts

```ts
accepts: Accept[];
```

Every alternative the site offered, so a fulfiller can prefer one.

<a id="action-2"></a>

##### action

```ts
action: string;
```

<a id="message-3"></a>

##### message

```ts
message: string;
```

<a id="reason-1"></a>

##### reason

```ts
reason: string;
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

<a id="reason-2"></a>

##### reason

```ts
reason: string;
```

<a id="resumetoken"></a>

##### resumeToken

```ts
resumeToken: string;
```

<a id="url-2"></a>

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

<a id="invokeoptions"></a>

### InvokeOptions

#### Extended by

- [`RunOptions`](#runoptions)

#### Properties

<a id="context"></a>

##### context?

```ts
optional context?: Partial<RequestContext>;
```

<a id="expectedrev"></a>

##### expectedRev?

```ts
optional expectedRev?: Revision;
```

The revision you observed (from `state()`, `manifest().live.rev`, or a previous result's
`rev`). A site with live state refuses the call with `conflict` when it moved, applying nothing.

<a id="idempotencykey"></a>

##### idempotencyKey?

```ts
optional idempotencyKey?: string;
```

<a id="signal-1"></a>

##### signal?

```ts
optional signal?: AbortSignal;
```

***

<a id="live-1"></a>

### Live

`manifest.live`: where live state is served, and the revision when the manifest was rendered.

#### Properties

<a id="rev-1"></a>

##### rev?

```ts
optional rev?: Revision;
```

The revision at manifest render time. Manifests are cached; prefer `url`.

<a id="url-3"></a>

##### url?

```ts
optional url?: string;
```

Absolute URL of the state endpoint (`/axe/state`), served with `Cache-Control: no-store`.

***

<a id="livestate"></a>

### LiveState

The document at `/axe/state`.

#### Properties

<a id="actions"></a>

##### actions

```ts
actions: Record<string, Availability>;
```

Every action in the manifest; one that declares no availability is `{ available: true }`.

<a id="rev-2"></a>

##### rev?

```ts
optional rev?: Revision;
```

***

<a id="manifest-1"></a>

### Manifest

#### Properties

<a id="actions-1"></a>

##### actions

```ts
actions: ActionDefinition[];
```

<a id="auth-2"></a>

##### auth

```ts
auth: ManifestAuth;
```

<a id="baseurl"></a>

##### baseUrl

```ts
baseUrl: string;
```

<a id="brand"></a>

##### brand?

```ts
optional brand?: Brand;
```

<a id="contact"></a>

##### contact?

```ts
optional contact?: Contact;
```

<a id="description-2"></a>

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

<a id="live-2"></a>

##### live?

```ts
optional live?: Live;
```

The site publishes live state: a revision and per-action availability. See spec §21.

<a id="name-3"></a>

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

<a id="updatedat"></a>

##### updatedAt?

```ts
optional updatedAt?: string;
```

***

<a id="manifestchange"></a>

### ManifestChange

What `refresh()` found: the action names added, removed, and whose definition changed.

#### Properties

<a id="added"></a>

##### added

```ts
added: string[];
```

<a id="changed"></a>

##### changed

```ts
changed: boolean;
```

<a id="manifest-2"></a>

##### manifest

```ts
manifest: Manifest;
```

The manifest in use after the refresh.

<a id="modified"></a>

##### modified

```ts
modified: string[];
```

<a id="removed"></a>

##### removed

```ts
removed: string[];
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

<a id="rev-3"></a>

##### rev?

```ts
optional rev?: Revision;
```

<a id="status-1"></a>

##### status

```ts
status: "needs_human";
```

***

<a id="needsinputresult"></a>

### NeedsInputResult

#### Properties

<a id="accepts-1"></a>

##### accepts

```ts
accepts: Accept[];
```

<a id="continuationtoken"></a>

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

<a id="message-4"></a>

##### message

```ts
message: string;
```

<a id="reason-3"></a>

##### reason

```ts
reason: string;
```

<a id="rev-4"></a>

##### rev?

```ts
optional rev?: Revision;
```

<a id="status-2"></a>

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

<a id="output-1"></a>

##### output

```ts
output: O;
```

<a id="rev-5"></a>

##### rev?

```ts
optional rev?: Revision;
```

The revision the change produced, when the site has one.

<a id="status-3"></a>

##### status

```ts
status: "ok";
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

<a id="rev-6"></a>

##### rev?

```ts
optional rev?: Revision;
```

<a id="status-4"></a>

##### status

```ts
status: "pending";
```

***

<a id="polloptions"></a>

### PollOptions

#### Extended by

- [`RunOptions`](#runoptions)

#### Properties

<a id="maxpollattempts"></a>

##### maxPollAttempts?

```ts
optional maxPollAttempts?: number;
```

Stop after this many poll requests and return the last `pending`. Default 60; shared in `run()` like `maxWaitMs`.

<a id="maxwaitms"></a>

##### maxWaitMs?

```ts
optional maxWaitMs?: number;
```

Stop polling after this long and return the last `pending`. Default 60000. In `run()` the
budget is shared by every poll of the run, starting at its first poll.

<a id="onpending"></a>

##### onPending?

```ts
optional onPending?: (result) => void;
```

###### Parameters

###### result

[`PendingResult`](#pendingresult)

###### Returns

`void`

<a id="signal-2"></a>

##### signal?

```ts
optional signal?: AbortSignal;
```

***

<a id="runoptions"></a>

### RunOptions

#### Extends

- [`InvokeOptions`](#invokeoptions).[`PollOptions`](#polloptions)

#### Properties

<a id="context-1"></a>

##### context?

```ts
optional context?: Partial<RequestContext>;
```

###### Inherited from

[`InvokeOptions`](#invokeoptions).[`context`](#context)

<a id="expectedrev-1"></a>

##### expectedRev?

```ts
optional expectedRev?: Revision;
```

The revision you observed (from `state()`, `manifest().live.rev`, or a previous result's
`rev`). A site with live state refuses the call with `conflict` when it moved, applying nothing.

###### Inherited from

[`InvokeOptions`](#invokeoptions).[`expectedRev`](#expectedrev)

<a id="idempotencykey-1"></a>

##### idempotencyKey?

```ts
optional idempotencyKey?: string;
```

###### Inherited from

[`InvokeOptions`](#invokeoptions).[`idempotencyKey`](#idempotencykey)

<a id="maxpollattempts-1"></a>

##### maxPollAttempts?

```ts
optional maxPollAttempts?: number;
```

Stop after this many poll requests and return the last `pending`. Default 60; shared in `run()` like `maxWaitMs`.

###### Inherited from

[`PollOptions`](#polloptions).[`maxPollAttempts`](#maxpollattempts)

<a id="maxsteps"></a>

##### maxSteps?

```ts
optional maxSteps?: number;
```

Safety valve for requirement chains. Default 8.

<a id="maxwaitms-1"></a>

##### maxWaitMs?

```ts
optional maxWaitMs?: number;
```

Stop polling after this long and return the last `pending`. Default 60000. In `run()` the
budget is shared by every poll of the run, starting at its first poll.

###### Inherited from

[`PollOptions`](#polloptions).[`maxWaitMs`](#maxwaitms)

<a id="onpending-1"></a>

##### onPending?

```ts
optional onPending?: (result) => void;
```

###### Parameters

###### result

[`PendingResult`](#pendingresult)

###### Returns

`void`

###### Inherited from

[`PollOptions`](#polloptions).[`onPending`](#onpending)

<a id="pollpending"></a>

##### pollPending?

```ts
optional pollPending?: boolean;
```

Follow `pending` results by polling. Default true.

<a id="signal-3"></a>

##### signal?

```ts
optional signal?: AbortSignal;
```

###### Inherited from

[`InvokeOptions`](#invokeoptions).[`signal`](#signal-1)

***

<a id="trustoptions"></a>

### TrustOptions

Where the client may send requests and credentials. The anchor is the origin you discovered
from (`discover(url)`, `AXEClient.discover(url)`), or the `baseUrl` origin of a manifest you
hand to `new AXEClient` yourself. The credential audience is the anchor plus `origins`.

#### Properties

<a id="allowcrossorigin"></a>

##### allowCrossOrigin?

```ts
optional allowCrossOrigin?: boolean;
```

Contact other https origins named by the site (baseUrl, live.url, pollUrl, discovery hints),
without `auth` or `headers`. Loopback and private-range host names stay refused. Default false.

<a id="allowhttp"></a>

##### allowHttp?

```ts
optional allowHttp?: boolean | "localhost";
```

Plain http. `"localhost"` (default): only for `localhost`, `127.x.x.x`, and `[::1]` origins in
the credential audience. `false`: https everywhere. `true`: http anywhere (a private network
you control). An https-to-http redirect is refused whatever this says.

<a id="destinationpolicy"></a>

##### destinationPolicy?

```ts
optional destinationPolicy?: (request) => MaybePromise<boolean>;
```

Called for every outbound URL, redirects included, after the built-in checks pass. Return false
to refuse. Use it to bind the client to your own network policy. It sees URLs, not resolved
addresses: it does not stop DNS rebinding. See docs/security.md.

###### Parameters

###### request

[`DestinationRequest`](#destinationrequest)

###### Returns

`MaybePromise`\<`boolean`\>

<a id="origins"></a>

##### origins?

```ts
optional origins?: string[];
```

More origins (`https://api.example`; a path is ignored) that may be contacted with
credentials: a manifest `baseUrl`, `live.url`, `pollUrl`, or discovery hint on another origin.

## Type Aliases

<a id="availability-1"></a>

### Availability

```ts
type Availability = 
  | {
  available: true;
  handoff?: undefined;
  reason?: undefined;
  requires?: undefined;
}
  | {
  available: false;
  handoff?: HandoffSpec;
  reason: string;
  requires?: Accept[];
};
```

Whether an action can be done right now, and if not, why and what would change that.

#### Union Members

##### Type Literal

```ts
{
  available: true;
  handoff?: undefined;
  reason?: undefined;
  requires?: undefined;
}
```

***

##### Type Literal

```ts
{
  available: false;
  handoff?: HandoffSpec;
  reason: string;
  requires?: Accept[];
}
```

###### available

```ts
available: false;
```

###### handoff?

```ts
optional handoff?: HandoffSpec;
```

A step only a human can take.

###### reason

```ts
reason: string;
```

Plain language, in the site's words. Agent-read text.

###### requires?

```ts
optional requires?: Accept[];
```

`accepts`-shaped kinds that would make the action available.

***

<a id="destinationkind"></a>

### DestinationKind

```ts
type DestinationKind = "discovery" | "action" | "continue" | "resume" | "state" | "poll";
```

Which request a destination check is for.

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

<a id="revision"></a>

### Revision

```ts
type Revision = string | number;
```

A site's revision: an opaque string or number that moves with every change an agent could observe.

***

<a id="runoutcome"></a>

### RunOutcome

```ts
type RunOutcome<O> = 
  | {
  action: ActionDefinition;
  result: OkResult<O>;
  status: "ok";
}
  | {
  action: ActionDefinition;
  handoff: Handoff;
  result:   | NeedsHumanResult
     | NeedsInputResult;
  status: "needs_human";
}
  | {
  action: ActionDefinition;
  result: NeedsInputResult;
  status: "needs_input";
  tried: string[];
}
  | {
  action: ActionDefinition;
  result: PendingResult;
  status: "pending";
}
  | {
  action: ActionDefinition | undefined;
  result: ErrorResult;
  status: "error";
};
```

What `run()` settles to.

#### Type Parameters

##### O

`O` = [`JsonValue`](#jsonvalue)

## Functions

<a id="discover-1"></a>

### discover()

```ts
function discover(url, options?): Promise<{
  manifest: Manifest;
  manifestUrl: string;
  via: "well-known" | "alias" | "header" | "link";
}>;
```

Find a manifest starting from any URL: `/.well-known/axe.json`, `/axe/manifest`, the
`AXE-Manifest` response header, then a `<link rel="axe-manifest">` in the page. Returns
the manifest and where it was found. A hint or redirect to another origin is followed only
when `trust` authorizes it. The returned manifest remembers the discovery origin, so
`new AXEClient(manifest)` anchors its credentials there, not at the manifest's `baseUrl`.

#### Parameters

##### url

`string`

##### options?

[`DiscoverOptions`](#discoveroptions) = `{}`

#### Returns

`Promise`\<\{
  `manifest`: [`Manifest`](#manifest-1);
  `manifestUrl`: `string`;
  `via`: `"well-known"` \| `"alias"` \| `"header"` \| `"link"`;
\}\>

***

<a id="findlinkhref"></a>

### findLinkHref()

```ts
function findLinkHref(html): string | undefined;
```

Extract the href of `<link rel="axe-manifest">` from HTML without a parser.

#### Parameters

##### html

`string`

#### Returns

`string` \| `undefined`

***

<a id="iserror"></a>

### isError()

```ts
function isError<O>(r): r is ErrorResult;
```

#### Type Parameters

##### O

`O` = [`JsonValue`](#jsonvalue)

#### Parameters

##### r

[`Result`](#result)\<`O`\>

#### Returns

`r is ErrorResult`

***

<a id="isneedshuman"></a>

### isNeedsHuman()

```ts
function isNeedsHuman<O>(r): r is NeedsHumanResult;
```

#### Type Parameters

##### O

`O` = [`JsonValue`](#jsonvalue)

#### Parameters

##### r

[`Result`](#result)\<`O`\>

#### Returns

`r is NeedsHumanResult`

***

<a id="isneedsinput"></a>

### isNeedsInput()

```ts
function isNeedsInput<O>(r): r is NeedsInputResult;
```

#### Type Parameters

##### O

`O` = [`JsonValue`](#jsonvalue)

#### Parameters

##### r

[`Result`](#result)\<`O`\>

#### Returns

`r is NeedsInputResult`

***

<a id="isok"></a>

### isOk()

```ts
function isOk<O>(r): r is OkResult<O>;
```

#### Type Parameters

##### O

`O` = [`JsonValue`](#jsonvalue)

#### Parameters

##### r

[`Result`](#result)\<`O`\>

#### Returns

`r is OkResult<O>`

***

<a id="ispending"></a>

### isPending()

```ts
function isPending<O>(r): r is PendingResult;
```

#### Type Parameters

##### O

`O` = [`JsonValue`](#jsonvalue)

#### Parameters

##### r

[`Result`](#result)\<`O`\>

#### Returns

`r is PendingResult`
