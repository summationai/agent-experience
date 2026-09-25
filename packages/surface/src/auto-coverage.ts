/**
 * The coverage report of an auto surface: what was derived, how confident each name is, where
 * the page could not be read (unnamed and icon-only controls, canvas and SVG charts, cross-origin
 * frames, virtualized lists, clickable elements without a role, duplicate names), which controls
 * wait on the approval policy, which configuration rules matched nothing, and a configuration rule
 * that would close each gap ([S-AUTO-10]). `formatCoverage` renders it as Markdown.
 */
import type { EntryKind, EntrySource, Risk } from "./index";
import type { Confidence, NameFrom } from "./auto-dom";
import type { PolicyDecision, SurfaceMatch, SurfaceRule } from "./auto-config";

export type GapKind =
  | "unnamed"
  | "icon-only"
  | "weak-name"
  | "duplicate-name"
  | "possible-duplicate"
  | "custom-widget"
  | "canvas"
  | "chart"
  | "cross-origin-frame"
  | "virtualized"
  | "file-input"
  | "closed-shadow"
  | "unclassified-risk";

export interface CoverageGap {
  kind: GapKind;
  /** One plain sentence on what is missing. */
  message: string;
  /** A selector for the element, when there is one. */
  selector?: string;
  /** The entry the gap is about, when it was registered. */
  entryId?: string;
  /** A configuration rule that closes the gap, to paste into `rules` and edit. */
  suggestion?: SurfaceRule;
  /** The markup change that closes it at the source, when there is one ("add aria-label"). */
  markup?: string;
}

export interface CoverageEntry {
  id: string;
  /** The derived key; equal to `id` unless a pin (`data-surface-id`, a rule's `id`) replaced it. */
  key: string;
  kind: EntryKind;
  role: string;
  name: string;
  object: string | null;
  source: EntrySource;
  nameFrom: NameFrom;
  confidence: Confidence;
  risk?: Risk;
  /** Why the risk is what it is. */
  riskWhy?: string;
  /** What the policy lets an agent do with it. */
  policy?: PolicyDecision;
  available: boolean;
  sensitive?: boolean;
  group?: string;
  selector?: string;
}

export interface StaleRule {
  /** Index in `rules`. */
  index: number;
  match: SurfaceMatch;
  /** `stale`: the rule is scoped to this route and matched nothing; `unmatched`: it has matched nothing yet anywhere. */
  status: "stale" | "unmatched";
  message: string;
}

export interface Coverage {
  app: string;
  route: string;
  rev: number;
  at: string;
  counts: {
    entries: number;
    byKind: Record<EntryKind, number>;
    bySource: Record<EntrySource, number>;
    byConfidence: Record<Confidence, number>;
    unavailable: number;
    awaitingApproval: number;
    gaps: number;
  };
  entries: CoverageEntry[];
  gaps: CoverageGap[];
  /** Controls an agent cannot use without the person: `approve` (asks) or `deny` (refused). */
  approvals: { id: string; name: string; risk: Risk; why: string; policy: PolicyDecision }[];
  staleConfig: StaleRule[];
  /** Every gap's suggestion, in order: the starting point of a configuration. */
  suggestions: SurfaceRule[];
  /** Same-origin frames read, and cross-origin frames skipped. */
  frames: { sameOrigin: number; crossOrigin: number };
  /** Problems with the configuration itself. */
  configErrors: string[];
}

const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
const code = (s: string) => "`" + s.replace(/`/g, "'") + "`";

const GAP_TITLES: Record<GapKind, string> = {
  unnamed: "Unnamed controls",
  "icon-only": "Icon-only controls named from the icon",
  "weak-name": "Weak names",
  "duplicate-name": "Duplicate names",
  "possible-duplicate": "Possible duplicates of declared entries",
  "custom-widget": "Clickable elements without a role",
  canvas: "Canvas",
  chart: "SVG charts",
  "cross-origin-frame": "Cross-origin frames",
  virtualized: "Virtualized lists (visible rows only)",
  "file-input": "File inputs",
  "closed-shadow": "Custom elements with a closed shadow root",
  "unclassified-risk": "Controls with an unrecognized effect (treated as high risk)",
};

export interface FormatCoverageOptions {
  /** Include the table of entries: `true` (all), a number (at most that many rows), or false. Default 200. */
  entries?: boolean | number;
}

/** The coverage report as Markdown, for a terminal, a pull request, or an agent. */
export function formatCoverage(c: Coverage, options: FormatCoverageOptions = {}): string {
  const lines: string[] = [];
  const k = c.counts;
  lines.push(`# Surface coverage: ${c.route}`);
  lines.push("");
  lines.push(
    `${k.entries} entries at rev ${c.rev}: ${k.byKind.action} actions, ${k.byKind.field} fields, ${k.byKind.collection} collections. ` +
      `Derived ${k.bySource.derived}, annotated ${k.bySource.annotated}, declared ${k.bySource.declared}.`,
  );
  lines.push(
    `Names: ${k.byConfidence.high} high confidence, ${k.byConfidence.medium} medium, ${k.byConfidence.low} low` +
      (k.byConfidence.none ? `, ${k.byConfidence.none} none` : "") +
      `. ${k.unavailable} unavailable now; ${k.awaitingApproval} need the person's approval; ${k.gaps} gaps.`,
  );
  if (c.frames.crossOrigin || c.frames.sameOrigin)
    lines.push(
      `Frames: ${c.frames.sameOrigin} same-origin read, ${c.frames.crossOrigin} cross-origin skipped.`,
    );
  if (c.configErrors.length) {
    lines.push("", "## Configuration errors", "");
    for (const e of c.configErrors) lines.push(`- ${e}`);
  }
  if (c.approvals.length) {
    lines.push("", `## Needs the person (${c.approvals.length})`, "");
    lines.push("| Entry | Risk | Policy | Why |", "| --- | --- | --- | --- |");
    for (const a of c.approvals)
      lines.push(`| ${esc(a.name)} (${code(a.id)}) | ${a.risk} | ${a.policy} | ${esc(a.why)} |`);
  }
  if (c.gaps.length) {
    lines.push("", `## Gaps (${c.gaps.length})`);
    const kinds = [...new Set(c.gaps.map((g) => g.kind))];
    for (const kind of kinds) {
      const gaps = c.gaps.filter((g) => g.kind === kind);
      lines.push("", `### ${GAP_TITLES[kind]} (${gaps.length})`, "");
      for (const g of gaps.slice(0, 25)) {
        const where = g.entryId ? ` ${code(g.entryId)}` : g.selector ? ` ${code(g.selector)}` : "";
        lines.push(`- ${esc(g.message)}${where}${g.markup ? ` Fix in markup: ${g.markup}` : ""}`);
      }
      if (gaps.length > 25) lines.push(`- … and ${gaps.length - 25} more`);
    }
  }
  if (c.staleConfig.length) {
    lines.push("", `## Configuration that matched nothing (${c.staleConfig.length})`, "");
    for (const s of c.staleConfig)
      lines.push(
        `- rules[${s.index}] ${code(JSON.stringify(s.match))}: ${s.status}. ${esc(s.message)}`,
      );
  }
  if (c.suggestions.length) {
    lines.push(
      "",
      "## Suggested configuration",
      "",
      "Paste into `rules` and edit the names and effects to say what each control does.",
      "",
    );
    lines.push("```json", JSON.stringify({ rules: c.suggestions.slice(0, 50) }, null, 2), "```");
  }
  const limit =
    options.entries === undefined
      ? 200
      : options.entries === true
        ? Infinity
        : options.entries === false
          ? 0
          : options.entries;
  if (limit > 0 && c.entries.length) {
    lines.push("", "## Entries", "");
    lines.push(
      "| Id | Kind | Role | Name | Source | Name from | Risk | Policy |",
      "| --- | --- | --- | --- | --- | --- | --- | --- |",
    );
    for (const e of c.entries.slice(0, limit))
      lines.push(
        `| ${code(e.id)} | ${e.kind} | ${e.role} | ${esc(e.name)}${e.available ? "" : " (unavailable)"} | ${e.source} | ${e.nameFrom} (${e.confidence}) | ${e.risk ?? ""} | ${e.policy ?? ""} |`,
      );
    if (c.entries.length > limit) lines.push("", `… and ${c.entries.length - limit} more entries.`);
  }
  return lines.join("\n") + "\n";
}
