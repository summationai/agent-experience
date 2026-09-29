// Test harness: a relay on a free loopback port, pages in jsdom windows running the bundled
// client over the window's own WebSocket, and the MCP SDK's client over real transports.
import { build } from "esbuild";
import type { JSDOM } from "jsdom";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { ElicitRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { ElicitRequest, ElicitResult } from "@modelcontextprotocol/sdk/types.js";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { OAuthTokenVerifier } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { Surface } from "@summationai/axe-surface";
import type {
  connectRelay,
  devToken,
  localMcpService,
  injectedRelay,
  relayOptions,
  RelayConnection,
  RelayStatus,
} from "../src/client";
import type { autoSurface } from "@summationai/axe-surface/auto";
import { createRelay } from "../src/server";
import type { Relay, RelayAddress, RelayOptions } from "../src/server";

/**
 * Why the jsdom pages cannot run here, or null when they can. jsdom 30 needs Node 22 or newer
 * (its engines field); on Node 20 the page suites skip with this message, and the token, bundle,
 * CLI, and Chromium suites still run.
 */
export const noJsdom: string | null =
  Number(process.versions.node.split(".")[0]) >= 22
    ? null
    : `jsdom 30 needs Node 22 or newer; this is Node ${process.versions.node}`;
if (noJsdom) console.warn(`[relay tests] page suites skipped: ${noJsdom}`);

export const SECRET = "relay-test-secret-0123456789abcdef-0123";
export const APP_ORIGIN = "http://localhost:5173";

let bundled: Promise<string> | undefined;
/** The page script, bundled for the browser from the package source. */
export function pageBundle(): Promise<string> {
  bundled ??= build({
    entryPoints: [join(__dirname, "fixtures/page-entry.ts")],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: "es2022",
    logLevel: "silent",
  }).then((r) => r.outputFiles[0]!.text);
  return bundled;
}

export interface PageApi {
  createSurface: () => Surface;
  autoSurface: typeof autoSurface;
  connectRelay: typeof connectRelay;
  devToken: typeof devToken;
  localMcpService: typeof localMcpService;
  injectedRelay: typeof injectedRelay;
  relayOptions: typeof relayOptions;
}

export interface Page {
  dom: JSDOM;
  window: JSDOM["window"];
  api: PageApi;
  surface: Surface;
  /** Every handler call the page made, in order. */
  calls: string[];
  /** Status updates the connection reported. */
  statuses: RelayStatus[];
  connect(options: Omit<Parameters<typeof connectRelay>[1], "onStatus">): RelayConnection;
  /** Resolves when a status matching `pred` has been reported (now or later). */
  status(pred: (s: RelayStatus) => boolean, timeoutMs?: number): Promise<RelayStatus>;
  /** The indicator's shadow root, or null when none is shown. */
  indicator(): ShadowRoot | null;
  click(selector: string): void;
  close(): void;
}

export const SENSITIVE_VALUE = "hunter2-SECRET-VALUE-9f3a";

/** A small planning page: a name field, a sensitive field, a submit, a high-risk delete, a list. */
export function registerPlan(page: { surface: Surface; calls: string[] }): void {
  const { surface, calls } = page;
  let name = "Q3 plan";
  let loaded = 10;
  const registerName = () =>
    surface.register({
      id: "plan:name",
      kind: "field",
      role: "textbox",
      name: "Plan name",
      object: "plan",
      value: name,
      edit: {
        maxLength: 80,
        set: (text, actor) => {
          calls.push(`set-name:${text}:${actor}`);
          name = text;
          registerName();
          surface.bump();
        },
      },
    });
  registerName();
  surface.register({
    id: "account:token",
    kind: "field",
    role: "textbox",
    name: "API token",
    object: "account",
    value: SENSITIVE_VALUE,
    sensitive: true,
    edit: { set: () => calls.push("set-token") },
  });
  surface.register({
    id: "plan:submit",
    kind: "action",
    role: "button",
    name: "Submit the plan for review",
    object: "plan",
    effect: { mutates: "plan", risk: "medium", reversible: true },
    handler: (actor) => {
      calls.push(`submit:${actor}`);
      surface.bump();
    },
  });
  surface.register({
    id: "plan:delete",
    kind: "action",
    role: "button",
    name: "Delete the plan",
    object: "plan",
    effect: { mutates: "plan", risk: "high" },
    handler: (actor) => {
      calls.push(`delete:${actor}`);
      surface.bump();
    },
  });
  const registerRows = () =>
    surface.register({
      id: "plan:rows",
      kind: "collection",
      role: "grid",
      name: "Plan rows",
      total: 40,
      loaded,
      more: () => {
        calls.push("more");
        loaded += 10;
        registerRows();
        surface.bump();
      },
    });
  registerRows();
}

/** Open a page in a jsdom window with the bundled client. `storage` seeds sessionStorage (a reload). */
export async function openPage(
  options: {
    url?: string;
    storage?: Record<string, string>;
    /** What a host's init script sets before page scripts run: `window.__AXE_RELAY__`. */
    inject?: Record<string, unknown>;
    /** The page's body HTML. */
    body?: string;
  } = {},
): Promise<Page> {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM(
    `<!doctype html><html><head><title>Plan</title></head><body>${options.body ?? "<main>app</main>"}</body></html>`,
    {
      url: options.url ?? `${APP_ORIGIN}/plan`,
      runScripts: "outside-only",
      pretendToBeVisual: true,
    },
  );
  const window = dom.window;
  for (const [k, v] of Object.entries(options.storage ?? {})) window.sessionStorage.setItem(k, v);
  if (options.inject)
    (window as unknown as Record<string, unknown>)["__AXE_RELAY__"] = { ...options.inject };
  // jsdom has no fetch; the page's development-token helper uses Node's.
  (window as unknown as { fetch: typeof fetch }).fetch = fetch;
  window.eval(await pageBundle());
  const api = (window as unknown as { relayPage: PageApi }).relayPage;
  const surface = api.createSurface();
  const statuses: RelayStatus[] = [];
  const waiters = new Set<() => void>();
  const page: Page = {
    dom,
    window,
    api,
    surface,
    calls: [],
    statuses,
    connect(opts) {
      return api.connectRelay(surface, {
        ...opts,
        onStatus: (s) => {
          statuses.push(s);
          for (const w of [...waiters]) w();
        },
      });
    },
    status(pred, timeoutMs = 10_000) {
      return new Promise((resolve, reject) => {
        const check = () => {
          const hit = [...statuses].reverse().find(pred);
          if (!hit) return false;
          waiters.delete(check);
          clearTimeout(timer);
          resolve(hit);
          return true;
        };
        const timer = setTimeout(() => {
          waiters.delete(check);
          reject(new Error(`no matching status; last: ${JSON.stringify(statuses.at(-1))}`));
        }, timeoutMs);
        if (!check()) waiters.add(check);
      });
    },
    indicator() {
      const host = window.document.querySelector("[data-axe-relay-indicator]");
      return (host as HTMLElement | null)?.shadowRoot ?? null;
    },
    click(selector) {
      const el = page.indicator()?.querySelector(selector) as HTMLElement | null;
      if (!el) throw new Error(`no ${selector} in the indicator`);
      el.click();
    },
    close() {
      window.close();
    },
  };
  return page;
}

/** Poll a condition until it holds (a barrier on state another process moves), bounded. */
export async function until<T>(
  fn: () => T | undefined | false | null,
  timeoutMs = 10_000,
): Promise<T> {
  const start = Date.now();
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() - start > timeoutMs) throw new Error("condition not met in time");
    await new Promise((r) => setTimeout(r, 5));
  }
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
      scopes: ["relay"],
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      extra: { sub: a.sub, org: a.org },
    };
  },
};

export const agentAuth: RelayOptions["agentAuth"] = {
  verifier,
  identify: (info) => ({
    principal: String(info.extra!["sub"]),
    tenant: String(info.extra!["org"]),
  }),
};

export interface Running {
  relay: Relay;
  address: RelayAddress;
  frames: { direction: "in" | "out"; data: string }[];
}

export async function startRelay(options: Partial<RelayOptions> = {}): Promise<Running> {
  const frames: Running["frames"] = [];
  const relay = createRelay({
    secret: SECRET,
    origins: [APP_ORIGIN],
    ...(options.deferredAgentAuth ? {} : { agentAuth }),
    reconnectGraceMs: 3000,
    onFrame: (direction, _tab, data) => frames.push({ direction, data }),
    ...options,
  } as RelayOptions);
  const address = await relay.listen({ host: "127.0.0.1", port: 0 });
  return { relay, address, frames };
}

export interface Agent {
  client: Client;
  call(name: string, args?: Record<string, unknown>): Promise<ToolResult>;
  close(): Promise<void>;
}

export interface ToolResult {
  text: string;
  isError: boolean;
  /** The AXE result envelope. */
  result: {
    status: string;
    output?: Record<string, unknown>;
    error?: {
      code: string;
      message: string;
      retryable: boolean;
      details?: Record<string, unknown>;
    };
    rev?: number;
  };
}

export function toolResult(r: unknown): ToolResult {
  const x = r as {
    content?: { type: string; text?: string }[];
    isError?: boolean;
    structuredContent?: unknown;
  };
  return {
    text: (x.content ?? []).map((c) => c.text ?? "").join("\n"),
    isError: !!x.isError,
    result: (x.structuredContent ?? {}) as ToolResult["result"],
  };
}

export function wrap(client: Client, close: () => Promise<void>): Agent {
  return {
    client,
    async call(name, args = {}) {
      return toolResult(await client.callTool({ name, arguments: args }));
    },
    close,
  };
}

/** How a test client answers elicitation: the modes it declares and what the person does. */
export interface Elicitor {
  modes: { form?: boolean; url?: boolean };
  answer: (params: ElicitRequest["params"]) => ElicitResult | Promise<ElicitResult>;
}

/** An MCP SDK client that declares elicitation (when `elicit` is given) and answers it as the person would. */
export function elicitingClient(name: string, elicit?: Elicitor): Client {
  const client = new Client(
    { name, version: "0" },
    elicit
      ? {
          capabilities: {
            elicitation: {
              ...(elicit.modes.form ? { form: {} } : {}),
              ...(elicit.modes.url ? { url: {} } : {}),
            },
          },
        }
      : {},
  );
  if (elicit) client.setRequestHandler(ElicitRequestSchema, (req) => elicit.answer(req.params));
  return client;
}

/** The MCP SDK's client over Streamable HTTP, with a bearer token when supplied. */
export async function httpAgent(mcpUrl: string, token?: string, elicit?: Elicitor): Promise<Agent> {
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
    requestInit: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
  });
  const client = elicitingClient("relay-test-agent", elicit);
  await client.connect(transport as unknown as Transport);
  return wrap(client, () => client.close());
}
