import { describe, expect, it } from "vitest";
import { runConformance, formatConformanceTable } from "../src/conformance/index";
import { apartmentsAXE } from "../../core/test/fixtures/apartments";
import { badFetch } from "./fixtures/bad-manifest";

function inProcess(axe: { handle(req: Request): Promise<Response> }) {
  return (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === "/robots.txt")
      return Promise.resolve(
        new Response(
          "User-agent: *\nAllow: /\nAXE-Manifest: https://oakridge-rentals.example/.well-known/axe.json\n",
        ),
      );
    if (url.pathname === "/")
      return Promise.resolve(
        new Response("<html><head></head><body>Oakridge</body></html>", {
          headers: { "content-type": "text/html" },
        }),
      );
    return axe.handle(new Request(input, init));
  };
}

describe("conformance suite", () => {
  it("passes the apartments fixture end to end, exercising the whole ladder", async () => {
    const { axe } = apartmentsAXE({ cors: { origins: "*" } });
    const report = await runConformance("https://oakridge-rentals.example", {
      fetch: inProcess(axe),
      auth: "user:dana",
    });
    const failed = report.checks.filter((c) => c.status === "fail");
    expect(failed, formatConformanceTable(report)).toEqual([]);
    const byId = Object.fromEntries(report.checks.map((c) => [c.id, c.status]));
    for (const id of [
      "discovery.well-known",
      "discovery.hints",
      "manifest.schema",
      "manifest.display-pointers",
      "manifest.affordances",
      "runtime.unknown-action",
      "runtime.invalid-input",
      "runtime.unsupported-version",
      "runtime.example-roundtrip",
      "runtime.pagination-roundtrip",
      "runtime.cors",
      "runtime.rate-limit-header",
      "runtime.idempotency-required",
      "runtime.idempotency-replay",
      "runtime.idempotency-conflict",
      "runtime.continue-endpoint",
      "runtime.resume-endpoint",
      "runtime.token-tamper",
      "ladder.needs-input-shape",
      "ladder.continue-invalid",
      "ladder.continue-valid",
      "ladder.continue-replay",
      "ladder.fallback-resume",
      "ladder.resume-replay",
      "ladder.handoff-shape",
      "ladder.needs-human-avoidable",
    ]) {
      expect(byId[id], id).toBe("pass");
    }
    expect(report.ok).toBe(true);
    expect(report.observations.needsInput[0]!.action).toBe("applications.submit");
    const table = formatConformanceTable(report);
    expect(table).toContain("Conformant.");
  });

  it("skips ladder and mutation checks without credentials or with --no-mutate", async () => {
    const { axe } = apartmentsAXE();
    const report = await runConformance("https://oakridge-rentals.example", {
      fetch: inProcess(axe),
      noMutate: true,
    });
    expect(report.ok).toBe(true);
    expect(report.checks.find((c) => c.id === "ladder.continue-valid")!.status).toBe("skip");
    expect(report.checks.find((c) => c.id === "runtime.idempotency-replay")!.status).toBe("skip");
  });

  it("reports failures on a bad server", async () => {
    const report = await runConformance("https://bestshop.example", { fetch: badFetch() });
    expect(report.ok).toBe(false);
    const failedIds = report.checks.filter((c) => c.status === "fail").map((c) => c.id);
    expect(failedIds).toContain("runtime.protocol-header");
    expect(failedIds).toContain("manifest.truthful-metadata");
    expect(failedIds).toContain("manifest.honesty");
    expect(failedIds).toContain("manifest.description-length");
    expect(failedIds).toContain("runtime.continue-endpoint");
    expect(failedIds).toContain("runtime.error-hygiene");
    expect(formatConformanceTable(report)).toContain("Not conformant.");
  });

  it("reports a missing manifest", async () => {
    const report = await runConformance("https://nothing.example", {
      fetch: async () => new Response("nope", { status: 404 }),
    });
    expect(report.manifest).toBeNull();
    expect(report.checks[0]!.status).toBe("fail");
  });
});
