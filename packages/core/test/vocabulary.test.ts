import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { WIRE, WIRE_ENTRIES } from "../src/vocabulary";
import { readVocabulary, renderVocabularyTs } from "../../../scripts/vocabulary-parse.mjs";

const root = join(__dirname, "../../..");

describe("vocabulary", () => {
  it("packages/core/src/vocabulary.ts is generated from spec/VOCABULARY.md and identical", () => {
    const entries = readVocabulary(join(root, "spec/VOCABULARY.md"));
    const rendered = renderVocabularyTs(entries);
    const committed = readFileSync(join(root, "packages/core/src/vocabulary.ts"), "utf8");
    expect(committed).toBe(rendered);
    expect(WIRE_ENTRIES.length).toBe(entries.length);
    for (const e of entries) {
      expect((WIRE as Record<string, Record<string, string>>)[e.category]![e.key]).toBe(e.name);
    }
  });

  it("is frozen", () => {
    expect(Object.isFrozen(WIRE)).toBe(true);
    expect(Object.isFrozen(WIRE.path)).toBe(true);
  });
});
