import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // One Chromium per file; files run one after another so they do not compete for the CPU.
    fileParallelism: false,
  },
});
