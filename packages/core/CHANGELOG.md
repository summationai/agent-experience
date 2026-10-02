# @summationai/axe-core

## 1.2.0

### Minor Changes

- 2c81422: The agent web's pages are answered from the site's own origin. `agentSiteHandler` without `agentUrl` (the new default) passes `/agent`, `/agent/start`, and `/agent/s/...` through to the service, and `axe host --agent-web` writes its links for `<site>/agent`, so an agent never follows a link to another origin: an agent's safeguards flagged the jump from the site to the service as a possible exfiltration, and a person reading the link sees only the site's address. The service stays on loopback, and local development with a tunnel needs one tunnel, for the site. Setting `agentUrl` keeps the redirect to the service's own origin. `axe surface init` reads the dev port from the app's `dev` script.
- b80d034: `axe surface init --agent-web` wires the agent web without manual steps. It adds the `/agent` route to a React Router route config (`app/routes.ts`), calls `agentEntry` first in the root loader (adding one when there is none), writes a Next.js `proxy.ts` (16 and later) or `middleware.ts` when the app has neither, and appends `AXE_AGENT_WEB_SECRET` and `AXE_AGENT_WEB_URL` to a gitignored `.env`, newline-safe. The generated `<AgentSurface>` renders the `/agent` link and a visually hidden link for agents, so the root document is not edited for them. `agentEntry`, `agentBrowsers`, and the new `forwardCookies` (the person's own cookies by name, for `session` in development) are in `@summationai/axe-core/agent-entry`, which has no Node imports. `axe host --agent-web --env-file <path>` reads the shared secret and its port from the site's env file. The integration prompt gives patterns for the profile's sign-in state, `session`, and a sign-in return path kept across SSO.

### Patch Changes

- c611fa2: Two applications on one machine no longer cross wires. The site's pass-through proves itself to the agent web with the shared secret, and the agent web refuses another site's secret ("This agent web serves a different site"), instead of showing that site's agent this one's pages and sign-in links. `axe surface init --agent-web` writes the first agent web port from 4719 that no other application in the repository claims and nothing listens on, and says which.
- 50254a7: From a fresh agent's install of the admin app: the README and the CLI's README lead with `surface init --agent-web` and say what a coding agent does when its permissions refuse `npx` (ask the person to run one command, rather than rebuild the generated files). The generated `agentEntry` call waits for `AXE_AGENT_WEB_SECRET`, and `agentSiteHandler` without a secret has no pages, so an app with the integration but no agent web set up answers as before (no redirect, `/agent` a 404). The prompt's sign-in return path expires after ten minutes, notes the yarn age gate, and lists the navigation Surface already reads, so integrators do not add rules for it.

## 1.1.0

### Minor Changes

- `@summationai/axe-core/agent-site`: the site's side of the agent web, for the site's own server. `agentSiteHandler` serves `/agent` (on to the agent web's `/start`), `/agent/signin`, `/agent/approve/<id>`, and `/agent/input/<id>`, signed in with the site's own session, with nonce-signed forms and a shared-secret site API. `agentEntry(request)` sends a recognized agent (Claude's browser, `Claude-User`, `ChatGPT-User`, `Google-Agent`, `Perplexity-User`, or a signed agent) that opens the site from outside on to `/agent`; people and navigation within the site are untouched.
