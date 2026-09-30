// The site's side of the agent web (docs/agent-web.md): the pages a person opens from an agent's
// deep link, signed in with this app's own session. The agent's headless page gets a session of
// its own, minted here, never the person's browser cookie.
import { agentSiteHandler } from "@summationai/axe-host/site";
import { SESSION_COOKIE, readCookie } from "./axe";
import { store } from "./store";

const TENANTS: Record<string, string> = { acme: "Acme Manufacturing", globex: "Globex Foods" };

export const agentSite = agentSiteHandler({
  serviceUrl: process.env["AXE_AGENT_WEB_URL"] ?? "http://127.0.0.1:4719",
  secret: process.env["AXE_AGENT_WEB_SECRET"] ?? "",
  identify: (request) => {
    const s = store.session(readCookie(request, SESSION_COOKIE));
    return s
      ? {
          principal: `${s.user}@${s.tenant}`,
          tenant: s.tenant,
          displayName: `${s.user}, ${TENANTS[s.tenant] ?? s.tenant}`,
        }
      : null;
  },
  session: (_request, who) => {
    const [user, tenant] = who.principal.split("@") as [string, string];
    return { cookies: [{ name: SESSION_COOKIE, value: store.createSession(user, tenant).id }] };
  },
  loginUrl: (returnTo) => `/login?next=${encodeURIComponent(returnTo)}`,
});
