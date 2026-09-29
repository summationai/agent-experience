/**
 * @summationai/axe-express: mount an AXE server in Express (4 or 5) or any Connect-style framework.
 *
 * ```ts
 * app.use(axeExpress(axe, { context: async (req) => ({ identity: req.session?.userId ? { onBehalfOf: req.session.userId } : null }) }));
 * ```
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AXE, AdapterContext, MaybePromise } from "@summationai/axe-core";
import * as WIRE from "@summationai/axe-core/vocabulary";

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

/** Options for `toWebRequest`. */
export interface ToWebRequestOptions {
  /**
   * Read at most this many bytes of an unread body stream (pass `axe.maxBodyBytes`). A larger
   * body is not buffered: the Request carries the first `maxBodyBytes + 1` bytes, or none when
   * `Content-Length` already says it is too large, and the core refuses it with 413 ([P-LIM-1]).
   * Unbounded when omitted.
   */
  maxBodyBytes?: number;
}

/** Build a Web `Request` from a Node request. Exported for other Node adapters. */
export async function toWebRequest(
  req: NodeRequestLike,
  origin?: string,
  options: ToWebRequestOptions = {},
): Promise<Request> {
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
    // The request's own headers are kept as sent, `Content-Type` included: the core's request
    // policy ([P-TRANS-1]) judges the body by it, so a body parser that turned a text/plain or
    // form body into a value must not make it look like JSON. The raw stream is preferred while
    // it is unread (Express 4's json parser leaves `req.body = {}` on a body it skipped).
    // A body parser that already consumed the stream applied its own size limit; the core
    // applies `maxBodyBytes` again to what the parser produced.
    if (streamUnread(req)) {
      init.body = await readStream(req, options.maxBodyBytes);
    } else if (req.body instanceof Uint8Array) {
      init.body = toArrayBufferBytes(req.body);
    } else if (req.body !== undefined) {
      init.body = typeof req.body === "string" ? req.body : serializeParsed(req.body);
    }
  }
  return new Request(url, init);
}

/** Whether no middleware has consumed the request body stream. */
function streamUnread(req: IncomingMessage): boolean {
  const r = req as IncomingMessage & { _body?: boolean };
  return r._body !== true && !req.readableEnded && req.readable && req.readableFlowing !== true;
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
      const request = await toWebRequest(req, options.origin, { maxBodyBytes: axe.maxBodyBytes });
      const adapter = (await options.context?.(req, res)) ?? {};
      const response = await handler(request, adapter);
      // A body left unread (refused as too large) is not drained: the connection is closed.
      if (!req.readableEnded && req.method !== "GET" && req.method !== "HEAD")
        res.setHeader("Connection", "close");
      await sendWebResponse(res, response);
    })().catch(next);
  };
}

const WELL_KNOWN_PREFIX = WIRE.path.manifest.replace(/\.json$/, "");
const AXE_ROOT = `/${WIRE.path.actions.split("/")[1]}`;

function isAxePath(path: string, axe: AXE): boolean {
  const prefix = new URL(axe.config.baseUrl).pathname.replace(/\/$/, "");
  const p = prefix && path.startsWith(prefix + "/") ? path.slice(prefix.length) : path;
  return p.startsWith(WELL_KNOWN_PREFIX) || p === AXE_ROOT || p.startsWith(`${AXE_ROOT}/`);
}

function headerValue(req: IncomingMessage, name: string): string | undefined {
  const v = req.headers[name];
  const first = Array.isArray(v) ? v[0] : v;
  return first?.split(",")[0]?.trim() || undefined;
}

function isEncrypted(req: IncomingMessage): boolean {
  return Boolean((req.socket as { encrypted?: boolean } | undefined)?.encrypted);
}

/**
 * Read a request body, stopping after `max + 1` bytes (enough for the core to see it is too large)
 * without buffering the rest. When `Content-Length` already exceeds `max`, nothing is read.
 */
function readStream(
  req: IncomingMessage,
  max: number = Infinity,
): Promise<Uint8Array<ArrayBuffer>> {
  const declared = Number(req.headers["content-length"]);
  if (Number.isFinite(declared) && declared > max) return Promise.resolve(new Uint8Array(0));
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    const finish = () => {
      req.off("data", onData);
      req.off("end", finish);
      req.off("error", reject);
      resolve(toArrayBufferBytes(Buffer.concat(chunks).subarray(0, Math.min(total, max + 1))));
    };
    const onData = (c: Buffer) => {
      chunks.push(c);
      total += c.length;
      if (total > max) {
        req.pause();
        finish();
      }
    };
    req.on("data", onData);
    req.on("end", finish);
    req.on("error", reject);
  });
}

function toArrayBufferBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  out.set(bytes);
  return out;
}

/**
 * Serialize a body a parser already turned into a value. A value nested deeply enough to
 * overflow `JSON.stringify` is replaced by a body nested just past the core's limit, so the core
 * answers it as it answers any over-deep body ([P-LIM-2]) instead of the adapter failing with 500.
 */
function serializeParsed(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch (e) {
    if (!(e instanceof RangeError)) throw e;
    const depth = 1000;
    return `{"input":${"[".repeat(depth)}${"]".repeat(depth)}}`;
  }
}
