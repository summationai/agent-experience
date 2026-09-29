// main.ts — run with `deno run --allow-net --allow-env main.ts`.
// #region all
import { axeFetch, isAxePath } from "@summationai/axe-fetch";
import { axe } from "./axe";
import { customerFrom } from "./session";

// Deno's globals are not installed in this repository; this declares the part of
// Deno.serve we call. In your app the Deno runtime types provide the real one.
declare const Deno: {
  serve(handler: (request: Request) => Response | Promise<Response>): unknown;
};

const handler = axeFetch(axe, {
  context: async (request) => ({ identity: await customerFrom(request) }),
});

Deno.serve((request) => {
  if (isAxePath(new URL(request.url).pathname)) return handler(request);
  return new Response("Fieldstone Outfitters");
});
// #endregion all
