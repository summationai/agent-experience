// src/index.ts — a Cloudflare Worker.
// #region all
import { axeFetch, isAxePath } from "@summationai/axe-fetch";
import { axe } from "./axe";
import { customerFrom, type SessionLookup } from "./session";

// @cloudflare/workers-types is not installed in this repository, so `Env` lists
// only the binding we read. In your app, generate it with `wrangler types`.
// A KV namespace satisfies SessionLookup: its get(key) returns Promise<string | null>.
interface Env {
  SESSIONS: SessionLookup;
}

const handler = axeFetch<Env>(axe, {
  context: async (request, env) => ({ identity: await customerFrom(request, env?.SESSIONS) }),
});

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (isAxePath(url.pathname)) return handler(request, env);
    return new Response("Fieldstone Outfitters");
  },
};
// #endregion all
