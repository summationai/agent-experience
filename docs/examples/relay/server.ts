// A production relay: tabs sign in with relay tokens, agents with OAuth access tokens.
import { createRelay } from "@axe/relay/server";
import type { OAuthTokenVerifier } from "@axe/mcp";

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
];
// #endregion events

export { relay };
