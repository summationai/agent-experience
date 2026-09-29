/** Zod → JSON Schema (draft 2020-12) using Zod 4's native converter, with the SDK's conventions. */
import { z } from "zod";
import type { JsonSchema, ValidationIssue } from "./types";
import { escapeToken } from "./pointer";
import { WIRE } from "./vocabulary";

/**
 * Zod types JSON Schema cannot express. Zod emits `{}` (any value) for them, so the published
 * schema is looser than what the server enforces.
 */
const UNREPRESENTABLE = new Set([
  "custom",
  "date",
  "bigint",
  "symbol",
  "undefined",
  "void",
  "map",
  "set",
  "function",
  "promise",
  "nan",
]);

/**
 * Whether a Zod node checks more than its JSON Schema can say ([P-SCHEMA-5]): a refinement
 * (`.refine`, `.superRefine`, `.check` with a custom function), a custom or unrepresentable
 * type, or a preprocess whose input side is a function.
 */
function isRefined(schema: z.ZodType): boolean {
  const def = (schema as unknown as { _zod: { def: Record<string, unknown> } })._zod.def;
  const checks = (def["checks"] as { _zod: { def: { check: string } } }[] | undefined) ?? [];
  if (checks.some((c) => c._zod.def.check === "custom")) return true;
  const type = def["type"] as string;
  if (UNREPRESENTABLE.has(type)) return true;
  if (type === "pipe") {
    const input = (def["in"] as { _zod: { def: { type: string } } } | undefined)?._zod.def.type;
    return input === "transform";
  }
  return false;
}

/**
 * Convert a Zod schema to JSON Schema draft 2020-12.
 * `io` is `"input"` for schemas that describe what callers send and `"output"` for what handlers return.
 *
 * For `"input"`, every node whose Zod schema checks more than JSON Schema can express carries
 * `"x-axe-refined": true` ([P-SCHEMA-5]), so the manifest never claims a looser schema than the
 * server enforces without saying so. The lint reports each one (`refined-schema`).
 */
export function toJsonSchema(schema: z.ZodType, io: "input" | "output"): JsonSchema {
  const json = z.toJSONSchema(schema, {
    target: "draft-2020-12",
    io,
    unrepresentable: "any",
    reused: "inline",
    ...(io === "input"
      ? {
          override: (ctx: { zodSchema: unknown; jsonSchema: Record<string, unknown> }) => {
            if (isRefined(ctx.zodSchema as z.ZodType)) ctx.jsonSchema[WIRE.field.axeRefined] = true;
          },
        }
      : {}),
  }) as JsonSchema;
  delete json["$schema"];
  return json;
}

/** Whether a value is a Zod schema (as opposed to a JSON Schema object). */
export function isZodSchema(value: unknown): value is z.ZodType {
  return (
    typeof value === "object" &&
    value !== null &&
    "_zod" in (value as Record<string, unknown>) &&
    typeof (value as { safeParse?: unknown }).safeParse === "function"
  );
}

/** Convert Zod issues to protocol validation issues with JSON Pointer paths. */
export function zodIssuesToValidationIssues(
  issues: readonly z.core.$ZodIssue[],
): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  for (const issue of issues) {
    const base = issue.path
      .map((p) => escapeToken(String(typeof p === "symbol" ? p.description : p)))
      .join("/");
    const path = base ? `/${base}` : "";
    if (issue.code === "unrecognized_keys") {
      for (const key of issue.keys) {
        out.push({
          path: `${path}/${escapeToken(key)}`,
          message: "is not a known property",
          expected: "absent",
        });
      }
      continue;
    }
    const entry: ValidationIssue = { path, message: issue.message };
    if (issue.code === "invalid_type" && "expected" in issue)
      entry.expected = String(issue.expected);
    if (issue.code === "invalid_value" && "values" in issue) {
      entry.expected = (issue.values as unknown[]).map((v) => JSON.stringify(v)).join(" | ");
    }
    out.push(entry);
  }
  return out;
}
