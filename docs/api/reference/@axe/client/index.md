[AXE API reference](../../README.md) / [@axe/client](README.md) / index

# index

## Classes

### AXEClient

Defined in: [packages/client/src/index.ts:257](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L257)

#### Constructors

##### Constructor

```ts
new AXEClient(manifestDoc, options?): AXEClient;
```

Defined in: [packages/client/src/index.ts:261](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L261)

###### Parameters

###### manifestDoc

[`Manifest`](#manifest-1)

###### options?

[`ClientOptions`](#clientoptions) = `{}`

###### Returns

[`AXEClient`](#axeclient)

#### Methods

##### action()

```ts
action(name): ActionDefinition | undefined;
```

Defined in: [packages/client/src/index.ts:284](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L284)

One action's definition, or undefined.

###### Parameters

###### name

`string`

###### Returns

[`ActionDefinition`](#actiondefinition) \| `undefined`

##### allowed()

```ts
allowed(): boolean;
```

Defined in: [packages/client/src/index.ts:289](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L289)

Whether this client's vendor is allowed by `policies.agents`. Agents MUST check before calling.

###### Returns

`boolean`

##### continue()

```ts
continue<O>(
   continuationToken, 
   kind, 
   payload, 
   options?
): Promise<Result<O>>;
```

Defined in: [packages/client/src/index.ts:326](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L326)

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

##### invoke()

```ts
invoke<O>(
   name, 
   input, 
   options?
): Promise<Result<O>>;
```

Defined in: [packages/client/src/index.ts:299](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L299)

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

##### manifest()

```ts
manifest(): Manifest;
```

Defined in: [packages/client/src/index.ts:279](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L279)

The manifest this client was built from.

###### Returns

[`Manifest`](#manifest-1)

##### poll()

```ts
poll<O>(pendingResult, options?): Promise<Result<O>>;
```

Defined in: [packages/client/src/index.ts:352](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L352)

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

##### resume()

```ts
resume<O>(resumeToken, options?): Promise<Result<O>>;
```

Defined in: [packages/client/src/index.ts:340](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L340)

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

##### run()

```ts
run<O>(
   name, 
   input, 
   options?
): Promise<RunOutcome<O>>;
```

Defined in: [packages/client/src/index.ts:373](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L373)

Drive the whole escalation ladder: invoke, satisfy each `needs_input` from
registered fulfillers (confirming sensitive payloads), poll pending work, and
surface a handoff only when nothing else works.

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

##### discover()

```ts
static discover(url, options?): Promise<AXEClient>;
```

Defined in: [packages/client/src/index.ts:270](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L270)

Discover and construct in one step.

###### Parameters

###### url

`string`

###### options?

[`ClientOptions`](#clientoptions) = `{}`

###### Returns

`Promise`\<[`AXEClient`](#axeclient)\>

***

### AXEClientError

Defined in: [packages/client/src/index.ts:148](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L148)

Thrown for transport-level failures (network, non-JSON body). Protocol errors are returned as `error` results.

#### Extends

- `Error`

#### Constructors

##### Constructor

```ts
new AXEClientError(message, cause?): AXEClientError;
```

Defined in: [packages/client/src/index.ts:150](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L150)

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

##### cause

```ts
readonly cause: unknown;
```

Defined in: [packages/client/src/index.ts:149](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L149)

###### Overrides

```ts
Error.cause
```

##### message

```ts
message: string;
```

Defined in: node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es5.d.ts:1077

###### Inherited from

```ts
Error.message
```

##### name

```ts
name: string;
```

Defined in: node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es5.d.ts:1076

###### Inherited from

```ts
Error.name
```

##### stack?

```ts
optional stack?: string;
```

Defined in: node\_modules/.pnpm/typescript@5.9.3/node\_modules/typescript/lib/lib.es5.d.ts:1078

###### Inherited from

```ts
Error.stack
```

##### stackTraceLimit

```ts
static stackTraceLimit: number;
```

Defined in: node\_modules/.pnpm/@types+node@20.19.43/node\_modules/@types/node/globals.d.ts:68

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

##### captureStackTrace()

```ts
static captureStackTrace(targetObject, constructorOpt?): void;
```

Defined in: node\_modules/.pnpm/@types+node@20.19.43/node\_modules/@types/node/globals.d.ts:52

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

##### prepareStackTrace()

```ts
static prepareStackTrace(err, stackTraces): any;
```

Defined in: node\_modules/.pnpm/@types+node@20.19.43/node\_modules/@types/node/globals.d.ts:56

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

## Interfaces

### Accept

Defined in: packages/core/dist/types.d.ts:199

#### Properties

##### description

```ts
description: string;
```

Defined in: packages/core/dist/types.d.ts:202

##### instructions?

```ts
optional instructions?: string;
```

Defined in: packages/core/dist/types.d.ts:205

##### kind

```ts
kind: string;
```

Defined in: packages/core/dist/types.d.ts:200

##### schema

```ts
schema: JsonSchema;
```

Defined in: packages/core/dist/types.d.ts:203

##### sensitive

```ts
sensitive: boolean;
```

Defined in: packages/core/dist/types.d.ts:204

##### title

```ts
title: string;
```

Defined in: packages/core/dist/types.d.ts:201

***

### ActionDefinition

Defined in: packages/core/dist/types.d.ts:152

An action as it appears in the manifest.

#### Properties

##### affordances?

```ts
optional affordances?: Affordance[];
```

Defined in: packages/core/dist/types.d.ts:165

##### auth

```ts
auth: WireAuthMode;
```

Defined in: packages/core/dist/types.d.ts:162

##### deprecated?

```ts
optional deprecated?: Deprecation;
```

Defined in: packages/core/dist/types.d.ts:171

##### description

```ts
description: string;
```

Defined in: packages/core/dist/types.d.ts:155

##### display?

```ts
optional display?: Display;
```

Defined in: packages/core/dist/types.d.ts:164

##### examples?

```ts
optional examples?: ActionExample[];
```

Defined in: packages/core/dist/types.d.ts:163

##### freshness?

```ts
optional freshness?: Freshness;
```

Defined in: packages/core/dist/types.d.ts:167

##### humanHandoff?

```ts
optional humanHandoff?: object;
```

Defined in: packages/core/dist/types.d.ts:168

###### reasons

```ts
reasons: string[];
```

##### idempotent

```ts
idempotent: boolean;
```

Defined in: packages/core/dist/types.d.ts:159

##### input

```ts
input: JsonSchema;
```

Defined in: packages/core/dist/types.d.ts:156

##### name

```ts
name: string;
```

Defined in: packages/core/dist/types.d.ts:153

##### output

```ts
output: JsonSchema;
```

Defined in: packages/core/dist/types.d.ts:157

##### pagination?

```ts
optional pagination?: Pagination;
```

Defined in: packages/core/dist/types.d.ts:166

##### readOnly

```ts
readOnly: boolean;
```

Defined in: packages/core/dist/types.d.ts:158

##### reversible

```ts
reversible: boolean;
```

Defined in: packages/core/dist/types.d.ts:160

##### risk

```ts
risk: WireRisk;
```

Defined in: packages/core/dist/types.d.ts:161

##### title

```ts
title: string;
```

Defined in: packages/core/dist/types.d.ts:154

***

### ClientOptions

Defined in: [packages/client/src/index.ts:94](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L94)

#### Properties

##### agent?

```ts
optional agent?: AgentIdentification;
```

Defined in: [packages/client/src/index.ts:101](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L101)

Sent as `context.agent` and as the `User-Agent` when possible.

##### auth?

```ts
optional auth?: string | (() => MaybePromise<string | undefined>);
```

Defined in: [packages/client/src/index.ts:99](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L99)

Bearer token, or a function returning one, sent in `Authorization`.

##### confirm?

```ts
optional confirm?: (request) => MaybePromise<boolean>;
```

Defined in: [packages/client/src/index.ts:107](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L107)

Called before any `sensitive` payload is sent. Without it, sensitive options are skipped.

###### Parameters

###### request

[`ConfirmRequest`](#confirmrequest)

###### Returns

`MaybePromise`\<`boolean`\>

##### fetch?

```ts
optional fetch?: FetchLike;
```

Defined in: [packages/client/src/index.ts:95](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L95)

##### fulfillers?

```ts
optional fulfillers?: Fulfiller[];
```

Defined in: [packages/client/src/index.ts:105](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L105)

##### headers?

```ts
optional headers?: Record<string, string>;
```

Defined in: [packages/client/src/index.ts:97](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L97)

Extra headers on every request.

##### locale?

```ts
optional locale?: string;
```

Defined in: [packages/client/src/index.ts:102](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L102)

##### maxRetryAfterMs?

```ts
optional maxRetryAfterMs?: number;
```

Defined in: [packages/client/src/index.ts:109](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L109)

Longest `Retry-After` the client will honor automatically, in ms. Default 30000.

##### retries?

```ts
optional retries?: number;
```

Defined in: [packages/client/src/index.ts:111](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L111)

Retries after `rate_limited`/`unavailable`. Default 1.

##### sessionId?

```ts
optional sessionId?: string;
```

Defined in: [packages/client/src/index.ts:104](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L104)

##### timezone?

```ts
optional timezone?: string;
```

Defined in: [packages/client/src/index.ts:103](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L103)

***

### ConfirmRequest

Defined in: [packages/client/src/index.ts:86](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L86)

Passed to `confirm` before a sensitive payload is sent.

#### Properties

##### accept

```ts
accept: Accept;
```

Defined in: [packages/client/src/index.ts:88](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L88)

##### action

```ts
action: string;
```

Defined in: [packages/client/src/index.ts:87](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L87)

##### message

```ts
message: string;
```

Defined in: [packages/client/src/index.ts:91](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L91)

##### payload

```ts
payload: JsonValue;
```

Defined in: [packages/client/src/index.ts:90](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L90)

The payload the fulfiller produced. Show the user a summary, never log it.

***

### DiscoverOptions

Defined in: [packages/client/src/index.ts:161](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L161)

#### Properties

##### fetch?

```ts
optional fetch?: FetchLike;
```

Defined in: [packages/client/src/index.ts:162](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L162)

##### headers?

```ts
optional headers?: Record<string, string>;
```

Defined in: [packages/client/src/index.ts:163](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L163)

***

### ErrorResult

Defined in: packages/core/dist/types.d.ts:251

#### Properties

##### error

```ts
error: ErrorBody;
```

Defined in: packages/core/dist/types.d.ts:253

##### status

```ts
status: "error";
```

Defined in: packages/core/dist/types.d.ts:252

***

### Fulfiller

Defined in: [packages/client/src/index.ts:80](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L80)

Provides payloads for one or more kinds: a wallet for `payment.*`, a credential
store for `identity.*`, a profile for `contact.*`. Return `undefined` when this
fulfiller cannot satisfy the request; the client moves to the next option.

#### Properties

##### kinds

```ts
kinds: readonly string[];
```

Defined in: [packages/client/src/index.ts:81](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L81)

#### Methods

##### fulfill()

```ts
fulfill(request): MaybePromise<JsonValue | undefined>;
```

Defined in: [packages/client/src/index.ts:82](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L82)

###### Parameters

###### request

[`FulfillRequest`](#fulfillrequest)

###### Returns

`MaybePromise`\<[`JsonValue`](#jsonvalue) \| `undefined`\>

***

### FulfillRequest

Defined in: [packages/client/src/index.ts:66](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L66)

What a fulfiller receives for one `accepts[]` entry.

#### Properties

##### accept

```ts
accept: Accept;
```

Defined in: [packages/client/src/index.ts:70](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L70)

##### accepts

```ts
accepts: Accept[];
```

Defined in: [packages/client/src/index.ts:72](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L72)

Every alternative the site offered, so a fulfiller can prefer one.

##### action

```ts
action: string;
```

Defined in: [packages/client/src/index.ts:67](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L67)

##### message

```ts
message: string;
```

Defined in: [packages/client/src/index.ts:69](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L69)

##### reason

```ts
reason: string;
```

Defined in: [packages/client/src/index.ts:68](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L68)

***

### Handoff

Defined in: packages/core/dist/types.d.ts:207

#### Properties

##### expiresAt

```ts
expiresAt: string;
```

Defined in: packages/core/dist/types.d.ts:212

##### instructions

```ts
instructions: string;
```

Defined in: packages/core/dist/types.d.ts:209

##### reason

```ts
reason: string;
```

Defined in: packages/core/dist/types.d.ts:208

##### resumeToken

```ts
resumeToken: string;
```

Defined in: packages/core/dist/types.d.ts:211

##### url

```ts
url: string;
```

Defined in: packages/core/dist/types.d.ts:210

##### whatAgentShouldSayToUser

```ts
whatAgentShouldSayToUser: string;
```

Defined in: packages/core/dist/types.d.ts:213

***

### InvokeOptions

Defined in: [packages/client/src/index.ts:114](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L114)

#### Extended by

- [`RunOptions`](#runoptions)

#### Properties

##### context?

```ts
optional context?: Partial<RequestContext>;
```

Defined in: [packages/client/src/index.ts:116](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L116)

##### idempotencyKey?

```ts
optional idempotencyKey?: string;
```

Defined in: [packages/client/src/index.ts:115](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L115)

##### signal?

```ts
optional signal?: AbortSignal;
```

Defined in: [packages/client/src/index.ts:117](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L117)

***

### Manifest

Defined in: packages/core/dist/types.d.ts:68

#### Properties

##### actions

```ts
actions: ActionDefinition[];
```

Defined in: packages/core/dist/types.d.ts:75

##### auth

```ts
auth: ManifestAuth;
```

Defined in: packages/core/dist/types.d.ts:74

##### baseUrl

```ts
baseUrl: string;
```

Defined in: packages/core/dist/types.d.ts:72

##### brand?

```ts
optional brand?: Brand;
```

Defined in: packages/core/dist/types.d.ts:79

##### contact?

```ts
optional contact?: Contact;
```

Defined in: packages/core/dist/types.d.ts:78

##### description

```ts
description: string;
```

Defined in: packages/core/dist/types.d.ts:71

##### flows?

```ts
optional flows?: Flow[];
```

Defined in: packages/core/dist/types.d.ts:76

##### humanFallbackUrl?

```ts
optional humanFallbackUrl?: string;
```

Defined in: packages/core/dist/types.d.ts:73

##### indexUrl?

```ts
optional indexUrl?: string;
```

Defined in: packages/core/dist/types.d.ts:80

##### name

```ts
name: string;
```

Defined in: packages/core/dist/types.d.ts:70

##### policies?

```ts
optional policies?: Policies;
```

Defined in: packages/core/dist/types.d.ts:77

##### protocol

```ts
protocol: string;
```

Defined in: packages/core/dist/types.d.ts:69

##### updatedAt?

```ts
optional updatedAt?: string;
```

Defined in: packages/core/dist/types.d.ts:81

***

### NeedsHumanResult

Defined in: packages/core/dist/types.d.ts:241

#### Properties

##### handoff

```ts
handoff: Handoff;
```

Defined in: packages/core/dist/types.d.ts:243

##### status

```ts
status: "needs_human";
```

Defined in: packages/core/dist/types.d.ts:242

***

### NeedsInputResult

Defined in: packages/core/dist/types.d.ts:232

#### Properties

##### accepts

```ts
accepts: Accept[];
```

Defined in: packages/core/dist/types.d.ts:236

##### continuationToken

```ts
continuationToken: string;
```

Defined in: packages/core/dist/types.d.ts:237

##### expiresAt

```ts
expiresAt: string;
```

Defined in: packages/core/dist/types.d.ts:238

##### fallback?

```ts
optional fallback?: Handoff;
```

Defined in: packages/core/dist/types.d.ts:239

##### message

```ts
message: string;
```

Defined in: packages/core/dist/types.d.ts:235

##### reason

```ts
reason: string;
```

Defined in: packages/core/dist/types.d.ts:234

##### status

```ts
status: "needs_input";
```

Defined in: packages/core/dist/types.d.ts:233

***

### OkResult

Defined in: packages/core/dist/types.d.ts:228

#### Type Parameters

##### O

`O` = [`JsonValue`](#jsonvalue)

#### Properties

##### output

```ts
output: O;
```

Defined in: packages/core/dist/types.d.ts:230

##### status

```ts
status: "ok";
```

Defined in: packages/core/dist/types.d.ts:229

***

### PendingResult

Defined in: packages/core/dist/types.d.ts:245

#### Properties

##### expiresAt?

```ts
optional expiresAt?: string;
```

Defined in: packages/core/dist/types.d.ts:249

##### pollUrl

```ts
pollUrl: string;
```

Defined in: packages/core/dist/types.d.ts:247

##### retryAfter

```ts
retryAfter: number;
```

Defined in: packages/core/dist/types.d.ts:248

##### status

```ts
status: "pending";
```

Defined in: packages/core/dist/types.d.ts:246

***

### PollOptions

Defined in: [packages/client/src/index.ts:120](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L120)

#### Extended by

- [`RunOptions`](#runoptions)

#### Properties

##### maxWaitMs?

```ts
optional maxWaitMs?: number;
```

Defined in: [packages/client/src/index.ts:122](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L122)

Give up after this long. Default 60000.

##### onPending?

```ts
optional onPending?: (result) => void;
```

Defined in: [packages/client/src/index.ts:124](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L124)

###### Parameters

###### result

[`PendingResult`](#pendingresult)

###### Returns

`void`

##### signal?

```ts
optional signal?: AbortSignal;
```

Defined in: [packages/client/src/index.ts:123](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L123)

***

### RunOptions

Defined in: [packages/client/src/index.ts:127](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L127)

#### Extends

- [`InvokeOptions`](#invokeoptions).[`PollOptions`](#polloptions)

#### Properties

##### context?

```ts
optional context?: Partial<RequestContext>;
```

Defined in: [packages/client/src/index.ts:116](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L116)

###### Inherited from

[`InvokeOptions`](#invokeoptions).[`context`](#context)

##### idempotencyKey?

```ts
optional idempotencyKey?: string;
```

Defined in: [packages/client/src/index.ts:115](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L115)

###### Inherited from

[`InvokeOptions`](#invokeoptions).[`idempotencyKey`](#idempotencykey)

##### maxSteps?

```ts
optional maxSteps?: number;
```

Defined in: [packages/client/src/index.ts:131](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L131)

Safety valve for requirement chains. Default 8.

##### maxWaitMs?

```ts
optional maxWaitMs?: number;
```

Defined in: [packages/client/src/index.ts:122](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L122)

Give up after this long. Default 60000.

###### Inherited from

[`PollOptions`](#polloptions).[`maxWaitMs`](#maxwaitms)

##### onPending?

```ts
optional onPending?: (result) => void;
```

Defined in: [packages/client/src/index.ts:124](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L124)

###### Parameters

###### result

[`PendingResult`](#pendingresult)

###### Returns

`void`

###### Inherited from

[`PollOptions`](#polloptions).[`onPending`](#onpending)

##### pollPending?

```ts
optional pollPending?: boolean;
```

Defined in: [packages/client/src/index.ts:129](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L129)

Follow `pending` results by polling. Default true.

##### signal?

```ts
optional signal?: AbortSignal;
```

Defined in: [packages/client/src/index.ts:117](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L117)

###### Inherited from

[`InvokeOptions`](#invokeoptions).[`signal`](#signal)

## Type Aliases

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

Defined in: packages/core/dist/types.d.ts:11

A JSON value.

***

### Result

```ts
type Result<O> = 
  | OkResult<O>
  | NeedsInputResult
  | NeedsHumanResult
  | PendingResult
  | ErrorResult;
```

Defined in: packages/core/dist/types.d.ts:256

The result envelope: every AXE response body is one of these.

#### Type Parameters

##### O

`O` = [`JsonValue`](#jsonvalue)

***

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

Defined in: [packages/client/src/index.ts:135](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L135)

What `run()` settles to.

#### Type Parameters

##### O

`O` = [`JsonValue`](#jsonvalue)

## Variables

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

Defined in: packages/core/dist/vocabulary.d.ts:789

Every wire-level name in the AXE protocol, grouped by category.
Use these constants instead of string literals for paths, headers, statuses,
error codes, ladder values, kinds, MCP tool names, and CLI command names.

## Functions

### discover()

```ts
function discover(url, options?): Promise<{
  manifest: Manifest;
  manifestUrl: string;
  via: "well-known" | "alias" | "header" | "link";
}>;
```

Defined in: [packages/client/src/index.ts:171](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L171)

Find a manifest starting from any URL: `/.well-known/axe.json`, `/axe/manifest`, the
`AXE-Manifest` response header, then a `<link rel="axe-manifest">` in the page. Returns
the manifest and where it was found.

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

### findLinkHref()

```ts
function findLinkHref(html): string | undefined;
```

Defined in: [packages/client/src/index.ts:238](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L238)

Extract the href of `<link rel="axe-manifest">` from HTML without a parser.

#### Parameters

##### html

`string`

#### Returns

`string` \| `undefined`

***

### isError()

```ts
function isError<O>(r): r is ErrorResult;
```

Defined in: [packages/client/src/index.ts:57](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L57)

#### Type Parameters

##### O

`O` = [`JsonValue`](#jsonvalue)

#### Parameters

##### r

[`Result`](#result)\<`O`\>

#### Returns

`r is ErrorResult`

***

### isNeedsHuman()

```ts
function isNeedsHuman<O>(r): r is NeedsHumanResult;
```

Defined in: [packages/client/src/index.ts:51](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L51)

#### Type Parameters

##### O

`O` = [`JsonValue`](#jsonvalue)

#### Parameters

##### r

[`Result`](#result)\<`O`\>

#### Returns

`r is NeedsHumanResult`

***

### isNeedsInput()

```ts
function isNeedsInput<O>(r): r is NeedsInputResult;
```

Defined in: [packages/client/src/index.ts:48](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L48)

#### Type Parameters

##### O

`O` = [`JsonValue`](#jsonvalue)

#### Parameters

##### r

[`Result`](#result)\<`O`\>

#### Returns

`r is NeedsInputResult`

***

### isOk()

```ts
function isOk<O>(r): r is OkResult<O>;
```

Defined in: [packages/client/src/index.ts:45](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L45)

#### Type Parameters

##### O

`O` = [`JsonValue`](#jsonvalue)

#### Parameters

##### r

[`Result`](#result)\<`O`\>

#### Returns

`r is OkResult<O>`

***

### isPending()

```ts
function isPending<O>(r): r is PendingResult;
```

Defined in: [packages/client/src/index.ts:54](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/client/src/index.ts#L54)

#### Type Parameters

##### O

`O` = [`JsonValue`](#jsonvalue)

#### Parameters

##### r

[`Result`](#result)\<`O`\>

#### Returns

`r is PendingResult`
