import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createSurface } from "../src/index";
import type { ActionEntry, FieldEntry } from "../src/index";
import { toSurfaceProps, useSurfaceProps } from "../src/react";
import type { SurfaceProps } from "../src/react";

const entry: ActionEntry = {
  id: "pick:me:gibbs",
  kind: "action",
  role: "button",
  name: "Draft Jahmyr Gibbs (RB)",
  object: "player:gibbs",
  state: { available: false, reason: "already drafted by another team" },
  effect: { mutates: "draft", reversible: true },
  handler: () => {},
};

describe("useSurfaceProps [S-DOM-1]", () => {
  it("the rendered control carries the accessible name, id, kind, object, and the reason", () => {
    const surface = createSurface();
    function Row() {
      const props = useSurfaceProps(entry, [entry.state], surface);
      return createElement("button", { ...props, disabled: true }, "Draft");
    }
    const html = renderToStaticMarkup(createElement(Row));
    expect(html).toBe(
      '<button aria-label="Draft Jahmyr Gibbs (RB)" data-surface-id="pick:me:gibbs" data-surface-kind="action" data-surface-object="player:gibbs" aria-disabled="true" data-surface-reason="already drafted by another team" disabled="">Draft</button>',
    );
  });

  it("props spread onto input and div; aria flags are booleans for React", () => {
    const surface = createSurface();
    const field: FieldEntry = {
      id: "note",
      kind: "field",
      role: "textbox",
      name: "Note to the commissioner",
      edit: { readOnly: true, reason: "draft is over" },
    };
    let seen: SurfaceProps | undefined;
    function Field() {
      const props = useSurfaceProps(field, [], surface);
      seen = props;
      return createElement("div", {}, createElement("input", { ...props, readOnly: true }));
    }
    const html = renderToStaticMarkup(createElement(Field));
    expect(seen).toEqual({
      "aria-label": "Note to the commissioner",
      "data-surface-id": "note",
      "data-surface-kind": "field",
      "aria-readonly": true,
      "data-surface-reason": "draft is over",
    });
    expect(html).toContain('aria-readonly="true"');
    expect(html).toContain('data-surface-id="note"');
  });

  it("toSurfaceProps converts the string attributes; an available action has no aria-disabled key", () => {
    expect(toSurfaceProps({ "aria-label": "x", "aria-disabled": "true" })).toEqual({
      "aria-label": "x",
      "aria-disabled": true,
    });
    const surface = createSurface();
    let seen: SurfaceProps | undefined;
    function Row() {
      seen = useSurfaceProps({ ...entry, state: { available: true } }, [], surface);
      return null;
    }
    renderToStaticMarkup(createElement(Row));
    expect(seen).toEqual({
      "aria-label": "Draft Jahmyr Gibbs (RB)",
      "data-surface-id": "pick:me:gibbs",
      "data-surface-kind": "action",
      "data-surface-object": "player:gibbs",
    });
    expect(seen && "aria-disabled" in seen).toBe(false);
  });
});
