// Serve a surface as an AXE manifest: observe and act become actions; refusals become the ladder.
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
});

for (const a of surfaceActions(surface, { namespace: "board" })) axe.register(a);

export const handler = axe.fetchHandler();
// #endregion serve
