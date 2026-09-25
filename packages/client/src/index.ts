/**
 * @axe/client: the agent side of AXE. Discover a manifest, invoke actions, satisfy
 * requirements from registered fulfillers, hand off to humans, resume, poll.
 * No runtime dependencies; runs in Node 20+ and browsers.
 */
import type {
  ActionDefinition,
  AgentIdentification,
  ErrorResult,
  Handoff,
  JsonValue,
  Live,
  LiveState,
  Manifest,
  NeedsHumanResult,
  NeedsInputResult,
  OkResult,
  PendingResult,
  RequestContext,
  Result,
  Revision,
  Accept,
} from "@axe/core/types";
import * as WIRE from "@axe/core/vocabulary";

export type {
  ActionDefinition,
  Manifest,
  Result,
  OkResult,
  NeedsInputResult,
  NeedsHumanResult,
  PendingResult,
  ErrorResult,
  Handoff,
  Accept,
  Availability,
  JsonValue,
  Live,
  LiveState,
  Revision,
} from "@axe/core/types";

type MaybePromise<T> = T | Promise<T>;
type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

// ---------------------------------------------------------------------------
// Result narrowing
// ---------------------------------------------------------------------------

export function isOk<O = JsonValue>(r: Result<O>): r is OkResult<O> {
  return r.status === WIRE.status.ok;
}
export function isNeedsInput<O = JsonValue>(r: Result<O>): r is NeedsInputResult {
  return r.status === WIRE.status.needsInput;
}
export function isNeedsHuman<O = JsonValue>(r: Result<O>): r is NeedsHumanResult {
  return r.status === WIRE.status.needsHuman;
}
export function isPending<O = JsonValue>(r: Result<O>): r is PendingResult {
  return r.status === WIRE.status.pending;
}
export function isError<O = JsonValue>(r: Result<O>): r is ErrorResult {
  return r.status === WIRE.status.error;
}

// ---------------------------------------------------------------------------
// Fulfillers
// ---------------------------------------------------------------------------

/** What a fulfiller receives for one `accepts[]` entry. */
export interface FulfillRequest {
  action: string;
  reason: string;
  message: string;
  accept: Accept;
  /** Every alternative the site offered, so a fulfiller can prefer one. */
  accepts: Accept[];
}

/**
 * Provides payloads for one or more kinds: a wallet for `payment.*`, a credential
 * store for `identity.*`, a profile for `contact.*`. Return `undefined` when this
 * fulfiller cannot satisfy the request; the client moves to the next option.
 */
export interface Fulfiller {
  kinds: readonly string[];
  fulfill(request: FulfillRequest): MaybePromise<JsonValue | undefined>;
}

/** Passed to `confirm` before a sensitive payload is sent. */
export interface ConfirmRequest {
  action: string;
  accept: Accept;
  /** The payload the fulfiller produced. Show the user a summary, never log it. */
  payload: JsonValue;
  message: string;
}

export interface ClientOptions {
  fetch?: FetchLike;
  /**
   * Extra headers. Treated as credentials: sent only to origins in the credential audience
   * (the discovery origin plus `trust.origins`), never on a cross-origin redirect.
   */
  headers?: Record<string, string>;
  /**
   * Bearer token, or a function returning one, sent in `Authorization` to origins in the
   * credential audience only (see `trust`).
   */
  auth?: string | (() => MaybePromise<string | undefined>);
  /** Which destinations the client may contact and which receive credentials. See `TrustOptions`. */
  trust?: TrustOptions;
  /** Sent as `context.agent` and as the `User-Agent` when possible. */
  agent?: AgentIdentification;
  locale?: string;
  timezone?: string;
  sessionId?: string;
  fulfillers?: Fulfiller[];
  /** Called before any `sensitive` payload is sent. Without it, sensitive options are skipped. */
  confirm?: (request: ConfirmRequest) => MaybePromise<boolean>;
  /** Longest `Retry-After` the client will honor automatically, in ms. Default 30000. */
  maxRetryAfterMs?: number;
  /** Retries after `rate_limited`/`unavailable`. Default 1. */
  retries?: number;
  /**
   * Longest time, in ms, a fetched manifest is used before `ensureFresh()` revalidates it. The
   * effective bound is the smaller of this and the manifest response's `Cache-Control` max-age
   * (`no-cache` and `no-store` mean 0). Default 300000. See "Manifest freshness".
   */
  manifestMaxAgeMs?: number;
  /**
   * Abort one request after this many milliseconds, redirects and reading the body included.
   * Default 30000. Each retry and each poll is a new request with its own timeout.
   */
  timeoutMs?: number;
  /**
   * Largest response body the client reads, in bytes. A larger `Content-Length` is refused
   * before reading; a body without one is read up to the limit, then cancelled. Default 4194304
   * (4 MiB).
   */
  maxResponseBytes?: number;
}

export interface InvokeOptions {
  idempotencyKey?: string;
  context?: Partial<RequestContext>;
  signal?: AbortSignal;
  /**
   * The revision you observed (from `state()`, `manifest().live.rev`, or a previous result's
   * `rev`). A site with live state refuses the call with `conflict` when it moved, applying nothing.
   */
  expectedRev?: Revision | undefined;
}

export interface PollOptions {
  /**
   * Stop polling after this long and return the last `pending`. Default 60000. In `run()` the
   * budget is shared by every poll of the run, starting at its first poll.
   */
  maxWaitMs?: number;
  /** Stop after this many poll requests and return the last `pending`. Default 60; shared in `run()` like `maxWaitMs`. */
  maxPollAttempts?: number;
  signal?: AbortSignal;
  onPending?: (result: PendingResult) => void;
}

export interface RunOptions extends InvokeOptions, PollOptions {
  /** Follow `pending` results by polling. Default true. */
  pollPending?: boolean;
  /** Safety valve for requirement chains. Default 8. */
  maxSteps?: number;
}

/** What `run()` settles to. */
export type RunOutcome<O = JsonValue> =
  | { status: "ok"; result: OkResult<O>; action: ActionDefinition }
  | {
      status: "needs_human";
      handoff: Handoff;
      result: NeedsHumanResult | NeedsInputResult;
      action: ActionDefinition;
    }
  | { status: "needs_input"; result: NeedsInputResult; action: ActionDefinition; tried: string[] }
  | { status: "pending"; result: PendingResult; action: ActionDefinition }
  | { status: "error"; result: ErrorResult; action: ActionDefinition | undefined };

/**
 * Thrown for transport-level failures: the network, a timeout or an abort, a response larger than
 * `maxResponseBytes`, and a body that is not JSON or not a well-formed AXE document. Protocol
 * errors are returned as `error` results.
 */
export class AXEClientError extends Error {
  override readonly cause: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "AXEClientError";
    this.cause = cause;
  }
}

// ---------------------------------------------------------------------------
// Destination policy
// ---------------------------------------------------------------------------

/** Which request a destination check is for. */
export type DestinationKind = "discovery" | "action" | "continue" | "resume" | "state" | "poll";

/** What `trust.destinationPolicy` receives for every outbound request, redirects included. */
export interface DestinationRequest {
  url: string;
  kind: DestinationKind;
  /** Whether the client will attach `auth` and `headers` to this request. */
  credentialed: boolean;
  /** Set when this request follows a redirect: the URL that redirected. */
  redirectedFrom?: string;
}

/**
 * Where the client may send requests and credentials. The anchor is the origin you discovered
 * from (`discover(url)`, `AXEClient.discover(url)`), or the `baseUrl` origin of a manifest you
 * hand to `new AXEClient` yourself. The credential audience is the anchor plus `origins`.
 */
export interface TrustOptions {
  /**
   * More origins (`https://api.example`; a path is ignored) that may be contacted with
   * credentials: a manifest `baseUrl`, `live.url`, `pollUrl`, or discovery hint on another origin.
   */
  origins?: string[];
  /**
   * Contact other https origins named by the site (baseUrl, live.url, pollUrl, discovery hints),
   * without `auth` or `headers`. Loopback and private-range host names stay refused. Default false.
   */
  allowCrossOrigin?: boolean;
  /**
   * Plain http. `"localhost"` (default): only for `localhost`, `127.x.x.x`, and `[::1]` origins in
   * the credential audience. `false`: https everywhere. `true`: http anywhere (a private network
   * you control). An https-to-http redirect is refused whatever this says.
   */
  allowHttp?: boolean | "localhost";
  /**
   * Called for every outbound URL, redirects included, after the built-in checks pass. Return false
   * to refuse. Use it to bind the client to your own network policy. It sees URLs, not resolved
   * addresses: it does not stop DNS rebinding. See docs/security.md.
   */
  destinationPolicy?: (request: DestinationRequest) => MaybePromise<boolean>;
}

/** The built-in part of the destination check for one URL. */
export interface DestinationDecision {
  allowed: boolean;
  /** Whether `auth` and `headers` would be sent. */
  credentialed: boolean;
  reason?: string;
}

/** Thrown when the destination policy refuses a request. Nothing was sent to `url`. */
export class AXETrustError extends AXEClientError {
  readonly url: string;
  readonly kind: DestinationKind;
  constructor(message: string, url: string, kind: DestinationKind) {
    super(message);
    this.name = "AXETrustError";
    this.url = url;
    this.kind = kind;
  }
}

interface Policy {
  audience: Set<string>;
  crossOrigin: boolean;
  http: boolean | "localhost";
  hook: TrustOptions["destinationPolicy"];
}

const LOOPBACK = /^(localhost|127(\.\d{1,3}){3}|\[::1\])$/i;

function makePolicy(anchor: string, trust: TrustOptions = {}): Policy {
  const audience = new Set([anchor]);
  for (const o of trust.origins ?? []) {
    try {
      audience.add(new URL(o).origin);
    } catch (e) {
      throw new AXEClientError(`trust.origins entry "${o}" is not a URL.`, e);
    }
  }
  return {
    audience,
    crossOrigin: trust.allowCrossOrigin === true,
    http: trust.allowHttp ?? "localhost",
    hook: trust.destinationPolicy,
  };
}

/** Loopback, link-local, private, and local-only names, by syntax. Not a defence against DNS. */
function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || /\.(localhost|local|internal)$/.test(h)) return true;
  const v4 = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(h);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  if (h.startsWith("[")) return /^\[(::1?|f[cd]|fe[89ab]|::ffff:)/.test(h);
  return false;
}

function decide(p: Policy, u: URL): DestinationDecision {
  const no = (reason: string): DestinationDecision => ({
    allowed: false,
    credentialed: false,
    reason,
  });
  if (u.protocol !== "https:" && u.protocol !== "http:")
    return no(`${u.protocol} URLs are refused`);
  if (u.username || u.password) return no("URLs with embedded credentials are refused");
  const trusted = p.audience.has(u.origin);
  if (
    u.protocol === "http:" &&
    !(p.http === true || (p.http === "localhost" && trusted && LOOPBACK.test(u.hostname)))
  ) {
    return no(
      `plain http is refused; https is required except for a loopback origin you authorized (trust.allowHttp)`,
    );
  }
  if (trusted) return { allowed: true, credentialed: true };
  if (p.crossOrigin && !isPrivateHost(u.hostname)) return { allowed: true, credentialed: false };
  return no(
    `${u.origin} is not an authorized origin (authorized: ${[...p.audience].join(", ")}); add it to trust.origins`,
  );
}

const REDIRECT_STATUSES = [301, 302, 303, 307, 308];

/**
 * Every request the package makes goes through here. Redirects are followed by hand
 * (`redirect: "manual"`), each hop checked again; credentials go only to the audience and never
 * past a redirect to another origin; an https-to-http redirect is refused.
 */
async function send(
  f: FetchLike,
  p: Policy,
  kind: DestinationKind,
  url: string,
  init: {
    method: string;
    body?: string;
    signal?: AbortSignal | undefined;
    timeoutMs?: number | undefined;
    maxBytes?: number | undefined;
  },
  base: Record<string, string>,
  credentials: () => Promise<Record<string, string>>,
): Promise<Response> {
  let current: URL;
  try {
    current = new URL(url);
  } catch (e) {
    throw new AXEClientError(`${url} is not a URL.`, e);
  }
  const first = current.origin;
  let { method, body } = init;
  let from: string | undefined;
  // One controller per call: the caller's signal and the timeout both abort it, across every
  // redirect hop and while the body is read ([P-PEND-3], docs/for-agent-builders.md).
  const caller = init.signal;
  const timeoutMs = init.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = init.maxBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  if (caller?.aborted) throw new AXEClientError(`Request to ${url} was aborted.`, caller.reason);
  const ctl = new AbortController();
  let timedOut = false;
  const onAbort = () => ctl.abort(caller?.reason);
  caller?.addEventListener("abort", onAbort, { once: true });
  const timer =
    timeoutMs > 0 && Number.isFinite(timeoutMs)
      ? setTimeout(() => {
          timedOut = true;
          ctl.abort();
        }, timeoutMs)
      : undefined;
  (timer as { unref?: () => void } | undefined)?.unref?.();
  const done = () => {
    clearTimeout(timer);
    caller?.removeEventListener("abort", onAbort);
  };
  const failure = (at: string, e: unknown) =>
    e instanceof AXEClientError
      ? e
      : timedOut
        ? new AXEClientError(`Request to ${at} timed out after ${timeoutMs} ms.`, e)
        : caller?.aborted
          ? new AXEClientError(`Request to ${at} was aborted.`, caller.reason)
          : new AXEClientError(`Request to ${at} failed.`, e);
  try {
    for (let hop = 0; hop <= 5; hop++) {
      const refuse = (why: string) =>
        new AXETrustError(
          `Refused ${kind} request to ${current.href}${from ? ` (redirected from ${from})` : ""}: ${why}.`,
          current.href,
          kind,
        );
      const d = decide(p, current);
      if (!d.allowed) throw refuse(d.reason!);
      const credentialed = d.credentialed && current.origin === first;
      if (p.hook) {
        const req: DestinationRequest = { url: current.href, kind, credentialed };
        if (from) req.redirectedFrom = from;
        if (!(await p.hook(req))) throw refuse("trust.destinationPolicy returned false");
      }
      const ri: RequestInit = {
        method,
        headers: credentialed ? { ...base, ...(await credentials()) } : base,
        redirect: "manual",
        signal: ctl.signal,
      };
      if (body !== undefined) ri.body = body;
      let res: Response;
      try {
        res = await f(current.href, ri);
      } catch (e) {
        throw failure(current.href, e);
      }
      if (res.type === "opaqueredirect")
        throw refuse("it redirected and the runtime hides the target, so it cannot be checked");
      if (res.redirected && res.url && new URL(res.url).origin !== current.origin)
        throw refuse(`the fetch implementation followed a redirect to ${res.url} itself`);
      const location = REDIRECT_STATUSES.includes(res.status) ? res.headers.get("location") : null;
      if (!location) return bounded(res, current.href, maxBytes, done, failure);
      void res.body?.cancel().catch(() => undefined);
      const next = new URL(location, current);
      if (current.protocol === "https:" && next.protocol !== "https:")
        throw refuse(`it redirected to ${next.href}, a downgrade from https`);
      if (res.status === 303 || (method === "POST" && res.status < 307)) {
        method = "GET";
        body = undefined;
      }
      from = current.href;
      current = next;
    }
    throw new AXEClientError(`Too many redirects from ${url}.`);
  } catch (e) {
    done();
    throw e;
  }
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

/**
 * The response with its body limited to `max` bytes: a larger `Content-Length` is refused at
 * once, and a body without one errors (and is cancelled) as soon as it passes the limit. `done`
 * runs when the body ends, fails, or is cancelled, which stops the timeout.
 */
function bounded(
  res: Response,
  url: string,
  max: number,
  done: () => void,
  failure: (at: string, e: unknown) => AXEClientError,
): Response {
  const tooLarge = () =>
    new AXEClientError(`Response from ${url} is larger than maxResponseBytes (${max} bytes).`);
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) {
    done();
    void res.body?.cancel().catch(() => undefined);
    throw tooLarge();
  }
  if (!res.body || [204, 205, 304].includes(res.status)) {
    done();
    return res;
  }
  const reader = res.body.getReader();
  let total = 0;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await reader.read();
        if (chunk.done) {
          done();
          controller.close();
          return;
        }
        total += chunk.value.byteLength;
        if (total > max) {
          done();
          void reader.cancel().catch(() => undefined);
          controller.error(tooLarge());
          return;
        }
        controller.enqueue(chunk.value);
      } catch (e) {
        done();
        controller.error(failure(url, e));
      }
    },
    cancel(reason) {
      done();
      return reader.cancel(reason);
    },
  });
  return new Response(stream, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}

/** The origin each manifest returned by `discover()` was discovered from. */
const discoveredFrom = new WeakMap<object, string>();

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

export interface DiscoverOptions {
  fetch?: FetchLike;
  /** Sent only to the discovery origin and `trust.origins`, like `ClientOptions.headers`. */
  headers?: Record<string, string>;
  /** Which origins discovery may follow a header or link hint to. See `TrustOptions`. */
  trust?: TrustOptions;
  /** Abort discovery: every request it makes. */
  signal?: AbortSignal;
  /** Per request, like `ClientOptions.timeoutMs`. Default 30000. */
  timeoutMs?: number;
  /** Like `ClientOptions.maxResponseBytes`. Default 4194304. */
  maxResponseBytes?: number;
}

/**
 * Find a manifest starting from any URL: `/.well-known/axe.json`, `/axe/manifest`, the
 * `AXE-Manifest` response header, then a `<link rel="axe-manifest">` in the page. Returns
 * the manifest and where it was found. A hint or redirect to another origin is followed only
 * when `trust` authorizes it. The returned manifest remembers the discovery origin, so
 * `new AXEClient(manifest)` anchors its credentials there, not at the manifest's `baseUrl`.
 */
export async function discover(
  url: string,
  options: DiscoverOptions = {},
): Promise<{
  manifest: Manifest;
  manifestUrl: string;
  via: "well-known" | "alias" | "header" | "link";
}> {
  const f = options.fetch ?? fetch;
  let origin: URL;
  try {
    origin = new URL(url);
  } catch (e) {
    throw new AXEClientError(`${url} is not a URL.`, e);
  }
  const policy = makePolicy(origin.origin, options.trust);
  const start = decide(policy, origin);
  if (!start.allowed)
    throw new AXETrustError(`Refused discovery at ${url}: ${start.reason}.`, url, "discovery");
  const creds = async () => ({ ...(options.headers ?? {}) });
  const refused: string[] = [];
  const unusable: string[] = [];
  const get = (u: string, accept: string) =>
    send(
      f,
      policy,
      "discovery",
      u,
      {
        method: "GET",
        signal: options.signal,
        timeoutMs: options.timeoutMs,
        maxBytes: options.maxResponseBytes,
      },
      { Accept: accept },
      creds,
    );
  const found = (
    manifest: Manifest,
    manifestUrl: string,
    via: "well-known" | "alias" | "header" | "link",
  ) => {
    discoveredFrom.set(manifest, origin.origin);
    return { manifest, manifestUrl, via };
  };
  const tryJson = async (u: string): Promise<Manifest | undefined> => {
    try {
      const res = await get(u, "application/json");
      if (!res.ok) {
        void res.body?.cancel().catch(() => undefined);
        return undefined;
      }
      const body = (await res.json()) as unknown;
      const problem = manifestProblem(body);
      if (problem) {
        unusable.push(`${u} is not a well-formed manifest: ${problem}.`);
        return undefined;
      }
      fetchedManifests.set(body as Manifest, fetchRecord(u, res));
      return body as Manifest;
    } catch (e) {
      // The caller's abort ends discovery; anything else rules out this candidate only.
      if (options.signal?.aborted) throw e;
      if (e instanceof AXETrustError) refused.push(e.message);
      else if (e instanceof AXEClientError) unusable.push(e.message);
      return undefined;
    }
  };
  const wk = new URL(WIRE.path.manifest, origin.origin).toString();
  const m1 = await tryJson(wk);
  if (m1) return found(m1, wk, "well-known");
  const alias = new URL(WIRE.path.manifestAlias, origin.origin).toString();
  const m2 = await tryJson(alias);
  if (m2) return found(m2, alias, "alias");
  let page: Response;
  try {
    page = await get(url, "text/html,application/json");
  } catch (e) {
    if (e instanceof AXETrustError || options.signal?.aborted) throw e;
    throw new AXEClientError(`Could not reach ${url} while discovering an AXE manifest.`, e);
  }
  const header = page.headers.get(WIRE.header.manifest);
  if (header) {
    const hu = new URL(header, url).toString();
    const m3 = await tryJson(hu);
    if (m3) return found(m3, hu, "header");
  }
  const ct = page.headers.get("content-type") ?? "";
  if (ct.includes("text/html")) {
    let html: string;
    try {
      html = await page.text();
    } catch (e) {
      throw e instanceof AXEClientError ? e : new AXEClientError(`Could not read ${url}.`, e);
    }
    const href = findLinkHref(html);
    if (href) {
      const lu = new URL(href, url).toString();
      const m4 = await tryJson(lu);
      if (m4) return found(m4, lu, "link");
    }
  }
  throw new AXEClientError(
    `No AXE manifest found for ${url}. Tried ${WIRE.path.manifest}, ${WIRE.path.manifestAlias}, the ${WIRE.header.manifest} header, and a <link rel="${WIRE.link.manifestRel}"> tag.${refused.length ? ` Refused by the destination policy: ${refused.join(" ")}` : ""}${unusable.length ? ` Not usable: ${unusable.join(" ")}` : ""}`,
  );
}

// ---------------------------------------------------------------------------
// Checking what a site sent. A manifest, a result, and a live-state document are untrusted input:
// each is checked for the members the client and `present` use before it is returned, so a
// malformed document is an `AXEClientError`, never a crash later on.
// ---------------------------------------------------------------------------

type Check = (v: unknown) => string | undefined;
const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const str: Check = (v) => (typeof v === "string" ? undefined : "a string");
const bool: Check = (v) => (typeof v === "boolean" ? undefined : "a boolean");
const obj: Check = (v) => (isObj(v) ? undefined : "an object");
const num: Check = (v) => (typeof v === "number" && Number.isFinite(v) ? undefined : "a number");
const rev: Check = (v) => (typeof v === "string" ? undefined : num(v));
const strs: Check = (v) =>
  Array.isArray(v) && v.every((x) => typeof x === "string") ? undefined : "an array of strings";
const opt =
  (c: Check): Check =>
  (v) =>
    v === undefined ? undefined : c(v);

/** Check own members of `v` against `shape`; the first problem, as `member must be ...`. */
function members(v: unknown, shape: Record<string, Check>, at = ""): string | undefined {
  if (!isObj(v)) return `${at || "the document"} must be an object`;
  for (const [k, c] of Object.entries(shape)) {
    const why = c(Object.prototype.hasOwnProperty.call(v, k) ? v[k] : undefined);
    if (why) return `${at}${at ? "." : ""}${k} must be ${why}`;
  }
  return undefined;
}

const nested =
  (shape: Record<string, Check>): Check =>
  (v) => {
    const why = members(v, shape);
    return why && isObj(v) ? `valid (${why})` : why && "an object";
  };
const list =
  (c: Check, min = 0): Check =>
  (v) => {
    if (!Array.isArray(v) || v.length < min) return min ? `a non-empty array` : "an array";
    for (let i = 0; i < v.length; i++) {
      const why = c(v[i]);
      if (why) return `valid at [${i}] (${why})`;
    }
    return undefined;
  };

const HANDOFF = {
  reason: str,
  instructions: str,
  url: str,
  resumeToken: str,
  expiresAt: str,
  whatAgentShouldSayToUser: str,
};
const RESULT_SHAPES: Record<string, Record<string, Check>> = {
  [WIRE.status.ok]: {},
  [WIRE.status.needsInput]: {
    reason: str,
    message: str,
    continuationToken: str,
    expiresAt: str,
    accepts: list(
      nested({
        kind: str,
        title: str,
        description: str,
        schema: obj,
        sensitive: bool,
        instructions: opt(str),
      }),
      1,
    ),
    fallback: opt(nested(HANDOFF)),
  },
  [WIRE.status.needsHuman]: { handoff: nested(HANDOFF) },
  [WIRE.status.pending]: { pollUrl: str, retryAfter: num, expiresAt: opt(str) },
  [WIRE.status.error]: {
    error: nested({ code: str, message: str, retryable: bool, details: opt(obj) }),
  },
};

/** Why `v` is not a result envelope the client can act on, or undefined. */
function resultProblem(v: unknown): string | undefined {
  if (!isObj(v)) return "the body must be an object";
  const status = Object.prototype.hasOwnProperty.call(v, "status") ? v["status"] : undefined;
  const shape = typeof status === "string" ? RESULT_SHAPES[status] : undefined;
  if (!shape || !Object.prototype.hasOwnProperty.call(RESULT_SHAPES, status as string))
    return `status must be one of ${Object.keys(RESULT_SHAPES).join(", ")}`;
  if (status === WIRE.status.ok && !Object.prototype.hasOwnProperty.call(v, "output"))
    return "output is missing";
  return members(v, { ...shape, rev: opt(rev) });
}

/** Why `v` is not a manifest the client can use, or undefined. */
function manifestProblem(v: unknown): string | undefined {
  return members(v, {
    protocol: str,
    name: str,
    description: str,
    baseUrl: str,
    actions: list(
      nested({
        name: str,
        title: str,
        description: str,
        input: obj,
        output: obj,
        readOnly: bool,
        display: opt(obj),
        affordances: opt(list(obj)),
      }),
    ),
    live: opt(nested({ url: opt(str), rev: opt(rev) })),
    policies: opt(nested({ agents: opt(nested({ allow: opt(strs), deny: opt(strs) })) })),
  });
}

/** Why `v` is not a live-state document, or undefined. */
function liveStateProblem(v: unknown): string | undefined {
  const why = members(v, { actions: obj, rev: opt(rev) });
  if (why) return why;
  for (const [name, a] of Object.entries((v as { actions: Record<string, unknown> }).actions)) {
    const bad = members(a, { available: bool, reason: opt(str) }, `actions.${name}`);
    if (bad) return bad;
  }
  return undefined;
}

/** Extract the href of `<link rel="axe-manifest">` from HTML without a parser. */
export function findLinkHref(html: string): string | undefined {
  const head = html.slice(0, 200_000);
  const linkRe = /<link\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(head))) {
    const tag = m[0];
    const rel = /\brel\s*=\s*["']?([^"'>\s]+)/i.exec(tag)?.[1];
    if (rel?.toLowerCase() !== WIRE.link.manifestRel) continue;
    const href =
      /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] ?? /\bhref\s*=\s*([^\s>]+)/i.exec(tag)?.[1];
    if (href) return href;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class AXEClient {
  private readonly f: FetchLike;
  private base: string;
  private readonly policy: Policy;
  private fetched: ManifestFetch;
  private refreshing: Promise<ManifestChange> | undefined;
  private readonly changeListeners = new Set<(change: ManifestChange) => void>();

  /**
   * Build a client from a manifest. Credentials are anchored at the origin `discover()` found the
   * manifest on, or, for a manifest you obtained yourself, at its `baseUrl` origin: the client
   * trusts a manifest you hand it. Add origins with `trust.origins`.
   */
  constructor(
    private manifestDoc: Manifest,
    private readonly options: ClientOptions = {},
  ) {
    this.f = options.fetch ?? fetch;
    this.base = manifestDoc.baseUrl.replace(/\/$/, "");
    let anchor = discoveredFrom.get(manifestDoc);
    if (!anchor) {
      try {
        anchor = new URL(manifestDoc.baseUrl).origin;
      } catch (e) {
        throw new AXEClientError(
          `The manifest's baseUrl "${manifestDoc.baseUrl}" is not a URL.`,
          e,
        );
      }
    }
    this.policy = makePolicy(anchor, options.trust);
    this.fetched = fetchedManifests.get(manifestDoc) ?? {
      url: `${this.base}${WIRE.path.manifest}`,
      at: Date.now(),
    };
  }

  /**
   * Discover and construct in one step. Throws `AXETrustError` when the manifest's `baseUrl` is on
   * an origin `trust` does not authorize: a manifest cannot redirect your credentials elsewhere.
   */
  static async discover(
    url: string,
    options: ClientOptions = {},
    call: { signal?: AbortSignal } = {},
  ): Promise<AXEClient> {
    const discoverOpts: DiscoverOptions = {};
    if (options.fetch) discoverOpts.fetch = options.fetch;
    if (options.headers) discoverOpts.headers = options.headers;
    if (options.trust) discoverOpts.trust = options.trust;
    if (options.timeoutMs !== undefined) discoverOpts.timeoutMs = options.timeoutMs;
    if (options.maxResponseBytes !== undefined)
      discoverOpts.maxResponseBytes = options.maxResponseBytes;
    if (call.signal) discoverOpts.signal = call.signal;
    const { manifest, manifestUrl } = await discover(url, discoverOpts);
    const client = new AXEClient(manifest, options);
    const d = client.checkDestination(manifest.baseUrl);
    if (!d.allowed) {
      throw new AXETrustError(
        `The manifest at ${manifestUrl} names baseUrl ${manifest.baseUrl}, which this client may not contact: ${d.reason}.`,
        manifest.baseUrl,
        "action",
      );
    }
    return client;
  }

  /**
   * Whether the destination policy lets this client contact `url`, and with credentials. Checks
   * scheme and origin only; `trust.destinationPolicy` runs at request time. Useful before
   * showing or opening a URL a site returned, such as a handoff `url`.
   */
  checkDestination(url: string): DestinationDecision {
    try {
      return decide(this.policy, new URL(url));
    } catch {
      return { allowed: false, credentialed: false, reason: `${url} is not a URL` };
    }
  }

  /** The manifest this client was built from. */
  manifest(): Manifest {
    return this.manifestDoc;
  }

  /** One action's definition, or undefined. */
  action(name: string): ActionDefinition | undefined {
    return this.manifestDoc.actions.find((a) => a.name === name);
  }

  /** The manifest's `live` member, when the site publishes live state. */
  live(): Live | undefined {
    return this.manifestDoc.live;
  }

  /**
   * What can be done right now, and why not the rest: `GET /axe/state` (never cached), computed for
   * the caller `auth` identifies. Throws `AXEClientError` when the site publishes no live state.
   */
  async state(options: { signal?: AbortSignal } = {}): Promise<LiveState> {
    const url = this.manifestDoc.live?.url ?? `${this.base}${WIRE.path.state}`;
    const res = await this.send("state", url, "GET", undefined, options.signal);
    let body: unknown;
    try {
      body = await res.json();
    } catch (e) {
      if (e instanceof AXEClientError) throw e;
      throw new AXEClientError(`Response from ${url} (HTTP ${res.status}) was not JSON.`, e);
    }
    if (isResult(body) && isError(body)) {
      throw new AXEClientError(
        `${this.manifestDoc.name} does not serve live state at ${url}: ${body.error.code}: ${body.error.message}`,
      );
    }
    const problem = liveStateProblem(body);
    if (problem) {
      throw new AXEClientError(`Response from ${url} is not a live-state document: ${problem}.`);
    }
    return body as LiveState;
  }

  /** Whether this client's vendor is allowed by `policies.agents`. Agents MUST check before calling. */
  allowed(): boolean {
    const policy = this.manifestDoc.policies?.agents;
    if (!policy) return true;
    const vendor = this.options.agent?.vendor?.toLowerCase();
    if (vendor && (policy.deny ?? []).some((d) => d.toLowerCase() === vendor)) return false;
    const allow = (policy.allow ?? ["*"]).map((a) => a.toLowerCase());
    return allow.includes("*") || (!!vendor && allow.includes(vendor));
  }

  /** Invoke an action. Generates an idempotency key for mutating actions when none is given. */
  async invoke<O = JsonValue>(
    name: string,
    input: unknown,
    options: InvokeOptions = {},
  ): Promise<Result<O>> {
    if (!this.allowed()) {
      return {
        status: WIRE.status.error,
        error: {
          code: WIRE.error.forbidden,
          message: `This site's policies.agents does not permit vendor "${this.options.agent?.vendor ?? "(unknown)"}". Do not call it.`,
          retryable: false,
        },
      };
    }
    const def = this.action(name);
    const body: Record<string, unknown> = { input, context: this.context(options.context) };
    if (def && !def.readOnly) body["idempotencyKey"] = options.idempotencyKey ?? randomKey();
    else if (options.idempotencyKey) body["idempotencyKey"] = options.idempotencyKey;
    if (options.expectedRev !== undefined) body["expectedRev"] = options.expectedRev;
    return this.request<O>(
      "action",
      `${this.base}${WIRE.path.actions}/${encodeURIComponent(name)}`,
      body,
      options.signal,
    );
  }

  /** Satisfy a `needs_input` requirement. */
  async continue<O = JsonValue>(
    continuationToken: string,
    kind: string,
    payload: JsonValue,
    options: InvokeOptions = {},
  ): Promise<Result<O>> {
    const body: Record<string, unknown> = {
      continuationToken,
      kind,
      payload,
      context: this.context(options.context),
    };
    if (options.expectedRev !== undefined) body["expectedRev"] = options.expectedRev;
    return this.request<O>("continue", `${this.base}${WIRE.path.continue}`, body, options.signal);
  }

  /** Resume after a human handoff. */
  async resume<O = JsonValue>(
    resumeToken: string,
    options: InvokeOptions = {},
  ): Promise<Result<O>> {
    const body: Record<string, unknown> = { resumeToken, context: this.context(options.context) };
    if (options.expectedRev !== undefined) body["expectedRev"] = options.expectedRev;
    return this.request<O>("resume", `${this.base}${WIRE.path.resume}`, body, options.signal);
  }

  /** Poll a `pending` result until it settles or `maxWaitMs` passes (then the last `pending` is returned). */
  async poll<O = JsonValue>(
    pendingResult: PendingResult,
    options: PollOptions = {},
  ): Promise<Result<O>> {
    return this.pollWithin<O>(pendingResult, options, pollBudget(options));
  }

  /**
   * Poll until settled or the budget runs out: `maxPollAttempts` requests and `maxWaitMs` in all.
   * Each wait honors `retryAfter`, clamped to at least one second (a site that says 0 does not
   * get a request loop) and at most what is left of the budget.
   */
  private async pollWithin<O>(
    pendingResult: PendingResult,
    options: PollOptions,
    budget: { deadline: number; attempts: number },
  ): Promise<Result<O>> {
    let current: Result<O> = pendingResult as Result<O>;
    while (isPending(current)) {
      options.onPending?.(current);
      const remaining = budget.deadline - Date.now();
      if (remaining <= 0 || budget.attempts <= 0) return current;
      budget.attempts--;
      const asked = Number.isFinite(current.retryAfter) ? current.retryAfter * 1000 : 0;
      await sleep(Math.min(Math.max(1000, asked), remaining), options.signal);
      current = await this.request<O>("poll", current.pollUrl, undefined, options.signal);
    }
    return current;
  }

  /**
   * Drive the whole escalation ladder: invoke, satisfy each `needs_input` from
   * registered fulfillers (confirming sensitive payloads), poll pending work, and
   * surface a handoff only when nothing else works.
   *
   * When `expectedRev` is passed, the revision is tracked through the ladder: the first call
   * carries it, and each continuation carries the `rev` of the result it continues from, so a
   * change by someone else between two rungs is caught as `conflict` rather than applied blind.
   */
  async run<O = JsonValue>(
    name: string,
    input: unknown,
    options: RunOptions = {},
  ): Promise<RunOutcome<O>> {
    const def = this.action(name) ?? (await this.actionAfterRefresh(name));
    if (!def) {
      return {
        status: "error",
        action: undefined,
        result: {
          status: WIRE.status.error,
          error: {
            code: WIRE.error.notFound,
            message: `Action "${name}" is not in the manifest.`,
            retryable: false,
          },
        },
      };
    }
    let result = await this.invoke<O>(name, input, options);
    const tried: string[] = [];
    let budget: { deadline: number; attempts: number } | undefined;
    for (let step = 0; step < (options.maxSteps ?? 8); step++) {
      if (isPending(result) && options.pollPending !== false)
        result = await this.pollWithin<O>(result, options, (budget ??= pollBudget(options)));
      if (isOk(result)) return { status: "ok", result, action: def };
      if (isError(result)) return { status: "error", result, action: def };
      if (isNeedsHuman(result))
        return { status: "needs_human", handoff: result.handoff, result, action: def };
      if (isPending(result)) return { status: "pending", result, action: def };
      const ni: NeedsInputResult = result;
      const fulfilled = await this.fulfill(def, ni, tried);
      if (!fulfilled) {
        if (ni.fallback)
          return { status: "needs_human", handoff: ni.fallback, result: ni, action: def };
        return { status: "needs_input", result: ni, action: def, tried };
      }
      const { expectedRev: _seen, ...rest } = options;
      const next: RunOptions =
        options.expectedRev !== undefined && ni.rev !== undefined
          ? { ...rest, expectedRev: ni.rev }
          : rest;
      result = await this.continue<O>(
        ni.continuationToken,
        fulfilled.kind,
        fulfilled.payload,
        next,
      );
    }
    return {
      status: "error",
      action: def,
      result: {
        status: WIRE.status.error,
        error: {
          code: WIRE.error.unavailable,
          message: `Gave up after ${options.maxSteps ?? 8} requirement steps for "${name}".`,
          retryable: false,
        },
      },
    };
  }

  private async fulfill(
    def: ActionDefinition,
    ni: NeedsInputResult,
    tried: string[],
  ): Promise<{ kind: string; payload: JsonValue } | undefined> {
    for (const entry of ni.accepts) {
      const fulfillers = (this.options.fulfillers ?? []).filter((f) =>
        f.kinds.includes(entry.kind),
      );
      for (const fulfiller of fulfillers) {
        tried.push(entry.kind);
        const payload = await fulfiller.fulfill({
          action: def.name,
          reason: ni.reason,
          message: ni.message,
          accept: entry,
          accepts: ni.accepts,
        });
        if (payload === undefined) continue;
        if (entry.sensitive) {
          if (!this.options.confirm) continue;
          const okToSend = await this.options.confirm({
            action: def.name,
            accept: entry,
            payload,
            message: ni.message,
          });
          if (!okToSend) continue;
        }
        return { kind: entry.kind, payload };
      }
    }
    return undefined;
  }

  private context(extra?: Partial<RequestContext>): RequestContext {
    const ctx: RequestContext = {};
    if (this.options.agent) ctx.agent = this.options.agent;
    if (this.options.locale) ctx.locale = this.options.locale;
    if (this.options.timezone) ctx.timezone = this.options.timezone;
    if (this.options.sessionId) ctx.sessionId = this.options.sessionId;
    for (const [k, v] of Object.entries(extra ?? {}))
      if (v !== undefined) (ctx as Record<string, unknown>)[k] = v;
    return ctx;
  }

  /** Headers every request carries. Nothing here identifies the user. */
  private baseHeaders(): Record<string, string> {
    const h: Record<string, string> = {
      [WIRE.header.contentType]: "application/json",
      Accept: "application/json",
      [WIRE.header.protocol]: WIRE.protocol.version,
    };
    const a = this.options.agent;
    if (a && typeof document === "undefined") {
      h[WIRE.header.userAgent] =
        `${a.name}/${a.version ?? "0"} (${a.contact ? `+${a.contact}; ` : ""}${WIRE.protocol.version})`;
    }
    return h;
  }

  /** `headers` and `Authorization`: sent only to the credential audience. */
  private async credentials(): Promise<Record<string, string>> {
    const h: Record<string, string> = { ...(this.options.headers ?? {}) };
    const token =
      typeof this.options.auth === "function" ? await this.options.auth() : this.options.auth;
    if (token) h[WIRE.header.authorization] = `Bearer ${token}`;
    return h;
  }

  private send(
    kind: DestinationKind,
    url: string,
    method: string,
    body: string | undefined,
    signal: AbortSignal | undefined,
  ): Promise<Response> {
    const init: Parameters<typeof send>[4] = {
      method,
      signal,
      timeoutMs: this.options.timeoutMs,
      maxBytes: this.options.maxResponseBytes,
    };
    if (body !== undefined) init.body = body;
    return send(this.f, this.policy, kind, url, init, this.baseHeaders(), () => this.credentials());
  }

  /** POST `body` as JSON, or GET when `body` is undefined; parse the envelope; retry once on 429/503. */
  private async request<O>(
    kind: DestinationKind,
    url: string,
    body: unknown,
    signal?: AbortSignal,
    attempt = 0,
  ): Promise<Result<O>> {
    const json = body === undefined ? undefined : JSON.stringify(body);
    const res = await this.send(kind, url, json === undefined ? "GET" : "POST", json, signal);
    let parsed: unknown;
    try {
      parsed = await res.json();
    } catch (e) {
      if (e instanceof AXEClientError) throw e;
      throw new AXEClientError(`Response from ${url} (HTTP ${res.status}) was not JSON.`, e);
    }
    if (!isResult(parsed)) {
      throw new AXEClientError(
        `Response from ${url} (HTTP ${res.status}) is not an AXE result envelope: ${resultProblem(parsed)}.`,
      );
    }
    // Only what the site says may be retried: an `unavailable` with `retryable: false` (a disabled
    // control, a closed period) will not change in a second, so retrying it only adds a request.
    const retryable =
      isError(parsed) &&
      parsed.error.retryable !== false &&
      (parsed.error.code === WIRE.error.rateLimited ||
        parsed.error.code === WIRE.error.unavailable);
    if (retryable && attempt < (this.options.retries ?? 1)) {
      const ra = Number(res.headers.get(WIRE.header.retryAfter));
      const waitMs = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1000;
      if (waitMs <= (this.options.maxRetryAfterMs ?? 30_000)) {
        await sleep(waitMs, signal);
        return this.request<O>(kind, url, body, signal, attempt + 1);
      }
    }
    return parsed as Result<O>;
  }

  // -------------------------------------------------------------------------
  // Manifest freshness (review item 10, 2026-09-24). Kept separate from the request path.
  // -------------------------------------------------------------------------

  /**
   * Whether the manifest is older than its bound: the smaller of `manifestMaxAgeMs` (default five
   * minutes) and the `Cache-Control` max-age the site sent with it.
   */
  isManifestStale(now: number = Date.now()): boolean {
    const cap = this.options.manifestMaxAgeMs ?? DEFAULT_MANIFEST_MAX_AGE_MS;
    const bound = Math.min(cap, this.fetched.maxAgeMs ?? cap);
    return now - this.fetched.at >= bound;
  }

  /**
   * Fetch the manifest again, conditionally (`If-None-Match` when the site sent an `ETag`), and
   * replace this client's copy when it changed. Concurrent calls share one request. The new
   * manifest's `baseUrl` must pass the destination policy, or the old manifest is kept and
   * `AXETrustError` is thrown. Listeners from `onManifestChange` hear about a change.
   */
  refresh(options: { signal?: AbortSignal } = {}): Promise<ManifestChange> {
    if (!this.refreshing) {
      this.refreshing = this.fetchManifest(options.signal).finally(() => {
        this.refreshing = undefined;
      });
    }
    return this.refreshing;
  }

  /** `refresh()` when the manifest is stale; otherwise nothing. */
  async ensureFresh(options: { signal?: AbortSignal } = {}): Promise<ManifestChange | undefined> {
    if (!this.isManifestStale()) return undefined;
    return this.refresh(options);
  }

  /** Called after every refresh that changed the manifest. Returns an unsubscribe function. */
  onManifestChange(listener: (change: ManifestChange) => void): () => void {
    this.changeListeners.add(listener);
    return () => void this.changeListeners.delete(listener);
  }

  /** An action this client does not know: the site may have added it since. One refresh, then look again. */
  private async actionAfterRefresh(name: string): Promise<ActionDefinition | undefined> {
    try {
      await this.refresh();
    } catch {
      return undefined;
    }
    return this.action(name);
  }

  private async fetchManifest(signal: AbortSignal | undefined): Promise<ManifestChange> {
    const url = this.fetched.url;
    const base = { Accept: "application/json", [WIRE.header.protocol]: WIRE.protocol.version };
    const headers: Record<string, string> = this.fetched.etag
      ? { ...base, "If-None-Match": this.fetched.etag }
      : base;
    const init = {
      method: "GET",
      signal,
      timeoutMs: this.options.timeoutMs,
      maxBytes: this.options.maxResponseBytes,
    };
    const res = await send(this.f, this.policy, "discovery", url, init, headers, async () => ({
      ...(this.options.headers ?? {}),
    }));
    const unchanged: ManifestChange = {
      changed: false,
      added: [],
      removed: [],
      modified: [],
      manifest: this.manifestDoc,
    };
    if (res.status === 304) {
      const etag = this.fetched.etag;
      this.fetched = fetchRecord(url, res);
      if (!this.fetched.etag && etag) this.fetched.etag = etag;
      return unchanged;
    }
    if (!res.ok)
      throw new AXEClientError(`Refreshing the manifest from ${url} failed: HTTP ${res.status}.`);
    let body: unknown;
    try {
      body = await res.json();
    } catch (e) {
      throw new AXEClientError(`The manifest at ${url} was not JSON.`, e);
    }
    const problem = manifestProblem(body);
    if (problem)
      throw new AXEClientError(`The document at ${url} is not a well-formed manifest: ${problem}.`);
    const next = body as Manifest;
    const d = this.checkDestination(next.baseUrl);
    if (!d.allowed) {
      throw new AXETrustError(
        `The refreshed manifest at ${url} names baseUrl ${next.baseUrl}, which this client may not contact: ${d.reason}.`,
        next.baseUrl,
        "action",
      );
    }
    const change = diffManifests(this.manifestDoc, next);
    this.fetched = fetchRecord(url, res);
    const anchor = discoveredFrom.get(this.manifestDoc);
    if (anchor) discoveredFrom.set(next, anchor);
    fetchedManifests.set(next, this.fetched);
    this.manifestDoc = next;
    this.base = next.baseUrl.replace(/\/$/, "");
    if (!change.changed) return unchanged;
    for (const listener of this.changeListeners) {
      try {
        listener(change);
      } catch {
        // a listener's failure is its own
      }
    }
    return change;
  }
}

/** What `refresh()` found: the action names added, removed, and whose definition changed. */
export interface ManifestChange {
  changed: boolean;
  added: string[];
  removed: string[];
  modified: string[];
  /** The manifest in use after the refresh. */
  manifest: Manifest;
}

interface ManifestFetch {
  url: string;
  /** When the manifest was fetched or last revalidated (ms since epoch). */
  at: number;
  etag?: string;
  /** From `Cache-Control`; undefined when the site sent no max-age. */
  maxAgeMs?: number;
}

const DEFAULT_MANIFEST_MAX_AGE_MS = 300_000;

/** Where and how each manifest returned by `discover()` or `refresh()` was fetched. */
const fetchedManifests = new WeakMap<object, ManifestFetch>();

function fetchRecord(url: string, res: Response): ManifestFetch {
  const record: ManifestFetch = { url, at: Date.now() };
  const etag = res.headers.get("etag");
  if (etag) record.etag = etag;
  const cc = (res.headers.get("cache-control") ?? "").toLowerCase();
  if (/\bno-(store|cache)\b/.test(cc)) record.maxAgeMs = 0;
  else {
    const m = /\bmax-age=(\d+)/.exec(cc);
    if (m) record.maxAgeMs = Number(m[1]) * 1000;
  }
  return record;
}

function diffManifests(before: Manifest, after: Manifest): ManifestChange {
  const old = new Map(before.actions.map((a) => [a.name, JSON.stringify(a)]));
  const now = new Map(after.actions.map((a) => [a.name, JSON.stringify(a)]));
  const added = [...now.keys()].filter((n) => !old.has(n));
  const removed = [...old.keys()].filter((n) => !now.has(n));
  const modified = [...now.keys()].filter((n) => old.has(n) && old.get(n) !== now.get(n));
  const { actions: _a, ...restBefore } = before;
  const { actions: _b, ...restAfter } = after;
  const changed =
    added.length > 0 ||
    removed.length > 0 ||
    modified.length > 0 ||
    JSON.stringify(restBefore) !== JSON.stringify(restAfter);
  return { changed, added, removed, modified, manifest: after };
}

function isResult(v: unknown): v is Result {
  return resultProblem(v) === undefined;
}

function pollBudget(options: PollOptions): { deadline: number; attempts: number } {
  return {
    deadline: Date.now() + (options.maxWaitMs ?? 60_000),
    attempts: options.maxPollAttempts ?? 60,
  };
}

function randomKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new AXEClientError("Aborted."));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new AXEClientError("Aborted."));
      },
      { once: true },
    );
  });
}
