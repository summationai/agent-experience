// axe.ts — an online shop: track an order, start a return.
// #region all
import { createAXE, action, z } from "@summationai/axe-core";

export const axe = createAXE({
  name: "Fieldstone Outfitters",
  description:
    "Track orders and start returns for purchases from Fieldstone Outfitters, an online outdoor-clothing shop. Requires the customer to be signed in.",
  baseUrl: process.env.AXE_BASE_URL ?? "https://shop.fieldstone.example",
  auth: { modes: ["none", "user"], userLoginUrl: "https://shop.fieldstone.example/login" },
  secret: process.env.AXE_SECRET,
});

axe.register(
  action("orders.track", {
    title: "Track an order",
    description:
      "Returns the status, carrier, and tracking number of one of the signed-in customer's orders. Does not change anything.",
    readOnly: true,
    risk: "none",
    auth: "user",
    input: z.object({
      orderId: z.string().describe("Order number from the confirmation email, e.g. FO-118204"),
    }),
    output: z.object({
      orderId: z.string(),
      status: z.enum(["processing", "shipped", "delivered"]),
      carrier: z.string().nullable(),
      trackingNumber: z.string().nullable(),
    }),
    examples: [
      {
        input: { orderId: "FO-118204" },
        output: {
          orderId: "FO-118204",
          status: "shipped",
          carrier: "UPS",
          trackingNumber: "1Z999AA10123456784",
        },
      },
    ],
    handler: async ({ input, context }) => orders.track(context.onBehalfOf!, input.orderId),
  }),
);

axe.register(
  action("returns.start", {
    title: "Start a return",
    description:
      "Opens a return for one item of a delivered order within 30 days of delivery and returns a prepaid label URL. Refunds are issued when the carrier scans the package. Cancel the return from the order page before shipping.",
    risk: "medium",
    idempotent: true,
    reversible: true,
    auth: "user",
    input: z.object({
      orderId: z.string(),
      lineId: z.string().describe("Line item id from the order"),
      reason: z.enum(["wrong-size", "damaged", "not-as-described", "changed-mind"]),
    }),
    output: z.object({ returnId: z.string(), labelUrl: z.string() }),
    examples: [
      {
        input: { orderId: "FO-118204", lineId: "L1", reason: "wrong-size" },
        output: {
          returnId: "R-55021",
          labelUrl: "https://shop.fieldstone.example/returns/R-55021/label",
        },
      },
    ],
    handler: async ({ input, context }) =>
      returns.start(context.onBehalfOf!, input.orderId, input.lineId, input.reason),
  }),
);
// #endregion all

// Stand-ins for your order system.
const orders = {
  async track(_customerId: string, orderId: string) {
    return {
      orderId,
      status: "shipped" as const,
      carrier: "UPS",
      trackingNumber: "1Z999AA10123456784",
    };
  },
};

const returns = {
  async start(_customerId: string, _orderId: string, _lineId: string, _reason: string) {
    return {
      returnId: "R-55021",
      labelUrl: "https://shop.fieldstone.example/returns/R-55021/label",
    };
  },
};
