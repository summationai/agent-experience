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
  /** Extra headers on every request. */
  headers?: Record<string, string>;
  /** Bearer token, or a function returning one, sent in `Authorization`. */
  auth?: string | (() => MaybePromise<string | undefined>);
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
  /** Give up after this long. Default 60000. */
  maxWaitMs?: number;
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

/** Thrown for transport-level failures (network, non-JSON body). Protocol errors are returned as `error` results. */
export class AXEClientError extends Error {
  override readonly cause: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "AXEClientError";
    this.cause = cause;
  }
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

export interface DiscoverOptions {
  fetch?: FetchLike;
  headers?: Record<string, string>;
}

/**
 * Find a manifest starting from any URL: `/.well-known/axe.json`, `/axe/manifest`, the
 * `AXE-Manifest` response header, then a `<link rel="axe-manifest">` in the page. Returns
 * the manifest and where it was found.
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
  const origin = new URL(url);
  const headers = { Accept: "application/json", ...(options.headers ?? {}) };
  const tryJson = async (u: string): Promise<Manifest | undefined> => {
    try {
      const res = await f(u, { headers });
      if (!res.ok) return undefined;
      const body = (await res.json()) as unknown;
      return looksLikeManifest(body) ? body : undefined;
    } catch {
      return undefined;
    }
  };
  const wk = new URL(WIRE.path.manifest, origin.origin).toString();
  const m1 = await tryJson(wk);
  if (m1) return { manifest: m1, manifestUrl: wk, via: "well-known" };
  const alias = new URL(WIRE.path.manifestAlias, origin.origin).toString();
  const m2 = await tryJson(alias);
  if (m2) return { manifest: m2, manifestUrl: alias, via: "alias" };
  let page: Response | undefined;
  try {
    page = await f(url, {
      headers: { Accept: "text/html,application/json", ...(options.headers ?? {}) },
    });
  } catch (e) {
    throw new AXEClientError(`Could not reach ${url} while discovering an AXE manifest.`, e);
  }
  const header = page.headers.get(WIRE.header.manifest);
  if (header) {
    const hu = new URL(header, url).toString();
    const m3 = await tryJson(hu);
    if (m3) return { manifest: m3, manifestUrl: hu, via: "header" };
  }
  const ct = page.headers.get("content-type") ?? "";
  if (ct.includes("text/html")) {
    const html = await page.text();
    const href = findLinkHref(html);
    if (href) {
      const lu = new URL(href, url).toString();
      const m4 = await tryJson(lu);
      if (m4) return { manifest: m4, manifestUrl: lu, via: "link" };
    }
  }
  throw new AXEClientError(
    `No AXE manifest found for ${url}. Tried ${WIRE.path.manifest}, ${WIRE.path.manifestAlias}, the ${WIRE.header.manifest} header, and a <link rel="${WIRE.link.manifestRel}"> tag.`,
  );
}

function looksLikeManifest(v: unknown): v is Manifest {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as Manifest).protocol === "string" &&
    Array.isArray((v as Manifest).actions) &&
    typeof (v as Manifest).baseUrl === "string"
  );
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
  private readonly base: string;

  constructor(
    private readonly manifestDoc: Manifest,
    private readonly options: ClientOptions = {},
  ) {
    this.f = options.fetch ?? fetch;
    this.base = manifestDoc.baseUrl.replace(/\/$/, "");
  }

  /** Discover and construct in one step. */
  static async discover(url: string, options: ClientOptions = {}): Promise<AXEClient> {
    const discoverOpts: DiscoverOptions = {};
    if (options.fetch) discoverOpts.fetch = options.fetch;
    if (options.headers) discoverOpts.headers = options.headers;
    const { manifest } = await discover(url, discoverOpts);
    return new AXEClient(manifest, options);
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
    const init: RequestInit = { method: "GET", headers: await this.headers() };
    if (options.signal) init.signal = options.signal;
    let res: Response;
    try {
      res = await this.f(url, init);
    } catch (e) {
      throw new AXEClientError(`Request to ${url} failed.`, e);
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch (e) {
      throw new AXEClientError(`Response from ${url} (HTTP ${res.status}) was not JSON.`, e);
    }
    if (isResult(body) && isError(body)) {
      throw new AXEClientError(
        `${this.manifestDoc.name} does not serve live state at ${url}: ${body.error.code}: ${body.error.message}`,
      );
    }
    if (!body || typeof body !== "object" || typeof (body as LiveState).actions !== "object") {
      throw new AXEClientError(`Response from ${url} is not a live-state document.`);
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
    return this.post<O>(
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
    return this.post<O>(`${this.base}${WIRE.path.continue}`, body, options.signal);
  }

  /** Resume after a human handoff. */
  async resume<O = JsonValue>(
    resumeToken: string,
    options: InvokeOptions = {},
  ): Promise<Result<O>> {
    const body: Record<string, unknown> = { resumeToken, context: this.context(options.context) };
    if (options.expectedRev !== undefined) body["expectedRev"] = options.expectedRev;
    return this.post<O>(`${this.base}${WIRE.path.resume}`, body, options.signal);
  }

  /** Poll a `pending` result until it settles or `maxWaitMs` passes (then the last `pending` is returned). */
  async poll<O = JsonValue>(
    pendingResult: PendingResult,
    options: PollOptions = {},
  ): Promise<Result<O>> {
    const deadline = Date.now() + (options.maxWaitMs ?? 60_000);
    let current: Result<O> = pendingResult as Result<O>;
    while (isPending(current)) {
      options.onPending?.(current);
      const remaining = deadline - Date.now();
      if (remaining <= 0) return current;
      await sleep(Math.min(current.retryAfter * 1000, remaining), options.signal);
      current = await this.get<O>(current.pollUrl, options.signal);
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
    const def = this.action(name);
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
    for (let step = 0; step < (options.maxSteps ?? 8); step++) {
      if (isPending(result) && options.pollPending !== false)
        result = await this.poll<O>(result, options);
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

  private async headers(): Promise<Record<string, string>> {
    const h: Record<string, string> = {
      [WIRE.header.contentType]: "application/json",
      Accept: "application/json",
      [WIRE.header.protocol]: WIRE.protocol.version,
      ...(this.options.headers ?? {}),
    };
    const a = this.options.agent;
    if (a && typeof document === "undefined") {
      h[WIRE.header.userAgent] =
        `${a.name}/${a.version ?? "0"} (${a.contact ? `+${a.contact}; ` : ""}${WIRE.protocol.version})`;
    }
    const token =
      typeof this.options.auth === "function" ? await this.options.auth() : this.options.auth;
    if (token) h[WIRE.header.authorization] = `Bearer ${token}`;
    return h;
  }

  private async post<O>(url: string, body: unknown, signal?: AbortSignal): Promise<Result<O>> {
    const init: RequestInit = {
      method: "POST",
      headers: await this.headers(),
      body: JSON.stringify(body),
    };
    if (signal) init.signal = signal;
    return this.request<O>(url, init);
  }

  private async get<O>(url: string, signal?: AbortSignal): Promise<Result<O>> {
    const init: RequestInit = { method: "GET", headers: await this.headers() };
    if (signal) init.signal = signal;
    return this.request<O>(url, init);
  }

  private async request<O>(url: string, init: RequestInit, attempt = 0): Promise<Result<O>> {
    let res: Response;
    try {
      res = await this.f(url, init);
    } catch (e) {
      throw new AXEClientError(`Request to ${url} failed.`, e);
    }
    let body: unknown;
    try {
      body = await res.json();
    } catch (e) {
      throw new AXEClientError(`Response from ${url} (HTTP ${res.status}) was not JSON.`, e);
    }
    if (!isResult(body)) {
      throw new AXEClientError(
        `Response from ${url} (HTTP ${res.status}) is not an AXE result envelope.`,
      );
    }
    const retryable =
      isError(body) &&
      (body.error.code === WIRE.error.rateLimited || body.error.code === WIRE.error.unavailable);
    if (retryable && attempt < (this.options.retries ?? 1)) {
      const ra = Number(res.headers.get(WIRE.header.retryAfter));
      const waitMs = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1000;
      if (waitMs <= (this.options.maxRetryAfterMs ?? 30_000)) {
        await sleep(waitMs, init.signal ?? undefined);
        return this.request<O>(url, init, attempt + 1);
      }
    }
    return body as Result<O>;
  }
}

function isResult(v: unknown): v is Result {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as Result).status === "string" &&
    (Object.values(WIRE.status) as string[]).includes((v as Result).status)
  );
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
