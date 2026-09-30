/**
 * Reading the page's content ([S-AUTO-14]): the text, key-value pairs, tables, lists, and document
 * text the page shows the person, grouped into sections by heading, bounded, and redacted. The
 * controls are `observe()`'s; this is what the page says. Framework-free: it reads the DOM (open
 * shadow roots and same-origin frames included) and nothing else, and it never guesses what a
 * chart or a canvas draws.
 */
import {
  ScanContext,
  accessibleName,
  clampText,
  fieldValue,
  idrefText,
  isContentEditable,
  isHidden,
  laysOutApart,
  nameOfContainer,
  norm,
  opaqueKind,
  opaqueTitle,
  roleOf,
  selectorFor,
  textOf,
} from "./auto-dom";
import { isItemBlock } from "./auto-risk";
import type {
  PageRead,
  ReadField,
  ReadList,
  ReadOpaque,
  ReadSection,
  ReadTable,
} from "./auto-content";

/** What the reader is told about the page it reads. */
export interface ReadEnv {
  root: Element;
  layout: boolean;
  /** A subtree never read: `data-surface-ignore`, the relay's indicator, excluded selectors. */
  skip: (el: Element) => boolean;
  /** An element whose value (or content) is private. */
  sensitive: (el: Element) => boolean;
  /** Read navigation landmarks too (off for a whole-page read: the controls are in observe). */
  navigation: boolean;
}

/** An opaque region with where it is, for coverage. */
export interface OpaqueAt extends ReadOpaque {
  selector: string;
}

export interface Collected {
  sections: ReadSection[];
  notices: string[];
  opaque: OpaqueAt[];
  redacted: number;
  /** The page was larger than the reader's hard bounds; the rest was not read. */
  capped: boolean;
}

/** Hard bounds on one read, whatever `maxChars` says: elements visited, characters kept, rows per table. */
const NODE_CAP = 40_000;
const CHAR_CAP = 1_000_000;
const ROW_CAP = 2_000;

const SKIP_TAGS = new Set([
  "script",
  "style",
  "template",
  "noscript",
  "head",
  "meta",
  "link",
  "datalist",
  "button",
  "option",
  "optgroup",
  "img",
  "video",
  "audio",
  "picture",
  "object",
  "embed",
]);

const BLOCK = new Set(
  "address article aside blockquote br dd details dialog div dl dt fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr li main nav ol p pre section summary table tbody td th thead tfoot tr ul caption legend".split(
    " ",
  ),
);

/** Roles whose text is a control's name, not the page's content (their state is in observe). */
const CONTROL_ROLES = new Set([
  "button",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "menu",
  "menubar",
  "toolbar",
  "tablist",
  "tab",
  "switch",
  "option",
  "listbox",
  "listbox-select",
  "tooltip",
  "slider",
  "combobox-trigger",
  "spinbutton",
  "scrollbar",
  "separator",
]);

const TABLE_ROLES = new Set(["table", "grid", "treegrid"]);
const SCOPED_ROLES = new Set(["dialog", "alertdialog", "region", "article", "complementary"]);
const SCOPED_TAGS = new Set(["section", "article", "aside", "dialog", "fieldset"]);
const NOTICE =
  '[role="alert"], [aria-live="assertive"], [data-sonner-toast], [class*="toast" i], [class*="snackbar" i], [class*="notistack" i]';
const HEADING_CLASS =
  /(^|[\s_-])(title|heading|header|headline|card-title|panel-title|section-title)([\s_-]|$)/i;
const LABEL_CLASS = /(^|[\s_-])(label|key|term|name|caption|prop|property|field-name)([\s_-]|$)/i;
const PAIR_CLASS =
  /(^|[\s_-])(field|kv|key-?value|property|prop|detail|details-item|meta|stat|attribute|attr|info-row|summary-item)([\s_-]|$)/i;
const VALUE_CLASS = /(^|[\s_-])(value|val)([\s_-]|$)/i;

function classOf(el: Element): string {
  return typeof el.className === "string" ? el.className : (el.getAttribute("class") ?? "");
}

interface Work {
  heading: string;
  level: number;
  paras: string[];
  fields: ReadField[];
  tables: ReadTable[];
  lists: ReadList[];
  opaque: ReadOpaque[];
}

/** Collect the content under `env.root`, in document order, grouped by heading. */
export function collectContent(env: ReadEnv): Collected {
  const ctx = new ScanContext(env.root, env.layout);
  const works: Work[] = [];
  const notices: string[] = [];
  const opaque: OpaqueAt[] = [];
  let redacted = 0;
  let nodes = 0;
  let chars = 0;
  let capped = false;
  let line = "";
  let inDocument = 0;

  const open = (heading: string, level: number): Work => {
    const w: Work = { heading, level, paras: [], fields: [], tables: [], lists: [], opaque: [] };
    works.push(w);
    return w;
  };
  let cur: Work | null = null;
  const here = (): Work => (cur ??= open("", 0));
  const keep = (n: number): boolean => {
    chars += n;
    if (chars > CHAR_CAP) capped = true;
    return !capped;
  };
  const text = (el: Element, max = 500) => clampText(textOf(el, ctx).text, max);

  const breakLine = () => {
    const t = norm(line);
    line = "";
    if (!t || !/[\p{L}\p{N}]/u.test(t) || !keep(t.length)) return;
    // "Status: At risk" on a line of its own is a field, outside a document's prose.
    const kv =
      !inDocument && t.length <= 160 ? /^([\p{L}][^:]{0,39}):\s+(\S.{0,119})$/u.exec(t) : null;
    if (kv && kv[1]!.split(" ").length <= 5) here().fields.push({ label: kv[1]!, value: kv[2]! });
    else here().paras.push(t);
  };

  const addOpaque = (el: Element, o: ReadOpaque) => {
    here().opaque.push(o);
    opaque.push({ ...o, selector: selectorFor(el) });
  };

  const visibleChildren = (el: Element): Element[] =>
    Array.from(
      ((el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot ?? el).children,
    ).filter(
      (c) =>
        !["script", "style", "template", "noscript"].includes(c.localName) &&
        !env.skip(c) &&
        c.getAttribute("aria-hidden") !== "true" &&
        !isHidden(c, ctx),
    );

  const hasStructure = (el: Element) =>
    !!el.querySelector(
      'h1, h2, h3, h4, h5, h6, [role="heading"], table, [role="table"], [role="grid"], ul, ol, dl, [role="list"], input, select, textarea, button, [role="button"]',
    );

  /** A first child that reads as a card's title: a short line styled or classed as one. */
  const headingLike = (first: Element, container: Element, rest: Element[]): string => {
    if (!rest.length || hasStructure(first) || roleOf(first)) return "";
    if (["p", "li", "td", "th", "label", "span", "a", "dt", "dd"].includes(container.localName))
      return "";
    const t = text(first, 120);
    if (!t || t.length > 80 || t.split(" ").length > 12 || !/\p{L}/u.test(t)) return "";
    if (/[:：]\s*$/.test(t)) return "";
    const style = (first as HTMLElement).style;
    const bold = !!style && /^(bold|[6-9]00)$/.test(style.fontWeight ?? "");
    const cls = classOf(first);
    const strongOnly =
      first.children.length === 1 &&
      /^(strong|b)$/.test(first.children[0]!.localName) &&
      norm(first.children[0]!.textContent) === norm(first.textContent);
    if (first.localName === "legend") return t;
    if (!(HEADING_CLASS.test(cls) && !LABEL_CLASS.test(cls)) && !bold && !strongOnly) return "";
    // Something with text follows it in the card.
    return rest.some((r) => norm(r.textContent)) ? t : "";
  };

  /** A label and a value side by side: two short leaves with a cue that one labels the other. */
  const pairOf = (el: Element, kids: Element[]): [string, string] | null => {
    if (kids.length !== 2) return null;
    for (const n of Array.from(el.childNodes))
      if (n.nodeType === 3 && (n as Text).data.trim()) return null;
    const [a, b] = kids as [Element, Element];
    if (hasStructure(a) || roleOf(a) || roleOf(b) === "heading") return null;
    if (
      b.querySelector('h1, h2, h3, h4, h5, h6, [role="heading"], table, [role="grid"], ul, ol, dl')
    )
      return null;
    const label = text(a, 80);
    const value = text(b, 400);
    if (!label || !value || label.length > 60 || value.length > 300 || !/\p{L}/u.test(label))
      return null;
    const cue =
      /[:：]\s*$/.test(label) ||
      ["label", "dt", "th", "strong", "b"].includes(a.localName) ||
      LABEL_CLASS.test(classOf(a)) ||
      PAIR_CLASS.test(classOf(el)) ||
      VALUE_CLASS.test(classOf(b));
    return cue ? [label.replace(/[:：]\s*$/, ""), value] : null;
  };

  const controlField = (el: Element, role: string): ReadField | null => {
    const type = (el.getAttribute("type") ?? "").toLowerCase();
    if (
      el.localName === "input" &&
      ["hidden", "submit", "button", "reset", "image", "file"].includes(type)
    )
      return null;
    let label = accessibleName(el, role, ctx).name || norm(el.getAttribute("name")) || role;
    let value: string;
    if (role === "checkbox" || role === "switch") {
      const on =
        el.localName === "input"
          ? (el as HTMLInputElement).checked
          : el.getAttribute("aria-checked") === "true";
      value = on ? "checked" : "not checked";
    } else if (role === "radio") {
      const on =
        el.localName === "input"
          ? (el as HTMLInputElement).checked
          : el.getAttribute("aria-checked") === "true";
      if (!on) return null;
      const group = el.closest('fieldset, [role="radiogroup"]');
      value = label;
      label = (group && nameOfContainer(group, ctx)) || norm(el.getAttribute("name")) || "choice";
    } else {
      const v = fieldValue(el);
      value = clampText(Array.isArray(v) ? v.join(", ") : v, 1000);
    }
    return { label, value };
  };

  /**
   * A control that holds an item's data (a row of a listing rendered as one button) is content
   * as well as a control: its own text pieces in order, joined, without its nested controls.
   */
  const itemRowText = (row: Element): string => {
    const parts: string[] = [];
    const visit = (el: Element) => {
      for (const n of Array.from(el.childNodes)) {
        if (n.nodeType === 3) {
          const t = norm((n as Text).data);
          if (t && /[\p{L}\p{N}]/u.test(t)) parts.push(t);
          continue;
        }
        if (n.nodeType !== 1) continue;
        const c = n as Element;
        if (SKIP_TAGS.has(c.localName) || env.skip(c) || isHidden(c, ctx)) continue;
        if (c.getAttribute("aria-hidden") === "true") continue;
        const r = roleOf(c);
        if (CONTROL_ROLES.has(r) || r === "link" || c.localName === "input") continue;
        visit(c);
      }
    };
    visit(row);
    return clampText(parts.join(" · "), 500);
  };
  /** The list a run of sibling item rows is gathered into, with the container it came from. */
  let rowList: { parent: Element | null; work: Work; list: ReadList } | null = null;
  /** Add one row's text to the list its sibling rows share (a wrapper apiece is allowed for). */
  const addRow = (el: Element, t: string) => {
    breakLine();
    const parent = el.parentElement;
    const group = parent && parent.children.length === 1 ? parent.parentElement : parent;
    const work = here();
    if (rowList && rowList.work === work && rowList.parent === group) {
      if (rowList.list.items.length < ROW_CAP) rowList.list.items.push(t);
      const total = (rowList.list.total ?? rowList.list.items.length - 1) + 1;
      rowList.list.total = total;
      rowList.list.truncated = total > rowList.list.items.length;
    } else {
      const list: ReadList = { items: [t], total: 1, truncated: false };
      work.lists.push(list);
      rowList = { parent: group, work, list };
    }
  };
  /** A row's text pieces, controls' visible text included (an icon-only button has none). */
  const rowPieces = (row: Element): string[] => {
    const parts: string[] = [];
    const visit = (el: Element) => {
      for (const n of Array.from(el.childNodes)) {
        if (n.nodeType === 3) {
          const t = norm((n as Text).data);
          if (t && /[\p{L}\p{N}]/u.test(t)) parts.push(t);
          continue;
        }
        if (n.nodeType !== 1) continue;
        const c = n as Element;
        if (SKIP_TAGS.has(c.localName) || env.skip(c) || isHidden(c, ctx)) continue;
        if (c.getAttribute("aria-hidden") === "true") continue;
        if (["menu", "listbox", "dialog", "tooltip"].includes(roleOf(c))) continue;
        if (env.sensitive(c)) continue;
        visit(c);
      }
    };
    visit(row);
    return parts;
  };
  const FLAT_ROW_EXCLUDES =
    'h1, h2, h3, h4, h5, h6, [role="heading"], table, [role="table"], [role="grid"], ul, ol, dl, input, select, textarea, [contenteditable]';
  /**
   * A row of a listing that is not itself a control, such as a table's name cell as the button
   * beside its columns: a flat block holding a control and at least two pieces of text, among
   * siblings of the same element and class. Read whole, as one item.
   */
  const listingRow = (el: Element, role: string): string => {
    if (role && role !== "row") return "";
    if (!["div", "li", "article"].includes(el.localName)) return "";
    if (el.querySelector(FLAT_ROW_EXCLUDES)) return "";
    if (!el.querySelector('button, [role="button"], a[href], [role="link"]')) return "";
    let unit: Element = el;
    let parent = el.parentElement;
    if (parent && parent.children.length === 1 && parent !== env.root) {
      unit = parent;
      parent = parent.parentElement;
    }
    if (!parent) return "";
    const cls = unit.getAttribute("class") ?? "";
    const peers = Array.from(parent.children).filter(
      (c) => c.localName === unit.localName && (c.getAttribute("class") ?? "") === cls,
    );
    if (peers.length < 2) return "";
    const parts = rowPieces(el);
    if (parts.length < 2) return "";
    const t = clampText(parts.join(" · "), 500);
    return t.length <= 500 ? t : "";
  };

  const listOf = (el: Element): ReadList | null => {
    const items = Array.from(
      el.querySelectorAll(
        ':scope > li, :scope > [role="listitem"], :scope > * > [role="listitem"]',
      ),
    ).filter((li) => !isHidden(li, ctx) && !env.skip(li));
    const texts: string[] = [];
    for (const li of items) {
      if (texts.length >= ROW_CAP) break;
      const t = text(li, 500);
      if (t && keep(t.length)) texts.push(t);
    }
    if (!texts.length) return null;
    return { items: texts, total: items.length, truncated: items.length > texts.length };
  };

  const cell = (c: Element) => {
    // A cell shows its controls' values; a private control keeps the whole cell private.
    const controls = Array.from(c.querySelectorAll("input, textarea, select"));
    if (env.sensitive(c) || controls.some((k) => env.sensitive(k))) {
      redacted++;
      return "";
    }
    const t = text(c, 300);
    keep(t.length);
    return t;
  };

  const nativeTable = (t: HTMLTableElement): ReadTable | ReadField[] => {
    const all = Array.from(t.rows ?? []).filter(
      (r) => r.closest("table") === t && !isHidden(r, ctx) && !env.skip(r),
    );
    const isHead = (r: HTMLTableRowElement, i: number) =>
      r.parentElement?.localName === "thead" ||
      (i === 0 &&
        r.cells.length > 0 &&
        Array.from(r.cells).every((c) => c.localName === "th") &&
        r.cells.length > 1);
    const heads = all.filter(isHead);
    const body = all.filter((r, i) => !isHead(r, i));
    const caption =
      (t.caption ? text(t.caption, 200) : "") ||
      norm(t.getAttribute("aria-label")) ||
      (t.hasAttribute("aria-labelledby") ? idrefText(t, "aria-labelledby", ctx) : "");
    // A two-column table of row headers and values is a list of fields.
    if (
      !heads.length &&
      body.length &&
      body.every((r) => r.cells.length === 2 && r.cells[0]!.localName === "th")
    )
      return body.map((r) => ({ label: cell(r.cells[0]!), value: cell(r.cells[1]!) }));
    const columns: string[] = [];
    const last = heads[heads.length - 1];
    if (last)
      for (const c of Array.from(last.cells)) {
        columns.push(cell(c));
        for (let i = 1; i < (c.colSpan || 1); i++) columns.push("");
      }
    const rows: string[][] = [];
    for (const r of body) {
      if (rows.length >= ROW_CAP) break;
      rows.push(Array.from(r.cells).map(cell));
    }
    const count = Number(t.getAttribute("aria-rowcount"));
    const total = count > 0 ? Math.max(0, count - heads.length) : body.length;
    return { caption, columns, rows, total, truncated: total > rows.length };
  };

  const ariaTable = (g: Element): ReadTable => {
    const rowEls = Array.from(g.querySelectorAll('[role="row"]')).filter(
      (r) => !isHidden(r, ctx) && !env.skip(r),
    );
    const idx = (el: Element, attr: string) => {
      const n = Number(el.getAttribute(attr));
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    const header = new Map<number, string>();
    const headerOrder: string[] = [];
    const bodies = new Map<string, Map<number, string>>();
    const order: string[] = [];
    const headerIndexes = new Set<string>();
    rowEls.forEach((r, i) => {
      const heads = Array.from(r.querySelectorAll('[role="columnheader"]'));
      const key = r.getAttribute("aria-rowindex") ?? `dom-${i}`;
      if (heads.length) {
        headerIndexes.add(key);
        for (const h of heads) {
          if (isHidden(h, ctx)) continue;
          const c = idx(h, "aria-colindex");
          const t = cell(h);
          if (c !== null) header.set(c, t);
          else headerOrder.push(t);
        }
        return;
      }
      if (!bodies.has(key)) {
        if (bodies.size >= ROW_CAP) return;
        bodies.set(key, new Map());
        order.push(key);
      }
      const row = bodies.get(key)!;
      const cells = Array.from(
        r.querySelectorAll('[role="gridcell"], [role="cell"], [role="rowheader"]'),
      ).filter((c) => c.closest('[role="row"]') === r);
      let next = row.size ? Math.max(...row.keys()) + 1 : 1;
      for (const c of cells) {
        if (isHidden(c, ctx)) continue;
        const at = idx(c, "aria-colindex") ?? next;
        next = at + 1;
        row.set(at, cell(c));
      }
    });
    const colIdx = [
      ...new Set([...header.keys(), ...[...bodies.values()].flatMap((m) => [...m.keys()])]),
    ].sort((a, b) => a - b);
    const columns = header.size ? colIdx.map((c) => header.get(c) ?? "") : headerOrder;
    const sorted = [...order].sort((a, b) => {
      const x = Number(a);
      const y = Number(b);
      return Number.isFinite(x) && Number.isFinite(y) ? x - y : 0;
    });
    const rows = sorted.map((k) => {
      const m = bodies.get(k)!;
      return header.size || colIdx.length ? colIdx.map((c) => m.get(c) ?? "") : [...m.values()];
    });
    const caption =
      norm(g.getAttribute("aria-label")) ||
      (g.hasAttribute("aria-labelledby") ? idrefText(g, "aria-labelledby", ctx) : "");
    const count = Number(g.getAttribute("aria-rowcount"));
    const total = count > 0 ? Math.max(rows.length, count - headerIndexes.size) : rows.length;
    return { caption, columns, rows, total, truncated: total > rows.length };
  };

  const children = (el: Element, skipFirst: Element | null) => {
    const shadow = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
    const kids = shadow ? Array.from(shadow.childNodes) : Array.from(el.childNodes);
    // Items of a flex or grid row are separate boxes: "Status: draft" and "Revision 1" in two
    // spans with no space between them are two lines, not "Status: draftRevision 1".
    const apart = kids.some((n) => n.nodeType === 1) && laysOutApart(el, ctx);
    for (const n of kids) {
      if (capped) return;
      if (n === skipFirst) continue;
      if (n.nodeType === 3) line += (n as Text).data;
      else if (n.nodeType === 1) {
        if (apart) breakLine();
        visit(n as Element);
        if (apart) breakLine();
      }
    }
  };

  const visit = (el: Element): void => {
    if (capped) return;
    if (++nodes > NODE_CAP) {
      capped = true;
      return;
    }
    const tag = el.localName;
    if (SKIP_TAGS.has(tag) || env.skip(el) || el.getAttribute("aria-hidden") === "true") return;
    if (isHidden(el, ctx)) return;
    if (tag === "slot") {
      const assigned = (el as HTMLSlotElement).assignedNodes?.({ flatten: true }) ?? [];
      for (const n of assigned.length ? assigned : Array.from(el.childNodes)) {
        if (n.nodeType === 3) line += (n as Text).data;
        else if (n.nodeType === 1) visit(n as Element);
      }
      return;
    }
    if (tag === "label") {
      // A label is its control's name: read once, as the field.
      const control = (el as HTMLLabelElement).control;
      if (control) {
        if (el.contains(control)) visit(control);
        return;
      }
    }
    const role = roleOf(el);
    const field = (tag === "input" || tag === "select" || tag === "textarea") && role !== "file";
    if (env.sensitive(el)) {
      redacted++;
      breakLine();
      if (field || role === "textbox") {
        const f = controlField(el, role === "listbox-select" ? "listbox" : role);
        if (f) here().fields.push({ label: f.label, value: "", sensitive: true });
      }
      return;
    }
    try {
      if (el.matches(NOTICE)) {
        const t = text(el, 200);
        if (t && notices.length < 5 && !notices.includes(t)) notices.push(t);
        return;
      }
    } catch {
      // Selector unsupported: read it as content.
    }
    if (role === "navigation" && !env.navigation) return;

    // Regions whose content cannot be read: said, with their titles; never guessed.
    if (tag === "svg" || tag === "canvas" || classOf(el).includes("highcharts-container")) {
      const shapes =
        tag === "canvas"
          ? 0
          : el.querySelectorAll("path, rect, circle, line, polyline, polygon").length;
      const lib = opaqueKind(el);
      const label =
        norm(el.getAttribute("aria-label")) ||
        (el.hasAttribute("aria-labelledby") ? idrefText(el, "aria-labelledby", ctx) : "");
      if (tag === "canvas" || shapes >= 12 || lib) {
        breakLine();
        if (label && tag !== "canvas") here().paras.push(`Chart: ${label}`);
        else
          addOpaque(el, {
            kind: tag === "canvas" ? "canvas" : "chart",
            title: label || opaqueTitle(el) || norm(el.getAttribute("title")),
            ...(lib ? { library: lib } : {}),
          });
      }
      return;
    }
    if (tag === "iframe" || tag === "frame") {
      let inner: Document | null = null;
      try {
        inner = (el as HTMLIFrameElement).contentDocument;
      } catch {
        inner = null;
      }
      breakLine();
      if (inner?.body) visit(inner.body);
      else addOpaque(el, { kind: "frame", title: norm(el.getAttribute("title")) });
      breakLine();
      return;
    }
    if (tag.includes("-") && !el.shadowRoot && !el.children.length && !norm(el.textContent)) {
      const defined = (
        el.ownerDocument?.defaultView as (Window & typeof globalThis) | null
      )?.customElements?.get(tag);
      if (defined)
        addOpaque(el, {
          kind: "closed-shadow",
          title: norm(el.getAttribute("aria-label")) || `<${tag}>`,
        });
      return;
    }
    if (classOf(el).includes("gc-spread") || el.hasAttribute("gcuielement")) {
      breakLine();
      addOpaque(el, {
        kind: "canvas",
        title: norm(el.getAttribute("aria-label")),
        library: "a SpreadJS spreadsheet",
      });
      return;
    }

    const row = listingRow(el, role);
    if (row) {
      if (keep(row.length)) addRow(el, row);
      return;
    }
    if (role === "heading") {
      breakLine();
      const lv = /^h[1-6]$/.test(tag) ? Number(tag[1]) : Number(el.getAttribute("aria-level")) || 2;
      const t = text(el, 200);
      if (t && keep(t.length)) cur = open(t, Math.min(6, Math.max(1, lv)));
      return;
    }
    if ((tag === "table" && role === "table") || TABLE_ROLES.has(role)) {
      breakLine();
      const t =
        tag === "table" && !el.querySelector('[role="row"]')
          ? nativeTable(el as HTMLTableElement)
          : ariaTable(el);
      if (Array.isArray(t)) here().fields.push(...t.filter((f) => f.label || f.value));
      else if (t.rows.length || t.columns.length) here().tables.push(t);
      return;
    }
    if (tag === "dl") {
      breakLine();
      let label = "";
      for (const c of Array.from(
        el.querySelectorAll(":scope > dt, :scope > dd, :scope > div > dt, :scope > div > dd"),
      )) {
        if (isHidden(c, ctx)) continue;
        if (c.localName === "dt") label = cell(c);
        else if (label) here().fields.push({ label, value: cell(c) });
      }
      return;
    }
    if (
      role === "list" &&
      !el.querySelector('h1, h2, h3, h4, h5, h6, [role="heading"], table, [role="grid"]')
    ) {
      breakLine();
      const l = listOf(el);
      if (l) here().lists.push(l);
      return;
    }
    if (field) {
      breakLine();
      const f = controlField(el, role);
      if (f) here().fields.push(f);
      return;
    }
    if (role === "checkbox" || role === "radio") {
      breakLine();
      const f = controlField(el, role);
      if (f) here().fields.push(f);
      return;
    }
    if (CONTROL_ROLES.has(role)) {
      if (!(role === "button" || role === "menuitem" || role === "option") || !isItemBlock(el))
        return;
      const t = itemRowText(el);
      if (!t || !keep(t.length)) return;
      addRow(el, t);
      return;
    }
    if (role === "progressbar" || role === "meter" || tag === "progress" || tag === "meter") {
      breakLine();
      const now =
        el.getAttribute("aria-valuetext") ??
        el.getAttribute("aria-valuenow") ??
        el.getAttribute("value");
      const max = el.getAttribute("aria-valuemax") ?? el.getAttribute("max");
      const label = accessibleName(el, role, ctx).name || role || tag;
      if (now !== null)
        here().fields.push({
          label,
          value: max && !el.hasAttribute("aria-valuetext") ? `${now} of ${max}` : now,
        });
      return;
    }
    // A value named by another element, or a short label described by one.
    if ((!role || role === "status" || role === "note") && !hasStructure(el)) {
      const own = text(el, 400);
      if (el.hasAttribute("aria-labelledby")) {
        const label = idrefText(el, "aria-labelledby", ctx);
        if (label && own && label.length <= 60 && own.length <= 300 && label !== own) {
          breakLine();
          here().fields.push({ label, value: own });
          return;
        }
      }
      if (el.hasAttribute("aria-describedby")) {
        const value = idrefText(el, "aria-describedby", ctx);
        if (value && own && own.length <= 60 && value.length <= 300 && value !== own) {
          breakLine();
          here().fields.push({ label: own, value });
          return;
        }
      }
    }
    const kids = visibleChildren(el);
    if (BLOCK.has(tag) || kids.length === 2) {
      const pair = pairOf(el, kids);
      if (pair) {
        breakLine();
        if (keep(pair[0].length + pair[1].length))
          here().fields.push({ label: pair[0], value: pair[1] });
        return;
      }
    }

    // Containers: a named region, a dialog, or a card with a title scopes a section of its own.
    const saved = cur;
    let scoped = false;
    let skipFirst: Element | null = null;
    const block = BLOCK.has(tag);
    if (block) breakLine();
    if (el !== env.root) {
      const explicit = SCOPED_TAGS.has(tag) || SCOPED_ROLES.has(role) || role === "form";
      const ref = (() => {
        const id = norm(el.getAttribute("aria-labelledby")).split(" ")[0];
        return id ? (el.ownerDocument?.getElementById(id) ?? null) : null;
      })();
      const labelledByHeading = !!ref && el.contains(ref) && roleOf(ref) === "heading";
      const legend = tag === "fieldset" ? el.querySelector(":scope > legend") : null;
      let label = "";
      if (explicit || (block && kids.length)) {
        if (ref && !labelledByHeading) label = idrefText(el, "aria-labelledby", ctx);
        label ||= norm(el.getAttribute("aria-label"));
        if (!label && legend) label = text(legend, 120);
      }
      if (explicit || label || labelledByHeading) {
        scoped = true;
        if (legend) skipFirst = legend;
        if (label && keep(label.length))
          cur = open(clampText(label, 120), Math.min(6, (saved?.level ?? 0) + 1));
      } else if (
        kids.length > 1 &&
        roleOf(kids[0]!) === "heading" &&
        !/^h1$/.test(kids[0]!.localName) &&
        kids
          .slice(1)
          .some(
            (k) => !CONTROL_ROLES.has(roleOf(k)) && k.localName !== "button" && norm(k.textContent),
          )
      ) {
        // A card that starts with its heading: what follows the card is not under that heading.
        scoped = true;
      } else if (kids.length > 1) {
        const title = headingLike(kids[0]!, el, kids.slice(1));
        if (title && keep(title.length)) {
          scoped = true;
          skipFirst = kids[0]!;
          cur = open(title, Math.min(6, Math.max(2, (saved?.level ?? 1) + 1)));
        }
      }
    }
    const editor = isContentEditable(el) || classOf(el).includes("ProseMirror");
    if (editor) inDocument++;
    children(el, skipFirst);
    if (editor) inDocument--;
    if (block || scoped) breakLine();
    if (scoped) cur = saved;
  };

  visit(env.root);
  breakLine();
  const sections: ReadSection[] = works
    .map((w) => {
      const s: ReadSection = {
        heading: w.heading,
        level: w.level,
        text: w.paras.join("\n\n"),
        fields: w.fields,
        tables: w.tables,
        lists: w.lists,
      };
      if (w.opaque.length) s.opaque = w.opaque;
      return s;
    })
    .filter(
      (s) =>
        s.heading ||
        s.text ||
        s.fields.length ||
        s.tables.length ||
        s.lists.length ||
        s.opaque?.length,
    );
  return { sections, notices, opaque, redacted, capped };
}

/**
 * The page's text for `wait`: text nodes under `root` (open shadow roots and same-origin frames
 * included), skipping what `skip` says, scripts, and `hidden` or `aria-hidden` subtrees. With a
 * `ctx`, subtrees hidden by style are skipped too (slower; used to confirm a match).
 */
export function pageText(
  root: Element,
  skip: (el: Element) => boolean,
  ctx: ScanContext | null,
  max = 2_000_000,
): string {
  const parts: string[] = [];
  let size = 0;
  const walk = (el: Element) => {
    if (size > max) return;
    const tag = el.localName;
    if (tag === "script" || tag === "style" || tag === "template" || tag === "noscript") return;
    if (skip(el) || el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true") return;
    if (ctx && isHidden(el, ctx)) return;
    if (tag === "iframe" || tag === "frame") {
      try {
        const body = (el as HTMLIFrameElement).contentDocument?.body;
        if (body) walk(body);
      } catch {
        // Cross-origin: not readable.
      }
      return;
    }
    const shadow = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
    for (const n of Array.from((shadow ?? el).childNodes)) {
      if (n.nodeType === 3) {
        const t = (n as Text).data;
        parts.push(t);
        size += t.length;
      } else if (n.nodeType === 1) {
        if (BLOCK.has((n as Element).localName)) parts.push(" ");
        walk(n as Element);
      }
    }
  };
  walk(root);
  return norm(parts.join(""));
}

// ---------------------------------------------------------------------------------------------
// Query, row bounds, paging
// ---------------------------------------------------------------------------------------------

function includes(hay: string, needle: string): boolean {
  return hay.toLowerCase().includes(needle);
}

/** Keep what mentions `query`: a section whose heading does whole, else its matching parts. */
export function filterSections(sections: ReadSection[], query: string): ReadSection[] {
  const q = norm(query).toLowerCase();
  if (!q) return sections;
  const out: ReadSection[] = [];
  for (const s of sections) {
    if (includes(s.heading, q)) {
      out.push(s);
      continue;
    }
    const paras = s.text ? s.text.split("\n\n").filter((p) => includes(p, q)) : [];
    const fields = s.fields.filter((f) => includes(f.label, q) || includes(f.value, q));
    const tables = s.tables.flatMap((t) => {
      if (includes(t.caption, q) || t.columns.some((c) => includes(c, q))) return [t];
      const rows = t.rows.filter((r) => r.some((c) => includes(c, q)));
      return rows.length ? [{ ...t, rows, truncated: true }] : [];
    });
    const lists = s.lists.flatMap((l) => {
      const items = l.items.filter((i) => includes(i, q));
      return items.length ? [{ ...l, items, truncated: true }] : [];
    });
    const opaque = (s.opaque ?? []).filter((o) => includes(o.title, q));
    if (paras.length || fields.length || tables.length || lists.length || opaque.length) {
      const f: ReadSection = { ...s, text: paras.join("\n\n"), fields, tables, lists };
      if (opaque.length) f.opaque = opaque;
      else delete f.opaque;
      out.push(f);
    }
  }
  return out;
}

/** Cut every table and list to `maxRows`. */
export function boundRows(sections: ReadSection[], maxRows: number): ReadSection[] {
  return sections.map((s) => ({
    ...s,
    tables: s.tables.map((t) =>
      t.rows.length > maxRows ? { ...t, rows: t.rows.slice(0, maxRows), truncated: true } : t,
    ),
    lists: s.lists.map((l) =>
      l.items.length > maxRows ? { ...l, items: l.items.slice(0, maxRows), truncated: true } : l,
    ),
  }));
}

/** The sections under a heading: the first whose heading is `name` (else contains it) and those nested below it. */
export function sectionsUnder(sections: ReadSection[], name: string): ReadSection[] {
  const n = norm(name).toLowerCase();
  let at = sections.findIndex((s) => s.heading.toLowerCase() === n);
  if (at < 0) at = sections.findIndex((s) => s.heading && includes(s.heading, n));
  if (at < 0) return [];
  const top = sections[at]!;
  const out = [top];
  for (let i = at + 1; i < sections.length && sections[i]!.level > top.level; i++)
    out.push(sections[i]!);
  return out;
}

function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** A page of sections within `maxChars`, from `cursor`, and the cursor after it. */
export function paginate(
  sections: ReadSection[],
  maxChars: number,
  cursor: string | undefined,
): { sections: ReadSection[]; nextCursor?: string; truncated: boolean; reason?: string } {
  let start = 0;
  let offset = 0;
  let reason: string | undefined;
  if (cursor) {
    const m = /^(\d+)\.(\d+)\.([0-9a-z]+)$/.exec(cursor);
    if (!m)
      return {
        sections: [],
        truncated: false,
        reason: `the cursor “${cursor}” is not one this reader gave`,
      };
    start = Number(m[1]);
    offset = Number(m[2]);
    if (!sections[start] || hash(sections[start]!.heading) !== m[3]) {
      const found = sections.findIndex((s) => hash(s.heading) === m[3]);
      if (found < 0) {
        reason = "the page changed since that cursor; reading from the start";
        start = 0;
        offset = 0;
      } else start = found;
    }
  }
  const out: ReadSection[] = [];
  let used = 0;
  for (let i = start; i < sections.length; i++) {
    let s = sections[i]!;
    if (i === start && offset) s = { ...s, text: s.text.slice(offset), truncated: true };
    const size = formatSection(s).length;
    if (used + size <= maxChars) {
      out.push(s);
      used += size;
      offset = 0;
      continue;
    }
    if (out.length)
      return {
        sections: out,
        nextCursor: `${i}.${i === start ? offset : 0}.${hash(sections[i]!.heading)}`,
        truncated: true,
        ...(reason ? { reason } : {}),
      };
    // The first section alone is too long: fit what fits, and continue its text next time.
    const fitted = fit(s, maxChars);
    out.push(fitted.section);
    const consumed = (i === start ? offset : 0) + fitted.text;
    const more = consumed < sections[i]!.text.length;
    const next = more
      ? `${i}.${consumed}.${hash(sections[i]!.heading)}`
      : i + 1 < sections.length
        ? `${i + 1}.0.${hash(sections[i + 1]!.heading)}`
        : undefined;
    return {
      sections: out,
      ...(next ? { nextCursor: next } : {}),
      truncated: true,
      ...(reason ? { reason } : {}),
    };
  }
  return { sections: out, truncated: false, ...(reason ? { reason } : {}) };
}

/** Fit one section into `budget` characters: rows and items first, then as much text as is left. */
function fit(s: ReadSection, budget: number): { section: ReadSection; text: number } {
  let section: ReadSection = { ...s, text: "", truncated: true };
  const size = () => formatSection(section).length;
  let rows = Math.max(
    ...section.tables.map((t) => t.rows.length),
    ...section.lists.map((l) => l.items.length),
    0,
  );
  while (size() > budget && rows > 1) {
    rows = Math.floor(rows / 2);
    section = {
      ...section,
      tables: section.tables.map((t) =>
        t.rows.length > rows ? { ...t, rows: t.rows.slice(0, rows), truncated: true } : t,
      ),
      lists: section.lists.map((l) =>
        l.items.length > rows ? { ...l, items: l.items.slice(0, rows), truncated: true } : l,
      ),
    };
  }
  if (size() > budget) section = { ...section, fields: section.fields.slice(0, 20) };
  const room = Math.max(0, budget - size() - 4);
  let take = Math.min(s.text.length, room);
  if (take < s.text.length) {
    const space = s.text.lastIndexOf(" ", take);
    if (space > take * 0.6) take = space + 1;
  }
  section = { ...section, text: s.text.slice(0, take).trimEnd() };
  return { section, text: take };
}

// ---------------------------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------------------------

const cellText = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

/** One section as Markdown. */
export function formatSection(s: ReadSection): string {
  const out: string[] = [];
  if (s.level > 0) out.push(`${"#".repeat(Math.min(6, s.level + 1))} ${s.heading}`, "");
  if (s.fields.length) {
    for (const f of s.fields)
      out.push(`- **${f.label}:** ${f.sensitive ? "(private, not shown)" : f.value || "(empty)"}`);
    out.push("");
  }
  if (s.text) out.push(s.text, "");
  for (const t of s.tables) {
    if (t.caption && t.caption !== s.heading) out.push(`**${t.caption}**`, "");
    const width = Math.max(t.columns.length, ...t.rows.map((r) => r.length), 1);
    const head = t.columns.length ? t.columns : Array.from({ length: width }, () => "");
    const pad = (r: string[]) => [...r, ...Array.from({ length: width - r.length }, () => "")];
    out.push(`| ${pad(head).map(cellText).join(" | ")} |`, `|${" --- |".repeat(width)}`);
    for (const r of t.rows) out.push(`| ${pad(r).map(cellText).join(" | ")} |`);
    if (t.truncated)
      out.push(
        "",
        `_${t.rows.length} of ${t.total !== undefined && t.total > t.rows.length ? t.total : "more"} rows shown._`,
      );
    out.push("");
  }
  for (const l of s.lists) {
    for (const i of l.items) out.push(`- ${i}`);
    if (l.truncated)
      out.push(
        `- _… ${l.total !== undefined && l.total > l.items.length ? `${l.total - l.items.length} more` : "more"}_`,
      );
    out.push("");
  }
  for (const o of s.opaque ?? [])
    out.push(
      `_${o.kind === "frame" ? "A frame from another site" : o.kind === "closed-shadow" ? "A component with a closed shadow root" : o.library ? o.library.charAt(0).toUpperCase() + o.library.slice(1) : o.kind === "canvas" ? "A canvas" : "A chart"}${o.title ? ` (“${o.title}”)` : ""}: drawn so its content cannot be read here; its values are not shown._`,
      "",
    );
  if (s.truncated) out.push("_(continued)_", "");
  return out.join("\n");
}

/** A read as Markdown: what the page shows, for an agent or a terminal. */
export function formatRead(r: PageRead): string {
  const out: string[] = [];
  out.push(`# ${r.title || r.route}`, "");
  out.push(
    `Page ${r.path} at rev ${r.rev}${r.region ? `, region “${r.region}”` : ""}. Content the page shows the person${r.redacted ? `; ${r.redacted} private ${r.redacted === 1 ? "value" : "values"} withheld` : ""}.`,
    "",
  );
  if (r.reason) out.push(`_${r.reason}._`, "");
  if (r.regions?.length) out.push(`Regions: ${r.regions.map((x) => `“${x}”`).join(", ")}.`, "");
  for (const n of r.notices) out.push(`> Notice: ${n}`, "");
  for (const s of r.sections) out.push(formatSection(s));
  if (r.nextCursor) out.push(`_More on the page: read again with cursor “${r.nextCursor}”._`, "");
  else if (r.truncated) out.push("_Some content was left out; narrow with region or query._", "");
  return (
    out
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trimEnd() + "\n"
  );
}
