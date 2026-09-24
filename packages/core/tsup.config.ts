import { defineConfig } from "tsup";
import { base } from "../../tsup.base";

export default defineConfig(
  base({
    index: "src/index.ts",
    vocabulary: "src/vocabulary.ts",
    kinds: "src/kinds.ts",
    events: "src/events.ts",
    display: "src/display.ts",
    lint: "src/lint.ts",
    schemas: "src/schemas.ts",
    types: "src/types.ts",
  }),
);
