[AXE API reference](../../README.md) / [@summationai/axe-core](README.md) / json-schema

# json-schema

## Interfaces

<a id="schemaproblem"></a>

### SchemaProblem

One construct in a schema that the validator will refuse to apply, or that deserves a warning.

#### Properties

<a id="keyword"></a>

##### keyword

```ts
keyword: string;
```

What is there: a keyword, `pattern`, `format`, or `$ref`.

<a id="message"></a>

##### message

```ts
message: string;
```

<a id="path"></a>

##### path

```ts
path: string;
```

JSON Pointer into the schema.

<a id="severity"></a>

##### severity

```ts
severity: "error" | "warning";
```

`error`: every value is refused. `warning`: applied, with a risk the author should know.

## Variables

<a id="supported_schema_keywords"></a>

### SUPPORTED\_SCHEMA\_KEYWORDS

```ts
const SUPPORTED_SCHEMA_KEYWORDS: object;
```

The keywords the validator implements, and the ones it ignores as annotations. Anything else
(except an `x-` extension) makes validation fail with an issue naming the keyword.

#### Type Declaration

<a id="annotations"></a>

##### annotations

```ts
readonly annotations: readonly string[];
```

<a id="assertions"></a>

##### assertions

```ts
readonly assertions: readonly string[];
```

<a id="formats"></a>

##### formats

```ts
readonly formats: readonly string[];
```

## Functions

<a id="compilepattern"></a>

### compilePattern()

```ts
function compilePattern(pattern): RegExp | null;
```

Compile a schema `pattern` as ECMAScript with the `u` flag, falling back to no flag for patterns
written for plain JavaScript. Null when it compiles neither way.

#### Parameters

##### pattern

`string`

#### Returns

`RegExp` \| `null`

***

<a id="deepequal"></a>

### deepEqual()

```ts
function deepEqual(a, b): boolean;
```

#### Parameters

##### a

`unknown`

##### b

`unknown`

#### Returns

`boolean`

***

<a id="isbacktrackingpattern"></a>

### isBacktrackingPattern()

```ts
function isBacktrackingPattern(pattern): boolean;
```

Whether a pattern has the shape that backtracks catastrophically in a backtracking engine: a
group repeated without bound (`+`, `*`, `{n,}`) whose body ends in an unbounded repetition that
no required atom follows, as in `(a+)+`, `(a*)*`, or `(\w+\s?)*`. `(\w+\.)*` is not
flagged: the required `.` ends each round. A heuristic: it finds the common shape, not every
one (overlapping alternatives such as `(a|aa)+` are not detected).

#### Parameters

##### pattern

`string`

#### Returns

`boolean`

***

<a id="schemaproblems"></a>

### schemaProblems()

```ts
function schemaProblems(schema): SchemaProblem[];
```

Walk a schema without a value and report what `validateJsonSchema` would refuse to apply
(unsupported keywords, formats it cannot check, patterns that do not compile, non-local or
unresolvable refs) and patterns shaped for catastrophic backtracking. Used by the lint and
`axe validate` so an author learns at registration, not from a refused payload.

#### Parameters

##### schema

`boolean` \| [`JsonSchema`](types.md#jsonschema)

#### Returns

[`SchemaProblem`](#schemaproblem)[]

***

<a id="schemasstructurallyequal"></a>

### schemasStructurallyEqual()

```ts
function schemasStructurallyEqual(a, b): boolean;
```

Structural equivalence of two schemas, ignoring `title`, `description`, `$id`,
`$schema`, `examples`, and `default`. Used to detect custom kinds that duplicate
a well-known kind.

#### Parameters

##### a

[`JsonSchema`](types.md#jsonschema)

##### b

[`JsonSchema`](types.md#jsonschema)

#### Returns

`boolean`

***

<a id="validatejsonschema"></a>

### validateJsonSchema()

```ts
function validateJsonSchema(schema, value): ValidationIssue[];
```

Validate `value` against `schema`. Returns an empty array when valid, otherwise
one issue per problem, each with a JSON Pointer `path` relative to `value`. Never throws: a
schema the validator cannot apply yields an issue, so the value is refused ([P-SCHEMA-2]).

#### Parameters

##### schema

[`JsonSchema`](types.md#jsonschema)

##### value

`unknown`

#### Returns

[`ValidationIssue`](types.md#validationissue)[]
