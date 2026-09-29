import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { specJsonSchemas } from "../src/schemas";
import { WELL_KNOWN_KINDS, kindJsonSchema } from "../src/kinds";

const root = join(__dirname, "../../..");

describe("spec/schemas are generated from @summationai/axe-core", () => {
  it("every published schema matches the Zod definitions", () => {
    for (const [name, schema] of Object.entries(specJsonSchemas())) {
      const path = join(root, "spec/schemas", `${name}.schema.json`);
      expect(existsSync(path), `${path} missing; run pnpm gen:schemas`).toBe(true);
      expect(JSON.parse(readFileSync(path, "utf8"))).toEqual(schema);
    }
    for (const kind of WELL_KNOWN_KINDS) {
      const path = join(root, "spec/schemas/kinds", `${kind.kind}.schema.json`);
      expect(existsSync(path), `${path} missing; run pnpm gen:schemas`).toBe(true);
      const published = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
      const { $schema: _s, $id: _i, title: _t, description: _d, ...rest } = published;
      expect(rest).toEqual(kindJsonSchema(kind));
    }
  });

  it("published schemas are draft 2020-12 with stable ids", () => {
    const manifest = JSON.parse(
      readFileSync(join(root, "spec/schemas/manifest.schema.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(manifest["$schema"]).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(manifest["$id"]).toContain("manifest.schema.json");
    expect(manifest["type"]).toBe("object");
  });
});
