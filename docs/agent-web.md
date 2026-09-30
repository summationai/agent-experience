# Agent web (experimental)

The agent web serves an application's Surface to an agent that has nothing installed: no MCP server, no connector, no browser extension. The person starts in their agent ("list my tables in Summation") and stays there. The one thing the agent needs is a tool almost every agent already has: fetching a URL.

It is experimental. Everything below runs and is tested against an agent that follows the documented rules of a model's web fetch; it has not yet been run from a real Claude conversation (see [What is not proven yet](#what-is-not-proven-yet)).

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
| Enter a number | A keypad of links: each digit is a link, then "Done, set it to 1555" |
| Sign in | A deep link to the site's own page, `/agent/signin?agent_session=<id>` |
| Approve a high-risk action | A deep link to the site's own page, `/agent/approve/<id>`; nothing runs until the person decides there |
| Type free text | A deep link to the site's own page, `/agent/input/<id>`; the person types it there, and the agent learns only that it was set |

The person opens a deep link in their own browser, on the site, signed in with the site's own session. No browser session is mirrored anywhere: the site's server tells the service what the person did, and the agent's "continue" link shows it.

### Connecting a session

1. The agent fetches `https://agent.example.com/start` (the site can name it in its HTML, or the person gives it). The page opens a pending session with a code, `4F7-K2Q`, and gives the sign-in link to pass on.
2. The person opens `https://app.example.com/agent/signin?agent_session=<id>`, signs in as usual if they are not, sees the same code, and presses Connect. That page says what the agent will be able to do, as whom.
3. The site mints an application session for the agent's headless page (not the person's own browser cookie) and hands it to the service. The agent's next link reads the page as that person.

## Adding it to a site

The site's side is `agentSiteHandler` from `@summationai/axe-host/site`, a Web `Request` handler with no browser dependency, mounted at `/agent/*`. In Next.js (the reference application's `lib/agent-site.ts` and `app/agent/[...path]/route.ts`):

```ts
import { agentSiteHandler } from "@summationai/axe-host/site";

export const agentSite = agentSiteHandler({
  serviceUrl: process.env.AXE_AGENT_WEB_URL!, // the agent web service
  secret: process.env.AXE_AGENT_WEB_SECRET!, // shared with it
  identify: (request) => personFromSession(request), // { principal, tenant?, displayName? } or null
  session: (_request, who) => ({ cookies: [mintAgentSession(who)] }), // the headless page's session
  loginUrl: (returnTo) => `/login?next=${encodeURIComponent(returnTo)}`,
});
// app/agent/[...path]/route.ts: GET and POST return (await agentSite(request)) ?? 404
```

The service is `createAgentWeb` from `@summationai/axe-host`, operated by the Surface provider. For development:

```sh
export AXE_AGENT_WEB_SECRET=…   # the same value the site has
axe host --dev --agent-web --app http://localhost:3000 --start /plan --name "Plan Review"
```

It listens on 4719. A model's web fetch runs on the model provider's servers and cannot reach loopback, so a real agent needs this service and the site on public HTTPS: pass `--public <origin>` with the service's public origin, and `--site <origin>` when the site is not the app URL.

## Security

- **The session link is a bearer link.** Anyone holding `/s/<session>/…` acts as the person it was connected to. It lives in the agent's transcript, so it ends after two hours without use (`sessionIdleMs`), and the site can end the application session it minted for the agent at any time.
- **Connecting needs the person, signed in, on the site.** The sign-in page shows the code the agent showed; the person connects only if it matches. A session connects once.
- **Approval and text come only from the person on the site.** Each of those pages checks that the signed-in person is the one the session acts for, and each form carries a nonce bound to the request, the person, and the shared secret. The agent's web fetch cannot post a form and carries no cookies.
- **The site API needs the shared secret.** `/api/sessions/…` and `/api/pending/…` answer only a request with `Authorization: Bearer <secret>`.
- **Nothing is cached.** Every page is `Cache-Control: no-store, private`: a page is one person's, at one moment.
- **Page text is data.** Every page says so, as the MCP tools do.

## What is not proven yet

These depend on how a real agent's web fetch behaves, and a run from a real Claude conversation, with both services on public HTTPS, settles them:

1. **A session link from a fetched page.** Web fetch refuses a URL that looks like it carries a credential unless the credential appeared in the person's own message. If it treats the session link that way, the person pastes one short link after connecting.
2. **Caching.** Web fetch caches by URL. If it serves a cached `/start` to two people despite `no-store`, they would share a pending session; the code shown on the site, and the account named on every page, are the check until that is known. Every other link is unique.
3. **Whether the agent follows act links without stopping to ask** each time.
4. **Latency per step.** Each link is a server-side fetch: seconds, not the milliseconds of an MCP call.

The reference application has run end to end through it over HTTP: bob connected on the site, entered 1555 into Widgets, January 2027 by keypad, and saved; the server's plan showed 1555, in nine fetches.

## Next steps

- [WebMCP](webmcp.md): the page-side contract the agent web drives, and its headless bridge.
- [Unattended mode](host.md): the MCP path for agents that have a connector.
