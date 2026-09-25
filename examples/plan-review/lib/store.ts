// Authoritative server state for the reference app: tenants, members, sessions, one demand plan
// per tenant with a revision column, and the app's own history. In memory, one process.
//
// Every write goes through `write()`, a conditional write: it applies only when the plan's
// revision equals the revision the writer read (the in-memory form of
// `UPDATE plans SET ..., rev = rev + 1 WHERE id = $1 AND rev = $expected`). The check and the
// write run with no `await` between them, so two requests cannot both pass it.
import type { Actor, AuditEntry, Change, PlanSnapshot, PlanStatus } from "./model";
import { cellKey, describeActor } from "./model";

export type Role = "planner" | "approver";

export interface Member {
  user: string;
  tenant: string;
  role: Role;
}

export interface Session {
  id: string;
  user: string;
  tenant: string;
  createdAt: number;
}

/** The two demo tenants and who belongs to each. Every user has a role per tenant. */
export const TENANTS: Record<string, { name: string }> = {
  acme: { name: "Acme Manufacturing" },
  globex: { name: "Globex Foods" },
};

export const MEMBERS: Member[] = [
  { user: "alice", tenant: "acme", role: "approver" },
  { user: "bob", tenant: "acme", role: "planner" },
  { user: "alice", tenant: "globex", role: "planner" },
  { user: "bob", tenant: "globex", role: "approver" },
];

/**
 * Agent credentials: one bearer token per person and tenant, as a site would issue from a
 * settings page. Fixed values for a local demo only.
 */
export const AGENT_TOKENS: Record<string, { user: string; tenant: string }> = {
  "demo-agent-alice-acme": { user: "alice", tenant: "acme" },
  "demo-agent-bob-acme": { user: "bob", tenant: "acme" },
  "demo-agent-alice-globex": { user: "alice", tenant: "globex" },
  "demo-agent-bob-globex": { user: "bob", tenant: "globex" },
};

export function agentTokenFor(user: string, tenant: string): string {
  return `demo-agent-${user}-${tenant}`;
}

export function memberOf(user: string, tenant: string): Member | undefined {
  return MEMBERS.find((m) => m.user === user && m.tenant === tenant);
}

const ITEMS = ["Widgets", "Gaskets", "Brackets"];
const MONTHS = ["2027-01", "2027-02", "2027-03", "2027-04", "2027-05", "2027-06"];

function seedPlan(tenant: string, base: number): PlanSnapshot {
  const values: Record<string, number> = {};
  ITEMS.forEach((item, i) =>
    MONTHS.forEach((month, j) => {
      values[cellKey(item, month)] = base + i * 100 + j * 10;
    }),
  );
  return {
    id: `${tenant}-fy27-h1`,
    tenant,
    name: "FY27 H1 demand",
    items: [...ITEMS],
    months: [...MONTHS],
    values,
    status: "draft",
    rev: 1,
    frozen: null,
  };
}

export type WriteOutcome =
  | { ok: true; plan: PlanSnapshot; changes: Change[]; revBefore: number; revAfter: number }
  | { ok: false; kind: "conflict"; currentRev: number }
  | { ok: false; kind: "refused"; reason: string; currentRev: number };

/** Thrown by a mutation to refuse without writing; `write` turns it into `refused`. */
export class Refusal extends Error {}

export class Store {
  private plans = new Map<string, PlanSnapshot>();
  private history = new Map<string, AuditEntry[]>();
  private sessions = new Map<string, Session>();
  /** Operation ids already applied, with the outcome: a retried operation is not applied twice. */
  private applied = new Map<string, WriteOutcome>();
  /** The app's index of approval requests per tenant (handoff ids), fed by approval events. */
  private approvalIds = new Map<string, string[]>();
  private seq = 0;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.plans.clear();
    this.history.clear();
    this.sessions.clear();
    this.applied.clear();
    this.approvalIds.clear();
    this.seq = 0;
    this.plans.set("acme", seedPlan("acme", 1200));
    this.plans.set("globex", seedPlan("globex", 800));
  }

  plan(tenant: string): PlanSnapshot | undefined {
    const p = this.plans.get(tenant);
    return p ? structuredClone(p) : undefined;
  }

  rev(tenant: string): number {
    return this.plans.get(tenant)?.rev ?? 0;
  }

  /**
   * The conditional write. `mutate` receives a copy of the plan, changes it, and returns what it
   * changed; it throws `Refusal` to refuse. Nothing is stored unless the revision still equals
   * `expectedRev` and `mutate` returns. With `operationId`, a second write with the same id
   * returns the first outcome instead of applying again (a retried operation after a crash).
   */
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

  /** Append one line to the tenant's history. */
  record(entry: Omit<AuditEntry, "seq" | "at">): AuditEntry {
    const full: AuditEntry = { seq: ++this.seq, at: new Date().toISOString(), ...entry };
    const list = this.history.get(entry.tenant) ?? [];
    list.push(full);
    this.history.set(entry.tenant, list);
    return full;
  }

  audit(tenant: string): AuditEntry[] {
    return [...(this.history.get(tenant) ?? [])];
  }

  noteApprovalRequest(tenant: string, handoffId: string): void {
    const list = this.approvalIds.get(tenant) ?? [];
    if (!list.includes(handoffId)) list.push(handoffId);
    this.approvalIds.set(tenant, list);
  }

  approvalRequests(tenant: string): string[] {
    return [...(this.approvalIds.get(tenant) ?? [])];
  }

  createSession(user: string, tenant: string): Session {
    const id = crypto.randomUUID();
    const s: Session = { id, user, tenant, createdAt: Date.now() };
    this.sessions.set(id, s);
    return s;
  }

  session(id: string | undefined | null): Session | undefined {
    return id ? this.sessions.get(id) : undefined;
  }

  endSession(id: string): void {
    this.sessions.delete(id);
  }
}

export function statusLabel(status: PlanStatus): string {
  return status === "draft"
    ? "Draft"
    : status === "submitted"
      ? "Submitted for approval"
      : "Locked";
}

// One store per server process. Next can evaluate a module once per bundle layer (route handlers
// and server components), so the instance lives on globalThis rather than in module scope.
const KEY = Symbol.for("plan-review.store");
export const store: Store =
  ((globalThis as Record<symbol, unknown>)[KEY] as Store | undefined) ??
  (((globalThis as Record<symbol, unknown>)[KEY] = new Store()) as Store);
