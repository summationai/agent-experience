import { defineConfig } from "tsup";
import { base } from "../../tsup.base";

export default defineConfig(base({ index: "src/index.ts" }));
