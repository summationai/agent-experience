# Human oversight: approvals, receipts, and takeover

An agent can put anything in its input, including `confirm: true` or a note that says the person agreed. None of that is consent. This page covers the SDK's approval request: a consequential call is approved by a person on your site, with their own session, bound to the exact call, the person the agent acts for, the tenant, and the state it was asked about; it runs once, after the approval, while all of that still holds, and returns a receipt. It also covers cancellation, what happens when the state moves, expiry, replay, the history, and what the SDK does not do. The normative rules are [P-APPR-1] to [P-APPR-9] in the protocol, §9.3.

The [reference application](reference-app.md) uses everything on this page: an agent asks to approve and lock a demand plan, an approver approves it on the app's own page, the agent resumes and gets a receipt, and one history shows who did what.

## The flow

1. The agent calls a consequential action (send an invoice, lock a plan). The handler returns `requestApproval(...)` instead of acting.
2. The agent gets `needs_human` with a handoff whose `reason` is `approval_required` and whose `url` is your approval page. The runtime has recorded, with the resume token, the call's input as sent, the acting principal, the tenant, and the value your action's `approvalState` returns now. The agent sees none of that; it sees the link and a sentence to say to the person.
3. A person opens the page with their own session. The page reads the request with `getHandoff` and shows exactly what will run. The person approves (`approveHandoff`) or cancels (`cancelHandoff`) through your own endpoint, which your session and your cross-site request protection guard.
4. The agent calls `/axe/resume` with the token. The runtime checks that the request was approved, not cancelled, not expired, that the caller is the same principal on the same tenant, and that `approvalState` still returns the recorded value; then `onResume` runs with `approval` set and executes the recorded input.
5. `onResume` returns a receipt: what ran, what changed, for whom, who approved, and the state before and after. A repeat of the resume returns the same receipt and runs nothing.

## Declaring an action that needs approval

<!-- include: examples/human-oversight/approval.ts#action -->
```ts
axe.register(
  action("invoices.send", {
    title: "Send an invoice",
    description:
      "Sends a draft invoice to the customer. A person approves every send on the billing site first; the call returns needs_human with the approval page, and resuming after approval sends it and returns a receipt.",
    input: z.object({ invoiceId: z.string() }),
    output: z.object({
      receipt: z.object({
        invoiceId: z.string(),
        approvedBy: z.string(),
        revBefore: z.number(),
        revAfter: z.number(),
      }),
    }),
    risk: "high",
    auth: "user",
    // What the approval is bound to: any committed change to the invoice voids it.
    approvalState: ({ input }) => {
      const id = (input as { invoiceId: string }).invoiceId;
      const inv = invoices.get(id);
      return inv ? { id, rev: inv.rev, status: inv.status } : null;
    },
    handler: ({ input, fail }) => {
      const inv = invoices.get(input.invoiceId);
      if (!inv) return fail("not_found", "No invoice with that id.");
      return requestApproval({
        url: (id) => `https://billing.example/approvals/${id}`,
        instructions:
          "A person reviews the invoice on the approval page and approves or cancels sending it.",
        whatAgentShouldSayToUser:
          "Sending this invoice needs your approval. Open the link to review it, then tell me to continue.",
        preview: { invoiceId: input.invoiceId, amount: inv.amount },
      });
    },
    // Runs only for an approved request whose bound state still holds (spec §9.3).
    onResume: ({ approval, fail }) => {
      if (!approval) return fail("internal", "Resumes only an approved request.");
      const { id, rev } = approval.state as { id: string; rev: number };
      const inv = invoices.get(id);
      // The second gate: the write applies only at the revision the approval was bound to.
      if (!inv || inv.rev !== rev)
        return fail("conflict", "The invoice changed.", { retryable: false });
      inv.status = "sent";
      inv.rev += 1;
      return {
        receipt: {
          invoiceId: id,
          approvedBy: approval.approvedBy,
          revBefore: rev,
          revAfter: inv.rev,
        },
      };
    },
  }),
);
```
<!-- /include -->

- `approvalState` is required for an action whose handler returns `requestApproval`, and `action()` refuses one without `onResume`. Return the smallest value whose change should void the approval: the record's id and revision, or its status. The runtime compares canonical JSON, calls it at the request, at the approval, and at the resume, and passes it the input as sent, the tenant id, and the user.
- `requestApproval` takes the handoff's `url` (a function receives the request id, so the page can put it in its path), `instructions`, `whatAgentShouldSayToUser`, an optional `preview` for your page, and `ttlSeconds` (default one hour). It sets `requireCompletion` and the reason for you.
- An action that declares `approvalState` carries `humanHandoff: { reasons: ["approval_required"] }` in the manifest unless you set `humanHandoff` yourself, so an agent knows before calling that a person will be asked.
- Only the handler of the call can request approval. Returning it from `onContinue`, `onResume`, `onPoll`, or as a `needs_input` fallback is reported to `onError` and answered `internal`, since the runtime can only bind the input of the call it is serving.
- `onResume` receives `approval` with the approved input (parsed by the action's schema), the input as sent, the bound state, `approvedBy`, and when it was requested and approved. Execute that input. Carry the bound state into your own conditional write: the runtime's check is the first gate, and the state can still move between the check and your write.

## The approval page

Your page is the trusted interaction. The SDK cannot see a browser, a session, or a click; it records what your page tells it, after your page has decided.

<!-- include: examples/human-oversight/approval.ts#page -->
```ts
// The site's own approval endpoint, behind the site's session and its CSRF protection. The
// session tells who is deciding; the site decides whether that person may approve.
export async function decide(
  handoffId: string,
  decision: "approve" | "cancel",
  person: { id: string; mayApprove: boolean },
): Promise<{ status: number; message: string }> {
  const view = await axe.getHandoff(handoffId);
  if (!view?.approval) return { status: 404, message: "No such request." };
  if (decision === "approve") {
    if (!person.mayApprove) return { status: 403, message: "You cannot approve this." };
    const result = await axe.approveHandoff(handoffId, { approver: person.id });
    return result.ok
      ? { status: 200, message: "Approved." }
      : { status: 409, message: `Not approved: ${result.reason}` };
  }
  const result = await axe.cancelHandoff(handoffId, { by: person.id });
  return result.ok
    ? { status: 200, message: "Cancelled." }
    : { status: 409, message: result.reason };
}
```
<!-- /include -->

What the page must do:

- Authenticate the person with your own session, never with anything from the agent. Protect the decision endpoint against cross-site requests: JSON only and an `Origin` check, the way the runtime protects its own endpoints (see [Auth](auth.md#cookie-sessions)). A GET that approves is a forgery waiting to happen.
- Decide who may approve. The SDK records whoever you name as `approver`. Whether the person the agent acts for may approve their own agent's request, or only a second person may, is your policy.
- Show what will run: `getHandoff` returns the action, the input as sent, the user the agent acts for, the tenant, the bound state, your preview, the expiry, the status, and the agent's `User-Agent` self-identification. Mark the last as unverified; any client can send any name. Render the current state from your own store beside the bound state, and say when they differ: approving will then be refused.
- Pass the tenant on a multi-tenant server: `getHandoff`, `approveHandoff`, and `cancelHandoff` take `tenant`, and another tenant's request is answered exactly like an unknown one.

`approveHandoff` refuses with a reason your page can show: `not_found` (unknown, expired, or another tenant's), `not_approval`, `already_approved`, `cancelled`, `invalidated`, `used`, or `state_changed` (the state moved; the request is now invalidated for good). `completeHandoff` never approves an approval request; it returns false for one.

## What is bound, and where it is checked

| Binding | Recorded | Checked at approval | Checked at resume |
| --- | --- | --- | --- |
| Action and input fingerprint | resume token ([P-TOK-2]) | the page shows the recorded input | the token; the recorded input is what runs, never the resume body |
| Principal the agent acts for | resume token | shown | the resume must come from the same principal ([P-TOK-6]) |
| Tenant | resume token | `tenant` must match | the serving tenant must match |
| Relevant state | `approvalState` at the request | must be equal, or the request is invalidated | must be equal, or the request is invalidated |
| Approval | set by `approveHandoff` | must still be open | must be approved |
| Cancellation | set by `cancelHandoff` | refused once cancelled | refused once cancelled |
| Expiry | token, default one hour | refused after | `not_found` after |
| Single use | operation claim ([P-OP-1]) | refused once used | a repeat returns the stored envelope |

## Where a request stands

`getHandoff` reports `status`: `open`, `approved`, `cancelled`, `invalidated`, or `used` (and `completed` for a plain handoff recorded with `completeHandoff`). A resume is answered like this:

| Status | Resume result | `retryable` | `details.handoffStatus` |
| --- | --- | --- | --- |
| open | `conflict`, nothing runs | true | `open` |
| approved, state unchanged | `onResume` runs; its result | | |
| approved, state changed | `conflict`, nothing runs; the request becomes invalidated | false | `invalidated` |
| cancelled | `conflict`, nothing runs | false | `cancelled` |
| invalidated | `conflict`, nothing runs; the message says to start the action again | false | `invalidated` |
| used | the stored envelope (the receipt), nothing runs | | |
| expired | `not_found`, the unknown-token answer; the message says nothing was applied and to start again | false | |

A repeat of the original call with the same `idempotencyKey` returns the same handoff, so a lost `needs_human` response is recovered without a second request.

## Cancellation, takeover, and what cannot be taken back

- **Cancel.** `cancelHandoff` works on any handoff that has not been used, an approval request open or approved alike. Use it for the person who changes their mind, for an approver who declines, and to revoke an approval before the agent resumes.
- **Takeover.** A site can stop agents altogether. The reference app has a freeze: while frozen, its actions report unavailable with the reason ("alice froze the plan; agents cannot change it until a person unfreezes it"), and the freeze cancels every request that is still open or approved. That is the app's own control, built from `cancelHandoff` and its availability; the SDK has no global switch.
- **Committed work.** A request whose resume ran, or is running, cannot be cancelled (`used`). Its effect happened. If you offer a way back, it is your own action (the reference app's "Reopen" returns a locked plan to draft, for an approver, from the page). Declaring `reversible: true` on the action describes that; it does not implement it. Present undo only where you built it.

## Receipts and one history

A receipt is the `ok` output of the approved operation. Include the operation and the input that ran, the changes it made, the principal the agent acted for, who approved and when, and the state before and after (for a revisioned site, the revision before and after). Leave out anything sensitive: the receipt goes to the agent, and from there to wherever the agent's host logs it.

The runtime emits the request's lifecycle as action events on your `onActionEvent` sinks: `approval.requested`, `approval.approved`, `approval.cancelled`, `approval.invalidated`, and `approval.executed` (spec/EVENTS.md, "Approval events"). They carry the request id and the actors, never the input, the bound state, the preview, or a cancellation reason. Feed them into your own history beside the records your handlers write.

Your own pages' handlers are not logged by anything in the SDK. A button that changes state on your site reaches your history only if its handler writes to it. The reference app routes every change, from the page and from agents, through one set of domain functions that write the history, and adds the approval events; that is a design choice you make, not something the SDK does for you.

For a surface served through AXE, the ledger's text policy (`createSurface({ ledger: { text: "hash" } })`), `sensitive` fields, and `redactEvent` keep typed text out of the ledger and the `surface.act` events; see [Surface](surface.md#sensitive-values-and-the-ledgers-text).

## Limits

- The approval is as trustworthy as your page. The SDK records the `approver` your code names; it cannot tell a real click from a script that holds the person's session.
- Decisions are a read-modify-write on the `TokenStore`, like `completeHandoff`. Two simultaneous decisions on one request can both succeed and the last write wins; a cancel that lands while a resume is starting may not stop it. The resume reads the record again after it claims the operation, which narrows the window without closing it. The operation's own conditional write at the bound state is the guarantee against running on changed state.
- `approvalState` must be cheap and deterministic. It runs on every approval and resume.
- The agent's self-identification is whatever `User-Agent` it sent.
- The default stores are in memory: a restart loses every open request. Production needs a durable `tokenStore` and `idempotencyStore` ([Deploying](deploying.md)).
- MCP hosts see the approval as a `needs_human` handoff with a link; MCP elicitation is not used for it.

## Next steps

- [Reference application](reference-app.md): the full workflow, with sessions, two people, two tenants, and browser tests.
- [Human handoff](human-handoff.md): the handoff lifecycle an approval request is built on.
- [Live state and revisions](live-state.md): the revision an approval is usually bound to.
