# Evaluation

This page describes the evaluation harness in `examples/plan-review/eval/`: what it compares, what it measures and what it does not, how to run it, how to read its report, the results of the one run recorded so far, and the experiments that have not been run.

> **Warning**
> Every result on this page comes from scripted agents, not models. A scripted agent is a deterministic program that does the best it can with what an interface exposes. Scripted success shows that an interface makes a task possible for a careful client. It is not evidence of how a model-driven agent performs, of adoption, or of value to anyone.

## The question

The SDK claims that an agent working next to people in an interactive application does better with live state, a revision on every write, availability with reasons, approvals, and idempotent retries than with the page alone or with a thin set of tools. The Surface trials behind the SDK found that two of their three gains against browser agents came from accessible names alone ([Surface](surface.md#accessible-names); [DECISIONS.md](../DECISIONS.md), "Surface"). An honest comparison therefore has to separate what the markup buys from what the protocol buys, on the same application, with the same permissions, tasks, and data.

## Four variants of one application

The [reference application](reference-app.md) runs in four variants. One environment variable, `PLAN_REVIEW_VARIANT`, read on the server at request time (`lib/variant.ts`), selects which agent-facing interface the running app exposes. The domain functions, the conditional write, the roles, the seed data, and the reset are the same in every variant; only the interface differs. Unset, the app is what it always was: everything on, which is what the other test suites use.

| Variant | What the agent gets | What changes in the code |
| --- | --- | --- |
| V1, UI as shipped | The rendered page with generic markup: no accessible names on the grid, no Surface attributes. | `PlanBoard.tsx` does not spread the `useSurfaceProps` attributes on the controls. The registrations still run; the page looks the same. |
| V2, accessible names | The same page with each control's accessible name and the Surface DOM mirror (`aria-label`, `data-surface-id`, `aria-readonly`, `data-surface-reason`). No tools. | None beyond V1's switch: this is the page as shipped. |
| V3, basic tools | Four MCP tools (`lib/basic-tools.ts`, `eval/basic-mcp.ts`) over plain JSON endpoints: get the plan, set a value, submit, lock. They call the same domain functions with the same token and role checks. | New, written for this evaluation. No revision (every write applies to the plan as it is now), no availability, no approval handoff, no idempotency key. |
| V4, AXE | The MCP server `@axe/mcp` derives from the app's AXE manifest, the same one `axe mcp <url>` serves: `axe_state`, `expectedRev` on every write, idempotency keys the agent can repeat, `needs_human` and `axe_resume`. | `lib/axe.ts` and the approval page, as shipped. |

In V1 and V2 the AXE endpoints and the basic tools answer 404; in V3 only the basic tools answer; in V4 only AXE. V1 and V2 differ only in markup. The page's in-tab surface at `window.__surface` stays published in V1 and V2, and the scripted browser agents never read it.

### Installation effort

Lines of integration code each variant adds to V1, counted by `eval/integration.ts` from the source (non-blank, non-comment lines in the files or call sites that exist only for that variant):

| Variant | Lines | What is counted |
| --- | --- | --- |
| V1 | 0 | the baseline |
| V2 | 91 | `lib/browser-surface.ts`, `app/SurfaceHost.tsx`, and the four `useSurfaceProps` registrations in `PlanBoard.tsx` |
| V3 | 131 | `lib/basic-tools.ts`, its route, and the MCP adapter in `eval/basic-mcp.ts` |
| V4 | 589 | `lib/axe.ts`, the two AXE routes, the approval page and its decisions; the MCP server is derived and costs no lines |

V4's count includes an approval flow that V1 to V3 do not have at all, so the numbers are not like for like. Hours are not recorded: the V3 wrapper and the harness were written in one session by the same author, which says nothing about the effort for a team new to the SDK.

## Scenarios

Each scenario has a task (the sentence a person would give an agent), a fault, a scripted person where the scenario needs one, and an expected final state. The agent acts for bob, a planner on the Acme team; the person beside it is alice, an approver on the same team.

| Scenario | Task | Fault |
| --- | --- | --- |
| Simple edit | Set Widgets, March 2027 to 1750. | none |
| Interrupted task | Set three cells, then submit. | The agent process dies right after its second change (tools: the write reached the server; browser: the draft was typed, not saved). A new process starts with only the task. |
| Stale observation | Add 100 to Gaskets, March 2027. | A person sets that cell to 1500 after the agent read it and before its change is sent. |
| Two actors | Set Widgets, April 2027 to 2000. | A person saves a different cell just before the agent's change. |
| Unavailable control | Set Widgets, January 2027 to 1300; if it cannot be done, say why. | A person submitted the plan first, so values cannot change. The app locks whole plans, not months. |
| Lost response | Set Brackets, June 2027 to 2500. | The first write is applied, but its response never arrives; the agent retries. |
| Navigation | Set two cells. | After the first change the agent's tab navigates to the history page. Server tools have no page, so this fault does not apply to V3 and V4. |
| Human handoff | Submit the plan and get it approved and locked. | Locking needs an approver; bob is a planner. |

### The scripted agents

One algorithm (`eval/policy.ts`) runs every variant: observe, compute the change, send it, handle what comes back, and after a crash start again knowing only the task. A driver per variant does only what that variant exposes:

- **V1** drives Chromium through Playwright. It finds a cell by the column whose header shows the month and the row whose header shows the item, finds buttons by their visible text, and learns that a cell is read-only from the input itself, with no reason.
- **V2** drives the same page by accessible name ("Widgets, March 2027", "Save 1 unsaved change") and reads the reason for a read-only cell from `data-surface-reason`.
- **V3** calls the basic tools. It cannot know that a change is blocked until it tries, and cannot tell that the plan moved since it read it.
- **V4** reads `axe_state` and `plan_read` to observe, presents `expectedRev` and a repeatable idempotency key on every write, re-reads on `conflict`, relays an unavailable action's reason without trying it, and follows `needs_human` to `axe_resume`.

All four handle what their variant reports as well as a careful program can. In particular, the browser agents treat the page's own "The plan changed since you loaded it" message as a conflict: they discard the draft, read again, and retype.

## What is measured, and what is not

Per variant, scenario, and run:

- **Success**: the application's final plan and history match the expected state, no agent write is incorrect, and, for the unavailable control, the agent relayed the application's own reason. Read from a test-only snapshot endpoint, never from the agent's report.
- **Incorrect mutations**: agent writes in the history whose value the task did not ask for, or that touch a cell or status outside the task. A lost update counts here.
- **Recovered**: the task completed after its fault (only for scenarios with a fault to recover from).
- **Human interventions**: steps a person took for the agent (an approval, or the person doing the step).
- **Write attempts, conflicts, refusals**, and who completed the final step.
- **HTTP requests and bytes** between the agent's side and the app (request and response bodies; for the browser, every request except cached script and style assets, including the page's own polling).
- **Agent bytes**: what the agent program sent and read. For V3 and V4, the MCP messages. For V1 and V2, one accessibility snapshot of the page per observation, which stands in for what a browser agent would read. A size, not a token count.
- **Latency**: wall time of the task, excluding sign-in and MCP connect, with the environment recorded.
- **Tokens**: n/a. No model runs, so there are none to count, and the report never estimates them.
- **Maintenance**: after a controlled UI change (the Save button's visible label becomes "Apply changes" and the item column moves to the end), every scenario runs again without any change to the agents; a scenario that succeeded every time before and fails after counts as broken.

Not measured: how a model reads a page or a tool list, how often it picks the wrong control or ignores a reason, token cost, a person's time or experience, any application other than this one, and anything about the market.

## Run it

```sh
pnpm install
pnpm -r build
pnpm --filter plan-review-example exec playwright install chromium   # once per machine
pnpm eval                                                             # or: pnpm example:eval
```

`pnpm eval` runs `next build` and then `eval/run.ts`: for each variant it starts `next start` on port 3117 with `PLAN_REVIEW_VARIANT` and the test-only reset, runs every scenario five times, restarts with the UI change, runs every scenario five times again, and writes `docs/review/2026-09-24/data/evaluation-<date>.json` (every run) and `.md` (the report). It is headless and offline and takes about five minutes on a laptop. From `examples/plan-review` after a build, `node --import tsx eval/run.ts` takes `--runs=N`, `--maintenance-runs=N`, `--variants=v1,v3`, `--scenarios=stale-observation,handoff`, `--port=N`, `--date=YYYY-MM-DD`, `--out=DIR`, and `--no-write`.

The harness's own pieces (the variant switch, the thin tools' blind write, the outcome check, the Wilson interval, the model runner's refusal) are tested in `examples/plan-review/test/eval.test.ts`, which is part of `pnpm -r test`.

## How to read the report

The report opens with the environment (commit, Node, Chromium, Playwright, Next, machine) and the integration counts. "Success by scenario and variant" gives successes over runs with a 95% Wilson interval. The runs are deterministic, so five of five is the same result five times; the interval only says how little five runs can establish, not that the behavior varies. "All measures" has one row per scenario and variant, with medians. "Why the failures failed" names the cell or reason that differed. The maintenance table counts broken scenarios per variant.

## Results of the run on 2026-09-24

Commit `9f43260`, Node 24.21.0, Chromium 153 headless through Playwright 1.63.0, Next 16.3.6, macOS on an Apple M5, one production server on localhost. Five runs per cell, five after the UI change. Full report: [evaluation-2026-09-24.md](review/2026-09-24/data/evaluation-2026-09-24.md); every run: the JSON beside it.

| Scenario | V1 | V2 | V3 | V4 |
| --- | --- | --- | --- | --- |
| Simple edit | 5/5 | 5/5 | 5/5 | 5/5 |
| Interrupted task | 5/5 | 5/5 | 5/5 | 5/5 |
| Stale observation | 5/5 | 5/5 | **0/5**, 5 lost updates | 5/5 |
| Two actors | 5/5 | 5/5 | 5/5 | 5/5 |
| Unavailable control | **0/5**, no reason shown | 5/5 | 5/5, after one refused write | 5/5 |
| Lost response | 5/5 | 5/5 | 5/5 | 5/5 |
| Navigation | 5/5 | 5/5 | 5/5 (fault n/a) | 5/5 (fault n/a) |
| Human handoff | 5/5, the person locks | 5/5, the person locks | 5/5, the person locks | 5/5, the agent locks after approval |
| Broken by the UI change | **6 of 8** | 0 of 8 | 0 of 8 | 0 of 8 |

Selected measures (medians over five runs; the report has all of them):

| Scenario | Variant | Write attempts | Conflicts | HTTP requests | Agent bytes | Latency |
| --- | --- | --- | --- | --- | --- | --- |
| Simple edit | V1 / V2 / V3 / V4 | 1 / 1 / 1 / 1 | 0 | 4 / 4 / 3 / 5 | 5.3 / 6.5 / 2.6 / 7.9 kB | 123 / 108 / 2 / 4 ms |
| Stale observation | V1 / V2 / V3 / V4 | 2 / 2 / 1 / 2 | 1 / 1 / 0 / 1 | 6 / 6 / 2 / 6 | 5.3 / 6.6 / 1.8 / 8.8 kB | 338 / 337 / 2 / 4 ms |
| Two actors | V1 / V2 / V3 / V4 | 2 / 2 / 1 / 2 | 1 / 1 / 0 / 1 | 6 / 6 / 3 / 8 | 8.1 / 10.0 / 2.6 / 11.6 kB | 344 / 343 / 2 / 5 ms |
| Lost response | V1 / V2 / V3 / V4 | 1 / 1 / 2 / 2 | 0 | 8 / 8 / 4 / 6 | 5.2 / 6.5 / 2.3 / 8.3 kB | 4140 / 4136 / 2 / 3 ms |
| Interrupted task | V1 / V2 / V3 / V4 | 2 / 2 / 4 / 4 | 0 | 10 / 10 / 8 / 13 | 10.6 / 13.2 / 8.1 / 30.3 kB | 362 / 328 / 5 / 9 ms |

What the run shows, within its limits:

- **The conditional write is what protects against a stale observation, whichever door the agent uses.** The reference page already sends the revision a draft was typed at, so the browser agents in V1 and V2 were refused, re-read, and got it right. V4 did the same with `expectedRev`. V3's thin tools write blind, and every run overwrote the person's 1500 with 1420. A V3 that added a revision check would pass, and would be most of the way to V4.
- **Accessible names are what let a browser agent relay a reason and survive a cosmetic rename.** V1 could see that the cell was read-only but not why; V2 read the application's sentence from `data-surface-reason`. After the Save button was relabeled, V1 could not find it in six scenarios; V2 found it by its accessible name, which did not change. This matches the trials' finding that names carry much of the gain for browser agents.
- **Availability saves a refused write, not a failure.** V3 relayed the same reason as V4, but only after trying the write and being refused. In this app the refusal is harmless; in an application where a refused attempt has side effects (a notification, a lock taken), it would not be.
- **One site-wide revision costs a retry on unrelated changes.** In the two-actors scenario V1, V2, and V4 were each refused once because a person changed a different cell, and retried; V3 wrote without a conflict and was right, because its write touches one cell. This is the cost [DECISIONS.md](../DECISIONS.md) accepts under "No per-entry revisions".
- **Restarts and lost responses did not separate the variants here.** Every task in this app is state-idempotent (setting a value to what it already is changes nothing, and the domain refuses it), so an agent that observes again after a restart or retries the same absolute write ends in the right state. V4's retry was replayed from the idempotency record instead of being refused as a duplicate, which is cleaner, but the outcome was the same. A task with a relative or non-idempotent step (append, transfer, send) would test this properly; none is in the app.
- **The handoff differs in who finishes, not in how many people act.** Every variant needed one intervention. In V1 to V3 the person did the locking step themselves on the plan page and the agent had to watch for it; in V4 the person approved a request bound to the plan's revision, and the agent finished and got a receipt.
- **The browser is slower, and the numbers are not comparable across doors.** V3 and V4 take milliseconds on localhost; the browser variants take hundreds of milliseconds and four seconds when a response is lost, because the page gives no signal and the scripted agent waits before reloading. These latencies measure the harness and the page as much as the interface.
- **V4 sends more bytes than V3.** It observes with two calls (`axe_state` and `plan_read`), and its tool list and manifest are larger (16 kB of setup against about 1 kB). V3 is the cheapest in every row it passes.

Two defects surfaced along the way. The reference page does not recover from a failed save request: `busy` stays set and Save stays disabled until the page reloads. `@axe/client` retries an `unavailable` error once after a second even when the site marked it `retryable: false` (`packages/client/src/index.ts`, `request`); V4 never hit it because it reads availability before writing. Neither is fixed here; both are recorded in [item 17](review/2026-09-24/17-evaluation.md).

## Experiments that have not been run

- **Model-driven runs.** `examples/plan-review/eval/model/` holds a runner with the same scenarios and outcome checks, for a browser agent on V1 and V2, a tool-calling model on V3 and V4, and a WebMCP lane. It refuses to start unless `AXE_EVAL_MODEL_PROVIDER`, `AXE_EVAL_MODEL_CREDENTIAL_ENV` (the name of the variable holding the credential), and `AXE_EVAL_ACCEPT_COST=yes` are set, and with them it only prints its plan: no provider adapter is written. No model API has been called and no tokens have been spent for this page.
- **WebMCP.** The page surface can be offered through `document.modelContext` (`@axe/surface/webmcp`), but the Chromium that Playwright 1.63 ships (153, headless) does not expose `document.modelContext` by default (checked: `"modelContext" in document` is false), and the reference app does not install the adapter. V2 plus WebMCP is a lane in the model runner, not a result.
- **A second application, and other people's.** Every number here comes from one app written by the SDK's authors, with tasks chosen to exercise the faults the SDK was designed for. The [pilot plan](pilot-plan.md) describes how to test with applications and tasks that are not ours.
- **Non-idempotent tasks, per-cell revisions, and a V3 with a revision check.** Each would sharpen a comparison above.

## Limitations

- The scripted agents are written by the same author as the variants, and they are as good as that author made them. A weaker V1 script (clicking by raw position) would break on the column move; a stronger one (matching the button by its role in the form) might survive the rename.
- The UI change renames only the Save button's visible text. V2's accessible name comes from the Surface entry's name, which was left alone; a rename of the entry would break V2 the same way.
- The person beside the agent is scripted and acts through the app's endpoints, not a second browser.
- The run is on one machine; latency depends on it and on the page's 1.5-second polling.
- The unavailable-control scenario uses a submitted plan, because the app has no per-month lock.

## Next steps

- [Pilot plan](pilot-plan.md): testing with external applications and tasks.
- [Reference application](reference-app.md): the app the variants are built from.
- [Live state and revisions](live-state.md): `expectedRev` and `/axe/state`, which the stale and unavailable scenarios exercise.
