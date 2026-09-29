/**
 * A surface served through AXE with the surface's revision as the site's revision.
 */
// #region serve
import { createAXE } from "@summationai/axe-core";
import { createSurface } from "@summationai/axe-surface";
import { surfaceActions } from "@summationai/axe-surface/axe";

export const surface = createSurface({ app: "fantasy-draft" });

export const axe = createAXE({
  name: "Fantasy Draft",
  description:
    "A draft board: observe which players can be drafted right now, then draft, undo, or flag them under one revision.",
  baseUrl: "https://draft.example",
  auth: { modes: ["none", "user"], userLoginUrl: "https://draft.example/login" },
  secret: process.env.AXE_SECRET,
  // The surface already keeps one revision for the application; make it the site's. Every
  // envelope now carries `rev`, and an act whose envelope `expectedRev` is stale is refused by the
  // protocol before the surface's own check runs.
  revision: surface.currentRev,
});

// Every entry is its own action, with the entry's live state as its availability. Only signed-in
// callers observe and act (`auth: "user"`, the default, written out).
axe.addProvider(surfaceActions(surface, { namespace: "board", auth: "user" }));
// #endregion serve
