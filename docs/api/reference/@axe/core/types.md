[AXE API reference](../../README.md) / [@axe/core](README.md) / types

# types

## Interfaces

### Accept

Defined in: [packages/core/src/types.ts:244](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L244)

#### Properties

##### description

```ts
description: string;
```

Defined in: [packages/core/src/types.ts:247](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L247)

##### instructions?

```ts
optional instructions?: string;
```

Defined in: [packages/core/src/types.ts:250](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L250)

##### kind

```ts
kind: string;
```

Defined in: [packages/core/src/types.ts:245](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L245)

##### schema

```ts
schema: JsonSchema;
```

Defined in: [packages/core/src/types.ts:248](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L248)

##### sensitive

```ts
sensitive: boolean;
```

Defined in: [packages/core/src/types.ts:249](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L249)

##### title

```ts
title: string;
```

Defined in: [packages/core/src/types.ts:246](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L246)

***

### ActionDefinition

Defined in: [packages/core/src/types.ts:185](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L185)

An action as it appears in the manifest.

#### Properties

##### affordances?

```ts
optional affordances?: Affordance[];
```

Defined in: [packages/core/src/types.ts:198](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L198)

##### auth

```ts
auth: WireAuthMode;
```

Defined in: [packages/core/src/types.ts:195](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L195)

##### deprecated?

```ts
optional deprecated?: Deprecation;
```

Defined in: [packages/core/src/types.ts:202](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L202)

##### description

```ts
description: string;
```

Defined in: [packages/core/src/types.ts:188](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L188)

##### display?

```ts
optional display?: Display;
```

Defined in: [packages/core/src/types.ts:197](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L197)

##### examples?

```ts
optional examples?: ActionExample[];
```

Defined in: [packages/core/src/types.ts:196](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L196)

##### freshness?

```ts
optional freshness?: Freshness;
```

Defined in: [packages/core/src/types.ts:200](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L200)

##### humanHandoff?

```ts
optional humanHandoff?: object;
```

Defined in: [packages/core/src/types.ts:201](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L201)

###### reasons

```ts
reasons: string[];
```

##### idempotent

```ts
idempotent: boolean;
```

Defined in: [packages/core/src/types.ts:192](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L192)

##### input

```ts
input: JsonSchema;
```

Defined in: [packages/core/src/types.ts:189](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L189)

##### name

```ts
name: string;
```

Defined in: [packages/core/src/types.ts:186](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L186)

##### output

```ts
output: JsonSchema;
```

Defined in: [packages/core/src/types.ts:190](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L190)

##### pagination?

```ts
optional pagination?: Pagination;
```

Defined in: [packages/core/src/types.ts:199](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L199)

##### readOnly

```ts
readOnly: boolean;
```

Defined in: [packages/core/src/types.ts:191](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L191)

##### reversible

```ts
reversible: boolean;
```

Defined in: [packages/core/src/types.ts:193](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L193)

##### risk

```ts
risk: WireRisk;
```

Defined in: [packages/core/src/types.ts:194](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L194)

##### title

```ts
title: string;
```

Defined in: [packages/core/src/types.ts:187](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L187)

***

### ActionExample

Defined in: [packages/core/src/types.ts:174](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L174)

#### Properties

##### input

```ts
input: JsonValue;
```

Defined in: [packages/core/src/types.ts:175](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L175)

##### output

```ts
output: JsonValue;
```

Defined in: [packages/core/src/types.ts:176](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L176)

***

### Affordance

Defined in: [packages/core/src/types.ts:143](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L143)

A statically declared affordance. `input` values are JSON Pointers relative to the item.

#### Properties

##### action

```ts
action: string;
```

Defined in: [packages/core/src/types.ts:144](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L144)

##### input

```ts
input: Record<string, JsonPointer>;
```

Defined in: [packages/core/src/types.ts:146](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L146)

##### primary?

```ts
optional primary?: boolean;
```

Defined in: [packages/core/src/types.ts:147](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L147)

##### title

```ts
title: string;
```

Defined in: [packages/core/src/types.ts:145](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L145)

***

### AgentIdentification

Defined in: [packages/core/src/types.ts:209](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L209)

#### Properties

##### contact?

```ts
optional contact?: string;
```

Defined in: [packages/core/src/types.ts:213](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L213)

##### name

```ts
name: string;
```

Defined in: [packages/core/src/types.ts:210](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L210)

##### vendor?

```ts
optional vendor?: string;
```

Defined in: [packages/core/src/types.ts:212](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L212)

##### version?

```ts
optional version?: string;
```

Defined in: [packages/core/src/types.ts:211](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L211)

***

### AgentPolicy

Defined in: [packages/core/src/types.ts:57](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L57)

#### Properties

##### allow?

```ts
optional allow?: string[];
```

Defined in: [packages/core/src/types.ts:58](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L58)

##### deny?

```ts
optional deny?: string[];
```

Defined in: [packages/core/src/types.ts:59](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L59)

***

### AttributeDisplay

Defined in: [packages/core/src/types.ts:114](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L114)

#### Properties

##### compare?

```ts
optional compare?: WireCompare;
```

Defined in: [packages/core/src/types.ts:118](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L118)

##### format?

```ts
optional format?: WireFormat;
```

Defined in: [packages/core/src/types.ts:117](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L117)

##### label

```ts
label: string;
```

Defined in: [packages/core/src/types.ts:115](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L115)

##### path

```ts
path: string;
```

Defined in: [packages/core/src/types.ts:116](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L116)

***

### AXEEvent

Defined in: [packages/core/src/types.ts:339](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L339)

#### Properties

##### action

```ts
action: string;
```

Defined in: [packages/core/src/types.ts:342](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L342)

##### agent

```ts
agent: EventAgent | null;
```

Defined in: [packages/core/src/types.ts:345](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L345)

##### errorCode

```ts
errorCode: WireError | null;
```

Defined in: [packages/core/src/types.ts:348](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L348)

##### kind

```ts
kind: string | null;
```

Defined in: [packages/core/src/types.ts:347](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L347)

##### ladder

```ts
ladder: WireLadder;
```

Defined in: [packages/core/src/types.ts:344](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L344)

##### latencyMs

```ts
latencyMs: number;
```

Defined in: [packages/core/src/types.ts:346](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L346)

##### schemaVersion

```ts
schemaVersion: 1;
```

Defined in: [packages/core/src/types.ts:340](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L340)

##### status

```ts
status: WireStatus;
```

Defined in: [packages/core/src/types.ts:343](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L343)

##### tenant

```ts
tenant: string | null;
```

Defined in: [packages/core/src/types.ts:349](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L349)

##### ts

```ts
ts: string;
```

Defined in: [packages/core/src/types.ts:341](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L341)

***

### AxeReserved

Defined in: [packages/core/src/types.ts:159](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L159)

The reserved `_axe` member on an output or item.

#### Properties

##### affordances?

```ts
optional affordances?: DynamicAffordance[];
```

Defined in: [packages/core/src/types.ts:160](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L160)

***

### Brand

Defined in: [packages/core/src/types.ts:74](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L74)

#### Properties

##### accentColor?

```ts
optional accentColor?: string;
```

Defined in: [packages/core/src/types.ts:77](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L77)

##### logoUrl?

```ts
optional logoUrl?: string;
```

Defined in: [packages/core/src/types.ts:76](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L76)

##### name?

```ts
optional name?: string;
```

Defined in: [packages/core/src/types.ts:75](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L75)

##### tone?

```ts
optional tone?: WireTone;
```

Defined in: [packages/core/src/types.ts:78](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L78)

***

### Contact

Defined in: [packages/core/src/types.ts:69](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L69)

#### Properties

##### email?

```ts
optional email?: string;
```

Defined in: [packages/core/src/types.ts:70](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L70)

##### url?

```ts
optional url?: string;
```

Defined in: [packages/core/src/types.ts:71](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L71)

***

### ContinueRequest

Defined in: [packages/core/src/types.ts:230](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L230)

#### Properties

##### continuationToken

```ts
continuationToken: string;
```

Defined in: [packages/core/src/types.ts:231](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L231)

##### kind

```ts
kind: string;
```

Defined in: [packages/core/src/types.ts:232](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L232)

##### payload

```ts
payload: JsonValue;
```

Defined in: [packages/core/src/types.ts:233](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L233)

***

### Deprecation

Defined in: [packages/core/src/types.ts:179](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L179)

#### Properties

##### replacedBy?

```ts
optional replacedBy?: string;
```

Defined in: [packages/core/src/types.ts:181](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L181)

##### since

```ts
since: string;
```

Defined in: [packages/core/src/types.ts:180](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L180)

***

### Display

Defined in: [packages/core/src/types.ts:133](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L133)

#### Properties

##### disclaimer?

```ts
optional disclaimer?: string;
```

Defined in: [packages/core/src/types.ts:139](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L139)

##### emptyMessage?

```ts
optional emptyMessage?: string;
```

Defined in: [packages/core/src/types.ts:138](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L138)

##### item?

```ts
optional item?: ItemDisplay;
```

Defined in: [packages/core/src/types.ts:136](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L136)

##### items?

```ts
optional items?: string;
```

Defined in: [packages/core/src/types.ts:135](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L135)

##### kind

```ts
kind: WireDisplayKind;
```

Defined in: [packages/core/src/types.ts:134](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L134)

##### suggestedComparison?

```ts
optional suggestedComparison?: string[];
```

Defined in: [packages/core/src/types.ts:137](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L137)

***

### DynamicAffordance

Defined in: [packages/core/src/types.ts:151](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L151)

A dynamic affordance returned under `_axe`. `input` values are concrete.

#### Properties

##### action

```ts
action: string;
```

Defined in: [packages/core/src/types.ts:152](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L152)

##### input

```ts
input: Record<string, JsonValue>;
```

Defined in: [packages/core/src/types.ts:154](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L154)

##### primary?

```ts
optional primary?: boolean;
```

Defined in: [packages/core/src/types.ts:155](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L155)

##### title

```ts
title: string;
```

Defined in: [packages/core/src/types.ts:153](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L153)

***

### ErrorBody

Defined in: [packages/core/src/types.ts:268](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L268)

#### Properties

##### code

```ts
code: WireError;
```

Defined in: [packages/core/src/types.ts:269](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L269)

##### details?

```ts
optional details?: JsonObject & object;
```

Defined in: [packages/core/src/types.ts:272](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L272)

###### Type Declaration

###### issues?

```ts
optional issues?: ValidationIssue[];
```

##### message

```ts
message: string;
```

Defined in: [packages/core/src/types.ts:270](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L270)

##### retryable

```ts
retryable: boolean;
```

Defined in: [packages/core/src/types.ts:271](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L271)

***

### ErrorResult

Defined in: [packages/core/src/types.ts:302](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L302)

#### Properties

##### error

```ts
error: ErrorBody;
```

Defined in: [packages/core/src/types.ts:304](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L304)

##### status

```ts
status: "error";
```

Defined in: [packages/core/src/types.ts:303](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L303)

***

### EventAgent

Defined in: [packages/core/src/types.ts:333](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L333)

#### Properties

##### name?

```ts
optional name?: string;
```

Defined in: [packages/core/src/types.ts:335](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L335)

##### vendor?

```ts
optional vendor?: string;
```

Defined in: [packages/core/src/types.ts:334](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L334)

##### version?

```ts
optional version?: string;
```

Defined in: [packages/core/src/types.ts:336](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L336)

***

### Flow

Defined in: [packages/core/src/types.ts:81](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L81)

#### Properties

##### description

```ts
description: string;
```

Defined in: [packages/core/src/types.ts:84](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L84)

##### name

```ts
name: string;
```

Defined in: [packages/core/src/types.ts:82](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L82)

##### steps

```ts
steps: string[];
```

Defined in: [packages/core/src/types.ts:85](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L85)

##### title

```ts
title: string;
```

Defined in: [packages/core/src/types.ts:83](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L83)

***

### Freshness

Defined in: [packages/core/src/types.ts:169](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L169)

#### Properties

##### cacheTtlSeconds?

```ts
optional cacheTtlSeconds?: number;
```

Defined in: [packages/core/src/types.ts:170](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L170)

##### validUntil?

```ts
optional validUntil?: string;
```

Defined in: [packages/core/src/types.ts:171](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L171)

***

### Handoff

Defined in: [packages/core/src/types.ts:253](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L253)

#### Properties

##### expiresAt

```ts
expiresAt: string;
```

Defined in: [packages/core/src/types.ts:258](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L258)

##### instructions

```ts
instructions: string;
```

Defined in: [packages/core/src/types.ts:255](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L255)

##### reason

```ts
reason: string;
```

Defined in: [packages/core/src/types.ts:254](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L254)

##### resumeToken

```ts
resumeToken: string;
```

Defined in: [packages/core/src/types.ts:257](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L257)

##### url

```ts
url: string;
```

Defined in: [packages/core/src/types.ts:256](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L256)

##### whatAgentShouldSayToUser

```ts
whatAgentShouldSayToUser: string;
```

Defined in: [packages/core/src/types.ts:259](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L259)

***

### IndexSite

Defined in: [packages/core/src/types.ts:315](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L315)

#### Properties

##### manifestUrl

```ts
manifestUrl: string;
```

Defined in: [packages/core/src/types.ts:317](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L317)

##### name

```ts
name: string;
```

Defined in: [packages/core/src/types.ts:316](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L316)

##### tags?

```ts
optional tags?: string[];
```

Defined in: [packages/core/src/types.ts:319](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L319)

##### updatedAt

```ts
updatedAt: string;
```

Defined in: [packages/core/src/types.ts:318](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L318)

***

### ItemDisplay

Defined in: [packages/core/src/types.ts:121](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L121)

#### Properties

##### attributes?

```ts
optional attributes?: AttributeDisplay[];
```

Defined in: [packages/core/src/types.ts:129](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L129)

##### badges?

```ts
optional badges?: string[];
```

Defined in: [packages/core/src/types.ts:130](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L130)

##### id

```ts
id: string;
```

Defined in: [packages/core/src/types.ts:122](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L122)

##### image?

```ts
optional image?: string | string[];
```

Defined in: [packages/core/src/types.ts:126](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L126)

##### price?

```ts
optional price?: PriceDisplay;
```

Defined in: [packages/core/src/types.ts:128](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L128)

##### subtitle?

```ts
optional subtitle?: string;
```

Defined in: [packages/core/src/types.ts:124](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L124)

##### summary?

```ts
optional summary?: string;
```

Defined in: [packages/core/src/types.ts:125](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L125)

##### title

```ts
title: string;
```

Defined in: [packages/core/src/types.ts:123](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L123)

##### url?

```ts
optional url?: string;
```

Defined in: [packages/core/src/types.ts:127](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L127)

***

### Manifest

Defined in: [packages/core/src/types.ts:88](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L88)

#### Properties

##### actions

```ts
actions: ActionDefinition[];
```

Defined in: [packages/core/src/types.ts:95](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L95)

##### auth

```ts
auth: ManifestAuth;
```

Defined in: [packages/core/src/types.ts:94](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L94)

##### baseUrl

```ts
baseUrl: string;
```

Defined in: [packages/core/src/types.ts:92](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L92)

##### brand?

```ts
optional brand?: Brand;
```

Defined in: [packages/core/src/types.ts:99](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L99)

##### contact?

```ts
optional contact?: Contact;
```

Defined in: [packages/core/src/types.ts:98](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L98)

##### description

```ts
description: string;
```

Defined in: [packages/core/src/types.ts:91](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L91)

##### flows?

```ts
optional flows?: Flow[];
```

Defined in: [packages/core/src/types.ts:96](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L96)

##### humanFallbackUrl?

```ts
optional humanFallbackUrl?: string;
```

Defined in: [packages/core/src/types.ts:93](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L93)

##### indexUrl?

```ts
optional indexUrl?: string;
```

Defined in: [packages/core/src/types.ts:100](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L100)

##### name

```ts
name: string;
```

Defined in: [packages/core/src/types.ts:90](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L90)

##### policies?

```ts
optional policies?: Policies;
```

Defined in: [packages/core/src/types.ts:97](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L97)

##### protocol

```ts
protocol: string;
```

Defined in: [packages/core/src/types.ts:89](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L89)

##### updatedAt?

```ts
optional updatedAt?: string;
```

Defined in: [packages/core/src/types.ts:101](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L101)

***

### ManifestAuth

Defined in: [packages/core/src/types.ts:47](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L47)

#### Properties

##### modes

```ts
modes: WireAuthMode[];
```

Defined in: [packages/core/src/types.ts:48](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L48)

##### userLoginUrl?

```ts
optional userLoginUrl?: string;
```

Defined in: [packages/core/src/types.ts:49](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L49)

***

### NeedsHumanResult

Defined in: [packages/core/src/types.ts:290](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L290)

#### Properties

##### handoff

```ts
handoff: Handoff;
```

Defined in: [packages/core/src/types.ts:292](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L292)

##### status

```ts
status: "needs_human";
```

Defined in: [packages/core/src/types.ts:291](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L291)

***

### NeedsInputResult

Defined in: [packages/core/src/types.ts:280](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L280)

#### Properties

##### accepts

```ts
accepts: Accept[];
```

Defined in: [packages/core/src/types.ts:284](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L284)

##### continuationToken

```ts
continuationToken: string;
```

Defined in: [packages/core/src/types.ts:285](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L285)

##### expiresAt

```ts
expiresAt: string;
```

Defined in: [packages/core/src/types.ts:286](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L286)

##### fallback?

```ts
optional fallback?: Handoff;
```

Defined in: [packages/core/src/types.ts:287](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L287)

##### message

```ts
message: string;
```

Defined in: [packages/core/src/types.ts:283](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L283)

##### reason

```ts
reason: string;
```

Defined in: [packages/core/src/types.ts:282](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L282)

##### status

```ts
status: "needs_input";
```

Defined in: [packages/core/src/types.ts:281](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L281)

***

### OkResult

Defined in: [packages/core/src/types.ts:275](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L275)

#### Type Parameters

##### O

`O` = [`JsonValue`](#jsonvalue)

#### Properties

##### output

```ts
output: O;
```

Defined in: [packages/core/src/types.ts:277](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L277)

##### status

```ts
status: "ok";
```

Defined in: [packages/core/src/types.ts:276](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L276)

***

### Pagination

Defined in: [packages/core/src/types.ts:163](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L163)

#### Properties

##### cursorIn

```ts
cursorIn: string;
```

Defined in: [packages/core/src/types.ts:164](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L164)

##### cursorOut

```ts
cursorOut: string;
```

Defined in: [packages/core/src/types.ts:165](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L165)

##### pageSize

```ts
pageSize: object;
```

Defined in: [packages/core/src/types.ts:166](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L166)

###### default

```ts
default: number;
```

###### max

```ts
max: number;
```

***

### PendingResult

Defined in: [packages/core/src/types.ts:295](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L295)

#### Properties

##### expiresAt?

```ts
optional expiresAt?: string;
```

Defined in: [packages/core/src/types.ts:299](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L299)

##### pollUrl

```ts
pollUrl: string;
```

Defined in: [packages/core/src/types.ts:297](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L297)

##### retryAfter

```ts
retryAfter: number;
```

Defined in: [packages/core/src/types.ts:298](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L298)

##### status

```ts
status: "pending";
```

Defined in: [packages/core/src/types.ts:296](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L296)

***

### PlatformIndex

Defined in: [packages/core/src/types.ts:322](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L322)

#### Properties

##### next?

```ts
optional next?: string;
```

Defined in: [packages/core/src/types.ts:326](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L326)

##### platform

```ts
platform: object;
```

Defined in: [packages/core/src/types.ts:324](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L324)

###### name

```ts
name: string;
```

###### url

```ts
url: string;
```

##### protocol

```ts
protocol: string;
```

Defined in: [packages/core/src/types.ts:323](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L323)

##### sites

```ts
sites: IndexSite[];
```

Defined in: [packages/core/src/types.ts:325](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L325)

***

### Policies

Defined in: [packages/core/src/types.ts:62](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L62)

#### Properties

##### agents?

```ts
optional agents?: AgentPolicy;
```

Defined in: [packages/core/src/types.ts:66](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L66)

##### dataRetention?

```ts
optional dataRetention?: string;
```

Defined in: [packages/core/src/types.ts:65](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L65)

##### rateLimit?

```ts
optional rateLimit?: RateLimitPolicy;
```

Defined in: [packages/core/src/types.ts:63](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L63)

##### termsUrl?

```ts
optional termsUrl?: string;
```

Defined in: [packages/core/src/types.ts:64](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L64)

***

### PriceDisplay

Defined in: [packages/core/src/types.ts:108](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L108)

#### Properties

##### amount

```ts
amount: string;
```

Defined in: [packages/core/src/types.ts:109](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L109)

##### currency

```ts
currency: string;
```

Defined in: [packages/core/src/types.ts:110](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L110)

##### period?

```ts
optional period?: WirePeriod;
```

Defined in: [packages/core/src/types.ts:111](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L111)

***

### RateLimitPolicy

Defined in: [packages/core/src/types.ts:52](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L52)

#### Properties

##### burst?

```ts
optional burst?: number;
```

Defined in: [packages/core/src/types.ts:54](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L54)

##### requestsPerMinute

```ts
requestsPerMinute: number;
```

Defined in: [packages/core/src/types.ts:53](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L53)

***

### RequestContext

Defined in: [packages/core/src/types.ts:216](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L216)

#### Properties

##### agent?

```ts
optional agent?: AgentIdentification;
```

Defined in: [packages/core/src/types.ts:220](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L220)

##### locale?

```ts
optional locale?: string;
```

Defined in: [packages/core/src/types.ts:218](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L218)

##### onBehalfOf?

```ts
optional onBehalfOf?: string;
```

Defined in: [packages/core/src/types.ts:217](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L217)

##### sessionId?

```ts
optional sessionId?: string;
```

Defined in: [packages/core/src/types.ts:221](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L221)

##### timezone?

```ts
optional timezone?: string;
```

Defined in: [packages/core/src/types.ts:219](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L219)

***

### RequestEnvelope

Defined in: [packages/core/src/types.ts:224](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L224)

#### Type Parameters

##### I

`I` = [`JsonValue`](#jsonvalue)

#### Properties

##### context?

```ts
optional context?: RequestContext;
```

Defined in: [packages/core/src/types.ts:226](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L226)

##### idempotencyKey?

```ts
optional idempotencyKey?: string;
```

Defined in: [packages/core/src/types.ts:227](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L227)

##### input

```ts
input: I;
```

Defined in: [packages/core/src/types.ts:225](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L225)

***

### ResumeRequest

Defined in: [packages/core/src/types.ts:236](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L236)

#### Properties

##### resumeToken

```ts
resumeToken: string;
```

Defined in: [packages/core/src/types.ts:237](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L237)

***

### ValidationIssue

Defined in: [packages/core/src/types.ts:262](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L262)

#### Properties

##### expected?

```ts
optional expected?: string;
```

Defined in: [packages/core/src/types.ts:265](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L265)

##### message

```ts
message: string;
```

Defined in: [packages/core/src/types.ts:264](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L264)

##### path

```ts
path: string;
```

Defined in: [packages/core/src/types.ts:263](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L263)

## Type Aliases

### AttributeFormat

```ts
type AttributeFormat = WireFormat;
```

Defined in: [packages/core/src/types.ts:38](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L38)

***

### AuthMode

```ts
type AuthMode = WireAuthMode;
```

Defined in: [packages/core/src/types.ts:33](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L33)

***

### BrandTone

```ts
type BrandTone = WireTone;
```

Defined in: [packages/core/src/types.ts:41](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L41)

***

### CompareDirection

```ts
type CompareDirection = WireCompare;
```

Defined in: [packages/core/src/types.ts:39](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L39)

***

### DisplayKind

```ts
type DisplayKind = WireDisplayKind;
```

Defined in: [packages/core/src/types.ts:37](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L37)

***

### ErrorCode

```ts
type ErrorCode = WireError;
```

Defined in: [packages/core/src/types.ts:35](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L35)

***

### JsonObject

```ts
type JsonObject = object;
```

Defined in: [packages/core/src/types.ts:24](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L24)

A JSON object.

#### Index Signature

```ts
[key: string]: JsonValue
```

***

### JsonPointer

```ts
type JsonPointer = string;
```

Defined in: [packages/core/src/types.ts:30](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L30)

An RFC 6901 JSON Pointer, for example `/units` or `/price/amount`.

***

### JsonSchema

```ts
type JsonSchema = object;
```

Defined in: [packages/core/src/types.ts:27](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L27)

A JSON Schema document (draft 2020-12). Kept loose on purpose; the SDK generates these.

#### Index Signature

```ts
[key: string]: unknown
```

***

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

Defined in: [packages/core/src/types.ts:21](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L21)

A JSON value.

***

### Ladder

```ts
type Ladder = WireLadder;
```

Defined in: [packages/core/src/types.ts:36](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L36)

***

### PricePeriod

```ts
type PricePeriod = WirePeriod;
```

Defined in: [packages/core/src/types.ts:40](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L40)

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

Defined in: [packages/core/src/types.ts:308](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L308)

The result envelope: every AXE response body is one of these.

#### Type Parameters

##### O

`O` = [`JsonValue`](#jsonvalue)

***

### ResultStatus

```ts
type ResultStatus = WireStatus;
```

Defined in: [packages/core/src/types.ts:34](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L34)

***

### Risk

```ts
type Risk = WireRisk;
```

Defined in: [packages/core/src/types.ts:32](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/types.ts#L32)
