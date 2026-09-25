// The deterministic evaluation harness (review item 17). No model: each variant is driven by a
// scripted agent program (policy.ts) that does the best it can with what the variant exposes.
// Outcomes are checked against the application's own state. Scripted success is not evidence of
// how a model-driven agent performs.
//
//   pnpm eval                                  (from the repository root; builds the app first)
//   node --import tsx eval/run.ts --runs=5     (from examples/plan-review, after `next build`)
//
// Options: --runs=N (default 5), --maintenance-runs=N (default: --runs), --variants=v1,v2,v3,v4,
// --scenarios=id,id, --port=3117, --date=YYYY-MM-DD, --out=DIR, --no-write.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { cpus, platform, release, arch, totalmem } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { chromium } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";
import { EXAMPLE_DIR, Person, resetApp, snapshot, startServer } from "./app";
import { openBrowserDriver } from "./browser-driver";
import { integrationEffort } from "./integration";
import { Meter, median, wilson } from "./meter";
import type { FetchFaults } from "./meter";
import { Crash, runAgent } from "./policy";
import type { Driver, Hooks } from "./policy";
import { SCENARIOS, checkOutcome, hasRecoverableFault } from "./scenarios";
import type { Outcome, PolicyReport, Scenario } from "./scenarios";
import { openAxeDriver, openBasicDriver } from "./tool-drivers";
import { renderMarkdown } from "./report";

export type VariantId = "v1" | "v2" | "v3" | "v4";

export const VARIANTS: { id: VariantId; title: string; how: string }[] = [
  {
    id: "v1",
    title: "V1 UI as shipped, generic markup",
    how: "Playwright on the page; controls found by visible text and table position",
  },
  {
    id: "v2",
    title: "V2 accessible names and semantic markup",
    how: "Playwright on the page; controls found by accessible name; reasons read from the DOM mirror",
  },
  {
    id: "v3",
    title: "V3 basic structured tools",
    how: "MCP tools over plain CRUD endpoints; no revision, availability, handoff, or idempotency key",
  },
  {
    id: "v4",
    title: "V4 AXE with live state",
    how: "the MCP server derived from the AXE manifest: axe_state, expectedRev, idempotency keys, needs_human and axe_resume",
  },
];

export interface RunRecord {
  variant: VariantId;
  scenario: string;
  run: number;
  uiChange: boolean;
  outcome: Outcome;
  report: PolicyReport;
  /** The task completed after its fault (null when the scenario has no fault to recover from). */
  recovered: boolean | null;
  faultApplies: boolean;
  latencyMs: number;
  httpRequests: number;
  httpBytes: number;
  agentMessages: number;
  agentBytes: number;
  /** Sign-in or MCP connect and tool listing before the task, not counted above. */
  setupRequests: number;
  setupBytes: number;
  tokens: "n/a";
  error: string | null;
}

function arg(name: string, fallback: string): string {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

function log(msg: string): void {
  process.stderr.write(`${msg}\n`);
}

async function runOne(
  variant: VariantId,
  scenario: Scenario,
  run: number,
  base: string,
  browser: Browser,
  uiChange: boolean,
): Promise<RunRecord> {
  await resetApp(base);
  const alice = await Person.signIn(base, "alice", "acme");
  if (scenario.setup === "human-submits") await alice.submit();
  const seed = (await snapshot(base)).plan.values;

  const meter = new Meter();
  const browserVariant = variant === "v1" || variant === "v2";
  const faultApplies = !(scenario.kind === "navigation" && !browserVariant);
  let page: Page | null = null;
  let dropped = false;
  const faults: FetchFaults =
    scenario.kind === "lost-response"
      ? {
          dropResponse: (url, method) => {
            if (dropped || method !== "POST") return false;
            if (!/\/tools\/set_value$|\/axe\/actions\/plan\.set-value$/.test(url)) return false;
            dropped = true;
            return true;
          },
        }
      : {};
  const runKey = `eval-${variant}-${scenario.id}-${run}-${Date.now()}`;
  const make = (): Promise<Driver> => {
    if (browserVariant)
      return openBrowserDriver({
        browser,
        base,
        markup: variant === "v1" ? "generic" : "semantic",
        meter,
        loseFirstSave: scenario.kind === "lost-response",
        onPage: (p) => (page = p),
      });
    return variant === "v3"
      ? openBasicDriver({ base, meter, faults, runKey })
      : openAxeDriver({ base, meter, faults, runKey });
  };
  const hooks: Hooks = {
    beforeCommit: async (attempt) => {
      if (attempt === 1 && scenario.humanCells) await alice.save(scenario.humanCells);
    },
    afterStep: async (step) => {
      if (scenario.kind === "restart" && step === 2) throw new Crash();
      if (scenario.kind === "navigation" && step === 1 && page) await page.goto("/history");
    },
    approve: (id) => alice.approve(id),
    lockForAgent: () => alice.lock(),
  };

  let report: PolicyReport = {
    reported: null,
    interventions: 0,
    writeAttempts: 0,
    conflicts: 0,
    refusals: 0,
    lostResponses: 0,
    restarts: 0,
    completedBy: "nobody",
    notes: [],
  };
  let error: string | null = null;
  let latencyMs = 0;
  let setupRequests = 0;
  let setupBytes = 0;
  try {
    const first = await make();
    setupRequests = meter.httpRequests;
    setupBytes = meter.httpBytesIn + meter.httpBytesOut + meter.agentBytesIn + meter.agentBytesOut;
    meter.reset();
    let lives = 0;
    const t0 = performance.now();
    try {
      report = await runAgent(
        scenario.goal,
        () => (lives++ === 0 ? Promise.resolve(first) : make()),
        hooks,
      );
    } finally {
      latencyMs = performance.now() - t0;
    }
  } catch (e) {
    error = (e as Error).message.split("\n")[0]!.slice(0, 300);
  }
  const outcome = checkOutcome(scenario, seed, await snapshot(base), report);
  if (error) outcome.success = false;
  return {
    variant,
    scenario: scenario.id,
    run,
    uiChange,
    outcome,
    report,
    recovered: hasRecoverableFault(scenario.kind) && faultApplies ? outcome.success : null,
    faultApplies,
    latencyMs: Math.round(latencyMs),
    httpRequests: meter.httpRequests,
    httpBytes: meter.httpBytesIn + meter.httpBytesOut,
    agentMessages: meter.agentMessages,
    agentBytes: meter.agentBytesIn + meter.agentBytesOut,
    setupRequests,
    setupBytes,
    tokens: "n/a",
    error,
  };
}

export interface CellSummary {
  variant: VariantId;
  scenario: string;
  runs: number;
  successes: number;
  successRate: number;
  wilson95: { low: number; high: number };
  incorrectMutations: number;
  recovered: string;
  interventions: number;
  writeAttempts: number;
  conflicts: number;
  refusals: number;
  completedBy: string;
  medianHttpRequests: number;
  medianHttpBytes: number;
  medianAgentBytes: number;
  medianLatencyMs: number;
  maxLatencyMs: number;
  faultApplies: boolean;
  errors: string[];
  mismatches: string[];
}

export function summarize(records: RunRecord[]): CellSummary[] {
  const out: CellSummary[] = [];
  const keys = [...new Set(records.map((r) => `${r.variant}|${r.scenario}`))];
  for (const key of keys) {
    const [variant, scenario] = key.split("|") as [VariantId, string];
    const rs = records.filter((r) => r.variant === variant && r.scenario === scenario);
    const k = rs.filter((r) => r.outcome.success).length;
    const rec = rs.filter((r) => r.recovered !== null);
    out.push({
      variant,
      scenario,
      runs: rs.length,
      successes: k,
      successRate: k / rs.length,
      wilson95: wilson(k, rs.length),
      incorrectMutations: rs.reduce((a, r) => a + r.outcome.incorrectMutations, 0),
      recovered: rec.length ? `${rec.filter((r) => r.recovered).length}/${rec.length}` : "n/a",
      interventions: median(rs.map((r) => r.report.interventions)),
      writeAttempts: median(rs.map((r) => r.report.writeAttempts)),
      conflicts: median(rs.map((r) => r.report.conflicts)),
      refusals: median(rs.map((r) => r.report.refusals)),
      completedBy: [...new Set(rs.map((r) => r.report.completedBy))].join("/"),
      medianHttpRequests: median(rs.map((r) => r.httpRequests)),
      medianHttpBytes: median(rs.map((r) => r.httpBytes)),
      medianAgentBytes: median(rs.map((r) => r.agentBytes)),
      medianLatencyMs: median(rs.map((r) => r.latencyMs)),
      maxLatencyMs: Math.max(...rs.map((r) => r.latencyMs)),
      faultApplies: rs[0]!.faultApplies,
      errors: [...new Set(rs.map((r) => r.error).filter((e): e is string => !!e))],
      mismatches: [...new Set(rs.flatMap((r) => r.outcome.mismatches))],
    });
  }
  return out;
}

function git(args: string[]): string {
  try {
    return execFileSync("git", args, { cwd: EXAMPLE_DIR, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function pkgVersion(name: string): string {
  try {
    const p = join(EXAMPLE_DIR, "node_modules", name, "package.json");
    return (JSON.parse(readFileSync(p, "utf8")) as { version: string }).version;
  } catch {
    return "unknown";
  }
}

async function main(): Promise<void> {
  const runs = Number(arg("runs", "5"));
  const maintenanceRuns = Number(arg("maintenance-runs", String(runs)));
  const variants = arg("variants", "v1,v2,v3,v4").split(",") as VariantId[];
  const scenarioIds = arg("scenarios", SCENARIOS.map((s) => s.id).join(",")).split(",");
  const scenarios = SCENARIOS.filter((s) => scenarioIds.includes(s.id));
  const port = Number(arg("port", "3117"));
  const now = new Date();
  const today = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((n) => String(n).padStart(2, "0"))
    .join("-");
  const date = arg("date", today);
  const outDir = arg("out", join(EXAMPLE_DIR, "..", "..", "docs", "review", "2026-09-24", "data"));
  const write = !process.argv.includes("--no-write");

  const browser = await chromium.launch({ headless: true });
  const started = new Date().toISOString();
  const records: RunRecord[] = [];
  const maintenance: RunRecord[] = [];
  try {
    for (const uiChange of [false, true]) {
      const n = uiChange ? maintenanceRuns : runs;
      if (n <= 0) continue;
      for (const v of variants) {
        const server = await startServer({ port, variant: v, uiChange });
        try {
          for (const s of scenarios)
            for (let i = 1; i <= n; i++) {
              const r = await runOne(v, s, i, server.base, browser, uiChange);
              (uiChange ? maintenance : records).push(r);
              log(
                `${uiChange ? "[ui change] " : ""}${v} ${s.id} #${i}: ${r.outcome.success ? "ok" : "FAIL"} ${r.latencyMs} ms${r.error ? ` (${r.error})` : ""}${r.outcome.mismatches.length ? ` ${r.outcome.mismatches.join("; ")}` : ""}`,
              );
            }
        } finally {
          await server.stop();
        }
      }
    }
  } finally {
    const env = {
      started,
      finished: new Date().toISOString(),
      commit: git(["rev-parse", "HEAD"]),
      branch: git(["rev-parse", "--abbrev-ref", "HEAD"]),
      dirty: git(["status", "--porcelain"]) !== "",
      node: process.version,
      os: `${platform()} ${release()} ${arch()}`,
      cpu: `${cpus()[0]?.model ?? "unknown"} x${cpus().length}`,
      memoryGb: Math.round(totalmem() / 2 ** 30),
      browser: `chromium ${browser.version()} (headless)`,
      playwright: pkgVersion("@playwright/test"),
      next: pkgVersion("next"),
      react: pkgVersion("react"),
      mcpSdk: pkgVersion("@modelcontextprotocol/sdk"),
      server: "next start (production build), one process, in-memory store, localhost",
    };
    await browser.close();
    const results = {
      kind: "axe-evaluation",
      version: 1,
      date,
      scripted: true,
      disclaimer:
        "Scripted runs, no model. Success here says what a deterministic client can do with each variant's interface; it is not evidence of how a model-driven agent performs.",
      environment: env,
      config: { runs, maintenanceRuns, variants, scenarios: scenarios.map((s) => s.id), port },
      variants: VARIANTS.filter((v) => variants.includes(v.id)),
      scenarios: scenarios.map(({ id, title, task, fault, kind }) => ({
        id,
        title,
        task,
        fault,
        kind,
      })),
      integration: integrationEffort(),
      summary: summarize(records),
      maintenanceSummary: summarize(maintenance),
      records,
      maintenance,
    };
    if (write) {
      mkdirSync(outDir, { recursive: true });
      const jsonPath = join(outDir, `evaluation-${date}.json`);
      writeFileSync(jsonPath, `${JSON.stringify(results, null, 2)}\n`);
      writeFileSync(join(outDir, `evaluation-${date}.md`), renderMarkdown(results));
      log(`wrote ${jsonPath} and the .md beside it`);
    }
  }
}

export type Results = {
  date: string;
  disclaimer: string;
  environment: Record<string, string | number | boolean>;
  config: { runs: number; maintenanceRuns: number; variants: string[]; scenarios: string[] };
  variants: { id: string; title: string; how: string }[];
  scenarios: { id: string; title: string; task: string; fault: string; kind: string }[];
  integration: ReturnType<typeof integrationEffort>;
  summary: CellSummary[];
  maintenanceSummary: CellSummary[];
};

if (process.argv[1] && /run\.ts$/.test(process.argv[1])) {
  main().catch((e) => {
    log(String((e as Error).stack ?? e));
    process.exit(1);
  });
}
