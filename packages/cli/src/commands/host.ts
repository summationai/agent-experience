import { realpathSync } from "node:fs";
import type { CommandContext } from "../index";

/** `axe host`: unattended mode from `@axe/host` (docs/host.md). Loaded on use: it brings Playwright. */
export async function host(ctx: CommandContext): Promise<number> {
  const { runHostCli } = await import("@axe/host/cli");
  let script = process.argv[1] ?? "axe";
  try {
    script = realpathSync(script);
  } catch {
    // keep what we were started with
  }
  return runHostCli(ctx.args, {
    stdout: ctx.stdout,
    stderr: ctx.stderr,
    self: { command: process.execPath, args: [script, "host"] },
  });
}
