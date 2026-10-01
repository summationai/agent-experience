# Agent web (experimental)

The agent web serves an application's Surface to an agent that has nothing installed: no MCP server, no connector, no browser extension. The person starts in their agent ("list my tables in Summation") and stays there. The one thing the agent needs is a tool almost every agent already has: fetching a URL.

It is experimental. It is tested against an agent that follows the documented rules of a model's web fetch, and it has been run from Claude Desktop with nothing installed (see [Run from Claude Desktop](#run-from-claude-desktop)).

## Why links

A model's web fetch sends a GET request, carries no cookies, and, to stop an agent smuggling data out in a URL, fetches only URLs that have already appeared in the conversation: in the person's message or in an earlier fetched page ([web fetch](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-fetch-tool)). It cannot fill in a template or add a query parameter of its own. So the agent web answers every request with a page of text whose links are the only way on:

```
# Plan Review, as bob, Acme Manufacturing

- **Count:** 0 ...                                   ← the page's content (surface_read)

## What you can do

- Add one: https://agent.example.com/s/2ryJ…/-ndx8YZ
- Widgets, January 2027 (now "1200"): enter a number https://agent.example.com/s/2ryJ…/7aZrZE, or ask the person to type it https://agent.example.com/s/2ryJ…/bvZDhv
- Delete everything (asks the person first): https://agent.example.com/s/2ryJ…/KMzQj9
```

A link is `/s/<session>/<link>`. The link's action and arguments stay on the server, bound to the page's revision, so a link is short, cannot be edited into another action, and acts once: following an act link again says "Already done" and shows the page as it is now. The page itself runs in headless Chromium on the service, one per agent session, through the [WebMCP bridge](webmcp.md#headless-bridge-experimental); the application offers its Surface with `exposeWebMcp` or `<SurfaceProvider webMcp>`, as for a browser's own agent.

## What the agent does, and what goes to the site

| The agent needs to | How |
| --- | --- |
| Read the page | Every page starts with its content, then its controls; "More of this page" and "More controls" links page through both |
| Click, navigate, choose an option | One link per control, and one link per option of a field that has options |
| Enter a number | A keypad of links: each digit is a link, then "Done, set it to 1555"; or, with `textInUrl`, one link the agent completes with `?text=1555` |
| Sign in | A deep link to the site's own page, `/agent/signin?agent_session=<id>` |
| Approve a high-risk action | A deep link to the site's own page, `/agent/approve/<id>`; nothing runs until the person decides there |
| Type free text | With `textInUrl`, a link the agent completes with `?text=<value>`; otherwise a deep link to the site's own page, `/agent/input/<id>`, where the person types it and the agent learns only that it was set |

The person opens a deep link in their own browser, on the site, signed in with the site's own session. No browser session is mirrored anywhere: the site's server tells the service what the person did, and the agent's "continue" link shows it.

### Connecting a session

1. The agent fetches `https://app.example.com/agent`: the person gives it the site's address, and the site sends an agent there ([below](#when-the-agent-is-given-only-the-sites-address)). The page opens a pending session with a code, `4F7-K2Q`, and gives the sign-in link to pass on. Every link the agent follows from here is on the site's own origin.
2. The person opens `https://app.example.com/agent/signin?agent_session=<id>`, signs in as usual if they are not, sees the same code, and presses Connect. That page says what the agent will be able to do, as whom.
3. The site mints an application session for the agent's headless page (not the person's own browser cookie) and hands it to the service. The agent's next link reads the page as that person.

## Adding it to a site

The site's side is `agentSiteHandler` from `@summationai/axe-core/agent-site`, a Web `Request` handler for the site's own server (Node, nothing else installed), mounted at `/agent` and `/agent/*`. `GET /agent` is where an agent that found the site starts. The agent web's own pages (`/agent`, `/agent/start`, `/agent/s/...`) are answered from the site too: the handler passes them through to the service (`serviceUrl`) and returns its answer, so an agent never follows a link to another origin. An agent's safeguards treat a jump to an origin the person never named as a possible exfiltration, and a person reading the link sees the site's own address. Set `agentUrl` to send agents to the service's own public origin instead (a 303 from `/agent` to `<agentUrl>/start`). In Next.js (the reference application's `lib/agent-site.ts` and `app/agent/[...path]/route.ts`):

```ts
import { agentSiteHandler } from "@summationai/axe-core/agent-site";

export const agentSite = agentSiteHandler({
  serviceUrl: process.env.AXE_AGENT_WEB_URL!, // the agent web service
  secret: process.env.AXE_AGENT_WEB_SECRET!, // shared with it
  identify: (request) => personFromSession(request), // { principal, tenant?, displayName? } or null
  session: (_request, who) => ({ cookies: [mintAgentSession(who)] }), // the headless page's session
  loginUrl: (returnTo) => `/login?next=${encodeURIComponent(returnTo)}`,
});
// app/agent/[...path]/route.ts: GET and POST return (await agentSite(request)) ?? 404
```

### When the agent is given only the site's address

An agent told "use Summation at app.example.com" opens the site itself, lands on the sign-in page, and asks the person to sign in in the agent's browser. `agentEntry(request)` sends it to `/agent` instead. `axe surface init --agent-web` calls it first in a React Router root loader, or writes a Next.js `proxy.ts` (Next.js 16) or `middleware.ts`; anywhere else, call it first wherever every page request passes. It comes from `@summationai/axe-core/agent-entry`, which has no Node imports, so an Edge middleware can use it:

```ts
import { agentEntry } from "@summationai/axe-core/agent-entry";

const toAgent = agentEntry(request); // a 303 to /agent, or null
if (toAgent) throw toAgent; // or return it
```

It answers only a GET for a document, from a user agent in `agentBrowsers` (Claude's in-app browser sends `Claude/<version>`; the providers' per-request fetchers send `Claude-User`, `ChatGPT-User`, `Google-Agent`, `Perplexity-User`) or with a `Signature-Agent` header (a signed agent, such as ChatGPT agent), arriving from outside the site. An agent driving the person's own browser (Claude in Chrome, Copilot in Edge) sends that browser's user agent and is not sent on; it has the site's own pages and session already. A navigation within the site (`Sec-Fetch-Site: same-origin`) is never sent on, so the person can still sign in from a link in the agent's browser, and `?agent=off` opens the site as usual. For an agent it does not recognize, the generated `<AgentSurface>` names the entry in the page: a `<link rel="alternate" type="text/markdown" href="/agent">` (React 19 renders it in `<head>`), and a visually hidden link, since agents read the accessibility tree rather than `<head>`.

The service is `createAgentWeb` from `@summationai/axe-host`, operated by the Surface provider. For development:

```sh
axe host --dev --agent-web --env-file .env --app http://localhost:3000 --start /plan --name "Plan Review"
```

`--env-file` reads the secret the site has (`AXE_AGENT_WEB_SECRET`, which `init --agent-web` writes to a gitignored `.env`) and the port from `AXE_AGENT_WEB_URL`; `AXE_AGENT_WEB_SECRET` in the environment works too.

It listens on 4719, on loopback, and only the site's server reaches it. Its links are written for `<site>/agent` (`--site`, default the app URL; `--public` overrides it for a site that sets `agentUrl`). A model's web fetch runs on the model provider's servers and cannot reach loopback, so a real agent needs the site on public HTTPS; the service stays where it is. [Local development with cloudflared](#local-development-with-cloudflared) does this from a laptop.

### Local development with cloudflared

Claude Desktop needs no tunnel: it opens the links in its own browser, on the person's machine, so the service, the site, and the agent can all be on loopback. An agent whose web fetch runs on its provider's servers (Claude on the web and on mobile, ChatGPT, Perplexity) cannot reach loopback, and needs the site on public HTTPS. Only the site: it answers the agent web's pages itself, and the service stays on loopback. Cloudflare's quick tunnels give a local port a public `https://<words>.trycloudflare.com` origin, with no account.

1. Install it: `brew install cloudflared` (other platforms: [Cloudflare's downloads](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)).
2. Open a tunnel to the site, and note the origin it prints:

   ```sh
   cloudflared tunnel --url http://localhost:3000   # the site (5173 for a Vite dev server)
   ```

3. Let the site's dev server answer its tunnel origin. Development servers refuse a host they do not know:
   - Next.js: `allowedDevOrigins` in `next.config`, or sign-in and every client-side control silently do nothing (its HMR socket is refused). The reference application reads `NEXT_ALLOWED_DEV_ORIGINS`.
   - Vite (React Router, Remix, SvelteKit): `server.allowedHosts: [".trycloudflare.com"]`, or every request answers "Blocked request. This host is not allowed."
   - An application that checks `Origin` on writes needs the tunnel origin among its trusted origins too; the reference application reads `PLAN_REVIEW_TRUSTED_ORIGINS`.
4. Start the site. `AXE_AGENT_WEB_URL` stays on loopback: the site's server reaches the service directly, and answers the agent pages from the tunnel origin:

   ```sh
   AXE_AGENT_WEB_SECRET=… AXE_AGENT_WEB_URL=http://127.0.0.1:4719 \
   NEXT_ALLOWED_DEV_ORIGINS=<site>.trycloudflare.com \
   PLAN_REVIEW_TRUSTED_ORIGINS=http://127.0.0.1:3000,https://<site>.trycloudflare.com \
   pnpm --filter plan-review-example dev
   ```

5. Start the agent web with the site's tunnel origin. `--app` stays local, because the service's own headless browser loads the page; `--site` is the origin every link it writes is on:

   ```sh
   AXE_AGENT_WEB_SECRET=… axe host --dev --agent-web --text-in-url \
     --app http://localhost:3000 --site https://<site>.trycloudflare.com --start /plan --name "Plan Review"
   ```

6. Check from outside: `curl -s https://<site>.trycloudflare.com/agent` answers the start page, and every link on it is on `https://<site>.trycloudflare.com`. Then give the agent `https://<site>.trycloudflare.com` (or `/agent`).

What to expect:

- **A quick tunnel's origin changes every time it starts.** Restart the agent web with the new `--site`, and update the dev server's allowed hosts.
- **Signing in on the tunnel origin is a separate session** from the same app on `localhost`: cookies belong to the origin.
- **Cloudflare answers some agents itself.** It serves its own managed `robots.txt` and refuses training crawlers (`GPTBot` gets `403`); per-request fetchers (`Claude-User`, `ChatGPT-User`) pass. The agent web's dev log shows each request that reached it, with its user agent, `Sec-Fetch-Site`, `Signature-Agent`, and the client address Cloudflare reports (`from=`), so a request that is missing from the log never left the agent or was stopped at the edge.
- **Some agents fetch only URLs they already know.** Codex's web tool reads from OpenAI's index and refuses any URL it has not seen, even with `--search`; it never reaches the tunnel, and the agent web's fresh links cannot work through it.
- **If `cloudflared` stalls on "Failed to initialize DNS local resolver ... i/o timeout"**, typically behind a VPN whose first resolver does not answer direct queries, use the system resolver: `GODEBUG=netdns=cgo cloudflared tunnel --url http://localhost:3000`.
- **A tunnel makes the dev server public.** Anyone with the origin reaches it, and a session link is a bearer link. Use demo data, and stop the tunnels when the run is over.

## Security

- **The session link is a bearer link.** Anyone holding `/s/<session>/…` acts as the person it was connected to. It lives in the agent's transcript, so it ends after two hours without use (`sessionIdleMs`), and the site can end the application session it minted for the agent at any time.
- **Connecting needs the person, signed in, on the site.** The sign-in page shows the code the agent showed; the person connects only if it matches. A session connects once.
- **Approval and text come only from the person on the site.** Each of those pages checks that the signed-in person is the one the session acts for, and each form carries a nonce bound to the request, the person, and the shared secret. The agent's web fetch cannot post a form and carries no cookies.
- **The site API needs the shared secret.** `/api/sessions/…` and `/api/pending/…` answer only a request with `Authorization: Bearer <secret>`.
- **Nothing is cached.** Every page is `Cache-Control: no-store, private`: a page is one person's, at one moment.
- **Page text is data.** Every page says so, as the MCP tools do.

## Run from Claude Desktop

Three runs on 2026-09-30 from Claude Desktop, with nothing installed (no connector, no MCP server), against the reference application, signed in on its own pages as bob at Acme. The server's saved plan showed each value afterwards.

| Task | Route | Agent requests, plan to saved | Time |
| --- | --- | --- | --- |
| Widgets, January 2027 to 1555 | keypad (1, 5, 5, 5, Done), Save; through public tunnels | 8 | 25 s |
| Gaskets, March 2027 to 4321 | `?text=4321`, Save; through public tunnels; asked to type the value itself | 3 | 10 s |
| Brackets, May 2027 to 2468 | `?text=2468`, Save; on `127.0.0.1` with no tunnel; chose to type it itself | 3 | 7 s |

What the runs settled:

- **Claude Desktop opens the links in its own browser, on the person's machine.** Every request carried the app's user agent and was followed by a favicon request, and the loopback run worked, so it is not a server-side web fetch. A session link from a fetched page was followed; nothing had to be pasted.
- **It composes URLs.** Given a link that takes `?text=`, it put the value in the URL itself. So in Claude Desktop, typing needs neither the keypad nor the site's page; the service offers that link with `textInUrl` (`--text-in-url`), off by default, because an agent limited to URLs it has seen cannot use it.
- **It follows act links without stopping to ask**, about three seconds apart, almost all of it the model's time: the service answered in 0 to 145 ms, and 1.6 s for a session's first page while its headless browser started.
- **No caching was seen**: every link reached the service, and `/start` was requested once per run.

Still to run: Claude on the web and on mobile, where a server-side web fetch may apply the rules the link-only design was built for, and the sign-in, approval, and text pages for a production site. Local development with Claude Desktop needs no tunnel; the service, the site, and the agent can all be on loopback.

## Next steps

- [WebMCP](webmcp.md): the page-side contract the agent web drives, and its headless bridge.
- [Unattended mode](host.md): the MCP path for agents that have a connector.
