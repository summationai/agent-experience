# 17. Evaluation harness and external pilot plan

Phase 4. Branch `review/evaluation`, based on `herz/surface-integration` at `49c11be` (phases 1 to 3 merged).

## Finding

The review: the evidence for AXE was the Surface trials and the SDK's own tests. Nothing compared, on one application with the same permissions, tasks, and data, the page as shipped, accessible names alone, basic structured tools, and AXE with live state; nothing measured task success, incorrect writes, recovery, human interventions, cost, integration effort, or maintenance; and there was no plan for testing with anyone outside the team.

Checked in this checkout at `49c11be`:

- No evaluation code existed. The reference app's suites (`test/server.test.ts`, `e2e/plan-review.spec.ts`) test that AXE behaves correctly; neither compares it with anything.
- The only comparative evidence was the trials summarized in `DECISIONS.md` ("Surface") and `docs/surface.md` ("Accessible names"): two of three gains against browser agents came from accessible names alone. No artifact in the repository reproduces it.
- The app could not run without its agent affordances: `useSurfaceProps` attributes were always spread, and the AXE endpoints always answered.
- No pilot plan, and no statement of which commercial claims were hypotheses.

## Change

Variant switch in the reference app (smallest change that keeps the business logic identical):

- `examples/plan-review/lib/variant.ts`: `PLAN_REVIEW_VARIANT` (`v1`, `v2`, `v3`, `v4`; unset means everything, as before) and `PLAN_REVIEW_UI_CHANGE`, read on the server at request time, so one production build serves every variant.
- `app/plan/PlanBoard.tsx`: with generic markup (v1) the Surface attributes are not spread on the controls; the registrations are unchanged. The UI change relabels Save ("Apply changes") and moves the item column to the end.
- `app/axe/[...axe]/route.ts`, `app/.well-known/axe.json/route.ts`: 404 unless v4 or unset.
- `lib/basic-tools.ts` and `app/tools/[name]/route.ts`: v3's thin tools (`get_plan`, `set_value`, `submit_plan`, `lock_plan`), same domain functions, same agent token and roles, writes at the current revision (blind), no availability, no handoff, no idempotency key. 404 unless v3 or unset.
- `lib/ui-api.ts`: the page state carries the view; a test-only `GET /api/test/snapshot` beside the reset (only with `PLAN_REVIEW_TEST_RESET=1`).

Harness, `examples/plan-review/eval/`:

- `scenarios.ts`: eight scenarios (simple edit, interrupted task, stale observation, two actors, unavailable control, lost response, navigation, human handoff) with task text, fault, scripted person, expected final state, and an outcome check that scores the app's plan and history (success, incorrect agent writes, mismatches, the relayed reason). Shared with the model runner.
- `policy.ts`: one scripted agent algorithm (observe, compute, send, handle conflict, refusal, lost response, page change, crash and restart, handoff) over a `Driver` per variant.
- `browser-driver.ts` (v1 by visible text and table position, v2 by accessible name and `data-surface-reason`, both through Playwright), `tool-drivers.ts` (v3 over `basic-mcp.ts`, v4 over the MCP server `@axe/mcp` derives from the manifest), `meter.ts` (HTTP and MCP bytes, injected lost responses, Wilson intervals), `app.ts` (next start per variant, the scripted person, reset, snapshot), `integration.ts` (lines per variant from the source), `report.ts`, `run.ts`.
- `model/run.ts` and `model/README.md`: the model-driven runner skeleton; refuses without `AXE_EVAL_MODEL_PROVIDER`, `AXE_EVAL_MODEL_CREDENTIAL_ENV`, and `AXE_EVAL_ACCEPT_COST=yes`; with them prints its plan and exits 3. Imports no provider SDK.
- Scripts: `eval` and `eval:model` in the example; `eval` and `example:eval` at the root. `.prettierignore` skips the generated JSON.

Docs: new `docs/evaluation.md` (question, variants and their code, installation effort, scenarios, the scripted agents, what is and is not measured, how to run, how to read the report, the results of the run, unrun experiments, limitations) and `docs/pilot-plan.md`; both in `docs/README.md` and `site/build.mjs` HUB_GROUPS; `docs/reference-app.md` points at the harness. `DECISIONS.md` section "Evaluation"; `CHANGELOG.md`. No SDK package, wire name, or spec rule changed, so no vocabulary rows and no changeset.

## Tests

`examples/plan-review/test/eval.test.ts` (in `pnpm -r test`, 7 tests):

- the variant switch: unset means everything; v1 alone strips the markup; each tool set answers only in its own variant
- v3 basic tools call the same domain rules but write blind: a person's change in between is overwritten (the property the stale scenario measures); refusals carry the domain's reasons
- outcome checks score the app's state and history: a lost update is an incorrect mutation even if the agent reports success
- the unavailable control counts only the app's own reason
- Wilson intervals for five of five and zero of five
- integration lines are counted from the source for v2, v3, and v4
- the model runner refuses without a provider, a named credential, and an explicit cost acknowledgment

The existing suites still pass with the variant switch unset: `pnpm example:test` (22 tests with the new file) and `pnpm example:test:app` (7 passed).

## Measured results vs unrun experiments

Measured (scripted, no model), `pnpm eval` at commit `9f43260`, Node 24.21.0, Chromium 153 headless, Playwright 1.63.0, Next 16.3.6, macOS on Apple M5; five runs per cell and five after the UI change. Report: [data/evaluation-2026-09-24.md](data/evaluation-2026-09-24.md); every run in the JSON beside it.

| Scenario | V1 | V2 | V3 | V4 |
| --- | --- | --- | --- | --- |
| Simple edit | 5/5 | 5/5 | 5/5 | 5/5 |
| Interrupted task | 5/5 | 5/5 | 5/5 | 5/5 |
| Stale observation | 5/5 | 5/5 | 0/5 (5 lost updates) | 5/5 |
| Two actors | 5/5 (1 conflict each) | 5/5 (1 conflict each) | 5/5 | 5/5 (1 conflict each) |
| Unavailable control | 0/5 (no reason available) | 5/5 | 5/5 (after a refused write) | 5/5 |
| Lost response | 5/5 (4.1 s wait, reload) | 5/5 (4.1 s) | 5/5 (retry refused as a duplicate, verified) | 5/5 (retry replayed) |
| Navigation | 5/5 | 5/5 | 5/5 (fault n/a) | 5/5 (fault n/a) |
| Human handoff | 5/5 (person locks) | 5/5 (person locks) | 5/5 (person locks) | 5/5 (agent locks after approval, receipt) |
| Broken by the UI change | 6 of 8 | 0 | 0 | 0 |

Every cell with five of five has a 95% Wilson interval of 57% to 100%; zero of five, 0% to 43%. The runs are deterministic, so the intervals reflect the number of runs, not behavioral variance. Integration lines over V1: V2 91, V3 131, V4 589 (V4 includes an approval flow the others lack). Human interventions: one per handoff run in every variant, zero elsewhere. Tokens: n/a everywhere.

Not run: any model-driven benchmark (the runner exists and refuses to start without configuration); a WebMCP lane (Chromium 153 does not expose `document.modelContext` by default, and the app does not install the adapter); any second or external application; any pilot. No model API was called, nothing was spent, and no one was contacted.

Two defects surfaced and are not fixed here: the reference page leaves Save disabled after a failed save request (`busy` is never cleared when `fetch` rejects in `PlanBoard.tsx`'s `act`), and `@axe/client` retries an `unavailable` error once after a second even when the site marked it `retryable: false` (`packages/client/src/index.ts`, `request`).

## Limitations

- Scripted success is not evidence of agent performance. The scripts are the upper bound of what each interface allows a careful client; a model can do worse on any variant, and differently on each.
- One application, written by the SDK's authors, with scenarios chosen to exercise faults the SDK was designed for. Every task in the app is state-idempotent, so restarts and lost responses do not separate the variants; a relative or non-idempotent step would.
- The v3 wrapper is deliberately thin; adding a revision check to it would pass the stale scenario.
- The UI change renames only Save's visible text; V2 survives because its accessible name comes from the Surface entry's name, which was not renamed. The V1 script maps columns by header text, so the column move alone breaks nothing.
- The app locks whole plans, not months; the unavailable-control scenario uses a submitted plan.
- The person beside the agent is scripted and acts through the app's endpoints.
- Latency is from one machine; browser variants include the page's polling and the scripts' waits, so the doors are not comparable on latency. "Agent bytes" are sizes of what the scripts read (MCP messages, or one accessibility snapshot per observation), not tokens.
- Installation effort is lines only; hours were not recorded, and the author of V3 also wrote the harness.
- `docs/pilot-plan.md` is a plan: every commercial hypothesis in it is unvalidated and every threshold a proposal.
- Items 16 and 18 are in progress on other branches; `DECISIONS.md`, `CHANGELOG.md`, `docs/README.md`, and `site/build.mjs` may need reconciling at merge.

## Status

done
