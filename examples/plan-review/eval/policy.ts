// The scripted agent program. One algorithm for every variant; what differs is the driver, which
// can do only what its variant exposes. The algorithm is the best a scripted client can do with
// each driver: observe, compute the change, send it, and handle what comes back. It never reads
// the application's state behind the variant's back.
import type { CellTarget, Goal, PolicyReport } from "./scenarios";
import { cellKey } from "../lib/model";

export interface Observation {
  values: Record<string, number>;
  status: string;
  /**
   * What the variant says about editing before the agent tries: null means editable or not known
   * to be blocked; a string is the reason given ("" when the control is visibly blocked but no
   * reason is shown).
   */
  editBlocked: string | null;
}

export type WriteResult =
  { kind: "ok" } | { kind: "conflict" } | { kind: "refused"; reason: string } | { kind: "lost" };

export type LockRequest =
  | { kind: "handoff"; handoffId: string; resume: () => Promise<WriteResult> }
  | { kind: "refused"; reason: string };

export interface Change {
  item: string;
  month: string;
  value: number;
}

/** Hooks the scenario uses to inject its fault and to play the person beside the agent. */
export interface Hooks {
  /** After the agent prepared its change and before it sends it. */
  beforeCommit?: (attempt: number) => Promise<void>;
  /** After each mutating step (a typed draft, or a tool call that changes state). May throw. */
  afterStep?: (step: number) => Promise<void>;
  /** The person approves a request the agent made. */
  approve: (handoffId: string) => Promise<void>;
  /** The person does the locking step on the plan page. */
  lockForAgent: () => Promise<void>;
}

export interface Driver {
  observe(cells: CellTarget[]): Promise<Observation>;
  /** Send the changes. `beforeCommit` runs after the change is prepared and before it is sent. */
  write(
    changes: Change[],
    obs: Observation,
    beforeCommit: () => Promise<void>,
    afterStep: () => Promise<void>,
  ): Promise<WriteResult>;
  /** Resend the last write exactly (same idempotency key, where the variant has one). */
  retryLast(): Promise<WriteResult | null>;
  afterConflict(): Promise<void>;
  /** Get back to a usable state after an unknown outcome or a changed page. */
  recover(): Promise<void>;
  submit(obs: Observation): Promise<WriteResult>;
  requestLock(obs: Observation): Promise<LockRequest>;
  close(): Promise<void>;
  /** Mutating requests sent so far by this driver (including retries). */
  writeAttempts: number;
}

/** The page the agent was driving is no longer the plan page. */
export class PageChanged extends Error {}
/** The scripted agent process dies here (the scenario's restart fault). */
export class Crash extends Error {}

const MAX_ATTEMPTS = 5;

function newReport(): PolicyReport {
  return {
    reported: null,
    interventions: 0,
    writeAttempts: 0,
    conflicts: 0,
    refusals: 0,
    lostResponses: 0,
    restarts: 0,
    completedBy: "nobody",
    notes: [],
  };
}

function targetsFor(goal: Goal, obs: Observation): Change[] {
  return goal.cells.map((c) => {
    const current = obs.values[cellKey(c.item, c.month)] ?? 0;
    return { item: c.item, month: c.month, value: c.value ?? current + (c.delta ?? 0) };
  });
}

/**
 * Run the goal to completion with a driver, restarting with a fresh driver after a `Crash`. A
 * restarted agent knows only the task; everything else it learns again by observing.
 */
export async function runAgent(
  goal: Goal,
  makeDriver: () => Promise<Driver>,
  hooks: Hooks,
): Promise<PolicyReport> {
  const report = newReport();
  let step = 0;
  for (let life = 0; life < 3; life++) {
    const driver = await makeDriver();
    try {
      await runOnce(
        goal,
        driver,
        hooks,
        report,
        () => hooks.afterStep?.(++step) ?? Promise.resolve(),
      );
      report.writeAttempts += driver.writeAttempts;
      await driver.close();
      return report;
    } catch (e) {
      report.writeAttempts += driver.writeAttempts;
      await driver.close().catch(() => {});
      if (!(e instanceof Crash)) throw e;
      report.restarts++;
      report.notes.push("restarted after the injected crash");
    }
  }
  report.notes.push("gave up after repeated crashes");
  return report;
}

async function runOnce(
  goal: Goal,
  driver: Driver,
  hooks: Hooks,
  report: PolicyReport,
  afterStep: () => Promise<void>,
): Promise<void> {
  let obs: Observation | null = null;
  let attempt = 0;
  let lastRefusal: string | null = null;

  // Edits: observe, compute, send; repeat until nothing is left to change.
  for (;;) {
    if (++attempt > MAX_ATTEMPTS) {
      report.reported = "gave up after repeated attempts";
      return;
    }
    try {
      obs = await driver.observe(goal.cells);
    } catch (e) {
      if (!(e instanceof PageChanged)) throw e;
      report.notes.push("the page changed; went back to the plan");
      await driver.recover();
      continue;
    }
    if (goal.cells.length === 0) break;
    const changes = targetsFor(goal, obs).filter(
      (c) => obs!.values[cellKey(c.item, c.month)] !== c.value,
    );
    if (changes.length === 0) break;
    if (obs.editBlocked !== null) {
      // Known before acting: relay the variant's reason and stop without a write.
      report.reported =
        obs.editBlocked || "The values cannot be edited right now (no reason shown).";
      return;
    }
    if (lastRefusal !== null) {
      report.reported = lastRefusal;
      return;
    }
    let r: WriteResult;
    try {
      const n = attempt;
      r = await driver.write(
        changes,
        obs,
        () => hooks.beforeCommit?.(n) ?? Promise.resolve(),
        afterStep,
      );
    } catch (e) {
      if (!(e instanceof PageChanged)) throw e;
      report.notes.push("the page changed mid-edit; went back to the plan");
      await driver.recover();
      continue;
    }
    if (r.kind === "ok") {
      // A relative change ("add 100") is done once applied; observing again would apply it again.
      if (goal.cells.some((c) => c.delta !== undefined)) break;
      continue; // re-observe to confirm, and to pick up anything left
    }
    if (r.kind === "conflict") {
      report.conflicts++;
      await driver.afterConflict();
      continue;
    }
    if (r.kind === "refused") {
      report.refusals++;
      lastRefusal = r.reason;
      continue; // re-observe: a refused retry may mean the change is already there
    }
    report.lostResponses++;
    const again = await driver.retryLast();
    if (again?.kind === "refused") {
      report.refusals++;
      lastRefusal = again.reason;
    }
    if (!again || again.kind !== "ok") await driver.recover();
  }

  if (!goal.then) {
    report.completedBy = "agent";
    return;
  }

  // Submit (and, for "lock", ask for the approval next).
  for (let i = 0; ; i++) {
    if (!obs) obs = await driver.observe(goal.cells);
    if (obs.status !== "draft") break; // already submitted (a restarted agent) or further
    if (i >= MAX_ATTEMPTS) {
      report.reported = "gave up submitting";
      return;
    }
    const r = await driver.submit(obs);
    await afterStep();
    if (r.kind === "refused") {
      report.refusals++;
      report.reported = r.reason;
      return;
    }
    if (r.kind === "conflict") report.conflicts++;
    if (r.kind === "lost") report.lostResponses++;
    obs = null;
  }
  if (goal.then === "submit") {
    report.completedBy = "agent";
    return;
  }

  obs = await driver.observe(goal.cells);
  if (obs.status === "locked") {
    report.completedBy = "agent";
    return;
  }
  const ask = await driver.requestLock(obs);
  if (ask.kind === "handoff") {
    // The variant hands the step to a person on the site and lets the agent continue after.
    report.interventions++;
    await hooks.approve(ask.handoffId);
    const done = await ask.resume();
    if (done.kind === "ok") report.completedBy = "agent";
    else report.reported = done.kind === "refused" ? done.reason : `resume: ${done.kind}`;
    return;
  }
  // No handoff: the agent relays the refusal and a person does the step on the plan page.
  report.refusals++;
  report.reported = ask.reason;
  report.interventions++;
  await hooks.lockForAgent();
  for (let i = 0; i < 20; i++) {
    obs = await driver.observe(goal.cells);
    if (obs.status === "locked") {
      report.completedBy = "human";
      return;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}
