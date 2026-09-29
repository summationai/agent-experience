/**
 * @summationai/axe-fetch: mount an AXE server anywhere a Web-standard `(Request) => Response`
 * handler runs: Hono, Remix, Cloudflare Workers, Bun, Deno, SvelteKit.
 *
 * ```ts
 * const handler = axeFetch(axe, { context: async (req) => ({ identity: await sessionFrom(req) }) });
 * app.all("/axe/*", (c) => handler(c.req.raw));
 * app.get("/.well-known/axe.json", (c) => handler(c.req.raw));
 * ```
 */
import type { AXE, AdapterContext, MaybePromise } from "@summationai/axe-core";
import * as WIRE from "@summationai/axe-core/vocabulary";

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
const WELL_KNOWN_PREFIX = WIRE.path.manifest.replace(/\.json$/, "");
const AXE_ROOT = `/${WIRE.path.actions.split("/")[1]}`;

export function isAxePath(pathname: string): boolean {
  return (
    pathname.startsWith(WELL_KNOWN_PREFIX) ||
    pathname === AXE_ROOT ||
    pathname.startsWith(`${AXE_ROOT}/`)
  );
}
