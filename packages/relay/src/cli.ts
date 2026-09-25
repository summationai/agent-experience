/**
 * `axe relay`: run the relay from the command line.
 *
 *   axe relay --dev                 development relay on 127.0.0.1:4717, MCP over HTTP
 *   axe relay --dev --stdio         the same, with MCP on stdio (Claude Code starts it)
 *   axe relay --stdio --principal <p> --tenant <t> --origin <o>
 *                                   one local agent acting for a named principal; tokens are
 *                                   signed with AXE_RELAY_SECRET
 *
 * A production relay with OAuth agents is a few lines of code with `createRelay` (docs/relay.md).
 */
import { parseArgs } from "node:util";
import { createRelay } from "./server";
import type { RelayPrincipal } from "./server";

export const DEFAULT_DEV_PORT = 4717;

export interface RelayCliIo {
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
  env?: Record<string, string | undefined>;
  /** Resolves when the process should stop (tests); default: SIGINT, SIGTERM, or stdio closing. */
  until?: Promise<void>;
}

const HELP = `axe relay — let an agent drive a signed-in person's live tab over MCP

Usage:
  axe relay --dev [--stdio] [--port <n>] [--origin <url>]...
  axe relay --stdio --principal <p> --tenant <t> --origin <url> [--port <n>] [--host <h>]

Options:
  --dev             Local development: loopback only, pairing codes, development tokens.
  --stdio           Serve MCP on stdio (for an agent that starts the relay itself).
  --port <n>        Port for tabs (and /mcp). Default ${DEFAULT_DEV_PORT}.
  --host <h>        Interface to listen on. Default 127.0.0.1.
  --origin <url>    Page origin allowed to connect (repeatable). Default in --dev: any localhost port.
  --principal, --tenant
                    Without --dev: who the stdio agent acts for; tabs sign in with tokens
                    minted by mintRelayToken with AXE_RELAY_SECRET.
  --dev-key <key>   Development bearer key for /mcp. Default: random per run.
`;

/** Run `axe relay`. Resolves with the exit code when the relay stops. */
export async function runRelayCli(argv: string[], io: RelayCliIo = {}): Promise<number> {
  const stdout = io.stdout ?? ((l: string) => process.stdout.write(l + "\n"));
  const stderr = io.stderr ?? ((l: string) => process.stderr.write(l + "\n"));
  const env = io.env ?? process.env;
  let values: Record<string, string | boolean | string[] | undefined>;
  try {
    values = parseArgs({
      args: argv,
      options: {
        dev: { type: "boolean" },
        stdio: { type: "boolean" },
        port: { type: "string" },
        host: { type: "string" },
        origin: { type: "string", multiple: true },
        principal: { type: "string" },
        tenant: { type: "string" },
        "dev-key": { type: "string" },
        help: { type: "boolean", short: "h" },
      },
      strict: true,
      allowPositionals: false,
    }).values;
  } catch (e) {
    stderr(`axe relay: ${e instanceof Error ? e.message : String(e)}\n\n${HELP}`);
    return 1;
  }
  if (values["help"]) {
    stdout(HELP);
    return 0;
  }
  const dev = values["dev"] === true;
  const stdio = values["stdio"] === true;
  // In stdio mode stdout carries MCP, so every human-readable line goes to stderr.
  const say = stdio ? stderr : stdout;
  const port = values["port"] === undefined ? DEFAULT_DEV_PORT : Number(values["port"]);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    stderr("axe relay: --port must be a port number.");
    return 1;
  }
  const host = (values["host"] as string | undefined) ?? "127.0.0.1";
  const origins = (values["origin"] as string[] | undefined) ?? [];
  let as: RelayPrincipal | undefined;
  if (!dev) {
    const principal = values["principal"] as string | undefined;
    const tenant = values["tenant"] as string | undefined;
    const secret = env["AXE_RELAY_SECRET"];
    if (!stdio || !principal || !tenant || !secret || origins.length === 0) {
      stderr(
        "axe relay: without --dev, run it as --stdio --principal <p> --tenant <t> --origin <url> with AXE_RELAY_SECRET set; for agents over HTTP with OAuth, use createRelay({ agentAuth }) in code (docs/relay.md).",
      );
      return 1;
    }
    as = { principal, tenant };
  }
  let relay: ReturnType<typeof createRelay>;
  try {
    relay = createRelay({
      ...(dev ? { devPairing: true } : { secret: env["AXE_RELAY_SECRET"]! }),
      ...(origins.length ? { origins } : {}),
      ...(values["dev-key"] ? { devAgentKey: String(values["dev-key"]) } : {}),
    });
  } catch (e) {
    stderr(`axe relay: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
  let address: Awaited<ReturnType<typeof relay.listen>>;
  try {
    address = await relay.listen({ host, port });
  } catch (e) {
    const code = (e as { code?: string }).code;
    stderr(
      code === "EADDRINUSE"
        ? `axe relay: port ${port} is in use (another relay?). Stop it, or pass --port and use the same port in the page.`
        : `axe relay: ${e instanceof Error ? e.message : String(e)}`,
    );
    await relay.close();
    return 1;
  }
  // Tests and wrappers read this line for the port.
  say(`axe relay: listening for tabs on ${address.tabUrl}`);
  if (dev) {
    say("");
    say("Development relay: loopback only, agents pair with the code shown in the tab.");
    say("");
    say("1. In your page (development builds only):");
    say(`     import { connectRelay, devToken } from "@axe/relay/client";`);
    say(
      `     connectRelay(surface, { url: "${address.tabUrl}", getToken: devToken("${address.url}") });`,
    );
    say("");
    if (stdio) {
      say("2. This process serves MCP on stdio for the agent that started it.");
    } else {
      say("2. Connect Claude Code to this relay (HTTP):");
      say(
        `     claude mcp add --transport http surface ${address.mcpUrl} --header "Authorization: Bearer ${relay.devAgentKey}"`,
      );
      say("   Or let Claude Code start the relay itself (stop this one first):");
      say(`     claude mcp add surface -- npx axe relay --dev --stdio`);
    }
    say("");
    say('3. Open the page. The tab shows a pairing code; tell the agent: "pair with code XXXX-XXXX".');
  }
  let stopped: () => void = () => undefined;
  const done = new Promise<void>((resolve) => (stopped = resolve));
  if (stdio) {
    const derived = await relay.serveStdio(as ? { as } : {});
    derived.server.onclose = () => stopped();
  }
  const onSignal = () => stopped();
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  await Promise.race([done, ...(io.until ? [io.until] : [])]);
  process.off("SIGINT", onSignal);
  process.off("SIGTERM", onSignal);
  await relay.close();
  return 0;
}
