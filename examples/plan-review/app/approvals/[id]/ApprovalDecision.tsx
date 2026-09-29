"use client";
import { useState } from "react";

export function ApprovalDecision(props: {
  id: string;
  status: string;
  canApprove: boolean;
  canCancel: boolean;
}) {
  const { id, status, canApprove, canCancel } = props;
  const [message, setMessage] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  async function decide(decision: "approve" | "cancel") {
    const res = await fetch(`/api/approvals/${encodeURIComponent(id)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    const body = (await res.json()) as { error?: string };
    if (res.ok) {
      setDone(true);
      setMessage(
        decision === "approve"
          ? "Approved. The agent can now continue."
          : "Cancelled. The agent will be told.",
      );
    } else {
      setMessage(body.error ?? "That did not work.");
    }
  }
  const openable = status === "open" || status === "approved";
  return (
    <div className="row">
      {status === "open" && canApprove && !done ? (
        <button onClick={() => decide("approve")}>Approve this request</button>
      ) : null}
      {openable && canCancel && !done ? (
        <button onClick={() => decide("cancel")}>Cancel this request</button>
      ) : null}
      {status === "open" && !canApprove ? <p>Only an approver can approve this request.</p> : null}
      {message ? (
        <p role="status" data-testid="decision-message">
          {message}
        </p>
      ) : null}
    </div>
  );
}
