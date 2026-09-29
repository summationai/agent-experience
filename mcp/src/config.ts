export const LOCAL_MCP_HOST = "127.0.0.1";
export const LOCAL_MCP_PORT = 4717;
export const LOCAL_MCP_AGENT_KEY = "axd_agent_experience_local";

export interface McpServiceConfig {
  host: string;
  port: number;
  agentKey: string;
  origins?: string[];
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

/** The development service must not expose its fixed-key pairing mode beyond this machine. */
export function assertLocalMcpHost(host: string): void {
  if (!LOOPBACK_HOSTS.has(host))
    throw new Error(
      `AXE_MCP_HOST must be a loopback host (${[...LOOPBACK_HOSTS].join(", ")}); refusing ${host}.`,
    );
}

function port(value: string | undefined): number {
  if (value === undefined || value === "") return LOCAL_MCP_PORT;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65_535)
    throw new Error("AXE_MCP_PORT must be an integer from 0 to 65535.");
  return parsed;
}

function origins(value: string | undefined): string[] | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return parsed.length ? parsed : undefined;
}

/** Read the local service configuration without mutating process state. */
export function serviceConfig(
  env: Record<string, string | undefined> = process.env,
): McpServiceConfig {
  const allowed = origins(env["AXE_MCP_ALLOWED_ORIGINS"]);
  const host = env["AXE_MCP_HOST"] || LOCAL_MCP_HOST;
  assertLocalMcpHost(host);
  return {
    host,
    port: port(env["AXE_MCP_PORT"]),
    agentKey: env["AXE_MCP_AGENT_KEY"] || LOCAL_MCP_AGENT_KEY,
    ...(allowed ? { origins: allowed } : {}),
  };
}
