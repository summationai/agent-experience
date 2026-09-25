/**
 * The minimal MCP Apps view ([P-MCP-8]), EXPERIMENTAL: offered only to a host that declared the
 * `io.modelcontextprotocol/ui` extension with the `text/html;profile=mcp-app` type, with the
 * Markdown text as the result every other host shows.
 */
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { ClientCapabilities } from "@modelcontextprotocol/sdk/types.js";
import { createAXE, action, z } from "../../core/src/index";
import {
  APPS_EXTENSION,
  APPS_MIME_TYPE,
  PRESENTATION_META_KEY,
  PRESENTATION_URI,
  createMcpServer,
  serveHttp,
} from "../src/index";
import type { McpServerOptions } from "../src/index";
import { httpClient, text } from "./fixtures";
import { listen } from "./listen";
import type { Listening } from "./listen";

const APPS: ClientCapabilities = {
  extensions: { [APPS_EXTENSION]: { mimeTypes: [APPS_MIME_TYPE] } },
};

/** A site whose display action echoes text it was given, so escaping can be checked. */
export function echoSite() {
  const axe = createAXE({
    name: "Echo shop",
    description: "Finds products; titles echo the query.",
    baseUrl: "https://shop.example",
  });
  axe.register(
    action("products.search", {
      title: "Search products",
      description: "Finds products whose title matches the query.",
      readOnly: true,
      risk: "none",
      input: z.object({ q: z.string() }).strict(),
      output: z.object({
        items: z.array(z.object({ id: z.string(), title: z.string(), url: z.string() })),
      }),
      display: {
        kind: "list",
        items: "/items",
        item: { id: "/id", title: "/title", url: "/url" },
        disclaimer: "Prices change.",
      },
      handler: async ({ input }) => ({
        items: [{ id: "p1", title: `Lamp ${input.q}`, url: "https://shop.example/p1" }],
      }),
    }),
  );
  axe.register(
    action("orders.cancel", {
      title: "Cancel an order",
      description: "Cancels an order.",
      risk: "low",
      reversible: false,
      input: z.object({ id: z.string() }).strict(),
      output: z.object({ cancelled: z.string() }),
      handler: async ({ input }) => ({ cancelled: input.id }),
    }),
  );
  return axe;
}

async function connect(capabilities?: ClientCapabilities, options: McpServerOptions = {}) {
  const derived = await createMcpServer(echoSite(), options);
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await derived.server.connect(serverT);
  const client = new Client({ name: "host", version: "0" }, capabilities ? { capabilities } : {});
  await client.connect(clientT);
  return client;
}

const INJECTED = `<img src=x onerror="alert(1)"><script>alert(2)</script>`;

let servers: Listening[] = [];
afterEach(async () => {
  for (const s of servers) await s.close();
  servers = [];
});

describe("MCP Apps view", () => {
  it("a host that negotiated the extension gets the ui:// view on display tools and the escaped rendering with each result", async () => {
    const client = await connect(APPS);
    const { tools } = await client.listTools();
    const search = tools.find((t) => t.name === "products_search")!;
    expect(search._meta).toEqual({ ui: { resourceUri: PRESENTATION_URI } });
    expect(tools.find((t) => t.name === "orders_cancel")!._meta).toBeUndefined();

    const { resources } = await client.listResources();
    expect(resources).toEqual([
      expect.objectContaining({ uri: PRESENTATION_URI, mimeType: APPS_MIME_TYPE }),
    ]);
    const read = await client.readResource({ uri: PRESENTATION_URI });
    const view = read.contents[0] as { uri: string; mimeType: string; text: string };
    expect(view.mimeType).toBe("text/html;profile=mcp-app");
    // Self-contained: no external script, stylesheet, frame, or request.
    expect(view.text).not.toMatch(/<script[^>]+src=/i);
    expect(view.text).not.toMatch(/<link|<iframe|@import|fetch\(|XMLHttpRequest|https?:\/\//i);
    expect(view.text).toContain("ui/initialize");
    expect(view.text).toContain("ui/notifications/tool-result");

    const r = await client.callTool({ name: "products_search", arguments: { q: INJECTED } });
    const html = (r._meta as Record<string, { html: string }>)[PRESENTATION_META_KEY]!.html;
    expect(html).toContain("Lamp &lt;img src=x onerror=&quot;alert(1)&quot;&gt;&lt;script&gt;");
    expect(html).not.toContain(INJECTED);
    expect(html).toContain("Prices change.");
    // The text a host without Apps shows is unchanged: the Markdown comparison and the JSON.
    expect(text(r)).toContain("Prices change.");
    expect(text(r)).toContain("```json");
    const cancel = await client.callTool({ name: "orders_cancel", arguments: { id: "o1" } });
    expect(cancel._meta).toBeUndefined();
  });

  it("a host without the extension sees no view, no resource, and the same text result", async () => {
    const plain = await connect();
    const { tools } = await plain.listTools();
    expect(tools.every((t) => t._meta === undefined)).toBe(true);
    expect((await plain.listResources()).resources).toEqual([]);
    const r = await plain.callTool({ name: "products_search", arguments: { q: "x" } });
    expect(r._meta).toBeUndefined();

    const withApps = await connect(APPS);
    const r2 = await withApps.callTool({ name: "products_search", arguments: { q: "x" } });
    expect(text(r2)).toBe(text(r));

    // A host that declared the extension without the HTML view type is not offered it either.
    const otherType = await connect({
      extensions: { [APPS_EXTENSION]: { mimeTypes: ["text/x-other"] } },
    });
    expect((await otherType.listTools()).tools.every((t) => t._meta === undefined)).toBe(true);

    // And `apps: false` turns it off for everyone.
    const off = await connect(APPS, { apps: false });
    expect((await off.listTools()).tools.every((t) => t._meta === undefined)).toBe(true);
  });

  it("over HTTP sessions the view is negotiated per session", async () => {
    const handler = serveHttp(await createMcpServer(echoSite()), { sessions: true });
    const l = await listen(handler);
    servers.push(l);
    const host = await httpClient(`${l.url}/mcp`, undefined, { capabilities: APPS });
    const plain = await httpClient(`${l.url}/mcp`);
    const hostTools = (await host.client.listTools()).tools;
    const plainTools = (await plain.client.listTools()).tools;
    expect(hostTools.find((t) => t.name === "products_search")!._meta).toEqual({
      ui: { resourceUri: PRESENTATION_URI },
    });
    expect(plainTools.every((t) => t._meta === undefined)).toBe(true);
    await host.client.close();
    await plain.client.close();
    await handler.close();
  });
});
