/**
 * Oakridge Rentals: run the conformance suite and the audit from a script instead of
 * the CLI, for example inside a custom CI step or a scheduled check against staging.
 */
import { writeFileSync } from "node:fs";
import {
  runConformance,
  formatConformanceTable,
  runAudit,
  formatAuditHtml,
  type ConformanceOptions,
} from "@axe/testing";

// #region conformance
const url = process.env.AXE_TARGET_URL ?? "https://staging.oakridge-rentals.example";

const options: ConformanceOptions = { vendor: "Oakridge CI" };
// A staging user's bearer token lets the suite call `user` actions and walk the ladder.
if (process.env.AXE_TEST_TOKEN) options.auth = process.env.AXE_TEST_TOKEN;
// Name an action and input known to return needs_input when no example does.
options.ladder = { action: "applications.submit", input: { unitId: "u_204" } };

const report = await runConformance(url, options);
console.log(formatConformanceTable(report));

const failed = report.checks.filter((c) => c.status === "fail");
for (const c of failed) console.error(`${c.id}: ${c.detail} (see ${c.docs}; spec ${c.requirements.join(", ")})`);

const ladderSkipped = report.checks.filter((c) => c.id.startsWith("ladder.") && c.status === "skip");
if (ladderSkipped.length > 0) {
  console.warn(`${ladderSkipped.length} ladder checks skipped: ${ladderSkipped[0]!.detail}`);
}

process.exitCode = report.ok ? 0 : 1;
// #endregion conformance

// #region audit
const audit = await runAudit(url, { ...options, browser: true });
writeFileSync("axe-audit.html", formatAuditHtml(audit));
console.log(`AXE Score ${audit.score}; ${audit.fixes.length} fixes; top: ${audit.fixes[0]?.title ?? "none"}`);
if (audit.hardFailure) console.error(`Hard failure: ${audit.hardFailure}`);
if (audit.score < 80) process.exitCode = 1;
// #endregion audit
