# Next.js

`@axe/next` mounts an AXE server in a Next.js app. `axeNext` is for the App Router: it hands the Web `Request` that Next gives a route handler straight to `@axe/core` and returns the `Response`, with no conversion at all. `axeNextPages` is for the Pages API: it converts Next's Node request into a Web `Request`, calls the same handler, and writes the `Response` back. Pick the one that matches where your routes live; both can coexist during a migration.

The example is Northgate University Admissions, whose `applications.status` action ([Concepts](../concepts.md#action)) needs a signed-in applicant.

## Install

```sh
npm install @axe/core @axe/next
```

## Where the declaration goes

Put `axe.ts` at the project root, next to `next.config.js`, not inside `app/` or `pages/`. Files under `app/` are route segments and files under `pages/` are pages; a stray `axe.ts` in either would be treated as one. Both route files below import it with a relative path.

<!-- include: examples/integrations/next/axe.ts#create -->
```ts
import { createAXE, action, z } from "@axe/core";

export const axe = createAXE({
  name: "Northgate University Admissions",
  description:
    "Check application status, upload transcripts and recommendation letters, and schedule campus visits for prospective students.",
  baseUrl: process.env.AXE_BASE_URL ?? "https://admissions.northgate.example",
  auth: { modes: ["none", "user"], userLoginUrl: "https://admissions.northgate.example/login" },
  secret: process.env.AXE_SECRET,
});```
<!-- /include -->

`baseUrl` comes from the environment so preview and production deployments each advertise their own origin. `secret` must be set in production; see [Gotchas](#gotchas).

## App Router

Create a catch-all route at `app/axe/[...axe]/route.ts` and export the three handlers `axeNext` returns. The `context` callback receives the Web `Request`; read your session cookie from it and return the identity.

<!-- include: examples/integrations/next/app/axe/[...axe]/route.ts#all -->
```ts
import { axeNext } from "@axe/next";
import { axe } from "../../../axe";
import { applicantFromRequest } from "../../../lib/session";

export const { GET, POST, OPTIONS } = axeNext(axe, {
  // `null` means anonymous: a `user` action then returns a login_required handoff.
  context: async (request) => ({ identity: await applicantFromRequest(request) }),
});```
<!-- /include -->

The session helper is yours. This one parses a cookie and looks it up; with next-auth, iron-session, or Clerk you would call their server-side session function instead.

<!-- include: examples/integrations/next/lib/session.ts#all -->
```ts
import type { Identity } from "@axe/core";

const SESSIONS = new Map<string, string>([["s_demo", "applicant_0142"]]);

/** Web Request in: App Router route handlers receive one. */
export async function applicantFromRequest(request: Request): Promise<Identity | null> {
  return applicantFromCookieHeader(request.headers.get("cookie"));
}

/** Cookie header in: Pages API handlers expose it as req.headers.cookie. */
export async function applicantFromCookieHeader(
  cookie: string | null | undefined,
): Promise<Identity | null> {
  const sid = /(?:^|;\s*)ng_session=([^;]+)/.exec(cookie ?? "")?.[1];
  const applicantId = sid ? SESSIONS.get(sid) : undefined;
  return applicantId ? { onBehalfOf: applicantId } : null;
}```
<!-- /include -->

The manifest also has to be reachable at `/.well-known/axe.json`. There are two ways; pick one.

The first is a second route file that re-exports the same handlers:

<!-- include: examples/integrations/next/app/.well-known/axe.json/route.ts#all -->
```ts
export { GET, POST, OPTIONS } from "../../axe/[...axe]/route";```
<!-- /include -->

The second is a rewrite in `next.config.js` from the well-known path to the alias the core already serves, `/axe/manifest`:

```js
// next.config.js
module.exports = {
  async rewrites() {
    return [{ source: "/.well-known/axe.json", destination: "/axe/manifest" }];
  },
};
````

Either way, `axe conformance` should report the well-known and alias discovery checks as passing.

## Pages API

Create a catch-all at `pages/api/axe/[...axe].ts` with a default export. Here `context` receives Next's Node request and response, so the cookie is on the headers object rather than on a Web `Request`.

<!-- include: examples/integrations/next/pages/api/axe/[...axe].ts#all -->
```ts
import { axeNextPages } from "@axe/next";
import { axe } from "../../../axe";
import { applicantFromCookieHeader } from "../../../lib/session";

export default axeNextPages(axe, {
  // The adapter assumes https unless X-Forwarded-Proto says otherwise. Set the
  // origin explicitly so local development and proxied deployments both work.
  origin: process.env.AXE_BASE_URL ?? "http://localhost:3000",
  context: async (req) => ({ identity: await applicantFromCookieHeader(req.headers.cookie) }),
});```
<!-- /include -->

Pages API routes live under `/api`, and agents look under `/axe` and `/.well-known`, so add two rewrites:

```js
// next.config.js
module.exports = {
  async rewrites() {
    return [
      { source: "/.well-known/axe.json", destination: "/api/axe/manifest" },
      { source: "/axe/:path*", destination: "/api/axe/:path*" },
    ];
  },
};
````

Next passes the original URL through to the API route, so the adapter still sees `/axe/actions/applications.status` and routes it correctly. The adapter also honors an x-axe-original-path request header, which you only need when something in front of Next (nginx, a CDN rule) rewrites the path before Next sees it. Have that layer set the header to the path the agent requested.

Two Pages API defaults are worth knowing. Next parses JSON bodies for API routes; the adapter serializes the parsed body back, and if you disable the body parser for the route, it reads the raw stream instead. And the adapter assumes `https` unless `X-Forwarded-Proto` says otherwise, which is right on Vercel and behind most load balancers and wrong on `localhost`; the `origin` option in the example makes both cases explicit.

## Passing your session in

Both adapters take the same `context` shape, and it means the same thing:

- `identity` with an `onBehalfOf` (and optionally `claims`) is the signed-in user. Handlers read it as `context.onBehalfOf`; `applications.status` uses it to find the applicant's file.
- `identity: null` declares the request anonymous. A `user` action then returns `needs_human` with `reason: "login_required"`, a URL at your `userLoginUrl` with the handoff id appended, and a resume token bound to whoever signs in.
- Leaving `identity` out defers to the `authenticate` function in `createAXE`, which sees the Web `Request` and is the right place to validate an `Authorization` bearer token. [Auth](../auth.md) covers pass-through and the login handoff.

The `onBehalfOf` an agent puts in the request body is ignored. Only what your code returns from `context` or `authenticate` reaches a handler.

`context` may also return `tenant` for multi-tenant deployments; [Platforms](../platforms.md) covers that.

## Edge runtime

`@axe/core` is written against Web-standard `Request`, `Response`, `URL`, and Web Crypto, so `export const runtime = "edge"` in the route file works with `axeNext` as it is. Two things change when you do that:

- Every isolate has its own memory. The default token store and idempotency store are in-memory, so a continuation token minted on one isolate is unknown to the next, and an idempotent replay may run twice. Configure `tokenStore` and `idempotencyStore` with something durable (Vercel KV, Upstash, a database) before enabling the Edge runtime. [Deploying](../deploying.md) shows the two interfaces.
- The random fallback `secret` is per isolate, too. Set `secret` explicitly or no token will verify.

`axeNextPages` uses Node's stream API and is Node-only; the Pages API runs there anyway.

## Gotchas

- **Set `secret` in production**, for the reasons above. Even on the Node runtime, serverless functions are recycled without warning.
- **Static caching of `GET` route handlers.** Next may treat a `GET` route handler as static when it does not read the request. The handlers `axeNext` returns read the request URL and headers, which opts them out, but if you see a stale manifest after a deploy, add `export const dynamic = "force-dynamic"` to the route file.
- **Next middleware runs first.** If `middleware.ts` redirects unauthenticated requests to a login page, exclude `/axe` and `/.well-known` from its matcher. An agent needs the `needs_human` envelope, not a `307`.
- **CORS is off by default.** Browser-based agents need `cors` in `createAXE`; see [Deploying](../deploying.md#cors).

## Next steps

- [Getting started](../getting-started.md): `axe inspect`, `axe conformance`, and Claude Desktop against this app.
- [Auth](../auth.md): bearer pass-through with `authenticate`, and what the login handoff looks like from the agent's side.
- [Deploying](../deploying.md): secret, CORS, caching, rate limits, and durable stores for serverless and Edge deployments.
