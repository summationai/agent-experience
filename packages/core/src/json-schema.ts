/**
 * A small, dependency-free JSON Schema (draft 2020-12) validator covering the
 * subset the SDK generates from Zod and the subset well-known kinds use:
 * type, enum, const, properties, required, additionalProperties, items,
 * prefixItems, minItems, maxItems, minLength, maxLength, pattern, minimum,
 * maximum, exclusiveMinimum, exclusiveMaximum, multipleOf, anyOf, oneOf,
 * allOf, not, $ref (local), and the string formats the protocol relies on.
 *
 * It is used on the server to validate continuation payloads (whose schemas are
 * stored as JSON, not Zod) and by the conformance suite and audit, which never
 * hold Zod schemas.
 */
import type { JsonSchema, ValidationIssue } from "./types";
import { escapeToken, getPointer } from "./pointer";

const FORMATS: Record<string, RegExp> = {
  date: /^\d{4}-\d{2}-\d{2}$/,
  "date-time": /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/,
  time: /^\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})?$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  uri: /^[a-zA-Z][a-zA-Z0-9+.-]*:[^\s]*$/,
  uuid: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  duration: /^P(?!$)(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+(\.\d+)?S)?)?$/,
};

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

interface Ctx {
  root: JsonSchema;
  issues: ValidationIssue[];
}

function resolveRef(ref: string, root: JsonSchema): JsonSchema | undefined {
  if (!ref.startsWith("#")) return undefined;
  const target = getPointer(root, ref.slice(1));
  return target && typeof target === "object" ? (target as JsonSchema) : undefined;
}

function validateAt(schema: JsonSchema | boolean, value: unknown, path: string, ctx: Ctx): boolean {
  if (schema === true) return true;
  if (schema === false) {
    ctx.issues.push({ path, message: "no value is allowed here" });
    return false;
  }
  const before = ctx.issues.length;

  const ref = schema["$ref"];
  if (typeof ref === "string") {
    const target = resolveRef(ref, ctx.root);
    if (!target) {
      ctx.issues.push({ path, message: `unresolvable $ref ${ref}` });
    } else {
      validateAt(target, value, path, ctx);
    }
  }

  if (schema["type"] !== undefined && !matchesType(value, schema["type"])) {
    ctx.issues.push({
      path,
      message: `expected ${describeType(schema["type"])}, received ${typeOf(value)}`,
      expected: describeType(schema["type"]),
    });
    return false;
  }

  if (schema["enum"] !== undefined) {
    const list = schema["enum"] as unknown[];
    if (!list.some((v) => deepEqual(v, value))) {
      ctx.issues.push({
        path,
        message: `expected one of ${list.map((v) => JSON.stringify(v)).join(", ")}`,
        expected: list.map((v) => JSON.stringify(v)).join(" | "),
      });
    }
  }
  if (schema["const"] !== undefined && !deepEqual(schema["const"], value)) {
    ctx.issues.push({ path, message: `expected ${JSON.stringify(schema["const"])}` });
  }

  if (typeof value === "string") {
    if (typeof schema["minLength"] === "number" && [...value].length < schema["minLength"]) {
      ctx.issues.push({ path, message: `must be at least ${schema["minLength"]} characters` });
    }
    if (typeof schema["maxLength"] === "number" && [...value].length > schema["maxLength"]) {
      ctx.issues.push({ path, message: `must be at most ${schema["maxLength"]} characters` });
    }
    if (typeof schema["pattern"] === "string" && !new RegExp(schema["pattern"], "u").test(value)) {
      ctx.issues.push({
        path,
        message: `must match pattern ${schema["pattern"]}`,
        expected: schema["pattern"],
      });
    }
    if (typeof schema["format"] === "string") {
      const re = FORMATS[schema["format"]];
      if (re && !re.test(value)) {
        ctx.issues.push({
          path,
          message: `must be a valid ${schema["format"]}`,
          expected: schema["format"],
        });
      }
    }
  }

  if (typeof value === "number") {
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
    if (
      typeof schema["multipleOf"] === "number" &&
      Math.abs(value / schema["multipleOf"] - Math.round(value / schema["multipleOf"])) > 1e-9
    ) {
      ctx.issues.push({ path, message: `must be a multiple of ${schema["multipleOf"]}` });
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema["minItems"] === "number" && value.length < schema["minItems"]) {
      ctx.issues.push({ path, message: `must have at least ${schema["minItems"]} items` });
    }
    if (typeof schema["maxItems"] === "number" && value.length > schema["maxItems"]) {
      ctx.issues.push({ path, message: `must have at most ${schema["maxItems"]} items` });
    }
    const prefix = schema["prefixItems"];
    const items = schema["items"];
    value.forEach((v, i) => {
      const p = `${path}/${i}`;
      if (Array.isArray(prefix) && i < prefix.length) {
        validateAt(prefix[i] as JsonSchema | boolean, v, p, ctx);
      } else if (items !== undefined) {
        validateAt(items as JsonSchema | boolean, v, p, ctx);
      }
    });
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const props = (schema["properties"] ?? {}) as Record<string, JsonSchema | boolean>;
    const required = (schema["required"] ?? []) as string[];
    for (const key of required) {
      if (!(key in obj)) {
        ctx.issues.push({
          path: `${path}/${escapeToken(key)}`,
          message: "is required",
          expected: "present",
        });
      }
    }
    for (const [key, v] of Object.entries(obj)) {
      const p = `${path}/${escapeToken(key)}`;
      if (key in props) {
        validateAt(props[key] as JsonSchema | boolean, v, p, ctx);
      } else if (schema["additionalProperties"] === false) {
        ctx.issues.push({ path: p, message: "is not a known property", expected: "absent" });
      } else if (
        schema["additionalProperties"] &&
        typeof schema["additionalProperties"] === "object"
      ) {
        validateAt(schema["additionalProperties"] as JsonSchema, v, p, ctx);
      }
    }
  }

  for (const key of ["allOf"] as const) {
    const list = schema[key];
    if (Array.isArray(list)) for (const s of list) validateAt(s as JsonSchema, value, path, ctx);
  }
  const anyOf = schema["anyOf"];
  if (Array.isArray(anyOf)) {
    const ok = anyOf.some((s) =>
      validateAt(s as JsonSchema, value, path, { root: ctx.root, issues: [] }),
    );
    if (!ok) ctx.issues.push({ path, message: "does not match any allowed alternative" });
  }
  const oneOf = schema["oneOf"];
  if (Array.isArray(oneOf)) {
    const count = oneOf.filter((s) =>
      validateAt(s as JsonSchema, value, path, { root: ctx.root, issues: [] }),
    ).length;
    if (count !== 1)
      ctx.issues.push({ path, message: `must match exactly one alternative (matched ${count})` });
  }
  if (schema["not"] !== undefined) {
    if (validateAt(schema["not"] as JsonSchema, value, path, { root: ctx.root, issues: [] })) {
      ctx.issues.push({ path, message: "matches a disallowed schema" });
    }
  }

  return ctx.issues.length === before;
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a)) {
    return Array.isArray(b) && a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
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
 * one issue per problem, each with a JSON Pointer `path` relative to `value`.
 */
export function validateJsonSchema(schema: JsonSchema, value: unknown): ValidationIssue[] {
  const ctx: Ctx = { root: schema, issues: [] };
  validateAt(schema, value, "", ctx);
  return ctx.issues;
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
