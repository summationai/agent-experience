// Unattended mode in production: the agent signs in with OAuth; the application issues the
// browser session for the verified person; the host runs the app for them.
import { createHost } from "@summationai/axe-host";
import type { SessionFor } from "@summationai/axe-host";
import type { OAuthTokenVerifier } from "@summationai/axe-mcp";

declare const verifier: OAuthTokenVerifier;
/** Your backend: a short-lived application session for a verified user (your IdP's API). */
declare function mintAgentSession(input: {
  userId: string;
  orgId: string;
  scopes: string[];
}): Promise<{ jwt: string; expiresAt: number }>;

// #region session-for
// The application, not the SDK, issues the session: here a short-lived one minted for the user
// the agent's access token names, set as the app's own session cookie. Return null to refuse.
const sessionFor: SessionFor = async ({ principal, tenant, authInfo }) => {
  if (!authInfo?.scopes.includes("app:act")) return null;
  const session = await mintAgentSession({
    userId: principal,
    orgId: tenant,
    scopes: authInfo.scopes,
  });
  return {
    cookies: [
      {
        name: "app_session_jwt",
        value: session.jwt,
        url: "https://app.yogastudio.example",
        expires: Math.floor(session.expiresAt / 1000),
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      },
    ],
  };
};
// #endregion session-for

// #region production
const host = createHost({
  appUrl: "https://app.yogastudio.example",
  startPath: "/schedule",
  sessionFor,
  // Agents: an OAuth 2.1 resource server. `identify` names the person and tenant a verified
  // token speaks for; each gets its own browser context, started on their first tool call.
  agentAuth: {
    verifier,
    requiredScopes: ["app:act"],
    resource: "https://agents.yogastudio.example/mcp",
    identify: (authInfo) => {
      const sub = authInfo.extra?.["sub"];
      const org = authInfo.extra?.["org"];
      return typeof sub === "string" && typeof org === "string"
        ? { principal: sub, tenant: org }
        : null;
    },
  },
  // Where MCP clients find your authorization server (RFC 9728).
  protectedResource: {
    resource: "https://agents.yogastudio.example/mcp",
    authorizationServers: ["https://auth.yogastudio.example"],
    scopesSupported: ["app:act"],
  },
  // The identity provider's pages, if a session ever needs them; every other origin is refused.
  allowedOrigins: ["https://auth.yogastudio.example"],
  maxSessions: 50,
  idleMs: 10 * 60_000,
  onEvent: (event) => console.info("[host]", JSON.stringify(event)),
});

// Behind a TLS terminator at https://agents.yogastudio.example. The relay the hosted pages
// connect to runs inside this process, on loopback.
await host.listen({ host: "0.0.0.0", port: 8080 });
// #endregion production
