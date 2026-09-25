/**
 * The text edits `axe surface init` makes to an application's root file: one import and one
 * wrapper around the element the app renders at its root. Each edit touches only the lines it
 * must and follows the file's own quotes, semicolons, and indentation.
 */

export interface Style {
  quote: '"' | "'";
  semi: boolean;
  /** One level of indentation, as the file writes it. */
  unit: string;
}

export function detectStyle(text: string): Style {
  const imports = text.match(/^import[^\n]*from\s+(["'])[^"']*\1(;?)\s*$/gm) ?? [];
  const doubles = imports.filter((l) => /from\s+"/.test(l)).length;
  const singles = imports.length - doubles;
  const semis = imports.filter((l) => /;\s*$/.test(l)).length;
  // One level is the most common step between a line and a deeper next line.
  const steps = new Map<string, number>();
  let prev = 0;
  let tabs = 0;
  for (const line of text.split("\n")) {
    if (!line.trim() || /^\s*\*/.test(line)) continue;
    const lead = /^[ \t]*/.exec(line)![0];
    if (lead.includes("\t")) tabs++;
    const width = lead.replace(/\t/g, "    ").length;
    if (width > prev) {
      const key = String(width - prev);
      steps.set(key, (steps.get(key) ?? 0) + 1);
    }
    prev = width;
  }
  const best = [...steps].sort((a, b) => b[1] - a[1])[0]?.[0];
  const unit =
    tabs > 0 && tabs * 2 > steps.size ? "\t" : " ".repeat(best === "4" ? 4 : best === "3" ? 3 : 2);
  return {
    quote: singles > doubles ? "'" : '"',
    semi: imports.length === 0 ? true : semis * 2 >= imports.length,
    unit,
  };
}

/** Insert `statement` after the file's last top-level import (or after its directives). */
export function insertImport(text: string, statement: string): string {
  const lines = text.split("\n");
  let lastImportEnd = -1;
  let inImport = false;
  let directivesEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const t = line.trim();
    if (inImport) {
      if (/from\s+["'][^"']+["']\s*;?\s*$/.test(t) || /;\s*$/.test(t)) {
        inImport = false;
        lastImportEnd = i;
      }
      continue;
    }
    if (/^import\b/.test(t)) {
      if (/from\s+["'][^"']+["']\s*;?\s*$/.test(t) || /^import\s+["'][^"']+["']\s*;?\s*$/.test(t))
        lastImportEnd = i;
      else inImport = true;
      continue;
    }
    if (t === "" || t.startsWith("//") || t.startsWith("/*") || t.startsWith("*")) continue;
    if (/^["']use (client|server|strict)["'];?$/.test(t) && lastImportEnd < 0) {
      directivesEnd = i;
      continue;
    }
    if (lastImportEnd >= 0) break;
    // Code before any import: imports, if any, come later only in unusual files; stop here.
    break;
  }
  const at = lastImportEnd >= 0 ? lastImportEnd + 1 : directivesEnd + 1;
  lines.splice(at, 0, statement);
  return lines.join("\n");
}

/**
 * Wrap the source range [start, end) (one JSX element) in `<Wrapper>`. When the element stands
 * alone on its line (optionally followed by `,`), the wrapper takes a line above and below and the
 * element moves one level in; otherwise the wrapper is written inline around it.
 */
export function wrapRange(
  text: string,
  start: number,
  end: number,
  wrapper: string,
  style: Style,
  inline = false,
): string {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const lineEndIdx = text.indexOf("\n", end);
  const lineEnd = lineEndIdx < 0 ? text.length : lineEndIdx;
  const before = text.slice(lineStart, start);
  const after = text.slice(end, lineEnd);
  const element = text.slice(start, end);
  if (!inline && /^\s*$/.test(before) && /^,?\s*$/.test(after)) {
    const indent = before;
    const block =
      `${indent}<${wrapper}>\n` +
      element
        .split("\n")
        .map((l, i) => (i === 0 ? `${indent}${style.unit}${l}` : `${style.unit}${l}`))
        .join("\n") +
      `\n${indent}</${wrapper}>${after}`;
    return text.slice(0, lineStart) + block + text.slice(lineEnd);
  }
  // `return <App />;` becomes the parenthesized block a formatter would write.
  const ret = /^(\s*)return\s+$/.exec(before);
  if (ret && /^;?\s*$/.test(after) && !element.includes("\n")) {
    const indent = ret[1]!;
    const inner = indent + style.unit;
    const block =
      `${indent}return (\n${inner}<${wrapper}>\n${inner}${style.unit}${element}\n` +
      `${inner}</${wrapper}>\n${indent})${after}`;
    return text.slice(0, lineStart) + block + text.slice(lineEnd);
  }
  // `.render(<App />)`: the sole argument of a call, broken over lines with a trailing comma.
  const call = /^(\s*)(.*\()$/.exec(before);
  if (!inline && call && after.startsWith(")") && !element.includes("\n")) {
    const indent = call[1]!;
    const inner = indent + style.unit;
    const block =
      `${before}\n${inner}<${wrapper}>\n${inner}${style.unit}${element}\n` +
      `${inner}</${wrapper}>,\n${indent}${after}`;
    return text.slice(0, lineStart) + block + text.slice(lineEnd);
  }
  return text.slice(0, start) + `<${wrapper}>${element}</${wrapper}>` + text.slice(end);
}

/** The extent of the first match of `re` at or after `from`, or undefined. */
export function find(
  text: string,
  re: RegExp,
  from = 0,
): { start: number; end: number } | undefined {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  g.lastIndex = from;
  const m = g.exec(text);
  return m ? { start: m.index, end: m.index + m[0].length } : undefined;
}

/** Index of the `)` closing the `(` at `open`, skipping strings, template literals, and comments. */
export function matchParen(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i]!;
    if (c === '"' || c === "'" || c === "`") {
      for (i++; i < text.length && text[i] !== c; i++) if (text[i] === "\\") i++;
      continue;
    }
    if (c === "/" && text[i + 1] === "/") {
      i = text.indexOf("\n", i);
      if (i < 0) return -1;
      continue;
    }
    if (c === "/" && text[i + 1] === "*") {
      i = text.indexOf("*/", i + 2) + 1;
      if (i <= 0) return -1;
      continue;
    }
    if (c === "(") depth++;
    else if (c === ")" && --depth === 0) return i;
  }
  return -1;
}
