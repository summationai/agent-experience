# Reference application: Plan Review

`examples/plan-review` is a runnable Next.js (App Router) application in which people and agents work on the same demand plan. Each team (tenant) has one plan: demand per item and month, a status (draft, submitted, locked), and a revision column. People edit and submit it on the plan page; agents do the same through AXE. Locking the plan is consequential: an agent can only ask, an approver approves on the app's own page, and the agent's resume then locks it and returns a receipt. The page's own controls are also published to agents that run in the page, and nowhere else.

It exists to show two things the SDK leaves to the application and that are easy to get wrong: which capabilities run on the server and which in the browser, and how a person's approval is established and bound. This page covers what it demonstrates, how to run it and each test suite, who owns each capability, a code tour, and what it deliberately does not do.

## What it demonstrates

- **Two execution modes, explicitly.** The domain actions (read, edit a value, submit, ask for approval and lock, read the history) are AXE actions defined on the server in `lib/axe.ts`. The page's controls (the unsaved draft of each cell, Save, Scroll to a month, Open the approval requests) are registered with `useSurfaceProps` on a surface that belongs to the page instance, `lib/browser-surface.ts`, and are published only at `window.__surface`. Neither mode reaches the other's registry (spec/SURFACE.md §8).
- **Authoritative server state.** One in-memory store per process (`lib/store.ts`) with a revision per plan and a conditional write: a change applies only when the revision equals the one the writer read. The page's buttons and the agents' actions call the same domain functions (`lib/domain.ts`), so they share rules, reasons, and the write.
- **Sessions and the request policy.** Two demo people and two teams. Sign-in sets an `HttpOnly`, `SameSite=Lax` session cookie. The app's own endpoints and the AXE endpoints refuse cross-site and non-JSON writes; `trustedOrigins` lists the second spelling of the local origin.
- **Human oversight.** `plan.approve` returns `requestApproval`; the approval page shows the exact call, the plan revision it is bound to next to the plan now, and who asked; an approver approves or cancels with their own session; any change to the plan voids the request; a freeze cancels every open request and pauses agents; a lock that ran is undone only by the app's own Reopen. See [Human oversight](human-oversight.md).
- **One history.** Every change from the page and from agents is written by the domain functions, and the approval lifecycle arrives through the runtime's approval events; the plan page and `plan.history` show both.

## Run it

```sh
pnpm install
pnpm -r build                 # the SDK packages the app imports
pnpm example:dev              # next dev on http://localhost:3000
```

Open http://localhost:3000 and sign in. The plan page shows your agent token for that team and the command to connect an MCP client:

```sh
node packages/cli/dist/index.js mcp http://localhost:3000 --auth demo-agent-bob-acme
```

The people and their roles:

| Person | Acme Manufacturing (`acme`) | Globex Foods (`globex`) |
| --- | --- | --- |
| alice | approver | planner |
| bob | planner | approver |

Agent tokens are `demo-agent-<person>-<team>`, for example `demo-agent-bob-acme`: an agent acting for that person on that team. They are fixed values for a laptop.

Set `PLAN_REVIEW_BASE_URL` when serving on another origin (default `http://localhost:3000`), `PLAN_REVIEW_TRUSTED_ORIGINS` for extra origins (default: the `127.0.0.1` spelling of a localhost base), and `AXE_SECRET` for anything that is not a demo.

### A five-minute demo

1. Sign in as bob on Acme in one browser window and as alice on Acme in another. Change a value in both windows in the same cell; save in alice's window, then in bob's. Bob's save is refused because his draft was typed at an older revision; his value stays in the cell, and "Keep my drafts on the current plan" lets him save it deliberately.
2. Connect an agent with bob's token and ask it to read the plan and raise Widgets for March. Meanwhile, change any value in alice's window. The agent's write, made with the revision it read, is refused with `conflict`; it reads again and succeeds. Both changes appear in the history with who made them.
3. Ask the agent to submit the plan and have it approved and locked. It gets `needs_human` with a link to `/approvals/<id>`. Open the link as bob: he is a planner, so the page says only an approver can approve. Open it as alice: it shows the operation, its input, the revision it is bound to, the plan now, and that an agent acting for bob asked.
4. Approve as alice, then tell the agent to continue. It resumes, the plan locks, and the agent reports a receipt: approved by alice, for bob, revision before and after, status submitted to locked. Ask it to continue again: it gets the same receipt, and nothing runs twice.
5. Reopen the plan as alice, have the agent submit and ask again, and press Freeze before approving. The request is cancelled, the agent's resume is refused with `handoffStatus: "cancelled"`, and its tools report "alice froze the plan". Unfreeze to let it continue.

Open the browser console on the plan page and try `await window.__surface.observe()`: the rows are the page's controls, at the plan's revision. Navigate to History and observe again: the table is empty, and the plan's revision has not moved.

## Who owns each capability

| Capability | Where it runs | Registered by | Reachable by | Scoped to | Lifetime |
| --- | --- | --- | --- | --- | --- |
| Read the plan, read the history | server | `action()` in `lib/axe.ts` | agents over AXE (HTTP, MCP) | the caller's user and tenant | the server process |
| Change a value, submit | server | `action()`, calling `lib/domain.ts` | agents over AXE; the page through its own endpoints (`lib/ui-api.ts`) | user and tenant; the conditional write at the presented revision | the server process |
| Ask for approval and lock | server | `action()` with `approvalState` and `onResume` | agents over AXE; the request is decided on the app's approval page | user and tenant; the approval bound to input, principal, tenant, revision | the request: one hour, one use |
| Approve or cancel a request, freeze, reopen, approve and lock directly | server | the app's own endpoints | a person, with the session cookie, from the app's origin | the person's role in the tenant | the server process |
| Draft a cell (unsaved) | browser | `useSurfaceProps` in `app/plan/PlanBoard.tsx` | code in the page: `window.__surface` | this tab and page instance | while the plan page is mounted |
| Save the drafts | browser, then the app's endpoint | `useSurfaceProps` | code in the page | this tab; the save carries this person's session and the revision the drafts were typed at | while mounted |
| Scroll to a month, open the approval requests | browser | `useSurfaceProps` | code in the page | this tab | while mounted |

Nothing in the second half of the table is an AXE action or reachable over HTTP. Nothing in the first half depends on a page being open.

## Code tour

The conditional write every change goes through (`lib/store.ts`):

<!-- include: ../examples/plan-review/lib/store.ts#write -->
```ts
write(
  tenant: string,
  expectedRev: number,
  actor: Actor,
  event: string,
  mutate: (plan: PlanSnapshot) => { changes: Change[]; summary: string },
  operationId?: string,
): WriteOutcome {
  if (operationId) {
    const prior = this.applied.get(operationId);
    if (prior) return prior;
  }
  const current = this.plans.get(tenant);
  if (!current) return { ok: false, kind: "refused", reason: "No such plan.", currentRev: 0 };
  if (current.rev !== expectedRev)
    return { ok: false, kind: "conflict", currentRev: current.rev };
  const next = structuredClone(current);
  let result: { changes: Change[]; summary: string };
  try {
    result = mutate(next);
  } catch (e) {
    if (e instanceof Refusal)
      return { ok: false, kind: "refused", reason: e.message, currentRev: current.rev };
    throw e;
  }
  const revBefore = current.rev;
  next.rev = revBefore + 1;
  this.plans.set(tenant, next);
  this.record({
    tenant,
    actor: describeActor(actor),
    via: actor.via,
    event,
    summary: result.summary,
    changes: result.changes,
    revBefore,
    revAfter: next.rev,
  });
  const outcome: WriteOutcome = {
    ok: true,
    plan: structuredClone(next),
    changes: result.changes,
    revBefore,
    revAfter: next.rev,
  };
  if (operationId) this.applied.set(operationId, outcome);
  return outcome;
}
```
<!-- /include -->

The consequential action (`lib/axe.ts`). The handler asks; `onResume` runs only for an approved request whose bound revision still holds, carries that revision into the write, and returns the receipt:

<!-- include: ../examples/plan-review/lib/axe.ts#approve -->
```ts
axe.register(
  action("plan.approve", {
    title: "Ask for the plan to be approved and locked",
    description:
      "Asks an approver to approve and lock the submitted plan. A person approves every lock on the plan's approval page; the call returns needs_human with that page, and resuming after the approval locks the plan and returns a receipt. An approver can reopen a locked plan from the plan page.",
    input: z.object({ planId: z.string() }),
    output: z.object({ receipt: receiptSchema }),
    risk: "high",
    auth: "user",
    reversible: true,
    availability: availabilityFor("lock"),
    // The approval is bound to these: any committed change to the plan voids it.
    approvalState: ({ tenant }) => {
      const plan = store.plan(tenant ?? "")!;
      return { planId: plan.id, rev: plan.rev, status: plan.status };
    },
    handler: (ctx) => {
      const rev = requireRev(ctx);
      if (typeof rev !== "number") return rev;
      const plan = store.plan(tenantOf(ctx))!;
      if (ctx.input.planId !== plan.id)
        return ctx.fail("not_found", "This team has no plan with that id.");
      if (ctx.availability && !ctx.availability.available) return unavailable(ctx.availability);
      const who = ctx.identity!.onBehalfOf;
      return requestApproval({
        url: (id) => `${BASE_URL}/approvals/${encodeURIComponent(id)}`,
        instructions: `An approver opens the approval page, checks the plan at revision ${plan.rev}, and approves or cancels the lock.`,
        whatAgentShouldSayToUser: `Locking "${plan.name}" needs an approver's approval. Open the link to review and approve it, then tell me to continue.`,
        preview: {
          plan: plan.name,
          rev: plan.rev,
          change: "status: submitted → locked",
          total: planTotal(plan),
          months: plan.months.map(monthLabel),
          requestedFor: who,
        },
      });
    },
    onResume: (ctx) => {
      const grant = ctx.approval;
      if (!grant) return ctx.fail("internal", "This action resumes only an approved request.");
      const tenant = tenantOf(ctx);
      const actor = actorOf(ctx.identity);
      const boundRev = (grant.state as { rev: number }).rev;
      // Second gate: the conditional write at the revision the approval was bound to.
      const out = lock(tenant, actor, boundRev, grant.approvedBy, ctx.operationId);
      if (!out.ok) return refusal(out, boundRev, ctx);
      const receipt: Receipt = {
        operation: "plan.approve",
        planId: out.plan.id,
        requestedFor: actor.user,
        actor: describeActor(actor),
        approvedBy: grant.approvedBy,
        requestedAt: grant.requestedAt,
        approvedAt: grant.approvedAt,
        executedAt: new Date().toISOString(),
        revBefore: out.revBefore,
        revAfter: out.revAfter,
        changes: out.changes,
      };
      return { receipt };
    },
  }),
);
```
<!-- /include -->

The approval page's decision endpoint (`lib/ui-api.ts`). The session says who is deciding; the app decides who may; the runtime checks the bindings:

<!-- include: ../examples/plan-review/lib/ui-api.ts#decide -->
```ts
const m = /^\/approvals\/([^/]+)$/.exec(path);
if (m) {
  const id = decodeURIComponent(m[1]!);
  const axe = getAXE();
  const view = await axe.getHandoff(id, { tenant });
  if (!view?.approval) return json({ error: "No such approval request." }, 404);
  const decision = b["decision"];
  const isApprover = memberOf(session.user, tenant)?.role === "approver";
  if (decision === "approve") {
    if (!isApprover) return json({ error: "Only an approver can approve this request." }, 403);
    const d = await axe.approveHandoff(id, { approver: session.user, tenant });
    return d.ok
      ? json({ ok: true, view: d.view })
      : json({ error: refusalText(d.reason), reason: d.reason }, 409);
  }
  if (decision === "cancel") {
    if (!isApprover && view.onBehalfOf !== session.user)
      return json(
        { error: "Only an approver or the person who asked can cancel this request." },
        403,
      );
    const reason = typeof b["reason"] === "string" ? b["reason"].slice(0, 200) : undefined;
    const d = await axe.cancelHandoff(id, {
      by: session.user,
      tenant,
      ...(reason ? { reason } : {}),
    });
    return d.ok
      ? json({ ok: true, view: d.view })
      : json({ error: refusalText(d.reason), reason: d.reason }, 409);
  }
  return json({ error: "decision must be approve or cancel." }, 400);
}
```
<!-- /include -->

A browser-local control (`app/plan/PlanBoard.tsx`). The field's setter changes only this tab's draft; saving is a separate control that posts to the app with the person's session:

<!-- include: ../examples/plan-review/app/plan/PlanBoard.tsx#cell -->
```ts
function Cell(props: {
  planId: string;
  item: string;
  month: string;
  saved: number;
  draft: string | undefined;
  readOnlyReason: string | null;
  semantic: boolean;
  onDraft: (text: string) => void;
}) {
  const { planId, item, month, saved, draft, readOnlyReason, semantic, onDraft } = props;
  const value = draft ?? String(saved);
  const surfaceProps = useSurfaceProps(
    {
      id: `draft:${item}:${month}`,
      kind: "field",
      role: "textbox",
      name: `${item}, ${monthLabel(month)}`,
      object: `plan:${planId}`,
      value,
      // Typing here changes only this tab's unsaved draft; "Save" sends it to the server.
      edit: readOnlyReason
        ? { readOnly: true, reason: readOnlyReason }
        : {
            maxLength: 8,
            schema: { type: "string", pattern: "^[0-9]{1,8}$" },
            set: (text: string) => onDraft(text),
          },
    },
    [value, readOnlyReason],
    pageSurface,
  );
  return (
    <td className={draft !== undefined ? "dirty" : undefined}>
      <input
        {...(semantic ? surfaceProps : {})}
        inputMode="numeric"
        value={value}
        readOnly={!!readOnlyReason}
        onChange={(e) => onDraft(e.target.value.replace(/[^0-9]/g, "").slice(0, 8))}
      />
    </td>
  );
}
```
<!-- /include -->

## Tests

Two suites. The Node suite is part of `pnpm -r test`; the browser suite needs a production build and Chromium, so it has its own script.

```sh
pnpm example:test          # or: pnpm --filter plan-review-example test   (vitest, no server, no browser)
pnpm example:test:app      # or: pnpm --filter plan-review-example test:app   (next build, then Playwright against next start)
```

The browser suite uses the Chromium that `@playwright/test` 1.63 installs (`pnpm --filter plan-review-example exec playwright install chromium` on a new machine). It starts `next start` on port 3107 with a test-only reset endpoint enabled (`PLAN_REVIEW_TEST_RESET=1`), which the development server never has.

`test/server.test.ts` (Node, in process, deterministic):

- login: a session cookie per user and tenant; forged sign-in, cross-site writes with the cookie, and non-JSON writes are refused on the app's endpoints and on AXE; the trusted origin works
- tenant scope: the same person on another team is another scope, for plans, tokens, and approvals
- two users editing the same plan: one conflict, one success, nothing lost silently (including two tabs saving at once)
- a person's change between the agent's observe and act is refused; the agent re-reads and continues; availability explains why a submitted plan cannot be edited
- a lost response is recovered by retrying with the same idempotency key; the edit applies once
- approval: request, the page's view, a planner refused, the approver approves, the resume returns the receipt, a repeat replays it, and the history reads submit, request, approval, lock
- an agent's confirm or approve flag is not consent
- a change to the plan after the request voids the approval, before and after it was approved
- takeover: freezing cancels waiting and approved requests and pauses agents; committed work is undone only by reopening
- the person who asked, or an approver, can cancel a request; the reason stays out of the history
- an expired approval request is refused and the agent is told to start again
- reconnect: a new AXE client re-discovers the site and continues the approved request; an MCP client on a new connection resumes with `axe_resume`
- browser-local capabilities are never served over HTTP

`e2e/plan-review.spec.ts` (Playwright, Chromium, real pages):

- an agent in the page drafts a value through `window.__surface` and saves it through the page's own Save; the manifest lists only the server actions
- two people in two tabs edit the same cell: one save succeeds, the other is refused and keeps its draft, then saves deliberately
- a person changes the plan between an HTTP agent's observe and act: the agent is refused, re-reads, and continues; the page shows its change
- navigation: the page's controls leave the surface on a route change and come back; the server's revision is untouched
- approval: the agent asks, a planner cannot approve, the approver approves on the page, the agent resumes and gets a receipt, and the plan page's history shows all four steps
- takeover: Freeze on the page cancels the agent's request and pauses it
- a cross-site request with the person's cookie is refused on the app's endpoints and on AXE

## Supported behavior and deliberate limits

- **No browser-session broker.** The SDK does not carry a page's controls, session, or state to a server, another tab, or another device, and this app does not build one. An agent outside the browser uses the server actions; an agent inside the page uses `window.__surface`. The in-page Save works because it runs in the page with the person's cookie, exactly like the button.
- **One process, in memory.** Plans, sessions, the history, AXE tokens, and idempotency records live in the server's memory. A restart resets the demo and loses open approval requests. Two server instances would not share them; production needs a database with the same conditional write and durable AXE stores ([Deploying](deploying.md)).
- **Demo credentials.** Sign-in has no password, and agent tokens are fixed strings. The session is still a real `HttpOnly` cookie under the request policy.
- **Polling, not push.** The page polls every 1.5 seconds. A change made by an agent shows up on the next poll.
- **Drafts are per tab.** An unsaved draft lives in that tab's memory. Closing the tab loses it, and another tab never sees it.
- **What an agent cannot do here.** Approve, cancel, freeze, unfreeze, reopen, or lock directly. Those are the person's, on the app's pages. The reasons an agent reads for them are the same sentences the page uses to disable its buttons.
- **Undo.** Only Reopen, for an approver, from the page. `plan.approve` declares `reversible: true` because that action exists; nothing is undone automatically.
- **Receipts and the history carry no secrets.** No session id, token, or cancellation reason is written to either. The page surface keeps typed text in its ledger as a hash.

## Next steps

- [Human oversight](human-oversight.md): the approval primitive this app uses.
- [Surface](surface.md): the page surface, `useSurfaceProps`, and serving a surface from a server.
- [Next.js](integrations/next.md): `axeNext` for the App Router.
