import { describe, expect, it } from "vitest";
import { build } from "esbuild";
import { join } from "node:path";

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
    },
  });
  const inputs = Object.keys(result.metafile.inputs);
  // Every import the bundle still makes at runtime: with `platform: "browser"` a Node built-in
  // fails the build outright, and anything left is listed here as external.
  const imports = Object.values(result.metafile.outputs).flatMap((o) =>
    o.imports.map((i) => i.path),
  );
  return { bytes: result.outputFiles[0]!.contents.byteLength, inputs, imports };
}

describe("browser bundle", () => {
  it("@axe/surface and @axe/surface/react bundle for the browser without Node built-ins or Zod, under 50 kB minified", async () => {
    const out = await bundle(
      `import * as surface from "@axe/surface";
       import * as react from "@axe/surface/react";
       console.log(surface, react);`,
    );
    expect(out.imports).toEqual(["react"]);
    expect(out.inputs.filter((f) => /\/zod\//.test(f))).toEqual([]);
    expect(out.inputs.some((f) => f.includes("vocabulary"))).toBe(true);
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
});
