/**
 * `SurfaceConfig`: the overlay a team writes on top of what `autoSurface` derives. A plain object,
 * loadable from a JSON or TypeScript file and reviewable in a diff: each rule matches derived
 * controls (by key, by `data-surface-id`, by CSS selector, or by route, role, and name) and says
 * what the page could not: a better name, the object it belongs to, why it is disabled, what it
 * changes and how risky that is, that its value is private, that it should be hidden, that it
 * needs the person's approval, the domain action it belongs to, or a real application function to
 * run in place of the page's events ([S-CFG-1] to [S-CFG-8]).
 */
import type { Effect, Entry, HandlerReport, MaybePromise, Risk } from "./index";
import type { RiskLexicon } from "./auto-risk";
import { norm } from "./auto-dom";

/** What a rule's `handler` receives: the declared tier, an application function in place of the page's events. */
export interface AutoHandlerContext {
  /** The entry id the act resolved to. */
  entryId: string;
  /** The control on the page now, or null when the rule declares a control the page does not render. */
  element: Element | null;
  /** The act's text: a field's new value, or an action's free text. */
  text: string | undefined;
  actor: string;
  /** The revision the agent presented, for a conditional write. */
  expectedRev: number;
  /** Run the page's own events for this control (the derived act), when the handler wants both. */
  dispatch: () => Promise<void>;
}

export type AutoHandler = (context: AutoHandlerContext) => MaybePromise<HandlerReport | unknown>;

/**
 * Which derived controls a rule applies to. Every member given must hold. `name` is compared
 * case-insensitively after collapsing whitespace, or as a regular expression written `/…/flags`;
 * `route` and `key` accept `*` (within a segment) and `**` (across segments) globs.
 */
export interface SurfaceMatch {
  /** The derived key, as coverage and `observe()` report it. */
  key?: string;
  /** The control's `data-surface-id`. */
  id?: string;
  /** A CSS selector the control matches. Also brings in an element the scan would not pick (a clickable `div`). */
  selector?: string;
  /** A glob on the route the page is at (`/projects/*`). */
  route?: string;
  /** The derived role (`button`, `link`, `textbox`, `checkbox`, `grid`, …). */
  role?: string;
  /** The derived accessible name, or `/regex/flags`. */
  name?: string;
}

/** A rule of a `SurfaceConfig`. */
export interface SurfaceRule {
  match: SurfaceMatch;
  /** A note for reviewers; ignored by the SDK. */
  note?: string;
  /** Pin the entry id, as `data-surface-id` would. */
  id?: string;
  /** The name to publish in place of the derived one. States the outcome ([S-DOM-1]). */
  name?: string;
  /** The object the control belongs to. */
  object?: string;
  /** Treat a matched element as this role (to bring in a clickable `div`, or correct a role). */
  role?: string;
  /** The reason to report when the control is unavailable, in the application's words. */
  reason?: string;
  /** Force the availability: `unavailable` needs `reason`. */
  state?: "available" | "unavailable";
  /** What the control changes and how risky that is; merged over the derived effect. */
  effect?: Partial<
    Pick<Effect, "mutates" | "risk" | "reversible" | "idempotent" | "confirm" | "text">
  >;
  /** The field's value is private ([S-PRV-1]). */
  sensitive?: boolean;
  /** Let an agent type into a sensitive field. Default false: a sensitive field is read only to agents. */
  editable?: boolean;
  /** Leave the control out of the surface. */
  hide?: boolean;
  /** Require the person's approval before an agent acts (true), or never (false), whatever the risk. */
  approval?: boolean;
  /** Fold the control into this domain action (a key of `groups`). */
  group?: string;
  /** Run this application function instead of the page's events: the declared tier. */
  handler?: AutoHandler;
}

/** A domain action that folds matched controls together, for `autoActions`. */
export interface SurfaceGroup {
  title: string;
  description: string;
  /** The highest risk of any control in the group. Default `high`. */
  risk?: Exclude<Risk, "none">;
  reversible?: boolean;
  idempotent?: boolean;
}

/** What an agent may do with a derived control at each risk level. */
export type PolicyDecision = "allow" | "approve" | "deny";

export interface SurfacePolicy {
  none?: PolicyDecision;
  low?: PolicyDecision;
  medium?: PolicyDecision;
  /** Default `approve`: the act is refused with a handoff that tells the agent to ask the person. */
  high?: PolicyDecision;
}

export interface SurfaceConfig {
  /** The application name `observe()` reports. */
  app?: string;
  /** Routes to derive on (globs on the route); the rest derive nothing. Default: every route. */
  routes?: { include?: string[]; exclude?: string[] };
  /** Rules, applied in order; a later rule's fields win. */
  rules?: SurfaceRule[];
  /** The risk word lists, extending the English defaults unless `replace` is set. */
  lexicon?: RiskLexicon;
  /** What an agent may do at each risk level. Default: allow `none`, `low`, `medium`; `approve` for `high`. */
  policy?: SurfacePolicy;
  /** Domain actions that rules fold controls into with `group`. Names: lowercase letters, digits, hyphens. */
  groups?: Record<string, SurfaceGroup>;
  /** More selectors whose fields are sensitive, beside passwords, card fields, and one-time codes. */
  sensitive?: string[];
  /** Selectors never derived (a developer toolbar, a chat widget). */
  exclude?: string[];
  /** Entries registered as they are, beside the derived ones: the declared tier. */
  declare?: Entry[];
  /** Register the page's landmarks as targets of `navigate`. Default true. */
  landmarks?: boolean;
  /**
   * How the `navigate` entry opens a path: a function (your router's `navigate`), `link` (click a
   * link on the page with that path, else load it), `history` (`pushState` and `popstate`, for
   * routers that listen to it), `location` (a full load), or `false` for no `navigate` entry.
   * Default `link`.
   */
  navigate?: ((path: string) => MaybePromise<void>) | "link" | "history" | "location" | false;
}

/** A glob to a regular expression: `**` any characters, `*` any within a path segment, `?` one character. */
export function globToRegExp(glob: string): RegExp {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === "*") {
      if (glob[i + 1] === "*") {
        out += ".*";
        i++;
      } else out += "[^/]*";
    } else if (c === "?") out += "[^/]";
    else out += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${out}$`);
}

const globCache = new Map<string, RegExp>();
export function globMatch(glob: string, value: string): boolean {
  let re = globCache.get(glob);
  if (!re) {
    re = globToRegExp(glob);
    globCache.set(glob, re);
  }
  return re.test(value);
}

/** A `name` matcher: `/regex/flags`, or a case-insensitive exact name. */
export function nameMatches(pattern: string, name: string): boolean {
  const m = /^\/(.*)\/([dgimsuvy]*)$/.exec(pattern);
  if (m) {
    try {
      return new RegExp(m[1]!, m[2]!.replace("g", "")).test(name);
    } catch {
      return false;
    }
  }
  return norm(pattern).toLowerCase() === norm(name).toLowerCase();
}

/** Whether a route is derived on under `routes`. */
export function routeIncluded(config: SurfaceConfig, route: string): boolean {
  const inc = config.routes?.include;
  const exc = config.routes?.exclude;
  if (inc && inc.length && !inc.some((g) => globMatch(g, route))) return false;
  if (exc && exc.some((g) => globMatch(g, route))) return false;
  return true;
}

/** The facts a rule is matched against. */
export interface MatchSubject {
  key: string;
  pin: string | null;
  element: Element | null;
  route: string;
  role: string;
  name: string;
}

/** Whether every member of `match` holds for the subject. An empty match never matches. */
export function ruleMatches(match: SurfaceMatch, s: MatchSubject): boolean {
  let any = false;
  if (match.key !== undefined) {
    any = true;
    if (!(match.key.includes("*") ? globMatch(match.key, s.key) : match.key === s.key))
      return false;
  }
  if (match.id !== undefined) {
    any = true;
    if (s.pin !== match.id) return false;
  }
  if (match.selector !== undefined) {
    any = true;
    if (!s.element) return false;
    try {
      if (!s.element.matches(match.selector)) return false;
    } catch {
      return false;
    }
  }
  if (match.route !== undefined) {
    any = true;
    if (!globMatch(match.route, s.route)) return false;
  }
  if (match.role !== undefined) {
    any = true;
    if (match.role !== s.role && !(match.role === "combobox" && s.role === "combobox-trigger"))
      return false;
  }
  if (match.name !== undefined) {
    any = true;
    if (!nameMatches(match.name, s.name)) return false;
  }
  return any;
}

/** The validation problems of a configuration, as plain sentences; empty when it is sound. */
export function checkConfig(config: SurfaceConfig): string[] {
  const out: string[] = [];
  (config.rules ?? []).forEach((r, i) => {
    const where = `rules[${i}]`;
    if (!r || typeof r !== "object" || !r.match || typeof r.match !== "object") {
      out.push(`${where}: needs a match object.`);
      return;
    }
    const keys = Object.keys(r.match).filter(
      (k) => (r.match as Record<string, unknown>)[k] !== undefined,
    );
    if (!keys.length) out.push(`${where}: match is empty, so it would match nothing.`);
    if (r.state === "unavailable" && !r.reason)
      out.push(`${where}: state "unavailable" needs a reason.`);
    if (r.group && !(config.groups && r.group in config.groups))
      out.push(`${where}: group "${r.group}" is not declared under groups.`);
    if (r.match.selector) {
      try {
        (globalThis.document ?? null)?.createDocumentFragment().querySelector(r.match.selector);
      } catch {
        out.push(`${where}: selector ${JSON.stringify(r.match.selector)} is not valid CSS.`);
      }
    }
  });
  for (const name of Object.keys(config.groups ?? {}))
    if (!/^[a-z][a-z0-9-]*$/.test(name))
      out.push(`groups.${name}: use lowercase letters, digits, and hyphens.`);
  return out;
}
