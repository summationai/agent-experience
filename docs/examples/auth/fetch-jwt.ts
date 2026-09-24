/**
 * Sunrise Yoga Studio: `user` mode pass-through of a bearer access token, verified in
 * `authenticate` so the same code runs under every adapter.
 */
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createAXE, action, z } from "@axe/core";
import { axeFetch } from "@axe/fetch";

// #region verify
// Stand-in for token verification. In production this is your JWT library (for example
// jose's jwtVerify with your issuer, audience, and signing keys) or an introspection call
// to your authorization server. It returns the claims when the token is valid and unexpired.
const issuedTokens = new Map<string, { sub: string; email: string; exp: number }>([
  ["at_2f8c1e", { sub: "member_1088", email: "dana@example.com", exp: 1_790_000_000 }],
]);

async function verifyAccessToken(token: string) {
  const claims = issuedTokens.get(token);
  if (!claims || claims.exp * 1000 < Date.now()) return null;
  return claims;
}
// #endregion verify

// Stand-in for your booking service.
const bookings = {
  async create(memberId: string, classId: string) {
    return { bookingId: `b_${memberId.slice(-4)}_${classId}`, classId, cancelBy: "2026-10-01T01:00:00Z" };
  },
};

// #region create
const axe = createAXE({
  name: "Sunrise Yoga Studio",
  description:
    "Search upcoming yoga classes by date and style, see instructor names and spots left, and (once signed in) book or cancel a spot.",
  baseUrl: "https://sunriseyoga.example",
  humanFallbackUrl: "https://sunriseyoga.example",
  auth: {
    modes: ["none", "user"],
    userLoginUrl: "https://sunriseyoga.example/login",
    // Runs whenever an identity is needed: on the action call and again on continue,
    // resume, and poll. Return null for anonymous or invalid credentials.
    authenticate: async (request) => {
      const header = request.headers.get("authorization");
      const token = /^Bearer\s+(.+)$/i.exec(header ?? "")?.[1];
      if (!token) return null;
      const claims = await verifyAccessToken(token);
      if (!claims) return null;
      return { onBehalfOf: claims.sub, claims: { email: claims.email } };
    },
  },
  secret: process.env.AXE_SECRET,
});
// #endregion create

// #region action
axe.register(
  action("classes.book", {
    title: "Book a class",
    description:
      "Reserves one spot in a class for the signed-in member. Returns the booking id and the cancellation deadline. Cancellation is free until two hours before the class starts.",
    risk: "medium",
    reversible: true,
    auth: "user",
    input: z.object({ classId: z.string().describe("Class id from classes.search") }),
    output: z.object({ bookingId: z.string(), classId: z.string(), cancelBy: z.string().datetime() }),
    examples: [
      { input: { classId: "c_102" }, output: { bookingId: "b_1088_c_102", classId: "c_102", cancelBy: "2026-10-01T01:00:00Z" } },
    ],
    handler: async ({ input, context }) => bookings.create(context.onBehalfOf!, input.classId),
  }),
);
// #endregion action

// #region mount
const app = new Hono();
// No `context` option: identity comes from `authenticate` above.
const handler = axeFetch(axe);

app.all("/axe/*", (c) => handler(c.req.raw));
app.get("/.well-known/axe.json", (c) => handler(c.req.raw));

serve({ fetch: app.fetch, port: 3000 });
// #endregion mount
