# 15. Human oversight in the reference workflow

Phase 3. Branch `review/reference-app`, based on `herz/surface-integration` at `7284f6a` (phases 1 and 2 merged).

## Finding

The review: demonstrate preview, explicit approval of a consequential operation, execution, and a receipt, with the approval established through a trusted human interaction and bound to the operation, the input, the principal, and the relevant state; an agent passing `confirm: true` is not proof of consent. Specify expiry, cancellation, invalidation by a state change, and replay; route human and agent actions into one history; provide takeover; present undo only where it exists; keep sensitive data out of receipts and logs.

Checked in this checkout at `7284f6a`:

- The SDK had no approval primitive. `completeHandoff(id, { onBehalfOf, data, tenant })` recorded that a handoff was finished; the resume then ran `onResume` with whatever `state` the handler had stored. Nothing compared the site's state at completion or at resume with the state the request was made against, so an approval given for one version of a record ran against whatever the record had become.
- Nothing could cancel a handoff; it could only expire (24 hours by default).
- The page at the handoff URL could not see what it was approving: the token record held only the input's hash, and no call returned a record to the site.
- Surface's `effect.confirm` requires `confirm: true` on the act, which is the agent's own assertion.
- The Plan Board demo's approval (`POST /demo/approve/:month`) set `approved = true` on a month: bound to no call, revision, or expiry, not cancellable, and reusable by any later lock, however much the month changed after the person looked at it.

## Change

`@summationai/axe-core` (reuses the resume token, `completeHandoff`'s checks, the operation claim, and replay from phase 1; adds bindings, invalidation, and cancel):

- `requestApproval({ url, instructions, whatAgentShouldSayToUser, preview?, ttlSeconds?, reason? })`, also on every handler's helpers: a handoff with `reason: "approval_required"`, `requireCompletion`, a one-hour default expiry (`APPROVAL_TTL_SECONDS`), and an approval marker.
- `action({ approvalState })`: the state an approval is bound to, called by the runtime at the request, at the approval, and at the resume, compared as canonical JSON. `action()` refuses it on a `readOnly` action or without `onResume`; the manifest gains `humanHandoff: { reasons: ["approval_required"] }`. Returning `requestApproval` without it, from `onContinue`, `onResume`, `onPoll`, or as a `needs_input` fallback is `internal` with an `onError` report. A throwing `approvalState` runs nothing and leaves the request as it was.
- The token record (`TokenRecord.approval`, `ApprovalRecord`) keeps the input as sent, the bound state and its hash, the preview, the agent's `User-Agent` self-identification, and the decision; `TokenRecord.cancelled` records a cancellation.
- `AXE.getHandoff(id, { tenant })` → `HandoffView` (action, reason, status `open` / `completed` / `approved` / `cancelled` / `invalidated` / `used`, principal, tenant, expiry, and for an approval the input, state, preview, agent, decision); null for unknown, expired, or foreign.
- `AXE.approveHandoff(id, { approver, tenant })` → `HandoffDecision`: refuses `not_found`, `not_approval`, `already_approved`, `cancelled`, `invalidated`, `used`, or `state_changed` (which invalidates the request for good).
- `AXE.cancelHandoff(id, { by, tenant, reason })`: any unused handoff; `used` once a resume ran.
- `/axe/resume`: a cancelled handoff is `conflict`, `retryable: false`, `handoffStatus: "cancelled"`; an approval not yet approved is `conflict`, retryable, `handoffStatus: "open"`; after the claim, the record is read again and the state compared; a mismatch invalidates the request (`handoffStatus: "invalidated"`, "start the action again"); otherwise `onResume` receives `approval` (`ApprovalGrant`: approved input parsed by the schema, input as sent, bound state, `approvedBy`, times) and runs once. A repeat returns the stored receipt ([P-HAND-6]). `completeHandoff` returns false for an approval request or a cancelled handoff. The unknown resume token message now says nothing was applied and to start again (still one message for every refusal).
- Approval events on `onActionEvent`: `approval.requested`, `approval.approved`, `approval.cancelled`, `approval.invalidated`, `approval.executed`, with the request id and actors, never the input, state, preview, or cancellation reason.

Approval model in short: the approval is bound to the action and the input fingerprint (the resume token), the principal and tenant (token authorization), and the state (`approvalState`); it is recorded only by the site's own code after its session, CSRF, and role checks; it expires in an hour by default; it is single use, and a repeat replays the receipt; a person can cancel it until the resume runs; any change to the bound state voids it permanently, checked at approval and again at resume, with the operation's conditional write as the second gate.

Reference app (`examples/plan-review`, item 13): `plan.approve` returns `requestApproval` with a preview; `approvalState` is the plan id, revision, and status; `onResume` locks the plan with the bound revision as the conditional write's expected revision and returns a receipt (`operation`, planId, requestedFor, `actor`, `approvedBy`, requestedAt, approvedAt, executedAt, `revBefore`, `revAfter`, `changes`). The approval page `app/approvals/[id]` shows who asked (the principal, and the agent's self-identification marked unverified), the operation and input, what changes, the bound revision beside the plan now, and the expiry; approvers approve, approvers or the requester cancel, through `POST /api/approvals/{id}` under the app's origin and JSON policy. Takeover: Freeze cancels every open or approved request and makes every agent write unavailable with the reason; Reopen (approvers, from the page) is the only undo, and `plan.approve` declares `reversible: true` because it exists. The history is one list: every change from the page and from agents is written by the domain functions (`lib/domain.ts`), and approval requests and decisions arrive through the approval events; nothing is logged automatically for the app's own handlers beyond what they write. Receipts and the history carry no session id, token, or cancellation reason; the page surface keeps typed text as a hash.

Spec: `spec/AXE-PROTOCOL.md` §9.3 "Approvals", [P-APPR-1] (request from the handler; record input and state beside the token binding), [P-APPR-2] (what the page can show; tenant isolation), [P-APPR-3] (recorded only by the site from a session-authenticated, CSRF-protected request; nothing on the AXE endpoints implies approval; only while open and the state matches), [P-APPR-4] (resume conditions; recorded input only; open is retryable `conflict`), [P-APPR-5] (cancel any unused handoff; `cancelled`; committed work cannot be cancelled), [P-APPR-6] (permanent invalidation; `invalidated`; two gates), [P-APPR-7] (single use and replay), [P-APPR-8] (shorter expiry, one hour by default; expired is the unknown-token answer with "start again"), [P-APPR-9] (receipts; events without input or state). §19 consent bullet. `spec/EVENTS.md` "Approval events" and [E-8]. All nine mapped in `packages/testing/src/conformance/requirements.ts`.

Vocabulary: `requestApproval`, `approvalState`, `getHandoff`, `approveHandoff`, `cancelHandoff`, `approvedBy`, `handoffId`, reason `approval_required`, and `handoffStatus` values `cancelled` and `invalidated`.

Docs: new `docs/human-oversight.md` (the flow, the typechecked action and page from `docs/examples/human-oversight/approval.ts`, what the page must do, a bindings table, a status and resume table, cancellation and takeover, receipts and one history, limits); `docs/human-handoff.md` (approvals and cancellation, a cancel row, and the replay row corrected from `conflict` to the original envelope); `docs/reference-app.md`. `DECISIONS.md` section "Human oversight and execution modes"; `CHANGELOG.md`; `.changeset/review-oversight-execution-modes.md`. The Plan Board demo's approval endpoint now says it is a demo shortcut, not the SDK's approval primitive.

## Tests

`packages/core/test/approvals.test.ts` (10, in `pnpm -r test`):

- an approval request returns needs_human and records the exact call for the site's page [P-APPR-1] [P-APPR-2]
- a resume before approval is a retryable conflict and runs nothing; nothing the agent sends approves [P-APPR-3]
- approved: the resume runs onResume once with the approved input and approver; a repeat replays the receipt [P-APPR-4] [P-APPR-7]
- a state change after the request invalidates the approval, at approval and at resume, for good [P-APPR-6]
- a cancelled request, open or approved, is refused with handoffStatus cancelled and nothing runs [P-APPR-5]
- an expired approval request is not_found and tells the agent to start again; it cannot be approved [P-APPR-8]
- the approval is bound to the principal and tenant: another user or tenant cannot read, approve, or resume it [P-APPR-2]
- requestApproval outside the handler, or without approvalState, is internal and reported [P-APPR-1]
- an approvalState that throws at resume runs nothing and leaves the approval standing
- approval lifecycle events name the actors and the handoff, never the input or the state [P-APPR-9]

All but the last two exercise API that did not exist at `7284f6a` (`requestApproval`, `approveHandoff`, `cancelHandoff`, `getHandoff`), so they cannot run there.

`examples/plan-review/test/server.test.ts` (Node), item 15's cases:

- the agent's request becomes a page a person approves; the resume locks the plan and returns a receipt; the history tells one story (submit, request, approval, lock; the planner cannot approve; Reopen is the undo)
- an agent's confirm or approve flag is not consent
- a change to the plan after the request voids the approval; the agent is told to ask again
- takeover: freezing cancels waiting and approved requests and pauses agents; committed work is undone only by reopening
- the person who asked, or an approver, can cancel a request; the agent is told and nothing runs
- an expired approval request is refused and the agent is told to start again

`examples/plan-review/e2e/plan-review.spec.ts` (Playwright, Chromium), item 15's cases:

- approval: the agent asks, the approver approves on the app's page, the agent resumes and gets a receipt (a planner sees "Only an approver can approve this request."; the plan page's history shows the request, the approval, and the lock)
- takeover: freezing the plan from the page cancels the agent's request and pauses it
- a cross-site request with the person's cookie is refused on the app's endpoints and on AXE

Commands and results on this branch: `pnpm gen:vocabulary -- --check` (up to date), `pnpm -r build`, `node scripts/gen-schemas.mjs --check` (22 up to date; no zod schema changed), `pnpm check:snippets` (156 up to date), `pnpm lint`, `pnpm -r typecheck`, `pnpm -r test` (all packages and the example pass), `node scripts/ci-conformance.mjs` (exit 0), `pnpm docs:api`, `pnpm example:test:app` (7 passed).

## Limitations

- The approval is as trustworthy as the site's page: the SDK records the `approver` the site names and cannot tell a person's click from a script holding the person's session.
- Decisions are a read-modify-write on the `TokenStore`, like `completeHandoff`: two simultaneous decisions on one request can both succeed (last write wins), and a cancel that lands while a resume is starting may not stop it. The resume re-reads the record after claiming the operation, which narrows the window; the operation's conditional write at the bound state is the guarantee against running on changed state. An atomic `TokenStore` compare-and-set would be a breaking interface change and was not made.
- `approvalState` is computed by the runtime just after the handler returns; a change between the handler's read (for its preview) and that call binds the newer state. The page renders the current state and a mismatch is refused at approval.
- Approval can be requested only from the handler of the call (not from `onContinue` or a surface entry's handoff); a Surface entry that needs approval would use a hand-written action for now.
- MCP hosts see an approval request as a `needs_human` handoff with a link; MCP elicitation is not used (item 14).
- The reference app's freeze, reopen, and history are the app's own code; the SDK provides the cancel and the events they are built from.
- The default stores are in memory; a restart loses open requests.

## Status

done
