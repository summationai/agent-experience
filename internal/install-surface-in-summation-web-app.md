# Connect the Summation web app to the Agent Experience browser relay (internal)

This is a prompt for a coding agent working in the Summation monorepo (`summationai/code`). Give it this whole file. It adds the Surface integration to `js/apps/web-app`: the live controls, revision, ledger, and handlers stay in the page, and the lightweight browser client connects that page to the separately operated Agent Experience MCP service. The Summation application does not run an MCP server.

This is a local experiment. Work in the current checkout and leave the finished changes uncommitted in the working tree. Do not create a branch or worktree, commit, or push.

## Goal

Make the smallest local change that lets a desktop agent open Summation's ordinary sign-in/page flow and use the controls people already use, without running an MCP server in the Summation repository, adding a Summation backend endpoint, or pairing with a code.

Done means:

- only the browser packages `@axe/surface` and `@axe/relay` are added to the web app;
- one Surface provider is mounted at the application root, remains mounted across login and tenant navigation, and is enabled only for an authenticated page or a provider-injected agent session;
- the provider exposes WebMCP only for authenticated pages and accepts an identity-bound relay injected by the provider-operated hidden host;
- the Addison agent UI is excluded from the derived surface;
- the app's normal checks pass; and
- starting the desktop client opens no login page; after the person asks to use Summation, `relay_tabs` starts a hidden local browser and the agent can complete sign-in, organization selection, tenant selection, and the requested task through one continuously connected Surface without a pairing code or visible browser window.

Do not add an MCP server, hosted browser, token-minting route, session broker, or other backend integration to Summation. The service under `agent-experience/mcp` owns relay transport and the hidden browser; its loopback-only development mode opens Summation's existing local login without becoming another credential store. A credential supplied deliberately in this local experiment may be written only to a Surface-reported sensitive password field; never read it back, echo it, log it, persist it, or put it in a URL. Production authentication still requires the provider-operated identity/session design described in the Agent Experience repository.

## Ground rules

- Read the Summation repo's `AGENTS.md` and `js/apps/web-app/AGENTS.md` first and follow them.
- Preserve all existing local changes. Inspect `git status` before editing and do not overwrite unrelated work.
- Surface reports and never decides. Do not change application logic to make the agent's job easier; describe the controls and state the app already has.
- Keep the diff small: the root mount, removal of the old authenticated-layout mount, `app/surface.tsx`, `app/surface.config.ts`, package/lockfile/Dockerfile changes, the vendored tarballs, and at most a few targeted config or `data-surface-ignore` edits. Do not change sum-api.
- Do not add user-facing strings. Summation requires UI text through `useText()`.
- Never make approval reachable from an agent. In particular, do not expose `handle.approve`, and do not implement `requestApproval` with a WebMCP tool, an agent-visible control, an agent-supplied message, or automatic acceptance.
- `@axe/core` is a transitive package pin while the SDK is unpublished. Do not add it to the web app's dependencies; knip will treat it as unused. The root resolutions also pin `@axe/surface` so the vendored relay uses the same browser registry instance.

## Summation-specific facts to verify

These were true when this prompt was written. Inspect the current code before relying on them.

- **Mount point:** `app/root.tsx` renders both pre-auth and authenticated pages. Mount once around its `<Outlet />`, but gate normal browser sessions on `root` loader data's authenticated `user`. A provider-injected session is the sole pre-auth exception: it must connect on the login and organization-picker routes so a hidden agent browser can advance. This same root mount must remain alive while `_main` shows `TenantSwitchModal`; mounting inside `AppShell` deadlocks because `AppShell` is not rendered until a tenant already exists. The Surface must not depend on Statsig or another feature-flag provider.
- **SSR:** `react-router.config.ts` has SSR enabled. `SurfaceProvider` starts only in an effect; do not add module-scope browser work or side-effect imports.
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

Do not recreate the Surface config, sum-api route, database state, login configuration, or user data. Remove the old Surface feature gate in place: delete the `useFeatureFlag` import and call, remove `flag={enabled}` from `SurfaceProvider`, and remove the `ui_axe_surface` default-flag entry if this experiment added it. Do not disturb unrelated feature flags. Move the existing `AgentSurface` mount from `_main+/_layout.tsx` to `app/root.tsx` as described in Step 4; do not leave two providers mounted. The provider-injected connection behavior is inside `@axe/relay/client` and is picked up by `injectedRelay()`. Preserve the existing config instead of regenerating it when possible.

### 3. Add the local package dependency

Make these local package changes:

- In `js/apps/web-app/package.json`, add only the browser packages:
  `"@axe/surface": "file:./vendor/axe/axe-surface-0.1.0.tgz"` and
  `"@axe/relay": "file:./vendor/axe/axe-relay-0.1.0.tgz"`.
- In the root `package.json` `resolutions`, add `@axe/core` and `@axe/surface`, both pointing at their tarballs under `js/apps/web-app/vendor/axe/`.
- Do not add `@axe/core` to the app's dependencies.
- In `js/apps/web-app/Dockerfile`, copy `js/apps/web-app/vendor/axe/` before the `RUN yarn install` layer, beside the existing local-tarball copy.
- Run `yarn install` at the Summation repo root. Re-run it whenever the tarballs change so `yarn.lock` has their current checksums.

### 4. Mount one authenticated-or-injected provider above tenant resolution

Preview the generated change first:

```sh
node ~/code/agent-experience/packages/cli/dist/index.js surface init \
  --mount "app/root.tsx" \
  --remote \
  --dry-run
```

`--remote` enables provider-supplied connections, including the production hidden host and the attended fallback. It never creates a pairing-code flow. Do not replace it with `--relay-dev` or add server code to this checkout.

Confirm the preview has this shape:

- `root.tsx` imports `AgentSurface` and wraps its single `<Outlet />` inside `QueryProvider`. Remove the old `AgentSurface` import and wrapper from `_main+/_layout.tsx`; there must be exactly one provider.
- `app/surface.tsx` imports `SurfaceProvider` from `@axe/surface/react`.
- `Root` reads `user` from the root loader data and passes `authenticated={user !== null}`. This is application state already available in `root.tsx`; do not add a request or auth endpoint.
- `AgentSurface` captures `injectedRelay()` once for that document. Its `enabled` value is `authenticated || providerRelay !== null`. It does not fall back to `localMcpService`: ordinary development tabs use the development global and WebMCP, while desktop MCP agents use the injected hidden host. This keeps an ordinary signed-out browser private and removes the pairing path entirely.
- The provider includes `config={surfaceConfig}`, `expose={development && providerRelay === null}`, and `webMcp={providerRelay === null}`. Those values stay fixed for the lifetime of the document: an injected session never publishes pre-auth controls through WebMCP or the development global, and its relay connection is not torn down and revoked when authentication changes. An ordinary non-injected session starts Surface only after `authenticated` becomes true.
- `app/surface.tsx` imports only `connectRelay` and `injectedRelay` from `@axe/relay/client`; its `onReady` connects only when the provider supplied a scoped connection. Remove `localMcpService`, the fallback `relay` constant, and any `VITE_SURFACE_RELAY_URL` use. Do not add application-specific token code.
- `app/surface.config.ts` is the reviewable overlay. Set `app: "Summation"` so observations and diagnostics identify the application rather than the SDK's generic fallback name.
- Auto Surface deliberately makes passwords read-only. For this loopback-only, injected-session login experiment, add exactly one narrow rule: `{ match: { route: "/login**", selector: 'input[type="password"]' }, sensitive: true, editable: true, note: "Injected agent login; root provider disables ordinary signed-out sessions" }`. Do not make one-time codes, card fields, arbitrary sensitive fields, or passwords outside the login routes editable. The value remains absent from observations, reads, the ledger, and action events.
- `FileListTable` renders an item row or its direct name cell as a custom button even though it only opens that existing item. Put the package's `data-surface-navigation` marker on the exact clickable row when `isFullRowClickable` and on the exact name control when `isNameClickable`. Do not put it on the row as an ancestor of nested action buttons. The SDK then publishes those controls as low-risk, reversible, idempotent navigation without a selector rule in `surface.config.ts`; destructive wording and styling still win.
- Give breadcrumb containers standard navigation semantics (`role="navigation"` or `<nav>`, with a localized accessible label). Auto Surface then classifies their non-destructive router buttons as low-risk navigation without an app-specific rule.

The generator does not know Summation's authenticated root data. Before applying or immediately afterward, make the narrow local edits above: add the `authenticated` prop, capture the injected relay with a `useState` initializer, and use the conditional `enabled`, `expose`, `webMcp`, and fallback behavior. Do not replace them with a Summation feature flag or environment variable.

The intended `AgentSurface` behavior is equivalent to:

```tsx
export function AgentSurface({
  authenticated,
  children,
}: {
  authenticated: boolean;
  children: ReactNode;
}) {
  const [providerRelay] = useState(() => injectedRelay());
  return (
    <SurfaceProvider
      config={surfaceConfig}
      enabled={authenticated || providerRelay !== null}
      expose={development && providerRelay === null}
      webMcp={providerRelay === null}
      onReady={(handle) => {
        if (!providerRelay) return;
        const connection = connectRelay(handle.surface, providerRelay);
        return () => connection.stop();
      }}
    >
      {children}
    </SurfaceProvider>
  );
}
```

Use the repository's formatting and existing types/import style. In `Root`, obtain its own loader data with the existing React Router hook, then wrap the outlet:

```tsx
const { user } = useRouteLoaderData<RootLoaderData>("root")!;
<AgentSurface authenticated={user !== null}>
  <Outlet />
</AgentSurface>;
```

If the rest of the diff is correct, run the same command with `--yes`. Do not pass `--install`, because the unpublished tarballs were installed manually. Make the conditional root edit, then run the command once more; because the generated file now exists and was deliberately edited, init should preserve it. Prefer the `~/surface` import alias in `root.tsx` if that is the local convention.

### 5. Exclude Addison

Find the single outer element that owns the Addison pane and composer under `app/features/addison*` or the authenticated layout. Add `data-surface-ignore` there.

Do not scatter the attribute over several descendants. If there is no clear owning element, leave the code alone and report that uncertainty in the final local summary.

### 6. Run the hidden-browser service and app, then inspect the surface

Run Summation's web app at `http://localhost:5173`; do not start or change sum-api beyond whatever the web app normally uses. Install Chromium for the host once, then start the laptop-only unattended service from the Agent Experience checkout:

```sh
pnpm exec playwright install chromium
export AXE_HOST_APP_URL=http://localhost:5173/login
export AXE_MCP_AGENT_KEY=axd_agent_experience_local
pnpm mcp:unattended-dev
```

It must report the desktop-agent endpoint `http://127.0.0.1:4717/mcp`, `browser: hidden`, and `pairing: disabled`. Its tool list must not contain `relay_pair`. This service is not part of the Summation process. `AXE_HOST_STATE_PATH` may point at a storage-state file captured with `axe host login` for repeat demos; without it, the agent begins on the login page and uses its Surface controls.

Start the web app normally from `js/apps/web-app`, with its usual environment and VPN:

```sh
yarn dev
```

For a separate manual verification, open the signed-in app at:

```text
http://localhost:5173/
```

In the browser console, confirm:

```js
window.__surface?.observe();
```

The observation should identify the current app, have a numeric revision, list controls with useful names, omit sensitive values, and contain no Addison controls. Check at least two routes. On `/login`, confirm the password entry is present, `sensitive: true`, has no `value`, and is editable only in the injected hidden session; an ordinary signed-out tab must have no `window.__surface`. If this is absent, verify the provider mount and development build before changing code; do not add a feature flag as a workaround.

### 7. Verify with a desktop MCP agent

Connect the desktop client through its remote-MCP bridge. For Claude Desktop, configure the local development key (valid only for this loopback-only mode):

```json
{
  "mcpServers": {
    "agent-experience": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote@latest",
        "http://127.0.0.1:4717/mcp",
        "--allow-http",
        "--header",
        "Authorization:${AXE_AUTH_HEADER}"
      ],
      "env": {
        "AXE_AUTH_HEADER": "Bearer axd_agent_experience_local"
      }
    }
  }
}
```

Restart Claude and confirm that no browser opens merely because the MCP server initialized. Start a fresh conversation; do not launch a nested agent or tell it to use a checkout-specific “Summation MCP.” The service starts its hidden browser only on the first relevant tool call.

In the desktop agent:

1. Start Claude with the server configured. No browser or sign-in page should appear.
2. Ask Claude to use Summation for a concrete task. Its first `relay_tabs` call should start the hidden browser and return the login page's connected Surface without opening a visible browser.
3. If the hidden session is signed out, deliberately provide the local demo credential and ask Claude to enter it through the reported sensitive controls. It must not repeat the password. If an organization picker or `TenantSwitchModal` follows, `surface_observe` must report that chooser before a tenant has been selected; Claude should ask which tenant only when the request does not identify one, select it through Surface, and continue without a new pairing or visible page.
4. Confirm it calls `surface_read` and `surface_observe`, and describes several controls using their application-owned names and unavailable reasons. No staging page should appear, and `relay_pair` must not exist.
5. For a slow operation, confirm `surface_wait` follows the visible status instead of repeatedly clicking or guessing from elapsed time.
6. Ask it to perform one ordinary, reversible action through `surface_set-field`, `surface_run-control`, or `surface_load-more`.
7. In a separate ordinary browser session, check the resulting application state yourself; do not accept the agent's narration as proof.
8. Change the page after an observation and confirm an act using the old revision is refused without applying anything.
9. Try one high-risk or approval-gated control only in disposable local state. If the desktop client has no native elicitation UI, Claude must present the returned one-time `approvalUrl`; open it in an ordinary browser, approve there, and confirm Claude's identical retry runs exactly once. The hidden application browser must remain hidden.

### 8. Measure and make only high-value refinements

Run coverage while the development app is running:

```sh
node ~/code/agent-experience/packages/cli/dist/index.js surface coverage \
  "http://localhost:5173/" \
  --routes / \
  --out coverage.md
```

Add at most five high-value rules to `app/surface.config.ts`. Prefer a one-attribute accessibility fix when the owning team would want it anyway; otherwise use a config rule. Do not lower the risk of a destructive or unknown action just to make it runnable.

Delete `coverage.md` when you are done unless the user explicitly wants the local report kept.

### 9. Run checks and stop with local changes

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

This path proves that the JavaScript package can own Surface state inside the consuming site while a separately operated service runs the site in a hidden browser and presents only its semantic controls and results to desktop agents. The page remains authoritative for the registry, revision, ledger, approval boundary, and handlers; the customer team runs no MCP server and the user performs no pairing step. Root-level conditional mounting is what makes login, organization choice, tenant choice, and the authenticated application one continuous agent session without exposing ordinary signed-out tabs.

It does not persist the in-memory ledger across reloads or turn a derived click into a server-side conditional write. Those remain durability and application-consistency concerns. It also does not make an agent's confirmation count as a person's approval; consequential actions run only after approval through the MCP client's trusted elicitation UI or the relay's one-time approval page.
