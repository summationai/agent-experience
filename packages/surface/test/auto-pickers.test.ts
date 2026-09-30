// @vitest-environment jsdom
/**
 * Choosing an item is not an unknown mutation ([S-AUTO-7]). A control named for an item (a
 * tenant, a table, a report), one of several peers in a list, table, menu, or grid of cards,
 * opens or selects that item: low risk and reversible. What still errs high: a per-row action
 * repeated on every row ("Recalculate"), distinct unknown verbs in a toolbar, and anything
 * destructive by name or styling.
 */
import { afterEach, describe, expect, it } from "vitest";
import { autoSurface } from "../src/auto";
import type { AutoSurfaceHandle } from "../src/auto";

const handles: AutoSurfaceHandle[] = [];
afterEach(() => {
  for (const h of handles.splice(0)) h.stop();
  document.body.innerHTML = "";
});

function risks(
  html: string,
): Record<string, { risk?: string; mutates?: string; reversible?: boolean }> {
  document.body.innerHTML = html;
  const h = autoSurface({ observe: { settle: { quietMs: 5, timeoutMs: 100 }, debounceMs: 0 } });
  handles.push(h);
  const out: Record<string, { risk?: string; mutates?: string; reversible?: boolean }> = {};
  for (const e of h.surface.observe().entries)
    if (e.kind === "action" && e.effect)
      out[e.name] = {
        risk: e.effect.risk,
        mutates: e.effect.mutates,
        reversible: e.effect.reversible,
      };
  return out;
}

describe("auto surface: choosing an item", () => {
  it("an organization chooser page: each organization is an item, not a change", () => {
    const r = risks(`<main><h1>Choose an organization</h1><ul>
      <li><button>Acme Manufacturing</button></li>
      <li><button>Globex Foods</button></li>
      <li><button>Initech</button></li></ul></main>`);
    for (const name of ["Acme Manufacturing", "Globex Foods", "Initech"])
      expect(r[name], name).toMatchObject({ risk: "low", reversible: true });
  });

  it("a tenant switcher that switches on click, in a dialog or a menu", () => {
    const dialog = risks(`<div role="dialog" aria-modal="true" aria-label="Switch tenant">
      <div role="menu"><div role="menuitem">SummationDotCom</div><div role="menuitem">Fanatics</div></div>
      <button>Close</button></div>`);
    expect(dialog["SummationDotCom"]).toMatchObject({ risk: "low", reversible: true });
    expect(dialog["Fanatics"]).toMatchObject({ risk: "low", reversible: true });
    const menu = risks(`<header><button aria-haspopup="menu" aria-expanded="true">Acme</button>
      <div role="menu"><div role="menuitem">Acme</div><div role="menuitem">Globex</div>
      <div role="menuitem">Delete workspace</div></div></header>`);
    expect(menu["Globex"]).toMatchObject({ risk: "low", reversible: true });
    expect(menu["Delete workspace"]!.risk).toBe("high");
  });

  it("tables in a catalog: rows, a sidebar list, and a grid of cards", () => {
    const rows =
      risks(`<main><table><thead><tr><th>Table</th><th>Rows</th><th></th></tr></thead><tbody>
      <tr><td><button>orders</button></td><td>1.2M</td><td><button>Recalculate</button></td></tr>
      <tr><td><button>customers</button></td><td>80k</td><td><button>Recalculate</button></td></tr>
      <tr><td><button>general_ledger</button></td><td>3.4M</td><td><button>Recalculate</button></td></tr>
      </tbody></table></main>`);
    expect(rows["orders"]).toMatchObject({ risk: "low", reversible: true });
    expect(rows["general_ledger"]).toMatchObject({ risk: "low", reversible: true });
    // The same unknown verb on every row is an action per row, not an item: it stays high.
    expect(rows["Recalculate"]!.risk).toBe("high");

    const sidebar = risks(`<aside><h2>Tables</h2><ul>
      <li><button>orders</button></li><li><button>customers</button></li></ul></aside>`);
    expect(sidebar["orders"]).toMatchObject({ risk: "low", reversible: true });

    const cards = risks(`<main><div class="grid">
      <button><h3>General ledger</h3><p>3.4M rows</p></button>
      <button><h3>Accounts payable</h3><p>210k rows</p></button></div></main>`);
    const cardNames = Object.keys(cards).filter((n) => /rows$/.test(n));
    expect(cardNames).toHaveLength(2);
    for (const name of cardNames) expect(cards[name], name).toMatchObject({ risk: "low" });
  });

  it("still errs high: distinct unknown verbs in a toolbar, destructive names, danger styling", () => {
    const r =
      risks(`<main><div role="toolbar"><button>Recalculate</button><button>Rebalance</button></div>
      <ul><li><button>orders</button></li><li><button>Trash</button></li>
      <li><button class="btn-danger">customers</button></li></ul></main>`);
    expect(r["Recalculate"]!.risk).toBe("high");
    expect(r["Rebalance"]!.risk).toBe("high");
    expect(r["Trash"]!.risk).toBe("high");
    expect(r["customers"]!.risk).toBe("high");
    expect(r["orders"]!.risk).toBe("low");
  });

  it("a lone unknown button is still not recognized", () => {
    const r = risks(`<main><button>Frobnicate</button></main>`);
    expect(r["Frobnicate"]!.risk).toBe("high");
  });

  it("a tenant menu portaled out of its dialog (Radix): part of the dialog, a staged choice", () => {
    // The live TenantSwitchModal: the dropdown's content renders in a portal on <body>, a sibling
    // of the modal, linked to its trigger by aria-controls and aria-labelledby.
    document.body.innerHTML = `<main><button>Reports</button></main>
      <div role="dialog" aria-modal="true" aria-labelledby="t">
        <h2 id="t">Select a tenant to continue</h2>
        <p>You have access to the following tenants</p>
        <button id="trig" type="button" aria-haspopup="menu" aria-expanded="true" aria-controls="menu1">Select tenant</button>
        <button type="button" disabled>Continue</button>
      </div>
      <div data-radix-popper-content-wrapper>
        <div role="menu" id="menu1" aria-labelledby="trig">
          <div role="group"><div role="menuitem" tabindex="-1">SummationDotCom</div>
          <div role="menuitem" tabindex="-1">Fanatics</div></div>
        </div>
      </div>
      <div data-radix-popper-content-wrapper>
        <div role="menu" id="stray"><div role="menuitem">Unrelated</div></div>
      </div>`;
    const h = autoSurface({ observe: { settle: { quietMs: 5, timeoutMs: 100 }, debounceMs: 0 } });
    handles.push(h);
    const entries = h.surface.observe().entries;
    const row = (name: string) => entries.find((e) => e.name === name)!;
    for (const name of ["SummationDotCom", "Fanatics"]) {
      expect(row(name).state?.available, name).toBe(true);
      expect(row(name).effect, name).toMatchObject({
        risk: "low",
        mutates: "form",
        reversible: true,
      });
    }
    // What is really behind the modal stays unavailable, and so does a menu no control in it owns.
    expect(row("Reports").state?.available).toBe(false);
    expect(row("Unrelated").state?.available).toBe(false);
  });

  it("the data page's table list: each row is a button holding the table's columns (FileListTable)", () => {
    // The live markup: the whole row is role="button", holding the name, the metadata columns, and
    // the row's own icon buttons; with drag and drop on, each row sits in a wrapper of its own.
    const tableRow = (name: string, dnd: boolean) => {
      const row = `<div class="row grid" role="button" tabindex="0">
        <div class="name"><div class="icon"><svg></svg></div><span>${name}</span></div>
        <div class="metadata"><div>Data table</div><div>1.2M rows</div><div>2 hours ago</div></div>
        <div class="actions"><button aria-label="Open data catalog"></button>
        <button aria-label="Actions" aria-haspopup="menu"></button></div></div>`;
      return dnd ? `<div data-dnd>${row}</div>` : row;
    };
    for (const dnd of [false, true]) {
      const r = risks(
        `<main><h1>Tables</h1><div>${["orders", "refund_events", "Revenue share by region"]
          .map((n) => tableRow(n, dnd))
          .join("")}</div></main>`,
      );
      const rows = Object.entries(r).filter(([name]) => /hours ago/.test(name));
      expect(rows, `dnd=${dnd}`).toHaveLength(3);
      // A table named for refunds or shares is not a refund or a share.
      for (const [name, v] of rows)
        expect(v, `${name} (dnd=${dnd})`).toMatchObject({ risk: "low", reversible: true });
      // The row's own icon buttons are what they say.
      expect(r["Open data catalog"]!.risk).toBe("low");
    }
  });

  it("a row that starts with a destructive verb is still high, and so is a danger-styled one", () => {
    const r = risks(`<main><div>
      <div role="button" tabindex="0"><span>Delete orders</span><span>Data table</span></div>
      <div role="button" tabindex="0" class="btn-danger"><span>customers</span><span>Data table</span></div>
      <div role="button" tabindex="0"><span>ledger</span><span>Data table</span></div></div></main>`);
    expect(r["Delete orders Data table"]!.risk).toBe("high");
    expect(r["customers Data table"]!.risk).toBe("high");
    expect(r["ledger Data table"]!.risk).toBe("low");
  });

  it("live /table: duplicate folder names and a folder called New Folder are still items", () => {
    const row = (
      name: string,
    ) => `<div role="button" tabindex="0"><div><svg></svg><span>${name}</span></div>
      <div><div>Folder</div><div>2 hours ago</div></div><div><button aria-label="Actions" aria-haspopup="menu"></button></div></div>`;
    const r = risks(
      `<main><div>${[
        "anaplan_poc",
        "Shopify connection",
        "Shopify connection",
        "New Folder",
        "New Folder",
        "snowflake-sample",
      ]
        .map(row)
        .join("")}</div></main>`,
    );
    for (const name of [
      "Shopify connection Folder 2 hours ago Actions",
      "New Folder Folder 2 hours ago Actions",
    ])
      expect(r[name], name).toMatchObject({ risk: "low", reversible: true });
  });

  it("live /table: a strip of source filters with counts reads as filters", () => {
    const chip = (name: string) =>
      `<button type="button" class="flex shrink-0 items-center gap-6 rounded-md px-8 py-4"><svg></svg>${name}</button>`;
    const r = risks(
      `<main><section aria-label="Tables"><div class="flex overflow-x-auto">${[
        "All",
        "Summation (118)",
        "Google Sheets (1)",
        "Postgres (0)",
        "Snowflake (7)",
      ]
        .map(chip)
        .join("")}</div></section></main>`,
    );
    for (const name of ["All", "Summation (118)", "Snowflake (7)"])
      expect(r[name], name).toMatchObject({ risk: "low", mutates: "view", reversible: true });
  });

  it("a group of toggles that carry aria-pressed reads as a filter; one alone does not", () => {
    const r = risks(`<main><div>
      <button aria-pressed="true">Open</button><button aria-pressed="false">Closed</button>
      <button aria-pressed="false">Merged</button></div>
      <button aria-pressed="false">Frobnicate</button></main>`);
    expect(r["Closed"]).toMatchObject({ risk: "low", mutates: "view" });
    expect(r["Merged"]).toMatchObject({ risk: "low", mutates: "view" });
    expect(r["Frobnicate"]!.risk).toBe("high");
  });
});
