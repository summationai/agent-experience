import { Buffer } from "node:buffer";
import { createHost, SessionLoginRequired } from "@summationai/axe-host";
import type {
  AppSession,
  Host,
  HostAddress,
  HostEvent,
  HostOptions,
  SessionFor,
} from "@summationai/axe-host";
import type { AuthInfo, OAuthTokenVerifier } from "@summationai/axe-mcp";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { connectorRegistryFromFile, createConnectorRegistry } from "./connectors";
import type { ConnectorDescriptor, ConnectorRegistry } from "./connectors";
import { startProviderService } from "./provider";
import type { ProviderAddress, ProviderService } from "./provider";

const DEFAULT_PORT = 8080;
const DEFAULT_SCOPE = "surface:act";

export interface HostedEnvironmentConfig {
  host: string;
  port: number;
  connectorFile?: string;
  connectorId: string;
  connectorName: string;
  connectorAliases: string[];
  connectorDescription?: string;
  surfaceId: string;
  appUrl?: string;
  startPath?: string;
  publicMcpUrl: string;
  authorizationServers: string[];
  scopes: string[];
  introspectionUrl?: string;
  oauthClientId?: string;
  oauthClientSecret?: string;
  browserOAuthClientId?: string;
  userInfoUrl?: string;
  sessionBrokerUrl?: string;
  sessionBrokerToken?: string;
  sessionBrokerAuth: "service" | "caller";
  principalClaim: string;
  tenantClaim: string;
  defaultTenant?: string;
  allowedOrigins?: string[];
  maxSessions?: number;
  idleMs?: number;
}

export interface HostedMcpService {
  readonly host?: Host;
  readonly hosts?: ReadonlyMap<string, Host>;
  readonly registry?: ConnectorRegistry;
  readonly address: HostAddress | ProviderAddress;
  close(): Promise<void>;
}

type Fetch = typeof fetch;

interface BrokerLoginResponse {
  loginUrl?: unknown;
  instructions?: unknown;
  whatAgentShouldSayToUser?: unknown;
  expiresAt?: unknown;
}

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

function claim(value: unknown, path: string): unknown {
  let current = value;
  for (const part of path.split(".")) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
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
  if (
    publicMcp.protocol !== "https:" &&
    !(
      publicMcp.protocol === "http:" &&
      ["localhost", "127.0.0.1", "::1", "[::1]"].includes(publicMcp.hostname)
    )
  )
    throw new Error("AXE_HOST_PUBLIC_MCP_URL must use https (or loopback http).");
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
  const userInfoUrl = env["AXE_HOST_OAUTH_USERINFO_URL"]?.trim();
  const introspectionUrl = env["AXE_HOST_OAUTH_INTROSPECTION_URL"]?.trim();
  if (!userInfoUrl && !introspectionUrl)
    throw new Error(
      "AXE_HOST_OAUTH_USERINFO_URL or AXE_HOST_OAUTH_INTROSPECTION_URL is required in hosted mode.",
    );
  const sessionBrokerAuth = env["AXE_HOST_SESSION_BROKER_AUTH"]?.trim() || "service";
  if (sessionBrokerAuth !== "service" && sessionBrokerAuth !== "caller")
    throw new Error('AXE_HOST_SESSION_BROKER_AUTH must be "service" or "caller".');
  const sessionBrokerToken = env["AXE_HOST_SESSION_BROKER_TOKEN"]?.trim();
  const sessionBrokerUrl = env["AXE_HOST_SESSION_BROKER_URL"]?.trim();
  const connectorFile = env["AXE_CONNECTORS_FILE"]?.trim();
  if (!connectorFile && sessionBrokerUrl && sessionBrokerAuth === "service" && !sessionBrokerToken)
    throw new Error("AXE_HOST_SESSION_BROKER_TOKEN is required with service broker auth.");
  const connectorId = env["AXE_CONNECTOR_ID"]?.trim() || "application";
  const connectorName = env["AXE_CONNECTOR_NAME"]?.trim() || "Connected application";
  const surfaceId = env["AXE_CONNECTOR_SURFACE_ID"]?.trim() || connectorId;
  return {
    host: env["HOST"]?.trim() || "0.0.0.0",
    port: listenPort(env["PORT"]),
    ...(connectorFile ? { connectorFile } : {}),
    connectorId,
    connectorName,
    connectorAliases: list(env["AXE_CONNECTOR_ALIASES"]),
    ...(env["AXE_CONNECTOR_DESCRIPTION"]?.trim()
      ? { connectorDescription: env["AXE_CONNECTOR_DESCRIPTION"]!.trim() }
      : {}),
    surfaceId,
    ...(!connectorFile
      ? { appUrl: url(required(env, "AXE_HOST_APP_URL"), "AXE_HOST_APP_URL") }
      : {}),
    ...(startPath ? { startPath } : {}),
    publicMcpUrl,
    authorizationServers,
    scopes,
    ...(userInfoUrl
      ? { userInfoUrl: url(userInfoUrl, "AXE_HOST_OAUTH_USERINFO_URL") }
      : {
          introspectionUrl: url(introspectionUrl!, "AXE_HOST_OAUTH_INTROSPECTION_URL"),
          oauthClientId: required(env, "AXE_HOST_OAUTH_CLIENT_ID"),
          oauthClientSecret: required(env, "AXE_HOST_OAUTH_CLIENT_SECRET"),
        }),
    ...(env["AXE_HOST_BROWSER_OAUTH_CLIENT_ID"]?.trim()
      ? { browserOAuthClientId: env["AXE_HOST_BROWSER_OAUTH_CLIENT_ID"]!.trim() }
      : {}),
    ...(!connectorFile
      ? sessionBrokerUrl
        ? { sessionBrokerUrl: url(sessionBrokerUrl, "AXE_HOST_SESSION_BROKER_URL") }
        : {}
      : {}),
    ...(sessionBrokerToken ? { sessionBrokerToken } : {}),
    sessionBrokerAuth,
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
  if (!config.introspectionUrl || !config.oauthClientId || !config.oauthClientSecret)
    throw new Error("OAuth introspection configuration is incomplete.");
  const introspectionUrl = config.introspectionUrl;
  const oauthClientId = config.oauthClientId;
  const oauthClientSecret = config.oauthClientSecret;
  return {
    async verifyAccessToken(token: string): Promise<AuthInfo> {
      let response: Response;
      try {
        response = await fetcher(introspectionUrl, {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${oauthClientId}:${oauthClientSecret}`).toString("base64")}`,
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

/**
 * Verifies an opaque OAuth token through an authenticated identity endpoint such as `/v1/me`.
 * This is useful when the authorization server issues application-session credentials
 * rather than RFC 7662 introspection-friendly access tokens.
 */
export function userInfoVerifier(
  config: Required<
    Pick<HostedEnvironmentConfig, "userInfoUrl" | "principalClaim" | "tenantClaim" | "publicMcpUrl">
  >,
  fetcher: Fetch = fetch,
): OAuthTokenVerifier {
  return {
    async verifyAccessToken(token: string): Promise<AuthInfo> {
      let response: Response;
      try {
        response = await fetcher(config.userInfoUrl, {
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        throw new InvalidTokenError("The identity service could not verify this token.");
      }
      if (!response.ok) throw new InvalidTokenError("The identity service refused this token.");
      let value: Record<string, unknown>;
      try {
        value = (await response.json()) as Record<string, unknown>;
      } catch {
        throw new InvalidTokenError("The identity service returned an invalid response.");
      }
      if (value["authenticated"] === false) throw new InvalidTokenError("The token is not active.");
      const principal = claim(value, config.principalClaim);
      const tenant = claim(value, config.tenantClaim);
      if (typeof principal !== "string" || typeof tenant !== "string")
        throw new InvalidTokenError("The identity service response is missing identity claims.");
      const rawScopes = claim(value, "identity.scopes") ?? value["scope"];
      const scopes = Array.isArray(rawScopes)
        ? rawScopes.filter((scope): scope is string => typeof scope === "string")
        : typeof rawScopes === "string"
          ? list(rawScopes)
          : [];
      return {
        token,
        clientId: "oauth-user",
        scopes,
        resource: new URL(config.publicMcpUrl),
        extra: value,
      };
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
 * Exchanges an already verified identity for a short-lived application session. With service
 * auth, the MCP token is not forwarded. With caller auth, the broker receives that token as its
 * bearer credential so an application that issued it can perform a direct session exchange.
 */
export function brokeredSessionFor(
  config: Pick<
    HostedEnvironmentConfig,
    "sessionBrokerUrl" | "sessionBrokerToken" | "sessionBrokerAuth"
  >,
  fetcher: Fetch = fetch,
): SessionFor {
  if (!config.sessionBrokerUrl)
    throw new Error("The broker session strategy requires a session broker URL.");
  const sessionBrokerUrl = config.sessionBrokerUrl;
  return async ({ principal, tenant, authInfo }) => {
    if (config.sessionBrokerAuth === "caller" && !authInfo)
      throw new Error("The caller-authenticated session broker requires MCP authentication.");
    const authorization =
      config.sessionBrokerAuth === "caller"
        ? `Bearer ${authInfo!.token}`
        : `Bearer ${config.sessionBrokerToken}`;
    const response = await fetcher(sessionBrokerUrl, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ principal, tenant, scopes: authInfo?.scopes ?? [] }),
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 401 || response.status === 403) {
      const login = (await response.json().catch(() => null)) as BrokerLoginResponse | null;
      if (login && typeof login.loginUrl === "string") {
        const expiresAt =
          typeof login.expiresAt === "string" || typeof login.expiresAt === "number"
            ? login.expiresAt
            : undefined;
        throw new SessionLoginRequired({
          url: login.loginUrl,
          ...(typeof login.instructions === "string" ? { instructions: login.instructions } : {}),
          ...(typeof login.whatAgentShouldSayToUser === "string"
            ? { whatAgentShouldSayToUser: login.whatAgentShouldSayToUser }
            : {}),
          ...(expiresAt !== undefined ? { expiresAt } : {}),
        });
      }
      return null;
    }
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

function hostedRegistry(
  config: HostedEnvironmentConfig,
  env: Record<string, string | undefined>,
  fetcher: Fetch = fetch,
): ConnectorRegistry {
  const sessionFor = (connector: ConnectorDescriptor, token: string | undefined): SessionFor =>
    brokeredSessionFor(
      {
        sessionBrokerUrl: connector.session.brokerUrl!,
        sessionBrokerAuth: connector.session.brokerAuth ?? "service",
        ...(token ? { sessionBrokerToken: token } : {}),
      },
      fetcher,
    );
  if (config.connectorFile) return connectorRegistryFromFile(config.connectorFile, env, sessionFor);
  const connector: ConnectorDescriptor = {
    id: config.connectorId,
    displayName: config.connectorName,
    aliases: config.connectorAliases,
    ...(config.connectorDescription ? { description: config.connectorDescription } : {}),
    appUrl: config.appUrl!,
    ...(config.startPath ? { startPath: config.startPath } : {}),
    allowedOrigins: config.allowedOrigins ?? [new URL(config.appUrl!).origin],
    surfaceId: config.surfaceId,
    identity: {
      principalClaim: config.principalClaim,
      contextClaim: config.tenantClaim,
      ...(config.defaultTenant ? { defaultContext: config.defaultTenant } : {}),
    },
    session: config.sessionBrokerUrl
      ? {
          strategy: "broker",
          brokerUrl: config.sessionBrokerUrl,
          brokerAuth: config.sessionBrokerAuth,
        }
      : { strategy: "none" },
  };
  return createConnectorRegistry([
    config.sessionBrokerUrl
      ? { ...connector, sessionFor: brokeredSessionFor(config, fetcher) }
      : connector,
  ]);
}

/** Build and start the provider-operated service from deployment environment variables. */
export async function startHostedMcpServiceFromEnv(
  env: Record<string, string | undefined> = process.env,
  dependencies: { fetch?: Fetch; onEvent?: (event: HostEvent) => void } = {},
): Promise<HostedMcpService> {
  const config = hostedEnvironmentConfig(env);
  const verifier = config.userInfoUrl
    ? userInfoVerifier(
        {
          userInfoUrl: config.userInfoUrl,
          principalClaim: config.principalClaim,
          tenantClaim: config.tenantClaim,
          publicMcpUrl: config.publicMcpUrl,
        },
        dependencies.fetch,
      )
    : introspectionVerifier(
        {
          introspectionUrl: config.introspectionUrl!,
          oauthClientId: config.oauthClientId!,
          oauthClientSecret: config.oauthClientSecret!,
          publicMcpUrl: config.publicMcpUrl,
        },
        dependencies.fetch,
      );
  const registry = hostedRegistry(config, env, dependencies.fetch);
  const service: ProviderService = await startProviderService({
    registry,
    verifier,
    requiredScopes: config.scopes,
    resource: config.publicMcpUrl,
    protectedResource: {
      resource: config.publicMcpUrl,
      authorizationServers: config.authorizationServers,
      scopesSupported: config.scopes,
    },
    principal: (authInfo) => {
      const principal = claim(authInfo.extra, config.principalClaim);
      return typeof principal === "string" ? principal : null;
    },
    identify: (connector, authInfo) => {
      const principal = claim(authInfo.extra, connector.identity.principalClaim);
      const context =
        claim(authInfo.extra, connector.identity.contextClaim) ?? connector.identity.defaultContext;
      return typeof principal === "string" && typeof context === "string"
        ? { principal, tenant: context }
        : null;
    },
    ...(config.browserOAuthClientId ? { browserOAuthClientId: config.browserOAuthClientId } : {}),
    ...(config.maxSessions ? { maxSessions: config.maxSessions } : {}),
    ...(config.idleMs ? { idleMs: config.idleMs } : {}),
    name: "Agent Experience",
    ...(dependencies.onEvent
      ? { onEvent: (_connectorId: string, event: HostEvent) => dependencies.onEvent!(event) }
      : {}),
    host: config.host,
    port: config.port,
  });
  return {
    hosts: service.hosts,
    registry: service.registry,
    address: service.address,
    close: () => service.close(),
  };
}
