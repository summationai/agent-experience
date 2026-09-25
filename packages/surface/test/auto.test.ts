// @vitest-environment jsdom
/**
 * `autoSurface` over realistic fixtures in jsdom: derived names, reasons, and availability; keys
 * that survive a re-render and a sibling insertion; staleness; the risk defaults and their
 * approval gate; the configuration overlay; coverage. Mounted React behavior (onChange, onClick)
 * is in auto-react.test.ts.
 */
import { afterEach, describe, expect, it } from "vitest";
import { createSurface } from "../src/index";
import type { ActResult, ObservedEntry, Surface } from "../src/index";
import { autoSurface, formatCoverage, defaultRoute } from "../src/auto";
import type { AutoSurfaceHandle, SurfaceConfig } from "../src/auto";

let handles: AutoSurfaceHandle[] = [];
afterEach(() => {
  for (const h of handles) h.stop();
  handles = [];
  document.body.innerHTML = "";
  window.history.replaceState({}, "", "/");
});

function start(
  html: string,
  config?: SurfaceConfig,
  extra: Parameters<typeof autoSurface>[0] = {},
) {
  document.body.innerHTML = html;
  const h = autoSurface({
    ...(config ? { config } : {}),
    observe: { settle: { quietMs: 5, timeoutMs: 100 }, debounceMs: 0 },
    ...extra,
  });
  handles.push(h);
  return h;
}

const rows = (s: Surface) => s.observe().entries;
const byName = (s: Surface, name: string, role?: string): ObservedEntry => {
  const found = rows(s).filter((r) => r.name === name && (!role || r.role === role));
  if (found.length !== 1)
    throw new Error(
      `expected one entry named ${name}, found ${found.length}: ${rows(s)
        .map((r) => `${r.role}:${r.name}`)
        .join(", ")}`,
    );
  return found[0]!;
};
const act = (
  s: Surface,
  target: string,
  extra: Partial<Parameters<Surface["act"]>[0]> = {},
): Promise<ActResult> => {
  const row = s.observe().entries.find((r) => r.id === target)!;
  const op =
    row.kind === "field" ? "TYPE_TEXT" : row.kind === "collection" ? "SCROLL_DOWN" : "CLICK";
  return s.act({ op, target, expectedRev: s.currentRev(), ...extra });
};
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

const FORM = `
<main>
  <h1>Profile</h1>
  <form aria-label="Profile" onsubmit="event.preventDefault()">
    <label for="email">Email</label>
    <input id="email" type="email" value="ada@example.com" aria-invalid="true" aria-describedby="email-err">
    <span id="email-err">Enter a work email</span>
    <label>Display name <input name="display" value="Ada"></label>
    <input placeholder="Search people" type="search">
    <input type="password" id="pw" aria-label="Password" value="hunter2">
    <input autocomplete="cc-number" aria-label="Card number" value="4242">
    <select aria-label="Plan"><option value="free">Free</option><option value="pro" selected>Pro</option></select>
    <textarea aria-label="Bio" readonly title="Bios are managed by HR">Hi</textarea>
    <input type="checkbox" id="news"><label for="news">Send me the newsletter</label>
    <button type="submit" disabled>Save profile</button>
  </form>
</main>`;

describe("derivation [S-AUTO-2]", () => {
  it("names controls from labels, wrapping labels, aria-label, and placeholder, with confidence", () => {
    const h = start(FORM);
    const s = h.surface;
    expect(byName(s, "Email").kind).toBe("field");
    expect(byName(s, "Email").value).toBe("ada@example.com");
    expect(byName(s, "Display name").value).toBe("Ada");
    expect(byName(s, "Search people").role).toBe("searchbox");
    expect(h.metaFor(byName(s, "Search people").id)?.confidence).toBe("low");
    expect(h.metaFor(byName(s, "Email").id)?.nameFrom).toBe("label");
    expect(byName(s, "Plan").value).toBe("Pro");
    expect(byName(s, "Send me the newsletter").role).toBe("checkbox");
    expect(byName(s, "Send me the newsletter").value).toEqual({ checked: false });
  });

  it("reports a disabled submit's reason from the form's invalid fields", () => {
    const s = start(FORM).surface;
    const save = byName(s, "Save profile");
    expect(save.state).toEqual({ available: false, reason: "Email: Enter a work email" });
    expect(save.index).toBeNull();
  });

  it("never reports a password, card, or one-time-code value, and makes them read only to agents", () => {
    const s = start(FORM).surface;
    for (const n of ["Password", "Card number"]) {
      const r = byName(s, n);
      expect(r.sensitive).toBe(true);
      expect("value" in r).toBe(false);
      expect(r.edit?.readOnly).toBe(true);
    }
    expect(JSON.stringify(s.observe())).not.toContain("hunter2");
    expect(JSON.stringify(s.observe())).not.toContain("4242");
  });

  it("a read-only field says why, from its title", () => {
    const s = start(FORM).surface;
    expect(byName(s, "Bio").edit).toMatchObject({
      readOnly: true,
      reason: "Bios are managed by HR",
    });
  });

  it("gives the object context from the landmark, form, and heading", () => {
    const s = start(FORM).surface;
    expect(byName(s, "Email").object).toBe("Profile");
    expect(byName(s, "Email").source).toBe("derived");
  });
});

const ICONS = `
<header>
  <button aria-label="Open notifications"><svg class="lucide lucide-bell"></svg></button>
  <button><svg class="lucide lucide-trash-2"></svg></button>
  <button><svg></svg></button>
  <a href="/settings/billing"><svg></svg></a>
</header>`;

describe("icon-only controls", () => {
  it("names from aria-label; guesses from an icon class or an href with low confidence; reports the rest as gaps", () => {
    const h = start(ICONS);
    const s = h.surface;
    expect(byName(s, "Open notifications").role).toBe("button");
    const trash = byName(s, "trash");
    expect(h.metaFor(trash.id)).toMatchObject({ nameFrom: "icon", confidence: "low" });
    expect(h.metaFor(byName(s, "Billing").id)).toMatchObject({
      nameFrom: "href",
      confidence: "low",
    });
    const cov = h.coverage();
    const kinds = cov.gaps.map((g) => g.kind);
    expect(kinds).toContain("icon-only");
    const unnamed = cov.gaps.filter(
      (g) => g.kind === "icon-only" && g.message.includes("has no accessible name"),
    );
    expect(unnamed).toHaveLength(1);
    expect(unnamed[0]!.suggestion).toMatchObject({ name: "say what it does" });
  });
});

describe("keys [S-AUTO-3]", () => {
  const table = (names: string[]) => `
<main>
  <h2>Members</h2>
  <table aria-label="Members">
    <thead><tr><th scope="col">Name</th><th scope="col">Actions</th></tr></thead>
    <tbody>${names.map((n) => `<tr><td>${n}</td><td><button>Remove</button><button>Edit</button></td></tr>`).join("")}</tbody>
  </table>
</main>`;

  it("row controls take the row label as object and key context, so keys survive a sibling insertion and a re-render", async () => {
    const h = start(table(["Ada", "Grace"]));
    const s = h.surface;
    const removeGrace = rows(s).find((r) => r.name === "Remove" && r.object === "Grace")!;
    expect(removeGrace.id).toContain("row:grace");
    const before = new Set(rows(s).map((r) => r.id));
    // A sibling row inserted before Grace, then the whole tbody re-rendered as new nodes.
    document.body.innerHTML = table(["Ada", "Linus", "Grace"]);
    h.refresh();
    const after = new Set(rows(s).map((r) => r.id));
    for (const id of before) expect(after.has(id)).toBe(true);
    expect(rows(s).find((r) => r.name === "Remove" && r.object === "Grace")!.id).toBe(
      removeGrace.id,
    );
  });

  it("the route is part of the key, with id-like segments collapsed", () => {
    expect(defaultRoute({ pathname: "/projects/123/settings" })).toBe("/projects/:id/settings");
    expect(defaultRoute({ pathname: "/p/0b0e8a8e-7a1c-4d3b-9c9d-2f8b1e0c1a2b/" })).toBe("/p/:id");
    window.history.replaceState({}, "", "/teams/42");
    const s = start(table(["Ada"])).surface;
    expect(
      rows(s)
        .find((r) => r.name === "Remove")!
        .id.startsWith("/teams/:id#"),
    ).toBe(true);
  });

  it("data-surface-id pins the id", () => {
    const s = start(`<button data-surface-id="export-csv">Export</button>`).surface;
    expect(byName(s, "Export").id).toBe("export-csv");
    expect(byName(s, "Export").source).toBe("annotated");
  });

  it("duplicates in one context get an ordinal and a coverage gap", () => {
    const h = start(`<main><button>Save</button><button>Save</button></main>`);
    const ids = rows(h.surface)
      .filter((r) => r.name === "Save")
      .map((r) => r.id);
    expect(ids[1]).toBe(`${ids[0]}~2`);
    expect(h.coverage().gaps.some((g) => g.kind === "duplicate-name")).toBe(true);
  });
});

describe("acting by the same door [S-AUTO-4]", () => {
  it("click dispatches pointer, mouse, focus, and click, in a person's order", async () => {
    const h = start(`<button id="b">Refresh</button>`);
    const b = document.getElementById("b")!;
    const seen: string[] = [];
    for (const t of ["pointerdown", "mousedown", "focus", "pointerup", "mouseup", "click"])
      b.addEventListener(t, () => seen.push(t));
    const r = await act(h.surface, byName(h.surface, "Refresh").id);
    expect(r.status).toBe("ok");
    expect(seen).toEqual(["pointerdown", "mousedown", "focus", "pointerup", "mouseup", "click"]);
  });

  it("typing sets the value through the native setter and fires input and change", async () => {
    const h = start(FORM);
    const input = document.getElementById("email") as HTMLInputElement;
    const events: string[] = [];
    input.addEventListener("input", () => events.push(`input:${input.value}`));
    input.addEventListener("change", () => events.push("change"));
    const r = await act(h.surface, byName(h.surface, "Email").id, { text: "ada@acme.com" });
    expect(r.status).toBe("ok");
    expect(events).toEqual(["input:ada@acme.com", "change"]);
    expect(byName(h.surface, "Email").value).toBe("ada@acme.com");
  });

  it("a select chooses by label or value, and refuses an option it does not have", async () => {
    const h = start(FORM);
    const plan = byName(h.surface, "Plan");
    expect(plan.edit?.schema).toEqual({ type: "string", enum: ["Free", "free", "Pro", "pro"] });
    expect((await act(h.surface, plan.id, { text: "Free" })).status).toBe("ok");
    expect(byName(h.surface, "Plan").value).toBe("Free");
    const bad = await act(h.surface, plan.id, { text: "Enterprise" });
    expect(bad.status).toBe("error");
  });

  it("a checkbox toggles by click and reports its checked state", async () => {
    const h = start(FORM);
    const box = byName(h.surface, "Send me the newsletter");
    const r = await act(h.surface, box.id);
    expect(r, JSON.stringify(r)).toMatchObject({ status: "ok" });
    expect(byName(h.surface, "Send me the newsletter").value).toEqual({ checked: true });
    if (r.status === "ok") expect(r.output.changed).toContain(box.id);
  });

  it("a rich-text editor without a name is named from its placeholder and typed into with input events", async () => {
    const h = start(
      `<main><h2>Notes</h2><div class="ProseMirror" contenteditable="true"><p data-placeholder="Write a note…" class="is-empty"></p></div></main>`,
    );
    const s = h.surface;
    const ed = byName(s, "Write a note…");
    expect(ed.kind).toBe("field");
    expect(h.metaFor(ed.id)?.confidence).toBe("low");
    const el = document.querySelector(".ProseMirror")!;
    const types: string[] = [];
    el.addEventListener("beforeinput", (e) => types.push(`before:${(e as InputEvent).inputType}`));
    el.addEventListener("input", () => types.push("input"));
    expect((await act(s, ed.id, { text: "Call Ada" })).status).toBe("ok");
    expect(types).toEqual(["before:insertText", "input"]);
    expect(el.textContent).toBe("Call Ada");
  });

  it("an act reports text that appeared in a toast while the page settled", async () => {
    const h = start(`<main><button id="save">Save draft</button></main>`);
    document.getElementById("save")!.addEventListener("click", () => {
      setTimeout(() => {
        const t = document.createElement("div");
        t.className = "Toastify__toast";
        t.textContent = "Draft saved";
        document.body.appendChild(t);
      }, 1);
    });
    const r = await act(h.surface, byName(h.surface, "Save draft").id);
    expect(r.status).toBe("ok");
    if (r.status === "ok") expect(r.output.notices).toEqual(["Draft saved"]);
  });

  it("an act whose control left the page is a conflict, not a click on something else", async () => {
    const h = start(`<main><button id="x">Refresh</button></main>`);
    const id = byName(h.surface, "Refresh").id;
    const rev = h.surface.currentRev();
    // Removed without the observer having run yet: the act flushes, sees the revision moved, and refuses.
    document.getElementById("x")!.remove();
    const r = await h.surface.act({ op: "CLICK", target: id, expectedRev: rev });
    expect(r.status).toBe("error");
    if (r.status === "error") expect(r.error.code).toBe("conflict");
  });
});

describe("revision and staleness [S-AUTO-6]", () => {
  it("a DOM change moves the revision, and an act at the old revision is refused", async () => {
    const h = start(`<main><button id="a">Refresh</button></main>`);
    const s = h.surface;
    const rev = s.currentRev();
    const id = byName(s, "Refresh").id;
    const b = document.createElement("button");
    b.textContent = "Export";
    document.querySelector("main")!.appendChild(b);
    await tick(5);
    expect(s.currentRev()).toBeGreaterThan(rev);
    const r = await s.act({ op: "CLICK", target: id, expectedRev: rev });
    expect(r.status === "error" && r.error.code).toBe("conflict");
  });

  it("a change that alters no entry leaves the revision alone", async () => {
    const h = start(`<main><button>Refresh</button><p id="p">x</p></main>`);
    const rev = h.surface.currentRev();
    document.getElementById("p")!.className = "y";
    await tick(5);
    expect(h.surface.currentRev()).toBe(rev);
  });

  it("observe flushes a change the observer has not delivered yet", () => {
    const h = start(`<main><button>Refresh</button></main>`);
    const b = document.createElement("button");
    b.textContent = "Export";
    document.querySelector("main")!.appendChild(b);
    // No await: the MutationObserver callback has not run.
    expect(rows(h.surface).some((r) => r.name === "Export")).toBe(true);
  });
});

const DANGER = `
<main>
  <h2>Danger zone</h2>
  <button>Delete project</button>
  <button class="btn btn-danger">Reset everything</button>
  <button data-variant="destructive">Wipe</button>
  <button>Frobnicate</button>
  <button>Cancel subscription</button>
  <button>Cancel</button>
  <a href="/docs">Docs</a>
  <a href="https://elsewhere.example/">Partner site</a>
</main>`;

describe("safety defaults [S-AUTO-7]", () => {
  it("classifies by wording, styling, and role", () => {
    const h = start(DANGER);
    const s = h.surface;
    const risk = (n: string) => byName(s, n).effect?.risk;
    expect(risk("Delete project")).toBe("high");
    expect(risk("Reset everything")).toBe("high");
    expect(risk("Wipe")).toBe("high");
    expect(risk("Cancel subscription")).toBe("high");
    expect(risk("Frobnicate")).toBe("high");
    expect(h.metaFor(byName(s, "Frobnicate").id)?.unrecognized).toBe(true);
    expect(risk("Cancel")).toBe("low");
    expect(risk("Docs")).toBe("low");
    expect(risk("Partner site")).toBe("medium");
    expect(byName(s, "Delete project").object).toBe("Danger zone");
  });

  it("gates high risk behind the person's approval with a handoff, and approve() opens it once", async () => {
    const h = start(DANGER);
    const s = h.surface;
    let clicks = 0;
    document.querySelector("button")!.addEventListener("click", () => clicks++);
    const del = byName(s, "Delete project");
    expect(del.state?.available).toBe(false);
    expect(del.state?.reason).toMatch(/needs the person's approval/);
    expect(del.state?.handoff).toMatchObject({ reason: "approval_required" });
    const refused = await act(s, del.id);
    expect(refused.status === "error" && refused.error.code).toBe("unavailable");
    expect(clicks).toBe(0);
    expect(h.approve(del.id)).toBe(true);
    expect(byName(s, "Delete project").state?.available).toBe(true);
    expect((await act(s, del.id)).status).toBe("ok");
    expect(clicks).toBe(1);
    // One use: gated again.
    expect(byName(s, "Delete project").state?.available).toBe(false);
  });

  it("policy can deny or allow high risk", () => {
    const deny = start(DANGER, { policy: { high: "deny" } }).surface;
    expect(byName(deny, "Delete project").state?.reason).toMatch(/may not/);
    const allow = start(DANGER, { policy: { high: "allow" } }).surface;
    expect(byName(allow, "Delete project").state?.available).toBe(true);
  });

  it("a confirmation dialog's affirmative button is high risk; its cancel is low", () => {
    const s = start(`<main><button>Open</button></main>
      <div role="alertdialog" aria-modal="true" aria-labelledby="t"><h2 id="t">Remove Ada?</h2>
      <button>Yes</button><button>Cancel</button></div>`).surface;
    expect(byName(s, "Yes").effect?.risk).toBe("high");
    expect(byName(s, "Cancel").effect?.risk).toBe("low");
    expect(byName(s, "Yes").object).toBe("Remove Ada?");
    // The page behind the modal is unavailable, with the dialog named.
    expect(byName(s, "Open").state).toEqual({
      available: false,
      reason: "behind the open dialog “Remove Ada?”; close it first",
    });
  });
});

describe("configuration overlay [S-CFG-*]", () => {
  it("renames, re-objects, sets reason, risk, hides, and pins", () => {
    const h = start(DANGER + `<button disabled>Archive</button>`, {
      rules: [
        {
          match: { name: "Frobnicate" },
          name: "Recompute the forecast",
          effect: { risk: "medium", mutates: "forecast" },
        },
        { match: { name: "Archive" }, reason: "only owners can archive", object: "Project" },
        { match: { name: "Wipe" }, hide: true },
        { match: { role: "link", name: "Docs" }, id: "docs-link" },
      ],
    });
    const s = h.surface;
    const f = byName(s, "Recompute the forecast");
    expect(f.effect).toMatchObject({ risk: "medium", mutates: "forecast" });
    expect(f.state?.available).toBe(true);
    expect(f.source).toBe("annotated");
    expect(byName(s, "Archive").state).toEqual({
      available: false,
      reason: "only owners can archive",
    });
    expect(byName(s, "Archive").object).toBe("Project");
    expect(rows(s).some((r) => r.name === "Wipe")).toBe(false);
    expect(byName(s, "Docs").id).toBe("docs-link");
  });

  it("a handler replaces the DOM dispatch: the declared tier", async () => {
    const calls: string[] = [];
    const h = start(DANGER, {
      policy: { high: "allow" },
      rules: [
        {
          match: { name: "Delete project" },
          handler: ({ entryId, element }) => void calls.push(`${entryId}:${element?.textContent}`),
        },
      ],
    });
    let clicked = 0;
    document.querySelector("button")!.addEventListener("click", () => clicked++);
    const del = byName(h.surface, "Delete project");
    expect(del.source).toBeUndefined();
    expect(h.metaFor(del.id)?.source).toBe("declared");
    expect((await act(h.surface, del.id)).status).toBe("ok");
    expect(calls).toEqual([`${del.id}:Delete project`]);
    expect(clicked).toBe(0);
  });

  it("marks a field sensitive, and editable only when the config says so", async () => {
    const h = start(`<label>Account number <input id="acct" value="12345678"></label>`, {
      rules: [{ match: { name: "Account number" }, sensitive: true }],
    });
    const r = byName(h.surface, "Account number");
    expect(r.sensitive).toBe(true);
    expect(r.edit?.readOnly).toBe(true);
    h.configure({
      rules: [{ match: { name: "Account number" }, sensitive: true, editable: true }],
    });
    const again = byName(h.surface, "Account number");
    expect(again.edit?.readOnly).toBe(false);
    expect((await act(h.surface, again.id, { text: "999" })).status).toBe("ok");
    expect((document.getElementById("acct") as HTMLInputElement).value).toBe("999");
    expect(JSON.stringify(h.surface.ledger())).not.toContain("999");
  });

  it("groups fold matches into a domain action; unmatched rules are reported stale", () => {
    const h = start(DANGER, {
      groups: {
        "manage-project": {
          title: "Manage the project",
          description: "Delete or reset the project.",
          risk: "high",
        },
      },
      rules: [
        { match: { name: "/^(delete|reset)/i" }, group: "manage-project" },
        { match: { route: "/", name: "Rename project" }, name: "x" },
        { match: { selector: "#nope" }, name: "y" },
      ],
    });
    expect(h.metaFor(byName(h.surface, "Delete project").id)?.group).toBe("manage-project");
    const stale = h.coverage().staleConfig;
    expect(stale.map((x) => [x.index, x.status])).toEqual([
      [1, "stale"],
      [2, "unmatched"],
    ]);
  });

  it("a selector rule with a role brings in a clickable div", () => {
    document.body.innerHTML = `<main><div class="card" tabindex="0">Quarterly report</div></main>`;
    const h = autoSurface({ observe: { debounceMs: 0 } });
    handles.push(h);
    expect(rows(h.surface).some((r) => r.name === "Quarterly report")).toBe(false);
    expect(h.coverage().gaps.find((g) => g.kind === "custom-widget")?.suggestion).toMatchObject({
      role: "button",
    });
    h.configure({
      rules: [
        {
          match: { selector: ".card" },
          role: "button",
          name: "Open the quarterly report",
          effect: { risk: "low", mutates: "view" },
        },
      ],
    });
    expect(byName(h.surface, "Open the quarterly report").effect?.risk).toBe("low");
  });

  it("routes include and exclude; declared entries stand beside derived ones", () => {
    window.history.replaceState({}, "", "/admin");
    const h = start(`<button>Refresh</button>`, {
      routes: { exclude: ["/admin/**", "/admin"] },
      declare: [
        {
          id: "chat.send",
          kind: "action",
          role: "button",
          name: "Send a chat message",
          effect: { mutates: "chat", risk: "medium" },
          handler: () => {},
        },
      ],
    });
    expect(rows(h.surface).map((r) => r.id)).toEqual(["chat.send"]);
  });
});

describe("shadow DOM, frames, virtualized lists", () => {
  it("reads open shadow roots", () => {
    document.body.innerHTML = `<main><x-card></x-card></main>`;
    const host = document.querySelector("x-card")!;
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<label for="q">Quantity</label><input id="q" value="2"><button>Add to order</button>`;
    const h = autoSurface({ observe: { debounceMs: 0 } });
    handles.push(h);
    expect(byName(h.surface, "Quantity").value).toBe("2");
    expect(byName(h.surface, "Add to order").kind).toBe("action");
  });

  it("reports a virtualized grid as partial coverage and scrolls it to load more", async () => {
    const h =
      start(`<main><div role="grid" aria-label="Orders" aria-rowcount="501" style="overflow: auto; height: 200px">
      <div role="row" aria-rowindex="1"><div role="columnheader">Order</div></div>
      <div role="row" aria-rowindex="2"><div role="gridcell">A-1</div></div>
      <div role="row" aria-rowindex="3"><div role="gridcell">A-2</div></div></div></main>`);
    const grid = byName(h.surface, "Orders");
    expect(grid).toMatchObject({ kind: "collection", total: 500, loaded: 2 });
    expect(grid.index).not.toBeNull();
    expect(h.coverage().gaps.find((g) => g.kind === "virtualized")?.message).toMatch(
      /only the visible rows/,
    );
    let scrolled = 0;
    document.querySelector('[role="grid"]')!.addEventListener("scroll", () => scrolled++);
    expect((await act(h.surface, grid.id)).status).toBe("ok");
    expect(scrolled).toBe(1);
  });

  it("counts a pinned-column grid's rows once per aria-rowindex (ag-grid)", () => {
    const row = (i: number) =>
      `<div role="row" aria-rowindex="${i}"><div role="gridcell">r${i}</div></div>`;
    const h = start(`<div role="grid" aria-label="Positions" aria-rowcount="100">
      <div class="left">${row(2)}${row(3)}</div><div class="center">${row(2)}${row(3)}</div></div>`);
    expect(byName(h.surface, "Positions")).toMatchObject({ loaded: 2, total: 100 });
  });

  it("a table with a load-more button loads more by clicking it", async () => {
    const h = start(
      `<main><h2>Invoices</h2><table><tbody><tr><td>INV-1</td></tr></tbody></table><button id="more">Load more</button></main>`,
    );
    let n = 0;
    document.getElementById("more")!.addEventListener("click", () => n++);
    const t = byName(h.surface, "Invoices");
    expect((await act(h.surface, t.id)).status).toBe("ok");
    expect(n).toBe(1);
  });

  it("reports canvas and chart regions as opaque, naming the library", () => {
    const shapes = Array.from({ length: 14 }, () => "<rect></rect>").join("");
    const h =
      start(`<main><div class="highcharts-container"><svg class="highcharts-root"><text class="highcharts-title">Revenue</text>${shapes}</svg></div>
      <div class="gc-spread-sheet"><canvas></canvas></div></main>`);
    const gaps = h.coverage().gaps;
    expect(gaps.find((g) => g.kind === "chart")?.message).toMatch(/Highcharts chart \(“Revenue”\)/);
    expect(gaps.find((g) => g.kind === "canvas")?.message).toMatch(/SpreadJS spreadsheet/);
  });
});

describe("navigate [S-AUTO-11]", () => {
  it("landmarks and a navigate entry that opens a same-origin path", async () => {
    const h = start(
      `<nav aria-label="Primary"><a href="/reports">Reports</a></nav><main><h1>Home</h1></main>`,
    );
    const s = h.surface;
    expect(byName(s, "Primary").role).toBe("navigation");
    expect(byName(s, "Main content").role).toBe("main");
    let followed = "";
    document.querySelector("a")!.addEventListener("click", (e) => {
      e.preventDefault();
      followed = "/reports";
    });
    const nav = byName(s, "Go to a page of this site");
    expect((await act(s, nav.id, { text: "/reports" })).status).toBe("ok");
    expect(followed).toBe("/reports");
    await expect(act(s, nav.id, { text: "https://evil.example/" })).rejects.toThrow(
      /not on this site/,
    );
  });
});

describe("coverage [S-AUTO-10]", () => {
  it("counts by kind and source, lists approvals and gaps, and formats as Markdown", () => {
    const h = start(
      FORM + ICONS + DANGER,
      { rules: [{ match: { name: "Docs" }, name: "Read the docs" }] },
      { now: () => new Date("2026-09-25T00:00:00Z") },
    );
    const surface = h.surface;
    surface.register({
      id: "declared.one",
      kind: "action",
      role: "button",
      name: "Declared thing",
      effect: { mutates: "x" },
      handler: () => {},
    });
    const c = h.coverage();
    expect(c.counts.bySource.declared).toBe(1);
    expect(c.counts.bySource.annotated).toBe(1);
    expect(c.counts.bySource.derived).toBeGreaterThan(10);
    expect(c.approvals.map((a) => a.name)).toContain("Delete project");
    const md = formatCoverage(c);
    expect(md).toMatch(/^# Surface coverage: \//);
    expect(md).toContain("## Needs the person");
    expect(md).toContain("## Suggested configuration");
    expect(md).toContain("| Id | Kind | Role | Name |");
  });

  it("expose publishes coverage on window.__surface", () => {
    start(`<button>Refresh</button>`, undefined, { expose: true });
    const pub = (
      window as unknown as {
        __surface: { coverage: () => { counts: { entries: number } }; observe: () => unknown };
      }
    ).__surface;
    expect(pub.coverage().counts.entries).toBeGreaterThan(0);
  });
});

describe("lifecycle", () => {
  it("stop unregisters derived entries and leaves the application's own", () => {
    const surface = createSurface();
    surface.register({
      id: "mine",
      kind: "action",
      role: "button",
      name: "Mine",
      effect: { mutates: "x" },
      handler: () => {},
    });
    document.body.innerHTML = `<button>Refresh</button>`;
    const h = autoSurface({ surface });
    expect(surface.entries().length).toBeGreaterThan(1);
    h.stop();
    expect(surface.entries().map((e) => e.id)).toEqual(["mine"]);
  });

  it("an application entry pinned by data-surface-id is not derived again", () => {
    const surface = createSurface();
    surface.register({
      id: "draft",
      kind: "action",
      role: "button",
      name: "Draft Gibbs",
      effect: { mutates: "draft" },
      handler: () => {},
    });
    document.body.innerHTML = `<button data-surface-id="draft" aria-label="Draft Gibbs">Draft</button>`;
    const h = autoSurface({ surface });
    handles.push(h);
    expect(surface.entries().filter((e) => e.id === "draft")).toHaveLength(1);
    expect(surface.get("draft")!.source).toBeUndefined();
  });
});
