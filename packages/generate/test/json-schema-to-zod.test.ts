import { describe, expect, it } from "vitest";
import { toJsonSchema } from "@summationai/axe-core";
import { jsonSchemaToZod, resolveLocalRef } from "../src/index";

describe("jsonSchemaToZod", () => {
  it("converts the common subset and round-trips through JSON Schema", () => {
    const { schema, warnings } = jsonSchemaToZod({
      type: "object",
      required: ["id", "kind", "when"],
      properties: {
        id: { type: "string", minLength: 1, description: "Identifier" },
        kind: { enum: ["a", "b"] },
        when: { type: "string", format: "date-time" },
        email: { type: "string", format: "email" },
        site: { type: "string", format: "uri" },
        count: { type: "integer", minimum: 0, maximum: 10 },
        ratio: { type: "number", exclusiveMinimum: 0 },
        flag: { type: "boolean" },
        tags: { type: "array", items: { type: "string" }, maxItems: 3 },
        maybe: { type: "string", nullable: true },
        either: { type: ["integer", "null"] },
        level: { enum: [1, 2, null] },
        fixed: { const: "yes" },
        labels: { type: "object", additionalProperties: { type: "string" } },
        anyOf: { anyOf: [{ type: "string" }, { type: "number" }] },
      },
    });
    expect(warnings).toEqual([]);
    expect(
      schema.safeParse({
        id: "x",
        kind: "a",
        when: "2026-09-01T10:00:00Z",
        email: "a@b.co",
        site: "https://x.example",
        count: 3,
        ratio: 0.5,
        flag: true,
        tags: ["t"],
        maybe: null,
        either: null,
        level: 2,
        fixed: "yes",
        labels: { color: "red" },
        anyOf: 4,
      }).success,
    ).toBe(true);
    for (const bad of [
      { id: "", kind: "a", when: "2026-09-01T10:00:00Z" },
      { id: "x", kind: "c", when: "2026-09-01T10:00:00Z" },
      { id: "x", kind: "a", when: "yesterday" },
      { id: "x", kind: "a", when: "2026-09-01T10:00:00Z", email: "nope" },
      { id: "x", kind: "a", when: "2026-09-01T10:00:00Z", count: 11 },
      { id: "x", kind: "a", when: "2026-09-01T10:00:00Z", ratio: 0 },
      { id: "x", kind: "a", when: "2026-09-01T10:00:00Z", tags: ["a", "b", "c", "d"] },
      { id: "x", kind: "a", when: "2026-09-01T10:00:00Z", level: 3 },
      { id: "x", kind: "a", when: "2026-09-01T10:00:00Z", fixed: "no" },
      { id: "x", kind: "a", when: "2026-09-01T10:00:00Z", labels: { color: 1 } },
    ]) {
      expect(schema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
    const json = toJsonSchema(schema, "input");
    const props = json["properties"] as Record<string, Record<string, unknown>>;
    expect(props["id"]).toMatchObject({ type: "string", minLength: 1, description: "Identifier" });
    expect(props["when"]!["format"]).toBe("date-time");
    expect(props["kind"]!["enum"]).toEqual(["a", "b"]);
    expect(json["required"]).toEqual(["id", "kind", "when"]);
  });

  it("resolves $ref within the document and merges allOf shallowly", () => {
    const root = {
      components: {
        schemas: {
          Base: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
          Named: {
            allOf: [
              { $ref: "#/components/schemas/Base" },
              { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
            ],
          },
          Wrapper: {
            type: "object",
            properties: { item: { $ref: "#/components/schemas/Named", description: "The item" } },
          },
          Loop: { type: "object", properties: { next: { $ref: "#/components/schemas/Loop" } } },
        },
      },
    };
    expect(resolveLocalRef(root, "#/components/schemas/Base")).toBe(root.components.schemas.Base);
    expect(resolveLocalRef(root, "#/components/schemas/Nope")).toBeUndefined();
    const named = jsonSchemaToZod({ $ref: "#/components/schemas/Named" }, { root });
    expect(named.warnings).toEqual([]);
    expect(named.schema.safeParse({ id: "1", name: "n" }).success).toBe(true);
    expect(named.schema.safeParse({ id: "1" }).success).toBe(false);
    const wrapper = jsonSchemaToZod({ $ref: "#/components/schemas/Wrapper" }, { root });
    const json = toJsonSchema(wrapper.schema, "output");
    const item = (json["properties"] as Record<string, Record<string, unknown>>)["item"]!;
    expect(item["description"]).toBe("The item");
    expect((item["required"] as string[]).sort()).toEqual(["id", "name"]);
    const loop = jsonSchemaToZod({ $ref: "#/components/schemas/Loop" }, { root, location: "x" });
    expect(loop.warnings.map((w) => w.field)).toEqual(["x/next"]);
    expect(loop.warnings[0]!.message).toMatch(/Recursive \$ref/);
  });

  it("falls back to unknown with a warning naming the path for what it does not handle", () => {
    const { schema, warnings } = jsonSchemaToZod(
      {
        type: "object",
        properties: {
          weird: { not: { type: "string" } },
          typed: { type: "binary" },
          missing: { $ref: "#/components/schemas/Missing" },
          mixedAllOf: { allOf: [{ type: "string" }, { type: "object" }] },
          ok: { type: "string" },
        },
      },
      { root: {}, location: "orders.create.input" },
    );
    expect(warnings.map((w) => [w.code, w.field])).toEqual([
      // `not` is reported as dropped, and the node, left without a type, as unknown.
      ["unsupported-schema", "orders.create.input/weird"],
      ["unsupported-schema", "orders.create.input/weird"],
      ["unsupported-schema", "orders.create.input/typed"],
      ["unsupported-schema", "orders.create.input/missing"],
      ["unsupported-schema", "orders.create.input/mixedAllOf/allOf/0"],
    ]);
    expect(
      schema.safeParse({ weird: 1, typed: [], missing: {}, mixedAllOf: 3, ok: "s" }).success,
    ).toBe(true);
    expect(schema.safeParse({ ok: 1 }).success).toBe(false);
  });

  it("honours additionalProperties and boolean schemas", () => {
    const strict = jsonSchemaToZod({
      type: "object",
      properties: { a: { type: "string" } },
      additionalProperties: false,
    }).schema;
    expect(strict.safeParse({ a: "x", b: 1 }).success).toBe(false);
    const loose = jsonSchemaToZod({
      type: "object",
      properties: { a: { type: "string" } },
      additionalProperties: true,
    }).schema;
    expect(loose.parse({ a: "x", b: 1 })).toEqual({ a: "x", b: 1 });
    expect(jsonSchemaToZod(true).schema.safeParse("anything").success).toBe(true);
    expect(jsonSchemaToZod(false).schema.safeParse("anything").success).toBe(false);
  });

  it("never drops a constraint silently: length and pattern stay with a format, and what is dropped is named", () => {
    const { schema, warnings } = jsonSchemaToZod(
      {
        type: "object",
        properties: {
          email: { type: "string", format: "email", maxLength: 20 },
          stamp: { type: "string", format: "date-time", pattern: "Z$" },
          host: { type: "string", format: "hostname" },
          code: { type: "string", pattern: "(" },
          tags: { type: "array", items: { type: "string" }, uniqueItems: true },
          extra: { type: "object", patternProperties: { "^x-": { type: "string" } } },
          money: {
            type: "object",
            properties: { amount: { type: "number" } },
            additionalProperties: { type: "number" },
          },
          blob: { type: "string", format: "binary" },
        },
      },
      { location: "s" },
    );
    expect(warnings.map((w) => w.field)).toEqual(["s/host", "s/code", "s/tags", "s/extra"]);
    expect(warnings.map((w) => w.message).join(" ")).toMatch(/format "hostname" is not checked/);
    expect(warnings.map((w) => w.message).join(" ")).toMatch(/pattern \( does not compile/);
    expect(warnings.map((w) => w.message).join(" ")).toMatch(/"uniqueItems" is not converted/);
    // Before: the format replaced the string, and maxLength and pattern were lost.
    expect(schema.safeParse({ email: "averyveryverylongname@example.com" }).success).toBe(false);
    expect(schema.safeParse({ email: "a@b.co" }).success).toBe(true);
    expect(schema.safeParse({ stamp: "2026-01-01T00:00:00+02:00" }).success).toBe(false);
    expect(schema.safeParse({ stamp: "2026-01-01T00:00:00Z" }).success).toBe(true);
    // Before: an additionalProperties schema beside properties accepted anything.
    expect(schema.safeParse({ money: { amount: 1, tip: "lots" } }).success).toBe(false);
    expect(schema.safeParse({ money: { amount: 1, tip: 2 } }).success).toBe(true);
  });
});
