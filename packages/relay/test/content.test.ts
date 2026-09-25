// The page's content and waiting, through the relay ([S-AUTO-14] to [S-AUTO-16]): a jsdom page
// runs an auto surface and connectRelay; the relay derives surface_read and surface_wait from the
// same domain actions as the rest, forwards them to the page, and translates revisions.
import { afterEach, describe, expect, it } from "vitest";
import { mintRelayToken } from "../src/token";
import { SECRET, httpAgent, noJsdom, openPage, startRelay, until } from "./helpers";
import type { Agent, Page, Running } from "./helpers";

const cleanup: (() => unknown)[] = [];
afterEach(async () => {
  while (cleanup.length) await Promise.resolve(cleanup.pop()!()).catch(() => undefined);
});

const PASSWORD = "hunter2-RELAY-PASSWORD";

async function setup(auto = true): Promise<{ r: Running; p: Page; a: Agent }> {
  const r = await startRelay();
  cleanup.push(() => r.relay.close());
  const p = await openPage();
  cleanup.push(() => p.close());
  const doc = p.window.document;
  doc.title = "Apollo launch";
  doc.body.innerHTML = `
    <div class="page">
      <h1>Apollo launch</h1>
      <div class="card"><div class="card-title">Project status</div>
        <div>Status: At risk</div>
        <div class="field"><span class="label">Owner</span><span>Dana Whitfield</span></div>
      </div>
      <button id="gen">Generate report</button>
      <div id="out"></div>
      <label>Password <input type="password" value="${PASSWORD}"></label>
      <div data-surface-ignore><p>ADDISON-PANEL</p></div>
    </div>`;
  if (auto) p.api.autoSurface({ surface: p.surface, root: doc.body, observe: { debounceMs: 0 } });
  p.connect({
    url: r.address.tabUrl,
    getToken: () => mintRelayToken({ principal: "alice", tenant: "acme", ttl: 600 }, SECRET),
  });
  await p.status((s) => s.state === "connected");
  await until(() => r.relay.tabs({ principal: "alice", tenant: "acme" })[0]?.rev !== undefined);
  const a = await httpAgent(r.address.mcpUrl, "agent-alice");
  cleanup.push(() => a.close());
  return { r, p, a };
}

describe.skipIf(noJsdom)("relay: surface_read and surface_wait", () => {
  it("lists both tools, reads the page as Markdown without private values or ignored panels, and moves no revision", async () => {
    const { p, a } = await setup();
    const tools = (await a.client.listTools()).tools;
    const names = tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["surface_read", "surface_wait"]));
    const readTool = tools.find((t) => t.name === "surface_read")!;
    expect(readTool.annotations?.readOnlyHint).toBe(true);
    expect(Object.keys(readTool.inputSchema.properties ?? {})).toEqual(
      expect.arrayContaining(["region", "query", "cursor", "maxChars"]),
    );
    const before = await a.call("surface_observe");
    const rev = (before.result.output as { rev: number }).rev;
    const tabRev = p.surface.currentRev();

    const r = await a.call("surface_read");
    expect(r.result.status, r.text).toBe("ok");
    const out = r.result.output as { markdown: string; rev: number; redacted: number };
    expect(out.markdown).toContain(
      "## Project status\n\n- **Status:** At risk\n- **Owner:** Dana Whitfield",
    );
    expect(out.markdown).not.toContain(PASSWORD);
    expect(out.markdown).not.toContain("ADDISON-PANEL");
    // The relay presents revisions in its own space for the tab, as observe does.
    expect(out.rev).toBe(rev);
    expect(out.redacted).toBe(1);
    const q = await a.call("surface_read", { query: "owner", format: "sections" });
    expect(
      (q.result.output as { sections: { heading: string }[] }).sections.map((s) => s.heading),
    ).toEqual(["Project status"]);
    expect(p.surface.currentRev()).toBe(tabRev);
    expect(p.surface.ledger()).toEqual([]);
  });

  it("waits in the page for a report the agent's click started, and reports what changed", async () => {
    const { p, a } = await setup();
    const doc = p.window.document;
    doc.getElementById("gen")!.addEventListener("click", () => {
      p.window.setTimeout(() => {
        doc.getElementById("out")!.innerHTML =
          "<h2>Weekly report</h2><p>Launch slips one week.</p>";
        doc.body.insertAdjacentHTML("beforeend", '<div class="toast">Report ready</div>');
      }, 400);
    });
    const view = (await a.call("surface_observe")).result.output as {
      rev: number;
      entries: { id: string; name: string }[];
    };
    const gen = view.entries.find((e) => e.name === "Generate report")!;
    const acted = await a.call("surface_run-control", { entryId: gen.id, expectedRev: view.rev });
    expect(acted.result.status, acted.text).toBe("ok");
    const w = await a.call("surface_wait", {
      condition: { text: "Launch slips" },
      timeoutMs: 5000,
    });
    expect(w.result.status, w.text).toBe("ok");
    expect(w.result.output).toMatchObject({
      met: true,
      notices: expect.arrayContaining(["Report ready"]),
    });
    expect((w.result.output as { elapsedMs: number }).elapsedMs).toBeGreaterThan(50);
    const report = await a.call("surface_read", { region: "Weekly report" });
    expect((report.result.output as { markdown: string }).markdown).toContain(
      "## Weekly report\n\nLaunch slips one week.",
    );
    const late = await a.call("surface_wait", { condition: { text: "Never" }, timeoutMs: 30 });
    expect(late.result.output).toMatchObject({ met: false });
  });

  it("a tab without an auto surface answers read with a reason, not content", async () => {
    const { a } = await setup(false);
    const r = await a.call("surface_read");
    expect(r.result.status).toBe("error");
    expect(r.result.error!.code).toBe("unavailable");
    expect(r.result.error!.message).toContain("does not publish its content");
  });
});
