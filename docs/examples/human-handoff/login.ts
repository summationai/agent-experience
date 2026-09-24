/**
 * Larkspur Goods (an online shop): the SDK's built-in `login_required` handoff, and the login
 * route that records who signed in so the resumed action runs as that user.
 */
import express from "express";
import type { Response } from "express";
import { createAXE, action, z } from "@axe/core";
import { axeExpress } from "@axe/express";

// #region config
export const axe = createAXE({
  name: "Larkspur Goods",
  description: "Track orders and start returns for purchases from the Larkspur Goods online shop.",
  baseUrl: "https://shop.larkspur.example",
  humanFallbackUrl: "https://shop.larkspur.example",
  auth: {
    modes: ["none", "user"],
    // Where the SDK sends the human when a `user` action is called without an identity.
    userLoginUrl: "https://shop.larkspur.example/login",
  },
  secret: process.env.AXE_SECRET,
});

axe.register(
  action("orders.track", {
    title: "Track an order",
    description:
      "Returns the status, carrier, and expected delivery date of one of the signed-in customer's orders. Does not change anything.",
    readOnly: true,
    risk: "none",
    auth: "user",
    input: z
      .object({ orderNumber: z.string().describe("Order number from the confirmation email") })
      .strict(),
    output: z.object({
      status: z.string(),
      carrier: z.string().nullable(),
      expectedBy: z.string().nullable(),
    }),
    handler: async ({ input, context }) => orders.track(context.onBehalfOf!, input.orderNumber),
  }),
);
// #endregion config

// #region login
const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(axeExpress(axe));

// GET /login?axe_handoff=<id>: the form carries the id through to the POST.
app.get("/login", (req, res) => {
  const handoffId = typeof req.query.axe_handoff === "string" ? req.query.axe_handoff : "";
  res.send(loginForm(handoffId));
});

app.post("/login", async (req, res) => {
  const { email, password, handoffId } = req.body as {
    email: string;
    password: string;
    handoffId?: string;
  };
  const user = await accounts.signIn(email, password);
  if (!user) {
    res.status(401).send(loginForm(handoffId ?? "", "Wrong email or password."));
    return;
  }
  startSession(res, user.id);
  if (handoffId) {
    // Binds the pending resume to this user. The agent's next /axe/resume runs orders.track as user.id.
    const recorded = await axe.completeHandoff(handoffId, { onBehalfOf: user.id });
    res.send(
      recorded
        ? "Signed in. You can return to your assistant; it will continue where it left off."
        : "Signed in. The assistant's link had expired, so ask it to try again.",
    );
    return;
  }
  res.redirect("/account");
});
// #endregion login

function loginForm(handoffId: string, error = "") {
  return `<!doctype html><title>Sign in to Larkspur Goods</title>
${error ? `<p>${escapeHtml(error)}</p>` : ""}
<form method="post" action="/login">
  <input type="hidden" name="handoffId" value="${escapeHtml(handoffId)}">
  <label>Email <input name="email" type="email" required></label>
  <label>Password <input name="password" type="password" required></label>
  <button>Sign in</button>
</form>`;
}

function startSession(res: Response, userId: string) {
  res.cookie("session", `sess_${userId}`, { httpOnly: true, secure: true, sameSite: "lax" });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// Stand-ins for your accounts and orders systems.
const accounts = {
  async signIn(email: string, _password: string) {
    return email ? { id: `cust_${email.split("@")[0] ?? "unknown"}` } : null;
  },
};
const orders = {
  async track(_customerId: string, _orderNumber: string) {
    return { status: "shipped", carrier: "UPS", expectedBy: "2026-09-26" };
  },
};

app.listen(3000);
