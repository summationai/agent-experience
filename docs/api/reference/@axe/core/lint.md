[AXE API reference](../../README.md) / [@axe/core](README.md) / lint

# lint

## Interfaces

<a id="lintissue"></a>

### LintIssue

#### Properties

<a id="docs"></a>

##### docs

```ts
docs: string;
```

The doc section that explains the fix.

<a id="excerpt"></a>

##### excerpt?

```ts
optional excerpt?: string;
```

The offending text or value, when applicable.

<a id="location"></a>

##### location

```ts
location: string;
```

Where the problem is: an action name and field, or a manifest field.

<a id="message"></a>

##### message

```ts
message: string;
```

<a id="rule"></a>

##### rule

```ts
rule: LintRule;
```

Stable rule identifier.

<a id="severity"></a>

##### severity

```ts
severity: LintSeverity;
```

***

<a id="linttextoptions"></a>

### LintTextOptions

#### Properties

<a id="checklength"></a>

##### checkLength?

```ts
optional checkLength?: boolean;
```

Apply the 40–400 character rule (for `description` fields).

<a id="location-1"></a>

##### location?

```ts
optional location?: string;
```

Dotted location for the report, e.g. `units.search.description`.

## Type Aliases

<a id="lintrule"></a>

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

***

<a id="lintseverity"></a>

### LintSeverity

```ts
type LintSeverity = "error" | "warning";
```

## Variables

<a id="agent_directive_patterns"></a>

### AGENT\_DIRECTIVE\_PATTERNS

```ts
const AGENT_DIRECTIVE_PATTERNS: readonly RegExp[];
```

Imperatives aimed at the agent. Each pattern is a prompt-injection shape seen in
the wild, generalized. Matching any of these is a hard failure.

***

<a id="persuasion_patterns"></a>

### PERSUASION\_PATTERNS

```ts
const PERSUASION_PATTERNS: readonly RegExp[];
```

Superlatives and comparative marketing claims. Reported, not fatal.

## Functions

<a id="agentreadtext"></a>

### agentReadText()

```ts
function agentReadText(action): object[];
```

Every agent-read text field of an action, as (location, text) pairs.

#### Parameters

##### action

[`ActionDefinition`](types.md#actiondefinition)

#### Returns

`object`[]

***

<a id="haslinterrors"></a>

### hasLintErrors()

```ts
function hasLintErrors(issues): boolean;
```

True when any issue is an error.

#### Parameters

##### issues

readonly [`LintIssue`](#lintissue)[]

#### Returns

`boolean`

***

<a id="isbarequerysearch"></a>

### isBareQuerySearch()

```ts
function isBareQuerySearch(input): boolean;
```

Whether an input schema is a "search box": its only property is free text.

#### Parameters

##### input

[`JsonSchema`](types.md#jsonschema)

#### Returns

`boolean`

***

<a id="lintaction"></a>

### lintAction()

```ts
function lintAction(action): LintIssue[];
```

Apply every lint rule to one action.

#### Parameters

##### action

[`ActionDefinition`](types.md#actiondefinition)

#### Returns

[`LintIssue`](#lintissue)[]

***

<a id="lintagenttext"></a>

### lintAgentText()

```ts
function lintAgentText(text, options?): LintIssue[];
```

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

<a id="lintmanifest"></a>

### lintManifest()

```ts
function lintManifest(manifest): LintIssue[];
```

Apply every lint rule to a manifest.

#### Parameters

##### manifest

[`Manifest`](types.md#manifest)

#### Returns

[`LintIssue`](#lintissue)[]
