// Serve a surface as an AXE manifest: every entry becomes its own action; refusals become the ladder.
// #region serve
import { createAXE } from "@axe/core";
import { surfaceActions } from "@axe/surface/axe";
import { surface } from "./board";

export const axe = createAXE({
  name: "Fantasy Draft",
  description:
    "A draft board: observe which players can be drafted right now, then draft, undo, or flag them under one revision.",
  baseUrl: "https://draft.example",
  auth: { modes: ["none", "user"], userLoginUrl: "https://draft.example/login" },
  secret: process.env.AXE_SECRET,
  // The surface's revision is the site's: every envelope carries rev, and a stale expectedRev is
  // refused before any handler runs.
  revision: surface.currentRev,
});

// One action per entry, plus board.observe and board.ledger. The set follows the registry: a row
// that registers or unregisters is in or out of the manifest on the next request.
export const bridge = surfaceActions(surface, { namespace: "board" });
axe.addProvider(bridge);

export const handler = axe.fetchHandler();
// #endregion serve

// #region names
// Entry ids are not action names; the bridge maps them both ways, and the map is stable.
bridge.actionNameFor("pick:me:Gibbs"); // "board.pick-me-gibbs"
bridge.entryIdFor("board.pick-me-gibbs"); // "pick:me:Gibbs"
// #endregion names
