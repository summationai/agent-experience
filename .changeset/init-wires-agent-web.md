---
"@summationai/axe": minor
"@summationai/axe-core": minor
"@summationai/axe-host": minor
---

`axe surface init --agent-web` wires the agent web without manual steps. It adds the `/agent` route to a React Router route config (`app/routes.ts`), calls `agentEntry` first in the root loader (adding one when there is none), writes a Next.js `proxy.ts` (16 and later) or `middleware.ts` when the app has neither, and appends `AXE_AGENT_WEB_SECRET` and `AXE_AGENT_WEB_URL` to a gitignored `.env`, newline-safe. The generated `<AgentSurface>` renders the `/agent` link and a visually hidden link for agents, so the root document is not edited for them. `agentEntry`, `agentBrowsers`, and the new `forwardCookies` (the person's own cookies by name, for `session` in development) are in `@summationai/axe-core/agent-entry`, which has no Node imports. `axe host --agent-web --env-file <path>` reads the shared secret and its port from the site's env file. The integration prompt gives patterns for the profile's sign-in state, `session`, and a sign-in return path kept across SSO.
