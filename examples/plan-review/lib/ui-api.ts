// The app's own endpoints for its pages: sign-in, reading the plan, the edit/submit/lock/reopen
// buttons, freeze, and the approval page's decisions. Each is authenticated by the person's
// session cookie and refused for other origins and non-JSON bodies, the same request policy the
// AXE runtime applies to its own endpoints (protocol §6.4). Every change calls lib/domain.ts,
// which writes the history; the approval decisions reach the history through the runtime's
// approval events. Nothing here is logged automatically: each handler that changes state goes
// through a domain function or an approval call that records it.
import { isAcceptedOrigin, isJsonContentType, normalizeOrigin } from "@axe/core";
import type { HandoffView } from "@axe/core";
import type { Actor } from "./model";
import { BASE_URL, SESSION_COOKIE, TRUSTED_ORIGINS, getAXE, readCookie } from "./axe";
import { lock, reopen, setFrozen, setValues, submit, whyNot } from "./domain";
import type { CellChange } from "./domain";
import { TENANTS, agentTokenFor, memberOf, store } from "./store";
import type { Session, WriteOutcome } from "./store";

const ACCEPTED_ORIGINS = new Set(
  [BASE_URL, ...TRUSTED_ORIGINS].map((o) => normalizeOrigin(o)).filter((o): o is string => !!o),
);

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  });
}

/**
 * The request policy for the app's own writes: a POST must be JSON and come from the app's
 * origin (or a trusted one). Unlike the AXE default, the origin is checked with or without a
 * cookie, so sign-in cannot be forged either.
 */
function refusedByPolicy(request: Request): Response | undefined {
  if (request.method !== "POST") return undefined;
  if (!isAcceptedOrigin(request, ACCEPTED_ORIGINS))
    return json({ error: "Requests from other sites are refused." }, 403);
  if (!isJsonContentType(request.headers.get("content-type")))
    return json({ error: "Send JSON." }, 415);
  return undefined;
}

export function sessionOf(request: Request): Session | undefined {
  return store.session(readCookie(request, SESSION_COOKIE));
}

async function body(request: Request): Promise<Record<string, unknown>> {
  try {
    const v = (await request.json()) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function writeResponse(out: WriteOutcome): Response {
  if (out.ok) return json({ ok: true, rev: out.revAfter, changes: out.changes });
  if (out.kind === "conflict")
    return json(
      {
        error:
          "The plan changed since you loaded it. Your edits were not saved; review and save again.",
        conflict: true,
        currentRev: out.currentRev,
      },
      409,
    );
  return json({ error: out.reason, currentRev: out.currentRev }, 409);
}

/** Approval requests the page lists: those still waiting or approved and not yet used. */
export async function pendingApprovals(tenant: string): Promise<HandoffView[]> {
  const axe = getAXE();
  const out: HandoffView[] = [];
  for (const id of store.approvalRequests(tenant)) {
    const v = await axe.getHandoff(id, { tenant });
    if (v && (v.status === "open" || v.status === "approved")) out.push(v);
  }
  return out;
}

/** Everything the plan page renders, for the signed-in person. */
export async function pageState(session: Session) {
  const plan = store.plan(session.tenant)!;
  const actor: Actor = { user: session.user, via: "ui" };
  return {
    session: {
      user: session.user,
      tenant: session.tenant,
      tenantName: TENANTS[session.tenant]!.name,
      role: memberOf(session.user, session.tenant)!.role,
    },
    plan,
    can: {
      edit: whyNot(plan, "edit", actor),
      submit: whyNot(plan, "submit", actor),
      lock:
        memberOf(session.user, session.tenant)?.role === "approver"
          ? whyNot(plan, "lock", actor)
          : "Only an approver can lock the plan",
      reopen: whyNot(plan, "reopen", actor),
    },
    approvals: await pendingApprovals(session.tenant),
    history: store.audit(session.tenant).slice(-30).reverse(),
    agent: { token: agentTokenFor(session.user, session.tenant), baseUrl: BASE_URL },
  };
}

export type PageState = Awaited<ReturnType<typeof pageState>>;

function rev(b: Record<string, unknown>): number | null {
  return typeof b["expectedRev"] === "number" ? b["expectedRev"] : null;
}

/** Route one request under `/api/`. */
export async function handleUi(request: Request): Promise<Response> {
  const refused = refusedByPolicy(request);
  if (refused) return refused;
  const path = new URL(request.url).pathname.replace(/^\/api/, "");
  const method = request.method;

  if (path === "/login" && method === "POST") {
    const b = await body(request);
    const user = String(b["user"] ?? "");
    const tenant = String(b["tenant"] ?? "");
    if (!memberOf(user, tenant)) return json({ error: "Unknown user or team." }, 401);
    const s = store.createSession(user, tenant);
    return json({ user, tenant }, 200, {
      "set-cookie": `${SESSION_COOKIE}=${encodeURIComponent(s.id)}; Path=/; HttpOnly; SameSite=Lax`,
    });
  }

  // Browser tests reset the demo data between cases; off unless the server was started for them.
  if (
    path === "/test/reset" &&
    method === "POST" &&
    process.env["PLAN_REVIEW_TEST_RESET"] === "1"
  ) {
    store.reset();
    return json({ ok: true });
  }

  const session = sessionOf(request);
  if (!session) return json({ error: "Sign in first." }, 401);
  const actor: Actor = { user: session.user, via: "ui" };
  const tenant = session.tenant;

  if (path === "/logout" && method === "POST") {
    store.endSession(session.id);
    return json({ ok: true }, 200, {
      "set-cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    });
  }
  if (path === "/state" && method === "GET") return json(await pageState(session));

  if (method !== "POST") return json({ error: "Not found." }, 404);
  const b = await body(request);

  if (path === "/plan/freeze") {
    const frozen = b["frozen"] === true;
    const out = setFrozen(tenant, actor, frozen);
    if (out.ok && frozen) {
      // Takeover: every request still waiting or approved is cancelled. A lock that already ran
      // is committed; reopening the plan is the undo.
      const axe = getAXE();
      for (const id of store.approvalRequests(tenant))
        await axe.cancelHandoff(id, { by: session.user, tenant, reason: "plan frozen" });
    }
    return writeResponse(out);
  }

  const expectedRev = rev(b);
  if (path.startsWith("/plan/") && expectedRev === null)
    return json({ error: "expectedRev (the revision you loaded) is required." }, 400);

  switch (path) {
    case "/plan/values": {
      const cells = Array.isArray(b["cells"]) ? (b["cells"] as CellChange[]) : [];
      return writeResponse(setValues(tenant, actor, expectedRev!, cells));
    }
    case "/plan/submit":
      return writeResponse(submit(tenant, actor, expectedRev!));
    case "/plan/lock":
      // A person approving and locking directly: their own click is the approval.
      if (memberOf(session.user, tenant)?.role !== "approver")
        return json({ error: "Only an approver can lock the plan." }, 403);
      return writeResponse(lock(tenant, actor, expectedRev!, session.user));
    case "/plan/reopen":
      return writeResponse(reopen(tenant, actor, expectedRev!));
  }

  // #region decide
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
  // #endregion decide
  return json({ error: "Not found." }, 404);
}

export function refusalText(reason: string): string {
  switch (reason) {
    case "state_changed":
      return "The plan changed after the agent asked, so this request no longer matches it and was voided. The agent has to ask again.";
    case "already_approved":
      return "This request is already approved.";
    case "cancelled":
      return "This request was cancelled.";
    case "invalidated":
      return "This request was voided because the plan changed after it was asked for.";
    case "used":
      return "This request was already carried out; it can no longer be changed. Reopen the plan to undo the lock.";
    default:
      return "This request does not exist or has expired.";
  }
}
