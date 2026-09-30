import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { run } from "../src/index";
import {
  formatReport,
  loadPlaywright,
  parseAuth,
  PLAYWRIGHT_MISSING,
  runCoverage,
} from "../src/surface/coverage";

// Playwright is installed for the site's tests; the CLI finds it through --playwright-from.
const site = join(__dirname, "../../../site");
const tsx = pathToFileURL(createRequire(__filename).resolve("tsx")).href;

// A stand-in for what @summationai/axe-surface/auto's coverage() returns (TODO(merge): the real shape).
const REPORT = {
  summary: { controls: 4, named: 3, withReasons: 0 },
  gaps: [
    {
      kind: "unnamed",
      selector: "#refresh",
      message: "an icon button with no accessible name",
      suggestion: { name: "Refresh the plan" },
    },
    { kind: "destructive", selector: "button.delete", message: "deletes without approval" },
  ],
  config: { controls: { "#refresh": { name: "Refresh the plan" } } },
};

const page = (body: string, script = "") =>
  `<!doctype html><html><head><title>t</title></head><body>${body}<script>${script}</script></body></html>`;

const PAGES: Record<string, string> = {
  "/": page(
    '<button id="refresh"></button><button class="delete">Delete</button><a href="/basic">Basic</a> <a href="/logout">Sign out</a> <a href="/none">None</a> <a href="https://example.com/">Elsewhere</a>',
    // Exposed a moment after load, the way a provider's effect does.
    `setTimeout(() => { window.__surface = { coverage: async () => (${JSON.stringify(REPORT)}) }; }, 150);`,
  ),
  "/basic": page(
    '<button data-surface-id="save">Save</button><button id="export">Export CSV</button><input name="note">',
    `window.__surface = { observe: () => ({ rev: 3, entries: [
      { id: "save", kind: "action", name: "Save the plan", state: { available: true } },
      { id: "lock", kind: "action", name: "", state: { available: false } }
    ] }), act: async () => ({}) };`,
  ),
  "/markdown": page(
    "",
    "window.__surface = { coverage: () => '### Controls\\n\\n2 named, 0 gaps.\\n' };",
  ),
  "/none": page("<button>Plain</button>"),
  "/attrs": page('<button data-surface-id="x" aria-label="X">X</button>'),
  "/whoami": page("", "window.__surface = { coverage: () => ({ cookie: document.cookie }) };"),
  // A provider at the app root exposes the surface at once; the route renders its content later.
  "/late": page(
    '<div id="app"></div>',
    `window.__surface = { coverage: () => ({ controls: document.querySelectorAll("#app button").length }) };
     setTimeout(() => { document.getElementById("app").innerHTML = "<button>orders</button><button>customers</button>"; }, 400);`,
  ),
};

let http: Server;
let base = "";
const visited: string[] = [];
const headersSeen: Record<string, string | undefined>[] = [];

beforeAll(async () => {
  http = createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0]!;
    visited.push(path);
    headersSeen.push({ authorization: req.headers.authorization, cookie: req.headers.cookie });
    const body = PAGES[path];
    res.statusCode = body ? 200 : 404;
    res.setHeader("content-type", "text/html");
    res.end(body ?? "not found");
  });
  await new Promise<void>((r) => http.listen(0, "127.0.0.1", () => r()));
  base = `http://127.0.0.1:${(http.address() as { port: number }).port}`;
});
afterAll(() => {
  http.closeAllConnections();
  return new Promise<void>((r) => http.close(() => r()));
});

async function cli(args: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await run(args, {
    stdout: (l) => void out.push(l),
    stderr: (l) => void err.push(l),
  });
  return { code, out: out.join("\n"), err: err.join("\n") };
}

describe("axe surface coverage: pieces", () => {
  it("parses --auth as a header or cookies", () => {
    expect(parseAuth(["Authorization: Bearer t1", "session=abc; theme=dark"], "http://h")).toEqual({
      headers: { Authorization: "Bearer t1" },
      cookies: [
        { name: "session", value: "abc", url: "http://h" },
        { name: "theme", value: "dark", url: "http://h" },
      ],
    });
    expect(parseAuth(["Cookie: a=1"], "http://h").cookies).toEqual([
      { name: "a", value: "1", url: "http://h" },
    ]);
    expect(() => parseAuth(["token"], "http://h")).toThrow("pass a header");
  });

  it("formats a report of any shape it is given", () => {
    const md = formatReport(REPORT);
    expect(md).toContain("controls 4 · named 3 · withReasons 0");
    expect(md).toContain(
      '- **unnamed** `#refresh` an icon button with no accessible name → {"name":"Refresh the plan"}',
    );
    expect(md).toContain('"#refresh": {');
    expect(formatReport({ other: true })).toContain('"other": true');
  });

  it("says how to install Playwright when it cannot be found", async () => {
    const empty = mkdtempSync(join(tmpdir(), "axe-no-playwright-"));
    await expect(loadPlaywright([empty], ["playwright-not-installed"])).rejects.toThrow(
      PLAYWRIGHT_MISSING,
    );
    expect(PLAYWRIGHT_MISSING).toContain(
      "npm install -D playwright && npx playwright install chromium",
    );
  });
});

describe("axe surface coverage: in headless Chromium", () => {
  it("crawls same-origin links (never a sign-out link), reads each page, and combines the report", async () => {
    visited.length = 0;
    const r = await runCoverage(base + "/", { resolveFrom: [site], waitMs: 3000 });
    const paths = r.pages.map((p) => new URL(p.url).pathname);
    expect(paths).toEqual(["/", "/basic", "/none"]);
    expect(visited).not.toContain("/logout");
    const [home, basic, none] = r.pages;
    expect(home!.ok).toBe(true);
    expect(home!.source).toBe("coverage");
    expect(home!.report).toEqual(REPORT);
    expect(basic!.source).toBe("basic");
    expect(basic!.markdown).toContain("window.__surface has no coverage()");
    expect(basic!.markdown).toContain("Unnamed entries: `lock`.");
    expect(basic!.markdown).toContain("Unavailable without a reason: `lock`.");
    expect(basic!.markdown).toContain("- `#export` Export CSV");
    expect(basic!.markdown).toContain("- `input[name=note]`");
    expect(basic!.markdown).not.toContain("Save");
    expect(none!.ok).toBe(false);
    expect(none!.problem).toContain("No window.__surface after 3 s and no Surface attributes");
    expect(r.markdown).toContain("# Surface coverage");
    expect(r.markdown).toContain("| / | report |");
    expect(r.markdown).toContain("| /none | no surface |");
    expect(r.markdown).toContain("## Top gaps across pages");
    expect(r.markdown).toContain("**destructive** `button.delete` deletes without approval");
  }, 60_000);

  it("visits exactly the listed routes, with the credential on every request", async () => {
    headersSeen.length = 0;
    const r = await runCoverage(base, {
      resolveFrom: [site],
      routes: ["/markdown", "/attrs", "/whoami"],
      auth: ["Authorization: Bearer t1", "session=abc"],
      waitMs: 500,
    });
    expect(r.pages.map((p) => new URL(p.url).pathname)).toEqual(["/markdown", "/attrs", "/whoami"]);
    expect(r.pages[0]!.markdown).toBe("### Controls\n\n2 named, 0 gaps.\n");
    expect(r.pages[1]!.problem).toContain(
      "The page carries Surface attributes (1 element(s) with data-surface-id) but no window.__surface: expose is off.",
    );
    expect(r.pages[2]!.report).toEqual({ cookie: "session=abc" });
    expect(headersSeen.every((h) => h.authorization === "Bearer t1")).toBe(true);
  }, 60_000);

  it("reads a page once it has settled, not the moment its surface appears", async () => {
    const r = await runCoverage(base, { resolveFrom: [site], routes: ["/late"], waitMs: 5000 });
    expect(r.pages[0]!.report).toEqual({ controls: 2 });
  }, 60_000);

  it("--state loads a saved session (axe host login's storage state) before the first page", async () => {
    const dir = mkdtempSync(join(tmpdir(), "axe-coverage-state-"));
    const file = join(dir, "host-state.json");
    const { hostname } = new URL(base);
    writeFileSync(
      file,
      JSON.stringify({
        cookies: [
          {
            name: "session",
            value: "saved",
            domain: hostname,
            path: "/",
            expires: -1,
            httpOnly: false,
            secure: false,
            sameSite: "Lax",
          },
        ],
        origins: [],
      }),
    );
    const r = await runCoverage(base, {
      resolveFrom: [site],
      routes: ["/whoami"],
      waitMs: 500,
      state: file,
    });
    expect(r.pages[0]!.report).toEqual({ cookie: "session=saved" });
    const missing: string[] = [];
    const code = await run(["surface", "coverage", base, "--state", join(dir, "nope.json")], {
      stdout: () => undefined,
      stderr: (l) => void missing.push(l),
    });
    expect(code).toBe(1);
    expect(missing.join("\n")).toContain("axe host login");
  }, 60_000);

  it("the command prints Markdown or JSON, writes --out, and fails when no page has a surface", async () => {
    const dir = mkdtempSync(join(tmpdir(), "axe-coverage-"));
    const md = await cli([
      "surface",
      "coverage",
      base,
      "--routes",
      "/,/none",
      "--wait",
      "2000",
      "--playwright-from",
      site,
      "--out",
      join(dir, "report.md"),
    ]);
    expect(md.code, md.err).toBe(0);
    expect(md.out).toContain("# Surface coverage");
    expect(readFileSync(join(dir, "report.md"), "utf8")).toContain("## /none");
    const json = await cli([
      "surface",
      "coverage",
      base,
      "--routes",
      "/basic",
      "--json",
      "--playwright-from",
      site,
    ]);
    expect(json.code).toBe(0);
    const parsed = JSON.parse(json.out) as { pages: { source: string }[] };
    expect(parsed.pages[0]!.source).toBe("basic");
    const none = await cli([
      "surface",
      "coverage",
      `${base}/none`,
      "--routes",
      "/none",
      "--wait",
      "200",
      "--playwright-from",
      site,
    ]);
    expect(none.code).toBe(1);
    expect(none.err).toContain("No page had a surface.");
    expect(none.err).toContain("an explicitly configured --flag check is false");
  }, 60_000);

  it("names what to install when Playwright is missing", () => {
    // A child process without the NODE_PATH pnpm sets, started outside the repository.
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      AXE_CLI_MAIN: "1",
    };
    delete env["NODE_PATH"];
    const r = spawnSync(
      process.execPath,
      ["--import", tsx, join(__dirname, "../src/index.ts"), "surface", "coverage", base],
      { cwd: mkdtempSync(join(tmpdir(), "axe-no-playwright-")), env, encoding: "utf8" },
    );
    expect(r.status, r.stderr).toBe(1);
    expect(r.stderr).toContain("npm install -D playwright && npx playwright install chromium");
  }, 30_000);
});
