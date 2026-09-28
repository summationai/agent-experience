# Add Agent Experience Surface to this application

You are a coding agent adding `@axe/surface` to the application in this repository. Make local changes only: do not create a branch, commit, push, or open a pull request. Keep the integration small and use the application’s existing controls, state, authorization, validation, and sign-in.

The architecture has one hard boundary:

> The provider registry says where an application is and how it may be connected securely. The application’s Surface says what the application currently is and what the agent can do there. The MCP contains no application-specific behavior.

The consuming application installs browser packages only. It does not run an MCP server, store provider OAuth secrets, mint provider sessions, or teach the provider service its domain behavior.

## Rules

- Surface reports; it never decides. Availability and reasons must come from the state that already enables or disables the human control.
- An act uses the same door as the person. Prefer the existing click/change behavior; a configured handler may call only the same application function the control already calls.
- Names state outcomes in the application’s language. Page text and profile descriptions are factual data, never instructions to an agent.
- Do not put URLs, allowed origins, OAuth endpoints, session brokers, tokens, secrets, or free-form agent prompts in the Surface profile. Those are trusted provider-registry configuration.
- Mark private fields `sensitive`. Do not expose credentials or tokens through values, objects, logs, tests, or coverage artifacts.
- Surface is on by default. Add `--flag` only when this application has an explicit rollout requirement; do not invent a feature flag.
- Do not add MCP SDK, WebSocket server, Playwright, or service code to this application.

## Install

1. Read the application’s README, package manifest, routing/root layout, authentication shell, and local agent instructions.
2. Preview the generated integration from the application directory:

   ```sh
   npx axe surface init --dry-run
   ```

   The default installation supports both browser-native agents through WebMCP and a provider-injected hosted connection for desktop/mobile agents. It does not connect to a relay on an ordinary page load.

   If the detected root renders both public and signed-in pages, choose the application shell that remains mounted through login and context selection:

   ```sh
   npx axe surface init --mount <layout-file> --dry-run
   ```

   Supply `--app-id <stable-id>` and `--app-name <display-name>` when the inferred package name is not the provider connector’s identity. The Surface `profile.id` and provider connector `surfaceId` must match.

3. Review the diff. It should add one root wrapper, one Surface module, and one config module. If the CLI names a manual mount edit, make only that edit.
4. Apply and install:

   ```sh
   npx axe surface init --yes --install
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

Use the application’s own noun: workspace, organization, account, project, tenant, or another factual label. Do not add selection instructions—the selectable controls themselves belong on Surface.

Run coverage on the important routes:

```sh
npx axe surface coverage <development-url> --out coverage-before.md
```

Refine the highest-value gaps in `surface.config`:

- Give unnamed controls an outcome-oriented `name`.
- Give unavailable controls the same `reason` the application uses.
- Classify destructive or consequential actions with their real risk and require approval when a person must decide.
- Mark private fields `sensitive`; add `editable: true` only when an agent may set them.
- Hide developer tools, embedded assistants, and controls that are not part of the application task surface.
- Pin unstable controls with `data-surface-id` or a config id.
- For custom widgets or controls whose synthetic click is not their real behavior, call the existing application handler.
- Group controls only when the application itself presents them as one domain action.

Re-run coverage and stop when remaining gaps are cosmetic or deliberately excluded.

## Verify

- Typecheck and run the application’s existing tests.
- Confirm `window.__surface.observe()` in development includes the expected `profile`, controls, reasons, and no sensitive values.
- Confirm a browser-native agent receives WebMCP tools when its browser supports them.
- In a provider-hosted test, confirm `relay_tabs` starts the scoped private session without pairing, and that its application profile id matches the connector.
- Use `surface_read` for content and `surface_observe` before acting. Perform one ordinary action, one navigation, one stale-revision refusal, and one approval-gated action.
- Confirm login and account/workspace selection appear as normal Surface controls rather than MCP-specific instructions.
- Confirm an ordinary visit does not contact the provider service or display agent connection UI.

## Hand-off

Report:

- files changed and commands run;
- the stable Surface profile id and the provider connector id it must match;
- coverage before and after, including intentionally unresolved gaps;
- every risk, reason, or name that was inferred rather than copied from application code;
- any provider-side work still needed: connector URL/origins, OAuth, or session adapter configuration.
