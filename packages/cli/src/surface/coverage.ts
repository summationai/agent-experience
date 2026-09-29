/**
 * `axe surface coverage <url>`: open the app in headless Chromium, read
 * `window.__surface.coverage()` on each page, and print one Markdown report with the gaps and the
 * config that would close them. Playwright is loaded lazily from the app (or the CLI) so the CLI
 * does not depend on it.
 */
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as WIRE from "@summationai/axe-core/vocabulary";
import type { CommandContext } from "../index";
import { parse, requireUrl } from "../commands/shared";
import { MODULES, NAMES, PAGE_GLOBAL } from "./api";

/** The parts of Playwright this command uses, structurally. */
export interface BrowserPage {
  goto(
    url: string,
    options?: { waitUntil?: "load" | "domcontentloaded" | "networkidle"; timeout?: number },
  ): Promise<unknown>;
  waitForFunction(fn: string, arg?: unknown, options?: { timeout?: number }): Promise<unknown>;
  evaluate<R, A>(fn: (arg: A) => R | Promise<R>, arg: A): Promise<R>;
  url(): string;
  close(): Promise<void>;
}
export interface BrowserContext {
  addCookies(cookies: { name: string; value: string; url: string }[]): Promise<void>;
  newPage(): Promise<BrowserPage>;
}
export interface Browser {
  newContext(options?: { extraHTTPHeaders?: Record<string, string> }): Promise<BrowserContext>;
  close(): Promise<void>;
}
export interface BrowserLauncher {
  launch(options?: { headless?: boolean }): Promise<Browser>;
}

export const PLAYWRIGHT_MISSING =
  "axe surface coverage drives a headless Chromium through Playwright, which is not installed here.\n" +
  "Install it in your app (or globally) and fetch the browser:\n" +
  "  npm install -D playwright && npx playwright install chromium";

/** Resolve and import Playwright from the first base directory that has it. */
export async function loadPlaywright(
  bases: string[],
  names = ["playwright", "playwright-core", "@playwright/test"],
): Promise<BrowserLauncher> {
  for (const base of bases) {
    for (const name of names) {
      let path: string;
      try {
        path = createRequire(join(base, "noop.js")).resolve(name);
      } catch {
        continue;
      }
      const mod = (await import(pathToFileURL(path).href)) as {
        chromium?: BrowserLauncher;
        default?: { chromium?: BrowserLauncher };
      };
      const chromium = mod.chromium ?? mod.default?.chromium;
      if (chromium) return chromium;
    }
  }
  throw new Error(PLAYWRIGHT_MISSING);
}

type Probe =
  | { state: "missing"; attrs: number; href: string }
  | { state: "coverage"; report: unknown; markdown: string | null; attrs: number; href: string }
  | { state: "basic"; report: BasicReport; attrs: number; href: string }
  | { state: "unknown"; keys: string[]; attrs: number; href: string };

export interface BasicReport {
  entries: number;
  byKind: Record<string, number>;
  unnamed: string[];
  unavailableWithoutReason: string[];
  /** Interactive elements with no Surface entry: tag, a selector hint, and their text. */
  unregistered: { selector: string; text: string }[];
  unregisteredTotal: number;
}

/**
 * Runs in the page (serialized by Playwright; no closures). Reads `window.__surface` and falls
 * back to a basic count from `observe()` and the DOM when the page has no `coverage()`.
 */
async function probe(globalName: string): Promise<Probe> {
  const w = window as unknown as Record<string, unknown>;
  const s = w[globalName] as Record<string, unknown> | undefined;
  const attrs = document.querySelectorAll("[data-surface-id]").length;
  const href = location.href;
  if (!s) return { state: "missing", attrs, href };
  if (typeof s["coverage"] === "function") {
    const report = await (s["coverage"] as () => unknown)();
    let markdown: string | null = null;
    if (typeof report === "string") markdown = report;
    else if (typeof s["formatCoverage"] === "function")
      markdown = String((s["formatCoverage"] as (r: unknown) => unknown)(report));
    return {
      state: "coverage",
      report: typeof report === "string" ? null : report,
      markdown,
      attrs,
      href,
    };
  }
  if (typeof s["observe"] === "function") {
    const obs = (await (s["observe"] as () => unknown)()) as { entries?: unknown[] } | undefined;
    const entries = (obs?.entries ?? []) as {
      id: string;
      kind?: string;
      name?: string;
      state?: { available?: boolean; reason?: string };
      available?: boolean;
      reason?: string;
    }[];
    const byKind: Record<string, number> = {};
    for (const e of entries) byKind[e.kind ?? "entry"] = (byKind[e.kind ?? "entry"] ?? 0) + 1;
    const interactive = Array.from(
      document.querySelectorAll(
        "button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=link], [role=checkbox], [role=tab], [role=menuitem], [contenteditable=true]",
      ),
    ).filter((el) => !el.closest("[data-surface-id]"));
    const hint = (el: Element) => {
      const id = el.getAttribute("id");
      if (id) return `#${id}`;
      const testId = el.getAttribute("data-testid");
      if (testId) return `[data-testid=${testId}]`;
      const name = el.getAttribute("name");
      if (name) return `${el.tagName.toLowerCase()}[name=${name}]`;
      return el.tagName.toLowerCase();
    };
    return {
      state: "basic",
      attrs,
      href,
      report: {
        entries: entries.length,
        byKind,
        unnamed: entries.filter((e) => !e.name || !e.name.trim()).map((e) => e.id),
        unavailableWithoutReason: entries
          .filter(
            (e) => (e.state?.available ?? e.available) === false && !(e.state?.reason ?? e.reason),
          )
          .map((e) => e.id),
        unregistered: interactive.slice(0, 25).map((el) => ({
          selector: hint(el),
          text: (el.getAttribute("aria-label") ?? (el as HTMLElement).innerText ?? "")
            .trim()
            .slice(0, 60),
        })),
        unregisteredTotal: interactive.length,
      },
    };
  }
  return { state: "unknown", keys: Object.keys(s), attrs, href };
}

/** In the page: same-origin links, for the bounded crawl. */
function pageLinks(): string[] {
  return Array.from(document.querySelectorAll("a[href]"))
    .map((a) => (a as HTMLAnchorElement).href)
    .filter((h) => h.startsWith(location.origin));
}

export interface PageCoverage {
  url: string;
  /** Where the page ended up (a redirect to a login shows here). */
  finalUrl?: string;
  ok: boolean;
  /** `coverage`: the page's own report; `basic`: counted by the CLI from observe() and the DOM. */
  source?: "coverage" | "basic";
  report?: unknown;
  markdown?: string;
  /** Why there is no report, and what to change. */
  problem?: string;
}

export interface CoverageRun {
  url: string;
  pages: PageCoverage[];
  markdown: string;
}

export interface CoverageOptions {
  routes?: string[];
  /** `Name: value` headers; a `Cookie:` header or a bare `a=b; c=d` becomes cookies. */
  auth?: string[];
  /** Pages visited when following links (default 5, the start page included). */
  maxPages?: number;
  /** How long to wait for `window.__surface` on each page (default 10 s). */
  waitMs?: number;
  /** Injected for tests; default loads Playwright. */
  launcher?: BrowserLauncher;
  /** Where to look for Playwright and `@summationai/axe-surface/auto` (default: cwd, then the CLI). */
  resolveFrom?: string[];
}

export function parseAuth(
  values: string[],
  origin: string,
): {
  headers: Record<string, string>;
  cookies: { name: string; value: string; url: string }[];
} {
  const headers: Record<string, string> = {};
  const cookies: { name: string; value: string; url: string }[] = [];
  const addCookies = (text: string) => {
    for (const part of text.split(";")) {
      const eq = part.indexOf("=");
      if (eq <= 0) continue;
      cookies.push({
        name: part.slice(0, eq).trim(),
        value: part.slice(eq + 1).trim(),
        url: origin,
      });
    }
  };
  for (const v of values) {
    const header = /^([A-Za-z0-9-]+):\s*(.*)$/.exec(v);
    if (header) {
      if (header[1]!.toLowerCase() === "cookie") addCookies(header[2]!);
      else headers[header[1]!] = header[2]!;
    } else if (v.includes("=")) addCookies(v);
    else
      throw new Error(
        `--auth ${v}: pass a header ("Authorization: Bearer <token>") or cookies ("session=<value>").`,
      );
  }
  return { headers, cookies };
}

const LOGOUT = /log-?out|sign-?out|logoff/i;

export function explainMissing(
  p: Extract<Probe, { state: "missing" | "unknown" }>,
  url: string,
  waitMs: number,
): string {
  const redirected =
    p.href && p.href.split("#")[0] !== url.split("#")[0]
      ? ` The page ended at ${p.href}; if that is a login, pass --auth.`
      : "";
  if (p.state === "unknown")
    return `window.${PAGE_GLOBAL} exists but has neither coverage() nor observe() (it has: ${p.keys.join(", ") || "nothing"}). Something other than Surface set it, or an older SDK did.`;
  if (p.attrs > 0)
    return `The page carries Surface attributes (${p.attrs} element(s) with data-surface-id) but no window.${PAGE_GLOBAL}: expose is off. Expose it in development: the AgentSurface that axe surface init writes passes expose={development}; a hand-written setup calls surface.expose(window) in development only.${redirected}`;
  return (
    `No window.${PAGE_GLOBAL} after ${Math.round(waitMs / 1000)} s and no Surface attributes on the page. One of: Surface is not mounted on this page (run ${WIRE.cli.surfaceInit}); an explicitly configured --flag check is false; this is a production build, where the diagnostic global stays hidden; or the app did not finish loading.` +
    redirected
  );
}

/** Tolerant Markdown for a report whose exact shape comes from `@summationai/axe-surface/auto`. */
export function formatReport(report: unknown): string {
  if (report === null || report === undefined) return "_The page returned an empty report._\n";
  if (typeof report !== "object") return `${String(report)}\n`;
  const r = report as Record<string, unknown>;
  const out: string[] = [];
  const counts: string[] = [];
  const summary = (r["summary"] ?? r["counts"] ?? r) as Record<string, unknown>;
  for (const [k, v] of Object.entries(summary)) if (typeof v === "number") counts.push(`${k} ${v}`);
  if (counts.length) out.push(counts.join(" · "), "");
  const gaps = (r["gaps"] ?? r["issues"] ?? r["findings"]) as unknown;
  if (Array.isArray(gaps)) {
    out.push(`Gaps (${gaps.length}):`, "");
    for (const g of gaps) out.push(`- ${gapText(g)}`);
    out.push("");
  }
  const config = r["config"] ?? r["suggestions"] ?? r["suggestedConfig"];
  if (config !== undefined) {
    out.push(
      "Suggested config:",
      "",
      "```ts",
      typeof config === "string" ? config : JSON.stringify(config, null, 2),
      "```",
      "",
    );
  }
  if (!out.length) out.push("```json", JSON.stringify(report, null, 2), "```", "");
  return out.join("\n");
}

function gapText(g: unknown): string {
  if (typeof g === "string") return g;
  if (!g || typeof g !== "object") return String(g);
  const o = g as Record<string, unknown>;
  const where = o["selector"] ?? o["id"] ?? o["target"];
  const kind = o["kind"] ?? o["type"] ?? o["rule"];
  const text = o["message"] ?? o["problem"] ?? o["detail"] ?? o["reason"];
  const fix = o["suggestion"] ?? o["fix"];
  return [
    kind ? `**${String(kind)}**` : "",
    where ? `\`${String(where)}\`` : "",
    text ? String(text) : JSON.stringify(g),
    fix ? `→ ${typeof fix === "string" ? fix : JSON.stringify(fix)}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function formatBasic(r: BasicReport): string {
  const kinds = Object.entries(r.byKind)
    .map(([k, n]) => `${n} ${k}`)
    .join(", ");
  const out = [
    `Basic coverage: window.${PAGE_GLOBAL} has no coverage(), so these counts come from observe() and the DOM. With ${MODULES.auto} mounted, the page reports its own gaps and suggestions.`,
    "",
    `Entries: ${r.entries}${kinds ? ` (${kinds})` : ""}.`,
  ];
  if (r.unnamed.length)
    out.push(`Unnamed entries: ${r.unnamed.map((id) => `\`${id}\``).join(", ")}.`);
  if (r.unavailableWithoutReason.length)
    out.push(
      `Unavailable without a reason: ${r.unavailableWithoutReason.map((id) => `\`${id}\``).join(", ")}.`,
    );
  if (r.unregisteredTotal) {
    out.push(
      "",
      `Interactive elements with no entry: ${r.unregisteredTotal}${r.unregisteredTotal > r.unregistered.length ? ` (first ${r.unregistered.length})` : ""}:`,
      "",
    );
    for (const u of r.unregistered) out.push(`- \`${u.selector}\`${u.text ? ` ${u.text}` : ""}`);
  }
  return out.join("\n") + "\n";
}

/** `formatCoverage` from `@summationai/axe-surface/auto`, when it resolves from one of `bases`. */
async function loadFormatter(bases: string[]): Promise<((r: unknown) => string) | undefined> {
  for (const base of bases) {
    try {
      const path = createRequire(join(base, "noop.js")).resolve(MODULES.auto);
      const mod = (await import(pathToFileURL(path).href)) as Record<string, unknown>;
      const fn = mod[NAMES.formatCoverage];
      // formatCoverage(coverage) returns Markdown; a formatter that throws falls back to the
      // tolerant one below (a page on an older SDK).
      if (typeof fn === "function") return fn as (r: unknown) => string;
    } catch {
      // not installed here
    }
  }
  return undefined;
}

function combine(url: string, pages: PageCoverage[]): string {
  const out = [
    `# Surface coverage`,
    "",
    `${url}: ${pages.length} page(s), ${pages.filter((p) => p.ok).length} with a surface.`,
    "",
  ];
  out.push("| Page | Result |", "| --- | --- |");
  for (const p of pages)
    out.push(
      `| ${new URL(p.url).pathname}${new URL(p.url).search} | ${p.ok ? (p.source === "basic" ? "basic counts (no coverage())" : "report") : "no surface"} |`,
    );
  out.push("");
  for (const p of pages) {
    const u = new URL(p.url);
    out.push(`## ${u.pathname}${u.search}`, "");
    if (p.markdown) out.push(p.markdown.trimEnd(), "");
    else if (p.problem) out.push(`No report. ${p.problem}`, "");
  }
  const gaps = new Map<string, number>();
  for (const p of pages) {
    const r = p.report as Record<string, unknown> | undefined;
    const list =
      r && typeof r === "object" ? (r["gaps"] ?? r["issues"] ?? r["findings"]) : undefined;
    if (Array.isArray(list))
      for (const g of list) gaps.set(gapText(g), (gaps.get(gapText(g)) ?? 0) + 1);
  }
  if (gaps.size) {
    out.push("## Top gaps across pages", "");
    for (const [text, n] of [...gaps].sort((a, b) => b[1] - a[1]).slice(0, 15))
      out.push(`- ${text}${n > 1 ? ` (${n} pages)` : ""}`);
    out.push("");
  }
  out.push(
    "## Next",
    "",
    "Close the gaps in surface.config: name every control by its outcome, give every disabled control the app's own reason, mark destructive actions for approval and fields that hold private data as sensitive, then run this again.",
    "",
  );
  return out.join("\n");
}

export async function runCoverage(url: string, o: CoverageOptions = {}): Promise<CoverageRun> {
  const cliDir = dirname(fileURLToPath(import.meta.url));
  const bases = o.resolveFrom ?? [process.cwd(), cliDir];
  const launcher = o.launcher ?? (await loadPlaywright(bases));
  const waitMs = o.waitMs ?? 10_000;
  const origin = new URL(url).origin;
  const { headers, cookies } = parseAuth(o.auth ?? [], origin);
  const formatter = await loadFormatter(bases);
  const browser = await launcher.launch({ headless: true });
  const pages: PageCoverage[] = [];
  try {
    const context = await browser.newContext(
      Object.keys(headers).length ? { extraHTTPHeaders: headers } : {},
    );
    if (cookies.length) await context.addCookies(cookies);
    const queue = o.routes?.length ? o.routes.map((r) => new URL(r, url).toString()) : [url];
    const crawl = !o.routes?.length;
    const max = o.maxPages ?? 5;
    const seen = new Set(queue.map((q) => q.split("#")[0]!));
    while (queue.length && (!crawl || pages.length < max)) {
      const target = queue.shift()!;
      const page = await context.newPage();
      const result: PageCoverage = { url: target, ok: false };
      try {
        await page.goto(target, { waitUntil: "load", timeout: 30_000 });
        await page
          .waitForFunction(
            `typeof window[${JSON.stringify(PAGE_GLOBAL)}] !== "undefined"`,
            undefined,
            { timeout: waitMs },
          )
          .catch(() => undefined);
        const p = await page.evaluate(probe, PAGE_GLOBAL);
        if (p.href !== target) result.finalUrl = p.href;
        if (p.state === "coverage") {
          result.ok = true;
          result.source = "coverage";
          result.report = p.report;
          let md = p.markdown;
          if (md === null && formatter) {
            try {
              md = formatter(p.report);
            } catch {
              md = null;
            }
          }
          result.markdown = md ?? formatReport(p.report);
        } else if (p.state === "basic") {
          result.ok = true;
          result.source = "basic";
          result.report = p.report;
          result.markdown = formatBasic(p.report);
        } else result.problem = explainMissing(p, target, waitMs);
        if (crawl) {
          for (const link of await page.evaluate(pageLinks, undefined)) {
            const clean = link.split("#")[0]!;
            if (!seen.has(clean) && !LOGOUT.test(clean) && seen.size < max) {
              seen.add(clean);
              queue.push(clean);
            }
          }
        }
      } catch (e) {
        result.problem = `Could not load the page: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}. Is the app running at ${origin}?`;
      } finally {
        await page.close().catch(() => undefined);
      }
      pages.push(result);
    }
  } finally {
    await browser.close();
  }
  return { url, pages, markdown: combine(url, pages) };
}

export async function surfaceCoverage(ctx: CommandContext): Promise<number> {
  const { values, positionals } = parse(ctx.args, {
    auth: { type: "string", multiple: true },
    routes: { type: "string" },
    json: { type: "boolean" },
    out: { type: "string" },
    "max-pages": { type: "string" },
    wait: { type: "string" },
    "playwright-from": { type: "string" },
  });
  const url = requireUrl(positionals[0], `${WIRE.cli.surfaceCoverage} <url>`);
  const o: CoverageOptions = {};
  if (values.auth) o.auth = values.auth.map(String);
  if (values.routes)
    o.routes = String(values.routes)
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);
  if (values["max-pages"] !== undefined) o.maxPages = Math.max(1, Number(values["max-pages"]) || 5);
  if (values.wait !== undefined) o.waitMs = Math.max(0, Number(values.wait) || 0);
  if (values["playwright-from"] !== undefined) {
    const cliDir = dirname(fileURLToPath(import.meta.url));
    o.resolveFrom = [resolve(String(values["playwright-from"])), process.cwd(), cliDir];
  }
  let run: CoverageRun;
  try {
    run = await runCoverage(url, o);
  } catch (e) {
    if (e instanceof Error && e.message === PLAYWRIGHT_MISSING) {
      ctx.stderr(PLAYWRIGHT_MISSING);
      return 1;
    }
    throw e;
  }
  const text = values.json
    ? JSON.stringify({ url: run.url, pages: run.pages }, null, 2)
    : run.markdown;
  ctx.stdout(text);
  if (values.out) {
    const out = resolve(String(values.out));
    writeFileSync(out, text + "\n");
    ctx.stderr(`Wrote ${out}`);
  }
  if (!run.pages.some((p) => p.ok)) {
    ctx.stderr(`No page had a surface. ${run.pages[0]?.problem ?? ""}`.trim());
    return 1;
  }
  return 0;
}
