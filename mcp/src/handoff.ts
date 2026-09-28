import { createServer } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import { createRelay } from "@axe/relay/server";
import type { Relay, RelayAddress } from "@axe/relay/server";
import { protectedResourceMetadata } from "@axe/mcp";
import type { AuthInfo, OAuthTokenVerifier } from "@axe/mcp";
import { introspectionVerifier, userInfoVerifier } from "./hosted";

const DEFAULT_PORT = 8080;
const DEFAULT_SCOPE = "surface:act";

export interface HandoffEnvironmentConfig {
  host: string;
  port: number;
  appUrl: string;
  publicMcpUrl: string;
  authorizationServers: string[];
  scopes: string[];
  userInfoUrl?: string;
  introspectionUrl?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
  principalClaim: string;
  tenantClaim: string;
  defaultTenant?: string;
  allowedOrigins: string[];
}

export interface HandoffMcpService {
  readonly relay: Relay;
  readonly address: RelayAddress;
  close(): Promise<void>;
}

type Fetch = typeof fetch;

function required(env: Record<string, string | undefined>, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required in handoff mode.`);
  return value;
}

function absoluteUrl(value: string, name: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute http(s) URL.`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
    throw new Error(`${name} must be an absolute http(s) URL.`);
  return parsed.href;
}

function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[ ,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function port(value: string | undefined): number {
  if (!value) return DEFAULT_PORT;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65_535)
    throw new Error("PORT must be an integer from 0 to 65535.");
  return parsed;
}

function claim(value: unknown, path: string): unknown {
  let current = value;
  for (const part of path.split(".")) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function handoffEnvironmentConfig(
  env: Record<string, string | undefined> = process.env,
): HandoffEnvironmentConfig {
  const appUrl = absoluteUrl(required(env, "AXE_HOST_APP_URL"), "AXE_HOST_APP_URL");
  const publicMcpUrl = absoluteUrl(
    required(env, "AXE_HOST_PUBLIC_MCP_URL"),
    "AXE_HOST_PUBLIC_MCP_URL",
  );
  const publicMcp = new URL(publicMcpUrl);
  if (publicMcp.pathname !== "/mcp" || publicMcp.search || publicMcp.hash)
    throw new Error("AXE_HOST_PUBLIC_MCP_URL must end in /mcp.");
  const authorizationServers = list(required(env, "AXE_HOST_AUTHORIZATION_SERVERS")).map((value) =>
    absoluteUrl(value, "AXE_HOST_AUTHORIZATION_SERVERS"),
  );
  const scopes = list(env["AXE_HOST_SCOPES"] ?? DEFAULT_SCOPE);
  if (!scopes.length) throw new Error("AXE_HOST_SCOPES must contain at least one scope.");
  const userInfoUrl = env["AXE_HOST_OAUTH_USERINFO_URL"]?.trim();
  const introspectionUrl = env["AXE_HOST_OAUTH_INTROSPECTION_URL"]?.trim();
  if (!userInfoUrl && !introspectionUrl)
    throw new Error(
      "AXE_HOST_OAUTH_USERINFO_URL or AXE_HOST_OAUTH_INTROSPECTION_URL is required in handoff mode.",
    );
  const defaultTenant = env["AXE_HOST_DEFAULT_TENANT"]?.trim();
  const configuredOrigins = list(env["AXE_HOST_ALLOWED_ORIGINS"]);
  return {
    host: env["HOST"]?.trim() || "0.0.0.0",
    port: port(env["PORT"]),
    appUrl,
    publicMcpUrl,
    authorizationServers,
    scopes,
    ...(userInfoUrl
      ? { userInfoUrl: absoluteUrl(userInfoUrl, "AXE_HOST_OAUTH_USERINFO_URL") }
      : {
          introspectionUrl: absoluteUrl(introspectionUrl!, "AXE_HOST_OAUTH_INTROSPECTION_URL"),
          oauthClientId: required(env, "AXE_HOST_OAUTH_CLIENT_ID"),
          oauthClientSecret: required(env, "AXE_HOST_OAUTH_CLIENT_SECRET"),
        }),
    principalClaim: env["AXE_HOST_PRINCIPAL_CLAIM"]?.trim() || "sub",
    tenantClaim: env["AXE_HOST_TENANT_CLAIM"]?.trim() || "org",
    ...(defaultTenant ? { defaultTenant } : {}),
    allowedOrigins: [...new Set([new URL(appUrl).origin, ...configuredOrigins])],
  };
}

function verifierFor(config: HandoffEnvironmentConfig, fetcher?: Fetch): OAuthTokenVerifier {
  return config.userInfoUrl
    ? userInfoVerifier(
        {
          userInfoUrl: config.userInfoUrl,
          principalClaim: config.principalClaim,
          tenantClaim: config.tenantClaim,
          publicMcpUrl: config.publicMcpUrl,
        },
        fetcher,
      )
    : introspectionVerifier(
        {
          introspectionUrl: config.introspectionUrl!,
          oauthClientId: config.oauthClientId!,
          oauthClientSecret: config.oauthClientSecret!,
          publicMcpUrl: config.publicMcpUrl,
        },
        fetcher,
      );
}

/**
 * Start the provider-operated relay whose browser handoff needs no customer backend. The MCP
 * caller's verified identity is bound to a one-time link; the installed package exchanges it
 * directly with this service after the ordinary application login page has loaded.
 */
export async function startHandoffMcpServiceFromEnv(
  env: Record<string, string | undefined> = process.env,
  dependencies: { fetch?: Fetch } = {},
): Promise<HandoffMcpService> {
  const config = handoffEnvironmentConfig(env);
  const publicOrigin = new URL(config.publicMcpUrl).origin;
  const resourceMetadataUrl = new URL("/.well-known/oauth-protected-resource/mcp", publicOrigin)
    .href;
  const relay = createRelay({
    origins: config.allowedOrigins,
    baseUrl: publicOrigin,
    name: "Agent Experience",
    description:
      "Use the connected application's Surface. Start with relay_tabs. If it returns an application_tab_required handoff, immediately open that URL through the client's URL flow and call axe_resume with its token; follow any pending poll while the person signs in. The installed package connects the tab automatically, so never ask the person to announce completion. Never ask for a pairing code and never look for relay_pair. Then use surface_read, surface_observe, surface_wait, and the Surface action tools instead of generic browser automation or a nested agent.",
    handoff: { appUrl: config.appUrl, pageUrl: publicOrigin },
    agentAuth: {
      verifier: verifierFor(config, dependencies.fetch),
      requiredScopes: config.scopes,
      resource: config.publicMcpUrl,
      resourceMetadataUrl,
      identify: (authInfo: AuthInfo) => {
        const principal = claim(authInfo.extra, config.principalClaim);
        const tenant = claim(authInfo.extra, config.tenantClaim) ?? config.defaultTenant;
        return typeof principal === "string" && typeof tenant === "string"
          ? { principal, tenant }
          : null;
      },
    },
  });
  const metadata = protectedResourceMetadata({
    resource: config.publicMcpUrl,
    authorizationServers: config.authorizationServers,
    scopesSupported: config.scopes,
  });
  const sockets = new Set<Socket>();
  const server = createServer((request, response) => {
    const path = (request.url ?? "/").split("?")[0];
    if (path !== "/.well-known/oauth-protected-resource/mcp") return;
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    });
    response.end(JSON.stringify(metadata.metadata));
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
  const origin = `http://${shown}:${bound.port}`;
  const address: RelayAddress = {
    url: origin,
    tabUrl: `ws://${shown}:${bound.port}/tab`,
    mcpUrl: `${origin}/mcp`,
    port: bound.port,
    host: config.host,
  };
  let closed = false;
  return {
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
