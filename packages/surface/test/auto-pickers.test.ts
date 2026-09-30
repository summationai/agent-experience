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
});
