/**
 * Kestrel Wholesale: `site` mode. Retail partners' agents authenticate with an API key
 * the wholesaler issued; each key is scoped to the actions that partner may call.
 */
import { createHash } from "node:crypto";
import { createAXE, action, z } from "@axe/core";

// #region keys
// Stand-in for your API-key table. Store a hash of each key, never the key itself.
// Your admin UI issues keys (shown once), records the hash, and sets revokedAt to revoke.
interface ApiKeyRecord {
  id: string;
  partner: string;
  actions: string[];
  revokedAt: string | null;
}

const keysBySha256 = new Map<string, ApiKeyRecord>([
  [
    "a5d9d9bd022ad27632f3fd4578df098262de607781ddb50c57c2dd521f5b7b1e",
    {
      id: "key_northlake_retail",
      partner: "Northlake Retail Co.",
      actions: ["stock.check", "purchase-orders.place"],
      revokedAt: null,
    },
  ],
  [
    "b8485c89ecc068bef48647d6d64940a19aa8e03091b8bb86d036319cfaa5813f",
    {
      id: "key_pricefeed",
      partner: "PriceFeed aggregator",
      actions: ["stock.check"],
      revokedAt: null,
    },
  ],
]);

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// The runtime does not pass the verdict's `id` to handlers in v0, so a handler that needs
// to know which partner is calling resolves it from the same bearer key.
function partnerFromRequest(request: Request): ApiKeyRecord {
  const key = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const record = keysBySha256.get(sha256(key));
  if (!record) throw new Error("verifySiteKey admitted a key that is no longer in the table");
  return record;
}
// #endregion keys

// Stand-in for your warehouse and order systems.
const warehouse = {
  async stock(itemCode: string) {
    return {
      itemCode,
      onHand: 1200,
      nextInbound: "2026-10-14" as string | null,
      unitPriceUsd: 4.35,
    };
  },
  async placeOrder(
    _partnerId: string,
    lines: { itemCode: string; quantity: number }[],
    _poReference?: string,
  ) {
    return { orderNumber: `PO-${88213 + lines.length}`, expectedShipDate: "2026-10-02" };
  },
};

// #region create
const axe = createAXE({
  name: "Kestrel Wholesale",
  description:
    "Check live stock levels and place purchase orders against a retail partner's wholesale account. Order history and returns are handled on the partner portal.",
  baseUrl: "https://wholesale.kestrel.example",
  humanFallbackUrl: "https://wholesale.kestrel.example/portal",
  auth: {
    modes: ["site"],
    verifySiteKey: async (key) => {
      const record = keysBySha256.get(sha256(key));
      if (!record || record.revokedAt) return false; // the agent receives `unauthorized`
      // Scoped keys: calling an action outside this list returns `forbidden`.
      return { id: record.id, actions: record.actions };
    },
  },
  policies: {
    // Declared here; enforced per key at your edge (docs/deploying.md#rate-limiting).
    rateLimit: { requestsPerMinute: 120, burst: 40 },
    termsUrl: "https://wholesale.kestrel.example/terms/agent-access",
  },
  contact: { email: "partners@kestrel.example" },
  secret: process.env.AXE_SECRET,
});
// #endregion create

// #region actions
axe.register(
  action("stock.check", {
    title: "Check stock",
    description:
      "Returns on-hand quantity, the next inbound date, and the partner's unit price for one catalog item. Does not reserve or order anything.",
    readOnly: true,
    risk: "none",
    auth: "site",
    input: z.object({ itemCode: z.string().describe("Catalog item code, for example KW-10442") }),
    output: z.object({
      itemCode: z.string(),
      onHand: z.number().int(),
      nextInbound: z.string().date().nullable(),
      unitPriceUsd: z.number(),
    }),
    examples: [
      {
        input: { itemCode: "KW-10442" },
        output: {
          itemCode: "KW-10442",
          onHand: 1200,
          nextInbound: "2026-10-14",
          unitPriceUsd: 4.35,
        },
      },
    ],
    handler: async ({ input }) => warehouse.stock(input.itemCode),
  }),
);

axe.register(
  action("purchase-orders.place", {
    title: "Place a purchase order",
    description:
      "Places a purchase order on the partner's account for one or more catalog items. Returns the order number and the expected ship date. Orders can be cancelled on the portal until they ship.",
    risk: "high",
    reversible: true,
    auth: "site",
    input: z.object({
      lines: z
        .array(z.object({ itemCode: z.string(), quantity: z.number().int().positive() }))
        .min(1)
        .describe("Items and quantities"),
      poReference: z
        .string()
        .optional()
        .describe("The partner's own PO number, printed on the invoice"),
    }),
    output: z.object({ orderNumber: z.string(), expectedShipDate: z.string().date() }),
    examples: [
      {
        input: { lines: [{ itemCode: "KW-10442", quantity: 200 }], poReference: "NR-2026-0917" },
        output: { orderNumber: "PO-88214", expectedShipDate: "2026-10-02" },
      },
    ],
    handler: async ({ input, request }) =>
      warehouse.placeOrder(partnerFromRequest(request).id, input.lines, input.poReference),
  }),
);
// #endregion actions
