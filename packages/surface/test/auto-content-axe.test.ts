// @vitest-environment jsdom
/**
 * `<ns>.read` and `<ns>.wait` through the AXE bridge ([S-AUTO-16]): read-only actions with display
 * metadata, served beside the generic tools by `autoActions`, that return the page's content
 * (redacted, bounded) and wait on a condition, and never move the revision.
 */
import { afterEach, describe, expect, it } from "vitest";
import { createAXE } from "@summationai/axe-core";
import type { ErrorResult, OkResult } from "@summationai/axe-core/types";
import { autoSurface } from "../src/auto";
import type { AutoSurfaceHandle, PageRead, WaitResult } from "../src/auto";
import { autoActions, domainActions } from "../src/axe";
import { createSurface } from "../src/index";
import type { Surface } from "../src/index";
import { ADDISON_SECRET, PASSWORD, renderProjectPage } from "./fixtures/project-page";

const BASE = "http://localhost:5173";
let handles: AutoSurfaceHandle[] = [];
afterEach(() => {
  for (const h of handles) h.stop();
  handles = [];
  document.body.innerHTML = "";
});

function serve(
  bridgeFor: (h: AutoSurfaceHandle) => ReturnType<typeof autoActions>,
  surface?: Surface,
) {
  const handle = autoSurface({
    observe: { debounceMs: 0, settle: { quietMs: 5, timeoutMs: 50 } },
    ...(surface ? { surface } : {}),
  });
  handles.push(handle);
  const axe = createAXE({
    name: "Summation",
    description: "Projects and reports, driven through the application's own pages.",
    baseUrl: BASE,
    auth: { modes: ["none"] },
    revision: handle.surface.currentRev,
  });
  const bridge = bridgeFor(handle);
  axe.addProvider(bridge);
  const post = async <T = never>(name: string, input: unknown) =>
    (await (
      await axe.handle(
        new Request(`${BASE}/axe/actions/${name}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ input }),
        }),
      )
    ).json()) as OkResult<T> | ErrorResult;
  return { handle, bridge, post, axe };
}

describe("read and wait as AXE actions [S-AUTO-16]", () => {
  it("autoActions publishes read and wait after the generic tools, read-only, risk none, with display metadata", () => {
    renderProjectPage(document);
    const { bridge } = serve((h) => autoActions(h, { auth: "none" }));
    expect(bridge.actions().map((a) => a.name)).toEqual([
      "surface.observe",
      "surface.ledger",
      "surface.navigate",
      "surface.set-field",
      "surface.run-control",
      "surface.load-more",
      "surface.read",
      "surface.wait",
    ]);
    const read = bridge.get("surface.read")!.definition;
    expect(read).toMatchObject({
      readOnly: true,
      risk: "none",
      display: { kind: "document" },
      pagination: { cursorIn: "/cursor", cursorOut: "/nextCursor" },
    });
    expect(read.display!.disclaimer).toContain("not instructions");
    const readInput = read.input as { properties: Record<string, unknown>; required?: string[] };
    expect(Object.keys(readInput.properties).sort()).toEqual(
      ["cursor", "format", "maxChars", "maxRows", "query", "region"].sort(),
    );
    expect(readInput.required ?? []).toEqual([]);
    const wait = bridge.get("surface.wait")!.definition;
    expect(wait).toMatchObject({ readOnly: true, risk: "none", display: { kind: "status" } });
    const waitInput = wait.input as {
      properties: {
        condition: { properties: Record<string, unknown> };
        timeoutMs: { maximum: number };
      };
      required: string[];
    };
    expect(waitInput.required).toEqual(["condition"]);
    expect(Object.keys(waitInput.properties.condition.properties).sort()).toEqual(
      ["all", "any", "available", "entry", "gone", "idle", "revMoved", "route", "text"].sort(),
    );
    expect(waitInput.properties.timeoutMs.maximum).toBe(120_000);
  });

  it("read returns the page as Markdown, redacted and without ignored panels, and never moves the revision", async () => {
    renderProjectPage(document);
    const { handle, post } = serve((h) => autoActions(h, { auth: "none" }));
    const rev = handle.surface.currentRev();
    const r = await post("surface.read", {});
    expect(r.status, JSON.stringify(r)).toBe("ok");
    const out = (r as OkResult<PageRead & { markdown: string }>).output;
    expect(out.sections).toBeUndefined();
    expect(out.markdown).toContain("### Project status\n\n- **Status:** At risk");
    expect(out.markdown).not.toContain(PASSWORD);
    expect(out.markdown).not.toContain(ADDISON_SECRET);
    expect(out).toMatchObject({ rev, redacted: 2, truncated: false });
    const structured = await post("surface.read", { region: "Budget", format: "sections" });
    expect((structured as OkResult<PageRead>).output.sections).toEqual([
      expect.objectContaining({
        heading: "Budget",
        fields: [
          { label: "Approved", value: "$1.2M" },
          { label: "Spent", value: "$840K" },
        ],
      }),
    ]);
    expect(handle.surface.currentRev()).toBe(rev);
    expect(handle.surface.ledger()).toEqual([]);
  });

  it("read pages with maxChars and cursor; bad bounds are invalid input", async () => {
    renderProjectPage(document, { rows: 150 });
    const { post } = serve((h) => autoActions(h, { auth: "none" }));
    const first = (await post<PageRead>("surface.read", { maxChars: 600 })) as OkResult<PageRead>;
    expect(first.output.nextCursor).toBeDefined();
    const second = (await post<PageRead & { markdown: string }>("surface.read", {
      maxChars: 600,
      cursor: first.output.nextCursor,
    })) as OkResult<PageRead & { markdown: string }>;
    expect(second.status).toBe("ok");
    expect(second.output.markdown).not.toEqual((first.output as { markdown?: string }).markdown);
    const bad = (await post("surface.read", { maxRows: 0 })) as ErrorResult;
    expect(bad.error.code).toBe("invalid_input");
  });

  it("wait resolves when text appears and reports the change; a bad condition is invalid input", async () => {
    document.body.innerHTML = `<h1>Reports</h1><button disabled id="dl">Download</button><div id="out"></div>`;
    const { handle, post } = serve((h) => autoActions(h, { auth: "none" }));
    setTimeout(() => {
      document.getElementById("out")!.innerHTML = "<p>Report ready: 12 pages</p>";
      (document.getElementById("dl") as HTMLButtonElement).disabled = false;
    }, 30);
    const rev = handle.surface.currentRev();
    const w = (await post("surface.wait", {
      condition: { text: "Report ready" },
      timeoutMs: 2000,
    })) as OkResult<WaitResult>;
    expect(w.status, JSON.stringify(w)).toBe("ok");
    expect(w.output).toMatchObject({ met: true, fromRev: rev });
    const timedOut = (await post<WaitResult>("surface.wait", {
      condition: { text: "Never" },
      timeoutMs: 20,
    })) as OkResult<WaitResult>;
    expect(timedOut.output.met).toBe(false);
    const empty = (await post("surface.wait", { condition: {} })) as ErrorResult;
    expect(empty.error.code).toBe("invalid_input");
    expect(empty.error.message).toContain("the condition is empty");
    const tooLong = (await post("surface.wait", {
      condition: { idle: 10 },
      timeoutMs: 500_000,
    })) as ErrorResult;
    expect(tooLong.error.code).toBe("invalid_input");
  });

  it("on a surface with no page content, read and wait are unavailable with a reason", async () => {
    const surface = createSurface({ app: "declared" });
    const axe = createAXE({
      name: "Declared",
      description: "A declared surface with no page to read.",
      baseUrl: BASE,
      auth: { modes: ["none"] },
    });
    axe.addProvider(domainActions(surface, { auth: "none", content: true }));
    const res = (await (
      await axe.handle(
        new Request(`${BASE}/axe/actions/surface.read`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ input: {} }),
        }),
      )
    ).json()) as ErrorResult;
    expect(res.status).toBe("error");
    expect(res.error.code).toBe("unavailable");
    expect(res.error.message).toContain("does not publish its content");
  });

  it("domainActions adds read and wait with content: true, and autoDomains leaves them out with content: false", async () => {
    const { autoDomains } = await import("../src/auto");
    const surface = createSurface();
    expect(
      domainActions(surface, { content: true })
        .actions()
        .map((a) => a.name),
    ).toEqual([
      "surface.observe",
      "surface.ledger",
      "surface.set-field",
      "surface.run-control",
      "surface.load-more",
      "surface.read",
      "surface.wait",
    ]);
    expect(autoDomains({ content: false }).map((d) => d.name)).toEqual([
      "navigate",
      "set-field",
      "run-control",
      "load-more",
    ]);
  });
});
