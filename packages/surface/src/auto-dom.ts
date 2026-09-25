/**
 * The accessibility semantics `autoSurface` reads from a rendered page: roles, accessible names,
 * availability and its reason, values, the named containers a control sits in, and the events a
 * person's pointer and keyboard cause. Framework-free and dependency-free: it reads the DOM and
 * nothing else, so it runs on any page and in jsdom.
 *
 * The name computation follows the order of the W3C accessible name algorithm (accname 1.2)
 * closely enough for a high hit rate on real applications: `aria-labelledby`, `aria-label`, the
 * native label (`label[for]`, a wrapping `label`, `alt`, `value`, `legend`, `caption`), the
 * control's own text content, `title`, and `placeholder` last. Where it stops short of the full
 * algorithm (CSS generated content, embedded-control values inside labels) is listed in
 * docs/auto-surface.md.
 */

/** Where a derived name came from, in the order the computation tries them. */
export type NameFrom =
  | "pin"
  | "config"
  | "aria-labelledby"
  | "aria-label"
  | "label"
  | "text"
  | "alt"
  | "value"
  | "title"
  | "heading"
  | "placeholder"
  | "icon"
  | "href"
  | "nearby"
  | "role"
  | "declared"
  | "none";

/** How far an agent can trust a derived name: from the page's own labels (high) down to a guess from an icon's class (low). */
export type Confidence = "high" | "medium" | "low" | "none";

export function confidenceOf(from: NameFrom, name: string): Confidence {
  if (!name || from === "none") return "none";
  switch (from) {
    case "pin":
    case "config":
    case "declared":
    case "aria-labelledby":
    case "aria-label":
    case "label":
      return "high";
    case "text":
      // A single glyph ("×", "+", "…") is text, but not a name anyone would act on.
      return /[\p{L}\p{N}]{2,}/u.test(name) ? "high" : "low";
    case "alt":
    case "value":
    case "title":
    case "heading":
    case "role":
      return "medium";
    default:
      return "low";
  }
}

type Win = Window & typeof globalThis;

export function windowOf(node: Node): Win {
  const doc = node.nodeType === 9 ? (node as Document) : node.ownerDocument;
  return (doc?.defaultView ?? globalThis) as Win;
}

/** Collapse whitespace and trim. */
export function norm(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

const MAX_NAME = 120;

export function clampText(text: string, max = MAX_NAME): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

// ---------------------------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------------------------

/** Roles that become action entries. */
export const ACTION_ROLES = new Set([
  "button",
  "link",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "tab",
  "switch",
  "checkbox",
  "radio",
  "option",
  "treeitem",
  "combobox-trigger",
]);
/** Roles that become field entries (when the element holds an editable value). */
export const FIELD_ROLES = new Set(["textbox", "searchbox", "combobox", "spinbutton", "slider"]);
/** Roles that become collection entries. */
export const COLLECTION_ROLES = new Set(["grid", "treegrid", "table", "listbox", "tree"]);
/** Landmarks a `navigate` act can bring into view. */
export const LANDMARK_ROLES = new Set([
  "main",
  "navigation",
  "banner",
  "contentinfo",
  "complementary",
  "search",
  "region",
  "form",
]);

const NAME_FROM_CONTENT = new Set([
  "button",
  "link",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "tab",
  "switch",
  "checkbox",
  "radio",
  "option",
  "treeitem",
  "heading",
  "cell",
  "gridcell",
  "rowheader",
  "columnheader",
  "row",
  "tooltip",
  "combobox-trigger",
]);

const TEXT_INPUT_TYPES = new Set([
  "",
  "text",
  "email",
  "tel",
  "url",
  "password",
  "date",
  "datetime-local",
  "month",
  "week",
  "time",
  "color",
]);

/** The element's role: its explicit `role` when valid, else its implicit ARIA role; `""` when it has none worth reading. */
export function roleOf(el: Element): string {
  const explicit = norm(el.getAttribute("role")).split(" ")[0]?.toLowerCase() ?? "";
  const tag = el.localName;
  if (explicit && explicit !== "presentation" && explicit !== "none" && explicit !== "generic") {
    // A combobox that is not a text input is a trigger that opens a list (Radix Select, a custom
    // dropdown): an action, not a field.
    if (explicit === "combobox" && !isTextEditable(el)) return "combobox-trigger";
    return explicit;
  }
  switch (tag) {
    case "button":
      return "button";
    case "a":
    case "area":
      return el.hasAttribute("href") ? "link" : "";
    case "summary":
      return "button";
    case "select": {
      const s = el as HTMLSelectElement;
      return s.multiple || s.size > 1 ? "listbox-select" : "combobox";
    }
    case "textarea":
      return "textbox";
    case "input": {
      const type = (el.getAttribute("type") ?? "").toLowerCase();
      if (type === "hidden") return "";
      if (type === "button" || type === "submit" || type === "reset" || type === "image")
        return "button";
      if (type === "checkbox") return "checkbox";
      if (type === "radio") return "radio";
      if (type === "range") return "slider";
      if (type === "number") return "spinbutton";
      if (type === "search") return el.hasAttribute("list") ? "combobox" : "searchbox";
      if (type === "file") return "file";
      if (el.hasAttribute("list")) return "combobox";
      return TEXT_INPUT_TYPES.has(type) ? "textbox" : "textbox";
    }
    case "table":
      return "table";
    case "nav":
      return "navigation";
    case "main":
      return "main";
    case "aside":
      return "complementary";
    case "search":
      return "search";
    case "dialog":
      return "dialog";
    case "form":
      return hasOwnName(el) ? "form" : "";
    case "section":
      return hasOwnName(el) ? "region" : "";
    case "header":
      return el.closest("article, section, main, aside, nav") ? "" : "banner";
    case "footer":
      return el.closest("article, section, main, aside, nav") ? "" : "contentinfo";
    case "fieldset":
      return "group";
    case "tr":
      return "row";
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      return "heading";
    default:
      break;
  }
  if (isContentEditable(el)) return "textbox";
  return "";
}

function hasOwnName(el: Element): boolean {
  return !!(norm(el.getAttribute("aria-label")) || el.getAttribute("aria-labelledby"));
}

export function isContentEditable(el: Element): boolean {
  const v = el.getAttribute("contenteditable");
  if (v === null) return false;
  if (v === "false") return false;
  // Only the editing host, not every descendant that inherits editability.
  const parent = el.parentElement?.closest("[contenteditable]");
  return !(parent && parent.getAttribute("contenteditable") !== "false");
}

function isTextEditable(el: Element): boolean {
  return (
    el.localName === "input" ||
    el.localName === "textarea" ||
    el.localName === "select" ||
    isContentEditable(el)
  );
}

/** The selector for elements that may become entries; each match is confirmed by `roleOf`. */
export const CANDIDATE_SELECTOR = [
  "button",
  "a[href]",
  "area[href]",
  "summary",
  "input",
  "select",
  "textarea",
  "table",
  "[contenteditable]",
  "[role]",
  "[data-surface-id]",
  "nav",
  "main",
  "aside",
  "search",
  "form",
  "section",
  "header",
  "footer",
].join(",");

// ---------------------------------------------------------------------------------------------
// Visibility and blocking
// ---------------------------------------------------------------------------------------------

/**
 * Per-scan caches and page facts. `layout` is true in a real browser (sizes and `checkVisibility`
 * mean something) and false under jsdom, where only attributes and computed `display` are read.
 */
export class ScanContext {
  readonly hidden = new Map<Element, boolean>();
  readonly ariaHidden = new Map<Element, boolean>();
  readonly win: Win;
  readonly modal: Element | null;
  readonly modalName: string;
  constructor(
    readonly root: Element,
    readonly layout: boolean,
  ) {
    this.win = windowOf(root);
    this.modal = findModal(root, this);
    this.modalName = this.modal ? nameOfContainer(this.modal, this) : "";
  }
}

function composedParent(el: Element): Element | null {
  if (el.parentElement) return el.parentElement;
  const root = el.getRootNode();
  if (root && (root as ShadowRoot).host) return (root as ShadowRoot).host;
  // Inside a same-origin iframe: continue at the frame element.
  const frame = windowOf(el).frameElement;
  return frame ?? null;
}

/** `ancestor` contains `el` across shadow boundaries and same-origin frames. */
export function containsComposed(ancestor: Element, el: Element): boolean {
  let cur: Element | null = el;
  while (cur) {
    if (cur === ancestor) return true;
    cur = composedParent(cur);
  }
  return false;
}

function styleOf(el: Element, ctx: ScanContext): CSSStyleDeclaration | null {
  try {
    return windowOf(el).getComputedStyle(el);
  } catch {
    void ctx;
    return null;
  }
}

/** Hidden from everyone: `hidden`, `display: none`, `visibility: hidden`, a closed `<details>`, or (with layout) no box at all. */
export function isHidden(el: Element, ctx: ScanContext): boolean {
  const cached = ctx.hidden.get(el);
  if (cached !== undefined) return cached;
  let out = false;
  const cv = (el as Element & { checkVisibility?: (o?: object) => boolean }).checkVisibility;
  if (ctx.layout && typeof cv === "function") {
    out = !cv.call(el, { visibilityProperty: true, contentVisibilityAuto: false });
  } else {
    if (el.hasAttribute("hidden") && el.getAttribute("hidden") !== "until-found") out = true;
    if (!out) {
      const s = styleOf(el, ctx);
      if (s && (s.display === "none" || s.visibility === "hidden" || s.visibility === "collapse"))
        out = true;
    }
    if (!out) {
      const parent = composedParent(el);
      // A closed <details> hides everything but its summary.
      if (parent && parent.localName === "details" && !(parent as HTMLDetailsElement).open) {
        out = el.localName !== "summary";
      }
      if (!out && parent) out = isHidden(parent, ctx);
    }
  }
  ctx.hidden.set(el, out);
  return out;
}

/** Hidden from assistive technology: `aria-hidden="true"` on the element or an ancestor. */
export function isAriaHidden(el: Element, ctx: ScanContext): boolean {
  const cached = ctx.ariaHidden.get(el);
  if (cached !== undefined) return cached;
  let out = el.getAttribute("aria-hidden") === "true";
  if (!out) {
    const parent = composedParent(el);
    if (parent) out = isAriaHidden(parent, ctx);
  }
  ctx.ariaHidden.set(el, out);
  return out;
}

function findModal(root: Element, ctx: ScanContext): Element | null {
  const found: Element[] = [];
  const visit = (scope: ParentNode) => {
    for (const d of Array.from(
      scope.querySelectorAll('[aria-modal="true"], dialog[open], [role="alertdialog"]'),
    )) {
      let modal = d.getAttribute("aria-modal") === "true";
      if (!modal && d.localName === "dialog") {
        try {
          modal = d.matches(":modal");
        } catch {
          modal = false;
        }
      }
      if (!modal && d.getAttribute("role") === "alertdialog") modal = true;
      if (modal) found.push(d);
    }
  };
  visit(root.ownerDocument ?? root);
  // Topmost: the last one in document order that is shown.
  for (let i = found.length - 1; i >= 0; i--) {
    const d = found[i]!;
    if (!isHidden(d, ctx)) return d;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Text and names
// ---------------------------------------------------------------------------------------------

interface TextResult {
  text: string;
  /** Some of the text came from text nodes, not only from `alt` or an SVG title. */
  fromText: boolean;
}

const SKIP_TEXT = new Set(["script", "style", "template", "noscript"]);

/** The text an element contributes to a name from content (accname step 2F, simplified). */
export function textOf(node: Node, ctx: ScanContext, skip?: Element, depth = 0): TextResult {
  let text = "";
  let fromText = false;
  const visit = (n: Node, d: number): void => {
    if (d > 30) return;
    if (n.nodeType === 3) {
      const t = (n as Text).data;
      if (t.trim()) fromText = true;
      text += t;
      return;
    }
    if (n.nodeType !== 1 && n.nodeType !== 11) return;
    if (n.nodeType === 1) {
      const el = n as Element;
      if (el === skip) return;
      if (SKIP_TEXT.has(el.localName)) return;
      if (d > 0) {
        if (el.getAttribute("aria-hidden") === "true") return;
        if (isHidden(el, ctx)) return;
        const label = norm(el.getAttribute("aria-label"));
        if (label) {
          text += ` ${label} `;
          return;
        }
      }
      if (
        el.localName === "img" ||
        (el.localName === "input" && el.getAttribute("type") === "image")
      ) {
        const alt = norm(el.getAttribute("alt"));
        if (alt) text += ` ${alt} `;
        return;
      }
      if (el.localName === "svg") {
        const title = el.querySelector("title");
        if (title) text += ` ${norm(title.textContent)} `;
        return;
      }
      if (el.localName === "input" && d > 0) {
        const input = el as HTMLInputElement;
        if (TEXT_INPUT_TYPES.has(input.type) && input.type !== "password")
          text += ` ${input.value} `;
        return;
      }
      if (el.localName === "slot") {
        const assigned = (el as HTMLSlotElement).assignedNodes?.({ flatten: true }) ?? [];
        const kids = assigned.length ? assigned : Array.from(el.childNodes);
        for (const k of kids) visit(k, d + 1);
        return;
      }
      if (el.localName === "br") {
        text += " ";
        return;
      }
      const shadow = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
      text += " ";
      if (shadow) {
        for (const k of Array.from(shadow.childNodes)) visit(k, d + 1);
      } else {
        for (const k of Array.from(el.childNodes)) visit(k, d + 1);
      }
      text += " ";
      return;
    }
    for (const k of Array.from(n.childNodes)) visit(k, d + 1);
  };
  visit(node, depth);
  return { text: norm(text), fromText };
}

function byIdIn(el: Element, id: string): Element | null {
  const root = el.getRootNode() as Document | ShadowRoot;
  if (typeof (root as Document).getElementById === "function")
    return (root as Document).getElementById(id);
  return el.ownerDocument?.getElementById(id) ?? null;
}

/** Text of the elements an IDREF list names (`aria-labelledby`, `aria-describedby`), hidden ones included. */
export function idrefText(el: Element, attr: string, ctx: ScanContext): string {
  const ids = norm(el.getAttribute(attr)).split(" ").filter(Boolean);
  const parts: string[] = [];
  for (const id of ids) {
    const ref = byIdIn(el, id);
    if (!ref) continue;
    const label = norm(ref.getAttribute("aria-label"));
    parts.push(label || textOfIgnoringHidden(ref, ctx));
  }
  return norm(parts.join(" "));
}

/** Referenced text counts even when the referenced element is hidden (accname 2B). */
function textOfIgnoringHidden(el: Element, ctx: ScanContext): string {
  const t = textOf(el, ctx).text;
  return t || norm(el.textContent);
}

/** Text of a label element, leaving out the control it labels. */
function labelText(label: Element, control: Element, ctx: ScanContext): string {
  return textOf(label, ctx, control).text;
}

function labelsOf(el: Element): Element[] {
  try {
    const labels = (el as HTMLInputElement).labels;
    if (labels && labels.length) return Array.from(labels);
  } catch {
    // Not a labelable element.
  }
  const out: Element[] = [];
  const id = el.getAttribute("id");
  if (id) {
    const root = el.getRootNode() as Document | ShadowRoot;
    for (const l of Array.from(root.querySelectorAll?.("label[for]") ?? []))
      if (l.getAttribute("for") === id) out.push(l);
  }
  const wrap = el.closest("label");
  if (wrap && !out.includes(wrap)) out.push(wrap);
  return out;
}

/** Guess a name from an icon's class or sprite reference: `lucide-trash-2` gives "trash". Low confidence. */
export function iconHint(el: Element): string {
  const icons = [el, ...Array.from(el.querySelectorAll("svg, i, span, use, img"))].slice(0, 8);
  for (const icon of icons) {
    const data = icon.getAttribute("data-icon") ?? icon.getAttribute("data-testid");
    if (data && /icon/i.test(data)) return humanizeIcon(data.replace(/icon/gi, ""));
    if (data && icon !== el && icon.getAttribute("data-icon")) return humanizeIcon(data);
    const href = icon.getAttribute("href") ?? icon.getAttribute("xlink:href");
    if (icon.localName === "use" && href && href.includes("#"))
      return humanizeIcon(href.slice(href.indexOf("#") + 1));
    const cls =
      typeof icon.className === "string" ? icon.className : (icon.getAttribute("class") ?? "");
    const m =
      /(?:^|\s)(?:lucide|fa|fas|far|bi|ri|ti|tabler|mdi|heroicon|icon|ph|feather|octicon|gg|la|codicon)-([a-z][a-z0-9-]*)/i.exec(
        cls,
      );
    if (
      m &&
      !/^(solid|regular|light|thin|duotone|brands|lg|sm|xs|fw|\dx|outline|filled|icon)$/i.test(
        m[1]!,
      )
    )
      return humanizeIcon(m[1]!);
    // Material Icons put the ligature name in the text: that is text content, read elsewhere.
  }
  return "";
}

function humanizeIcon(raw: string): string {
  return norm(
    raw
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[-_]+/g, " ")
      .replace(/\b(icon|outline|solid|filled|round|sharp|\d+)\b/gi, " "),
  ).toLowerCase();
}

export interface NameResult {
  name: string;
  from: NameFrom;
}

/** The accessible name of a control, and where it came from. */
export function accessibleName(el: Element, role: string, ctx: ScanContext): NameResult {
  const done = (name: string, from: NameFrom): NameResult => ({
    name: clampText(norm(name)),
    from: norm(name) ? from : "none",
  });
  if (el.hasAttribute("aria-labelledby")) {
    const t = idrefText(el, "aria-labelledby", ctx);
    if (t) return done(t, "aria-labelledby");
  }
  const aria = norm(el.getAttribute("aria-label"));
  if (aria) return done(aria, "aria-label");
  const tag = el.localName;
  if (tag === "input") {
    const type = (el.getAttribute("type") ?? "").toLowerCase();
    if (type === "button" || type === "submit" || type === "reset") {
      const v = norm(el.getAttribute("value"));
      if (v) return done(v, "value");
      if (type === "submit") return done("Submit", "value");
      if (type === "reset") return done("Reset", "value");
    }
    if (type === "image") {
      const alt = norm(el.getAttribute("alt"));
      if (alt) return done(alt, "alt");
    }
  }
  if (
    tag === "input" ||
    tag === "select" ||
    tag === "textarea" ||
    tag === "button" ||
    tag === "meter" ||
    tag === "progress"
  ) {
    const labels = labelsOf(el);
    const t = norm(labels.map((l) => labelText(l, el, ctx)).join(" "));
    if (t) return done(t, "label");
  }
  if (tag === "fieldset") {
    const legend = el.querySelector(":scope > legend");
    if (legend) return done(textOf(legend, ctx).text, "label");
  }
  if (tag === "table") {
    const caption = el.querySelector(":scope > caption");
    if (caption) {
      const t = textOf(caption, ctx).text;
      if (t) return done(t, "label");
    }
  }
  if (NAME_FROM_CONTENT.has(role)) {
    const t = textOf(el, ctx);
    if (t.text) return done(t.text, t.fromText ? "text" : "alt");
  }
  const title = norm(el.getAttribute("title"));
  if (title) return done(title, "title");
  const placeholder = norm(el.getAttribute("placeholder") ?? el.getAttribute("aria-placeholder"));
  if (placeholder) return done(placeholder, "placeholder");
  if (isContentEditable(el)) {
    // Rich-text editors (ProseMirror, Tiptap, Lexical) often carry their placeholder on the first
    // empty paragraph as `data-placeholder`.
    const ph =
      el.getAttribute("data-placeholder") ??
      el.querySelector("[data-placeholder]")?.getAttribute("data-placeholder");
    if (norm(ph)) return done(norm(ph), "placeholder");
  }
  if (FIELD_ROLES.has(role) || role === "listbox-select") {
    const near = nearbyLabel(el, ctx);
    if (near) return done(near, "nearby");
  }
  if (COLLECTION_ROLES.has(role) || LANDMARK_ROLES.has(role)) {
    const h = precedingHeading(el, ctx) || firstHeadingIn(el, ctx);
    if (h) return done(h, "heading");
  }
  if (ACTION_ROLES.has(role)) {
    const hint = iconHint(el);
    if (hint) return done(hint, "icon");
  }
  if (role === "link") {
    const fromHref = hrefName(el);
    if (fromHref) return done(fromHref, "href");
  }
  return { name: "", from: "none" };
}

/** A link's last path segment, humanized: `/settings/billing` gives "Billing". Low confidence. */
export function hrefName(el: Element): string {
  const raw = el.getAttribute("href");
  if (!raw || raw.startsWith("#") || /^(javascript|mailto|tel):/i.test(raw)) return "";
  let path = raw;
  try {
    path = new URL(raw, "http://x.invalid/").pathname;
  } catch {
    // Keep the raw href.
  }
  const segs = path.split("/").filter((p) => p && !/^\d+$/.test(p) && !/^[0-9a-f-]{16,}$/i.test(p));
  const last = segs[segs.length - 1];
  if (!last) return path === "/" ? "Home" : "";
  let word = last;
  try {
    word = decodeURIComponent(last);
  } catch {
    // Keep it encoded.
  }
  word = norm(word.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " "));
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : "";
}

/**
 * Short text right before a field that has no label (`<div>Email</div><input>`): the previous
 * sibling's text, else the parent's previous sibling's, at most two levels up; else the nearest
 * preceding heading. Low confidence.
 */
export function nearbyLabel(el: Element, ctx: ScanContext): string {
  let cur: Element | null = el;
  for (let level = 0; cur && level < 3; level++) {
    let sib = cur.previousElementSibling;
    for (let i = 0; sib && i < 2; i++) {
      if (
        !isHidden(sib, ctx) &&
        !sib.querySelector("input, select, textarea, button, [contenteditable]")
      ) {
        const t = textOf(sib, ctx).text;
        if (t && t.length <= 60) return t.replace(/[:*]\s*$/, "").trim();
      }
      sib = sib.previousElementSibling;
    }
    cur = cur.parentElement;
    if (
      cur &&
      (cur.localName === "form" || cur.localName === "body" || LANDMARK_ROLES.has(roleOf(cur)))
    )
      break;
  }
  return precedingHeading(el, ctx);
}

function firstHeadingIn(el: Element, ctx: ScanContext): string {
  const h = el.querySelector('h1, h2, h3, h4, h5, h6, [role="heading"]');
  return h && !isHidden(h, ctx) ? textOf(h, ctx).text : "";
}

/**
 * The nearest heading before `el` in document order, within its landmark (or the document): the
 * "section heading" of a settings page whose sections are plain `div`s. At most 60 steps.
 */
export function precedingHeading(el: Element, ctx: ScanContext, stop?: Element | null): string {
  let steps = 0;
  let cur: Element | null = el;
  while (cur && steps < 60) {
    let sib: Element | null = cur.previousElementSibling;
    while (sib && steps < 60) {
      steps++;
      if (/^h[1-6]$/.test(sib.localName) || sib.getAttribute("role") === "heading") {
        if (!isHidden(sib, ctx)) return textOf(sib, ctx).text;
      } else {
        const inner = sib.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]');
        for (let i = inner.length - 1; i >= 0; i--) {
          const h = inner[i]!;
          if (!isHidden(h, ctx)) return textOf(h, ctx).text;
        }
      }
      sib = sib.previousElementSibling;
    }
    cur = cur.parentElement;
    if (!cur || cur === stop || LANDMARK_ROLES.has(roleOf(cur)) || isDialog(cur)) break;
  }
  return "";
}

function isDialog(el: Element): boolean {
  const r = el.getAttribute("role");
  return el.localName === "dialog" || r === "dialog" || r === "alertdialog";
}

/** The name of a container (a dialog, a landmark, a menu): its label, else its first heading. */
export function nameOfContainer(el: Element, ctx: ScanContext): string {
  if (el.hasAttribute("aria-labelledby")) {
    const t = idrefText(el, "aria-labelledby", ctx);
    if (t) return clampText(t, 60);
  }
  const aria = norm(el.getAttribute("aria-label"));
  if (aria) return clampText(aria, 60);
  if (el.localName === "fieldset") {
    const legend = el.querySelector(":scope > legend");
    if (legend) return clampText(textOf(legend, ctx).text, 60);
  }
  if (
    isDialog(el) ||
    el.localName === "section" ||
    el.localName === "article" ||
    el.localName === "form"
  ) {
    return clampText(firstHeadingIn(el, ctx), 60);
  }
  return "";
}

// ---------------------------------------------------------------------------------------------
// Context: the named containers a control sits in
// ---------------------------------------------------------------------------------------------

export interface ContextSegment {
  /** `landmark`, `dialog`, `region`, `menu`, `group`, `section`, `row`, or `frame`. */
  kind: string;
  /** The landmark role, or the container's name. */
  label: string;
}

/** The label of a table or grid row: its row header, else the first non-empty cell that is not the control's own. */
function rowLabel(row: Element, control: Element, ctx: ScanContext): string {
  const cells = Array.from(
    row.querySelectorAll(
      ':scope > th, :scope > td, :scope > [role="rowheader"], :scope > [role="cell"], :scope > [role="gridcell"]',
    ),
  );
  const header = cells.find((c) => c.localName === "th" || c.getAttribute("role") === "rowheader");
  if (header) {
    const t = textOf(header, ctx, control).text;
    if (t) return clampText(t, 60);
  }
  for (const c of cells) {
    if (c.contains(control) && !c.querySelector("a[href]")) continue;
    const t = textOf(c, ctx, control).text;
    if (t && /[\p{L}\p{N}]/u.test(t)) return clampText(t, 60);
  }
  const aria = norm(row.getAttribute("aria-label"));
  return aria ? clampText(aria, 60) : "";
}

/** Named containers from the outside in, and the object context (the innermost meaningful label). */
export function contextOf(
  el: Element,
  ctx: ScanContext,
): { path: ContextSegment[]; object: string } {
  const segs: ContextSegment[] = [];
  let sectionHeadingSeen = false;
  let cur: Element | null = composedParent(el);
  let landmark: Element | null = null;
  const seenRow = { done: false };
  while (cur && cur !== ctx.root.ownerDocument?.documentElement) {
    const role = roleOf(cur);
    if (cur.localName === "iframe" || cur.localName === "frame") {
      const title = norm(cur.getAttribute("title") ?? cur.getAttribute("name"));
      segs.push({ kind: "frame", label: title || "frame" });
    } else if (isDialog(cur)) {
      segs.push({ kind: "dialog", label: nameOfContainer(cur, ctx) || "dialog" });
    } else if (role === "row" && !seenRow.done) {
      seenRow.done = true;
      const label = rowLabel(cur, el, ctx);
      if (label) segs.push({ kind: "row", label });
    } else if (LANDMARK_ROLES.has(role)) {
      const name = nameOfContainer(cur, ctx);
      if (!landmark) landmark = cur;
      segs.push({ kind: "landmark", label: name ? `${role}:${name}` : role });
    } else if (
      role === "menu" ||
      role === "menubar" ||
      role === "toolbar" ||
      role === "tablist" ||
      role === "listbox" ||
      role === "group" ||
      role === "radiogroup"
    ) {
      const name = nameOfContainer(cur, ctx);
      if (name)
        segs.push({
          kind: role === "group" || role === "radiogroup" ? "group" : "menu",
          label: name,
        });
    } else if (
      !role &&
      cur !== el &&
      (cur.hasAttribute("aria-labelledby") ||
        (cur.hasAttribute("aria-label") && cur.localName === "div"))
    ) {
      // A div layout names its panels with aria-labelledby and no role: a region all the same.
      const name = nameOfContainer(cur, ctx);
      if (name) segs.push({ kind: "region", label: name });
    } else if (
      !sectionHeadingSeen &&
      (cur.localName === "article" ||
        cur.localName === "li" ||
        role === "article" ||
        role === "listitem")
    ) {
      const h = firstHeadingIn(cur, ctx);
      if (h && !cur.contains(el.closest('h1, h2, h3, h4, h5, h6, [role="heading"]'))) {
        segs.push({ kind: "section", label: clampText(h, 60) });
        sectionHeadingSeen = true;
      }
    }
    cur = composedParent(cur);
  }
  segs.reverse();
  // A plain-div settings page: the nearest heading before the control, inside its landmark.
  if (!sectionHeadingSeen && !segs.some((s) => s.kind === "row")) {
    const h = precedingHeading(el, ctx, landmark);
    if (h) segs.push({ kind: "section", label: clampText(h, 60) });
  }
  // The object: the innermost named container; a landmark counts only when it has a name.
  const inner = [...segs]
    .reverse()
    .find((s) => s.kind !== "frame" && (s.kind !== "landmark" || s.label.includes(":")));
  const object = !inner
    ? ""
    : inner.kind === "landmark"
      ? inner.label.slice(inner.label.indexOf(":") + 1)
      : inner.label;
  return { path: segs, object };
}

// ---------------------------------------------------------------------------------------------
// State: availability, reasons, values
// ---------------------------------------------------------------------------------------------

export function isDisabled(el: Element): boolean {
  try {
    if (el.matches(":disabled")) return true;
  } catch {
    // Selector unsupported: fall through.
  }
  if (el.getAttribute("aria-disabled") === "true") return true;
  const group = el.parentElement?.closest('[aria-disabled="true"]');
  if (group) {
    const r = group.getAttribute("role");
    if (
      r &&
      [
        "group",
        "toolbar",
        "menu",
        "menubar",
        "tablist",
        "radiogroup",
        "listbox",
        "grid",
        "tree",
      ].includes(r)
    )
      return true;
  }
  return false;
}

export function isReadOnly(el: Element): boolean {
  if (el.hasAttribute("readonly") && (el.localName === "input" || el.localName === "textarea"))
    return true;
  return el.getAttribute("aria-readonly") === "true";
}

export function isInert(el: Element): boolean {
  return !!el.closest("[inert]");
}

/**
 * Why a control is disabled, in the page's own words: `data-surface-reason`, its description
 * (`aria-describedby`), its error message, a `title` on it or on a wrapper (a tooltip on a
 * disabled button), the errors of the form it submits, else an empty string.
 */
export function reasonOf(el: Element, ctx: ScanContext): string {
  const own = norm(el.getAttribute("data-surface-reason"));
  if (own) return own;
  if (el.hasAttribute("aria-errormessage")) {
    const t = idrefText(el, "aria-errormessage", ctx);
    if (t) return t;
  }
  if (el.hasAttribute("aria-describedby")) {
    const t = idrefText(el, "aria-describedby", ctx);
    if (t) return t;
  }
  const title = norm(el.getAttribute("title"));
  if (title) return title;
  const wrapper = el.parentElement;
  if (wrapper && wrapper.children.length === 1) {
    const t = norm(
      wrapper.getAttribute("title") ??
        wrapper.getAttribute("data-tooltip") ??
        wrapper.getAttribute("aria-label"),
    );
    if (t) return t;
  }
  const form = (el as HTMLButtonElement).form ?? el.closest("form");
  if (form) {
    const errors: string[] = [];
    for (const field of Array.from(form.querySelectorAll('[aria-invalid="true"]'))) {
      const msg = field.hasAttribute("aria-errormessage")
        ? idrefText(field, "aria-errormessage", ctx)
        : field.hasAttribute("aria-describedby")
          ? idrefText(field, "aria-describedby", ctx)
          : "";
      const label = accessibleName(field, roleOf(field), ctx).name;
      if (msg || label)
        errors.push(msg && label ? `${label}: ${msg}` : msg || `${label} is invalid`);
    }
    if (!errors.length) {
      for (const alert of Array.from(
        form.querySelectorAll('[role="alert"], [aria-live="assertive"]'),
      )) {
        const t = textOf(alert, ctx).text;
        if (t && !isHidden(alert, ctx)) errors.push(t);
      }
    }
    if (errors.length) return clampText(errors.join("; "), 200);
    const required = Array.from(form.querySelectorAll("[required], [aria-required='true']")).filter(
      (f) => "value" in f && !(f as HTMLInputElement).value,
    );
    if (required.length) {
      const names = required
        .slice(0, 3)
        .map((f) => accessibleName(f, roleOf(f), ctx).name)
        .filter(Boolean);
      if (names.length) return `fill in ${names.join(", ")} first`;
    }
  }
  return "";
}

/** A field's current value as the page shows it; a select reports its option labels. */
export function fieldValue(el: Element): string | string[] {
  if (el.localName === "select") {
    const s = el as HTMLSelectElement;
    const labels = Array.from(s.selectedOptions ?? []).map((o) => norm(o.label || o.text));
    return s.multiple ? labels : (labels[0] ?? "");
  }
  if (el.localName === "input" || el.localName === "textarea")
    return (el as HTMLInputElement).value;
  return clampText(norm(el.textContent), 2000);
}

/** The options of a select, as the texts an agent may send: every label, and every value that differs from its label. */
export function selectChoices(el: HTMLSelectElement): string[] {
  const out = new Set<string>();
  for (const o of Array.from(el.options)) {
    if (o.disabled) continue;
    out.add(norm(o.label || o.text));
    if (o.value && o.value !== norm(o.label || o.text)) out.add(o.value);
  }
  return [...out];
}

/** An action's toggle or selection state (`{ checked }`, `{ pressed }`, `{ selected }`, `{ expanded }`), or undefined. */
export function actionValue(
  el: Element,
  role: string,
): Record<string, boolean | string> | undefined {
  const out: Record<string, boolean | string> = {};
  const tri = (v: string | null) => (v === "mixed" ? "mixed" : v === "true");
  if (el.localName === "input" && (role === "checkbox" || role === "radio" || role === "switch")) {
    const i = el as HTMLInputElement;
    out.checked = i.indeterminate ? "mixed" : i.checked;
  } else if (el.hasAttribute("aria-checked")) out.checked = tri(el.getAttribute("aria-checked"));
  if (el.hasAttribute("aria-pressed")) out.pressed = tri(el.getAttribute("aria-pressed"));
  if (el.hasAttribute("aria-selected")) out.selected = el.getAttribute("aria-selected") === "true";
  if (el.localName === "summary") {
    const d = el.parentElement;
    if (d && d.localName === "details") out.expanded = (d as HTMLDetailsElement).open;
  } else if (el.hasAttribute("aria-expanded"))
    out.expanded = el.getAttribute("aria-expanded") === "true";
  if (role === "combobox-trigger") {
    const shown = norm(el.textContent);
    if (shown) out.value = clampText(shown, 120);
  }
  return Object.keys(out).length ? out : undefined;
}

/** A field whose value never leaves the page: passwords, card numbers, one-time codes. */
export function isSensitiveField(el: Element): boolean {
  if (el.localName === "input" && (el as HTMLInputElement).type === "password") return true;
  const ac = (el.getAttribute("autocomplete") ?? "").toLowerCase();
  if (/(^|\s)(cc-[a-z-]+|one-time-code|current-password|new-password)(\s|$)/.test(ac)) return true;
  return false;
}

// ---------------------------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------------------------

export interface CollectionFacts {
  total: number | null;
  loaded: number;
  /** Only the rendered rows are in the DOM: `aria-rowcount` or `aria-setsize` says more, or rows are absolutely positioned inside a spacer. */
  virtualized: boolean;
  /** The control that loads more, when the collection has one ("Load more", "Show more"). */
  loadMore: Element | null;
  /** The element to scroll to load more, when scrolling is how. */
  scroller: Element | null;
  sort: { column: string; direction: string } | null;
}

const LOAD_MORE =
  /^(load|show|view|see|fetch) (\d+ )?(more|all)\b|^more( results| items| rows)?$|^next page$/i;

export function collectionFacts(el: Element, role: string, ctx: ScanContext): CollectionFacts {
  let rows: Element[];
  if (role === "listbox" || role === "tree") {
    rows = Array.from(el.querySelectorAll('[role="option"], [role="treeitem"]'));
  } else {
    rows = Array.from(el.querySelectorAll('tr, [role="row"]')).filter(
      (r) => !r.closest("thead") && !r.querySelector('th[scope="col"], [role="columnheader"]'),
    );
  }
  // Grids with pinned columns (ag-grid) render one row element per column container with the same
  // aria-rowindex: count each index once.
  const shown = rows.filter((r) => !isHidden(r, ctx));
  const indexes = new Set(
    shown.map((r) => r.getAttribute("aria-rowindex")).filter((v) => v !== null),
  );
  const loaded = indexes.size && indexes.size < shown.length ? indexes.size : shown.length;
  let total: number | null = null;
  const rowcount = Number(el.getAttribute("aria-rowcount"));
  if (Number.isFinite(rowcount) && rowcount > 0) {
    const headerRows = Array.from(el.querySelectorAll('tr, [role="row"]')).length - rows.length;
    total = Math.max(0, rowcount - headerRows);
  } else {
    const setsize = Number(rows[0]?.getAttribute("aria-setsize") ?? NaN);
    if (Number.isFinite(setsize) && setsize > 0) total = setsize;
  }
  let virtualized = total !== null && total > loaded;
  if (!virtualized) {
    const idx = Number(
      rows[0]?.getAttribute("aria-rowindex") ?? rows[0]?.getAttribute("aria-posinset"),
    );
    if (Number.isFinite(idx) && idx > 2) virtualized = true;
  }
  if (!virtualized && rows.length > 1) {
    const positioned = rows.slice(0, 5).filter((r) => {
      const s = (r as HTMLElement).style;
      return !!s && (s.position === "absolute" || /translate/.test(s.transform ?? ""));
    });
    if (positioned.length >= Math.min(2, rows.length)) virtualized = true;
  }
  // A scroller: the element itself or its nearest ancestor that scrolls (overflow auto/scroll).
  let scroller: Element | null = null;
  // A viewport inside the grid (ag-grid's body viewport) scrolls before the grid itself does.
  for (const inner of Array.from(
    el.querySelectorAll('[class*="viewport"], [style*="overflow"]'),
  ).slice(0, 4)) {
    const s = styleOf(inner, ctx);
    if (/auto|scroll/.test(`${s?.overflowY ?? ""} ${s?.overflow ?? ""}`)) {
      const box = inner as HTMLElement;
      if (!ctx.layout || box.scrollHeight > box.clientHeight + 2) {
        scroller = inner;
        break;
      }
    }
  }
  let cur: Element | null = scroller ? null : el;
  for (let i = 0; cur && i < 6; i++) {
    const s = styleOf(cur, ctx);
    const overflow = `${s?.overflowY ?? ""} ${s?.overflow ?? ""}`;
    if (/auto|scroll/.test(overflow)) {
      const box = cur as HTMLElement;
      if (!ctx.layout || box.scrollHeight > box.clientHeight + 2) {
        scroller = cur;
        break;
      }
    }
    cur = cur.parentElement;
  }
  // A load-more control inside the collection, or right after it.
  let loadMore: Element | null = null;
  const probe = [el, el.nextElementSibling, el.parentElement?.nextElementSibling].filter(
    Boolean,
  ) as Element[];
  for (const scope of probe) {
    const buttons = [
      scope,
      ...Array.from(scope.querySelectorAll("button, [role=button], a[href]")),
    ];
    for (const b of buttons) {
      if (!(b.localName === "button" || b.getAttribute("role") === "button" || b.localName === "a"))
        continue;
      const n = accessibleName(b, roleOf(b), ctx).name;
      if (LOAD_MORE.test(n) && !isHidden(b, ctx)) {
        loadMore = b;
        break;
      }
    }
    if (loadMore) break;
  }
  let sort: CollectionFacts["sort"] = null;
  const sorted = el.querySelector('[aria-sort="ascending"], [aria-sort="descending"]');
  if (sorted)
    sort = { column: textOf(sorted, ctx).text, direction: sorted.getAttribute("aria-sort")! };
  return {
    total,
    loaded,
    virtualized,
    loadMore,
    scroller: scroller ?? (virtualized ? el : null),
    sort,
  };
}

// ---------------------------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------------------------

function cssEscape(win: Win, s: string): string {
  const css = (win as unknown as { CSS?: { escape?: (v: string) => string } }).CSS;
  if (css?.escape) return css.escape(s);
  return s.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}

/**
 * A CSS selector that finds `el` again in its root: an id, a test id, or a short path of tags with
 * `:nth-of-type`. Reported in coverage so a configuration rule can name a control precisely.
 */
export function selectorFor(el: Element): string {
  const win = windowOf(el);
  const root = el.getRootNode() as Document | ShadowRoot;
  const unique = (sel: string) => {
    try {
      return root.querySelectorAll(sel).length === 1;
    } catch {
      return false;
    }
  };
  const pin = el.getAttribute("data-surface-id");
  if (pin) return `[data-surface-id="${pin.replace(/"/g, '\\"')}"]`;
  const id = el.getAttribute("id");
  if (id && !/^(radix-|:r|headlessui-|react-aria|mui-|rc_|__)/i.test(id) && !/\d{3,}/.test(id)) {
    const sel = `#${cssEscape(win, id)}`;
    if (unique(sel)) return sel;
  }
  for (const attr of ["data-testid", "data-test", "data-cy", "name"]) {
    const v = el.getAttribute(attr);
    if (v) {
      const sel = `${el.localName}[${attr}="${v.replace(/"/g, '\\"')}"]`;
      if (unique(sel)) return sel;
    }
  }
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && parts.length < 5) {
    let part = cur.localName;
    const parentEl: Element | null = cur.parentElement;
    if (parentEl) {
      const same = Array.from(parentEl.children).filter((c) => c.localName === cur!.localName);
      if (same.length > 1) part += `:nth-of-type(${same.indexOf(cur) + 1})`;
    }
    parts.unshift(part);
    const sel = parts.join(" > ");
    if (unique(sel)) return sel;
    const pid = parentEl?.getAttribute("id");
    if (parentEl && pid && !/\d{3,}/.test(pid)) {
      const withId = `#${cssEscape(win, pid)} > ${sel}`;
      if (unique(withId)) return withId;
    }
    cur = parentEl;
  }
  return parts.join(" > ");
}

// ---------------------------------------------------------------------------------------------
// Acting by the same door
// ---------------------------------------------------------------------------------------------

function center(el: Element): { clientX: number; clientY: number } {
  try {
    const r = el.getBoundingClientRect();
    return { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
  } catch {
    return { clientX: 0, clientY: 0 };
  }
}

function reveal(el: Element): void {
  const s = (el as HTMLElement).scrollIntoView;
  if (typeof s === "function") {
    try {
      s.call(el, { block: "center", inline: "nearest" });
    } catch {
      // Older engines: the element stays where it is.
    }
  }
}

/**
 * What a person's click causes, in order: pointer and mouse down (which is where Radix-style menus
 * open), focus, pointer and mouse up, then `click()`, which runs the element's activation behavior
 * (a checkbox toggles, a link follows, a submit button submits its form).
 */
export function activate(el: Element): void {
  const win = windowOf(el);
  reveal(el);
  const at = center(el);
  const base = { bubbles: true, cancelable: true, composed: true, button: 0, ...at };
  const P = (win.PointerEvent ?? win.MouseEvent) as typeof MouseEvent;
  const pointer = {
    ...base,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
  } as MouseEventInit;
  el.dispatchEvent(new P("pointerover", pointer));
  el.dispatchEvent(new P("pointerenter", { ...pointer, bubbles: false }));
  el.dispatchEvent(new win.MouseEvent("mouseover", base));
  const downPointer = el.dispatchEvent(new P("pointerdown", { ...pointer, buttons: 1 }));
  const downMouse =
    downPointer && el.dispatchEvent(new win.MouseEvent("mousedown", { ...base, buttons: 1 }));
  if (downMouse && typeof (el as HTMLElement).focus === "function")
    (el as HTMLElement).focus({ preventScroll: true });
  el.dispatchEvent(new P("pointerup", pointer));
  el.dispatchEvent(new win.MouseEvent("mouseup", base));
  if (typeof (el as HTMLElement).click === "function") (el as HTMLElement).click();
  else el.dispatchEvent(new win.MouseEvent("click", base));
}

function nativeSetter(el: Element, prop: "value"): ((v: string) => void) | undefined {
  const win = windowOf(el);
  const proto =
    el.localName === "textarea"
      ? win.HTMLTextAreaElement.prototype
      : el.localName === "select"
        ? win.HTMLSelectElement.prototype
        : win.HTMLInputElement.prototype;
  return Object.getOwnPropertyDescriptor(proto, prop)?.set as ((v: string) => void) | undefined;
}

/**
 * Type `text` into a field the way a person's typing ends up: focus, the value set through the
 * element's native setter (so a React-controlled input sees a change and fires `onChange`), then
 * `input` and `change` events. A select chooses the option whose label or value is `text` (a
 * multiple select takes a JSON array or a comma-separated list). A contenteditable host gets the
 * text and an `input` event. Returns false when a select has no such option.
 */
export function typeInto(el: Element, text: string): boolean {
  const win = windowOf(el);
  reveal(el);
  if (typeof (el as HTMLElement).focus === "function")
    (el as HTMLElement).focus({ preventScroll: true });
  const fire = () => {
    el.dispatchEvent(new win.Event("input", { bubbles: true, composed: true }));
    el.dispatchEvent(new win.Event("change", { bubbles: true }));
  };
  if (el.localName === "select") {
    const s = el as HTMLSelectElement;
    let wanted: string[];
    if (s.multiple) {
      try {
        const parsed: unknown = JSON.parse(text);
        wanted = Array.isArray(parsed) ? parsed.map(String) : [text];
      } catch {
        wanted = text
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
      }
    } else wanted = [text];
    const pick = (w: string) =>
      Array.from(s.options).find((o) => o.value === w) ??
      Array.from(s.options).find(
        (o) => norm(o.label || o.text).toLowerCase() === norm(w).toLowerCase(),
      );
    const chosen = wanted.map(pick);
    if (chosen.some((o) => !o)) return false;
    if (s.multiple) {
      for (const o of Array.from(s.options)) o.selected = chosen.includes(o);
    } else {
      nativeSetter(el, "value")?.call(el, chosen[0]!.value);
    }
    fire();
    return true;
  }
  if (el.localName === "input" || el.localName === "textarea") {
    const set = nativeSetter(el, "value");
    if (set) set.call(el, text);
    else (el as HTMLInputElement).value = text;
    fire();
    return true;
  }
  // A contenteditable host (ProseMirror, Tiptap, Lexical, Slate, a plain editable div). Setting a
  // value does nothing there: select what it holds, then insert the text the way typing does.
  const doc = el.ownerDocument;
  const sel = win.getSelection?.();
  if (sel && doc) {
    const range = doc.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
  }
  const IE = (win.InputEvent ?? win.Event) as unknown as typeof Event;
  const init = {
    bubbles: true,
    cancelable: true,
    composed: true,
    inputType: "insertText",
    data: text,
  } as EventInit;
  // Editors built on beforeinput (Lexical, Slate) take the edit here and cancel the default.
  const proceed = el.dispatchEvent(new IE("beforeinput", init));
  if (!proceed) {
    el.dispatchEvent(new IE("input", { ...init, cancelable: false } as EventInit));
    return true;
  }
  // Editors that observe DOM mutations (ProseMirror, Tiptap) take a real editing command.
  let done = false;
  try {
    done =
      !!doc && typeof doc.execCommand === "function" && doc.execCommand("insertText", false, text);
  } catch {
    done = false;
  }
  if (done && norm(el.textContent).includes(norm(text).slice(0, 20))) return true;
  el.textContent = text;
  el.dispatchEvent(new IE("input", { ...init, cancelable: false } as EventInit));
  return true;
}

/** Bring a landmark into view and move focus to it, as a skip link does. */
export function focusRegion(el: Element): void {
  reveal(el);
  const h = el as HTMLElement;
  if (!h.hasAttribute("tabindex")) {
    h.setAttribute("tabindex", "-1");
    h.addEventListener("blur", () => h.removeAttribute("tabindex"), { once: true });
  }
  h.focus?.({ preventScroll: true });
}

/** Scroll a container (or the window) by about a screen, then fire `scroll`, which is where virtualized lists render more. */
export function scrollMore(el: Element | null, win: Win): void {
  if (el) {
    const box = el as HTMLElement;
    const by = Math.max(box.clientHeight * 0.9, 200);
    box.scrollTop = box.scrollTop + by;
    box.dispatchEvent(new win.Event("scroll", { bubbles: false }));
  } else {
    win.scrollBy?.(0, Math.max(win.innerHeight * 0.9, 200));
    win.dispatchEvent(new win.Event("scroll"));
  }
}

/**
 * Watches the page from just before an act until it settles, keeping the time of the last change
 * and the text that appeared in a notice: a live region, an alert or status, a toast, or anything
 * newly added at the top level of the document (a portal). Toasts that are not live regions are
 * how many applications say "Saved".
 */
export class ActWatch {
  last = Date.now();
  readonly started = Date.now();
  private readonly texts: string[] = [];
  private readonly mo: MutationObserver | null;
  constructor(
    roots: Node[],
    private readonly win: Win,
    private readonly ignore: Element | null,
  ) {
    const MO = win.MutationObserver;
    this.mo = MO ? new MO((records) => this.take(records)) : null;
    for (const r of roots)
      this.mo?.observe(r, {
        subtree: true,
        childList: true,
        attributes: true,
        characterData: true,
      });
  }
  private take(records: MutationRecord[]): void {
    this.last = Date.now();
    for (const rec of records) {
      if (rec.type === "childList") {
        for (const n of Array.from(rec.addedNodes))
          this.consider(n.nodeType === 1 ? (n as Element) : n.parentElement, n);
      } else if (rec.type === "characterData") {
        this.consider(rec.target.parentElement, rec.target);
      }
    }
  }
  private consider(host: Element | null, node: Node): void {
    if (!host || (this.ignore && (this.ignore.contains(host) || host.contains(this.ignore))))
      return;
    const notice =
      host.closest(
        '[role="alert"], [role="status"], [role="log"], [aria-live]:not([aria-live="off"]), [data-sonner-toast], [class*="toast" i], [class*="snackbar" i], [class*="notification" i], [class*="notistack" i]',
      ) ?? (topLevel(host) ? host : null);
    if (!notice) return;
    const text = clampText(norm(node.textContent), 200);
    if (text && /[\p{L}\p{N}]/u.test(text) && !this.texts.includes(text)) this.texts.push(text);
  }
  /** Stop watching; the notices seen, at most five. */
  stop(): string[] {
    if (this.mo) this.take(this.mo.takeRecords());
    this.mo?.disconnect();
    // Keep the outermost text of nested additions only.
    const out = this.texts.filter(
      (t, i) => !this.texts.some((o, j) => j !== i && o.length > t.length && o.includes(t)),
    );
    return out.slice(0, 5);
  }
}

function topLevel(el: Element): boolean {
  const body = el.ownerDocument?.body;
  if (!body) return false;
  let depth = 0;
  let cur: Element | null = el;
  while (cur && cur.parentElement && cur.parentElement !== body) {
    cur = cur.parentElement;
    if (++depth > 3) return false;
  }
  if (!cur || cur.parentElement !== body) return false;
  // A dialog is a container of controls, reported as entries; not a notice.
  return (
    !cur.matches(
      '[role="dialog"], [role="alertdialog"], dialog, [role="menu"], [role="listbox"]',
    ) && !cur.querySelector('[role="dialog"], [role="menu"], [role="listbox"]')
  );
}

/**
 * Wait for the page to settle after an act: a microtask, an animation frame (bounded), then a
 * quiet period with no mutation (as `watch` saw them), bounded by `timeoutMs`.
 */
export async function settle(
  watch: ActWatch,
  win: Win,
  { quietMs = 50, timeoutMs = 1000 }: { quietMs?: number; timeoutMs?: number } = {},
): Promise<void> {
  await Promise.resolve();
  await new Promise<void>((resolve) => {
    const done = () => resolve();
    const t = setTimeout(done, 50);
    if (typeof win.requestAnimationFrame === "function")
      win.requestAnimationFrame(() => {
        clearTimeout(t);
        done();
      });
  });
  if (quietMs <= 0) return;
  const start = Date.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      const now = Date.now();
      if (now - watch.last >= quietMs || now - start >= timeoutMs) resolve();
      else
        setTimeout(
          tick,
          Math.max(5, Math.min(quietMs - (now - watch.last), timeoutMs - (now - start))),
        );
    };
    setTimeout(tick, quietMs);
  });
}

/** A name for an opaque region, from the charting or spreadsheet library that drew it. */
export function opaqueKind(el: Element): string {
  const probe = (sel: string) => !!el.closest(sel) || !!el.querySelector?.(sel);
  if (probe('[class*="highcharts"]')) return "a Highcharts chart";
  if (probe('[class*="gc-spread"], [gcuielement]')) return "a SpreadJS spreadsheet";
  if (probe('[class*="recharts"]')) return "a Recharts chart";
  if (probe('[_echarts_instance_], [class*="echarts"]')) return "an ECharts chart";
  if (probe('[class*="plotly"]')) return "a Plotly chart";
  if (probe('[class*="apexcharts"]')) return "an ApexCharts chart";
  if (probe('[class*="vega"]')) return "a Vega chart";
  if (probe('[class*="mapboxgl"], [class*="maplibregl"], [class*="leaflet"]')) return "a map";
  return "";
}

/** The title an opaque chart shows, when the library renders one (`.highcharts-title`). */
export function opaqueTitle(el: Element): string {
  const t = el.querySelector('.highcharts-title, [class*="chart-title"], title');
  return t ? clampText(norm(t.textContent), 80) : "";
}

// ---------------------------------------------------------------------------------------------
// Custom widgets: clickable elements without a role
// ---------------------------------------------------------------------------------------------

const NATIVE_INTERACTIVE = new Set([
  "a",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  "label",
  "option",
  "details",
  "video",
  "audio",
]);

/**
 * An element a person can click that assistive technology cannot see as a control: an `onclick`
 * attribute, a React or Vue click handler on a non-interactive element, or `tabindex` without a
 * role. Framework handlers are read from the properties React (`__reactProps$…`) and Vue (`_vei`)
 * keep on DOM nodes; nothing is called.
 */
export function isCustomWidget(el: Element): boolean {
  if (NATIVE_INTERACTIVE.has(el.localName) || el.hasAttribute("role") || isContentEditable(el))
    return false;
  let clickable = el.hasAttribute("onclick");
  if (!clickable) {
    const ti = el.getAttribute("tabindex");
    if (ti !== null && Number(ti) >= 0) clickable = true;
  }
  if (!clickable) {
    for (const key of Object.keys(el)) {
      if (key.startsWith("__reactProps$")) {
        const props = (el as unknown as Record<string, Record<string, unknown> | undefined>)[key];
        if (
          props &&
          (typeof props.onClick === "function" ||
            typeof props.onMouseDown === "function" ||
            typeof props.onPointerDown === "function")
        )
          clickable = true;
        break;
      }
      if (key === "_vei") {
        const vei = (el as unknown as { _vei?: Record<string, unknown> })._vei;
        if (vei && (vei.onClick || vei.onMousedown)) clickable = true;
      }
    }
  }
  if (!clickable) return false;
  // A wrapper around real controls (a row that stops propagation) is not itself a widget.
  return !el.querySelector("a[href], button, input, select, textarea, [role=button], [role=link]");
}
