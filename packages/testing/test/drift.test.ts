import { describe, expect, it } from "vitest";
import { join } from "node:path";
import {
  checkVocabularyDrift,
  formatDriftReport,
  wireLikeNames,
  inlineCodeSpans,
  htmlCodeSpans,
  jsStringLiterals,
} from "../src/drift";

const root = join(__dirname, "../../..");

describe("vocabulary drift", () => {
  it("classifies code spans", () => {
    expect(wireLikeNames("/axe/actions/{name}")).toEqual([
      { name: "/axe/actions", categories: ["path"] },
    ]);
    expect(wireLikeNames("AXE-Protocol")[0]!.name).toBe("AXE-Protocol");
    expect(wireLikeNames("axe_continue")[0]!.categories).toEqual(["tool", "query"]);
    expect(wireLikeNames("axe audit --json")[0]!.name).toBe("axe audit");
    expect(wireLikeNames("continuationToken")[0]!.categories).toEqual(["field", "api"]);
    expect(wireLikeNames("needs_input")[0]!.categories).toContain("status");
    expect(wireLikeNames("payment.ach-debit")[0]!.categories).toEqual(["kind"]);
    expect(wireLikeNames("display.item.url")).toEqual([]);
    expect(wireLikeNames("policies.rateLimit")).toEqual([
      { name: "rateLimit", categories: ["field", "api"] },
    ]);
    expect(wireLikeNames("units.search")).toEqual([]);
    expect(wireLikeNames("x-oakridge.guarantor-form")).toEqual([]);
    expect(wireLikeNames("rentUsd")[0]!.name).toBe("rentUsd");
    expect(wireLikeNames("Some prose")).toEqual([]);
    expect(inlineCodeSpans("a `b` c\n```\n`ignored`\n```\n`d`")).toEqual(["b", "d"]);
    expect(
      htmlCodeSpans('<p>x <code>needs_input</code> and <code class="k">&lt;a&gt;</code></p>'),
    ).toEqual(["needs_input", "<a>"]);
    expect(
      jsStringLiterals("var a = \"continuationToken\"; var b = 'two words'; f(`axe_continue`);"),
    ).toEqual(["continuationToken", "axe_continue"]);
  });

  it("the repository has no vocabulary drift, including the site sources", () => {
    const report = checkVocabularyDrift({ root, sitePaths: ["site/src"] });
    expect(report.ok, "\n" + formatDriftReport(report)).toBe(true);
    expect(report.allowlist.length).toBeLessThan(15);
  });
});
