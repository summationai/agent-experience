// #region all
import { createAXE } from "@summationai/axe-core";

export const axe = createAXE({
  name: "Oakridge Rentals",
  description:
    "Search available apartments, schedule tours, and submit rental applications with a holding deposit.",
  // #region baseurl
  // HTTPS is required except for localhost. A path prefix is honored: every AXE path is served under it.
  baseUrl: process.env.AXE_BASE_URL ?? "https://www.oakridge-rentals.example/agents",
  // #endregion baseurl
  humanFallbackUrl: "https://www.oakridge-rentals.example",
  auth: { modes: ["none", "user"], userLoginUrl: "https://www.oakridge-rentals.example/login" },
  secret: process.env.AXE_SECRET,
  // #region policies
  policies: {
    rateLimit: { requestsPerMinute: 120, burst: 30 },
    termsUrl: "https://www.oakridge-rentals.example/agent-terms",
    dataRetention: "Application data is kept for 12 months after the last activity.",
    // Deny wins. An absent allow list permits every vendor that is not denied.
    agents: { deny: ["scraper-co"] },
  },
  // #endregion policies
  // #region cors
  // Off unless set. Only browser-based agents need it.
  cors: { origins: ["https://agent.example"], allowCredentials: true },
  // #endregion cors
  // #region cache
  // Cache-Control: public, max-age=<seconds> on the manifest and on action definitions. Default 300.
  manifestCacheSeconds: 600,
  updatedAt: process.env.AXE_MANIFEST_UPDATED_AT ?? "2026-09-23T00:00:00Z",
  // #endregion cache
});
// #endregion all
