import { createServer } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import { createRelay } from "@summationai/axe-relay/server";
import type { Relay, RelayAddress } from "@summationai/axe-relay/server";
import { assertLocalMcpHost, serviceConfig } from "./config";
import type { McpServiceConfig } from "./config";

const SERVICE_NAME = "Agent Experience website relay";
const SERVICE_DESCRIPTION =
  "Connects an agent to a person's open website tab. Start with relay_tabs. If the tab is waiting for a development pairing code, ask the person for it and call relay_pair. Then use surface_read for page content, surface_observe for controls and their revision, surface_wait for slow work, and the surface action tools to act. Do not substitute generic browser automation or a nested CLI agent when these relay tools are available.";

export interface McpServiceAddress extends RelayAddress {
  /** Non-standard operational metadata for people configuring an MCP client. */
  discoveryUrl: string;
}

export interface McpService {
  readonly config: McpServiceConfig;
  readonly relay: Relay;
  readonly address: McpServiceAddress;
  close(): Promise<void>;
}

function metadata(origin: string) {
  const ws = origin.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  return {
    name: SERVICE_NAME,
    description: SERVICE_DESCRIPTION,
    development: true,
    transport: "streamable-http",
    mcpUrl: `${origin}/mcp`,
    tabUrl: `${ws}/tab`,
    authentication: {
      type: "bearer",
      environmentVariable: "AXE_MCP_AGENT_KEY",
    },
    workflow: [
      "Call relay_tabs.",
      "If unpaired, ask the person for the code shown in the website and call relay_pair.",
      "Use surface_read and surface_observe before acting.",
      "Use surface_wait for work that is still preparing.",
      "Use surface_set-field, surface_run-control, and surface_load-more instead of browser clicks.",
    ],
  };
}

/**
 * Start the local company-side MCP service. The service deliberately uses the relay's loopback-only
 * development identity and pairing mode for now; production replaces that with OAuth and signed
 * application tokens without changing the browser or tool protocol.
 */
export async function startMcpService(
  overrides: Partial<McpServiceConfig> = {},
): Promise<McpService> {
  const config = { ...serviceConfig(), ...overrides };
  assertLocalMcpHost(config.host);
  const relay = createRelay({
    devPairing: true,
    devAgentKey: config.agentKey,
    ...(config.origins ? { origins: config.origins } : {}),
    name: SERVICE_NAME,
    description: SERVICE_DESCRIPTION,
  });
  const sockets = new Set<Socket>();
  let origin = "";
  const server = createServer((request, response) => {
    const path = (request.url ?? "/").split("?")[0];
    if (path !== "/" && path !== "/.well-known/agent-experience.json") return;
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(JSON.stringify(metadata(origin), null, 2) + "\n");
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  relay.attach(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, () => {
      server.off("error", reject);
      resolve();
    });
  }).catch(async (error) => {
    await relay.close();
    throw error;
  });
  const bound = server.address() as AddressInfo;
  const shown = config.host.includes(":") ? `[${config.host}]` : config.host;
  origin = `http://${shown}:${bound.port}`;
  const address: McpServiceAddress = {
    url: origin,
    tabUrl: `ws://${shown}:${bound.port}/tab`,
    mcpUrl: `${origin}/mcp`,
    discoveryUrl: `${origin}/.well-known/agent-experience.json`,
    port: bound.port,
    host: config.host,
  };
  let closed = false;
  return {
    config,
    relay,
    address,
    async close() {
      if (closed) return;
      closed = true;
      await relay.close();
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
