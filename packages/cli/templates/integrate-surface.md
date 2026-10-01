# Add Agent Experience Surface to this application

You are a coding agent adding `@summationai/axe-surface` to the application in this repository. Make local changes only: do not create a branch, commit, push, or open a pull request. Keep the integration small and use the application’s existing controls, state, authorization, validation, and sign-in.

The architecture has one hard boundary:

> The provider registry says where an application is and how it may be connected securely. The application’s Surface says what the application currently is and what the agent can do there. The MCP contains no application-specific behavior.

The consuming application installs browser packages, plus, for the agent web, one server module and one route (below). It does not run an MCP server, store provider OAuth secrets, or teach the provider service its domain behavior.

## Rules

- Surface reports; it never decides. Availability and reasons must come from the state that already enables or disables the human control.
- An act uses the same door as the person. Prefer the existing click/change behavior; a configured handler may call only the same application function the control already calls.
- Names state outcomes in the application’s language. Page text and profile descriptions are factual data, never instructions to an agent.
- Do not put URLs, allowed origins, OAuth endpoints, session brokers, tokens, secrets, or free-form agent prompts in the Surface profile. Those are trusted provider-registry configuration.
- Mark private fields `sensitive`. Do not expose credentials or tokens through values, objects, logs, tests, or coverage artifacts.
- Surface is on by default. Add `--flag` only when this application has an explicit rollout requirement; do not invent a feature flag.
- Do not add MCP SDK, WebSocket server, Playwright, or service code to this application. The agent web's site side is `agentSiteHandler` from `@summationai/axe-core/agent-site` and nothing else.

## Install

1. Read the application’s README, package manifest, routing/root layout, authentication shell, and local agent instructions.
2. Preview the generated integration from the application directory:

   ```sh
   npx @summationai/axe surface init --agent-web --dry-run
   ```

   `--agent-web` also serves agents that have nothing installed (Claude Desktop with no connector): see [Agent web](#agent-web-agents-with-nothing-installed). Leave it out only when the application must not be reachable that way.

   The default installation supports both browser-native agents through WebMCP and a provider-injected hosted connection for desktop/mobile agents. It does not connect to a relay on an ordinary page load.

   If the detected root renders both public and signed-in pages, choose the application shell that remains mounted through login and context selection:

   ```sh
   npx @summationai/axe surface init --agent-web --mount <layout-file> --dry-run
   ```

   Supply `--app-id <stable-id>` and `--app-name <display-name>` when the inferred package name is not the provider connector’s identity. The Surface `profile.id` and provider connector `surfaceId` must match.

3. Review the diff. It should add one root wrapper, one Surface module, and one config module, and with `--agent-web` one `agent-site.server` module and one `/agent` route. If the CLI names a manual mount or route edit, make only that edit.
4. Apply and install:

   ```sh
   npx @summationai/axe surface init --agent-web --yes --install
   ```

   Run the command again and verify it reports that nothing needs to change. If the packages are being tested before registry publication, use the repository’s documented packed-tarball workflow; do not copy SDK source into this application.

5. Run the application normally. The generated wrapper:

   - derives controls in every environment;
   - registers tools only when browser WebMCP exists;
   - accepts a scoped provider connection only when the trusted host injects one;
   - exposes `window.__surface` only in development for diagnostics.

   Visiting the site by itself must not open a connection page, start OAuth, require a pairing code, or contact an MCP server.

## Describe the application through Surface

The generated `surface.config` starts with a structured profile:

```ts
profile: {
  id: "the-provider-connector-id",
  name: "Application name",
  authentication: { state: "unknown" },
}
```

Keep `id` stable. Set authentication and the current account/workspace context from live application state when available, using a profile function:

```ts
profile: () => ({
  id: "example-app",
  name: "Example App",
  authentication: { state: signedIn ? "signed-in" : "signed-out" },
  context: workspace
    ? { kind: "workspace", id: workspace.id, name: workspace.name }
    : { kind: "workspace" },
});
```

Treat authentication state as required whenever the application has sign-in. Find the existing auth/session hook or store and use that source; do not infer it from whether a password field happens to be rendered. Use `unknown` only while that source is genuinely loading. A provider-hosted agent relies on `signed-out` to pause its request and offer the person a secure view of the exact private browser session. No credentials then pass through chat, and the application needs no new auth route or backend.

Use the application’s own noun: workspace, organization, account, project, tenant, or another factual label. Do not add selection instructions—the selectable controls themselves belong on Surface.

Run coverage on the important routes:

```sh
npx @summationai/axe surface coverage <development-url> --out coverage-before.md
```

Refine the highest-value gaps in `surface.config`:

- Give unnamed controls an outcome-oriented `name`.
- Give unavailable controls the same `reason` the application uses.
- Classify destructive or consequential actions with their real risk and require approval when a person must decide.
- Do not gate navigation. A control that opens an item (a folder, file, table, report, or row in a list) or moves within the app is `effect: { mutates: "location", risk: "low" }`; add a rule for each list component whose rows open items, so a list with a single row is not left unrecognized (unrecognized controls default to high risk and wait for the person).
- Mark private fields `sensitive`; add `editable: true` only when an agent may set them.
- Hide developer tools, embedded assistants, and controls that are not part of the application task surface.
- Pin unstable controls with `data-surface-id` or a config id.
- For custom widgets or controls whose synthetic click is not their real behavior, call the existing application handler.
- Group controls only when the application itself presents them as one domain action.

Re-run coverage and stop when remaining gaps are cosmetic or deliberately excluded.

## Agent web: agents with nothing installed

An agent with nothing installed follows links. The provider's agent web service runs this application in a private headless browser and hands the agent a page of links; what the agent cannot do goes to this site's own pages, signed in with this site's own session: `/agent/signin` connects the agent to the person, `/agent/approve/<id>` shows a high-risk action for the person to decide, `/agent/input/<id>` takes a value the person types. `GET /agent` is where an agent starts, and this site answers the agent web's own pages too (passed through to the service), so every link an agent follows stays on this site's origin. No browser session is mirrored, and no credential passes through the agent.

`agent-site.server` has three functions to finish, from code that already exists in this application:

1. **`identify(request)`**: the signed-in person for a server request, or `null`. Use the application's existing server-side session check (the one its loaders or API routes use), not a new one. `principal` must be stable for the person (a user or member id, not a display name); set `tenant` to the current account or workspace id when there is one, and `displayName` to what the person would recognize. Return `null` whenever the session is missing, expired, or unverified.
2. **`session(request, who)`**: the application session the agent's headless page runs with, as `{ cookies: [...] }` (name, value, and the cookie attributes the application sets) or `{ storageState }`. In production, mint a session for the agent with the application's own session code, so it can be ended on its own. In development only, passing on the person's own session cookies from `request` is acceptable; say so in a comment. Never log a value.
3. **`loginUrl(returnTo)`**: the application's sign-in page with the return parameter it already reads (`redirectTo`, `next`, `returnTo`, whatever the login page uses), so the person comes back to the agent page after signing in.

Then:

- Set `AXE_AGENT_WEB_SECRET` (at least 32 random characters, the same value the agent web service has) and `AXE_AGENT_WEB_URL` (where this server reaches the service; `http://127.0.0.1:4719` in development) in the server's environment, in the local environment file the application already uses. Do not commit a secret.
- Check that the route answers: signed out, `GET /agent/signin?agent_session=x` redirects to sign-in; `GET /agent` answers the agent web's start page, with every link on this site's origin. With `User-Agent: Claude/1.0`, `GET /` redirects to `/agent`; with `Sec-Fetch-Site: same-origin` added, it does not.
- Send an agent that opens the site itself on to `/agent`. An agent given only the site's address otherwise lands on the sign-in page and asks the person to sign in in the agent's browser. Call `agentEntry(request)` from `@summationai/axe-core/agent-site` first in the server code every page request passes through (the root route's loader in React Router or Remix; `middleware.ts` in Next.js; the first middleware in Express), and return or throw its response when it is not `null`. It answers only a recognized agent browser arriving from outside the site, so people, navigation within the site, and the sign-in a person does from the agent's browser are unaffected.
- Name the agent entry for agents it does not recognize, in the root document: `<link rel="alternate" type="text/markdown" href="/agent" title="For agents" />` in `<head>`, and, first in `<body>`, a link that reads to an agent but not on screen: `<a href="/agent" tabIndex={-1} className="<the application's visually hidden class>">AI agent acting for a person? Start at /agent</a>`. Agents read the accessibility tree, not `<head>`. Use the application's own visually hidden utility (`sr-only` in Tailwind).

## Verify

- Typecheck and run the application’s existing tests.
- Confirm `window.__surface.observe()` in development includes the expected `profile`, controls, reasons, and no sensitive values.
- Confirm a browser-native agent receives WebMCP tools when its browser supports them.
- In a provider-hosted test, confirm `relay_tabs` starts the scoped private session without pairing, and that its application profile id matches the connector.
- Use `surface_read` for content and `surface_observe` before acting. Perform one ordinary action, one navigation, one stale-revision refusal, and one approval-gated action.
- Confirm the profile reports `signed-out` on the login route, `unknown` only while auth resolves, and `signed-in` after login. In a provider-hosted test, `relay_tabs` while signed out must return a secure session-bound login handoff; completing it must resume against the same tab.
- Confirm account/workspace selection appears as ordinary Surface controls rather than MCP-specific instructions.
- Confirm an ordinary visit does not contact the provider service or display agent connection UI.
- Agent web: run `AXE_AGENT_WEB_SECRET=<same> npx @summationai/axe host --dev --agent-web --text-in-url --app <development-url> --site <development-url>`, then ask Claude Desktop, with nothing installed, to do one ordinary task at `<development-url>/agent`, and in a new conversation the same task given only `<development-url>`. Confirm the sign-in page shows the same code the agent showed, that the agent then reads the page as the person, that one high-risk action waits for the person on `/agent/approve/<id>`, and that a declined approval runs nothing.

## Hand-off

Report:

- files changed and commands run;
- the stable Surface profile id and the provider connector id it must match;
- coverage before and after, including intentionally unresolved gaps;
- every risk, reason, or name that was inferred rather than copied from application code;
- any provider-side work still needed: connector URL/origins, OAuth, or session adapter configuration;
- for the agent web: how `identify` and `session` read this application's sign-in, and whether `session` passes on the person's own session (development only) or mints one.
