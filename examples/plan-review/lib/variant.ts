// Evaluation variants (review item 17). One environment variable, read on the server at request
// time, selects what the running app exposes to an agent. The business logic, permissions, data,
// and reset state are the same in every variant; only the agent-facing interface differs.
//
//   PLAN_REVIEW_VARIANT unset  everything, as shipped (the default; every other suite uses this)
//   v1  the page only, generic markup: no accessible names or Surface attributes on the grid
//   v2  the page only, semantic markup: accessible names and the Surface DOM mirror, no tools
//   v3  basic structured tools (lib/basic-tools.ts): plain CRUD, no revision, no handoff
//   v4  the AXE actions (lib/axe.ts): live state, expectedRev, approvals, idempotent retries
//
// PLAN_REVIEW_UI_CHANGE=1 applies the controlled UI change the harness uses to measure
// maintenance: the Save button's visible label is renamed and the item column moves to the end.

export type Variant = "all" | "v1" | "v2" | "v3" | "v4";

export function variant(): Variant {
  const v = process.env["PLAN_REVIEW_VARIANT"];
  return v === "v1" || v === "v2" || v === "v3" || v === "v4" ? v : "all";
}

/** What the page renders for an agent that reads it. */
export interface PageView {
  /** `generic`: the controls without accessible names or Surface attributes (v1). */
  markup: "generic" | "semantic";
  /** The controlled UI change for the maintenance run. */
  uiChange: boolean;
}

export function pageView(): PageView {
  return {
    markup: variant() === "v1" ? "generic" : "semantic",
    uiChange: process.env["PLAN_REVIEW_UI_CHANGE"] === "1",
  };
}

/** The AXE endpoints and manifest answer only in v4 and as shipped. */
export function axeEnabled(): boolean {
  const v = variant();
  return v === "all" || v === "v4";
}

/** The basic tools answer only in v3 and as shipped. */
export function basicToolsEnabled(): boolean {
  const v = variant();
  return v === "all" || v === "v3";
}

export function notFound(): Response {
  return new Response(JSON.stringify({ error: "Not found." }), {
    status: 404,
    headers: { "content-type": "application/json" },
  });
}
