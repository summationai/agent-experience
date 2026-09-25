// Offer the draft board's controls to the browser's own agent through WebMCP, where the browser
// has it. Runs in the page, next to the code that registers the controls.
// #region expose
import { exposeWebMcp } from "@axe/surface/webmcp";
import { surface } from "../surface/board";

// Browser-driving agents keep reading window.__surface, whatever the browser supports.
surface.expose(typeof window !== "undefined" ? window : null);

// Registers surface_observe and one tool per control when document.modelContext exists;
// otherwise registers nothing and says why. The human UI is the same either way.
const webmcp = exposeWebMcp(surface, { actor: "browser-agent" });
if (!webmcp.supported) console.info(`WebMCP not offered: ${webmcp.reason}`);

// A single-page app that tears the board down (a route change) closes it too.
export function leaveBoard(): void {
  webmcp.close();
}
// #endregion expose

// #region options
// Leave unavailable controls out instead of describing them, and use a prefix per page so two
// surfaces on one page do not collide.
export const quiet = exposeWebMcp(surface, { unavailable: "omit", prefix: "draft_" });
// #endregion options
