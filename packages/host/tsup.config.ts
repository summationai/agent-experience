import { defineConfig } from "tsup";
import { base } from "../../tsup.base";

export default defineConfig([
  base({ index: "src/index.ts", cli: "src/cli.ts" }, { platform: "node" }),
  base(
    { bin: "src/bin.ts" },
    {
      platform: "node",
      format: ["esm"],
      dts: false,
      clean: false,
      banner: { js: "#!/usr/bin/env node" },
    },
  ),
]);
