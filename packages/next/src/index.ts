/**
 * @axe/next: mount an AXE server in Next.js.
 *
 * App Router (`app/axe/[...axe]/route.ts` and `app/.well-known/axe.json/route.ts`):
 * ```ts
 * export const { GET, POST, OPTIONS } = axeNext(axe, { context: async (req) => ({ identity: await sessionFrom(req) }) });
 * ```
 * Pages API (`pages/api/axe/[...axe].ts` with a rewrite for `.well-known`):
 * ```ts
 * export default axeNextPages(axe);
 * ```
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AXE, AdapterContext, MaybePromise } from "@axe/core";

export interface NextAdapterOptions {
  /** Inject the app's session or tenant. */
  context?: (request: Request) => MaybePromise<AdapterContext | undefined>;
}

type RouteHandler = (request: Request) => Promise<Response>;

/** App Router route handlers. Export the returned `GET`, `POST`, and `OPTIONS` from your route file. */
export function axeNext(
  axe: AXE,
  options: NextAdapterOptions = {},
): { GET: RouteHandler; POST: RouteHandler; OPTIONS: RouteHandler } {
  const handler = axe.fetchHandler();
  const route: RouteHandler = async (request) =>
    handler(request, (await options.context?.(request)) ?? {});
  return { GET: route, POST: route, OPTIONS: route };
}

/** A Pages API request: Next parses JSON bodies into `body` by default. */
export interface PagesApiRequestLike extends IncomingMessage {
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
}

export interface NextPagesAdapterOptions {
  context?: (
    req: PagesApiRequestLike,
    res: ServerResponse,
  ) => MaybePromise<AdapterContext | undefined>;
  /** The public origin, e.g. `https://example.com`. Defaults to the request's `Host` header. */
  origin?: string;
}

/** Pages API handler. Use a catch-all route (`pages/api/axe/[...axe].ts`) and rewrite `/.well-known/axe.json` and `/axe/:path*` to it. */
export function axeNextPages(axe: AXE, options: NextPagesAdapterOptions = {}) {
  const handler = axe.fetchHandler();
  return async function pagesHandler(req: PagesApiRequestLike, res: ServerResponse): Promise<void> {
    const host = firstHeader(req, "x-forwarded-host") ?? firstHeader(req, "host") ?? "localhost";
    const proto = firstHeader(req, "x-forwarded-proto") ?? "https";
    const base = options.origin ?? `${proto}://${host}`;
    const original = firstHeader(req, "x-axe-original-path") ?? req.url ?? "/";
    const url = new URL(original, base);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers))
      if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
    const method = (req.method ?? "GET").toUpperCase();
    const init: RequestInit = { method, headers };
    if (method !== "GET" && method !== "HEAD") {
      if (req.body !== undefined) {
        init.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
        headers.set("content-type", "application/json");
      } else {
        init.body = await readStream(req);
      }
    }
    const response = await handler(
      new Request(url, init),
      (await options.context?.(req, res)) ?? {},
    );
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(response.body ? Buffer.from(await response.arrayBuffer()) : null);
  };
}

function firstHeader(req: IncomingMessage, name: string): string | undefined {
  const v = req.headers[name];
  const first = Array.isArray(v) ? v[0] : v;
  return first?.split(",")[0]?.trim() || undefined;
}

function readStream(req: IncomingMessage): Promise<Uint8Array<ArrayBuffer>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(toArrayBufferBytes(Buffer.concat(chunks))));
    req.on("error", reject);
  });
}

function toArrayBufferBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  out.set(bytes);
  return out;
}
