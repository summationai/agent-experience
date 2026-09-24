import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer, toolNameFor, formatResult } from "../src/index";
import { apartmentsAXE } from "../../core/test/fixtures/apartments";
import { liveAXE } from "../../core/test/fixtures/live";

async function connect(auth?: string) {
  const { axe, state } = apartmentsAXE();
  const derived = await createMcpServer(axe, { client: auth ? { auth } : {} });
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await derived.server.connect(serverT);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(clientT);
  return { client, derived, state };
}

function text(r: Awaited<ReturnType<Client["callTool"]>>): string {
  const content = r.content as { type: string; text?: string }[];
  return content.map((c) => c.text ?? "").join("\n");
}

describe("@axe/mcp", () => {
  it("lists one tool per action plus the reserved tools, with schemas and annotations", async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([
      "applications_submit",
      "axe_continue",
      "axe_manifest",
      "axe_poll",
      "axe_resume",
      "leases_sign",
      "tours_book",
      "units_search",
    ]);
    const search = tools.find((t) => t.name === "units_search")!;
    expect(search.inputSchema.type).toBe("object");
    expect((search.inputSchema.properties as Record<string, unknown>)["location"]).toBeDefined();
    expect(search.annotations?.readOnlyHint).toBe(true);
    expect(search.description).toContain("Follow-ups per result: tours_book, applications_submit");
    const submit = tools.find((t) => t.name === "applications_submit")!;
    expect(submit.annotations?.readOnlyHint).toBe(false);
    expect(submit.description).toContain("Requires user authentication");
    expect(toolNameFor("a.b-c.d")).toBe("a_b-c_d");
  });

  it("returns Markdown comparison plus JSON for display actions", async () => {
    const { client } = await connect();
    const r = await client.callTool({
      name: "units_search",
      arguments: { location: "Bellevue, WA", bedrooms: 1 },
    });
    const t = text(r);
    expect(t).toContain("| Option | Price | Size |");
    expect(t).toContain("applications.submit");
    expect(t).toContain("```json");
    expect((r.structuredContent as { status: string }).status).toBe("ok");
    const bad = await client.callTool({ name: "units_search", arguments: { bedrooms: "two" } });
    expect(bad.isError).toBe(true);
    expect(text(bad)).toContain("/location");
  });

  it("surfaces needs_input with accepts and axe_continue, then completes", async () => {
    const { client, state } = await connect("user:dana");
    const r = await client.callTool({
      name: "applications_submit",
      arguments: { unitId: "u_204" },
    });
    const t = text(r);
    expect(t).toContain("payment_required");
    expect(t).toContain("kind `payment.ach-debit`");
    expect(t).toContain("SENSITIVE");
    expect(t).toContain("axe_continue");
    expect(t).toContain("axe_resume");
    const token = (r.structuredContent as { continuationToken: string }).continuationToken;
    const done = await client.callTool({
      name: "axe_continue",
      arguments: {
        continuationToken: token,
        kind: "payment.ach-debit",
        payload: {
          accountHolderName: "D",
          routingNumber: "125000024",
          accountNumber: "0001234",
          accountType: "checking",
          amount: 500,
          currency: "USD",
          authorizedAt: "2026-01-01T00:00:00Z",
          authorizationText: "ok",
        },
      },
    });
    expect((done.structuredContent as { status: string }).status).toBe("ok");
    expect(text(done)).toContain("depositStatus");
    expect([...state.applications.values()][0]!.status).toBe("submitted");
  });

  it("surfaces needs_human with handoff text and axe_resume; errors are isError", async () => {
    const { client } = await connect("user:dana");
    const r = await client.callTool({ name: "leases_sign", arguments: { applicationId: "APP-1" } });
    const t = text(r);
    expect(t).toContain("Tell the user:");
    expect(t).toContain("axe_resume");
    const token = (r.structuredContent as { handoff: { resumeToken: string } }).handoff.resumeToken;
    const early = await client.callTool({ name: "axe_resume", arguments: { resumeToken: token } });
    expect(early.isError).toBe(true);
    expect(text(early)).toContain("conflict");
    const unknown = await client.callTool({ name: "axe_manifest", arguments: {} });
    expect((unknown.structuredContent as { name: string }).name).toBe("Oakridge Rentals");
  });

  it("formats pending and error results", () => {
    const p = formatResult(
      { status: "pending", pollUrl: "https://x.example/axe/poll/t", retryAfter: 3 },
      undefined,
      undefined,
    );
    expect((p.content[0] as { text: string }).text).toContain("axe_poll");
    const e = formatResult(
      {
        status: "error",
        error: {
          code: "invalid_input",
          message: "bad",
          retryable: false,
          details: { issues: [{ path: "/a", message: "is required", expected: "string" }] },
        },
      },
      undefined,
      undefined,
    );
    expect(e.isError).toBe(true);
    expect((e.content[0] as { text: string }).text).toContain("/a: is required (expected string)");
  });

  it("adds axe_state, accepts expectedRev, and explains stale and unavailable when the site is live", async () => {
    const { axe, studio } = liveAXE();
    const derived = await createMcpServer(axe, { client: { auth: "user:dana" } });
    const [clientT, serverT] = InMemoryTransport.createLinkedPair();
    await derived.server.connect(serverT);
    const client = new Client({ name: "test", version: "0" });
    await client.connect(clientT);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain("axe_state");
    const book = tools.find((t) => t.name === "classes_book")!;
    expect((book.inputSchema.properties as Record<string, unknown>)["expectedRev"]).toBeDefined();
    expect(book.description).toContain("Available at the time the manifest was read");
    const state = await client.callTool({ name: "axe_state", arguments: {} });
    expect(text(state)).toContain("As of revision 41.");
    expect((state.structuredContent as { rev: number }).rev).toBe(41);
    const stale = await client.callTool({
      name: "classes_book",
      arguments: { classId: "yin-tue-1800", expectedRev: 40 },
    });
    expect(stale.isError).toBe(true);
    expect(text(stale)).toContain("Stale: you acted on revision 40 but the site is at revision 41");
    expect(studio.handlerRuns).toBe(0);
    const ok = await client.callTool({
      name: "classes_book",
      arguments: { classId: "yin-tue-1800", expectedRev: 41 },
    });
    expect(ok.isError).toBeUndefined();
    expect(text(ok)).toContain("Revision: 42.");
    // Sam has no credits: unavailable, with the reason and what would unblock it.
    const sam = await createMcpServer(axe, { client: { auth: "user:sam" } });
    const [c2, s2] = InMemoryTransport.createLinkedPair();
    await sam.server.connect(s2);
    const client2 = new Client({ name: "test", version: "0" });
    await client2.connect(c2);
    const refused = await client2.callTool({
      name: "classes_book",
      arguments: { classId: "yin-tue-1800" },
    });
    expect(refused.isError).toBe(true);
    expect(text(refused)).toContain(
      "Not available right now: no credits left on the member's pass.",
    );
    expect(text(refused)).toContain("payment.card");
    expect(text(refused)).toContain(
      "A person can do it at https://ember-yoga.example/account/passes.",
    );
  });

  it("rejects colliding or reserved tool names", async () => {
    const { axe } = apartmentsAXE();
    const core = await import("../../core/src/index");
    axe.register(
      core.action("axe.continue", {
        title: "Bad",
        description:
          "An action whose derived MCP tool name collides with the reserved axe_continue tool; must be rejected.",
        readOnly: true,
        risk: "none",
        input: core.z.object({}),
        output: core.z.object({}),
        handler: async () => ({}),
      }),
    );
    await expect(createMcpServer(axe)).rejects.toThrow(/reserved MCP tool name "axe_continue"/);
  });
});
