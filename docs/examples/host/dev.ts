// Unattended mode in development, in code: what `axe host --dev` does.
import { createHost, storageStateSession } from "@summationai/axe-host";

// #region dev
// Loopback only, one identity ("dev"), the session `axe host login` saved, and a key for /mcp.
const host = createHost({
  appUrl: "http://localhost:5173",
  startPath: "/dashboards",
  dev: true,
  sessionFor: storageStateSession(".axe/host-state.json"),
});
const address = await host.listen({ port: 4718 });
console.log(`MCP: ${address.mcpUrl} (Bearer ${host.devAgentKey}); watch: ${address.watchUrl}`);
// #endregion dev
