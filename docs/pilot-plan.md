# Pilot plan

A plan for testing AXE and Surface with three to five external design partners: companies with interactive B2B applications where people and agents share work. It says who to look for, what to ask them to do, what to compare against, what to measure, and what result would justify continuing.

> **Warning**
> This is a plan, not a report. No pilot has been run. No company or person has been contacted. Every commercial hypothesis on this page is unvalidated, and every threshold is a proposal to be agreed before the first partner starts.

## What the pilot is for

The [evaluation](evaluation.md) shows what a scripted client can do with each interface to one application written by the SDK's authors. It cannot say whether real teams can integrate the SDK at a reasonable cost, whether model-driven agents do better with it on their own workflows, or whether anyone would keep it or pay for it. The pilot is designed to answer those questions, and to be able to answer "no".

Hypotheses, all unvalidated:

1. **Integration.** A team that owns an interactive B2B application can expose three of its real workflows through AXE (and, where it has a live UI, Surface) in a bounded number of engineering hours, without changing its business logic.
2. **Outcomes.** On those workflows, a model-driven agent makes fewer incorrect writes and completes more tasks after faults (stale views, concurrent edits, lost responses, restarts) through AXE than through the partner's current UI or its existing API or MCP tools.
3. **Oversight.** Bound approvals and one shared history reduce the human work needed to supervise an agent, compared with the partner's current way of reviewing agent actions.
4. **Accessible names alone.** Some or most of the gain for browser agents comes from accessible names and the DOM mirror, without tools. If so, that is a smaller, separate offering.
5. **Retention and value.** A partner keeps the integration running after the pilot without our help, and some partners would pay for support, hosting, or the audit.

## Who to look for

Selection criteria for each partner:

- An interactive B2B application in production: planning and forecasting, scheduling, admin and back-office workflows, approvals, inventory, or configuration. Something where a person and an agent could plausibly edit the same record on the same day.
- At least three workflows with a state change a person cares about (not read-only lookups), at least one of which needs a person's approval today.
- Concurrent use: more than one person edits the same objects, so stale views and conflicts happen in real use.
- An engineering team that can give two engineers part time for two weeks, and a product owner who can define tasks and success.
- A stack the SDK runs in (Node 20 or newer with a Web-standard or Express server; a React front end for Surface), or a willingness to put a Node service beside theirs.
- Willingness to share aggregate metrics and integration effort, under the data handling below.

Aim for variety across the three to five: at least one with an existing public API or MCP server (to test against a real V3 baseline), at least one where agents today drive the browser, and at least one with a strict approval requirement (finance, compliance, or safety). Exclude partners whose main workflow needs a payment, identity proof, or regulated consent on the agent path in the first pilot; those raise requirements the pilot is not designed to measure.

## Tasks for each partner

Tasks come from the partner's own workflows, written by their product owner as the sentence a user would give an agent, with an expected final state that can be checked in their data. The evaluation's scenarios are templates for the faults each task should be tried under:

| Template (evaluation scenario) | The partner's version |
| --- | --- |
| Simple edit | The most common single change in the workflow. |
| Interrupted task | A multi-step change where the agent's process restarts after some steps. |
| Stale observation | A relative change ("raise by 10%") while a person edits the same record. |
| Two actors | A person and an agent editing different parts of the same object at once. |
| Unavailable control | A change the workflow forbids in some state (a closed period, a locked record, a role), where the agent should relay the reason and stop. |
| Lost response | A write whose response is dropped by the network, then retried. |
| Navigation | For browser baselines: the page changes under the agent mid-task. |
| Human handoff | A change that needs an approver, with the approval bound to the state it was asked for. |

Three to five tasks per partner, each tried under the faults that make sense for it. The partner decides the expected state; we write the check against their data, never against the agent's account of what it did. Where a task has a relative or non-idempotent step (a transfer, an append, a message), include it: the reference app has none, and that is exactly where retries and restarts differ.

## Baselines

Every task runs through at least two of these, on the same data, permissions, and resets:

1. **The current UI** with a browser agent, as the partner's users would use one today.
2. **The current UI with accessible names** added through the DOM mirror, if the partner accepts the change (this isolates hypothesis 4).
3. **The partner's existing API or MCP tools**, if they have them, called by a tool-calling model.
4. **AXE** (and Surface where it fits), called by the same tool-calling model through the derived MCP server.

The model, its version, the prompt, and the tool descriptions are fixed per partner and recorded. The model-driven runner in `examples/plan-review/eval/model/` is the starting point for the harness; it has not been run, and a provider adapter has to be written and reviewed first.

## Measuring integration effort

- **Hours**, logged per person per day against a fixed list: reading, designing actions, writing handlers, approvals, tests, review, deployment, and time blocked on us. Logged by the partner's engineers, not estimated afterwards.
- **Lines**, counted from the partner's diff as the evaluation counts them (non-blank, non-comment lines that exist only for the integration), split into actions, approval pages, and configuration.
- **Who**: role and seniority, prior familiarity with MCP and agents, and how much help they needed from us (every question and its answer, logged).
- **Where it hurt**: each blocker, with the file or doc it came from. A blocker that a doc change fixes is fixed during the pilot and noted.

## Duration and cadence

| Weeks | What happens |
| --- | --- |
| 0 | Agreement, data handling sign-off, task definitions, baseline measurement plan. |
| 1 to 2 | Integration by the partner's engineers, with a shared channel and two scheduled pairing sessions. |
| 3 | Scripted runs of the partner's tasks (a harness like `pnpm eval`, on their staging data) to check that each check scores correctly. |
| 4 to 7 | Model-driven runs on staging, then limited use by real users where the partner agrees, with the ledger and events on. |
| 8 | Analysis, a written readout to the partner, and the retention and value conversation. |
| 12 | Follow-up: is the integration still running, and who maintains it. |

Weekly: a 30-minute check-in with the partner's engineer and product owner. Every two weeks: a metrics review with the numbers below. Any incorrect write attributed to the integration is reviewed within two working days.

## What to instrument

- **Outcomes**: the partner's check for each task, run after every attempt: success, incorrect writes, recovered after a fault, and who finished.
- **The history**: action events (`onActionEvent`), including approval events, into the partner's own store; the Surface ledger where Surface is used. These say who did what, at which revision, and what was refused.
- **Analytics events** as in [Analytics](analytics.md): calls, statuses, conflicts, latency. They name no one.
- **Human work**: interventions per task (approvals, takeovers, corrections), and the time from a handoff to the person's decision.
- **Cost**: model tokens as the provider reports them, requests, and wall time. Never estimated.
- **Maintenance**: every UI or API change the partner ships during the pilot, and whether any integration or task broke because of it.

## Retention and value

Questions for the week 8 readout and the week 12 follow-up, asked the same way of every partner, with no price anchored in advance:

- Is the integration still running? Who changed it since the pilot, and why?
- Which tasks, if any, would you let an agent do in production with this in place, and which not?
- What would you stop doing, or do less of, if you kept it?
- What would you need from us to keep it: nothing, fixes, support, hosting, an audit, something else?
- If you would pay for any of that, what budget would it come from, and who decides?

What counts as evidence, strongest first: the integration still running at week 12 without our engineering; an agent task moved to production use; budget allocated or a paid agreement signed; a written request for a specific paid capability. What does not count on its own: interest expressed in a call, a positive survey answer, or praise for the demo.

## Go / no-go criteria

All thresholds are proposals, to be agreed before the first partner starts and not moved afterwards.

| Question | Go (proposal) | No-go (proposal) |
| --- | --- | --- |
| Integration cost | Median at most 40 engineer-hours to expose three tasks, across partners who finish. | Median above 80 hours, or fewer than half the partners finish integration. |
| Outcomes after faults | On at least two partners, AXE's task success under faults is at least 20 points higher than the best baseline, with the difference outside both Wilson 95% intervals. | No partner shows a difference outside the intervals. |
| Incorrect writes | AXE's rate of incorrect writes is no higher than the best baseline on every partner, and zero incorrect writes reach production. | Any partner shows more incorrect writes through AXE than through its baseline. |
| Oversight | Human interventions per completed task no higher than the partner's current process, with approvals bound and recorded. | Interventions per task higher on most partners. |
| Accessible names alone | Recorded either way. If names alone capture most of the gain for browser agents on most partners, the DOM mirror is offered separately and the protocol's case rests on the tool-calling results. | (not a no-go by itself) |
| Retention | At least two partners keep the integration running at week 12 without our engineering. | No partner keeps it running. |
| Value | At least one partner allocates budget or signs a paid agreement for a named capability. | No partner names anything they would pay for. |

The project continues as planned only if integration cost, outcomes, and incorrect writes are all in the go column. A no-go on outcomes with a go on names alone points to a smaller product. A no-go on retention and value with a go on outcomes says the problem is real but not one partners will act on yet.

## Risks

- **Selection bias**: partners who say yes are the ones already interested in agents. Record how each was found and who declined, and why.
- **Our help inflates their success**: log every hour we spend; report integration effort with and without it.
- **Model variance**: model-driven runs vary; plan enough runs per cell for the intervals to mean something, and fix the model version for the whole pilot.
- **Harness errors**: a wrong check scores a failure as a success. Scripted runs in week 3 check every check before any model run.
- **Security**: an agent with a real token on staging data can do real damage. Use staging, scoped tokens, per-partner tenants, and approvals on every consequential action; stop on the first incorrect production write.
- **Protocol churn**: the SDK is unreleased and may change during the pilot. Pin a version per partner and upgrade only between phases.
- **Sunk-cost reading**: the team that built the SDK is not a neutral judge of the results. Have someone outside it review the readout against the agreed thresholds.

## Data handling

- The partner's data stays in the partner's systems. We receive aggregate metrics, integration logs, and event records that carry identifiers and actors, never payloads, inputs, or bound state (the approval events already omit them).
- The Surface ledger keeps typed text as a hash, as the reference app does; if a partner uses the `keep` policy, the ledger stays on their side.
- Model transcripts are kept by the partner, or by us only with the partner's written agreement and with customer data redacted before it leaves.
- Every partner signs a data processing agreement before any access; access is limited to named people; everything we hold is deleted within 90 days of the readout unless the partner asks us to keep it.
- Credentials for model providers are the partner's or ours, never shared across partners, and never written to logs or results.

## Next steps

- [Evaluation](evaluation.md): the scripted harness the pilot's tasks and checks start from.
- [Human oversight](human-oversight.md): the approval primitive the handoff tasks use.
- [Analytics](analytics.md): the event schema to instrument.
