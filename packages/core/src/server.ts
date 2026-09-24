/**
 * The framework-free AXE server runtime: routing, validation, auth, tokens,
 * idempotency, hooks, events, and manifest generation, over Web-standard
 * `Request`/`Response`.
 */
import type { z } from "zod";
import type {
  Accept,
  ActionDefinition,
  AgentIdentification,
  Brand,
  Contact,
  ErrorBody,
  ErrorCode,
  Flow,
  Handoff,
  IndexSite,
  JsonSchema,
  JsonValue,
  Ladder,
  Manifest,
  ManifestAuth,
  PlatformIndex,
  Policies,
  RequestContext,
  Result,
  ResultStatus,
  AXEActionEventInput,
} from "./types";
import type { RegisteredAction, TenantInfo, MaybePromise, ResultHelpers } from "./action";
import { ActionDefinitionError } from "./action";
import { validateAffordanceBinding } from "./display";
import { stripReserved } from "./display";
import type { AXEActionEvent, AXEEvent, ActionEventSink, EventAgent, EventSink } from "./events";
import { combineSinks, parseUserAgent } from "./events";
import type { AcceptInput } from "./kinds";
import { isValidKindName } from "./kinds";
import {
  DEFAULT_IDEMPOTENCY_TTL_SECONDS,
  MemoryIdempotencyStore,
  idempotencyStorageKey,
} from "./idempotency";
import type { IdempotencyStore } from "./idempotency";
import { validateJsonSchema } from "./json-schema";
import type { HandoffIntent, ResultIntent } from "./results";
import { AXEError, INTENT, fail, handoff, isIntent, needsInput, ok, pending } from "./results";
import { AGENT_DIRECTIVE_PATTERNS } from "./lint";
import { MemoryTokenStore, TokenSigner, hashJson, loadToken, mintToken } from "./tokens";
import type { TokenRecord, TokenStore } from "./tokens";
import { isZodSchema, toJsonSchema, zodIssuesToValidationIssues } from "./zod-json-schema";
import { WIRE } from "./vocabulary";

export type { TenantInfo };

/** The identity an adapter or `authenticate` establishes for the acting user. */
export interface Identity {
  onBehalfOf: string;
  /** Anything the site wants handlers to see (roles, email). Not sent on the wire. */
  claims?: Record<string, JsonValue>;
}

/** What a `verifySiteKey` function may return: `true`, `false`, or an allowlist of actions. */
export type SiteKeyVerdict = boolean | { id?: string; actions?: string[] };

export interface AuthConfig {
  modes: ManifestAuth["modes"];
  /** Where a human signs in during a `login_required` handoff. Required when `user` is a mode and pass-through is not the only mechanism. */
  userLoginUrl?: string;
  /** Map a request to the acting user, for `user` mode pass-through. Return `null` when anonymous. */
  authenticate?: (request: Request) => MaybePromise<Identity | null | undefined>;
  /** Validate a `site` mode bearer key. */
  verifySiteKey?: (key: string, request: Request) => MaybePromise<SiteKeyVerdict>;
}

export interface CorsConfig {
  /** `"*"` or a list of allowed origins. */
  origins: "*" | string[];
  allowCredentials?: boolean;
}

export interface IndexConfig {
  platform: { name: string; url: string };
  /** Return one page of sites. `page` is whatever you put in the previous page's `next` query string, or `null`. */
  sites: (page: string | null) => MaybePromise<{ sites: IndexSite[]; next?: string | null }>;
}

export type Endpoint = "action" | "continue" | "resume" | "poll";

/** Passed to hooks. */
export interface HookContext {
  endpoint: Endpoint;
  action: string;
  request: Request;
  context: RequestContext;
  tenant: TenantInfo | null;
}

/** Passed by adapters to inject the framework's own session and tenant resolution. */
export interface AdapterContext {
  identity?: Identity | null;
  tenant?: TenantInfo | null;
}

export interface AXEConfig {
  name: string;
  description: string;
  baseUrl: string;
  humanFallbackUrl?: string;
  auth: AuthConfig;
  policies?: Policies;
  contact?: Contact;
  brand?: Brand;
  flows?: Flow[];
  indexUrl?: string;
  updatedAt?: string;
  /** HMAC secret for tokens, at least 16 characters. Omit only in development: a random per-process secret is used and tokens do not survive restarts. */
  secret?: string | undefined;
  tokenStore?: TokenStore;
  idempotencyStore?: IdempotencyStore;
  /** Default 86400 (24 hours). */
  idempotencyTtlSeconds?: number;
  /** Reject mutating calls without `idempotencyKey`. Default true. */
  requireIdempotencyKey?: boolean;
  cors?: CorsConfig;
  /** Resolve the tenant for a request on multi-tenant platforms. Return `null` for unknown hosts. */
  tenant?: (request: Request) => MaybePromise<TenantInfo | null | undefined>;
  /** Serve a platform index at `/.well-known/axe-index.json`. */
  index?: IndexConfig;
  /** `Cache-Control` max-age for the manifest, in seconds. Default 300. */
  manifestCacheSeconds?: number;
  onRequest?: (ctx: HookContext) => MaybePromise<void | ResultIntent>;
  onResult?: (ctx: HookContext, result: Result) => MaybePromise<void>;
  onError?: (ctx: HookContext, error: unknown) => MaybePromise<void>;
  onEvent?: EventSink | EventSink[];
  /** Sinks for action events, the ledger lines a handler records with `context.emit`. They name actors, so they are not analytics. */
  onActionEvent?: ActionEventSink | ActionEventSink[];
}

const CONTINUATION_TTL = 15 * 60;
/** Decoded-size limit for `document.base64` payloads (spec/KINDS.md). */
export const MAX_BASE64_DOCUMENT_BYTES = 10 * 1024 * 1024;
const RESUME_TTL = 24 * 60 * 60;
const POLL_TTL = 60 * 60;

const HTTP_STATUS: Record<ErrorCode, number> = {
  invalid_input: 400,
  unsupported: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  internal: 500,
  unavailable: 503,
};

const helpers: ResultHelpers = { ok, needsInput, handoff, pending, fail };

type WithoutUndefined<T> = { [K in keyof T]: Exclude<T[K], undefined> };

/** Drop `undefined` members so objects satisfy `exactOptionalPropertyTypes`. */
function omitUndefined<T extends object>(obj: T): WithoutUndefined<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as WithoutUndefined<T>;
}

function majorOf(version: string): string | undefined {
  const m = /^axe\/(\d+)\.(\d+)$/.exec(version);
  return m?.[1];
}

/** The server. Create one with `createAXE()`. */
export class AXE {
  private readonly actions = new Map<string, RegisteredAction>();
  private readonly signer: TokenSigner;
  private readonly tokens: TokenStore;
  private readonly idempotency: IdempotencyStore;
  private readonly emit: EventSink;
  private readonly emitAction: ActionEventSink;
  private finalized = false;
  private basePath: string;

  constructor(readonly config: AXEConfig) {
    if (!config.name?.trim() || !config.description?.trim() || !config.baseUrl) {
      throw new Error("createAXE: `name`, `description`, and `baseUrl` are required.");
    }
    let base: URL;
    try {
      base = new URL(config.baseUrl);
    } catch {
      throw new Error(`createAXE: baseUrl "${config.baseUrl}" is not an absolute URL.`);
    }
    if (base.protocol !== "https:" && !isLoopback(base.hostname)) {
      throw new Error(
        `createAXE: baseUrl must use https (http is allowed for localhost). Received ${config.baseUrl} (spec [P-MAN-2]).`,
      );
    }
    if (!config.auth || !Array.isArray(config.auth.modes) || config.auth.modes.length === 0) {
      throw new Error('createAXE: `auth.modes` must list at least one of "none", "site", "user".');
    }
    if (
      config.auth.modes.includes(WIRE.authMode.user) &&
      !config.auth.userLoginUrl &&
      !config.auth.authenticate
    ) {
      throw new Error(
        "createAXE: auth mode `user` needs `auth.userLoginUrl` (for login handoffs), `auth.authenticate` (for pass-through), or both.",
      );
    }
    if (config.auth.modes.includes(WIRE.authMode.site) && !config.auth.verifySiteKey) {
      throw new Error("createAXE: auth mode `site` needs `auth.verifySiteKey(key, request)`.");
    }
    this.basePath = base.pathname.replace(/\/$/, "");
    let secret = config.secret;
    if (!secret) {
      secret = crypto.randomUUID() + crypto.randomUUID();
      console.warn(
        "[axe] No `secret` configured; using a random per-process secret. Continuation and resume tokens will not survive a restart. Set `secret` in production.",
      );
    }
    this.signer = new TokenSigner(secret);
    this.tokens = config.tokenStore ?? new MemoryTokenStore();
    this.idempotency = config.idempotencyStore ?? new MemoryIdempotencyStore();
    const sinks = config.onEvent
      ? Array.isArray(config.onEvent)
        ? config.onEvent
        : [config.onEvent]
      : [];
    this.emit = combineSinks(sinks, (e) => console.error("[axe] event sink failed", e));
    const actionSinks = config.onActionEvent
      ? Array.isArray(config.onActionEvent)
        ? config.onActionEvent
        : [config.onActionEvent]
      : [];
    this.emitAction = combineSinks<AXEActionEvent>(actionSinks, (e) =>
      console.error("[axe] action event sink failed", e),
    );
  }

  /** The `emit` a handler receives: stamps the event and hands it to the action event sinks on the next microtask. */
  private emitterFor(action: string, tenant: TenantInfo | null): (e: AXEActionEventInput) => void {
    return (e) => {
      const event: AXEActionEvent = {
        schemaVersion: 1,
        ts: new Date().toISOString(),
        action,
        event: e.event,
        status: e.status ?? WIRE.status.ok,
        errorCode: e.errorCode ?? null,
        actor: e.actor ?? null,
        details: e.details ?? {},
        tenant: tenant?.id ?? null,
      };
      queueMicrotask(() => this.emitAction(event));
    };
  }

  // -------------------------------------------------------------------------
  // Registration and manifest
  // -------------------------------------------------------------------------

  /** Add an action created with `action()`. Throws when the name is taken or a declaration is invalid. */
  register<I extends z.ZodType, O extends z.ZodType, S extends JsonValue>(
    registered: RegisteredAction<I, O, S>,
  ): this {
    if (this.actions.has(registered.name)) {
      throw new ActionDefinitionError(
        registered.name,
        "is already registered. Action names must be unique (spec [P-ACT-2]).",
      );
    }
    const def = registered.definition;
    if (!this.config.auth.modes.includes(def.auth)) {
      throw new ActionDefinitionError(
        registered.name,
        `auth "${def.auth}" is not in manifest auth.modes [${this.config.auth.modes.join(", ")}] (spec [P-AUTH-1]).`,
      );
    }
    // Check affordances whose targets are already registered.
    for (const [i, aff] of (def.affordances ?? []).entries()) {
      const target = this.actions.get(aff.action);
      if (target) validateAffordanceBinding(registered.name, i, aff, target.definition.input);
    }
    // Check earlier actions that pointed at this one.
    for (const other of this.actions.values()) {
      if (!other.unresolvedTargets.includes(registered.name)) continue;
      for (const [i, aff] of (other.definition.affordances ?? []).entries()) {
        if (aff.action === registered.name)
          validateAffordanceBinding(other.name, i, aff, def.input);
      }
      other.unresolvedTargets = other.unresolvedTargets.filter((t) => t !== registered.name);
    }
    this.actions.set(registered.name, registered as unknown as RegisteredAction);
    this.finalized = false;
    return this;
  }

  /** Every registered action's wire definition. */
  get definitions(): ActionDefinition[] {
    return [...this.actions.values()].map((a) => a.definition);
  }

  /** Look up one registered action. */
  getAction(name: string): RegisteredAction | undefined {
    return this.actions.get(name);
  }

  /**
   * Verify cross-action references (affordance targets, flow steps, deprecations).
   * Called automatically on the first request or `describe()`; call it in tests to fail fast.
   */
  finalize(): this {
    if (this.finalized) return this;
    for (const a of this.actions.values()) {
      for (const t of a.unresolvedTargets) {
        throw new ActionDefinitionError(
          a.name,
          `affordance targets "${t}", which is not registered. Register it, or remove the affordance (spec [P-AFF-1]).`,
        );
      }
      if (
        a.definition.deprecated?.replacedBy &&
        !this.actions.has(a.definition.deprecated.replacedBy)
      ) {
        throw new ActionDefinitionError(
          a.name,
          `deprecated.replacedBy "${a.definition.deprecated.replacedBy}" is not a registered action.`,
        );
      }
    }
    for (const flow of this.config.flows ?? []) {
      for (const step of flow.steps) {
        if (!this.actions.has(step))
          throw new Error(
            `createAXE: flow "${flow.name}" step "${step}" is not a registered action.`,
          );
      }
    }
    this.finalized = true;
    return this;
  }

  /** The manifest, optionally for a tenant. */
  describe(tenant?: TenantInfo | null): Manifest {
    this.finalize();
    const c = this.config;
    const t = tenant ?? null;
    const auth = omitUndefined({
      modes: t?.auth?.modes ?? c.auth.modes,
      userLoginUrl: t?.auth?.userLoginUrl ?? c.auth.userLoginUrl,
    }) as ManifestAuth;
    return omitUndefined({
      protocol: WIRE.protocol.version,
      name: t?.name ?? c.name,
      description: t?.description ?? c.description,
      baseUrl: t?.baseUrl ?? c.baseUrl,
      humanFallbackUrl: t?.humanFallbackUrl ?? c.humanFallbackUrl,
      auth,
      actions: this.definitions,
      flows: c.flows,
      policies: t?.policies ?? c.policies,
      contact: t?.contact ?? c.contact,
      brand: t?.brand ?? c.brand,
      indexUrl: t?.indexUrl ?? c.indexUrl,
      updatedAt: t?.updatedAt ?? c.updatedAt,
    }) as Manifest;
  }

  /** A `(Request) => Promise<Response>` for the whole protocol surface. Adapters wrap this. */
  fetchHandler(): (request: Request, adapter?: AdapterContext) => Promise<Response> {
    return (request, adapter) => this.handle(request, adapter);
  }

  /**
   * Record that the human finished a handoff. Call this from the page at the handoff
   * `url` (read the `axe_handoff` query parameter). Returns false when the id is unknown.
   */
  async completeHandoff(
    handoffId: string,
    completion: { onBehalfOf?: string; data?: JsonValue } = {},
  ): Promise<boolean> {
    const record = await this.tokens.get(handoffId);
    if (!record || record.type !== "resume") return false;
    record.completion = omitUndefined({
      at: new Date().toISOString(),
      onBehalfOf: completion.onBehalfOf,
      data: completion.data,
    }) as NonNullable<TokenRecord["completion"]>;
    await this.tokens.set(
      handoffId,
      record,
      Math.max(1, Math.ceil((record.expiresAt - Date.now()) / 1000)),
    );
    return true;
  }

  // -------------------------------------------------------------------------
  // HTTP
  // -------------------------------------------------------------------------

  /** Handle one request. Prefer `fetchHandler()`; this is the same thing as a method. */
  async handle(request: Request, adapter: AdapterContext = {}): Promise<Response> {
    this.finalize();
    const url = new URL(request.url);
    const path = this.stripBase(url.pathname);
    const method = request.method.toUpperCase();

    let tenant: TenantInfo | null = adapter.tenant ?? null;
    if (!tenant && this.config.tenant) {
      tenant = (await this.config.tenant(request)) ?? null;
      if (!tenant && path !== WIRE.path.index) {
        return this.respond(
          request,
          tenant,
          fail(WIRE.error.notFound, "No AXE site is configured for this host.").error,
          undefined,
        );
      }
    }

    if (method === "OPTIONS") return this.preflight(request);

    if (method === "GET" && (path === WIRE.path.manifest || path === WIRE.path.manifestAlias)) {
      return this.json(request, this.describe(tenant), 200, {
        "Cache-Control": `public, max-age=${this.config.manifestCacheSeconds ?? 300}`,
      });
    }
    if (method === "GET" && path === WIRE.path.index) {
      if (!this.config.index)
        return this.respond(
          request,
          tenant,
          fail(WIRE.error.notFound, "This site does not publish a platform index.").error,
          undefined,
        );
      const page = await this.config.index.sites(url.searchParams.get("page"));
      const index = omitUndefined({
        protocol: WIRE.protocol.version,
        platform: this.config.index.platform,
        sites: page.sites,
        next: page.next
          ? `${this.config.baseUrl.replace(/\/$/, "")}${WIRE.path.index}?page=${encodeURIComponent(page.next)}`
          : undefined,
      }) as PlatformIndex;
      return this.json(request, index, 200, { "Cache-Control": "public, max-age=300" });
    }

    const actionsPrefix = `${WIRE.path.actions}/`;
    if (path.startsWith(actionsPrefix)) {
      const name = decodeURIComponent(path.slice(actionsPrefix.length));
      if (method === "GET") {
        const a = this.actions.get(name);
        if (!a)
          return this.respond(
            request,
            tenant,
            fail(WIRE.error.notFound, `Unknown action "${name}".`).error,
            undefined,
          );
        return this.json(request, a.definition, 200, {
          "Cache-Control": `public, max-age=${this.config.manifestCacheSeconds ?? 300}`,
        });
      }
      if (method === "POST") return this.invokeEndpoint(request, name, tenant, adapter);
      return this.methodNotAllowed(request, "GET, POST, OPTIONS");
    }
    if (path === WIRE.path.continue) {
      if (method !== "POST") return this.methodNotAllowed(request, "POST, OPTIONS");
      return this.continueEndpoint(request, tenant, adapter);
    }
    if (path === WIRE.path.resume) {
      if (method !== "POST") return this.methodNotAllowed(request, "POST, OPTIONS");
      return this.resumeEndpoint(request, tenant, adapter);
    }
    const pollPrefix = `${WIRE.path.poll}/`;
    if (path.startsWith(pollPrefix)) {
      if (method !== "GET") return this.methodNotAllowed(request, "GET, OPTIONS");
      return this.pollEndpoint(
        request,
        decodeURIComponent(path.slice(pollPrefix.length)),
        tenant,
        adapter,
      );
    }
    return this.respond(
      request,
      tenant,
      fail(
        WIRE.error.notFound,
        `No AXE endpoint at ${path}. See the manifest at ${WIRE.path.manifest}.`,
      ).error,
      undefined,
    );
  }

  private stripBase(pathname: string): string {
    if (this.basePath && pathname.startsWith(this.basePath + "/"))
      return pathname.slice(this.basePath.length);
    return pathname;
  }

  private headers(request: Request, extra: Record<string, string> = {}): Headers {
    const h = new Headers({
      [WIRE.header.contentType]: "application/json; charset=utf-8",
      [WIRE.header.protocol]: WIRE.protocol.version,
      ...extra,
    });
    const rl = this.config.policies?.rateLimit;
    if (rl) h.set(WIRE.header.rateLimitPolicy, `${rl.requestsPerMinute};w=60`);
    const cors = this.config.cors;
    if (cors) {
      const origin = request.headers.get("Origin");
      const allowed =
        cors.origins === "*" ? "*" : origin && cors.origins.includes(origin) ? origin : null;
      if (allowed) {
        h.set("Access-Control-Allow-Origin", allowed);
        h.set(
          "Access-Control-Expose-Headers",
          [WIRE.header.protocol, WIRE.header.retryAfter, WIRE.header.rateLimitPolicy].join(", "),
        );
        if (cors.allowCredentials && allowed !== "*")
          h.set("Access-Control-Allow-Credentials", "true");
        if (allowed !== "*") h.set("Vary", "Origin");
      }
    }
    return h;
  }

  private json(
    request: Request,
    body: unknown,
    status: number,
    extra: Record<string, string> = {},
  ): Response {
    return new Response(JSON.stringify(body), { status, headers: this.headers(request, extra) });
  }

  private preflight(request: Request): Response {
    if (!this.config.cors)
      return new Response(null, {
        status: 204,
        headers: this.headers(request, { Allow: "GET, POST, OPTIONS" }),
      });
    const h = this.headers(request, {
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": [
        WIRE.header.contentType,
        WIRE.header.authorization,
        WIRE.header.protocol,
      ].join(", "),
      "Access-Control-Max-Age": "600",
    });
    h.delete(WIRE.header.contentType);
    return new Response(null, { status: 204, headers: h });
  }

  private methodNotAllowed(request: Request, allow: string): Response {
    const body: Result = {
      status: WIRE.status.error,
      error: fail(
        WIRE.error.notFound,
        `Method ${request.method} is not supported here. Allowed: ${allow}.`,
      ).error,
    };
    return this.json(request, body, 405, { Allow: allow });
  }

  private respond(
    request: Request,
    _tenant: TenantInfo | null,
    error: ErrorBody,
    retryAfter: number | undefined,
  ): Response {
    const extra: Record<string, string> = {};
    if (retryAfter !== undefined) extra[WIRE.header.retryAfter] = String(retryAfter);
    return this.json(
      request,
      { status: WIRE.status.error, error } satisfies Result,
      HTTP_STATUS[error.code],
      extra,
    );
  }

  private send(request: Request, result: Result): Response {
    if (result.status === WIRE.status.error) {
      const extra: Record<string, string> = {};
      if (result.error.code === WIRE.error.rateLimited) {
        const ra = result.error.details?.["retryAfter"];
        extra[WIRE.header.retryAfter] = String(typeof ra === "number" ? ra : 60);
      }
      return this.json(request, result, HTTP_STATUS[result.error.code], extra);
    }
    if (result.status === WIRE.status.pending) {
      return this.json(request, result, 200, {
        [WIRE.header.retryAfter]: String(result.retryAfter),
      });
    }
    return this.json(request, result, 200);
  }

  // -------------------------------------------------------------------------
  // Shared request plumbing
  // -------------------------------------------------------------------------

  private protocolError(request: Request): Result | undefined {
    const header = request.headers.get(WIRE.header.protocol);
    if (!header) return undefined;
    const theirs = majorOf(header.trim());
    const ours = majorOf(WIRE.protocol.version);
    if (theirs === undefined || theirs !== ours) {
      return {
        status: WIRE.status.error,
        error: fail(
          WIRE.error.unsupported,
          `Protocol version "${header}" is not supported; this server speaks ${WIRE.protocol.version} (spec [P-VER-5]).`,
        ).error,
      };
    }
    return undefined;
  }

  private async readBody(
    request: Request,
  ): Promise<{ body: Record<string, unknown> } | { error: Result }> {
    let text: string;
    try {
      text = await request.text();
    } catch {
      return {
        error: {
          status: WIRE.status.error,
          error: fail(WIRE.error.invalidInput, "Could not read the request body.").error,
        },
      };
    }
    if (!text.trim())
      return {
        error: {
          status: WIRE.status.error,
          error: fail(
            WIRE.error.invalidInput,
            "Request body is required and must be a JSON object.",
          ).error,
        },
      };
    try {
      const parsed = JSON.parse(text) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return {
          error: {
            status: WIRE.status.error,
            error: fail(WIRE.error.invalidInput, "Request body must be a JSON object.").error,
          },
        };
      }
      return { body: parsed as Record<string, unknown> };
    } catch {
      return {
        error: {
          status: WIRE.status.error,
          error: fail(WIRE.error.invalidInput, "Request body is not valid JSON.").error,
        },
      };
    }
  }

  private sanitizeContext(raw: unknown): RequestContext {
    const ctx: RequestContext = {};
    if (!raw || typeof raw !== "object") return ctx;
    const r = raw as Record<string, unknown>;
    if (typeof r["locale"] === "string") ctx.locale = r["locale"];
    if (typeof r["timezone"] === "string") ctx.timezone = r["timezone"];
    if (typeof r["sessionId"] === "string") ctx.sessionId = r["sessionId"].slice(0, 200);
    const agent = r["agent"];
    if (agent && typeof agent === "object") {
      const a = agent as Record<string, unknown>;
      if (typeof a["name"] === "string") {
        const id: AgentIdentification = { name: a["name"].slice(0, 200) };
        if (typeof a["version"] === "string") id.version = a["version"].slice(0, 100);
        if (typeof a["vendor"] === "string") id.vendor = a["vendor"].slice(0, 200);
        if (typeof a["contact"] === "string") id.contact = a["contact"].slice(0, 500);
        ctx.agent = id;
      }
    }
    return ctx;
  }

  private agentDenied(ctx: RequestContext, tenant: TenantInfo | null): boolean {
    const policy = (tenant?.policies ?? this.config.policies)?.agents;
    if (!policy) return false;
    const vendor = ctx.agent?.vendor?.toLowerCase();
    const deny = (policy.deny ?? []).map((v) => v.toLowerCase());
    const allow = (policy.allow ?? ["*"]).map((v) => v.toLowerCase());
    if (vendor && deny.includes(vendor)) return true;
    if (allow.includes("*")) return false;
    return !vendor || !allow.includes(vendor);
  }

  private async establishIdentity(
    request: Request,
    adapter: AdapterContext,
  ): Promise<Identity | null> {
    if (adapter.identity !== undefined) return adapter.identity ?? null;
    if (this.config.auth.authenticate)
      return (await this.config.auth.authenticate(request)) ?? null;
    return null;
  }

  private bearer(request: Request): string | null {
    const h = request.headers.get(WIRE.header.authorization);
    const m = h ? /^Bearer\s+(.+)$/i.exec(h.trim()) : null;
    return m?.[1]?.trim() || null;
  }

  private hook(
    endpoint: Endpoint,
    action: string,
    request: Request,
    context: RequestContext,
    tenant: TenantInfo | null,
  ): HookContext {
    return { endpoint, action, request, context, tenant };
  }

  private async runHooksAndFinish(
    hookCtx: HookContext,
    result: Result,
    startedAt: number,
    ladder: Ladder,
    kind: string | null,
  ): Promise<Response> {
    try {
      await this.config.onResult?.(hookCtx, result);
    } catch (e) {
      console.error("[axe] onResult hook failed", e);
    }
    const event: AXEEvent = {
      schemaVersion: 1,
      ts: new Date().toISOString(),
      action: hookCtx.action,
      status: result.status as ResultStatus,
      ladder,
      agent: hookCtx.context.agent
        ? (omitUndefined({
            vendor: hookCtx.context.agent.vendor,
            name: hookCtx.context.agent.name,
            version: hookCtx.context.agent.version,
          }) as EventAgent)
        : parseUserAgent(hookCtx.request.headers.get(WIRE.header.userAgent)),
      latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      kind,
      errorCode: result.status === WIRE.status.error ? result.error.code : null,
      tenant: hookCtx.tenant?.id ?? null,
    };
    queueMicrotask(() => this.emit(event));
    return this.send(hookCtx.request, result);
  }

  /** Run a handler-ish function and normalize what comes back (value, intent, or throw) into an intent. */
  private async runHandler<T>(
    hookCtx: HookContext,
    fn: () => MaybePromise<T>,
  ): Promise<ResultIntent> {
    try {
      const value = await fn();
      if (isIntent(value)) return value;
      return ok(value);
    } catch (e) {
      if (e instanceof AXEError) return e.intent;
      try {
        await this.config.onError?.(hookCtx, e);
      } catch (hookErr) {
        console.error("[axe] onError hook failed", hookErr);
      }
      return fail(
        WIRE.error.internal,
        "The action failed unexpectedly. The site has been notified.",
        { retryable: true },
      );
    }
  }

  /**
   * Agent-read text produced at runtime (messages, instructions, what the agent should say)
   * is held to the same honesty rule as registration-time text: an instruction aimed at the
   * agent is a site bug, and the runtime refuses to forward it.
   */
  private directiveIn(intent: ResultIntent): string | undefined {
    const texts: string[] = [];
    if (intent[INTENT] === "needs_input") {
      texts.push(intent.message);
      for (const a of intent.accepts)
        texts.push(a.description, a.title ?? "", a.instructions ?? "");
      if (intent.fallback)
        texts.push(intent.fallback.instructions, intent.fallback.whatAgentShouldSayToUser);
    } else if (intent[INTENT] === "handoff") {
      texts.push(intent.instructions, intent.whatAgentShouldSayToUser);
    } else if (intent[INTENT] === "error") {
      texts.push(intent.error.message);
    }
    for (const t of texts)
      for (const re of AGENT_DIRECTIVE_PATTERNS) {
        const m = re.exec(t);
        if (m) return m[0];
      }
    return undefined;
  }

  /** Turn an intent into a wire result, minting tokens and validating output. */
  private async materialize(
    intent: ResultIntent,
    a: RegisteredAction,
    hookCtx: HookContext,
    binding: { inputHash: string; onBehalfOf: string | null; tenant: string | null },
    baseUrl: string,
  ): Promise<Result> {
    const directive = this.directiveIn(intent);
    if (directive) {
      try {
        await this.config.onError?.(
          hookCtx,
          new Error(
            `Action "${a.name}" produced agent-read text containing an instruction aimed at the agent ("${directive}"). Agent-read text describes the step; it never tells the agent how to behave (spec [P-HON-1]).`,
          ),
        );
      } catch (e) {
        console.error("[axe] onError hook failed", e);
      }
      return {
        status: WIRE.status.error,
        error: fail(
          WIRE.error.internal,
          "The action produced a response that failed validation. The site has been notified.",
          { retryable: false },
        ).error,
      };
    }
    switch (intent[INTENT]) {
      case "ok": {
        const stripped = stripReserved(intent.output, a.definition.display?.items);
        const parsed = a.spec.output.safeParse(stripped);
        if (!parsed.success) {
          const issues = zodIssuesToValidationIssues(parsed.error.issues);
          try {
            await this.config.onError?.(
              hookCtx,
              new Error(
                `Action "${a.name}" returned output that does not match its output schema: ${issues.map((i) => `${i.path || "/"} ${i.message}`).join("; ")}`,
              ),
            );
          } catch (e) {
            console.error("[axe] onError hook failed", e);
          }
          return {
            status: WIRE.status.error,
            error: fail(
              WIRE.error.internal,
              "The action produced a response that failed validation. The site has been notified.",
              { retryable: false },
            ).error,
          };
        }
        // Keep `_axe` on the wire: agents need dynamic affordances. Validation used the stripped copy.
        return { status: WIRE.status.ok, output: intent.output as JsonValue };
      }
      case "needs_input": {
        const accepts = intent.accepts.map((entry) => this.toWireAccept(a.name, entry));
        const minted = await mintToken(this.signer, {
          type: "continuation",
          action: a.name,
          ttlSeconds: intent.ttlSeconds ?? CONTINUATION_TTL,
          state: intent.state,
          accepts,
          ...binding,
        });
        await this.tokens.set(
          minted.record.id,
          minted.record,
          intent.ttlSeconds ?? CONTINUATION_TTL,
        );
        const result: Result = {
          status: WIRE.status.needsInput,
          reason: intent.reason,
          message: intent.message,
          accepts,
          continuationToken: minted.token,
          expiresAt: minted.expiresAt,
        };
        if (intent.fallback)
          result.fallback = await this.mintHandoff(intent.fallback, a.name, binding);
        return result;
      }
      case "handoff":
        return {
          status: WIRE.status.needsHuman,
          handoff: await this.mintHandoff(intent, a.name, binding),
        };
      case "pending": {
        if (!a.spec.onPoll && !intent.pollUrl) {
          return {
            status: WIRE.status.error,
            error: fail(
              WIRE.error.internal,
              "The action reported pending work but defines no onPoll. The site has been notified.",
            ).error,
          };
        }
        const ttl = intent.ttlSeconds ?? POLL_TTL;
        const minted = await mintToken(this.signer, {
          type: "poll",
          action: a.name,
          ttlSeconds: ttl,
          state: intent.state,
          ...binding,
        });
        await this.tokens.set(minted.record.id, minted.record, ttl);
        return {
          status: WIRE.status.pending,
          pollUrl:
            intent.pollUrl ?? `${baseUrl}${WIRE.path.poll}/${encodeURIComponent(minted.token)}`,
          retryAfter: Math.max(1, Math.round(intent.retryAfter ?? 5)),
          expiresAt: minted.expiresAt,
        };
      }
      case "error":
        return { status: WIRE.status.error, error: intent.error };
    }
  }

  private toWireAccept(actionName: string, entry: AcceptInput): Accept {
    if (!isValidKindName(entry.kind)) {
      throw new AXEError(
        WIRE.error.internal,
        `Action "${actionName}" offered kind "${entry.kind}", which is neither well-known nor a valid custom kind (x-<org>.<name>).`,
      );
    }
    const schema: JsonSchema = isZodSchema(entry.schema)
      ? toJsonSchema(entry.schema, "input")
      : entry.schema;
    const out: Accept = {
      kind: entry.kind,
      title: entry.title ?? entry.kind,
      description: entry.description,
      schema,
      sensitive: entry.sensitive,
    };
    if (entry.instructions !== undefined) out.instructions = entry.instructions;
    return out;
  }

  private async mintHandoff(
    intent: HandoffIntent,
    actionName: string,
    binding: { inputHash: string; onBehalfOf: string | null; tenant: string | null },
    login?: TokenRecord["login"],
  ): Promise<Handoff> {
    const ttl = intent.ttlSeconds ?? RESUME_TTL;
    const minted = await mintToken(this.signer, {
      type: "resume",
      action: actionName,
      ttlSeconds: ttl,
      state: intent.state,
      ...binding,
      ...(login ? { login } : {}),
    });
    let url = typeof intent.url === "function" ? intent.url(minted.record.id) : intent.url;
    if (intent.appendHandoffId !== false && typeof intent.url === "string") {
      const u = new URL(url);
      u.searchParams.set(WIRE.query.handoff, minted.record.id);
      url = u.toString();
    }
    const handoffWire: Handoff = {
      reason: intent.reason,
      instructions: intent.instructions,
      url,
      resumeToken: minted.token,
      expiresAt: minted.expiresAt,
      whatAgentShouldSayToUser: intent.whatAgentShouldSayToUser,
    };
    minted.record.handoff = handoffWire;
    if (intent.requireCompletion) minted.record.requireCompletion = true;
    await this.tokens.set(minted.record.id, minted.record, ttl);
    return handoffWire;
  }

  private async consume(record: TokenRecord): Promise<void> {
    record.consumedAt = Date.now();
    await this.tokens.set(
      record.id,
      record,
      Math.max(1, Math.ceil((record.expiresAt - Date.now()) / 1000)),
    );
  }

  private tenantBaseUrl(tenant: TenantInfo | null): string {
    return (tenant?.baseUrl ?? this.config.baseUrl).replace(/\/$/, "");
  }

  // -------------------------------------------------------------------------
  // Endpoints
  // -------------------------------------------------------------------------

  private async invokeEndpoint(
    request: Request,
    name: string,
    tenant: TenantInfo | null,
    adapter: AdapterContext,
  ): Promise<Response> {
    const startedAt = performance.now();
    const proto = this.protocolError(request);
    const a = this.actions.get(name);
    const read = await this.readBody(request);
    const context = this.sanitizeContext("body" in read ? read.body["context"] : undefined);
    const hookCtx = this.hook("action", name, request, context, tenant);
    if (proto) return this.runHooksAndFinish(hookCtx, proto, startedAt, WIRE.ladder.error, null);
    if (!a)
      return this.runHooksAndFinish(
        hookCtx,
        {
          status: WIRE.status.error,
          error: fail(
            WIRE.error.notFound,
            `Unknown action "${name}". The manifest at ${WIRE.path.manifest} lists the available actions.`,
          ).error,
        },
        startedAt,
        WIRE.ladder.error,
        null,
      );
    if ("error" in read)
      return this.runHooksAndFinish(hookCtx, read.error, startedAt, WIRE.ladder.error, null);
    const body = read.body;
    if (!("input" in body)) {
      return this.runHooksAndFinish(
        hookCtx,
        {
          status: WIRE.status.error,
          error: fail(
            WIRE.error.invalidInput,
            "The request envelope must have an `input` member (use {} for an action with no parameters).",
            { issues: [{ path: "/input", message: "is required", expected: "object" }] },
          ).error,
        },
        startedAt,
        WIRE.ladder.error,
        null,
      );
    }
    if (this.agentDenied(context, tenant)) {
      return this.runHooksAndFinish(
        hookCtx,
        {
          status: WIRE.status.error,
          error: fail(
            WIRE.error.forbidden,
            "This site's policies.agents does not permit your agent vendor.",
          ).error,
        },
        startedAt,
        WIRE.ladder.error,
        null,
      );
    }

    const outcome = await this.invokeAction(
      a,
      body["input"],
      context,
      request,
      tenant,
      adapter,
      body["idempotencyKey"],
      hookCtx,
    );
    return this.runHooksAndFinish(hookCtx, outcome.result, startedAt, outcome.ladder, outcome.kind);
  }

  /** The action pipeline, shared by the action endpoint and the login-handoff resume. */
  private async invokeAction(
    a: RegisteredAction,
    rawInput: unknown,
    context: RequestContext,
    request: Request,
    tenant: TenantInfo | null,
    adapter: AdapterContext,
    idempotencyKey: unknown,
    hookCtx: HookContext,
    presetIdentity?: Identity,
  ): Promise<{ result: Result; ladder: Ladder; kind: string | null }> {
    const def = a.definition;
    const err = (result: Result): { result: Result; ladder: Ladder; kind: string | null } => ({
      result,
      ladder: WIRE.ladder.error,
      kind: null,
    });

    // Auth
    let identity: Identity | null = presetIdentity ?? null;
    let siteKey: { id?: string; actions?: string[] } | null = null;
    if (!identity && def.auth !== WIRE.authMode.site)
      identity = await this.establishIdentity(request, adapter);
    if (def.auth === WIRE.authMode.site) {
      const key = this.bearer(request);
      if (!key)
        return err({
          status: WIRE.status.error,
          error: fail(
            WIRE.error.unauthorized,
            `Action "${a.name}" requires site authentication: send Authorization: Bearer <api-key>.`,
          ).error,
        });
      const verdict = await this.config.auth.verifySiteKey!(key, request);
      if (verdict === false)
        return err({
          status: WIRE.status.error,
          error: fail(WIRE.error.unauthorized, "The API key is not valid.").error,
        });
      if (typeof verdict === "object") siteKey = verdict;
      if (typeof verdict === "object" && verdict.actions && !verdict.actions.includes(a.name)) {
        return err({
          status: WIRE.status.error,
          error: fail(WIRE.error.forbidden, `This API key may not call "${a.name}".`).error,
        });
      }
      if (!identity) identity = await this.establishIdentity(request, adapter);
    }
    const inputParsed = a.spec.input.safeParse(rawInput);
    if (!inputParsed.success) {
      return err({
        status: WIRE.status.error,
        error: fail(
          WIRE.error.invalidInput,
          `Input does not match the schema of "${a.name}". Fix the listed paths and retry.`,
          { issues: zodIssuesToValidationIssues(inputParsed.error.issues) },
        ).error,
      });
    }
    const input = inputParsed.data as JsonValue;
    const inputHash = await hashJson(input);
    // Tokens and idempotency keys are scoped to the acting principal: the user, or the site key.
    const principal = identity?.onBehalfOf ?? (siteKey?.id ? `site:${siteKey.id}` : null);
    const binding = { inputHash, onBehalfOf: principal, tenant: tenant?.id ?? null };

    // Idempotency key presence is checked before any handoff so the agent learns about it immediately.
    let key: string | undefined;
    if (!def.readOnly) {
      if (idempotencyKey === undefined || idempotencyKey === null || idempotencyKey === "") {
        if (this.config.requireIdempotencyKey !== false) {
          return err({
            status: WIRE.status.error,
            error: fail(
              WIRE.error.invalidInput,
              `"${a.name}" changes state and requires an idempotencyKey (a UUID you generate per attempt) so retries are safe (spec [P-IDEM-1]).`,
              {
                issues: [
                  {
                    path: "/idempotencyKey",
                    message: "is required for mutating actions",
                    expected: "string",
                  },
                ],
              },
            ).error,
          });
        }
      } else if (typeof idempotencyKey !== "string" || idempotencyKey.length > 256) {
        return err({
          status: WIRE.status.error,
          error: fail(
            WIRE.error.invalidInput,
            "idempotencyKey must be a string of at most 256 characters.",
            {
              issues: [
                { path: "/idempotencyKey", message: "must be a string", expected: "string" },
              ],
            },
          ).error,
        });
      } else {
        key = idempotencyKey;
      }
    }

    if (def.auth === WIRE.authMode.user && !identity) {
      const loginUrl = tenant?.auth?.userLoginUrl ?? this.config.auth.userLoginUrl;
      if (!loginUrl)
        return err({
          status: WIRE.status.error,
          error: fail(
            WIRE.error.unauthorized,
            `Action "${a.name}" acts on behalf of a user; send the user's bearer token in Authorization.`,
          ).error,
        });
      const h = await this.mintHandoff(
        {
          [INTENT]: "handoff",
          reason: WIRE.reason.loginRequired,
          instructions: `Sign in to ${tenant?.name ?? this.config.name} and approve the request, then return to your assistant.`,
          url: loginUrl,
          whatAgentShouldSayToUser: `${tenant?.name ?? this.config.name} needs you to sign in before I can do this on your behalf. Sign in at the link and I'll continue from there.`,
          requireCompletion: true,
        },
        a.name,
        binding,
        key !== undefined ? { input, context, idempotencyKey: key } : { input, context },
      );
      return {
        result: { status: WIRE.status.needsHuman, handoff: h },
        ladder: WIRE.ladder.needsHuman,
        kind: null,
      };
    }

    const authedContext: RequestContext = identity
      ? { ...context, onBehalfOf: identity.onBehalfOf }
      : context;
    hookCtx.context = authedContext;

    // Idempotency replay
    let storageKey: string | undefined;
    if (key !== undefined) {
      storageKey = idempotencyStorageKey({
        tenant: binding.tenant,
        action: a.name,
        onBehalfOf: binding.onBehalfOf,
        key,
      });
      const prior = await this.idempotency.get(storageKey);
      if (prior) {
        if (prior.inputHash !== inputHash) {
          return err({
            status: WIRE.status.error,
            error: fail(
              WIRE.error.conflict,
              "This idempotencyKey was already used with different input. Use a new key for a new request (spec [P-IDEM-3]).",
            ).error,
          });
        }
        return {
          result: prior.result,
          ladder: ladderFor(prior.result),
          kind: kindFor(prior.result),
        };
      }
    }

    // onRequest hook may short-circuit.
    let intent: ResultIntent | undefined;
    try {
      const short = await this.config.onRequest?.(hookCtx);
      if (isIntent(short)) intent = short;
    } catch (e) {
      if (e instanceof AXEError) intent = e.intent;
      else throw e;
    }
    if (!intent) {
      intent = await this.runHandler(hookCtx, () =>
        a.spec.handler({
          input,
          context: authedContext,
          request,
          tenant,
          identity,
          siteKey,
          action: a.name,
          emit: this.emitterFor(a.name, tenant),
          ...helpers,
        }),
      );
    }
    const result = await this.materialize(intent, a, hookCtx, binding, this.tenantBaseUrl(tenant));
    if (storageKey && result.status !== WIRE.status.error) {
      await this.idempotency.set(
        storageKey,
        { inputHash, result, createdAt: Date.now() },
        this.config.idempotencyTtlSeconds ?? DEFAULT_IDEMPOTENCY_TTL_SECONDS,
      );
    }
    return { result, ladder: ladderFor(result), kind: kindFor(result) };
  }

  private async continueEndpoint(
    request: Request,
    tenant: TenantInfo | null,
    adapter: AdapterContext,
  ): Promise<Response> {
    const startedAt = performance.now();
    const proto = this.protocolError(request);
    const read = await this.readBody(request);
    const context = this.sanitizeContext("body" in read ? read.body["context"] : undefined);
    const hookCtx = this.hook("continue", "", request, context, tenant);
    const finish = (result: Result, kind: string | null = null) =>
      this.runHooksAndFinish(hookCtx, result, startedAt, WIRE.ladder.continued, kind);
    if (proto) return finish(proto);
    if ("error" in read) return finish(read.error);
    const { continuationToken, kind, payload } = read.body;
    if (
      typeof continuationToken !== "string" ||
      typeof kind !== "string" ||
      !("payload" in read.body)
    ) {
      return finish({
        status: WIRE.status.error,
        error: fail(WIRE.error.invalidInput, "Body must be { continuationToken, kind, payload }.")
          .error,
      });
    }
    const loaded = await loadToken(this.signer, this.tokens, continuationToken, "continuation");
    if (loaded.kind === "invalid")
      return finish({
        status: WIRE.status.error,
        error: fail(
          WIRE.error.notFound,
          "Unknown or expired continuation token. Call the action again to get a new one.",
        ).error,
      });
    if (loaded.kind === "consumed")
      return finish({
        status: WIRE.status.error,
        error: fail(WIRE.error.conflict, "This continuation token was already used.").error,
      });
    const record = loaded.record;
    hookCtx.action = record.action;
    const a = this.actions.get(record.action);
    if (!a)
      return finish({
        status: WIRE.status.error,
        error: fail(WIRE.error.notFound, `Action "${record.action}" is no longer available.`).error,
      });
    const identity = await this.establishIdentity(request, adapter);
    if (record.onBehalfOf && identity?.onBehalfOf !== record.onBehalfOf) {
      return finish({
        status: WIRE.status.error,
        error: fail(WIRE.error.notFound, "Unknown or expired continuation token.").error,
      });
    }
    const entry = record.accepts?.find((e) => e.kind === kind);
    if (!entry) {
      return finish(
        {
          status: WIRE.status.error,
          error: fail(
            WIRE.error.invalidInput,
            `Kind "${kind}" is not one of the accepted kinds for this requirement: ${(record.accepts ?? []).map((e) => e.kind).join(", ")}.`,
            {
              issues: [
                {
                  path: "/kind",
                  message: "not accepted",
                  expected: (record.accepts ?? []).map((e) => e.kind).join(" | "),
                },
              ],
            },
          ).error,
        },
        kind,
      );
    }
    const issues = validateJsonSchema(entry.schema, payload);
    if (issues.length === 0 && kind === WIRE.kind.documentBase64) {
      const content = (payload as { contentBase64?: unknown }).contentBase64;
      const decodedBytes =
        typeof content === "string" ? Math.floor((content.replace(/=+$/, "").length * 3) / 4) : 0;
      if (decodedBytes > MAX_BASE64_DOCUMENT_BYTES) {
        issues.push({
          path: "/contentBase64",
          message: `decoded size ${decodedBytes} bytes exceeds the ${MAX_BASE64_DOCUMENT_BYTES}-byte limit; use ${WIRE.kind.documentUrl} for larger files`,
          expected: `<= ${MAX_BASE64_DOCUMENT_BYTES} bytes`,
        });
      }
    }
    if (issues.length > 0) {
      return finish(
        {
          status: WIRE.status.error,
          error: fail(
            WIRE.error.invalidInput,
            `Payload does not match the schema for kind "${kind}". Fix the listed paths and retry with the same token.`,
            { issues: issues.map((i) => ({ ...i, path: `/payload${i.path}` })) },
          ).error,
        },
        kind,
      );
    }
    if (!a.spec.onContinue) {
      return finish(
        {
          status: WIRE.status.error,
          error: fail(
            WIRE.error.internal,
            `Action "${a.name}" offered requirements but defines no onContinue. The site has been notified.`,
          ).error,
        },
        kind,
      );
    }
    const authedContext: RequestContext = identity
      ? { ...context, onBehalfOf: identity.onBehalfOf }
      : context;
    hookCtx.context = authedContext;
    const intent = await this.runHandler(hookCtx, () =>
      a.spec.onContinue!({
        kind,
        payload: payload as JsonValue,
        state: record.state as JsonValue,
        context: authedContext,
        request,
        tenant,
        identity,
        siteKey: null,
        action: a.name,
        emit: this.emitterFor(a.name, tenant),
        ...helpers,
      }),
    );
    const result = await this.materialize(
      intent,
      a,
      hookCtx,
      { inputHash: record.inputHash, onBehalfOf: record.onBehalfOf, tenant: record.tenant },
      this.tenantBaseUrl(tenant),
    );
    if (result.status !== WIRE.status.error) await this.consume(record);
    return finish(result, kind);
  }

  private async resumeEndpoint(
    request: Request,
    tenant: TenantInfo | null,
    adapter: AdapterContext,
  ): Promise<Response> {
    const startedAt = performance.now();
    const proto = this.protocolError(request);
    const read = await this.readBody(request);
    const context = this.sanitizeContext("body" in read ? read.body["context"] : undefined);
    const hookCtx = this.hook("resume", "", request, context, tenant);
    const finish = (result: Result) =>
      this.runHooksAndFinish(hookCtx, result, startedAt, WIRE.ladder.resumed, null);
    if (proto) return finish(proto);
    if ("error" in read) return finish(read.error);
    const { resumeToken } = read.body;
    if (typeof resumeToken !== "string")
      return finish({
        status: WIRE.status.error,
        error: fail(WIRE.error.invalidInput, "Body must be { resumeToken }.").error,
      });
    const loaded = await loadToken(this.signer, this.tokens, resumeToken, "resume");
    if (loaded.kind === "invalid")
      return finish({
        status: WIRE.status.error,
        error: fail(WIRE.error.notFound, "Unknown or expired resume token.").error,
      });
    if (loaded.kind === "consumed")
      return finish({
        status: WIRE.status.error,
        error: fail(WIRE.error.conflict, "This resume token was already used.").error,
      });
    const record = loaded.record;
    hookCtx.action = record.action;
    const a = this.actions.get(record.action);
    if (!a)
      return finish({
        status: WIRE.status.error,
        error: fail(WIRE.error.notFound, `Action "${record.action}" is no longer available.`).error,
      });
    const identity = await this.establishIdentity(request, adapter);
    if (record.onBehalfOf && identity?.onBehalfOf !== record.onBehalfOf) {
      return finish({
        status: WIRE.status.error,
        error: fail(WIRE.error.notFound, "Unknown or expired resume token.").error,
      });
    }
    if (record.requireCompletion && !record.completion) {
      return finish({
        status: WIRE.status.error,
        error: fail(
          WIRE.error.conflict,
          "The human has not completed this step yet. Retry after they finish, or show them the handoff again.",
          { retryable: true, details: { handoffStatus: "open" } },
        ).error,
      });
    }
    if (record.login) {
      const who = record.completion?.onBehalfOf;
      if (!who)
        return finish({
          status: WIRE.status.error,
          error: fail(WIRE.error.conflict, "Sign-in has not completed yet.", {
            retryable: true,
            details: { handoffStatus: "open" },
          }).error,
        });
      const outcome = await this.invokeAction(
        a,
        record.login.input,
        record.login.context,
        request,
        tenant,
        adapter,
        record.login.idempotencyKey,
        hookCtx,
        { onBehalfOf: who },
      );
      if (outcome.result.status !== WIRE.status.error) await this.consume(record);
      return finish(outcome.result);
    }
    if (!a.spec.onResume) {
      return finish({
        status: WIRE.status.error,
        error: fail(
          WIRE.error.internal,
          `Action "${a.name}" hands off to humans but defines no onResume. The site has been notified.`,
        ).error,
      });
    }
    const authedContext: RequestContext = identity
      ? { ...context, onBehalfOf: identity.onBehalfOf }
      : context;
    hookCtx.context = authedContext;
    const intent = await this.runHandler(hookCtx, () =>
      a.spec.onResume!({
        state: record.state as JsonValue,
        completion: record.completion,
        context: authedContext,
        request,
        tenant,
        identity,
        siteKey: null,
        action: a.name,
        emit: this.emitterFor(a.name, tenant),
        ...helpers,
      }),
    );
    const result = await this.materialize(
      intent,
      a,
      hookCtx,
      { inputHash: record.inputHash, onBehalfOf: record.onBehalfOf, tenant: record.tenant },
      this.tenantBaseUrl(tenant),
    );
    if (result.status !== WIRE.status.error) await this.consume(record);
    return finish(result);
  }

  private async pollEndpoint(
    request: Request,
    token: string,
    tenant: TenantInfo | null,
    adapter: AdapterContext,
  ): Promise<Response> {
    const startedAt = performance.now();
    const context: RequestContext = {};
    const hookCtx = this.hook("poll", "", request, context, tenant);
    const finish = (result: Result) =>
      this.runHooksAndFinish(
        hookCtx,
        result,
        startedAt,
        result.status === WIRE.status.pending ? WIRE.ladder.pending : ladderFor(result),
        null,
      );
    const loaded = await loadToken(this.signer, this.tokens, token, "poll");
    if (loaded.kind === "invalid")
      return finish({
        status: WIRE.status.error,
        error: fail(WIRE.error.notFound, "Unknown or expired poll token.").error,
      });
    const record = loaded.record;
    hookCtx.action = record.action;
    if (record.terminal) return finish(record.terminal);
    const a = this.actions.get(record.action);
    if (!a?.spec.onPoll)
      return finish({
        status: WIRE.status.error,
        error: fail(WIRE.error.notFound, `Action "${record.action}" is no longer available.`).error,
      });
    const identity = await this.establishIdentity(request, adapter);
    if (record.onBehalfOf && identity?.onBehalfOf !== record.onBehalfOf) {
      return finish({
        status: WIRE.status.error,
        error: fail(WIRE.error.notFound, "Unknown or expired poll token.").error,
      });
    }
    const intent = await this.runHandler(hookCtx, () =>
      a.spec.onPoll!({
        state: record.state as JsonValue,
        context,
        request,
        tenant,
        identity,
        siteKey: null,
        action: a.name,
        emit: this.emitterFor(a.name, tenant),
        ...helpers,
      }),
    );
    let result: Result;
    if (intent[INTENT] === "pending") {
      result = {
        status: WIRE.status.pending,
        pollUrl: `${this.tenantBaseUrl(tenant)}${WIRE.path.poll}/${encodeURIComponent(token)}`,
        retryAfter: Math.max(1, Math.round(intent.retryAfter ?? 5)),
        expiresAt: new Date(record.expiresAt).toISOString(),
      };
    } else {
      result = await this.materialize(
        intent,
        a,
        hookCtx,
        { inputHash: record.inputHash, onBehalfOf: record.onBehalfOf, tenant: record.tenant },
        this.tenantBaseUrl(tenant),
      );
      record.terminal = result;
      record.consumedAt = Date.now();
      await this.tokens.set(
        record.id,
        record,
        this.config.idempotencyTtlSeconds ?? DEFAULT_IDEMPOTENCY_TTL_SECONDS,
      );
    }
    return finish(result);
  }
}

function ladderFor(result: Result): Ladder {
  switch (result.status) {
    case "ok":
      return WIRE.ladder.ok;
    case "needs_input":
      return WIRE.ladder.needsInput;
    case "needs_human":
      return WIRE.ladder.needsHuman;
    case "pending":
      return WIRE.ladder.pending;
    case "error":
      return WIRE.ladder.error;
  }
}

function kindFor(result: Result): string | null {
  return result.status === WIRE.status.needsInput ? (result.accepts[0]?.kind ?? null) : null;
}

function isLoopback(host: string): boolean {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host === "::1" ||
    host.endsWith(".localhost")
  );
}

/** Create an AXE server. See `docs/getting-started.md`. */
export function createAXE(config: AXEConfig): AXE {
  return new AXE(config);
}
