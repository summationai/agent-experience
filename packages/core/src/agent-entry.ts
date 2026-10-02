/**
 * @summationai/axe-core/agent-entry: the parts of the agent web's site side that run anywhere a Web
 * `Request` does (Node, an Edge middleware, a worker). No Node imports. `@summationai/axe-core/agent-site`
 * re-exports all of it.
 */
import type { AgentSiteCookie } from "./agent-site";

/**
 * User agents of agents acting for a person: Claude Desktop's browser pane (`Claude/<ver>`,
 * observed), and the per-request fetchers the providers document: `Claude-User` (Claude's web
 * fetch, Claude Code), `ChatGPT-User`, `Google-Agent` (agents on Google's infrastructure),
 * `Perplexity-User`. Crawlers that index or train are not here. An agent driving the person's own
 * browser (Claude in Chrome, Atlas, Copilot in Edge) sends that browser's user agent and is not
 * recognizable; it has the site's own pages and session, and the page's Surface, anyway.
 */
export const agentBrowsers: readonly RegExp[] = [
  /\bClaude\/\d/,
  /\bClaude-User\b/,
  /\bChatGPT-User\b/,
  /\bGoogle-Agent\b/,
  /\bPerplexity-User\b/,
];

export interface AgentEntryOptions {
  /** Where the site's agent pages are mounted. Default `/agent`. */
  basePath?: string;
  /** User agents to send on. Default {@link agentBrowsers}. */
  agents?: readonly RegExp[];
}

/**
 * For the site's first response to a page request: when an agent's browser arrives at the site
 * from outside (a typed or pasted URL, a link from elsewhere), a 303 to `/agent`, the agent web's
 * entry, instead of the page a person would see. Otherwise null, and the site answers as usual.
 *
 * It never sends on a navigation within the site (`Sec-Fetch-Site: same-origin`), so a person
 * signing in from a link in the agent's browser, or using the site there, keeps the site. Nor a
 * request under `basePath`, a non-GET, a request for anything but a document, or a request with
 * `?agent=off`.
 */
export function agentEntry(request: Request, o: AgentEntryOptions = {}): Response | null {
  if (request.method !== "GET") return null;
  const ua = request.headers.get("user-agent") ?? "";
  // A signed agent (Web Bot Auth: ChatGPT agent sends `Signature-Agent: "https://chatgpt.com"`).
  // The signature is not verified here: a forged one only gets the agent pages, which ask the
  // person to sign in like any other visit.
  const signed = request.headers.has("signature-agent");
  if (!signed && !(o.agents ?? agentBrowsers).some((re) => re.test(ua))) return null;
  const site = request.headers.get("sec-fetch-site");
  if (site === "same-origin" || site === "same-site") return null;
  const dest = request.headers.get("sec-fetch-dest");
  if (dest && dest !== "document") return null;
  const url = new URL(request.url);
  const base = (o.basePath ?? "/agent").replace(/\/+$/, "");
  if (url.pathname === base || url.pathname.startsWith(`${base}/`)) return null;
  if (url.searchParams.get("agent") === "off") return null;
  return new Response(`This site's interface for agents is ${base}\n`, {
    status: 303,
    headers: {
      Location: base,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      Vary: "User-Agent, Sec-Fetch-Site",
    },
  });
}

/**
 * The person's own cookies named `names`, from `request`, as cookies for the agent's headless page
 * on this site. For `agentSiteHandler`'s `session` in development only: in production, mint a
 * session for the agent, so it can be ended on its own.
 */
export function forwardCookies(request: Request, names: readonly string[]): AgentSiteCookie[] {
  const header = request.headers.get("cookie") ?? "";
  const domain = new URL(request.url).hostname;
  const out: AgentSiteCookie[] = [];
  for (const name of names) {
    for (const part of header.split(";")) {
      const at = part.indexOf("=");
      if (at <= 0 || part.slice(0, at).trim() !== name) continue;
      let value = part.slice(at + 1).trim();
      try {
        value = decodeURIComponent(value);
      } catch {
        // Not percent-encoded: pass it on as sent.
      }
      out.push({ name, value, domain, path: "/", sameSite: "Lax" });
      break;
    }
  }
  return out;
}
