"use client";
// Browser-local capabilities: the page's own controls, registered by the components that render
// them (`useSurface` / `useSurfaceProps` in app/plan/PlanBoard.tsx), scoped to this tab and this
// page instance, and gone when the component unmounts or the tab closes.
//
// They are published at `window.__surface` by `exposePageSurface` and nowhere else. They are not
// AXE actions, the server never sees them, and there is no broker that carries them to a server,
// another tab, or another device: an agent reaches them only by running in this page (a
// browser-driving agent, or an in-page adapter such as a WebMCP bridge that hooks this module).
// Server capabilities (edit, submit, approve and lock) are AXE actions in lib/axe.ts; the
// browser-local ones below either change only this page (scroll, open a dialog, an unsaved draft)
// or call the app's own endpoint with this person's session, exactly as the page's button does.
import { createSurface } from "@summationai/axe-surface";
import type { Surface } from "@summationai/axe-surface";

/** The app name `observe()` reports for the page's surface. */
export const PAGE_SURFACE_APP = "plan-review-page";

/**
 * One surface per page instance (per tab). The revision is the application's: the page adopts
 * the plan's server revision with `setRev` on every refresh, so an agent in the page and the
 * server agree on what "the state I saw" means. Typed text is kept in the ledger as a hash only.
 */
export const pageSurface: Surface = createSurface({
  app: PAGE_SURFACE_APP,
  revision: "app",
  ledger: { text: "hash", max: 200 },
});

/**
 * Publish the page's surface for agents that run in the page. Returns the function that removes
 * it again. Call once from the root layout; an adapter (WebMCP, a test) can import `pageSurface`
 * from this module directly instead.
 */
export function exposePageSurface(
  host: object | null = typeof window !== "undefined" ? window : null,
): () => void {
  if (!host) return () => {};
  pageSurface.expose(host);
  return () => {
    delete (host as { __surface?: unknown }).__surface;
  };
}
