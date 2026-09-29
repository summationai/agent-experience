#!/usr/bin/env node
// Layout-dependent behavior of autoSurface in a real browser (headless Chromium through the
// site's Playwright install): stylesheet visibility through checkVisibility, focus after an act,
// and a scrolling list that loads more. Not part of `pnpm -r test`, since it needs a browser:
//   pnpm --filter @summationai/axe-surface test:browser
// (first run: pnpm --filter body-spray-site exec playwright install chromium)
import { build } from "esbuild";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, "../..");
const require = createRequire(join(pkg, "../../site/package.json"));
const { chromium } = require("playwright");

const bundled = await build({
  stdin: {
    contents: `import { autoSurface, formatCoverage } from "./src/auto.ts"; window.AutoSurface = { autoSurface, formatCoverage };`,
    resolveDir: pkg,
    loader: "ts",
  },
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  target: "es2022",
  logLevel: "silent",
});
const script = bundled.outputFiles[0].text;
const html = readFileSync(join(here, "fixture.html"), "utf8");

const browser = await chromium.launch({ headless: true });
let failed = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` ${detail}`}`);
  if (!ok) failed++;
};
try {
  const page = await browser.newPage();
  await page.route("http://fixture.test/", (r) =>
    r.fulfill({ contentType: "text/html", body: html }),
  );
  await page.goto("http://fixture.test/");
  await page.addScriptTag({ content: script });
  const result = await page.evaluate(async () => {
    const h = window.AutoSurface.autoSurface({
      observe: { debounceMs: 0, settle: { quietMs: 30, timeoutMs: 500 } },
    });
    const s = h.surface;
    const names = () => s.observe().entries.map((r) => r.name);
    const find = (n) => s.observe().entries.find((r) => r.name === n);
    const out = { layoutNames: names() };
    const refresh = find("Refresh");
    out.click = (
      await s.act({ op: "CLICK", target: refresh.id, expectedRev: s.currentRev() })
    ).status;
    out.focusAfterClick = document.activeElement && document.activeElement.id;
    const q = find("Query");
    out.type = (
      await s.act({ op: "TYPE_TEXT", target: q.id, text: "hello", expectedRev: s.currentRev() })
    ).status;
    out.focusAfterType = document.activeElement && document.activeElement.id;
    out.value = find("Query").value;
    const list = find("Results");
    out.listAvailable = list.index !== null;
    out.loadedBefore = list.loaded;
    out.more = (
      await s.act({ op: "SCROLL_DOWN", target: list.id, expectedRev: s.currentRev() })
    ).status;
    out.more2 = (
      await s.act({ op: "SCROLL_DOWN", target: list.id, expectedRev: s.currentRev() })
    ).status;
    out.loadedAfter = find("Results").loaded;
    out.layout = h.coverage().counts.entries > 0;
    h.stop();
    return out;
  });
  check(
    "a control hidden by a stylesheet is not derived",
    !result.layoutNames.includes("Hidden by a stylesheet"),
    JSON.stringify(result.layoutNames),
  );
  check(
    "a visibility:hidden control is not derived",
    !result.layoutNames.includes("Invisible"),
    JSON.stringify(result.layoutNames),
  );
  check("a shown control is derived", result.layoutNames.includes("Refresh"));
  check("click runs", result.click === "ok");
  check(
    "focus moves to the clicked control",
    result.focusAfterClick === "shown",
    String(result.focusAfterClick),
  );
  check(
    "typing runs and focuses the field",
    result.type === "ok" && result.focusAfterType === "q",
    JSON.stringify(result),
  );
  check("the typed value is observed", result.value === "hello", String(result.value));
  check(
    "a scrolling list can load more",
    result.listAvailable === true && result.more === "ok" && result.more2 === "ok",
    JSON.stringify(result),
  );
  check(
    "scrolling loaded more rows",
    result.loadedAfter > result.loadedBefore,
    `${result.loadedBefore} -> ${result.loadedAfter}`,
  );
} finally {
  await browser.close();
}
if (failed) {
  console.error(`${failed} browser check(s) failed`);
  process.exit(1);
}
console.log("autoSurface browser checks passed");
