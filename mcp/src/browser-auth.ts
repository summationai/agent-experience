/** Provider-owned OAuth session for human browser handoffs. No application-specific behavior. */
import { createHash, randomBytes } from "node:crypto";
import type { AuthInfo, OAuthTokenVerifier } from "@axe/mcp";

interface AuthorizationMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
}

interface Pending {
  returnTo: string;
  verifier: string;
  expiresAt: number;
}

export interface BrowserAuthOptions {
  publicOrigin: string;
  authorizationServers: string[];
  scopes: string[];
  resource: string;
  verifier: OAuthTokenVerifier;
  /** Pre-registered public OAuth client. Without it, dynamic client registration is used. */
  clientId?: string;
  fetch?: typeof fetch;
}

export interface BrowserAuth {
  /** Create a one-time provider OAuth start URL that returns to this exact handoff URL. */
  signInUrl(returnTo: string): string;
  /** Verified OAuth identity from the provider browser session, or null. */
  authInfo(request: Request): AuthInfo | null;
  /** Handle `/human-auth/*`; null for another path. */
  handle(request: Request): Promise<Response | null>;
}

function object(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}

function cookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

function redirect(location: string, headers: Record<string, string> = {}): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: location, "Cache-Control": "no-store", ...headers },
  });
}

/**
 * OAuth authorization for the person opening a hosted browser handoff. This is separate from MCP
 * bearer authentication because an ordinary browser opening a URL does not receive the MCP token.
 */
export function createBrowserAuth(options: BrowserAuthOptions): BrowserAuth {
  const publicUrl = new URL(options.publicOrigin);
  if (
    publicUrl.protocol !== "https:" &&
    !(
      publicUrl.protocol === "http:" &&
      ["localhost", "127.0.0.1", "::1", "[::1]"].includes(publicUrl.hostname)
    )
  )
    throw new Error("browser auth publicOrigin must use https (or loopback http).");
  const origin = publicUrl.origin;
  if (new URL(options.resource).origin !== origin)
    throw new Error("browser auth resource and publicOrigin must have the same origin.");
  const issuer = new URL(options.authorizationServers[0] ?? "");
  const fetcher = options.fetch ?? fetch;
  const callbackUrl = new URL("/human-auth/callback", origin).href;
  const pending = new Map<string, Pending>();
  const sessions = new Map<string, { authInfo: AuthInfo; expiresAt: number }>();
  let client: Promise<{ metadata: AuthorizationMetadata; clientId: string }> | null = null;

  const prune = (): void => {
    const now = Date.now();
    for (const [key, value] of pending) if (value.expiresAt <= now) pending.delete(key);
    for (const [key, value] of sessions) if (value.expiresAt <= now) sessions.delete(key);
    while (pending.size >= 1000) pending.delete(pending.keys().next().value!);
    while (sessions.size >= 10_000) sessions.delete(sessions.keys().next().value!);
  };

  const authorizationClient = (): Promise<{
    metadata: AuthorizationMetadata;
    clientId: string;
  }> => {
    if (client) return client;
    client = (async () => {
      const metadataResponse = await fetcher(
        new URL("/.well-known/oauth-authorization-server", issuer).href,
        { headers: { Accept: "application/json" } },
      );
      if (!metadataResponse.ok)
        throw new Error(`Authorization discovery returned HTTP ${metadataResponse.status}.`);
      const raw = object(await metadataResponse.json(), "Authorization discovery was invalid.");
      const metadata: AuthorizationMetadata = {
        issuer: String(raw["issuer"] ?? ""),
        authorization_endpoint: String(raw["authorization_endpoint"] ?? ""),
        token_endpoint: String(raw["token_endpoint"] ?? ""),
        ...(typeof raw["registration_endpoint"] === "string" && raw["registration_endpoint"]
          ? { registration_endpoint: raw["registration_endpoint"] }
          : {}),
      };
      for (const [name, value] of Object.entries({
        issuer: metadata.issuer,
        authorization_endpoint: metadata.authorization_endpoint,
        token_endpoint: metadata.token_endpoint,
      }))
        if (!value) throw new Error(`Authorization discovery omitted ${name}.`);
      if (new URL(metadata.issuer).origin !== issuer.origin)
        throw new Error("Authorization discovery returned an unexpected issuer.");
      if (options.clientId) return { metadata, clientId: options.clientId };
      if (!metadata.registration_endpoint)
        throw new Error(
          "Authorization discovery omitted registration_endpoint; configure a browser OAuth client id.",
        );
      const registration = await fetcher(metadata.registration_endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          client_name: "Agent Experience secure browser handoff",
          redirect_uris: [callbackUrl],
          token_endpoint_auth_method: "none",
          grant_types: ["authorization_code"],
          response_types: ["code"],
        }),
      });
      if (!registration.ok)
        throw new Error(`OAuth client registration returned HTTP ${registration.status}.`);
      const registered = object(await registration.json(), "OAuth registration was invalid.");
      const clientId = registered["client_id"];
      if (typeof clientId !== "string" || !clientId)
        throw new Error("OAuth registration omitted client_id.");
      return { metadata, clientId };
    })().catch((error) => {
      client = null;
      throw error;
    });
    return client;
  };

  const signInUrl = (returnTo: string): string => {
    const target = new URL(returnTo);
    if (target.origin !== origin || !target.pathname.startsWith("/human-session/"))
      throw new Error("browser auth return URL is outside the human-session routes.");
    prune();
    const state = randomBytes(24).toString("base64url");
    pending.set(state, {
      returnTo: target.href,
      verifier: randomBytes(32).toString("base64url"),
      expiresAt: Date.now() + 10 * 60_000,
    });
    return new URL(`/human-auth/start/${state}`, origin).href;
  };

  return {
    signInUrl,
    authInfo(request) {
      prune();
      const id = cookie(request, "axe_human_auth");
      return id ? (sessions.get(id)?.authInfo ?? null) : null;
    },
    async handle(request) {
      const url = new URL(request.url);
      if (url.origin !== origin || !url.pathname.startsWith("/human-auth/")) return null;
      prune();
      const start = url.pathname.match(/^\/human-auth\/start\/([A-Za-z0-9_-]{32,64})$/);
      if (request.method === "GET" && start) {
        const state = start[1]!;
        const login = pending.get(state);
        if (!login)
          return new Response("This sign-in request is unknown or expired.", { status: 410 });
        try {
          const { metadata, clientId } = await authorizationClient();
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
          if (options.scopes.length)
            authorization.searchParams.set("scope", options.scopes.join(" "));
          authorization.searchParams.set("resource", options.resource);
          return redirect(authorization.href);
        } catch {
          return new Response("Provider sign-in is temporarily unavailable.", { status: 503 });
        }
      }
      if (request.method === "GET" && url.pathname === "/human-auth/callback") {
        const state = url.searchParams.get("state") ?? "";
        const code = url.searchParams.get("code") ?? "";
        const login = pending.get(state);
        pending.delete(state);
        if (!login || !code)
          return new Response("This sign-in response is unknown or expired.", { status: 400 });
        try {
          const { metadata, clientId } = await authorizationClient();
          const tokenResponse = await fetcher(metadata.token_endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Accept: "application/json",
            },
            body: new URLSearchParams({
              grant_type: "authorization_code",
              code,
              client_id: clientId,
              redirect_uri: callbackUrl,
              code_verifier: login.verifier,
              resource: options.resource,
            }),
          });
          if (!tokenResponse.ok)
            throw new Error(`Token exchange returned HTTP ${tokenResponse.status}.`);
          const token = object(await tokenResponse.json(), "Token response was invalid.");
          const accessToken = token["access_token"];
          if (typeof accessToken !== "string" || !accessToken)
            throw new Error("Token response omitted access_token.");
          const authInfo = await options.verifier.verifyAccessToken(accessToken);
          const id = randomBytes(32).toString("base64url");
          sessions.set(id, {
            authInfo,
            expiresAt:
              typeof authInfo.expiresAt === "number"
                ? Math.min(authInfo.expiresAt * 1000, Date.now() + 12 * 60 * 60_000)
                : Date.now() + 12 * 60 * 60_000,
          });
          return redirect(login.returnTo, {
            "Set-Cookie": `axe_human_auth=${encodeURIComponent(id)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200`,
          });
        } catch {
          return new Response("Provider sign-in could not be verified.", { status: 401 });
        }
      }
      return new Response("Not found", { status: 404 });
    },
  };
}
