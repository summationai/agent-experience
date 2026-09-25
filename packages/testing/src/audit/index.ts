/**
 * `axe audit`: the AXE Score (0–100) with a categorized, prioritized fix list.
 * Deterministic for a given manifest and set of responses. Weights live in
 * `weights.json` so a team can tune them in one place.
 */
import type { ActionDefinition, Manifest } from "@axe/core/types";
import { lintManifest, isBareQuerySearch } from "@axe/core/lint";
import { resolveDisplay } from "@axe/core/display";
import { getPointer } from "@axe/core";
import * as WIRE from "@axe/core/vocabulary";
import weightsJson from "./weights.json";
import { runConformance } from "../conformance/index";
import type { ConformanceOptions, ConformanceReport } from "../conformance/index";

export interface AuditCheck {
  id: string;
  category: string;
  title: string;
  weight: number;
  /** Fraction earned, 0..1. Always 0 for a skipped check, which is excluded from the score. */
  earned: number;
  status: "pass" | "partial" | "fail" | "skip";
  detail: string;
  docs: string;
}

export interface AuditCategory {
  id: string;
  title: string;
  max: number;
  /** 0 when the category is not scored. */
  score: number;
  /**
   * False when every check in the category skipped. An unscored category earns nothing and is
   * left out of the total, which is then scaled to 100 over the categories that were scored.
   */
  scored: boolean;
  checks: AuditCheck[];
}

export interface AuditFix {
  check: string;
  title: string;
  category: string;
  /** Points of the total score recoverable by fixing this check completely. */
  points: number;
  detail: string;
  docs: string;
}

export interface ParityTarget {
  action: string;
  itemId: string;
  url: string;
  /** Values an auditor should find on the human page. */
  expect: Record<string, string>;
  /** Filled in with `--browser`. */
  found?: Record<string, boolean>;
}

export interface AuditReport {
  url: string;
  score: number;
  categories: AuditCategory[];
  fixes: AuditFix[];
  parity: { targets: ParityTarget[]; checked: boolean; note: string };
  hardFailure: string | null;
  conformance: ConformanceReport;
  generatedAt: string;
}

export interface AuditOptions extends ConformanceOptions {
  /** Fetch each parity URL and look for the agent-facing price/availability values on the page. */
  browser?: boolean;
  /** Fail below this score (used by the CLI exit code). */
  minScore?: number;
}

type Weights = {
  categories: Record<string, { title: string; max: number }>;
  checks: Record<string, { weight: number; title: string; docs: string }>;
  hardFailures: string[];
};

export const WEIGHTS: Weights = weightsJson as Weights;

class Scorer {
  readonly checks: AuditCheck[] = [];
  add(id: string, earned: number, detail: string, status?: AuditCheck["status"]): void {
    const w = WEIGHTS.checks[id];
    if (!w) throw new Error(`Unknown audit check ${id}`);
    const category = id.split(".")[0]!;
    const e = Math.max(0, Math.min(1, earned));
    this.checks.push({
      id,
      category,
      title: w.title,
      weight: w.weight,
      earned: e,
      status: status ?? (e >= 1 ? "pass" : e <= 0 ? "fail" : "partial"),
      detail,
      docs: w.docs,
    });
  }
  skip(id: string, detail: string): void {
    const w = WEIGHTS.checks[id]!;
    this.checks.push({
      id,
      category: id.split(".")[0]!,
      title: w.title,
      weight: w.weight,
      earned: 0,
      status: "skip",
      detail,
      docs: w.docs,
    });
  }
}

function status(report: ConformanceReport, id: string) {
  return report.checks.find((c) => c.id === id);
}

function fraction(ok: number, total: number): number {
  return total === 0 ? 1 : ok / total;
}

/** Actions reachable from a read action or from another action's affordances. */
export function graphConnectivity(m: Manifest): {
  orphanTransactions: string[];
  deadEndReads: string[];
} {
  const targets = new Set<string>();
  for (const a of m.actions) for (const aff of a.affordances ?? []) targets.add(aff.action);
  for (const f of m.flows ?? []) for (const s of f.steps) targets.add(s);
  const deadEndReads = m.actions
    .filter(
      (a) =>
        a.readOnly &&
        a.display &&
        (a.display.kind === WIRE.displayKind.list || a.display.kind === WIRE.displayKind.table) &&
        !a.affordances?.length,
    )
    .map((a) => a.name);
  const orphanTransactions = m.actions
    .filter((a) => !a.readOnly && !targets.has(a.name) && m.actions.length > 1)
    .map((a) => a.name);
  return { orphanTransactions, deadEndReads };
}

function inputFieldsWithoutDescription(a: ActionDefinition): { total: number; missing: string[] } {
  const props = (a.input["properties"] ?? {}) as Record<string, Record<string, unknown>>;
  const names = Object.keys(props);
  return {
    total: names.length,
    missing: names.filter((n) => typeof props[n]?.["description"] !== "string"),
  };
}

function collectParity(m: Manifest, report: ConformanceReport): ParityTarget[] {
  const targets: ParityTarget[] = [];
  for (const a of m.actions) {
    if (!a.display?.item?.url) continue;
    const live =
      report.observations.outputs.find((o) => o.action === a.name)?.output ??
      a.examples?.[0]?.output;
    if (live === undefined) continue;
    const presented = resolveDisplay(a, live);
    for (const item of presented.items.slice(0, 3)) {
      if (!item.url) continue;
      const expect: Record<string, string> = {};
      if (item.price) expect["price"] = String(item.price.amount);
      for (const attr of item.attributes.slice(0, 3))
        if (attr.value !== null && typeof attr.value !== "object")
          expect[attr.label] = String(attr.value);
      targets.push({ action: a.name, itemId: item.id, url: item.url, expect });
    }
  }
  return targets;
}

/** Run the audit. Runs the conformance suite first and reuses its observations. */
export async function runAudit(url: string, options: AuditOptions = {}): Promise<AuditReport> {
  const { browser: _browser, minScore: _minScore, ...conf } = options;
  const report = await runConformance(url, conf);
  const s = new Scorer();
  const m = report.manifest;
  const f = options.fetch ?? fetch;

  // Discoverable
  s.add(
    "discoverable.well-known",
    status(report, "discovery.well-known")?.status === "pass" ? 1 : 0,
    status(report, "discovery.well-known")?.detail ?? "No manifest.",
  );
  s.add(
    "discoverable.schema",
    status(report, "manifest.schema")?.status === "pass" ? 1 : 0,
    status(report, "manifest.schema")?.detail ?? "No manifest.",
  );
  s.add(
    "discoverable.protocol-header",
    report.checks
      .filter((c) => c.id === "runtime.protocol-header")
      .every((c) => c.status === "pass") && status(report, "runtime.protocol-header")
      ? 1
      : 0,
    status(report, "runtime.protocol-header")?.detail ?? "Not checked.",
  );
  s.add(
    "discoverable.hint",
    report.observations.hintFound ? 1 : 0,
    report.observations.hintFound
      ? `Found via ${report.observations.hintFound}`
      : `Add "${WIRE.robots.manifest}: <url>" to robots.txt or <link rel="${WIRE.link.manifestRel}"> to your pages.`,
  );
  s.add(
    "discoverable.cacheable",
    status(report, "discovery.headers")?.status === "pass"
      ? 1
      : status(report, "discovery.headers")?.status === "warn"
        ? 0.5
        : 0,
    status(report, "discovery.headers")?.detail ?? "Not checked.",
  );
  {
    const idx = status(report, "manifest.index");
    if (!idx || idx.status === "skip")
      s.skip("discoverable.index", idx?.detail ?? "No manifest to read an indexUrl from.");
    else s.add("discoverable.index", idx?.status === "pass" ? 1 : 0, idx?.detail ?? "Not checked.");
  }

  if (!m) {
    return finish(url, s, report, [], options, null);
  }

  // Describable
  {
    const bad = m.actions.filter(
      (a) => a.description.trim().length < 40 || a.description.trim().length > 400,
    );
    const mBad = m.description.trim().length < 40 || m.description.trim().length > 400 ? 1 : 0;
    s.add(
      "describable.description-length",
      fraction(m.actions.length + 1 - bad.length - mBad, m.actions.length + 1),
      bad.length || mBad
        ? `Out of range: ${[mBad ? "manifest.description" : "", ...bad.map((a) => `${a.name} (${a.description.trim().length})`)].filter(Boolean).join(", ")}`
        : "All descriptions within 40–400 characters",
    );
    const noEx = m.actions.filter((a) => !a.examples?.length);
    if (m.actions.length === 0) s.skip("describable.examples-present", "No actions.");
    else
      s.add(
        "describable.examples-present",
        fraction(m.actions.length - noEx.length, m.actions.length),
        noEx.length
          ? `Missing examples: ${noEx.map((a) => a.name).join(", ")}`
          : "Every action has examples",
      );
    const exv = status(report, "manifest.examples-validate");
    if (!exv || exv.status === "skip")
      s.skip("describable.examples-validate", exv?.detail ?? "Not checked.");
    else s.add("describable.examples-validate", exv.status === "fail" ? 0 : 1, exv.detail);
    let total = 0;
    let missing = 0;
    const missingBy: string[] = [];
    for (const a of m.actions) {
      const r = inputFieldsWithoutDescription(a);
      total += r.total;
      missing += r.missing.length;
      if (r.missing.length) missingBy.push(`${a.name}: ${r.missing.join(", ")}`);
    }
    if (total === 0) s.skip("describable.input-descriptions", "No input fields.");
    else
      s.add(
        "describable.input-descriptions",
        fraction(total - missing, total),
        missingBy.length
          ? `Undescribed input fields: ${missingBy.join("; ")}`
          : `${total} input fields described`,
      );
    const bare = m.actions.filter((a) => isBareQuerySearch(a.input));
    if (m.actions.length === 0) s.skip("describable.structured-filters", "No actions.");
    else
      s.add(
        "describable.structured-filters",
        bare.length ? 0 : 1,
        bare.length
          ? `Free-text-only search: ${bare.map((a) => a.name).join(", ")}`
          : "No bare query searches",
      );
    const dep = m.actions.filter((a) => a.deprecated);
    const depBad = dep.filter((a) => !a.deprecated!.replacedBy);
    if (dep.length === 0) s.skip("describable.deprecations", "No deprecated actions.");
    else
      s.add(
        "describable.deprecations",
        fraction(dep.length - depBad.length, dep.length),
        depBad.length
          ? `Deprecated without replacement: ${depBad.map((a) => a.name).join(", ")}`
          : "All deprecations name a replacement",
      );
  }

  // Presentable
  {
    const listReads = m.actions.filter(
      (a) =>
        a.readOnly &&
        Object.values(
          (a.output["properties"] ?? {}) as Record<string, Record<string, unknown>>,
        ).some((p) => p && (p["type"] === "array" || p["items"] !== undefined)),
    );
    const withDisplay = listReads.filter((a) => a.display);
    if (listReads.length === 0)
      s.skip("presentable.display-present", "No read actions return lists.");
    else
      s.add(
        "presentable.display-present",
        fraction(withDisplay.length, listReads.length),
        withDisplay.length === listReads.length
          ? `${withDisplay.length} list-returning read actions declare display`
          : `Without display: ${listReads
              .filter((a) => !a.display)
              .map((a) => a.name)
              .join(", ")}`,
      );
    const displayed = m.actions.filter((a) => a.display);
    if (displayed.length === 0) {
      s.skip("presentable.pointers-resolve", "No display declared.");
      s.skip("presentable.url", "No display declared.");
      s.skip("presentable.disclaimer", "No display declared.");
      s.skip("presentable.images-https", "No display declared.");
    } else {
      // Two halves, static and live. A half that did not run earns nothing and is left out,
      // so a skipped round trip cannot contribute the points of a passing one.
      const ptr = status(report, "manifest.display-pointers");
      const live = status(report, "runtime.example-roundtrip");
      const halves = [ptr, live].filter((c) => c && c.status !== "skip");
      const notRun = [
        !ptr || ptr.status === "skip" ? "static pointer check not run" : "",
        !live || live.status === "skip"
          ? `live round trip not run${live ? ` (${live.detail})` : ""}`
          : "",
      ].filter(Boolean);
      if (halves.length === 0)
        s.skip("presentable.pointers-resolve", notRun.join("; ") || "Not checked.");
      else
        s.add(
          "presentable.pointers-resolve",
          halves.filter((c) => c!.status !== "fail").length / halves.length,
          [...halves.map((c) => c!.detail), ...notRun].filter(Boolean).join("; "),
        );
      const noUrl = displayed.filter((a) => a.display!.item && !a.display!.item.url);
      s.add(
        "presentable.url",
        fraction(displayed.length - noUrl.length, displayed.length),
        noUrl.length
          ? `No display.item.url: ${noUrl.map((a) => a.name).join(", ")}`
          : "Every displayed item links to a human page",
      );
      const noDisc = displayed.filter((a) => !a.display!.disclaimer);
      s.add(
        "presentable.disclaimer",
        fraction(displayed.length - noDisc.length, displayed.length),
        noDisc.length
          ? `No disclaimer: ${noDisc.map((a) => a.name).join(", ")}`
          : "Every display has a disclaimer",
      );
      let imgs = 0;
      let badImgs = 0;
      for (const a of displayed) {
        const out = a.examples?.[0]?.output;
        if (out === undefined) continue;
        const presented = resolveDisplay(a, out);
        const arr = a.display!.items ? getPointer(out, a.display!.items) : [out];
        for (const [i, raw] of (Array.isArray(arr) ? arr : [out]).entries()) {
          const d = a.display!.item;
          if (!d?.image) continue;
          const pointers = Array.isArray(d.image) ? d.image : [d.image];
          for (const p of pointers) {
            const v = getPointer(raw, p);
            const list = Array.isArray(v) ? v : v === undefined ? [] : [v];
            for (const u of list) {
              imgs++;
              if (typeof u !== "string" || !/^https:\/\//.test(u)) badImgs++;
            }
          }
          void presented.items[i];
        }
      }
      if (imgs === 0) s.skip("presentable.images-https", "No example images.");
      else
        s.add(
          "presentable.images-https",
          fraction(imgs - badImgs, imgs),
          badImgs
            ? `${badImgs} of ${imgs} example image URLs are not absolute HTTPS`
            : `${imgs} image URLs are absolute HTTPS`,
        );
    }
  }

  // Actionable
  {
    const g = graphConnectivity(m);
    const problems = [
      ...g.orphanTransactions.map(
        (n) => `${n} is not reachable from any read action, affordance, or flow`,
      ),
      ...g.deadEndReads.map((n) => `${n} returns a list but offers no affordances`),
    ];
    const total = m.actions.length;
    if (total === 0) s.skip("actionable.graph-connected", "No actions.");
    else
      s.add(
        "actionable.graph-connected",
        fraction(total - g.orphanTransactions.length - g.deadEndReads.length, total),
        problems.length
          ? problems.join("; ")
          : "Every read leads somewhere and every transaction is reachable",
      );
    const truth = status(report, "manifest.truthful-metadata");
    s.add(
      "actionable.truthful-metadata",
      truth?.status === "pass" ? 1 : 0,
      truth?.detail ?? "Not checked.",
    );
    const idem = status(report, "runtime.idempotency-replay");
    if (idem?.status === "skip") s.skip("actionable.idempotency", idem.detail);
    else
      s.add(
        "actionable.idempotency",
        idem?.status === "pass" ? 1 : 0,
        idem?.detail ?? "Not checked.",
      );
    const avoid = status(report, "ladder.needs-human-avoidable");
    if (!avoid || avoid.status === "skip")
      s.skip("actionable.needs-input-first", avoid?.detail ?? "Ladder not exercised.");
    else s.add("actionable.needs-input-first", avoid.status === "pass" ? 1 : 0, avoid.detail);
    const calls = report.observations.calls;
    if (calls.length === 0) s.skip("actionable.handoff-rate", "No live calls.");
    else {
      const humans = calls.filter((c) => c.status === WIRE.status.needsHuman).length;
      const rate = humans / calls.length;
      s.add(
        "actionable.handoff-rate",
        rate <= 0.25 ? 1 : rate <= 0.5 ? 0.5 : 0,
        `${humans} of ${calls.length} live calls ended in needs_human (${Math.round(rate * 100)}%)`,
      );
    }
    // Live state is optional: sites that publish none are not penalized; sites that do must get it right.
    const liveChecks = report.checks.filter((c) => c.id.startsWith("live.") && c.status !== "skip");
    if (!m.live || liveChecks.length === 0)
      s.skip("actionable.live-state", "The manifest does not advertise live state.");
    else {
      const passed = liveChecks.filter((c) => c.status === "pass").length;
      const failed = liveChecks.filter((c) => c.status === "fail");
      s.add(
        "actionable.live-state",
        fraction(passed, liveChecks.length),
        failed.length
          ? failed.map((c) => `${c.id}: ${c.detail}`).join("; ")
          : `${passed} live-state checks passed`,
      );
    }
  }

  // Trustworthy
  let hardFailure: string | null = null;
  {
    const lint = lintManifest(m);
    const directives = lint.filter((i) => i.rule === "agent-directive");
    const persuasion = lint.filter((i) => i.rule === "persuasion");
    s.add(
      "trustworthy.no-agent-directives",
      directives.length ? 0 : 1,
      directives.length
        ? `Instructions aimed at the agent: ${directives.map((i) => `${i.location} ("${i.excerpt}")`).join("; ")}`
        : "No agent-directed text",
    );
    if (directives.length) hardFailure = "trustworthy.no-agent-directives";
    s.add(
      "trustworthy.no-persuasion",
      persuasion.length === 0 ? 1 : persuasion.length <= 2 ? 0.5 : 0,
      persuasion.length
        ? `Marketing claims: ${persuasion.map((i) => `${i.location} ("${i.excerpt}")`).join("; ")}`
        : "No superlatives or comparative claims",
    );
    const rl = status(report, "runtime.rate-limit-header");
    s.add(
      "trustworthy.rate-limit",
      rl?.status === "pass" ? 1 : m.policies?.rateLimit ? 0.5 : 0,
      rl?.detail ?? "Not checked.",
    );
    s.add(
      "trustworthy.terms",
      m.policies?.termsUrl ? 1 : 0,
      m.policies?.termsUrl
        ? m.policies.termsUrl
        : "Add policies.termsUrl so agent operators know the rules.",
    );
    s.add(
      "trustworthy.contact",
      m.contact?.email || m.contact?.url ? 1 : 0,
      m.contact?.email || m.contact?.url
        ? `${m.contact?.email ?? m.contact?.url}`
        : "Add contact.email or contact.url.",
    );
    if (!m.humanFallbackUrl)
      s.add(
        "trustworthy.human-fallback",
        0,
        "Add humanFallbackUrl: the normal website agents can send users to.",
      );
    else {
      let reachable = false;
      let note = "";
      try {
        const res = await f(m.humanFallbackUrl, {
          method: "GET",
          headers: { Accept: "text/html" },
          redirect: "follow",
        });
        reachable = res.status < 400;
        note = `HTTP ${res.status}`;
      } catch (e) {
        note = (e as Error).message;
      }
      s.add("trustworthy.human-fallback", reachable ? 1 : 0.5, `${m.humanFallbackUrl}: ${note}`);
    }
    s.add(
      "trustworthy.https",
      status(report, "manifest.https")?.status === "pass" ? 1 : 0,
      status(report, "manifest.https")?.detail ?? "",
    );
    const tamper = report.observations.tokenTamperRejected;
    const fakes = status(report, "ladder.fake-kinds");
    // Two halves; only the ones that were exercised count.
    const fakesRan = Boolean(fakes && fakes.status !== "skip");
    const halves = [
      ...(tamper === null ? [] : [tamper]),
      ...(fakesRan ? [fakes!.status !== "fail"] : []),
    ];
    if (halves.length === 0) s.skip("trustworthy.tokens", "Ladder not exercised.");
    else
      s.add(
        "trustworthy.tokens",
        halves.filter(Boolean).length / halves.length,
        [
          tamper === false
            ? "A tampered token was not rejected"
            : tamper
              ? "Tampered tokens rejected"
              : "Token tampering not exercised",
          fakesRan ? fakes!.detail : "Custom kinds not observed",
        ].join("; "),
      );
  }

  // Parity
  const targets = collectParity(m, report);
  if (options.browser) {
    for (const t of targets) {
      t.found = {};
      try {
        const res = await f(t.url, { headers: { Accept: "text/html" } });
        const html = (await res.text()).replace(/\s+/g, " ");
        for (const [k, v] of Object.entries(t.expect))
          t.found[k] = html.includes(v) || html.includes(Number(v).toLocaleString("en-US"));
      } catch {
        for (const k of Object.keys(t.expect)) t.found[k] = false;
      }
    }
  }
  return finish(url, s, report, targets, options, hardFailure);
}

function finish(
  url: string,
  s: Scorer,
  report: ConformanceReport,
  targets: ParityTarget[],
  options: AuditOptions,
  hardFailure: string | null,
): AuditReport {
  const categories: AuditCategory[] = Object.entries(WEIGHTS.categories).map(([id, c]) => {
    const checks = s.checks.filter((k) => k.category === id);
    const scored = checks.filter((k) => k.status !== "skip");
    const totalW = scored.reduce((n, k) => n + k.weight, 0);
    const earnedW = scored.reduce((n, k) => n + k.weight * k.earned, 0);
    // A category where every check skipped earns nothing and is not scored: skipped checks
    // are not passes, so they cannot add a category's maximum to the total.
    const isScored = totalW > 0;
    let score = isScored ? (earnedW / totalW) * c.max : 0;
    if (hardFailure && hardFailure.startsWith(id + ".")) score = 0;
    return {
      id,
      title: c.title,
      max: c.max,
      score: Math.round(score * 10) / 10,
      scored: isScored,
      checks,
    };
  });
  // The total is out of 100 over the categories that were scored. When all are (the usual
  // case, since the category maximums sum to 100), this is the plain sum.
  const scoredMax = categories.filter((c) => c.scored).reduce((n, c) => n + c.max, 0);
  const scale = scoredMax > 0 ? 100 / scoredMax : 0;
  const score = Math.round(
    categories.filter((c) => c.scored).reduce((n, c) => n + c.score, 0) * scale,
  );
  const fixes: AuditFix[] = s.checks
    .filter((k) => k.status === "fail" || k.status === "partial")
    .map((k) => {
      const cat = categories.find((c) => c.id === k.category)!;
      const scoredW = cat.checks
        .filter((x) => x.status !== "skip")
        .reduce((n, x) => n + x.weight, 0);
      const points = scoredW
        ? Math.round(((k.weight * (1 - k.earned)) / scoredW) * cat.max * scale * 10) / 10
        : 0;
      return {
        check: k.id,
        title: k.title,
        category: cat.title,
        points: hardFailure === k.id ? Math.round(cat.max * scale * 10) / 10 : points,
        detail: k.detail,
        docs: k.docs,
      };
    })
    .sort((a, b) => b.points - a.points);
  const parityNote = targets.length
    ? options.browser
      ? "Fetched each URL and looked for the agent-facing values. A miss is a warning to investigate, not proof of cloaking (pages render values in many formats)."
      : "Compare the agent-facing values with the human page at each URL at the same moment. Run with --browser to fetch and diff automatically."
    : "No displayed items with a url to compare.";
  return {
    url,
    score,
    categories,
    fixes,
    parity: { targets, checked: Boolean(options.browser), note: parityNote },
    hardFailure,
    conformance: report,
    generatedAt: new Date().toISOString(),
  };
}
