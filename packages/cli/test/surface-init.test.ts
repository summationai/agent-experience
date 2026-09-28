import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as prettier from "prettier";
import { run } from "../src/index";
import { detect } from "../src/surface/detect";
import { installCommand, planInit, writeOverrides } from "../src/surface/init";
import { DEV_RELAY_URL } from "../src/surface/api";

const fixtures = join(__dirname, "fixtures");
const repo = join(__dirname, "../../..");

/** A fixture copied to a temporary directory, so applying never touches the repository. */
function copy(name: string): string {
  const dir = mkdtempSync(join(tmpdir(), `axe-surface-${name}-`));
  cpSync(join(fixtures, name), dir, { recursive: true });
  return dir;
}

async function cli(args: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await run(args, {
    stdout: (l) => void out.push(l),
    stderr: (l) => void err.push(l),
  });
  return { code, out: out.join("\n"), err: err.join("\n") };
}

/** Typecheck an app directory against the stubbed SDK entry points and the repo's React types. */
function typecheck(dir: string, include: string[], jsx: "react-jsx" | "preserve" = "react-jsx") {
  const types = join(repo, "packages/surface/node_modules/@types");
  writeFileSync(
    join(dir, "tsconfig.surface-check.json"),
    JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        jsx,
        module: "ESNext",
        moduleResolution: "Bundler",
        target: "ES2022",
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        types: [],
        allowJs: true,
        skipLibCheck: true,
        paths: {
          react: [join(types, "react/index.d.ts")],
          "react/jsx-runtime": [join(types, "react/jsx-runtime.d.ts")],
          "react-dom/client": [join(types, "react-dom/client.d.ts")],
          "~/*": ["./app/*"],
        },
      },
      files: [join(fixtures, "_stubs/modules.d.ts")],
      include,
    }),
  );
  try {
    execFileSync(
      process.execPath,
      [join(repo, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.surface-check.json"],
      { cwd: dir, encoding: "utf8" },
    );
  } catch (e) {
    throw new Error(`tsc failed in ${dir}:\n${(e as { stdout?: string }).stdout ?? String(e)}`);
  }
}

describe("axe surface init: detection", () => {
  it("detects each fixture's framework, root, package manager, and language", () => {
    const rr = detect(join(fixtures, "react-router"));
    expect([rr.framework, rr.rootFile.endsWith("app/root.tsx"), rr.typescript]).toEqual([
      "react-router",
      true,
      true,
    ]);
    const next = detect(join(fixtures, "next"));
    expect([next.framework, next.rootFile.endsWith("app/layout.tsx")]).toEqual(["next", true]);
    const vite = detect(join(fixtures, "vite-react"));
    expect([vite.framework, vite.rootFile.endsWith("src/main.tsx")]).toEqual(["vite-react", true]);
    const plain = detect(join(fixtures, "plain"));
    expect([plain.framework, plain.rootFile.endsWith("index.html"), plain.typescript]).toEqual([
      "plain",
      true,
      false,
    ]);
    const esb = detect(join(fixtures, "react-esbuild"));
    expect([esb.framework, esb.rootFile.endsWith("src/main.jsx"), esb.typescript]).toEqual([
      "react",
      true,
      false,
    ]);
    // Package managers, from copies (inside the repository every fixture sees its pnpm lockfile).
    expect(detect(copy("react-router")).packageManager).toBe("npm");
    expect(detect(copy("next")).packageManager).toBe("pnpm");
    const ws = copy("yarn-workspace");
    const web = detect(join(ws, "apps/web"));
    expect(web.framework).toBe("react-router");
    expect(web.rootFile.endsWith("apps/web/app/root.tsx")).toBe(true);
    expect(web.packageManager).toBe("yarn-berry");
    expect(web.workspaceRoot).toBe(ws);
    expect(web.packageName).toBe("web-app");
  });

  it("refuses a framework the directory does not have, and a directory with no root", async () => {
    const r = await cli(["surface", "init", "--dir", copy("plain"), "--framework", "next"]);
    expect(r.code).toBe(1);
    expect(r.err).toContain("--framework next: no root file found");
    const empty = mkdtempSync(join(tmpdir(), "axe-surface-empty-"));
    const e = await cli(["surface", "init", "--dir", empty, "--dry-run"]);
    expect(e.code).toBe(1);
    expect(e.err).toContain("Could not find an application root");
    expect((await cli(["surface", "init", "--framework", "svelte"])).err).toContain(
      "--framework must be auto or one of",
    );
  });
});

describe("axe surface init: the diff", () => {
  for (const name of ["react-router", "next", "vite-react", "plain", "react-esbuild"]) {
    it(`${name}: prints the exact diff, and --dry-run writes nothing`, async () => {
      const dir = copy(name);
      const plan = planInit({ dir });
      await expect(plan.diff).toMatchFileSnapshot(`__snapshots__/surface-init-${name}.diff`);
      const before = readFileSync(plan.detection.rootFile, "utf8");
      const r = await cli(["surface", "init", "--dir", dir, "--dry-run"]);
      expect(r.code).toBe(0);
      expect(r.out).toContain(plan.diff.trimEnd());
      expect(r.out).toContain("Dry run: nothing written.");
      expect(r.out).toContain("Next steps:");
      expect(readFileSync(plan.detection.rootFile, "utf8")).toBe(before);
      for (const c of plan.changes)
        if (c.before === undefined) expect(existsSync(c.path)).toBe(false);
    });
  }

  it("the React Router 7 diff touches two lines of root.tsx and nothing else", () => {
    const plan = planInit({ dir: copy("react-router") });
    const root = plan.changes.find((c) => c.display === "app/root.tsx")!;
    const removed = plan.diff.split("\n").filter((l) => l.startsWith("-") && !l.startsWith("---"));
    expect(removed).toEqual(["-  return <Outlet />;"]);
    expect(root.after).toContain('import { AgentSurface } from "./surface";');
    expect(plan.changes.map((c) => c.display).sort()).toEqual([
      "app/root.tsx",
      "app/surface.config.ts",
      "app/surface.tsx",
    ]);
  });

  it("follows the file's style: four spaces in the Yarn workspace app, the Outlet wrapped in place", () => {
    const ws = copy("yarn-workspace");
    const plan = planInit({ dir: join(ws, "apps/web") });
    expect(plan.diff).toContain(
      [
        "         <QueryProvider>",
        "-            <Outlet />",
        "+            <AgentSurface>",
        "+                <Outlet />",
        "+            </AgentSurface>",
        "         </QueryProvider>",
      ].join("\n"),
    );
    const surface = plan.changes.find((c) => c.display === "app/surface.tsx")!.after;
    expect(surface).toContain("\n    return (\n        <SurfaceProvider\n");
    expect(surface).toContain("            onReady={(handle) => {");
  });
});

describe("axe surface init: applying", () => {
  it("applies with --yes, then a second run changes nothing", async () => {
    const dir = copy("react-router");
    const first = await cli(["surface", "init", "--dir", dir, "--yes"]);
    expect(first.code, first.err).toBe(0);
    expect(first.out).toContain("Updated app/root.tsx");
    expect(first.out).toContain("Wrote app/surface.tsx");
    expect(first.out).toContain("Wrote app/surface.config.ts");
    const after = readFileSync(join(dir, "app/root.tsx"), "utf8");
    const second = await cli(["surface", "init", "--dir", dir, "--yes"]);
    expect(second.code).toBe(0);
    expect(second.out).toContain("Nothing to change: Surface is already set up here.");
    expect(readFileSync(join(dir, "app/root.tsx"), "utf8")).toBe(after);
    expect(planInit({ dir }).changes).toEqual([]);
  });

  it("without --yes and without a terminal, prints the diff and applies nothing", async () => {
    const dir = copy("vite-react");
    const r = await cli(["surface", "init", "--dir", dir]);
    expect(r.out).toContain("Not applied. Re-run with --yes to apply.");
    expect(existsSync(join(dir, "src/surface.tsx"))).toBe(false);
  });

  it("is idempotent for every fixture, and applied files are formatted as prettier would", async () => {
    for (const name of ["react-router", "next", "vite-react", "plain", "react-esbuild"]) {
      const dir = copy(name);
      const plan = planInit({ dir });
      expect((await cli(["surface", "init", "--dir", dir, "--yes"])).code).toBe(0);
      expect(planInit({ dir }).changes, name).toEqual([]);
      for (const c of plan.changes) {
        const text = readFileSync(c.path, "utf8");
        // The repository's prettier config, as it applies to the fixture in place.
        const config = await prettier.resolveConfig(join(fixtures, name, c.display));
        const formatted = await prettier.format(text, { ...config, filepath: c.path });
        expect(text, `${name} ${c.display}`).toBe(formatted);
      }
    }
  });

  it("keeps a file it did not write, and writes beside it", () => {
    const dir = copy("react-router");
    writeFileSync(join(dir, "app/surface.tsx"), "export const mine = 1;\n");
    const plan = planInit({ dir });
    expect(plan.changes.map((c) => c.display)).toContain("app/agent-surface.tsx");
    expect(plan.diff).toContain('import { AgentSurface } from "./agent-surface";');
  });

  it("keeps an edited generated file and says how to regenerate it", () => {
    const dir = copy("react-router");
    const p = planInit({ dir });
    for (const c of p.changes) writeFileSync(c.path, c.after);
    writeFileSync(
      join(dir, "app/surface.config.ts"),
      readFileSync(join(dir, "app/surface.config.ts"), "utf8") + "// mine\n",
    );
    const again = planInit({ dir, relay: DEV_RELAY_URL });
    expect(again.changes).toEqual([]);
    expect(again.kept.join("\n")).toContain(
      "app/surface.tsx exists; left as is (edited, or written with other options",
    );
  });

  it("names the manual step when the root has no element to wrap", async () => {
    const dir = copy("react-router");
    writeFileSync(
      join(dir, "app/root.tsx"),
      "export default function App() {\n  return null;\n}\n",
    );
    const r = await cli(["surface", "init", "--dir", dir, "--dry-run"]);
    expect(r.code).toBe(0);
    expect(r.err).toContain(
      'manual step: Wrap your app root in <AgentSurface> from "./surface" by hand: init could not find <Outlet /> or {children} in the default export of app/root.tsx.',
    );
  });
});

describe("axe surface init: flags and the relay", () => {
  const surfaceOf = (plan: ReturnType<typeof planInit>) =>
    plan.changes.find((c) => /surface\.(tsx|jsx|js)$/.test(c.display))!.after;

  it("is enabled by default and exposes browser diagnostics only in development", () => {
    expect(surfaceOf(planInit({ dir: copy("react-router") }))).toContain("const enabled = true;");
    const next = surfaceOf(planInit({ dir: copy("next") }));
    expect(next.startsWith('"use client";\n')).toBe(true);
    expect(next).toContain('const development = process.env.NODE_ENV === "development";');
    expect(next).toContain("const enabled = true;");
    const plain = surfaceOf(planInit({ dir: copy("plain") }));
    expect(plain).toContain('["localhost", "127.0.0.1"].includes(location.hostname)');
    expect(plain).toContain("surfaceConfig, expose: development });");
    expect(plain).toContain("const enabled = true;");
    expect(plain).toContain('import { exposeWebMcp } from "@axe/surface/webmcp";');
    expect(plain).toContain("  exposeWebMcp(handle.surface);");
    // expose follows development, not the flag.
    expect(surfaceOf(planInit({ dir: copy("vite-react") }))).toContain("expose={development}");
  });

  it("writes the connector-matched application profile", async () => {
    const plan = planInit({
      dir: copy("react-router"),
      appId: "acme-analytics",
      appName: "Acme Analytics",
    });
    const config = plan.changes.find((change) => change.display === "app/surface.config.ts")!.after;
    expect(config).toContain('id: "acme-analytics"');
    expect(config).toContain('name: "Acme Analytics"');
    expect(config).toContain('authentication: { state: "unknown" }');
    const invalid = await cli([
      "surface",
      "init",
      "--dir",
      copy("react-router"),
      "--app-id",
      "Not Valid",
    ]);
    expect(invalid.err).toContain("--app-id must be at most 80 lowercase letters");
  });

  it("takes a named variable or a named check", async () => {
    expect(surfaceOf(planInit({ dir: copy("vite-react"), flag: "VITE_AGENT_SURFACE" }))).toContain(
      'import.meta.env.VITE_AGENT_SURFACE === "1"',
    );
    const hook = surfaceOf(
      planInit({ dir: copy("react-router"), flag: "~/flags#useAgentSurface" }),
    );
    expect(hook).toContain('import { useAgentSurface } from "~/flags";');
    expect(hook).toContain(
      "  const enabled = useAgentSurface() || injectedRelay() !== null;\n  return (",
    );
    const bad = await cli([
      "surface",
      "init",
      "--dir",
      copy("vite-react"),
      "--flag",
      "AGENT_SURFACE",
    ]);
    expect(bad.err).toContain(
      "vite-react exposes only VITE_* variables to the browser; use VITE_AGENT_SURFACE",
    );
    const worse = await cli([
      "surface",
      "init",
      "--dir",
      copy("vite-react"),
      "--flag",
      "agent_surface",
    ]);
    expect(worse.err).toContain(
      "--flag takes an environment variable (VITE_SURFACE) or a check to call",
    );
  });

  it("is provider-ready by default; --browser-only opts out and relay options add attended fallback", async () => {
    const remote = surfaceOf(planInit({ dir: copy("react-router") }));
    expect(remote).toContain('import { connectRelay, injectedRelay } from "@axe/relay/client";');
    expect(remote).toContain(
      [
        "      onReady={(handle) => {",
        "        const options = injectedRelay();",
        "        if (!options) return;",
        "        const connection = connectRelay(handle.surface, options);",
        "        return () => connection.stop();",
        "      }}",
      ].join("\n"),
    );
    expect(remote).not.toContain("devToken");
    expect(remote).toContain("webMcp");
    const browserOnly = surfaceOf(planInit({ dir: copy("react-router"), remote: false }));
    expect(browserOnly).not.toContain("@axe/relay/client");
    expect(browserOnly).toContain("webMcp");
    const dev = surfaceOf(planInit({ dir: copy("react-router"), relay: DEV_RELAY_URL }));
    expect(dev).toContain(
      'import { connectRelay, localMcpService, injectedRelay } from "@axe/relay/client";',
    );
    expect(dev).toContain(
      `...localMcpService(import.meta.env.VITE_SURFACE_RELAY_URL ?? "${DEV_RELAY_URL}"),`,
    );
    // The injected connection wins; the development relay only in development (attended).
    expect(dev).toContain("const options = injectedRelay() ?? (development ? relay : null);");
    const prod = surfaceOf(
      planInit({ dir: copy("react-router"), relay: "wss://relay.example.com/tab" }),
    );
    expect(prod).toContain("const options = injectedRelay() ?? relay;");
    const r = await cli([
      "surface",
      "init",
      "--dir",
      copy("next"),
      "--relay",
      "wss://relay.example.com",
      "--dry-run",
    ]);
    expect(r.out).toContain(
      'process.env.NEXT_PUBLIC_SURFACE_RELAY_URL ?? "wss://relay.example.com"',
    );
    expect(r.out).toContain("pack-for-consumer.sh vendor core surface relay");
    // With a remote option, next steps explain the provider handoff and keep
    // the checkout-local host only as an isolated fallback.
    expect(r.out).toContain(
      "The provider browser handoff supplies the relay connection automatically after normal application sign-in",
    );
    const login = r.out.indexOf("npx axe host login http://localhost:3000");
    const add = r.out.indexOf("npx axe host --dev --stdio --app http://localhost:3000");
    expect(login, r.out).toBeGreaterThan(0);
    expect(add).toBeGreaterThan(login);
    expect(r.out.indexOf("npx axe surface coverage")).toBeGreaterThan(add);
    expect(r.out).toContain("The person's own tab connects to the company-side service");
    // An app that already depends on both packages is not told to install them.
    const has = copy("vite-react");
    const pkgPath = join(has, "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
      dependencies: Record<string, string>;
    };
    pkg.dependencies["@axe/surface"] = "workspace:*";
    pkg.dependencies["@axe/relay"] = "workspace:*";
    writeFileSync(pkgPath, JSON.stringify(pkg));
    const again = await cli(["surface", "init", "--dir", has, "--dry-run"]);
    expect(again.out).not.toContain("Install (nothing was added");
    expect(again.out).toContain("  1. Run the app in development");
    const both = await cli(["surface", "init", "--relay", "x", "--relay-dev"]);
    expect(both.err).toContain("Pass --relay <url> or --relay-dev, not both.");
  });
});

describe("axe surface init: choosing the mount", () => {
  it("lists layout routes as mount points and mounts in the one named", async () => {
    const ws = copy("yarn-workspace");
    const dir = join(ws, "apps/web");
    expect(detect(dir).candidates).toEqual(["app/routes/_shell.tsx"]);
    const r = await cli(["surface", "init", "--dir", dir, "--dry-run"]);
    expect(r.out).toContain(
      "Other mount points (layouts that render the app's pages): app/routes/_shell.tsx.",
    );
    const plan = planInit({
      dir,
      mount: "app/routes/_shell.tsx",
      flagHook: 'useFeatureFlag("ui_axe_surface")',
      flagImport: "~/feature-flags",
    });
    await expect(plan.diff).toMatchFileSnapshot("__snapshots__/surface-init-shell-mount.diff");
    expect(plan.changes.map((c) => c.display).sort()).toEqual([
      "app/routes/_shell.tsx",
      "app/surface.config.ts",
      "app/surface.tsx",
    ]);
    expect(plan.diff).toContain('+import { AgentSurface } from "../surface";');
    expect(plan.diff).toContain(
      '+    const enabled = useFeatureFlag("ui_axe_surface") || injectedRelay() !== null;',
    );
    expect(plan.diff).not.toContain("app/root.tsx");
    const bad = await cli(["surface", "init", "--dir", dir, "--mount", "app/nope.tsx"]);
    expect(bad.err).toContain("--mount app/nope.tsx: no such file");
    const half = await cli(["surface", "init", "--dir", dir, "--flag-hook", "useX()"]);
    expect(half.err).toContain("--flag-hook and --flag-import go together");
  });
});

describe("axe surface init: install commands", () => {
  it("prints the registry and tarball forms for each package manager", () => {
    const rr = detect(copy("react-router"));
    expect(installCommand(rr, false).argv).toEqual(["npm", "install", "@axe/surface"]);
    const tar = installCommand(rr, true, "vendor");
    expect(tar.argv).toEqual([
      "npm",
      "install",
      "@axe/core@file:vendor/axe-core-0.1.0.tgz",
      "@axe/surface@file:vendor/axe-surface-0.1.0.tgz",
      "@axe/relay@file:vendor/axe-relay-0.1.0.tgz",
    ]);
    expect(tar.overrides).toEqual({
      file: "package.json",
      key: "overrides",
      value: {
        "@axe/core": "file:vendor/axe-core-0.1.0.tgz",
        "@axe/surface": "file:vendor/axe-surface-0.1.0.tgz",
      },
    });
    expect(installCommand(detect(copy("next")), false).argv).toEqual([
      "pnpm",
      "add",
      "@axe/surface",
    ]);
    expect(installCommand(detect(copy("next")), false, "vendor").overrides!.key).toBe(
      "pnpm.overrides",
    );
    // Yarn Berry workspace: add in the app, resolutions at the workspace root, relative to it.
    const ws = copy("yarn-workspace");
    const web = detect(join(ws, "apps/web"));
    const y = installCommand(web, false, "../../vendor");
    expect(y.argv).toEqual([
      "yarn",
      "add",
      "@axe/core@file:../../vendor/axe-core-0.1.0.tgz",
      "@axe/surface@file:../../vendor/axe-surface-0.1.0.tgz",
    ]);
    expect(y.overrides).toEqual({
      file: "../../package.json",
      key: "resolutions",
      value: { "@axe/core": "file:./vendor/axe-core-0.1.0.tgz" },
    });
    // The web app's own precedent: tarballs beside the app, resolutions at the root.
    const beside = installCommand(web, false, "vendor");
    expect(beside.argv).toContain("@axe/surface@file:./vendor/axe-surface-0.1.0.tgz");
    expect(beside.overrides!.value).toEqual({
      "@axe/core": "file:./apps/web/vendor/axe-core-0.1.0.tgz",
    });
    expect(writeOverrides(join(ws, "apps/web"), beside.overrides!)).toBe(true);
    expect(JSON.parse(readFileSync(join(ws, "package.json"), "utf8")).resolutions).toEqual({
      "@axe/core": "file:./apps/web/vendor/axe-core-0.1.0.tgz",
    });
    expect(writeOverrides(join(ws, "apps/web"), beside.overrides!)).toBe(false);
    const pnpmApp = copy("next");
    writeOverrides(pnpmApp, installCommand(detect(pnpmApp), false, "vendor").overrides!);
    expect(JSON.parse(readFileSync(join(pnpmApp, "package.json"), "utf8")).pnpm.overrides).toEqual({
      "@axe/core": "file:vendor/axe-core-0.1.0.tgz",
    });
    // A vendor directory with packed tarballs is read for their real names.
    mkdirSync(join(ws, "apps/web/vendor"));
    writeFileSync(join(ws, "apps/web/vendor/axe-surface-0.2.0.tgz"), "");
    expect(installCommand(web, false, "vendor").argv).toContain(
      "@axe/surface@file:./vendor/axe-surface-0.2.0.tgz",
    );
  });
});

describe("axe surface init: the result typechecks", () => {
  it("React Router 7, default gate", async () => {
    const dir = copy("react-router");
    expect((await cli(["surface", "init", "--dir", dir, "--yes"])).code).toBe(0);
    typecheck(dir, ["app/**/*"]);
  }, 60_000);

  it("React Router 7 in a Yarn workspace, with a named check and the relay", async () => {
    const ws = copy("yarn-workspace");
    const dir = join(ws, "apps/web");
    writeFileSync(
      join(dir, "app/flags.ts"),
      "export function useAgentSurface(): boolean {\n  return true;\n}\n",
    );
    const r = await cli([
      "surface",
      "init",
      "--dir",
      dir,
      "--flag",
      "~/flags#useAgentSurface",
      "--relay-dev",
      "--yes",
    ]);
    expect(r.code, r.err).toBe(0);
    typecheck(dir, ["app/**/*"]);
  }, 60_000);

  it("a layout route mount with a Statsig-style hook flag", async () => {
    const ws = copy("yarn-workspace");
    const dir = join(ws, "apps/web");
    const r = await cli([
      "surface",
      "init",
      "--dir",
      dir,
      "--mount",
      "app/routes/_shell.tsx",
      "--flag-hook",
      'useFeatureFlag("ui_axe_surface")',
      "--flag-import",
      "~/feature-flags",
      "--yes",
    ]);
    expect(r.code, r.err).toBe(0);
    typecheck(dir, ["app/**/*"]);
  }, 60_000);

  it("Next App Router with the relay", async () => {
    const dir = copy("next");
    expect(
      (await cli(["surface", "init", "--dir", dir, "--relay", "wss://relay.example.com", "--yes"]))
        .code,
    ).toBe(0);
    typecheck(dir, ["app/**/*"], "preserve");
  }, 60_000);

  it("Vite React", async () => {
    const dir = copy("vite-react");
    expect((await cli(["surface", "init", "--dir", dir, "--yes"])).code).toBe(0);
    typecheck(dir, ["src/**/*"]);
  }, 60_000);

  it("plain HTML and a JavaScript React entry parse", async () => {
    const plain = copy("plain");
    expect((await cli(["surface", "init", "--dir", plain, "--relay-dev", "--yes"])).code).toBe(0);
    expect(readFileSync(join(plain, "index.html"), "utf8")).toContain(
      '    <script type="module" src="./surface.js"></script>\n  </body>',
    );
    typecheck(plain, ["*.js"]);
    const esb = copy("react-esbuild");
    expect((await cli(["surface", "init", "--dir", esb, "--yes"])).code).toBe(0);
    expect(readFileSync(join(esb, "src/main.jsx"), "utf8")).toContain(
      'createRoot(document.getElementById("root")).render(\n  <AgentSurface>\n    <App />\n  </AgentSurface>,\n);',
    );
    typecheck(esb, ["src/**/*"]);
  }, 60_000);
});

describe("axe surface: help and the prompt pack", () => {
  it("prints help, the prompt, and refuses an unknown subcommand", async () => {
    expect((await cli([])).out).toContain("axe surface init [--dir <app>]");
    const help = await cli(["surface"]);
    expect(help.code).toBe(1);
    expect(help.out).toContain("axe surface coverage <url>");
    const prompt = await cli(["surface", "prompt"]);
    expect(prompt.code).toBe(0);
    expect(prompt.out).toContain("# Add Agent Experience Surface to this application");
    expect((await cli(["surface", "nope"])).err).toContain('Unknown subcommand "nope"');
  });

  it("states the architecture boundary and names current commands and options", () => {
    const prompt = readFileSync(join(__dirname, "../templates/integrate-surface.md"), "utf8");
    expect(prompt).toContain("The provider registry says where an application is");
    expect(prompt).toContain("The MCP contains no application-specific behavior");
    for (const option of ["--dry-run", "--yes", "--mount", "--app-id", "--app-name", "--out"])
      expect(prompt).toContain(option);
  });
});
