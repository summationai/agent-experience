import { defineConfig, devices } from "@playwright/test";

// Browser-level tests against `next start` (run `pnpm build:app` first; `pnpm test:app` does
// both). One server, one worker: the tests share the server's in-memory state and reset it
// through a test-only endpoint that exists only when PLAN_REVIEW_TEST_RESET=1.
const PORT = Number(process.env["PLAN_REVIEW_PORT"] ?? 3107);
const BASE = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 30_000,
  reporter: [["list"]],
  use: { baseURL: BASE, ...devices["Desktop Chrome"], trace: "retain-on-failure" },
  webServer: {
    command: `pnpm exec next start --port ${PORT}`,
    url: `${BASE}/login`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PLAN_REVIEW_BASE_URL: BASE,
      PLAN_REVIEW_TEST_RESET: "1",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
