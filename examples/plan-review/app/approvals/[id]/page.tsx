// The app's own approval page: where an agent's request to lock the plan is approved or
// cancelled by a person with their own session. It shows exactly what will run (the action and
// its input), the plan revision the request is bound to next to the plan as it is now, who the
// agent acts for, and how the agent identified itself (not authenticated).
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAXE } from "../../../lib/axe";
import { memberOf, store } from "../../../lib/store";
import { currentSession } from "../../session";
import { ApprovalDecision } from "./ApprovalDecision";

export const dynamic = "force-dynamic";

export default async function ApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await currentSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/approvals/${id}`)}`);
  const view = await getAXE().getHandoff(id, { tenant: session.tenant });
  if (!view?.approval) {
    return (
      <main className="narrow">
        <h1>Approval request not found</h1>
        <p data-testid="approval-status">
          This request does not exist for your team, or it has expired. The agent has to ask again.
        </p>
        <Link href="/plan">Back to the plan</Link>
      </main>
    );
  }
  const a = view.approval;
  const bound = a.state as { planId: string; rev: number; status: string };
  const plan = store.plan(session.tenant)!;
  const moved = plan.rev !== bound.rev;
  const isApprover = memberOf(session.user, session.tenant)?.role === "approver";
  const canCancel = isApprover || view.onBehalfOf === session.user;
  return (
    <main className="narrow">
      <nav>
        <Link href="/plan">Back to the plan</Link>
      </nav>
      <h1>Approve and lock {plan.name}?</h1>
      <p data-testid="approval-status">Status: {view.status}</p>
      <dl className="facts">
        <dt>Asked by</dt>
        <dd data-testid="asked-by">
          An agent acting for <strong>{view.onBehalfOf}</strong>
          {a.agent
            ? ` (it identifies itself as ${a.agent.name}/${a.agent.version}; not verified)`
            : ""}
        </dd>
        <dt>Operation</dt>
        <dd>
          <code>{view.action}</code> with input{" "}
          <code data-testid="approval-input">{JSON.stringify(a.input)}</code>
        </dd>
        <dt>What changes</dt>
        <dd>
          Plan status: submitted → locked. Values can no longer change until an approver reopens the
          plan.
        </dd>
        <dt>Bound to</dt>
        <dd data-testid="bound-rev">
          Plan revision {bound.rev} (status {bound.status})
        </dd>
        <dt>The plan now</dt>
        <dd data-testid="current-rev">
          Revision {plan.rev} (status {plan.status})
          {moved ? ": the plan changed since the agent asked, so approving will be refused" : ""}
        </dd>
        <dt>Requested</dt>
        <dd>{new Date(a.requestedAt).toLocaleString()}</dd>
        <dt>Expires</dt>
        <dd>{new Date(view.expiresAt).toLocaleString()}</dd>
        {a.approved ? (
          <>
            <dt>Approved by</dt>
            <dd>
              {a.approved.by} at {new Date(a.approved.at).toLocaleString()}
            </dd>
          </>
        ) : null}
        {view.cancelled ? (
          <>
            <dt>Cancelled by</dt>
            <dd>{view.cancelled.by ?? "someone"}</dd>
          </>
        ) : null}
      </dl>
      <ApprovalDecision
        id={view.id}
        status={view.status}
        canApprove={isApprover}
        canCancel={canCancel}
      />
      <p className="muted">
        Approving here lets the agent carry out this one request, once, while the plan stays at
        revision {bound.rev}. Any change to the plan, a cancel, or a freeze voids it. The agent
        cannot approve its own request.
      </p>
    </main>
  );
}
