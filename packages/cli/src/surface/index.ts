/**
 * `axe surface <subcommand>`: add Surface to an existing application and check what agents see.
 *
 *   axe surface init        detect the app, print the smallest diff, apply it
 *   axe surface coverage    open the app headless and report coverage gaps
 *   axe surface prompt      print the integration prompt for a coding agent
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as WIRE from "@axe/core/vocabulary";
import type { CommandContext } from "../index";
import { surfaceInit } from "./init";
import { surfaceCoverage } from "./coverage";

export const SURFACE_HELP = `Usage:
  ${WIRE.cli.surfaceInit} [--dir <app>] [--framework auto|react-router|next|vite-react|react|plain]
                    [--mount <layout file>] [--flag <ENV_VAR>|<module>#<export>]
                    [--flag-hook '<hook call>' --flag-import <module>] [--remote]
                    [--relay <url>|--relay-dev]
                    [--dry-run] [--yes] [--install] [--vendor <dir>]
  ${WIRE.cli.surfaceCoverage} <url> [--auth <header|cookies>]... [--routes /a,/b] [--max-pages <n>]
                    [--wait <ms>] [--playwright-from <dir>] [--json] [--out <report.md>]
  ${WIRE.cli.surface} prompt       print the integration prompt (templates/integrate-surface.md)`;

/** The prompt pack, shipped in the package beside dist/. */
export function promptPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const candidate of [join(here, "..", "templates"), join(here, "..", "..", "templates")]) {
    const p = join(candidate, "integrate-surface.md");
    if (existsSync(p)) return p;
  }
  throw new Error("templates/integrate-surface.md is missing from this install of the CLI.");
}

export async function surface(ctx: CommandContext): Promise<number> {
  const [sub, ...rest] = ctx.args;
  const next: CommandContext = { ...ctx, args: rest };
  switch (sub) {
    case "init":
      return surfaceInit(next);
    case "coverage":
      return surfaceCoverage(next);
    case "prompt":
      ctx.stdout(readFileSync(promptPath(), "utf8").trimEnd());
      return 0;
    case undefined:
    case "--help":
    case "-h":
      ctx.stdout(SURFACE_HELP);
      return sub === undefined ? 1 : 0;
    default:
      ctx.stderr(`Unknown subcommand "${sub}".\n\n${SURFACE_HELP}`);
      return 1;
  }
}
