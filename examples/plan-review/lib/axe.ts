// Server capabilities: the plan's domain actions as AXE actions. They live on the server for as
// long as the process runs, are scoped to the caller's user and tenant by the runtime, and call
// the same handlers as the app's own pages (lib/domain.ts). Nothing here depends on a browser:
// no closure registered in a page is ever called from this file.
import { action, createAXE, requestApproval, unavailable, z } from "@axe/core";
import type {
  AXE,
  AXEActionEvent,
  AvailabilityContext,
  AvailabilityInput,
  HandlerContext,
  Identity,
  ResultHelpers,
  TenantInfo,
} from "@axe/core";
import type { Actor } from "./model";
import { describeActor, monthLabel, planTotal } from "./model";
import { lock, setValues, submit, whyNot } from "./domain";
import type { Operation } from "./domain";
import { AGENT_TOKENS, TENANTS, store } from "./store";
import type { WriteOutcome } from "./store";

export const BASE_URL = (process.env.PLAN_REVIEW_BASE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

/**
 * Origins, besides `BASE_URL`'s, whose credentialed requests are accepted (protocol §6.4). The
 * same app reached as 127.0.0.1 instead of localhost is a different origin; list it here, or the
 * browser's own requests are refused as cross-site.
 */
export const TRUSTED_ORIGINS = (process.env.PLAN_REVIEW_TRUSTED_ORIGINS ?? defaultTrusted())
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function defaultTrusted(): string {
  const u = new URL(BASE_URL);
  if (u.hostname === "localhost") return `${u.protocol}//127.0.0.1${u.port ? `:${u.port}` : ""}`;
  return "";
}

export const SESSION_COOKIE = "plan_review_session";

/** Who is calling: an agent with its bearer token, or a page with the person's session cookie. */
export interface Caller {
  user: string;
  tenant: string;
  credential: "agent-token" | "session";
}

export function readCookie(request: Request, name: string): string | undefined {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function callerOf(request: Request): Caller | null {
  const auth = request.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(\S+)$/i.exec(auth);
  if (m) {
    const t = AGENT_TOKENS[m[1]!];
    return t ? { ...t, credential: "agent-token" } : null;
  }
  const s = store.session(readCookie(request, SESSION_COOKIE));
  return s ? { user: s.user, tenant: s.tenant, credential: "session" } : null;
}

/** The tenant an anonymous request sees: the action set only, nothing from any plan. */
const PUBLIC: TenantInfo = { id: "public", name: "Plan Review", baseUrl: BASE_URL };

const planOutput = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["draft", "submitted", "locked"]),
  rev: z.number(),
  frozen: z.boolean(),
  months: z.array(z.string()),
  rows: z.array(z.object({ item: z.string(), values: z.record(z.string(), z.number()) })),
  total: z.number(),
});

const receiptSchema = z.object({
  operation: z.string(),
  planId: z.string(),
  requestedFor: z.string(),
  actor: z.string(),
  approvedBy: z.string(),
  requestedAt: z.string(),
  approvedAt: z.string(),
  executedAt: z.string(),
  revBefore: z.number(),
  revAfter: z.number(),
  changes: z.array(
    z.object({
      field: z.string(),
      from: z.union([z.string(), z.number(), z.null()]),
      to: z.union([z.string(), z.number(), z.null()]),
    }),
  ),
});

export type Receipt = z.infer<typeof receiptSchema>;

function actorOf(identity: Identity | null): Actor {
  return { user: identity?.onBehalfOf ?? "", via: "axe" };
}

function planView(tenant: string) {
  const plan = store.plan(tenant)!;
  return {
    id: plan.id,
    name: plan.name,
    status: plan.status,
    rev: plan.rev,
    frozen: !!plan.frozen,
    months: plan.months,
    rows: plan.items.map((item) => ({
      item,
      values: Object.fromEntries(plan.months.map((m) => [m, plan.values[`${item}|${m}`] ?? 0])),
    })),
    total: planTotal(plan),
  };
}

/** Availability for one operation, computed by the app's own rule; the non-claim for anonymous readers. */
function availabilityFor(op: Operation) {
  return (ctx: AvailabilityContext): AvailabilityInput => {
    if (!ctx.identity || !ctx.tenant || ctx.tenant.id === PUBLIC.id) return { available: true };
    const plan = store.plan(ctx.tenant.id);
    if (!plan) return { available: true };
    const reason = whyNot(plan, op, actorOf(ctx.identity));
    return reason ? { available: false, reason } : { available: true };
  };
}

/** Every write presents the revision it read; the handler carries it into the conditional write. */
function requireRev(
  ctx: Pick<HandlerContext<unknown>, "expectedRev"> & Pick<ResultHelpers, "fail">,
) {
  if (ctx.expectedRev === undefined)
    return ctx.fail(
      "invalid_input",
      "Send expectedRev: the rev of the plan you read (plan.read, /axe/state, or the last result).",
      { issues: [{ path: "/expectedRev", message: "is required for writes", expected: "number" }] },
    );
  return Number(ctx.expectedRev);
}

/** A refused or stale write, as the AXE result the agent needs. */
function refusal(
  outcome: Exclude<WriteOutcome, { ok: true }>,
  expectedRev: number,
  ctx: Pick<ResultHelpers, "fail">,
) {
  if (outcome.kind === "conflict")
    return ctx.fail(
      "conflict",
      `The plan changed since you read it (you saw revision ${expectedRev}, it is now ${outcome.currentRev}). Nothing was applied; read it again and decide again.`,
      { retryable: true, details: { expectedRev, currentRev: outcome.currentRev } },
    );
  return unavailable({ available: false, reason: outcome.reason }, { retryable: false });
}

function tenantOf(ctx: { tenant: TenantInfo | null }): string {
  return ctx.tenant!.id;
}

export function buildAXE(): AXE {
  const axe = createAXE({
    name: "Plan Review",
    description:
      "A team's half-year demand plan: read it, change monthly demand per item, submit it for approval, and ask for it to be approved and locked. Locking needs a person's approval on the site.",
    baseUrl: BASE_URL,
    secret: process.env.AXE_SECRET ?? "plan-review-local-demo-secret-not-for-production",
    tenant: (request) => {
      const c = callerOf(request);
      return c ? { id: c.tenant, name: TENANTS[c.tenant]!.name, baseUrl: BASE_URL } : PUBLIC;
    },
    auth: {
      modes: ["user"],
      authenticate: (request) => {
        const c = callerOf(request);
        return c ? { onBehalfOf: c.user, claims: { credential: c.credential } } : null;
      },
    },
    // One revision per tenant: the plan's revision column.
    revision: ({ tenant }) => (tenant ? store.rev(tenant.id) : 0),
    // Cookie requests from other origins are refused (phase 1 request policy, on by default).
    requestPolicy: { trustedOrigins: TRUSTED_ORIGINS },
    // The approval lifecycle feeds the app's history (recordApprovalEvent, below).
    onActionEvent: (e) => recordApprovalEvent(e),
  });

  axe.register(
    action("plan.read", {
      title: "Read the demand plan",
      description:
        "Returns the team's demand plan: status (draft, submitted, locked), whether a person froze it, the revision, and demand per item and month. Pass rev as expectedRev on the next write.",
      input: z.object({}),
      output: z.object({ plan: planOutput }),
      readOnly: true,
      risk: "none",
      auth: "user",
      handler: (ctx) => ({ plan: planView(tenantOf(ctx)) }),
    }),
  );

  axe.register(
    action("plan.set-value", {
      title: "Change a month's demand for an item",
      description:
        "Sets the demand for one item in one month of the draft plan. Refused while the plan is submitted, locked, or frozen, and when the plan moved since the revision you present.",
      input: z.object({
        item: z.string().min(1).max(40),
        month: z.string().regex(/^\d{4}-\d{2}$/),
        value: z.number().int().min(0).max(10_000_000),
      }),
      output: z.object({ plan: planOutput, revBefore: z.number(), revAfter: z.number() }),
      risk: "low",
      auth: "user",
      idempotent: true,
      reversible: true,
      availability: availabilityFor("edit"),
      handler: (ctx) => {
        const rev = requireRev(ctx);
        if (typeof rev !== "number") return rev;
        if (ctx.availability && !ctx.availability.available) return unavailable(ctx.availability);
        const out = setValues(
          tenantOf(ctx),
          actorOf(ctx.identity),
          rev,
          [ctx.input],
          ctx.operationId,
        );
        if (!out.ok) return refusal(out, rev, ctx);
        return { plan: planView(tenantOf(ctx)), revBefore: out.revBefore, revAfter: out.revAfter };
      },
    }),
  );

  axe.register(
    action("plan.submit", {
      title: "Submit the plan for approval",
      description:
        "Moves the draft plan to submitted, so an approver can lock it. Values can no longer change until an approver reopens it.",
      input: z.object({ planId: z.string() }),
      output: z.object({ plan: planOutput }),
      risk: "medium",
      auth: "user",
      reversible: true,
      availability: availabilityFor("submit"),
      handler: (ctx) => {
        const rev = requireRev(ctx);
        if (typeof rev !== "number") return rev;
        if (ctx.input.planId !== store.plan(tenantOf(ctx))!.id)
          return ctx.fail("not_found", "This team has no plan with that id.");
        if (ctx.availability && !ctx.availability.available) return unavailable(ctx.availability);
        const out = submit(tenantOf(ctx), actorOf(ctx.identity), rev, ctx.operationId);
        if (!out.ok) return refusal(out, rev, ctx);
        return { plan: planView(tenantOf(ctx)) };
      },
    }),
  );

  // #region approve
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
  // #endregion approve

  axe.register(
    action("plan.history", {
      title: "Read the plan's history",
      description:
        "Returns the most recent entries of the plan's history: every committed change, who made it and when, people and agents alike, and every approval request and decision. A refused or stale write changed nothing and is not listed.",
      input: z.object({ limit: z.number().int().min(1).max(100).optional() }),
      output: z.object({
        entries: z.array(
          z.object({
            seq: z.number(),
            at: z.string(),
            actor: z.string(),
            event: z.string(),
            summary: z.string(),
            revBefore: z.number().nullable(),
            revAfter: z.number().nullable(),
          }),
        ),
      }),
      readOnly: true,
      risk: "none",
      auth: "user",
      handler: (ctx) => ({
        entries: store
          .audit(tenantOf(ctx))
          .slice(-(ctx.input.limit ?? 20))
          .map(({ seq, at, actor, event, summary, revBefore, revAfter }) => ({
            seq,
            at,
            actor,
            event,
            summary,
            revBefore,
            revAfter,
          })),
      }),
    }),
  );
  return axe;
}

/**
 * Approval decisions and requests into the app's history. The runtime emits these as action
 * events; they carry the handoff id and the actors, never the input or the bound state. The lock
 * itself is recorded by the domain write, so `approval.executed` is recorded only when it failed.
 */
export function recordApprovalEvent(e: AXEActionEvent): void {
  if (!e.tenant || !e.event.startsWith("approval.")) return;
  const id = String(e.details["handoffId"] ?? "");
  const base = {
    tenant: e.tenant,
    via: "approval" as const,
    changes: [],
    revBefore: null,
    revAfter: null,
  };
  switch (e.event) {
    case "approval.requested":
      store.noteApprovalRequest(e.tenant, id);
      store.record({
        ...base,
        actor: `agent for ${e.actor}`,
        event: e.event,
        summary: "Asked for approval to lock the plan",
      });
      break;
    case "approval.approved":
      store.record({
        ...base,
        actor: e.actor ?? "",
        event: e.event,
        summary: "Approved the agent's request to lock the plan",
      });
      break;
    case "approval.cancelled":
      store.record({
        ...base,
        actor: e.actor ?? "",
        event: e.event,
        summary: "Cancelled the request to lock the plan",
      });
      break;
    case "approval.invalidated":
      store.record({
        ...base,
        actor: "site",
        event: e.event,
        summary: "Voided a request to lock: the plan changed after it was asked for",
      });
      break;
    case "approval.executed":
      if (e.status === "error")
        store.record({
          ...base,
          actor: `agent for ${e.actor}`,
          event: e.event,
          summary: `An approved lock did not run (${e.errorCode ?? "error"})`,
        });
      break;
  }
}

// One runtime per server process (its token and idempotency stores are in memory).
const KEY = Symbol.for("plan-review.axe");
export function getAXE(): AXE {
  const g = globalThis as Record<symbol, unknown>;
  return (g[KEY] as AXE | undefined) ?? ((g[KEY] = buildAXE()) as AXE);
}

/** For tests: a fresh runtime (and so fresh token and idempotency stores). */
export function resetAXE(): AXE {
  const g = globalThis as Record<symbol, unknown>;
  g[KEY] = buildAXE();
  return g[KEY] as AXE;
}
