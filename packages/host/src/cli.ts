/**
 * `axe host`: unattended mode from the command line, for local development.
 *
 *   axe host login <app url> [--state <file>]
 *                    open a visible browser once, sign in, and save the session (storage state)
 *   axe host --dev --app <url> [--start <path>] [--state <file>] [--port <n>] [--stdio]
 *                    run the app headless for a development identity and serve MCP (HTTP or stdio)
 *
 * Production is code: `createHost({ appUrl, agentAuth, sessionFor })`, with OAuth in the agent and
 * the application's own `sessionFor` (docs/host.md).
 */
import { parseArgs } from "node:util";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline";
import { createHost } from "./host";
import type { HostEvent } from "./host";
import { storageStateSession } from "./session";

export const DEFAULT_HOST_PORT = 4718;
export const DEFAULT_STATE_FILE = ".axe/host-state.json";

export interface HostCliIo {
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
  /** Where relative paths resolve. Default `process.cwd()`. */
  cwd?: string;
  /** Resolves when the process should stop (tests); default: SIGINT, SIGTERM, or stdio closing. */
  until?: Promise<void>;
  /** How to run this command again, for the printed agent configuration. Default: this node and script. */
  self?: { command: string; args: string[] };
  /** Where `login` waits for Enter; null waits only for the window to close (or `until`). */
  stdin?: NodeJS.ReadableStream | null;
}

const HELP = `axe host — unattended mode: the agent drives the app in a headless browser, signed in as you

Usage:
  axe host login <app url> [--state <file>]
  axe host --dev --app <url> [--start <path>] [--state <file>] [--port <n>] [--stdio] [--name <n>]

Commands and options:
  login <app url>   Open a visible browser at the app; sign in; press Enter (or close the window).
                    The signed-in session is saved to --state (default ${DEFAULT_STATE_FILE}).
  --dev             Local development: loopback only, one identity ("dev"), the saved session.
  --app <url>       The application, e.g. http://localhost:5173.
  --start <path>    The page each session opens first. Default: the app URL.
  --state <file>    The storage state from \`axe host login\`. Default ${DEFAULT_STATE_FILE}.
  --stdio           Serve MCP on stdio (for an agent that starts the host itself).
  --port <n>        HTTP port for /mcp and the watch page. Default ${DEFAULT_HOST_PORT} (with --stdio: any free port).
  --name <n>        The MCP server's name in the printed agent configuration. Default "app".
  --agent-web       Experimental: serve the app to agents with nothing installed, as pages of links
                    (docs/agent-web.md). The site mounts agentSiteHandler at /agent; set
                    AXE_AGENT_WEB_SECRET to the secret it shares, and it answers the agent pages
                    from its own origin. With --site <origin> (default the app), --public <url>
                    (where agents reach these pages; default <site>/agent), --port (4719).
                    --text-in-url also offers links that take a typed value as ?text=.
                    --env-file <path> reads AXE_AGENT_WEB_SECRET, and the port from
                    AXE_AGENT_WEB_URL, from the site's env file.
  --webmcp          Experimental, with --stdio: serve the page's own WebMCP tools (SurfaceProvider
                    webMcp, exposeWebMcp, or document.modelContext.registerTool) instead of the
                    relay's. The page needs no relay connection. Chromium 150 or newer.
  --headed          Show the browser windows (debugging).
  --dev-key <key>   Development bearer key for /mcp. Default: random per run.

Production uses OAuth in the agent and the application's own sessionFor: see docs/host.md.
`;

function defaultSelf(): { command: string; args: string[] } {
  let script = process.argv[1] ?? "axe-host";
  try {
    script = realpathSync(script);
  } catch {
    // keep what we were started with
  }
  return { command: process.execPath, args: [script] };
}

function describeEvent(e: HostEvent): string | null {
  switch (e.type) {
    case "session.starting":
      return `session starting for ${e.principal} (${e.tenant})`;
    case "session.ready":
      return `session ready for ${e.principal} in ${e.ms} ms`;
    case "session.failed":
      return `session failed for ${e.principal}: ${e.reason}`;
    case "session.closed":
      return `session closed for ${e.principal} (${e.reason})`;
    case "session.crashed":
      return `session page went away for ${e.principal}; the next tool call restarts it`;
    case "request.blocked":
      return `refused ${e.navigation ? "a navigation" : "a request"} to ${e.origin}`;
    case "relay":
      return e.event.type === "tab.refused" ? `relay refused a tab: ${e.event.reason}` : null;
  }
}

/** Run `axe host`. Resolves with the exit code when it stops. */
export async function runHostCli(argv: string[], io: HostCliIo = {}): Promise<number> {
  const stdout = io.stdout ?? ((l: string) => process.stdout.write(l + "\n"));
  const stderr = io.stderr ?? ((l: string) => process.stderr.write(l + "\n"));
  const cwd = io.cwd ?? process.cwd();
  let values: Record<string, string | boolean | undefined>;
  let positionals: string[];
  try {
    const parsed = parseArgs({
      args: argv,
      options: {
        dev: { type: "boolean" },
        stdio: { type: "boolean" },
        webmcp: { type: "boolean" },
        "agent-web": { type: "boolean" },
        "text-in-url": { type: "boolean" },
        "env-file": { type: "string" },
        site: { type: "string" },
        public: { type: "string" },
        app: { type: "string" },
        start: { type: "string" },
        state: { type: "string" },
        port: { type: "string" },
        name: { type: "string" },
        headed: { type: "boolean" },
        headless: { type: "boolean" },
        "dev-key": { type: "string" },
        help: { type: "boolean", short: "h" },
      },
      strict: true,
      allowPositionals: true,
    });
    values = parsed.values as Record<string, string | boolean | undefined>;
    positionals = parsed.positionals;
  } catch (e) {
    stderr(`axe host: ${e instanceof Error ? e.message : String(e)}\n\n${HELP}`);
    return 1;
  }
  if (values["help"]) {
    stdout(HELP);
    return 0;
  }
  const statePath = resolve(cwd, (values["state"] as string | undefined) ?? DEFAULT_STATE_FILE);
  if (positionals[0] === "login") {
    const appUrl = positionals[1] ?? (values["app"] as string | undefined);
    if (!appUrl) {
      stderr("axe host login: give the app URL, e.g. axe host login http://localhost:5173");
      return 1;
    }
    return login(appUrl, statePath, values["headless"] === true, { stdout, stderr, io });
  }
  if (positionals.length) {
    stderr(`axe host: unknown command "${positionals[0]}".\n\n${HELP}`);
    return 1;
  }
  if (values["dev"] !== true) {
    stderr(
      "axe host: the command line runs development only (--dev). In production the agent signs in with OAuth and your application supplies sessionFor: createHost({ appUrl, agentAuth, sessionFor }) (docs/host.md).",
    );
    return 1;
  }
  const appUrl = values["app"] as string | undefined;
  if (!appUrl) {
    stderr("axe host: --app <url> is required, e.g. --app http://localhost:5173");
    return 1;
  }
  const stdio = values["stdio"] === true;
  // In stdio mode stdout carries MCP, so every human-readable line goes to stderr.
  const say = stdio ? stderr : stdout;
  const port =
    values["port"] === undefined ? (stdio ? 0 : DEFAULT_HOST_PORT) : Number(values["port"]);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    stderr("axe host: --port must be a port number.");
    return 1;
  }
  const start = values["start"] as string | undefined;
  const hasState = existsSync(statePath);
  if (values["agent-web"] === true) {
    // The site's own env file: the secret it shares, and the port it reaches this service on.
    let fileEnv: Record<string, string> = {};
    const envFile = values["env-file"] as string | undefined;
    if (envFile) {
      try {
        fileEnv = readEnvFile(envFile);
      } catch {
        stderr(`axe host: --env-file ${envFile}: cannot read it.`);
        return 1;
      }
    }
    const serviceUrl = fileEnv["AXE_AGENT_WEB_URL"];
    const filePort = serviceUrl ? Number(/:(\d+)(?:\/|$)/.exec(serviceUrl)?.[1] ?? NaN) : NaN;
    return serveAgentWeb({
      secret: process.env["AXE_AGENT_WEB_SECRET"] || fileEnv["AXE_AGENT_WEB_SECRET"] || "",
      appUrl,
      start,
      site: (values["site"] as string | undefined) ?? new URL(appUrl).origin,
      publicUrl: values["public"] as string | undefined,
      port:
        values["port"] !== undefined
          ? Number(values["port"])
          : Number.isFinite(filePort)
            ? filePort
            : 4719,
      name: values["name"] as string | undefined,
      textInUrl: values["text-in-url"] === true,
      headless: values["headed"] !== true,
      stdout: say,
      stderr,
      until: io.until,
    });
  }
  if (values["webmcp"] === true) {
    if (!stdio) {
      stderr("axe host: --webmcp serves MCP on stdio only for now; add --stdio.");
      return 1;
    }
    return serveWebMcp({
      appUrl,
      start,
      statePath: hasState ? statePath : null,
      headless: values["headed"] !== true,
      name: (values["name"] as string | undefined) ?? "app",
      self: io.self ?? defaultSelf(),
      stderr,
      until: io.until,
    });
  }
  let host: ReturnType<typeof createHost>;
  try {
    host = createHost({
      appUrl,
      ...(start ? { startPath: start } : {}),
      dev: values["dev-key"] ? { agentKey: String(values["dev-key"]) } : true,
      ...(hasState ? { sessionFor: storageStateSession(statePath) } : {}),
      browser: { headless: values["headed"] !== true },
      onEvent: (e) => {
        const line = describeEvent(e);
        if (line) stderr(`[host] ${line}`);
      },
    });
  } catch (e) {
    stderr(`axe host: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
  let address: Awaited<ReturnType<typeof host.listen>>;
  try {
    address = await host.listen({ host: "127.0.0.1", port });
  } catch (e) {
    const code = (e as { code?: string }).code;
    stderr(
      code === "EADDRINUSE"
        ? `axe host: port ${port} is in use (another host?). Stop it, or pass --port.`
        : `axe host: ${e instanceof Error ? e.message : String(e)}`,
    );
    await host.close();
    return 1;
  }
  const name = (values["name"] as string | undefined) ?? "app";
  const self = io.self ?? defaultSelf();
  const stdioArgs = [
    ...self.args,
    "--dev",
    "--stdio",
    "--app",
    appUrl,
    ...(start ? ["--start", start] : []),
    "--state",
    statePath,
  ];
  const quote = (s: string) => (/^[A-Za-z0-9_./:@=+-]+$/.test(s) ? s : JSON.stringify(s));
  // Tests and wrappers read this line for the port.
  say(`axe host: serving MCP on ${address.mcpUrl} for ${appUrl} (development, loopback only)`);
  say(
    hasState
      ? `Signed in with the session saved in ${statePath}.`
      : `No saved sign-in at ${statePath}: the app opens signed out. Run \`axe host login ${appUrl}\` once to sign in.`,
  );
  say("");
  if (stdio) {
    say("This process serves MCP on stdio for the agent that started it.");
  } else {
    say("Connect Claude Code to this host (HTTP):");
    say(
      `  claude mcp add --transport http ${name} ${address.mcpUrl} --header "Authorization: Bearer ${host.devAgentKey}"`,
    );
    say("Or let Claude Code start the host itself (stop this one first):");
    say(`  claude mcp add ${name} -- ${[self.command, ...stdioArgs].map(quote).join(" ")}`);
    say("");
    say("Claude Desktop (claude_desktop_config.json), which starts the host itself:");
    const desktop = { mcpServers: { [name]: { command: self.command, args: stdioArgs } } };
    for (const line of JSON.stringify(desktop, null, 2).split("\n")) say(`  ${line}`);
  }
  say("");
  say(`Watch the hidden session: ${address.watchUrl}`);
  say(
    "The session starts on the agent's first tool call; ask it to call relay_tabs or surface_observe.",
  );

  let stopped: () => void = () => undefined;
  const done = new Promise<void>((resolve) => (stopped = resolve));
  if (stdio) {
    const derived = await host.serveStdio();
    derived.server.onclose = () => stopped();
  }
  const onSignal = () => stopped();
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  await Promise.race([done, ...(io.until ? [io.until] : [])]);
  process.off("SIGINT", onSignal);
  process.off("SIGTERM", onSignal);
  await host.close();
  return 0;
}

/** `axe host --dev --agent-web`: the app as pages of links for agents with only web fetch. */
/** KEY=VALUE lines of an env file (comments, blanks, and `export ` prefixes allowed; quotes removed). */
export function readEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2]!.trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    out[m[1]!] = v;
  }
  return out;
}

async function serveAgentWeb(o: {
  secret: string;
  appUrl: string;
  start: string | undefined;
  site: string;
  publicUrl: string | undefined;
  port: number;
  name: string | undefined;
  textInUrl: boolean;
  headless: boolean;
  stdout: (l: string) => void;
  stderr: (l: string) => void;
  until: Promise<void> | undefined;
}): Promise<number> {
  const { createAgentWeb } = await import("./agent-web");
  const { randomBytes } = await import("node:crypto");
  let secret = o.secret;
  const generated = !secret;
  if (generated) secret = randomBytes(32).toString("base64url");
  if (secret.length < 32) {
    o.stderr("axe host: AXE_AGENT_WEB_SECRET must be at least 32 characters.");
    return 1;
  }
  // By default the site answers the agent pages itself (agentSiteHandler without agentUrl), so
  // every link an agent follows is on the site's own origin.
  const publicUrl = o.publicUrl ?? `${o.site.replace(/\/+$/, "")}/agent`;
  const web = createAgentWeb({
    publicUrl,
    siteUrl: o.site,
    appUrl: o.appUrl,
    ...(o.start ? { startPath: o.start } : {}),
    siteSecret: secret,
    appName: o.name ?? new URL(o.appUrl).hostname,
    textInUrl: o.textInUrl,
    browser: { headless: o.headless },
    onRequest: (e) =>
      o.stdout(
        `[agent-web] ${new Date().toISOString()} ${e.method} ${e.route}${e.kind ? ` (${e.kind})` : ""} ${e.status} ${e.ms}ms ${e.userAgent}${e.signals ? ` [${e.signals}]` : ""}`,
      ),
  });
  let address: { url: string; port: number };
  try {
    address = await web.listen({ host: "127.0.0.1", port: o.port });
  } catch (e) {
    o.stderr(`axe host: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
  o.stdout(`axe host: agent web for ${o.appUrl} on ${address.url} (experimental, development)`);
  o.stdout(`  agents start at: ${o.publicUrl ? `${publicUrl}/start` : publicUrl}`);
  o.stdout(
    `  the site's agent pages: ${o.site}/agent/...  (agentSiteHandler, serviceUrl ${address.url})`,
  );
  if (generated)
    o.stdout(`  AXE_AGENT_WEB_SECRET=${secret}   (generated; give the site the same value)`);
  if (/^https?:\/\/(localhost|127\.|\[::1\])/.test(publicUrl))
    o.stdout(
      "  Loopback suits Claude Desktop. An agent whose web fetch runs on its provider's servers needs the site on public HTTPS (docs/agent-web.md, cloudflared); this service stays on loopback.",
    );
  let stopped: () => void = () => undefined;
  const done = new Promise<void>((resolve) => (stopped = resolve));
  const onSignal = () => stopped();
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  await Promise.race([done, ...(o.until ? [o.until] : [])]);
  process.off("SIGINT", onSignal);
  process.off("SIGTERM", onSignal);
  await web.close();
  return 0;
}

/** `axe host --dev --webmcp --stdio`: the page's WebMCP tools over stdio, from a headless page. */
async function serveWebMcp(o: {
  appUrl: string;
  start: string | undefined;
  statePath: string | null;
  headless: boolean;
  name: string;
  self: { command: string; args: string[] };
  stderr: (l: string) => void;
  until: Promise<void> | undefined;
}): Promise<number> {
  const { createWebMcpBridge, openInBrowser, webMcpBridgeServer } = await import("./webmcp-bridge");
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
  let bridge: ReturnType<typeof createWebMcpBridge>;
  try {
    bridge = createWebMcpBridge({
      appUrl: o.appUrl,
      ...(o.start ? { startPath: o.start } : {}),
      ...(o.statePath ? { storageState: o.statePath } : {}),
      browser: { headless: o.headless },
      // The person may not see a browser window open (another desktop, a remote session), so the
      // link is in this process's log too; it never goes to the agent.
      showApprovalPage: (url, q) => {
        o.stderr(`axe host: approval needed for "${q.name}": ${url}`);
        return openInBrowser(url);
      },
    });
  } catch (e) {
    o.stderr(`axe host: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
  const args = [
    ...o.self.args,
    "--dev",
    "--webmcp",
    "--stdio",
    "--app",
    o.appUrl,
    ...(o.start ? ["--start", o.start] : []),
    ...(o.statePath ? ["--state", o.statePath] : []),
  ];
  const quote = (s: string) => (/^[A-Za-z0-9_./:@=+-]+$/.test(s) ? s : JSON.stringify(s));
  o.stderr(`axe host: serving ${o.appUrl}'s WebMCP tools on stdio (experimental, development)`);
  o.stderr(
    o.statePath
      ? `Signed in with the session saved in ${o.statePath}.`
      : `No saved sign-in: the app opens signed out. Run \`axe host login ${o.appUrl}\` once to sign in.`,
  );
  o.stderr(`  claude mcp add ${o.name} -- ${[o.self.command, ...args].map(quote).join(" ")}`);
  const server = webMcpBridgeServer(bridge, { name: o.name });
  let stopped: () => void = () => undefined;
  const done = new Promise<void>((resolve) => (stopped = resolve));
  const unsubscribe = server.onclose;
  server.onclose = () => {
    unsubscribe?.();
    stopped();
  };
  await server.connect(new StdioServerTransport());
  const onSignal = () => stopped();
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  await Promise.race([done, ...(o.until ? [o.until] : [])]);
  process.off("SIGINT", onSignal);
  process.off("SIGTERM", onSignal);
  await bridge.close();
  return 0;
}

/** `axe host login`: a visible browser at the app; the session is saved while it is open and at the end. */
async function login(
  appUrl: string,
  statePath: string,
  headless: boolean,
  ctx: {
    stdout: (l: string) => void;
    stderr: (l: string) => void;
    io: HostCliIo;
  },
): Promise<number> {
  const { stdout, stderr, io } = ctx;
  let url: URL;
  try {
    url = new URL(appUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("not http(s)");
  } catch {
    stderr(`axe host login: ${appUrl} is not an http(s) URL.`);
    return 1;
  }
  const { chromium } = await import("playwright-core");
  let browser: Awaited<ReturnType<typeof chromium.launch>>;
  try {
    browser = await chromium.launch({ headless });
  } catch (e) {
    const first = e instanceof Error ? (e.message.split("\n")[0] ?? "") : String(e);
    stderr(
      `axe host login: Chromium could not start (${first}). Install it with \`npx playwright install chromium\`.`,
    );
    return 1;
  }
  const context = await browser.newContext({
    viewport: null,
    ...(existsSync(statePath) ? { storageState: statePath } : {}),
  });
  const page = await context.newPage();
  await mkdir(dirname(statePath), { recursive: true });
  let saving: Promise<void> = Promise.resolve();
  const save = (): Promise<void> => {
    saving = saving.then(async () => {
      const state = await context.storageState();
      const tmp = `${statePath}.${process.pid}.tmp`;
      // The file holds the person's cookies: readable by this user only.
      await writeFile(tmp, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
      await rename(tmp, statePath);
    });
    return saving.catch(() => undefined);
  };
  try {
    await page.goto(url.href);
  } catch (e) {
    const first = e instanceof Error ? (e.message.split("\n")[0] ?? "") : String(e);
    stderr(`axe host login: the app did not load (${first}). Is it running?`);
    await browser.close();
    return 1;
  }
  stdout(`axe host login: sign in to ${url.origin} in the browser window that opened.`);
  stdout("When you are signed in, press Enter here (or close the window).");
  const timer = setInterval(() => void save(), 1000);
  const waits: Promise<unknown>[] = [
    new Promise((r) => page.once("close", r)),
    new Promise((r) => context.once("close", r)),
    new Promise((r) => browser.once("disconnected", r)),
  ];
  if (io.until) waits.push(io.until);
  const stdin = io.stdin === undefined ? process.stdin : io.stdin;
  const rl = stdin ? createInterface({ input: stdin }) : null;
  if (rl) waits.push(new Promise((r) => rl.once("line", r)));
  await Promise.race(waits);
  clearInterval(timer);
  rl?.close();
  if (stdin === process.stdin) process.stdin.pause();
  if (browser.isConnected()) await save();
  else await saving.catch(() => undefined);
  await browser.close().catch(() => undefined);
  if (!existsSync(statePath)) {
    stderr("axe host login: nothing was saved (the window closed before the page loaded).");
    return 1;
  }
  stdout(`Saved the signed-in session to ${statePath}.`);
  stdout(
    "It holds your cookies: keep it private and out of version control (add .axe/ to .gitignore).",
  );
  stdout(`Next: axe host --dev --app ${url.origin} --state ${statePath}`);
  return 0;
}
