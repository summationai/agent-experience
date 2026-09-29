import { describe, expect, it } from "vitest";
import { build } from "esbuild";
import { join } from "node:path";

describe("bundle size", () => {
  // 20 kB (18.8 kB measured at the merge of review items 10 and 12): manifest refresh with ETag
  // revalidation and change diffing added about 0.7 kB on top of the 18 kB budget below. 18 kB: timeouts, bounded response reads, polling budgets, and envelope checks took the
  // entry from 12 kB to 16 kB (DECISIONS.md, "The client checks what a site sends by hand").
  it("@summationai/axe-client main entry is under 20 kB minified", async () => {
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
    expect(bytes, `client bundle is ${bytes} bytes`).toBeLessThan(20 * 1024);
  });
});
