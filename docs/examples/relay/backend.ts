// The application's backend mints the relay token, in a request its own session authenticated.
import express from "express";
import { mintRelayToken } from "@axe/relay/token";

declare function currentUser(
  req: express.Request,
): { id: string; studioId: string; memberId: string } | null;

const app: express.Express = express();

// #region mint
// A signing key used for nothing else, shared with the relay (RELAY_TOKEN_SECRET, at least 32
// characters). The token names the person (sub) and the tenant (org), lives ten minutes, and goes
// to your own page in a response body, never in a URL.
app.post("/api/relay-token", async (req, res) => {
  const user = currentUser(req);
  if (!user) return void res.status(401).json({ error: "sign in" });
  const token = await mintRelayToken(
    { principal: user.id, tenant: user.studioId, ttl: 600, claims: { mid: user.memberId } },
    process.env["RELAY_TOKEN_SECRET"]!,
  );
  res.set("Cache-Control", "no-store").json({ token });
});
// #endregion mint

export { app };
