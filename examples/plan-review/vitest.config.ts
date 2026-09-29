import { defineConfig } from "vitest/config";

// The deterministic Node suite: server actions, sessions, approvals, over the runtime's
// in-process handler. The browser suite (e2e/) runs under Playwright with `pnpm test:app`.
export default defineConfig({ test: { include: ["test/**/*.test.ts"], environment: "node" } });
