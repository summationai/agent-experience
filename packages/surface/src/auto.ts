/**
 * @axe/surface/auto: derive a surface from the rendered page, then refine it with configuration.
 *
 * `autoSurface()` reads the page's accessibility semantics (roles, accessible names, disabled
 * states and their reasons, values, the dialogs and landmarks controls sit in) and registers one
 * entry per control on an ordinary surface: the base layer. A `SurfaceConfig` overlays what the
 * page cannot say (a better name, the object, the effect and its risk, privacy, approval, a real
 * application handler), and entries the application registers itself stand beside both. An agent
 * acts on a derived entry by the same door a person uses: the events a click or typing causes.
 *
 * Browser-only and framework-free; no Zod, no Node built-ins. See spec/SURFACE.md §10 and
 * docs/auto-surface.md.
 */
import { SurfaceConflict, createSurface } from "./index";
import type {
  ActContext,
  ActRequest,
  ActResult,
  Availability,
  Effect,
  Entry,
  EntryTier,
  HandlerReport,
  JsonValue,
  MaybePromise,
  Observation,
  Risk,
  Surface,
} from "./index";
import {
  ACTION_ROLES,
  CANDIDATE_SELECTOR,
  COLLECTION_ROLES,
  FIELD_ROLES,
  LANDMARK_ROLES,
  MORE_ONLY_ROLES,
  ActWatch,
  ScanContext,
  accessibleName,
  actionValue,
  activate,
  clampText,
  collectionFacts,
  confidenceOf,
  containsComposed,
  contextOf,
  fieldValue,
  focusRegion,
  isAriaHidden,
  isCustomWidget,
  isDisabled,
  isHidden,
  isInert,
  isReadOnly,
  isSensitiveField,
  nameOfContainer,
  norm,
  opaqueKind,
  opaqueTitle,
  reasonOf,
  roleOf,
  scrollMore,
  selectChoices,
  selectorFor,
  settle,
  typeInto,
  windowOf,
} from "./auto-dom";
import type { Confidence, NameFrom } from "./auto-dom";
import { classify, compileLexicon } from "./auto-risk";
import type { CompiledLexicon } from "./auto-risk";
import { checkConfig, routeIncluded, ruleMatches } from "./auto-config";
import type { AutoHandler, PolicyDecision, SurfaceConfig, SurfaceRule } from "./auto-config";
import { formatCoverage } from "./auto-coverage";
import type { Coverage, CoverageEntry, CoverageGap, StaleRule } from "./auto-coverage";
import { AUTO_META } from "./auto-domains";
import type { AutoEntryMark } from "./auto-domains";
import { CONTENT, READ_LIMITS } from "./auto-content";
import type {
  PageContent,
  PageRead,
  ReadOptions,
  WaitCondition,
  WaitOptions,
  WaitResult,
} from "./auto-content";
import {
  boundRows,
  collectContent,
  filterSections,
  formatRead,
  paginate,
  pageText,
  sectionsUnder,
} from "./auto-read";
import { createWaiter } from "./auto-wait";

export type {
  AutoHandler,
  AutoHandlerContext,
  PolicyDecision,
  SurfaceConfig,
  SurfaceGroup,
  SurfaceMatch,
  SurfacePolicy,
  SurfaceRule,
} from "./auto-config";
export { checkConfig, globMatch } from "./auto-config";
export type { RiskLexicon, RiskVerdict } from "./auto-risk";
export { DEFAULT_LEXICON } from "./auto-risk";
export type { Confidence, NameFrom } from "./auto-dom";
export { accessibleName, roleOf } from "./auto-dom";
export type {
  Coverage,
  CoverageEntry,
  CoverageGap,
  FormatCoverageOptions,
  GapKind,
  StaleRule,
  UnreadableRegion,
} from "./auto-coverage";
export { formatCoverage } from "./auto-coverage";
export type { AutoDomainsOptions, AutoEntryMark } from "./auto-domains";
export { AUTO_META, autoDomains, autoMarkOf, contentDomains } from "./auto-domains";
export type {
  PageContent,
  PageRead,
  ReadField,
  ReadList,
  ReadOpaque,
  ReadOptions,
  ReadSection,
  ReadTable,
  WaitCondition,
  WaitOptions,
  WaitResult,
} from "./auto-content";
export { CONTENT, READ_LIMITS, WAIT_LIMITS, checkCondition, contentOf } from "./auto-content";
export { formatRead } from "./auto-read";

/** The id of the entry that opens a same-origin path. */
export const NAVIGATE_ENTRY_ID = "page:navigate";

export interface AutoSurfaceOptions {
  /** The part of the page to derive from. Default `document.body`. */
  root?: Element;
  /** The surface to register on. Default: a new `createSurface({ app })`. Entries the application registers on it stay beside the derived ones. */
  surface?: Surface;
  /** The configuration overlay; `handle.configure()` replaces it later. */
  config?: SurfaceConfig;
  observe?: {
    /** Coalesce DOM changes for this long before re-scanning. Default 30 ms. */
    debounceMs?: number;
    /** After an act, wait for this long without a DOM change (bounded by `timeoutMs`) before reporting. Default 50 and 1500 ms. */
    settle?: { quietMs?: number; timeoutMs?: number };
  };
  /** Clock for coverage timestamps. */
  now?: () => Date;
  /** Publish `window.__surface` (with `coverage()`) now: `true` for `window`, or a host object. */
  expose?: boolean | object;
  /**
   * The route part of every key, from the location. Default: the pathname with numeric, UUID, and
   * long hexadecimal segments replaced by `:id`, so one record's page and the next share keys.
   */
  route?: (location: Location) => string;
  /**
   * What to do with a control that is on the page but not shown (`hidden`, `display: none`, a
   * closed `<details>`): `skip` (the default) leaves it out; `unavailable` lists it with the reason
   * "not shown on the page".
   */
  hidden?: "skip" | "unavailable";
  /** Move the surface's revision when the derived set changes (`bump`, the default), or leave the revision to the application (`none`). */
  revision?: "bump" | "none";
  /** Read layout (sizes, `checkVisibility`). Default: true in browsers, false under jsdom. */
  layout?: boolean;
}

/** What `autoSurface` knows about one registered entry beyond the entry itself. */
export interface AutoEntryMeta {
  key: string;
  tier: EntryTier;
  nameFrom: NameFrom;
  confidence: Confidence;
  risk?: Risk;
  riskWhy?: string;
  unrecognized?: boolean;
  policy?: PolicyDecision;
  group?: string;
  sensitive?: boolean;
  /** Rule indexes that matched. */
  rules: number[];
}

export interface AutoSurfaceHandle {
  /** The surface the entries are registered on: observe, act, ledger, bridges, as for any surface. */
  readonly surface: Surface;
  /** Re-scan now. Returns the ids whose entry was added, changed, or removed. */
  refresh(): { changed: string[] };
  /** The coverage report of the current page. */
  coverage(): Coverage;
  /** Replace the configuration and re-scan. */
  configure(config: SurfaceConfig): void;
  /** The configuration in force. */
  config(): SurfaceConfig;
  /**
   * Record the person's approval of one gated control, for `uses` acts (default 1) within `ttlMs`
   * (default five minutes). Call it only from the person's own interaction (an approval prompt in
   * the page), never from anything an agent can reach. Returns false for an unknown id.
   */
  approve(id: string, options?: { uses?: number; ttlMs?: number }): boolean;
  /** The element an entry was derived from, when it is on the page. */
  elementFor(id: string): Element | undefined;
  /** What the scan recorded about an entry. */
  metaFor(id: string): AutoEntryMeta | undefined;
  /** The route the keys are built from now. */
  route(): string;
  /**
   * The content the page shows the person ([S-AUTO-14]): sections by heading with their text,
   * key-value fields, tables, and lists; charts and canvases reported by title only; private
   * values withheld; bounded by `maxChars` and `maxRows`, with a cursor for the rest. Never moves
   * the revision. `formatRead` renders it as Markdown.
   */
  read(options?: ReadOptions): PageRead;
  /**
   * Wait until a condition on the page holds or `timeoutMs` (default 30 s, at most 120 s) runs
   * out ([S-AUTO-15]): text appears or goes, an entry is (un)available, the revision moves, the
   * page goes quiet, the route matches. Resolves with `met`, what changed while it waited, and
   * the notices that appeared. Never moves the revision; `stop()` ends it with `met: false`.
   */
  wait(condition: WaitCondition, options?: WaitOptions): Promise<WaitResult>;
  /** Publish `window.__surface` (observe, act, ledger, rev, coverage, formatCoverage) on `host`. */
  expose(host?: object | null): void;
  /** Stop observing, unregister every derived and configured entry, and restore the surface. */
  stop(): void;
}

// ---------------------------------------------------------------------------------------------

const DEFAULT_POLICY: Record<Risk, PolicyDecision> = {
  none: "allow",
  low: "allow",
  medium: "allow",
  high: "approve",
};

const LANDMARK_NAMES: Record<string, string> = {
  main: "Main content",
  navigation: "Navigation",
  search: "Search",
  complementary: "Complementary content",
  banner: "Page header",
  contentinfo: "Page footer",
};

/** The default route: the pathname with id-like segments collapsed to `:id`. */
export function defaultRoute(location: Pick<Location, "pathname">): string {
  const path = location.pathname || "/";
  return (
    path
      .split("/")
      .map((seg) =>
        /^\d+$/.test(seg) ||
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg) ||
        /^[0-9a-f]{12,}$/i.test(seg) ||
        (/\d/.test(seg) && /[a-z]/i.test(seg) && seg.length >= 16 && !seg.includes("-"))
          ? ":id"
          : seg,
      )
      .join("/")
      .replace(/\/+$/, "") || "/"
  );
}

function slug(text: string, max = 40): string {
  const s = text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return s.length > max ? s.slice(0, max).replace(/-+$/, "") : s;
}

interface Candidate {
  el: Element;
  role: string;
  kind: "action" | "field" | "collection" | "landmark";
  name: string;
  nameFrom: NameFrom;
  path: { kind: string; label: string }[];
  object: string;
  pin: string | null;
  hidden: boolean;
  baseKey: string;
  key: string;
}

interface Built {
  entry: Entry;
  sig: string;
  meta: AutoEntryMeta;
  element: Element | null;
}

/**
 * Where a surface's approver lives, for a trusted channel that has just shown the person a request
 * (the relay's in-page panel) to grant it. A symbol, not an import, so such a channel need not load
 * this module. Never reachable by an agent: it is a property of the page's own object.
 */
export const APPROVER = Symbol.for("axe.surface.approver");

/** Marks a subtree the scan never reads: the application's own agent UI, a debug panel. */
export const IGNORE_ATTRIBUTE = "data-surface-ignore";
/** The relay's in-page indicator, which the scan never reads whether or not it is marked ignored. */
const RELAY_INDICATOR_ATTRIBUTE = "data-axe-relay-indicator";

/**
 * What an agent's plan can depend on, for deciding whether a change moves the revision. For a
 * collection that is its identity and whether it can load more, not its content: a table that
 * gains a row, or a list a poll refreshes, changes what an agent reads, not what it can act on,
 * and moving the revision for it would refuse every act on a page that updates live. Rows that
 * carry controls still move it, because those controls are entries of their own.
 */
function controlSignature(entry: Entry): string {
  // The approval gate is not page state: a person approving (or an approval expiring) changes
  // whether the act may run, not the page an agent planned against, so it must not make the
  // agent's retry at the same revision stale.
  if (
    entry.kind === "action" &&
    entry.state &&
    !entry.state.available &&
    entry.state.handoff?.reason === "approval_required" &&
    !entry.state.handoff.url
  )
    entry = { ...entry, state: { available: true } };
  if (entry.kind === "collection")
    return JSON.stringify([entry.id, entry.kind, entry.name, typeof entry.more === "function"]);
  return JSON.stringify(entry, (k, v) => (typeof v === "function" ? undefined : v));
}

function signature(entry: Entry, meta: AutoEntryMeta): string {
  return (
    JSON.stringify(entry, (k, v) => (typeof v === "function" ? undefined : v)) +
    JSON.stringify(meta)
  );
}

/**
 * Derive a surface from the rendered page and keep it current: scan now, re-scan on every DOM
 * change (coalesced), and register, replace, or unregister entries so the table matches the page.
 */
export function autoSurface(options: AutoSurfaceOptions = {}): AutoSurfaceHandle {
  const doc =
    options.root?.ownerDocument ?? (typeof document !== "undefined" ? document : undefined);
  const rootEl = options.root ?? doc?.body;
  if (!doc || !rootEl)
    throw new Error(
      "autoSurface needs a rendered page: call it in the browser after the DOM exists, or pass `root`.",
    );
  const win = windowOf(rootEl);
  let config: SurfaceConfig = options.config ?? {};
  const surface =
    options.surface ??
    createSurface({
      ...(config.app ? { app: config.app } : {}),
      ...(config.profile ? { profile: config.profile } : {}),
    });
  if (config.app || config.profile)
    surface.configure({
      ...(config.app ? { app: config.app } : {}),
      ...(config.profile ? { profile: config.profile } : {}),
    });
  const now = options.now ?? (() => new Date());
  const routeFn = options.route ?? ((loc: Location) => defaultRoute(loc));
  const layout = options.layout ?? !/jsdom/i.test(win.navigator?.userAgent ?? "");
  const debounceMs = options.observe?.debounceMs ?? 30;
  const settleOpts = { quietMs: 50, timeoutMs: 1500, ...(options.observe?.settle ?? {}) };
  const hiddenMode = options.hidden ?? "skip";
  const bumpRevision = (options.revision ?? "bump") === "bump";

  let lexicon: CompiledLexicon = compileLexicon(config.lexicon);
  let policy: Record<Risk, PolicyDecision> = { ...DEFAULT_POLICY, ...(config.policy ?? {}) };
  let configErrors = checkConfig(config);

  let registered = new Map<string, Built>();
  let elements = new Map<string, Element>();
  let gaps: CoverageGap[] = [];
  let frames = { sameOrigin: 0, crossOrigin: 0 };
  let ruleHitsNow: number[] = [];
  let ruleHitsEver: number[] = [];
  let currentRoute = "/";
  const approvals = new Map<string, { uses: number; until: number }>();
  const declared = new Set<string>();
  let stopped = false;
  // The ids changed by every scan while an act is in flight, one set per act.
  const collectors = new Set<Set<string>>();

  // --- observation of the page -----------------------------------------------------------------
  const MO = win.MutationObserver;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (stopped || timer) return;
    timer = setTimeout(() => {
      timer = null;
      scanNow();
    }, debounceMs);
  };
  const observer = MO ? new MO(() => schedule()) : null;
  const observed = new WeakSet<Node>();
  const watch = (node: Node) => {
    if (!observer || observed.has(node)) return;
    observed.add(node);
    observer.observe(node, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
  };
  watch(rootEl);
  const onEvent = () => schedule();
  const events = ["input", "change", "toggle", "reset", "transitionend"];
  for (const t of events) doc.addEventListener(t, onEvent, true);
  win.addEventListener("popstate", onEvent);
  win.addEventListener("hashchange", onEvent);
  const flush = () => {
    if (stopped) return;
    const pending = observer ? observer.takeRecords().length > 0 : false;
    if (pending || timer) {
      if (timer) clearTimeout(timer);
      timer = null;
      scanNow();
    }
  };

  // --- the scan ----------------------------------------------------------------------------------
  const rules = (): SurfaceRule[] => config.rules ?? [];

  function collect(ctx: ScanContext, out: Element[], customs: Element[]) {
    const exclude = (config.exclude ?? []).join(",");
    const promote = rules()
      .filter((r) => r.match.selector && r.role)
      .map((r) => r.match.selector!)
      .join(",");
    const visit = (el: Element) => {
      // Never part of the surface: a subtree the application marked, and the relay's own
      // indicator (its Stop, Approve, and Deny are the person's, never an agent's).
      if (el.hasAttribute(IGNORE_ATTRIBUTE) || el.hasAttribute(RELAY_INDICATOR_ATTRIBUTE)) return;
      if (exclude) {
        try {
          if (el.matches(exclude)) return;
        } catch {
          // An invalid selector is reported by checkConfig.
        }
      }
      const tag = el.localName;
      if (tag === "script" || tag === "style" || tag === "template" || tag === "noscript") return;
      if (
        el.hasAttribute("hidden") &&
        el.getAttribute("hidden") !== "until-found" &&
        hiddenMode === "skip"
      )
        return;
      let isCandidate = false;
      try {
        isCandidate = el.matches(CANDIDATE_SELECTOR) || (!!promote && el.matches(promote));
      } catch {
        isCandidate = el.matches(CANDIDATE_SELECTOR);
      }
      if (isCandidate) out.push(el);
      else if (isCustomWidget(el)) customs.push(el);
      if (tag === "canvas" && !isHidden(el, ctx) && !isAriaHidden(el, ctx)) {
        const name = norm(el.getAttribute("aria-label"));
        const lib = opaqueKind(el);
        gaps.push({
          kind: "canvas",
          message: `${lib ? lib.charAt(0).toUpperCase() + lib.slice(1) + " draws on a canvas" : "A canvas"}${name ? ` (“${name}”)` : ""}: an opaque region; its data and any controls drawn on it are invisible to agents.`,
          selector: selectorFor(el),
          markup: "expose the data behind it with surface.setObjects() or declare its controls",
        });
      }
      if (
        tag === "svg" &&
        !el.closest("button, a, [role=button], [role=link]") &&
        !isHidden(el, ctx)
      ) {
        const shapes = el.querySelectorAll("path, rect, circle, line, polyline, polygon").length;
        const lib = opaqueKind(el);
        if (
          (shapes >= 12 || lib) &&
          !norm(el.getAttribute("aria-label")) &&
          !el.getAttribute("aria-labelledby")
        ) {
          const title = opaqueTitle(el);
          gaps.push({
            kind: "chart",
            message: `${lib ? lib.charAt(0).toUpperCase() + lib.slice(1) : `An SVG with ${shapes} shapes (a chart?)`}${title ? ` (“${title}”)` : ""} is an opaque region: no accessible name or data, so agents see nothing of it.`,
            selector: selectorFor(el),
            markup:
              'add role="img" and an aria-label that states what it shows (or enable the library\'s accessibility module), or publish its data with surface.setObjects()',
          });
        }
      }
      if (
        tag.includes("-") &&
        !el.shadowRoot &&
        !el.children.length &&
        win.customElements?.get(tag)
      )
        gaps.push({
          kind: "closed-shadow",
          message: `<${tag}> renders into a closed shadow root (or nothing): its controls cannot be read.`,
          selector: selectorFor(el),
          markup: "use an open shadow root, or declare its controls",
        });
      const shadow = el.shadowRoot;
      if (shadow) {
        watch(shadow);
        for (const child of Array.from(shadow.children)) visit(child);
      }
      if (tag === "iframe" || tag === "frame") {
        let inner: Document | null = null;
        try {
          inner = (el as HTMLIFrameElement).contentDocument;
        } catch {
          inner = null;
        }
        if (inner && inner.body) {
          frames.sameOrigin++;
          watch(inner);
          visit(inner.body);
        } else {
          frames.crossOrigin++;
          const title = norm(el.getAttribute("title"));
          gaps.push({
            kind: "cross-origin-frame",
            message: `A cross-origin frame${title ? ` (“${title}”)` : ""} cannot be read from this page; its controls are not on the surface.`,
            selector: selectorFor(el),
            markup: "run autoSurface inside that frame's own origin, or declare what it does",
          });
        }
        return;
      }
      if (tag === "details" && !(el as HTMLDetailsElement).open && hiddenMode === "skip") {
        const summary = el.querySelector(":scope > summary");
        if (summary) visit(summary);
        return;
      }
      for (const child of Array.from(el.children)) visit(child);
    };
    visit(rootEl!);
  }

  function kindOf(el: Element, role: string): Candidate["kind"] | null {
    if (ACTION_ROLES.has(role)) return "action";
    if (role === "listbox-select") return "field";
    if (FIELD_ROLES.has(role)) {
      const tag = el.localName;
      if (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        el.hasAttribute("contenteditable")
      )
        return "field";
      return null;
    }
    if (COLLECTION_ROLES.has(role)) return "collection";
    if (
      LANDMARK_ROLES.has(role) &&
      config.landmarks !== false &&
      role !== "banner" &&
      role !== "contentinfo"
    )
      return "landmark";
    return null;
  }

  function roleFromRules(el: Element): string | undefined {
    let role: string | undefined;
    for (const r of rules()) {
      if (!r.role || !r.match.selector) continue;
      try {
        if (el.matches(r.match.selector)) role = r.role;
      } catch {
        // Invalid selector: reported by checkConfig.
      }
    }
    return role;
  }

  function scanNow(): string[] {
    if (stopped) return [];
    const route = routeFn(win.location);
    currentRoute = route;
    gaps = [];
    frames = { sameOrigin: 0, crossOrigin: 0 };
    ruleHitsNow = rules().map(() => 0);
    if (ruleHitsEver.length !== ruleHitsNow.length) ruleHitsEver = rules().map(() => 0);
    const next = new Map<string, Built>();
    if (routeIncluded(config, route)) {
      const ctx = new ScanContext(rootEl!, layout);
      const found: Element[] = [];
      const customs: Element[] = [];
      collect(ctx, found, customs);
      const candidates: Candidate[] = [];
      for (const el of found) {
        const c = describe(el, ctx, route);
        if (c) candidates.push(c);
      }
      for (const el of customs) {
        const promoted = roleFromRules(el);
        if (promoted) {
          const c = describe(el, ctx, route, promoted);
          if (c) candidates.push(c);
          continue;
        }
        if (isHidden(el, ctx)) continue;
        const text = clampText(norm(el.textContent), 60);
        const selector = selectorFor(el);
        gaps.push({
          kind: "custom-widget",
          message: `A clickable <${el.localName}>${text ? ` (“${text}”)` : ""} has no role, so it is not on the surface.`,
          selector,
          suggestion: {
            match: { selector, route },
            role: "button",
            name: text || "describe what it does",
          },
          markup: 'use a <button>, or add role="button", tabindex="0", and an accessible name',
        });
      }
      // Links with the same name and destination in one context are one way to go there: keep
      // the first.
      const hrefs = new Set<string>();
      const unique = candidates.filter((c) => {
        if (c.role !== "link") return true;
        const k = `${c.baseKey} ${(c.el as HTMLAnchorElement).href ?? c.el.getAttribute("href")}`;
        if (hrefs.has(k)) return false;
        hrefs.add(k);
        return true;
      });
      candidates.length = 0;
      candidates.push(...unique);
      // Ordinals for duplicates, in document order.
      const seen = new Map<string, number>();
      for (const c of candidates) {
        const n = (seen.get(c.baseKey) ?? 0) + 1;
        seen.set(c.baseKey, n);
        c.key = n === 1 ? c.baseKey : `${c.baseKey}~${n}`;
      }
      for (const [base, n] of seen)
        if (n > 1) {
          const first = candidates.find((c) => c.baseKey === base)!;
          gaps.push({
            kind: "duplicate-name",
            message: `${n} controls named “${first.name}” (${first.role}) share one context; their keys carry an ordinal (~2, ~3), which shifts when one is added before another.`,
            entryId: first.pin ?? first.key,
            suggestion: {
              match: { key: `${base}~2` },
              id: `${slug(first.name)}-2`,
              name: `${first.name} (say which)`,
            },
            markup: "give each a name that says which one (aria-label), or a data-surface-id",
          });
        }
      const ids = new Map<string, number>();
      for (const c of candidates) {
        const b = build(c, route, ctx);
        if (!b) continue;
        let id = b.entry.id;
        const dup = ids.get(id) ?? 0;
        ids.set(id, dup + 1);
        if (dup) {
          id = `${id}~${dup + 1}`;
          b.entry = { ...b.entry, id } as Entry;
          (b.entry as unknown as Record<symbol, AutoEntryMark>)[AUTO_META] = {
            key: b.meta.key,
            ...(b.meta.group ? { group: b.meta.group } : {}),
          };
        }
        // An entry the application registered itself under this id wins ([S-AUTO-2]).
        const live = surface.get(id);
        const mine = registered.get(id);
        if (live && (!mine || live !== mine.entry)) continue;
        next.set(id, b);
      }
      if (config.navigate !== false) {
        const nav = navigateEntry();
        next.set(nav.entry.id, nav);
      }
    }
    // Rule hits and gaps that depend on the whole table.
    ruleHitsNow.forEach((n, i) => {
      if (n) ruleHitsEver[i] = (ruleHitsEver[i] ?? 0) + n;
    });
    const declaredNames = new Map<string, string>();
    for (const e of surface.entries())
      if (!next.has(e.id) && !registered.has(e.id))
        declaredNames.set(norm(nameText(e)).toLowerCase(), e.id);
    for (const [id, b] of next) {
      const other = declaredNames.get(norm(nameText(b.entry)).toLowerCase());
      if (other && b.meta.tier !== "declared")
        gaps.push({
          kind: "possible-duplicate",
          message: `“${nameText(b.entry)}” is derived from the page and also declared as ${other}; an agent sees both.`,
          entryId: id,
          suggestion: { match: { key: b.meta.key }, hide: true },
          markup: `render the declared entry's attributes on the control (useSurfaceProps), so the scan recognizes it`,
        });
    }
    // Apply the difference.
    const changed: string[] = [];
    let moved = false;
    for (const [id, b] of next) {
      const prev = registered.get(id);
      if (!prev || prev.sig !== b.sig) {
        if (!prev || controlSignature(prev.entry) !== controlSignature(b.entry)) moved = true;
        surface.register(b.entry);
        changed.push(id);
      } else {
        // Same entry: keep the registered object (and the bridge's cached coverage of it).
        b.entry = prev.entry;
      }
    }
    for (const [id, prev] of registered) {
      if (next.has(id)) continue;
      // Only remove what is still ours.
      if (surface.get(id) === prev.entry) surface.unregister(id);
      changed.push(id);
      moved = true;
    }
    registered = next;
    elements = new Map();
    for (const [id, b] of next) if (b.element) elements.set(id, b.element);
    if (moved && bumpRevision) surface.bump({ derived: changed.length });
    for (const c of collectors) for (const id of changed) c.add(id);
    return changed;
  }

  function nameText(e: Entry): string {
    return typeof e.name === "function" ? e.name() : e.name;
  }

  function describe(
    el: Element,
    ctx: ScanContext,
    route: string,
    forcedRole?: string,
  ): Candidate | null {
    const role = forcedRole ?? roleFromRules(el) ?? roleOf(el);
    const pin = el.getAttribute("data-surface-id");
    if (role === "file") {
      if (!isHidden(el, ctx))
        gaps.push({
          kind: "file-input",
          message: `A file input (“${accessibleName(el, role, ctx).name || "unnamed"}”) cannot be filled by an agent through the page.`,
          selector: selectorFor(el),
          markup:
            "declare an entry whose handler takes a document the agent supplies (requires with document.url)",
        });
      return null;
    }
    const kind = kindOf(el, role);
    if (!kind) return null;
    // A pin the application registered itself is declared, not derived.
    if (pin) {
      const live = surface.get(pin);
      const mine = registered.get(pin);
      if (live && (!mine || mine.entry !== live)) return null;
    }
    const hidden = isHidden(el, ctx);
    if (hidden && (hiddenMode === "skip" || kind === "landmark")) return null;
    let { name, from } = accessibleName(el, role, ctx);
    if (kind === "landmark") {
      const named = nameOfContainer(el, ctx);
      if (named) {
        name = named;
        from = "aria-label";
      } else if (role === "region" || role === "form") return null;
      else {
        name = LANDMARK_NAMES[role] ?? role;
        from = "role";
      }
    }
    if (pin && !name) {
      name = pin;
      from = "pin";
    }
    const where = contextOf(el, ctx);
    // An unnamed control can still be named by a rule that does not match on key or name.
    if (!name) {
      for (const r of rules()) {
        if (!r.name || r.match.key !== undefined || r.match.name !== undefined) continue;
        if (ruleMatches(r.match, { key: "", pin, element: el, route, role, name: "" })) {
          name = r.name;
          from = "config";
        }
      }
    }
    if (!name) {
      if (!isAriaHidden(el, ctx) && kind !== "collection") {
        const selector = selectorFor(el);
        const iconOnly = !!el.querySelector("svg, img, i, [class*=icon]");
        gaps.push({
          kind: iconOnly ? "icon-only" : "unnamed",
          message: `${iconOnly ? "An icon-only" : "An unnamed"} ${role}${where.object ? ` in “${where.object}”` : ""} has no accessible name, so it is not on the surface.`,
          selector,
          suggestion: { match: { selector, route }, name: "say what it does" },
          markup: "add an aria-label that states the outcome",
        });
      }
      return null;
    }
    if (from === "icon") {
      const selector = selectorFor(el);
      gaps.push({
        kind: "icon-only",
        message: `An icon-only ${role} is named “${name}” from its icon's class only.`,
        selector,
        suggestion: {
          match: { selector, route },
          name: name.charAt(0).toUpperCase() + name.slice(1),
        },
        markup: `add aria-label="${name.charAt(0).toUpperCase() + name.slice(1)}" (or what it does)`,
      });
    }
    const pathKey = where.path.map((s) =>
      s.kind === "landmark" ? slug(s.label.replace(":", "-")) : `${s.kind}:${slug(s.label, 32)}`,
    );
    const baseKey = `${route}#${pathKey.join("/")}${pathKey.length ? "/" : ""}${role}:${slug(name)}`;
    return {
      el,
      role,
      kind,
      name,
      nameFrom: from,
      path: where.path,
      object: where.object,
      pin,
      hidden,
      baseKey,
      key: baseKey,
    };
  }

  /** The rules that match a candidate, merged in order; a later rule's fields win. */
  function overlayFor(
    c: Candidate,
    route: string,
  ): { rule: Omit<SurfaceRule, "match">; hits: number[] } {
    const merged: Omit<SurfaceRule, "match"> = {};
    const hits: number[] = [];
    rules().forEach((r, i) => {
      if (
        !ruleMatches(r.match, {
          key: c.key,
          pin: c.pin,
          element: c.el,
          route,
          role: c.role,
          name: c.name,
        })
      )
        return;
      hits.push(i);
      ruleHitsNow[i] = (ruleHitsNow[i] ?? 0) + 1;
      const { match: _m, effect, ...rest } = r;
      Object.assign(merged, rest);
      if (effect) merged.effect = { ...(merged.effect ?? {}), ...effect };
    });
    return { rule: merged, hits };
  }

  function unavailableFor(c: Candidate, ctx: ScanContext): string | null {
    const el = c.el;
    if (c.hidden) return "not shown on the page";
    if (ctx.modal && !containsComposed(ctx.modal, el))
      return `behind the open dialog${ctx.modalName ? ` “${ctx.modalName}”` : ""}; close it first`;
    if (isAriaHidden(el, ctx)) return "hidden from assistive technology on the page";
    if (isInert(el)) return "inert on the page";
    if (el.closest('[aria-busy="true"]')) return "the page is busy";
    if (isDisabled(el)) return reasonOf(el, ctx) || "disabled in the page";
    return null;
  }

  function isApproved(id: string): boolean {
    const a = approvals.get(id);
    if (!a) return false;
    if (a.uses <= 0 || Date.now() > a.until) {
      approvals.delete(id);
      return false;
    }
    return true;
  }

  function build(c: Candidate, route: string, ctx: ScanContext): Built | null {
    const { rule, hits } = overlayFor(c, route);
    if (rule.hide) return null;
    const id = rule.id ?? c.pin ?? c.key;
    const name = rule.name ?? c.name;
    const nameFrom: NameFrom = rule.name
      ? "config"
      : c.pin && c.nameFrom === "pin"
        ? "pin"
        : c.nameFrom;
    const object = rule.object ?? (c.object || undefined);
    const handler = rule.handler;
    const tier: EntryTier = handler
      ? "declared"
      : hits.length ||
          c.pin ||
          c.el.hasAttribute("data-surface-reason") ||
          c.el.hasAttribute("data-surface-navigation")
        ? "annotated"
        : "derived";
    const meta: AutoEntryMeta = {
      key: c.key,
      tier,
      nameFrom,
      confidence: confidenceOf(nameFrom, name),
      rules: hits,
    };
    if (rule.group) meta.group = rule.group;
    const blocked = unavailableFor(c, ctx);
    const mark: AutoEntryMark = { key: c.key, ...(rule.group ? { group: rule.group } : {}) };
    const finish = (entry: Entry): Built => {
      (entry as unknown as Record<symbol, AutoEntryMark>)[AUTO_META] = mark;
      return { entry, sig: signature(entry, meta), meta, element: c.el };
    };

    if (c.kind === "field") {
      const el = c.el;
      const sensitive =
        rule.sensitive ??
        (isSensitiveField(el) ||
          (config.sensitive ?? []).some((sel) => {
            try {
              return el.matches(sel);
            } catch {
              return false;
            }
          }));
      if (sensitive) meta.sensitive = true;
      let readOnlyReason: string | null =
        rule.state === "unavailable"
          ? (rule.reason ?? "unavailable")
          : rule.state === "available"
            ? null
            : blocked;
      if (!readOnlyReason && rule.state !== "available" && isReadOnly(el))
        readOnlyReason = rule.reason ?? (reasonOf(el, ctx) || "read only in the page");
      if (readOnlyReason && blocked && rule.reason && readOnlyReason === blocked && !c.hidden)
        readOnlyReason = rule.reason;
      if (!readOnlyReason && sensitive && !rule.editable)
        readOnlyReason = "a private field: the person types it";
      if (!readOnlyReason && rule.approval === true && !isApproved(id))
        readOnlyReason = "needs the person's approval";
      if (!readOnlyReason && policy.medium === "deny")
        readOnlyReason = "agents may not edit fields on this site";
      const role = c.role === "listbox-select" ? "listbox" : c.role;
      const entry: Entry = {
        id,
        kind: "field",
        role,
        name,
        tier,
        edit: readOnlyReason
          ? { readOnly: true, reason: readOnlyReason }
          : {
              set: fieldSetter(id),
              ...(el.getAttribute("maxlength") && Number(el.getAttribute("maxlength")) > 0
                ? { maxLength: Number(el.getAttribute("maxlength")) }
                : {}),
              ...(el.localName === "select" && !(el as HTMLSelectElement).multiple
                ? { schema: { type: "string", enum: selectChoices(el as HTMLSelectElement) } }
                : {}),
            },
      };
      if (object) entry.object = object;
      if (sensitive) entry.sensitive = true;
      else entry.value = fieldValue(el) as JsonValue;
      if (handler) handlers.set(id, handler);
      else handlers.delete(id);
      return finish(entry);
    }

    if (c.kind === "collection") {
      const facts = collectionFacts(c.el, c.role, ctx);
      if (facts.virtualized)
        gaps.push({
          kind: "virtualized",
          message: `“${name}” renders ${facts.loaded}${facts.total !== null ? ` of ${facts.total}` : ""} rows: only the visible rows are on the surface; load-more scrolls it.`,
          entryId: id,
          markup:
            "set aria-rowcount (or aria-setsize) so the total is known, or declare the collection with its data",
        });
      const canMore = !blocked && (facts.loadMore || facts.scroller);
      // A plain list is a collection only when it can load more: otherwise it is layout.
      if (MORE_ONLY_ROLES.has(c.role) && !facts.loadMore && !facts.scroller && !facts.virtualized)
        return null;
      const entry: Entry = {
        id,
        kind: "collection",
        role: c.role,
        name,
        tier,
        total: facts.total,
        loaded: facts.loaded,
      };
      if (facts.sort) entry.sort = facts.sort;
      if (object) entry.object = object;
      if (canMore || handler) entry.more = moreFor(id);
      if (handler) handlers.set(id, handler);
      else handlers.delete(id);
      moreHow.set(id, facts.loadMore ? { button: facts.loadMore } : { scroller: facts.scroller });
      return finish(entry);
    }

    // Actions and landmarks.
    let effect: Effect;
    let why: string;
    let unrecognized = false;
    if (c.kind === "landmark") {
      effect = { mutates: "view", risk: "none", reversible: true, idempotent: true };
      why = "brings a landmark into view";
    } else {
      let href: URL | null = null;
      const raw = c.el.getAttribute("href");
      if (raw !== null) {
        try {
          href = new URL(raw, win.location.href);
        } catch {
          href = null;
        }
      }
      const dialog = c.path.filter((s) => s.kind === "dialog").pop();
      const inAlert = !!c.el.closest('[role="alertdialog"]');
      const verdict = classify(
        {
          role: c.role,
          name: c.name,
          element: c.el,
          href,
          origin: win.location.origin,
          inDialog: dialog || inAlert ? { alert: inAlert, name: dialog?.label ?? "" } : null,
        },
        lexicon,
      );
      effect = {
        mutates: verdict.mutates,
        risk: verdict.risk,
        reversible: verdict.reversible,
        idempotent: verdict.idempotent,
      };
      why = verdict.why;
      unrecognized = verdict.unrecognized;
    }
    if (rule.effect) {
      effect = { ...effect, ...rule.effect };
      if (rule.effect.risk) {
        why = "configured";
        unrecognized = false;
      }
    }
    const risk = effect.risk ?? "medium";
    const decision: PolicyDecision =
      rule.approval === true ? "approve" : rule.approval === false ? "allow" : policy[risk];
    meta.risk = risk;
    meta.riskWhy = why;
    meta.policy = decision;
    if (unrecognized) {
      meta.unrecognized = true;
      gaps.push({
        kind: "unclassified-risk",
        message: `“${name}” (${c.role}) was not recognized, so it is treated as a high-risk change${decision === "approve" ? " that needs the person's approval" : ""}.`,
        entryId: id,
        ...(c.role === "button"
          ? {
              markup:
                "if this exact custom button only changes location, add data-surface-navigation; otherwise configure its real effect",
            }
          : {}),
        suggestion: {
          match: { key: c.key },
          effect: { mutates: "say what it changes", risk: "medium" },
        },
      });
    }
    let state: Availability = { available: true };
    const reason =
      rule.state === "unavailable"
        ? (rule.reason ?? "unavailable")
        : rule.state === "available"
          ? null
          : blocked;
    if (reason) {
      state = {
        available: false,
        reason:
          blocked && rule.reason && !c.hidden && rule.state !== "unavailable"
            ? rule.reason
            : reason,
      };
    } else if (decision === "deny") {
      state = {
        available: false,
        reason: "agents may not do this on this site; the person can do it themselves",
      };
    } else if (decision === "approve" && !isApproved(id)) {
      state = {
        available: false,
        reason: `needs the person's approval (${why})`,
        handoff: {
          reason: "approval_required",
          instructions: `Ask the person to approve “${name}” in the page, or to do it themselves.`,
          whatAgentShouldSayToUser: `I'd like to use “${name}”${object ? ` for ${object}` : ""}. It ${why.startsWith("not recognized") ? "may change something I cannot undo" : `looks consequential (${why})`}. Can you approve it, or do it yourself?`,
        },
      };
    }
    const role = c.role === "combobox-trigger" ? "combobox" : c.role;
    const entry: Entry = {
      id,
      kind: "action",
      role,
      name,
      tier,
      effect,
      state,
      handler: actionHandler(id, c.kind === "landmark" ? "landmark" : "control"),
    };
    if (object) entry.object = object;
    const value = c.kind === "landmark" ? undefined : actionValue(c.el, c.role);
    if (value) entry.value = value;
    if (handler) handlers.set(id, handler);
    else handlers.delete(id);
    return finish(entry);
  }

  // --- acting --------------------------------------------------------------------------------------
  const handlers = new Map<string, AutoHandler>();
  const moreHow = new Map<string, { button?: Element; scroller?: Element | null }>();

  /** The element for an entry on the page now: from the last scan, else after a fresh one. */
  function liveElement(id: string): Element | null {
    let el = elements.get(id);
    if (el && el.isConnected) return el;
    scanNow();
    el = elements.get(id);
    return el && el.isConnected ? el : null;
  }

  const gone = (id: string) =>
    new SurfaceConflict(
      `The control ${id} is no longer on the page; nothing was done. Observe again and choose again.`,
    );

  /** Start watching before the act's events, so changes made while they dispatch count. */
  const watches = new WeakMap<ActWatch, Set<string>>();
  function watchAct(el: Element | null): ActWatch {
    const w = new ActWatch([doc!], win, el);
    const seen = new Set<string>();
    collectors.add(seen);
    watches.set(w, seen);
    const stop = w.stop.bind(w);
    w.stop = () => {
      collectors.delete(seen);
      return stop();
    };
    return w;
  }

  async function afterAct(watch: ActWatch, report: unknown): Promise<HandlerReport> {
    const seen = watches.get(watch) ?? new Set<string>();
    let notices: string[] = [];
    try {
      await settle(watch, win, settleOpts);
    } finally {
      notices = watch.stop();
    }
    const changed = scanNow();
    const r = (report && typeof report === "object" ? report : {}) as HandlerReport;
    const merged = [...new Set([...(r.changed ?? []), ...seen, ...changed])];
    const out: HandlerReport = { ...r, changed: merged };
    const all = [...(r.notices ?? []), ...notices];
    if (all.length) out.notices = [...new Set(all)];
    return out;
  }

  function consumeApproval(id: string) {
    const a = approvals.get(id);
    if (!a) return;
    a.uses -= 1;
    if (a.uses <= 0) approvals.delete(id);
  }

  function runDeclared(
    id: string,
    el: Element | null,
    text: string | undefined,
    actor: string,
    context: ActContext,
    dispatch: () => Promise<void>,
  ): Promise<unknown> {
    const h = handlers.get(id);
    if (!h) return dispatch();
    return Promise.resolve(
      h({ entryId: id, element: el, text, actor, expectedRev: context.expectedRev, dispatch }),
    );
  }

  function actionHandler(id: string, how: "control" | "landmark") {
    return async (
      actor: string,
      text: string | undefined,
      context: ActContext,
    ): Promise<HandlerReport> => {
      const el = liveElement(id);
      if (!el && !handlers.has(id)) throw gone(id);
      consumeApproval(id);
      const dispatch = async () => {
        if (!el) return;
        if (how === "landmark") focusRegion(el);
        else activate(el);
      };
      const watch = watchAct(el);
      try {
        const report = await runDeclared(id, el, text, actor, context, dispatch);
        return await afterAct(watch, report);
      } catch (e) {
        watch.stop();
        throw e;
      }
    };
  }

  function fieldSetter(id: string) {
    return async (text: string, actor: string, context: ActContext): Promise<HandlerReport> => {
      const el = liveElement(id);
      if (!el && !handlers.has(id)) throw gone(id);
      consumeApproval(id);
      const dispatch = async () => {
        if (!el) return;
        if (!typeInto(el, text))
          throw new SurfaceConflict(
            `“${text}” is not one of the options of ${id}; nothing was chosen.`,
          );
      };
      const watch = watchAct(el);
      try {
        const report = await runDeclared(id, el, text, actor, context, dispatch);
        return await afterAct(watch, report);
      } catch (e) {
        watch.stop();
        throw e;
      }
    };
  }

  function moreFor(id: string) {
    return async (context: ActContext): Promise<HandlerReport> => {
      const el = liveElement(id);
      if (!el && !handlers.has(id)) throw gone(id);
      const dispatch = async () => {
        const how = moreHow.get(id);
        if (how?.button && how.button.isConnected) activate(how.button);
        else scrollMore(how?.scroller ?? null, win);
      };
      const watch = watchAct(el);
      try {
        const report = await runDeclared(id, el, undefined, context.actor, context, dispatch);
        return await afterAct(watch, report);
      } catch (e) {
        watch.stop();
        throw e;
      }
    };
  }

  function navigateEntry(): Built {
    const entry: Entry = {
      id: NAVIGATE_ENTRY_ID,
      kind: "action",
      role: "link",
      name: "Go to a page of this site",
      tier: "derived",
      effect: {
        mutates: "location",
        risk: "low",
        reversible: true,
        idempotent: true,
        text: "the same-origin path to open, for example /settings",
      },
      handler: async (_actor: string, text: string | undefined) => {
        const watch = watchAct(null);
        try {
          await navigateTo(text ?? "");
          return await afterAct(watch, undefined);
        } catch (e) {
          watch.stop();
          throw e;
        }
      },
    };
    const meta: AutoEntryMeta = {
      key: NAVIGATE_ENTRY_ID,
      tier: "derived",
      nameFrom: "role",
      confidence: "high",
      risk: "low",
      riskWhy: "opens a page within the site",
      policy: "allow",
      rules: [],
    };
    (entry as unknown as Record<symbol, AutoEntryMark>)[AUTO_META] = { key: NAVIGATE_ENTRY_ID };
    return { entry, sig: signature(entry, meta), meta, element: null };
  }

  async function navigateTo(path: string): Promise<void> {
    let url: URL;
    try {
      url = new URL(path, win.location.href);
    } catch {
      throw new Error(`navigate: "${path}" is not a path.`);
    }
    if (url.origin !== win.location.origin)
      throw new Error(
        `navigate: "${path}" is not on this site (${win.location.origin}); only same-origin paths open.`,
      );
    const how = config.navigate ?? "link";
    const target = url.pathname + url.search + url.hash;
    if (typeof how === "function") return void (await how(target));
    if (how === "link") {
      for (const a of Array.from(doc!.querySelectorAll("a[href]"))) {
        try {
          const u = new URL(a.getAttribute("href")!, win.location.href);
          if (u.origin === url.origin && u.pathname === url.pathname && u.search === url.search) {
            activate(a);
            return;
          }
        } catch {
          // Not a URL: skip.
        }
      }
    }
    if (how === "history" || how === "link") {
      if (how === "history") {
        win.history.pushState({}, "", target);
        win.dispatchEvent(new win.PopStateEvent("popstate", { state: {} }));
        return;
      }
    }
    win.location.assign(target);
  }

  // --- the surface's own reads flush pending DOM changes first ([S-AUTO-6]) -------------------------
  const originalObserve = surface.observe;
  const originalAct = surface.act;
  let acting = 0;
  const patchedObserve = (): Observation => {
    if (!acting) flush();
    return originalObserve();
  };
  const patchedAct = async (
    request: ActRequest,
    opts?: { run?: (fn: () => MaybePromise<unknown>) => MaybePromise<unknown> },
  ): Promise<ActResult> => {
    flush();
    acting++;
    try {
      return await originalAct(request, opts);
    } finally {
      acting--;
    }
  };
  surface.observe = patchedObserve;
  surface.act = patchedAct;

  // --- configuration ------------------------------------------------------------------------------
  function applyConfig(next: SurfaceConfig) {
    for (const id of declared) {
      surface.unregister(id);
    }
    declared.clear();
    config = next;
    lexicon = compileLexicon(config.lexicon);
    policy = { ...DEFAULT_POLICY, ...(config.policy ?? {}) };
    configErrors = checkConfig(config);
    ruleHitsEver = rules().map(() => 0);
    surface.configure({
      ...(config.app ? { app: config.app } : {}),
      profile: config.profile ?? null,
    });
    for (const e of config.declare ?? []) {
      surface.register({ ...e, tier: "declared" } as Entry);
      declared.add(e.id);
    }
  }
  applyConfig(config);
  scanNow();

  // --- coverage -----------------------------------------------------------------------------------
  function coverage(): Coverage {
    flush();
    const view = originalObserve();
    const rows = new Map(view.entries.map((r) => [r.id, r]));
    const entries: CoverageEntry[] = [];
    const counts: Coverage["counts"] = {
      entries: 0,
      byKind: { action: 0, field: 0, collection: 0 },
      byTier: { derived: 0, annotated: 0, declared: 0 },
      byConfidence: { high: 0, medium: 0, low: 0, none: 0 },
      unavailable: 0,
      awaitingApproval: 0,
      gaps: 0,
    };
    const approvalsOut: Coverage["approvals"] = [];
    for (const e of surface.entries()) {
      const b = registered.get(e.id);
      const row = rows.get(e.id);
      const meta = b?.meta;
      const tier: EntryTier = meta?.tier ?? e.tier ?? "declared";
      const nameFrom: NameFrom = meta?.nameFrom ?? "declared";
      const confidence = meta?.confidence ?? "high";
      const available = row ? row.index !== null : false;
      const out: CoverageEntry = {
        id: e.id,
        key: meta?.key ?? e.id,
        kind: e.kind,
        role: e.role,
        name: nameText(e),
        object: e.object ?? null,
        tier,
        nameFrom,
        confidence,
        available,
      };
      const risk = meta?.risk ?? (e.kind === "action" ? (e.effect.risk ?? "medium") : undefined);
      if (risk) out.risk = risk;
      if (meta?.riskWhy) out.riskWhy = meta.riskWhy;
      if (meta?.policy) out.policy = meta.policy;
      if (meta?.group) out.group = meta.group;
      if (e.kind === "field" && e.sensitive) out.sensitive = true;
      const el = b?.element;
      if (el && el.isConnected) out.selector = selectorFor(el);
      entries.push(out);
      counts.entries++;
      counts.byKind[e.kind]++;
      counts.byTier[tier]++;
      counts.byConfidence[confidence]++;
      if (!available) counts.unavailable++;
      if (meta?.policy === "approve" || meta?.policy === "deny") {
        if (meta.policy === "approve") counts.awaitingApproval++;
        approvalsOut.push({
          id: e.id,
          name: nameText(e),
          risk: meta.risk ?? "high",
          why: meta.riskWhy ?? "",
          policy: meta.policy,
        });
      }
    }
    const stale: StaleRule[] = [];
    rules().forEach((r, i) => {
      if ((ruleHitsNow[i] ?? 0) > 0) return;
      const scoped =
        r.match.route !== undefined &&
        ruleMatches(
          { route: r.match.route },
          { key: "", pin: null, element: null, route: currentRoute, role: "", name: "" },
        );
      if (scoped)
        stale.push({
          index: i,
          match: r.match,
          status: "stale",
          message: `It is scoped to ${currentRoute} and matched no control here: the control was renamed, moved, or removed.`,
        });
      else if (r.match.route === undefined && !(ruleHitsEver[i] ?? 0))
        stale.push({
          index: i,
          match: r.match,
          status: "unmatched",
          message:
            "It has matched no control on any page seen so far; add a route to scope it, or fix the match.",
        });
    });
    const suggestions = gaps.flatMap((g) => (g.suggestion ? [g.suggestion] : []));
    counts.gaps = gaps.length;
    const unreadable = collectContent({
      root: rootEl!,
      layout,
      skip: skipper(),
      sensitive: sensitivity(),
      navigation: true,
    }).opaque.map((o) => ({
      ...o,
      message: `${o.kind === "frame" ? "A frame from another site" : o.kind === "closed-shadow" ? "A component with a closed shadow root" : o.library ? o.library.charAt(0).toUpperCase() + o.library.slice(1) : o.kind === "canvas" ? "A canvas" : "An SVG chart"}${o.title ? ` (“${o.title}”)` : ""}: read reports it by title only; its content is not on the page as text.`,
    }));
    return {
      app: view.app,
      route: currentRoute,
      rev: view.rev,
      at: now().toISOString(),
      counts,
      entries,
      gaps: [...gaps],
      approvals: approvalsOut,
      staleConfig: stale,
      suggestions,
      frames: { ...frames },
      configErrors: [...configErrors],
      unreadable,
    };
  }

  // --- reading and waiting ([S-AUTO-14], [S-AUTO-15]) ---------------------------------------------
  const matchesAny = (el: Element, selector: string): boolean => {
    if (!selector) return false;
    try {
      return el.matches(selector);
    } catch {
      return false;
    }
  };
  /** Never read: an ignored subtree, the relay's indicator, excluded selectors. */
  function skipper(): (el: Element) => boolean {
    const excluded = [...(config.exclude ?? []), ...(config.read?.exclude ?? [])].join(",");
    return (el) =>
      el.hasAttribute(IGNORE_ATTRIBUTE) ||
      el.hasAttribute(RELAY_INDICATOR_ATTRIBUTE) ||
      matchesAny(el, excluded);
  }
  /** Private: passwords, card fields, one-time codes, configured selectors, fields a rule marks. */
  function sensitivity(): (el: Element) => boolean {
    const marked = new Set<Element>();
    for (const b of registered.values()) if (b.meta.sensitive && b.element) marked.add(b.element);
    const selector = (config.sensitive ?? []).join(",");
    return (el) => isSensitiveField(el) || marked.has(el) || matchesAny(el, selector);
  }

  const REGION_CONTAINERS =
    "main, nav, aside, header, footer, section, form, dialog, article, [role], [aria-label], [aria-labelledby]";
  function namedContainers(ctx: ScanContext): { el: Element; name: string }[] {
    const out: { el: Element; name: string }[] = [];
    for (const el of Array.from(rootEl!.querySelectorAll(REGION_CONTAINERS))) {
      if (skipper()(el) || isHidden(el, ctx)) continue;
      const role = roleOf(el);
      const container =
        LANDMARK_ROLES.has(role) ||
        ["dialog", "alertdialog", "article", "region", "group"].includes(role) ||
        el.hasAttribute("aria-label") ||
        el.hasAttribute("aria-labelledby");
      if (!container || ACTION_ROLES.has(role) || FIELD_ROLES.has(role)) continue;
      const name = nameOfContainer(el, ctx) || LANDMARK_NAMES[role] || "";
      if (name) out.push({ el, name });
    }
    return out;
  }

  /** Where a region name points: a configured selector, an entry, a named container, or a heading. */
  function resolveRegion(
    name: string,
  ): { root: Element; label: string } | { heading: string } | null {
    const regions = config.read?.regions ?? {};
    if (Object.prototype.hasOwnProperty.call(regions, name)) {
      let el: Element | null = null;
      try {
        el = rootEl!.querySelector(regions[name]!) ?? doc!.querySelector(regions[name]!);
      } catch {
        el = null;
      }
      return el ? { root: el, label: name } : null;
    }
    const entryEl = elements.get(name);
    if (entryEl && entryEl.isConnected) {
      const own =
        roleOf(entryEl) &&
        (COLLECTION_ROLES.has(roleOf(entryEl)) || LANDMARK_ROLES.has(roleOf(entryEl)));
      const root = own
        ? entryEl
        : (entryEl.closest(
            'table, [role="grid"], [role="table"], [role="treegrid"], section, article, form, dialog, [role="dialog"], [role="region"], main, aside, nav, ul, ol, dl',
          ) ??
          entryEl.parentElement ??
          entryEl);
      return { root, label: name };
    }
    const wanted = norm(name).toLowerCase();
    const ctx = new ScanContext(rootEl!, layout);
    const hit = namedContainers(ctx).find((c) => c.name.toLowerCase() === wanted);
    if (hit) return { root: hit.el, label: hit.name };
    return { heading: name };
  }

  function regionNames(headings: string[]): string[] {
    const ctx = new ScanContext(rootEl!, layout);
    const names = [
      ...Object.keys(config.read?.regions ?? {}),
      ...namedContainers(ctx).map((c) => c.name),
      ...headings,
    ];
    return [...new Set(names.filter(Boolean))].slice(0, 40);
  }

  function read(options: ReadOptions = {}): PageRead {
    flush();
    const bound = (v: number | undefined, l: { default: number; min: number; max: number }) =>
      typeof v === "number" && Number.isFinite(v)
        ? Math.min(l.max, Math.max(l.min, Math.floor(v)))
        : l.default;
    const maxChars = bound(options.maxChars, READ_LIMITS.maxChars);
    const maxRows = bound(options.maxRows, READ_LIMITS.maxRows);
    const base = {
      route: currentRoute,
      path: win.location?.pathname ?? "",
      title: norm(doc!.title),
      rev: surface.currentRev(),
    };
    const nothing = (reason: string, headings: string[]): PageRead => ({
      ...base,
      sections: [],
      notices: [],
      truncated: false,
      redacted: 0,
      reason,
      regions: regionNames(headings),
    });
    let root: Element = rootEl!;
    let region: string | undefined;
    let heading: string | null = null;
    const want = norm(options.region);
    if (want) {
      const found = resolveRegion(want);
      if (!found) return nothing(`no region named “${want}” is on this page now`, []);
      if ("heading" in found) heading = found.heading;
      else {
        root = found.root;
        region = found.label;
      }
    }
    const collected = collectContent({
      root,
      layout,
      skip: skipper(),
      sensitive: sensitivity(),
      navigation: root !== rootEl,
    });
    let sections = collected.sections;
    if (heading !== null) {
      sections = sectionsUnder(sections, heading);
      if (!sections.length)
        return nothing(
          `no region or heading named “${heading}” is on this page now`,
          collected.sections.filter((s) => s.level > 0 && s.level <= 3).map((s) => s.heading),
        );
      region = sections[0]!.heading;
    }
    const query = norm(options.query);
    if (query) sections = filterSections(sections, query);
    sections = boundRows(sections, maxRows);
    const page = paginate(sections, maxChars, options.cursor);
    const out: PageRead = {
      ...base,
      sections: page.sections,
      notices: collected.notices,
      truncated: page.truncated || collected.capped,
      redacted: collected.redacted,
    };
    if (region) out.region = region;
    if (page.nextCursor) out.nextCursor = page.nextCursor;
    if (page.reason) out.reason = page.reason;
    else if (query && !sections.length) out.reason = `nothing on the page mentions “${query}”`;
    return out;
  }

  const waiter = createWaiter({
    win,
    doc: doc!,
    surface,
    flush: () => flush(),
    route: () => currentRoute,
    collectors,
    text: (visible) =>
      pageText(rootEl!, skipper(), visible ? new ScanContext(rootEl!, layout) : null),
  });
  const content: PageContent = {
    read: (o) => read(o),
    wait: (c, o) => waiter.wait(c, o),
  };
  (surface as unknown as Record<symbol, unknown>)[CONTENT] = content;

  const handle: AutoSurfaceHandle = {
    surface,
    refresh: () => ({ changed: scanNow() }),
    coverage,
    configure(next) {
      applyConfig(next ?? {});
      scanNow();
    },
    config: () => config,
    approve(id, { uses = 1, ttlMs = 5 * 60_000 } = {}) {
      if (!registered.has(id)) return false;
      approvals.set(id, { uses: Math.max(1, uses), until: Date.now() + ttlMs });
      scanNow();
      return true;
    },
    elementFor: (id) => {
      const el = elements.get(id);
      return el && el.isConnected ? el : undefined;
    },
    metaFor: (id) => registered.get(id)?.meta,
    route: () => currentRoute,
    read,
    wait: (condition, options) => waiter.wait(condition, options),
    expose(host = win) {
      if (!host) return;
      surface.expose(host);
      const pub = (host as { __surface?: Record<string, unknown> }).__surface;
      if (pub) {
        pub.coverage = () => coverage();
        pub.formatCoverage = (c?: Coverage) => formatCoverage(c ?? coverage());
        pub.refresh = () => handle.refresh();
        pub.read = (o?: ReadOptions) => read(o);
        pub.wait = (c: WaitCondition, o?: WaitOptions) => waiter.wait(c, o);
        pub.formatRead = (r?: PageRead) => formatRead(r ?? read());
      }
    },
    stop() {
      if (stopped) return;
      if (timer) clearTimeout(timer);
      timer = null;
      observer?.disconnect();
      for (const t of events) doc.removeEventListener(t, onEvent, true);
      win.removeEventListener("popstate", onEvent);
      win.removeEventListener("hashchange", onEvent);
      for (const [id, b] of registered) if (surface.get(id) === b.entry) surface.unregister(id);
      for (const id of declared) surface.unregister(id);
      registered = new Map();
      elements = new Map();
      declared.clear();
      if (surface.observe === patchedObserve) surface.observe = originalObserve;
      if (surface.act === patchedAct) surface.act = originalAct;
      const slot = surface as unknown as Record<symbol, unknown>;
      if (slot[APPROVER] === approver) delete slot[APPROVER];
      if (slot[CONTENT] === content) delete slot[CONTENT];
      stopped = true;
      waiter.cancelAll("the surface stopped");
    },
  };
  if (options.expose) handle.expose(options.expose === true ? win : options.expose);
  // A trusted channel that showed the person the request (the relay's panel) grants it here.
  const approver = (id: string): boolean => handle.approve(id);
  (surface as unknown as Record<symbol, unknown>)[APPROVER] = approver;
  return handle;
}
