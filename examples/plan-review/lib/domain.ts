// The application's handlers: the one implementation of every change to a plan. The app's own
// pages (lib/ui-api.ts) and the AXE actions (lib/axe.ts) both call these, so a person and an
// agent go through the same door, the same rules, and the same conditional write.
import type { Actor, Change, PlanSnapshot } from "./model";
import { cellKey, monthLabel, planTotal } from "./model";
import { Refusal, memberOf, statusLabel, store } from "./store";
import type { WriteOutcome } from "./store";

export type Operation = "edit" | "submit" | "lock" | "reopen" | "freeze";

/**
 * Why `actor` cannot do `op` on `plan` right now, in the app's own words, or null. The same
 * sentence disables the page's control, is the AXE action's availability reason, and is the
 * refusal a handler returns, so the three can never disagree.
 */
export function whyNot(plan: PlanSnapshot, op: Operation, actor: Actor): string | null {
  const member = memberOf(actor.user, plan.tenant);
  if (!member) return "You are not a member of this plan's team.";
  if (actor.via === "axe" && plan.frozen && op !== "freeze")
    return `${plan.frozen.by} froze the plan; agents cannot change it until a person unfreezes it`;
  switch (op) {
    case "edit":
      return plan.status === "draft"
        ? null
        : `The plan is ${statusLabel(plan.status).toLowerCase()}; an approver must reopen it before values can change`;
    case "submit":
      return plan.status === "draft"
        ? null
        : `The plan is already ${statusLabel(plan.status).toLowerCase()}`;
    case "lock":
      return plan.status === "submitted"
        ? null
        : plan.status === "draft"
          ? "The plan must be submitted for approval before it can be locked"
          : "The plan is already locked";
    case "reopen":
      if (actor.via !== "ui") return "Only a person can reopen a plan, from the plan page";
      if (member.role !== "approver") return "Only an approver can reopen the plan";
      return plan.status === "draft" ? "The plan is already a draft" : null;
    case "freeze":
      return actor.via === "ui" ? null : "Only a person can freeze or unfreeze the plan";
  }
}

function refuseUnless(plan: PlanSnapshot, op: Operation, actor: Actor): void {
  const reason = whyNot(plan, op, actor);
  if (reason) throw new Refusal(reason);
}

export interface CellChange {
  item: string;
  month: string;
  value: number;
}

/** Change one or more demand values. */
export function setValues(
  tenant: string,
  actor: Actor,
  expectedRev: number,
  cells: CellChange[],
  operationId?: string,
): WriteOutcome {
  return store.write(
    tenant,
    expectedRev,
    actor,
    "plan.edit",
    (plan) => {
      refuseUnless(plan, "edit", actor);
      if (cells.length === 0) throw new Refusal("No values to change.");
      const changes: Change[] = [];
      for (const c of cells) {
        if (!plan.items.includes(c.item)) throw new Refusal(`The plan has no item "${c.item}".`);
        if (!plan.months.includes(c.month))
          throw new Refusal(`The plan has no month "${c.month}".`);
        if (!Number.isInteger(c.value) || c.value < 0 || c.value > 10_000_000)
          throw new Refusal("A demand value is a whole number from 0 to 10,000,000.");
        const key = cellKey(c.item, c.month);
        const from = plan.values[key] ?? 0;
        if (from === c.value) continue;
        plan.values[key] = c.value;
        changes.push({ field: `${c.item}, ${monthLabel(c.month)}`, from, to: c.value });
      }
      if (changes.length === 0) throw new Refusal("Those values are already in the plan.");
      return {
        changes,
        summary: `Changed ${changes.length} value${changes.length === 1 ? "" : "s"}`,
      };
    },
    operationId,
  );
}

/** Submit the draft for approval. */
export function submit(
  tenant: string,
  actor: Actor,
  expectedRev: number,
  operationId?: string,
): WriteOutcome {
  return store.write(
    tenant,
    expectedRev,
    actor,
    "plan.submit",
    (plan) => {
      refuseUnless(plan, "submit", actor);
      plan.status = "submitted";
      return {
        changes: [{ field: "status", from: "draft", to: "submitted" }],
        summary: `Submitted for approval (total ${planTotal(plan).toLocaleString("en-US")} units)`,
      };
    },
    operationId,
  );
}

/**
 * Approve and lock the submitted plan. `approvedBy` is the person whose approval this is: the
 * signed-in approver on the page, or, for an agent's request, the approver recorded by the
 * approval page. It must hold the approver role in the tenant either way.
 */
export function lock(
  tenant: string,
  actor: Actor,
  expectedRev: number,
  approvedBy: string,
  operationId?: string,
): WriteOutcome {
  return store.write(
    tenant,
    expectedRev,
    actor,
    "plan.lock",
    (plan) => {
      refuseUnless(plan, "lock", actor);
      if (memberOf(approvedBy, tenant)?.role !== "approver")
        throw new Refusal(`${approvedBy} is not an approver for this plan`);
      plan.status = "locked";
      return {
        changes: [{ field: "status", from: "submitted", to: "locked" }],
        summary:
          actor.via === "ui"
            ? `Approved and locked by ${approvedBy}`
            : `Locked for ${actor.user}, approved by ${approvedBy}`,
      };
    },
    operationId,
  );
}

/** The undo of submit and lock: back to a draft. A person with the approver role only. */
export function reopen(tenant: string, actor: Actor, expectedRev: number): WriteOutcome {
  return store.write(tenant, expectedRev, actor, "plan.reopen", (plan) => {
    refuseUnless(plan, "reopen", actor);
    const from = plan.status;
    plan.status = "draft";
    return {
      changes: [{ field: "status", from, to: "draft" }],
      summary: "Reopened as a draft",
    };
  });
}

/**
 * Freeze or unfreeze the plan: while frozen, agents can change nothing and every open approval
 * request is cancelled by the caller (lib/ui-api.ts). A takeover, so it applies at the current
 * revision rather than refusing on a stale one.
 */
export function setFrozen(tenant: string, actor: Actor, frozen: boolean): WriteOutcome {
  return store.write(
    tenant,
    store.rev(tenant),
    actor,
    frozen ? "plan.freeze" : "plan.unfreeze",
    (plan) => {
      refuseUnless(plan, "freeze", actor);
      if (!!plan.frozen === frozen)
        throw new Refusal(frozen ? "The plan is already frozen" : "The plan is not frozen");
      plan.frozen = frozen ? { by: actor.user, at: new Date().toISOString() } : null;
      return {
        changes: [{ field: "frozen", from: frozen ? "no" : "yes", to: frozen ? "yes" : "no" }],
        summary: frozen ? "Froze the plan: agents paused" : "Unfroze the plan",
      };
    },
  );
}
