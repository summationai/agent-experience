# Express

`axeExpress` mounts an AXE server in Express 4, Express 5, or any Connect-style middleware stack. The adapter does one job: it converts the Node request into a Web `Request`, calls the framework-free handler from `@axe/core`, and writes the resulting `Response` back onto the Node response. Routing, validation, auth, tokens, and idempotency happen in the core. The adapter is plumbing, and it is short enough to read in one sitting.

## Install

```sh
npm install @axe/core @axe/express
```

## The mount

The example is Sunrise Yoga Studio with one mutating action, `classes.book`, that only a signed-in member may call. The declaration is the same `axe.ts` you would write for any framework; the framework-specific part is the mount.

<!-- include: examples/integrations/express.ts#axe -->
```ts
export const axe = createAXE({
  name: "Sunrise Yoga Studio",
  description:
    "Search upcoming yoga classes by date and style, see instructor names and spots left, and (once signed in) book or cancel a spot.",
  baseUrl: process.env.AXE_BASE_URL ?? "http://localhost:3000",
  humanFallbackUrl: "http://localhost:3000",
  // `user` mode needs a login page for the login_required handoff. Pass-through comes from the adapter below.
  auth: { modes: ["none", "user"], userLoginUrl: "http://localhost:3000/login" },
  secret: process.env.AXE_SECRET,
});

axe.register(
  action("classes.book", {
    title: "Book a spot in a class",
    description:
      "Books one spot in the given class for the signed-in member and returns the booking id. Cancellation is free until two hours before the class starts. Requires the member to be signed in.",
    risk: "medium",
    idempotent: true,
    reversible: true,
    auth: "user",
    input: z.object({ classId: z.string().describe("Class id, as returned by classes.search") }),
    output: z.object({
      bookingId: z.string(),
      classId: z.string(),
      startsAt: z.string().datetime(),
    }),
    examples: [
      {
        input: { classId: "c_102" },
        output: { bookingId: "b_9001", classId: "c_102", startsAt: "2026-10-01T03:00:00Z" },
      },
    ],
    // `auth: "user"` guarantees an identity here: without one the SDK has already
    // returned a login_required handoff instead of calling the handler.
    handler: async ({ input, context }) => bookings.create(context.onBehalfOf!, input.classId),
  }),
);
```
<!-- /include -->

The site lists `user` among its auth modes and gives a `userLoginUrl`. That is what lets the core send an anonymous agent to the login page instead of failing.

Next, a stand-in for your session middleware. It reads a cookie and attaches `req.session`, which is what express-session does; if you already have one, skip this block.

<!-- include: examples/integrations/express.ts#session -->
```ts
// Stand-in for express-session or your own auth middleware. It reads a `sid`
// cookie, looks the session up, and attaches `req.session`. express-session's
// types augment IncomingMessage the same way, which is why `req.session` is
// visible inside the adapter's `context` callback.
declare module "http" {
  interface IncomingMessage {
    session?: { memberId: string };
  }
}

const SESSIONS = new Map<string, string>([["s_demo", "m_4471"]]);

function session(): express.RequestHandler {
  return (req, _res, next) => {
    const sid = /(?:^|;\s*)sid=([^;]+)/.exec(req.headers.cookie ?? "")?.[1];
    const memberId = sid ? SESSIONS.get(sid) : undefined;
    if (memberId) req.session = { memberId };
    next();
  };
}
```
<!-- /include -->

The mount:

<!-- include: examples/integrations/express.ts#mount -->
```ts
const app = express();
app.use(express.json());
app.use(session());

// Mount at the root. The middleware answers /.well-known/axe* and /axe/* and
// calls next() for everything else, so your own routes are unaffected.
app.use(
  axeExpress(axe, {
    context: (req) => ({
      identity: req.session ? { onBehalfOf: req.session.memberId } : null,
    }),
  }),
);

app.get("/", (_req, res) => {
  res.send("Sunrise Yoga Studio");
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
```
<!-- /include -->

Run it with `npx tsx server.ts` and call the action as a signed-in member:

```sh
curl -s -X POST http://localhost:3000/axe/actions/classes.book \
  -H 'content-type: application/json' \
  -H 'cookie: sid=s_demo' \
  -d '{"input":{"classId":"c_102"},"idempotencyKey":"0b6f0d1c-8d0d-4c1e-9d6a-0f7e6a8b2c11"}'
````

```json
{
  "status": "ok",
  "output": { "bookingId": "b_4471_c_102", "classId": "c_102", "startsAt": "2026-10-01T03:00:00Z" }
}
```

The session middleware turned the cookie into `req.session`, the adapter's `context` callback turned that into an identity, and the handler received it as `context.onBehalfOf`. Drop the cookie header and the same call returns `needs_human` with `reason: "login_required"`, a URL on your login page, and a resume token. [Auth](../auth.md) covers what happens after the member signs in.

## Where the middleware sits

Mount it at the application root with `app.use`. The middleware claims `/.well-known/axe.json`, `/.well-known/axe-index.json`, `/axe/manifest`, and everything under `/axe/actions`, `/axe/continue`, `/axe/resume`, and `/axe/poll`. For any other path it calls `next()` without touching the request, so your routes, static files, and error handlers behave as before.

Two ordering rules follow from how it works:

- Put it after any middleware whose output you read in `context` (session, auth, tenant resolution) and before your catch-all 404 handler.
- Do not mount it under a prefix such as `app.use("/agents", ...)`. The manifest must be served at `/.well-known/axe.json` relative to the origin of `baseUrl` ([spec §3.1](../../spec/AXE-PROTOCOL.md#31-manifest-location)), and the middleware routes on the original URL, so a prefix would move the endpoints away from where agents look. If your whole site lives under a path, put that path in `baseUrl`; the middleware then claims the same paths under that prefix.

Body parsing is optional. When no parser has consumed the body, the adapter reads the raw request stream itself, and only up to the server's `maxBodyBytes` (1 MiB by default): a larger body is answered with 413 and the connection is closed without reading the rest. When `express.json()` (or another parser) has consumed it, the parser's own `limit` applied first (100 kB by default for `express.json()`), and the adapter serializes the parsed value. Mounting `axeExpress` before your body parsers is simplest: AXE then applies its own limit and answers an oversized body with a result envelope, where a parser in front answers with its own error page. See [Deploying](../deploying.md#limits-and-retention). Either way it keeps every request header as sent, `Content-Type` included, so the core's request policy judges the body the client actually sent: a `text/plain` body that `express.text()` turned into a string is still refused.

### Cookie sessions and CSRF

A session cookie like the one above is sent by the browser on requests from any page, so the core refuses a `POST` that carries a cookie unless its `Origin` is the origin of `baseUrl` or an origin in `requestPolicy.trustedOrigins`, and refuses writes whose body is not `application/json` (spec [P-TRANS-1] and [P-TRANS-2]). Set `baseUrl` to the public origin browsers use; the adapter's `origin` option and the forwarded headers only shape the request URL and are never compared with `Origin`. Agents calling with a bearer token and no `Origin` are unaffected. [Auth](../auth.md#cookie-sessions) has the matrix.

## Passing your session in

The `context` option is the bridge between your app's notion of "who is signed in" and AXE's. It receives the Node request and response and returns an object with two optional members:

- `identity`: an object with `onBehalfOf`, optionally with `claims` that handlers can read (roles, email; never sent on the wire). Return `null` to declare the request anonymous.
- `tenant`: the site being served, on multi-tenant platforms.

The difference between `null` and leaving `identity` out matters. `null` means "I checked; nobody is signed in", and the core skips the `authenticate` function from `createAXE`. An empty object means "I have no opinion", and the core falls through to `authenticate`, which sees the Web `Request` and can validate an `Authorization` bearer token that an agent obtained through your normal login or an OAuth grant. Most sites want both: a session cookie for same-origin and embedded agents, a bearer token for agents acting remotely. [Auth](../auth.md) shows the `authenticate` side.

Whatever you return, handlers see it as `context.onBehalfOf`. The `onBehalfOf` an agent writes into the request body is never trusted ([spec §16](../../spec/AXE-PROTOCOL.md#16-authentication)).

### Tenants

On a platform that hosts many studios from one process, resolve the tenant in the same callback:

<!-- include: examples/integrations/express.ts#tenant -->
```ts
// On a platform that hosts many studios, resolve the tenant from the host and
// return it next to the identity. Handlers receive it as `tenant`.
function mountForPlatform(host: express.Express) {
  host.use(
    axeExpress(axe, {
      context: async (req) => ({
        tenant: await tenants.byHost(req.headers.host ?? ""),
        identity: req.session ? { onBehalfOf: req.session.memberId } : null,
      }),
    }),
  );
}
```
<!-- /include -->

Handlers receive it as `tenant`, the manifest is generated per tenant, and every event carries the tenant id. [Platforms](../platforms.md) covers the rest: the platform index, per-tenant branding, and the `tenant` resolver in `createAXE` for when you would rather resolve from the Web `Request`.

## Behind a proxy

The adapter reconstructs the public URL of each request from `X-Forwarded-Proto` and `X-Forwarded-Host`, then `Host`, then Express's own protocol detection (which honors `trust proxy`). The core routes on the path of that URL and, on platforms, resolves tenants from its host. If a proxy in front of you rewrites `Host` and does not add the forwarded headers, pass the public origin explicitly:

<!-- include: examples/integrations/express.ts#origin -->
```ts
// Behind a proxy that does not forward Host or X-Forwarded-*, fix the public origin.
const behindProxy = axeExpress(axe, { origin: "https://sunriseyoga.example" });
```
<!-- /include -->

## Express 4, Express 5, and Connect

The same code runs on Express 4 and 5. The middleware has the plain `(req, res, next)` signature, reads only the original URL, method, headers, and body, and passes conversion errors to `next(err)`, so your error handler sees them. Exceptions thrown by your action handlers never reach it: the core turns them into an `internal` error envelope and calls your `onError` hook, so nothing internal leaks to an agent.

Anything Connect-shaped works too: a `connect()` stack, or a plain Node HTTP server with a hand-written `next`. If you are writing an adapter for another Node framework, `@axe/express` exports the two conversion functions it is built on (toWebRequest and sendWebResponse), so you do not have to reimplement stream reading and header copying.

## Gotchas

- **Set `secret` in production.** Without it the core generates a random per-process secret; continuation and resume tokens then die with every restart and never verify across two instances. [Deploying](../deploying.md) has the checklist.
- **The manifest is cached.** It is served with `Cache-Control` for five minutes by default. `axe inspect` fetches it fresh; a browser tab may not.
- **CORS is off by default.** Agents that call you from a browser need the `cors` option in `createAXE`; see [Deploying](../deploying.md#cors).
- **Mutating actions require `idempotencyKey`.** A `POST` to `classes.book` without one is rejected. `@axe/client` adds one per attempt automatically; a hand-written `curl` must include it, as above.

## Next steps

- [Getting started](../getting-started.md): `axe inspect`, `axe conformance`, and Claude Desktop against this server.
- [Auth](../auth.md): bearer pass-through with `authenticate`, API keys with `verifySiteKey`, and the login handoff.
- [Deploying](../deploying.md): secret, CORS, caching, rate limits, and a durable token store.
````
