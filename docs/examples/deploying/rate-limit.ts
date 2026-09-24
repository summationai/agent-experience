// #region all
import { createAXE, fail } from "@axe/core";
import type { HookContext } from "@axe/core";

// #region bucket
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
// #endregion bucket

// #region hook
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
// #endregion hook
// #endregion all
