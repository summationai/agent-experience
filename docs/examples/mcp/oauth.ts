// #region resource-server
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { axeFetch } from "@summationai/axe-fetch";
import { createMcpServer, protectedResourceMetadata, serveHttp } from "@summationai/axe-mcp";
import type { AuthInfo, OAuthTokenVerifier } from "@summationai/axe-mcp";
import { axe } from "../apartments/site";

const MCP_URL = "https://oakridge-rentals.example/mcp";

// Tokens come from your existing authorization server. This verifier asks it about each token
// (RFC 7662 introspection) and refuses one issued for any other audience.
const verifier: OAuthTokenVerifier = {
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const res = await fetch("https://auth.oakridge-rentals.example/oauth/introspect", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${process.env.INTROSPECTION_CREDENTIALS}`,
      },
      body: new URLSearchParams({ token }),
    });
    const t = (await res.json()) as {
      active: boolean;
      sub?: string;
      client_id?: string;
      scope?: string;
      exp?: number;
      aud?: string | string[];
    };
    const audience = Array.isArray(t.aud) ? t.aud : [t.aud];
    if (!t.active || !t.sub || !audience.includes(MCP_URL))
      throw new InvalidTokenError("Token is not active for this server.");
    const info: AuthInfo = {
      token,
      clientId: t.client_id ?? "unknown",
      scopes: (t.scope ?? "").split(" ").filter(Boolean),
      extra: { sub: t.sub },
    };
    if (t.exp !== undefined) info.expiresAt = t.exp;
    return info;
  },
};

// RFC 9728 metadata: how an MCP client finds the authorization server.
const metadata = protectedResourceMetadata({
  resource: MCP_URL,
  authorizationServers: ["https://auth.oakridge-rentals.example"],
  scopesSupported: ["rentals"],
});

const mcpHandler = serveHttp(await createMcpServer(axe), {
  sessions: { idleTimeoutMs: 30 * 60_000 },
  auth: {
    verifier,
    requiredScopes: ["rentals"],
    resource: MCP_URL,
    resourceMetadataUrl: metadata.url,
  },
  // In process: each verified caller reaches the AXE runtime as themselves, as an adapter would
  // pass the identity. The site's own authenticate() is not consulted for these calls.
  clientFor: (authInfo) => ({ identity: { onBehalfOf: String(authInfo.extra?.["sub"]) } }),
});

const app = new Hono();
const axeHandler = axeFetch(axe);
app.all("/axe/*", (c) => axeHandler(c.req.raw));
app.get("/.well-known/axe.json", (c) => axeHandler(c.req.raw));
app.get(metadata.path, (c) => metadata.handler(c.req.raw));
app.all("/mcp", (c) => mcpHandler(c.req.raw));

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) });
// #endregion resource-server
