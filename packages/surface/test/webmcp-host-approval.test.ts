// @vitest-environment jsdom
/**
 * A host-injected approver (`window.__AXE_WEBMCP_APPROVER__`): a host that runs the page for a
 * person, headless, answers approvals through its own channel instead of the page's UI. Its own
 * file: the approver a host installs cannot be removed again, by design.
 */
import { describe, expect, it } from "vitest";
import { createSurface } from "../src/index";
import { exposeWebMcp, INJECTED_APPROVER_GLOBAL } from "../src/webmcp";
import type {
  HostApprovalDecision,
  HostApprovalRequest,
  ModelContextLike,
  WebMcpTool,
  WebMcpToolResult,
} from "../src/webmcp";

class FakeModelContext implements ModelContextLike {
  readonly tools = new Map<string, WebMcpTool>();
  async registerTool(tool: WebMcpTool, options: { signal?: AbortSignal } = {}): Promise<undefined> {
    this.tools.set(tool.name, tool);
    options.signal?.addEventListener("abort", () => {
      if (this.tools.get(tool.name) === tool) this.tools.delete(tool.name);
    });
    return undefined;
  }
  async executeTool(name: string, input: Record<string, unknown> = {}): Promise<WebMcpToolResult> {
    const value = await this.tools
      .get(name)!
      .execute(input, { signal: new AbortController().signal });
    return JSON.parse(JSON.stringify(value)) as WebMcpToolResult;
  }
}

function board() {
  const s = createSurface({ app: "planner" });
  const ran: string[] = [];
  s.register({
    id: "plan:delete",
    kind: "action",
    role: "button",
    name: "Delete the plan",
    state: { available: true },
    effect: { mutates: "plan", reversible: false, risk: "high" },
    handler: (actor) => {
      ran.push(actor);
      s.bump();
    },
  });
  return { s, ran };
}

const asked: HostApprovalRequest[] = [];
let answer: HostApprovalDecision = false;

describe("host-injected WebMCP approver", () => {
  it("ignores a replaceable global: only a host's non-writable, non-configurable one counts", async () => {
    const mc = new FakeModelContext();
    const { s, ran } = board();
    // What page code or an agent with script access could set after the fact.
    (globalThis as Record<string, unknown>)[INJECTED_APPROVER_GLOBAL] = () => true;
    const h = exposeWebMcp(s, { modelContext: mc });
    await h.ready();
    const r = await mc.executeTool("surface_plan_delete");
    expect(r.structuredContent).toMatchObject({
      error: { details: { reason: "approval_channel_missing" } },
    });
    expect(ran).toEqual([]);
    h.close();
    delete (globalThis as Record<string, unknown>)[INJECTED_APPROVER_GLOBAL];

    // From here on, the approver a host installs before page code.
    Object.defineProperty(globalThis, INJECTED_APPROVER_GLOBAL, {
      value: async (req: HostApprovalRequest) => {
        asked.push(req);
        return answer;
      },
      writable: false,
      configurable: false,
      enumerable: false,
    });
  });

  it("asks the host with plain data, runs the act once approved, and records who approved first", async () => {
    const mc = new FakeModelContext();
    const { s, ran } = board();
    // The page's own UI is not used while a host approver is present: no one would see it.
    const h = exposeWebMcp(s, { modelContext: mc, requestApproval: () => false });
    await h.ready();
    asked.length = 0;
    answer = { approved: true, actor: "dana (approved in the agent's MCP client)" };
    const r = await mc.executeTool("surface_plan_delete");
    expect(r.structuredContent).toMatchObject({ status: "ok" });
    expect(asked).toEqual([
      {
        tool: "surface_plan_delete",
        entryId: "plan:delete",
        name: "Delete the plan",
        app: "planner",
        risk: "high",
        mutates: "plan",
        reversible: false,
        expectedRev: 0,
      },
    ]);
    expect(ran).toEqual(["webmcp"]);
    expect(s.ledger().map((e) => [e.op, e.actor])).toEqual([
      ["APPROVE", "dana (approved in the agent's MCP client)"],
      ["CLICK", "webmcp"],
    ]);
    h.close();
  });

  it("runs nothing when the person declines", async () => {
    const mc = new FakeModelContext();
    const { s, ran } = board();
    const h = exposeWebMcp(s, { modelContext: mc });
    await h.ready();
    answer = false;
    const r = await mc.executeTool("surface_plan_delete");
    expect(r.isError).toBe(true);
    expect(r.structuredContent).toMatchObject({
      error: { details: { reason: "approval_denied" } },
    });
    expect(ran).toEqual([]);
    expect(s.ledger().map((e) => e.op)).toEqual(["DENY"]);
    h.close();
  });

  it("an unanswered question runs nothing, records no decision, and passes the host's link on", async () => {
    const mc = new FakeModelContext();
    const { s, ran } = board();
    const h = exposeWebMcp(s, { modelContext: mc });
    await h.ready();
    answer = {
      unanswered: {
        message: "Give the person this link to decide: http://127.0.0.1:1/approve/x",
        details: { approvalUrl: "http://127.0.0.1:1/approve/x" },
      },
    };
    const r = await mc.executeTool("surface_plan_delete");
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toContain("Not done: Delete the plan. Give the person this link");
    expect(r.structuredContent).toMatchObject({
      error: {
        retryable: true,
        details: { reason: "approval_pending", approvalUrl: "http://127.0.0.1:1/approve/x" },
      },
    });
    expect(ran).toEqual([]);
    expect(s.ledger()).toEqual([]);
    h.close();
  });
});
