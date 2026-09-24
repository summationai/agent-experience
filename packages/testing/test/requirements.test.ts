import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REQUIREMENTS } from "../src/conformance/requirements";
import { runConformance } from "../src/conformance/index";
import { WEIGHTS } from "../src/audit/index";
import { apartmentsAXE } from "../../core/test/fixtures/apartments";

const root = join(__dirname, "../../..");

describe("requirement coverage", () => {
  it("every numbered requirement in the spec is mapped to a check or a test", () => {
    const spec = readFileSync(join(root, "spec/AXE-PROTOCOL.md"), "utf8");
    const ids = [...new Set([...spec.matchAll(/\[(P-[A-Z]+-\d+)\]/g)].map((m) => m[1]!))];
    expect(ids.length).toBeGreaterThan(90);
    const missing = ids.filter((id) => !REQUIREMENTS[id]);
    expect(missing, `Unmapped requirements: ${missing.join(", ")}`).toEqual([]);
    const extra = Object.keys(REQUIREMENTS).filter((id) => !ids.includes(id));
    expect(extra, `Mapped but not in spec: ${extra.join(", ")}`).toEqual([]);
  });

  it("every conformance check id referenced in the map is emitted by the suite", async () => {
    const { axe } = apartmentsAXE();
    const report = await runConformance("https://oakridge-rentals.example", {
      fetch: (i, init) => axe.handle(new Request(i, init)),
      auth: "user:dana",
    });
    const emitted = new Set(report.checks.map((c) => c.id));
    const referenced = new Set<string>();
    for (const list of Object.values(REQUIREMENTS))
      for (const c of list) if ("check" in c) referenced.add(c.check);
    const missing = [...referenced].filter((id) => !emitted.has(id) && !id.startsWith("audit."));
    expect(missing, `Referenced checks never emitted: ${missing.join(", ")}`).toEqual([]);
    for (const id of Object.keys(WEIGHTS.checks)) expect(id.split(".").length).toBe(2);
  });

  it("every mapped test name corresponds to a real test title", () => {
    const testFiles = [
      "packages/core/test/ladder.test.ts",
      "packages/core/test/manifest.test.ts",
      "packages/core/test/display.test.ts",
      "packages/core/test/pending.test.ts",
      "packages/core/test/tokens.test.ts",
      "packages/core/test/live.test.ts",
      "packages/client/test/client.test.ts",
      "packages/client/test/narrowing.test.ts",
      "packages/client/test/trust.test.ts",
      "packages/mcp/test/mcp.test.ts",
    ]
      .map((p) => readFileSync(join(root, p), "utf8"))
      .join("\n");
    const names = new Set<string>();
    for (const list of Object.values(REQUIREMENTS))
      for (const c of list) if ("test" in c) names.add(c.test);
    const missing = [...names].filter((n) => {
      const title = n.replace(/^@axe\/(core|client|mcp) /, "");
      const words = title.split(/[:;,]/)[0]!.trim();
      return !testFiles.includes(words);
    });
    expect(missing, `Test names not found: ${missing.join(" | ")}`).toEqual([]);
  });
});
