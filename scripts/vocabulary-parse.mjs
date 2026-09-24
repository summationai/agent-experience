// Shared parser for spec/VOCABULARY.md. Used by the generator and by the drift test.
import { readFileSync } from "node:fs";

/**
 * @typedef {{ category: string, key: string, name: string, where: string, meaning: string }} VocabEntry
 */

/** @returns {VocabEntry[]} */
export function parseVocabulary(markdown) {
  const entries = [];
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line
      .slice(1, line.lastIndexOf("|"))
      .split("|")
      .map((c) => c.trim());
    if (cells.length < 5) continue;
    const [category, key, rawName, where, meaning] = cells;
    if (category === "Category" || /^-+$/.test(category)) continue;
    const m = /^`([^`]+)`$/.exec(rawName);
    if (!m)
      throw new Error(
        `Vocabulary row for key "${key}" has a name that is not in backticks: ${rawName}`,
      );
    entries.push({ category, key, name: m[1], where, meaning });
  }
  const seen = new Set();
  for (const e of entries) {
    const id = `${e.category}.${e.key}`;
    if (seen.has(id)) throw new Error(`Duplicate vocabulary key ${id}`);
    seen.add(id);
    if (!/^[a-z][A-Za-z0-9]*$/.test(e.key))
      throw new Error(`Vocabulary key ${id} must be camelCase`);
  }
  return entries;
}

export function readVocabulary(path) {
  return parseVocabulary(readFileSync(path, "utf8"));
}

/** Render the frozen WIRE object as TypeScript source. */
export function renderVocabularyTs(entries) {
  const byCat = new Map();
  for (const e of entries) {
    if (!byCat.has(e.category)) byCat.set(e.category, []);
    byCat.get(e.category).push(e);
  }
  let out = `// GENERATED FILE. Do not edit.\n// Source: spec/VOCABULARY.md. Regenerate with \`pnpm gen:vocabulary\`.\n\n`;
  out += `/**\n * Every wire-level name in the AXE protocol, grouped by category.\n * Use these constants instead of string literals for paths, headers, statuses,\n * error codes, ladder values, kinds, MCP tool names, and CLI command names.\n */\n`;
  out += `export const WIRE = Object.freeze({\n`;
  for (const [cat, list] of byCat) {
    out += `  ${cat}: Object.freeze({\n`;
    for (const e of list) {
      out += `    /** ${e.meaning.replace(/\*\//g, "* /")} */\n    ${e.key}: ${JSON.stringify(e.name)},\n`;
    }
    out += `  }),\n`;
  }
  out += `} as const);\n\n`;
  out += `export type Wire = typeof WIRE;\n`;
  for (const [cat, list] of byCat) {
    const typeName = cat[0].toUpperCase() + cat.slice(1);
    out += `/** Union of every \`${cat}\` name. */\nexport type Wire${typeName} = ${list.map((e) => JSON.stringify(e.name)).join(" | ")};\n`;
  }
  out += `\n/** All entries as a flat list, for tooling. */\nexport const WIRE_ENTRIES: ReadonlyArray<{ readonly category: string; readonly key: string; readonly name: string }> = Object.freeze([\n`;
  for (const e of entries)
    out += `  { category: ${JSON.stringify(e.category)}, key: ${JSON.stringify(e.key)}, name: ${JSON.stringify(e.name)} },\n`;
  out += `]);\n`;
  return out;
}
