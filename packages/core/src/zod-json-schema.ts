/** Zod → JSON Schema (draft 2020-12) using Zod 4's native converter, with the SDK's conventions. */
import { z } from "zod";
import type { JsonSchema, ValidationIssue } from "./types";
import { escapeToken } from "./pointer";

/**
 * Convert a Zod schema to JSON Schema draft 2020-12.
 * `io` is `"input"` for schemas that describe what callers send and `"output"` for what handlers return.
 */
export function toJsonSchema(schema: z.ZodType, io: "input" | "output"): JsonSchema {
  const json = z.toJSONSchema(schema, {
    target: "draft-2020-12",
    io,
    unrepresentable: "any",
    reused: "inline",
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
