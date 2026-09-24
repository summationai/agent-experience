/**
 * Test fixture: a property manager with the full search → present → select → transact arc.
 * Shared by core, client, mcp, testing, and the docs examples.
 */
import { createAXE, action, z, accept, kinds } from "../../src/index";
import type { AXEConfig } from "../../src/index";

export const UnitSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  photos: z.array(z.string()),
  humanUrl: z.string(),
  rentUsd: z.number(),
  bedrooms: z.number().int(),
  bathrooms: z.number(),
  sqft: z.number().int(),
  availableFrom: z.string().date(),
  petPolicy: z.string(),
  parking: z.string(),
  badges: z.array(z.string()),
});

export const UNITS = [
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
  {
    id: "u_118",
    name: "Lakeview 118",
    address: "800 Bellevue Way NE, Bellevue",
    photos: [],
    humanUrl: "https://oakridge-rentals.example/units/u_118",
    rentUsd: 3150,
    bedrooms: 1,
    bathrooms: 1,
    sqft: 810,
    availableFrom: "2026-10-01",
    petPolicy: "Cats only",
    parking: "Street",
    badges: ["Available now"],
  },
];

export interface ApartmentsState {
  applications: Map<
    string,
    {
      unitId: string;
      depositUsd: number;
      status: "draft" | "submitted";
      depositStatus: "pending" | "received";
    }
  >;
  tours: string[];
  leaseSignatures: Set<string>;
}

export function apartmentsAXE(
  overrides: Partial<AXEConfig> = {},
  state: ApartmentsState = { applications: new Map(), tours: [], leaseSignatures: new Set() },
) {
  const axe = createAXE({
    name: "Oakridge Rentals",
    description:
      "Search available apartments in the Seattle area, schedule tours, submit rental applications with a holding deposit, and sign leases.",
    baseUrl: "https://oakridge-rentals.example",
    humanFallbackUrl: "https://oakridge-rentals.example",
    auth: {
      modes: ["none", "user"],
      userLoginUrl: "https://oakridge-rentals.example/login",
      authenticate: async (req) => {
        const h = req.headers.get("Authorization");
        const m = h ? /^Bearer user:(.+)$/.exec(h) : null;
        return m ? { onBehalfOf: m[1]! } : null;
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
    secret: "test-secret-test-secret-test-secret",
    ...overrides,
  });

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
          maxRentUsd: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Monthly rent ceiling in USD"),
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
      affordances: [
        { action: "tours.book", title: "Schedule a tour", input: { unitId: "/id" } },
        {
          action: "applications.submit",
          title: "Apply for this unit",
          input: { unitId: "/id" },
          primary: true,
        },
      ],
      pagination: {
        cursorIn: "/cursor",
        cursorOut: "/nextCursor",
        pageSize: { default: 10, max: 20 },
      },
      freshness: { cacheTtlSeconds: 300 },
      examples: [
        {
          input: { location: "Bellevue, WA", bedrooms: 1, maxRentUsd: 3200 },
          output: { units: UNITS, nextCursor: null },
        },
      ],
      handler: async ({ input }) => {
        const units = UNITS.filter((u) => (input.maxRentUsd ? u.rentUsd <= input.maxRentUsd : true))
          .filter((u) => (input.bedrooms !== undefined ? u.bedrooms === input.bedrooms : true))
          .map((u) => {
            const hasApp = [...state.applications.values()].some(
              (a) => a.unitId === u.id && a.status === "submitted",
            );
            return hasApp
              ? {
                  ...u,
                  _axe: {
                    affordances: [
                      { action: "tours.book", title: "Schedule a tour", input: { unitId: u.id } },
                    ],
                  },
                }
              : u;
          });
        return { units, nextCursor: null };
      },
    }),
  );

  axe.register(
    action("tours.book", {
      title: "Schedule a tour",
      description:
        "Books a 30-minute in-person tour of a unit at the requested time. Returns the tour id and confirmed time. Tours can be cancelled up to two hours before.",
      risk: "medium",
      idempotent: true,
      reversible: true,
      auth: "user",
      input: z
        .object({
          unitId: z.string().describe("Unit id from units.search"),
          at: z.string().datetime({ offset: true }).describe("Requested start time"),
        })
        .strict(),
      output: z.object({ tourId: z.string(), at: z.string() }),
      examples: [
        {
          input: { unitId: "u_204", at: "2026-10-02T17:00:00Z" },
          output: { tourId: "t_1", at: "2026-10-02T17:00:00Z" },
        },
      ],
      handler: async ({ input }) => {
        const tourId = `t_${state.tours.length + 1}`;
        state.tours.push(tourId);
        return { tourId, at: input.at };
      },
    }),
  );

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
      output: z.object({
        applicationId: z.string(),
        depositStatus: z.enum(["pending", "received"]),
      }),
      humanHandoff: { reasons: ["payment_required"] },
      examples: [
        {
          input: { unitId: "u_204" },
          output: { applicationId: "APP-8812", depositStatus: "received" },
        },
      ],
      handler: async ({ input, needsInput, handoff }) => {
        const id = `APP-${8812 + state.applications.size}`;
        state.applications.set(id, {
          unitId: input.unitId,
          depositUsd: 500,
          status: "draft",
          depositStatus: "pending",
        });
        return needsInput({
          reason: "payment_required",
          message:
            "A refundable $500 holding deposit is required to submit. Cards are not accepted.",
          accepts: [
            accept(kinds.payment.achDebit, {
              description: "Authorize a one-time ACH debit for the deposit.",
            }),
            accept(kinds.payment.wireConfirmation, {
              description:
                "Provide the wire reference number after sending to the instructions below.",
              instructions: `Wire $500 to Oakridge Rentals, routing 021000021, account 123456789, memo ${id}.`,
            }),
          ],
          state: { applicationId: id },
          fallback: handoff({
            reason: "payment_required",
            instructions: "Pay the holding deposit by ACH or wire on the application page.",
            url: `https://oakridge-rentals.example/applications/${id}/deposit`,
            whatAgentShouldSayToUser:
              "Oakridge only takes the deposit by bank transfer, and I don't have bank details I can use for you. Can you complete it on their site? I'll finish the application once it's paid.",
            state: { applicationId: id },
          }),
        });
      },
      onContinue: async ({ state: s }) => {
        const app = state.applications.get((s as { applicationId: string }).applicationId)!;
        app.depositStatus = "received";
        app.status = "submitted";
        return {
          applicationId: (s as { applicationId: string }).applicationId,
          depositStatus: "received" as const,
        };
      },
      onResume: async ({ state: s }) => {
        const id = (s as { applicationId: string }).applicationId;
        const app = state.applications.get(id)!;
        if (app.depositStatus !== "received") {
          app.depositStatus = "received";
        }
        app.status = "submitted";
        return { applicationId: id, depositStatus: "received" as const };
      },
    }),
  );

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
          requireCompletion: true,
        }),
      onResume: async ({ state: s, completion }) => {
        const id = (s as { applicationId: string }).applicationId;
        state.leaseSignatures.add(id);
        return { leaseId: `L-${id}`, signedAt: completion?.at ?? new Date().toISOString() };
      },
    }),
  );

  return { axe, state };
}

/** In-process HTTP helper. */
export function call(
  axe: ReturnType<typeof createAXE>,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  const init: RequestInit = { method, headers: { "Content-Type": "application/json", ...headers } };
  if (body !== undefined) init.body = JSON.stringify(body);
  return axe.handle(new Request(`https://oakridge-rentals.example${path}`, init));
}

export async function json<T = unknown>(res: Response): Promise<T> {
  return (await res.json()) as T;
}
