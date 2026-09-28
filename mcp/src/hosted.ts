import { Buffer } from "node:buffer";
import { createHost } from "@axe/host";
import type { AppSession, Host, HostAddress, HostEvent, HostOptions, SessionFor } from "@axe/host";
import type { AuthInfo, OAuthTokenVerifier } from "@axe/mcp";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";

const DEFAULT_PORT = 8080;
const DEFAULT_SCOPE = "surface:act";

export interface HostedEnvironmentConfig {
  host: string;
  port: number;
  appUrl: string;
  startPath?: string;
  publicMcpUrl: string;
  authorizationServers: string[];
  scopes: string[];
  introspectionUrl: string;
  oauthClientId: string;
  oauthClientSecret: string;
  sessionBrokerUrl: string;
  sessionBrokerToken: string;
  principalClaim: string;
  tenantClaim: string;
  defaultTenant?: string;
  allowedOrigins?: string[];
  maxSessions?: number;
  idleMs?: number;
}

export interface HostedMcpService {
  readonly host: Host;
  readonly address: HostAddress;
  close(): Promise<void>;
}

type Fetch = typeof fetch;

function required(env: Record<string, string | undefined>, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required in hosted mode.`);
  return value;
}

function url(value: string, name: string): string {
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

function positiveInteger(value: string | undefined, name: string): number | undefined {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

function listenPort(value: string | undefined): number {
  if (value === undefined || value === "") return DEFAULT_PORT;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65_535)
    throw new Error("PORT must be an integer from 0 to 65535.");
  return parsed;
}

/** Configuration for the provider-operated, unattended service. Secrets are never sent to a page. */
export function hostedEnvironmentConfig(
  env: Record<string, string | undefined> = process.env,
): HostedEnvironmentConfig {
  const publicMcpUrl = url(required(env, "AXE_HOST_PUBLIC_MCP_URL"), "AXE_HOST_PUBLIC_MCP_URL");
  const publicMcp = new URL(publicMcpUrl);
  if (publicMcp.pathname !== "/mcp" || publicMcp.search || publicMcp.hash)
    throw new Error("AXE_HOST_PUBLIC_MCP_URL must end in /mcp.");
  const authorizationServers = list(required(env, "AXE_HOST_AUTHORIZATION_SERVERS")).map((item) =>
    url(item, "AXE_HOST_AUTHORIZATION_SERVERS"),
  );
  const scopes = list(env["AXE_HOST_SCOPES"] ?? DEFAULT_SCOPE);
  if (!scopes.length) throw new Error("AXE_HOST_SCOPES must contain at least one scope.");
  const startPath = env["AXE_HOST_START_PATH"]?.trim();
  const allowedOrigins = list(env["AXE_HOST_ALLOWED_ORIGINS"]);
  const defaultTenant = env["AXE_HOST_DEFAULT_TENANT"]?.trim();
  const maxSessions = positiveInteger(env["AXE_HOST_MAX_SESSIONS"], "AXE_HOST_MAX_SESSIONS");
  const idleMs = positiveInteger(env["AXE_HOST_IDLE_MS"], "AXE_HOST_IDLE_MS");
  return {
    host: env["HOST"]?.trim() || "0.0.0.0",
    port: listenPort(env["PORT"]),
    appUrl: url(required(env, "AXE_HOST_APP_URL"), "AXE_HOST_APP_URL"),
    ...(startPath ? { startPath } : {}),
    publicMcpUrl,
    authorizationServers,
    scopes,
    introspectionUrl: url(
      required(env, "AXE_HOST_OAUTH_INTROSPECTION_URL"),
      "AXE_HOST_OAUTH_INTROSPECTION_URL",
    ),
    oauthClientId: required(env, "AXE_HOST_OAUTH_CLIENT_ID"),
    oauthClientSecret: required(env, "AXE_HOST_OAUTH_CLIENT_SECRET"),
    sessionBrokerUrl: url(
      required(env, "AXE_HOST_SESSION_BROKER_URL"),
      "AXE_HOST_SESSION_BROKER_URL",
    ),
    sessionBrokerToken: required(env, "AXE_HOST_SESSION_BROKER_TOKEN"),
    principalClaim: env["AXE_HOST_PRINCIPAL_CLAIM"]?.trim() || "sub",
    tenantClaim: env["AXE_HOST_TENANT_CLAIM"]?.trim() || "org",
    ...(defaultTenant ? { defaultTenant } : {}),
    ...(allowedOrigins.length ? { allowedOrigins } : {}),
    ...(maxSessions !== undefined ? { maxSessions } : {}),
    ...(idleMs !== undefined ? { idleMs } : {}),
  };
}

interface IntrospectionResponse extends Record<string, unknown> {
  active?: boolean;
  aud?: string | string[];
  client_id?: string;
  exp?: number;
  scope?: string | string[];
}

/** RFC 7662 verifier for access tokens issued to the public MCP resource. */
export function introspectionVerifier(
  config: Pick<
    HostedEnvironmentConfig,
    "introspectionUrl" | "oauthClientId" | "oauthClientSecret" | "publicMcpUrl"
  >,
  fetcher: Fetch = fetch,
): OAuthTokenVerifier {
  return {
    async verifyAccessToken(token: string): Promise<AuthInfo> {
      let response: Response;
      try {
        response = await fetcher(config.introspectionUrl, {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${config.oauthClientId}:${config.oauthClientSecret}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ token }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        throw new InvalidTokenError("The authorization server could not verify this token.");
      }
      if (!response.ok)
        throw new InvalidTokenError("The authorization server refused token introspection.");
      let value: IntrospectionResponse;
      try {
        value = (await response.json()) as IntrospectionResponse;
      } catch {
        throw new InvalidTokenError("The authorization server returned an invalid response.");
      }
      const audience = Array.isArray(value.aud) ? value.aud : value.aud ? [value.aud] : [];
      if (!value.active || !audience.includes(config.publicMcpUrl))
        throw new InvalidTokenError("The token is not active for this service.");
      const scopes = Array.isArray(value.scope) ? value.scope : list(value.scope);
      const info: AuthInfo = {
        token,
        clientId: typeof value.client_id === "string" ? value.client_id : "unknown",
        scopes,
        resource: new URL(config.publicMcpUrl),
        extra: { ...value },
      };
      if (typeof value.exp === "number") info.expiresAt = value.exp;
      return info;
    },
  };
}

function appSession(value: unknown): AppSession | null {
  if (value === null) return null;
  if (typeof value !== "object" || Array.isArray(value))
    throw new Error("The session broker returned an invalid application session.");
  const session = value as Record<string, unknown>;
  for (const key of Object.keys(session))
    if (!new Set(["cookies", "headers", "localStorage", "storageState"]).has(key))
      throw new Error(`The session broker returned an unsupported field: ${key}.`);
  if (typeof session["storageState"] === "string")
    throw new Error("The session broker may return an inline storageState, not a host file path.");
  return session as AppSession;
}

/**
 * Exchanges an already verified identity for a short-lived application session. The MCP access
 * token is intentionally not forwarded: the broker authenticates this service and receives only
 * the identity and scopes that the verifier accepted.
 */
export function brokeredSessionFor(
  config: Pick<HostedEnvironmentConfig, "sessionBrokerUrl" | "sessionBrokerToken">,
  fetcher: Fetch = fetch,
): SessionFor {
  return async ({ principal, tenant, authInfo }) => {
    const response = await fetcher(config.sessionBrokerUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.sessionBrokerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ principal, tenant, scopes: authInfo?.scopes ?? [] }),
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 401 || response.status === 403) return null;
    if (!response.ok) throw new Error(`The session broker failed with HTTP ${response.status}.`);
    return appSession(await response.json());
  };
}

/** Start the production host with caller-supplied identity and session integrations. */
export async function startHostedMcpService(
  options: HostOptions & { listen?: { host?: string; port?: number } },
): Promise<HostedMcpService> {
  const { listen, ...hostOptions } = options;
  const host = createHost(hostOptions);
  try {
    const address = await host.listen(listen);
    return { host, address, close: () => host.close() };
  } catch (error) {
    await host.close();
    throw error;
  }
}

/** Build and start the provider-operated service from deployment environment variables. */
export async function startHostedMcpServiceFromEnv(
  env: Record<string, string | undefined> = process.env,
  dependencies: { fetch?: Fetch; onEvent?: (event: HostEvent) => void } = {},
): Promise<HostedMcpService> {
  const config = hostedEnvironmentConfig(env);
  const verifier = introspectionVerifier(config, dependencies.fetch);
  const sessionFor = brokeredSessionFor(config, dependencies.fetch);
  return startHostedMcpService({
    appUrl: config.appUrl,
    ...(config.startPath ? { startPath: config.startPath } : {}),
    sessionFor,
    agentAuth: {
      verifier,
      requiredScopes: config.scopes,
      resource: config.publicMcpUrl,
      identify: (authInfo) => {
        const principal = authInfo.extra?.[config.principalClaim];
        const tenant = authInfo.extra?.[config.tenantClaim] ?? config.defaultTenant;
        return typeof principal === "string" && typeof tenant === "string"
          ? { principal, tenant }
          : null;
      },
    },
    protectedResource: {
      resource: config.publicMcpUrl,
      authorizationServers: config.authorizationServers,
      scopesSupported: config.scopes,
    },
    ...(config.allowedOrigins ? { allowedOrigins: config.allowedOrigins } : {}),
    ...(config.maxSessions ? { maxSessions: config.maxSessions } : {}),
    ...(config.idleMs ? { idleMs: config.idleMs } : {}),
    name: "Agent Experience",
    description:
      "Use the connected application's real interface in a private hosted browser session. Start with relay_tabs, then surface_read and surface_observe. Act only with Surface tools; do not use generic browser automation or a nested CLI agent.",
    ...(dependencies.onEvent ? { onEvent: dependencies.onEvent } : {}),
    listen: { host: config.host, port: config.port },
  });
}
