/**
 * @axe/fetch: mount an AXE server anywhere a Web-standard `(Request) => Response`
 * handler runs: Hono, Remix, Cloudflare Workers, Bun, Deno, SvelteKit.
 *
 * ```ts
 * const handler = axeFetch(axe, { context: async (req) => ({ identity: await sessionFrom(req) }) });
 * app.all("/axe/*", (c) => handler(c.req.raw));
 * app.get("/.well-known/axe.json", (c) => handler(c.req.raw));
 * ```
 */
import type { AXE, AdapterContext, MaybePromise } from "@axe/core";

export interface FetchAdapterOptions<Env = unknown> {
  /** Inject the platform's session or tenant. Receives the request and whatever extra argument the platform passes (Workers `env`, Hono `Context`). */
  context?: (request: Request, env?: Env) => MaybePromise<AdapterContext | undefined>;
}

/** A fetch handler for the whole AXE surface. */
export function axeFetch<Env = unknown>(axe: AXE, options: FetchAdapterOptions<Env> = {}) {
  const handler = axe.fetchHandler();
  return async function axeHandler(request: Request, env?: Env): Promise<Response> {
    const adapter = (await options.context?.(request, env)) ?? {};
    return handler(request, adapter);
  };
}

/** Whether a URL path is one AXE serves, so routers can delegate only those. */
export function isAxePath(pathname: string): boolean {
  return (
    pathname.startsWith("/.well-known/axe") || pathname === "/axe" || pathname.startsWith("/axe/")
  );
}
