/**
 * Oakridge Rentals: the apartment domain used throughout the docs, end to end.
 * search → present → select → transact, with a real requirement ladder and one genuine handoff.
 */
// #region imports
import { createAXE, action, z, accept, kinds } from "@axe/core";
// #endregion imports

// #region db
// Stand-ins for your existing service layer.
interface Unit {
  id: string;
  name: string;
  address: string;
  photos: string[];
  humanUrl: string;
  rentUsd: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  availableFrom: string;
  petPolicy: string;
  parking: string;
  badges: string[];
}
interface Application {
  id: string;
  unitId: string;
  applicantId: string;
  depositUsd: number;
  depositStatus: "pending" | "received";
  status: "draft" | "submitted";
  wireInstructions: string;
}
const db = {
  units: [] as Unit[],
  applications: new Map<string, Application>(),
  async searchUnits(_filters: {
    location: string;
    bedrooms?: number | undefined;
    maxRentUsd?: number | undefined;
    petFriendly?: boolean | undefined;
    moveInBy?: string | undefined;
    cursor?: string | undefined;
  }) {
    return { units: db.units, nextCursor: null as string | null };
  },
  async hasOpenApplication(unitId: string, applicantId: string) {
    return [...db.applications.values()].some(
      (a) => a.unitId === unitId && a.applicantId === applicantId,
    );
  },
  async createApplication(unitId: string, applicantId: string): Promise<Application> {
    const id = `APP-${8812 + db.applications.size}`;
    const app: Application = {
      id,
      unitId,
      applicantId,
      depositUsd: 500,
      depositStatus: "pending",
      status: "draft",
      wireInstructions: `Wire $500 to Oakridge Rentals, routing 021000021, account 123456789, memo ${id}.`,
    };
    db.applications.set(id, app);
    return app;
  },
  async submit(applicationId: string) {
    const app = db.applications.get(applicationId)!;
    app.status = "submitted";
    return { applicationId, depositStatus: app.depositStatus };
  },
  async bookTour(unitId: string, at: string, applicantId: string) {
    return { tourId: `t_${unitId}_${applicantId}`, at };
  },
};
const payments = {
  async settleDeposit(applicationId: string, _kind: string, _payload: unknown) {
    db.applications.get(applicationId)!.depositStatus = "received";
  },
};
// #endregion db

// #region create
export const axe = createAXE({
  name: "Oakridge Rentals",
  description:
    "Search available apartments in the Seattle area, schedule tours, submit rental applications with a holding deposit, and sign leases.",
  baseUrl: "https://oakridge-rentals.example",
  humanFallbackUrl: "https://oakridge-rentals.example",
  auth: {
    modes: ["none", "user"],
    userLoginUrl: "https://oakridge-rentals.example/login",
    // Pass-through: the agent sends a session token the human already has.
    authenticate: async (request) => {
      const token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
      const session = token ? await lookupSession(token) : null;
      return session ? { onBehalfOf: session.applicantId } : null;
    },
  },
  policies: {
    rateLimit: { requestsPerMinute: 120 },
    termsUrl: "https://oakridge-rentals.example/terms",
    dataRetention: "Application data is kept for 12 months after a decision.",
  },
  contact: { email: "agents@oakridge-rentals.example" },
  brand: { name: "Oakridge Rentals", accentColor: "#2b6cb0", tone: "neutral" },
  flows: [
    {
      name: "rent-a-unit",
      title: "Rent a unit",
      description: "Search for a unit, apply with a deposit, then sign the lease.",
      steps: ["units.search", "applications.submit", "leases.sign"],
    },
  ],
  secret: process.env.AXE_SECRET,
});
// #endregion create

// #region unit-schema
const UnitSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  photos: z.array(z.string()).describe("Absolute HTTPS image URLs"),
  humanUrl: z.string().describe("The listing page for humans"),
  rentUsd: z.number(),
  bedrooms: z.number().int(),
  bathrooms: z.number(),
  sqft: z.number().int(),
  availableFrom: z.string().date(),
  petPolicy: z.string(),
  parking: z.string(),
  badges: z.array(z.string()),
});
// #endregion unit-schema

// #region search
axe.register(
  action("units.search", {
    title: "Search available units",
    description:
      "Find available apartments by city or neighborhood, bedrooms, and monthly rent ceiling. Returns up to 20 units with pricing, size, availability, and pet policy. Prices are current as of the response and may change.",
    readOnly: true,
    risk: "none",
    input: z
      .object({
        location: z.string().describe("City or neighborhood, e.g. 'Bellevue, WA'"),
        bedrooms: z.number().int().min(0).max(5).optional().describe("Exact bedroom count"),
        maxRentUsd: z.number().int().positive().optional().describe("Monthly rent ceiling in USD"),
        petFriendly: z.boolean().optional().describe("Only units that allow pets"),
        moveInBy: z
          .string()
          .date()
          .optional()
          .describe("Latest acceptable move-in date, YYYY-MM-DD"),
        cursor: z.string().optional().describe("Opaque cursor from a previous page"),
      })
      .strict(),
    output: z.object({ units: z.array(UnitSchema), nextCursor: z.string().nullable() }),
    // #region display
    display: {
      kind: "list",
      items: "/units",
      item: {
        id: "/id",
        title: "/name",
        subtitle: "/address",
        image: "/photos",
        url: "/humanUrl",
        price: { amount: "/rentUsd", currency: "USD", period: "month" },
        attributes: [
          { label: "Bedrooms", path: "/bedrooms", format: "number" },
          { label: "Bathrooms", path: "/bathrooms", format: "number" },
          { label: "Size", path: "/sqft", format: "area", compare: "higher-better" },
          { label: "Available", path: "/availableFrom", format: "date", compare: "lower-better" },
          { label: "Pets", path: "/petPolicy", format: "text" },
          { label: "Parking", path: "/parking", format: "text" },
        ],
        badges: ["/badges"],
      },
      suggestedComparison: ["Size", "Available", "Pets"],
      emptyMessage:
        "No units match those filters. Widening the rent ceiling or removing the move-in date usually helps.",
      disclaimer:
        "Pricing and availability change frequently. Confirm on the listing page before applying.",
    },
    // #endregion display
    // #region affordances
    affordances: [
      { action: "tours.book", title: "Schedule a tour", input: { unitId: "/id" } },
      {
        action: "applications.submit",
        title: "Apply for this unit",
        input: { unitId: "/id" },
        primary: true,
      },
    ],
    // #endregion affordances
    // #region pagination
    pagination: {
      cursorIn: "/cursor",
      cursorOut: "/nextCursor",
      pageSize: { default: 10, max: 20 },
    },
    freshness: { cacheTtlSeconds: 300 },
    // #endregion pagination
    examples: [
      {
        input: { location: "Bellevue, WA", bedrooms: 1, maxRentUsd: 3200 },
        output: {
          units: [
            {
              id: "u_204",
              name: "The Meridian 204",
              address: "10800 NE 8th St, Bellevue",
              photos: ["https://oakridge-rentals.example/img/u204-1.jpg"],
              humanUrl: "https://oakridge-rentals.example/units/u_204",
              rentUsd: 2950,
              bedrooms: 1,
              bathrooms: 1,
              sqft: 720,
              availableFrom: "2026-10-15",
              petPolicy: "Cats and dogs under 40 lb",
              parking: "1 garage space included",
              badges: ["Pet friendly"],
            },
          ],
          nextCursor: null,
        },
      },
    ],
    // #region dynamic
    handler: async ({ input, context }) => {
      const page = await db.searchUnits(input);
      // Dynamic affordances: a unit the applicant already applied for offers only a tour.
      const units = await Promise.all(
        page.units.map(async (u) =>
          context.onBehalfOf && (await db.hasOpenApplication(u.id, context.onBehalfOf))
            ? {
                ...u,
                _axe: {
                  affordances: [
                    { action: "tours.book", title: "Schedule a tour", input: { unitId: u.id } },
                  ],
                },
              }
            : u,
        ),
      );
      return { units, nextCursor: page.nextCursor };
    },
    // #endregion dynamic
  }),
);
// #endregion search

// #region tours
axe.register(
  action("tours.book", {
    title: "Schedule a tour",
    description:
      "Books a 30-minute in-person tour of a unit at the requested time for the signed-in applicant. Returns the tour id and confirmed time. Tours can be cancelled up to two hours before.",
    risk: "medium",
    idempotent: true,
    reversible: true,
    auth: "user",
    input: z
      .object({
        unitId: z.string().describe("Unit id from units.search"),
        at: z.string().datetime({ offset: true }).describe("Requested start time, ISO 8601"),
      })
      .strict(),
    output: z.object({ tourId: z.string(), at: z.string() }),
    examples: [
      {
        input: { unitId: "u_204", at: "2026-10-02T17:00:00Z" },
        output: { tourId: "t_u_204_a1", at: "2026-10-02T17:00:00Z" },
      },
    ],
    handler: async ({ input, context }) => db.bookTour(input.unitId, input.at, context.onBehalfOf!),
  }),
);
// #endregion tours

// #region submit
axe.register(
  action("applications.submit", {
    title: "Submit a rental application",
    description:
      "Submits a completed application for a unit and places a refundable holding deposit. The deposit can only be paid by ACH or wire; card payments are not accepted. Returns the application id and deposit status.",
    risk: "high",
    idempotent: true,
    reversible: true,
    auth: "user",
    input: z.object({ unitId: z.string().describe("Unit id from units.search") }).strict(),
    output: z.object({ applicationId: z.string(), depositStatus: z.enum(["pending", "received"]) }),
    humanHandoff: { reasons: ["payment_required"] },
    examples: [
      {
        input: { unitId: "u_204" },
        output: { applicationId: "APP-8812", depositStatus: "received" },
      },
    ],
    // #region submit-handler
    handler: async ({ input, context, needsInput, handoff }) => {
      const app = await db.createApplication(input.unitId, context.onBehalfOf!);
      return needsInput({
        reason: "payment_required",
        message: `A refundable $${app.depositUsd} holding deposit is required to submit. Cards are not accepted.`,
        accepts: [
          accept(kinds.payment.achDebit, {
            description: "Authorize a one-time ACH debit for the deposit.",
          }),
          accept(kinds.payment.wireConfirmation, {
            description:
              "Provide the wire reference number after sending to the instructions below.",
            instructions: app.wireInstructions,
          }),
        ],
        state: { applicationId: app.id },
        // Only reached if the agent can satisfy neither option above.
        fallback: handoff({
          reason: "payment_required",
          instructions: "Pay the holding deposit by ACH or wire on the application page.",
          url: `https://oakridge-rentals.example/applications/${app.id}/deposit`,
          whatAgentShouldSayToUser:
            "Oakridge only takes the deposit by bank transfer, and I don't have bank details I can use for you. Can you complete it on their site? I'll finish the application once it's paid.",
          state: { applicationId: app.id },
        }),
      });
    },
    onContinue: async ({ kind, payload, state }) => {
      const { applicationId } = state as { applicationId: string };
      await payments.settleDeposit(applicationId, kind, payload);
      return db.submit(applicationId);
    },
    onResume: async ({ state }) => db.submit((state as { applicationId: string }).applicationId),
    // #endregion submit-handler
  }),
);
// #endregion submit

// #region lease
axe.register(
  action("leases.sign", {
    title: "Sign the lease",
    description:
      "Starts lease signing for an approved application. Oakridge requires an in-person signature with identity verification, so this always hands off to the human. Returns the lease id once signed.",
    risk: "high",
    idempotent: true,
    reversible: false,
    auth: "user",
    input: z.object({ applicationId: z.string().describe("Approved application id") }).strict(),
    output: z.object({ leaseId: z.string(), signedAt: z.string() }),
    humanHandoff: { reasons: ["signature_required"] },
    handler: async ({ input, handoff }) =>
      handoff({
        reason: "signature_required",
        instructions: "Visit the leasing office with photo ID to sign the lease in person.",
        url: `https://oakridge-rentals.example/applications/${input.applicationId}/lease`,
        whatAgentShouldSayToUser:
          "Oakridge requires an in-person signature with photo ID. Once you've signed at the leasing office, tell me and I'll confirm the lease.",
        state: { applicationId: input.applicationId },
        // The leasing office marks the handoff complete (see docs/human-handoff.md); resume is refused until then.
        requireCompletion: true,
      }),
    onResume: async ({ state, completion }) => ({
      leaseId: `L-${(state as { applicationId: string }).applicationId}`,
      signedAt: completion?.at ?? new Date().toISOString(),
    }),
  }),
);
// #endregion lease

// #region handler
export const handler = axe.fetchHandler();
// #endregion handler

async function lookupSession(token: string): Promise<{ applicantId: string } | null> {
  return token.startsWith("sess_") ? { applicantId: token.slice(5) } : null;
}
