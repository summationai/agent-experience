/**
 * The safety defaults of derived entries: a heuristic risk for every derived control, from its
 * role, its words, its styling, and its surroundings. It errs high: a control the heuristics do
 * not recognize is treated as a high-risk mutation, which the default policy gates behind the
 * person's approval. Configuration lowers or raises any of it ([S-AUTO-7], [S-CFG-5]).
 */
import type { Risk } from "./index";

/**
 * Word lists, English by default, matched case-insensitively on whole words against a control's
 * name (and its `title`). `destructive` makes a control high risk, `commit` medium, `view` low.
 * A configuration's lists extend these unless `replace` is true.
 */
export interface RiskLexicon {
  destructive?: string[];
  commit?: string[];
  view?: string[];
  /** Use the configured lists instead of the defaults. Default false (extend). */
  replace?: boolean;
}

export const DEFAULT_LEXICON: Required<Omit<RiskLexicon, "replace">> = {
  destructive: [
    "delete",
    "remove",
    "archive",
    "revoke",
    "disconnect",
    "cancel subscription",
    "cancel plan",
    "cancel order",
    "cancel account",
    "cancel membership",
    "unsubscribe",
    "reset",
    "purge",
    "drop",
    "overwrite",
    "erase",
    "wipe",
    "destroy",
    "terminate",
    "deactivate",
    "close account",
    "discard",
    "clear all",
    "trash",
    "empty trash",
    "uninstall",
    "send",
    "publish",
    "unpublish",
    "pay",
    "purchase",
    "buy",
    "checkout",
    "check out",
    "place order",
    "subscribe",
    "upgrade",
    "downgrade",
    "invite",
    "transfer",
    "share",
    "make public",
    "deploy",
    "release",
    "merge",
    "approve",
    "reject",
    "refund",
    "charge",
    "withdraw",
    "ban",
    "block",
    "kick",
    "suspend",
    "sign out",
    "log out",
    "logout",
    "rotate",
    "regenerate",
    "leave",
  ],
  commit: [
    "save",
    "submit",
    "update",
    "create",
    "add",
    "new",
    "apply",
    "confirm",
    "continue",
    "done",
    "finish",
    "upload",
    "import",
    "rename",
    "assign",
    "unassign",
    "move",
    "duplicate",
    "schedule",
    "enable",
    "disable",
    "connect",
    "mark",
    "star",
    "unstar",
    "follow",
    "unfollow",
    "like",
    "pin",
    "unpin",
    "join",
    "accept",
    "restore",
    "undo",
    "redo",
    "sync",
    "generate",
    "run",
    "start",
    "stop",
    "retry",
    "reopen",
    "resume",
    "post",
    "reply",
    "comment",
    "vote",
    "set",
    "change",
    "attach",
    "tag",
    "label",
    "complete",
  ],
  view: [
    "open",
    "view",
    "show",
    "hide",
    "expand",
    "collapse",
    "close",
    "cancel",
    "dismiss",
    "back",
    "previous",
    "prev",
    "next",
    "more",
    "less",
    "see all",
    "view all",
    "filter",
    "filters",
    "sort",
    "search",
    "find",
    "go",
    "refresh",
    "reload",
    "details",
    "menu",
    "options",
    "settings",
    "preferences",
    "help",
    "select",
    "choose",
    "pick",
    "toggle",
    "zoom",
    "preview",
    "edit",
    "learn more",
    "copy",
    "download",
    "export",
    "print",
    "home",
    "sign in",
    "log in",
    "login",
    "page",
    "profile",
    "account",
    "notifications",
    "inbox",
    "dashboard",
    "overview",
    "skip",
    "theme",
    "dark",
    "light",
    "dark mode",
    "light mode",
    "language",
  ],
};

export interface RiskInput {
  role: string;
  name: string;
  /** The element, for styling hints and surroundings. */
  element: Element;
  /** Resolved `href` of a link, when it has one. */
  href?: URL | null;
  /** The page's origin, for telling an external link from an internal one. */
  origin?: string;
  /** The open modal the control sits in, when it does. */
  inDialog?: { alert: boolean; name: string } | null;
}

export interface RiskVerdict {
  risk: Risk;
  /** The state the control changes, for `effect.mutates`: `location`, `view`, `form`, or `app`. */
  mutates: string;
  reversible: boolean;
  idempotent: boolean;
  /** One line on why, for coverage: "name matches “delete”". */
  why: string;
  /** Nothing recognized the control; it is high risk because it is unknown. */
  unrecognized: boolean;
}

/**
 * One pattern for a word list. `anchored`: the word must lead the name (its verb position), so
 * "Freeze (pause agents, cancel their requests)" is not a "cancel".
 */
function compile(words: string[], anchored = false): RegExp | null {
  const clean = words.map((w) => w.trim().toLowerCase()).filter(Boolean);
  if (!clean.length) return null;
  const alt = clean
    .sort((a, b) => b.length - a.length)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"))
    .join("|");
  // `_` joins a word: `refund_events` and `delete_log` are identifiers, not a verb and a noun.
  const lead = anchored ? "^[^\\p{L}\\p{N}_]*" : "(?:^|[^\\p{L}\\p{N}_])";
  return new RegExp(`${lead}(${alt})(?=$|[^\\p{L}\\p{N}_])`, "iu");
}

export interface CompiledLexicon {
  destructive: RegExp | null;
  /** The destructive words in the verb position only: for a control whose name is an item's data. */
  destructiveLead: RegExp | null;
  commit: RegExp | null;
  view: RegExp | null;
}

export function compileLexicon(lex: RiskLexicon | undefined): CompiledLexicon {
  const pick = (k: "destructive" | "commit" | "view") =>
    lex?.replace ? (lex[k] ?? []) : [...DEFAULT_LEXICON[k], ...(lex?.[k] ?? [])];
  return {
    destructive: compile(pick("destructive")),
    destructiveLead: compile(pick("destructive"), true),
    commit: compile(pick("commit"), true),
    view: compile(pick("view"), true),
  };
}

const DANGER_STYLE =
  /(?:^|[\s:_-])(?:danger|destructive|critical|negative)(?:$|[\s_-])|colorError|(?:^|\s)(?:is|btn|button)-(?:danger|error|red)(?:$|\s)|(?:^|\s)(?:bg|text|border)-(?:red|rose)-[5-9]00(?:$|\s)/i;

/** A destructive styling hint on the control: a `danger` or `destructive` class, a variant attribute, a red button. */
export function dangerStyled(el: Element): string {
  const cls =
    typeof (el as HTMLElement).className === "string"
      ? (el as HTMLElement).className
      : (el.getAttribute("class") ?? "");
  if (DANGER_STYLE.test(cls)) return "styled as destructive";
  for (const attr of [
    "data-variant",
    "variant",
    "data-intent",
    "data-color",
    "data-type",
    "data-tone",
    "color",
    "intent",
    "kind",
    "appearance",
  ]) {
    const v = (el.getAttribute(attr) ?? "").toLowerCase();
    if (/^(danger|destructive|critical|negative|error|red)$/.test(v)) return `${attr}="${v}"`;
  }
  return "";
}

/** Opens a confirmation dialog: its `aria-controls` names an `alertdialog`. */
function opensConfirm(el: Element): boolean {
  const ids = (el.getAttribute("aria-controls") ?? "").split(/\s+/).filter(Boolean);
  const root = el.getRootNode() as Document | ShadowRoot;
  return ids.some((id) => {
    const t = (root as Document).getElementById?.(id) ?? el.ownerDocument?.getElementById(id);
    return t?.getAttribute("role") === "alertdialog";
  });
}

/** A popup a trigger opens, which a UI library may render in a portal away from the trigger. */
const POPUP = '[role="menu"], [role="listbox"], [role="tree"]';

/**
 * The control that opened the popup this element is in, when the popup lives elsewhere in the
 * document (a portal on <body>, as Radix and most UI libraries render menus): the element whose
 * `aria-controls` or `aria-owns` names the popup, else the popup trigger its `aria-labelledby`
 * names. Null when the element is in no popup or none owns it.
 */
export function popupOwner(el: Element): Element | null {
  const popup = el.closest(POPUP);
  const doc = el.ownerDocument;
  if (!popup || !doc) return null;
  if (popup.id)
    for (const c of Array.from(doc.querySelectorAll("[aria-controls], [aria-owns]"))) {
      const refs = `${c.getAttribute("aria-controls") ?? ""} ${c.getAttribute("aria-owns") ?? ""}`;
      if (!popup.contains(c) && refs.split(/\s+/).includes(popup.id)) return c;
    }
  for (const ref of (popup.getAttribute("aria-labelledby") ?? "").split(/\s+/).filter(Boolean)) {
    const t = doc.getElementById(ref);
    if (t && !popup.contains(t) && t.hasAttribute("aria-haspopup")) return t;
  }
  return null;
}

/** Whether `el` is inside `container` itself or through the popups opened from inside it. */
export function withinThroughPopups(
  container: Element,
  el: Element,
  contains: (container: Element, el: Element) => boolean = (c, e) => c.contains(e),
): boolean {
  let at: Element | null = el;
  for (let hops = 0; at && hops < 5; hops++) {
    if (contains(container, at)) return true;
    at = popupOwner(at);
  }
  return false;
}

/** The dialog an element is in, directly or through the popup trigger that opened its popup. */
function dialogOf(el: Element): Element | null {
  let at: Element | null = el;
  for (let hops = 0; at && hops < 5; hops++) {
    const d = at.closest('[role="dialog"], dialog');
    if (d) return d;
    at = popupOwner(at);
  }
  return null;
}

/** What a list, table, menu, listbox, grid, or tree holds one of. */
const ITEM =
  'li, [role="listitem"], tr, [role="row"], [role="menuitem"], [role="menuitemradio"], [role="option"], [role="gridcell"], [role="treeitem"]';

const HEADING = 'h1, h2, h3, h4, h5, h6, [role="heading"]';

function controlName(c: Element): string {
  return (c.getAttribute("aria-label") || c.textContent || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const INTERACTIVE = 'a[href], button, input, select, textarea, [role="button"], [role="link"]';

/**
 * A block that is an item rather than a label: it holds a heading, other controls, or at least two
 * separate pieces of text (a name and its details). A toolbar button or a bare verb never is.
 */
export function isItemBlock(el: Element): boolean {
  if (el.querySelector(HEADING) || el.querySelector(INTERACTIVE)) return true;
  let parts = 0;
  for (const node of Array.from(el.querySelectorAll("*"))) {
    const own = Array.from(node.childNodes).some(
      (n) => n.nodeType === 3 && !!n.textContent?.trim(),
    );
    if (own && ++parts >= 2) return true;
  }
  return false;
}

/**
 * How many peers a control named for an item has, or 0 when it is not one. The control sits in an
 * item of a list, table, menu, or grid, or is (or sits in) an item block among sibling blocks of the
 * same shape (a card, a row of columns), up to three levels up to allow for wrappers; outside a
 * toolbar; and its counterpart in each peer (the same kind of control, at the same place) has its
 * own name. A name repeated across the peers is an action done to each item ("Recalculate" on
 * every row), not an item.
 */
export function itemPeers(el: Element): number {
  if (el.closest('[role="toolbar"]')) return 0;
  const listItem = el.closest(ITEM);
  const role = el.getAttribute("role");
  const selector = role ? `[role="${role}"]` : el.localName;
  const controlsIn = (u: Element): Element[] =>
    u.matches(selector) ? [u] : [...u.querySelectorAll(selector)];
  let unit: Element = listItem ?? el;
  for (let depth = 0; depth < 3; depth++) {
    const parent = unit.parentElement;
    if (!parent) return 0;
    const peers = [...parent.children].filter(
      (c) => c.localName === unit.localName && c.getAttribute("role") === unit.getAttribute("role"),
    );
    if (peers.length >= 2) {
      if (!listItem && !isItemBlock(unit)) return 0;
      const at = controlsIn(unit).indexOf(el);
      if (at < 0) return 0;
      const names = peers.map((p) => {
        const c = controlsIn(p)[at];
        return c ? controlName(c) : "";
      });
      // Most items have names of their own; two folders may share one. An action done to each
      // item has one name on every row ("Recalculate").
      if (!controlName(el)) return 0;
      const distinct = new Set(names.filter(Boolean)).size;
      return distinct >= 2 && distinct * 2 >= peers.length ? peers.length : 0;
    }
    // A list item's peers are its siblings; anything else may be wrapped, one level at a time.
    if (listItem) return 0;
    unit = parent;
  }
  return 0;
}

/** Words joined by `_`, `-`, or `.`: `connector_test`, `q3-plan`, `report.csv`. Data, not a verb. */
const IDENTIFIER = /^[\p{L}\p{N}]+(?:[._-][\p{L}\p{N}]+)+$/u;

/**
 * The name of an item that has no peers to compare with, or "": a control outside a toolbar that
 * is (or sits in) a block shaped like an item, the name and at least one more column of text,
 * whose leading text is an identifier.
 */
export function loneItemName(el: Element): string {
  if (el.closest('[role="toolbar"]')) return "";
  const block = isItemBlock(el)
    ? el
    : el.parentElement && isItemBlock(el.parentElement)
      ? el.parentElement
      : null;
  if (!block) return "";
  const walker = block.ownerDocument.createTreeWalker(block, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent?.trim();
    if (text) return IDENTIFIER.test(text) ? text : "";
  }
  return "";
}

/** A name that ends in a count: "Snowflake (7)", "Inbox 12". */
const COUNTED = /(?:\(\s*\d[\d,.]*\s*\)|\s\d[\d,.]*)$/;
const TOGGLE_STATE = ["aria-pressed", "aria-selected", "aria-current"];

/**
 * How many options a filter strip has, or 0 when the control is not one of them: at least three
 * sibling controls of the same element and class, most with names of their own, and most either
 * naming a count ("Snowflake (7)") or carrying a pressed, selected, or current state. Choosing one
 * changes what is shown.
 */
export function filterPeers(el: Element): number {
  const parent = el.parentElement;
  if (!parent) return 0;
  const cls = el.getAttribute("class") ?? "";
  const role = el.getAttribute("role");
  const peers = [...parent.children].filter(
    (c) =>
      c.localName === el.localName &&
      c.getAttribute("role") === role &&
      (c.getAttribute("class") ?? "") === cls,
  );
  if (peers.length < 3) return 0;
  const names = peers.map(controlName);
  const distinct = new Set(names.filter(Boolean)).size;
  if (distinct * 2 < peers.length || !controlName(el)) return 0;
  const counted = names.filter((n) => COUNTED.test(n)).length;
  const stated = peers.filter((p) => TOGGLE_STATE.some((a) => p.hasAttribute(a))).length;
  return counted * 2 >= peers.length || stated * 2 >= peers.length ? peers.length : 0;
}

function matchOf(re: RegExp | null, text: string): string {
  if (!re) return "";
  const m = re.exec(text);
  return m ? m[1]!.toLowerCase() : "";
}

/** The heuristic verdict for one derived action. */
export function classify(input: RiskInput, lex: CompiledLexicon): RiskVerdict {
  const { role, element: el } = input;
  const title = el.getAttribute("title") ?? "";
  const words = `${input.name} ${title}`.trim();
  const verdict = (
    risk: Risk,
    mutates: string,
    why: string,
    extra: Partial<RiskVerdict> = {},
  ): RiskVerdict => ({
    risk,
    mutates,
    reversible: risk === "none" || risk === "low",
    idempotent: mutates === "location" || mutates === "view",
    why,
    unrecognized: false,
    ...extra,
  });
  // Controls whose effect is structural: they change what the page shows or what a form holds,
  // whatever their label says ("Send me the newsletter" is a checkbox, not a send).
  const inFormEarly = !!el.closest("form");
  if (role === "tab" || role === "treeitem" || role === "menuitemradio")
    return verdict("low", "view", `a ${role}: changes what is shown`);
  if (role === "option") return verdict("low", "form", "chooses an option");
  if (role === "combobox-trigger") return verdict("low", "view", "opens a list of choices");
  if ((role === "checkbox" || role === "radio") && inFormEarly)
    return verdict("low", "form", `a ${role} in a form: nothing is saved until it is submitted`);
  // A link whose name is a whole card of text ("Schemas: … every schema you publish …") navigates;
  // its words describe the destination, not an effect.
  const longLink = role === "link" && input.name.split(/\s+/).length > 6;
  // A control that is itself an item among its peers (a row of a table's columns, a card) takes
  // its name from the item's data: "refund_events" is a table, not a refund. Only a verb at the
  // start of its name counts, and danger styling and confirmation still do.
  const itemSelf = role !== "link" && isItemBlock(el) ? itemPeers(el) : 0;
  if (itemSelf) {
    const lead = matchOf(lex.destructiveLead, input.name);
    if (lead) return verdict("high", "app", `name starts with “${lead}”`);
    const styledItem = dangerStyled(el);
    if (styledItem) return verdict("high", "app", styledItem);
    if (opensConfirm(el)) return verdict("high", "app", "opens a confirmation dialog");
    if (!input.inDialog?.alert)
      return verdict(
        "low",
        "location",
        `opens one of ${itemSelf} items; its name is the item, not an action`,
        {
          reversible: true,
          idempotent: true,
        },
      );
  }
  // An operable table row (focusable, in a table or grid) opens its item; its text is the item's
  // data, so only a verb at the start of it counts.
  if (role === "row") {
    const lead = matchOf(lex.destructiveLead, input.name);
    if (lead) return verdict("high", "app", `name starts with “${lead}”`);
    const styledRow = dangerStyled(el);
    if (styledRow) return verdict("high", "app", styledRow);
    if (opensConfirm(el)) return verdict("high", "app", "opens a confirmation dialog");
    return verdict(
      "low",
      "location",
      "opens a row of the table; its text is the item, not an action",
      {
        reversible: true,
        idempotent: true,
      },
    );
  }
  const destructive = longLink ? "" : matchOf(lex.destructive, words);
  if (destructive) return verdict("high", "app", `name matches “${destructive}”`);
  const styled = dangerStyled(el);
  if (styled) return verdict("high", "app", styled);
  if (opensConfirm(el)) return verdict("high", "app", "opens a confirmation dialog");
  if (input.inDialog?.alert) {
    // The affirmative button of a confirmation dialog confirms whatever the dialog describes.
    const view = matchOf(lex.view, input.name);
    if (view) return verdict("low", "view", `“${view}” in a confirmation dialog`);
    return verdict("high", "app", `confirms the dialog “${input.inDialog.name || "confirmation"}”`);
  }
  // A menu a dialog's trigger opened belongs to that dialog, wherever the library rendered it.
  const ownerDialog = input.inDialog ? null : dialogOf(el);
  if (role === "menuitem" && (input.inDialog || ownerDialog)) {
    // A common picker shape (workspace, account, tenant, project, etc.) stages a menu choice in a
    // dialog and has a separate Continue/Apply/Save control commit it. The choice itself changes
    // only the form. Destructive names and styling were checked above, so they remain high risk.
    const dialog = el.closest('[role="dialog"]') ?? ownerDialog;
    const hasSeparateCommit = [
      ...(dialog?.querySelectorAll<HTMLElement>('button, input[type="submit"], [role="button"]') ??
        []),
    ].some((candidate) => {
      if (candidate === el || candidate.contains(el)) return false;
      const candidateType = (candidate.getAttribute("type") ?? "").toLowerCase();
      if (
        (candidate.localName === "button" &&
          (candidateType === "submit" || (candidateType === "" && !!candidate.closest("form")))) ||
        (candidate.localName === "input" && candidateType === "submit")
      )
        return true;
      const candidateName =
        `${candidate.getAttribute("aria-label") ?? ""} ${candidate.textContent ?? ""} ${candidate.getAttribute("title") ?? ""}`.trim();
      return !!matchOf(lex.commit, candidateName);
    });
    if (hasSeparateCommit)
      return verdict(
        "low",
        "form",
        "chooses a staged value in a dialog; a separate control commits it",
      );
  }
  if (role === "link") {
    if (input.href && input.origin && input.href.origin !== input.origin)
      return verdict("medium", "location", "leaves the site", { reversible: true });
    return verdict("low", "location", "a link within the site", {
      reversible: true,
      idempotent: true,
    });
  }
  if (role === "tab" || role === "treeitem" || role === "menuitemradio")
    return verdict("low", "view", `a ${role}: changes what is shown`);
  if (role === "option") return verdict("low", "form", "chooses an option");
  if (role === "combobox-trigger") return verdict("low", "view", "opens a list of choices");
  const inForm = !!el.closest("form");
  if (role === "checkbox" || role === "radio" || role === "menuitemcheckbox") {
    if (inForm)
      return verdict("low", "form", `a ${role} in a form: nothing is saved until it is submitted`);
    if (el.closest('tr, [role="row"]')) return verdict("low", "view", "selects a row");
    return verdict("medium", "app", `a ${role} outside a form may save on change`);
  }
  if (role === "switch") return verdict("medium", "app", "a switch usually saves on change");
  const commit = matchOf(lex.commit, input.name) || matchOf(lex.commit, title);
  const view = matchOf(lex.view, input.name) || matchOf(lex.view, title);
  const type = (el.getAttribute("type") ?? "").toLowerCase();
  const submits =
    (el.localName === "button" && (type === "submit" || (type === "" && inForm))) ||
    (el.localName === "input" && type === "submit");
  if (commit)
    return verdict("medium", submits || inForm ? "form" : "app", `name matches “${commit}”`);
  if (submits) return verdict("medium", "form", "submits a form");
  if (el.localName === "summary") return verdict("low", "view", "opens or closes a disclosure");
  if (view) return verdict("low", "view", `name matches “${view}”`);
  if (el.hasAttribute("aria-haspopup") || el.hasAttribute("aria-expanded"))
    return verdict("low", "view", "opens a menu or panel");
  // Some client-side routers use buttons for navigation. Inside an actual navigation landmark,
  // that semantic context is enough to distinguish an otherwise unknown button from an unknown
  // application mutation. Destructive wording, styling, and confirmation dialogs were checked
  // above and stay high risk.
  if (el.hasAttribute("data-surface-navigation"))
    return verdict("low", "location", "marked as navigation by the application", {
      reversible: true,
      idempotent: true,
    });
  if (el.closest('nav, [role="navigation"]'))
    return verdict("low", "location", "a control in a navigation landmark", {
      reversible: true,
      idempotent: true,
    });
  // A control named for an item among its peers (an organization, a tenant, a table, a report)
  // opens or selects that item. Every check above (destructive words, styling, confirmation,
  // commit words, submits) has had its say; this only lowers what would otherwise be unknown.
  const peers = itemPeers(el);
  if (peers)
    return verdict(
      "low",
      "location",
      `opens one of ${peers} items; its name is the item, not an action`,
      { reversible: true, idempotent: true },
    );
  // The same, for an item that has no peers yet (a folder holding one subfolder): a block shaped
  // like an item (its name plus other columns), whose name is an identifier.
  const lone = loneItemName(el);
  if (lone)
    return verdict(
      "low",
      "location",
      `opens the item “${lone}”; its name is the item, not an action`,
      {
        reversible: true,
        idempotent: true,
      },
    );
  const options = filterPeers(el);
  if (options)
    return verdict("low", "view", `filters by one of ${options} options`, {
      reversible: true,
      idempotent: true,
    });
  if (el.getAttribute("type") === "reset") return verdict("medium", "form", "resets a form");
  return verdict("high", "app", "not recognized; treated as a high-risk change until configured", {
    unrecognized: true,
  });
}
