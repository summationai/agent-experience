import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { spawn } from "node:child_process";
import { AXEClient } from "@summationai/axe-client";
import { present, toHTML } from "@summationai/axe-client/present";
import type { CommandContext } from "../index";
import { parse, parseJsonArg, requireUrl } from "./shared";

export async function preview(ctx: CommandContext): Promise<number> {
  const { values, positionals } = parse(ctx.args, {
    input: { type: "string", short: "i" },
    out: { type: "string", short: "o" },
    "no-open": { type: "boolean" },
    auth: { type: "string" },
    layout: { type: "string" },
  });
  const url = requireUrl(positionals[0], "axe preview <url> <action> [--input '<json>']");
  const actionName = positionals[1];
  if (!actionName) throw new Error("Usage: axe preview <url> <action> [--input '<json>']");
  const client = await AXEClient.discover(url, values.auth ? { auth: String(values.auth) } : {});
  const def = client.action(actionName);
  if (!def)
    throw new Error(
      `Action "${actionName}" is not in the manifest. Actions: ${client
        .manifest()
        .actions.map((a) => a.name)
        .join(", ")}`,
    );
  const input =
    parseJsonArg(values.input as string | undefined, "input") ?? def.examples?.[0]?.input;
  if (input === undefined)
    throw new Error(`Action "${actionName}" has no examples; pass --input '<json>'.`);
  if (!def.readOnly)
    ctx.stderr(`Warning: "${actionName}" is not read-only; preview will call it for real.`);
  const result = await client.invoke(actionName, input);
  if (result.status !== "ok") {
    ctx.stderr(`Action returned ${result.status}:\n${JSON.stringify(result, null, 2)}`);
    return 1;
  }
  const presented = present(def, result, client.manifest().brand);
  const layout =
    values.layout === "table" ? "table" : values.layout === "cards" ? "cards" : undefined;
  const html = toHTML(presented, {
    heading: `${def.title} — ${client.manifest().name}`,
    ...(layout ? { layout } : {}),
  });
  const out = resolve(String(values.out ?? `.axe-preview/${actionName}.html`));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  ctx.stdout(`Rendered ${presented.items.length} item(s) to ${out}`);
  if (!values["no-open"]) openInBrowser(out);
  return 0;
}

function openInBrowser(path: string): void {
  const cmd =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", path] : [path];
  try {
    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    child.on("error", () => undefined);
    child.unref();
  } catch {
    // Opening is best-effort.
  }
}
