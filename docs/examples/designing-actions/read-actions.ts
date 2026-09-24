/**
 * An online shop: the order-history read action, first as a search box, then with
 * the filters the agent already holds.
 */
import { createAXE, action, z } from "@axe/core";

export const axe = createAXE({
  name: "Harbor Goods",
  description: "Track orders, see delivery estimates, and start a return for the signed-in customer.",
  baseUrl: "https://shop.harborgoods.example",
  auth: { modes: ["none", "user"], userLoginUrl: "https://shop.harborgoods.example/login" },
  secret: process.env.AXE_SECRET,
});

const OrderSchema = z.object({
  id: z.string(),
  placedAt: z.string().datetime(),
  status: z.enum(["processing", "shipped", "delivered", "returned"]),
  totalUsd: z.number(),
  itemCount: z.number().int(),
  estimatedDelivery: z.string().date().nullable(),
  url: z.string(),
});

// Stand-in for your existing order service.
const orders = {
  async list(_customerId: string, _filters: { status?: string | undefined; placedAfter?: string | undefined; placedBefore?: string | undefined; cursor?: string | undefined }) {
    return { orders: [] as z.infer<typeof OrderSchema>[], nextCursor: null as string | null };
  },
};

// #region bare-search
// Reported by axe audit. The agent has already understood "my orders from August that
// haven't arrived"; a free-text box makes it throw that structure away.
const bareQuery = z.object({ query: z.string().describe("Free-text search over your orders") });
// #endregion bare-search
void bareQuery;

// #region structured
axe.register(
  action("orders.list", {
    title: "List orders",
    description:
      "Lists the signed-in customer's orders, newest first, filtered by status and date range. Returns up to 25 orders per page with status, total, and estimated delivery. Does not change anything.",
    readOnly: true,
    risk: "none",
    auth: "user",
    input: z
      .object({
        status: z.enum(["processing", "shipped", "delivered", "returned"]).optional().describe("Only orders in this state"),
        placedAfter: z.string().date().optional().describe("Earliest order date, YYYY-MM-DD, e.g. '2026-08-01'"),
        placedBefore: z.string().date().optional().describe("Latest order date, YYYY-MM-DD"),
        cursor: z.string().optional().describe("Opaque cursor from a previous page"),
      })
      .strict(),
    output: z.object({ orders: z.array(OrderSchema), nextCursor: z.string().nullable() }),
    display: {
      kind: "list",
      items: "/orders",
      item: {
        id: "/id",
        title: "/id",
        url: "/url",
        price: { amount: "/totalUsd", currency: "USD", period: "once" },
        attributes: [
          { label: "Placed", path: "/placedAt", format: "datetime" },
          { label: "Status", path: "/status", format: "text" },
          { label: "Items", path: "/itemCount", format: "number" },
          { label: "Estimated delivery", path: "/estimatedDelivery", format: "date", compare: "lower-better" },
        ],
      },
      suggestedComparison: ["Status", "Estimated delivery"],
      emptyMessage: "No orders match those filters.",
      disclaimer: "Delivery estimates come from the carrier and can change. The order page has the latest.",
    },
    affordances: [{ action: "returns.start", title: "Start a return", input: { orderId: "/id" } }],
    pagination: { cursorIn: "/cursor", cursorOut: "/nextCursor", pageSize: { default: 10, max: 25 } },
    freshness: { cacheTtlSeconds: 60 },
    examples: [
      {
        input: { status: "shipped" },
        output: {
          orders: [{ id: "HG-20931", placedAt: "2026-09-18T16:04:00Z", status: "shipped", totalUsd: 84.5, itemCount: 2, estimatedDelivery: "2026-09-25", url: "https://shop.harborgoods.example/orders/HG-20931" }],
          nextCursor: null,
        },
      },
    ],
    handler: async ({ input, context }) => orders.list(context.onBehalfOf!, input),
  }),
);
// #endregion structured

axe.register(
  action("returns.start", {
    title: "Start a return",
    description:
      "Opens a return for a delivered order and emails a prepaid shipping label to the customer. Returns the return id and the refund amount once the item is received. Can be cancelled until the item ships back.",
    risk: "medium",
    idempotent: true,
    reversible: true,
    auth: "user",
    input: z.object({ orderId: z.string().describe("Order id from orders.list, e.g. 'HG-20931'") }).strict(),
    output: z.object({ returnId: z.string(), refundUsd: z.number() }),
    examples: [{ input: { orderId: "HG-20931" }, output: { returnId: "R-1180", refundUsd: 84.5 } }],
    handler: async ({ input }) => ({ returnId: `R-${input.orderId.slice(3)}`, refundUsd: 84.5 }),
  }),
);
