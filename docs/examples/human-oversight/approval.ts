// An approval request: the agent asks, a person approves on the site's own page, the resume runs
// the approved call once and returns a receipt. The reference app (examples/plan-review) is the
// full version, with sessions, a conditional write, and a history.
import { action, createAXE, requestApproval, z } from "@summationai/axe-core";

// Stands in for the site's database: one invoice per id, with a revision column.
const invoices = new Map([["inv_1042", { rev: 3, status: "draft", amount: 12_400 }]]);

export const axe = createAXE({
  name: "Billing",
  description: "Draft and send invoices.",
  baseUrl: "https://billing.example",
  auth: {
    modes: ["user"],
    authenticate: (request) => {
      const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
      return token === "agent-token-for-dana" ? { onBehalfOf: "dana" } : null;
    },
  },
});

// #region action
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
// #endregion action

// #region page
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
// #endregion page
