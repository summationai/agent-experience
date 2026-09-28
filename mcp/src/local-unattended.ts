import { resolve } from "node:path";
import { createHost, storageStateSession } from "@axe/host";
import type { HostAddress, HostEvent, HostOptions } from "@axe/host";

const DEFAULT_AGENT_KEY = "axd_agent_experience_local";
const DEFAULT_PORT = 4717;

export interface LocalUnattendedEnvironmentConfig {
  host: string;
  port: number;
  appUrl: string;
  connectorId: string;
  connectorName: string;
  surfaceId: string;
  startPath?: string;
  agentKey: string;
  principal: string;
  tenant: string;
  statePath?: string;
  executablePath?: string;
  allowedOrigins?: string[];
}

export interface LocalUnattendedMcpService {
  readonly address: HostAddress;
  close(): Promise<void>;
}

type LocalUnattendedDependencies = { onEvent?: (event: HostEvent) => void };

function required(env: Record<string, string | undefined>, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required in local-unattended mode.`);
  return value;
}

function appUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("AXE_HOST_APP_URL must be an absolute loopback http(s) URL.");
  }
  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    !["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsed.hostname)
  )
    throw new Error("AXE_HOST_APP_URL must be an absolute loopback http(s) URL.");
  return parsed.href;
}

function port(value: string | undefined): number {
  if (!value) return DEFAULT_PORT;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65_535)
    throw new Error("PORT must be an integer from 0 to 65535.");
  return parsed;
}

function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[ ,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Laptop-only headless mode. It deliberately accepts only a loopback application and listener;
 * production identity and application-session exchange belong to hosted mode.
 */
export function localUnattendedEnvironmentConfig(
  env: Record<string, string | undefined> = process.env,
): LocalUnattendedEnvironmentConfig {
  const host = env["HOST"]?.trim() || "127.0.0.1";
  if (!["localhost", "127.0.0.1", "::1"].includes(host))
    throw new Error("local-unattended mode must bind to loopback.");
  const startPath = env["AXE_HOST_START_PATH"]?.trim();
  const state = env["AXE_HOST_STATE_PATH"]?.trim();
  const executablePath = env["AXE_HOST_BROWSER_EXECUTABLE_PATH"]?.trim();
  const allowedOrigins = list(env["AXE_HOST_ALLOWED_ORIGINS"]);
  return {
    host,
    port: port(env["PORT"]),
    appUrl: appUrl(required(env, "AXE_HOST_APP_URL")),
    connectorId: env["AXE_CONNECTOR_ID"]?.trim() || "application",
    connectorName: env["AXE_CONNECTOR_NAME"]?.trim() || "Connected application",
    surfaceId:
      env["AXE_CONNECTOR_SURFACE_ID"]?.trim() || env["AXE_CONNECTOR_ID"]?.trim() || "application",
    ...(startPath ? { startPath } : {}),
    agentKey: env["AXE_MCP_AGENT_KEY"]?.trim() || DEFAULT_AGENT_KEY,
    principal: env["AXE_HOST_DEV_PRINCIPAL"]?.trim() || "local-user",
    tenant: env["AXE_HOST_DEV_TENANT"]?.trim() || "unselected",
    ...(state ? { statePath: resolve(state) } : {}),
    ...(executablePath ? { executablePath } : {}),
    ...(allowedOrigins.length ? { allowedOrigins } : {}),
  };
}

/** Host configuration for the loopback-only hidden browser and its human approval page. */
export function localUnattendedHostOptions(
  config: LocalUnattendedEnvironmentConfig,
  dependencies: LocalUnattendedDependencies = {},
): HostOptions {
  const identity = { principal: config.principal, tenant: config.tenant };
  return {
    application: { id: config.surfaceId, name: config.connectorName },
    appUrl: config.appUrl,
    ...(config.startPath ? { startPath: config.startPath } : {}),
    ...(config.statePath ? { sessionFor: storageStateSession(config.statePath) } : {}),
    dev: {
      agentKey: config.agentKey,
      identity,
    },
    relay: {
      approvals: {
        // The approval server is bound to loopback by the host. In this development mode there is
        // exactly one configured identity, so the ordinary browser opening the one-time link is
        // that same local person. Production uses the provider's authenticated web session.
        identify: () => identity,
      },
    },
    browser: {
      headless: true,
      ...(config.executablePath ? { executablePath: config.executablePath } : {}),
    },
    ...(config.allowedOrigins ? { allowedOrigins: config.allowedOrigins } : {}),
    name: "Agent Experience — local unattended",
    description:
      "This is a loopback-only local-unattended development service. Use the connected application entirely in its private hidden browser session. Never ask for a pairing code; never open a generic browser or browser pane; never ask the person to sign in in another tab, because another browser context cannot authenticate this session. Start with relay_tabs, then surface_read and surface_observe. If the hidden page is signed out and the person deliberately provided local development credentials, enter them through the reported Surface fields and submit the reported login control. A password field is sensitive: set it only from the person's exact value and never read, repeat, display, log, or persist it. If no credential was provided, ask once for the local development credentials required by the reported fields. When the Surface reports a workspace, organization, account, tenant, project, or other context chooser, select the exact context named in the request; ask one concise question only when it is ambiguous. Continue the original task afterward. If an action returns approvalUrl, present that ordinary clickable link immediately; never say the client cannot show an approval. Do not open or approve the link yourself. After approval, retry the exact same call with the same arguments and expectedRev. Use only Surface tools for actions; host_screenshot is diagnostic, not the primary interface.",
    ...(dependencies.onEvent ? { onEvent: dependencies.onEvent } : {}),
  };
}

/** Start a hidden local browser that the desktop agent drives entirely through Surface tools. */
export async function startLocalUnattendedMcpServiceFromEnv(
  env: Record<string, string | undefined> = process.env,
  dependencies: LocalUnattendedDependencies = {},
): Promise<LocalUnattendedMcpService> {
  const config = localUnattendedEnvironmentConfig(env);
  const host = createHost(localUnattendedHostOptions(config, dependencies));
  try {
    const address = await host.listen({ host: config.host, port: config.port });
    return { address, close: () => host.close() };
  } catch (error) {
    await host.close();
    throw error;
  }
}
