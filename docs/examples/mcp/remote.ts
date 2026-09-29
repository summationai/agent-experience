// #region remote
import { createMcpServer, serveHttp } from "@summationai/axe-mcp";
import type { AuthInfo, OAuthTokenVerifier } from "@summationai/axe-mcp";

declare const verifier: OAuthTokenVerifier;

// A site you reach over HTTP. The MCP access token was issued for this MCP server, not for the
// site, so it is not forwarded. Exchange it (RFC 8693) for a token the site accepts, per caller.
async function siteTokenFor(authInfo: AuthInfo): Promise<string> {
  const res = await fetch("https://auth.oakridge-rentals.example/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: authInfo.token,
      subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
      resource: "https://oakridge-rentals.example",
    }),
  });
  return ((await res.json()) as { access_token: string }).access_token;
}

const derived = await createMcpServer("https://oakridge-rentals.example", {
  // Revalidate the manifest at least every minute (a 304 when nothing changed).
  client: { manifestMaxAgeMs: 60_000 },
});

export const mcpHandler = serveHttp(derived, {
  sessions: true,
  auth: { verifier, resource: "https://mcp.homefinder.example/mcp" },
  clientFor: async (authInfo) => ({ client: { auth: await siteTokenFor(authInfo) } }),
});

// Optional: look for new or removed actions on a schedule, so connected sessions hear about
// them (tools/list_changed) without waiting for their next call.
setInterval(() => void derived.refresh(), 60_000).unref();
// #endregion remote
