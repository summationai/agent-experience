import { defineConfig } from "vitest/config";

// The built `@axe/surface` imports `react`; inlined and deduplicated, that import resolves to this
// package's React 19 rather than the React 18 the SDK develops against.
export default defineConfig({
  resolve: { dedupe: ["react", "react-dom"] },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "jsdom",
    server: { deps: { inline: [/@axe\/surface/] } },
  },
});
