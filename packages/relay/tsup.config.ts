import { defineConfig } from "tsup";
import { base } from "../../tsup.base";

export default defineConfig([
  // The browser client: neutral platform, no Node built-ins (a bundle test pins it).
  base({ client: "src/client.ts", token: "src/token.ts" }),
  base(
    { server: "src/server.ts", cli: "src/cli.ts" },
    { platform: "node", clean: false },
  ),
  base(
    { bin: "src/bin.ts" },
    { platform: "node", format: ["esm"], dts: false, clean: false, banner: { js: "#!/usr/bin/env node" } },
  ),
]);
