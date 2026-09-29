// A configuration overlay: reviewed in a diff, applied over what the page derives.
// #region config
import type { SurfaceConfig } from "@summationai/axe-surface/auto";

export const surfaceConfig: SurfaceConfig = {
  app: "Acme back office",
  routes: { exclude: ["/admin/**"] },
  policy: { high: "approve" },
  groups: {
    refunds: {
      title: "Refund an order",
      description: "Refunds one order to the card it was paid with.",
      risk: "high",
    },
  },
  rules: [
    // Say what an icon-only button does.
    { match: { selector: "button.row-menu" }, name: "Open the order's actions" },
    // A button the heuristics did not recognize: say what it changes and how risky it is.
    {
      match: { route: "/orders/:id", role: "button", name: "Recalculate" },
      name: "Recalculate the order's totals",
      effect: { mutates: "order", risk: "low", reversible: true },
    },
    // The page gives no reason when Ship is disabled; the application's words do.
    { match: { name: "Ship" }, reason: "an order ships once it is paid and packed" },
    // Fold every refund button into one domain action.
    { match: { name: "/^refund/i" }, group: "refunds" },
    // A private field, and a developer toolbar agents never see.
    { match: { name: "Tax ID" }, sensitive: true },
    { match: { selector: "#dev-toolbar *" }, hide: true },
  ],
};
// #endregion config
