#!/usr/bin/env node
// Generates spec/schemas/*.schema.json and spec/schemas/kinds/*.schema.json from @summationai/axe-core.
// Usage: node scripts/gen-schemas.mjs [--check]   (requires `pnpm --filter @summationai/axe-core build` first)
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { specJsonSchemas } = await import(join(root, "packages/core/dist/schemas.js"));
const { WELL_KNOWN_KINDS, kindJsonSchema } = await import(
  join(root, "packages/core/dist/kinds.js")
);

const files = new Map();
for (const [name, schema] of Object.entries(specJsonSchemas())) {
  files.set(join("spec/schemas", `${name}.schema.json`), schema);
}
for (const kind of WELL_KNOWN_KINDS) {
  const schema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `https://axe.dev/schemas/axe-0.1/kinds/${kind.kind}.schema.json`,
    title: kind.title,
    description: `${kind.description} Kind: ${kind.kind}. Sensitive: ${kind.sensitive}.`,
    ...kindJsonSchema(kind),
  };
  files.set(join("spec/schemas/kinds", `${kind.kind}.schema.json`), schema);
}

const check = process.argv.includes("--check");
let stale = 0;
for (const [rel, schema] of files) {
  const path = join(root, rel);
  const rendered = JSON.stringify(schema, null, 2) + "\n";
  if (check) {
    const current = existsSync(path) ? readFileSync(path, "utf8") : "";
    if (current !== rendered) {
      console.error(`stale: ${rel}`);
      stale++;
    }
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, rendered);
  }
}
if (check) {
  if (stale) {
    console.error(`${stale} schema file(s) out of date. Run: pnpm gen:schemas`);
    process.exit(1);
  }
  console.log(`${files.size} schema files are up to date`);
} else {
  console.log(`wrote ${files.size} schema files under spec/schemas/`);
}
