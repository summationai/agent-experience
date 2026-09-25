// Test harness: a small fixture application on a free loopback port (easy mode plus the injected
// relay connection), a second "foreign" origin, and the MCP SDK's client over real transports.
import { build } from "esbuild";
import { createServer } from "node:http";
import type { IncomingMessage, Server } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { ElicitRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { ElicitRequest, ElicitResult } from "@modelcontextprotocol/sdk/types.js";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { OAuthTokenVerifier } from "@modelcontextprotocol/sdk/server/auth/provider.js";

let bundled: Promise<string> | undefined;
/** The page script, bundled for the browser from the packages' source. */
export function pageBundle(): Promise<string> {
  bundled ??= build({
    entryPoints: [fileURLToPath(new URL("./fixtures/page-entry.ts", import.meta.url))],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: "es2022",
    logLevel: "silent",
  }).then((r) => r.outputFiles[0]!.text);
  return bundled;
}

/** Whether Playwright's Chromium can start here; the reason when it cannot. */
export async function chromiumMissing(): Promise<string | null> {
  try {
    const { chromium } = await import("playwright-core");
    const b = await chromium.launch();
    await b.close();
    return null;
  } catch (e) {
    return e instanceof Error ? (e.message.split("\n")[0] ?? "") : String(e);
  }
}

export interface Fixture {
  url: string;
  origin: string;
  /** Another origin (127.0.0.1 instead of localhost): a hosted page must never reach it. */
  foreign: string;
  /** Every request the app received: path and the `session` cookie it carried. */
  seen: { path: string; session: string | null; header: string | null }[];
  foreignHits: string[];
  close(): Promise<void>;
}

function cookieOf(req: IncomingMessage, name: string): string | null {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

function page(path: string, user: string | null, foreign: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Board ${esc(path)}</title></head>
<body><main>
<h1>Board</h1>
<p id="who">${user ? `Signed in as ${esc(user)}` : "Signed out"}</p>
<label>Display name <input id="name" value="${esc(user ?? "")}"></label>
<label>Greeting <input id="greeting" value=""></label>
<button id="add" type="button">Add one</button> <output id="count">0</output>
<button id="delete" type="button">Delete everything</button>
<a href="/other">Other page</a>
<a href="${foreign}/steal">Partner site</a>
</main>
<script>
  let count = 0;
  document.getElementById("add").addEventListener("click", () => {
    count += 1;
    document.getElementById("count").textContent = String(count);
  });
  document.getElementById("delete").addEventListener("click", () => { window.deleted = true; });
  document.getElementById("greeting").value = localStorage.getItem("greeting") ?? "";
</script>
<script src="/bundle.js"></script>
</body></html>`;
}

function listen(server: Server): Promise<number> {
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve((server.address() as AddressInfo).port)),
  );
}

/** The fixture application on `http://localhost:<port>`, and a foreign origin on `http://127.0.0.1:<port>`. */
export async function startFixture(): Promise<Fixture> {
  const bundle = await pageBundle();
  const seen: Fixture["seen"] = [];
  const foreignHits: string[] = [];
  const foreignServer = createServer((req, res) => {
    foreignHits.push(req.url ?? "/");
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<!doctype html><title>Foreign</title><p>foreign</p>");
  });
  const foreignPort = await listen(foreignServer);
  const foreign = `http://127.0.0.1:${foreignPort}`;
  const server = createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0]!;
    const header = req.headers["x-app-session"];
    seen.push({
      path,
      session: cookieOf(req, "session"),
      header: typeof header === "string" ? header : null,
    });
    if (path === "/bundle.js") {
      res.writeHead(200, { "Content-Type": "text/javascript" });
      return void res.end(bundle);
    }
    if (path === "/login") {
      // What `axe host login` captures: the app sets its session cookie when the person signs in.
      res.writeHead(200, {
        "Content-Type": "text/html",
        "Set-Cookie": "session=operator; Path=/; HttpOnly; SameSite=Lax",
      });
      return void res.end("<!doctype html><title>Signed in</title><p>signed in</p>");
    }
    if (path === "/" || path === "/other") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return void res.end(page(path, cookieOf(req, "session"), foreign));
    }
    res.writeHead(404).end();
  });
  const port = await listen(server);
  const origin = `http://localhost:${port}`;
  return {
    url: `${origin}/`,
    origin,
    foreign,
    seen,
    foreignHits,
    async close() {
      server.closeAllConnections();
      foreignServer.closeAllConnections();
      await Promise.all([
        new Promise<void>((r) => server.close(() => r())),
        new Promise<void>((r) => foreignServer.close(() => r())),
      ]);
    },
  };
}

/** Agent tokens for the OAuth verifier stand-in: token -> principal and tenant. */
export const AGENTS: Record<string, { sub: string; org: string }> = {
  "agent-alice": { sub: "alice", org: "acme" },
  "agent-bob": { sub: "bob", org: "acme" },
  "agent-alice-globex": { sub: "alice", org: "globex" },
};

export const verifier: OAuthTokenVerifier = {
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const a = AGENTS[token];
    if (!a) throw new InvalidTokenError("Unknown token");
    return {
      token,
      clientId: "claude-code",
      scopes: ["app"],
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      extra: { sub: a.sub, org: a.org },
    };
  },
};

export const agentAuth = {
  verifier,
  identify: (info: AuthInfo) => ({
    principal: String(info.extra!["sub"]),
    tenant: String(info.extra!["org"]),
  }),
};

export interface ToolResult {
  text: string;
  isError: boolean;
  content: { type: string; text?: string; data?: string; mimeType?: string }[];
  result: {
    status: string;
    output?: Record<string, unknown>;
    error?: { code: string; message: string; details?: Record<string, unknown> };
    rev?: number;
  };
}

export interface Agent {
  client: Client;
  call(name: string, args?: Record<string, unknown>): Promise<ToolResult>;
  close(): Promise<void>;
}

export function wrap(client: Client, close: () => Promise<void>): Agent {
  return {
    client,
    async call(name, args = {}) {
      const r = (await client.callTool({ name, arguments: args })) as {
        content?: ToolResult["content"];
        isError?: boolean;
        structuredContent?: unknown;
      };
      return {
        text: (r.content ?? []).map((c) => c.text ?? "").join("\n"),
        isError: !!r.isError,
        content: r.content ?? [],
        result: (r.structuredContent ?? {}) as ToolResult["result"],
      };
    },
    close,
  };
}

/** What the person does when the agent's client asks them (MCP form elicitation). */
export type Approver = (params: ElicitRequest["params"]) => ElicitResult;

/** The MCP SDK's client over Streamable HTTP with a bearer token; with `approve`, it declares form elicitation. */
export async function httpAgent(mcpUrl: string, token: string, approve?: Approver): Promise<Agent> {
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  const client = new Client(
    { name: "host-test-agent", version: "0" },
    approve ? { capabilities: { elicitation: { form: {} } } } : {},
  );
  if (approve) client.setRequestHandler(ElicitRequestSchema, (req) => approve(req.params));
  await client.connect(transport as unknown as Transport);
  return wrap(client, () => client.close());
}

export interface ObservedRow {
  id: string;
  name: string;
  kind: string;
  value?: unknown;
  state?: { available?: boolean };
}

/** Observe, and return the rev and the rows. */
export async function observe(agent: Agent): Promise<{ rev: number; rows: ObservedRow[] }> {
  const r = await agent.call("surface_observe", { limit: 200 });
  if (r.result.status !== "ok") throw new Error(`observe failed: ${r.text}`);
  const out = r.result.output as { rev: number; entries: ObservedRow[] };
  return { rev: out.rev, rows: out.entries };
}

export function row(rows: ObservedRow[], name: string): ObservedRow {
  const hit = rows.find((r) => r.name === name);
  if (!hit) throw new Error(`no row named "${name}" in: ${rows.map((r) => r.name).join(", ")}`);
  return hit;
}

/** Poll a condition until it holds, bounded. */
export async function until<T>(
  fn: () => T | undefined | false | null | Promise<T | undefined | false | null>,
  timeoutMs = 15_000,
): Promise<T> {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - start > timeoutMs) throw new Error("condition not met in time");
    await new Promise((r) => setTimeout(r, 25));
  }
}
