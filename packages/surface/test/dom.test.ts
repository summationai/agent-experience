import { describe, expect, it } from "vitest";
import { createSurface, describeEntry, surfaceAttributes, surfaceSelector } from "../src/index";
import type { ActionEntry, CollectionEntry, FieldEntry } from "../src/index";

const draft: ActionEntry = {
  id: "pick:me:gibbs",
  kind: "action",
  role: "button",
  name: "Draft Jahmyr Gibbs (RB)",
  object: "player:gibbs",
  state: { available: false, reason: "already drafted by another team" },
  effect: { mutates: "draft", reversible: true },
  handler: () => {},
};

describe("surfaceAttributes [S-DOM-1]", () => {
  it("an available action carries name, id, kind, and object, and nothing about state", () => {
    expect(
      surfaceAttributes({ ...draft, state: { available: true }, object: "player:gibbs" }),
    ).toEqual({
      "aria-label": "Draft Jahmyr Gibbs (RB)",
      "data-surface-id": "pick:me:gibbs",
      "data-surface-kind": "action",
      "data-surface-object": "player:gibbs",
    });
    // No `state` means available; no `object` means no object attribute.
    const { object: _o, state: _s, ...bare } = draft;
    expect(Object.keys(surfaceAttributes(bare))).toEqual([
      "aria-label",
      "data-surface-id",
      "data-surface-kind",
    ]);
  });

  it("an unavailable action is aria-disabled with its reason", () => {
    expect(surfaceAttributes(draft)).toMatchObject({
      "aria-disabled": "true",
      "data-surface-reason": "already drafted by another team",
    });
    expect(surfaceAttributes(draft)["aria-readonly"]).toBeUndefined();
  });

  it("a name that is a function is resolved", () => {
    expect(surfaceAttributes({ ...draft, name: () => "Draft Gibbs" })["aria-label"]).toBe(
      "Draft Gibbs",
    );
  });

  it("fields: editable carries the common set; read-only is aria-readonly with its reason", () => {
    const editable: FieldEntry = {
      id: "note",
      kind: "field",
      role: "textbox",
      name: "Note to the commissioner",
      value: "hi",
      edit: { maxLength: 80, set() {} },
    };
    expect(surfaceAttributes(editable)).toEqual({
      "aria-label": "Note to the commissioner",
      "data-surface-id": "note",
      "data-surface-kind": "field",
    });
    const locked: FieldEntry = {
      ...editable,
      edit: { readOnly: true, reason: "draft is over" },
    };
    expect(surfaceAttributes(locked)).toMatchObject({
      "aria-readonly": "true",
      "data-surface-reason": "draft is over",
    });
    expect(surfaceAttributes(locked)["aria-disabled"]).toBeUndefined();
    expect(
      surfaceAttributes({ ...editable, edit: { readOnly: true } })["data-surface-reason"],
    ).toBe("read only");
  });

  it("collections carry the common set only, whether or not they can load more", () => {
    const board: CollectionEntry = {
      id: "board",
      kind: "collection",
      role: "grid",
      name: "Players",
      total: 300,
      loaded: 24,
    };
    const common = {
      "aria-label": "Players",
      "data-surface-id": "board",
      "data-surface-kind": "collection",
    };
    expect(surfaceAttributes(board)).toEqual(common);
    expect(surfaceAttributes({ ...board, more() {} })).toEqual(common);
  });

  it("reads observed rows the same as registered entries", () => {
    const s = createSurface();
    s.register(draft);
    s.register({
      id: "note",
      kind: "field",
      role: "textbox",
      name: "Note",
      edit: { readOnly: true, reason: "draft is over" },
    });
    const [row, field] = s.observe().entries;
    expect(surfaceAttributes(row!)).toEqual(surfaceAttributes(draft));
    expect(surfaceAttributes(field!)).toMatchObject({
      "aria-readonly": "true",
      "data-surface-reason": "draft is over",
    });
  });
});

describe("surfaceSelector [S-DOM-3]", () => {
  it("quotes the id so colons and spaces need no escaping", () => {
    expect(surfaceSelector("pick:me:gibbs")).toBe('[data-surface-id="pick:me:gibbs"]');
    expect(surfaceSelector("lock 2026-03")).toBe('[data-surface-id="lock 2026-03"]');
  });

  it("escapes quotes, backslashes, and newlines", () => {
    expect(surfaceSelector('say "hi"')).toBe('[data-surface-id="say \\"hi\\""]');
    expect(surfaceSelector("a\\b")).toBe('[data-surface-id="a\\\\b"]');
    expect(surfaceSelector("two\nlines")).toBe('[data-surface-id="two\\a lines"]');
  });

  it("finds exactly the element that carries the attributes", () => {
    // A minimal attribute matcher standing in for querySelector, so the contract is pinned
    // without a DOM: the selector's value, unescaped, equals the id the attributes carry.
    const id = 'weird: "id" \\ here';
    const attrs = surfaceAttributes({ ...draft, id });
    const m = /^\[data-surface-id="((?:[^"\\]|\\.)*)"\]$/.exec(surfaceSelector(id));
    expect(m).not.toBeNull();
    const unescaped = m![1]!.replace(/\\a /g, "\n").replace(/\\(.)/g, "$1");
    expect(unescaped).toBe(attrs["data-surface-id"]);
  });
});

describe("describeEntry [S-DOM-4]", () => {
  it("an action: name, availability with reason, then the effect", () => {
    expect(describeEntry(draft)).toBe(
      "Draft Jahmyr Gibbs (RB): unavailable, already drafted by another team; mutates draft, reversible, risk medium",
    );
    expect(
      describeEntry({
        ...draft,
        state: { available: true },
        effect: { mutates: "locks", idempotent: true, risk: "high", confirm: true },
      }),
    ).toBe(
      "Draft Jahmyr Gibbs (RB): available; mutates locks, idempotent, not reversible, risk high, confirm required",
    );
    // Legacy `undoable` reads as reversible.
    expect(describeEntry({ ...draft, effect: { mutates: "draft", undoable: true } })).toContain(
      "; mutates draft, reversible,",
    );
  });

  it("a field: editable or read only with reason, value, and length", () => {
    const note: FieldEntry = {
      id: "note",
      kind: "field",
      role: "textbox",
      name: "Note",
      value: "hi",
      edit: { maxLength: 80, set() {} },
    };
    expect(describeEntry(note)).toBe('Note: editable, value "hi", up to 80 characters');
    expect(describeEntry({ ...note, value: null, edit: { set() {} } })).toBe("Note: editable");
    expect(describeEntry({ ...note, edit: { readOnly: true, reason: "draft is over" } })).toBe(
      'Note: read only, draft is over, value "hi"',
    );
  });

  it("a collection: loaded of total, and whether it can load more", () => {
    const board: CollectionEntry = {
      id: "board",
      kind: "collection",
      role: "grid",
      name: "Players",
      total: 300,
      loaded: 24,
    };
    expect(describeEntry(board)).toBe("Players: 24 of 300 loaded, cannot load more");
    expect(describeEntry({ ...board, more() {} })).toBe("Players: 24 of 300 loaded, can load more");
    expect(describeEntry({ ...board, loaded: null })).toBe("Players: 300 items, cannot load more");
    expect(describeEntry({ ...board, total: null, loaded: null })).toBe(
      "Players: collection, cannot load more",
    );
  });

  it("describes observed rows the same as registered entries", () => {
    const s = createSurface();
    s.register(draft);
    s.register({
      id: "board",
      kind: "collection",
      role: "grid",
      name: "Players",
      total: 3,
      loaded: 3,
      more() {},
    });
    const [row, board] = s.observe().entries;
    expect(describeEntry(row!)).toBe(describeEntry(draft));
    expect(describeEntry(board!)).toBe("Players: 3 of 3 loaded, can load more");
  });
});
