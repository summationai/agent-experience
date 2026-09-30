// @vitest-environment jsdom
/**
 * Reading the page ([S-AUTO-14]): the content a landmark-less application shows (a status card of
 * label/value pairs, a key-value panel, a native table, an ag-grid-like grid inside an open
 * shadow root, a ProseMirror report, a Highcharts-like chart) comes back as sections by heading,
 * bounded and paged, with private values withheld, ignored subtrees unread, and the revision
 * untouched.
 */
import { afterEach, describe, expect, it } from "vitest";
import { autoSurface, formatCoverage, formatRead } from "../src/auto";
import type { AutoSurfaceHandle, PageRead, SurfaceConfig } from "../src/auto";
import { ADDISON_SECRET, CARD, PASSWORD, renderProjectPage } from "./fixtures/project-page";

let handles: AutoSurfaceHandle[] = [];
afterEach(() => {
  for (const h of handles) h.stop();
  handles = [];
  document.body.innerHTML = "";
});

function start(config: SurfaceConfig = {}, rows?: { rows?: number; rendered?: number }) {
  renderProjectPage(document, rows);
  const handle = autoSurface({ config, observe: { debounceMs: 0 } });
  handles.push(handle);
  return handle;
}

const section = (r: PageRead, heading: string) => r.sections.find((s) => s.heading === heading);
const all = (r: PageRead) => JSON.stringify(r) + formatRead(r);

describe("read: sections, fields, tables, text [S-AUTO-14]", () => {
  it("reads a landmark-less project page into sections by heading and card title", () => {
    const r = start().read();
    expect(r.title).toBe("Apollo launch · Summation");
    expect(r.sections.map((s) => [s.heading, s.level])).toEqual([
      ["", 0],
      ["Apollo launch", 1],
      ["Project status", 2],
      ["Budget", 3],
      ["Milestones", 3],
      ["Open tasks", 2],
      ["Weekly report", 2],
      ["Summary", 2],
      ["Burn-down", 2],
    ]);
    // The status card: "Status: At risk" text and label/value pairs become fields.
    expect(section(r, "Project status")).toMatchObject({
      fields: [
        { label: "Status", value: "At risk" },
        { label: "Owner", value: "Dana Whitfield" },
        { label: "Due date", value: "Oct 3, 2026" },
      ],
      text: "Vendor delays pushed the beta by two weeks.",
    });
    // A definition list is fields too.
    expect(section(r, "Budget")!.fields).toEqual([
      { label: "Approved", value: "$1.2M" },
      { label: "Spent", value: "$840K" },
    ]);
    expect(section(r, "Milestones")!.tables).toEqual([
      {
        caption: "Milestones",
        columns: ["Milestone", "Date", "State"],
        rows: [
          ["Alpha", "Jul 1", "Done"],
          ["Beta", "Sep 12", "Late"],
          ["Launch", "Oct 3", "Planned"],
        ],
        total: 3,
        truncated: false,
      },
    ]);
  });

  it("reads an ag-grid-like grid inside an open shadow root, merging pinned and center cells by row index", () => {
    const r = start().read();
    expect(section(r, "Open tasks")!.tables).toEqual([
      {
        caption: "Open tasks",
        columns: ["Task", "Assignee", "Due"],
        rows: [
          ["Task 1", "Ria", "Oct 1"],
          ["Task 2", "Sam", "Oct 2"],
          ["Task 3", "Ria", "Oct 3"],
        ],
        total: 3,
        truncated: false,
      },
    ]);
  });

  it("says a virtualized grid shows only some of its rows", () => {
    const r = start({}, { rows: 120, rendered: 20 }).read();
    const t = section(r, "Open tasks")!.tables[0]!;
    expect(t.rows).toHaveLength(20);
    expect(t).toMatchObject({ total: 120, truncated: true });
    expect(formatRead(r)).toContain("_20 of 120 rows shown._");
  });

  it("reads a ProseMirror report as document text and lists", () => {
    const r = start().read();
    expect(section(r, "Summary")).toMatchObject({
      // Inside a document, "Label: value" prose stays prose.
      text: "Launch is at risk: the vendor contract was signed late.",
      fields: [],
      lists: [{ items: ["QA is one sprint behind", "Marketing copy is ready"], truncated: false }],
    });
  });

  it("reports a chart as opaque with its title and never its values", () => {
    const r = start().read();
    expect(section(r, "Burn-down")!.opaque).toEqual([
      { kind: "chart", title: "Burn-down by week", library: "a Highcharts chart" },
    ]);
    expect(all(r)).not.toContain("42");
    expect(formatRead(r)).toContain(
      "_A Highcharts chart (“Burn-down by week”): drawn so its content cannot be read here; its values are not shown._",
    );
  });

  it("reads a list whose rows are buttons holding the item's data (the data page's FileListTable)", () => {
    const row = (name: string, type: string, when: string) => `<div role="button" tabindex="0">
      <div><svg aria-hidden="true"></svg><span>${name}</span></div>
      <div><div>${type}</div><div>${when}</div></div>
      <div><button aria-label="Open data catalog"></button><button aria-label="Actions">⋯</button></div></div>`;
    document.body.innerHTML = `<header><h1>Tables</h1><button>Create</button></header>
      <section aria-label="Tables"><div>
        ${row("orders", "Data table", "2 hours ago")}
        ${row("Shopify connection", "Folder", "yesterday")}
      </div><button>Save</button></section>`;
    const h = autoSurface();
    handles.push(h);
    const r = h.read();
    const text = formatRead(r);
    const list = r.sections.flatMap((s) => s.lists ?? []).find((l) => l.items.length === 2);
    expect(list?.items).toEqual([
      "orders · Data table · 2 hours ago",
      "Shopify connection · Folder · yesterday",
    ]);
    // A row's own buttons, and a plain control, are observe's, not content.
    expect(text).not.toContain("Actions");
    expect(text).not.toContain("Save");
  });

  it("reads through a display: contents wrapper in a real browser's layout mode", () => {
    // Chromium's checkVisibility(): false for display: none or contents, visibility: hidden, and
    // anything under a display: none ancestor. jsdom has none, so this stands in for it.
    const proto = Element.prototype as Element & { checkVisibility?: (o?: object) => boolean };
    const had = proto.checkVisibility;
    proto.checkVisibility = function (this: Element) {
      for (let n: Element | null = this; n; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.display === "none") return false;
        if (n === this && (cs.display === "contents" || cs.visibility === "hidden")) return false;
      }
      return true;
    };
    try {
      document.body.innerHTML = `<div style="display: contents"><div>
        <header><h1>Tables</h1></header>
        <section aria-label="Tables"><h2>Summation</h2><p>118 tables</p>
          <p style="display: none">Not shown</p></section></div></div>`;
      const h = autoSurface({ layout: true });
      handles.push(h);
      const text = formatRead(h.read());
      expect(text).toContain("118 tables");
      expect(text).toContain("Summation");
      expect(text).not.toContain("Not shown");
    } finally {
      if (had) proto.checkVisibility = had;
      else delete (proto as { checkVisibility?: unknown }).checkVisibility;
    }
  });

  it("a chart with an accessible name is read by that name", () => {
    document.body.innerHTML = `<h2>Revenue</h2><svg role="img" aria-label="Revenue rose 12% in Q3">${"<path d='M0 0'/>".repeat(20)}</svg>`;
    const h = autoSurface();
    handles.push(h);
    expect(h.read().sections[0]).toMatchObject({
      heading: "Revenue",
      text: "Chart: Revenue rose 12% in Q3",
    });
  });

  it("reads a dialog, an aria-labelledby value, a progress bar, and two-column th/td tables", () => {
    document.body.innerHTML = `
      <div role="dialog" aria-label="Generate report">
        <div role="progressbar" aria-label="Generating" aria-valuenow="40" aria-valuemax="100"></div>
        <span id="fmt">Format</span><span aria-labelledby="fmt">PDF</span>
        <table><tr><th>Pages</th><td>12</td></tr><tr><th>Author</th><td>Dana</td></tr></table>
      </div>`;
    const h = autoSurface();
    handles.push(h);
    const r = h.read();
    expect(r.sections).toHaveLength(1);
    expect(r.sections[0]).toMatchObject({
      heading: "Generate report",
      fields: [
        { label: "Generating", value: "40 of 100" },
        { label: "Format", value: "PDF" },
        { label: "Pages", value: "12" },
        { label: "Author", value: "Dana" },
      ],
    });
  });
});

describe("read: an editable grid and a flex status row (found driving a Next app headless)", () => {
  it("reads an input in a table cell as its value, not its label, and flex items as separate lines", () => {
    document.body.innerHTML = `
      <main><h1>FY27 H1 demand</h1>
        <section style="display: flex; gap: 8px"><span>Status: draft</span><span>Revision 1</span><span>Total 7,300 units</span></section>
        <table>
          <thead><tr><th>Item</th><th>January 2027</th><th>February 2027</th></tr></thead>
          <tbody>
            <tr><th scope="row">Widgets</th><td><input aria-label="Widgets, January 2027" value="1200"></td><td><input aria-label="Widgets, February 2027" value="1210"></td></tr>
            <tr><th scope="row">Cards</th><td><input aria-label="Card number" autocomplete="cc-number" value="4111111111111111"></td><td>4890</td></tr>
          </tbody>
        </table>
      </main>`;
    const h = autoSurface();
    handles.push(h);
    const r = h.read();
    const s = section(r, "FY27 H1 demand")!;
    expect(s.fields).toContainEqual({ label: "Status", value: "draft" });
    expect(s.text).toContain("Revision 1");
    expect(s.text).not.toContain("draftRevision");
    expect(s.tables[0]!.rows[0]).toEqual(["Widgets", "1200", "1210"]);
    // A private control keeps its cell private.
    expect(s.tables[0]!.rows[1]).toEqual(["Cards", "", "4890"]);
    expect(all(r)).not.toContain("4111111111111111");
  });
});

describe("read: redaction and ignored subtrees [S-AUTO-14]", () => {
  it("withholds passwords and card numbers, keeps their labels, and counts them", () => {
    const r = start().read();
    expect(all(r)).not.toContain(PASSWORD);
    expect(all(r)).not.toContain(CARD);
    expect(section(r, "Apollo launch")!.fields).toEqual([
      { label: "API password", value: "", sensitive: true },
      { label: "Card number", value: "", sensitive: true },
      { label: "Nickname", value: "Apollo" },
    ]);
    expect(r.redacted).toBe(2);
    expect(formatRead(r)).toContain("- **API password:** (private, not shown)");
  });

  it("withholds what the configuration marks sensitive, field or not, and never reads excluded selectors", () => {
    const r = start({
      sensitive: [".status-card > .field", "input[value=Apollo]"],
      read: { exclude: [".sidebar"] },
    }).read();
    expect(all(r)).not.toContain("Dana Whitfield");
    expect(all(r)).not.toContain("Nickname: Apollo");
    expect(all(r)).not.toContain("Projects Reports");
    expect(all(r)).not.toContain("Oct 3, 2026");
    expect(r.redacted).toBe(5);
  });

  it("a rule's sensitive: true withholds that field's value", () => {
    const r = start({ rules: [{ match: { name: "Nickname" }, sensitive: true }] }).read();
    expect(section(r, "Apollo launch")!.fields[2]).toEqual({
      label: "Nickname",
      value: "",
      sensitive: true,
    });
  });

  it("never reads a data-surface-ignore subtree or the relay's indicator", () => {
    const h = start();
    const indicator = document.createElement("div");
    indicator.setAttribute("data-axe-relay-indicator", "");
    indicator.textContent = "An agent is acting in this tab RELAY-INDICATOR";
    document.body.appendChild(indicator);
    const r = h.read();
    expect(all(r)).not.toContain(ADDISON_SECRET);
    expect(all(r)).not.toContain("Addison");
    expect(all(r)).not.toContain("RELAY-INDICATOR");
  });

  it("takes toasts and alerts out of the sections into notices", () => {
    const h = start();
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div class="toast">Report generated</div><div role="alert">Sync failed</div>',
    );
    const r = h.read();
    expect(r.notices).toEqual(["Report generated", "Sync failed"]);
    expect(r.sections.map((s) => s.text).join(" ")).not.toContain("Report generated");
    expect(formatRead(r)).toContain("> Notice: Report generated");
  });
});

describe("read: regions, query, bounds, paging [S-AUTO-14]", () => {
  it("reads a heading's section and the sections under it", () => {
    const r = start().read({ region: "Project status" });
    expect(r.region).toBe("Project status");
    expect(r.sections.map((s) => s.heading)).toEqual(["Project status", "Budget", "Milestones"]);
  });

  it("reads a region the configuration names, and an entry's element", () => {
    const h = start({ read: { regions: { status: ".status-card" } } });
    const r = h.read({ region: "status" });
    expect(r.region).toBe("status");
    expect(r.sections).toHaveLength(1);
    expect(r.sections[0]!.fields[0]).toEqual({ label: "Status", value: "At risk" });
    const grid = h.surface
      .entries()
      .find((e) => e.kind === "collection" && e.name === "Open tasks")!;
    const g = h.read({ region: grid.id });
    expect(g.sections.flatMap((s) => s.tables).map((t) => t.caption)).toEqual(["Open tasks"]);
  });

  it("an unknown region reads nothing and lists the regions there are", () => {
    const r = start().read({ region: "Nowhere" });
    expect(r.sections).toEqual([]);
    expect(r.reason).toBe("no region or heading named “Nowhere” is on this page now");
    expect(r.regions).toEqual(expect.arrayContaining(["Apollo launch", "Budget", "Milestones"]));
  });

  it("filters by query: a matching heading whole, else matching fields, rows, items, and paragraphs", () => {
    const r = start().read({ query: "sam" });
    expect(r.sections.map((s) => s.heading)).toEqual(["Open tasks"]);
    expect(r.sections[0]!.tables[0]!.rows).toEqual([["Task 2", "Sam", "Oct 2"]]);
    const status = start().read({ query: "at risk" });
    expect(status.sections.map((s) => [s.heading, s.fields.length, s.text])).toEqual([
      ["Project status", 1, ""],
      ["Summary", 0, "Launch is at risk: the vendor contract was signed late."],
    ]);
    expect(start().read({ query: "zebra" }).reason).toBe("nothing on the page mentions “zebra”");
  });

  it("bounds rows per table and pages long content with a cursor until it is all read", () => {
    const h = start({}, { rows: 200 });
    const r = h.read({ maxRows: 10 });
    expect(section(r, "Open tasks")!.tables[0]).toMatchObject({ total: 200, truncated: true });
    expect(section(r, "Open tasks")!.tables[0]!.rows).toHaveLength(10);

    const seen: string[] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const page = h.read({ maxChars: 400, ...(cursor ? { cursor } : {}) });
      expect(formatRead({ ...page, notices: [] }).length).toBeLessThan(400 + 400);
      for (const s of page.sections) if (!seen.includes(s.heading)) seen.push(s.heading);
      cursor = page.nextCursor;
      expect(page.truncated).toBe(cursor !== undefined);
      pages++;
    } while (cursor && pages < 40);
    expect(pages).toBeGreaterThan(3);
    expect(seen).toEqual(h.read({ maxChars: 50_000 }).sections.map((s) => s.heading));
  });

  it("continues a section too long for one page from where it stopped", () => {
    const long = Array.from({ length: 80 }, (_, i) => `Sentence number ${i} of the report.`).join(
      " ",
    );
    document.body.innerHTML = `<h2>Report</h2><p>${long}</p>`;
    const h = autoSurface();
    handles.push(h);
    const first = h.read({ maxChars: 500 });
    expect(first.sections[0]).toMatchObject({ heading: "Report", truncated: true });
    expect(first.nextCursor).toMatch(/^0\.\d+\./);
    let text = first.sections[0]!.text;
    let cursor = first.nextCursor;
    while (cursor) {
      const next = h.read({ maxChars: 500, cursor });
      text += " " + next.sections[0]!.text;
      cursor = next.nextCursor;
    }
    expect(text.replace(/\s+/g, " ")).toBe(long);
  });

  it("never moves the revision and writes nothing to the ledger", () => {
    const h = start();
    const rev = h.surface.currentRev();
    h.read();
    h.read({ region: "Budget", query: "spent", maxChars: 300 });
    expect(h.surface.currentRev()).toBe(rev);
    expect(h.surface.ledger()).toEqual([]);
  });
});

describe("read: formatRead and coverage", () => {
  it("renders Markdown with headings, fields, tables, lists, and the opaque note", () => {
    const md = formatRead(start().read());
    expect(md).toContain("# Apollo launch · Summation");
    expect(md).toContain("## Apollo launch");
    expect(md).toContain(
      "### Project status\n\n- **Status:** At risk\n- **Owner:** Dana Whitfield",
    );
    expect(md).toContain(
      "| Milestone | Date | State |\n| --- | --- | --- |\n| Alpha | Jul 1 | Done |",
    );
    expect(md).toContain("- QA is one sprint behind");
  });

  it("coverage lists the content an agent cannot read", () => {
    const h = start();
    const iframe = document.createElement("iframe");
    iframe.setAttribute("title", "Billing");
    iframe.src = "https://billing.example.com/";
    document.body.appendChild(iframe);
    // jsdom gives a cross-origin frame no readable document either way; make that explicit.
    Object.defineProperty(iframe, "contentDocument", { get: () => null });
    const c = h.coverage();
    expect(c.unreadable.map((u) => [u.kind, u.title])).toEqual([
      ["chart", "Burn-down by week"],
      ["frame", "Billing"],
    ]);
    const md = formatCoverage(c);
    expect(md).toContain("## Content an agent cannot read (2)");
    expect(md).toContain("A Highcharts chart (“Burn-down by week”): read reports it by title only");
  });

  it("publishes read, wait, and formatRead on window.__surface with expose", () => {
    renderProjectPage(document);
    const h = autoSurface({ expose: true });
    handles.push(h);
    const pub = (window as unknown as { __surface: Record<string, (...a: unknown[]) => unknown> })
      .__surface;
    expect((pub.read!() as PageRead).title).toBe("Apollo launch · Summation");
    expect(pub.formatRead!()).toContain("### Project status");
    expect(typeof pub.wait).toBe("function");
  });
});
