// Hono on Node. The same routes work unchanged on Workers, Bun, and Deno.
// #region all
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { axeFetch } from "@summationai/axe-fetch";
import { axe } from "./axe";
import { customerFrom, type SessionLookup } from "./session";

// On Cloudflare, `c.env` holds your bindings; on Node it is empty and the lookup
// falls back to the local default.
type Bindings = { SESSIONS?: SessionLookup };

const app = new Hono<{ Bindings: Bindings }>();

const handler = axeFetch<Bindings>(axe, {
  context: async (request, env) => ({ identity: await customerFrom(request, env?.SESSIONS) }),
});

app.all("/axe/*", (c) => handler(c.req.raw, c.env));
app.get("/.well-known/axe.json", (c) => handler(c.req.raw, c.env));
app.get("/", (c) => c.text("Fieldstone Outfitters"));

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) });
// #endregion all
