import { defineConfig } from "tsup";
import { base } from "../../tsup.base";

// @axe/core's zod-free subpaths are bundled in so agents install one small package.
export default defineConfig(
  base(
    { index: "src/index.ts", present: "src/present.ts" },
    { noExternal: ["@axe/core"], minify: false },
  ),
);
