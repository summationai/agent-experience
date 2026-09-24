/**
 * @axe/express: mount an AXE server in Express (4 or 5) or any Connect-style framework.
 *
 * ```ts
 * app.use(axeExpress(axe, { context: async (req) => ({ identity: req.session?.userId ? { onBehalfOf: req.session.userId } : null }) }));
 * ```
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AXE, AdapterContext, MaybePromise } from "@axe/core";

/** A Node request as Express and Connect present it: `originalUrl` and a possibly pre-parsed `body`. */
export interface NodeRequestLike extends IncomingMessage {
  originalUrl?: string;
  body?: unknown;
  protocol?: string;
}

export interface ExpressAdapterOptions {
  /** Inject the framework's session or tenant into AXE. Return `identity: null` for anonymous requests. */
  context?: (req: NodeRequestLike, res: ServerResponse) => MaybePromise<AdapterContext | undefined>;
  /** Override the public origin when the app sits behind a proxy that does not set `Host`/`X-Forwarded-*`. */
  origin?: string;
}

/** Build a Web `Request` from a Node request. Exported for other Node adapters. */
export async function toWebRequest(req: NodeRequestLike, origin?: string): Promise<Request> {
  const proto = origin
    ? undefined
    : (headerValue(req, "x-forwarded-proto") ??
      req.protocol ??
      (isEncrypted(req) ? "https" : "http"));
  const host = origin
    ? undefined
    : (headerValue(req, "x-forwarded-host") ?? headerValue(req, "host") ?? "localhost");
  const base = origin ?? `${proto}://${host}`;
  const url = new URL(req.originalUrl ?? req.url ?? "/", base);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    headers.set(k, Array.isArray(v) ? v.join(", ") : v);
  }
  const method = (req.method ?? "GET").toUpperCase();
  const init: RequestInit = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    if (req.body !== undefined && !(req.body instanceof Uint8Array)) {
      init.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      headers.set("content-type", "application/json");
    } else if (req.body instanceof Uint8Array) {
      init.body = toArrayBufferBytes(req.body);
    } else {
      init.body = await readStream(req);
    }
  }
  return new Request(url, init);
}

/** Write a Web `Response` to a Node response. Exported for other Node adapters. */
export async function sendWebResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  const body = response.body ? Buffer.from(await response.arrayBuffer()) : null;
  res.end(body);
}

/** Express/Connect middleware that serves every AXE path. Mount at the app root. */
export function axeExpress(axe: AXE, options: ExpressAdapterOptions = {}) {
  const handler = axe.fetchHandler();
  return function axeMiddleware(
    req: NodeRequestLike,
    res: ServerResponse,
    next: (err?: unknown) => void,
  ): void {
    const path = (req.originalUrl ?? req.url ?? "/").split("?")[0] ?? "/";
    if (!isAxePath(path, axe)) {
      next();
      return;
    }
    (async () => {
      const request = await toWebRequest(req, options.origin);
      const adapter = (await options.context?.(req, res)) ?? {};
      const response = await handler(request, adapter);
      await sendWebResponse(res, response);
    })().catch(next);
  };
}

function isAxePath(path: string, axe: AXE): boolean {
  const prefix = new URL(axe.config.baseUrl).pathname.replace(/\/$/, "");
  const p = prefix && path.startsWith(prefix + "/") ? path.slice(prefix.length) : path;
  return p.startsWith("/.well-known/axe") || p === "/axe" || p.startsWith("/axe/");
}

function headerValue(req: IncomingMessage, name: string): string | undefined {
  const v = req.headers[name];
  const first = Array.isArray(v) ? v[0] : v;
  return first?.split(",")[0]?.trim() || undefined;
}

function isEncrypted(req: IncomingMessage): boolean {
  return Boolean((req.socket as { encrypted?: boolean } | undefined)?.encrypted);
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
