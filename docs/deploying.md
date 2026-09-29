# Deploying

[Getting started](getting-started.md) leaves you with a conformant endpoint on localhost. This page is what changes between that and production: where the secret and the stores live, how agents find you, which headers the SDK emits and which it does not, and how to roll actions out one at a time without breaking the agents that already depend on you.

## Secrets and stores

The SDK signs continuation, resume, and poll tokens with an HMAC over `secret`. It must be at least 16 characters and should come from your secret manager. When it is absent the server logs a warning and generates a random per-process secret, which is fine on a laptop and wrong everywhere else: tokens minted before a restart fail to verify after it, and two instances behind a load balancer cannot verify each other's tokens. Rotating the secret has the same effect on purpose: every outstanding token becomes invalid, so rotate during a quiet period or accept that in-flight handoffs return `not_found` and agents start over.

Tokens carry no state. What the server remembers about an open requirement or handoff lives in a `TokenStore`. Every operation that must run at most once lives in an `IdempotencyStore`: an action call under one `idempotencyKey` (keyed by tenant, action, acting principal, and key), one use of a continuation or resume token, and the computation of a poll result. Both default to in-memory implementations that are correct for one process and wrong for two.

The two stores need different guarantees. A token record is written when the token is minted and again when `completeHandoff` records a completion, so a get/set store with TTLs is enough. The idempotency store must claim atomically: of two requests that arrive together with one key, on one instance or two, exactly one may be told to run. A `get` followed by a `set` lets both run, so `createAXE` refuses an idempotency store without `claim`, `complete`, and `release`. With Redis, each of those is one Lua script, which Redis runs without interleaving another command:

<!-- include: examples/deploying/stores.ts#kv -->
```ts
// The subset of a Redis-style client the stores need. ioredis and node-redis both have this shape.
interface KV {
  get(k: string): Promise<string | null>;
  set(k: string, v: string, mode: "EX", ttl: number): Promise<unknown>;
  del(k: string): Promise<unknown>;
  /** EVAL: runs a Lua script atomically on the Redis server. */
  eval(script: string, numKeys: number, ...args: string[]): Promise<unknown>;
}
```
<!-- /include -->

<!-- include: examples/deploying/stores.ts#stores -->
```ts
// Token records are written once when a token is minted and again when completeHandoff records
// a completion. Single use lives in the idempotency store, so a plain get/set is enough here.
export function kvTokenStore(kv: KV, prefix = "axe:token:"): TokenStore {
  return {
    async get(id) {
      const raw = await kv.get(prefix + id);
      return raw ? (JSON.parse(raw) as TokenRecord) : undefined;
    },
    async set(id, record, ttlSeconds) {
      await kv.set(prefix + id, JSON.stringify(record), "EX", Math.max(1, Math.ceil(ttlSeconds)));
    },
    async delete(id) {
      await kv.del(prefix + id);
    },
  };
}

// Claims must be atomic, so each operation is one Lua script: Redis runs a script without
// interleaving any other command. A GET followed by a SET would let two requests both claim.
const CLAIM = `
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local raw = redis.call('GET', KEYS[1])
if raw then
  local e = cjson.decode(raw)
  if e.state == 'completed' then return raw end
  if not (e.leaseExpiresAt <= now and e.fingerprint == ARGV[1]) then return raw end
end
redis.call('SET', KEYS[1], cjson.encode({ state = 'in_progress', fingerprint = ARGV[1],
  owner = ARGV[2], leaseExpiresAt = now + tonumber(ARGV[3]) }), 'PX', ARGV[4])
return false`;
const COMPLETE = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local e = cjson.decode(raw)
if e.state ~= 'in_progress' or e.owner ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3])
return 1`;
const RELEASE = `
local raw = redis.call('GET', KEYS[1])
if raw then
  local e = cjson.decode(raw)
  if e.state == 'in_progress' and e.owner == ARGV[1] then redis.call('DEL', KEYS[1]) end
end
return 0`;

export function redisIdempotencyStore(kv: KV, prefix = "axe:op:"): IdempotencyStore {
  type Stored =
    | { state: "in_progress"; fingerprint: string; leaseExpiresAt: number }
    | { state: "completed"; record: IdempotencyRecord };
  return {
    async get(key) {
      const raw = await kv.get(prefix + key);
      const e = raw ? (JSON.parse(raw) as Stored) : undefined;
      return e?.state === "completed" ? e.record : undefined;
    },
    async claim(key, { fingerprint, owner, leaseSeconds, ttlSeconds }): Promise<ClaimOutcome> {
      const raw = await kv.eval(
        CLAIM,
        1,
        prefix + key,
        fingerprint,
        owner,
        String(leaseSeconds * 1000),
        String(Math.max(ttlSeconds, leaseSeconds) * 1000),
      );
      if (typeof raw !== "string") return { outcome: "acquired" };
      const e = JSON.parse(raw) as Stored;
      return e.state === "completed"
        ? { outcome: "completed", record: e.record }
        : { outcome: "in_progress", fingerprint: e.fingerprint, leaseExpiresAt: e.leaseExpiresAt };
    },
    async complete(key, owner, record, ttlSeconds) {
      const stored: Stored = { state: "completed", record };
      const n = await kv.eval(
        COMPLETE,
        1,
        prefix + key,
        owner,
        JSON.stringify(stored),
        String(ttlSeconds * 1000),
      );
      return n === 1;
    },
    async release(key, owner) {
      await kv.eval(RELEASE, 1, prefix + key, owner);
    },
  };
}
```
<!-- /include -->

The SDK passes a TTL on every write: about 15 minutes for continuation tokens, 24 hours for resume tokens, one hour for poll tokens, and the idempotency window (24 hours by default) for idempotency records. Honor it: a store that ignores TTLs grows without bound, and one that shortens them makes handoffs fail before the human gets back.

The scripts are atomic on one Redis primary. With asynchronous replication, a failover can lose a claim or a stored result written just before it, and a retry then runs the handler again; the next section is what keeps that safe. The reference adapter is SQLite: `SqliteIdempotencyStore` from `@summationai/axe-core/node` makes every claim one `INSERT ... ON CONFLICT DO UPDATE ... WHERE` statement, so every runtime that opens the same database file shares claims. It needs Node 22.5 or newer (`node:sqlite`; without a flag from 22.13) and stays on one host, since SQLite over a network filesystem is not safe. The same statements port to PostgreSQL, using `RETURNING` to learn whether the insert or the conditional update took effect.

<!-- include: examples/deploying/stores.ts#sqlite -->
<!-- /include -->

<!-- include: examples/deploying/stores.ts#config -->
```ts
export const axe = createAXE({
  name: "Oakridge Rentals",
  description:
    "Search available apartments, schedule tours, and submit rental applications with a holding deposit.",
  baseUrl: "https://oakridge-rentals.example",
  humanFallbackUrl: "https://oakridge-rentals.example",
  auth: { modes: ["none", "user"], userLoginUrl: "https://oakridge-rentals.example/login" },
  // At least 16 characters, from your secret manager. Rotating it invalidates outstanding tokens.
  secret: process.env.AXE_SECRET,
  tokenStore: kvTokenStore(kv),
  idempotencyStore: redisIdempotencyStore(kv),
  // The idempotency window. Default 24 hours; the store receives it as the TTL on every record.
  idempotencyTtlSeconds: 60 * 60 * 24,
  // How long a claim holds before a retry of the same call may run it again. Above your slowest handler.
  operationLeaseSeconds: 60,
});
```
<!-- /include -->

The same configuration can disable the `idempotencyKey` requirement. Do not: [idempotency](concepts.md#idempotency) is what makes a retried deposit one deposit.

### Operations, claims, and crashes

Every operation goes through one lifecycle (spec §12.2):

1. **Claim.** Before the handler, `onContinue`, `onResume`, or `onPoll` runs, the runtime claims the operation with a fingerprint of what makes a retry the same operation: the canonical `input` as the agent sent it for a call (before defaults or transforms; see [Schemas](schemas.md#input-as-sent-input-as-parsed)), the kind and payload for a continuation. If the operation already completed with that fingerprint, the stored envelope is returned and nothing runs. If it completed or is running with another fingerprint, the answer is `conflict`.
2. **In progress.** A request for an operation another request is still running gets `error` with `code: "conflict"`, `retryable: true`, `details.operationStatus: "in_progress"`, and `details.retryAfter`, with the same number in `Retry-After`. The agent retries with the same key or token after the delay and receives the stored envelope once it exists. A poll answers `pending` instead.
3. **Settle.** A non-error result completes the operation and is stored for the idempotency window. An `error` result, including a handler that throws, releases the claim and stores nothing, so the same key or token may be retried and the handler runs again. A poll's terminal result is stored whatever its status.
4. **Lease.** A claim holds for the operation lease (60 seconds by default). If the process holding it dies before settling, a retry of the same operation takes the claim over once the lease has passed, and runs the handler again. A request for a different operation never takes a claim over. Set the lease above your slowest handler: a handler still running when its lease passes may be joined by a second run, and the first one's result is then not stored (the runtime reports it to `onError`).

The claim makes the decision to run atomic. It does not make your side effect atomic with the stored result: a crash after your database commits and before the result is stored leads to the retry in step 4. Handlers receive `operationId`, the same on every run of one operation and on every instance, for exactly this. Write it under a unique constraint in the same transaction as the change, or pass it to your payment provider as its idempotency key, and the second run finds the first run's work instead of repeating it:

<!-- include: examples/deploying/stores.ts#operation -->
<!-- /include -->

Nothing in the SDK promises that a side effect happens exactly once. It promises one run at a time per operation, a stored envelope for every completed one, and a stable `operationId`; exactly-once effects are that plus your downstream idempotency.

### Migrating a store

The `IdempotencyStore` interface changed from `get` and `set` to `get`, `claim`, `complete`, and `release`, and its record's input hash field is now `fingerprint`. There is no shim: a get/set store cannot claim atomically, and wrapping one would keep the race the change removes. Replace a custom store with `SqliteIdempotencyStore`, the Redis scripts above, or an implementation over your database's conditional insert. `TokenRecord.onBehalfOf` is now `principal` (the encoded principal, `user:<id>`, `site:<id>`, or both), and the consumed-at and terminal-result fields are gone, because single use and poll results live in the idempotency store; a `TokenStore` that stores records as opaque JSON needs no change. Outstanding tokens minted before the upgrade do not verify against the new record shape and return `not_found`; deploy in a quiet period, as for a secret rotation.

## Limits and retention

The runtime bounds what one request can make it hold, and what abandoned requests leave behind ([spec §6.5](../spec/AXE-PROTOCOL.md#65-limits)).

### Request bodies

`maxBodyBytes` is the largest request body the runtime reads: 1 MiB by default. A request whose `Content-Length` is larger is refused before any of it is read; a body without one (chunked) is read only until it passes the limit, then the stream is cancelled. The refusal is `invalid_input` with `details.reason: "payload_too_large"` and `details.maxBodyBytes`, HTTP 413, before any JSON is parsed or any handler runs. A body nested more than 64 levels deep is `invalid_input` too, instead of exhausting the stack.

<!-- include: examples/deploying/limits.ts#body -->
<!-- /include -->

Raise it only for what needs it. A `document.base64` payload may be 10 MiB decoded, about 14 MiB of base64, so a site that accepts large inline documents raises `maxBodyBytes` to match; every other site is better served by `document.url` for anything large.

Adapters and body parsers:

| Where the body is read                                                         | Limit that applies                                                                                          |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `axeFetch`, `axeNext` (App Router), or `fetchHandler()` directly               | `maxBodyBytes`, while the runtime reads the `Request` stream                                                |
| `axeExpress` with no body parser in front, or `axeNextPages` with the body parser turned off (`bodyParser: false`) | `maxBodyBytes`: the adapter reads at most `maxBodyBytes + 1` bytes, then the connection is closed      |
| `express.json()` in front of `axeExpress`                                      | The parser's own `limit` (100 kB by default) first; a larger body never reaches AXE. Then `maxBodyBytes` on the re-serialized value |
| Next's Pages API body parser (the default)                                     | its size limit (`sizeLimit: "1mb"` by default) first, then `maxBodyBytes`                                         |
| A proxy or CDN in front                                                        | Its own limit first. Set it at least as high as `maxBodyBytes` if you raise the latter                      |

### What the stores keep

Every continuation, handoff, and poll mints a token record; every mutating call, continuation, resume, and poll leaves an operation record. Most are never presented again: an agent that abandons a flow leaves its token behind, and idempotency keys are unique by design. A store that only drops an expired record when that key is read again grows without bound.

- `MemoryTokenStore` and `MemoryIdempotencyStore` sweep expired entries on writes, at most once per `sweepIntervalMs` (60 seconds by default), and hold at most `maxEntries` (10000 by default). At the limit the oldest entries are evicted first. An operation claim whose lease is still running is never evicted: that would let the operation run twice, so when every entry is one, the claim fails with an error instead. An evicted completed record shortens that key's idempotency window, and a retry after it runs the handler again; an evicted token answers `not_found`. Neither store runs a timer, so neither keeps a process alive. `sweep()` runs a sweep now; `close()` drops everything and makes later calls fail.
- `SqliteIdempotencyStore` keeps expired rows until something deletes them. Every read already ignores them, so correctness never depends on cleanup; the table size does. Call `prune()` from a periodic job. It deletes rows that expired before now (or before the time you pass, which may not be in the future). Outside Node, the same statement is `DELETE FROM axe_operations_v1 WHERE expires <= ?` with the current time in epoch milliseconds; the `expires` column is indexed.
- A Redis store sets a TTL on every key it writes (`PX` in the scripts above), so Redis expires them itself. Give the instance a `maxmemory` with a `volatile-*` eviction policy, and treat eviction under memory pressure like the in-memory store's: it shortens the window.
- A token store you write yourself: honor `ttlSeconds` on `set` with the backend's own expiry (a TTL, or an `expires` column and a cleanup job).

<!-- include: examples/deploying/limits.ts#memory -->
<!-- /include -->

<!-- include: examples/deploying/limits.ts#prune -->
<!-- /include -->

## Discovery

An agent that has only your home page URL needs to find the manifest. The protocol gives it four places to look, in order, and the SDK serves the first two:

1. `/.well-known/axe.json` at the origin of `baseUrl`. This is the primary location and it must be reachable there, even when `baseUrl` carries a path prefix.
2. `/axe/manifest`, an alias for hosts that cannot serve anything under `.well-known`.
3. The `AXE-Manifest` response header on any page of your site, carrying the absolute manifest URL. Add it at your web server or CDN; the SDK does not emit it because it does not serve your pages.
4. A `<link rel="axe-manifest" href="...">` element in the `<head>` of your HTML.

For crawlers, `robots.txt` may carry two lines:

````

AXE-Manifest: https://www.oakridge-rentals.example/.well-known/axe.json
AXE-Index: https://www.oakridge-rentals.example/.well-known/axe-index.json

````

The second is for [platforms](platforms.md) that publish an index of tenant manifests. Both lines are hints, not access control; an agent that skips `robots.txt` still finds the manifest at the well-known path. To refuse an agent, use `policies.agents`: a `deny` list of vendor names, or an `allow` list that permits only the vendors it names. Deny wins, matching is case-insensitive, and the SDK returns `forbidden` to a denied vendor.

<!-- include: examples/deploying/production.ts#policies -->
```ts
policies: {
  rateLimit: { requestsPerMinute: 120, burst: 30 },
  termsUrl: "https://www.oakridge-rentals.example/agent-terms",
  dataRetention: "Application data is kept for 12 months after the last activity.",
  // Deny wins. An absent allow list permits every vendor that is not denied.
  agents: { deny: ["scraper-co"] },
},
```
<!-- /include -->

`axe conformance` warns when it finds no hint beyond the well-known path, and `axe audit` awards points for one. The cheapest fix is the `robots.txt` line.

## CORS

CORS is off unless you turn it on, and when it is off the SDK emits no CORS headers at all. `OPTIONS` requests still get a `204` with an `Allow` header, so a health check does not mistake the endpoint for dead.

Enable it only for browser-based agents. Server-side agents, MCP clients, and the CLI never send preflights and gain nothing from it.

<!-- include: examples/deploying/production.ts#cors -->
```ts
// Off unless set. Only browser-based agents need it.
cors: { origins: ["https://agent.example"], allowCredentials: true },
```
<!-- /include -->

With `cors` set, a preflight on any AXE path returns `204` with:

```http
Access-Control-Allow-Origin: https://agent.example
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, AXE-Protocol
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 600
Vary: Origin
````

Every other response to a listed origin carries the same allow-origin header and exposes `AXE-Protocol`, `Retry-After`, and `RateLimit-Policy` so a browser client can read them. An origin not in the list gets a response with no CORS headers. With the wildcard as the origins value, credentials are never allowed, per the Fetch standard; set the credentials flag only when browser agents send cookies or `Authorization` headers to a listed origin. An origin you allow credentialed CORS for is also trusted by the request policy, which refuses cookie-carrying `POST`s from every other origin whether or not CORS headers are sent; see [Auth](auth.md#cookie-sessions).

## Caching the manifest

The manifest and each action definition are served with `Cache-Control: public, max-age=300`. Change the number with the manifest cache option. The manifest changes only when you deploy, and the max-age is how long an agent that read it just before a deploy keeps calling an action you renamed.

<!-- include: examples/deploying/production.ts#cache -->
```ts
// Cache-Control: public, max-age=<seconds> on the manifest and on action definitions. Default 300.
manifestCacheSeconds: 600,
updatedAt: process.env.AXE_MANIFEST_UPDATED_AT ?? "2026-09-23T00:00:00Z",
```
<!-- /include -->

The manifest is public and identical for every anonymous request, so let your CDN cache it. Action invocations, `/axe/continue`, `/axe/resume`, and `/axe/poll` responses are per request and carry no cache header; do not add one at the CDN. On platforms the manifest varies by host, so the CDN key must include the host.

Set `updatedAt` from your build, for example from the commit timestamp. Agents and indexes use it to decide whether to re-read the manifest.

## Rate limiting

Declare your limit in `policies.rateLimit`. The SDK then emits `RateLimit-Policy` on every response, in the form `60;w=60`, so agents can pace themselves, and `Retry-After` on every `429`.

The SDK does not enforce the limit: it has no view of your fleet and would need yet another shared store for counters. Enforce at your edge, where you already rate limit the human site, or in `onRequest`, which runs before the handler on every action invocation and may short-circuit it with a result. Returning `fail` with `rate_limited` and the wait in `details` produces the `429` and the header:

<!-- include: examples/deploying/rate-limit.ts#hook -->
```ts
export const axe = createAXE({
  name: "Sunrise Yoga Studio",
  description:
    "Search upcoming yoga classes by date and style, see instructor names and spots left, and (once signed in) book or cancel a spot.",
  baseUrl: "https://sunriseyoga.example",
  auth: { modes: ["none"] },
  secret: process.env.AXE_SECRET,
  // Declared: the SDK emits RateLimit-Policy: 60;w=60 on every response.
  policies: { rateLimit: LIMIT },
  // Enforced: the SDK does not count requests. This hook does, and short-circuits the handler.
  onRequest: (ctx) => {
    const wait = take(callerKey(ctx));
    if (wait === 0) return;
    return fail("rate_limited", `Rate limit exceeded. Retry in ${wait} seconds.`, {
      retryable: true,
      // details.retryAfter becomes the Retry-After header on the 429.
      details: { retryAfter: wait },
    });
  },
});
```
<!-- /include -->

The bucket behind it:

<!-- include: examples/deploying/rate-limit.ts#bucket -->
```ts
// A token bucket per caller, in one process. Behind more than one instance, keep the
// buckets in Redis or enforce the limit at your edge instead.
const LIMIT = { requestsPerMinute: 60, burst: 20 };
const buckets = new Map<string, { tokens: number; updatedAt: number }>();

// Bearer token when the agent authenticates, otherwise the declared vendor.
function callerKey(ctx: HookContext): string {
  const bearer = ctx.request.headers.get("authorization");
  if (bearer) return `token:${bearer}`;
  return `vendor:${ctx.context.agent?.vendor?.toLowerCase() ?? "unknown"}`;
}

/** Returns 0 when the call is allowed, otherwise the number of seconds to wait. */
function take(key: string): number {
  const now = Date.now();
  const capacity = LIMIT.requestsPerMinute + LIMIT.burst;
  const perMs = LIMIT.requestsPerMinute / 60_000;
  const bucket = buckets.get(key) ?? { tokens: capacity, updatedAt: now };
  bucket.tokens = Math.min(capacity, bucket.tokens + (now - bucket.updatedAt) * perMs);
  bucket.updatedAt = now;
  buckets.set(key, bucket);
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return 0;
  }
  return Math.max(1, Math.ceil((1 - bucket.tokens) / perMs / 1000));
}
```
<!-- /include -->

Key on the bearer token when there is one, because that is the identity you issued, and on the declared vendor otherwise; the vendor is self-reported, so it is a fairness key, not a security boundary. `onRequest` is not called for continuation, resume, or poll requests, which are gated by single-use, principal-bound tokens; limit those at the edge if you need to. Agents must honor `Retry-After` and must not retry a `rate_limited` error sooner; `@summationai/axe-client` does this for you.

## Observability hooks

Four hooks give you the request path. Each receives a `HookContext` with the endpoint (`action`, `continue`, `resume`, or `poll`), the action name (recovered from the token on the last three), the underlying `Request`, the sanitized request `context`, and the tenant on platforms.

| Hook        | Receives                           | When                                                                             | May return                        |
| ----------- | ---------------------------------- | -------------------------------------------------------------------------------- | --------------------------------- |
| `onRequest` | the hook context                   | Before the handler on an action invocation, after auth and input validation.     | A result intent to short-circuit. |
| `onResult`  | the hook context, the `Result`     | After every result envelope is determined, on every endpoint, before it is sent. | Nothing.                          |
| `onError`   | the hook context, the thrown value | When a handler throws. The agent receives an `internal` error.                   | Nothing.                          |
| `onEvent`   | the `AXEEvent`                     | After the response is determined, asynchronously. See [Analytics](analytics.md). | Nothing.                          |

Wire `onRequest` and `onResult` to your structured logger with your own request id, `onError` to your APM client, and `onEvent` to a sink. The first three are request-scoped detail for your logs; the fourth is aggregate telemetry that is safe to ship anywhere.

<!-- include: examples/deploying/hooks.ts#fields -->
```ts
// The same fields on every line, so one request id ties the request, the result, and your
// own application logs together. The request id never enters an AXE event.
function fields(ctx: HookContext): Record<string, unknown> {
  return {
    requestId: ctx.request.headers.get("x-request-id"),
    endpoint: ctx.endpoint,
    action: ctx.action,
    vendor: ctx.context.agent?.vendor ?? "unknown",
    tenant: ctx.tenant?.id ?? null,
  };
}
```
<!-- /include -->

<!-- include: examples/deploying/hooks.ts#hooks -->
```ts
export const axe = createAXE({
  name: "Northgate University Admissions",
  description:
    "Check application status, upload transcripts and recommendation letters, and schedule campus visits for prospective students.",
  baseUrl: "https://admissions.northgate.example",
  auth: { modes: ["none", "user"], userLoginUrl: "https://admissions.northgate.example/login" },
  secret: process.env.AXE_SECRET,
  onRequest: (ctx) => {
    log.info({ msg: "axe.request", ...fields(ctx) });
  },
  onResult: (ctx, result) => {
    // Log the status, never result.output, result.accepts, or result.handoff.
    log.info({ msg: "axe.result", ...fields(ctx), status: result.status });
  },
  onError: (ctx, error) => {
    log.error({
      msg: "axe.error",
      ...fields(ctx),
      error: error instanceof Error ? error.message : String(error),
    });
    apm.captureException(error, { action: ctx.action, endpoint: ctx.endpoint });
  },
  onEvent: otelSink({ meter: metrics.getMeter("axe") }),
});
```
<!-- /include -->

> **Warning**
> Never log `input`, `output`, or a continuation `payload`. A payload of a `sensitive` kind is a payment authorization or an identity document. The SDK validates it, hands it to `onContinue`, and forgets it. The hooks give you the result envelope so you can log its status; log nothing else from it.

`onResult` and `onError` failures are logged to stderr and the response goes out unchanged. An `onRequest` hook that throws an `AXEError` short-circuits with that error; any other exception propagates to your framework's error handler, so catch inside the hook.

## Rolling out one action at a time

Agents read the manifest and act on it, so an action that appears in production is in production. Grow the manifest one action at a time behind a flag, verifying at each step.

<!-- include: examples/deploying/flags.ts#gate -->
```ts
const trackOrder = action("orders.track", {
  title: "Track an order",
  description:
    "Returns the shipping status and estimated delivery date for one order, given the order number and the email used at purchase. Does not change anything.",
  readOnly: true,
  risk: "none",
  input: z.object({
    orderNumber: z.string().describe("Order number from the confirmation email, e.g. BG-48213"),
    email: z.string().email().describe("Email address used at purchase"),
  }),
  output: OrderStatus,
  display: {
    kind: "status",
    item: {
      id: "/orderNumber",
      title: "/orderNumber",
      url: "/url",
      attributes: [
        { label: "Status", path: "/status", format: "text" },
        { label: "Estimated delivery", path: "/estimatedDelivery", format: "date" },
      ],
    },
  },
  examples: [
    {
      input: { orderNumber: "BG-48213", email: "sam@example.com" },
      output: {
        orderNumber: "BG-48213",
        status: "shipped",
        estimatedDelivery: "2026-10-02",
        url: "https://bramblegoods.example/orders/BG-48213",
      },
    },
  ],
  handler: async ({ input }) => orders.status(input.orderNumber, input.email),
});

const startReturn = action("returns.start", {
  title: "Start a return",
  description:
    "Opens a return for a delivered order and returns a prepaid shipping label URL. The return can be cancelled from the order page until the package is scanned.",
  risk: "low",
  reversible: true,
  input: z.object({
    orderNumber: z.string().describe("Order number of a delivered order"),
    email: z.string().email().describe("Email address used at purchase"),
    reason: z.enum(["wrong-size", "damaged", "not-as-described", "other"]),
  }),
  output: z.object({ returnId: z.string(), labelUrl: z.string() }),
  handler: async ({ input }) => orders.startReturn(input.orderNumber, input.email, input.reason),
});

// Always on: a read-only action is the safest first step.
axe.register(trackOrder);
// Behind a flag: flip it for one environment, run the conformance suite, then flip it everywhere.
if (flags.isEnabled("axe.returns.start")) axe.register(startReturn);
```
<!-- /include -->

The order that works:

1. **One read-only action** with `readOnly: true` and `risk: "none"`. It cannot hurt anyone, and it exercises discovery, auth, and your adapter.
2. **Add `display`** so agents can present and compare results. See [Presenting results](presenting-results.md).
3. **One mutating action**, low risk and reversible, with an affordance from the read action to it. Run the conformance suite with `--auth` so the ladder checks execute.
4. **Requirements**, when the mutating action needs something the agent may hold: a payment kind, an address, a consent. Watch the `needs_input` to `continued` ratio in your events.
5. **Handoffs**, last, for the steps that genuinely need the human. Verify the landing page calls `completeHandoff` and that resume works end to end. See [Human handoff](human-handoff.md).

At each step, run `axe conformance` against the deployed URL and `axe audit --min-score 80` in CI. The conformance suite fails the build when a check regresses; the audit threshold fails it when a new action ships without examples, without `display`, or with a description the linter rejects. [Testing and conformance](testing-and-conformance.md) has the CI configuration.

When an action must go, do not delete it; an MCP client configured last week still calls the old name. Mark it `deprecated` with `since` and `replacedBy`, keep it serving, and remove it once the events show no traffic:

<!-- include: examples/deploying/flags.ts#deprecate -->
```ts
// Keep the old name serving. Agents that read the manifest will move to orders.track on their own.
const lookupOrder = action("orders.lookup", {
  ...trackOrder.spec,
  title: "Look up an order (deprecated)",
  deprecated: { since: "2026-09-01", replacedBy: "orders.track" },
});
axe.register(lookupOrder);
```
<!-- /include -->

The replacement must be a registered action; the SDK refuses a `replacedBy` that points nowhere. [Deprecating actions](designing-actions.md#deprecating-actions) covers the agent-facing side.

## HTTPS, proxies, and baseUrl

`baseUrl` must use HTTPS. `createAXE` throws otherwise, with one exception: `localhost`, its subdomains, and the loopback addresses may use HTTP. Tokens travel in request bodies and keys in `Authorization` headers; neither has any protection but the transport.

A path prefix in `baseUrl` is honored. With a base of `https://www.oakridge-rentals.example/agents`, the manifest is at `/agents/.well-known/axe.json`, actions are under `/agents/axe/actions`, and the poll URLs and index links the SDK generates include the prefix. Serve the well-known path at the origin as well, as [Discovery](#discovery) says, because that is where agents look first.

<!-- include: examples/deploying/production.ts#baseurl -->
```ts
// HTTPS is required except for localhost. A path prefix is honored: every AXE path is served under it.
baseUrl: process.env.AXE_BASE_URL ?? "https://www.oakridge-rentals.example/agents",
```
<!-- /include -->

Behind a proxy or load balancer, the adapters rebuild the public URL of each request from the forwarded headers. The Express adapter reads the forwarded protocol and host and falls back to the socket; the Next.js Pages adapter reads the same headers and assumes HTTPS. If your proxy does not set them, pass `origin` to `axeExpress` or `axeNextPages` with your public origin so prefix routing and tenant resolution by host see what the agent sees. The fetch-based adapters (`axeFetch`, and `axeNext` for the App Router) receive a Web `Request` whose URL the framework already built; configure the framework's trusted-proxy setting instead. Terminate TLS at the proxy and keep the proxy-to-app hop on a private network.

## Install from GitHub Packages

The packages are published to the summationai organization's GitHub Packages npm registry, not to npmjs, and they are private to the organization: an install needs a GitHub token of someone, or some workflow, in it. Every package carries the same version; install the same version of each.

An `.npmrc` beside the application's `package.json` maps the scope to the registry and reads the token from the environment. npm reads project configuration from the package directory, so a repository-root `.npmrc` is not consulted when the application builds with `npm --prefix <dir>`.

```ini
@summationai:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

- On a workstation: `gh auth refresh -s read:packages && export NODE_AUTH_TOKEN=$(gh auth token)`, then install as usual.
- In GitHub Actions: give the job `permissions: packages: read` and the install step `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`. The packages take their access from this repository, which is internal to the organization; if a workflow's install is refused with 403, add its repository under "Manage Actions access" in the package's settings.
- In a container build: pass the token as a build secret (`RUN --mount=type=secret,id=npm_token NODE_AUTH_TOKEN=$(cat /run/secrets/npm_token) npm ci`), never as a build argument, which stays in the image history.

Without the `.npmrc` the package manager asks npmjs for `@summationai/*` and gets a 404; without a token it gets a 401 from GitHub.

Releases are cut by merging to `main`: `.github/workflows/release.yml` publishes every version the registry does not have yet, so a pull request that bumps versions (`pnpm changeset`, then `pnpm version-packages`) releases them when it merges. The workflow then checks that each package is still private: the registry refuses it and its package page is not found without credentials.

## Consume from a checkout

Without registry access, or to try a commit between releases, an application takes the packages from a checkout as tarballs. `scripts/pack-for-consumer.sh <out-dir>` builds the workspace, packs `@summationai/axe-core`, `@summationai/axe-surface`, `@summationai/axe-client`, and `@summationai/axe-testing` into `<out-dir>` as `summationai-axe-<name>-<version>.tgz`, and writes `<out-dir>/SOURCE` with the repository, branch, commit, and date they came from, because a tarball carries only the version and every commit between two releases carries the same one.

Three things about installing them, whatever the package manager:

- `file:` dependencies. Point each package at its tarball, for example `"@summationai/axe-surface": "file:vendor/summationai-axe-surface-1.0.0.tgz"`. The runtime needs `core` and `surface`; the in-process conformance tests need `client` and `testing` as dev dependencies.
- Overrides for the siblings. Packing rewrites each `workspace:*` dependency to the packed version, so the surface tarball asks for `@summationai/axe-core` at `1.0.0` and the testing tarball for `@summationai/axe-client` at `1.0.0`, which the package manager would ask a registry for. One `overrides` entry per sibling (npm and pnpm; `resolutions` in Yarn) points those requests back at the tarballs: `"overrides": { "@summationai/axe-core": "file:vendor/summationai-axe-core-1.0.0.tgz", "@summationai/axe-client": "file:vendor/summationai-axe-client-1.0.0.tgz" }`.
- Copy before install. The lockfile records each tarball's integrity hash, so a container build that installs from the lockfile must have the tarballs in place first: copy the vendor directory into the image before the install step, and check it out in any CI job that installs. Commit the vendor directory, the package manifest, and the lockfile together, and refresh all three when the `SOURCE` commit moves. Every pack between two releases carries the same version, so a refreshed tarball at the same path looks unchanged to npm: `npm install` reports "up to date" and keeps the old integrity hashes, which `npm ci` then rejects. After refreshing, delete the `node_modules/@summationai/axe-*` entries from the lockfile (or the lockfile's `packages` entries for the tarballs) and install again.

A browser bundle needs no alias for a Node built-in and no work to keep Zod out: `@summationai/axe-core` keeps its one Node-only export on `@summationai/axe-core/node`, and `@summationai/axe-surface` with `@summationai/axe-surface/react` bundles for the browser without Zod, which the bundle test in `packages/surface/test` pins.

## Checklist

Before the manifest is reachable from the public internet:

- [ ] `secret` is at least 16 characters and comes from a secret manager; no per-process-secret warning appears in the logs.
- [ ] `TokenStore` and `IdempotencyStore` are shared across instances, with TTLs honored, and the idempotency store's `claim` is atomic (`SqliteIdempotencyStore`, the Redis scripts, or a conditional insert).
- [ ] Expired records are cleaned up: `SqliteIdempotencyStore.prune()` runs on a schedule, your Redis keys carry TTLs, or the in-memory stores' `maxEntries` fits the process.
- [ ] `maxBodyBytes` is the default unless an inline document kind needs more, and any proxy or body parser in front allows at least that much.
- [ ] `operationLeaseSeconds` is above the slowest handler, and handlers with external effects pass `operationId` downstream or write it in the same transaction.
- [ ] `baseUrl` is the public HTTPS origin agents will use, and `/.well-known/axe.json` answers there.
- [ ] `robots.txt` carries an `AXE-Manifest` line; `axe conformance` reports no hint warning.
- [ ] `policies.rateLimit` is declared, and the edge or `onRequest` enforces it.
- [ ] `cors` is unset unless browser-based agents are expected.
- [ ] If browsers call AXE with your session cookie, every hostname they load pages from is `baseUrl`'s origin or in `requestPolicy.trustedOrigins`, and the session cookie is `SameSite=Lax` or stricter.
- [ ] `onError` reaches your APM; `onEvent` reaches a sink you will look at.
- [ ] No hook and no application log line contains `input`, `output`, or a continuation `payload`.
- [ ] The handoff landing page calls `completeHandoff`, and a resume works against the deployed URL.
- [ ] `axe conformance <url> --auth <token>` and `axe audit <url> --min-score 80` pass in CI.

## Next steps

- [Analytics](analytics.md): the event schema and the queries that tell you whether the rollout is working.
- [Security](security.md): the threat model, what the SDK mitigates, and what your site must.
- [Testing and conformance](testing-and-conformance.md): running the suites locally and in CI.
- [Platforms](platforms.md): serving many tenants, and the index.
````
