# Connect the Summation web app to the Agent Experience browser relay (internal)

This is a prompt for a coding agent working in the Summation monorepo (`summationai/code`). Give it this whole file. It adds the Surface integration to `js/apps/web-app`: the live controls, revision, ledger, and handlers stay in the page, and the lightweight browser client connects that page to the separately operated Agent Experience MCP service. The Summation application does not run an MCP server.

This is a local experiment. Work in the current checkout and leave the finished changes uncommitted in the working tree. Do not create a branch or worktree, commit, or push.

## Goal

Make the smallest local change that lets a desktop agent open Summation's ordinary sign-in/page flow and use the controls people already use, without running an MCP server in the Summation repository, adding a Summation backend endpoint, or pairing with a code.

Done means:

- only the browser packages `@axe/surface` and `@axe/relay` are added to the web app;
- the Surface provider is mounted inside the authenticated shell and behind `ui_axe_surface`;
- the generated provider has `webMcp` enabled and accepts the identity-bound browser handoff supplied by the provider-operated relay;
- the Addison agent UI is excluded from the derived surface;
- the app's normal checks pass; and
- connecting the provider relay causes the desktop client to open Summation's OAuth login and then an ordinary Summation tab, after which the installed package connects automatically and the agent can observe, read, wait, and perform one ordinary action without a pairing code.

Do not add an MCP server, hosted browser, token-minting route, session broker, or other backend integration to Summation. The service under `agent-experience/mcp` owns OAuth and relay transport; the installed browser package connects the page after the user's normal Summation sign-in. Do not add a second credential store or accept usernames and passwords through MCP or chat.

## Ground rules

- Read the Summation repo's `AGENTS.md` and `js/apps/web-app/AGENTS.md` first and follow them.
- Preserve all existing local changes. Inspect `git status` before editing and do not overwrite unrelated work.
- Surface reports and never decides. Do not change application logic to make the agent's job easier; describe the controls and state the app already has.
- Keep the diff small: the authenticated-layout mount, `app/surface.tsx`, `app/surface.config.ts`, one flag key, package/lockfile/Dockerfile changes, the vendored tarballs, and at most a few targeted config or `data-surface-ignore` edits. Do not change sum-api.
- Do not add user-facing strings. Summation requires UI text through `useText()`.
- Never make approval reachable from an agent. In particular, do not expose `handle.approve`, and do not implement `requestApproval` with a WebMCP tool, an agent-visible control, an agent-supplied message, or automatic acceptance.
- `@axe/core` is a transitive package pin while the SDK is unpublished. Do not add it to the web app's dependencies; knip will treat it as unused. The root resolutions also pin `@axe/surface` so the vendored relay uses the same browser registry instance.

## Summation-specific facts to verify

These were true when this prompt was written. Inspect the current code before relying on them.

- **Mount point:** `app/root.tsx` also renders pre-auth pages. Mount in `app/routes/_main+/_layout.tsx`, inside the authenticated shell and below `FeatureFlagServiceProvider`, so `useFeatureFlag` is valid.
- **SSR:** `react-router.config.ts` has SSR enabled. `SurfaceProvider` starts only in an effect; do not add module-scope browser work or side-effect imports.
- **Flag:** feature flags use `useFeatureFlag("<key>")` from `~/feature-flags`, with keys declared in `app/feature-flags/gen/defaultFlags.json`. The local URL override `?ui_axe_surface=true` enables the flag for the session.
- **Packaging:** Yarn 4's registry age gate means the unpublished SDK must be consumed as local tarballs. The vendor directory must exist before `yarn install`, including in the Dockerfile.
- **Addison:** the Addison pane and composer are a different agent's UI. Its outermost element should carry `data-surface-ignore` so the desktop agent does not drive Addison through Surface.
- **Likely coverage gaps:** collapsed icon navigation, unnamed Tiptap/ProseMirror editors, `div role="button"` rows, missing landmarks, non-live toasts, Highcharts with accessibility disabled, SpreadJS canvas content, and virtualized grids. Treat coverage as evidence; do not preemptively rewrite all of these.

## Steps

### 1. Inspect both checkouts

In the Summation checkout, record the starting state for yourself:

```sh
git status --short
rg -n '^\[mcp_servers\.summation\]' .codex/config.toml 2>/dev/null || true
```

The second command must find nothing. A project-local `mcp_servers.summation` entry that launches `axe host` is legacy configuration: it starts a customer-checkout-specific MCP server and defeats the service boundary. Remove only that stale Summation server block (and its `[mcp_servers.summation.tools.*]` blocks), preserving unrelated project configuration. Configure the separately running `agent-experience` HTTP MCP service in the desktop agent instead; do not add a project-local command server.

Use the existing Agent Experience checkout at `~/code/agent-experience`. Do not switch branches or pull over local work. Confirm it contains the package-first implementation, then build it:

```sh
cd ~/code/agent-experience
git status --short
pnpm install
pnpm --filter @axe/core build
pnpm --filter @axe/surface build
pnpm --filter @axe/relay build
pnpm --filter axe build
pnpm --filter @axe/mcp-service build
```

If the checkout is elsewhere, use its absolute path consistently below.

### 2. Vendor only the packages the browser integration needs

From `js/apps/web-app` in the Summation checkout:

```sh
~/code/agent-experience/scripts/pack-for-consumer.sh vendor/axe core surface relay
```

This should produce:

- `vendor/axe/axe-core-0.1.0.tgz`
- `vendor/axe/axe-surface-0.1.0.tgz`
- `vendor/axe/axe-relay-0.1.0.tgz`
- `vendor/axe/SOURCE`

Do not pack or install `@axe/mcp`, `@modelcontextprotocol/sdk`, `ws`, or `@axe/host`; those are service-side dependencies and remain outside Summation.

#### Upgrading an existing Summation installation

Do not remove the existing integration or run `surface init` from scratch. If Summation already has the provider generated with `--remote`, upgrade it in place:

```sh
cd <summation-checkout>/js/apps/web-app
~/code/agent-experience/scripts/pack-for-consumer.sh vendor/axe core surface relay

cd <summation-checkout>
YARN_CHECKSUM_BEHAVIOR=update yarn install
```

Commit the refreshed files under `js/apps/web-app/vendor/axe/` together with the resulting `yarn.lock` checksum change. The one-command checksum override is needed because Yarn otherwise treats changed bytes at the same package locator as an error. The package versions remain `0.1.0` during local development, so the updated `SOURCE` file and lockfile checksum—not a version-number change—identify the upgrade.

No feature flag, mount, Surface config, sum-api route, database state, login configuration, or user data needs to be recreated. The new handoff behavior is inside `@axe/relay/client` and is picked up by the existing `injectedRelay()` call. Before stopping, verify that `app/surface.tsx` still imports `connectRelay` and `injectedRelay` from `@axe/relay/client`; if it does, do not regenerate the file. Only an older installation without that `--remote` shape needs the narrowly scoped Step 5 generator update.

### 3. Add the local package dependency

Make these local package changes:

- In `js/apps/web-app/package.json`, add only the browser packages:
  `"@axe/surface": "file:./vendor/axe/axe-surface-0.1.0.tgz"` and
  `"@axe/relay": "file:./vendor/axe/axe-relay-0.1.0.tgz"`.
- In the root `package.json` `resolutions`, add `@axe/core` and `@axe/surface`, both pointing at their tarballs under `js/apps/web-app/vendor/axe/`.
- Do not add `@axe/core` to the app's dependencies.
- In `js/apps/web-app/Dockerfile`, copy `js/apps/web-app/vendor/axe/` before the `RUN yarn install` layer, beside the existing local-tarball copy.
- Run `yarn install` at the Summation repo root. Re-run it whenever the tarballs change so `yarn.lock` has their current checksums.

### 4. Add the local feature flag

Add `"ui_axe_surface": false` to `app/feature-flags/gen/defaultFlags.json`.

Do not create or change remote Statsig configuration. The URL override is enough for this local experiment.

### 5. Mount the provider and browser relay client

Preview the generated change first:

```sh
node ~/code/agent-experience/packages/cli/dist/index.js surface init \
  --mount "app/routes/_main+/_layout.tsx" \
  --flag-hook 'useFeatureFlag("ui_axe_surface")' --flag-import "~/feature-flags" \
  --remote \
  --dry-run
```

`--remote` enables provider-supplied connections, including the production browser handoff. It never creates a pairing-code flow. Do not replace it with `--relay-dev` or add server code to this checkout.

Confirm the preview has this shape:

- `_layout.tsx` imports `AgentSurface` and wraps the authenticated `<Outlet />` inside `<AppLayoutV2>`.
- `app/surface.tsx` imports `SurfaceProvider` from `@axe/surface/react`.
- The provider includes `config={surfaceConfig}`, `flag={enabled}`, `expose={development}`, and `webMcp`.
- In a normal Summation tab, `enabled` follows the Summation feature flag. The generated `|| injectedRelay() !== null` clause enables the provider after a provider handoff even when the end-user flag is off.
- `app/surface.tsx` imports `connectRelay` and `injectedRelay` from `@axe/relay/client`; its `onReady` connects only when the provider supplied a scoped connection. The helper recognizes the handoff automatically; do not add application-specific token code.
- `app/surface.config.ts` is the reviewable overlay. Set `app: "Summation"` so observations and diagnostics identify the application rather than the SDK's generic fallback name.

If the diff is correct, run the same command with `--yes`. Do not pass `--install`, because the unpublished tarballs were installed manually. Run it once more and confirm it reports nothing to change. Prefer the `~/surface` import alias in `_layout.tsx` if that is the local convention.

### 6. Exclude Addison

Find the single outer element that owns the Addison pane and composer under `app/features/addison*` or the authenticated layout. Add `data-surface-ignore` there.

Do not scatter the attribute over several descendants. If there is no clear owning element, leave the code alone and report that uncertainty in the final local summary.

### 7. Run the browser-handoff service and app, then inspect the surface

Run Summation's web app at `http://localhost:5173` and sum-api at `http://localhost:9092`. Enable sum-api's existing OAuth authorization-code routes and set its issuer to the reachable sum-api origin. From the Agent Experience checkout, export the hosted integration and start it:

```sh
export AXE_HOST_APP_URL=http://localhost:5173
export AXE_HOST_PUBLIC_MCP_URL=http://127.0.0.1:4717/mcp
export AXE_HOST_AUTHORIZATION_SERVERS=http://localhost:9092
export AXE_HOST_SCOPES=agent:read
export AXE_HOST_OAUTH_USERINFO_URL=http://localhost:9092/v1/me
export AXE_HOST_PRINCIPAL_CLAIM=identity.user_id
export AXE_HOST_TENANT_CLAIM=identity.org_id
pnpm mcp:handoff-dev
```

It must report the desktop-agent endpoint `http://127.0.0.1:4717/mcp`. Its tool list must not contain `relay_pair`. This service is not part of the Summation process.

Start the web app normally from `js/apps/web-app`, with its usual environment and VPN:

```sh
yarn dev
```

Open the signed-in app at:

```text
http://localhost:5173/?ui_axe_surface=true
```

In the browser console, confirm:

```js
window.__surface?.observe();
```

The observation should identify the current app, have a numeric revision, list controls with useful names, omit sensitive values, and contain no Addison controls. Check at least two routes. If this is absent, verify the flag override, provider mount, and development build before changing code.

### 8. Verify with a desktop MCP agent

Connect the desktop client through its OAuth-capable remote-MCP bridge. For Claude Desktop, configure:

```json
{
  "mcpServers": {
    "agent-experience": {
      "command": "npx",
      "args": ["-y", "mcp-remote@latest", "http://127.0.0.1:4717/mcp", "--allow-http"]
    }
  }
}
```

Do not configure an `Authorization` header or bearer-token environment variable: either one suppresses the OAuth browser flow. Restart Claude and start a fresh conversation. The service's own instructions tell the agent to call `relay_tabs` first; do not launch a nested agent or tell it to use a checkout-specific “Summation MCP.”

In the desktop agent:

1. Connect the server. Claude should open Summation's OAuth page in the system browser; sign in there, never in chat.
2. Call `relay_tabs`. Claude should offer and open an Agent Experience connection URL, which immediately redirects to the ordinary Summation page. Sign in there if needed; the installed package should connect that tab without asking for a code. `relay_pair` must not exist.
3. Confirm it calls `surface_read` and `surface_observe`, and describes several controls using their application-owned names and unavailable reasons.
4. For a slow operation, confirm `surface_wait` follows the visible status instead of repeatedly clicking or guessing from elapsed time.
5. Ask it to perform one ordinary, reversible action through `surface_set-field`, `surface_run-control`, or `surface_load-more`.
6. Check the visible application state yourself; do not accept the agent's narration as proof.
7. Change the page after an observation and confirm an act using the old revision is refused without applying anything.
8. Try one high-risk or approval-gated control only in disposable local state. It must wait for approval in the page indicator and run only after the person approves.

### 9. Measure and make only high-value refinements

Run coverage while the development app and flag are on:

```sh
node ~/code/agent-experience/packages/cli/dist/index.js surface coverage \
  "http://localhost:5173/?ui_axe_surface=true" \
  --routes / \
  --out coverage.md
```

Add at most five high-value rules to `app/surface.config.ts`. Prefer a one-attribute accessibility fix when the owning team would want it anyway; otherwise use a config rule. Do not lower the risk of a destructive or unknown action just to make it runnable.

Delete `coverage.md` when you are done unless the user explicitly wants the local report kept.

### 10. Run checks and stop with local changes

Run the checks that match the current Summation repository scripts, including at least the web app's lint, typecheck, tests, and build, plus root knip and unbarrelify checks when available. Fix failures caused by this change. For an unrelated pre-existing failure, preserve its output and identify it clearly.

Finish by reporting:

- every file changed locally;
- the generated provider shape and confirmation that it imports only the browser relay client, never server dependencies;
- the routes and controls observed;
- the ordinary action tried and the application state that proved it worked;
- the approval-sensitive refusal, if tested;
- the coverage summary and any rules added;
- every check and its result; and
- any step that could not be exercised in the available browser.

Leave the changes uncommitted in the working tree for the user to inspect.

## What this experiment proves—and does not

This path proves that the JavaScript package can own Surface state inside the consuming site while a separately operated service opens an identity-scoped handoff into the person's ordinary browser and presents that page to desktop agents. The page remains authoritative for the registry, revision, ledger, approval boundary, and handlers; the customer team runs no MCP server and the user performs no pairing step.

It does not persist the in-memory ledger across reloads or turn a derived click into a server-side conditional write. Those remain durability and application-consistency concerns. It also does not make an agent's confirmation count as a person's approval; consequential actions run only after approval through the MCP client's trusted elicitation UI or the relay's one-time approval page.
