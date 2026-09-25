# Model-driven benchmark (not run)

This directory holds the skeleton of a benchmark with real agents. It has never been run. No model API has been called for this evaluation, no tokens were spent, and no result in `docs/review/2026-09-24/data/` comes from a model.

The deterministic harness one directory up (`pnpm eval`) answers a narrower question: what can a scripted client do with each variant's interface? It cannot say how often a model reads a page wrongly, picks the wrong tool, ignores a reason, or asks a person when it does not need to. That is what this runner is for.

## What it would do

`run.ts` uses the same scenarios, faults, and outcome checks as the scripted harness (`../scenarios.ts`, `checkOutcome`), so both are scored against the application's own state and history, never against what the agent says it did. Lanes:

| Lane        | Agent                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------ |
| v1          | a browser agent (screenshots or the accessibility tree) on the page with generic markup                      |
| v2          | the same browser agent on the page with accessible names and the Surface DOM mirror                          |
| v3          | a tool-calling model connected to the basic tools over MCP (`../basic-mcp.ts`)                               |
| v4          | a tool-calling model connected to the derived AXE MCP server (`axe mcp <url>`)                               |
| v2 + WebMCP | a browser agent reading the page surface through `document.modelContext`, only in a browser that provides it |

Per run: reset the app, apply the scenario's setup, give the agent only the task text, inject the fault through the same hooks, play the person with the same scripted steps, score with `checkOutcome`, and record the provider's own token counts, wall time, tool calls, and the transcript.

## Starting it

It refuses to start unless all of these are set:

- `AXE_EVAL_MODEL_PROVIDER`: which agent to drive.
- `AXE_EVAL_MODEL_CREDENTIAL_ENV`: the name of the variable holding the credential (the runner checks that it is set and never prints it).
- `AXE_EVAL_ACCEPT_COST=yes`: an explicit acknowledgment that a run calls a paid API.

With them set, it prints the plan and exits with status 3, because no provider adapter is written. Adding one is the next step, together with a budget, the model and version, sampling settings, and the number of runs, all recorded in the output.

```sh
pnpm --filter plan-review-example eval:model   # refuses: nothing is configured
```

## Before a real run

- Decide the number of runs from the variance you expect: model runs are not deterministic, and five runs per cell gives wide intervals.
- Record the model, its version, the system prompt, the tool descriptions as sent, temperature, and the harness commit.
- Keep transcripts; a success with a wrong explanation, or a failure caused by the harness, is only visible there.
- Report tokens as the provider reports them. Do not estimate tokens from byte counts.
