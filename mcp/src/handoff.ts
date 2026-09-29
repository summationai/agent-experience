import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import type { ServerResponse } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import { createRelay } from "@summationai/axe-relay/server";
import type { Relay, RelayAddress, RelayPrincipal } from "@summationai/axe-relay/server";
import type { OAuthTokenVerifier } from "@summationai/axe-mcp";
import { introspectionVerifier, userInfoVerifier } from "./hosted";

const DEFAULT_PORT = 8080;
const DEFAULT_SCOPE = "surface:act";

export interface HandoffEnvironmentConfig {
  host: string;
  port: number;
  appUrl: string;
  connectorId: string;
  connectorName: string;
  surfaceId: string;
  publicMcpUrl: string;
  authMode: "oauth" | "local";
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

interface AuthorizationServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
}

interface PendingLogin {
  agent: string;
  verifier: string;
  expiresAt: number;
}

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

function loopback(url: string): boolean {
  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(url).hostname);
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
  const authMode = env["AXE_HOST_AUTH_MODE"]?.trim() || "oauth";
  if (authMode !== "oauth" && authMode !== "local")
    throw new Error('AXE_HOST_AUTH_MODE must be "oauth" or "local".');
  const host = env["HOST"]?.trim() || "0.0.0.0";
  if (
    authMode === "local" &&
    (!loopback(appUrl) ||
      !loopback(publicMcpUrl) ||
      !["localhost", "127.0.0.1", "::1"].includes(host))
  )
    throw new Error(
      "AXE_HOST_AUTH_MODE=local requires loopback HOST, AXE_HOST_APP_URL, and AXE_HOST_PUBLIC_MCP_URL.",
    );
  const authorizationServers =
    authMode === "oauth"
      ? list(required(env, "AXE_HOST_AUTHORIZATION_SERVERS")).map((value) =>
          absoluteUrl(value, "AXE_HOST_AUTHORIZATION_SERVERS"),
        )
      : [];
  const scopes = list(env["AXE_HOST_SCOPES"] ?? DEFAULT_SCOPE);
  if (!scopes.length) throw new Error("AXE_HOST_SCOPES must contain at least one scope.");
  const userInfoUrl = env["AXE_HOST_OAUTH_USERINFO_URL"]?.trim();
  const introspectionUrl = env["AXE_HOST_OAUTH_INTROSPECTION_URL"]?.trim();
  if (authMode === "oauth" && !userInfoUrl && !introspectionUrl)
    throw new Error(
      "AXE_HOST_OAUTH_USERINFO_URL or AXE_HOST_OAUTH_INTROSPECTION_URL is required in handoff mode.",
    );
  const defaultTenant = env["AXE_HOST_DEFAULT_TENANT"]?.trim();
  const configuredOrigins = list(env["AXE_HOST_ALLOWED_ORIGINS"]);
  return {
    host,
    port: port(env["PORT"]),
    appUrl,
    connectorId: env["AXE_CONNECTOR_ID"]?.trim() || "application",
    connectorName: env["AXE_CONNECTOR_NAME"]?.trim() || "Connected application",
    surfaceId:
      env["AXE_CONNECTOR_SURFACE_ID"]?.trim() || env["AXE_CONNECTOR_ID"]?.trim() || "application",
    publicMcpUrl,
    authMode,
    authorizationServers,
    scopes,
    ...(authMode === "local"
      ? {}
      : userInfoUrl
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

function html(response: ServerResponse, status: number, title: string, body: string): void {
  response.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  });
  response.end(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font:16px system-ui,sans-serif;max-width:36rem;margin:12vh auto;padding:0 1.5rem;line-height:1.5;color:#171717}a{display:inline-block;margin-top:1rem;padding:.75rem 1rem;border-radius:.5rem;background:#171717;color:white;text-decoration:none}p{color:#444}</style></head><body>${body}</body></html>`,
  );
}

function redirect(response: ServerResponse, location: string): void {
  response.writeHead(302, { Location: location, "Cache-Control": "no-store" });
  response.end();
}

function object(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
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
  const fetcher = dependencies.fetch ?? fetch;
  const publicOrigin = new URL(config.publicMcpUrl).origin;
  const callbackUrl = new URL("/oauth/callback", publicOrigin).href;
  const verifier = config.authMode === "oauth" ? verifierFor(config, fetcher) : null;
  const pending = new Map<string, PendingLogin>();
  const identities = new Map<string, { who: RelayPrincipal; expiresAt: number }>();
  let client: Promise<{ metadata: AuthorizationServerMetadata; clientId: string }> | null = null;

  const prune = (): void => {
    const now = Date.now();
    for (const [state, login] of pending) if (login.expiresAt <= now) pending.delete(state);
    for (const [session, identity] of identities)
      if (identity.expiresAt <= now) identities.delete(session);
  };

  const authorizationClient = async (): Promise<{
    metadata: AuthorizationServerMetadata;
    clientId: string;
  }> => {
    if (client) return client;
    client = (async () => {
      const issuer = new URL(config.authorizationServers[0]!);
      const metadataUrl = new URL("/.well-known/oauth-authorization-server", issuer).href;
      const metadataResponse = await fetcher(metadataUrl, {
        headers: { Accept: "application/json" },
      });
      if (!metadataResponse.ok)
        throw new Error(`Authorization discovery returned HTTP ${metadataResponse.status}.`);
      const raw = object(await metadataResponse.json(), "Authorization discovery was invalid.");
      const metadata: AuthorizationServerMetadata = {
        issuer: String(raw["issuer"] ?? ""),
        authorization_endpoint: String(raw["authorization_endpoint"] ?? ""),
        token_endpoint: String(raw["token_endpoint"] ?? ""),
        registration_endpoint: String(raw["registration_endpoint"] ?? ""),
      };
      for (const [name, value] of Object.entries(metadata))
        if (!value) throw new Error(`Authorization discovery omitted ${name}.`);
      if (new URL(metadata.issuer).origin !== issuer.origin)
        throw new Error("Authorization discovery returned an unexpected issuer.");

      const registrationResponse = await fetcher(metadata.registration_endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          client_name: `Agent Experience for ${config.connectorName}`,
          redirect_uris: [callbackUrl],
          token_endpoint_auth_method: "none",
          grant_types: ["authorization_code"],
          response_types: ["code"],
        }),
      });
      if (!registrationResponse.ok)
        throw new Error(`OAuth client registration returned HTTP ${registrationResponse.status}.`);
      const registration = object(
        await registrationResponse.json(),
        "OAuth client registration was invalid.",
      );
      const clientId = registration["client_id"];
      if (typeof clientId !== "string" || !clientId)
        throw new Error("OAuth client registration omitted client_id.");
      return { metadata, clientId };
    })().catch((error) => {
      client = null;
      throw error;
    });
    return client;
  };

  const beginLogin = (agent: string): string => {
    prune();
    for (const [state, login] of pending) if (login.agent === agent) pending.delete(state);
    const state = randomBytes(24).toString("base64url");
    pending.set(state, {
      agent,
      verifier: randomBytes(32).toString("base64url"),
      expiresAt: Date.now() + 10 * 60_000,
    });
    return new URL(`/login/${state}`, publicOrigin).href;
  };

  const relay = createRelay({
    application: { id: config.surfaceId, name: config.connectorName },
    origins: config.allowedOrigins,
    baseUrl: publicOrigin,
    name: "Agent Experience",
    description:
      config.authMode === "local"
        ? "Use this server only when the person's request concerns the connected application. Start with relay_tabs. It opens the application's local sign-in page and connects its installed Surface automatically. Use the client's URL flow and continue the pending handoff; never ask for a pairing code. Then use surface_read, surface_observe, surface_wait, and the Surface action tools instead of generic browser automation or a nested agent."
        : "Use this server only when the person's request concerns the connected application. Start with relay_tabs. It may offer a contextual Agent Experience sign-in page, then open the application and connect its installed Surface automatically. Use the client's URL flow and continue the pending handoff; never ask for a pairing code. Then use surface_read, surface_observe, surface_wait, and the Surface action tools instead of generic browser automation or a nested agent.",
    handoff: { appUrl: config.appUrl, pageUrl: publicOrigin },
    deferredAgentAuth: {
      identify: (sessionId) => {
        prune();
        return identities.get(sessionId)?.who ?? null;
      },
      login: (sessionId) => {
        if (config.authMode === "local") {
          const who = { principal: `local:${sessionId}`, tenant: "local" };
          identities.set(sessionId, { who, expiresAt: Date.now() + 12 * 60 * 60_000 });
          const url = relay.browserHandoff(who);
          if (!url) throw new Error("The local browser handoff could not be created.");
          return {
            url,
            instructions:
              "Open the local application and sign in on its normal page if asked. Its installed Surface connects this session automatically afterward.",
            whatAgentShouldSayToUser: `You asked me to use ${config.connectorName}. I need to open its local sign-in page.`,
            ttlSeconds: 10 * 60,
          };
        }
        return {
          url: beginLogin(sessionId),
          instructions:
            "Open the Agent Experience connection page. It explains why application authorization is needed before offering a Continue button. After approval, the application opens and its installed Surface connects automatically.",
          whatAgentShouldSayToUser: `You asked me to use ${config.connectorName}. I need to open a secure connection page so you can sign in and approve access.`,
          ttlSeconds: 10 * 60,
        };
      },
    },
  });
  const connectorName = escapeHtml(config.connectorName);
  const sockets = new Set<Socket>();
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", publicOrigin);
    const path = url.pathname;
    const loginPage = /^\/login\/([A-Za-z0-9_-]{32})$/.exec(path);
    if (request.method === "GET" && loginPage) {
      prune();
      const state = loginPage[1]!;
      if (!pending.has(state)) {
        html(
          response,
          410,
          "Connection expired",
          `<h1>This connection link has expired.</h1><p>Return to your agent and ask it to use ${connectorName} again.</p>`,
        );
        return;
      }
      html(
        response,
        200,
        `Connect to ${connectorName}`,
        `<h1>Connect your agent to ${connectorName}</h1><p>You asked your agent to use ${connectorName}. Continue to its secure sign-in to approve this connection. Afterward, the application page will open and connect automatically.</p><p>Your password and any pairing code are never shared with the agent.</p><a href="/login/${state}/start">Continue to ${connectorName}</a>`,
      );
      return;
    }

    const loginStart = /^\/login\/([A-Za-z0-9_-]{32})\/start$/.exec(path);
    if (request.method === "GET" && loginStart) {
      prune();
      const state = loginStart[1]!;
      const login = pending.get(state);
      if (!login) {
        html(
          response,
          410,
          "Connection expired",
          `<h1>This connection link has expired.</h1><p>Return to your agent and ask it to use ${connectorName} again.</p>`,
        );
        return;
      }
      void authorizationClient()
        .then(({ metadata, clientId }) => {
          const authorization = new URL(metadata.authorization_endpoint);
          authorization.searchParams.set("response_type", "code");
          authorization.searchParams.set("client_id", clientId);
          authorization.searchParams.set("redirect_uri", callbackUrl);
          authorization.searchParams.set(
            "code_challenge",
            createHash("sha256").update(login.verifier).digest("base64url"),
          );
          authorization.searchParams.set("code_challenge_method", "S256");
          authorization.searchParams.set("state", state);
          authorization.searchParams.set("scope", config.scopes.join(" "));
          authorization.searchParams.set("resource", config.publicMcpUrl);
          redirect(response, authorization.href);
        })
        .catch(() =>
          html(
            response,
            502,
            `${connectorName} unavailable`,
            `<h1>${connectorName} sign-in is temporarily unavailable.</h1><p>Return to your agent and try again.</p>`,
          ),
        );
      return;
    }

    if (request.method === "GET" && path === "/oauth/callback") {
      prune();
      const state = url.searchParams.get("state") ?? "";
      const code = url.searchParams.get("code") ?? "";
      const login = pending.get(state);
      if (!login || !code) {
        html(
          response,
          400,
          "Connection failed",
          `<h1>The ${connectorName} connection could not be completed.</h1><p>Return to your agent and try again.</p>`,
        );
        return;
      }
      pending.delete(state);
      void authorizationClient()
        .then(async ({ metadata, clientId }) => {
          const tokenResponse = await fetcher(metadata.token_endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Accept: "application/json",
            },
            body: new URLSearchParams({
              grant_type: "authorization_code",
              code,
              code_verifier: login.verifier,
              client_id: clientId,
              redirect_uri: callbackUrl,
              resource: config.publicMcpUrl,
            }),
          });
          if (!tokenResponse.ok)
            throw new Error(`OAuth token exchange returned HTTP ${tokenResponse.status}.`);
          const token = object(await tokenResponse.json(), "OAuth token response was invalid.");
          const accessToken = token["access_token"];
          if (typeof accessToken !== "string" || !accessToken)
            throw new Error("OAuth token response omitted access_token.");
          if (!verifier) throw new Error("OAuth is disabled for this local service.");
          const authInfo = await verifier.verifyAccessToken(accessToken);
          const principal = claim(authInfo.extra, config.principalClaim);
          const tenant = claim(authInfo.extra, config.tenantClaim) ?? config.defaultTenant;
          if (typeof principal !== "string" || typeof tenant !== "string")
            throw new Error("The application did not return a usable account identity.");
          const who = { principal, tenant };
          identities.set(login.agent, {
            who,
            expiresAt:
              typeof authInfo.expiresAt === "number"
                ? authInfo.expiresAt * 1000
                : Date.now() + 12 * 60 * 60_000,
          });
          const handoff = relay.browserHandoff(who);
          if (!handoff) throw new Error("The browser handoff could not be created.");
          redirect(response, handoff);
        })
        .catch((error: unknown) =>
          html(
            response,
            502,
            "Connection failed",
            `<h1>The ${connectorName} connection could not be completed.</h1><p>${escapeHtml(error instanceof Error ? error.message : "Return to your agent and try again.")}</p>`,
          ),
        );
      return;
    }

    // relay.attach adds the second request listener for its own routes. Every other route must
    // finish here; returning without a response leaves clients waiting until they time out.
    if (
      path === "/mcp" ||
      path === "/dev/token" ||
      path === "/health" ||
      path === "/connect/exchange" ||
      path?.startsWith("/connect/") ||
      path?.startsWith("/approve/")
    )
      return;
    response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "not found" }));
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
