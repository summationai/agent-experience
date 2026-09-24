import { defineConfig } from "tsup";
import { base } from "../../tsup.base";

export default defineConfig(
  base(
    { index: "src/index.ts" },
    { format: ["esm"], platform: "node", banner: { js: "#!/usr/bin/env node" }, dts: true },
  ),
);
