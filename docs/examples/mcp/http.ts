// #region http
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { axeFetch } from "@axe/fetch";
import { createMcpServer, serveHttp } from "@axe/mcp";
import { axe } from "../apartments/site";

const app = new Hono();
const axeHandler = axeFetch(axe);

// The MCP server calls the same AXE instance in-process, so /mcp and /axe/* stay in sync.
const mcpHandler = serveHttp(await createMcpServer(axe));

app.all("/axe/*", (c) => axeHandler(c.req.raw));
app.get("/.well-known/axe.json", (c) => axeHandler(c.req.raw));
app.all("/mcp", (c) => mcpHandler(c.req.raw));

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) });
// #endregion http
