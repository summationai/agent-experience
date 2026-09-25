// Evaluation variant v3 (review item 17): basic structured tools. A deliberately thin wrapper,
// the kind of CRUD tool set a team writes in an afternoon: each tool calls the same domain
// function as the page and the AXE actions (lib/domain.ts), with the same agent token, tenant,
// and role checks. What it leaves out is the point of the comparison: no revision (a write
// applies to whatever the plan is now), no availability before a call, no approval handoff, and
// no idempotency key. Served as JSON at POST /tools/{name}; eval/basic-mcp.ts offers the same
// table as MCP tools.
import { callerOf } from "./axe";
import type { Actor } from "./model";
import { lock, setValues, submit } from "./domain";
import { store } from "./store";
import type { WriteOutcome } from "./store";

export interface BasicTool {
  name: string;
  description: string;
  /** JSON Schema of the arguments. */
  inputSchema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
}

export const BASIC_TOOLS: BasicTool[] = [
  {
    name: "get_plan",
    description: "Get the team's demand plan: status and demand per item and month.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "set_value",
    description: "Set the demand for one item in one month.",
    inputSchema: {
      type: "object",
      properties: {
        item: { type: "string" },
        month: { type: "string", description: "YYYY-MM" },
        value: { type: "integer", minimum: 0 },
      },
      required: ["item", "month", "value"],
    },
  },
  {
    name: "submit_plan",
    description: "Submit the plan for approval.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "lock_plan",
    description: "Approve and lock the plan.",
    inputSchema: { type: "object", properties: {} },
  },
];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function result(out: WriteOutcome): Response {
  if (out.ok) return json({ ok: true, plan: planView(out.plan.tenant) });
  return json({ ok: false, error: out.kind === "refused" ? out.reason : "Please try again." }, 409);
}

function planView(tenant: string) {
  const p = store.plan(tenant)!;
  return {
    id: p.id,
    name: p.name,
    status: p.status,
    items: p.items,
    months: p.months,
    values: p.values,
  };
}

/** Route one POST /tools/{name}. Agent bearer token only (no cookie, so no CSRF surface). */
export async function handleBasicTool(request: Request, name: string): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Not found." }, 404);
  const caller = request.headers.get("authorization") ? callerOf(request) : null;
  if (!caller) return json({ ok: false, error: "Send your agent token." }, 401);
  const tenant = caller.tenant;
  const actor: Actor = { user: caller.user, via: "axe" };
  let args: Record<string, unknown> = {};
  try {
    const v = (await request.json()) as unknown;
    if (v && typeof v === "object" && !Array.isArray(v)) args = v as Record<string, unknown>;
  } catch {
    // no arguments
  }
  // Every write presents the revision the plan has at this moment: a blind write.
  const now = () => store.rev(tenant);
  switch (name) {
    case "get_plan":
      return json({ ok: true, plan: planView(tenant) });
    case "set_value":
      return result(
        setValues(tenant, actor, now(), [
          {
            item: String(args["item"]),
            month: String(args["month"]),
            value: Number(args["value"]),
          },
        ]),
      );
    case "submit_plan":
      return result(submit(tenant, actor, now()));
    case "lock_plan":
      // No approval flow: the caller's own role decides, as it would on the plan page.
      return result(lock(tenant, actor, now(), caller.user));
  }
  return json({ ok: false, error: `No tool named ${name}.` }, 404);
}
