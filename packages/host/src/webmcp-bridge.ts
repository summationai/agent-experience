/**
 * Experimental: serve a page's WebMCP tools as MCP, from a headless browser.
 *
 * WebMCP tools exist only inside a loaded page, for the agent built into that browser. The bridge
 * is that agent: it opens the application in headless Chromium with WebMCP enabled, follows the
 * tools the page registers through the DevTools protocol's WebMCP domain (`WebMCP.enable`,
 * `toolsAdded`, `toolsRemoved`, `invokeTool`, `toolResponded`), and serves them to an MCP client.
 * The page needs no relay and no connection code: `<SurfaceProvider webMcp>`, `exposeWebMcp`, or
 * any hand-written `document.modelContext.registerTool` is the whole integration.
 *
 * One page for one identity (development). The multi-identity session management, request rules,
 * and human handoff of `createHost` are not here yet; see docs/webmcp.md, "Headless bridge".
 */
import type { Browser, BrowserContext, CDPSession, Page } from "playwright-core";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import type { StorageState } from "./session";

/**
 * A tool the page registered, as the WebMCP domain reports it. The domain carries `readOnly`,
 * `untrustedContent`, and `autosubmit` of the page's annotations; a page's `consequentialHint`
 * does not reach the agent.
 */
export interface BridgedTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: { readOnly?: boolean; untrustedContent?: boolean; autosubmit?: boolean };
  frameId: string;
}

/** What the page's `execute` answered, as the WebMCP domain reports it. */
export interface BridgedResult {
  status: "Completed" | "Canceled" | "Error";
  output?: unknown;
  errorText?: string;
}

export interface WebMcpBridgeOptions {
  /** The application, e.g. `http://localhost:5173`. Navigations off its origin are refused. */
  appUrl: string;
  /** The page opened first. Default: `appUrl`. */
  startPath?: string;
  /** A saved session (`axe host login`), loaded into the browser context. */
  storageState?: StorageState | string;
  browser?: {
    headless?: boolean;
    executablePath?: string;
    /** Supply your own browser. It must be Chromium started with `--enable-features=WebMCP`. */
    launch?: () => Promise<Browser>;
  };
  /** How long a page may take to load. Default 15000. */
  navigationTimeoutMs?: number;
  /** How long `tools()` waits for a page that has registered nothing yet. Default 5000. */
  toolsTimeoutMs?: number;
  /** How long one tool call may run before it is cancelled. Default 60000. */
  callTimeoutMs?: number;
  /**
   * After a tool answers, how long the page's tool registrations must be quiet before the answer
   * is returned (a page re-registers the tools a call changed just after it answers). Default 60;
   * never more than 500 in all.
   */
  settleMs?: number;
}

export interface WebMcpBridge {
  /** The tools the page's main frame offers now, starting the page if needed. */
  tools(): Promise<BridgedTool[]>;
  /** Run one tool in the page. */
  call(name: string, input: Record<string, unknown>): Promise<BridgedResult>;
  /** Called whenever the page's tool set changes. Returns the unsubscribe function. */
  onToolsChanged(listener: () => void): () => void;
  /** The page, once started (diagnostics and tests). */
  page(): Page | null;
  close(): Promise<void>;
}

/** Raised for a call whose outcome the bridge cannot know (the page went away mid-call). */
export class OutcomeUnknownError extends Error {
  readonly code = "outcome_unknown";
}

const originOf = (u: string): string | null => {
  try {
    return new URL(u).origin;
  } catch {
    return null;
  }
};

export function createWebMcpBridge(options: WebMcpBridgeOptions): WebMcpBridge {
  const appOrigin = originOf(options.appUrl);
  if (!appOrigin) throw new Error(`appUrl is not a URL: ${options.appUrl}`);
  const startUrl = new URL(options.startPath ?? "", options.appUrl).href;
  const navTimeout = options.navigationTimeoutMs ?? 15_000;
  const toolsTimeout = options.toolsTimeoutMs ?? 5_000;
  const callTimeout = options.callTimeoutMs ?? 60_000;
  const settleMs = options.settleMs ?? 60;

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let cdp: CDPSession | null = null;
  let mainFrameId = "";
  let starting: Promise<void> | null = null;
  let closed = false;
  // frameId -> name -> tool
  const byFrame = new Map<string, Map<string, BridgedTool>>();
  const pending = new Map<
    string,
    { resolve: (r: BridgedResult) => void; reject: (e: Error) => void }
  >();
  const early = new Map<string, BridgedResult>();
  const listeners = new Set<() => void>();
  let lastChange = 0;
  const changed = () => {
    lastChange = Date.now();
    for (const l of listeners) l();
  };
  // An answer returns once the tool list it caused has settled, so a tools/list right after a call
  // reads the page as the call left it.
  const settled = async (r: BridgedResult): Promise<BridgedResult> => {
    const answeredAt = Date.now();
    const deadline = answeredAt + 500;
    for (;;) {
      const quietSince = Math.max(answeredAt, lastChange);
      const wait = quietSince + settleMs - Date.now();
      if (wait <= 0 || Date.now() >= deadline) return r;
      await new Promise((res) => setTimeout(res, Math.min(wait, deadline - Date.now())));
    }
  };

  const mainTools = (): BridgedTool[] => [...(byFrame.get(mainFrameId)?.values() ?? [])];

  const dropFrame = (frameId: string) => {
    if (byFrame.delete(frameId)) changed();
    // A call in flight when its document goes away never responds, and it may or may not have run.
    if (frameId === mainFrameId)
      for (const [id, p] of pending) {
        pending.delete(id);
        p.reject(
          new OutcomeUnknownError(
            "The page navigated or reloaded while the tool was running, so whether it took effect is unknown. Read the page again before retrying.",
          ),
        );
      }
  };

  const start = async (): Promise<void> => {
    if (options.browser?.launch) browser = await options.browser.launch();
    else {
      const { chromium } = await import("playwright-core");
      browser = await chromium.launch({
        headless: options.browser?.headless ?? true,
        ...(options.browser?.executablePath
          ? { executablePath: options.browser.executablePath }
          : {}),
        args: ["--enable-features=WebMCP"],
      });
    }
    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      serviceWorkers: "block",
      ...(options.storageState ? { storageState: options.storageState } : {}),
    });
    // The page is the application's and nothing else: a navigation to another origin is answered
    // with 204, which leaves the page where it was.
    await context.route("**/*", (route, request) => {
      const origin = originOf(request.url());
      if (
        request.isNavigationRequest() &&
        request.frame() === page?.mainFrame() &&
        origin !== appOrigin
      )
        return route.fulfill({ status: 204, body: "" }).catch(() => undefined);
      return route.continue().catch(() => undefined);
    });
    page = await context.newPage();
    cdp = await context.newCDPSession(page);
    cdp.on("WebMCP.toolsAdded", (e) => {
      for (const t of e.tools) {
        const frame = byFrame.get(t.frameId) ?? new Map<string, BridgedTool>();
        byFrame.set(t.frameId, frame);
        frame.set(t.name, t);
      }
      changed();
    });
    cdp.on("WebMCP.toolsRemoved", (e) => {
      for (const t of e.tools) byFrame.get(t.frameId)?.delete(t.name);
      changed();
    });
    cdp.on("WebMCP.toolResponded", (e) => {
      const result: BridgedResult = {
        status: e.status,
        ...(e.output !== undefined ? { output: e.output } : {}),
        ...(e.errorText ? { errorText: e.errorText } : {}),
      };
      const p = pending.get(e.invocationId);
      // A quick tool can answer before `invokeTool` has returned its id to the caller.
      if (!p) return void early.set(e.invocationId, result);
      pending.delete(e.invocationId);
      p.resolve(result);
    });
    await cdp.send("WebMCP.enable").catch((e: unknown) => {
      throw new Error(
        `This Chromium has no WebMCP DevTools domain (${e instanceof Error ? e.message : String(e)}). It needs Chrome 150 or newer.`,
      );
    });
    // A new document in the main frame replaces its tools; the WebMCP domain reports the new
    // registrations but not the old document's end. Navigation is read on this same session, so it
    // is ordered with the tool events that follow it.
    await cdp.send("Page.enable");
    mainFrameId = (await cdp.send("Page.getFrameTree")).frameTree.frame.id;
    cdp.on("Page.frameNavigated", (e) => {
      if (!e.frame.parentId) dropFrame(e.frame.id);
    });
    page.on("close", () => dropFrame(mainFrameId));
    await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: navTimeout });
  };

  const ready = async (): Promise<void> => {
    if (closed) throw new Error("The bridge is closed.");
    if (page && !page.isClosed()) return;
    starting ??= start().finally(() => (starting = null));
    await starting;
  };

  return {
    async tools() {
      await ready();
      const until = Date.now() + toolsTimeout;
      while (mainTools().length === 0 && Date.now() < until)
        await new Promise((r) => setTimeout(r, 50));
      return mainTools();
    },

    async call(name, input) {
      await ready();
      const tool = mainTools().find((t) => t.name === name);
      if (!tool)
        throw new Error(
          `The page offers no tool named ${name} right now. List the tools again: the page may have changed.`,
        );
      const { invocationId } = await cdp!.send("WebMCP.invokeTool", {
        frameId: tool.frameId,
        toolName: name,
        // The protocol's input is any JSON object; Playwright's generated type says string values.
        input: input as Record<string, string>,
      });
      const answered = early.get(invocationId);
      if (answered) {
        early.delete(invocationId);
        return settled(answered);
      }
      const result = await new Promise<BridgedResult>((resolve, reject) => {
        const timer = setTimeout(() => {
          if (!pending.delete(invocationId)) return;
          void cdp?.send("WebMCP.cancelInvocation", { invocationId }).catch(() => undefined);
          reject(
            new OutcomeUnknownError(
              `The tool did not answer within ${callTimeout} ms and was cancelled; whether it took effect is unknown.`,
            ),
          );
        }, callTimeout);
        pending.set(invocationId, {
          resolve: (r) => (clearTimeout(timer), resolve(r)),
          reject: (e) => (clearTimeout(timer), reject(e)),
        });
      });
      return settled(result);
    },

    onToolsChanged(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    page: () => page,

    async close() {
      closed = true;
      await context?.close().catch(() => undefined);
      if (!options.browser?.launch) await browser?.close().catch(() => undefined);
      page = null;
      context = null;
      browser = null;
    },
  };
}

/** MCP's reading of a WebMCP tool: the same name, description, schema, and hints. */
export function toMcpTool(t: BridgedTool): Tool {
  const hints = t.annotations ?? {};
  return {
    name: t.name,
    ...(t.description ? { description: t.description } : {}),
    inputSchema: (t.inputSchema as unknown as Tool["inputSchema"]) ?? { type: "object" },
    annotations: {
      readOnlyHint: hints.readOnly === true,
      // The page's content is the application's data, not instructions to the agent.
      ...(hints.untrustedContent ? { openWorldHint: true } : {}),
    },
  };
}

/** MCP's reading of a WebMCP result: an MCP-shaped `output` passes through, a string as text, anything else as JSON. */
export function toMcpResult(r: BridgedResult): CallToolResult {
  if (r.status !== "Completed")
    return {
      content: [{ type: "text", text: r.errorText ?? `The tool ended with status ${r.status}.` }],
      isError: true,
    };
  const out = r.output as Partial<CallToolResult> | undefined;
  if (out && typeof out === "object" && Array.isArray(out.content)) return out as CallToolResult;
  if (typeof r.output === "string") return { content: [{ type: "text", text: r.output }] };
  return { content: [{ type: "text", text: JSON.stringify(r.output ?? null) }] };
}

/** An MCP server whose tools are the page's WebMCP tools, following them as they change. */
export function webMcpBridgeServer(
  bridge: WebMcpBridge,
  info: { name?: string; version?: string } = {},
): Server {
  const server = new Server(
    { name: info.name ?? "axe-webmcp-bridge", version: info.version ?? "0.0.0" },
    { capabilities: { tools: { listChanged: true } } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: (await bridge.tools()).map(toMcpTool),
  }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    try {
      return toMcpResult(await bridge.call(req.params.name, req.params.arguments ?? {}));
    } catch (e) {
      return {
        content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }],
        isError: true,
      };
    }
  });
  // Before a client connects there is no one to tell; the send rejects and is ignored.
  const unsubscribe = bridge.onToolsChanged(
    () => void server.sendToolListChanged().catch(() => undefined),
  );
  server.onclose = () => unsubscribe();
  return server;
}
