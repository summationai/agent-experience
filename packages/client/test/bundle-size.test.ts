import { describe, expect, it } from "vitest";
import { build } from "esbuild";
import { join } from "node:path";

describe("bundle size", () => {
  // 18 kB: timeouts, bounded response reads, polling budgets, and envelope checks took the
  // entry from 12 kB to 16 kB (DECISIONS.md, "The client checks what a site sends by hand").
  it("@axe/client main entry is under 18 kB minified", async () => {
    const result = await build({
      entryPoints: [join(__dirname, "../src/index.ts")],
      bundle: true,
      minify: true,
      write: false,
      format: "esm",
      platform: "neutral",
      target: "es2022",
      logLevel: "silent",
    });
    const bytes = result.outputFiles[0]!.contents.byteLength;
    expect(bytes, `client bundle is ${bytes} bytes`).toBeLessThan(18 * 1024);
  });
});
