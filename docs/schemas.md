# Schemas: the supported subset

Every schema you publish (an action's `input` and `output`, each `accepts[].schema`) is read twice: by an agent that builds a value from it, and by a validator that checks the value. If the validator ignored a keyword it did not understand, it would accept values you meant to refuse, and the agent would never know. So AXE fixes a subset of JSON Schema draft 2020-12, and anything outside it fails loudly ([spec §5.4](../spec/AXE-PROTOCOL.md#54-schemas-the-supported-subset)).

Three pieces of the SDK handle schemas:

- **The validator**, `validateJsonSchema` in `@summationai/axe-core/json-schema`. It checks continuation payloads on the server, a Surface field's `edit.schema` in the browser, tool arguments in the derived MCP server, and examples in the conformance suite. Action inputs are validated by your Zod schema, not by it.
- **Zod to JSON Schema**, `toJsonSchema` in `@summationai/axe-core`, which publishes your Zod schemas in the manifest. It uses Zod 4's own converter.
- **JSON Schema to Zod**, `jsonSchemaToZod` in `@summationai/axe-generate`, which turns an OpenAPI document's schemas into Zod when you [generate actions](generating.md).

## The supported subset

| Keyword                                                                 | Validator                                                                                                        | Zod to JSON Schema                                              | `@summationai/axe-generate`                                                                    |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `type` (one or a list; `integer`)                                       | Checked                                                                                                          | Emitted                                                         | Converted, `nullable` too                                                          |
| `enum`, `const`                                                         | Checked, deep equality                                                                                           | Emitted                                                         | Primitive values; anything else becomes unknown, with a warning                    |
| `properties`, `required`                                                | Checked on own members only                                                                                      | Emitted                                                         | Converted                                                                          |
| `additionalProperties`                                                  | Checked                                                                                                          | `false` for `.strict()`, a schema for `.catchall()`            | `false` is strict; a schema is a record or a catchall; `true` is loose             |
| `patternProperties`, `propertyNames`                                    | Checked                                                                                                          | `propertyNames` for `z.record` keys                             | Dropped, with a warning                                                            |
| `minProperties`, `maxProperties`, `dependentRequired`, `dependentSchemas` | Checked                                                                                                        | Not emitted                                                     | Dropped, with a warning                                                            |
| `items` (a schema), `minItems`, `maxItems`                              | Checked                                                                                                          | Emitted                                                         | Converted                                                                          |
| `prefixItems`                                                           | Checked                                                                                                          | Emitted for `z.tuple`                                           | Dropped, with a warning                                                            |
| `uniqueItems`, `contains`, `minContains`, `maxContains`                 | Checked                                                                                                          | Not emitted                                                     | Dropped, with a warning                                                            |
| `minLength`, `maxLength`                                                | Checked, in code points                                                                                          | Emitted                                                         | Converted, with or without a `format`                                              |
| `pattern`                                                               | Checked as ECMAScript; one that does not compile refuses every value                                             | Emitted                                                         | Converted; one that does not compile is dropped, with a warning                    |
| `format`                                                                | `date`, `date-time`, `time`, `duration`, `email`, `uri`, `uuid`, `ipv4`, `jwt`; any other only through a `pattern` | Emitted, with a `pattern` for most formats                     | `date-time`, `date`, `time`, `email`, `uri`, `url`, `uuid`; any other is dropped, with a warning |
| `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`            | Checked                                                                                                          | Emitted                                                         | Converted                                                                          |
| `multipleOf`                                                            | Checked exactly on decimals                                                                                      | Emitted                                                         | Converted                                                                          |
| `allOf`                                                                 | Checked                                                                                                          | Emitted (intersections, several string checks)                  | Object members merged; any other shape becomes unknown, with a warning             |
| `anyOf`                                                                 | Checked                                                                                                          | Emitted (unions, nullable)                                      | A union                                                                            |
| `oneOf`                                                                 | Checked: exactly one must match                                                                                  | Emitted for discriminated unions                                | A union: exclusivity is not enforced                                               |
| `not`                                                                   | Checked                                                                                                          | Emitted for `z.never()`                                         | Dropped, with a warning                                                            |
| `if`, `then`, `else`                                                    | Checked                                                                                                          | Not emitted                                                     | Dropped, with a warning                                                            |
| `$ref`, `$defs`                                                         | `#` and `#/...` in the same document; a loop that consumes nothing refuses                                       | Emitted only for recursive types                                | Local refs; a recursive ref becomes unknown, with a warning                        |
| `unevaluatedProperties`, `unevaluatedItems`, `$dynamicRef`, `dependencies`, `additionalItems`, an array `items`, any other keyword | Refuses every value                                          | Never emitted                                                   | Dropped, with a warning                                                            |
| Annotations (`title`, `description`, `default`, `examples`, `readOnly`, `deprecated`, `$comment`, `$id`, `content*`) and `x-` keywords | Ignored                                                        | `description` and `default` emitted; `x-axe-refined` added (below) | `description` and `default` used                                                   |

`SUPPORTED_SCHEMA_KEYWORDS` in `@summationai/axe-core/json-schema` lists the validator's assertions, annotations, and formats, for tools that need the list.

## How unsupported constructs fail

The validator never throws and never widens. Each of these is an issue, so the value is refused with `invalid_input` and a message naming the construct:

- a keyword outside the subset;
- a `format` it cannot check, unless a `pattern` in the same schema (or in an `allOf` member, which is how Zod writes `z.string().startsWith(...)`) carries the constraint;
- a `pattern` that does not compile;
- a `$ref` that is not local (`https://...`), uses a plain-name fragment (`#anchor`), or does not resolve;
- a `$ref` loop that consumes no part of the value, such as `{ "$ref": "#" }`;
- nesting deeper than 128 levels of schema and value.

Object members are the value's own members: `__proto__` and `constructor` are ordinary names, so `additionalProperties: false` refuses them and `required` is never satisfied by anything inherited.

A refused payload tells you about a broken schema in production. Find it earlier: `lintAction` (and so `axe validate` and `axe audit`) reports each construct as an `unsupported-schema` error, and `schemaProblems(schema)` returns the same list for a schema you wrote by hand.

<!-- include: examples/schemas/refined.ts#problems -->
```ts
// A hand-written JSON Schema, checked before it is published. Each problem is a construct the
// SDK's validator would refuse to apply (so every payload would fail) or a risky pattern.
const payment = {
  type: "object",
  properties: {
    reference: { type: "string", pattern: "^(\\w+\\s?)*$" }, // backtracks: warning
    iban: { type: "string", format: "iban" }, // no checker, no pattern: error
  },
  unevaluatedProperties: false, // not in the subset: error
};
for (const p of schemaProblems(payment)) console.log(p.severity, p.path, p.message);

// The validator fails closed on the same schema: the payload is refused, never accepted as if
// the unsupported keyword were absent.
console.log(validateJsonSchema(payment, { reference: "ok", iban: "DE89370400440532013000" }));
```
<!-- /include -->

`multipleOf` is exact on the decimal values as written: `0.3` is a multiple of `0.1`, and `0.30000000000000004` is not. A divisor that is zero or negative matches nothing.

## Patterns

A `pattern` is an ECMAScript regular expression, compiled with the `u` flag when it compiles that way and without it otherwise. It runs a regular expression you wrote against text an agent sent, in a backtracking engine, so a pattern with nested repetition can take exponential time on a crafted string: `^(\w+\s?)*$` against 28 word characters and a `!` takes about a second in Node 24, and each further character doubles it.

- The lint warns on the common shape as `backtracking-pattern`: a group repeated with `+`, `*`, or `{n,}` whose body ends in a repetition that nothing required follows (`(a+)+`, `(a*)*`, `(\w+\s?)*`). `(\w+\.)*` is not flagged, because the required `.` ends each round. It is a heuristic; it does not detect overlapping alternatives such as `(a|aa)+`. `isBacktrackingPattern` exposes it.
- Zod's own patterns for `z.email()`, `z.uuid()`, `z.ipv6()`, `z.hostname()`, and the other built-in formats do not trip it.
- The request body limit (`maxBodyBytes`, 1 MiB by default) bounds the input any pattern sees. It does not make a catastrophic pattern safe; rewrite the pattern, or bound the field with `maxLength` before it.

The same applies to `.regex()` on your Zod input schemas, which run on every call: the lint reads the published JSON Schema, so it sees them too.

## Refinements and transforms

Zod can check things JSON Schema cannot say. When the server checks more than the published schema, the manifest says so: `toJsonSchema` adds `"x-axe-refined": true` to each input node whose Zod schema has

- a `.refine`, `.superRefine`, or a custom `.check`;
- a custom type (`z.custom`) or a type JSON cannot carry (`z.date()`, `z.bigint()`, `z.map()`, `z.set()`, and the like, which Zod publishes as `{}`, any value);
- a `z.preprocess`, whose input side is a function.

An agent reading the manifest learns that a value matching that node may still be refused with `invalid_input`. The lint reports each node as a `refined-schema` warning, so you decide whether the field's `description` says what the check is. Output schemas are not annotated: the server validates its own output, and agents do not build it.

<!-- include: examples/schemas/refined.ts#refined -->
```ts
// A check JSON Schema cannot express: the visit must be on a weekday. The published input
// schema says "a date string" and marks the node x-axe-refined, so an agent knows a
// well-formed date can still be refused with invalid_input. The description says why.
export const scheduleVisit = action("visits.schedule", {
  title: "Schedule a campus visit",
  description:
    "Books a campus tour for the applicant on a weekday and returns the visit id and start time.",
  risk: "low",
  input: z.object({
    date: z.iso
      .date()
      .refine(
        (d) => ![0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay()),
        "weekends are closed",
      )
      .describe("Visit date, a weekday, e.g. 2026-10-06"),
  }),
  output: z.object({ visitId: z.string(), startsAt: z.string() }),
  handler: async ({ input }) => ({ visitId: "v_1", startsAt: `${input.date}T10:00:00-07:00` }),
});

// scheduleVisit.definition.input.properties.date carries "x-axe-refined": true, and the lint
// reports it as a `refined-schema` warning so the author decides it is said clearly enough.
for (const issue of lintAction(scheduleVisit.definition))
  if (issue.rule === "refined-schema") console.warn(`${issue.location}: ${issue.message}`);
```
<!-- /include -->

What is not annotated, and why:

- **Transforms** (`.transform`). The published schema describes what the agent sends, and that is unchanged; the handler receives the transformed value. A transform that rejects values is a refinement in disguise: write the check as `.refine` before the `.transform`, so it is annotated.
- **Defaults** (`.default`). Zod publishes the member as optional with a `default`; the handler receives the filled-in value.
- **Coercion** (`z.coerce.number()`). The server accepts more than the schema says (`"5"` as well as `5`). The published schema is the stricter one, which agents follow.

## Input as sent, input as parsed

The handler receives the parsed value: defaults filled in, transforms applied, unknown members stripped by a non-strict `z.object`. The fingerprint that decides whether a retry is the same operation is the input as sent, canonicalized (keys sorted), never the parsed value ([P-SCHEMA-6](../spec/AXE-PROTOCOL.md#54-schemas-the-supported-subset)):

- A parsed value can hold what JSON cannot. With `z.string().transform((s) => new Date(s))`, every date would fingerprint as `{}`, and a retry with a different date under the same `idempotencyKey` would get the first date's result instead of `conflict`.
- A retry of an action that no longer exists can only be matched on what was sent.
- A login handoff stores the input as sent and parses it once, when the action finally runs, so a transform does not run twice.

So `{ "note": "none" }` and `{}` are different requests under one key even when `note` defaults to `"none"`: the second is `conflict`. An agent retrying after a lost response sends the same body, so this costs it nothing.

## Why the validator is not Ajv

Ajv is the mature choice for full JSON Schema. It was measured against the in-house validator, minified and bundled for the browser with esbuild:

| Validator                                   | Minified | Gzipped |
| ------------------------------------------- | -------- | ------- |
| `@summationai/axe-core/json-schema` (this subset)       | 10 kB    | 3.6 kB  |
| Ajv 8, draft 2020-12 entry                  | 134 kB   | 40 kB   |
| Ajv 8, draft 2020-12 entry and `ajv-formats` | 148 kB   | 44 kB   |

The validator ships in the browser entry of `@summationai/axe-surface` (for `edit.schema`), which is held under 50 kB with no Zod, and Ajv compiles schemas with `new Function`, which a strict Content Security Policy and Cloudflare Workers refuse. The subset covers what Zod emits and what the well-known kinds use; what it does not cover, it refuses. The decision is recorded in [DECISIONS.md](../DECISIONS.md).

## Next steps

- [Designing actions](designing-actions.md): what to put in a schema so an agent can fill it in.
- [Requirements and kinds](requirements-and-kinds.md): the schemas on `accepts[]`, validated with this validator.
- [Security](security.md): the threat model, including resource exhaustion.
