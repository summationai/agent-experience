/**
 * The generic tools of a derived surface ([S-AUTO-11]): a fixed set of parameterized domain
 * actions instead of one tool per widget, so the tool list stays the same size however many
 * controls the page renders. Plain data (each spec's `covers` reads the entry), so the in-page
 * relay can use it without the AXE runtime; `autoActions` in `@axe/surface/axe` passes it to
 * `domainActions`.
 */
import type { DomainActionSpec } from "./axe";
import type { Entry, Risk } from "./index";
import type { SurfaceGroup } from "./auto-config";

/** The key under which an auto surface marks the entries it registered (a global symbol, so every bundle of the package reads the same one). */
export const AUTO_META = Symbol.for("@axe/surface/auto");

/** What an auto surface records on each entry it registers. */
export interface AutoEntryMark {
  group?: string;
  key: string;
}

/** The mark an auto surface left on an entry, or undefined for an entry it did not register. */
export function autoMarkOf(entry: Entry): AutoEntryMark | undefined {
  return (entry as unknown as Record<symbol, AutoEntryMark | undefined>)[AUTO_META];
}

const ORDER: Record<Risk, number> = { none: 0, low: 1, medium: 2, high: 3 };

export interface AutoDomainsOptions {
  /** The groups of the configuration (`SurfaceConfig.groups`): one domain action each, before the defaults. */
  groups?: Record<string, SurfaceGroup>;
  /** Risk declared for `set-field`. Default `medium`. */
  fieldRisk?: Exclude<Risk, "none">;
}

/**
 * The domain actions for an auto surface, in the order they are tried: one per configured group,
 * then `navigate` (links within the site, landmarks, and the `navigate` entry that opens a path),
 * `set-field`, `run-control` (every other action, declared `high` so every control fits), and
 * `load-more`.
 */
export function autoDomains(options: AutoDomainsOptions = {}): DomainActionSpec[] {
  const groups: DomainActionSpec[] = Object.entries(options.groups ?? {}).map(([name, g]) => ({
    name,
    title: g.title,
    description: g.description,
    covers: (e: Entry) => autoMarkOf(e)?.group === name,
    risk: g.risk ?? "high",
    idempotent: g.idempotent ?? false,
    reversible: g.reversible ?? false,
  }));
  return [
    ...groups,
    {
      name: "navigate",
      title: "Go somewhere in the application",
      description:
        "Follows a link within the site, brings a landmark (main content, navigation, search) into view, or, on the navigate entry, opens a same-origin path given as text.",
      covers: (e) =>
        e.kind === "action" &&
        (e.effect.mutates === "location" || e.effect.mutates === "view") &&
        ORDER[e.effect.risk ?? "medium"] <= ORDER.low &&
        (e.effect.reversible ?? e.effect.undoable ?? false) &&
        (e.role === "link" || e.effect.mutates === "location" || isLandmarkRole(e.role)),
      risk: "low",
      idempotent: false,
      reversible: true,
      idleReason: "there is nowhere to go from this page right now",
    },
    {
      name: "set-field",
      title: "Set a field",
      description:
        "Types a value into one of the page's fields through the page itself, as a person would. text is the new value; a select takes one of its options.",
      covers: (e) => e.kind === "field",
      risk: options.fieldRisk ?? "medium",
      idempotent: true,
      reversible: false,
      idleReason: "no field on the page can be edited right now",
    },
    {
      name: "run-control",
      title: "Use a control",
      description:
        "Clicks one of the page's controls (a button, a menu item, a tab, a checkbox) the way a person would. Its observe row carries its effect: what it changes, its risk, and whether it needs the person's approval.",
      covers: (e) => e.kind === "action",
      risk: "high",
      idempotent: false,
      reversible: false,
      idleReason: "no control on the page can be used right now",
    },
    {
      name: "load-more",
      title: "Load more rows",
      description:
        "Asks one of the page's lists or tables to show more, by its load-more control or by scrolling it. Its observe row carries total and loaded.",
      covers: (e) => e.kind === "collection",
      risk: "low",
      idempotent: false,
      reversible: false,
      idleReason: "no list on the page can load more right now",
    },
  ];
}

function isLandmarkRole(role: string): boolean {
  return [
    "main",
    "navigation",
    "search",
    "complementary",
    "region",
    "form",
    "banner",
    "contentinfo",
  ].includes(role);
}
