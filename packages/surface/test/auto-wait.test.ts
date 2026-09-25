// @vitest-environment jsdom
/**
 * Waiting for slow work ([S-AUTO-15]): a wait resolves when its condition holds on the page (text
 * appearing after an asynchronous "generate", quiet after streamed chunks, an entry becoming
 * available, the revision moving, the route changing), resolves `met: false` at its bound or when
 * canceled or stopped, reports what changed and the notices that appeared, and never moves the
 * revision itself.
 */
import { afterEach, describe, expect, it } from "vitest";
import { autoSurface, checkCondition } from "../src/auto";
import type { AutoSurfaceHandle } from "../src/auto";

let handles: AutoSurfaceHandle[] = [];
afterEach(() => {
  for (const h of handles) h.stop();
  handles = [];
  document.body.innerHTML = "";
  history.replaceState({}, "", "/");
});

function start(html: string) {
  document.body.innerHTML = html;
  const handle = autoSurface({ observe: { debounceMs: 0, settle: { quietMs: 5, timeoutMs: 50 } } });
  handles.push(handle);
  return handle;
}

const later = (ms: number, fn: () => void) => setTimeout(fn, ms);

const REPORT_PAGE = `
  <h1>Reports</h1>
  <button id="gen">Generate report</button>
  <div id="out"></div>`;

describe("wait [S-AUTO-15]", () => {
  it("resolves when text appears after an asynchronous generate, with what changed and the toast", async () => {
    const h = start(REPORT_PAGE);
    document.getElementById("gen")!.addEventListener("click", () => {
      const b = document.getElementById("gen") as HTMLButtonElement;
      b.disabled = true;
      later(40, () => {
        document.getElementById("out")!.innerHTML = "<h2>Q3 report</h2><p>Revenue grew 4%.</p>";
        document.body.insertAdjacentHTML("beforeend", '<div class="toast">Report ready</div>');
        b.disabled = false;
      });
    });
    const view = h.surface.observe();
    const gen = view.entries.find((e) => e.name === "Generate report")!;
    const acted = await h.surface.act({ op: "CLICK", target: gen.id, expectedRev: view.rev });
    expect(acted.status).toBe("ok");
    const revBefore = h.surface.currentRev();
    const w = await h.wait({ text: "Revenue grew" }, { timeoutMs: 2000 });
    expect(w).toMatchObject({ met: true, reason: "text “Revenue grew” is on the page" });
    expect(w.fromRev).toBe(revBefore);
    expect(w.rev).toBe(h.surface.currentRev());
    expect(w.changed).toContain(gen.id);
    expect(w.notices).toContain("Report ready");
    expect(w.elapsedMs).toBeGreaterThanOrEqual(20);
    expect(h.read({ region: "Q3 report" }).sections[0]!.text).toBe("Revenue grew 4%.");
  });

  it("matches a regular expression, and text that appeared only in a toast that has gone", async () => {
    const h = start(REPORT_PAGE);
    later(20, () => {
      document.body.insertAdjacentHTML("beforeend", '<div role="status" id="t">Saved 3 rows</div>');
      later(20, () => document.getElementById("t")!.remove());
    });
    const re = await h.wait({ text: "/saved \\d+ rows/i" }, { timeoutMs: 1000 });
    expect(re.met).toBe(true);
    const gone = start(REPORT_PAGE);
    later(10, () => {
      document.body.insertAdjacentHTML("beforeend", '<div class="toast" id="t2">Exported</div>');
      later(10, () => document.getElementById("t2")!.remove());
    });
    await new Promise((r) => setTimeout(r, 60));
    // Appeared and went before this wait began: not seen.
    expect((await gone.wait({ text: "Exported" }, { timeoutMs: 60 })).met).toBe(false);
  });

  it("waits until a streamed report goes quiet", async () => {
    const h = start(REPORT_PAGE);
    const out = document.getElementById("out")!;
    let n = 0;
    const tick = setInterval(() => {
      out.insertAdjacentHTML("beforeend", `<p>chunk ${n}</p>`);
      if (++n === 6) clearInterval(tick);
    }, 15);
    const w = await h.wait({ idle: 80 }, { timeoutMs: 3000, pollMs: 20 });
    expect(w.met).toBe(true);
    expect(n).toBe(6);
    expect(out.textContent).toContain("chunk 5");
    expect(w.elapsedMs).toBeGreaterThanOrEqual(80);
  });

  it("waits for an entry to become available, and for text to go", async () => {
    const h = start(
      `<div id="spin">Generating…</div><button id="dl" disabled>Download report</button>`,
    );
    const id = h.surface.entries().find((e) => e.name === "Download report")!.id;
    expect(h.surface.availability(id)?.available).toBe(false);
    later(30, () => {
      (document.getElementById("dl") as HTMLButtonElement).disabled = false;
      document.getElementById("spin")!.remove();
    });
    const w = await h.wait(
      { all: [{ entry: id, available: true }, { gone: "Generating" }] },
      { timeoutMs: 2000 },
    );
    expect(w).toMatchObject({
      met: true,
      reason: `entry ${id} is available and text “Generating” is no longer on the page`,
    });
    expect(w.changed).toContain(id);
    expect(w.rev).toBeGreaterThan(w.fromRev);
  });

  it("waits for the revision to move, or for the route, whichever comes first with any", async () => {
    const h = start(`<button id="b">Refresh</button>`);
    const rev = h.surface.currentRev();
    later(20, () => document.body.insertAdjacentHTML("beforeend", "<button>New control</button>"));
    const moved = await h.wait({ revMoved: rev }, { timeoutMs: 1000 });
    expect(moved.met).toBe(true);
    expect(moved.rev).toBe(rev + 1);
    later(20, () => {
      history.pushState({}, "", "/reports/42");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    const routed = await h.wait(
      { any: [{ route: "/reports/*" }, { text: "never shown" }] },
      { timeoutMs: 1000 },
    );
    expect(routed).toMatchObject({ met: true, reason: "the route matches /reports/*" });
  });

  it("times out with met: false and says what it waited for", async () => {
    const h = start(REPORT_PAGE);
    const w = await h.wait({ text: "Never" }, { timeoutMs: 50 });
    expect(w.met).toBe(false);
    expect(w.reason).toBe("timed out after 50 ms waiting until text “Never” is on the page");
    expect(w.elapsedMs).toBeGreaterThanOrEqual(45);
  });

  it("bounds the timeout at two minutes, resolves at once when already met, and cancels by signal", async () => {
    const h = start(REPORT_PAGE);
    const now = await h.wait({ text: "Reports" }, { timeoutMs: 10 ** 9 });
    expect(now).toMatchObject({ met: true });
    expect(now.elapsedMs).toBeLessThan(50);
    const ac = new AbortController();
    const p = h.wait({ text: "Never" }, { timeoutMs: 10 ** 9, signal: ac.signal });
    later(10, () => ac.abort());
    expect(await p).toMatchObject({ met: false, reason: "the wait was canceled" });
  });

  it("ends every pending wait when the surface stops", async () => {
    const h = start(REPORT_PAGE);
    const p = h.wait({ text: "Never" }, { timeoutMs: 60_000 });
    later(10, () => h.stop());
    expect(await p).toMatchObject({ met: false, reason: "the surface stopped" });
  });

  it("never moves the revision itself", async () => {
    const h = start(REPORT_PAGE);
    const rev = h.surface.currentRev();
    await h.wait({ idle: 20 }, { timeoutMs: 500 });
    await h.wait({ text: "Never" }, { timeoutMs: 30 });
    expect(h.surface.currentRev()).toBe(rev);
    expect(h.surface.ledger()).toEqual([]);
  });

  it("refuses a condition that says nothing, or available without entry", async () => {
    const h = start(REPORT_PAGE);
    await expect(h.wait({})).rejects.toThrow("the condition is empty");
    await expect(h.wait({ available: true })).rejects.toThrow("available needs entry");
    expect(checkCondition({ idle: 0 })).toBe("idle is a positive number of milliseconds");
    expect(checkCondition({ any: [{ text: "" }] })).toBe(
      "any: text is a non-empty string or a regular expression",
    );
    expect(checkCondition({ text: "x", bogus: 1 })).toBe("unknown member “bogus”");
  });

  it("does not see text inside data-surface-ignore", async () => {
    const h = start(`${REPORT_PAGE}<div data-surface-ignore id="panel"></div>`);
    later(10, () => (document.getElementById("panel")!.textContent = "Report ready"));
    expect((await h.wait({ text: "Report ready" }, { timeoutMs: 80 })).met).toBe(false);
  });
});
