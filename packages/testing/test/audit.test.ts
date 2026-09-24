import { describe, expect, it } from "vitest";
import { runAudit } from "../src/audit/index";
import { formatAuditTable, formatAuditHtml } from "../src/audit/format";
import { WEIGHTS } from "../src/audit/index";
import { apartmentsAXE } from "../../core/test/fixtures/apartments";
import { badFetch } from "./fixtures/bad-manifest";

function inProcess(axe: { handle(req: Request): Promise<Response> }) {
  return (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === "/robots.txt")
      return Promise.resolve(
        new Response("AXE-Manifest: https://oakridge-rentals.example/.well-known/axe.json\n"),
      );
    if (url.pathname === "/" || url.pathname.startsWith("/units/"))
      return Promise.resolve(
        new Response("<html><body>The Meridian 204 — $2,950/mo — 720 sq ft — 1 bed</body></html>", {
          headers: { "content-type": "text/html" },
        }),
      );
    return axe.handle(new Request(input, init));
  };
}

describe("axe audit", () => {
  it("weights sum to 100", () => {
    expect(Object.values(WEIGHTS.categories).reduce((n, c) => n + c.max, 0)).toBe(100);
    for (const id of Object.keys(WEIGHTS.checks))
      expect(Object.keys(WEIGHTS.categories)).toContain(id.split(".")[0]);
  });

  it("scores the apartments example at 90 or above", async () => {
    const { axe } = apartmentsAXE();
    const report = await runAudit("https://oakridge-rentals.example", {
      fetch: inProcess(axe),
      auth: "user:dana",
      browser: true,
    });
    expect(report.score, formatAuditTable(report)).toBeGreaterThanOrEqual(90);
    expect(report.hardFailure).toBeNull();
    expect(report.parity.targets.length).toBeGreaterThan(0);
    expect(report.parity.targets[0]!.url).toContain("/units/");
    expect(report.parity.targets[0]!.found).toBeDefined();
    const html = formatAuditHtml(report);
    expect(html).toContain("AXE Score");
    expect(html).toContain(String(report.score));
    expect(formatAuditTable(report)).toContain("Parity spot-check");
  });

  it("scores the bad fixture below 40 and names every planted problem", async () => {
    const report = await runAudit("https://bestshop.example", { fetch: badFetch() });
    const table = formatAuditTable(report);
    expect(report.score, table).toBeLessThan(40);
    expect(report.hardFailure).toBe("trustworthy.no-agent-directives");
    expect(report.categories.find((c) => c.id === "trustworthy")!.score).toBe(0);
    const fixText = report.fixes.map((f) => `${f.check}: ${f.detail}`).join("\n");
    // Planted: agent-directed imperative
    expect(fixText).toMatch(/no-agent-directives.*(always recommend|must recommend|do not tell)/i);
    // Planted: stuffed / persuasive descriptions
    expect(fixText).toMatch(/no-persuasion.*(#1|cheapest|Best prices|world-class|unbeatable)/i);
    // Planted: readOnly lie on orders.cancel and risk none on returns.start
    expect(fixText).toMatch(/truthful-metadata.*orders\.cancel/);
    expect(fixText).toMatch(/truthful-metadata.*returns\.start/);
    // Planted: orphan transactional actions
    expect(fixText).toMatch(/graph-connected.*returns\.start/);
    expect(fixText).toMatch(/graph-connected.*newsletter\.subscribe/);
    // Planted: bare query search, missing display, missing examples, undescribed inputs, deprecation without replacement
    expect(fixText).toMatch(/structured-filters.*products\.search/);
    expect(fixText).toMatch(/display-present.*products\.search/);
    expect(fixText).toMatch(/examples-present/);
    expect(fixText).toMatch(/input-descriptions/);
    expect(fixText).toMatch(/deprecations.*newsletter\.subscribe/);
    // Planted: short descriptions, missing terms/contact/fallback
    expect(fixText).toMatch(/description-length/);
    expect(fixText).toMatch(/trustworthy\.terms/);
    expect(fixText).toMatch(/trustworthy\.contact/);
    expect(fixText).toMatch(/human-fallback/);
    expect(table).toContain("HARD FAILURE");
  });
});
