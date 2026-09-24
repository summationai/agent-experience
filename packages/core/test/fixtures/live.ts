/**
 * Test fixture: Ember Yoga, a class-booking site with live state (spec §21). One revision for the
 * studio, per-action availability that depends on the caller, and handlers that refuse for the
 * same reason the manifest shows. Shared by core, client, mcp, and testing.
 */
import { createAXE, action, z, accept, kinds } from "../../src/index";
import type { AXEConfig } from "../../src/index";

export interface StudioState {
  revision: number;
  spots: number;
  roster: string[];
  credits: Map<string, number>;
  handlerRuns: number;
}

export function liveAXE(
  overrides: Partial<AXEConfig> = {},
  studio: StudioState = {
    revision: 41,
    spots: 2,
    roster: [],
    credits: new Map([
      ["dana", 3],
      ["sam", 0],
    ]),
    handlerRuns: 0,
  },
) {
  const axe = createAXE({
    name: "Ember Yoga",
    description:
      "Book and cancel spots in Ember Yoga classes for the signed-in member, and see which classes have room right now.",
    baseUrl: "https://ember-yoga.example",
    humanFallbackUrl: "https://ember-yoga.example",
    auth: {
      modes: ["none", "user"],
      userLoginUrl: "https://ember-yoga.example/login",
      authenticate: async (req) => {
        const m = /^Bearer user:(.+)$/.exec(req.headers.get("Authorization") ?? "");
        return m ? { onBehalfOf: m[1]! } : null;
      },
    },
    policies: {
      rateLimit: { requestsPerMinute: 60 },
      termsUrl: "https://ember-yoga.example/terms",
    },
    contact: { email: "agents@ember-yoga.example" },
    secret: "test-secret-test-secret-test-secret",
    revision: () => studio.revision,
    ...overrides,
  });

  axe.register(
    action("classes.search", {
      title: "Search classes",
      description:
        "Lists this week's classes with the spots left in each. Returns the class id, title, and spots. Read-only; nothing changes.",
      readOnly: true,
      risk: "none",
      input: z.object({ style: z.string().optional().describe("Yoga style, e.g. 'yin'") }).strict(),
      output: z.object({
        classes: z.array(z.object({ id: z.string(), title: z.string(), spots: z.number().int() })),
      }),
      examples: [
        {
          input: {},
          output: { classes: [{ id: "yin-tue-1800", title: "Yin, Tuesday 18:00", spots: 2 }] },
        },
      ],
      handler: async () => ({
        classes: [
          {
            id: "yin-tue-1800",
            title: "Yin, Tuesday 18:00",
            spots: studio.spots - studio.roster.length,
          },
        ],
      }),
    }),
  );

  axe.register(
    action("waitlist.join", {
      title: "Join the waitlist",
      description:
        "Adds the signed-in member to a class waitlist and returns their position. Joining is free and can be undone at any time from the member's page.",
      risk: "low",
      idempotent: true,
      reversible: true,
      auth: "user",
      input: z.object({ classId: z.string().describe("Class id from classes.search") }).strict(),
      output: z.object({ position: z.number().int() }),
      examples: [{ input: { classId: "yin-tue-1800" }, output: { position: 1 } }],
      handler: async () => {
        studio.revision += 1;
        return { position: 1 };
      },
    }),
  );

  axe.register(
    action("classes.book", {
      title: "Book a class",
      description:
        "Reserves one spot in a class for the signed-in member and uses one credit from their pass. Returns the booking id and the spots left. Cancellation is free until two hours before.",
      risk: "medium",
      idempotent: true,
      reversible: true,
      auth: "user",
      input: z.object({ classId: z.string().describe("Class id from classes.search") }).strict(),
      output: z.object({ bookingId: z.string(), spotsLeft: z.number().int() }),
      examples: [
        { input: { classId: "yin-tue-1800" }, output: { bookingId: "b_1", spotsLeft: 1 } },
      ],
      availability: ({ identity }) => {
        if (studio.roster.length >= studio.spots)
          return { available: false, reason: "the class is full" };
        if (identity && (studio.credits.get(identity.onBehalfOf) ?? 0) === 0) {
          return {
            available: false,
            reason: "no credits left on the member's pass",
            requires: [accept(kinds.payment.card, { description: "Buy a 5-class pass ($90)." })],
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
      handler: async ({ identity, availability, unavailable }) => {
        studio.handlerRuns++;
        if (availability && !availability.available) return unavailable(availability);
        studio.roster.push(identity!.onBehalfOf);
        studio.credits.set(identity!.onBehalfOf, studio.credits.get(identity!.onBehalfOf)! - 1);
        studio.revision += 1;
        return {
          bookingId: `b_${studio.roster.length}`,
          spotsLeft: studio.spots - studio.roster.length,
        };
      },
    }),
  );

  return { axe, studio };
}

/** In-process HTTP helper. */
export function liveCall(
  axe: ReturnType<typeof createAXE>,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  const init: RequestInit = { method, headers: { "Content-Type": "application/json", ...headers } };
  if (body !== undefined) init.body = JSON.stringify(body);
  return axe.handle(new Request(`https://ember-yoga.example${path}`, init));
}
