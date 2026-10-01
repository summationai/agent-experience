/**
 * The edits `axe surface init --agent-web` makes to an application's own files, beyond the files it
 * writes: the `/agent` route in a React Router route config, `agentEntry` in the root loader, and a
 * Next.js entry file. Each returns the new text, the same text when there is nothing to do, or a
 * manual step when the file is not in a shape it can edit safely.
 */
import { insertImport } from "./edit";

export type Edit = string | { manual: string };

/** The module `agentEntry` is imported from: no Node imports, so it suits any server and an Edge middleware. */
export const AGENT_ENTRY_MODULE = "@summationai/axe-core/agent-entry";

/** The index of the bracket that closes the one at `open`, skipping strings and comments; -1 if none. */
export function matchBracket(text: string, open: number): number {
  const openCh = text[open]!;
  const closeCh = openCh === "(" ? ")" : openCh === "[" ? "]" : "}";
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
    if (c === openCh) depth++;
    else if (c === closeCh && --depth === 0) return i;
  }
  return -1;
}

/** The leading whitespace of the line `at` is on. */
function indentAt(text: string, at: number): string {
  const start = text.lastIndexOf("\n", at - 1) + 1;
  return /^[ \t]*/.exec(text.slice(start))![0];
}

/**
 * Add `route("agent/*", "<file>")` to a React Router route config (`app/routes.ts`) whose default
 * export is an array, importing `route` from `@react-router/dev/routes` when it is not.
 */
export function addConfigRoute(text: string, file: string, quote: '"' | "'" = '"'): Edit {
  if (/["']agent\/\*["']/.test(text)) return text;
  const m = /export\s+default\s+\[/.exec(text);
  if (!m)
    return {
      manual: `add route("agent/*", "${file}") to the route config's default export (it is not an array init can edit).`,
    };
  const open = m.index + m[0].length - 1;
  const close = matchBracket(text, open);
  if (close < 0) return { manual: `add route("agent/*", "${file}") to the route config.` };
  let last = close - 1;
  while (last > open && /\s/.test(text[last]!)) last--;
  const comma = last > open && text[last] !== "," ? "," : "";
  const indent = indentAt(text, close) + "  ";
  const q = quote;
  const entry =
    `\n\n${indent}// The agent web's pages on this site: /agent and /agent/* (agent-site.server).\n` +
    `${indent}route(${q}agent/*${q}, ${q}${file}${q}),`;
  let out = text.slice(0, last + 1) + comma + entry + text.slice(last + 1);
  const imp = /import\s*\{([^}]*)\}\s*from\s*["']@react-router\/dev\/routes["']/.exec(out);
  if (!imp) out = insertImport(out, `import { route } from ${q}@react-router/dev/routes${q};`);
  else if (!/\broute\b/.test(imp[1]!.replace(/\btype\s+\w+/g, ""))) {
    const names = imp[1]!.trim().replace(/,\s*$/, "");
    out = out.replace(imp[0], imp[0].replace(imp[1]!, ` ${names ? `${names}, ` : ""}route `));
  }
  return out;
}

const ENTRY_COMMENT = [
  "// An agent's browser that opens the site from outside goes to the agent web's entry (/agent),",
  "// not the page a person would see. People and navigation within the site are untouched.",
];

/**
 * Call `agentEntry` first in a React Router (or Remix) root's `loader`, adding a loader when the
 * root has none. Returns a manual step for a loader it cannot read.
 */
export function addAgentEntryToRootLoader(
  text: string,
  o: { typescript: boolean; quote?: '"' | "'"; semi?: boolean },
): Edit {
  if (/\bagentEntry\(/.test(text)) return text;
  const q = o.quote ?? '"';
  const semi = o.semi === false ? "" : ";";
  const manual = {
    manual: `call agentEntry(request) from ${AGENT_ENTRY_MODULE} first in the root route's loader and throw its response when it is not null (const toAgent = agentEntry(request); if (toAgent) throw toAgent;).`,
  };
  const withImport = (t: string) =>
    insertImport(t, `import { agentEntry } from ${q}${AGENT_ENTRY_MODULE}${q}${semi}`);
  const fn = /export\s+(?:async\s+)?function\s+loader\s*\(/.exec(text);
  const arrow = fn ? null : /export\s+const\s+loader\s*(?::[^=]+)?=\s*(?:async\s*)?\(/.exec(text);
  const m = fn ?? arrow;
  if (!m) {
    // No loader: add one that only sends agents on.
    const source = /from\s+["']@remix-run\/react["']/.test(text)
      ? "@remix-run/node"
      : "react-router";
    let out = withImport(text);
    if (o.typescript)
      out = insertImport(out, `import type { LoaderFunctionArgs } from ${q}${source}${q}${semi}`);
    const param = o.typescript ? "{ request }: LoaderFunctionArgs" : "{ request }";
    return (
      out.replace(/\s*$/, "\n") +
      [
        "",
        ...ENTRY_COMMENT,
        `export async function loader(${param}) {`,
        `  const toAgent = agentEntry(request)${semi}`,
        `  if (toAgent) throw toAgent${semi}`,
        `  return null${semi}`,
        "}",
        "",
      ].join("\n")
    );
  }
  const open = m.index + m[0].length - 1;
  const close = matchBracket(text, open);
  if (close < 0) return manual;
  const params = text.slice(open + 1, close);
  let request: string;
  let newParams = params;
  const destructured = /^\s*\{([^}]*)\}/.exec(params);
  if (destructured) {
    const own = /(?:^|,)\s*request\s*(?::\s*([A-Za-z_$][\w$]*))?\s*(?=,|$)/.exec(destructured[1]!);
    if (own) request = own[1] ?? "request";
    else {
      request = "request";
      const inner = destructured[1]!.trim();
      newParams = params.replace(
        destructured[0],
        destructured[0].replace(/\{[^}]*\}/, `{ request${inner ? `, ${inner}` : ""} }`),
      );
    }
  } else {
    const id = /^\s*([A-Za-z_$][\w$]*)/.exec(params);
    if (!id) return manual;
    request = `${id[1]}.request`;
  }
  // The body's opening brace: after `=>` for an arrow function, else the first `{` that ends a line.
  let from = close + 1;
  if (arrow) {
    const at = text.indexOf("=>", from);
    if (at < 0) return manual;
    from = at + 2;
    if (!/^\s*\{/.test(text.slice(from))) return manual; // an expression body
  }
  const brace = /\{[ \t]*\r?\n/.exec(text.slice(from));
  if (!brace) return manual;
  const bodyStart = from + brace.index + brace[0].length;
  const firstLine = /^[ \t]*/.exec(text.slice(bodyStart))![0];
  const indent = firstLine || indentAt(text, m.index) + "  ";
  const insert =
    ENTRY_COMMENT.map((l) => indent + l).join("\n") +
    `\n${indent}const toAgent = agentEntry(${request})${semi}\n${indent}if (toAgent) throw toAgent${semi}\n`;
  const out =
    text.slice(0, open + 1) +
    newParams +
    text.slice(close, bodyStart) +
    insert +
    text.slice(bodyStart);
  return withImport(out);
}

/**
 * A Next.js entry file that sends agents on: `proxy.ts` (Next.js 16 and later) or `middleware.ts`.
 */
export function nextAgentEntryFile(o: { typescript: boolean; proxy: boolean }): string {
  const name = o.proxy ? "proxy" : "middleware";
  return [
    `import { NextResponse } from "next/server";`,
    ...(o.typescript ? [`import type { NextRequest } from "next/server";`] : []),
    `import { agentEntry } from "${AGENT_ENTRY_MODULE}";`,
    "",
    ...ENTRY_COMMENT,
    `export function ${name}(request${o.typescript ? ": NextRequest" : ""}) {`,
    "  return agentEntry(request) ?? NextResponse.next();",
    "}",
    "",
    "// Pages only: not Next.js's own files, API routes, the agent pages, or files with an extension.",
    "export const config = {",
    '  matcher: ["/((?!_next/|api/|agent(?:/|$)|.*\\\\..*).*)"],',
    "};",
    "",
  ].join("\n");
}
