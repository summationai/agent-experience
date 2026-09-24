#!/usr/bin/env node
// Generates packages/core/src/vocabulary.ts from spec/VOCABULARY.md.
// Usage: node scripts/gen-vocabulary.mjs [--check]
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readVocabulary, renderVocabularyTs } from "./vocabulary-parse.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "spec/VOCABULARY.md");
const target = join(root, "packages/core/src/vocabulary.ts");
const rendered = renderVocabularyTs(readVocabulary(source));

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(target, "utf8");
  } catch {
    // missing file fails the check below
  }
  if (current !== rendered) {
    console.error(`${target} is out of date. Run: pnpm gen:vocabulary`);
    process.exit(1);
  }
  console.log("vocabulary.ts is up to date");
} else {
  writeFileSync(target, rendered);
  console.log(`wrote ${target}`);
}
