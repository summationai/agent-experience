/**
 * Fieldstone Outfitters: a shop whose own pages and a partner's embedded widget call AXE
 * with the shop's session cookie, while agents call it server to server with bearer tokens.
 */
import express from "express";
import { createAXE, action, z } from "@summationai/axe-core";
import { axeExpress } from "@summationai/axe-express";

// Stand-in for your session store.
const sessions = new Map<string, string>([["s_4c9e", "cust_8812"]]);
const tokens = new Map<string, string>([["at_71d0", "cust_8812"]]);

// #region config
const axe = createAXE({
  name: "Fieldstone Outfitters",
  description:
    "Track orders and start returns for purchases from Fieldstone Outfitters, an online outdoor-clothing shop. Requires the customer to be signed in.",
  // The site's own origin for the origin rule comes from here, never from Host or
  // X-Forwarded-Host.
  baseUrl: "https://shop.fieldstone.example",
  auth: {
    modes: ["none", "user"],
    userLoginUrl: "https://shop.fieldstone.example/login",
    // A browser on the shop's pages sends the session cookie; an agent sends a bearer token.
    authenticate: (request) => {
      const bearer = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
      if (bearer) return tokens.has(bearer) ? { onBehalfOf: tokens.get(bearer)! } : null;
      const sid = /(?:^|;\s*)fo_session=([^;]+)/.exec(request.headers.get("cookie") ?? "")?.[1];
      return sid && sessions.has(sid) ? { onBehalfOf: sessions.get(sid)! } : null;
    },
  },
  // The defaults already require JSON on writes and check Origin on any POST that carries a
  // Cookie. What a cookie site adds is the list of other origins whose pages may call it with
  // the shop's cookie: here, the help-center widget on a sibling domain.
  requestPolicy: {
    trustedOrigins: ["https://help.fieldstone.example"],
  },
  // Credentialed CORS lets the widget read responses. An origin listed here with
  // allowCredentials is trusted by the request policy as well.
  cors: { origins: ["https://help.fieldstone.example"], allowCredentials: true },
  secret: process.env.AXE_SECRET,
});
// #endregion config

axe.register(
  action("returns.start", {
    title: "Start a return",
    description:
      "Opens a return for one item of a delivered order within 30 days of delivery and returns a prepaid label URL. Cancel the return from the order page before shipping.",
    risk: "medium",
    reversible: true,
    auth: "user",
    input: z.object({ orderId: z.string(), lineId: z.string() }),
    output: z.object({ returnId: z.string(), labelUrl: z.string() }),
    handler: async ({ input }) => ({
      returnId: `R-${input.orderId}-${input.lineId}`,
      labelUrl: `https://shop.fieldstone.example/returns/R-${input.orderId}/label`,
    }),
  }),
);

// #region cookie
// The session cookie itself: SameSite=Lax keeps browsers from attaching it to cross-site
// POSTs at all, which is a second layer under the request policy, not a replacement for it
// (a sibling subdomain is same-site, and older browsers ignore the attribute).
function setSessionCookie(res: express.Response, sid: string) {
  res.cookie("fo_session", sid, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
}
// #endregion cookie

const app = express();
// Body parsers may run before the adapter: it keeps the Content-Type the browser sent, so a
// text/plain or form body that express.text() or express.urlencoded() parsed is still refused.
app.use(express.json());
app.use(axeExpress(axe));
app.post("/login", (_req, res) => {
  setSessionCookie(res, "s_4c9e");
  res.redirect("/account");
});
app.listen(3000);
