import { discover } from "@summationai/axe-client";
import type { Manifest } from "@summationai/axe-core/types";
import type { CommandContext } from "../index";
import { parse, requireUrl } from "./shared";

/** The affordance graph as text: which actions lead where. */
export function affordanceGraph(m: Manifest): string[] {
  const lines: string[] = [];
  for (const a of m.actions) {
    const outgoing = a.affordances ?? [];
    if (outgoing.length === 0) continue;
    for (const aff of outgoing) {
      lines.push(
        `  ${a.name} → ${aff.action}${aff.primary ? " (primary)" : ""}  binds ${
          Object.entries(aff.input)
            .map(([k, v]) => `${k}=${v}`)
            .join(", ") || "nothing"
        }`,
      );
    }
  }
  const targets = new Set(m.actions.flatMap((a) => (a.affordances ?? []).map((x) => x.action)));
  const roots = m.actions.filter((a) => a.readOnly && !targets.has(a.name)).map((a) => a.name);
  const orphans = m.actions
    .filter(
      (a) =>
        !a.readOnly &&
        !targets.has(a.name) &&
        !(m.flows ?? []).some((f) => f.steps.includes(a.name)),
    )
    .map((a) => a.name);
  if (roots.length) lines.push(`  entry points: ${roots.join(", ")}`);
  if (orphans.length) lines.push(`  not reachable from any read or flow: ${orphans.join(", ")}`);
  return lines;
}

export async function inspect(ctx: CommandContext): Promise<number> {
  const { values, positionals } = parse(ctx.args, { json: { type: "boolean" } });
  const url = requireUrl(positionals[0], "axe inspect <url>");
  const { manifest: m, manifestUrl, via } = await discover(url);
  if (values.json) {
    ctx.stdout(JSON.stringify(m, null, 2));
    return 0;
  }
  ctx.stdout(`${m.name}  (${m.protocol})`);
  ctx.stdout(`  ${m.description}`);
  ctx.stdout(`  manifest: ${manifestUrl} (via ${via})`);
  ctx.stdout(
    `  baseUrl: ${m.baseUrl}${m.humanFallbackUrl ? `   human site: ${m.humanFallbackUrl}` : ""}`,
  );
  ctx.stdout(
    `  auth modes: ${m.auth.modes.join(", ")}${m.auth.userLoginUrl ? `   login: ${m.auth.userLoginUrl}` : ""}`,
  );
  if (m.policies?.rateLimit)
    ctx.stdout(`  rate limit: ${m.policies.rateLimit.requestsPerMinute}/min`);
  if (m.policies?.agents)
    ctx.stdout(
      `  agents: allow ${m.policies.agents.allow?.join(", ") ?? "*"}; deny ${m.policies.agents.deny?.join(", ") ?? "(none)"}`,
    );
  ctx.stdout("");
  ctx.stdout(`Actions (${m.actions.length}):`);
  for (const a of m.actions) {
    const flags = [
      a.readOnly ? "read-only" : "mutating",
      `risk ${a.risk}`,
      `auth ${a.auth}`,
      a.idempotent ? "idempotent" : "",
      a.reversible ? "reversible" : "",
      a.deprecated
        ? `DEPRECATED${a.deprecated.replacedBy ? ` → ${a.deprecated.replacedBy}` : ""}`
        : "",
    ].filter(Boolean);
    ctx.stdout(`  ${a.name}  ${a.title}`);
    ctx.stdout(`    ${a.description}`);
    ctx.stdout(`    ${flags.join(" · ")}`);
    const props = Object.entries(
      (a.input["properties"] ?? {}) as Record<string, Record<string, unknown>>,
    );
    const required = (a.input["required"] ?? []) as string[];
    if (props.length)
      ctx.stdout(
        `    input: ${props.map(([k, v]) => `${k}${required.includes(k) ? "" : "?"}: ${String(v["type"] ?? (v["enum"] ? "enum" : "any"))}`).join(", ")}`,
      );
    if (a.display)
      ctx.stdout(
        `    display: ${a.display.kind}${a.display.items ? ` of ${a.display.items}` : ""}${a.display.item?.attributes ? `; attributes ${a.display.item.attributes.map((x) => x.label).join(", ")}` : ""}`,
      );
    if (a.examples?.length) ctx.stdout(`    examples: ${a.examples.length}`);
  }
  ctx.stdout("");
  ctx.stdout("Affordance graph:");
  const graph = affordanceGraph(m);
  for (const line of graph.length ? graph : ["  (no affordances declared)"]) ctx.stdout(line);
  if (m.flows?.length) {
    ctx.stdout("");
    ctx.stdout("Flows:");
    for (const f of m.flows) ctx.stdout(`  ${f.name}: ${f.steps.join(" → ")}  — ${f.description}`);
  }
  return 0;
}
