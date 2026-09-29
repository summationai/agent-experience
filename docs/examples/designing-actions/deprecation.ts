/**
 * An online shop: retiring an action without breaking the agents that call it.
 */
import { createAXE, action, z } from "@summationai/axe-core";

export const axe = createAXE({
  name: "Harbor Goods",
  description:
    "Track orders, see delivery estimates, and start a return for the signed-in customer.",
  baseUrl: "https://shop.harborgoods.example",
  auth: { modes: ["none", "user"], userLoginUrl: "https://shop.harborgoods.example/login" },
  secret: process.env.AXE_SECRET,
});

// Stand-in for your existing order service.
const orders = {
  async status(_customerId: string, orderId: string) {
    return {
      orderId,
      status: "shipped" as const,
      carrier: "UPS",
      trackingNumber: "1Z999AA10123456784",
      estimatedDelivery: "2026-09-25",
      url: `https://shop.harborgoods.example/orders/${orderId}`,
    };
  },
};

// #region deprecated
// The old action keeps working unchanged. Agents that read the manifest prefer the replacement.
axe.register(
  action("orders.track", {
    title: "Track an order",
    description:
      "Returns the shipping status and tracking number for one of the signed-in customer's orders. Superseded by orders.status, which adds the carrier and a delivery estimate.",
    readOnly: true,
    risk: "none",
    auth: "user",
    deprecated: { since: "2026-09-01", replacedBy: "orders.status" },
    input: z.object({ orderId: z.string().describe("Order id, e.g. 'HG-20931'") }).strict(),
    output: z.object({ status: z.string(), trackingNumber: z.string().nullable() }),
    examples: [
      {
        input: { orderId: "HG-20931" },
        output: { status: "shipped", trackingNumber: "1Z999AA10123456784" },
      },
    ],
    handler: async ({ input, context }) => {
      const o = await orders.status(context.onBehalfOf!, input.orderId);
      return { status: o.status, trackingNumber: o.trackingNumber };
    },
  }),
);

axe.register(
  action("orders.status", {
    title: "Order status",
    description:
      "Returns the current status of one of the signed-in customer's orders: processing, shipped, delivered, or returned, with carrier, tracking number, and estimated delivery date. Does not change anything.",
    readOnly: true,
    risk: "none",
    auth: "user",
    input: z
      .object({ orderId: z.string().describe("Order id from orders.list, e.g. 'HG-20931'") })
      .strict(),
    output: z.object({
      orderId: z.string(),
      status: z.enum(["processing", "shipped", "delivered", "returned"]),
      carrier: z.string().nullable(),
      trackingNumber: z.string().nullable(),
      estimatedDelivery: z.string().date().nullable(),
      url: z.string().describe("The order page for humans"),
    }),
    display: {
      kind: "status",
      item: {
        id: "/orderId",
        title: "/orderId",
        subtitle: "/status",
        url: "/url",
        attributes: [
          { label: "Carrier", path: "/carrier", format: "text" },
          { label: "Tracking number", path: "/trackingNumber", format: "text" },
          { label: "Estimated delivery", path: "/estimatedDelivery", format: "date" },
        ],
      },
      disclaimer: "Delivery estimates come from the carrier and can change.",
    },
    examples: [
      {
        input: { orderId: "HG-20931" },
        output: {
          orderId: "HG-20931",
          status: "shipped",
          carrier: "UPS",
          trackingNumber: "1Z999AA10123456784",
          estimatedDelivery: "2026-09-25",
          url: "https://shop.harborgoods.example/orders/HG-20931",
        },
      },
    ],
    handler: async ({ input, context }) => orders.status(context.onBehalfOf!, input.orderId),
  }),
);
// #endregion deprecated
