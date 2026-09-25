/**
 * RFC 6901 JSON Pointer utilities, plus resolution of a pointer against a
 * JSON Schema (draft 2020-12) so that `display` pointers can be checked at
 * registration time without any example data.
 */
import type { JsonPointer, JsonSchema } from "./types";

/** Split a JSON Pointer into unescaped reference tokens. Throws on malformed input. */
export function parsePointer(pointer: JsonPointer): string[] {
  if (pointer === "") return [];
  if (!pointer.startsWith("/")) {
    throw new Error(`Invalid JSON Pointer "${pointer}": a non-empty pointer must start with "/"`);
  }
  return pointer
    .slice(1)
    .split("/")
    .map((token) => token.replace(/~1/g, "/").replace(/~0/g, "~"));
}

/** Escape one reference token. */
export function escapeToken(token: string): string {
  return token.replace(/~/g, "~0").replace(/\//g, "~1");
}

/** Resolve a pointer against a value. Returns `undefined` when any step is missing. */
export function getPointer(value: unknown, pointer: JsonPointer): unknown {
  let current: unknown = value;
  for (const token of parsePointer(pointer)) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      if (!/^(0|[1-9][0-9]*)$/.test(token)) return undefined;
      current = current[Number(token)];
    } else if (typeof current === "object") {
      // Own members only: "/__proto__" or "/constructor" never reaches the prototype chain.
      if (!Object.prototype.hasOwnProperty.call(current, token)) return undefined;
      current = (current as Record<string, unknown>)[token];
    } else {
      return undefined;
    }
  }
  return current;
}

function deref(schema: JsonSchema, root: JsonSchema): JsonSchema {
  const ref = schema["$ref"];
  if (typeof ref !== "string") return schema;
  if (!ref.startsWith("#/")) return schema;
  const target = getPointer(root, ref.slice(1));
  if (target && typeof target === "object") return deref(target as JsonSchema, root);
  return schema;
}

function branches(schema: JsonSchema): JsonSchema[] {
  const out: JsonSchema[] = [];
  for (const key of ["anyOf", "oneOf", "allOf"]) {
    const list = schema[key];
    if (Array.isArray(list))
      for (const s of list) if (s && typeof s === "object") out.push(s as JsonSchema);
  }
  return out;
}

/**
 * Resolve one reference token against a schema: `properties.<token>` for objects,
 * `items` for arrays (any index token). Looks through `$ref` and composition keywords.
 */
function stepSchema(schema: JsonSchema, token: string, root: JsonSchema): JsonSchema | undefined {
  const s = deref(schema, root);
  const props = s["properties"];
  if (props && typeof props === "object" && Object.prototype.hasOwnProperty.call(props, token)) {
    const p = (props as Record<string, unknown>)[token];
    if (p && typeof p === "object") return p as JsonSchema;
  }
  const items = s["items"];
  if (items && typeof items === "object" && /^(0|[1-9][0-9]*|-)$/.test(token)) {
    return items as JsonSchema;
  }
  const additional = s["additionalProperties"];
  if (additional && typeof additional === "object" && s["type"] === "object") {
    return additional as JsonSchema;
  }
  for (const b of branches(s)) {
    const r = stepSchema(b, token, root);
    if (r) return r;
  }
  return undefined;
}

/**
 * Resolve a pointer against a JSON Schema, returning the sub-schema it points to,
 * or `undefined` when the location does not exist in the schema.
 */
export function resolvePointerInSchema(
  schema: JsonSchema,
  pointer: JsonPointer,
  root: JsonSchema = schema,
): JsonSchema | undefined {
  let current: JsonSchema | undefined = schema;
  for (const token of parsePointer(pointer)) {
    if (!current) return undefined;
    current = stepSchema(current, token, root);
  }
  return current ? deref(current, root) : undefined;
}

/** The schema of one element of an array schema, looking through `$ref`. */
export function itemSchemaOf(schema: JsonSchema, root: JsonSchema): JsonSchema | undefined {
  const s = deref(schema, root);
  const items = s["items"];
  if (items && typeof items === "object") return deref(items as JsonSchema, root);
  for (const b of branches(s)) {
    const r = itemSchemaOf(b, root);
    if (r) return r;
  }
  return undefined;
}

/** Whether a schema (looking through `$ref` and unions) admits arrays. */
export function schemaIsArray(schema: JsonSchema, root: JsonSchema): boolean {
  const s = deref(schema, root);
  const t = s["type"];
  if (t === "array" || (Array.isArray(t) && t.includes("array"))) return true;
  if (s["items"] !== undefined) return true;
  return branches(s).some((b) => schemaIsArray(b, root));
}

export { deref as dereferenceSchema };
