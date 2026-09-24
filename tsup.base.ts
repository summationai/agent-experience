import type { Options } from "tsup";

export function base(entry: Record<string, string>, overrides: Partial<Options> = {}): Options {
  return {
    entry,
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "node20",
    platform: "neutral",
    splitting: false,
    treeshake: true,
    outExtension({ format }) {
      return { js: format === "cjs" ? ".cjs" : ".js" };
    },
    ...overrides,
  };
}
