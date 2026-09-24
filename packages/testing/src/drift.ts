/**
 * Vocabulary drift check (spec §3.0 of the build brief, `docs/testing-and-conformance.md`):
 * every wire-looking name in the docs must be in `spec/VOCABULARY.md`; every vocabulary
 * entry must be mentioned in the docs and used in source; every `field`/`api` entry must
 * appear in a package's public `.d.ts`; no source file may spell a path, header, or tool
 * name as a literal.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { parseVocabulary } from "./vocabulary-parse";

export interface DriftOptions {
  /** Repository root containing `spec/`, `docs/`, `packages/`, `README.md`. */
  root: string;
  /** Path to the allowlist JSON, relative to root. Default `spec/drift-allowlist.json`. */
  allowlistPath?: string;
  /** Maximum allowlist entries before the check fails. Default 15. */
  maxAllowlist?: number;
  /** Doc directories to scan. Default `spec`, `docs`, and `README.md`; `docs/api` is skipped. */
  docPaths?: string[];
  /** Site source directories: `.html` files contribute their `<code>` spans, `.js` files their string literals. */
  sitePaths?: string[];
}

export interface DriftReport {
  /** Tokens that look like wire names but are not in the vocabulary: token → files. */
  unknown: Record<string, string[]>;
  /** Vocabulary entries never mentioned in any doc. */
  unmentioned: string[];
  /** Vocabulary entries never used in any source file. */
  unused: string[];
  /** `field`/`api` entries missing from every public .d.ts. */
  missingFromTypes: string[];
  /** Source files with literal wire names that should use WIRE. */
  literals: { file: string; literal: string }[];
  allowlist: string[];
  ok: boolean;
}

const KIND_NAMESPACES = ["payment", "identity", "document", "contact", "consent"];

function walk(dir: string, filter: (p: string) => boolean, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === "node_modules" || name === "dist" || name === ".turbo") continue;
    if (statSync(p).isDirectory()) walk(p, filter, out);
    else if (filter(p)) out.push(p);
  }
  return out;
}

/** `<code>` contents of an HTML file, decoded; build markers and generated blocks are ignored. */
export function htmlCodeSpans(html: string): string[] {
  const spans: string[] = [];
  const re = /<code[^>]*>([\s\S]*?)<\/code>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const text = m[1]!
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .trim();
    if (text && !text.includes("\n")) spans.push(text);
  }
  return spans;
}

/** String literals of a JavaScript file (single, double, and template without expressions). */
export function jsStringLiterals(source: string): string[] {
  const out: string[] = [];
  const re = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\$]|\\.)*)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const v = (m[1] ?? m[2] ?? m[3] ?? "").trim();
    if (v && v.length < 80 && !v.includes(" ")) out.push(v);
  }
  return out;
}

/** Inline code spans, with fenced blocks removed first. */
export function inlineCodeSpans(markdown: string): string[] {
  const withoutFences = markdown.replace(/```[\s\S]*?```/g, "").replace(/~~~[\s\S]*?~~~/g, "");
  const spans: string[] = [];
  const re = /`([^`\n]+)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(withoutFences))) spans.push(m[1]!.trim());
  return spans;
}

const CAMEL = /^[a-z]+[A-Z][A-Za-z0-9]*$/;
const SNAKE = /^[a-z]+(_[a-z0-9]+)+$/;
const HEADER = /^AXE-[A-Za-z-]+$/;
const TOOL = /^axe_[a-z_]+$/;
const CLI = /^axe ([a-z]+)\b/;
const PATH = /^\/(axe\/|\.well-known\/axe)/;
const KIND = new RegExp(`^(${KIND_NAMESPACES.join("|")})\\.[a-z][a-z0-9-]*$`);

/**
 * Classify a code span. Returns the names that must exist in the vocabulary, or an empty
 * list when the span is not wire-like (example data, prose, TypeScript types).
 */
export interface WireLikeName {
  name: string;
  categories: string[];
  /** For snake_case tokens: only a near-miss of a vocabulary name is an error (site-specific codes are legitimate). */
  nearMissOnly?: boolean;
}

export function wireLikeNames(span: string): WireLikeName[] {
  const s = span.replace(/[,;:.]+$/, "");
  if (PATH.test(s)) {
    const path = s
      .split("?")[0]!
      .replace(/\/\{[^}]+\}.*$/, "")
      .replace(/\/<[^>]+>.*$/, "");
    return [{ name: path, categories: ["path"] }];
  }
  if (HEADER.test(s)) return [{ name: s, categories: ["header", "robots"] }];
  if (TOOL.test(s)) return [{ name: s, categories: ["tool", "query"] }];
  const cli = CLI.exec(s);
  if (cli) return [{ name: `axe ${cli[1]}`, categories: ["cli"] }];
  if (KIND.test(s)) return [{ name: s, categories: ["kind"] }];
  if (s.startsWith("x-")) return [];
  if (/^axe\/\d+\.\d+$/.test(s)) return [{ name: s, categories: ["protocol"] }];
  if (SNAKE.test(s))
    return [
      { name: s, categories: ["status", "error", "ladder", "reason", "query"], nearMissOnly: true },
    ];
  // Dotted field paths: `display.item.url`, `policies.rateLimit`, `accepts[].kind`, `manifest.auth.modes`
  if (
    /^[a-z][A-Za-z0-9]*(\[\])?(\.[a-z_][A-Za-z0-9_]*(\[\])?)+$/.test(s) &&
    !s.startsWith("z.") &&
    !s.startsWith("axe.") &&
    !s.startsWith("client.") &&
    !s.startsWith("process.") &&
    !s.startsWith("crypto.")
  ) {
    const segs = s.split(".").map((x) => x.replace(/\[\]$/, ""));
    const out: WireLikeName[] = [];
    for (const seg of segs)
      if (CAMEL.test(seg) || seg === "_axe") out.push({ name: seg, categories: ["field", "api"] });
    return out;
  }
  if (CAMEL.test(s)) return [{ name: s, categories: ["field", "api"] }];
  if (s === "_axe") return [{ name: s, categories: ["field"] }];
  return [];
}

export function checkVocabularyDrift(options: DriftOptions): DriftReport {
  const root = options.root;
  const vocabPath = join(root, "spec/VOCABULARY.md");
  const entries = parseVocabulary(readFileSync(vocabPath, "utf8"));
  const allowlistPath = join(root, options.allowlistPath ?? "spec/drift-allowlist.json");
  const allowlist: string[] = existsSync(allowlistPath)
    ? (JSON.parse(readFileSync(allowlistPath, "utf8")) as { token: string }[]).map((e) => e.token)
    : [];
  const allowed = new Set(allowlist);

  const byName = new Map<string, Set<string>>();
  for (const e of entries) {
    if (!byName.has(e.name)) byName.set(e.name, new Set());
    byName.get(e.name)!.add(e.category);
  }

  // Docs
  const docFiles: string[] = [];
  for (const p of options.docPaths ?? ["spec", "docs", "README.md"]) {
    const full = join(root, p);
    if (!existsSync(full)) continue;
    if (statSync(full).isDirectory())
      docFiles.push(
        ...walk(
          full,
          (f) => f.endsWith(".md") && !relative(root, f).startsWith(join("docs", "api")),
        ),
      );
    else docFiles.push(full);
  }
  const siteFiles: string[] = [];
  for (const p of options.sitePaths ?? []) {
    const full = join(root, p);
    if (existsSync(full))
      siteFiles.push(...walk(full, (f) => f.endsWith(".html") || f.endsWith(".js")));
  }
  const unknown: Record<string, string[]> = {};
  const mentioned = new Set<string>();
  for (const file of [...docFiles, ...siteFiles]) {
    const rel = relative(root, file);
    const text = readFileSync(file, "utf8");
    const spans = file.endsWith(".html")
      ? htmlCodeSpans(text)
      : file.endsWith(".js")
        ? jsStringLiterals(text)
        : inlineCodeSpans(text);
    for (const span of spans) {
      if (rel === "spec/VOCABULARY.md") {
        if (byName.has(span)) mentioned.add(span);
        continue;
      }
      // Any span that contains a vocabulary name counts as a mention (paths, cli, headers, fields).
      for (const name of byName.keys()) {
        if (
          span === name ||
          (name.length > 3 &&
            (span.includes(name) || span.split(/[\s.[\]()/{}:?=,]+/).includes(name)))
        )
          mentioned.add(name);
      }
      for (const { name, categories, nearMissOnly } of wireLikeNames(span)) {
        if (allowed.has(name) || allowed.has(span)) continue;
        const cats = byName.get(name);
        if (cats && [...cats].some((c) => categories.includes(c))) continue;
        if (cats && categories.includes("field")) continue;
        if (categories.includes("path") && pathCovered(name, entries)) continue;
        if (nearMissOnly && !isNearMiss(name, entries, categories)) continue;
        (unknown[name] ??= []).push(rel);
      }
    }
  }
  for (const k of Object.keys(unknown)) unknown[k] = [...new Set(unknown[k])];

  // Source usage
  const srcFiles = walk(
    join(root, "packages"),
    (f) => /\/src\/.*\.ts$/.test(f) && !f.endsWith("vocabulary.ts") && !f.endsWith(".d.ts"),
  );
  const srcText = srcFiles.map((f) => ({
    rel: relative(root, f),
    text: stripComments(readFileSync(f, "utf8")),
  }));
  const allSrc = srcText.map((s) => s.text).join("\n");
  const unused: string[] = [];
  for (const e of entries) {
    const viaConstant = new RegExp(`\\b${e.category}\\.${e.key}\\b`).test(allSrc);
    const viaIdentifier =
      (e.category === "field" || e.category === "api" || e.category === "payload") &&
      new RegExp(`\\b${escapeRe(e.name)}\\b`).test(allSrc);
    const viaLiteral = new RegExp(`["'\`]${escapeRe(e.name)}["'\`]`).test(allSrc);
    // Enumerations are consumed whole (`z.enum(Object.values(WIRE.risk))`), which uses every member.
    const viaCategory = new RegExp(`\\bWIRE\\.${e.category}\\b(?!\\.)`).test(allSrc);
    if (!viaConstant && !viaIdentifier && !viaLiteral && !viaCategory)
      unused.push(`${e.category}.${e.key} (${e.name})`);
  }

  // Types
  const dtsFiles = walk(join(root, "packages"), (f) => /\/dist\/[^/]+\.d\.ts$/.test(f), []);
  const dtsAll = dtsFiles.map((f) => readFileSync(f, "utf8")).join("\n");
  const missingFromTypes: string[] = [];
  if (dtsFiles.length > 0) {
    for (const e of entries) {
      if (e.category !== "field" && e.category !== "api" && e.category !== "payload") continue;
      if (!new RegExp(`\\b${escapeRe(e.name)}\\b`).test(dtsAll))
        missingFromTypes.push(`${e.category}.${e.key} (${e.name})`);
    }
  }

  // Literals in source
  const literals: { file: string; literal: string }[] = [];
  const literalRe =
    /["'`](\/axe\/[^"'`\s]*|\/\.well-known\/axe[^"'`\s]*|AXE-[A-Za-z-]+|axe_[a-z_]+)["'`]/g;
  for (const s of srcText) {
    let m: RegExpExecArray | null;
    while ((m = literalRe.exec(s.text))) literals.push({ file: s.rel, literal: m[1]! });
  }

  const unmentioned = entries
    .filter((e) => !mentioned.has(e.name))
    .map((e) => `${e.category}.${e.key} (${e.name})`);
  const ok =
    Object.keys(unknown).length === 0 &&
    unmentioned.length === 0 &&
    unused.length === 0 &&
    missingFromTypes.length === 0 &&
    literals.length === 0 &&
    allowlist.length < (options.maxAllowlist ?? 15);
  return { unknown, unmentioned, unused, missingFromTypes, literals, allowlist, ok };
}

/** A path token is covered when a vocabulary path is a prefix of it (`/axe/actions/x.y`) or it is a prefix of one (`/axe/`). */
function pathCovered(token: string, entries: { category: string; name: string }[]): boolean {
  return entries.some(
    (e) =>
      e.category === "path" &&
      (token === e.name || token.startsWith(e.name + "/") || e.name.startsWith(token)),
  );
}

/** Levenshtein distance, for near-miss detection of snake_case codes. */
export function editDistance(a: string, b: string): number {
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]!;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length]!;
}

function isNearMiss(
  token: string,
  entries: { category: string; name: string }[],
  categories: string[],
): boolean {
  return entries.some(
    (e) => categories.includes(e.category) && e.name !== token && editDistance(e.name, token) <= 2,
  );
}

/** Remove line and block comments so documentation text is not mistaken for code. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

/** Human-readable summary. */
export function formatDriftReport(r: DriftReport): string {
  const lines: string[] = [];
  const unknown = Object.entries(r.unknown);
  if (unknown.length) {
    lines.push(`${unknown.length} wire-looking name(s) in docs are not in spec/VOCABULARY.md:`);
    for (const [name, files] of unknown) lines.push(`  ${name}  ← ${files.join(", ")}`);
  }
  if (r.unmentioned.length)
    lines.push(
      `${r.unmentioned.length} vocabulary entries are never mentioned in docs:`,
      ...r.unmentioned.map((x) => `  ${x}`),
    );
  if (r.unused.length)
    lines.push(
      `${r.unused.length} vocabulary entries are never used in source:`,
      ...r.unused.map((x) => `  ${x}`),
    );
  if (r.missingFromTypes.length)
    lines.push(
      `${r.missingFromTypes.length} field/api entries are missing from public .d.ts:`,
      ...r.missingFromTypes.map((x) => `  ${x}`),
    );
  if (r.literals.length)
    lines.push(
      `${r.literals.length} literal wire name(s) in source (use WIRE):`,
      ...r.literals.map((l) => `  ${l.file}: ${l.literal}`),
    );
  if (r.allowlist.length >= 15)
    lines.push(`Allowlist has ${r.allowlist.length} entries; the limit is 14.`);
  return lines.length ? lines.join("\n") : "No vocabulary drift.";
}
