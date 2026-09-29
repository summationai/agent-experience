import { runConformance, formatConformanceTable } from "@summationai/axe-testing";
import type { CommandContext } from "../index";
import { parse, parseJsonArg, requireUrl } from "./shared";

export async function conformance(ctx: CommandContext): Promise<number> {
  const { values, positionals } = parse(ctx.args, {
    auth: { type: "string" },
    "no-mutate": { type: "boolean" },
    json: { type: "boolean" },
    ladder: { type: "string" },
    "ladder-input": { type: "string" },
    vendor: { type: "string" },
  });
  const url = requireUrl(positionals[0], "axe conformance <url>");
  const options: Parameters<typeof runConformance>[1] = {};
  if (values.auth) options.auth = String(values.auth);
  if (values["no-mutate"]) options.noMutate = true;
  if (values.vendor) options.vendor = String(values.vendor);
  if (values.ladder) {
    const input = parseJsonArg(values["ladder-input"] as string | undefined, "ladder-input") ?? {};
    options.ladder = { action: String(values.ladder), input: input as never };
  }
  const report = await runConformance(url, options);
  if (values.json) ctx.stdout(JSON.stringify(report, null, 2));
  else ctx.stdout(formatConformanceTable(report, { color: process.stdout.isTTY ?? false }));
  return report.ok ? 0 : 1;
}
