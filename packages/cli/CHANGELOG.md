# @summationai/axe

## 1.2.0

### Minor Changes

- b80d034: `axe surface init --agent-web` wires the agent web without manual steps. It adds the `/agent` route to a React Router route config (`app/routes.ts`), calls `agentEntry` first in the root loader (adding one when there is none), writes a Next.js `proxy.ts` (16 and later) or `middleware.ts` when the app has neither, and appends `AXE_AGENT_WEB_SECRET` and `AXE_AGENT_WEB_URL` to a gitignored `.env`, newline-safe. The generated `<AgentSurface>` renders the `/agent` link and a visually hidden link for agents, so the root document is not edited for them. `agentEntry`, `agentBrowsers`, and the new `forwardCookies` (the person's own cookies by name, for `session` in development) are in `@summationai/axe-core/agent-entry`, which has no Node imports. `axe host --agent-web --env-file <path>` reads the shared secret and its port from the site's env file. The integration prompt gives patterns for the profile's sign-in state, `session`, and a sign-in return path kept across SSO.

### Patch Changes

- 2c81422: The agent web's pages are answered from the site's own origin. `agentSiteHandler` without `agentUrl` (the new default) passes `/agent`, `/agent/start`, and `/agent/s/...` through to the service, and `axe host --agent-web` writes its links for `<site>/agent`, so an agent never follows a link to another origin: an agent's safeguards flagged the jump from the site to the service as a possible exfiltration, and a person reading the link sees only the site's address. The service stays on loopback, and local development with a tunnel needs one tunnel, for the site. Setting `agentUrl` keeps the redirect to the service's own origin. `axe surface init` reads the dev port from the app's `dev` script.
- c611fa2: Two applications on one machine no longer cross wires. The site's pass-through proves itself to the agent web with the shared secret, and the agent web refuses another site's secret ("This agent web serves a different site"), instead of showing that site's agent this one's pages and sign-in links. `axe surface init --agent-web` writes the first agent web port from 4719 that no other application in the repository claims and nothing listens on, and says which.
- 50254a7: From a fresh agent's install of the admin app: the README and the CLI's README lead with `surface init --agent-web` and say what a coding agent does when its permissions refuse `npx` (ask the person to run one command, rather than rebuild the generated files). The generated `agentEntry` call waits for `AXE_AGENT_WEB_SECRET`, and `agentSiteHandler` without a secret has no pages, so an app with the integration but no agent web set up answers as before (no redirect, `/agent` a 404). The prompt's sign-in return path expires after ten minutes, notes the yarn age gate, and lists the navigation Surface already reads, so integrators do not add rules for it.
- 08f3874: `axe surface init` prints the GitHub Packages and tarball install hints only when the @summationai scope is not already mapped to a registry (`.npmrc` or `npmScopes` in `.yarnrc.yml`, here or above), and a dry run says the agent web settings will be added when init applies, not that they were added.
- 8079af2: The integration prompt tells an integrator to keep the default policy (low and medium risk run, high waits) and to mark each destructive control high risk instead of raising the policy for a whole level: two fresh installs of an admin console made every medium-risk action wait for approval, so an ordinary save would have sent the person out of their agent.
- 8010294: Every CLI command the docs, the integration prompt, and the CLIs' own hints give is `npx @summationai/axe@latest …`. npx reuses a cached copy of an unversioned package, so a developer who ran `npx @summationai/axe` once kept running that CLI after later releases; a fresh install of the admin app ran a cached build from earlier the same day and generated an older integration.
- df533bc: `axe surface init` finds a taken agent web port by binding it, so a sandbox that refuses network connections no longer makes a busy port look free (a third fresh install got 4719, the web app's agent web, although a dry run had chosen 4721). Install hints name the CLI's own version instead of 1.0.0, and the CLI's README says it is part of the Body Spray SDK.
- 8832355: `SurfaceProfile` and `SurfaceProfileSource` are exported from `@summationai/axe-surface/auto`, where a generated `surface.config` already imports `SurfaceConfig`. `axe surface init`'s next steps report the profile and `agent-site.server` as done once the integrator has wired them, instead of repeating the instructions.
- Updated dependencies [2c81422]
- Updated dependencies [c611fa2]
- Updated dependencies [50254a7]
- Updated dependencies [b80d034]
- Updated dependencies [8010294]
  - @summationai/axe-core@1.2.0
  - @summationai/axe-host@1.2.0
  - @summationai/axe-relay@1.2.0
  - @summationai/axe-client@1.2.0
  - @summationai/axe-generate@1.2.0
  - @summationai/axe-mcp@1.2.0
  - @summationai/axe-testing@1.2.0

## 1.1.0

### Minor Changes

- WebMCP without a relay, headless: `axe host --dev --webmcp --stdio` serves a page's own WebMCP tools to a desktop agent from headless Chromium, with the person asked before high-risk controls (a host-delivered approver, [S-WEB-6]) and the page's own tool hints. `exposeWebMcp(surface, { granularity: "domain" })` offers a fixed tool set taking entry ids (`surface_navigate`, `surface_set-field`, `surface_run-control`, `surface_load-more`) with an observe tool that filters and pages ([S-WEB-7]). Easy mode reads tenants, tables, and filter strips as the choices they are, reads a listing rendered as buttons, reads through `display: contents`, and never puts script text in notices. `axe surface coverage --state` reuses a saved sign-in and reads each page once it settles.
- `axe surface init --agent-web` writes the site's side of the agent web: an `agent-site.server` module (fail-closed `identify` and `session` to finish) and an `/agent` route for Next.js and React Router file routes. The integration prompt covers wiring them, `agentEntry`, naming the entry in the page, and not gating navigation.

### Patch Changes

- Updated dependencies
  - @summationai/axe-host@1.1.0
  - @summationai/axe-relay@1.1.0
  - @summationai/axe-client@1.1.0
  - @summationai/axe-core@1.1.0
  - @summationai/axe-generate@1.1.0
  - @summationai/axe-mcp@1.1.0
  - @summationai/axe-testing@1.1.0
