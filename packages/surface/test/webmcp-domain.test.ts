// @vitest-environment jsdom
/**
 * `exposeWebMcp(surface, { granularity: "domain" })`: a fixed set of tools, one per domain action,
 * each taking an entryId from the observe tool, whatever the size of the page.
 */
import { describe, expect, it } from "vitest";
import { createSurface } from "../src/index";
import type { Surface } from "../src/index";
import { exposeWebMcp } from "../src/webmcp";
import type { ModelContextLike, WebMcpTool, WebMcpToolResult } from "../src/webmcp";

class FakeModelContext implements ModelContextLike {
  readonly tools = new Map<string, WebMcpTool>();
  registrations = 0;
  async registerTool(tool: WebMcpTool, options: { signal?: AbortSignal } = {}): Promise<undefined> {
    if (/[^A-Za-z0-9_.-]/.test(tool.name))
      throw new DOMException("invalid name", "InvalidStateError");
    if (this.tools.has(tool.name)) throw new DOMException("duplicate", "InvalidStateError");
    this.registrations += 1;
    this.tools.set(tool.name, tool);
    options.signal?.addEventListener("abort", () => {
      if (this.tools.get(tool.name) === tool) this.tools.delete(tool.name);
    });
    return undefined;
  }
  async call(name: string, input: Record<string, unknown> = {}): Promise<WebMcpToolResult> {
    const value = await this.tools
      .get(name)!
      .execute(input, { signal: new AbortController().signal });
    return JSON.parse(JSON.stringify(value)) as WebMcpToolResult;
  }
}

/** A planning grid: `rows` products by 12 months of editable demand, plus a save and a delete. */
function grid(rows: number) {
  const s = createSurface({ app: "planner" });
  const values = new Map<string, string>();
  for (let p = 0; p < rows; p++)
    for (let m = 1; m <= 12; m++) {
      const id = `demand:p${p}:m${m}`;
      values.set(id, "100");
      s.register({
        id,
        kind: "field",
        role: "textbox",
        name: `Product ${p}, month ${m}`,
        object: `product:${p}`,
        value: "100",
        edit: { maxLength: 8, set: (text) => (values.set(id, text), s.bump()) },
      });
    }
  const ran: string[] = [];
  s.register({
    id: "save",
    kind: "action",
    role: "button",
    name: "Save",
    state: { available: true },
    effect: { mutates: "plan", reversible: true, risk: "low" },
    handler: () => void (ran.push("save"), s.bump()),
  });
  s.register({
    id: "delete",
    kind: "action",
    role: "button",
    name: "Delete the plan",
    state: { available: true },
    effect: { mutates: "plan", reversible: false, risk: "high" },
    handler: () => void (ran.push("delete"), s.bump()),
  });
  s.register({
    id: "pin",
    kind: "field",
    role: "textbox",
    name: "Account PIN",
    value: "4812",
    sensitive: true,
    edit: { set: () => undefined },
  });
  return { s, values, ran };
}

async function expose(s: Surface, extra: Parameters<typeof exposeWebMcp>[1] = {}) {
  const mc = new FakeModelContext();
  const h = exposeWebMcp(s, { modelContext: mc, granularity: "domain", ...extra });
  await h.ready();
  return { mc, h };
}

describe("WebMCP domain granularity", () => {
  it("registers a fixed set of tools, whatever the size of the page", async () => {
    const small = await expose(grid(2).s);
    const large = await expose(grid(50).s);
    const names = [
      "surface_load-more",
      "surface_observe",
      "surface_run-control",
      "surface_set-field",
    ];
    expect([...small.mc.tools.keys()].sort()).toEqual(names);
    expect([...large.mc.tools.keys()].sort()).toEqual(names);
    small.h.close();
    large.h.close();
  });

  it("acts on a row by its entryId, and the page's changes re-register nothing", async () => {
    const { s, values, ran } = grid(3);
    const { mc, h } = await expose(s);
    const before = mc.registrations;
    const set = await mc.call("surface_set-field", { entryId: "demand:p1:m3", text: "250" });
    expect(set.isError, set.content[0]!.text).toBeFalsy();
    expect(values.get("demand:p1:m3")).toBe("250");
    const saved = await mc.call("surface_run-control", {
      entryId: "save",
      expectedRev: s.currentRev(),
    });
    expect(saved.isError).toBeFalsy();
    expect(ran).toEqual(["save"]);
    await h.ready();
    expect(mc.registrations).toBe(before);
    expect(s.ledger().map((e) => [e.op, e.target])).toEqual([
      ["TYPE_TEXT", "demand:p1:m3"],
      ["CLICK", "save"],
    ]);
    h.close();
  });

  it("says which tool acts on a row, refuses unknown and sensitive ids, and keeps the revision guard", async () => {
    const { s, values } = grid(1);
    const { mc, h } = await expose(s);
    const wrong = await mc.call("surface_run-control", { entryId: "demand:p0:m1" });
    expect(wrong.isError).toBe(true);
    expect(wrong.content[0]!.text).toBe(
      '"Product 0, month 1" is used with surface_set-field, not surface_run-control.',
    );
    const unknown = await mc.call("surface_set-field", { entryId: "nope", text: "1" });
    expect(unknown.structuredContent).toMatchObject({ error: { code: "not_found" } });
    // The PIN is a sensitive field: it is not reachable, and its value is never echoed.
    const pin = await mc.call("surface_set-field", { entryId: "pin", text: "0000" });
    expect(pin.structuredContent).toMatchObject({ error: { code: "not_found" } });
    expect(JSON.stringify(pin)).not.toContain("4812");
    const stale = await mc.call("surface_set-field", {
      entryId: "demand:p0:m1",
      text: "9",
      expectedRev: s.currentRev() + 5,
    });
    expect(stale.structuredContent).toMatchObject({ status: "error", error: { code: "conflict" } });
    expect(values.get("demand:p0:m1")).toBe("100");
    h.close();
  });

  it("a high-risk control through run-control still needs a trusted approver", async () => {
    const { s, ran } = grid(1);
    const { mc, h } = await expose(s);
    const r = await mc.call("surface_run-control", { entryId: "delete" });
    expect(r.structuredContent).toMatchObject({
      error: { details: { reason: "approval_channel_missing" } },
    });
    expect(ran).toEqual([]);
    h.close();

    const asked: string[] = [];
    const approving = await expose(s, {
      requestApproval: ({ entry }) => (asked.push(entry.name), true),
    });
    const ok = await approving.mc.call("surface_run-control", { entryId: "delete" });
    expect(ok.isError).toBeFalsy();
    expect(asked).toEqual(["Delete the plan"]);
    expect(ran).toEqual(["delete"]);
    approving.h.close();
  });

  it("an entry riskier than a domain's ceiling is covered by none of them", async () => {
    const { s } = grid(1);
    const { mc, h } = await expose(s, {
      domains: [
        {
          name: "press",
          title: "Press a low-risk button",
          description: "Presses one of the page's low-risk buttons.",
          covers: (e) => e.kind === "action",
          risk: "low",
        },
      ],
    });
    expect([...mc.tools.keys()].sort()).toEqual(["surface_observe", "surface_press"]);
    expect((await mc.call("surface_press", { entryId: "save" })).isError).toBeFalsy();
    const del = await mc.call("surface_press", { entryId: "delete" });
    expect(del.content[0]!.text).toContain("none of them covers it");
    h.close();
  });

  it("observe pages, filters, and names each row's tool", async () => {
    const { s } = grid(50);
    const { mc, h } = await expose(s);
    const first = await mc.call("surface_observe");
    const out = first.structuredContent as {
      entries: { id: string; tool?: string }[];
      total: number;
      nextCursor?: string;
    };
    expect(out.total).toBe(603);
    expect(out.entries).toHaveLength(100);
    expect(out.entries[0]).toMatchObject({ id: "demand:p0:m1", tool: "surface_set-field" });
    expect(first.content[0]!.text).toContain("- demand:p0:m1: ");
    expect(first.content[0]!.text).toContain("[surface_set-field]");
    const second = await mc.call("surface_observe", { cursor: out.nextCursor });
    expect((second.structuredContent as { entries: { id: string }[] }).entries[0]!.id).toBe(
      "demand:p8:m5",
    );
    const one = await mc.call("surface_observe", { query: "product 7, month 12" });
    expect(
      (one.structuredContent as { entries: { id: string }[] }).entries.map((e) => e.id),
    ).toEqual(["demand:p7:m12"]);
    const actions = await mc.call("surface_observe", { kind: "action" });
    expect(
      (actions.structuredContent as { entries: { id: string; tool?: string }[] }).entries,
    ).toMatchObject([
      { id: "save", tool: "surface_run-control" },
      { id: "delete", tool: "surface_run-control" },
    ]);
    const bad = await mc.call("surface_observe", { cursor: "nonsense" });
    expect(bad.structuredContent).toMatchObject({ error: { code: "invalid_input" } });
    h.close();
  });
});
