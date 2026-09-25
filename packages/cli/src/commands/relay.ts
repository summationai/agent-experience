import { runRelayCli } from "@axe/relay/cli";
import type { CommandContext } from "../index";

/** `axe relay`: the relay from `@axe/relay` (docs/relay.md). */
export async function relay(ctx: CommandContext): Promise<number> {
  return runRelayCli(ctx.args, { stdout: ctx.stdout, stderr: ctx.stderr });
}
