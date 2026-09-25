/**
 * Detection for `axe surface init`: which framework an application uses, where its root
 * component or entry is, which package manager installs into it, and whether it is TypeScript.
 * Every rule reads files; nothing is executed.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

export type Framework = "react-router" | "next" | "vite-react" | "react" | "plain";
export const FRAMEWORKS: Framework[] = ["react-router", "next", "vite-react", "react", "plain"];

export type PackageManager = "npm" | "pnpm" | "yarn" | "yarn-berry" | "bun";

export interface Detection {
  /** The application directory (absolute). */
  dir: string;
  framework: Framework;
  /** Why this framework was chosen, for the printed summary. */
  because: string;
  /** The file the root edit goes into (absolute). */
  rootFile: string;
  /** Where the generated files go (absolute): next to the root file. */
  outDir: string;
  typescript: boolean;
  packageManager: PackageManager;
  /** The directory whose lockfile decided the package manager (a workspace root, or `dir`). */
  workspaceRoot: string;
  /** The app's package name, if it has one (for `yarn workspace <name> add`). */
  packageName?: string;
  /** Whether the app declares React 19 or newer (informational). */
  reactMajor?: number;
  /**
   * Other files that could hold the mount (layout routes that render `<Outlet />`, nested Next
   * layouts), relative to `dir`. An app whose root also renders pre-auth pages mounts Surface in
   * its authenticated shell instead: `--mount <file>`.
   */
  candidates: string[];
}

interface PackageJson {
  name?: string;
  packageManager?: string;
  workspaces?: string[] | { packages?: string[] };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function readJson(path: string): PackageJson | undefined {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as PackageJson;
  } catch {
    return undefined;
  }
}

function firstExisting(dir: string, candidates: string[]): string | undefined {
  for (const c of candidates) if (existsSync(join(dir, c))) return join(dir, c);
  return undefined;
}

const EXTS = ["tsx", "jsx", "ts", "js"];
const withExts = (base: string) => EXTS.map((e) => `${base}.${e}`);

/** The React Router `appDirectory`, when `react-router.config.*` names it as a plain string. */
function reactRouterAppDir(dir: string): string {
  const config = firstExisting(dir, ["react-router.config.ts", "react-router.config.js"]);
  if (config) {
    const m = /appDirectory\s*:\s*["'`]([^"'`]+)["'`]/.exec(readFileSync(config, "utf8"));
    if (m) return m[1]!;
    // `path.join(import.meta.dirname, "app")` and the like: take the last string literal.
    const joined = /appDirectory\s*:\s*[\w.]+\([^)]*["'`]([^"'`]+)["'`]\s*\)/.exec(
      readFileSync(config, "utf8"),
    );
    if (joined) return joined[1]!;
  }
  return "app";
}

/** The module script an `index.html` loads, if it names one (`<script type="module" src>`). */
function htmlEntry(dir: string): string | undefined {
  const html = join(dir, "index.html");
  if (!existsSync(html)) return undefined;
  const m = /<script[^>]*type=["']module["'][^>]*src=["']\/?([^"']+)["']/.exec(
    readFileSync(html, "utf8"),
  );
  if (m && existsSync(join(dir, m[1]!))) return join(dir, m[1]!);
  return undefined;
}

function hasRender(file: string): boolean {
  return /\.render\s*\(/.test(readFileSync(file, "utf8"));
}

function detectFramework(
  dir: string,
  deps: Record<string, string>,
  forced: Framework | undefined,
): { framework: Framework; because: string; rootFile: string } {
  const tried: string[] = [];
  const reactRouter = (): ReturnType<typeof detectFramework> | undefined => {
    const appDir = reactRouterAppDir(dir);
    const root = firstExisting(dir, withExts(`${appDir}/root`));
    tried.push(`${appDir}/root.tsx`);
    return root
      ? {
          framework: "react-router",
          because: deps["@react-router/dev"]
            ? "@react-router/dev in package.json"
            : "react-router.config found",
          rootFile: root,
        }
      : undefined;
  };
  const next = (): ReturnType<typeof detectFramework> | undefined => {
    const layout = firstExisting(dir, [...withExts("app/layout"), ...withExts("src/app/layout")]);
    tried.push("app/layout.tsx", "src/app/layout.tsx");
    return layout
      ? { framework: "next", because: "next in package.json, App Router layout", rootFile: layout }
      : undefined;
  };
  const reactEntry = (
    fw: "vite-react" | "react",
  ): ReturnType<typeof detectFramework> | undefined => {
    const fromHtml = htmlEntry(dir);
    const candidates = [
      ...(fromHtml ? [relative(dir, fromHtml)] : []),
      ...withExts("src/main"),
      ...withExts("src/index"),
    ];
    tried.push("src/main.tsx", "src/index.tsx");
    for (const c of candidates) {
      const file = join(dir, c);
      if (existsSync(file) && hasRender(file))
        return {
          framework: fw,
          because:
            fw === "vite-react"
              ? "vite and react in package.json"
              : "react in package.json, no Vite (any bundler)",
          rootFile: file,
        };
    }
    return undefined;
  };
  const plain = (): ReturnType<typeof detectFramework> | undefined => {
    const html = firstExisting(dir, ["index.html", "public/index.html"]);
    tried.push("index.html");
    return html
      ? { framework: "plain", because: "index.html, no React", rootFile: html }
      : undefined;
  };

  const by: Record<Framework, () => ReturnType<typeof detectFramework> | undefined> = {
    "react-router": reactRouter,
    next,
    "vite-react": () => reactEntry("vite-react"),
    react: () => reactEntry("react"),
    plain,
  };
  if (forced) {
    const found = by[forced]();
    if (!found)
      throw new Error(
        `--framework ${forced}: no root file found in ${dir} (looked for ${tried.join(", ")}).`,
      );
    return found;
  }
  const order: Framework[] = [];
  if (
    deps["@react-router/dev"] ||
    existsSync(join(dir, "react-router.config.ts")) ||
    existsSync(join(dir, "react-router.config.js"))
  )
    order.push("react-router");
  if (deps["next"]) order.push("next");
  if (deps["react"] && deps["vite"]) order.push("vite-react");
  if (deps["react"]) order.push("react");
  order.push("plain");
  for (const fw of order) {
    const found = by[fw]();
    if (found) return found;
  }
  throw new Error(
    `Could not find an application root in ${dir} (looked for ${[...new Set(tried)].join(", ")}). ` +
      `Pass --dir <app> or --framework react-router|next|vite-react|react|plain.`,
  );
}

/**
 * Walk up from `dir` to the first lockfile (stopping at a repository root); its kind names the
 * package manager and its directory is the workspace root. A `.yarnrc.yml` beside `yarn.lock`, or
 * `packageManager: yarn@2+`, is Yarn Berry. With no lockfile, the nearest `packageManager` decides.
 */
function detectPackageManager(dir: string): {
  packageManager: PackageManager;
  workspaceRoot: string;
} {
  let cur = resolve(dir);
  let pinned: { pm: string; version: string; at: string } | undefined;
  for (;;) {
    const pkg = readJson(join(cur, "package.json"));
    if (!pinned && pkg?.packageManager) {
      const [pm, version = ""] = pkg.packageManager.split("@");
      pinned = { pm: pm!, version, at: cur };
    }
    if (existsSync(join(cur, "pnpm-lock.yaml")) || existsSync(join(cur, "pnpm-workspace.yaml")))
      return { packageManager: "pnpm", workspaceRoot: cur };
    if (existsSync(join(cur, "yarn.lock"))) {
      const berry =
        existsSync(join(cur, ".yarnrc.yml")) ||
        /^([2-9]|\d{2,})/.test(pkg?.packageManager?.split("@")[1] ?? "");
      return { packageManager: berry ? "yarn-berry" : "yarn", workspaceRoot: cur };
    }
    if (existsSync(join(cur, "bun.lockb")) || existsSync(join(cur, "bun.lock")))
      return { packageManager: "bun", workspaceRoot: cur };
    if (existsSync(join(cur, "package-lock.json")))
      return { packageManager: "npm", workspaceRoot: cur };
    const parent = dirname(cur);
    if (parent === cur || existsSync(join(cur, ".git"))) break;
    cur = parent;
  }
  if (pinned?.pm === "yarn")
    return {
      packageManager: /^1\./.test(pinned.version) ? "yarn" : "yarn-berry",
      workspaceRoot: pinned.at,
    };
  if (pinned?.pm === "pnpm" || pinned?.pm === "bun" || pinned?.pm === "npm")
    return { packageManager: pinned.pm, workspaceRoot: pinned.at };
  return { packageManager: "npm", workspaceRoot: resolve(dir) };
}

/** Layout files under the app directory that render an outlet or children (bounded walk). */
function mountCandidates(dir: string, framework: Framework, rootFile: string): string[] {
  if (framework !== "react-router" && framework !== "next") return [];
  // React Router layouts are route modules; Next layouts live anywhere under app/.
  const base =
    framework === "next" ? dirname(rootFile) : join(dir, reactRouterAppDir(dir), "routes");
  const out: string[] = [];
  let visited = 0;
  const walk = (d: string, depth: number) => {
    if (depth > 6 || visited > 4000) return;
    let names: string[];
    try {
      names = readdirSync(d);
    } catch {
      return;
    }
    for (const name of names.sort()) {
      if (name === "node_modules" || name.startsWith(".")) continue;
      const p = join(d, name);
      visited++;
      let isDir = false;
      try {
        isDir = statSync(p).isDirectory();
      } catch {
        continue;
      }
      if (isDir) {
        walk(p, depth + 1);
        continue;
      }
      if (p === rootFile || !/\.(tsx|jsx)$/.test(name) || /\.(test|spec|stories)\./.test(name))
        continue;
      const isLayout =
        framework === "next"
          ? /^layout\.(tsx|jsx)$/.test(name)
          : /^(_|layout\b|shell\b)|[._+](layout|shell)\.(tsx|jsx)$/i.test(name);
      if (!isLayout) continue;
      const text = readFileSync(p, "utf8");
      if (framework === "next" ? /\{\s*children\s*\}/.test(text) : /<Outlet\b/.test(text))
        out.push(relative(dir, p).split("\\").join("/"));
    }
  };
  walk(base, 0);
  // Shallowest first: the signed-in shell is usually the first layout under the routes.
  const depth = (p: string) => p.split("/").length;
  return out.sort((a, b) => depth(a) - depth(b) || a.localeCompare(b)).slice(0, 6);
}

export function detect(dirArg: string, forced?: Framework): Detection {
  const dir = resolve(dirArg);
  if (!existsSync(dir)) throw new Error(`--dir ${dirArg}: no such directory.`);
  const pkg = readJson(join(dir, "package.json"));
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const { framework, because, rootFile } = detectFramework(dir, deps, forced);
  const { packageManager, workspaceRoot } = detectPackageManager(dir);
  const typescript =
    existsSync(join(dir, "tsconfig.json")) ||
    /\.tsx?$/.test(rootFile) ||
    Boolean(deps["typescript"]);
  const reactVersion = /(\d+)/.exec(deps["react"] ?? "")?.[1];
  const detection: Detection = {
    dir,
    framework,
    because,
    rootFile,
    outDir: dirname(rootFile),
    typescript: framework === "plain" ? false : typescript,
    packageManager,
    workspaceRoot,
    candidates: mountCandidates(dir, framework, rootFile),
  };
  if (pkg?.name) detection.packageName = pkg.name;
  if (reactVersion) detection.reactMajor = Number(reactVersion);
  return detection;
}
