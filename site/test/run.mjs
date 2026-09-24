#!/usr/bin/env node
// Site tests. Usage: node test/run.mjs [--update-screenshots] [--only <name>]
//   reproducible  build twice into temp dirs; byte-identical output
//   offline       every page loads from file:// with all network aborted; no console errors, failed requests, or broken images
//   links         every href/src in dist resolves (re-runs the build's link checker)
//   demos         the ladder plays both paths; an arc selection binds the unit id
//   screenshots   4 widths × 2 themes of index.html, compared with committed baselines
//   lighthouse    ≥ 95 in all four categories on index.html and one docs page
import {
  readFileSync,
  readdirSync,
  statSync,
  existsSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { chromium, firefox, webkit } from "playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { build, checkLinks } from "../build.mjs";

const SITE = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const DIST = join(SITE, "dist");
const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const updateShots = args.includes("--update-screenshots");
const results = [];

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const pages = () =>
  walk(DIST)
    .filter((f) => f.endsWith(".html"))
    .sort();
const fileUrl = (p) => pathToFileURL(p).href;

async function test(name, fn) {
  if (only && only !== name) return;
  const start = Date.now();
  try {
    const note = await fn();
    results.push({ name, ok: true, note });
    console.log(`PASS ${name}${note ? `  ${note}` : ""}  (${Date.now() - start} ms)`);
  } catch (e) {
    results.push({ name, ok: false, note: e.message });
    console.error(`FAIL ${name}\n${e.stack ?? e.message}`);
  }
}

function hashTree(dir) {
  const h = createHash("sha256");
  for (const f of walk(dir).sort()) {
    if (f.endsWith("og.png")) continue; // Rendered by a browser; compared by presence, not bytes.
    h.update(relative(dir, f));
    h.update(readFileSync(f));
  }
  return h.digest("hex");
}

// --- reproducible -------------------------------------------------------------
await test("reproducible", async () => {
  const a = join(tmpdir(), `axe-site-a-${process.pid}`);
  const b = join(tmpdir(), `axe-site-b-${process.pid}`);
  await build({ out: a, skipOg: true, log: () => {} });
  await build({ out: b, skipOg: true, log: () => {} });
  const ha = hashTree(a);
  const hb = hashTree(b);
  rmSync(a, { recursive: true, force: true });
  rmSync(b, { recursive: true, force: true });
  if (ha !== hb) throw new Error("two builds produced different output");
  // The committed dist must match a fresh build as well (freshness).
  const c = join(tmpdir(), `axe-site-c-${process.pid}`);
  await build({ out: c, skipOg: true, log: () => {} });
  const hc = hashTree(c);
  rmSync(c, { recursive: true, force: true });
  if (hc !== hashTree(DIST))
    throw new Error("site/dist is out of date; run pnpm site:build and commit");
  return `${hashTree(DIST).slice(0, 12)}`;
});

// --- offline ------------------------------------------------------------------
async function loadOffline(browser, url, { checkImages = true } = {}) {
  const context = await browser.newContext();
  await context.route("**/*", (route) => {
    const u = route.request().url();
    if (u.startsWith("file://")) return route.continue();
    return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  const problems = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("requestfailed", (r) =>
    problems.push(`request failed: ${r.url()} (${r.failure()?.errorText})`),
  );
  await page.goto(url, { waitUntil: "load" });
  if (checkImages) {
    const broken = await page.$$eval("img", (imgs) =>
      imgs
        .filter((i) => i.complete && i.naturalWidth === 0 && !i.closest("[hidden]"))
        .map((i) => i.getAttribute("src")),
    );
    for (const b of broken) problems.push(`broken image: ${b}`);
  }
  const title = await page.title();
  await context.close();
  return { problems, title };
}

await test("offline", async () => {
  const all = pages();
  const browser = await chromium.launch();
  const problems = [];
  try {
    for (const p of all) {
      const r = await loadOffline(browser, fileUrl(p));
      for (const x of r.problems) problems.push(`${relative(DIST, p)}: ${x}`);
    }
  } finally {
    await browser.close();
  }
  if (problems.length) throw new Error(problems.slice(0, 20).join("\n"));
  // Cross-browser smoke: the landing page and one docs page in Firefox and WebKit.
  const smoke = [join(DIST, "index.html"), join(DIST, "docs/concepts.html")];
  for (const launcher of [firefox, webkit]) {
    let b;
    try {
      b = await launcher.launch();
    } catch (e) {
      console.warn(`  (skipping ${launcher.name()}: ${e.message.split("\n")[0]})`);
      continue;
    }
    try {
      for (const p of smoke) {
        const r = await loadOffline(b, fileUrl(p));
        if (r.problems.length)
          throw new Error(`${launcher.name()} ${relative(DIST, p)}: ${r.problems.join("; ")}`);
      }
    } finally {
      await b.close();
    }
  }
  return `${all.length} pages`;
});

// --- links --------------------------------------------------------------------
await test("links", async () => {
  const pageMap = new Map(pages().map((p) => [relative(DIST, p).split("\\").join("/"), {}]));
  const problems = checkLinks(DIST, pageMap);
  if (problems.length) throw new Error(problems.slice(0, 20).join("\n"));
  return `${pageMap.size} pages checked`;
});

// --- demos --------------------------------------------------------------------
await test("demos", async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      reducedMotion: "reduce",
      viewport: { width: 1280, height: 900 },
    });
    await page.goto(fileUrl(join(DIST, "index.html")), { waitUntil: "load" });
    // Data loads when the demos approach the viewport.
    await page.locator("#ladder-demo").scrollIntoViewIfNeeded();
    await page.waitForFunction(
      () => document.getElementById("ladder-demo").getAttribute("data-ready") === "true",
    );
    const statuses = async (path) => {
      await page.click(`[role=tab][data-path="${path}"]`);
      await page.click("#ladder-reset");
      const seen = [];
      for (let i = 0; i < 4; i++) {
        await page.click("#ladder-step");
        seen.push(await page.getAttribute("#ladder-demo", "data-status"));
      }
      return seen;
    };
    const wallet = await statuses("wallet");
    const handoff = await statuses("handoff");
    const expectWallet = ["request", "needs_input", "request", "ok"];
    const expectHandoff = ["request", "needs_input", "request", "ok"];
    if (JSON.stringify(wallet) !== JSON.stringify(expectWallet))
      throw new Error(`wallet path statuses ${JSON.stringify(wallet)}`);
    if (JSON.stringify(handoff) !== JSON.stringify(expectHandoff))
      throw new Error(`handoff path statuses ${JSON.stringify(handoff)}`);
    // The handoff path's second envelope carries a fallback with a resumeToken; the third step resumes.
    await page.click(`[role=tab][data-path="handoff"]`);
    await page.click("#ladder-reset");
    await page.click("#ladder-step");
    await page.click("#ladder-step");
    const envelope = await page.textContent("#ladder-envelope");
    if (!envelope.includes('"fallback"') || !envelope.includes('"resumeToken"'))
      throw new Error("handoff path does not show the fallback handoff");
    await page.click("#ladder-step");
    const resume = await page.textContent("#ladder-envelope");
    if (!resume.includes('"resumeToken"')) throw new Error("third step is not the resume request");
    // Arc selection binds the unit id into the ladder.
    const frame = page.frameLocator("iframe.arc-frame");
    await frame
      .locator('button[data-axe-action="applications.submit"][data-axe-item="u_204"]')
      .first()
      .click();
    await page.waitForFunction(
      () => document.getElementById("ladder-demo").getAttribute("data-bound-unit") === "u_204",
    );
    const req = await page.textContent("#ladder-envelope");
    if (!req.includes('"unitId": "u_204"'))
      throw new Error("bound unit id not in the request envelope");
    // A different unit through the same channel.
    await page.evaluate(() =>
      window.axeSelect({
        itemId: "u_310",
        action: "applications.submit",
        input: { unitId: "u_310" },
      }),
    );
    await page.waitForFunction(
      () => document.getElementById("ladder-demo").getAttribute("data-bound-unit") === "u_310",
    );
    const req2 = await page.textContent("#ladder-envelope");
    if (!req2.includes('"unitId": "u_310"'))
      throw new Error("second bound unit id not in the request envelope");
    // Copy button and theme toggle do not throw.
    await page.click(".theme-toggle");
    const theme = await page.getAttribute("html", "data-theme");
    if (!theme) throw new Error("theme toggle did not set data-theme");
    // Keyboard: search opens with "/" and closes with Escape.
    await page.keyboard.press("/");
    if (!(await page.isVisible("#search-dialog"))) throw new Error("search dialog did not open");
    await page.fill(".search-input", "handoff");
    const count = await page.locator(".search-results a").count();
    if (count === 0) throw new Error("search returned nothing for 'handoff'");
    await page.keyboard.press("Escape");
    return `wallet ${wallet.join("→")}; handoff ${handoff.join("→")}; search ${count} results`;
  } finally {
    await browser.close();
  }
});

// --- screenshots --------------------------------------------------------------
await test("screenshots", async () => {
  const dir = join(SITE, "test/__screenshots__");
  mkdirSync(dir, { recursive: true });
  const platformFile = join(dir, "platform.txt");
  const platform = `${process.platform}-${process.arch}`;
  const baselinePlatform = existsSync(platformFile)
    ? readFileSync(platformFile, "utf8").trim()
    : null;
  const browser = await chromium.launch();
  const diffs = [];
  let compared = 0;
  try {
    for (const width of [375, 768, 1280, 1920]) {
      for (const scheme of ["light", "dark"]) {
        const page = await browser.newPage({
          viewport: { width, height: 900 },
          colorScheme: scheme,
          reducedMotion: "reduce",
          deviceScaleFactor: 1,
        });
        await page.goto(fileUrl(join(DIST, "index.html")), { waitUntil: "load" });
        // Full-page screenshots should include the demos: bring the data in first.
        await page.locator("#ladder-demo").scrollIntoViewIfNeeded();
        await page.waitForFunction(
          () => document.getElementById("ladder-demo").getAttribute("data-ready") === "true",
        );
        await page.waitForSelector("iframe.arc-frame[srcdoc]");
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(300);
        const shot = await page.screenshot({ fullPage: true, type: "png" });
        await page.close();
        const file = join(dir, `index-${width}-${scheme}.png`);
        if (updateShots || !existsSync(file)) {
          writeFileSync(file, shot);
          continue;
        }
        if (baselinePlatform && baselinePlatform !== platform) continue;
        const a = PNG.sync.read(readFileSync(file));
        const b = PNG.sync.read(shot);
        if (a.width !== b.width || a.height !== b.height) {
          diffs.push(
            `${relative(SITE, file)}: size ${a.width}x${a.height} → ${b.width}x${b.height}`,
          );
          writeFileSync(file.replace(/\.png$/, ".actual.png"), shot);
          continue;
        }
        const diff = pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: 0.12 });
        const ratio = diff / (a.width * a.height);
        compared++;
        if (ratio > 0.01) {
          diffs.push(`${relative(SITE, file)}: ${(ratio * 100).toFixed(2)}% of pixels differ`);
          writeFileSync(file.replace(/\.png$/, ".actual.png"), shot);
        }
      }
    }
  } finally {
    await browser.close();
  }
  if (updateShots || !baselinePlatform) writeFileSync(platformFile, platform + "\n");
  if (diffs.length) throw new Error(diffs.join("\n"));
  if (baselinePlatform && baselinePlatform !== platform)
    return `baselines are from ${baselinePlatform}; comparison skipped on ${platform}`;
  return `${compared} compared`;
});

// --- lighthouse ---------------------------------------------------------------
await test("lighthouse", async () => {
  const { default: lighthouse } = await import("lighthouse");
  const chromeLauncher = await import("chrome-launcher");
  const server = createServer((req, res) => {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path.endsWith("/")) path += "index.html";
    const file = join(DIST, path);
    if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) {
      res.statusCode = 404;
      res.end("not found");
      return;
    }
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css",
      ".js": "text/javascript",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".txt": "text/plain",
    };
    const ext = file.slice(file.lastIndexOf("."));
    res.setHeader("content-type", types[ext] ?? "application/octet-stream");
    res.setHeader("cache-control", "public, max-age=3600");
    res.end(readFileSync(file));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  let chrome;
  try {
    chrome = await chromeLauncher.launch({
      chromeFlags: ["--headless=new", "--no-sandbox"],
      chromePath: process.env.CHROME_PATH || chromium.executablePath(),
    });
  } catch (e) {
    server.close();
    throw new Error(`could not launch Chrome for Lighthouse: ${e.message}`);
  }
  const notes = [];
  try {
    for (const path of ["/index.html", "/docs/concepts.html"]) {
      // Lighthouse's simulated metrics vary a little between runs; take the best of two, as Lighthouse itself recommends.
      let result = null;
      let scores = {};
      for (let attempt = 0; attempt < 2; attempt++) {
        const run = await lighthouse(`http://127.0.0.1:${port}${path}`, {
          port: chrome.port,
          output: "json",
          logLevel: "error",
          onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
          formFactor: "desktop",
          screenEmulation: {
            mobile: false,
            width: 1280,
            height: 900,
            deviceScaleFactor: 1,
            disabled: false,
          },
        });
        const s = Object.fromEntries(
          Object.entries(run.lhr.categories).map(([k, v]) => [k, Math.round((v.score ?? 0) * 100)]),
        );
        if (!result || Math.min(...Object.values(s)) > Math.min(...Object.values(scores))) {
          result = run;
          scores = s;
        }
        if (Math.min(...Object.values(scores)) >= 95) break;
      }
      notes.push(
        `${path}: ${Object.entries(scores)
          .map(([k, v]) => `${k} ${v}`)
          .join(", ")}`,
      );
      const low = Object.entries(scores).filter(([, v]) => v < 95);
      if (low.length) {
        const failing = Object.values(result.lhr.audits)
          .filter(
            (a) =>
              a.score !== null &&
              a.score < 1 &&
              low.some(([cat]) =>
                result.lhr.categories[cat].auditRefs.some((r) => r.id === a.id && r.weight > 0),
              ),
          )
          .map((a) => `  - ${a.id}: ${a.title}`);
        throw new Error(
          `${path} scored below 95: ${low.map(([k, v]) => `${k} ${v}`).join(", ")}\n${failing.join("\n")}`,
        );
      }
    }
  } finally {
    await chrome.kill();
    server.close();
  }
  return notes.join(" | ");
});

console.log("");
const failed = results.filter((r) => !r.ok);
console.log(`${results.length - failed.length} passed, ${failed.length} failed`);
if (failed.length) process.exit(1);
