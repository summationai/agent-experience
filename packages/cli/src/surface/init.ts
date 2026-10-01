/**
 * `axe surface init`: add Surface to an existing application with the smallest correct diff.
 *
 * It detects the framework and the root file, writes a surface component (or a plain setup
 * module) and a starter config beside the root, and wraps the root in one import and one element.
 * It prints the diff, applies it with --yes or after a prompt, and on later runs applies only
 * known safe migrations to files it generated, preserving application-specific edits.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";
import { createInterface } from "node:readline/promises";
import * as WIRE from "@summationai/axe-core/vocabulary";
import type { CommandContext } from "../index";
import { parse } from "../commands/shared";
import { DEV_RELAY_URL, PACKAGES, REGISTRY_NPMRC } from "./api";
import { detect, FRAMEWORKS } from "./detect";
import type { Detection, Framework, PackageManager } from "./detect";
import {
  AGENT_ENTRY_MODULE,
  addAgentEntryToRootLoader,
  addConfigRoute,
  nextAgentEntryFile,
} from "./agent-web-edits";
import type { Edit } from "./agent-web-edits";
import { unifiedDiff } from "./diff";
import { detectStyle, find, insertImport, matchParen, wrapRange } from "./edit";
import type { Style } from "./edit";
import {
  agentSiteFile,
  configFile,
  defaultFlagName,
  MARKER,
  nextAgentRoute,
  reactRouterAgentRoute,
  plainSurfaceFile,
  reactSurfaceFile,
  styled,
  WRAPPER,
} from "./templates";
import type { FlagSpec, TemplateOptions } from "./templates";

export interface InitOptions {
  dir: string;
  framework?: Framework;
  flag?: string;
  /** A hook or function call that returns the flag, e.g. `useFeatureFlag("ui_axe_surface")`. */
  flagHook?: string;
  /** The module `flagHook`'s function is imported from. */
  flagImport?: string;
  /** The file to mount in, relative to `dir` (default: the framework root). */
  mount?: string;
  /** Include the relay/service or injected-host adapter for an agent outside the browser. */
  remote?: boolean;
  /** Stable id and human name shared with the provider connector. */
  appId?: string;
  appName?: string;
  relay?: string;
  /** Directory holding the packed tarballs, for the install form that needs no registry access. */
  vendor?: string;
  /**
   * Also serve agents that have nothing installed, through the agent web (docs/agent-web.md): domain
   * tools on the page, the site's agent pages in `agent-site.server`, and the `/agent` route.
   */
  agentWeb?: boolean;
}

export interface FileChange {
  /** Absolute path. */
  path: string;
  /** Path relative to the app directory, forward slashes. */
  display: string;
  before?: string;
  after: string;
}

export interface InitPlan {
  detection: Detection;
  /** The file the wrapper goes into (absolute). */
  mountFile: string;
  changes: FileChange[];
  /** Files already in place and left alone (with why). */
  kept: string[];
  /** Steps init could not do itself. */
  manual: string[];
  diff: string;
}

const posix = (p: string) => p.split(sep).join("/");

export function parseFlag(
  value: string | undefined,
  framework: Framework,
  hook: { call?: string; from?: string } = {},
): FlagSpec {
  if (hook.call !== undefined || hook.from !== undefined) {
    if (value !== undefined) throw new Error("Pass --flag or --flag-hook, not both.");
    if (!hook.call || !hook.from)
      throw new Error(
        "--flag-hook and --flag-import go together: the call, and the module its function comes from.",
      );
    const m = /^\s*([A-Za-z_$][\w$]*)\s*\([^]*\)\s*$/.exec(hook.call);
    if (!m)
      throw new Error(
        `--flag-hook ${hook.call}: expected a call, like useFeatureFlag("ui_axe_surface").`,
      );
    return { kind: "call", call: hook.call.trim(), name: m[1]!, module: hook.from };
  }
  if (value === undefined) return { kind: "default" };
  const hash = value.lastIndexOf("#");
  if (hash > 0 && hash < value.length - 1) {
    const name = value.slice(hash + 1);
    if (!/^[A-Za-z_$][\w$]*$/.test(name))
      throw new Error(`--flag ${value}: "${name}" is not an export name.`);
    return { kind: "call", module: value.slice(0, hash), name, call: `${name}()` };
  }
  if (/^[A-Z][A-Z0-9_]*$/.test(value)) {
    const prefix = defaultFlagName(framework)?.replace(/SURFACE$/, "");
    if (!prefix)
      throw new Error(
        `--flag ${value}: a ${framework} app has no build-time environment; name a check instead, as <module>#<export>.`,
      );
    if (!value.startsWith(prefix))
      throw new Error(
        `--flag ${value}: ${framework} exposes only ${prefix}* variables to the browser; use ${prefix}${value}.`,
      );
    return { kind: "env", name: value };
  }
  throw new Error(
    `--flag takes an environment variable (${defaultFlagName(framework) ?? "VITE_SURFACE"}) or a check to call, as <module>#<export> (for example ~/flags#useAgentSurface).`,
  );
}

/** A file name beside the root that is free or already ours. */
function ownName(outDir: string, stem: string, ext: string): string {
  for (const candidate of [stem, `agent-${stem}`, `axe-${stem}`]) {
    const path = join(outDir, `${candidate}.${ext}`);
    if (!existsSync(path) || readFileSync(path, "utf8").includes(MARKER)) return path;
  }
  throw new Error(
    `${join(outDir, `${stem}.${ext}`)} and its alternatives exist and are not init's.`,
  );
}

function importSpecifier(fromFile: string, toFile: string): string {
  let rel = posix(relative(dirname(fromFile), toFile)).replace(/\.(tsx|ts|jsx|js)$/, "");
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return rel;
}

/** Narrow, source-preserving upgrades for files carrying init's marker. */
function migrateGeneratedFile(text: string): string {
  return text.replaceAll(
    "return () => connection.stop();",
    "return () => connection.disconnect();",
  );
}

/**
 * The mount edit in a React file, chosen by what the file renders: the element passed to
 * `render()` in an entry, else `<Outlet />` in the default export (a React Router root or layout
 * route), else `{children}` (inside `<body>` when there is one: a Next layout).
 */
function editReactMount(
  d: Detection,
  mountFile: string,
  text: string,
  surfaceFile: string,
): { after: string } | { manual: string } {
  const style = detectStyle(text);
  const spec = importSpecifier(mountFile, surfaceFile);
  const already = new RegExp(`import\\s*\\{[^}]*\\b${WRAPPER}\\b[^}]*\\}\\s*from`).test(text);
  if (already) return { after: text };
  const name = posix(relative(d.dir, mountFile));
  let target: { start: number; end: number } | undefined;
  let inline = false;
  const call = text.search(/\.render\s*\(/);
  const from = text.search(/export\s+default\b/);
  if (call >= 0) {
    const open = text.indexOf("(", call);
    const close = matchParen(text, open);
    const arg = find(text, /<([A-Z][\w.]*)\b[^<>]*\/>/, open);
    if (arg && close > 0 && arg.end <= close) target = arg;
  } else if (from >= 0) {
    target = find(text, /<Outlet\b[^<>]*\/>/, from);
    if (!target) {
      const body = text.indexOf("<body", from);
      target = find(text, /\{\s*children\s*\}/, body >= 0 ? body : from);
      // `{children}` stays on its line, as a formatter writes a wrapper around one expression.
      inline = true;
    }
  }
  if (!target) {
    const what =
      call >= 0
        ? `a JSX element passed to render() in ${name}`
        : `<Outlet /> or {children} in the default export of ${name}`;
    return {
      manual: `Wrap your app root in <${WRAPPER}> from "${spec}" by hand: init could not find ${what}.`,
    };
  }
  const semi = style.semi ? ";" : "";
  const q = style.quote;
  let after = wrapRange(text, target.start, target.end, WRAPPER, style, inline);
  after = insertImport(after, `import { ${WRAPPER} } from ${q}${spec}${q}${semi}`);
  return { after };
}

function editHtml(
  d: Detection,
  text: string,
  surfaceFile: string,
): { after: string } | { manual: string } {
  const src = `./${posix(relative(dirname(d.rootFile), surfaceFile))}`;
  if (text.includes(src) || text.includes(basename(surfaceFile) + '"')) return { after: text };
  const close = text.search(/^[ \t]*<\/body>/im);
  if (close < 0)
    return {
      manual: `Add <script type="module" src="${src}"></script> to your page by hand: ${relative(d.dir, d.rootFile)} has no </body>.`,
    };
  const indent = /^[ \t]*/.exec(text.slice(close))![0];
  const unit = detectStyle(text).unit;
  const tag = `${indent}${unit}<script type="module" src="${src}"></script>\n`;
  return { after: text.slice(0, close) + tag + text.slice(close) };
}

export function planInit(o: InitOptions): InitPlan {
  const d = detect(o.dir, o.framework);
  const hook: { call?: string; from?: string } = {};
  if (o.flagHook !== undefined) hook.call = o.flagHook;
  if (o.flagImport !== undefined) hook.from = o.flagImport;
  const flag = parseFlag(o.flag, d.framework, hook);
  const mountFile = o.mount ? join(d.dir, o.mount) : d.rootFile;
  if (!existsSync(mountFile)) throw new Error(`--mount ${o.mount}: no such file in ${d.dir}.`);
  const rootText = readFileSync(mountFile, "utf8");
  const style =
    d.framework === "plain"
      ? { quote: '"' as const, semi: true, unit: "  " }
      : detectStyle(rootText);
  const inferredAppId = (d.packageName ?? "application")
    .replace(/^@[^/]+\//, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "");
  const appId = (o.appId ?? inferredAppId) || "application";
  if (!/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(appId) || appId.length > 80)
    throw new Error(
      "--app-id must be at most 80 lowercase letters, digits, dots, underscores, or hyphens.",
    );
  const appName = o.appName ?? d.packageName?.replace(/^@[^/]+\//, "") ?? "Application";
  if (!appName.trim() || appName.length > 120)
    throw new Error("--app-name must be between 1 and 120 characters.");
  const t: TemplateOptions = {
    framework: d.framework,
    typescript: d.typescript,
    style,
    flag,
    remote: o.remote !== false,
    appId,
    appName,
    ...(o.agentWeb ? { agentWeb: true } : {}),
  };
  if (o.relay !== undefined) t.relay = o.relay;
  const plain = d.framework === "plain";
  const surfaceExt = plain ? "js" : d.typescript ? "tsx" : "jsx";
  const configExt = d.typescript ? "ts" : "js";
  const surfacePath = ownName(d.outDir, "surface", surfaceExt);
  const configPath = join(d.outDir, `surface.config.${configExt}`);
  const surfaceText = plain ? plainSurfaceFile(t) : reactSurfaceFile(t);

  const changes: FileChange[] = [];
  const kept: string[] = [];
  const manual: string[] = [];
  const show = (p: string) => posix(relative(d.dir, p));

  const addFile = (path: string, content: string) => {
    if (!existsSync(path)) changes.push({ path, display: show(path), after: content });
    else {
      const before = readFileSync(path, "utf8");
      if (before === content) return;
      const generated = before.includes(MARKER);
      const after = generated ? migrateGeneratedFile(before) : before;
      if (after !== before) changes.push({ path, display: show(path), before, after });
      if (after !== content)
        kept.push(
          `${show(path)} exists; left as is${generated ? " except for safe generated-code upgrades (edited, or written with other options: delete it and re-run to regenerate)" : ""}.`,
        );
    }
  };
  addFile(surfacePath, surfaceText);
  addFile(configPath, configFile(t));
  const edit = plain
    ? editHtml(d, rootText, surfacePath)
    : editReactMount(d, mountFile, rootText, surfacePath);
  if ("manual" in edit) manual.push(edit.manual);
  else if (edit.after !== rootText)
    changes.push({
      path: mountFile,
      display: show(mountFile),
      before: rootText,
      after: edit.after,
    });

  // Edit a file in place, after any change already planned for it (the root's mount edit).
  const editFile = (path: string, fn: (text: string) => Edit): void => {
    const planned = changes.find((c) => c.path === path);
    const text = planned ? planned.after : existsSync(path) ? readFileSync(path, "utf8") : null;
    if (text === null) return;
    const r = fn(text);
    if (typeof r !== "string") manual.push(`--agent-web: in ${show(path)}, ${r.manual}`);
    else if (r !== text) {
      if (planned) planned.after = r;
      else changes.push({ path, display: show(path), before: text, after: r });
    }
  };
  if (o.agentWeb) planAgentWeb(d, style, addFile, editFile, manual, show);

  // Root edit first in the diff: it is the one a reviewer reads.
  changes.sort((a, b) => Number(b.before !== undefined) - Number(a.before !== undefined));
  const diff = changes.map((c) => unifiedDiff(c.display, c.before, c.after)).join("");
  return { detection: d, mountFile, changes, kept, manual, diff };
}

/**
 * The agent web's site side: `agent-site.server` beside the Surface module, and the `/agent` route
 * in the application's own routing convention, or a manual step when init cannot tell it.
 */
function planAgentWeb(
  d: Detection,
  style: Style,
  addFile: (path: string, content: string) => void,
  editFile: (path: string, fn: (text: string) => Edit) => void,
  manual: string[],
  show: (p: string) => string,
): void {
  if (d.framework !== "next" && d.framework !== "react-router") {
    manual.push(
      "--agent-web needs a server route for /agent and /agent/*: this application has no server init recognizes (Next.js or React Router). Mount agentSiteHandler from @summationai/axe-core/agent-site on your server (docs/agent-web.md).",
    );
    return;
  }
  const ext = d.typescript ? "ts" : "js";
  const sitePath = join(d.outDir, `agent-site.server.${ext}`);
  addFile(sitePath, agentSiteFile({ typescript: d.typescript, style }));
  const importFrom = (routeFile: string) =>
    importSpecifier(routeFile, sitePath).replace(/\.(t|j)sx?$/, "");
  if (d.framework === "next") {
    const route = join(d.outDir, "agent", "[[...path]]", `route.${ext}`);
    addFile(
      route,
      nextAgentRoute({ importPath: importFrom(route), typescript: d.typescript, style }),
    );
    // agentEntry in the entry file every page request passes: proxy.ts from Next.js 16, else
    // middleware.ts, beside the app directory. An existing one is the application's to edit.
    const base = dirname(d.outDir);
    const existing = ["proxy", "middleware"]
      .flatMap((n) => ["ts", "js", "mjs"].map((e) => join(base, `${n}.${e}`)))
      .find(existsSync);
    if (existing) {
      if (!readFileSync(existing, "utf8").includes("agentEntry("))
        manual.push(
          `--agent-web: in ${show(existing)}, return agentEntry(request) from ${AGENT_ENTRY_MODULE} when it is not null, before the rest of it runs (it sends an agent that opens the site from outside on to /agent).`,
        );
    } else {
      const proxy = nextMajor(d.dir) >= 16;
      addFile(
        join(base, `${proxy ? "proxy" : "middleware"}.${ext}`),
        styled(nextAgentEntryFile({ typescript: d.typescript, proxy }), style),
      );
    }
    return;
  }
  // The root loader sends agents on, unless the app has no server (SPA mode).
  const rrConfig = ["react-router.config.ts", "react-router.config.js"]
    .map((f) => join(d.dir, f))
    .find(existsSync);
  if (rrConfig && /\bssr\s*:\s*false\b/.test(readFileSync(rrConfig, "utf8")))
    manual.push(
      "--agent-web: this React Router app has no server (ssr: false), so the agent web's pages and agentEntry need a server of their own (docs/agent-web.md).",
    );
  else
    editFile(d.rootFile, (text) =>
      addAgentEntryToRootLoader(text, {
        typescript: d.typescript,
        quote: style.quote,
        semi: style.semi,
      }),
    );
  // React Router: the route file's name follows the application's route convention.
  const routesConfig = ["routes.ts", "routes.js"].map((f) => join(d.outDir, f)).find(existsSync);
  const config = routesConfig ? readFileSync(routesConfig, "utf8") : "";
  const routeExt = d.typescript ? "tsx" : "jsx";
  const route = /remix-flat-routes/.test(config)
    ? join(d.outDir, "routes", "agent+", `$.${routeExt}`)
    : /flatRoutes\(/.test(config) && /@react-router\/fs-routes/.test(config)
      ? join(d.outDir, "routes", `agent.$.${routeExt}`)
      : null;
  if (route) {
    addFile(
      route,
      reactRouterAgentRoute({ importPath: importFrom(route), typescript: d.typescript, style }),
    );
    return;
  }
  // A route config that lists its routes (`export default [ ... ]`): add the route and its file.
  if (routesConfig && /export\s+default\s+\[/.test(config)) {
    const file = join(d.outDir, "routes", `agent.$.${routeExt}`);
    addFile(
      file,
      reactRouterAgentRoute({ importPath: importFrom(file), typescript: d.typescript, style }),
    );
    editFile(routesConfig, (text) =>
      addConfigRoute(text, posix(relative(d.outDir, file)), style.quote),
    );
    return;
  }
  const example = reactRouterAgentRoute({
    importPath: `./${posix(relative(d.outDir, sitePath)).replace(/\.(t|j)s$/, "")}`,
    typescript: d.typescript,
    style,
  });
  manual.push(
    `--agent-web: add a resource route for /agent and /agent/* (a splat route, "agent/*") whose loader and action answer with agentSite from ${show(sitePath)}, for example:\n${example}`,
  );
}

export function applyPlan(plan: InitPlan): void {
  for (const c of plan.changes) {
    mkdirSync(dirname(c.path), { recursive: true });
    writeFileSync(c.path, c.after);
  }
}

function addCommand(pm: PackageManager): string {
  return pm === "npm"
    ? "npm install"
    : pm === "yarn-berry"
      ? "yarn add"
      : `${pm === "yarn" ? "yarn" : pm} add`;
}

/** Tarball file names in a vendor directory, by package (from `scripts/pack-for-consumer.sh`). */
function tarballs(vendorAbs: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  const names = vendorAbs && existsSync(vendorAbs) ? readdirSync(vendorAbs) : [];
  for (const pkg of ["core", "surface", "relay"]) {
    out[pkg] =
      names.find((n) => n.startsWith(`summationai-axe-${pkg}-`) && n.endsWith(".tgz")) ??
      `summationai-axe-${pkg}-1.0.0.tgz`;
  }
  return out;
}

/** Merge `entry` into a package.json (for --install with --vendor); returns whether it changed. */
export function writeOverrides(
  appDir: string,
  entry: NonNullable<InstallCommand["overrides"]>,
): boolean {
  const path = join(appDir, entry.file);
  const pkg = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  const keys = entry.key.split(".");
  let node = pkg;
  for (const k of keys.slice(0, -1)) node = (node[k] ??= {}) as Record<string, unknown>;
  const last = keys[keys.length - 1]!;
  const current = (node[last] ?? {}) as Record<string, string>;
  const merged = { ...current, ...entry.value };
  if (JSON.stringify(merged) === JSON.stringify(current)) return false;
  node[last] = merged;
  const indent = /^(\s+)"/m.exec(readFileSync(path, "utf8"))?.[1] ?? "  ";
  writeFileSync(path, JSON.stringify(pkg, null, indent) + "\n");
  return true;
}

export interface InstallCommand {
  /** The command to run in `cwd`. */
  argv: string[];
  cwd: string;
  /** The package.json entry the tarball form also needs (overrides or resolutions), if any. */
  overrides?: { file: string; key: string; value: Record<string, string> };
}

/** The exact install command: registry form, or `file:` tarballs when `vendor` is given. */
export function installCommand(
  d: Detection,
  withRelay: boolean,
  vendor?: string,
  /** The site's agent pages import @summationai/axe-core directly (--agent-web). */
  withCore = false,
): InstallCommand {
  const [bin, ...sub] = addCommand(d.packageManager).split(" ");
  const pkgs = [
    ...(withCore ? [PACKAGES.core] : []),
    PACKAGES.surface,
    ...(withRelay ? [PACKAGES.relay] : []),
  ];
  if (!vendor) return { argv: [bin!, ...sub, ...pkgs], cwd: d.dir };
  const vendorAbs = join(d.dir, vendor);
  const files = tarballs(vendorAbs);
  const yarn = d.packageManager === "yarn" || d.packageManager === "yarn-berry";
  // Yarn reads `file:` descriptors relative to the manifest; `./` keeps them unambiguous.
  const fileSpec = (from: string, pkg: string) => {
    const r = posix(relative(from, join(vendorAbs, files[pkg]!)));
    return `file:${yarn && !r.startsWith(".") ? `./${r}` : r}`;
  };
  const rel = (pkg: string) => fileSpec(d.dir, pkg);
  const spec = (name: string, pkg: string) => `${name}@${rel(pkg)}`;
  const argv = [
    bin!,
    ...sub,
    spec(PACKAGES.core, "core"),
    spec(PACKAGES.surface, "surface"),
    ...(withRelay ? [spec(PACKAGES.relay, "relay")] : []),
  ];
  // Packing rewrites workspace:* to the version, so each sibling a tarball depends on is pointed
  // back at its tarball. Yarn (Berry included) honours only the workspace root's resolutions.
  const base = yarn ? d.workspaceRoot : d.dir;
  const value: Record<string, string> = { [PACKAGES.core]: fileSpec(base, "core") };
  if (withRelay) value[PACKAGES.surface] = fileSpec(base, "surface");
  return {
    argv,
    cwd: d.dir,
    overrides: {
      file: posix(relative(d.dir, join(base, "package.json"))) || "package.json",
      key: yarn ? "resolutions" : d.packageManager === "pnpm" ? "pnpm.overrides" : "overrides",
      value,
    },
  };
}

const quoteArg = (a: string) => (/^[\w@./:=+-]+$/.test(a) ? a : `'${a}'`);

/** Whether the app's package.json already depends on every one of `names`. */
function declares(dir: string, names: string[]): boolean {
  try {
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as Record<
      string,
      Record<string, string> | undefined
    >;
    return names.every((n) => pkg["dependencies"]?.[n] ?? pkg["devDependencies"]?.[n]);
  } catch {
    return false;
  }
}

export interface AgentWebEnv {
  /** The env file, relative to the app directory, or null when there is none init may write. */
  file: string | null;
  /** The variables added (names only). */
  added: string[];
  /** Why nothing was written, when it was not. */
  reason?: string;
}

/**
 * Give the app's server the agent web's settings: append AXE_AGENT_WEB_SECRET (generated) and
 * AXE_AGENT_WEB_URL to the first of `.env` and `.env.local` that exists and that git ignores,
 * when they are missing. A file git does not ignore is never written: the secret must not be
 * committed. Nothing is printed but the names.
 */
export function ensureAgentWebEnv(dir: string, write: boolean): AgentWebEnv {
  const ignored = (file: string) =>
    spawnSync("git", ["check-ignore", "-q", file], { cwd: dir }).status === 0;
  const candidates = [".env", ".env.local"].filter((f) => existsSync(join(dir, f)));
  if (candidates.length === 0)
    return { file: null, added: [], reason: "no .env or .env.local in the app directory" };
  const file = candidates.find(ignored);
  if (!file)
    return {
      file: null,
      added: [],
      reason: `${candidates.join(" and ")} ${candidates.length > 1 ? "are" : "is"} not ignored by git, and the secret must not be committed`,
    };
  const path = join(dir, file);
  const text = readFileSync(path, "utf8");
  const has = (k: string) => new RegExp(`^\\s*${k}=`, "m").test(text);
  const lines: string[] = [];
  if (!has("AXE_AGENT_WEB_SECRET"))
    lines.push(`AXE_AGENT_WEB_SECRET=${randomBytes(36).toString("base64url")}`);
  if (!has("AXE_AGENT_WEB_URL")) lines.push("AXE_AGENT_WEB_URL=http://127.0.0.1:4719");
  if (lines.length && write) {
    // A file without a final newline would join the first line onto its last.
    const sep = text.length && !text.endsWith("\n") ? "\n" : "";
    writeFileSync(
      path,
      `${text}${sep}# The agent web (axe surface init --agent-web)\n${lines.join("\n")}\n`,
    );
  }
  return { file, added: lines.map((l) => l.slice(0, l.indexOf("="))) };
}

/** The major version of Next.js the app depends on (0 when it cannot tell). */
function nextMajor(dir: string): number {
  try {
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const v = pkg.dependencies?.["next"] ?? pkg.devDependencies?.["next"] ?? "";
    return Number(/(\d+)/.exec(v)?.[1] ?? 0);
  } catch {
    return 0;
  }
}

/** The port the app's own `dev` script names (`--port 5174`, `-p 3001`), if any. */
export function devScriptPort(dir: string): string | undefined {
  try {
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    return /(?:--port[= ]|-p )(\d{2,5})\b/.exec(pkg.scripts?.["dev"] ?? "")?.[1];
  } catch {
    return undefined;
  }
}

function nextSteps(
  plan: InitPlan,
  o: InitOptions,
  installed: boolean,
  env?: AgentWebEnv,
): string[] {
  const d = plan.detection;
  const remote = o.remote !== false;
  const registry = installCommand(d, remote, undefined, o.agentWeb === true);
  const tar = installCommand(d, remote, o.vendor ?? "vendor", o.agentWeb === true);
  const port = devScriptPort(d.dir);
  const devUrl = port
    ? `http://localhost:${port}`
    : d.framework === "next"
      ? "http://localhost:3000"
      : d.framework === "react-router" || d.framework === "vite-react"
        ? "http://localhost:5173"
        : "<your dev URL>";
  const config = posix(
    relative(d.dir, join(d.outDir, `surface.config.${d.typescript ? "ts" : "js"}`)),
  );
  const steps: { text: string; more?: string[] }[] = [];
  const required = [PACKAGES.surface, ...(remote ? [PACKAGES.relay] : [])];
  if (!installed && !declares(d.dir, required))
    steps.push({
      text: "Install (nothing was added to package.json; --install runs it):",
      more: [
        registry.argv.map(quoteArg).join(" "),
        `The packages are in the summationai GitHub Packages registry, not npmjs. An .npmrc beside package.json maps the scope: ${REGISTRY_NPMRC.join(" and ")}; locally, gh auth refresh -s read:packages && export NODE_AUTH_TOKEN=$(gh auth token).`,
        "Without registry access, pack the SDK from a checkout and install the tarballs:",
        `<sdk-checkout>/scripts/pack-for-consumer.sh ${o.vendor ?? "vendor"} core surface${remote ? " relay" : ""}`,
        tar.argv.map(quoteArg).join(" "),
        `and in ${tar.overrides!.file}: "${tar.overrides!.key}": ${JSON.stringify(tar.overrides!.value)}`,
        "Commit the tarballs, their SOURCE pin, and the lockfile together; a Dockerfile or CI job that installs from the lockfile copies the vendor directory in before the install step.",
      ],
    });
  steps.push(
    {
      text: `Run the app in development (${devUrl}). Surface registers with a browser-native agent when WebMCP is available${
        o.flagHook
          ? `, when ${o.flagHook} is true`
          : o.flag !== undefined
            ? `, when ${o.flag} is on`
            : ", in every environment"
      }.`,
    },
    ...(remote
      ? [
          {
            text: `Wire profile.authentication.state in ${config} to the app's existing auth/session source (unknown while resolving, signed-out on login, signed-in afterward). The provider supplies the private browser and secure sign-in handoff; this application needs no auth route, token endpoint, session broker, or MCP server. For an optional pre-authenticated local fixture:`,
            more: [
              `npx @summationai/${WIRE.cli.host} login ${devUrl}`,
              `npx @summationai/${WIRE.cli.host} --dev --stdio --app ${devUrl}`,
            ],
          },
        ]
      : [
          {
            text: "Open the app in an agent browser that implements WebMCP and delivers Site tools to the task. For desktop MCP agents, re-run with --relay-dev to connect the page to the separately operated local service.",
          },
        ]),
    {
      text: `See what an agent sees: npx @summationai/${WIRE.cli.surfaceCoverage} ${devUrl} [--routes /a,/b]`,
    },
    {
      text: `Write config for the top gaps in ${config}. The prompt that walks an agent through it: npx @summationai/${WIRE.cli.surface} prompt`,
    },
    {
      text: !remote
        ? "This browser-only installation exposes WebMCP. Re-run without --browser-only to accept a provider-injected host connection too."
        : o.relay === DEV_RELAY_URL
          ? "Start the company-side local service from the SDK checkout with pnpm mcp:dev, connect the desktop agent to http://127.0.0.1:4717/mcp, then pair it with the code the tab shows."
          : o.relay !== undefined
            ? "The person's own tab connects to the company-side service; its authenticated deployment supplies the short-lived tab token."
            : "The provider-injected connection needs no application token endpoint or pairing. Use --relay-dev only when deliberately testing the older attended-tab flow.",
    },
  );
  if (o.agentWeb)
    steps.push(
      {
        text: "Agent web: fill in identify and session in agent-site.server from this application's own sign-in (the prompt says how).",
        more: env?.file
          ? [
              `${env.file} has AXE_AGENT_WEB_SECRET and AXE_AGENT_WEB_URL for the application's server${env.added.length ? " (added now)" : ""}.`,
            ]
          : [
              `Set, for the application's server${env?.reason ? ` (not written: ${env.reason})` : ""}:`,
              "AXE_AGENT_WEB_SECRET=<32+ random characters, shared with the agent web service>",
              "AXE_AGENT_WEB_URL=http://127.0.0.1:4719",
            ],
      },
      {
        text: "Run the agent web beside the application, and give an agent (Claude Desktop, nothing installed) the application's address:",
        more: [
          `npx @summationai/${WIRE.cli.host} --dev --agent-web --text-in-url --env-file ${env?.file ?? "<env file>"} --app ${devUrl} --site ${devUrl}`,
          `It reads the shared secret (and its port, from AXE_AGENT_WEB_URL) from that file. Agents start at ${devUrl}/agent: this application answers the agent web's pages itself, so an agent never leaves its origin.`,
        ],
      },
    );
  return steps.flatMap((s, i) => [
    `  ${i + 1}. ${s.text}`,
    ...(s.more ?? []).map((m) => `       ${m}`),
  ]);
}

export async function surfaceInit(ctx: CommandContext): Promise<number> {
  const { values } = parse(ctx.args, {
    dir: { type: "string", short: "d" },
    framework: { type: "string", short: "f" },
    flag: { type: "string" },
    relay: { type: "string" },
    "relay-dev": { type: "boolean" },
    remote: { type: "boolean" },
    "browser-only": { type: "boolean" },
    "app-id": { type: "string" },
    "app-name": { type: "string" },
    "agent-web": { type: "boolean" },
    "dry-run": { type: "boolean" },
    yes: { type: "boolean", short: "y" },
    install: { type: "boolean" },
    vendor: { type: "string" },
    mount: { type: "string" },
    "flag-hook": { type: "string" },
    "flag-import": { type: "string" },
  });
  const fw =
    values.framework === undefined || values.framework === "auto"
      ? undefined
      : String(values.framework);
  if (fw !== undefined && !FRAMEWORKS.includes(fw as Framework))
    throw new Error(`--framework must be auto or one of ${FRAMEWORKS.join(", ")}`);
  if (values.relay !== undefined && values["relay-dev"])
    throw new Error("Pass --relay <url> or --relay-dev, not both.");
  if (values.remote && values["browser-only"])
    throw new Error("Pass --remote or --browser-only, not both.");
  const o: InitOptions = { dir: String(values.dir ?? ".") };
  if (fw) o.framework = fw as Framework;
  if (values.flag !== undefined) o.flag = String(values.flag);
  if (values.relay !== undefined) o.relay = String(values.relay);
  if (values["relay-dev"]) o.relay = DEV_RELAY_URL;
  if (values["browser-only"]) o.remote = false;
  else o.remote = true;
  if (values["app-id"] !== undefined) o.appId = String(values["app-id"]);
  if (values["app-name"] !== undefined) o.appName = String(values["app-name"]);
  if (values["agent-web"]) o.agentWeb = true;
  if (values.vendor !== undefined) o.vendor = String(values.vendor);
  if (values.mount !== undefined) o.mount = String(values.mount);
  if (values["flag-hook"] !== undefined) o.flagHook = String(values["flag-hook"]);
  if (values["flag-import"] !== undefined) o.flagImport = String(values["flag-import"]);

  const plan = planInit(o);
  const d = plan.detection;
  ctx.stdout(
    `Detected ${d.framework} (${d.because}); root ${posix(relative(d.dir, d.rootFile))}; ${d.typescript ? "TypeScript" : "JavaScript"}; package manager ${d.packageManager}${d.workspaceRoot !== d.dir ? ` (workspace root ${d.workspaceRoot})` : ""}.`,
  );
  const mountName = posix(relative(d.dir, plan.mountFile));
  if (mountName !== posix(relative(d.dir, d.rootFile))) ctx.stdout(`Mounting in ${mountName}.`);
  const others = d.candidates.filter((c) => c !== mountName);
  if (others.length)
    ctx.stdout(
      `Other mount points (layouts that render the app's pages): ${others.join(", ")}. Keep Surface mounted across sign-in and account/workspace selection; use --mount <file> only when that layout still covers those states.`,
    );
  for (const k of plan.kept) ctx.stdout(`  kept: ${k}`);
  for (const m of plan.manual) ctx.stderr(`  manual step: ${m}`);

  let applied = false;
  if (plan.changes.length === 0) {
    ctx.stdout("Nothing to change: Surface is already set up here.");
  } else {
    ctx.stdout("");
    ctx.stdout(plan.diff.replace(/\n$/, ""));
    ctx.stdout("");
    if (values["dry-run"]) {
      ctx.stdout(`Dry run: nothing written. ${plan.changes.length} file(s) would change.`);
    } else {
      let go = Boolean(values.yes);
      if (!go && process.stdin.isTTY) {
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        go = /^y(es)?$/i.test(
          (await rl.question(`Apply these ${plan.changes.length} change(s)? [y/N] `)).trim(),
        );
        rl.close();
      }
      if (go) {
        applyPlan(plan);
        applied = true;
        for (const c of plan.changes)
          ctx.stdout(`${c.before === undefined ? "Wrote" : "Updated"} ${c.display}`);
      } else ctx.stdout("Not applied. Re-run with --yes to apply.");
    }
  }

  let installed = false;
  if (values.install && !values["dry-run"]) {
    const cmd = installCommand(d, o.remote !== false, o.vendor, o.agentWeb === true);
    ctx.stdout(`Running: ${cmd.argv.map(quoteArg).join(" ")}  (in ${cmd.cwd})`);
    if (cmd.overrides && writeOverrides(d.dir, cmd.overrides))
      ctx.stdout(
        `Updated ${cmd.overrides.file}: "${cmd.overrides.key}": ${JSON.stringify(cmd.overrides.value)}`,
      );
    const r = spawnSync(cmd.argv[0]!, cmd.argv.slice(1), { cwd: cmd.cwd, stdio: "inherit" });
    if (r.status !== 0) {
      ctx.stderr(
        `The install failed (exit ${r.status ?? "signal"}). Run it yourself: ${cmd.argv.map(quoteArg).join(" ")}`,
      );
      return 1;
    }
    installed = true;
  }

  let env: AgentWebEnv | undefined;
  if (o.agentWeb) {
    env = ensureAgentWebEnv(d.dir, !values["dry-run"] && (applied || plan.changes.length === 0));
    if (env.file && env.added.length)
      ctx.stdout(
        `${values["dry-run"] ? "Would add" : "Added"} ${env.added.join(" and ")} to ${env.file} (values not shown).`,
      );
  }

  if (applied || plan.changes.length === 0 || values["dry-run"]) {
    ctx.stdout("");
    ctx.stdout("Next steps:");
    for (const line of nextSteps(plan, o, installed, env)) ctx.stdout(line);
  }
  return 0;
}
