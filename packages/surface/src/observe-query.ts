// Observation filters and pages [S-OBS-5], shared by the AXE bridge's `<ns>.observe` and the
// WebMCP adapter's observe tool. No Zod and no Node built-ins: it runs in the page.
import type { EntryKind, ObservedEntry, Observation } from "./index";

/** The filters and paging `<ns>.observe` accepts ([S-OBS-5]). Every member is optional. */
export interface ObserveQuery {
  /** Only rows whose `object` is exactly this. */
  object?: string;
  kind?: EntryKind;
  /** `true`: only rows that can be acted on now (those with an `index`); `false`: only rows that cannot. */
  available?: boolean;
  /** Case-insensitive substring of the row's `name`, `id`, or `object`. */
  query?: string;
  /** Rows per page, at most the bridge's `maxPageSize`. */
  limit?: number;
  /** The `nextCursor` of the previous page, with the same filters. */
  cursor?: string;
}

/** FNV-1a (32-bit) of a string, base 36: the suffix that separates two ids with the same plain slug. */
export function shortHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

const CURSOR_PREFIX = "c1";

function base64url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unbase64url(text: string): string {
  const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** The filters that define a result set; a cursor is valid only with the same ones. */
function filterKey(q: ObserveQuery): string {
  return shortHash(
    JSON.stringify([q.object ?? null, q.kind ?? null, q.available ?? null, q.query ?? null]),
  );
}

export function matches(row: ObservedEntry, q: ObserveQuery): boolean {
  if (q.object !== undefined && row.object !== q.object) return false;
  if (q.kind !== undefined && row.kind !== q.kind) return false;
  if (q.available !== undefined && (row.index !== null) !== q.available) return false;
  if (q.query !== undefined && q.query !== "") {
    const needle = q.query.toLowerCase();
    const hay = `${row.name}\u0000${row.id}\u0000${row.object ?? ""}`.toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}

export type PageResult =
  { rows: ObservedEntry[]; total: number; nextCursor?: string } | { invalid: string };

/**
 * One page of an observation: rows in registration order that match the filters, from the row
 * after the cursor's, at most `limit`. A cursor names the last row it returned and the row that
 * followed it (by id), and the position after the page. The next page starts after the last row;
 * if that row has left the table, at the row that followed it; if both have left, at the
 * position.
 */
export function pageOf(view: Observation, q: ObserveQuery, limit: number): PageResult {
  const key = filterKey(q);
  const rows = view.entries.filter((r) => matches(r, q));
  let start = 0;
  if (q.cursor !== undefined) {
    const parts = q.cursor.split(".");
    if (parts.length !== 5 || parts[0] !== CURSOR_PREFIX || !/^\d+$/.test(parts[1]!))
      return { invalid: "is not a cursor this action returned" };
    if (parts[2] !== key) return { invalid: "was returned for different filters" };
    let last: string;
    let next: string;
    try {
      last = unbase64url(parts[3]!);
      next = unbase64url(parts[4]!);
    } catch {
      return { invalid: "is not a cursor this action returned" };
    }
    const at = rows.findIndex((r) => r.id === last);
    const follow = at >= 0 ? -1 : rows.findIndex((r) => r.id === next);
    start = at >= 0 ? at + 1 : follow >= 0 ? follow : Math.min(Number(parts[1]), rows.length);
  }
  const page = rows.slice(start, start + limit);
  const out: { rows: ObservedEntry[]; total: number; nextCursor?: string } = {
    rows: page,
    total: rows.length,
  };
  const end = start + page.length;
  if (end < rows.length && page.length > 0)
    out.nextCursor = [
      CURSOR_PREFIX,
      String(end),
      key,
      base64url(page[page.length - 1]!.id),
      base64url(rows[end]!.id),
    ].join(".");
  return out;
}
