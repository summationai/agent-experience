// Types and pure helpers shared by the server and the page. Nothing here touches state, so the
// browser bundle can import it.

export type PlanStatus = "draft" | "submitted" | "locked";

export interface PlanSnapshot {
  id: string;
  tenant: string;
  name: string;
  items: string[];
  months: string[];
  /** Units of demand, keyed by `cellKey(item, month)`. */
  values: Record<string, number>;
  status: PlanStatus;
  /** The revision column: moves on every committed change, whoever made it. */
  rev: number;
  frozen: { by: string; at: string } | null;
}

/** Who did something, and through which door. */
export interface Actor {
  /** The signed-in person, or the person the agent acts for. */
  user: string;
  /** `ui`: the person, through the app's own pages. `axe`: an agent, through the AXE endpoint. */
  via: "ui" | "axe";
}

/** One change a write made, for receipts and the history. */
export interface Change {
  field: string;
  from: string | number | null;
  to: string | number | null;
}

/** One line of the app's history: human and agent actions, and approval decisions. */
export interface AuditEntry {
  seq: number;
  at: string;
  tenant: string;
  /** Who acted, as the history shows it: "alice", or "agent for bob". */
  actor: string;
  via: "ui" | "axe" | "approval";
  event: string;
  summary: string;
  changes: Change[];
  revBefore: number | null;
  revAfter: number | null;
}

export function cellKey(item: string, month: string): string {
  return `${item}|${month}`;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** `2027-03` → `March 2027`. */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${MONTH_NAMES[Number(m) - 1] ?? month} ${y}`;
}

export function describeActor(actor: Actor): string {
  return actor.via === "axe" ? `agent for ${actor.user}` : actor.user;
}

export function planTotal(plan: Pick<PlanSnapshot, "values">): number {
  return Object.values(plan.values).reduce((a, b) => a + b, 0);
}
