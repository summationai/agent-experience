[AXE API reference](../../README.md) / [@axe/core](README.md) / lint

# lint

## Interfaces

### LintIssue

Defined in: [packages/core/src/lint.ts:10](https://github.com/summationai/code/blob/54a1262160105150fe4db73da113f831554c9fbe/axe/packages/core/src/lint.ts#L10)

#### Properties

##### docs

```ts
docs: string;
```

Defined in: [packages/core/src/lint.ts:20](https://github.com/summationai/code/blob/54a1262160105150fe4db73da113f831554c9fbe/axe/packages/core/src/lint.ts#L20)

The doc section that explains the fix.

##### excerpt?

```ts
optional excerpt?: string;
```

Defined in: [packages/core/src/lint.ts:18](https://github.com/summationai/code/blob/54a1262160105150fe4db73da113f831554c9fbe/axe/packages/core/src/lint.ts#L18)

The offending text or value, when applicable.

##### location

```ts
location: string;
```

Defined in: [packages/core/src/lint.ts:15](https://github.com/summationai/code/blob/54a1262160105150fe4db73da113f831554c9fbe/axe/packages/core/src/lint.ts#L15)

Where the problem is: an action name and field, or a manifest field.

##### message

```ts
message: string;
```

Defined in: [packages/core/src/lint.ts:16](https://github.com/summationai/code/blob/54a1262160105150fe4db73da113f831554c9fbe/axe/packages/core/src/lint.ts#L16)

##### rule

```ts
rule: LintRule;
```

Defined in: [packages/core/src/lint.ts:12](https://github.com/summationai/code/blob/54a1262160105150fe4db73da113f831554c9fbe/axe/packages/core/src/lint.ts#L12)

Stable rule identifier.

##### severity

```ts
severity: LintSeverity;
```

Defined in: [packages/core/src/lint.ts:13](https://github.com/summationai/code/blob/54a1262160105150fe4db73da113f831554c9fbe/axe/packages/core/src/lint.ts#L13)

***

### LintTextOptions

Defined in: [packages/core/src/lint.ts:82](https://github.com/summationai/code/blob/54a1262160105150fe4db73da113f831554c9fbe/axe/packages/core/src/lint.ts#L82)

#### Properties

##### checkLength?

```ts
optional checkLength?: boolean;
```

Defined in: [packages/core/src/lint.ts:86](https://github.com/summationai/code/blob/54a1262160105150fe4db73da113f831554c9fbe/axe/packages/core/src/lint.ts#L86)

Apply the 40–400 character rule (for `description` fields).

##### location?

```ts
optional location?: string;
```

Defined in: [packages/core/src/lint.ts:84](https://github.com/summationai/code/blob/54a1262160105150fe4db73da113f831554c9fbe/axe/packages/core/src/lint.ts#L84)

Dotted location for the report, e.g. `units.search.description`.

## Type Aliases

### LintRule

```ts
type LintRule = 
  | "agent-directive"
  | "persuasion"
  | "description-length"
  | "missing-examples"
  | "bare-query-search"
  | "affordance-count"
  | "multiple-primary"
  | "deprecated-without-replacement"
  | "missing-input-descriptions"
  | "missing-display"
  | "missing-display-url"
  | "missing-disclaimer"
  | "readonly-contradiction"
  | "risk-none-on-mutation";
```

Defined in: [packages/core/src/lint.ts:23](https://github.com/summationai/code/blob/54a1262160105150fe4db73da113f831554c9fbe/axe/packages/core/src/lint.ts#L23)

***

### LintSeverity

```ts
type LintSeverity = "error" | "warning";
```

Defined in: [packages/core/src/lint.ts:8](https://github.com/summationai/code/blob/54a1262160105150fe4db73da113f831554c9fbe/axe/packages/core/src/lint.ts#L8)

## Variables

### AGENT\_DIRECTIVE\_PATTERNS

```ts
const AGENT_DIRECTIVE_PATTERNS: readonly RegExp[];
```

Defined in: [packages/core/src/lint.ts:45](https://github.com/summationai/code/blob/54a1262160105150fe4db73da113f831554c9fbe/axe/packages/core/src/lint.ts#L45)

Imperatives aimed at the agent. Each pattern is a prompt-injection shape seen in
the wild, generalized. Matching any of these is a hard failure.

***

### PERSUASION\_PATTERNS

```ts
const PERSUASION_PATTERNS: readonly RegExp[];
```

Defined in: [packages/core/src/lint.ts:61](https://github.com/summationai/code/blob/54a1262160105150fe4db73da113f831554c9fbe/axe/packages/core/src/lint.ts#L61)

Superlatives and comparative marketing claims. Reported, not fatal.

## Functions

### agentReadText()

```ts
function agentReadText(action): object[];
```

Defined in: [packages/core/src/lint.ts:170](https://github.com/summationai/code/blob/54a1262160105150fe4db73da113f831554c9fbe/axe/packages/core/src/lint.ts#L170)

Every agent-read text field of an action, as (location, text) pairs.

#### Parameters

##### action

[`ActionDefinition`](types.md#actiondefinition)

#### Returns

`object`[]

***

### hasLintErrors()

```ts
function hasLintErrors(issues): boolean;
```

Defined in: [packages/core/src/lint.ts:393](https://github.com/summationai/code/blob/54a1262160105150fe4db73da113f831554c9fbe/axe/packages/core/src/lint.ts#L393)

True when any issue is an error.

#### Parameters

##### issues

readonly [`LintIssue`](#lintissue)[]

#### Returns

`boolean`

***

### isBareQuerySearch()

```ts
function isBareQuerySearch(input): boolean;
```

Defined in: [packages/core/src/lint.ts:210](https://github.com/summationai/code/blob/54a1262160105150fe4db73da113f831554c9fbe/axe/packages/core/src/lint.ts#L210)

Whether an input schema is a "search box": its only property is free text.

#### Parameters

##### input

[`JsonSchema`](types.md#jsonschema)

#### Returns

`boolean`

***

### lintAction()

```ts
function lintAction(action): LintIssue[];
```

Defined in: [packages/core/src/lint.ts:240](https://github.com/summationai/code/blob/54a1262160105150fe4db73da113f831554c9fbe/axe/packages/core/src/lint.ts#L240)

Apply every lint rule to one action.

#### Parameters

##### action

[`ActionDefinition`](types.md#actiondefinition)

#### Returns

[`LintIssue`](#lintissue)[]

***

### lintAgentText()

```ts
function lintAgentText(text, options?): LintIssue[];
```

Defined in: [packages/core/src/lint.ts:93](https://github.com/summationai/code/blob/54a1262160105150fe4db73da113f831554c9fbe/axe/packages/core/src/lint.ts#L93)

Apply the honesty rules to one agent-read string.
Returns `agent-directive` errors, `persuasion` warnings, and optionally `description-length`.

#### Parameters

##### text

`string`

##### options?

[`LintTextOptions`](#linttextoptions) = `{}`

#### Returns

[`LintIssue`](#lintissue)[]

***

### lintManifest()

```ts
function lintManifest(manifest): LintIssue[];
```

Defined in: [packages/core/src/lint.ts:369](https://github.com/summationai/code/blob/54a1262160105150fe4db73da113f831554c9fbe/axe/packages/core/src/lint.ts#L369)

Apply every lint rule to a manifest.

#### Parameters

##### manifest

[`Manifest`](types.md#manifest)

#### Returns

[`LintIssue`](#lintissue)[]
