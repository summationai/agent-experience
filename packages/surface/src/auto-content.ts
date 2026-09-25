/**
 * The page's content, beside its controls: what `handle.read()` returns (the text, key-value
 * pairs, tables, and lists the page shows the person, bounded and redacted) and what
 * `handle.wait()` resolves (a condition on the page met or not, within a bound). Types and the
 * symbol a surface carries them under only; nothing here touches the DOM, so the AXE bridge and
 * the relay can read the shapes without loading the derivation ([S-AUTO-14], [S-AUTO-15]).
 */

/**
 * Where a surface keeps its page-content reader (`read` and `wait`): a global symbol, so the
 * bridges (`<ns>.read`, `<ns>.wait`) and the relay's mirror find it on any surface, in any
 * bundle, without importing the derivation.
 */
export const CONTENT = Symbol.for("axe.surface.content");

/** What `read` accepts. Every member is optional. */
export interface ReadOptions {
  /**
   * The part of the page to read: an entry id (a table's, a landmark's, or a control's container),
   * a region named in the configuration's `read.regions`, a landmark or named region or dialog,
   * or a heading (its section and the sections under it). Default: the whole page.
   */
  region?: string;
  /** Keep only what contains this text (case-insensitive): a section whose heading matches whole, else its matching paragraphs, fields, rows, and items. */
  query?: string;
  /** At most this many characters of Markdown per page of the result. Default 12000, at most 50000. */
  maxChars?: number;
  /** At most this many rows per table and items per list. Default 50, at most 500. */
  maxRows?: number;
  /** `nextCursor` from the previous read, with the same region and query. */
  cursor?: string;
}

/** A label and the value the page shows beside it. A sensitive field carries its label only. */
export interface ReadField {
  label: string;
  value: string;
  /** A private value (a password, a card number, a field the configuration marks): withheld. */
  sensitive?: true;
}

export interface ReadTable {
  caption: string;
  columns: string[];
  rows: string[][];
  /** Rows the table has in all, when the page says (`aria-rowcount`) or more than `rows` were rendered. */
  total?: number;
  /** Some rows are not in `rows`: past `maxRows`, not rendered (a virtualized grid), or filtered by `query`. */
  truncated: boolean;
}

export interface ReadList {
  items: string[];
  total?: number;
  truncated: boolean;
}

/**
 * A region whose content cannot be read from the page: a chart or canvas drawn as graphics, a
 * closed shadow root, a cross-origin frame. Reported with its title so an agent can say it
 * exists; its values are never guessed.
 */
export interface ReadOpaque {
  kind: "chart" | "canvas" | "closed-shadow" | "frame";
  title: string;
  /** The library that drew it, when it can tell ("a Highcharts chart"). */
  library?: string;
}

export interface ReadSection {
  /** The heading text; empty for content before the first heading. */
  heading: string;
  /** 1 to 6 for a heading, 0 for content before the first one. */
  level: number;
  /** Paragraphs, separated by blank lines. */
  text: string;
  fields: ReadField[];
  tables: ReadTable[];
  lists: ReadList[];
  opaque?: ReadOpaque[];
  /** Part of this section was cut to fit `maxChars`; the cursor continues it. */
  truncated?: true;
}

/** The page's content as `read` returns it. */
export interface PageRead {
  /** The route keys are built from (`/projects/:id`). */
  route: string;
  /** The location's path. */
  path: string;
  title: string;
  /** The surface's revision when the page was read. Reading never moves it. */
  rev: number;
  /** The region read, when one was asked for and found. */
  region?: string;
  sections: ReadSection[];
  /** Alerts and toasts on the page now (they are not repeated in `sections`). */
  notices: string[];
  /** More content than this page of the result holds: follow `nextCursor`, or narrow with `region` or `query`. */
  truncated: boolean;
  nextCursor?: string;
  /** How many private fields or regions were withheld. */
  redacted: number;
  /** Why nothing was read (an unknown region, a stale cursor), when that happened. */
  reason?: string;
  /** With an unknown region: the regions this page has, to choose from. */
  regions?: string[];
}

/**
 * What `wait` waits for. The members given in one object must all hold; `any` and `all` combine
 * nested conditions. A text is matched case-insensitively as a substring after collapsing
 * whitespace, or as a regular expression (a `RegExp`, or a string written `/pattern/flags`).
 */
export interface WaitCondition {
  /** This text is shown on the page, or appeared in a notice (a toast) during the wait. */
  text?: string | RegExp;
  /** This text is no longer shown on the page. */
  gone?: string | RegExp;
  /** The entry with this id is on the surface (and, with `available`, can or cannot be acted on). */
  entry?: string;
  available?: boolean;
  /** The surface's revision is no longer this one. */
  revMoved?: number;
  /** The page has had no DOM mutation for this many milliseconds (a streamed report finished). */
  idle?: number;
  /** The route or the location's path matches this glob (`/reports/*`). */
  route?: string;
  any?: WaitCondition[];
  all?: WaitCondition[];
}

export interface WaitOptions {
  /** Give up after this long. Default 30000, at most 120000. */
  timeoutMs?: number;
  /** Check at least this often, beside every DOM change. Default 250, from 20 to 5000. */
  pollMs?: number;
  /** Cancel the wait; it resolves with `met: false`. */
  signal?: AbortSignal;
}

/** How a wait ended, and what changed while it ran. */
export interface WaitResult {
  met: boolean;
  elapsedMs: number;
  /** The revision when it ended; waiting never moves it. */
  rev: number;
  /** The revision when it started. */
  fromRev: number;
  /** What held, or why it ended without: a timeout, a cancel, the surface stopping. */
  reason: string;
  /** Entry ids added, changed, or removed while it waited. */
  changed: string[];
  /** Text that appeared in a notice (a toast, an alert, a status line) while it waited. */
  notices: string[];
}

/** What a surface carries under `CONTENT`. In the page both are local; a relay mirror forwards them. */
export interface PageContent {
  read(options?: ReadOptions): PageRead | Promise<PageRead>;
  wait(condition: WaitCondition, options?: WaitOptions): Promise<WaitResult>;
}

/** The page-content reader a surface carries, or undefined. */
export function contentOf(surface: object): PageContent | undefined {
  return (surface as Record<symbol, PageContent | undefined>)[CONTENT];
}

/** The bounds `read` and `wait` apply. */
export const READ_LIMITS = {
  maxChars: { default: 12_000, min: 200, max: 50_000 },
  maxRows: { default: 50, min: 1, max: 500 },
} as const;
export const WAIT_LIMITS = {
  timeoutMs: { default: 30_000, max: 120_000 },
  pollMs: { default: 250, min: 20, max: 5_000 },
} as const;

/**
 * The problem with a wait condition, as a sentence, or null when it is sound: it must say
 * something, `available` needs `entry`, `idle` is a positive number of milliseconds, and nesting
 * is bounded.
 */
export function checkCondition(condition: unknown, depth = 0): string | null {
  if (!condition || typeof condition !== "object" || Array.isArray(condition))
    return "a condition is an object";
  if (depth > 4) return "conditions nest at most four levels";
  const c = condition as Record<string, unknown>;
  const known = ["text", "gone", "entry", "available", "revMoved", "idle", "route", "any", "all"];
  const keys = Object.keys(c).filter((k) => c[k] !== undefined);
  const unknown = keys.filter((k) => !known.includes(k));
  if (unknown.length) return `unknown member ${unknown.map((k) => `“${k}”`).join(", ")}`;
  if (!keys.length) return "the condition is empty, so it says nothing to wait for";
  if (c.available !== undefined && c.entry === undefined) return "available needs entry";
  for (const k of ["text", "gone"])
    if (
      c[k] !== undefined &&
      !(c[k] instanceof RegExp) &&
      (typeof c[k] !== "string" || !(c[k] as string).trim())
    )
      return `${k} is a non-empty string or a regular expression`;
  if (c.entry !== undefined && (typeof c.entry !== "string" || !c.entry))
    return "entry is an entry id";
  if (c.route !== undefined && (typeof c.route !== "string" || !c.route)) return "route is a glob";
  if (c.revMoved !== undefined && typeof c.revMoved !== "number") return "revMoved is a revision";
  if (c.idle !== undefined && (typeof c.idle !== "number" || !(c.idle > 0)))
    return "idle is a positive number of milliseconds";
  for (const k of ["any", "all"]) {
    if (c[k] === undefined) continue;
    const list = c[k];
    if (!Array.isArray(list) || !list.length) return `${k} is a non-empty list of conditions`;
    for (const sub of list) {
      const problem = checkCondition(sub, depth + 1);
      if (problem) return `${k}: ${problem}`;
    }
  }
  return null;
}
