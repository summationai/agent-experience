/**
 * `axe`: the command-line tool for AXE.
 *
 *   axe init                         scaffold an axe.ts for your framework
 *   axe validate ./axe.ts            validate the manifest and lint descriptions
 *   axe inspect <url>                print a manifest as an agent sees it
 *   axe preview <url> <action>       call a read action and render it to HTML
 *   axe conformance <url>            run the conformance suite
 *   axe audit <url>                  AXE Score and fix list
 *   axe mcp <url>                    serve the site as an MCP server over stdio
 */
import { parseArgs } from "node:util";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as WIRE from "@axe/core/vocabulary";
import { init } from "./commands/init";
import { validate } from "./commands/validate";
import { inspect } from "./commands/inspect";
import { preview } from "./commands/preview";
import { conformance } from "./commands/conformance";
import { audit } from "./commands/audit";
import { mcp } from "./commands/mcp";

const HELP = `axe — Agentic eXperience Engineering CLI

Usage:
  ${WIRE.cli.init} [--framework express|next|fetch] [--dir <path>] [--yes]
  ${WIRE.cli.validate} <file.ts|file.js> [--json]
  ${WIRE.cli.inspect} <url> [--json]
  ${WIRE.cli.preview} <url> <action> [--input '<json>'] [--out <file.html>] [--no-open] [--auth <token>]
  ${WIRE.cli.conformance} <url> [--auth <token>] [--no-mutate] [--json] [--ladder <action> --ladder-input '<json>']
  ${WIRE.cli.audit} <url> [--json] [--html <file>] [--browser] [--min-score <n>] [--auth <token>] [--no-mutate]
  ${WIRE.cli.mcp} <url> [--auth <token>]

Options:
  -h, --help       Show this help
  -v, --version    Show the version

Docs: docs/README.md in the body-spray repository.`;

export interface CommandContext {
  args: string[];
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}

function version(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf8"),
    ) as { version: string };
    return pkg.version;
  } catch {
    return "0.0.0";
  }
}

/** Run the CLI with the given argv (without node and script). Returns the exit code. */
export async function run(
  argv: string[],
  io: { stdout?: (l: string) => void; stderr?: (l: string) => void } = {},
): Promise<number> {
  const stdout = io.stdout ?? ((l: string) => process.stdout.write(l + "\n"));
  const stderr = io.stderr ?? ((l: string) => process.stderr.write(l + "\n"));
  const { values, positionals } = parseArgs({
    args: argv,
    options: { help: { type: "boolean", short: "h" }, version: { type: "boolean", short: "v" } },
    strict: false,
    allowPositionals: true,
  });
  const [command, ...rest] = positionals as string[];
  if (values.version) {
    stdout(version());
    return 0;
  }
  if (!command || (values.help && !command)) {
    stdout(HELP);
    return command ? 0 : 1;
  }
  const ctx: CommandContext = { args: argv.slice(argv.indexOf(command) + 1), stdout, stderr };
  void rest;
  try {
    switch (`axe ${command}`) {
      case WIRE.cli.init:
        return await init(ctx);
      case WIRE.cli.validate:
        return await validate(ctx);
      case WIRE.cli.inspect:
        return await inspect(ctx);
      case WIRE.cli.preview:
        return await preview(ctx);
      case WIRE.cli.conformance:
        return await conformance(ctx);
      case WIRE.cli.audit:
        return await audit(ctx);
      case WIRE.cli.mcp:
        return await mcp(ctx);
      default:
        stderr(`Unknown command "${command}".\n\n${HELP}`);
        return 1;
    }
  } catch (e) {
    stderr(`axe ${command}: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
}

const isMain = (() => {
  try {
    return process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
  } catch {
    return false;
  }
})();

if (isMain || process.env["AXE_CLI_MAIN"] === "1") {
  run(process.argv.slice(2)).then((code) => {
    if (code !== 0) process.exitCode = code;
  });
}
