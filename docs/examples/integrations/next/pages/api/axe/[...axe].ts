// pages/api/axe/[...axe].ts — with rewrites for /.well-known/axe.json and /axe/:path* in next.config.js.
// #region all
import { axeNextPages } from "@axe/next";
import { axe } from "../../../axe";
import { applicantFromCookieHeader } from "../../../lib/session";

export default axeNextPages(axe, {
  // The adapter assumes https unless X-Forwarded-Proto says otherwise. Set the
  // origin explicitly so local development and proxied deployments both work.
  origin: process.env.AXE_BASE_URL ?? "http://localhost:3000",
  context: async (req) => ({ identity: await applicantFromCookieHeader(req.headers.cookie) }),
});
// #endregion all
