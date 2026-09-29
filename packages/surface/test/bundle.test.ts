import { describe, expect, it } from "vitest";
import { build } from "esbuild";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

/**
 * The browser-bundle smoke test. A real integration (a legacy grid bundled with esbuild) found
 * that any browser bundle importing `@summationai/axe-surface` failed on a Node built-in reached through
 * `@summationai/axe-core`, and that a surface which never used a schema carried all of Zod. Both are pinned
 * here: the main entry and `/react` bundle for the browser with no Node built-in, without Zod,
 * and small; `/axe` (the server side) bundles too and may carry Zod.
 */
const src = join(__dirname, "../src");

async function bundle(contents: string, extraExternal: string[] = []) {
  const result = await build({
    stdin: { contents, resolveDir: __dirname, loader: "ts" },
    bundle: true,
    minify: true,
    write: false,
    metafile: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    logLevel: "silent",
    external: ["react", ...extraExternal],
    alias: {
      "@summationai/axe-surface": join(src, "index.ts"),
      "@summationai/axe-surface/react": join(src, "react.ts"),
      "@summationai/axe-surface/axe": join(src, "axe.ts"),
      "@summationai/axe-surface/webmcp": join(src, "webmcp.ts"),
      "@summationai/axe-surface/auto": join(src, "auto.ts"),
    },
  });
  // Modules that contribute code to the output: a module imported and then tree-shaken to nothing
  // is not in the bundle.
  const inputs = Object.values(result.metafile.outputs).flatMap((o) =>
    Object.entries(o.inputs)
      .filter(([, v]) => v.bytesInOutput > 0)
      .map(([k]) => k),
  );
  // Every import the bundle still makes at runtime: with `platform: "browser"` a Node built-in
  // fails the build outright, and anything left is listed here as external.
  const imports = [
    ...new Set(Object.values(result.metafile.outputs).flatMap((o) => o.imports.map((i) => i.path))),
  ];
  const output = result.outputFiles[0]!.contents;
  return { bytes: output.byteLength, gzip: gzipSync(output).byteLength, inputs, imports };
}

describe("browser bundle", () => {
  it("@summationai/axe-surface and @summationai/axe-surface/react bundle for the browser without Node built-ins or Zod, under 50 kB minified", async () => {
    const out = await bundle(
      `import * as surface from "@summationai/axe-surface";
       import { useSurface, useSurfaceProps, toSurfaceProps } from "@summationai/axe-surface/react";
       console.log(surface, useSurface, useSurfaceProps, toSurfaceProps);`,
    );
    expect(out.imports).toEqual(["react"]);
    expect(out.inputs.filter((f) => /\/zod\//.test(f))).toEqual([]);
    // jsdom is the mounted React tests' environment, a devDependency; it never enters the bundle.
    expect(out.inputs.filter((f) => /jsdom/.test(f))).toEqual([]);
    expect(out.inputs.some((f) => f.includes("vocabulary"))).toBe(true);
    // Hook-only imports tree-shake SurfaceProvider and its WebMCP adapter away.
    expect(out.inputs.filter((f) => /webmcp/.test(f))).toEqual([]);
    // Nor the derivation: the hooks alone tree-shake SurfaceProvider and @summationai/axe-surface/auto away.
    expect(out.inputs.filter((f) => /auto-dom/.test(f))).toEqual([]);
    console.log(
      `@summationai/axe-surface + @summationai/axe-surface/react: ${out.bytes} bytes minified for the browser`,
    );
    expect(out.bytes, `${out.bytes} bytes`).toBeLessThan(50 * 1024);
  });

  it("@summationai/axe-surface/axe bundles for the browser too (it carries Zod through @summationai/axe-core)", async () => {
    const out = await bundle(
      `import { surfaceActions } from "@summationai/axe-surface/axe";
       console.log(surfaceActions);`,
    );
    expect(out.imports).toEqual([]);
    console.log(`@summationai/axe-surface/axe: ${out.bytes} bytes minified for the browser`);
  });

  // The bound grew from 50 to 58 kB with the domain granularity ([S-WEB-7]) and observe's filters
  // and pages: about 6 kB of tool definitions, the shared cursor paging, and domainActions'
  // default specs. They keep the tool list fixed and small however large the page is, which is
  // what an agent pays for on every turn, so they ship in the adapter.
  it("@summationai/axe-surface/webmcp bundles for the browser alone, small, without Zod or React", async () => {
    const out = await bundle(
      `import { exposeWebMcp } from "@summationai/axe-surface/webmcp";
       console.log(exposeWebMcp);`,
    );
    expect(out.imports).toEqual([]);
    expect(out.inputs.filter((f) => /\/zod\//.test(f))).toEqual([]);
    expect(out.inputs.filter((f) => /react/.test(f))).toEqual([]);
    console.log(`@summationai/axe-surface/webmcp: ${out.bytes} bytes minified for the browser`);
    expect(out.bytes, `${out.bytes} bytes`).toBeLessThan(58 * 1024);
  });

  // The bound grew from 100 kB / 35 kB gzipped when the handle gained read() and wait()
  // ([S-AUTO-14], [S-AUTO-15]): reading a page's content (sections, fields, native and ARIA
  // tables, lists, paging, Markdown) and waiting on it add about 26 kB minified, 9.5 kB gzipped.
  // They are what lets an agent answer from the page and wait for slow work, so they ship with the
  // handle rather than behind a second import.
  it("@summationai/axe-surface/auto bundles for the browser without Node built-ins, Zod, or React, under 120 kB minified and 43 kB gzipped", async () => {
    const out = await bundle(
      `import { autoSurface, formatCoverage } from "@summationai/axe-surface/auto";
       console.log(autoSurface, formatCoverage);`,
    );
    expect(out.imports).toEqual([]);
    expect(out.inputs.filter((f) => /\/zod\//.test(f))).toEqual([]);
    expect(out.inputs.filter((f) => /react/.test(f))).toEqual([]);
    expect(out.inputs.filter((f) => /jsdom/.test(f))).toEqual([]);
    console.log(
      `@summationai/axe-surface/auto (with the surface core): ${out.bytes} bytes minified, ${out.gzip} gzipped, for the browser`,
    );
    expect(out.bytes, `${out.bytes} bytes`).toBeLessThan(120 * 1024);
    expect(out.gzip, `${out.gzip} bytes gzipped`).toBeLessThan(43 * 1024);
  });

  // The bound grew from 44 to 47 kB when the provider's WebMCP adapter gained the auto surface's
  // read/wait loop and registration diagnostics. The DOM reader was already in this bundle; the
  // increase is the two schemas, tool handlers, and diagnostic state. It grew to 50 kB with the
  // adapter's domain granularity and observe paging (about 2 kB gzipped; see the bound above).
  it("SurfaceProvider from @summationai/axe-surface/react carries the derivation and nothing server-side", async () => {
    const out = await bundle(
      `import { SurfaceProvider } from "@summationai/axe-surface/react";
       console.log(SurfaceProvider);`,
    );
    expect(out.imports).toEqual(["react"]);
    expect(out.inputs.filter((f) => /\/zod\//.test(f))).toEqual([]);
    console.log(
      `SurfaceProvider: ${out.bytes} bytes minified, ${out.gzip} gzipped, for the browser`,
    );
    expect(out.gzip, `${out.gzip} bytes gzipped`).toBeLessThan(50 * 1024);
  });
});
