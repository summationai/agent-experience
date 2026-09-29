/**
 * JSON Schema → Zod, for the subset that OpenAPI documents use in practice: objects, arrays,
 * strings (with `enum`, `const`, `format`, length, `pattern`), numbers and integers (with bounds
 * and `multipleOf`), booleans, `null`, `nullable`, `required`, `$ref` within the document, a
 * shallow `allOf` merge, `anyOf`/`oneOf` as unions, and `additionalProperties` as a record or a
 * catchall. A shape it cannot convert becomes `z.unknown()`, and a constraint it cannot convert
 * (a keyword outside the subset, a `format` it does not know, a `pattern` that does not compile)
 * is dropped; either way a warning names the path, so the author sees exactly what the generated
 * action will not enforce (docs/schemas.md).
 */
import { z } from "@summationai/axe-core";
import type { JsonSchema } from "@summationai/axe-core/types";
import type { GenerateWarning } from "./types";

export interface JsonSchemaToZodOptions {
  /** Resolve a `$ref` string to its schema. Default: JSON Pointer lookup in `root`. */
  resolve?: (ref: string) => JsonSchema | undefined;
  /** The document `$ref`s are relative to (`#/components/schemas/Order`). */
  root?: JsonSchema;
  /** Location prefix for warnings, e.g. `orders.get.output`. */
  location?: string;
}

export interface JsonSchemaToZodResult {
  schema: z.ZodType;
  warnings: GenerateWarning[];
}

/** Look up a local JSON Pointer `$ref` (`#/a/b`) in a document. */
export function resolveLocalRef(root: JsonSchema, ref: string): JsonSchema | undefined {
  if (!ref.startsWith("#/")) return undefined;
  let node: unknown = root;
  for (const raw of ref.slice(2).split("/")) {
    const key = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[key];
  }
  return node && typeof node === "object" ? (node as JsonSchema) : undefined;
}

/** Convert one JSON Schema to a Zod schema. */
export function jsonSchemaToZod(
  schema: JsonSchema | boolean,
  options: JsonSchemaToZodOptions = {},
): JsonSchemaToZodResult {
  const warnings: GenerateWarning[] = [];
  const resolve =
    options.resolve ??
    ((ref: string) => (options.root ? resolveLocalRef(options.root, ref) : undefined));
  const converter = new Converter(resolve, warnings);
  const result = converter.convert(schema, options.location ?? "schema", new Set());
  return { schema: result, warnings };
}

/** Keywords outside the converted subset; each is reported where it appears. */
const UNCONVERTED = [
  "patternProperties",
  "propertyNames",
  "dependentRequired",
  "dependentSchemas",
  "if",
  "then",
  "else",
  "not",
  "unevaluatedProperties",
  "unevaluatedItems",
  "contains",
  "minContains",
  "maxContains",
  "uniqueItems",
  "minProperties",
  "maxProperties",
  "prefixItems",
  "additionalItems",
  "$dynamicRef",
] as const;

class Converter {
  constructor(
    private readonly resolve: (ref: string) => JsonSchema | undefined,
    private readonly warnings: GenerateWarning[],
  ) {}

  private unknown(location: string, why: string): z.ZodType {
    this.warnings.push({
      code: "unsupported-schema",
      field: location,
      message: `${why}; the field is declared as unknown, so agents will not be told its shape.`,
    });
    return z.unknown();
  }

  /** A constraint that is dropped while the field keeps its type: the generated schema is looser. */
  private dropped(location: string, why: string): void {
    this.warnings.push({
      code: "unsupported-schema",
      field: location,
      message: `${why}; the generated schema does not enforce it, so it accepts more than the source allows.`,
    });
  }

  convert(schema: JsonSchema | boolean, location: string, seen: Set<string>): z.ZodType {
    if (schema === true) return z.unknown();
    if (schema === false) return z.never();
    if (!schema || typeof schema !== "object") return this.unknown(location, "Not a schema");

    const ref = schema["$ref"];
    if (typeof ref === "string") {
      if (seen.has(ref)) return this.unknown(location, `Recursive $ref ${ref}`);
      const target = this.resolve(ref);
      if (!target) return this.unknown(location, `Unresolvable $ref ${ref}`);
      const next = new Set(seen);
      next.add(ref);
      // Siblings of $ref (description, nullable) apply to the resolved schema.
      const { $ref: _ignored, ...siblings } = schema;
      const merged: JsonSchema = { ...target, ...siblings };
      return this.convert(merged, location, next);
    }

    for (const k of UNCONVERTED)
      if (schema[k] !== undefined) this.dropped(location, `"${k}" is not converted`);
    if (Array.isArray(schema["items"]))
      this.dropped(location, 'An array "items" (draft 7 tuple) is not converted');

    let out = this.convertCore(schema, location, seen);

    if (schema["nullable"] === true) out = out.nullable();
    if (typeof schema["description"] === "string") out = out.describe(schema["description"]);
    return out;
  }

  private convertCore(schema: JsonSchema, location: string, seen: Set<string>): z.ZodType {
    const allOf = schema["allOf"];
    if (Array.isArray(allOf))
      return this.convertAllOf(schema, allOf as JsonSchema[], location, seen);

    const variants = (schema["oneOf"] ?? schema["anyOf"]) as unknown;
    if (Array.isArray(variants)) {
      const members = (variants as (JsonSchema | boolean)[]).map((v, i) =>
        this.convert(v, `${location}/${schema["oneOf"] ? "oneOf" : "anyOf"}/${i}`, seen),
      );
      if (members.length === 0) return this.unknown(location, "Empty oneOf/anyOf");
      if (members.length === 1) return members[0]!;
      return z.union(members as [z.ZodType, z.ZodType, ...z.ZodType[]]);
    }

    if (schema["const"] !== undefined) {
      const c = schema["const"];
      if (c === null) return z.null();
      if (typeof c === "string" || typeof c === "number" || typeof c === "boolean")
        return z.literal(c);
      return this.unknown(location, "const with a non-primitive value");
    }

    const en = schema["enum"];
    if (Array.isArray(en)) return this.convertEnum(en as unknown[], location);

    let type = schema["type"] as unknown;
    let nullable = false;
    if (Array.isArray(type)) {
      const types = type.filter((t) => t !== "null") as string[];
      nullable = type.length !== types.length;
      if (types.length === 0) return z.null();
      if (types.length > 1) {
        const members = types.map((t) => this.convertCore({ ...schema, type: t }, location, seen));
        const u = z.union(members as [z.ZodType, z.ZodType, ...z.ZodType[]]);
        return nullable ? u.nullable() : u;
      }
      type = types[0];
    }
    if (type === undefined) {
      if (schema["properties"] || schema["additionalProperties"] !== undefined) type = "object";
      else if (schema["items"]) type = "array";
    }

    let out: z.ZodType;
    switch (type) {
      case "string":
        out = this.convertString(schema, location);
        break;
      case "number":
      case "integer":
        out = this.convertNumber(schema, type === "integer");
        break;
      case "boolean":
        out = z.boolean();
        break;
      case "null":
        out = z.null();
        break;
      case "array":
        out = this.convertArray(schema, location, seen);
        break;
      case "object":
        out = this.convertObject(schema, location, seen);
        break;
      default:
        return this.unknown(
          location,
          type === undefined ? "Schema has no type" : `Unsupported type ${JSON.stringify(type)}`,
        );
    }
    return nullable ? out.nullable() : out;
  }

  private convertEnum(values: unknown[], location: string): z.ZodType {
    const nonNull = values.filter((v) => v !== null);
    const hasNull = nonNull.length !== values.length;
    let out: z.ZodType;
    if (nonNull.length === 0) return z.null();
    if (nonNull.every((v) => typeof v === "string")) {
      out = z.enum(nonNull as [string, ...string[]]);
    } else if (nonNull.every((v) => typeof v === "number" || typeof v === "boolean")) {
      const lits: z.ZodType[] = nonNull.map((v) => z.literal(v as number | boolean));
      out = lits.length === 1 ? lits[0]! : z.union(lits as [z.ZodType, z.ZodType, ...z.ZodType[]]);
    } else {
      return this.unknown(location, "enum with non-primitive members");
    }
    return hasNull ? out.nullable() : out;
  }

  private convertString(schema: JsonSchema, location: string): z.ZodType {
    const format = schema["format"];
    let s: z.ZodString;
    switch (format) {
      case "date-time":
        s = z.iso.datetime({ offset: true }) as unknown as z.ZodString;
        break;
      case "date":
        s = z.iso.date() as unknown as z.ZodString;
        break;
      case "time":
        s = z.iso.time() as unknown as z.ZodString;
        break;
      case "email":
        s = z.email() as unknown as z.ZodString;
        break;
      case "uri":
      case "url":
        s = z.url() as unknown as z.ZodString;
        break;
      case "uuid":
        s = z.uuid() as unknown as z.ZodString;
        break;
      default:
        s = z.string();
        // Annotation-only formats OpenAPI uses for bytes; anything else would go unchecked.
        if (typeof format === "string" && !["byte", "binary", "password"].includes(format))
          this.dropped(location, `format "${format}" is not checked`);
    }
    // Length and pattern apply with a format too; dropping them would widen the field.
    if (typeof schema["minLength"] === "number") s = s.min(schema["minLength"]);
    if (typeof schema["maxLength"] === "number") s = s.max(schema["maxLength"]);
    if (typeof schema["pattern"] === "string") {
      try {
        s = s.regex(new RegExp(schema["pattern"], "u"));
      } catch {
        try {
          s = s.regex(new RegExp(schema["pattern"]));
        } catch {
          this.dropped(location, `pattern ${schema["pattern"]} does not compile`);
        }
      }
    }
    return s;
  }

  private convertNumber(schema: JsonSchema, integer: boolean): z.ZodType {
    let n = integer ? z.int() : z.number();
    if (typeof schema["minimum"] === "number") n = n.min(schema["minimum"]);
    if (typeof schema["maximum"] === "number") n = n.max(schema["maximum"]);
    if (typeof schema["exclusiveMinimum"] === "number") n = n.gt(schema["exclusiveMinimum"]);
    if (typeof schema["exclusiveMaximum"] === "number") n = n.lt(schema["exclusiveMaximum"]);
    if (typeof schema["multipleOf"] === "number") n = n.multipleOf(schema["multipleOf"]);
    return n;
  }

  private convertArray(schema: JsonSchema, location: string, seen: Set<string>): z.ZodType {
    const items = schema["items"];
    const item =
      items === undefined
        ? z.unknown()
        : this.convert(items as JsonSchema | boolean, `${location}/items`, seen);
    let a = z.array(item);
    if (typeof schema["minItems"] === "number") a = a.min(schema["minItems"]);
    if (typeof schema["maxItems"] === "number") a = a.max(schema["maxItems"]);
    return a;
  }

  private convertObject(schema: JsonSchema, location: string, seen: Set<string>): z.ZodType {
    const props = (schema["properties"] ?? {}) as Record<string, JsonSchema | boolean>;
    const required = new Set(
      Array.isArray(schema["required"]) ? (schema["required"] as string[]) : [],
    );
    const shape: Record<string, z.ZodType> = {};
    for (const [key, sub] of Object.entries(props)) {
      let field = this.convert(sub, `${location}/${key}`, seen);
      if (!required.has(key)) {
        const dflt = typeof sub === "object" && sub !== null ? sub["default"] : undefined;
        field = dflt !== undefined ? field.default(dflt as never) : field.optional();
      }
      shape[key] = field;
    }
    const additional = schema["additionalProperties"];
    if (Object.keys(shape).length === 0 && additional && typeof additional === "object") {
      return z.record(
        z.string(),
        this.convert(additional as JsonSchema, `${location}/additionalProperties`, seen),
      );
    }
    const obj = z.object(shape);
    if (additional === false) return obj.strict();
    if (additional && typeof additional === "object")
      return obj.catchall(
        this.convert(additional as JsonSchema, `${location}/additionalProperties`, seen),
      );
    if (additional === true) return obj.loose();
    return obj;
  }

  private convertAllOf(
    schema: JsonSchema,
    members: JsonSchema[],
    location: string,
    seen: Set<string>,
  ): z.ZodType {
    // Shallow merge: every member must resolve to an object schema; properties and required
    // are unioned. Anything deeper (allOf of unions, conflicting types) is out of scope.
    const merged: JsonSchema = { type: "object", properties: {}, required: [] };
    const props = merged["properties"] as Record<string, unknown>;
    const required = merged["required"] as string[];
    for (const [i, raw] of members.entries()) {
      let m: JsonSchema | undefined = raw;
      const ref = raw["$ref"];
      if (typeof ref === "string") {
        if (seen.has(ref)) return this.unknown(`${location}/allOf/${i}`, `Recursive $ref ${ref}`);
        m = this.resolve(ref);
        if (!m) return this.unknown(`${location}/allOf/${i}`, `Unresolvable $ref ${ref}`);
        seen = new Set(seen);
        seen.add(ref);
      }
      if (m["allOf"]) {
        // Nested allOf: merge recursively through a temporary conversion of its members.
        const inner = this.flattenAllOf(m, `${location}/allOf/${i}`, seen);
        if (!inner) return this.unknown(`${location}/allOf/${i}`, "Nested allOf is not an object");
        m = inner;
      }
      const t = m["type"];
      if (t !== undefined && t !== "object")
        return this.unknown(`${location}/allOf/${i}`, `allOf member of type ${String(t)}`);
      if (m["oneOf"] || m["anyOf"])
        return this.unknown(`${location}/allOf/${i}`, "allOf member with oneOf/anyOf");
      Object.assign(props, (m["properties"] ?? {}) as Record<string, unknown>);
      for (const r of (m["required"] as string[] | undefined) ?? [])
        if (!required.includes(r)) required.push(r);
      if (m["additionalProperties"] !== undefined)
        merged["additionalProperties"] = m["additionalProperties"];
    }
    // The enclosing schema's own members (properties beside allOf) take part too.
    Object.assign(props, (schema["properties"] ?? {}) as Record<string, unknown>);
    for (const r of (schema["required"] as string[] | undefined) ?? [])
      if (!required.includes(r)) required.push(r);
    if (schema["additionalProperties"] !== undefined)
      merged["additionalProperties"] = schema["additionalProperties"];
    return this.convertObject(merged, location, seen);
  }

  private flattenAllOf(
    schema: JsonSchema,
    location: string,
    seen: Set<string>,
  ): JsonSchema | undefined {
    const out: JsonSchema = { type: "object", properties: {}, required: [] };
    const props = out["properties"] as Record<string, unknown>;
    const required = out["required"] as string[];
    for (const [i, raw] of (schema["allOf"] as JsonSchema[]).entries()) {
      let m: JsonSchema | undefined = raw;
      const ref = raw["$ref"];
      if (typeof ref === "string") {
        if (seen.has(ref)) return undefined;
        m = this.resolve(ref);
        if (!m) return undefined;
        seen = new Set(seen);
        seen.add(ref);
      }
      if (m["allOf"]) {
        m = this.flattenAllOf(m, `${location}/allOf/${i}`, seen);
        if (!m) return undefined;
      }
      if ((m["type"] !== undefined && m["type"] !== "object") || m["oneOf"] || m["anyOf"])
        return undefined;
      Object.assign(props, (m["properties"] ?? {}) as Record<string, unknown>);
      for (const r of (m["required"] as string[] | undefined) ?? [])
        if (!required.includes(r)) required.push(r);
    }
    Object.assign(props, (schema["properties"] ?? {}) as Record<string, unknown>);
    for (const r of (schema["required"] as string[] | undefined) ?? [])
      if (!required.includes(r)) required.push(r);
    return out;
  }
}
