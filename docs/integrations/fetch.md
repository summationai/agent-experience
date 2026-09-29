# Hono, Remix, Cloudflare Workers, Bun, Deno, SvelteKit

`axeFetch` mounts an AXE server anywhere a Web-standard `(Request) => Response` function runs. There is nothing to convert: it takes the `Request` your framework already holds, resolves your `context`, and calls the handler from `@summationai/axe-core`. A second export, isAxePath, tells a router which paths to delegate. Everything on this page is the same server; only the few lines that hand it a request change per framework.

The example is Fieldstone Outfitters, an online shop with two actions: `orders.track` (read-only) and `returns.start` (mutating). Both need a signed-in customer.

## Install

```sh
npm install @summationai/axe-core @summationai/axe-fetch
```

## The declaration

<!-- include: examples/integrations/fetch/axe.ts#all -->
```ts
import { createAXE, action, z } from "@summationai/axe-core";

export const axe = createAXE({
  name: "Fieldstone Outfitters",
  description:
    "Track orders and start returns for purchases from Fieldstone Outfitters, an online outdoor-clothing shop. Requires the customer to be signed in.",
  baseUrl: process.env.AXE_BASE_URL ?? "https://shop.fieldstone.example",
  auth: { modes: ["none", "user"], userLoginUrl: "https://shop.fieldstone.example/login" },
  secret: process.env.AXE_SECRET,
});

axe.register(
  action("orders.track", {
    title: "Track an order",
    description:
      "Returns the status, carrier, and tracking number of one of the signed-in customer's orders. Does not change anything.",
    readOnly: true,
    risk: "none",
    auth: "user",
    input: z.object({
      orderId: z.string().describe("Order number from the confirmation email, e.g. FO-118204"),
    }),
    output: z.object({
      orderId: z.string(),
      status: z.enum(["processing", "shipped", "delivered"]),
      carrier: z.string().nullable(),
      trackingNumber: z.string().nullable(),
    }),
    examples: [
      {
        input: { orderId: "FO-118204" },
        output: {
          orderId: "FO-118204",
          status: "shipped",
          carrier: "UPS",
          trackingNumber: "1Z999AA10123456784",
        },
      },
    ],
    handler: async ({ input, context }) => orders.track(context.onBehalfOf!, input.orderId),
  }),
);

axe.register(
  action("returns.start", {
    title: "Start a return",
    description:
      "Opens a return for one item of a delivered order within 30 days of delivery and returns a prepaid label URL. Refunds are issued when the carrier scans the package. Cancel the return from the order page before shipping.",
    risk: "medium",
    idempotent: true,
    reversible: true,
    auth: "user",
    input: z.object({
      orderId: z.string(),
      lineId: z.string().describe("Line item id from the order"),
      reason: z.enum(["wrong-size", "damaged", "not-as-described", "changed-mind"]),
    }),
    output: z.object({ returnId: z.string(), labelUrl: z.string() }),
    examples: [
      {
        input: { orderId: "FO-118204", lineId: "L1", reason: "wrong-size" },
        output: {
          returnId: "R-55021",
          labelUrl: "https://shop.fieldstone.example/returns/R-55021/label",
        },
      },
    ],
    handler: async ({ input, context }) =>
      returns.start(context.onBehalfOf!, input.orderId, input.lineId, input.reason),
  }),
);
```
<!-- /include -->

## The session helper

Every mount below uses one function to turn a `Request` into an identity. A browser on the shop's own pages sends a session cookie; an agent acting for a customer sends a bearer token the customer granted it. Both resolve to a customer id. The lookup is a two-method interface so the same helper reads a local map in development and a KV namespace on Workers.

<!-- include: examples/integrations/fetch/session.ts#all -->
```ts
import type { Identity } from "@summationai/axe-core";

/** The two methods we use from a KV namespace, a Redis client, or a table. */
export interface SessionLookup {
  get(key: string): Promise<string | null>;
}

const LOCAL: SessionLookup = {
  async get(key) {
    return key === "s_demo" ? "cust_8812" : null;
  },
};

/**
 * A browser on your site sends the session cookie; an agent holding a token the
 * customer granted sends it as a bearer. Both resolve to the same identity.
 */
export async function customerFrom(
  request: Request,
  sessions: SessionLookup = LOCAL,
): Promise<Identity | null> {
  const bearer = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  const cookie = /(?:^|;\s*)fo_session=([^;]+)/.exec(request.headers.get("cookie") ?? "")?.[1];
  const sid = bearer ?? cookie;
  const customerId = sid ? await sessions.get(sid) : null;
  return customerId ? { onBehalfOf: customerId } : null;
}
```
<!-- /include -->

`null` declares the request anonymous, and a `user` action then returns `needs_human` with `reason: "login_required"`. Leaving `identity` out of the returned object instead defers to the `authenticate` function in `createAXE`. [Auth](../auth.md) has both paths in full.

## Hono

Two routes: a wildcard for everything under `/axe`, and the well-known path for the manifest. The second argument to the handler is whatever you want `context` to see; here it is `c.env`, so the same file runs on Node today and on Workers, where the bindings are real, tomorrow.

<!-- include: examples/integrations/fetch/hono.ts#all -->
```ts
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
```
<!-- /include -->

Run it with `npx tsx server.ts`, then `npx @summationai/axe inspect http://localhost:3000`.

## Remix

A resource route owns the whole AXE surface. The `$` in the filename is Remix's splat, so `app/routes/axe.$.ts` matches every path under `/axe`. Remix sends `GET` and `OPTIONS` to the loader and `POST` to the action; both call the same handler.

<!-- include: examples/integrations/fetch/remix.ts#all -->
```ts
import { axeFetch } from "@summationai/axe-fetch";
import { axe } from "./axe";
import { customerFrom } from "./session";

// Remix is not installed in this repository, so the argument shape is declared
// structurally. In your app, import LoaderFunctionArgs and ActionFunctionArgs
// from "@remix-run/node" (or "@remix-run/cloudflare") instead.
type RouteArgs = { request: Request };

const handler = axeFetch(axe, {
  context: async (request) => ({ identity: await customerFrom(request) }),
});

// GET and OPTIONS reach the loader; POST reaches the action.
export const loader = ({ request }: RouteArgs) => handler(request);
export const action = ({ request }: RouteArgs) => handler(request);
```
<!-- /include -->

The manifest at `/.well-known/axe.json` is a second resource route that re-exports the loader. In Remix's flat-route convention, brackets escape the dots:

<!-- include: examples/integrations/fetch/remix-well-known.ts#all -->
```ts
export { loader } from "./remix";
```
<!-- /include -->

Remix is not installed in this repository, so the example declares the argument type structurally. In your app, the loader and action argument types from your Remix runtime package replace it; nothing else changes.

## Cloudflare Workers

The Worker's `fetch` receives the request and the environment. Pass the environment through as the second argument and `context` can read a KV namespace, a D1 binding, or a secret from it.

<!-- include: examples/integrations/fetch/workers.ts#all -->
```ts
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
```
<!-- /include -->

Two Workers specifics. First, the environment interface here lists one binding; in your project, `wrangler types` generates the real one. Second, the declaration reads the signing secret from `process.env`. Workers with the Node compatibility flag and a 2025 or later compatibility date populate `process.env` from your vars and secrets, so that line works as written; on an older configuration, build the server on first request from the environment instead.

## Bun

`Bun.serve` takes a `fetch` function. Delegate AXE paths and serve everything else yourself:

<!-- include: examples/integrations/fetch/bun.ts#all -->
```ts
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
```
<!-- /include -->

The example declares the slice of `Bun.serve` it calls because Bun's types are not installed here; `bun add -d @types/bun` gives you the real ones.

## Deno

The same shape with `Deno.serve`:

<!-- include: examples/integrations/fetch/deno.ts#all -->
```ts
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
```
<!-- /include -->

Run it with the network and environment permissions the declaration needs. On Deno Deploy, read the note on isolates under [Gotchas](#gotchas).

## SvelteKit

Answer AXE paths in `hooks.server.ts` before SvelteKit's own router runs. `event.platform` carries the adapter's environment (bindings on adapter-cloudflare, nothing on adapter-node), so it is the natural second argument.

<!-- include: examples/integrations/fetch/sveltekit.ts#all -->
```ts
import { axeFetch, isAxePath } from "@summationai/axe-fetch";
import { axe } from "./axe";
import { customerFrom, type SessionLookup } from "./session";

// @sveltejs/kit is not installed in this repository, so `Handle` and `RequestEvent`
// are declared structurally with only the members we use. In your app, import
// `Handle` from "@sveltejs/kit" and declare `App.Platform` in app.d.ts.
type Platform = { env?: { SESSIONS?: SessionLookup } } | undefined;
type RequestEvent = { request: Request; url: URL; platform: Platform };
type Handle = (input: {
  event: RequestEvent;
  resolve: (event: RequestEvent) => Promise<Response>;
}) => Promise<Response>;

const handler = axeFetch<Platform>(axe, {
  // `platform` is set by adapter-cloudflare and friends; on adapter-node it is undefined.
  context: async (request, platform) => ({
    identity: await customerFrom(request, platform?.env?.SESSIONS),
  }),
});

export const handle: Handle = async ({ event, resolve }) => {
  if (isAxePath(event.url.pathname)) return handler(event.request, event.platform);
  return resolve(event);
};
```
<!-- /include -->

If you would rather keep AXE inside the routes tree, a `+server.ts` under `src/routes/axe/[...path]/` exporting `GET`, `POST`, and `OPTIONS` that each call the handler with `event.request` works the same way; you then need a second one under `src/routes/.well-known/axe.json/`. The hook is fewer files and catches both paths at once.

## Passing your session and environment in

The `context` callback is `(request, env) => ({ identity, tenant })`. The first argument is always the Web `Request`. The second is whatever you passed as the handler's second argument: `c.env` on Hono, the Worker environment, `event.platform` on SvelteKit, nothing on Bun or Deno. The generic type parameter on `axeFetch` types it, so `context` sees your bindings without a cast.

Handlers then see the user as `context.onBehalfOf`. The `onBehalfOf` an agent writes into the request body is never trusted; only what `context` or `authenticate` returns counts.

`tenant` is for platforms that serve many shops from one Worker or one Hono app. Resolve it from the request's host in the same callback; [Platforms](../platforms.md) covers the rest.

Because the session helper accepts the `fo_session` cookie, a page on another origin could otherwise make the customer's browser start a return. The core refuses that before it reads the body or runs a handler: a `POST` carrying a cookie must come from the origin of `baseUrl` (or the tenant's) or an origin in `requestPolicy.trustedOrigins`, and writes must be `application/json` (spec [P-TRANS-1] and [P-TRANS-2]). `axeFetch` passes the framework's `Request` through untouched, so the core sees the `Origin`, `Sec-Fetch-Site`, `Cookie`, and `Content-Type` the browser sent. An agent sending a bearer token and no `Origin` is unaffected. [Auth](../auth.md#cookie-sessions) has the matrix.

## Gotchas

- **Isolates do not share memory.** On Workers, Deno Deploy, and other edge runtimes, the default in-memory token and idempotency stores are per isolate: a continuation token minted on one may be unknown to the next, and an idempotent replay may run twice. Configure `tokenStore` and `idempotencyStore` with KV, Redis, or a database, and set `secret` explicitly so every isolate signs with the same key. [Deploying](../deploying.md) shows the two interfaces.
- **Delegate before you consume the body.** A `Request` body is a stream that can be read once. If a global middleware calls `request.json()` for logging or CSRF checks, AXE receives an empty body and returns `invalid_input`. Route AXE paths past such middleware, or clone the request before reading.
- **Delegate before auth redirects.** A framework-level guard that redirects anonymous requests to a login page must skip AXE paths; an agent needs the `needs_human` envelope, not a redirect. That is what isAxePath is for.
- **Preflight goes to the same handler.** `OPTIONS` requests must reach the handler for CORS to work, which is why the Hono example uses a wildcard method for `/axe` and Remix routes `OPTIONS` through the loader. CORS itself is off until you set `cors` in `createAXE`; see [Deploying](../deploying.md#cors).

## Next steps

- [Getting started](../getting-started.md): `axe inspect`, `axe conformance`, and Claude Desktop against this server.
- [Auth](../auth.md): bearer pass-through with `authenticate`, API keys with `verifySiteKey`, and the login handoff.
- [Deploying](../deploying.md): secret, CORS, caching, rate limits, and durable stores for edge runtimes.
````
