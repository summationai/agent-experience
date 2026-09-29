/**
 * A project page shaped like the first target application (no landmarks, a status card of
 * label/value pairs, a key-value panel, a native table, an ag-grid-like grid inside an open
 * shadow root, a ProseMirror editor holding a report, a Highcharts-like chart with accessibility
 * off, a sensitive field, and an agent panel marked `data-surface-ignore`).
 */
export const ADDISON_SECRET = "ADDISON-PANEL-TEXT-7f2c";
export const PASSWORD = "hunter2-PASSWORD-91ab";
export const CARD = "4242424242424242";

export const PROJECT_PAGE = `
<div id="app">
  <div class="sidebar">
    <a href="/projects">Projects</a>
    <a href="/reports">Reports</a>
  </div>
  <div class="page">
    <div class="page-header"><h1>Apollo launch</h1><button>Generate report</button></div>
    <div class="card status-card">
      <div class="card-title">Project status</div>
      <div>Status: At risk</div>
      <div class="field"><span class="label">Owner</span><span>Dana Whitfield</span></div>
      <div class="field"><span class="label">Due date</span><span>Oct 3, 2026</span></div>
      <p>Vendor delays pushed the beta by two weeks.</p>
    </div>
    <div class="card">
      <h3>Budget</h3>
      <dl><dt>Approved</dt><dd>$1.2M</dd><dt>Spent</dt><dd>$840K</dd></dl>
    </div>
    <div class="card">
      <h3>Milestones</h3>
      <table>
        <caption>Milestones</caption>
        <thead><tr><th>Milestone</th><th>Date</th><th>State</th></tr></thead>
        <tbody>
          <tr><td>Alpha</td><td>Jul 1</td><td>Done</td></tr>
          <tr><td>Beta</td><td>Sep 12</td><td>Late</td></tr>
          <tr><td>Launch</td><td>Oct 3</td><td>Planned</td></tr>
        </tbody>
      </table>
    </div>
    <table-card id="tasks"></table-card>
    <div class="card report-card">
      <div class="card-title">Weekly report</div>
      <div class="ProseMirror" contenteditable="true">
        <h2>Summary</h2>
        <p>Launch is at risk: the vendor contract was signed late.</p>
        <ul><li>QA is one sprint behind</li><li>Marketing copy is ready</li></ul>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Burn-down</div>
      <div class="highcharts-container">
        <svg class="highcharts-root" width="400" height="200">
          <text class="highcharts-title">Burn-down by week</text>
          ${Array.from({ length: 14 }, (_, i) => `<rect x="${i * 20}" y="10" width="10" height="${50 + i}"></rect>`).join("")}
          <text>42</text>
        </svg>
      </div>
    </div>
    <form class="settings">
      <label>API password <input type="password" value="${PASSWORD}"></label>
      <label>Card number <input autocomplete="cc-number" value="${CARD}"></label>
      <label>Nickname <input value="Apollo"></label>
    </form>
  </div>
  <div class="addison" data-surface-ignore>
    <h2>Addison</h2>
    <p>${ADDISON_SECRET}</p>
    <button>Send</button>
  </div>
</div>`;

/** The grid's rows, as ag-grid renders them: split across pinned and center containers by aria-rowindex. */
export function gridHtml(rows: number, rendered = rows): string {
  const idx = Array.from({ length: rendered }, (_, i) => i);
  return `
  <div class="card-title">Open tasks</div>
  <div class="ag-root" role="grid" aria-label="Open tasks" aria-rowcount="${rows + 1}" aria-colcount="3">
    <div class="ag-header" role="presentation">
      <div class="ag-pinned-left-header" role="presentation">
        <div role="row" aria-rowindex="1"><div role="columnheader" aria-colindex="1"><span class="ag-header-cell-text">Task</span></div></div>
      </div>
      <div class="ag-header-viewport" role="presentation">
        <div role="row" aria-rowindex="1"><div role="columnheader" aria-colindex="2">Assignee</div><div role="columnheader" aria-colindex="3">Due</div></div>
      </div>
    </div>
    <div class="ag-body" role="presentation">
      <div class="ag-pinned-left-cols-container" role="presentation">
        ${idx.map((i) => `<div role="row" aria-rowindex="${i + 2}"><div role="gridcell" aria-colindex="1">Task ${i + 1}</div></div>`).join("")}
      </div>
      <div class="ag-center-cols-container" role="presentation">
        ${idx.map((i) => `<div role="row" aria-rowindex="${i + 2}"><div role="gridcell" aria-colindex="2">${i % 2 ? "Sam" : "Ria"}</div><div role="gridcell" aria-colindex="3">Oct ${(i % 28) + 1}</div></div>`).join("")}
      </div>
    </div>
  </div>`;
}

/** Render the page into `document.body`, with the task grid inside an open shadow root. */
export function renderProjectPage(
  doc: Document,
  options: { rows?: number; rendered?: number } = {},
): void {
  doc.title = "Apollo launch · Summation";
  doc.body.innerHTML = PROJECT_PAGE;
  const host = doc.getElementById("tasks")!;
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<div class="table-card">${gridHtml(options.rows ?? 3, options.rendered)}</div>`;
}
