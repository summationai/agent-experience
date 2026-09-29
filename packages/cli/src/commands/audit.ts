import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runAudit, formatAuditTable, formatAuditHtml } from "@summationai/axe-testing";
import type { CommandContext } from "../index";
import { parse, requireUrl } from "./shared";

export async function audit(ctx: CommandContext): Promise<number> {
  const { values, positionals } = parse(ctx.args, {
    auth: { type: "string" },
    "no-mutate": { type: "boolean" },
    json: { type: "boolean" },
    html: { type: "string" },
    browser: { type: "boolean" },
    "min-score": { type: "string" },
    vendor: { type: "string" },
  });
  const url = requireUrl(positionals[0], "axe audit <url>");
  const options: Parameters<typeof runAudit>[1] = {};
  if (values.auth) options.auth = String(values.auth);
  if (values["no-mutate"]) options.noMutate = true;
  if (values.browser) options.browser = true;
  if (values.vendor) options.vendor = String(values.vendor);
  const report = await runAudit(url, options);
  if (values.json) ctx.stdout(JSON.stringify(report, null, 2));
  else ctx.stdout(formatAuditTable(report, { color: process.stdout.isTTY ?? false }));
  if (values.html) {
    const out = resolve(String(values.html));
    writeFileSync(out, formatAuditHtml(report));
    ctx.stdout(`Wrote ${out}`);
  }
  const min = values["min-score"] !== undefined ? Number(values["min-score"]) : undefined;
  if (min !== undefined && Number.isFinite(min) && report.score < min) {
    ctx.stderr(`AXE Score ${report.score} is below --min-score ${min}.`);
    return 1;
  }
  return 0;
}
