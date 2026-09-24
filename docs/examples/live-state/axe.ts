/**
 * Ember Yoga: class booking with live state. One revision for the studio, moved by every change a
 * member or the front desk makes; per-action availability computed for the caller; handlers that
 * refuse with the same reason the manifest shows.
 */
import { createAXE, action, z } from "@axe/core";
import { kinds, accept } from "@axe/core/kinds";

// The studio's own store. `revision` moves with every booking, cancellation, or roster change,
// whoever made it, so an agent's `expectedRev` catches a front-desk edit made in the meantime.
const studio = {
  revision: 41,
  classes: new Map([
    ["yin-tue-1800", { title: "Yin, Tuesday 18:00", spots: 2, roster: new Set<string>() }],
  ]),
  passes: new Map<string, number>([["m_dana", 3]]),
  touch() {
    this.revision += 1;
  },
};

// #region create
export const axe = createAXE({
  name: "Ember Yoga",
  description:
    "Book and cancel spots in Ember Yoga classes for the signed-in member, and see which classes have room right now.",
  baseUrl: "https://ember-yoga.example",
  auth: { modes: ["none", "user"], userLoginUrl: "https://ember-yoga.example/login" },
  secret: process.env.AXE_SECRET,
  // The site's revision: one value for the whole studio. With it, every envelope carries `rev`,
  // a request whose `expectedRev` differs is refused with `conflict` before anything runs, and
  // `/axe/state` is served.
  revision: () => studio.revision,
});
// #endregion create

// #region availability
axe.register(
  action("classes.book", {
    title: "Book a class",
    description:
      "Reserves one spot in a class for the signed-in member and uses one credit from their pass. Returns the booking id. Cancellation is free until two hours before the class.",
    risk: "medium",
    idempotent: true,
    reversible: true,
    auth: "user",
    input: z.object({ classId: z.string().describe("Class id, e.g. 'yin-tue-1800'") }).strict(),
    output: z.object({ bookingId: z.string(), spotsLeft: z.number().int() }),
    examples: [{ input: { classId: "yin-tue-1800" }, output: { bookingId: "b_1", spotsLeft: 1 } }],
    // Whether this member can book right now, in the studio's own words. The manifest shows the
    // anonymous view; `/axe/state` computes it for the caller; the handler receives the same value.
    availability: ({ identity }) => {
      const credits = identity ? (studio.passes.get(identity.onBehalfOf) ?? 0) : 0;
      const open = [...studio.classes.values()].some((c) => c.spots > c.roster.size);
      if (!open) return { available: false, reason: "every class this week is full" };
      if (identity && credits === 0) {
        return {
          available: false,
          reason: "no credits left on the member's pass",
          requires: [
            accept(kinds.payment.card, {
              description: "Buy a 5-class pass ($90) to book.",
            }),
          ],
          handoff: {
            reason: "payment_required",
            instructions: "Buy a class pass on the account page.",
            url: "https://ember-yoga.example/account/passes",
            whatAgentShouldSayToUser:
              "Your Ember Yoga pass has no credits left. Buy a pass on their site and I'll book the class.",
          },
        };
      }
      return { available: true };
    },
    // #endregion availability
    // #region handler
    handler: async ({ input, identity, availability, expectedRev, unavailable, fail }) => {
      // The runtime already refused a stale `expectedRev` with `conflict`; here it is fresh (or absent).
      void expectedRev;
      // The handler is the one door: it refuses for the reason the manifest shows.
      if (availability && !availability.available) return unavailable(availability);
      const cls = studio.classes.get(input.classId);
      if (!cls) return fail("not_found", `No class "${input.classId}".`);
      if (cls.roster.size >= cls.spots)
        return unavailable({ available: false, reason: `${cls.title} is full` });
      cls.roster.add(identity!.onBehalfOf);
      studio.passes.set(identity!.onBehalfOf, studio.passes.get(identity!.onBehalfOf)! - 1);
      studio.touch(); // the ok envelope carries the new revision
      return { bookingId: `b_${cls.roster.size}`, spotsLeft: cls.spots - cls.roster.size };
    },
    // #endregion handler
  }),
);

export const handler = axe.fetchHandler();
