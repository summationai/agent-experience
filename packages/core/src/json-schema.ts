/**
 * A small, dependency-free JSON Schema (draft 2020-12) validator for the subset the SDK generates
 * from Zod and the subset well-known kinds use. Spec §5.4 ([P-SCHEMA-1] to [P-SCHEMA-5]) and
 * docs/schemas.md list exactly what it checks.
 *
 * It fails closed. A keyword it does not implement, a `format` it cannot check, a `pattern` that
 * does not compile, a `$ref` it cannot resolve or that loops without consuming the value: each is
 * reported as an issue, so the value is refused rather than accepted under a looser schema than
 * the author wrote. Annotations (`title`, `description`, `default`, `examples`, ...) and `x-`
 * extension keywords are ignored.
 *
 * It is used on the server to validate continuation payloads (whose schemas are stored as JSON,
 * not Zod), by Surface for a field's `edit.schema`, by the derived MCP server, and by the
 * conformance suite and audit, which never hold Zod schemas.
 */
import type { JsonSchema, ValidationIssue } from "./types";
import { escapeToken, getPointer } from "./pointer";

/** String formats the validator checks. A `format` outside this list is checked only through a sibling `pattern`. */
const FORMATS: Record<string, RegExp> = {
  date: /^\d{4}-\d{2}-\d{2}$/,
  "date-time": /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/,
  time: /^\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})?$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  uri: /^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]*$/,
  uuid: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  duration: /^P(?!$)(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+(\.\d+)?S)?)?$/,
  ipv4: /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/,
  jwt: /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/,
};

/** Keywords that assert something and are implemented. */
const ASSERTIONS = [
  "type",
  "enum",
  "const",
  "properties",
  "required",
  "additionalProperties",
  "patternProperties",
  "propertyNames",
  "minProperties",
  "maxProperties",
  "dependentRequired",
  "dependentSchemas",
  "items",
  "prefixItems",
  "contains",
  "minContains",
  "maxContains",
  "minItems",
  "maxItems",
  "uniqueItems",
  "minLength",
  "maxLength",
  "pattern",
  "format",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "anyOf",
  "oneOf",
  "allOf",
  "not",
  "if",
  "then",
  "else",
  "$ref",
] as const;

/** Keywords that assert nothing and are ignored. */
const ANNOTATIONS_IGNORED = [
  "$schema",
  "$id",
  "$anchor",
  "$comment",
  "$defs",
  "definitions",
  "title",
  "description",
  "default",
  "examples",
  "example",
  "deprecated",
  "readOnly",
  "writeOnly",
  "contentEncoding",
  "contentMediaType",
  "contentSchema",
] as const;

/**
 * The keywords the validator implements, and the ones it ignores as annotations. Anything else
 * (except an `x-` extension) makes validation fail with an issue naming the keyword.
 */
export const SUPPORTED_SCHEMA_KEYWORDS: {
  readonly assertions: readonly string[];
  readonly annotations: readonly string[];
  readonly formats: readonly string[];
} = Object.freeze({
  assertions: ASSERTIONS,
  annotations: ANNOTATIONS_IGNORED,
  formats: Object.keys(FORMATS),
});

const KNOWN = new Set<string>([...ASSERTIONS, ...ANNOTATIONS_IGNORED]);

/** Deepest schema-and-value recursion before validation gives up with an issue. */
const MAX_DEPTH = 128;

function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  return typeof value;
}

function matchesType(value: unknown, type: unknown): boolean {
  const actual = typeOf(value);
  const check = (t: unknown) =>
    t === actual ||
    (t === "number" && actual === "integer") ||
    (t === "integer" && actual === "integer");
  if (Array.isArray(type)) return type.some(check);
  return check(type);
}

function describeType(type: unknown): string {
  return Array.isArray(type) ? type.join(" | ") : String(type);
}

const own = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

/** Compiled patterns, shared across calls. A pattern that does not compile maps to null. */
const PATTERNS = new Map<string, RegExp | null>();

/**
 * Compile a schema `pattern` as ECMAScript with the `u` flag, falling back to no flag for patterns
 * written for plain JavaScript. Null when it compiles neither way.
 */
export function compilePattern(pattern: string): RegExp | null {
  let re = PATTERNS.get(pattern);
  if (re !== undefined) return re;
  re = null;
  for (const flags of ["u", ""]) {
    try {
      re = new RegExp(pattern, flags);
      break;
    } catch {
      // try the next flag set
    }
  }
  if (PATTERNS.size >= 512) PATTERNS.clear();
  PATTERNS.set(pattern, re);
  return re;
}

/**
 * Whether a pattern has the shape that backtracks catastrophically in a backtracking engine: a
 * group repeated without bound (`+`, `*`, `{n,}`) whose body ends in an unbounded repetition that
 * no required atom follows, as in `(a+)+`, `(a*)*`, or `(\w+\s?)*`. `(\w+\.)*` is not
 * flagged: the required `.` ends each round. A heuristic: it finds the common shape, not every
 * one (overlapping alternatives such as `(a|aa)+` are not detected).
 */
export function isBacktrackingPattern(pattern: string): boolean {
  /** The quantifier at `at`: unbounded, optional (may match nothing), or none/required. */
  const quantifier = (
    at: number,
  ): { kind: "unbounded" | "optional" | "required"; next: number } => {
    const ch = pattern[at];
    if (ch === "+") return { kind: "unbounded", next: at + 1 };
    if (ch === "*") return { kind: "unbounded", next: at + 1 };
    if (ch === "?") return { kind: "optional", next: at + 1 };
    const m = ch === "{" ? /^\{(\d+)(,(\d*))?\}/.exec(pattern.slice(at)) : null;
    if (m) {
      const kind =
        m[2] !== undefined && m[3] === "" ? "unbounded" : m[1] === "0" ? "optional" : "required";
      return { kind, next: at + m[0].length };
    }
    return { kind: "required", next: at };
  };
  // Per open group: whether the current alternative, or an earlier one, ends in a loose repetition.
  const stack: { risky: boolean; anyAlt: boolean }[] = [{ risky: false, anyAlt: false }];
  const atom = (childRisky: boolean, at: number): number => {
    const q = quantifier(at);
    const top = stack[stack.length - 1]!;
    if (q.kind === "unbounded") top.risky = true;
    else if (q.kind === "required") top.risky = childRisky;
    // An optional atom neither starts nor ends a loose repetition.
    return q.next - 1;
  };
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]!;
    if (c === "\\") {
      i = atom(false, i + 2);
    } else if (c === "[") {
      for (i++; i < pattern.length && pattern[i] !== "]"; i++) if (pattern[i] === "\\") i++;
      i = atom(false, i + 1);
    } else if (c === "(") {
      stack.push({ risky: false, anyAlt: false });
    } else if (c === "|") {
      const top = stack[stack.length - 1]!;
      top.anyAlt ||= top.risky;
      top.risky = false;
    } else if (c === ")") {
      if (stack.length === 1) continue;
      const g = stack.pop()!;
      const bodyRisky = g.risky || g.anyAlt;
      if (bodyRisky && quantifier(i + 1).kind === "unbounded") return true;
      i = atom(bodyRisky, i + 1);
    } else if (c === "^" || c === "$") {
      // Anchors match no characters.
    } else {
      i = atom(false, i + 1);
    }
  }
  return false;
}

interface Ctx {
  root: JsonSchema;
  issues: ValidationIssue[];
  /** `$ref`s being expanded at each value location, to catch a loop that consumes nothing. */
  refs: Set<string>;
  depth: number;
}

function resolveRef(ref: string, root: JsonSchema): JsonSchema | boolean | undefined {
  if (ref === "#") return root;
  if (!ref.startsWith("#/")) return undefined;
  let pointer: string;
  try {
    pointer = decodeURIComponent(ref.slice(1));
  } catch {
    return undefined;
  }
  const target = getPointer(root, pointer);
  return typeof target === "boolean" || (target && typeof target === "object")
    ? (target as JsonSchema | boolean)
    : undefined;
}

function sub(ctx: Ctx): Ctx {
  return { root: ctx.root, issues: [], refs: ctx.refs, depth: ctx.depth };
}

function validateAt(schema: JsonSchema | boolean, value: unknown, path: string, ctx: Ctx): boolean {
  if (schema === true) return true;
  if (schema === false) {
    ctx.issues.push({ path, message: "no value is allowed here" });
    return false;
  }
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    ctx.issues.push({ path, message: "the schema here is not an object or a boolean" });
    return false;
  }
  const before = ctx.issues.length;
  if (ctx.depth > MAX_DEPTH) {
    ctx.issues.push({ path, message: `nesting deeper than ${MAX_DEPTH} levels cannot be checked` });
    return false;
  }
  ctx.depth++;
  try {
    check(schema, value, path, ctx);
  } finally {
    ctx.depth--;
  }
  return ctx.issues.length === before;
}

function check(schema: JsonSchema, value: unknown, path: string, ctx: Ctx): void {
  // Fail closed on anything this validator does not implement ([P-SCHEMA-2]).
  for (const k of Object.keys(schema)) {
    if (!KNOWN.has(k) && !k.startsWith("x-")) {
      ctx.issues.push({
        path,
        message: `the schema uses "${k}", which this validator does not support, so the value cannot be checked`,
      });
    }
  }
  if (Array.isArray(schema["items"])) {
    ctx.issues.push({
      path,
      message: 'the schema uses an array "items" (draft 7 tuples); use "prefixItems"',
    });
  }

  const ref = schema["$ref"];
  if (typeof ref === "string") {
    const target = resolveRef(ref, ctx.root);
    const seen = `${ref} ${path}`;
    if (target === undefined) {
      ctx.issues.push({
        path,
        message: `unresolvable $ref ${ref} (only local refs are supported)`,
      });
    } else if (ctx.refs.has(seen)) {
      ctx.issues.push({ path, message: `circular $ref ${ref}` });
    } else {
      ctx.refs.add(seen);
      try {
        validateAt(target, value, path, ctx);
      } finally {
        ctx.refs.delete(seen);
      }
    }
  }

  if (schema["type"] !== undefined && !matchesType(value, schema["type"])) {
    ctx.issues.push({
      path,
      message: `expected ${describeType(schema["type"])}, received ${typeOf(value)}`,
      expected: describeType(schema["type"]),
    });
    return;
  }

  if (schema["enum"] !== undefined) {
    const list = Array.isArray(schema["enum"]) ? (schema["enum"] as unknown[]) : [];
    if (!list.some((v) => deepEqual(v, value))) {
      ctx.issues.push({
        path,
        message: `expected one of ${list.map((v) => JSON.stringify(v)).join(", ")}`,
        expected: list.map((v) => JSON.stringify(v)).join(" | "),
      });
    }
  }
  if (own(schema, "const") && !deepEqual(schema["const"], value)) {
    ctx.issues.push({ path, message: `expected ${JSON.stringify(schema["const"])}` });
  }

  if (typeof value === "string") checkString(schema, value, path, ctx);
  if (typeof value === "number") checkNumber(schema, value, path, ctx);
  if (Array.isArray(value)) checkArray(schema, value, path, ctx);
  if (value !== null && typeof value === "object" && !Array.isArray(value))
    checkObject(schema, value as Record<string, unknown>, path, ctx);

  const allOf = schema["allOf"];
  if (Array.isArray(allOf)) for (const s of allOf) validateAt(s as JsonSchema, value, path, ctx);
  const anyOf = schema["anyOf"];
  if (Array.isArray(anyOf)) {
    const ok = anyOf.some((s) => validateAt(s as JsonSchema, value, path, sub(ctx)));
    if (!ok) ctx.issues.push({ path, message: "does not match any allowed alternative" });
  }
  const oneOf = schema["oneOf"];
  if (Array.isArray(oneOf)) {
    const count = oneOf.filter((s) => validateAt(s as JsonSchema, value, path, sub(ctx))).length;
    if (count !== 1)
      ctx.issues.push({ path, message: `must match exactly one alternative (matched ${count})` });
  }
  if (schema["not"] !== undefined) {
    if (validateAt(schema["not"] as JsonSchema, value, path, sub(ctx))) {
      ctx.issues.push({ path, message: "matches a disallowed schema" });
    }
  }
  if (schema["if"] !== undefined) {
    const branch = validateAt(schema["if"] as JsonSchema, value, path, sub(ctx))
      ? schema["then"]
      : schema["else"];
    if (branch !== undefined) validateAt(branch as JsonSchema, value, path, ctx);
  }
}

function checkString(schema: JsonSchema, value: string, path: string, ctx: Ctx): void {
  const length =
    typeof schema["minLength"] === "number" || typeof schema["maxLength"] === "number"
      ? [...value].length
      : 0;
  if (typeof schema["minLength"] === "number" && length < schema["minLength"]) {
    ctx.issues.push({ path, message: `must be at least ${schema["minLength"]} characters` });
  }
  if (typeof schema["maxLength"] === "number" && length > schema["maxLength"]) {
    ctx.issues.push({ path, message: `must be at most ${schema["maxLength"]} characters` });
  }
  const pattern = schema["pattern"];
  if (typeof pattern === "string") {
    const re = compilePattern(pattern);
    if (!re) {
      ctx.issues.push({
        path,
        message: `the schema's pattern ${pattern} does not compile, so the value cannot be checked`,
      });
    } else if (!re.test(value)) {
      ctx.issues.push({ path, message: `must match pattern ${pattern}`, expected: pattern });
    }
  }
  const format = schema["format"];
  if (typeof format === "string") {
    const re = own(FORMATS, format) ? FORMATS[format] : undefined;
    if (re) {
      if (!re.test(value))
        ctx.issues.push({ path, message: `must be a valid ${format}`, expected: format });
    } else if (!carriesPattern(schema)) {
      // Zod pairs its other formats with a pattern, which is checked above. Alone, a format this
      // validator cannot check would silently accept anything.
      ctx.issues.push({
        path,
        message: `the schema's format "${format}" cannot be checked by this validator and has no pattern`,
      });
    }
  }
}

/** Whether a string schema carries a `pattern`, directly or in an `allOf` member (as Zod emits it). */
function carriesPattern(schema: JsonSchema): boolean {
  if (typeof schema["pattern"] === "string") return true;
  const all = schema["allOf"];
  return (
    Array.isArray(all) &&
    all.some(
      (m) => !!m && typeof m === "object" && typeof (m as JsonSchema)["pattern"] === "string",
    )
  );
}

function checkNumber(schema: JsonSchema, value: number, path: string, ctx: Ctx): void {
  if (typeof schema["minimum"] === "number" && value < schema["minimum"]) {
    ctx.issues.push({ path, message: `must be >= ${schema["minimum"]}` });
  }
  if (typeof schema["maximum"] === "number" && value > schema["maximum"]) {
    ctx.issues.push({ path, message: `must be <= ${schema["maximum"]}` });
  }
  if (typeof schema["exclusiveMinimum"] === "number" && value <= schema["exclusiveMinimum"]) {
    ctx.issues.push({ path, message: `must be > ${schema["exclusiveMinimum"]}` });
  }
  if (typeof schema["exclusiveMaximum"] === "number" && value >= schema["exclusiveMaximum"]) {
    ctx.issues.push({ path, message: `must be < ${schema["exclusiveMaximum"]}` });
  }
  const m = schema["multipleOf"];
  if (typeof m === "number" && !isMultipleOf(value, m)) {
    ctx.issues.push({ path, message: `must be a multiple of ${m}` });
  }
}

/** A number's exact decimal value as digits × 10^exp, from its shortest round-trip form. */
function decimal(n: number): { digits: bigint; exp: number } | undefined {
  if (!Number.isFinite(n)) return undefined;
  const m = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/.exec(String(n));
  if (!m) return undefined;
  const frac = m[3] ?? "";
  return {
    digits: BigInt(`${m[1]}${m[2]}${frac}`),
    exp: Number(m[4] ?? 0) - frac.length,
  };
}

/**
 * `multipleOf`, exact on the decimal values as written ([P-SCHEMA-3]): `0.3` is a multiple of
 * `0.1`, `0.30000000000000004` is not. A divisor that is not positive never matches.
 */
function isMultipleOf(value: number, divisor: number): boolean {
  if (!(divisor > 0)) return false;
  if (Number.isInteger(value) && Number.isInteger(divisor) && Number.isSafeInteger(value))
    return value % divisor === 0;
  const a = decimal(value);
  const b = decimal(divisor);
  if (!a || !b) return false;
  const exp = Math.min(a.exp, b.exp);
  if (a.exp - exp > 400 || b.exp - exp > 400) return false;
  const x = a.digits * 10n ** BigInt(a.exp - exp);
  const y = b.digits * 10n ** BigInt(b.exp - exp);
  return x % y === 0n;
}

function checkArray(schema: JsonSchema, value: unknown[], path: string, ctx: Ctx): void {
  if (typeof schema["minItems"] === "number" && value.length < schema["minItems"]) {
    ctx.issues.push({ path, message: `must have at least ${schema["minItems"]} items` });
  }
  if (typeof schema["maxItems"] === "number" && value.length > schema["maxItems"]) {
    ctx.issues.push({ path, message: `must have at most ${schema["maxItems"]} items` });
  }
  if (schema["uniqueItems"] === true) {
    const seen = new Set<string>();
    for (const v of value) {
      const key = stableKey(v);
      if (seen.has(key)) {
        ctx.issues.push({ path, message: "must not contain duplicate items" });
        break;
      }
      seen.add(key);
    }
  }
  const prefix = schema["prefixItems"];
  const items = Array.isArray(schema["items"]) ? undefined : schema["items"];
  value.forEach((v, i) => {
    const p = `${path}/${i}`;
    if (Array.isArray(prefix) && i < prefix.length) {
      validateAt(prefix[i] as JsonSchema | boolean, v, p, ctx);
    } else if (items !== undefined) {
      validateAt(items as JsonSchema | boolean, v, p, ctx);
    }
  });
  const contains = schema["contains"];
  if (contains !== undefined) {
    const matches = value.filter((v, i) =>
      validateAt(contains as JsonSchema, v, `${path}/${i}`, sub(ctx)),
    ).length;
    const min = typeof schema["minContains"] === "number" ? schema["minContains"] : 1;
    const max = typeof schema["maxContains"] === "number" ? schema["maxContains"] : Infinity;
    if (matches < min)
      ctx.issues.push({ path, message: `must contain at least ${min} matching item(s)` });
    if (matches > max)
      ctx.issues.push({ path, message: `must contain at most ${max} matching item(s)` });
  }
}

function checkObject(
  schema: JsonSchema,
  obj: Record<string, unknown>,
  path: string,
  ctx: Ctx,
): void {
  const rawProps = schema["properties"];
  const props = (rawProps && typeof rawProps === "object" ? rawProps : {}) as Record<
    string,
    JsonSchema | boolean
  >;
  const rawPatterns = schema["patternProperties"];
  const patterns: [RegExp | null, string, JsonSchema | boolean][] =
    rawPatterns && typeof rawPatterns === "object"
      ? Object.entries(rawPatterns as Record<string, JsonSchema | boolean>).map(([p, s]) => [
          compilePattern(p),
          p,
          s,
        ])
      : [];
  const required = Array.isArray(schema["required"]) ? (schema["required"] as unknown[]) : [];
  for (const key of required) {
    if (typeof key === "string" && !own(obj, key)) {
      ctx.issues.push({
        path: `${path}/${escapeToken(key)}`,
        message: "is required",
        expected: "present",
      });
    }
  }
  const keys = Object.keys(obj);
  if (typeof schema["minProperties"] === "number" && keys.length < schema["minProperties"])
    ctx.issues.push({ path, message: `must have at least ${schema["minProperties"]} members` });
  if (typeof schema["maxProperties"] === "number" && keys.length > schema["maxProperties"])
    ctx.issues.push({ path, message: `must have at most ${schema["maxProperties"]} members` });
  const dependentRequired = schema["dependentRequired"];
  if (dependentRequired && typeof dependentRequired === "object") {
    for (const [key, needs] of Object.entries(dependentRequired as Record<string, unknown>)) {
      if (!own(obj, key) || !Array.isArray(needs)) continue;
      for (const n of needs)
        if (typeof n === "string" && !own(obj, n))
          ctx.issues.push({
            path: `${path}/${escapeToken(n)}`,
            message: `is required when ${key} is present`,
            expected: "present",
          });
    }
  }
  const dependentSchemas = schema["dependentSchemas"];
  if (dependentSchemas && typeof dependentSchemas === "object") {
    for (const [key, s] of Object.entries(dependentSchemas as Record<string, JsonSchema>))
      if (own(obj, key)) validateAt(s, obj, path, ctx);
  }
  const propertyNames = schema["propertyNames"];
  const additional = schema["additionalProperties"];
  for (const key of keys) {
    const v = obj[key];
    const p = `${path}/${escapeToken(key)}`;
    if (propertyNames !== undefined) validateAt(propertyNames as JsonSchema, key, p, ctx);
    let matched = false;
    if (own(props, key)) {
      matched = true;
      validateAt(props[key] as JsonSchema | boolean, v, p, ctx);
    }
    for (const [re, source, s] of patterns) {
      if (!re) {
        ctx.issues.push({
          path: p,
          message: `the schema's patternProperties key ${source} does not compile, so the member cannot be checked`,
        });
        matched = true;
      } else if (re.test(key)) {
        matched = true;
        validateAt(s, v, p, ctx);
      }
    }
    if (matched) continue;
    if (additional === false) {
      ctx.issues.push({ path: p, message: "is not a known property", expected: "absent" });
    } else if (additional && typeof additional === "object") {
      validateAt(additional as JsonSchema, v, p, ctx);
    }
  }
}

/** A key equal for deep-equal JSON values, for `uniqueItems`. */
function stableKey(v: unknown): string {
  if (v === null || typeof v !== "object") return `${typeof v}:${JSON.stringify(v)}`;
  if (Array.isArray(v)) return `[${v.map(stableKey).join(",")}]`;
  return `{${Object.keys(v)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableKey((v as Record<string, unknown>)[k])}`)
    .join(",")}}`;
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a)) {
    return Array.isArray(b) && a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    if (Array.isArray(b)) return false;
    const ka = Object.keys(a as object).sort();
    const kb = Object.keys(b as object).sort();
    if (ka.length !== kb.length || !ka.every((k, i) => k === kb[i])) return false;
    return ka.every((k) =>
      deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    );
  }
  return false;
}

/**
 * Validate `value` against `schema`. Returns an empty array when valid, otherwise
 * one issue per problem, each with a JSON Pointer `path` relative to `value`. Never throws: a
 * schema the validator cannot apply yields an issue, so the value is refused ([P-SCHEMA-2]).
 */
export function validateJsonSchema(schema: JsonSchema, value: unknown): ValidationIssue[] {
  const ctx: Ctx = { root: schema, issues: [], refs: new Set(), depth: 0 };
  validateAt(schema, value, "", ctx);
  return ctx.issues;
}

/** One construct in a schema that the validator will refuse to apply, or that deserves a warning. */
export interface SchemaProblem {
  /** JSON Pointer into the schema. */
  path: string;
  /** What is there: a keyword, `pattern`, `format`, or `$ref`. */
  keyword: string;
  /** `error`: every value is refused. `warning`: applied, with a risk the author should know. */
  severity: "error" | "warning";
  message: string;
}

/**
 * Walk a schema without a value and report what `validateJsonSchema` would refuse to apply
 * (unsupported keywords, formats it cannot check, patterns that do not compile, non-local or
 * unresolvable refs) and patterns shaped for catastrophic backtracking. Used by the lint and
 * `axe validate` so an author learns at registration, not from a refused payload.
 */
export function schemaProblems(schema: JsonSchema | boolean): SchemaProblem[] {
  const out: SchemaProblem[] = [];
  const root = schema;
  const walk = (s: unknown, path: string, depth: number): void => {
    if (typeof s === "boolean" || !s || typeof s !== "object" || Array.isArray(s)) return;
    if (depth > MAX_DEPTH) return;
    const node = s as JsonSchema;
    for (const k of Object.keys(node)) {
      if (!KNOWN.has(k) && !k.startsWith("x-"))
        out.push({
          path,
          keyword: k,
          severity: "error",
          message: `"${k}" is not supported by the SDK's validator; every value will be refused.`,
        });
    }
    const ref = node["$ref"];
    if (typeof ref === "string" && (typeof root !== "object" || !resolveRef(ref, root)))
      out.push({
        path,
        keyword: "$ref",
        severity: "error",
        message: `$ref ${ref} does not resolve within this schema; only local refs are supported.`,
      });
    const pattern = node["pattern"];
    const patterns = [
      ...(typeof pattern === "string" ? [pattern] : []),
      ...Object.keys((node["patternProperties"] as object | undefined) ?? {}),
    ];
    for (const p of patterns) {
      if (!compilePattern(p))
        out.push({
          path,
          keyword: "pattern",
          severity: "error",
          message: `pattern ${p} does not compile; every value will be refused.`,
        });
      else if (isBacktrackingPattern(p))
        out.push({
          path,
          keyword: "pattern",
          severity: "warning",
          message: `pattern ${p} nests quantifiers and can backtrack catastrophically on long input; rewrite it without a quantified group that is itself quantified (docs/schemas.md, "Patterns").`,
        });
    }
    const format = node["format"];
    if (typeof format === "string" && !own(FORMATS, format) && !carriesPattern(node))
      out.push({
        path,
        keyword: "format",
        severity: "error",
        message: `format "${format}" cannot be checked by the SDK's validator and has no pattern; every value will be refused.`,
      });
    if (Array.isArray(node["items"]))
      out.push({
        path,
        keyword: "items",
        severity: "error",
        message: 'an array "items" (draft 7 tuples) is not supported; use "prefixItems".',
      });
    for (const [k, v] of Object.entries(node)) {
      if (k === "enum" || k === "const" || k === "default" || k === "examples" || k === "example")
        continue;
      const p = `${path}/${escapeToken(k)}`;
      if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}/${i}`, depth + 1));
      else if (v && typeof v === "object") {
        if (
          k === "properties" ||
          k === "patternProperties" ||
          k === "$defs" ||
          k === "definitions" ||
          k === "dependentSchemas"
        ) {
          for (const [name, child] of Object.entries(v as Record<string, unknown>))
            walk(child, `${p}/${escapeToken(name)}`, depth + 1);
        } else walk(v, p, depth + 1);
      }
    }
  };
  walk(schema, "", 0);
  return out;
}

/**
 * Structural equivalence of two schemas, ignoring `title`, `description`, `$id`,
 * `$schema`, `examples`, and `default`. Used to detect custom kinds that duplicate
 * a well-known kind.
 */
export function schemasStructurallyEqual(a: JsonSchema, b: JsonSchema): boolean {
  return deepEqual(stripAnnotations(a), stripAnnotations(b));
}

const ANNOTATIONS = new Set([
  "title",
  "description",
  "$id",
  "$schema",
  "examples",
  "default",
  "$comment",
]);

function stripAnnotations(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripAnnotations);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>).sort(([x], [y]) =>
      x < y ? -1 : 1,
    )) {
      if (ANNOTATIONS.has(k)) continue;
      out[k] = stripAnnotations(v);
    }
    return out;
  }
  return value;
}
