// #region all
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { axeFetch } from "@summationai/axe-fetch";
import { axe } from "./axe";

const app = new Hono();
const handler = axeFetch(axe);

app.all("/axe/*", (c) => handler(c.req.raw));
app.get("/.well-known/axe.json", (c) => handler(c.req.raw));
app.get("/", (c) => c.text("Sunrise Yoga Studio"));

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) });
// #endregion all
