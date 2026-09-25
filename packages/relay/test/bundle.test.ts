// `@axe/relay/client` ships in application bundles: no Node built-ins, no Zod, no framework,
// small, and nothing touched at import time (pages load it with a dynamic import under SSR).
import { describe, expect, it } from "vitest";
import { build } from "esbuild";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

describe("browser bundle", () => {
  it("@axe/relay/client bundles for the browser without Node built-ins, Zod, or ws, under 16 kB minified", async () => {
    const result = await build({
      stdin: {
        contents: `export { connectRelay, devToken } from "${join(__dirname, "../src/client.ts").replace(/\\/g, "/")}";`,
        resolveDir: __dirname,
        loader: "ts",
      },
      bundle: true,
      minify: true,
      write: false,
      metafile: true,
      format: "esm",
      platform: "browser",
      target: "es2022",
      logLevel: "silent",
    });
    const inputs = Object.keys(result.metafile.inputs);
    const imports = Object.values(result.metafile.outputs).flatMap((o) =>
      o.imports.map((i) => i.path),
    );
    expect(imports).toEqual([]);
    expect(inputs.filter((f) => /\/(zod|ws|@modelcontextprotocol)\//.test(f))).toEqual([]);
    // The client imports nothing from the surface at runtime: types only.
    expect(inputs.filter((f) => /packages\/(surface|core)\//.test(f))).toEqual([]);
    const bytes = result.outputFiles[0]!.contents.byteLength;
    console.log(`@axe/relay/client: ${bytes} bytes minified for the browser`);
    expect(bytes, `${bytes} bytes`).toBeLessThan(16 * 1024);
  });

  it("importing the built client touches no window, document, or WebSocket", async () => {
    const g = globalThis as Record<string, unknown>;
    expect(g["window"]).toBeUndefined();
    expect(g["document"]).toBeUndefined();
    const saved = g["WebSocket"];
    delete g["WebSocket"];
    try {
      const mod = (await import(pathToFileURL(join(__dirname, "../src/client.ts")).href)) as Record<
        string,
        unknown
      >;
      expect(typeof mod["connectRelay"]).toBe("function");
    } finally {
      if (saved !== undefined) g["WebSocket"] = saved;
    }
  });
});
