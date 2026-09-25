import http from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
let client;
async function connect() {
client = new Client({ name: "try-surface-probe", version: "0.0.1" });
await client.connect(new StreamableHTTPClientTransport(new URL("http://127.0.0.1:4717/mcp"), { requestInit: { headers: { Authorization: "Bearer axd_f83238e7ba5dd506e046e142d9338df3c704caef3f4edabd" } } }));
}
await connect();
http.createServer(async (req, res) => {
  let body = ""; for await (const c of req) body += c;
  try {
    const { tool, args } = JSON.parse(body || "{}");
    if (!client.transport?.sessionId) await connect();
    const call = () => tool ? client.callTool({ name: tool, arguments: args ?? {} }) : client.listTools();
    let out;
    try { out = await call(); } catch (e) { if (!String(e).includes("Session not found")) throw e; await connect(); out = await call(); }
    res.end(JSON.stringify(out, null, 1));
  } catch (e) { res.statusCode = 500; res.end(String(e?.stack ?? e)); }
}).listen(4799, "127.0.0.1", () => console.log("probe ready on 4799"));
