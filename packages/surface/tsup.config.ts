import { defineConfig } from "tsup";
import type { Plugin } from "esbuild";
import { base } from "../../tsup.base";

/**
 * `@axe/surface/react` imports the main entry at runtime instead of inlining a copy of it. Inlined,
 * the hooks' default target was a second module-level `surface`, so `useSurface(entry, deps)`
 * registered in a table that `surface.expose(window)` from `@axe/surface` never showed (review
 * item 13). The import keeps the output's own extension, so ESM loads `./index.js` and CommonJS
 * `./index.cjs`: one registry per format, as for any package.
 */
const sharedIndex: Plugin = {
  name: "surface-shared-index",
  setup(build) {
    // tsup names each format's output through esbuild's outExtension (".cjs" for CommonJS here).
    const ext = build.initialOptions.outExtension?.[".js"] ?? ".js";
    build.onResolve({ filter: /^\.\/index$/ }, (args) =>
      args.kind === "entry-point" ? undefined : { path: `./index${ext}`, external: true },
    );
  },
};

export default defineConfig(
  base(
    { index: "src/index.ts", react: "src/react.ts", axe: "src/axe.ts" },
    { external: ["react"], esbuildPlugins: [sharedIndex] },
  ),
);
