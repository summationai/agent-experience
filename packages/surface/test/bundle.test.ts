import { describe, expect, it } from "vitest";
import { build } from "esbuild";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

/**
 * The browser-bundle smoke test. A real integration (a legacy grid bundled with esbuild) found
 * that any browser bundle importing `@axe/surface` failed on a Node built-in reached through
 * `@axe/core`, and that a surface which never used a schema carried all of Zod. Both are pinned
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
      "@axe/surface": join(src, "index.ts"),
      "@axe/surface/react": join(src, "react.ts"),
      "@axe/surface/axe": join(src, "axe.ts"),
      "@axe/surface/webmcp": join(src, "webmcp.ts"),
      "@axe/surface/auto": join(src, "auto.ts"),
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
  it("@axe/surface and @axe/surface/react bundle for the browser without Node built-ins or Zod, under 50 kB minified", async () => {
    const out = await bundle(
      `import * as surface from "@axe/surface";
       import { useSurface, useSurfaceProps, toSurfaceProps } from "@axe/surface/react";
       console.log(surface, useSurface, useSurfaceProps, toSurfaceProps);`,
    );
    expect(out.imports).toEqual(["react"]);
    expect(out.inputs.filter((f) => /\/zod\//.test(f))).toEqual([]);
    // jsdom is the mounted React tests' environment, a devDependency; it never enters the bundle.
    expect(out.inputs.filter((f) => /jsdom/.test(f))).toEqual([]);
    expect(out.inputs.some((f) => f.includes("vocabulary"))).toBe(true);
    // The WebMCP adapter is an optional subpath: neither entry pulls it in.
    expect(out.inputs.filter((f) => /webmcp/.test(f))).toEqual([]);
    // Nor the derivation: the hooks alone tree-shake SurfaceProvider and @axe/surface/auto away.
    expect(out.inputs.filter((f) => /auto-dom/.test(f))).toEqual([]);
    console.log(`@axe/surface + @axe/surface/react: ${out.bytes} bytes minified for the browser`);
    expect(out.bytes, `${out.bytes} bytes`).toBeLessThan(50 * 1024);
  });

  it("@axe/surface/axe bundles for the browser too (it carries Zod through @axe/core)", async () => {
    const out = await bundle(
      `import { surfaceActions } from "@axe/surface/axe";
       console.log(surfaceActions);`,
    );
    expect(out.imports).toEqual([]);
    console.log(`@axe/surface/axe: ${out.bytes} bytes minified for the browser`);
  });

  it("@axe/surface/webmcp bundles for the browser alone, small, without Zod or React", async () => {
    const out = await bundle(
      `import { exposeWebMcp } from "@axe/surface/webmcp";
       console.log(exposeWebMcp);`,
    );
    expect(out.imports).toEqual([]);
    expect(out.inputs.filter((f) => /\/zod\//.test(f))).toEqual([]);
    expect(out.inputs.filter((f) => /react/.test(f))).toEqual([]);
    console.log(`@axe/surface/webmcp: ${out.bytes} bytes minified for the browser`);
    expect(out.bytes, `${out.bytes} bytes`).toBeLessThan(50 * 1024);
  });

  // The bound grew from 100 kB / 35 kB gzipped when the handle gained read() and wait()
  // ([S-AUTO-14], [S-AUTO-15]): reading a page's content (sections, fields, native and ARIA
  // tables, lists, paging, Markdown) and waiting on it add about 26 kB minified, 9.5 kB gzipped.
  // They are what lets an agent answer from the page and wait for slow work, so they ship with the
  // handle rather than behind a second import.
  it("@axe/surface/auto bundles for the browser without Node built-ins, Zod, or React, under 120 kB minified and 43 kB gzipped", async () => {
    const out = await bundle(
      `import { autoSurface, formatCoverage } from "@axe/surface/auto";
       console.log(autoSurface, formatCoverage);`,
    );
    expect(out.imports).toEqual([]);
    expect(out.inputs.filter((f) => /\/zod\//.test(f))).toEqual([]);
    expect(out.inputs.filter((f) => /react/.test(f))).toEqual([]);
    expect(out.inputs.filter((f) => /jsdom/.test(f))).toEqual([]);
    console.log(
      `@axe/surface/auto (with the surface core): ${out.bytes} bytes minified, ${out.gzip} gzipped, for the browser`,
    );
    expect(out.bytes, `${out.bytes} bytes`).toBeLessThan(120 * 1024);
    expect(out.gzip, `${out.gzip} bytes gzipped`).toBeLessThan(43 * 1024);
  });

  it("SurfaceProvider from @axe/surface/react carries the derivation and nothing server-side", async () => {
    const out = await bundle(
      `import { SurfaceProvider } from "@axe/surface/react";
       console.log(SurfaceProvider);`,
    );
    expect(out.imports).toEqual(["react"]);
    expect(out.inputs.filter((f) => /\/zod\//.test(f))).toEqual([]);
    console.log(
      `SurfaceProvider: ${out.bytes} bytes minified, ${out.gzip} gzipped, for the browser`,
    );
    expect(out.gzip, `${out.gzip} bytes gzipped`).toBeLessThan(44 * 1024);
  });
});
