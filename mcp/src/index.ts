import { pathToFileURL } from "node:url";
import { startHandoffMcpServiceFromEnv } from "./handoff";
import { startHostedMcpServiceFromEnv } from "./hosted";
import { startLocalUnattendedMcpServiceFromEnv } from "./local-unattended";
import { startMcpService } from "./service";

export { serviceConfig } from "./config";
export type { McpServiceConfig } from "./config";
export { startMcpService } from "./service";
export type { McpService, McpServiceAddress } from "./service";
export {
  brokeredSessionFor,
  hostedEnvironmentConfig,
  introspectionVerifier,
  startHostedMcpService,
  startHostedMcpServiceFromEnv,
  userInfoVerifier,
} from "./hosted";
export type { HostedEnvironmentConfig, HostedMcpService } from "./hosted";
export { connectorRegistryFromFile, createConnectorRegistry } from "./connectors";
export type {
  ConnectorDescriptor,
  ConnectorRegistry,
  ConnectorSummary,
  RegisteredConnector,
} from "./connectors";
export { startProviderService } from "./provider";
export type { ProviderAddress, ProviderOptions, ProviderService } from "./provider";
export { handoffEnvironmentConfig, startHandoffMcpServiceFromEnv } from "./handoff";
export type { HandoffEnvironmentConfig, HandoffMcpService } from "./handoff";
export {
  localUnattendedEnvironmentConfig,
  startLocalUnattendedMcpServiceFromEnv,
} from "./local-unattended";
export type {
  LocalUnattendedEnvironmentConfig,
  LocalUnattendedMcpService,
} from "./local-unattended";

async function main(): Promise<void> {
  if (process.env["AXE_MCP_MODE"] === "local-unattended") {
    const service = await startLocalUnattendedMcpServiceFromEnv(process.env, {
      onEvent: (event) => process.stdout.write(`[host] ${JSON.stringify(event)}\n`),
    });
    process.stdout.write(
      [
        `Agent Experience local unattended MCP service`,
        `  listening: ${service.address.mcpUrl}`,
        `  application: ${process.env["AXE_HOST_APP_URL"]}`,
        `  browser: hidden`,
        `  pairing: disabled`,
      ].join("\n") + "\n",
    );
    const stop = async () => {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      await service.close();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    return;
  }
  if (process.env["AXE_MCP_MODE"] === "handoff") {
    const service = await startHandoffMcpServiceFromEnv(process.env);
    process.stdout.write(
      [
        `Agent Experience browser-handoff MCP service`,
        `  listening: ${service.address.mcpUrl}`,
        `  public endpoint: ${process.env["AXE_HOST_PUBLIC_MCP_URL"]}`,
        `  application: ${process.env["AXE_HOST_APP_URL"]}`,
        `  authentication: ${process.env["AXE_HOST_AUTH_MODE"] === "local" ? "local application login" : "OAuth"}`,
        `  pairing: disabled`,
      ].join("\n") + "\n",
    );
    const stop = async () => {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      await service.close();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    return;
  }
  if (process.env["AXE_MCP_MODE"] === "hosted") {
    const service = await startHostedMcpServiceFromEnv(process.env, {
      onEvent: (event) => process.stdout.write(`[host] ${JSON.stringify(event)}\n`),
    });
    const applications = service.registry?.list().map((connector) => connector.displayName) ?? [];
    process.stdout.write(
      [
        `Agent Experience hosted MCP service`,
        `  listening: ${service.address.mcpUrl}`,
        `  public endpoint: ${process.env["AXE_HOST_PUBLIC_MCP_URL"]}`,
        `  applications: ${applications.join(", ")}`,
      ].join("\n") + "\n",
    );
    const stop = async () => {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      await service.close();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    return;
  }
  const service = await startMcpService();
  const { address, config } = service;
  process.stdout.write(
    [
      `Agent Experience MCP service`,
      `  website tabs: ${address.tabUrl}`,
      `  desktop agents: ${address.mcpUrl}`,
      `  service metadata: ${address.discoveryUrl}`,
      `  local bearer key: ${config.agentKey}`,
      ``,
      `Open the integrated website, copy its pairing code, then ask the agent to call relay_pair.`,
    ].join("\n") + "\n",
  );
  const stop = async () => {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    await service.close();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href)
  void main().catch((error) => {
    process.stderr.write(
      `Agent Experience MCP service failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
