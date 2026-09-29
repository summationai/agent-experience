// An unavailable control can say what would unblock it. Through the AXE bridge this becomes
// needs_input (kinds an agent may hold) with an optional human fallback.
// #region lock
import { createSurface } from "@summationai/axe-surface";
import { toJsonSchema } from "@summationai/axe-core";
import { kinds, accept } from "@summationai/axe-core/kinds";

const plan = { approved: false, locked: false, revision: 129 };
// The server owns the revision (adopted as is with setRev), and the kinds below carry Zod
// schemas, so the converter that publishes them is passed in; the surface does not import Zod.
export const surface = createSurface({ app: "planning-app", revision: "app", toJsonSchema });
surface.setRev(plan.revision);

function registerLock() {
  surface.register({
    id: "lock:2026-03",
    kind: "action",
    role: "button",
    name: "Lock March",
    object: "month:2026-03",
    state: plan.approved
      ? { available: true }
      : {
          available: false,
          reason: "approval required",
          requires: {
            accepts: [
              accept(kinds.consent.terms, {
                description: "Record the planner's approval of the March lock.",
              }),
            ],
            fulfill: () => {
              plan.approved = true;
              registerLock();
            },
          },
          handoff: {
            reason: "approval_required",
            instructions: "Approve the March lock in the planning app.",
            url: "https://plan.example/locks/2026-03",
            whatAgentShouldSayToUser:
              "The March lock needs your approval in the planning app before I can apply it.",
          },
        },
    effect: {
      mutates: "locks",
      idempotent: true,
      reversible: true,
      risk: "high",
      text: "reason for the lock",
    },
    handler: (_actor, text) => {
      plan.locked = true;
      void text;
      plan.revision += 1;
      // Report what changed and the revision the server assigned; the surface adopts both.
      return { changed: ["lock:2026-03"], rev: plan.revision };
    },
  });
}
registerLock();
// #endregion lock
