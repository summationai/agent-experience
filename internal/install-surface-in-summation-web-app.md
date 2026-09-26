# Install browser-native Surface in the Summation web app (internal)

This is a prompt for a coding agent working in the Summation monorepo (`summationai/code`). Give it this whole file. It adds the package-only Surface integration to `js/apps/web-app`: the live controls, revision, ledger, and handlers stay in the page, and `<SurfaceProvider webMcp>` offers them directly to a browser-native agent when the browser supports WebMCP.

This is a local experiment. Work in the current checkout and leave the finished changes uncommitted in the working tree. Do not create a branch or worktree, commit, or push.

## Goal

Make the smallest local change that lets a browser-native agent use the signed-in Summation web app through the controls people already use.

Done means:

- only `@axe/surface` is added to the web app;
- the Surface provider is mounted inside the authenticated shell and behind `ui_axe_surface`;
- the generated provider has `webMcp` enabled and has no remote connection code;
- the Addison agent UI is excluded from the derived surface;
- the app's normal checks pass; and
- a WebMCP-capable browser can observe the registered controls and perform one ordinary action, with the result checked in the app itself.

Do not build remote transport, hosted-browser, token, pairing, or production-authentication infrastructure. Do not add a trusted approval UI in this pass; approval-sensitive acts should remain safely refused.

## Ground rules

- Read the Summation repo's `AGENTS.md` and `js/apps/web-app/AGENTS.md` first and follow them.
- Preserve all existing local changes. Inspect `git status` before editing and do not overwrite unrelated work.
- Surface reports and never decides. Do not change application logic to make the agent's job easier; describe the controls and state the app already has.
- Keep the diff small: the authenticated-layout mount, `app/surface.tsx`, `app/surface.config.ts`, one flag key, package/lockfile/Dockerfile changes, the vendored tarballs, and at most a few targeted config or `data-surface-ignore` edits.
- Do not add user-facing strings. Summation requires UI text through `useText()`.
- Never make approval reachable from an agent. In particular, do not expose `handle.approve`, and do not implement `requestApproval` with a WebMCP tool, an agent-visible control, an agent-supplied message, or automatic acceptance.
- `@axe/core` is a transitive package pin while the SDK is unpublished. Do not add it to the web app's dependencies; knip will treat it as unused.

## Summation-specific facts to verify

These were true when this prompt was written. Inspect the current code before relying on them.

- **Mount point:** `app/root.tsx` also renders pre-auth pages. Mount in `app/routes/_main+/_layout.tsx`, inside the authenticated shell and below `FeatureFlagServiceProvider`, so `useFeatureFlag` is valid.
- **SSR:** `react-router.config.ts` has SSR enabled. `SurfaceProvider` starts only in an effect; do not add module-scope browser work or side-effect imports.
- **Flag:** feature flags use `useFeatureFlag("<key>")` from `~/feature-flags`, with keys declared in `app/feature-flags/gen/defaultFlags.json`. The local URL override `?ui_axe_surface=true` enables the flag for the session.
- **Packaging:** Yarn 4's registry age gate means the unpublished SDK must be consumed as local tarballs. The vendor directory must exist before `yarn install`, including in the Dockerfile.
- **Addison:** the Addison pane and composer are a different agent's UI. Its outermost element should carry `data-surface-ignore` so the browser-native agent does not drive Addison through Surface.
- **Likely coverage gaps:** collapsed icon navigation, unnamed Tiptap/ProseMirror editors, `div role="button"` rows, missing landmarks, non-live toasts, Highcharts with accessibility disabled, SpreadJS canvas content, and virtualized grids. Treat coverage as evidence; do not preemptively rewrite all of these.

## Steps

### 1. Inspect both checkouts

In the Summation checkout, record the starting state for yourself:

```sh
git status --short
```

Use the existing Agent Experience checkout at `~/code/agent-experience`. Do not switch branches or pull over local work. Confirm it contains the package-first implementation, then build it:

```sh
cd ~/code/agent-experience
git status --short
pnpm install
pnpm --filter @axe/core build
pnpm --filter @axe/surface build
pnpm --filter axe build
```

If the checkout is elsewhere, use its absolute path consistently below.

### 2. Vendor only the packages the browser integration needs

From `js/apps/web-app` in the Summation checkout:

```sh
~/code/agent-experience/scripts/pack-for-consumer.sh vendor/axe core surface
```

This should produce:

- `vendor/axe/axe-core-0.1.0.tgz`
- `vendor/axe/axe-surface-0.1.0.tgz`
- `vendor/axe/SOURCE`

Do not pack or install relay or host packages.

### 3. Add the local package dependency

Make these local package changes:

- In `js/apps/web-app/package.json`, add only:
  `"@axe/surface": "file:./vendor/axe/axe-surface-0.1.0.tgz"`.
- In the root `package.json` `resolutions`, add:
  `"@axe/core": "file:./js/apps/web-app/vendor/axe/axe-core-0.1.0.tgz"`.
- Do not add `@axe/core` to the app's dependencies.
- In `js/apps/web-app/Dockerfile`, copy `js/apps/web-app/vendor/axe/` before the `RUN yarn install` layer, beside the existing local-tarball copy.
- Run `yarn install` at the Summation repo root. Re-run it whenever the tarballs change so `yarn.lock` has their current checksums.

### 4. Add the local feature flag

Add `"ui_axe_surface": false` to `app/feature-flags/gen/defaultFlags.json`.

Do not create or change remote Statsig configuration. The URL override is enough for this local experiment.

### 5. Mount the package-only provider

Preview the generated change first:

```sh
node ~/code/agent-experience/packages/cli/dist/index.js surface init \
  --mount "app/routes/_main+/_layout.tsx" \
  --flag-hook 'useFeatureFlag("ui_axe_surface")' --flag-import "~/feature-flags" \
  --dry-run
```

Do not pass `--remote`, `--relay`, or `--relay-dev`.

Confirm the preview has this shape:

- `_layout.tsx` imports `AgentSurface` and wraps the authenticated `<Outlet />` inside `<AppLayoutV2>`.
- `app/surface.tsx` imports `SurfaceProvider` from `@axe/surface/react`.
- The provider includes `config={surfaceConfig}`, `flag={enabled}`, `expose={development}`, and `webMcp`.
- `enabled` is exactly the Summation feature-flag result; it has no injected-connection clause.
- There are no imports from `@axe/relay`, no `onReady`, and no connection setup.
- `app/surface.config.ts` is the empty, reviewable overlay.

If the diff is correct, run the same command with `--yes`. Do not pass `--install`, because the unpublished tarballs were installed manually. Run it once more and confirm it reports nothing to change. Prefer the `~/surface` import alias in `_layout.tsx` if that is the local convention.

### 6. Exclude Addison

Find the single outer element that owns the Addison pane and composer under `app/features/addison*` or the authenticated layout. Add `data-surface-ignore` there.

Do not scatter the attribute over several descendants. If there is no clear owning element, leave the code alone and report that uncertainty in the final local summary.

### 7. Run the app and inspect the surface

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

### 8. Verify with a browser-native agent

Use a browser that implements the current WebMCP API. For local Chrome testing, enable `chrome://flags/#enable-webmcp-testing` and restart the browser if necessary. On the app page, `document.modelContext` must exist; the provider feature-detects it and otherwise leaves the page unchanged.

In the browser's agent UI:

1. Confirm it can call `surface_observe` and describe several controls using their application-owned names and unavailable reasons.
2. Ask it to perform one ordinary, reversible action such as opening a menu, changing a tab, or applying a harmless filter.
3. Check the visible application state yourself; do not accept the agent's narration as proof.
4. Change the page after an observation and confirm an act using the old revision is refused without applying anything, if the browser UI lets you provide `expectedRev`.
5. Try one high-risk or approval-gated control only in disposable local state. Because this integration has no trusted `requestApproval` callback, it must be refused with no handler run. That refusal is the expected safe behavior.

If the browser exposes `document.modelContext` but has no usable native agent UI, record that limitation and verify registration with the browser's WebMCP tooling plus `window.__surface`; do not add remote infrastructure as a workaround.

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
- the generated provider shape and confirmation that it imports no remote adapter;
- the routes and controls observed;
- the ordinary action tried and the application state that proved it worked;
- the approval-sensitive refusal, if tested;
- the coverage summary and any rules added;
- every check and its result; and
- any step that could not be exercised in the available browser.

Leave the changes uncommitted in the working tree for the user to inspect.

## What this experiment proves—and does not

This path proves that the JavaScript package can own Surface state inside the consuming site and communicate directly with a browser-native agent. No separate runtime is involved: the page owns the registry, revision, ledger, approval boundary, and handlers.

It does not make a browser-local surface reachable from a separate process, persist the in-memory ledger across reloads, or turn a derived click into a server-side conditional write. Those are separate transport, durability, and application-consistency concerns. It also does not make an agent's confirmation count as a person's approval; consequential actions remain refused until Summation deliberately supplies trusted, person-operated approval UI.
