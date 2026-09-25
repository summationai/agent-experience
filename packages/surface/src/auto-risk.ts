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

function compile(words: string[]): RegExp | null {
  const clean = words.map((w) => w.trim().toLowerCase()).filter(Boolean);
  if (!clean.length) return null;
  const alt = clean
    .sort((a, b) => b.length - a.length)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"))
    .join("|");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])(${alt})(?=$|[^\\p{L}\\p{N}])`, "iu");
}

export interface CompiledLexicon {
  destructive: RegExp | null;
  commit: RegExp | null;
  view: RegExp | null;
}

export function compileLexicon(lex: RiskLexicon | undefined): CompiledLexicon {
  const pick = (k: "destructive" | "commit" | "view") =>
    lex?.replace ? (lex[k] ?? []) : [...DEFAULT_LEXICON[k], ...(lex?.[k] ?? [])];
  return {
    destructive: compile(pick("destructive")),
    commit: compile(pick("commit")),
    view: compile(pick("view")),
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
  const destructive = longLink ? "" : matchOf(lex.destructive, words);
  if (destructive) return verdict("high", "app", `name matches “${destructive}”`);
  const styled = dangerStyled(el);
  if (styled) return verdict("high", "app", styled);
  if (opensConfirm(el)) return verdict("high", "app", "opens a confirmation dialog");
  if (input.inDialog?.alert) {
    // The affirmative button of a confirmation dialog confirms whatever the dialog describes.
    const view = matchOf(lex.view, words);
    if (view) return verdict("low", "view", `“${view}” in a confirmation dialog`);
    return verdict("high", "app", `confirms the dialog “${input.inDialog.name || "confirmation"}”`);
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
  const commit = matchOf(lex.commit, words);
  const view = matchOf(lex.view, words);
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
  if (el.getAttribute("type") === "reset") return verdict("medium", "form", "resets a form");
  return verdict("high", "app", "not recognized; treated as a high-risk change until configured", {
    unrecognized: true,
  });
}
