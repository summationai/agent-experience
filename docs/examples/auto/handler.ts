// The declared tier inside a configuration: a real application function in place of the click,
// so the write can carry the revision the agent presented.
// #region handler
import { SurfaceConflict } from "@summationai/axe-surface";
import type { SurfaceConfig } from "@summationai/axe-surface/auto";

declare function archiveOrder(
  id: string,
  expectedRev: number,
): Promise<{ ok: boolean; rev: number }>;

export const withHandler: SurfaceConfig = {
  rules: [
    {
      match: { route: "/orders/:id", name: "Archive order" },
      effect: { mutates: "order", risk: "medium", reversible: true },
      approval: false,
      handler: async ({ element, expectedRev }) => {
        const id = element?.closest("[data-order-id]")?.getAttribute("data-order-id");
        if (!id) throw new SurfaceConflict("The order is no longer on the page.");
        const result = await archiveOrder(id, expectedRev);
        if (!result.ok) throw new SurfaceConflict(undefined, { currentRev: result.rev });
        return { notices: ["Order archived"] };
      },
    },
  ],
};
// #endregion handler
