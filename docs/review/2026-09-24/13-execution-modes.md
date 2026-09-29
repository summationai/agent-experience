# 13. Browser-local and server-side execution as explicit modes; reference app

Phase 3. Branch `review/reference-app`, based on `herz/surface-integration` at `7284f6a` (phases 1 and 2 merged).

## Finding

The review: a React hook registers closures in a browser; importing the same module in a Next route shares none of that registry, session, or state. The two modes had to be named, with a runnable React/Next reference application showing who owns each capability, with real handlers, authoritative server state, and tests for login, two actors, human changes between observe and act, navigation, reconnect, lost responses, and expired handoffs.

Checked in this checkout at `7284f6a`:

- Nothing in `spec/SURFACE.md` or `docs/` said where a surface runs. [S-DOM-2] called `expose` browser-local; `docs/surface.md` said "two tabs of one user still resolve as the application's state store resolves them today". Nothing said that a route handler importing `@summationai/axe-surface` gets another, empty surface, or that the SDK has no broker between a page and a server.
- A second registry inside one realm: `packages/surface/dist/react.js` inlined `src/index.ts`, including `createSurface` and the module-level `surface` (`grep -c "function createSurface" dist/react.js` was 1; `dist/react.js` imported only `react` and `@summationai/axe-core`). So `useSurface(entry, deps)` with the default target registered in a table that `surface.expose(window)` from `@summationai/axe-surface` never showed. The source tests could not see it: they import `src/`, where there is one module.
- The only runnable example, `docs/examples/demo/plan-board.ts`, is one Express process with one surface on the server; its page calls the AXE actions with a fixed bearer token. There was no browser-local capability, no session, no tenant, and no browser test.

## Change

Reference application, `examples/plan-review` (private workspace package `plan-review-example`; Next 16 App Router, React 19; `next` and `react` are its dependencies only; no `build` script, so it is outside `pnpm -r build`; its Node suite is in `pnpm -r test`):

- `lib/store.ts`: one plan per tenant with a revision column; `write(tenant, expectedRev, actor, event, mutate, operationId?)` is the conditional write (check and write with no `await` between them), records the history, and remembers applied operation ids. Sessions, members, agent tokens, and the app's index of approval requests. Instances live on globalThis, since Next evaluates modules per bundle layer.
- `lib/domain.ts`: the one implementation of every change (edit values, submit, lock, reopen, freeze), with one function (whyNot) that returns the sentence the page disables its button with, the AXE action's availability reason, and the refusal.
- `lib/axe.ts`: server capabilities. `createAXE` with `auth: { modes: ["user"] }` (agent bearer token or the page's session cookie), a per-tenant `tenant` resolver (anonymous callers see a public tenant with no plan data), `revision` = the plan's revision column, `requestPolicy: { trustedOrigins }`, and `onActionEvent` feeding approval events into the history. Actions `plan.read`, `plan.set-value`, `plan.submit`, `plan.approve` (item 15), `plan.history`; every write requires `expectedRev` and carries it into the conditional write; a stale one is `conflict` with `details: { expectedRev, currentRev }`.
- `lib/ui-api.ts`: the app's own endpoints (sign-in, state, values, submit, lock, reopen, freeze, approval decisions) under the same JSON and origin policy as the runtime, checked with isAcceptedOrigin and isJsonContentType from `@summationai/axe-core` whether or not a cookie is present.
- `lib/browser-surface.ts`: the browser-local surface, one per page instance, in `app` revision mode (the page adopts the plan's revision with `setRev`), ledger text hashed; exposePageSurface publishes it at `window.__surface`. This is the one module a WebMCP adapter (item 14) should hook.
- `app/plan/PlanBoard.tsx`: `useSurfaceProps` registrations on the page surface: a field per cell whose setter changes only the tab's unsaved draft, "Save N unsaved changes" (posts to the app's endpoint with the person's session and the revision the drafts were typed at, so a draft typed before someone else's save is refused rather than rebased by the page's polling), "Scroll to <month>", and "Open the approval requests". `app/history/page.tsx` is a second route for the navigation case; `app/approvals/[id]` is the approval page (item 15).
- Routes: `app/axe/[...axe]/route.ts` and `app/.well-known/axe.json/route.ts` with `axeNext`; `app/api/[...path]/route.ts` delegates to `lib/ui-api.ts`.
- Root scripts `example:dev`, `example:test`, `example:test:app`; `pnpm-workspace.yaml` includes `examples/*`; ESLint and Prettier ignore `.next` and Playwright output. Next's generated `next-env.d.ts` (which imports types from `.next/`) is ignored and `app-env.d.ts` carries its references, so the typecheck works on a fresh clone.

`@summationai/axe-surface` packaging (`packages/surface/tsup.config.ts`): an esbuild plugin makes the `/react` entry import `./index.js` (ESM) or `./index.cjs` (CommonJS) instead of inlining it, so the hooks' default target is the `surface` that `@summationai/axe-surface` exports. No source change; the browser bundle test is unchanged and passes.

Ownership and scoping:

| Capability | Where | Registered by | Reachable by | Scope | Lifetime |
| --- | --- | --- | --- | --- | --- |
| read plan, read history | server | `action()` | agents over AXE (HTTP, MCP) | caller's user and tenant | process |
| edit value, submit | server | `action()` → `lib/domain.ts` | agents over AXE; the page via `lib/ui-api.ts` | user, tenant; conditional write at the presented revision | process |
| ask to approve and lock | server | `action()` with `approvalState`, `onResume` | agents over AXE; decided on the app's page | user, tenant; approval bound to input, principal, tenant, revision | one hour, one use |
| approve or cancel a request, freeze, reopen, lock directly | server | the app's endpoints | a person with the session cookie, from the app's origin | the person's role in the tenant | process |
| draft a cell, Save, scroll, open the dialog | browser | `useSurfaceProps` on the page surface | code in the page (`window.__surface`) | this tab and page instance | while mounted |

Spec: `spec/SURFACE.md` v0.7, §9 "Execution modes": [S-MODE-1] (browser-local: one page instance, reachable only in that realm; the same module on a server is another, empty surface), [S-MODE-2] (server-side: process lifetime, runtime-scoped, never depends on a browser closure), [S-MODE-3] (no broker; an explicit connection only; shared state on the server behind a conditional write; `app` revision mode shares `expectedRev`), [S-MODE-4] (unmount unregisters, nothing on the server changes). Changes line and a v0.7 provenance paragraph.

Docs: new `docs/reference-app.md` (what it demonstrates, how to run the app and each suite, a five-step demo, the ownership table, a code tour included from the app's own typechecked source, the test list, supported behavior and deliberate limits, including "no browser-session broker"); `docs/surface.md` new section "Where a surface runs"; `docs/README.md` and `site/build.mjs` HUB_GROUPS; `docs/examples/demo/README.md` and `plan-board.ts` point at the reference app. `DECISIONS.md` ("Execution modes are a spec section", "The reference app is a workspace package outside the build graph"), `CHANGELOG.md`.

## Tests

Node suite, `examples/plan-review/test/server.test.ts`, in `pnpm -r test` (`pnpm example:test`): 15 passed. Item 13's cases:

- login: a session cookie per user and tenant; other origins and non-JSON posts are refused on both doors
- tenant scope: the same person on another team is another scope, for plans, tokens, and approvals
- two users editing the same plan: one conflict, one success, nothing lost silently (including two tabs saving at once)
- a person's change between the agent's observe and act is refused; the agent re-reads and continues
- a lost response is recovered by retrying with the same idempotency key; the edit applies once
- a new AXE client re-discovers the site and continues the approved request
- an MCP client reconnects on a new connection and resumes with `axe_resume`
- browser-local capabilities are never served over HTTP: the page's registry and the server's actions are separate
- the built `@summationai/axe-surface/react` uses `@summationai/axe-surface`'s registry instead of carrying a second one (fails with the previous `tsup.config.ts`: checked by stashing it and rebuilding)
- the expired-handoff case is under item 15

Browser suite, `examples/plan-review/e2e/plan-review.spec.ts`, Playwright 1.63 with Chromium against `next start` on port 3107 (`pnpm example:test:app`, which runs `next build` first): 7 passed. Item 13's cases:

- sign in, then an agent in the page drafts a value and saves it through the page's own Save (the manifest lists only the server actions)
- two people in two tabs edit the same cell: one save succeeds, the other is refused and keeps its draft
- a person changes the plan between the agent's observe and act: the agent is refused, re-reads, and continues
- navigation: the page's controls leave the surface on a route change; the server's plan is untouched

The browser run needs the Chromium build that `@playwright/test` 1.63 expects (`pnpm --filter plan-review-example exec playwright install chromium`); it was already installed here for the site's tests. `next dev` was also checked by hand: sign-in, the plan page, and the manifest answer.

## Limitations

- One process, in memory: plans, sessions, history, AXE tokens, and idempotency records reset on restart and are not shared between instances. The conditional write is the in-memory equivalent of `UPDATE ... WHERE rev = $expected`, not a database.
- Demo credentials: sign-in has no password; agent tokens are fixed strings.
- The page polls every 1.5 seconds; there is no push.
- The page surface is reachable only through `window.__surface`. Nothing here connects the page's controls to an agent outside the page, by design ([S-MODE-3]); a WebMCP adapter can hook `lib/browser-surface.ts`.
- The packaging fix gives one registry per module format. An application that loads `@summationai/axe-surface` as ESM and `@summationai/axe-surface/react` as CommonJS (unusual outside mixed toolchains) still gets two; the reference app passes its surface explicitly anyway, which is clearest.
- `spec/SURFACE.md` moves to v0.7 here; item 14 may also touch that file, so the version line may need reconciling at merge. `packages/surface/tsup.config.ts` may conflict with a new entry item 14 adds.

## Status

done
