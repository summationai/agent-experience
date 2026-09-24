[AXE API reference](../../README.md) / [@axe/core](README.md) / json-schema

# json-schema

## Functions

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
one issue per problem, each with a JSON Pointer `path` relative to `value`.

#### Parameters

##### schema

[`JsonSchema`](types.md#jsonschema)

##### value

`unknown`

#### Returns

[`ValidationIssue`](types.md#validationissue)[]
