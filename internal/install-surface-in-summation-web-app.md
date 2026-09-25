# Install Surface in the Summation web app (internal)

This is a prompt for a coding agent working in the Summation monorepo (`summationai/code`). Give it this whole file. It installs the Surface SDK in `js/apps/web-app` so an outside agent (Claude Code over MCP) can drive a signed-in person's live tab, locally, behind a feature flag. It is internal and branch-specific: the SDK is unpublished and comes from the `summationai/agent-experience` repository, branch `herz/surface-integration`. A public path (an app registry, published packages) replaces this later.

The facts below were checked against `origin/main` of `summationai/code` at `85a732c56b` (2026-09-25) and against the SDK at `herz/surface-integration`. If either has moved, verify before relying on a line number.

---

## Your task

Add the Surface SDK to the web app with the smallest diff that lets an agent drive the app in local development, with the feature off everywhere by default. Then connect Claude Code to a local relay and prove it works by driving the app.

Out of scope: a production relay, a relay-token endpoint, a design-system indicator, and configuration beyond the top few gaps. They are listed at the end as follow-ups; do not build them.

## Ground rules

- Read the repo's `AGENTS.md` and `js/apps/web-app/AGENTS.md` first and follow them. Work in a dedicated `git worktree` off a fresh `origin/main`, on a branch like `<you>/surface-sdk`. Node 24.14.1, Yarn 4.13.0.
- Keep the diff small. The expected shape: one mount line in the authenticated layout, two new files (`app/surface.tsx`, `app/surface.config.ts`), one flag key, package and lockfile changes, one Dockerfile line, the vendored tarballs, and at most a few config rules and `data-surface-ignore` attributes.
- Surface reports and never decides. Do not change application logic to make the agent's job easier; describe the app as it is.
- Do not add user-facing strings. The web app requires all UI text through `useText()`. The relay's default in-page indicator is English and is acceptable only because this is development-only behind a flag; keep it, and list the design-system indicator as a follow-up.
- Never wire anything an agent can reach to approvals (`handle.approve`, the relay's `approve`). Approvals are the person's.
- Do not add a registry dependency the app does not import: `@axe/core` goes only in root `resolutions`, never in the app's dependencies (knip fails on unused dependencies).

## Background you need (verified)

- **Mount point.** `app/root.tsx` renders pre-auth pages too (login, signup, public shares), with no user, tenant, or flags. Mount inside the authenticated shell instead: `app/routes/_main+/_layout.tsx`, where `MainLayout` nests `FeatureFlagServiceProvider`, `TenantProvider`, and `AppShell`. `axe surface init --mount` wraps the `<Outlet />` inside `<AppLayoutV2>` there, which is below the flag provider, so `useFeatureFlag` works.
- **SSR is on** (`react-router.config.ts`, `ssr: true`). The generated code runs nothing at import time; `SurfaceProvider` starts in an effect, and every SDK entry imports cleanly in Node. Do not add side-effect-only imports (the app has a `sideEffects` allowlist in `package.json`).
- **Flags.** Statsig via `useFeatureFlag("<key>")` from `~/feature-flags`, typed from `app/feature-flags/gen/defaultFlags.json`. Add the key there with `false`. A URL query `?ui_axe_surface=true` overrides any key in that file for the session, which is how you turn it on locally.
- **Packaging.** Yarn 4 with `npmMinimalAgeGate: "7d"` in `.yarnrc.yml`: registry versions younger than seven days are refused. The only precedent for an unpublished package is `react-path-layouts`, a `file:` tarball next to the app, copied in `js/apps/web-app/Dockerfile` before `yarn install` and locked by checksum. The SDK's packed tarballs depend on each other at `0.1.0`, so `@axe/core` and `@axe/surface` must be pinned in the **root** `package.json` `resolutions` (Yarn only honours root resolutions). `@axe/relay`'s server dependencies are optional peers, so the app installs none of them. Verified in a Yarn 4 project with the same age gate: it installs, and the browser bundle of `@axe/surface/react`, `@axe/surface/auto`, and `@axe/relay/client` is about 99 KB minified with React external, with no zod.
- **What derivation will see.** Good: `app/lib` `Button` (native `disabled`), `IconButton` (a required `label`), Radix dialogs and menus, `FormInput` errors (`aria-describedby`). Weak, and reported by coverage: the collapsed sidebar (`NavLinkV2` renders nameless icon links when minimized), the Tiptap/ProseMirror editors (no accessible name; the Addison composer in `usePromptEditor.ts`), `div role="button"` rows (`ChatItemRow`), no `<main>`/`<nav>` landmarks, toasts that are not live regions. Opaque: Highcharts (its accessibility module is disabled in `HighChartsWrapper.tsx`), SpreadJS (canvas), virtualised ag-grid rows (only rendered rows exist). Table cards live in an open shadow root (`lib/TableCard/table-card.tsx`), which the SDK traverses.
- **Addison.** The app's own agent UI (the Addison pane and composer) is a control surface for a different agent. Mark its root `data-surface-ignore` so the outside agent does not drive Addison's controls. Addison's own Sense/UI-action layer is not wired into the web app on `main`, so there is nothing to integrate with it yet.
- **Relay in development.** The dev relay listens on `127.0.0.1:4717`, accepts tabs from any `localhost` origin, and pairs an agent with a code the tab shows. The web app's dev server is `http://localhost:5173`, so `ws://127.0.0.1:4717` is not mixed content. The app has no Content-Security-Policy on documents, so nothing blocks the connection.

## Steps

### 1. Build and pack the SDK (outside the monorepo)

```sh
git clone git@github.com:summationai/agent-experience.git ~/code/agent-experience   # or: git -C ~/code/agent-experience pull
cd ~/code/agent-experience
git checkout herz/surface-integration
pnpm install && pnpm -r build
```

Record the commit (`git rev-parse HEAD`) for the PR description.

### 2. Vendor the tarballs into the web app

From the web app directory in your worktree:

```sh
cd js/apps/web-app
~/code/agent-experience/scripts/pack-for-consumer.sh vendor/axe core surface relay
```

This writes `vendor/axe/axe-core-0.1.0.tgz`, `axe-surface-0.1.0.tgz`, `axe-relay-0.1.0.tgz`, and `vendor/axe/SOURCE` (repository, branch, commit, date). Commit all four.

### 3. Dependencies, resolutions, lockfile, Dockerfile

- `js/apps/web-app/package.json`, `dependencies`: add
  `"@axe/surface": "file:./vendor/axe/axe-surface-0.1.0.tgz"` and
  `"@axe/relay": "file:./vendor/axe/axe-relay-0.1.0.tgz"`.
  Do not add `@axe/core`.
- Root `package.json`, `resolutions`: add
  `"@axe/core": "file:./js/apps/web-app/vendor/axe/axe-core-0.1.0.tgz"` and
  `"@axe/surface": "file:./js/apps/web-app/vendor/axe/axe-surface-0.1.0.tgz"`.
- Run `yarn install` at the repo root and commit `yarn.lock`. A refreshed tarball at the same filename changes its checksum, so re-run `yarn install` whenever you re-vendor.
- `js/apps/web-app/Dockerfile`: next to the existing `COPY js/apps/web-app/react-path-layouts-0.0.0.tgz js/apps/web-app/` line (before `RUN yarn install`), add
  `COPY js/apps/web-app/vendor/axe/ js/apps/web-app/vendor/axe/`.

### 4. The flag

Add `"ui_axe_surface": false` to `app/feature-flags/gen/defaultFlags.json`. Creating the gate in Statsig is not needed for local work (the URL override turns it on); note it in the PR as a follow-up.

### 5. Mount with the CLI

Dry run first, and read the diff:

```sh
node ~/code/agent-experience/packages/cli/dist/index.js surface init \
  --mount "app/routes/_main+/_layout.tsx" \
  --flag-hook 'useFeatureFlag("ui_axe_surface")' --flag-import "~/feature-flags" \
  --relay-dev --dry-run
```

Expected (checked against `origin/main`): `_layout.tsx` gains `import { AgentSurface } from "../../surface";` and `<AgentSurface>` around the `<Outlet />` inside `<AppLayoutV2>`; new `app/surface.tsx` renders `SurfaceProvider` with `flag={useFeatureFlag("ui_axe_surface")}`, `expose` in development, and an `onReady` that calls `connectRelay(handle.surface, relay)` against `ws://127.0.0.1:4717/tab` with `devToken`, returning `connection.stop` as cleanup; new `app/surface.config.ts` is an empty overlay with commented examples. If it looks right, run it again with `--yes` (not `--install`: you did the dependencies by hand in step 3). A second run must report nothing to change.

Then two small edits the CLI does not make:

- Change the import in `_layout.tsx` to the app's alias, `import { AgentSurface } from "~/surface";`, if the linter or reviewers prefer aliases.
- Gate the relay on development in `app/surface.tsx`: connect only when `import.meta.env.DEV` (return nothing from `onReady` otherwise), so a flag flipped in a deployed environment never points a tab at `127.0.0.1`.

### 6. Keep the app's own agent UI out

Add `data-surface-ignore` to the root element of the Addison pane (find the component that renders the Addison chat panel and composer in `app/features/addison*`/`common-layout-v2`; one attribute on its outermost element). If you are unsure which element that is, skip it and list it in the PR; do not guess at several.

### 7. Checks

From the repo root and the app, as CI runs them: `yarn lint` (web app), `yarn typecheck` (web app), `yarn test` (web app), `yarn knip` (root), `yarn unbarrelify --check` (root), `yarn build` (web app). Fix anything the diff caused. If a check fails for a reason unrelated to the diff, say so in the PR with the output.

### 8. Try it

1. Start the web app as usual (`yarn dev` in `js/apps/web-app`, with its `.env` and the VPN), sign in at `http://localhost:5173/login`, and open a dashboard or report page with `?ui_axe_surface=true` appended to the URL.
2. In the browser console: `window.__surface.observe().entries.length` should be well above zero, and `window.__surface.formatCoverage()` prints the coverage report. Save it; it is the input to step 9.
3. Connect Claude Code (in another terminal):
   ```sh
   claude mcp add summation-tab -- node ~/code/agent-experience/packages/cli/dist/index.js relay --dev --stdio
   ```
   Start `claude`, run `/mcp` (the server should be connected), reload the app tab so it connects to the relay Claude started, and read the pairing code the tab shows in its agent panel. Tell Claude: "pair with code XXXX-XXXX".
4. Ask Claude to call `relay_tabs`, then `surface_observe`, and to describe what it can do on the page. Then ask for one read (open a menu, switch a tab, filter) and one ordinary change. A control that needs approval appears in the tab's agent panel: approve it there, then tell Claude to retry with the same arguments.
5. Stop the agent from the tab's panel and confirm Claude's next act is refused.

### 9. Refine the top gaps (optional, small)

From the coverage report, add at most five rules to `app/surface.config.ts` for the gaps that most hurt the pages you tried: a name for the collapsed nav links, a name for the Addison composer if it is not ignored, a real `effect` and risk for a frequently used control the heuristics flagged as unrecognized. Prefer markup fixes (`aria-label` on an icon-only control) only if they are one attribute and the owning team would want them anyway; otherwise use config. Do not lower a destructive control's risk.

### 10. Open the PR

Ready for review, not draft. In the description: the SDK commit from `vendor/axe/SOURCE`; what you tried in step 8 and what worked; the coverage summary line (entries, name confidence, gaps); the rules you added; every check's result; and the follow-ups below. Fill the PR template, including the feature-gating box (`ui_axe_surface`, default off).

## Follow-ups to list, not build

- A relay-token endpoint in the web app (a tRPC mutation that mints a short-lived relay token for `{ userId, orgId, memberId }` with a dedicated signing key declared optional in `app/env.server.ts`), and `connection.rekey()` on tenant switch (`setTenant`), before any non-local use.
- A hosted relay (`createRelay` behind `wss://`, with OAuth for agents and an origin allowlist mirroring `isTrustedWebAppOrigin`: localhost and `*.summation.com`).
- A design-system indicator (render the relay's status with `~/lib` components and `useText()`; pass `indicator: false`), which needs the summation-design skill.
- The Statsig gate `ui_axe_surface` in each environment.
- Coverage-driven config for the weak areas: collapsed nav, editors, row buttons, charts, grids.
- Whether Addison's UI actions should run through Surface.

## What the SDK does and does not promise here

Derived controls act through the same events a person causes, refuse an act if the page changed since the agent looked, and wait for the person's approval on anything destructive or unrecognized. They do not make server-side conditional writes; a page that saves on click saves whatever the page sends. Everything in the relay is in memory in one local process. None of this has been run against the web app yet: this prompt is its first run, and what you find is the first evidence.
