// #region all
import { createAXE, action, z } from "@axe/core";

// #region flags
// Stand-in for your feature-flag client (LaunchDarkly, Unleash, a database table).
const flags = {
  isEnabled(name: string): boolean {
    return (process.env.AXE_FLAGS ?? "").split(",").includes(name);
  },
};
// #endregion flags

export const axe = createAXE({
  name: "Bramble Goods",
  description:
    "Track the status of an order by order number and email, and start a return for delivered items.",
  baseUrl: "https://bramblegoods.example",
  humanFallbackUrl: "https://bramblegoods.example/help",
  auth: { modes: ["none"] },
  secret: process.env.AXE_SECRET,
});

const OrderStatus = z.object({
  orderNumber: z.string(),
  status: z.enum(["processing", "shipped", "delivered", "returned"]),
  estimatedDelivery: z.string().date().nullable(),
  url: z.string(),
});

// #region gate
const trackOrder = action("orders.track", {
  title: "Track an order",
  description:
    "Returns the shipping status and estimated delivery date for one order, given the order number and the email used at purchase. Does not change anything.",
  readOnly: true,
  risk: "none",
  input: z.object({
    orderNumber: z.string().describe("Order number from the confirmation email, e.g. BG-48213"),
    email: z.string().email().describe("Email address used at purchase"),
  }),
  output: OrderStatus,
  display: {
    kind: "status",
    item: {
      id: "/orderNumber",
      title: "/orderNumber",
      url: "/url",
      attributes: [
        { label: "Status", path: "/status", format: "text" },
        { label: "Estimated delivery", path: "/estimatedDelivery", format: "date" },
      ],
    },
  },
  examples: [
    {
      input: { orderNumber: "BG-48213", email: "sam@example.com" },
      output: {
        orderNumber: "BG-48213",
        status: "shipped",
        estimatedDelivery: "2026-10-02",
        url: "https://bramblegoods.example/orders/BG-48213",
      },
    },
  ],
  handler: async ({ input }) => orders.status(input.orderNumber, input.email),
});

const startReturn = action("returns.start", {
  title: "Start a return",
  description:
    "Opens a return for a delivered order and returns a prepaid shipping label URL. The return can be cancelled from the order page until the package is scanned.",
  risk: "low",
  reversible: true,
  input: z.object({
    orderNumber: z.string().describe("Order number of a delivered order"),
    email: z.string().email().describe("Email address used at purchase"),
    reason: z.enum(["wrong-size", "damaged", "not-as-described", "other"]),
  }),
  output: z.object({ returnId: z.string(), labelUrl: z.string() }),
  handler: async ({ input }) => orders.startReturn(input.orderNumber, input.email, input.reason),
});

// Always on: a read-only action is the safest first step.
axe.register(trackOrder);
// Behind a flag: flip it for one environment, run the conformance suite, then flip it everywhere.
if (flags.isEnabled("axe.returns.start")) axe.register(startReturn);
// #endregion gate

// #region deprecate
// Keep the old name serving. Agents that read the manifest will move to orders.track on their own.
const lookupOrder = action("orders.lookup", {
  ...trackOrder.spec,
  title: "Look up an order (deprecated)",
  deprecated: { since: "2026-09-01", replacedBy: "orders.track" },
});
axe.register(lookupOrder);
// #endregion deprecate

const orders = {
  async status(orderNumber: string, _email: string) {
    return {
      orderNumber,
      status: "shipped" as const,
      estimatedDelivery: "2026-10-02",
      url: `https://bramblegoods.example/orders/${orderNumber}`,
    };
  },
  async startReturn(orderNumber: string, _email: string, _reason: string) {
    return { returnId: `R-${orderNumber}`, labelUrl: `https://bramblegoods.example/returns/R-${orderNumber}/label` };
  },
};
// #endregion all
