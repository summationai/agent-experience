// Variant v3's MCP server: the basic tool table (lib/basic-tools.ts) offered as MCP tools, each
// call forwarded to POST /tools/{name} with the agent's token. This is the thin wrapper a team
// writes around an existing endpoint set; its lines count toward v3's integration effort.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { BASIC_TOOLS } from "../lib/basic-tools";

export function basicMcpServer(opts: {
  base: string;
  token: string;
  fetch?: typeof fetch;
}): Server {
  const f = opts.fetch ?? fetch;
  const server = new Server(
    { name: "plan-review-basic-tools", version: "0.0.0" },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: BASIC_TOOLS }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    try {
      const res = await f(`${opts.base}/tools/${encodeURIComponent(req.params.name)}`, {
        method: "POST",
        headers: { authorization: `Bearer ${opts.token}`, "content-type": "application/json" },
        body: JSON.stringify(req.params.arguments ?? {}),
      });
      return { content: [{ type: "text", text: await res.text() }], isError: !res.ok };
    } catch (e) {
      return {
        content: [{ type: "text", text: `Request failed: ${(e as Error).message}` }],
        isError: true,
      };
    }
  });
  return server;
}
