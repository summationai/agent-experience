// A production relay: tabs sign in with relay tokens, agents with OAuth access tokens.
import { createRelay } from "@summationai/axe-relay/server";
import type { OAuthTokenVerifier } from "@summationai/axe-mcp";

declare const verifier: OAuthTokenVerifier;

// #region production
const relay = createRelay({
  // The key the backend mints relay tokens with.
  secret: process.env["RELAY_TOKEN_SECRET"]!,
  // The pages that may connect a tab: exact origins, subdomains, or any port on localhost.
  origins: ["https://app.yogastudio.example", "https://*.yogastudio.example"],
  // Agents: an OAuth 2.1 resource server. `identify` says who a verified token speaks for; an
  // agent reaches only the tabs of that principal and tenant.
  agentAuth: {
    verifier,
    requiredScopes: ["relay"],
    resource: "https://relay.yogastudio.example/mcp",
    identify: (authInfo) => {
      const sub = authInfo.extra?.["sub"];
      const org = authInfo.extra?.["org"];
      return typeof sub === "string" && typeof org === "string"
        ? { principal: sub, tenant: org }
        : null;
    },
  },
  onEvent: (event) => console.info("[relay]", JSON.stringify(event)),
});

// Behind a TLS terminator: tabs connect to wss://relay.yogastudio.example/tab and agents to
// https://relay.yogastudio.example/mcp.
await relay.listen({ host: "0.0.0.0", port: 8080 });
// #endregion production

// #region events
// Every tab connection, refusal, Stop, and pairing is an event for your audit log. Acts are in
// the tab's ledger with the actor "<principal> (agent via relay)", and in the AXE action events.
export const auditEvents = [
  "tab.connected",
  "tab.refused",
  "tab.disconnected",
  "tab.stopped",
  "agent.paired",
  "approval.decided",
];
// #endregion events

// #region approvals
// Approvals asked through the agent (unattended tabs). A form in the agent's MCP client needs
// nothing here. The approval page (URL mode, for sensitive acts) needs to know who opened it:
// the person's own session on the relay's domain, never anything the agent sent.
declare function sessionFromCookie(request: Request): { userId: string; studioId: string } | null;

export const unattended = createRelay({
  secret: process.env["RELAY_TOKEN_SECRET"]!,
  origins: ["https://app.yogastudio.example"],
  agentAuth: {
    verifier,
    identify: (authInfo) =>
      typeof authInfo.extra?.["sub"] === "string" && typeof authInfo.extra?.["org"] === "string"
        ? { principal: authInfo.extra["sub"], tenant: authInfo.extra["org"] }
        : null,
  },
  baseUrl: "https://relay.yogastudio.example",
  approvals: {
    identify: (request) => {
      const s = sessionFromCookie(request);
      return s ? { principal: s.userId, tenant: s.studioId } : null;
    },
    // Links work once, for five minutes by default.
    linkTtlMs: 300_000,
    // Decided on the page rather than in a form: anything touching payments.
    sensitive: (row) => row.object === "billing",
  },
});

// A host's own Stop control (its watch page) ends the person's sessions.
export function stopFor(userId: string, studioId: string): number {
  return unattended.stop({ principal: userId, tenant: studioId });
}
// #endregion approvals

export { relay };
