// The WebMCP bridge against real headless Chromium: hand-written WebMCP tools, and a Surface in
// easy mode offered through WebMCP with no relay. Skipped where Chromium cannot start.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build } from "esbuild";
import { createServer } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ToolListChangedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createWebMcpBridge, webMcpBridgeServer } from "../src/webmcp-bridge";
import type { WebMcpBridge } from "../src/webmcp-bridge";
import { chromiumMissing } from "./helpers";

const missing = await chromiumMissing();

// Hand-written WebMCP: a counter, a tool that reloads the page mid-call, one that tries to leave.
const plain = (foreign: string, second = false) => `<!doctype html><title>Plain</title>
<p id="n">0</p><a id="next" href="/second">Second</a><script>
const mc = document.modelContext;
${
  second
    ? `mc.registerTool({ name: "second_only", description: "Only on the second page.",
  inputSchema: { type: "object", properties: {} }, execute: async () => ({ content: [{ type: "text", text: "second" }] }) });`
    : `mc.registerTool({ name: "add", description: "Add to the counter.", annotations: { readOnlyHint: false },
  inputSchema: { type: "object", properties: { by: { type: "number" } }, required: ["by"] },
  execute: async ({ by }) => { const n = document.getElementById("n"); n.textContent = String(Number(n.textContent) + by);
    return { content: [{ type: "text", text: "now " + n.textContent }], structuredContent: { n: Number(n.textContent) } }; } });
mc.registerTool({ name: "count", description: "Read the counter.", annotations: { readOnlyHint: true },
  inputSchema: { type: "object", properties: {} }, execute: async () => Number(document.getElementById("n").textContent) });
mc.registerTool({ name: "reload_midway", description: "Reloads the page and never answers.",
  inputSchema: { type: "object", properties: {} }, execute: () => new Promise(() => { location.reload(); }) });
mc.registerTool({ name: "leave", description: "Navigates to another origin.",
  inputSchema: { type: "object", properties: {} }, execute: async () => { location.href = ${JSON.stringify(foreign + "/steal")}; return "left"; } });
mc.registerTool({ name: "arm", description: "Arms the launcher.",
  inputSchema: { type: "object", properties: {} }, execute: async () => {
    // Like a Surface: the tools the call changed are registered again just after it answers.
    setTimeout(() => mc.registerTool({ name: "launch", description: "Armed: launches.",
      inputSchema: { type: "object", properties: {} }, execute: async () => "launched" }), 25);
    return "armed"; } });
mc.registerTool({ name: "go_second", description: "Goes to the second page.",
  inputSchema: { type: "object", properties: {} }, execute: async () => { setTimeout(() => document.getElementById("next").click(), 0); return "going"; } });`
}
</script>`;

// The same board the host tests use, with its Surface offered only through WebMCP.
const board = `<!doctype html><html><head><meta charset="utf-8"><title>Board</title></head>
<body data-signed-in="true"><main><h1>Board</h1>
<label>Display name <input id="name" value="Dana"></label>
<button id="add" type="button">Add one</button> <output id="count">0</output>
<button id="delete" type="button">Delete everything</button>
</main><script>
  let count = 0;
  document.getElementById("add").addEventListener("click", () => {
    count += 1; document.getElementById("count").textContent = String(count);
  });
  document.getElementById("delete").addEventListener("click", () => { window.deleted = true; });
</script><script src="/bundle.js"></script></body></html>`;

let app: Server;
let foreignServer: Server;
let origin = "";
const foreignHits: string[] = [];

const listen = (s: Server) =>
  new Promise<number>((r) => s.listen(0, "127.0.0.1", () => r((s.address() as AddressInfo).port)));

beforeAll(async () => {
  if (missing) return;
  const bundle = (
    await build({
      entryPoints: [fileURLToPath(new URL("./fixtures/webmcp-entry.ts", import.meta.url))],
      bundle: true,
      write: false,
      format: "iife",
      platform: "browser",
      target: "es2022",
      logLevel: "silent",
    })
  ).outputFiles[0]!.text;
  foreignServer = createServer((req, res) => {
    foreignHits.push(req.url ?? "/");
    res.end("foreign");
  });
  const foreign = `http://127.0.0.1:${await listen(foreignServer)}`;
  app = createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0];
    const html = (body: string) => {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(body);
    };
    if (path === "/bundle.js") {
      res.writeHead(200, { "Content-Type": "text/javascript" });
      return void res.end(bundle);
    }
    if (path === "/") return html(plain(foreign));
    if (path === "/second") return html(plain(foreign, true));
    if (path === "/board") return html(board);
    res.writeHead(404).end();
  });
  // `localhost`, not the IP: WebMCP needs a secure context, which loopback by name is.
  origin = `http://localhost:${await listen(app)}`;
});

afterAll(async () => {
  app?.close();
  foreignServer?.close();
});

async function connect(bridge: WebMcpBridge) {
  const server = webMcpBridgeServer(bridge);
  const client = new Client({ name: "bridge-test", version: "0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  let listChanged = 0;
  client.setNotificationHandler(ToolListChangedNotificationSchema, () => void (listChanged += 1));
  await Promise.all([server.connect(a), client.connect(b)]);
  return {
    client,
    listChanged: () => listChanged,
    call: (name: string, args: Record<string, unknown> = {}) =>
      client.callTool({ name, arguments: args }) as Promise<CallToolResult>,
    names: async () => (await client.listTools()).tools.map((t) => t.name).sort(),
  };
}

const text = (r: CallToolResult) =>
  r.content.map((c) => (c.type === "text" ? c.text : "")).join("\n");

describe.skipIf(missing)("WebMCP bridge: hand-written tools", () => {
  it("lists the page's tools as MCP tools with their hints, and runs one in the page", async () => {
    const bridge = createWebMcpBridge({ appUrl: origin });
    try {
      const mcp = await connect(bridge);
      const { tools } = await mcp.client.listTools();
      expect(tools.map((t) => t.name).sort()).toEqual([
        "add",
        "arm",
        "count",
        "go_second",
        "leave",
        "reload_midway",
      ]);
      const add = tools.find((t) => t.name === "add")!;
      expect(add.inputSchema).toMatchObject({ required: ["by"] });
      expect(tools.find((t) => t.name === "count")!.annotations?.readOnlyHint).toBe(true);
      expect(add.annotations?.readOnlyHint).toBe(false);

      const r = await mcp.call("add", { by: 5 });
      expect(r.isError).toBeFalsy();
      expect(text(r)).toBe("now 5");
      expect(r.structuredContent).toEqual({ n: 5 });
      expect(await bridge.page()!.textContent("#n")).toBe("5");
      // A non-MCP result (a bare number) comes back as JSON text.
      expect(text(await mcp.call("count"))).toBe("5");
    } finally {
      await bridge.close();
    }
  }, 30_000);

  it("returns an answer once the tools it changed are registered again", async () => {
    const bridge = createWebMcpBridge({ appUrl: origin });
    try {
      const mcp = await connect(bridge);
      expect(await mcp.names()).not.toContain("launch");
      expect(text(await mcp.call("arm"))).toBe("armed");
      // No polling: the list read right after the call already has the tool the call added.
      expect(await mcp.names()).toContain("launch");
    } finally {
      await bridge.close();
    }
  }, 30_000);

  it("follows the page to a new document: the tool list changes and the client is told", async () => {
    const bridge = createWebMcpBridge({ appUrl: origin });
    try {
      const mcp = await connect(bridge);
      await mcp.names();
      const before = mcp.listChanged();
      await mcp.call("go_second");
      await expect.poll(() => mcp.names(), { timeout: 5000 }).toEqual(["second_only"]);
      expect(mcp.listChanged()).toBeGreaterThan(before);
      expect(text(await mcp.call("second_only"))).toBe("second");
      const gone = await mcp.call("add", { by: 1 });
      expect(gone.isError).toBe(true);
      expect(text(gone)).toContain("no tool named add");
    } finally {
      await bridge.close();
    }
  }, 30_000);

  it("reports a call whose page reloaded underneath it as outcome unknown", async () => {
    const bridge = createWebMcpBridge({ appUrl: origin });
    try {
      const mcp = await connect(bridge);
      await mcp.names();
      const r = await mcp.call("reload_midway");
      expect(r.isError).toBe(true);
      expect(text(r)).toContain("whether it took effect is unknown");
      // The reloaded page registers its tools again.
      await expect.poll(() => mcp.names(), { timeout: 5000 }).toContain("add");
    } finally {
      await bridge.close();
    }
  }, 30_000);

  it("refuses a navigation off the application's origin, and the page stays", async () => {
    const bridge = createWebMcpBridge({ appUrl: origin });
    try {
      const mcp = await connect(bridge);
      await mcp.names();
      await mcp.call("leave");
      await new Promise((r) => setTimeout(r, 500));
      expect(foreignHits).toEqual([]);
      expect(new URL(bridge.page()!.url()).origin).toBe(origin);
      expect(await mcp.names()).toContain("add");
    } finally {
      await bridge.close();
    }
  }, 30_000);
});

describe.skipIf(missing)("WebMCP bridge: a Surface offered through WebMCP, no relay", () => {
  it("observes the page and acts on a control through the page's own Surface", async () => {
    const bridge = createWebMcpBridge({ appUrl: origin, startPath: "/board" });
    try {
      const mcp = await connect(bridge);
      const { tools } = await mcp.client.listTools();
      const names = tools.map((t) => t.name);
      expect(names).toContain("surface_observe");
      expect(names).toContain("surface_read");

      const observed = await mcp.call("surface_observe");
      expect(observed.isError).toBeFalsy();
      expect(text(observed)).toContain("Add one");

      const add = tools.find((t) => /add one/i.test(t.description ?? ""))!;
      expect(add, `no tool for "Add one" among ${names.join(", ")}`).toBeDefined();
      const r = await mcp.call(add.name);
      expect(r.isError, text(r)).toBeFalsy();
      expect(await bridge.page()!.textContent("#count")).toBe("1");
      expect(await bridge.page()!.evaluate(() => (window as { deleted?: boolean }).deleted)).toBe(
        undefined,
      );
    } finally {
      await bridge.close();
    }
  }, 30_000);

  it("refuses a high-risk control: the page has no approval UI, and no one would see one", async () => {
    const bridge = createWebMcpBridge({ appUrl: origin, startPath: "/board" });
    try {
      const mcp = await connect(bridge);
      const { tools } = await mcp.client.listTools();
      const del = tools.find((t) => /delete everything/i.test(t.description ?? ""))!;
      expect(del).toBeDefined();
      const r = await mcp.call(del.name);
      expect(r.isError).toBe(true);
      expect(await bridge.page()!.evaluate(() => (window as { deleted?: boolean }).deleted)).toBe(
        undefined,
      );
      // What the agent is told (recorded for docs/webmcp.md).
      console.info(`[bridge] high-risk refusal: ${text(r).slice(0, 300)}`);
    } finally {
      await bridge.close();
    }
  }, 30_000);
});

describe.skipIf(missing)("axe host --dev --webmcp --stdio", () => {
  it("serves the page's WebMCP tools to an agent that starts it, as Claude Desktop does", async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [
        "--import",
        "tsx",
        fileURLToPath(new URL("../src/bin.ts", import.meta.url)),
        "--dev",
        "--webmcp",
        "--stdio",
        "--app",
        origin,
        "--state",
        "/nonexistent/state.json",
      ],
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      stderr: "pipe",
    });
    const client = new Client({ name: "desktop-agent", version: "0" });
    await client.connect(transport);
    try {
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name)).toContain("add");
      const r = (await client.callTool({ name: "add", arguments: { by: 2 } })) as CallToolResult;
      expect(text(r)).toBe("now 2");
    } finally {
      await client.close();
    }
  }, 30_000);
});
