// Generic tools for a derived surface: a fixed set of domain actions, not one tool per widget.
// #region serve
import { createAXE } from "@axe/core";
import { autoActions } from "@axe/surface/axe";
import { handle } from "./start";

const axe = createAXE({
  name: "Acme back office",
  description: "Orders, refunds, and shipping, driven through the application's own pages.",
  baseUrl: "https://backoffice.acme.example",
  revision: handle.surface.currentRev,
});
// surface.observe, surface.ledger, surface.navigate, surface.set-field, surface.run-control,
// surface.load-more, and one action per configured group.
axe.addProvider(autoActions(handle));
// #endregion serve
export { axe };
