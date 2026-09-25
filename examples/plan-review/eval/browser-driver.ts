// Variants v1 and v2: an agent that drives the page in Chromium through Playwright, as a
// browser-driving agent would. v1 finds controls by visible text and table position; v2 finds
// them by accessible name and reads the Surface DOM mirror's reason attribute. Neither calls
// window.__surface or any endpoint: everything goes through the rendered page.
import type { Browser, BrowserContext, Locator, Page } from "@playwright/test";
import { monthLabel } from "../lib/model";
import { cellKey } from "../lib/model";
import type { CellTarget } from "./scenarios";
import type { Change, Driver, LockRequest, Observation, WriteResult } from "./policy";
import { PageChanged } from "./policy";
import type { Meter } from "./meter";
import { byteLength } from "./meter";

export type Markup = "generic" | "semantic";

export interface BrowserDriverOptions {
  browser: Browser;
  base: string;
  markup: Markup;
  meter: Meter;
  /** Lose the response to the first save (the lost-response fault). */
  loseFirstSave?: boolean;
  /** Navigate the tab away from the plan (the navigation fault), exposed to the scenario. */
  onPage?: (page: Page) => void;
  /** How long to wait for a control or an outcome before giving up on it. */
  timeoutMs?: number;
}

const SAVED = /^Saved \d+ change/;
const STALE = /changed since you loaded it/;

export async function openBrowserDriver(o: BrowserDriverOptions): Promise<Driver> {
  const timeout = o.timeoutMs ?? 4000;
  const context: BrowserContext = await o.browser.newContext({ baseURL: o.base });
  context.setDefaultTimeout(timeout);
  const pending: Promise<void>[] = [];
  context.on("requestfinished", (req) => {
    const url = req.url();
    if (url.includes("/_next/static/")) return; // cached script and style assets
    o.meter.httpRequests++;
    pending.push(
      req.sizes().then(
        (s) => {
          o.meter.httpBytesOut += s.requestBodySize;
          o.meter.httpBytesIn += s.responseBodySize;
        },
        () => {},
      ),
    );
  });
  context.on("requestfailed", (req) => {
    if (!req.url().includes("/_next/static/")) o.meter.httpRequests++;
  });
  const page = await context.newPage();
  if (o.loseFirstSave) {
    let lost = false;
    await page.route("**/api/plan/values", async (route) => {
      if (lost) return route.continue();
      lost = true;
      await route.fetch(); // the server applies the save
      await route.abort("failed"); // the page never sees the answer
    });
  }
  // Sign in as bob (a planner on Acme), as the person would before handing the tab to an agent.
  await page.goto("/login");
  await page.getByRole("button", { name: /Sign in as bob, Acme/ }).click();
  await page.waitForURL("**/plan");
  o.onPage?.(page);

  const semantic = o.markup === "semantic";

  async function ensureOnPlan(): Promise<void> {
    if (!new URL(page.url()).pathname.endsWith("/plan")) throw new PageChanged();
    if ((await page.locator("table.grid").count()) === 0) throw new PageChanged();
  }

  /** v2: the accessible name. v1: the column whose header shows the month, in the item's row. */
  async function cell(item: string, month: string): Promise<Locator> {
    if (semantic)
      return page.getByRole("textbox", { name: `${item}, ${monthLabel(month)}`, exact: true });
    const headers = await page.locator("table.grid thead th").allInnerTexts();
    const col = headers.findIndex((h) => h.trim() === monthLabel(month));
    if (col < 0) throw new Error(`no column headed ${monthLabel(month)}`);
    const row = page.locator("table.grid tbody tr").filter({
      has: page.locator("th", { hasText: new RegExp(`^${item}$`) }),
    });
    return row.locator(":scope > *").nth(col).locator("input");
  }

  function saveButton(): Locator {
    return semantic
      ? page.getByRole("button", { name: /^Save \d+ unsaved change/ })
      : page.getByRole("button", { name: /^Save/ });
  }

  /** The unsaved-change count the Save control shows: its name (v2) or its visible "(n)" (v1). */
  async function unsaved(): Promise<number> {
    const b = saveButton();
    const text = semantic ? ((await b.getAttribute("aria-label")) ?? "") : await b.innerText();
    const m = semantic ? /Save (\d+)/.exec(text) : /\((\d+)\)/.exec(text);
    return m ? Number(m[1]) : 0;
  }

  async function message(): Promise<string> {
    const m = page.getByRole("status");
    return (await m.count()) ? (await m.innerText()).trim() : "";
  }

  async function snapshotBytes(): Promise<void> {
    // What a browser agent would read to decide: the page's accessibility snapshot.
    const aria = await page.locator("body").ariaSnapshot();
    o.meter.agentMessages++;
    o.meter.agentBytesIn += byteLength(aria);
  }

  let writeAttempts = 0;

  const driver: Driver = {
    get writeAttempts() {
      return writeAttempts;
    },
    async observe(cells: CellTarget[]): Promise<Observation> {
      await ensureOnPlan();
      await snapshotBytes();
      const values: Record<string, number> = {};
      let editBlocked: string | null = null;
      for (const c of cells) {
        const input = await cell(c.item, c.month);
        values[cellKey(c.item, c.month)] = Number(await input.inputValue());
        if (!(await input.isEditable()))
          editBlocked = semantic ? ((await input.getAttribute("data-surface-reason")) ?? "") : "";
      }
      const statusText = await page.getByText(/^Status: /).innerText();
      return { values, status: statusText.replace(/^Status:\s*/, "").trim(), editBlocked };
    },
    async write(changes: Change[], _obs, beforeCommit, afterStep): Promise<WriteResult> {
      for (const c of changes) {
        await ensureOnPlan();
        await (await cell(c.item, c.month)).fill(String(c.value));
        await afterStep();
      }
      await ensureOnPlan();
      await beforeCommit();
      const before = await message();
      writeAttempts++;
      await saveButton().click();
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        const m = await message();
        if (SAVED.test(m) && (await unsaved()) === 0) return { kind: "ok" };
        if (STALE.test(m) && m !== before) return { kind: "conflict" };
        if (m && m !== before && !SAVED.test(m) && !STALE.test(m))
          return { kind: "refused", reason: m };
        await page.waitForTimeout(50);
      }
      return { kind: "lost" };
    },
    async retryLast() {
      return null; // a page cannot resend the same request; it can only reload and look again
    },
    async afterConflict() {
      await page.getByRole("button", { name: "Discard drafts" }).click();
      await page.waitForTimeout(100);
    },
    async recover() {
      await page.goto("/plan");
      await page.locator("table.grid").waitFor();
    },
    async submit(): Promise<WriteResult> {
      await ensureOnPlan();
      const b = page.getByRole("button", { name: "Submit for approval" });
      if (await b.isDisabled())
        return { kind: "refused", reason: (await b.getAttribute("title")) ?? "" };
      writeAttempts++;
      await b.click();
      await page.getByText(/^Status: submitted/).waitFor();
      return { kind: "ok" };
    },
    async requestLock(): Promise<LockRequest> {
      await ensureOnPlan();
      const b = page.getByRole("button", { name: "Approve and lock" });
      if (await b.isDisabled())
        return { kind: "refused", reason: (await b.getAttribute("title")) ?? "" };
      writeAttempts++;
      await b.click();
      return { kind: "refused", reason: "clicked; no handoff in this variant" };
    },
    async close() {
      await Promise.all(pending);
      await context.close();
    },
  };
  return driver;
}
