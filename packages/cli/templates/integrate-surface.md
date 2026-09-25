# Integrate Surface into this application

You are a coding agent adding Surface (the Body Spray SDK's live registry of an application's own controls) to the application in this repository, so that an agent can drive it through the same controls a person uses. By default the agent reaches it unattended: `axe host` runs the application headless for the signed-in person, the page connects with no pairing, and approvals reach the person in the agent's own UI. Work in small, reviewable steps. The goal is a small diff that gets most of the way, then config for the most important gaps, not a rewrite.

Read the SDK's `llms.txt` before you start (in the SDK checkout, or wherever the team keeps it), at least these sections: "Decide your shape", "Rules that are scars", "Ship behind a flag, staging first", and "Packaging". Come back to "Tests to write", "Reach it through existing agent interfaces", and "What does not exist yet" when those steps arrive. Where this prompt and `llms.txt` disagree, `llms.txt` is newer; say so in your summary.

## Ground rules

- Keep the diff small. Change only the files `axe surface init` writes or names, `surface.config`, and tests. Do not reformat, rename, or "tidy" unrelated code. If a change outside those files seems necessary, stop and explain why before making it.
- Report, never decide ("Rules that are scars"): a control's availability and its reason are whatever the application already computes. Do not add authorization, validation, or business logic to make coverage look better.
- Same door: a config `handler` calls the function the button or change event already calls. Never call a service or API directly from config.
- Reasons are the application's own words, names state the outcome ("Lock March", not "Lock button"), and no string an agent reads may instruct or persuade the agent. Never invent a URL, a risk, or a description you cannot point at in the code.
- Off by default in production for people. Do not remove or loosen the flag `init` writes; keep its `|| injectedRelay() !== null`, which turns the surface on inside a session a host runs for an agent. User-facing text goes through the application's own i18n; the generated code has none.
- Do not add dependencies other than the SDK packages `init` names, and do not commit secrets or relay tokens.

## Steps

1. **Preview.** From the application directory run `npx axe surface init --dry-run`. Read the detected framework, root file, and package manager, and the printed diff. If the root also renders pages before sign-in (login, marketing), or a provider the flag needs (a feature-flag client) is mounted lower down, pick the signed-in layout from the listed mount points and re-run with `--mount <file>`. If the team gates features with a flag client, pass its check: `--flag-hook 'useFeatureFlag("<key>")' --flag-import '<module>'` (or `--flag <module>#<export>`, or a build-time variable with `--flag <NAME>`). Do not add `--relay-dev` unless the team wants the attended fallback (the agent in a person's own open tab, with pairing): the default code already connects when a host runs the app for an agent.
2. **Review.** Confirm the diff wraps the right element, imports follow the file's style, and nothing unrelated changed. If `init` reports a manual step, make exactly that edit by hand.
3. **Apply.** Re-run the same command with `--yes`. Run it once more and confirm it says there is nothing to change.
4. **Install.** Run the install command `init` printed. While the SDK is unpublished use the tarball form from "Packaging" in `llms.txt`: pack with `scripts/pack-for-consumer.sh`, add the `file:` dependencies, point the sibling packages at their tarballs with `overrides` (npm), `pnpm.overrides` (pnpm), or root `resolutions` (Yarn, including Berry workspaces), commit the vendor directory with its `SOURCE` pin and the lockfile, and copy the vendor directory in any Dockerfile or CI job before its install step.
5. **Run the app** in development, where the flag is on and `expose` publishes `window.__surface`. Typecheck and run the existing tests: nothing that passed before may fail. If `.axe/` is not in `.gitignore`, add it: `axe host login` saves a person's session there.
6. **Measure.** Run `npx axe surface coverage <dev-url>` (add `--routes /a,/b` for the pages that matter, `--auth '<Cookie: ...>'` or `--auth 'Authorization: Bearer ...'` behind a sign-in; `--out coverage-before.md` keeps the report). If it reports no `window.__surface`, follow the reason it gives before anything else.
7. **Write config for the top gaps**, in `surface.config`, most important first, stopping when the remaining gaps are cosmetic:
   - unnamed controls: a `name` that states the outcome;
   - disabled controls without a reason: the `reason` sentence the UI already shows or implies, copied from the code that disables it;
   - destructive or irreversible actions (delete, submit, approve, send, pay): `risk: "high"` and `approval: true`, so a person approves on the page (see the consent rule in "Rules that are scars"; an agent's `confirm` is not consent);
   - fields that hold private data (credentials, personal or financial data): `sensitive: true`;
   - controls an agent should never see (debug panels, the app's own assistant): `hide: true`;
   - a control whose click is not its real effect (a menu, a custom widget): a `handler` that calls the application's own function;
   - related controls: a `group`.

   Also look for state the page changes without re-rendering (a save in flight, a lock, a busy sweep): "Decide your shape" explains why those need a freeze or a re-sync, and a config entry cannot see them.

8. **Verify by driving the app.** Re-run coverage and compare with the first report. Then act as the agent, unattended: sign in once with `npx axe host login <dev-url>` (a person does this; with no person, script a sign-in with Playwright and save its `storageState` to a file), start `npx axe host --dev --app <dev-url> [--start <path>] [--state <file>]`, and connect an MCP client with the printed key (or `claude mcp add <name> -- npx axe host --dev --stdio --app <dev-url>`). Call `relay_tabs`, read the page with `surface_read`, `surface_observe`, perform one ordinary change end to end, confirm a destructive action stops for the person's approval in the client (MCP elicitation; `approval_required` in a client without it), wait for its result with `surface_wait`, and confirm a stale act (an old `expectedRev`) is refused as a conflict with nothing applied. Check every outcome against the application's own state, not the tool text. In the page itself, `window.__surface.observe()` works too; remember that `act` returns a promise.
9. **Test.** Add the smallest tests from "Tests to write" that fit: names and reasons pass `lintAgentText`, and a mounted test shows the flag off renders exactly what it rendered before.

## Summary to hand back

- The commands you ran and the files changed (the diff should be short: the mount edit, two generated files, config, tests).
- Coverage before and after: counts, and the gaps you left and why.
- Every config entry whose value you inferred rather than copied from the code, so a person can check it.
- Anything that needs a person: an approval page, a flag to flip in an environment, a missing reason the product has to write, a stale-state channel that needs a freeze.
- For production: what the application must provide for unattended mode ("What does not exist yet" in `llms.txt`): an OAuth authorization server whose tokens the host verifies, and a `sessionFor` that issues an application session for the verified person and tenant.
