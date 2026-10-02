# @summationai/axe-host

## 1.2.0

### Minor Changes

- 2c81422: The agent web's pages are answered from the site's own origin. `agentSiteHandler` without `agentUrl` (the new default) passes `/agent`, `/agent/start`, and `/agent/s/...` through to the service, and `axe host --agent-web` writes its links for `<site>/agent`, so an agent never follows a link to another origin: an agent's safeguards flagged the jump from the site to the service as a possible exfiltration, and a person reading the link sees only the site's address. The service stays on loopback, and local development with a tunnel needs one tunnel, for the site. Setting `agentUrl` keeps the redirect to the service's own origin. `axe surface init` reads the dev port from the app's `dev` script.
- b80d034: `axe surface init --agent-web` wires the agent web without manual steps. It adds the `/agent` route to a React Router route config (`app/routes.ts`), calls `agentEntry` first in the root loader (adding one when there is none), writes a Next.js `proxy.ts` (16 and later) or `middleware.ts` when the app has neither, and appends `AXE_AGENT_WEB_SECRET` and `AXE_AGENT_WEB_URL` to a gitignored `.env`, newline-safe. The generated `<AgentSurface>` renders the `/agent` link and a visually hidden link for agents, so the root document is not edited for them. `agentEntry`, `agentBrowsers`, and the new `forwardCookies` (the person's own cookies by name, for `session` in development) are in `@summationai/axe-core/agent-entry`, which has no Node imports. `axe host --agent-web --env-file <path>` reads the shared secret and its port from the site's env file. The integration prompt gives patterns for the profile's sign-in state, `session`, and a sign-in return path kept across SSO.

### Patch Changes

- c611fa2: Two applications on one machine no longer cross wires. The site's pass-through proves itself to the agent web with the shared secret, and the agent web refuses another site's secret ("This agent web serves a different site"), instead of showing that site's agent this one's pages and sign-in links. `axe surface init --agent-web` writes the first agent web port from 4719 that no other application in the repository claims and nothing listens on, and says which.
- Updated dependencies [2c81422]
- Updated dependencies [c611fa2]
- Updated dependencies [50254a7]
- Updated dependencies [b80d034]
- Updated dependencies [8010294]
- Updated dependencies [3701f7a]
- Updated dependencies [8832355]
  - @summationai/axe-core@1.2.0
  - @summationai/axe-relay@1.2.0
  - @summationai/axe-surface@1.2.0
  - @summationai/axe-mcp@1.2.0

## 1.1.0

### Minor Changes

- WebMCP without a relay, headless: `axe host --dev --webmcp --stdio` serves a page's own WebMCP tools to a desktop agent from headless Chromium, with the person asked before high-risk controls (a host-delivered approver, [S-WEB-6]) and the page's own tool hints. `exposeWebMcp(surface, { granularity: "domain" })` offers a fixed tool set taking entry ids (`surface_navigate`, `surface_set-field`, `surface_run-control`, `surface_load-more`) with an observe tool that filters and pages ([S-WEB-7]). Easy mode reads tenants, tables, and filter strips as the choices they are, reads a listing rendered as buttons, reads through `display: contents`, and never puts script text in notices. `axe surface coverage --state` reuses a saved sign-in and reads each page once it settles.
- The agent web (experimental): a page's Surface for an agent with nothing installed. `axe host --dev --agent-web` serves the page as Markdown pages of single-use links, backed by the headless WebMCP bridge, so an agent that can only follow links (Claude Desktop, with no connector) reads and acts in the person's own account; `--text-in-url` lets an agent that composes URLs type a value as `?text=`. The person connects the session, approves high-risk actions, and types free text on the site's own pages (`agentSiteHandler` in `@summationai/axe-core/agent-site`). The dev log names each request's user agent, fetch metadata, and `Signature-Agent`.

### Patch Changes

- Updated dependencies
  - @summationai/axe-surface@1.1.0
  - @summationai/axe-relay@1.1.0
  - @summationai/axe-core@1.1.0
  - @summationai/axe-mcp@1.1.0
