/**
 * A skipped or unexercised check is not a pass: it must not add points to the score,
 * appear as earned in the JSON report, or give a category its maximum by default.
 * Every test here failed before review item 18 (see docs/review/2026-09-24/18-claims-and-roadmap.md).
 */
import { describe, expect, it } from "vitest";
import type { Manifest } from "@axe/core/types";
import { runAudit } from "../src/audit/index";
import { formatAuditTable, formatAuditHtml } from "../src/audit/format";
import { createAXE, action, handoff, z } from "@axe/core";
import { formatConformanceTable, runConformance } from "../src/conformance/index";
import { BAD_MANIFEST, badFetch } from "./fixtures/bad-manifest";

/** Nothing is served: no manifest, no robots.txt, no pages. */
const nothingFetch = async () => new Response("not found", { status: 404 });

/** Serves one manifest; every other path is a 404. */
function manifestOnly(m: unknown) {
  return async (input: string | URL) => {
    const url = new URL(String(input));
    if (url.pathname === "/.well-known/axe.json")
      return new Response(JSON.stringify(m), {
        headers: { "content-type": "application/json", "cache-control": "max-age=300" },
      });
    return new Response("not found", { status: 404 });
  };
}

describe("audit: skipped checks are not passes", () => {
  it("a URL that serves no manifest scores 0, not the maxima of the categories it could not check", async () => {
    const report = await runAudit("https://nothing.example", { fetch: nothingFetch });
    const table = formatAuditTable(report);
    expect(report.score, table).toBe(0);
    for (const id of ["describable", "presentable", "actionable", "trustworthy"]) {
      const cat = report.categories.find((c) => c.id === id)!;
      expect(cat.scored, id).toBe(false);
      expect(cat.score, id).toBe(0);
    }
    expect(table).toContain("not scored");
  });

  it("a skipped check reports earned 0 and is listed as skipped", async () => {
    const report = await runAudit("https://bestshop.example", { fetch: badFetch() });
    const skipped = report.categories.flatMap((c) => c.checks).filter((k) => k.status === "skip");
    expect(skipped.length).toBeGreaterThan(0);
    for (const k of skipped) expect(k.earned, k.id).toBe(0);
  });

  it("a category with no scored check is left out of the total instead of earning its maximum", async () => {
    // One mutating action with no display and no list-returning read: every Presentable check skips.
    const m: Manifest = {
      ...BAD_MANIFEST,
      description:
        "Start a return for an order placed in the last 30 days. Returns an RMA id to put on the parcel.",
      actions: [BAD_MANIFEST.actions[2]!],
    };
    const report = await runAudit("https://bestshop.example", { fetch: manifestOnly(m) });
    const presentable = report.categories.find((c) => c.id === "presentable")!;
    expect(presentable.checks.every((k) => k.status === "skip")).toBe(true);
    expect(presentable.scored).toBe(false);
    const scored = report.categories.filter((c) => c.scored);
    const expected = Math.round(
      (scored.reduce((n, c) => n + c.score, 0) / scored.reduce((n, c) => n + c.max, 0)) * 100,
    );
    expect(report.score).toBe(expected);
  });

  it("checks that count actions or fields skip, not pass, when there is nothing to count", async () => {
    const m: Manifest = { ...BAD_MANIFEST, actions: [] };
    const report = await runAudit("https://bestshop.example", { fetch: manifestOnly(m) });
    const byId = Object.fromEntries(
      report.categories.flatMap((c) => c.checks).map((k) => [k.id, k.status]),
    );
    for (const id of [
      "describable.examples-present",
      "describable.input-descriptions",
      "describable.structured-filters",
      "actionable.graph-connected",
    ])
      expect(byId[id], id).toBe("skip");
  });

  it("presentable.pointers-resolve scores only the halves that ran", async () => {
    // A display whose pointers resolve to nothing, on a read the suite cannot call (auth user,
    // no --auth), so the live round trip skips. The static half fails; the live half must not
    // contribute a free half point.
    const read = BAD_MANIFEST.actions[0]!;
    const m: Manifest = {
      ...BAD_MANIFEST,
      auth: { modes: ["none", "user"], userLoginUrl: "https://bestshop.example/login" },
      actions: [
        {
          ...read,
          auth: "user",
          display: { kind: "list", items: "/missing", item: { id: "/id", title: "/name" } },
          examples: [{ input: { query: "socks" }, output: { products: [] } }],
        },
      ],
    };
    const report = await runAudit("https://bestshop.example", { fetch: manifestOnly(m) });
    const check = report.categories
      .flatMap((c) => c.checks)
      .find((k) => k.id === "presentable.pointers-resolve")!;
    expect(
      report.conformance.checks.find((c) => c.id === "manifest.display-pointers")?.status,
    ).toBe("fail");
    expect(check.earned, check.detail).toBe(0);
    expect(check.status).toBe("fail");
    expect(check.detail).toMatch(/not run/i);
  });

  it("the text and HTML reports say what a score is not", async () => {
    const report = await runAudit("https://bestshop.example", { fetch: badFetch() });
    const skippedCount = report.categories
      .flatMap((c) => c.checks)
      .filter((k) => k.status === "skip").length;
    for (const out of [formatAuditTable(report), formatAuditHtml(report)]) {
      expect(out).toMatch(/not a security review/i);
      expect(out).toMatch(/not evidence of/i);
      expect(out).toContain(`${skippedCount} skipped`);
      expect(out).toContain("docs/audit.md#what-a-score-does-not-mean");
    }
  });

  it("the conformance table says skipped checks were not verified", async () => {
    const report = await runAudit("https://bestshop.example", { fetch: badFetch() });
    const table = formatConformanceTable(report.conformance);
    expect(report.conformance.skipped).toBeGreaterThan(0);
    expect(table).toMatch(/skipped checks were not verified/i);
  });
});

describe("conformance: ladder.needs-human-avoidable judges only what it observed", () => {
  const site = (reason: string) => {
    const axe = createAXE({
      name: "Handoff Site",
      description:
        "Submit a request that a person must finish on the site. Returns a handoff to the page where they finish it.",
      baseUrl: "https://handoff.example",
      auth: { modes: ["none"] },
      secret: "a-test-secret-that-is-long-enough-0123456789",
    });
    axe.register(
      action("requests.submit", {
        title: "Submit a request",
        description:
          "Submit a request for review. A person finishes it on the site; returns a handoff to that page.",
        readOnly: false,
        idempotent: false,
        reversible: false,
        risk: "low",
        input: z.object({ note: z.string().describe("What the request is about") }),
        output: z.object({ id: z.string() }),
        examples: [{ input: { note: "hello" }, output: { id: "r_1" } }],
        handler: async () =>
          handoff({
            reason,
            instructions: "Open the page and finish the request.",
            url: "https://handoff.example/requests/new",
            whatAgentShouldSayToUser: "Please finish this on the site.",
          }),
      }),
    );
    return (input: string | URL, init?: RequestInit) => axe.handle(new Request(input, init));
  };

  it("fails a needs_human whose reason a well-known kind covers, and passes one it does not", async () => {
    const statusFor = async (reason: string) =>
      (await runConformance("https://handoff.example", { fetch: site(reason) })).checks.find(
        (c) => c.id === "ladder.needs-human-avoidable",
      )?.status;
    expect(await statusFor("payment_required")).toBe("fail");
    expect(await statusFor("signature_required")).toBe("pass");
  });

  it("skips when no needs_human was observed", async () => {
    const report = await runAudit("https://bestshop.example", { fetch: badFetch() });
    expect(
      report.conformance.checks.find((c) => c.id === "ladder.needs-human-avoidable")?.status,
    ).toBe("skip");
    const check = report.categories
      .flatMap((c) => c.checks)
      .find((k) => k.id === "actionable.needs-input-first")!;
    expect(check.status).toBe("skip");
  });
});
