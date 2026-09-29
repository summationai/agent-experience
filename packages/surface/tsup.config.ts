import { defineConfig } from "tsup";
import type { Plugin } from "esbuild";
import { base } from "../../tsup.base";

/**
 * `@summationai/axe-surface/react` imports the main entry at runtime instead of inlining a copy of it. Inlined,
 * the hooks' default target was a second module-level `surface`, so `useSurface(entry, deps)`
 * registered in a table that `surface.expose(window)` from `@summationai/axe-surface` never showed (review
 * item 13). The import keeps the output's own extension, so ESM loads `./index.js` and CommonJS
 * `./index.cjs`: one registry per format, as for any package. `./auto` is shared the same way, so
 * `@summationai/axe-surface/react`'s `SurfaceProvider` and `@summationai/axe-surface/axe`'s `autoActions` load the one
 * `@summationai/axe-surface/auto` rather than carrying copies of it.
 */
const sharedIndex: Plugin = {
  name: "surface-shared-index",
  setup(build) {
    // tsup names each format's output through esbuild's outExtension (".cjs" for CommonJS here).
    const ext = build.initialOptions.outExtension?.[".js"] ?? ".js";
    build.onResolve({ filter: /^\.\/(index|auto)$/ }, (args) =>
      args.kind === "entry-point" ? undefined : { path: `${args.path}${ext}`, external: true },
    );
  },
};

export default defineConfig(
  base(
    {
      index: "src/index.ts",
      react: "src/react.ts",
      axe: "src/axe.ts",
      webmcp: "src/webmcp.ts",
      auto: "src/auto.ts",
    },
    { external: ["react"], esbuildPlugins: [sharedIndex] },
  ),
);
