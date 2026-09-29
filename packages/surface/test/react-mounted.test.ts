// @vitest-environment jsdom
/**
 * Mounted React behavior of `useSurface` and `useSurfaceProps`: real effects under
 * `react-dom/client` in jsdom, so registration, cleanup, Strict Mode, and the external-store
 * subscription run as they do in a browser. `react.test.ts` covers the server render.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { StrictMode, act, createElement, useState } from "react";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { createSurface } from "../src/index";
import type { ActionEntry, CollectionEntry, FieldEntry, Surface } from "../src/index";
import { useSurface, useSurfaceProps } from "../src/react";

beforeAll(() => {
  // Tell React this environment supports `act`, so updates flush inside it without warnings.
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let mounted: { root: Root; container: HTMLElement }[] = [];
afterEach(() => {
  for (const { root, container } of mounted) {
    act(() => root.unmount());
    container.remove();
  }
  mounted = [];
});

function mount(element: ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  act(() => root.render(element));
  return {
    container,
    render: (next: ReactElement) => act(() => root.render(next)),
    unmount: () => {
      act(() => root.unmount());
      mounted = mounted.filter((m) => m.root !== root);
    },
  };
}

const ids = (s: Surface) => s.entries().map((e) => e.id);

function action(id: string, over: Partial<ActionEntry> = {}): ActionEntry {
  return {
    id,
    kind: "action",
    role: "button",
    name: `Press ${id}`,
    effect: { mutates: "board" },
    handler: () => {},
    ...over,
  };
}

/** Registers one action; `label` is a value the entry uses that the caller passes as a dep. */
function Row(props: { id: string; surface: Surface; label?: string }) {
  useSurface(
    action(props.id, { name: props.label ?? `Press ${props.id}` }),
    [props.label],
    props.surface,
  );
  return null;
}

describe("useSurface mounted", () => {
  it("registers on mount, refreshes in place on a dep change, and unregisters on unmount", () => {
    const s = createSurface();
    const view = mount(createElement(Row, { id: "a", surface: s, label: "one" }));
    expect(ids(s)).toEqual(["a"]);
    expect(s.observe().entries[0]!.name).toBe("one");
    view.render(createElement(Row, { id: "a", surface: s, label: "two" }));
    expect(s.observe().entries[0]!.name).toBe("two");
    view.unmount();
    expect(ids(s)).toEqual([]);
  });

  it("re-rendering or refreshing one row keeps every row where it was [S-ENT-5]", () => {
    const s = createSurface();
    const list = (middle: string) =>
      createElement(
        "div",
        null,
        createElement(Row, { key: "a", id: "a", surface: s, label: "a" }),
        createElement(Row, { key: "b", id: "b", surface: s, label: middle }),
        createElement(Row, { key: "c", id: "c", surface: s, label: "c" }),
      );
    const view = mount(list("b1"));
    expect(ids(s)).toEqual(["a", "b", "c"]);
    const before = s.registryVersion();
    view.render(list("b1")); // an ordinary re-render with the same deps
    expect(s.registryVersion()).toBe(before);
    view.render(list("b2")); // a refresh of the middle row
    expect(ids(s)).toEqual(["a", "b", "c"]);
    expect(s.observe().entries.map((e) => [e.index, e.name])).toEqual([
      [1, "a"],
      [2, "b2"],
      [3, "c"],
    ]);
  });

  it("an id change moves the registration: the old id leaves, the new id stays until unmount", () => {
    const s = createSurface();
    const view = mount(createElement(Row, { id: "old", surface: s }));
    expect(ids(s)).toEqual(["old"]);
    view.render(createElement(Row, { id: "new", surface: s }));
    expect(ids(s)).toEqual(["new"]);
    view.unmount();
    expect(ids(s)).toEqual([]);
  });

  it("a target change moves the registration to the new surface and out of the old one", () => {
    const first = createSurface();
    const second = createSurface();
    const view = mount(createElement(Row, { id: "a", surface: first }));
    expect(ids(first)).toEqual(["a"]);
    view.render(createElement(Row, { id: "a", surface: second }));
    expect(ids(first)).toEqual([]);
    expect(ids(second)).toEqual(["a"]);
    view.unmount();
    expect(ids(second)).toEqual([]);
  });

  it("an act runs the latest render's handler even when deps leave out what the handler reads", async () => {
    const s = createSurface();
    const seen: number[] = [];
    let setCount: (n: number) => void = () => {};
    function Counter() {
      const [count, set] = useState(0);
      setCount = set;
      // `count` is deliberately not in deps: the entry's shape does not depend on it.
      useSurface(action("inc", { handler: () => void seen.push(count) }), [], s);
      return null;
    }
    mount(createElement(Counter));
    const version = s.registryVersion();
    act(() => setCount(5));
    // A new closure alone does not re-register the entry.
    expect(s.registryVersion()).toBe(version);
    expect((await s.act({ target: "inc", op: "CLICK", expectedRev: s.currentRev() })).status).toBe(
      "ok",
    );
    act(() => setCount(7));
    expect((await s.act({ target: "inc", op: "CLICK", expectedRev: s.currentRev() })).status).toBe(
      "ok",
    );
    expect(seen).toEqual([5, 7]);
  });

  it("a field's setter and a collection's more are the latest render's too", async () => {
    const s = createSurface();
    const seen: string[] = [];
    let setTag: (t: string) => void = () => {};
    function Parts() {
      const [tag, set] = useState("first");
      setTag = set;
      const field: FieldEntry = {
        id: "note",
        kind: "field",
        role: "textbox",
        name: "Note",
        edit: { set: (text) => void seen.push(`${tag}:${text}`) },
      };
      const list: CollectionEntry = {
        id: "list",
        kind: "collection",
        role: "list",
        name: "Players",
        more: () => void seen.push(`${tag}:more`),
      };
      useSurface(field, [], s);
      useSurface(list, [], s);
      return null;
    }
    mount(createElement(Parts));
    act(() => setTag("second"));
    await s.act({ target: "note", op: "TYPE_TEXT", text: "hi", expectedRev: s.currentRev() });
    await s.act({ target: "list", op: "SCROLL_DOWN", expectedRev: s.currentRev() });
    expect(seen).toEqual(["second:hi", "second:more"]);
  });

  it("is safe under Strict Mode: one row per entry, in render order, and none after unmount", () => {
    const s = createSurface();
    const list = createElement(
      StrictMode,
      null,
      createElement(Row, { key: "a", id: "a", surface: s }),
      createElement(Row, { key: "b", id: "b", surface: s }),
      createElement(Row, { key: "c", id: "c", surface: s }),
    );
    const view = mount(list);
    expect(ids(s)).toEqual(["a", "b", "c"]);
    view.render(
      createElement(
        StrictMode,
        null,
        createElement(Row, { key: "a", id: "a", surface: s }),
        createElement(Row, { key: "b", id: "b", surface: s, label: "refreshed" }),
        createElement(Row, { key: "c", id: "c", surface: s }),
      ),
    );
    expect(ids(s)).toEqual(["a", "b", "c"]);
    expect(s.get("b")?.name).toBe("refreshed");
    view.unmount();
    expect(ids(s)).toEqual([]);
  });

  it("an id change under Strict Mode leaves only the new id", () => {
    const s = createSurface();
    const view = mount(
      createElement(StrictMode, null, createElement(Row, { id: "x", surface: s })),
    );
    view.render(createElement(StrictMode, null, createElement(Row, { id: "y", surface: s })));
    expect(ids(s)).toEqual(["y"]);
  });
});

/** A button that spreads `useSurfaceProps`; `state` feeds the entry and is its dep. */
function Button(props: {
  surface: Surface;
  id?: string;
  name?: string;
  state?: ActionEntry["state"];
  onRender?: () => void;
}) {
  props.onRender?.();
  const id = props.id ?? "draft";
  const name = props.name ?? "Draft Jahmyr Gibbs (RB)";
  const attrs = useSurfaceProps(
    action(id, { name, state: props.state ?? { available: true } }),
    [name, props.state],
    props.surface,
  );
  return createElement("button", attrs, "Draft");
}

const button = (container: HTMLElement) => container.querySelector("button")!;
const attrs = (el: Element) =>
  Object.fromEntries([...el.attributes].map((a) => [a.name, a.value] as const));

describe("useSurfaceProps mounted", () => {
  it("freeze and thaw show on the control and leave no attribute behind (surface mode)", () => {
    const s = createSurface();
    const { container } = mount(createElement(Button, { surface: s }));
    expect(button(container).hasAttribute("aria-disabled")).toBe(false);
    let thaw!: () => void;
    act(() => {
      thaw = s.freeze("saving");
    });
    expect(attrs(button(container))).toMatchObject({
      "aria-disabled": "true",
      "data-surface-reason": "saving",
    });
    act(() => thaw());
    expect(button(container).hasAttribute("aria-disabled")).toBe(false);
    expect(button(container).hasAttribute("data-surface-reason")).toBe(false);
  });

  it("freeze and thaw show on the control in app revision mode, where the revision does not move", () => {
    const s = createSurface({ revision: "app" });
    act(() => s.setRev(40));
    const { container } = mount(createElement(Button, { surface: s }));
    let thaw!: () => void;
    act(() => {
      thaw = s.freeze("server save");
    });
    expect(s.currentRev()).toBe(40);
    expect(button(container).getAttribute("data-surface-reason")).toBe("server save");
    act(() => thaw());
    expect(button(container).hasAttribute("data-surface-reason")).toBe(false);
  });

  it("availability that returns removes aria-disabled and data-surface-reason from the DOM", () => {
    const s = createSurface();
    const taken = { available: false as const, reason: "already drafted by another team" };
    const view = mount(createElement(Button, { surface: s, state: taken }));
    expect(attrs(button(view.container))).toMatchObject({
      "aria-disabled": "true",
      "data-surface-reason": "already drafted by another team",
    });
    view.render(createElement(Button, { surface: s, state: { available: true } }));
    expect(button(view.container).hasAttribute("aria-disabled")).toBe(false);
    expect(button(view.container).hasAttribute("data-surface-reason")).toBe(false);
    expect(s.attributesFor("draft")?.set).not.toHaveProperty("aria-disabled");
  });

  it("a live name change is the control's new accessible name and the observed name", () => {
    const s = createSurface();
    const view = mount(createElement(Button, { surface: s, name: "Star Gibbs as a target" }));
    view.render(createElement(Button, { surface: s, name: "Remove Gibbs from targets" }));
    expect(button(view.container).getAttribute("aria-label")).toBe("Remove Gibbs from targets");
    expect(s.observe().entries[0]!.name).toBe("Remove Gibbs from targets");
  });

  it("an id change is the control's new data-surface-id", () => {
    const s = createSurface();
    const view = mount(createElement(Button, { surface: s, id: "pick:1" }));
    view.render(createElement(Button, { surface: s, id: "pick:2" }));
    expect(button(view.container).getAttribute("data-surface-id")).toBe("pick:2");
    expect(ids(s)).toEqual(["pick:2"]);
  });

  it("a change in app revision mode with setRev, and no bump, still reaches the control", () => {
    const s = createSurface({ revision: "app" });
    const view = mount(createElement(Button, { surface: s }));
    // The server confirms the pick: the app adopts its revision and re-renders the row.
    act(() => s.setRev(8));
    view.render(
      createElement(Button, { surface: s, state: { available: false, reason: "picked by you" } }),
    );
    expect(button(view.container).getAttribute("data-surface-reason")).toBe("picked by you");
    view.render(createElement(Button, { surface: s, state: { available: true } }));
    expect(button(view.container).hasAttribute("data-surface-reason")).toBe(false);
  });

  it("the control follows register, unregister, and reconcile made outside the component", () => {
    const s = createSurface({ revision: "app" });
    const { container } = mount(createElement(Button, { surface: s }));
    // Another writer replaces the entry in place (a non-React adapter sharing the id).
    act(() =>
      s.register(action("draft", { state: { available: false, reason: "locked by the server" } })),
    );
    expect(button(container).getAttribute("data-surface-reason")).toBe("locked by the server");
    act(() => s.register(action("draft", { name: "Draft Jahmyr Gibbs (RB)" })));
    expect(button(container).hasAttribute("data-surface-reason")).toBe(false);
    // Removed from the table, the control falls back to its own entry.
    act(() => s.register(action("draft", { state: { available: false, reason: "gone" } })));
    act(() => s.unregister("draft"));
    expect(button(container).hasAttribute("data-surface-reason")).toBe(false);
    act(() => s.register(action("draft", { state: { available: false, reason: "again" } })));
    act(() => s.reconcile("dr", new Set()));
    expect(button(container).hasAttribute("data-surface-reason")).toBe(false);
  });

  it("subscribes once across re-renders and does not loop", () => {
    const s = createSurface();
    const subscribe = vi.spyOn(s, "subscribe");
    let renders = 0;
    const onRender = () => void (renders += 1);
    const view = mount(createElement(Button, { surface: s, onRender }));
    for (let i = 0; i < 5; i += 1) view.render(createElement(Button, { surface: s, onRender }));
    act(() => void s.bump());
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(renders).toBeLessThan(12);
  });

  it("is safe under Strict Mode: the props follow a freeze and the row is registered once", () => {
    const s = createSurface();
    const { container } = mount(
      createElement(StrictMode, null, createElement(Button, { surface: s })),
    );
    expect(ids(s)).toEqual(["draft"]);
    let thaw!: () => void;
    act(() => {
      thaw = s.freeze("saving");
    });
    expect(button(container).getAttribute("data-surface-reason")).toBe("saving");
    act(() => thaw());
    expect(button(container).hasAttribute("data-surface-reason")).toBe(false);
  });
});
