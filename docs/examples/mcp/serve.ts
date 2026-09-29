// #region stdio
import { createMcpServer, serveStdio } from "@summationai/axe-mcp";
import { axe } from "../apartments/site";

// In-process: every tool call goes straight to axe.handle(); nothing touches the network.
const derived = await createMcpServer(axe, {
  client: { agent: { name: "oakridge-mcp", version: "0.1.0", vendor: "Oakridge Rentals" } },
});

console.error(`serving ${derived.manifest.name}: ${derived.tools.length} tools`);
await serveStdio(derived);
// #endregion stdio
