// @vitest-environment jsdom
/**
 * `@axe/surface/webmcp` against a fake `document.modelContext` that implements the shape the
 * WebMCP draft documents (Community Group draft of 2026-09-17; Chrome's imperative API page of
 * 2026-09-21): `registerTool(tool, { signal })` rejects an invalid or duplicate name and an empty
 * description, aborting the signal unregisters, and a tool's result is serialized to JSON for the
 * agent. And without it: nothing is registered, and the page is unaffected.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSurface } from "../src/index";
import type { ActionEntry, Surface } from "../src/index";
import { CONTENT } from "../src/auto-content";
import type { PageContent, PageRead, WaitResult } from "../src/auto-content";
import { exposeWebMcp, webMcpToolNames } from "../src/webmcp";
import type { ModelContextLike, WebMcpTool, WebMcpToolResult } from "../src/webmcp";

/** The documented shape, strictly: what the draft's registerTool steps check. */
class FakeModelContext implements ModelContextLike {
  readonly tools = new Map<string, WebMcpTool>();
  registrations = 0;
  async registerTool(tool: WebMcpTool, options: { signal?: AbortSignal } = {}): Promise<undefined> {
    if (!tool.name || tool.name.length > 128 || /[^A-Za-z0-9_.-]/.test(tool.name))
      throw new DOMException(`invalid tool name ${tool.name}`, "InvalidStateError");
    if (this.tools.has(tool.name))
      throw new DOMException(`duplicate tool name ${tool.name}`, "InvalidStateError");
    if (!tool.description) throw new DOMException("empty description", "InvalidStateError");
    JSON.stringify(tool.inputSchema);
    this.registrations += 1;
    this.tools.set(tool.name, tool);
    options.signal?.addEventListener("abort", () => {
      if (this.tools.get(tool.name) === tool) this.tools.delete(tool.name);
    });
    return undefined;
  }
  /** What an agent gets back: the draft serializes the execute result to a JSON string. */
  async executeTool(name: string, input: Record<string, unknown> = {}): Promise<WebMcpToolResult> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`no tool ${name}`);
    const value = await tool.execute(input, { signal: new AbortController().signal });
    return JSON.parse(JSON.stringify(value)) as WebMcpToolResult;
  }
}

function install(mc: unknown): void {
  Object.defineProperty(document, "modelContext", {
    value: mc,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  delete (document as { modelContext?: unknown }).modelContext;
});

function page() {
  const s = createSurface({ app: "planner" });
  const approved: string[] = [];
  const lock: ActionEntry = {
    id: "plan:march:lock",
    kind: "action",
    role: "button",
    name: "Lock March",
    object: "plan:march",
    state: { available: true },
    effect: { mutates: "plan", reversible: false, risk: "medium" },
    handler: (actor) => {
      approved.push(actor);
      s.bump();
    },
  };
  s.register(lock);
  s.register({
    id: "plan:march:note",
    kind: "field",
    role: "textbox",
    name: "March note",
    value: "draft",
    edit: { maxLength: 40, set: () => void s.bump() },
  });
  s.register({
    id: "account:pin",
    kind: "field",
    role: "textbox",
    name: "Account PIN",
    value: "4812",
    sensitive: true,
    edit: { set: () => void s.bump() },
  });
  s.register({ id: "plans", kind: "collection", role: "list", name: "Plans", total: 3, loaded: 3 });
  return { s, lock, approved };
}

describe("@axe/surface/webmcp", () => {
  it("without WebMCP: registers nothing, says so, and leaves the page and expose() working", async () => {
    const { s, approved } = page();
    expect("modelContext" in document).toBe(false);
    const handle = exposeWebMcp(s);
    expect(handle.supported).toBe(false);
    expect(handle.reason).toContain("not available");
    expect(handle.diagnostic()).toMatchObject({
      supported: false,
      state: "unavailable",
      tools: [],
      errors: [],
    });
    await handle.ready();
    expect(handle.tools()).toEqual([]);
    handle.close();
    // A document.modelContext without registerTool is not WebMCP either.
    install({});
    expect(exposeWebMcp(s).supported).toBe(false);
    // The fallback for browser-driving agents is unchanged.
    const host: { __surface?: { act: Surface["act"]; rev: () => number } } = {};
    s.expose(host);
    const r = await host.__surface!.act({ op: "CLICK", target: "plan:march:lock", expectedRev: 0 });
    expect(r.status).toBe("ok");
    expect(approved).toEqual(["agent"]);
    expect(exposeWebMcp(s, { modelContext: null }).reason).toContain("disabled");
  });

  it("registers an observe tool and one tool per control, with describeEntry text and JSON input schemas; a sensitive field is never exposed", async () => {
    const mc = new FakeModelContext();
    install(mc);
    const { s } = page();
    const handle = exposeWebMcp(s);
    expect(handle.supported).toBe(true);
    await handle.ready();
    expect([...mc.tools.keys()].sort()).toEqual([
      "surface_observe",
      "surface_plan_march_lock",
      "surface_plan_march_note",
    ]);
    // No tool for the PIN, and no tool for a list that cannot load more.
    const lock = mc.tools.get("surface_plan_march_lock")!;
    expect(lock.description).toContain(
      "Lock March: available; mutates plan, not reversible, risk medium.",
    );
    expect(lock.annotations).toMatchObject({ readOnlyHint: false, consequentialHint: true });
    expect(lock.inputSchema).toMatchObject({
      type: "object",
      properties: { expectedRev: { type: "integer" } },
      additionalProperties: false,
    });
    const note = mc.tools.get("surface_plan_march_note")!;
    expect(note.inputSchema).toMatchObject({
      properties: { text: { type: "string", maxLength: 40 } },
      required: ["text"],
    });
    const observe = await mc.executeTool("surface_observe");
    const serialized = JSON.stringify(observe);
    expect(serialized).toContain("account:pin");
    expect(serialized).not.toContain("4812");
    expect(observe.content[0]!.text).toContain("Account PIN: editable, value hidden");
    expect((observe.structuredContent as { rev: number }).rev).toBe(0);
    for (const t of mc.tools.values()) expect(JSON.stringify(t)).not.toContain("4812");
    handle.close();
    expect(mc.tools.size).toBe(0);
  });

  it("offers auto-surface page reading and waiting as stable read-only Surface tools", async () => {
    const mc = new FakeModelContext();
    install(mc);
    const { s } = page();
    const reads: unknown[] = [];
    const waits: unknown[] = [];
    const pageRead: PageRead = {
      route: "/reports/:id",
      path: "/reports/42",
      title: "Revenue report",
      rev: 4,
      sections: [
        {
          heading: "Status",
          level: 2,
          text: "Preparing",
          fields: [],
          tables: [],
          lists: [],
        },
      ],
      notices: [],
      truncated: false,
      redacted: 0,
    };
    const waited: WaitResult = {
      met: true,
      elapsedMs: 120,
      rev: 5,
      fromRev: 4,
      reason: "text “Ready” is on the page",
      changed: ["report:status"],
      notices: ["Report ready"],
    };
    const content: PageContent = {
      read: (options) => {
        reads.push(options);
        return pageRead;
      },
      wait: async (condition, options) => {
        waits.push({ condition, options });
        return waited;
      },
    };
    (s as unknown as Record<symbol, unknown>)[CONTENT] = content;

    const handle = exposeWebMcp(s);
    await handle.ready();
    expect([...mc.tools.keys()].sort()).toEqual([
      "surface_observe",
      "surface_plan_march_lock",
      "surface_plan_march_note",
      "surface_read",
      "surface_wait",
    ]);
    expect(mc.tools.get("surface_read")?.title).toBe("Read the page through Surface");
    expect(mc.tools.get("surface_wait")?.annotations).toMatchObject({ readOnlyHint: true });

    const read = await mc.executeTool("surface_read", { query: "status", maxRows: 20 });
    expect(read.content[0]!.text).toContain("# Revenue report");
    expect(read.content[0]!.text).toContain("Preparing");
    expect(read.structuredContent).toEqual(pageRead);
    expect(reads).toEqual([{ query: "status", maxRows: 20 }]);

    const wait = await mc.executeTool("surface_wait", {
      condition: { text: "Ready" },
      timeoutMs: 1_000,
    });
    expect(wait.content[0]!.text).toContain("Condition met at rev 5");
    expect(wait.structuredContent).toEqual(waited);
    expect(waits).toMatchObject([{ condition: { text: "Ready" }, options: { timeoutMs: 1_000 } }]);
    const invalidWait = await mc.executeTool("surface_wait", { condition: {} });
    expect(invalidWait).toMatchObject({
      isError: true,
      structuredContent: {
        status: "error",
        error: { code: "invalid_input", retryable: false },
      },
    });
    expect(handle.diagnostic()).toMatchObject({
      supported: true,
      state: "ready",
      errors: [],
    });
    handle.close();
    expect(handle.diagnostic().state).toBe("closed");
  });

  it("acts through the page's own surface at the latest revision, passes expectedRev, and maps the result to text and structured content", async () => {
    const mc = new FakeModelContext();
    install(mc);
    const { s, approved } = page();
    const handle = exposeWebMcp(s, { actor: "browser-agent" });
    await handle.ready();
    s.bump();
    s.bump(); // the page moved on; an agent without expectedRev acts on the current revision
    const ok = await mc.executeTool("surface_plan_march_lock", {});
    expect(ok.isError).toBeUndefined();
    expect(ok.content[0]!.text).toBe(
      "Done: Lock March. The page is now at rev 3; changed: plan:march:lock.",
    );
    expect(ok.structuredContent).toMatchObject({
      status: "ok",
      output: { id: "plan:march:lock", rev: 3 },
    });
    expect(approved).toEqual(["browser-agent"]);
    // A stale expectedRev is refused by the surface's own guard; the handler does not run.
    const stale = await mc.executeTool("surface_plan_march_lock", { expectedRev: 1 });
    expect(stale.isError).toBe(true);
    expect(stale.content[0]!.text).toContain("conflict");
    expect(stale.content[0]!.text).toContain("Nothing was applied");
    expect(approved).toEqual(["browser-agent"]);
    const typed = await mc.executeTool("surface_plan_march_note", {
      text: "ready",
      expectedRev: s.currentRev(),
    });
    expect(typed.structuredContent).toMatchObject({ status: "ok" });
    const ledger = s.ledger();
    expect(ledger.map((e) => [e.actor, e.status])).toEqual([
      ["browser-agent", "ok"],
      ["browser-agent", "conflict"],
      ["browser-agent", "ok"],
    ]);
    handle.close();
  });

  it("refuses approval-sensitive acts without trusted UI, and records the person's decision before acting", async () => {
    const mc = new FakeModelContext();
    install(mc);
    const { s, lock, approved } = page();
    s.register({ ...lock, effect: { ...lock.effect, risk: "high" } });

    const closed = exposeWebMcp(s);
    await closed.ready();
    const refused = await mc.executeTool("surface_plan_march_lock");
    expect(refused.isError).toBe(true);
    expect(refused.structuredContent).toMatchObject({
      status: "error",
      error: { details: { reason: "approval_channel_missing" } },
    });
    expect(approved).toEqual([]);
    closed.close();

    const requests: string[] = [];
    const open = exposeWebMcp(s, {
      requestApproval: ({ entry, act }) => {
        requests.push(`${entry.name}:${act.expectedRev}`);
        return { approved: true, actor: "Dana" };
      },
    });
    await open.ready();
    const ok = await mc.executeTool("surface_plan_march_lock");
    expect(ok.structuredContent).toMatchObject({ status: "ok" });
    expect(requests).toEqual(["Lock March:0"]);
    expect(approved).toEqual(["webmcp"]);
    expect(s.ledger().map((e) => [e.op, e.actor])).toEqual([
      ["APPROVE", "Dana"],
      ["CLICK", "webmcp"],
    ]);
    open.close();
  });

  it("opens an auto-surface approval gate only after trusted WebMCP approval", async () => {
    const mc = new FakeModelContext();
    install(mc);
    const { s, lock, approved } = page();
    const gated = {
      ...lock,
      effect: { ...lock.effect, risk: "high" as const },
      state: {
        available: false as const,
        reason: "needs the person's approval",
        handoff: {
          reason: "approval_required",
          instructions: "Ask the person.",
          whatAgentShouldSayToUser: "May I lock March?",
        },
      },
    };
    s.register(gated);
    (s as unknown as Record<symbol, unknown>)[Symbol.for("axe.surface.approver")] = (
      id: string,
    ) => {
      if (id !== lock.id) return false;
      s.register({ ...gated, state: { available: true } });
      return true;
    };
    const handle = exposeWebMcp(s, { requestApproval: () => true });
    await handle.ready();
    const result = await mc.executeTool("surface_plan_march_lock");
    expect(result.structuredContent).toMatchObject({ status: "ok" });
    expect(approved).toEqual(["webmcp"]);
    handle.close();
  });

  it("follows availability: a changed reason re-registers the tool, `omit` drops an unavailable control, and a freeze is described", async () => {
    const mc = new FakeModelContext();
    install(mc);
    const { s, lock } = page();
    const handle = exposeWebMcp(s);
    await handle.ready();
    const before = mc.registrations;
    s.bump(); // nothing an agent sees changed: no re-registration
    await handle.ready();
    expect(mc.registrations).toBe(before);

    s.register({
      ...lock,
      state: {
        available: false,
        reason: "the budget owner has not approved March",
        handoff: {
          reason: "approval_required",
          instructions: "The budget owner approves March on the plan page.",
          whatAgentShouldSayToUser: "March needs the budget owner's approval first.",
        },
      },
    });
    await handle.ready();
    const described = mc.tools.get("surface_plan_march_lock")!;
    expect(described.description).toContain("unavailable, the budget owner has not approved March");
    expect(described.description).toContain("A person must do this on the page");
    const refused = await mc.executeTool("surface_plan_march_lock", {});
    expect(refused.isError).toBe(true);
    expect(refused.content[0]!.text).toContain("trusted WebMCP approval UI");
    handle.close();

    const omitting = exposeWebMcp(s, { unavailable: "omit" });
    await omitting.ready();
    expect(mc.tools.has("surface_plan_march_lock")).toBe(false);
    s.register({ ...lock, state: { available: true } });
    await omitting.ready();
    expect(mc.tools.has("surface_plan_march_lock")).toBe(true);
    const thaw = s.freeze("saving");
    await omitting.ready();
    expect([...mc.tools.keys()]).toEqual(["surface_observe"]);
    thaw();
    await omitting.ready();
    expect(mc.tools.has("surface_plan_march_lock")).toBe(true);
    omitting.close();

    const describing = exposeWebMcp(s);
    s.freeze("saving");
    await describing.ready();
    expect(mc.tools.get("surface_plan_march_note")!.description).toContain("read only, saving");
    describing.close();
  });

  it("maps ids to valid, stable, unique tool names and reports a refused registration", async () => {
    const names = webMcpToolNames([
      "a:b",
      "a.b",
      "observe",
      "read",
      "wait",
      "plain-id_2",
      "x".repeat(200),
    ]);
    expect(names.get("plain-id_2")).toBe("surface_plain-id_2");
    expect(names.get("a:b")).not.toBe(names.get("a.b"));
    expect(names.get("a:b")).toMatch(/^surface_a_b_[0-9a-f]{8}$/);
    expect(names.get("observe")).toMatch(/^surface_observe_[0-9a-f]{8}$/);
    expect(names.get("read")).toMatch(/^surface_read_[0-9a-f]{8}$/);
    expect(names.get("wait")).toMatch(/^surface_wait_[0-9a-f]{8}$/);
    expect(names.get("x".repeat(200))!.length).toBe(128);
    for (const n of names.values()) expect(n).toMatch(/^[A-Za-z0-9_-]{1,128}$/);
    expect(webMcpToolNames(["a:b", "a.b"]).get("a:b")).toBe(names.get("a:b"));

    const mc = new FakeModelContext();
    const onError = vi.fn();
    const s = createSurface();
    s.register({
      id: "go",
      kind: "action",
      role: "button",
      name: "Go",
      effect: { mutates: "x" },
      handler: () => {},
    });
    // Another script on the page already holds the observe name.
    await mc.registerTool({
      name: "surface_observe",
      description: "someone else's",
      inputSchema: { type: "object" },
      execute: async () => null,
    });
    const handle = exposeWebMcp(s, { modelContext: mc, onError });
    await handle.ready();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]![1]).toBe("surface_observe");
    expect(handle.tools()).toEqual(["surface_go"]);
    expect(handle.diagnostic()).toMatchObject({
      state: "degraded",
      tools: ["surface_go"],
      errors: [{ tool: "surface_observe", message: expect.stringContaining("duplicate") }],
    });
    handle.close();
    handle.close();
    expect([...mc.tools.keys()]).toEqual(["surface_observe"]);
  });
});
