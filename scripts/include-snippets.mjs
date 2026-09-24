#!/usr/bin/env node
// Pulls TypeScript from docs/examples into fenced code blocks in Markdown so every
// code block in the docs is typechecked. Usage:
//   node scripts/include-snippets.mjs          rewrite blocks
//   node scripts/include-snippets.mjs --check  fail if any block is stale
//
// Markdown marker (the fenced block between the markers is replaced):
//   <!-- include: examples/getting-started/axe.ts -->
//   ```ts
//   ```
//   <!-- /include -->
//
// A `#region` suffix pulls the lines between `// #region name` and `// #endregion name`,
// with the region markers removed and common indentation stripped:
//   <!-- include: examples/apartments/site.ts#search -->
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === "node_modules" || name === "api") continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".md")) out.push(p);
  }
  return out;
}

function snippet(spec) {
  const [file, region] = spec.split("#");
  const path = join(root, "docs", file);
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new Error(`include: ${spec}: file not found at ${relative(root, path)}`);
  }
  let lines = text.replace(/\r\n/g, "\n").split("\n");
  if (region) {
    const start = lines.findIndex((l) =>
      new RegExp(`^\\s*//\\s*#region\\s+${region}\\s*$`).test(l),
    );
    const end = lines.findIndex(
      (l, i) => i > start && new RegExp(`^\\s*//\\s*#endregion(\\s+${region})?\\s*$`).test(l),
    );
    if (start < 0 || end < 0) throw new Error(`include: ${spec}: region "${region}" not found`);
    lines = lines.slice(start + 1, end);
  } else {
    lines = lines.filter((l) => !/^\s*\/\/\s*#(end)?region\b/.test(l));
  }
  while (lines.length && lines[0].trim() === "") lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => /^\s*/.exec(l)[0].length));
  return lines.map((l) => l.slice(Number.isFinite(indent) ? indent : 0)).join("\n");
}

const re = /(<!-- include: ([^\s]+) -->\n```(\w*)\n)([\s\S]*?)(\n?```\n<!-- \/include -->)/g;
let stale = 0;
let total = 0;
for (const file of walk(join(root, "docs")).concat(join(root, "README.md"))) {
  const original = readFileSync(file, "utf8");
  let failed = false;
  const updated = original.replace(re, (_m, open, spec, _lang, _body, close) => {
    total++;
    try {
      return `${open}${snippet(spec)}${close}`;
    } catch (e) {
      console.error(`${relative(root, file)}: ${e.message}`);
      failed = true;
      stale++;
      return _m;
    }
  });
  if (failed) continue;
  if (updated !== original) {
    if (check) {
      console.error(`stale: ${relative(root, file)}`);
      stale++;
    } else {
      writeFileSync(file, updated);
      console.log(`updated ${relative(root, file)}`);
    }
  }
}
if (check) {
  if (stale) {
    console.error(`${stale} stale or broken include(s). Run: pnpm gen:snippets`);
    process.exit(1);
  }
  console.log(`${total} snippet include(s) up to date`);
} else {
  console.log(`${total} snippet include(s) processed`);
}
