[AXE API reference](../README.md) / @summationai/axe-generate

# @summationai/axe-generate

## Interfaces

<a id="actionoverride"></a>

### ActionOverride

Per-action changes applied after the source has spoken and before the lints run.

#### Properties

<a id="affordances"></a>

##### affordances?

```ts
optional affordances?: Affordance[];
```

<a id="auth"></a>

##### auth?

```ts
optional auth?: WireAuthMode;
```

<a id="deprecated"></a>

##### deprecated?

```ts
optional deprecated?: Deprecation;
```

<a id="description"></a>

##### description?

```ts
optional description?: string;
```

<a id="display"></a>

##### display?

```ts
optional display?: Display;
```

<a id="examples"></a>

##### examples?

```ts
optional examples?: object[];
```

###### input

```ts
input: unknown;
```

###### output

```ts
output: unknown;
```

<a id="exclude"></a>

##### exclude?

```ts
optional exclude?: boolean;
```

Leave the action out.

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

##### idempotent?

```ts
optional idempotent?: boolean;
```

<a id="name"></a>

##### name?

```ts
optional name?: string;
```

Rename the action (the new name must follow the AXE grammar).

<a id="pagination"></a>

##### pagination?

```ts
optional pagination?: Pagination;
```

<a id="readonly"></a>

##### readOnly?

```ts
optional readOnly?: boolean;
```

<a id="reversible"></a>

##### reversible?

```ts
optional reversible?: boolean;
```

<a id="risk"></a>

##### risk?

```ts
optional risk?: WireRisk;
```

<a id="title"></a>

##### title?

```ts
optional title?: string;
```

***

<a id="actionsource"></a>

### ActionSource

Something that yields action candidates. `fromOpenAPI` and `fromFunctions` implement it.

#### Properties

<a id="source"></a>

##### source

```ts
readonly source: string;
```

The source kind, used in `provenance.source`.

#### Methods

<a id="actions"></a>

##### actions()

```ts
actions(): SourceOutput;
```

###### Returns

[`SourceOutput`](#sourceoutput)

***

<a id="functionentry"></a>

### FunctionEntry

One entry of a function table. `input` must be a `z.object()`; `output` defaults to an open object.

#### Extends

- `Partial`\<`SpecExtras`\>

#### Type Parameters

##### I

`I` *extends* `z.ZodObject` = `z.ZodObject`

##### O

`O` *extends* `z.ZodType` = `z.ZodType`

#### Properties

<a id="affordances-1"></a>

##### affordances?

```ts
optional affordances?: Affordance[];
```

###### Inherited from

```ts
Partial.affordances
```

<a id="auth-1"></a>

##### auth?

```ts
optional auth?: WireAuthMode;
```

<a id="deprecated-1"></a>

##### deprecated?

```ts
optional deprecated?: Deprecation;
```

###### Inherited from

```ts
Partial.deprecated
```

<a id="description-1"></a>

##### description?

```ts
optional description?: string;
```

Required for the action to be generated; the generator never writes one.

<a id="display-1"></a>

##### display?

```ts
optional display?: Display;
```

###### Inherited from

```ts
Partial.display
```

<a id="examples-1"></a>

##### examples?

```ts
optional examples?: object[];
```

###### input

```ts
input: input<I>;
```

###### output

```ts
output: input<O>;
```

<a id="freshness-1"></a>

##### freshness?

```ts
optional freshness?: Freshness;
```

###### Inherited from

```ts
Partial.freshness
```

<a id="handler"></a>

##### handler

```ts
handler: (input, ctx) => MaybePromise<HandlerReturn<input<O>>>;
```

`(input, ctx)`: the function you already have, with the AXE context second when it wants it.

###### Parameters

###### input

`output`\<`I`\>

###### ctx

`HandlerContext`\<`output`\<`I`\>\>

###### Returns

`MaybePromise`\<`HandlerReturn`\<`input`\<`O`\>\>\>

<a id="humanhandoff-1"></a>

##### humanHandoff?

```ts
optional humanHandoff?: object;
```

###### reasons

```ts
reasons: string[];
```

###### Inherited from

```ts
Partial.humanHandoff
```

<a id="idempotent-1"></a>

##### idempotent?

```ts
optional idempotent?: boolean;
```

<a id="input"></a>

##### input

```ts
input: I;
```

<a id="oncontinue"></a>

##### onContinue?

```ts
optional onContinue?: (ctx) => unknown;
```

###### Parameters

###### ctx

`ContinueContext`\<[`JsonValue`](axe-client/index.md#jsonvalue)\>

###### Returns

`unknown`

###### Inherited from

```ts
Partial.onContinue
```

<a id="onpoll"></a>

##### onPoll?

```ts
optional onPoll?: (ctx) => unknown;
```

###### Parameters

###### ctx

`PollContext`\<[`JsonValue`](axe-client/index.md#jsonvalue)\>

###### Returns

`unknown`

###### Inherited from

```ts
Partial.onPoll
```

<a id="onresume"></a>

##### onResume?

```ts
optional onResume?: (ctx) => unknown;
```

###### Parameters

###### ctx

`ResumeContext`\<[`JsonValue`](axe-client/index.md#jsonvalue)\>

###### Returns

`unknown`

###### Inherited from

```ts
Partial.onResume
```

<a id="output"></a>

##### output?

```ts
optional output?: O;
```

<a id="pagination-1"></a>

##### pagination?

```ts
optional pagination?: Pagination;
```

###### Inherited from

```ts
Partial.pagination
```

<a id="readonly-1"></a>

##### readOnly?

```ts
optional readOnly?: boolean;
```

<a id="reversible-1"></a>

##### reversible?

```ts
optional reversible?: boolean;
```

<a id="risk-1"></a>

##### risk?

```ts
optional risk?: WireRisk;
```

Required for mutations unless `policy.defaultRisk` supplies one. Reads default to `low`.

<a id="title-1"></a>

##### title?

```ts
optional title?: string;
```

***

<a id="functionsoptions"></a>

### FunctionsOptions

#### Properties

<a id="source-1"></a>

##### source?

```ts
optional source?: string;
```

`provenance.source` for these actions. Default `functions`.

***

<a id="generatedaction"></a>

### GeneratedAction

#### Properties

<a id="name-1"></a>

##### name

```ts
name: string;
```

The action name, already in the AXE grammar when the source could manage it.

<a id="provenance"></a>

##### provenance

```ts
provenance: Provenance;
```

<a id="spec"></a>

##### spec

```ts
spec: GeneratedSpec;
```

<a id="warnings"></a>

##### warnings?

```ts
optional warnings?: GenerateWarning[];
```

Things the source noticed while deriving this action (a schema it could not convert, a derived name).

***

<a id="generateoptions"></a>

### GenerateOptions

#### Properties

<a id="overrides"></a>

##### overrides?

```ts
optional overrides?: Record<string, ActionOverride>;
```

Keyed by action name or by source reference (`GET /orders/{id}`).

<a id="policy"></a>

##### policy?

```ts
optional policy?: GeneratePolicy;
```

***

<a id="generatepolicy"></a>

### GeneratePolicy

#### Properties

<a id="defaultrisk"></a>

##### defaultRisk?

```ts
optional defaultRisk?: WireRisk | ((action) => WireRisk | undefined);
```

Risk for candidates whose source did not decide (`fromFunctions` entries without `risk`).
A function returns `undefined` to decline; the candidate is then left out.

<a id="exclude-1"></a>

##### exclude?

```ts
optional exclude?: NamePattern[];
```

Leave out actions whose name or source reference matches.

<a id="include"></a>

##### include?

```ts
optional include?: NamePattern[];
```

When set, keep only actions whose name or source reference matches.

<a id="maxrisk"></a>

##### maxRisk?

```ts
optional maxRisk?: WireRisk;
```

Leave out actions above this risk. Useful for a first rollout that exposes reads only.

<a id="requireinputdescriptions"></a>

##### requireInputDescriptions?

```ts
optional requireInputDescriptions?: boolean;
```

Leave out actions whose input fields lack descriptions, instead of reporting a lint warning. Default false.

***

<a id="generateresult"></a>

### GenerateResult

#### Properties

<a id="actions-1"></a>

##### actions

```ts
actions: RegisteredAction<ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>, ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>, JsonValue>[];
```

Ready for `axe.register()`.

<a id="provenance-1"></a>

##### provenance

```ts
provenance: Record<string, Provenance>;
```

Action name → where it came from.

<a id="warnings-1"></a>

##### warnings

```ts
warnings: GenerateWarning[];
```

Every decision the generator declined to make, and every action it left out, with the reason.

***

<a id="generatewarning"></a>

### GenerateWarning

#### Properties

<a id="action"></a>

##### action?

```ts
optional action?: string;
```

The action name the warning is about, when there is one.

<a id="code"></a>

##### code

```ts
code: GenerateWarningCode;
```

<a id="dropped"></a>

##### dropped?

```ts
optional dropped?: boolean;
```

True when the action was left out of the result because of this.

<a id="field"></a>

##### field?

```ts
optional field?: string;
```

The field the warning is about, e.g. `description`, `input.status`.

<a id="lint"></a>

##### lint?

```ts
optional lint?: LintIssue;
```

The lint issue, for `lint` warnings.

<a id="message"></a>

##### message

```ts
message: string;
```

<a id="ref"></a>

##### ref?

```ts
optional ref?: string;
```

The source reference, e.g. `GET /orders/{id}`.

***

<a id="jsonschematozodoptions"></a>

### JsonSchemaToZodOptions

#### Properties

<a id="location"></a>

##### location?

```ts
optional location?: string;
```

Location prefix for warnings, e.g. `orders.get.output`.

<a id="resolve"></a>

##### resolve?

```ts
optional resolve?: (ref) => JsonSchema | undefined;
```

Resolve a `$ref` string to its schema. Default: JSON Pointer lookup in `root`.

###### Parameters

###### ref

`string`

###### Returns

`JsonSchema` \| `undefined`

<a id="root"></a>

##### root?

```ts
optional root?: JsonSchema;
```

The document `$ref`s are relative to (`#/components/schemas/Order`).

***

<a id="jsonschematozodresult"></a>

### JsonSchemaToZodResult

#### Properties

<a id="schema"></a>

##### schema

```ts
schema: ZodType;
```

<a id="warnings-2"></a>

##### warnings

```ts
warnings: GenerateWarning[];
```

***

<a id="openapiauthoptions"></a>

### OpenAPIAuthOptions

#### Properties

<a id="forward"></a>

##### forward?

```ts
optional forward?: boolean;
```

Forward the `Authorization` header of the AXE request to the upstream call. Default false.

<a id="mode"></a>

##### mode?

```ts
optional mode?: WireAuthMode;
```

The AXE auth mode to declare for operations that have a security requirement. Default: by
the first scheme's type, `apiKey` → `site`, everything else (`http`, `oauth2`, `openIdConnect`) → `user`.

<a id="token"></a>

##### token?

```ts
optional token?: (ctx) => string | Promise<string | undefined> | undefined;
```

Produce the upstream `Authorization` header value for a call (a service token, a per-user exchange).

###### Parameters

###### ctx

`HandlerContext`\<`unknown`\>

###### Returns

`string` \| `Promise`\<`string` \| `undefined`\> \| `undefined`

***

<a id="openapidocument"></a>

### OpenAPIDocument

#### Indexable

```ts
[extension: string]: unknown
```

#### Properties

<a id="components"></a>

##### components?

```ts
optional components?: object;
```

###### parameters?

```ts
optional parameters?: Record<string, OpenAPIParameter>;
```

###### requestBodies?

```ts
optional requestBodies?: Record<string, OpenAPIRequestBody>;
```

###### responses?

```ts
optional responses?: Record<string, OpenAPIResponse>;
```

###### schemas?

```ts
optional schemas?: Record<string, JsonSchema>;
```

###### securitySchemes?

```ts
optional securitySchemes?: Record<string, OpenAPISecurityScheme>;
```

<a id="info"></a>

##### info?

```ts
optional info?: object;
```

###### description?

```ts
optional description?: string;
```

###### title?

```ts
optional title?: string;
```

###### version?

```ts
optional version?: string;
```

<a id="openapi"></a>

##### openapi?

```ts
optional openapi?: string;
```

<a id="paths"></a>

##### paths?

```ts
optional paths?: Record<string, OpenAPIPathItem>;
```

<a id="security"></a>

##### security?

```ts
optional security?: OpenAPISecurityRequirement[];
```

<a id="servers"></a>

##### servers?

```ts
optional servers?: object[];
```

###### description?

```ts
optional description?: string;
```

###### url

```ts
url: string;
```

***

<a id="openapimediatype"></a>

### OpenAPIMediaType

#### Properties

<a id="schema-1"></a>

##### schema?

```ts
optional schema?: JsonSchema;
```

***

<a id="openapioperation"></a>

### OpenAPIOperation

#### Properties

<a id="deprecated-2"></a>

##### deprecated?

```ts
optional deprecated?: boolean;
```

<a id="description-2"></a>

##### description?

```ts
optional description?: string;
```

<a id="operationid"></a>

##### operationId?

```ts
optional operationId?: string;
```

<a id="parameters"></a>

##### parameters?

```ts
optional parameters?: OpenAPIParameter[];
```

<a id="requestbody"></a>

##### requestBody?

```ts
optional requestBody?: OpenAPIRequestBody;
```

<a id="responses"></a>

##### responses?

```ts
optional responses?: Record<string, OpenAPIResponse>;
```

<a id="security-1"></a>

##### security?

```ts
optional security?: OpenAPISecurityRequirement[];
```

<a id="summary"></a>

##### summary?

```ts
optional summary?: string;
```

<a id="tags"></a>

##### tags?

```ts
optional tags?: string[];
```

***

<a id="openapioptions"></a>

### OpenAPIOptions

#### Properties

<a id="auth-2"></a>

##### auth?

```ts
optional auth?: OpenAPIAuthOptions;
```

<a id="baseurl"></a>

##### baseUrl?

```ts
optional baseUrl?: string;
```

Where the operations are served. Default: the document's first `servers[].url`, which must be absolute.

<a id="fetch"></a>

##### fetch?

```ts
optional fetch?: {
  (input, init?): Promise<Response>;
  (input, init?): Promise<Response>;
};
```

The fetch implementation for upstream calls. Default `globalThis.fetch`.

###### Call Signature

```ts
(input, init?): Promise<Response>;
```

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch)

###### Parameters

###### input

`URL` \| `RequestInfo`

###### init?

`RequestInit`

###### Returns

`Promise`\<`Response`\>

###### Call Signature

```ts
(input, init?): Promise<Response>;
```

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch)

###### Parameters

###### input

`string` \| `URL` \| `Request`

###### init?

`RequestInit`

###### Returns

`Promise`\<`Response`\>

<a id="headers"></a>

##### headers?

```ts
optional headers?: 
  | Record<string, string>
  | ((ctx) => 
  | Record<string, string>
  | Promise<Record<string, string>>);
```

Static headers on every upstream call, or a function of the AXE call.

<a id="includedeprecated"></a>

##### includeDeprecated?

```ts
optional includeDeprecated?: boolean;
```

Include operations the document marks `deprecated`. Default false: they are left out with a warning.

<a id="namespace"></a>

##### namespace?

```ts
optional namespace?: string;
```

Namespace for paths without a static first segment. Default `api`.

<a id="risk-2"></a>

##### risk?

```ts
optional risk?: Partial<Record<HttpMethod, WireRisk>>;
```

Risk by method. Default GET/HEAD `low`, POST/PUT/PATCH `medium`, DELETE `high`.

***

<a id="openapiparameter"></a>

### OpenAPIParameter

#### Properties

<a id="ref-1"></a>

##### $ref?

```ts
optional $ref?: string;
```

<a id="deprecated-3"></a>

##### deprecated?

```ts
optional deprecated?: boolean;
```

<a id="description-3"></a>

##### description?

```ts
optional description?: string;
```

<a id="in"></a>

##### in?

```ts
optional in?: "path" | "query" | "header" | "cookie";
```

<a id="name-2"></a>

##### name?

```ts
optional name?: string;
```

<a id="required"></a>

##### required?

```ts
optional required?: boolean;
```

<a id="schema-2"></a>

##### schema?

```ts
optional schema?: JsonSchema;
```

***

<a id="openapipathitem"></a>

### OpenAPIPathItem

#### Properties

<a id="ref-2"></a>

##### $ref?

```ts
optional $ref?: string;
```

<a id="delete"></a>

##### delete?

```ts
optional delete?: OpenAPIOperation;
```

<a id="description-4"></a>

##### description?

```ts
optional description?: string;
```

<a id="get"></a>

##### get?

```ts
optional get?: OpenAPIOperation;
```

<a id="head"></a>

##### head?

```ts
optional head?: OpenAPIOperation;
```

<a id="options"></a>

##### options?

```ts
optional options?: OpenAPIOperation;
```

<a id="parameters-1"></a>

##### parameters?

```ts
optional parameters?: OpenAPIParameter[];
```

<a id="patch"></a>

##### patch?

```ts
optional patch?: OpenAPIOperation;
```

<a id="post"></a>

##### post?

```ts
optional post?: OpenAPIOperation;
```

<a id="put"></a>

##### put?

```ts
optional put?: OpenAPIOperation;
```

<a id="summary-1"></a>

##### summary?

```ts
optional summary?: string;
```

<a id="trace"></a>

##### trace?

```ts
optional trace?: OpenAPIOperation;
```

***

<a id="openapirequestbody"></a>

### OpenAPIRequestBody

#### Properties

<a id="ref-3"></a>

##### $ref?

```ts
optional $ref?: string;
```

<a id="content"></a>

##### content?

```ts
optional content?: Record<string, OpenAPIMediaType>;
```

<a id="description-5"></a>

##### description?

```ts
optional description?: string;
```

<a id="required-1"></a>

##### required?

```ts
optional required?: boolean;
```

***

<a id="openapiresponse"></a>

### OpenAPIResponse

#### Properties

<a id="ref-4"></a>

##### $ref?

```ts
optional $ref?: string;
```

<a id="content-1"></a>

##### content?

```ts
optional content?: Record<string, OpenAPIMediaType>;
```

<a id="description-6"></a>

##### description?

```ts
optional description?: string;
```

***

<a id="openapisecurityscheme"></a>

### OpenAPISecurityScheme

#### Properties

<a id="in-1"></a>

##### in?

```ts
optional in?: string;
```

<a id="name-3"></a>

##### name?

```ts
optional name?: string;
```

<a id="scheme"></a>

##### scheme?

```ts
optional scheme?: string;
```

<a id="type"></a>

##### type?

```ts
optional type?: string;
```

***

<a id="provenance-2"></a>

### Provenance

Where a generated action came from, so a reviewer can find the definition it mirrors.

#### Properties

<a id="ref-5"></a>

##### ref

```ts
ref: string;
```

The reference inside that source: `GET /orders/{id}`, `orders.list`, `#/paths/...`.

<a id="source-2"></a>

##### source

```ts
source: string;
```

The source kind: `openapi`, `functions`, `trpc`, or a custom source's name.

***

<a id="trpcoptions"></a>

### TRPCOptions

#### Type Parameters

##### Ctx

`Ctx`

#### Properties

<a id="createcontext"></a>

##### createContext

```ts
createContext: (ctx) => MaybePromise<Ctx>;
```

Build the tRPC context for a call from the AXE handler context.

###### Parameters

###### ctx

`HandlerContext`\<`unknown`\>

###### Returns

`MaybePromise`\<`Ctx`\>

<a id="namespace-1"></a>

##### namespace?

```ts
optional namespace?: string;
```

Prefix for action names when procedure paths have a single segment (`hello` → `<namespace>.hello`). Default `trpc`.

***

<a id="trpcprocedurelike"></a>

### TRPCProcedureLike

The slice of a tRPC procedure definition the adapter reads (v10 and v11 shapes).

#### Properties

<a id="_def"></a>

##### \_def

```ts
_def: object;
```

###### inputs?

```ts
optional inputs?: unknown[];
```

###### meta?

```ts
optional meta?: TRPCProcedureMeta;
```

###### mutation?

```ts
optional mutation?: boolean;
```

###### output?

```ts
optional output?: unknown;
```

###### query?

```ts
optional query?: boolean;
```

###### subscription?

```ts
optional subscription?: boolean;
```

###### type?

```ts
optional type?: "query" | "mutation" | "subscription";
```

***

<a id="trpcproceduremeta"></a>

### TRPCProcedureMeta

The `meta` a procedure can carry (`publicProcedure.meta({...})`) that the generator reads.

#### Indexable

```ts
[key: string]: unknown
```

#### Properties

<a id="auth-3"></a>

##### auth?

```ts
optional auth?: WireAuthMode;
```

<a id="description-7"></a>

##### description?

```ts
optional description?: string;
```

<a id="idempotent-2"></a>

##### idempotent?

```ts
optional idempotent?: boolean;
```

<a id="reversible-2"></a>

##### reversible?

```ts
optional reversible?: boolean;
```

<a id="risk-3"></a>

##### risk?

```ts
optional risk?: WireRisk;
```

<a id="title-2"></a>

##### title?

```ts
optional title?: string;
```

***

<a id="trpcrouterlike"></a>

### TRPCRouterLike

The slice of a tRPC router the adapter reads: a flat table of procedures by dotted path, and a caller factory.

#### Type Parameters

##### Ctx

`Ctx` = `unknown`

#### Properties

<a id="_def-1"></a>

##### \_def

```ts
_def: object;
```

###### procedures

```ts
procedures: Record<string, TRPCProcedureLike>;
```

#### Methods

<a id="createcaller"></a>

##### createCaller()

```ts
createCaller(ctx): unknown;
```

###### Parameters

###### ctx

`Ctx`

###### Returns

`unknown`

## Type Aliases

<a id="functiontable"></a>

### FunctionTable

```ts
type FunctionTable = Record<string, FunctionEntry>;
```

***

<a id="generatedspec"></a>

### GeneratedSpec

```ts
type GeneratedSpec = Omit<ActionSpec<z.ZodType, z.ZodType>, "title" | "description" | "risk"> & object;
```

An action as a source yields it: an `ActionSpec` whose honesty fields (`title`,
`description`, `risk`) may still be missing. `generate()` fills them from overrides and
policy, and leaves the action out when it cannot.

#### Type Declaration

##### description?

```ts
optional description?: string;
```

##### risk?

```ts
optional risk?: Risk;
```

##### title?

```ts
optional title?: string;
```

***

<a id="generatewarningcode-1"></a>

### GenerateWarningCode

```ts
type GenerateWarningCode = 
  | "missing-description"
  | "missing-risk"
  | "missing-output"
  | "unsupported-schema"
  | "unsupported-parameter"
  | "derived-name"
  | "duplicate-name"
  | "invalid-definition"
  | "lint"
  | "excluded"
  | "unknown-override"
  | "source";
```

***

<a id="httpmethod"></a>

### HttpMethod

```ts
type HttpMethod = "GET" | "PUT" | "POST" | "DELETE" | "PATCH" | "HEAD";
```

***

<a id="namepattern"></a>

### NamePattern

```ts
type NamePattern = string | RegExp;
```

A name or reference pattern: a string with `*` wildcards, or a regular expression.

***

<a id="openapisecurityrequirement"></a>

### OpenAPISecurityRequirement

```ts
type OpenAPISecurityRequirement = Record<string, string[]>;
```

***

<a id="sourceoutput"></a>

### SourceOutput

```ts
type SourceOutput = 
  | GeneratedAction[]
  | {
  actions: GeneratedAction[];
  warnings?: GenerateWarning[];
};
```

What a source yields: candidates alone, or candidates plus warnings about the source as a whole.

## Functions

<a id="actionnamefromoperationid"></a>

### actionNameFromOperationId()

```ts
function actionNameFromOperationId(
   operationId, 
   path, 
   namespace?
): string | undefined;
```

Sanitise an operationId to the AXE grammar. Dotted ids keep their segments; a flat id is
namespaced under the path's first static segment, with that word removed from the verb part
(`listOrders` on `/orders` → `orders.list`). Returns undefined when nothing valid comes out.

#### Parameters

##### operationId

`string`

##### path

`string`

##### namespace?

`string` = `"api"`

#### Returns

`string` \| `undefined`

***

<a id="derivedactionname"></a>

### derivedActionName()

```ts
function derivedActionName(
   method, 
   path, 
   namespace?
): string;
```

The name derived from method and path when there is no usable operationId.

#### Parameters

##### method

[`HttpMethod`](#httpmethod)

##### path

`string`

##### namespace?

`string` = `"api"`

#### Returns

`string`

***

<a id="errorcodeforstatus"></a>

### errorCodeForStatus()

```ts
function errorCodeForStatus(status): WireError;
```

HTTP status → AXE error code. Unlisted 4xx are `internal`: they signal a generator or configuration problem, not agent input.

#### Parameters

##### status

`number`

#### Returns

`WireError`

***

<a id="formatwarnings"></a>

### formatWarnings()

```ts
function formatWarnings(warnings): string;
```

One line per warning, for terminals and build logs.

#### Parameters

##### warnings

readonly [`GenerateWarning`](#generatewarning)[]

#### Returns

`string`

***

<a id="fromfunctions"></a>

### fromFunctions()

```ts
function fromFunctions<S>(table, options?): ActionSource;
```

Derive action candidates from a table keyed by action name. Each handler's `input` parameter
is typed from its entry's `input` schema; the return value is validated at runtime against
`output`.

#### Type Parameters

##### S

`S` *extends* `Record`\<`string`, `ZodObject`\<`$ZodLooseShape`, `$strip`\>\>

#### Parameters

##### table

\{ \[K in string \| number \| symbol\]: FunctionEntry\<S\[K\], ZodType\<unknown, unknown, $ZodTypeInternals\<unknown, unknown\>\>\> \}

##### options?

[`FunctionsOptions`](#functionsoptions) = `{}`

#### Returns

[`ActionSource`](#actionsource)

***

<a id="fromopenapi"></a>

### fromOpenAPI()

```ts
function fromOpenAPI(document, options?): ActionSource;
```

Derive AXE action candidates from an OpenAPI 3.x document. Feed the result to `generate()`.

#### Parameters

##### document

[`OpenAPIDocument`](#openapidocument)

##### options?

[`OpenAPIOptions`](#openapioptions) = `{}`

#### Returns

[`ActionSource`](#actionsource)

***

<a id="fromtrpcrouter"></a>

### fromTRPCRouter()

```ts
function fromTRPCRouter<Ctx>(router, options): ActionSource;
```

Derive action candidates from a tRPC router without depending on tRPC: procedures are read
from `_def.procedures`, called through `createCaller`. Queries are read-only; mutations need a
`risk` in their `meta` or an override; subscriptions are skipped.

#### Type Parameters

##### Ctx

`Ctx`

#### Parameters

##### router

[`TRPCRouterLike`](#trpcrouterlike)\<`Ctx`\>

##### options

[`TRPCOptions`](#trpcoptions)\<`Ctx`\>

#### Returns

[`ActionSource`](#actionsource)

***

<a id="generate"></a>

### generate()

```ts
function generate(sources, options?): GenerateResult;
```

Turn action candidates into registered actions. Nothing is invented: a candidate without a
description or a risk is left out, with a warning naming the source reference and the missing
field, unless an override supplies it.

#### Parameters

##### sources

[`ActionSource`](#actionsource)[]

##### options?

[`GenerateOptions`](#generateoptions) = `{}`

#### Returns

[`GenerateResult`](#generateresult)

***

<a id="jsonschematozod"></a>

### jsonSchemaToZod()

```ts
function jsonSchemaToZod(schema, options?): JsonSchemaToZodResult;
```

Convert one JSON Schema to a Zod schema.

#### Parameters

##### schema

`boolean` \| `JsonSchema`

##### options?

[`JsonSchemaToZodOptions`](#jsonschematozodoptions) = `{}`

#### Returns

[`JsonSchemaToZodResult`](#jsonschematozodresult)

***

<a id="registergenerated"></a>

### registerGenerated()

```ts
function registerGenerated<T>(axe, generated): T;
```

Register every generated action on an AXE server. Returns the server for chaining.

#### Type Parameters

##### T

`T` *extends* `object`

#### Parameters

##### axe

`T`

##### generated

`Pick`\<[`GenerateResult`](#generateresult), `"actions"`\>

#### Returns

`T`

***

<a id="resolvelocalref"></a>

### resolveLocalRef()

```ts
function resolveLocalRef(root, ref): JsonSchema | undefined;
```

Look up a local JSON Pointer `$ref` (`#/a/b`) in a document.

#### Parameters

##### root

`JsonSchema`

##### ref

`string`

#### Returns

`JsonSchema` \| `undefined`

***

<a id="wordtokens"></a>

### wordTokens()

```ts
function wordTokens(s): string[];
```

Lower-case word tokens of an identifier: `getOrderById` → get, order, by, id; `list_orders-v2` → list, orders, v2.

#### Parameters

##### s

`string`

#### Returns

`string`[]
