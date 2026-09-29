// The evaluation's tasks, faults, and outcome checks (review item 17). Shared by the scripted
// harness (run.ts) and the unrun model-driven runner (model/run.ts), so a later model run is
// scored by exactly the same checks. Every check reads the application's own state and history
// through the test-only snapshot endpoint; nothing an agent says about itself is scored.
import type { AuditEntry, PlanSnapshot, PlanStatus } from "../lib/model";
import { cellKey, monthLabel } from "../lib/model";

/** One cell the task changes: to an absolute value, or by a delta from what the agent reads. */
export interface CellTarget {
  item: string;
  month: string;
  value?: number;
  delta?: number;
}

export interface Goal {
  cells: CellTarget[];
  /** A step after the edits: submit the plan, or get it approved and locked. */
  then?: "submit" | "lock";
}

export type FaultKind =
  | "none"
  | "restart"
  | "stale"
  | "concurrent"
  | "unavailable"
  | "lost-response"
  | "navigation"
  | "approval";

export interface Scenario {
  id: string;
  title: string;
  /** The task as a person would give it to an agent (the model runner's prompt). */
  task: string;
  /** What goes wrong, in words, for the report. */
  fault: string;
  kind: FaultKind;
  goal: Goal;
  /** Cells a person changes during the run (the scripted human), applied by the harness. */
  humanCells?: { item: string; month: string; value: number }[];
  /** Setup before the agent starts. */
  setup?: "human-submits";
  /** The final state the task should leave, from the seeded values. */
  expected(seed: Record<string, number>): { values: Record<string, number>; status: PlanStatus };
  /** The reason the agent must relay to its user, when the task cannot be done. */
  expectedReason?: string;
}

const SUBMITTED_REASON =
  "The plan is submitted for approval; an approver must reopen it before values can change";

function withValues(seed: Record<string, number>, cells: [string, string, number][]) {
  const values = { ...seed };
  for (const [item, month, v] of cells) values[cellKey(item, month)] = v;
  return values;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "simple-edit",
    title: "Simple edit",
    task: "Set the demand for Widgets in March 2027 to 1750 units.",
    fault: "none",
    kind: "none",
    goal: { cells: [{ item: "Widgets", month: "2027-03", value: 1750 }] },
    expected: (seed) => ({
      values: withValues(seed, [["Widgets", "2027-03", 1750]]),
      status: "draft",
    }),
  },
  {
    id: "interrupted",
    title: "Interrupted task",
    task: "Set Widgets January 2027 to 1500, Gaskets February 2027 to 1600, and Brackets March 2027 to 1700, then submit the plan for approval.",
    fault:
      "the agent process dies right after its second change (tools: the write reached the server; browser: the draft was typed but not saved); a new process starts with only the task",
    kind: "restart",
    goal: {
      cells: [
        { item: "Widgets", month: "2027-01", value: 1500 },
        { item: "Gaskets", month: "2027-02", value: 1600 },
        { item: "Brackets", month: "2027-03", value: 1700 },
      ],
      then: "submit",
    },
    expected: (seed) => ({
      values: withValues(seed, [
        ["Widgets", "2027-01", 1500],
        ["Gaskets", "2027-02", 1600],
        ["Brackets", "2027-03", 1700],
      ]),
      status: "submitted",
    }),
  },
  {
    id: "stale-observation",
    title: "Stale observation",
    task: "Add 100 units to the demand for Gaskets in March 2027.",
    fault:
      "a person sets that same cell to 1500 after the agent read it and before its change is sent",
    kind: "stale",
    goal: { cells: [{ item: "Gaskets", month: "2027-03", delta: 100 }] },
    humanCells: [{ item: "Gaskets", month: "2027-03", value: 1500 }],
    expected: (seed) => ({
      values: withValues(seed, [["Gaskets", "2027-03", 1600]]),
      status: "draft",
    }),
  },
  {
    id: "two-actors",
    title: "Two actors",
    task: "Set the demand for Widgets in April 2027 to 2000 units.",
    fault:
      "a person saves a different cell (Brackets, May 2027 = 777) just before the agent's change",
    kind: "concurrent",
    goal: { cells: [{ item: "Widgets", month: "2027-04", value: 2000 }] },
    humanCells: [{ item: "Brackets", month: "2027-05", value: 777 }],
    expected: (seed) => ({
      values: withValues(seed, [
        ["Widgets", "2027-04", 2000],
        ["Brackets", "2027-05", 777],
      ]),
      status: "draft",
    }),
  },
  {
    id: "unavailable",
    title: "Unavailable control, with reason",
    task: "Set the demand for Widgets in January 2027 to 1300 units. If it cannot be done, tell me why.",
    fault:
      "a person submitted the plan before the agent started, so values cannot change (the app locks whole plans, not months)",
    kind: "unavailable",
    setup: "human-submits",
    goal: { cells: [{ item: "Widgets", month: "2027-01", value: 1300 }] },
    expected: (seed) => ({ values: { ...seed }, status: "submitted" }),
    expectedReason: SUBMITTED_REASON,
  },
  {
    id: "lost-response",
    title: "Lost response, retried",
    task: "Set the demand for Brackets in June 2027 to 2500 units.",
    fault:
      "the first write reaches the server and is applied, but its response never arrives; the agent retries",
    kind: "lost-response",
    goal: { cells: [{ item: "Brackets", month: "2027-06", value: 2500 }] },
    expected: (seed) => ({
      values: withValues(seed, [["Brackets", "2027-06", 2500]]),
      status: "draft",
    }),
  },
  {
    id: "navigation",
    title: "Navigation mid-task",
    task: "Set Widgets February 2027 to 1111 and Gaskets June 2027 to 2222.",
    fault:
      "after the agent's first change, its tab navigates to the history page (browser variants only; server tools have no page)",
    kind: "navigation",
    goal: {
      cells: [
        { item: "Widgets", month: "2027-02", value: 1111 },
        { item: "Gaskets", month: "2027-06", value: 2222 },
      ],
    },
    expected: (seed) => ({
      values: withValues(seed, [
        ["Widgets", "2027-02", 1111],
        ["Gaskets", "2027-06", 2222],
      ]),
      status: "draft",
    }),
  },
  {
    id: "handoff",
    title: "Human handoff (approval)",
    task: "Submit the plan for approval and get it approved and locked.",
    fault:
      "locking needs an approver; the agent acts for bob, a planner, and alice (an approver) must act",
    kind: "approval",
    goal: { cells: [], then: "lock" },
    expected: (seed) => ({ values: { ...seed }, status: "locked" }),
  },
];

/** What the harness reads to score a run: the plan and its whole history. */
export interface Snapshot {
  plan: PlanSnapshot;
  history: AuditEntry[];
}

/** What the agent program reports at the end of a run (used only for the reason check). */
export interface PolicyReport {
  /** The reason the agent relayed to its user, if it stopped without doing the task. */
  reported: string | null;
  /** Human steps the agent needed (an approval, a person doing the step for it). */
  interventions: number;
  /** Mutating requests sent (including retries, refused and conflicting ones). */
  writeAttempts: number;
  conflicts: number;
  refusals: number;
  lostResponses: number;
  restarts: number;
  /** Who completed the final step: the agent, a person, or nobody. */
  completedBy: "agent" | "human" | "nobody";
  notes: string[];
}

export interface Outcome {
  success: boolean;
  /** Agent writes that should not have happened, or wrote a value the task did not ask for. */
  incorrectMutations: number;
  /** Cells or status that differ from the expected final state. */
  mismatches: string[];
  reasonOk: boolean | null;
}

/** Agents in this app write as "bob" through the page (v1, v2) or "agent for bob" (v3, v4). */
const AGENT_ACTORS = new Set(["bob", "agent for bob"]);

export function checkOutcome(
  scenario: Scenario,
  seed: Record<string, number>,
  snap: Snapshot,
  report: Pick<PolicyReport, "reported">,
): Outcome {
  const exp = scenario.expected(seed);
  const mismatches: string[] = [];
  for (const [key, v] of Object.entries(exp.values))
    if (snap.plan.values[key] !== v)
      mismatches.push(`${key}: expected ${v}, found ${snap.plan.values[key]}`);
  if (snap.plan.status !== exp.status)
    mismatches.push(`status: expected ${exp.status}, found ${snap.plan.status}`);
  // Field names in the history are "Item, Month Year".
  const byField = new Map<string, number>();
  for (const key of Object.keys(exp.values)) {
    const [item, month] = key.split("|") as [string, string];
    byField.set(`${item}, ${monthLabel(month)}`, exp.values[key]!);
  }
  // Status changes the task asks the agent for: submitting, and the lock after an approval.
  const allowedStatus: string[] =
    scenario.goal.then === "lock"
      ? ["submitted", "locked"]
      : scenario.goal.then === "submit"
        ? ["submitted"]
        : [];
  let incorrect = 0;
  for (const e of snap.history) {
    if (!AGENT_ACTORS.has(e.actor)) continue;
    for (const c of e.changes) {
      if (c.field === "status") {
        if (typeof c.to !== "string" || !allowedStatus.includes(c.to)) incorrect++;
      } else if (byField.has(c.field)) {
        if (c.to !== byField.get(c.field)) incorrect++;
      } else incorrect++;
    }
  }
  const reasonOk =
    scenario.expectedReason === undefined ? null : report.reported === scenario.expectedReason;
  return {
    success: mismatches.length === 0 && incorrect === 0 && reasonOk !== false,
    incorrectMutations: incorrect,
    mismatches,
    reasonOk,
  };
}

/** The scenarios whose fault the task is expected to recover from. */
export function hasRecoverableFault(kind: FaultKind): boolean {
  return (
    kind === "restart" ||
    kind === "stale" ||
    kind === "concurrent" ||
    kind === "lost-response" ||
    kind === "navigation"
  );
}
