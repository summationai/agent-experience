[AXE API reference](../README.md) / @axe/testing

# @axe/testing

## Interfaces

### AuditCategory

Defined in: [testing/src/audit/index.ts:27](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L27)

#### Properties

##### checks

```ts
checks: AuditCheck[];
```

Defined in: [testing/src/audit/index.ts:32](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L32)

##### id

```ts
id: string;
```

Defined in: [testing/src/audit/index.ts:28](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L28)

##### max

```ts
max: number;
```

Defined in: [testing/src/audit/index.ts:30](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L30)

##### score

```ts
score: number;
```

Defined in: [testing/src/audit/index.ts:31](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L31)

##### title

```ts
title: string;
```

Defined in: [testing/src/audit/index.ts:29](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L29)

***

### AuditCheck

Defined in: [testing/src/audit/index.ts:15](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L15)

#### Properties

##### category

```ts
category: string;
```

Defined in: [testing/src/audit/index.ts:17](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L17)

##### detail

```ts
detail: string;
```

Defined in: [testing/src/audit/index.ts:23](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L23)

##### docs

```ts
docs: string;
```

Defined in: [testing/src/audit/index.ts:24](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L24)

##### earned

```ts
earned: number;
```

Defined in: [testing/src/audit/index.ts:21](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L21)

Fraction earned, 0..1.

##### id

```ts
id: string;
```

Defined in: [testing/src/audit/index.ts:16](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L16)

##### status

```ts
status: "pass" | "fail" | "skip" | "partial";
```

Defined in: [testing/src/audit/index.ts:22](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L22)

##### title

```ts
title: string;
```

Defined in: [testing/src/audit/index.ts:18](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L18)

##### weight

```ts
weight: number;
```

Defined in: [testing/src/audit/index.ts:19](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L19)

***

### AuditFix

Defined in: [testing/src/audit/index.ts:35](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L35)

#### Properties

##### category

```ts
category: string;
```

Defined in: [testing/src/audit/index.ts:38](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L38)

##### check

```ts
check: string;
```

Defined in: [testing/src/audit/index.ts:36](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L36)

##### detail

```ts
detail: string;
```

Defined in: [testing/src/audit/index.ts:41](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L41)

##### docs

```ts
docs: string;
```

Defined in: [testing/src/audit/index.ts:42](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L42)

##### points

```ts
points: number;
```

Defined in: [testing/src/audit/index.ts:40](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L40)

Points recoverable.

##### title

```ts
title: string;
```

Defined in: [testing/src/audit/index.ts:37](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L37)

***

### AuditOptions

Defined in: [testing/src/audit/index.ts:66](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L66)

#### Extends

- [`ConformanceOptions`](#conformanceoptions)

#### Properties

##### auth?

```ts
optional auth?: string;
```

Defined in: [testing/src/conformance/index.ts:83](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L83)

Bearer token for `user` or `site` actions, so the ladder can be exercised.

###### Inherited from

[`ConformanceOptions`](#conformanceoptions).[`auth`](#auth-1)

##### browser?

```ts
optional browser?: boolean;
```

Defined in: [testing/src/audit/index.ts:68](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L68)

Fetch each parity URL and look for the agent-facing price/availability values on the page.

##### fetch?

```ts
optional fetch?: (input, init?) => Promise<Response>;
```

Defined in: [testing/src/conformance/index.ts:81](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L81)

###### Parameters

###### input

`string` \| `URL`

###### init?

`RequestInit`

###### Returns

`Promise`\<`Response`\>

###### Inherited from

[`ConformanceOptions`](#conformanceoptions).[`fetch`](#fetch-1)

##### headers?

```ts
optional headers?: Record<string, string>;
```

Defined in: [testing/src/conformance/index.ts:84](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L84)

###### Inherited from

[`ConformanceOptions`](#conformanceoptions).[`headers`](#headers-1)

##### ladder?

```ts
optional ladder?: object;
```

Defined in: [testing/src/conformance/index.ts:92](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L92)

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

##### minScore?

```ts
optional minScore?: number;
```

Defined in: [testing/src/audit/index.ts:70](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L70)

Fail below this score (used by the CLI exit code).

##### noMutate?

```ts
optional noMutate?: boolean;
```

Defined in: [testing/src/conformance/index.ts:86](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L86)

Skip checks that call mutating actions.

###### Inherited from

[`ConformanceOptions`](#conformanceoptions).[`noMutate`](#nomutate-1)

##### timeoutMs?

```ts
optional timeoutMs?: number;
```

Defined in: [testing/src/conformance/index.ts:90](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L90)

Per-request timeout. Default 15000 ms.

###### Inherited from

[`ConformanceOptions`](#conformanceoptions).[`timeoutMs`](#timeoutms-1)

##### vendor?

```ts
optional vendor?: string;
```

Defined in: [testing/src/conformance/index.ts:88](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L88)

Vendor to present in `context.agent`.

###### Inherited from

[`ConformanceOptions`](#conformanceoptions).[`vendor`](#vendor-1)

***

### AuditReport

Defined in: [testing/src/audit/index.ts:55](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L55)

#### Properties

##### categories

```ts
categories: AuditCategory[];
```

Defined in: [testing/src/audit/index.ts:58](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L58)

##### conformance

```ts
conformance: ConformanceReport;
```

Defined in: [testing/src/audit/index.ts:62](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L62)

##### fixes

```ts
fixes: AuditFix[];
```

Defined in: [testing/src/audit/index.ts:59](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L59)

##### generatedAt

```ts
generatedAt: string;
```

Defined in: [testing/src/audit/index.ts:63](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L63)

##### hardFailure

```ts
hardFailure: string | null;
```

Defined in: [testing/src/audit/index.ts:61](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L61)

##### parity

```ts
parity: object;
```

Defined in: [testing/src/audit/index.ts:60](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L60)

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

##### score

```ts
score: number;
```

Defined in: [testing/src/audit/index.ts:57](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L57)

##### url

```ts
url: string;
```

Defined in: [testing/src/audit/index.ts:56](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L56)

***

### AxeLike

Defined in: [testing/src/helpers.ts:11](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/helpers.ts#L11)

The subset of an `AXE` instance the helpers need.

#### Methods

##### describe()

```ts
describe(): Manifest;
```

Defined in: [testing/src/helpers.ts:16](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/helpers.ts#L16)

###### Returns

[`Manifest`](client/index.md#manifest-1)

##### handle()

```ts
handle(request, adapter?): Promise<Response>;
```

Defined in: [testing/src/helpers.ts:12](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/helpers.ts#L12)

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

### Check

Defined in: [testing/src/conformance/index.ts:39](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L39)

#### Properties

##### detail

```ts
detail: string;
```

Defined in: [testing/src/conformance/index.ts:45](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L45)

##### docs

```ts
docs: string;
```

Defined in: [testing/src/conformance/index.ts:47](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L47)

Doc section that explains the fix.

##### id

```ts
id: string;
```

Defined in: [testing/src/conformance/index.ts:40](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L40)

##### requirements

```ts
requirements: string[];
```

Defined in: [testing/src/conformance/index.ts:44](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L44)

Spec requirement ids this check verifies.

##### status

```ts
status: CheckStatus;
```

Defined in: [testing/src/conformance/index.ts:42](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L42)

##### title

```ts
title: string;
```

Defined in: [testing/src/conformance/index.ts:41](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L41)

***

### ConformanceOptions

Defined in: [testing/src/conformance/index.ts:80](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L80)

#### Extended by

- [`AuditOptions`](#auditoptions)

#### Properties

##### auth?

```ts
optional auth?: string;
```

Defined in: [testing/src/conformance/index.ts:83](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L83)

Bearer token for `user` or `site` actions, so the ladder can be exercised.

##### fetch?

```ts
optional fetch?: (input, init?) => Promise<Response>;
```

Defined in: [testing/src/conformance/index.ts:81](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L81)

###### Parameters

###### input

`string` \| `URL`

###### init?

`RequestInit`

###### Returns

`Promise`\<`Response`\>

##### headers?

```ts
optional headers?: Record<string, string>;
```

Defined in: [testing/src/conformance/index.ts:84](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L84)

##### ladder?

```ts
optional ladder?: object;
```

Defined in: [testing/src/conformance/index.ts:92](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L92)

Explicit action + input known to return `needs_input`, when examples do not.

###### action

```ts
action: string;
```

###### input

```ts
input: JsonValue;
```

##### noMutate?

```ts
optional noMutate?: boolean;
```

Defined in: [testing/src/conformance/index.ts:86](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L86)

Skip checks that call mutating actions.

##### timeoutMs?

```ts
optional timeoutMs?: number;
```

Defined in: [testing/src/conformance/index.ts:90](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L90)

Per-request timeout. Default 15000 ms.

##### vendor?

```ts
optional vendor?: string;
```

Defined in: [testing/src/conformance/index.ts:88](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L88)

Vendor to present in `context.agent`.

***

### ConformanceReport

Defined in: [testing/src/conformance/index.ts:50](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L50)

#### Properties

##### checks

```ts
checks: Check[];
```

Defined in: [testing/src/conformance/index.ts:54](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L54)

##### failed

```ts
failed: number;
```

Defined in: [testing/src/conformance/index.ts:56](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L56)

##### manifest

```ts
manifest: Manifest | null;
```

Defined in: [testing/src/conformance/index.ts:53](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L53)

##### manifestUrl

```ts
manifestUrl: string | null;
```

Defined in: [testing/src/conformance/index.ts:52](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L52)

##### observations

```ts
observations: Observations;
```

Defined in: [testing/src/conformance/index.ts:62](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L62)

Observations the audit reuses.

##### ok

```ts
ok: boolean;
```

Defined in: [testing/src/conformance/index.ts:60](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L60)

True when no check failed.

##### passed

```ts
passed: number;
```

Defined in: [testing/src/conformance/index.ts:55](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L55)

##### skipped

```ts
skipped: number;
```

Defined in: [testing/src/conformance/index.ts:58](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L58)

##### url

```ts
url: string;
```

Defined in: [testing/src/conformance/index.ts:51](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L51)

##### warnings

```ts
warnings: number;
```

Defined in: [testing/src/conformance/index.ts:57](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L57)

***

### DriftOptions

Defined in: [testing/src/drift.ts:12](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/drift.ts#L12)

#### Properties

##### allowlistPath?

```ts
optional allowlistPath?: string;
```

Defined in: [testing/src/drift.ts:16](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/drift.ts#L16)

Path to the allowlist JSON, relative to root. Default `spec/drift-allowlist.json`.

##### docPaths?

```ts
optional docPaths?: string[];
```

Defined in: [testing/src/drift.ts:20](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/drift.ts#L20)

Doc directories to scan. Default `spec`, `docs`, and `README.md`; `docs/api` is skipped.

##### maxAllowlist?

```ts
optional maxAllowlist?: number;
```

Defined in: [testing/src/drift.ts:18](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/drift.ts#L18)

Maximum allowlist entries before the check fails. Default 15.

##### root

```ts
root: string;
```

Defined in: [testing/src/drift.ts:14](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/drift.ts#L14)

Repository root containing `spec/`, `docs/`, `packages/`, `README.md`.

***

### DriftReport

Defined in: [testing/src/drift.ts:23](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/drift.ts#L23)

#### Properties

##### allowlist

```ts
allowlist: string[];
```

Defined in: [testing/src/drift.ts:34](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/drift.ts#L34)

##### literals

```ts
literals: object[];
```

Defined in: [testing/src/drift.ts:33](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/drift.ts#L33)

Source files with literal wire names that should use WIRE.

###### file

```ts
file: string;
```

###### literal

```ts
literal: string;
```

##### missingFromTypes

```ts
missingFromTypes: string[];
```

Defined in: [testing/src/drift.ts:31](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/drift.ts#L31)

`field`/`api` entries missing from every public .d.ts.

##### ok

```ts
ok: boolean;
```

Defined in: [testing/src/drift.ts:35](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/drift.ts#L35)

##### unknown

```ts
unknown: Record<string, string[]>;
```

Defined in: [testing/src/drift.ts:25](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/drift.ts#L25)

Tokens that look like wire names but are not in the vocabulary: token → files.

##### unmentioned

```ts
unmentioned: string[];
```

Defined in: [testing/src/drift.ts:27](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/drift.ts#L27)

Vocabulary entries never mentioned in any doc.

##### unused

```ts
unused: string[];
```

Defined in: [testing/src/drift.ts:29](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/drift.ts#L29)

Vocabulary entries never used in any source file.

***

### Observations

Defined in: [testing/src/conformance/index.ts:65](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L65)

#### Properties

##### calls

```ts
calls: object[];
```

Defined in: [testing/src/conformance/index.ts:71](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L71)

Actions called live and whether each returned a non-error status.

###### action

```ts
action: string;
```

###### status

```ts
status: string;
```

##### hintFound

```ts
hintFound: "header" | "robots" | "link" | null;
```

Defined in: [testing/src/conformance/index.ts:77](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L77)

##### idempotencyReplayWorked

```ts
idempotencyReplayWorked: boolean | null;
```

Defined in: [testing/src/conformance/index.ts:75](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L75)

Whether a mutating action with a usable idempotency path was found.

##### needsHuman

```ts
needsHuman: object[];
```

Defined in: [testing/src/conformance/index.ts:69](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L69)

Every `needs_human` seen.

###### action

```ts
action: string;
```

###### reason

```ts
reason: string;
```

##### needsInput

```ts
needsInput: object[];
```

Defined in: [testing/src/conformance/index.ts:67](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L67)

Every `needs_input` seen, with the action that produced it.

###### action

```ts
action: string;
```

###### result

```ts
result: NeedsInputResult;
```

##### outputs

```ts
outputs: object[];
```

Defined in: [testing/src/conformance/index.ts:73](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L73)

Per-action outputs from live example runs, for display and parity checks.

###### action

```ts
action: string;
```

###### output

```ts
output: unknown;
```

##### tokenTamperRejected

```ts
tokenTamperRejected: boolean | null;
```

Defined in: [testing/src/conformance/index.ts:76](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L76)

***

### ParityTarget

Defined in: [testing/src/audit/index.ts:45](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L45)

#### Properties

##### action

```ts
action: string;
```

Defined in: [testing/src/audit/index.ts:46](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L46)

##### expect

```ts
expect: Record<string, string>;
```

Defined in: [testing/src/audit/index.ts:50](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L50)

Values an auditor should find on the human page.

##### found?

```ts
optional found?: Record<string, boolean>;
```

Defined in: [testing/src/audit/index.ts:52](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L52)

Filled in with `--browser`.

##### itemId

```ts
itemId: string;
```

Defined in: [testing/src/audit/index.ts:47](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L47)

##### url

```ts
url: string;
```

Defined in: [testing/src/audit/index.ts:48](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L48)

***

### TestClientOptions

Defined in: [testing/src/helpers.ts:19](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/helpers.ts#L19)

#### Extends

- `ClientOptions`

#### Properties

##### agent?

```ts
optional agent?: AgentIdentification;
```

Defined in: client/dist/index.d.ts:51

Sent as `context.agent` and as the `User-Agent` when possible.

###### Inherited from

```ts
ClientOptions.agent
```

##### auth?

```ts
optional auth?: string | (() => MaybePromise<string | undefined>);
```

Defined in: client/dist/index.d.ts:49

Bearer token, or a function returning one, sent in `Authorization`.

###### Inherited from

```ts
ClientOptions.auth
```

##### confirm?

```ts
optional confirm?: (request) => MaybePromise<boolean>;
```

Defined in: client/dist/index.d.ts:57

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

##### fetch?

```ts
optional fetch?: FetchLike;
```

Defined in: client/dist/index.d.ts:45

###### Inherited from

```ts
ClientOptions.fetch
```

##### fulfillers?

```ts
optional fulfillers?: Fulfiller[];
```

Defined in: client/dist/index.d.ts:55

###### Inherited from

```ts
ClientOptions.fulfillers
```

##### headers?

```ts
optional headers?: Record<string, string>;
```

Defined in: client/dist/index.d.ts:47

Extra headers on every request.

###### Inherited from

```ts
ClientOptions.headers
```

##### identity?

```ts
optional identity?: 
  | {
  onBehalfOf: string;
}
  | null;
```

Defined in: [testing/src/helpers.ts:21](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/helpers.ts#L21)

Act as this user without going through your `authenticate` function.

##### locale?

```ts
optional locale?: string;
```

Defined in: client/dist/index.d.ts:52

###### Inherited from

```ts
ClientOptions.locale
```

##### maxRetryAfterMs?

```ts
optional maxRetryAfterMs?: number;
```

Defined in: client/dist/index.d.ts:59

Longest `Retry-After` the client will honor automatically, in ms. Default 30000.

###### Inherited from

```ts
ClientOptions.maxRetryAfterMs
```

##### retries?

```ts
optional retries?: number;
```

Defined in: client/dist/index.d.ts:61

Retries after `rate_limited`/`unavailable`. Default 1.

###### Inherited from

```ts
ClientOptions.retries
```

##### sessionId?

```ts
optional sessionId?: string;
```

Defined in: client/dist/index.d.ts:54

###### Inherited from

```ts
ClientOptions.sessionId
```

##### timezone?

```ts
optional timezone?: string;
```

Defined in: client/dist/index.d.ts:53

###### Inherited from

```ts
ClientOptions.timezone
```

## Type Aliases

### CheckStatus

```ts
type CheckStatus = "pass" | "fail" | "warn" | "skip";
```

Defined in: [testing/src/conformance/index.ts:37](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L37)

***

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

Defined in: [testing/src/conformance/requirements.ts:6](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/requirements.ts#L6)

Where every numbered requirement in spec/AXE-PROTOCOL.md is verified: by a conformance
check id (runs against any URL) or by a named test in a package. A test asserts that
every `[P-...]` identifier in the spec appears here.

## Variables

### REQUIREMENTS

```ts
const REQUIREMENTS: Readonly<Record<string, readonly Coverage[]>>;
```

Defined in: [testing/src/conformance/requirements.ts:8](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/requirements.ts#L8)

***

### SAMPLE\_PAYLOADS

```ts
const SAMPLE_PAYLOADS: Readonly<Record<string, JsonValue>>;
```

Defined in: [testing/src/helpers.ts:66](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/helpers.ts#L66)

A valid sample payload for every well-known kind, for exercising `/axe/continue` in tests and conformance.

***

### WEIGHTS

```ts
const WEIGHTS: Weights;
```

Defined in: [testing/src/audit/index.ts:79](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L79)

***

### WELL\_KNOWN\_KIND\_NAMES

```ts
const WELL_KNOWN_KIND_NAMES: readonly string[];
```

Defined in: [testing/src/helpers.ts:133](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/helpers.ts#L133)

Names of every well-known kind.

## Functions

### checkVocabularyDrift()

```ts
function checkVocabularyDrift(options): DriftReport;
```

Defined in: [testing/src/drift.ts:118](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/drift.ts#L118)

#### Parameters

##### options

[`DriftOptions`](#driftoptions)

#### Returns

[`DriftReport`](#driftreport)

***

### createTestClient()

```ts
function createTestClient(axe, options?): AXEClient;
```

Defined in: [testing/src/helpers.ts:28](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/helpers.ts#L28)

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

### formatAuditHtml()

```ts
function formatAuditHtml(report): string;
```

Defined in: [testing/src/audit/format.ts:76](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/format.ts#L76)

Self-contained HTML report suitable for attaching to a pull request.

#### Parameters

##### report

[`AuditReport`](#auditreport)

#### Returns

`string`

***

### formatAuditTable()

```ts
function formatAuditTable(report, options?): string;
```

Defined in: [testing/src/audit/format.ts:8](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/format.ts#L8)

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

### formatConformanceTable()

```ts
function formatConformanceTable(report, options?): string;
```

Defined in: [testing/src/conformance/index.ts:1741](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L1741)

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

### formatDriftReport()

```ts
function formatDriftReport(r): string;
```

Defined in: [testing/src/drift.ts:269](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/drift.ts#L269)

Human-readable summary.

#### Parameters

##### r

[`DriftReport`](#driftreport)

#### Returns

`string`

***

### graphConnectivity()

```ts
function graphConnectivity(m): object;
```

Defined in: [testing/src/audit/index.ts:123](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L123)

Actions reachable from a read action or from another action's affordances.

#### Parameters

##### m

[`Manifest`](client/index.md#manifest-1)

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

### inlineCodeSpans()

```ts
function inlineCodeSpans(markdown): string[];
```

Defined in: [testing/src/drift.ts:52](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/drift.ts#L52)

Inline code spans, with fenced blocks removed first.

#### Parameters

##### markdown

`string`

#### Returns

`string`[]

***

### invokeAction()

```ts
function invokeAction<O>(
   axe, 
   name, 
   input, 
   options?
): Promise<Result<O>>;
```

Defined in: [testing/src/helpers.ts:39](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/helpers.ts#L39)

Invoke one action in-process and return the raw result envelope. Adds an idempotency
key for mutating actions.

#### Type Parameters

##### O

`O` = [`JsonValue`](client/index.md#jsonvalue)

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

`Promise`\<[`Result`](client/index.md#result)\<`O`\>\>

***

### runAudit()

```ts
function runAudit(url, options?): Promise<AuditReport>;
```

Defined in: [testing/src/audit/index.ts:177](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/audit/index.ts#L177)

Run the audit. Runs the conformance suite first and reuses its observations.

#### Parameters

##### url

`string`

##### options?

[`AuditOptions`](#auditoptions) = `{}`

#### Returns

`Promise`\<[`AuditReport`](#auditreport)\>

***

### runConformance()

```ts
function runConformance(url, options?): Promise<ConformanceReport>;
```

Defined in: [testing/src/conformance/index.ts:1711](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/conformance/index.ts#L1711)

Run the conformance suite against a site.

#### Parameters

##### url

`string`

##### options?

[`ConformanceOptions`](#conformanceoptions) = `{}`

#### Returns

`Promise`\<[`ConformanceReport`](#conformancereport)\>

***

### samplePayload()

```ts
function samplePayload(kind): JsonValue | undefined;
```

Defined in: [testing/src/helpers.ts:128](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/helpers.ts#L128)

Sample payload for a kind, or undefined for custom kinds.

#### Parameters

##### kind

`string`

#### Returns

[`JsonValue`](client/index.md#jsonvalue) \| `undefined`

***

### wireLikeNames()

```ts
function wireLikeNames(span): WireLikeName[];
```

Defined in: [testing/src/drift.ts:80](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/testing/src/drift.ts#L80)

#### Parameters

##### span

`string`

#### Returns

`WireLikeName`[]
