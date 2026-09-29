// server.ts — run with `bun run server.ts`.
// #region all
import { axeFetch, isAxePath } from "@summationai/axe-fetch";
import { axe } from "./axe";
import { customerFrom } from "./session";

// bun-types is not installed in this repository; this declares the part of
// Bun.serve we call. In your app, `bun add -d @types/bun` provides the real one.
declare const Bun: {
  serve(options: { port?: number; fetch(request: Request): Response | Promise<Response> }): unknown;
};

const handler = axeFetch(axe, {
  context: async (request) => ({ identity: await customerFrom(request) }),
});

Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  fetch(request) {
    if (isAxePath(new URL(request.url).pathname)) return handler(request);
    return new Response("Fieldstone Outfitters");
  },
});
// #endregion all
