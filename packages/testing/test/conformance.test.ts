import { describe, expect, it } from "vitest";
import { runConformance, formatConformanceTable } from "../src/conformance/index";
import { apartmentsAXE } from "../../core/test/fixtures/apartments";
import { liveAXE } from "../../core/test/fixtures/live";
import { badFetch } from "./fixtures/bad-manifest";
import { badLiveFetch } from "./fixtures/bad-live";

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
      "runtime.body-limit",
      "runtime.nesting-limit",
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

  it("runtime.json-content-type passes by default and fails when a text/plain write is accepted", async () => {
    const statusOf = async (overrides: Parameters<typeof apartmentsAXE>[0]) => {
      const { axe } = apartmentsAXE(overrides);
      const report = await runConformance("https://oakridge-rentals.example", {
        fetch: inProcess(axe),
        auth: "user:dana",
      });
      return report.checks.find((c) => c.id === "runtime.json-content-type")?.status;
    };
    expect(await statusOf({})).toBe("pass");
    expect(await statusOf({ requestPolicy: { requireJsonContentType: false } })).toBe("fail");
  });

  it("runtime.body-limit passes by default and fails when the server reads a 32 MiB body in full", async () => {
    const statusOf = async (overrides: Parameters<typeof apartmentsAXE>[0]) => {
      const { axe } = apartmentsAXE(overrides);
      const report = await runConformance("https://oakridge-rentals.example", {
        fetch: inProcess(axe),
        auth: "user:dana",
      });
      return report.checks.find((c) => c.id === "runtime.body-limit")?.status;
    };
    expect(await statusOf({})).toBe("pass");
    expect(await statusOf({ maxBodyBytes: 64 * 1024 * 1024 })).toBe("fail");
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

  it("live checks skip on a site without live state, and pass on one with it", async () => {
    const { axe } = apartmentsAXE();
    const plain = await runConformance("https://oakridge-rentals.example", {
      fetch: inProcess(axe),
      auth: "user:dana",
    });
    for (const c of plain.checks.filter((c) => c.id.startsWith("live.")))
      expect(c.status, c.id).toBe("skip");
    expect(plain.observations.liveState).toBeNull();

    const { axe: live } = liveAXE();
    const report = await runConformance("https://ember-yoga.example", {
      fetch: (i, init) => live.handle(new Request(i, init)),
      auth: "user:sam",
    });
    const byId = Object.fromEntries(report.checks.map((c) => [c.id, c]));
    for (const id of [
      "live.state-endpoint",
      "live.rev-on-envelopes",
      "live.stale-conflict",
      "live.fresh-accepted",
      "live.reasons",
      "live.availability-honored",
    ]) {
      expect(byId[id]!.status, `${id}: ${byId[id]!.detail}`).toBe("pass");
    }
    expect(byId["live.availability-honored"]!.detail).toContain("1 unavailable action(s) refused");
    expect(typeof report.observations.liveState?.rev).toBe("number");
    expect(report.failed).toBe(0);
  });

  it("live checks fail on a site that advertises live state and gets it wrong", async () => {
    const report = await runConformance("https://sloppy-live.example", { fetch: badLiveFetch() });
    const byId = Object.fromEntries(report.checks.map((c) => [c.id, c]));
    expect(byId["live.state-endpoint"]!.status).toBe("fail");
    expect(byId["live.state-endpoint"]!.detail).toContain("no-store");
    expect(byId["live.rev-on-envelopes"]!.status).toBe("fail");
    expect(byId["live.stale-conflict"]!.status).toBe("fail");
    expect(byId["live.reasons"]!.status).toBe("fail");
    expect(byId["live.reasons"]!.detail).toContain("Agent-directed text");
    expect(byId["live.availability-honored"]!.status).toBe("fail");
    expect(byId["live.availability-honored"]!.detail).toContain("things.do");
  });

  it("reports a missing manifest", async () => {
    const report = await runConformance("https://nothing.example", {
      fetch: async () => new Response("nope", { status: 404 }),
    });
    expect(report.manifest).toBeNull();
    expect(report.checks[0]!.status).toBe("fail");
  });
});
