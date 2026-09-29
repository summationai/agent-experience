// Installation effort: lines of integration code each variant needs on top of the app as shipped
// without agent affordances (v1). Counted from the source, not estimated: non-blank lines that
// are not comments, in the files (or call sites) that exist only for that variant. lib/variant.ts
// is harness code and is not counted; the two or three lines of the variant gate inside each
// route file are counted with the route.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EXAMPLE_DIR } from "./app";

function codeLines(text: string): number {
  let n = 0;
  let inBlock = false;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (inBlock) {
      if (line.includes("*/")) inBlock = false;
      continue;
    }
    if (line === "" || line.startsWith("//")) continue;
    if (line.startsWith("/*")) {
      if (!line.includes("*/")) inBlock = true;
      continue;
    }
    if (line.startsWith("*")) continue;
    n++;
  }
  return n;
}

const read = (rel: string) => readFileSync(join(EXAMPLE_DIR, rel), "utf8");

/** Lines of every `name(` call in a file, bracket-matched (the useSurfaceProps registrations). */
function callLines(rel: string, name: string): number {
  const src = read(rel);
  let total = 0;
  let from = 0;
  for (;;) {
    const at = src.indexOf(`${name}(`, from);
    if (at < 0) break;
    const lineStart = src.lastIndexOf("\n", at) + 1;
    if (/^\s*import\b/.test(src.slice(lineStart, at))) {
      from = at + 1;
      continue;
    }
    let depth = 0;
    let i = src.indexOf("(", at);
    for (; i < src.length; i++) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")" && --depth === 0) break;
    }
    total += codeLines(src.slice(lineStart, i + 1));
    from = i + 1;
  }
  return total;
}

/** Lines between `// #region name` and `// #endregion` in a file. */
function regionLines(rel: string, region: string): number {
  const src = read(rel);
  const start = src.indexOf(`// #region ${region}`);
  const end = src.indexOf("// #endregion", start);
  return start < 0 || end < 0 ? 0 : codeLines(src.slice(start, end));
}

export interface IntegrationCount {
  variant: string;
  lines: number;
  parts: { what: string; lines: number }[];
  note: string;
}

export function integrationEffort(): IntegrationCount[] {
  const file = (rel: string) => ({ what: rel, lines: codeLines(read(rel)) });
  const v2 = [
    file("lib/browser-surface.ts"),
    file("app/SurfaceHost.tsx"),
    {
      what: "app/plan/PlanBoard.tsx: useSurfaceProps registrations",
      lines: callLines("app/plan/PlanBoard.tsx", "useSurfaceProps"),
    },
  ];
  const v3 = [
    file("lib/basic-tools.ts"),
    file("app/tools/[name]/route.ts"),
    file("eval/basic-mcp.ts"),
  ];
  const v4 = [
    file("lib/axe.ts"),
    file("app/axe/[...axe]/route.ts"),
    file("app/.well-known/axe.json/route.ts"),
    file("app/approvals/[id]/page.tsx"),
    file("app/approvals/[id]/ApprovalDecision.tsx"),
    {
      what: "lib/ui-api.ts: approval decisions (region decide)",
      lines: regionLines("lib/ui-api.ts", "decide"),
    },
  ];
  const sum = (xs: { lines: number }[]) => xs.reduce((a, b) => a + b.lines, 0);
  return [
    {
      variant: "v1",
      lines: 0,
      parts: [],
      note: "the app as shipped, without agent affordances (the baseline)",
    },
    {
      variant: "v2",
      lines: sum(v2),
      parts: v2,
      note: "names and the DOM mirror come from the registrations; no endpoint",
    },
    {
      variant: "v3",
      lines: sum(v3),
      parts: v3,
      note: "written for this evaluation; includes its MCP adapter",
    },
    {
      variant: "v4",
      lines: sum(v4),
      parts: v4,
      note: "includes the approval page and decisions, which v1-v3 do not have; the MCP server is derived (`axe mcp <url>`), 0 lines",
    },
  ];
}
