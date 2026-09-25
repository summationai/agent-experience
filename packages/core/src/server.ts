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
  Availability,
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
  Live,
  LiveState,
  Manifest,
  ManifestAuth,
  PlatformIndex,
  Policies,
  RequestContext,
  Result,
  ResultStatus,
  AXEActionEventInput,
  Revision,
} from "./types";
import type {
  ActionProvider,
  AvailabilityContext,
  RegisteredAction,
  TenantInfo,
  MaybePromise,
  ResultHelpers,
} from "./action";
import { ActionDefinitionError } from "./action";
import { validateAffordanceBinding } from "./display";
import { stripReserved } from "./display";
import type { AXEActionEvent, AXEEvent, ActionEventSink, EventAgent, EventSink } from "./events";
import { combineSinks, parseUserAgent } from "./events";
import type { AcceptInput } from "./kinds";
import { isValidKindName } from "./kinds";
import {
  DEFAULT_IDEMPOTENCY_TTL_SECONDS,
  DEFAULT_OPERATION_LEASE_SECONDS,
  MemoryIdempotencyStore,
  idempotencyStorageKey,
  isClaimStore,
  tokenOperationKey,
} from "./idempotency";
import type { IdempotencyStore } from "./idempotency";
import { parsePrincipal, principalOf } from "./principal";
import type { SiteKeyContext } from "./principal";
import { validateJsonSchema } from "./json-schema";
import type { HandoffIntent, ResultIntent } from "./results";
import {
  AXEError,
  INTENT,
  fail,
  handoff,
  isIntent,
  needsInput,
  ok,
  pending,
  unavailable,
} from "./results";
import { AGENT_DIRECTIVE_PATTERNS } from "./lint";
import { MemoryTokenStore, TokenSigner, hashJson, loadToken, mintToken, randomId } from "./tokens";
import { evaluateRequestPolicy, resolveRequestPolicy } from "./request-policy";
import type { RequestPolicyConfig, ResolvedRequestPolicy } from "./request-policy";
import type { TokenRecord, TokenStore } from "./tokens";
import { isZodSchema, toJsonSchema, zodIssuesToValidationIssues } from "./zod-json-schema";
import { WIRE } from "./vocabulary";

export type { TenantInfo, SiteKeyContext };

/** The identity an adapter or `authenticate` establishes for the acting user. */
export interface Identity {
  onBehalfOf: string;
  /** Anything the site wants handlers to see (roles, email). Not sent on the wire. */
  claims?: Record<string, JsonValue>;
}

/**
 * What a `verifySiteKey` function may return: `true`, `false`, or an object naming the key's
 * stable `id` and, optionally, an allowlist of actions. Without an `id` the runtime scopes the key
 * by a keyed hash of the key itself (see `SiteKeyContext`).
 */
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

/** Passed to the `revision` provider. */
export interface RevisionContext {
  /** The request being served; null when the manifest is described outside a request. */
  request: Request | null;
  tenant: TenantInfo | null;
  /**
   * The user the runtime established for this request, once it has: on an action call, a continue,
   * a resume, a poll, and `/axe/state`. Absent for the manifest and before authentication.
   */
  identity?: Identity | null;
  /** The verified site key, when the call is a `site` call or a follow-up of one ([P-TOK-7]). */
  siteKey?: SiteKeyContext | null;
}

/**
 * Returns the site's current revision: one opaque string or number for the whole site (or tenant)
 * that moves with every change an agent could observe, whoever made it. `surface.currentRev` fits.
 */
export type RevisionProvider = (ctx: RevisionContext) => MaybePromise<Revision>;

export interface AXEConfig {
  name: string;
  description: string;
  baseUrl: string;
  humanFallbackUrl?: string;
  /** Auth modes and their hooks. Omitted, the site is public: `{ modes: ["none"] }`. */
  auth?: AuthConfig;
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
  /**
   * How long an operation claim holds before a retry of the same operation may take it over, in
   * seconds. Default 60. Set it above your slowest handler: a retry that arrives after the lease
   * runs the handler again (docs/deploying.md, "Operations, claims, and crashes").
   */
  operationLeaseSeconds?: number;
  /** Reject mutating calls without `idempotencyKey`. Default true. */
  requireIdempotencyKey?: boolean;
  cors?: CorsConfig;
  /**
   * Content-type and origin rules for POSTs, applied before any body is read (spec [P-TRANS-1] to
   * [P-TRANS-4]). Default: JSON required on state-changing endpoints, and a POST carrying a
   * `Cookie` header must come from the origin of `baseUrl` or a trusted origin.
   */
  requestPolicy?: RequestPolicyConfig;
  /** Resolve the tenant for a request on multi-tenant platforms. Return `null` for unknown hosts. */
  tenant?: (request: Request) => MaybePromise<TenantInfo | null | undefined>;
  /** Serve a platform index at `/.well-known/axe-index.json`. */
  index?: IndexConfig;
  /** `Cache-Control` max-age for the manifest, in seconds. Default 300. */
  manifestCacheSeconds?: number;
  /**
   * Live state (spec §21). When set, every envelope carries `rev`, a request whose `expectedRev`
   * differs from the current revision is refused with `conflict` before anything runs, and
   * `/axe/state` is served.
   */
  revision?: RevisionProvider;
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

const helpers: ResultHelpers = { ok, needsInput, handoff, pending, fail, unavailable };

/** Two revisions are equal when they are the same value; a numeric string equals its number. */
function sameRevision(a: Revision, b: Revision): boolean {
  return a === b || String(a) === String(b);
}

function isRevision(v: unknown): v is Revision {
  return (typeof v === "string" && v.length > 0) || (typeof v === "number" && Number.isFinite(v));
}

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
  /** Dynamic sources of actions, consulted after `actions` (spec [S-AXE-1]). */
  private readonly providers: ActionProvider[] = [];
  /** Provider actions whose `auth` mode and affordance targets have been checked. */
  private readonly vetted = new WeakSet<RegisteredAction>();
  private readonly changeListeners = new Set<() => void>();
  /** The principal resolved for each request in flight, for the revision provider's context. */
  private readonly callers = new WeakMap<
    Request,
    { identity: Identity | null; siteKey: SiteKeyContext | null }
  >();
  private readonly signer: TokenSigner;
  private readonly tokens: TokenStore;
  private readonly idempotency: IdempotencyStore;
  private readonly emit: EventSink;
  private readonly emitAction: ActionEventSink;
  private finalized = false;
  private basePath: string;
  private readonly policy: ResolvedRequestPolicy;

  readonly config: AXEConfig & { auth: AuthConfig };

  constructor(input: AXEConfig) {
    // A site that says nothing about auth is public: every action runs anonymously.
    const config = { ...input, auth: input.auth ?? { modes: [WIRE.authMode.none] } };
    this.config = config;
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
    if (!Array.isArray(config.auth.modes) || config.auth.modes.length === 0) {
      throw new Error(
        'createAXE: `auth.modes` must list at least one of "none", "site", "user". Omit `auth` for a public site; the default is { modes: ["none"] }.',
      );
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
    this.policy = resolveRequestPolicy(config);
    let secret = config.secret;
    if (!secret) {
      secret = crypto.randomUUID() + crypto.randomUUID();
      console.warn(
        "[axe] No `secret` configured; using a random per-process secret. Continuation and resume tokens will not survive a restart. Set `secret` in production.",
      );
    }
    this.signer = new TokenSigner(secret);
    this.tokens = config.tokenStore ?? new MemoryTokenStore();
    if (config.idempotencyStore && !isClaimStore(config.idempotencyStore)) {
      throw new Error(
        'createAXE: `idempotencyStore` must implement get, claim, complete, and release. A get/set store cannot claim an operation atomically; see docs/deploying.md, "Migrating a store".',
      );
    }
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
    if (this.getAction(registered.name)) {
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
    this.notifyChanged();
    return this;
  }

  /**
   * Add a source of actions that changes while the server runs: a Surface bridge, a registry the
   * application rebuilds as its page changes. The provider is consulted after the actions added
   * with `register()` whenever actions are enumerated or looked up by name, so the manifest,
   * `/axe/state`, and the derived MCP tools reflect the current set on every request. Names must
   * still be unique across `register()` and every provider (spec [P-ACT-2]); a collision is an
   * `ActionDefinitionError` when the set is next enumerated.
   */
  addProvider(provider: ActionProvider): this {
    this.providers.push(provider);
    provider.onChange?.(() => this.notifyChanged());
    this.notifyChanged();
    return this;
  }

  /** Called when the set of actions changes: after `register()`, `addProvider()`, and when a provider reports a change. */
  onActionsChanged(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => void this.changeListeners.delete(listener);
  }

  private notifyChanged(): void {
    for (const fn of this.changeListeners) {
      try {
        fn();
      } catch (e) {
        console.error("[axe] onActionsChanged listener failed", e);
      }
    }
  }

  /** Every action's wire definition: registered ones first, then each provider's, in order. */
  get definitions(): ActionDefinition[] {
    return this.allActions().map((a) => a.definition);
  }

  /** Look up one action by name, registered or provided. */
  getAction(name: string): RegisteredAction | undefined {
    const own = this.actions.get(name);
    if (own) return own;
    for (const p of this.providers) {
      const a = p.get ? p.get(name) : p.actions().find((x) => x.name === name);
      if (a) {
        this.vet(a);
        return a;
      }
    }
    return undefined;
  }

  /** The current set: registered actions in registration order, then each provider's actions. */
  private allActions(): RegisteredAction[] {
    if (this.providers.length === 0) return [...this.actions.values()];
    const out = [...this.actions.values()];
    const seen = new Map<string, RegisteredAction>(this.actions);
    for (const p of this.providers) {
      for (const a of p.actions()) {
        const prior = seen.get(a.name);
        if (prior && prior !== a) {
          throw new ActionDefinitionError(
            a.name,
            "is provided more than once, or collides with a registered action. Action names must be unique (spec [P-ACT-2]).",
          );
        }
        if (prior) continue;
        this.vet(a);
        seen.set(a.name, a);
        out.push(a);
      }
    }
    return out;
  }

  /** Registration-time checks for a provided action, once per action object. */
  private vet(a: RegisteredAction): void {
    if (this.vetted.has(a)) return;
    if (!this.config.auth.modes.includes(a.definition.auth)) {
      throw new ActionDefinitionError(
        a.name,
        `auth "${a.definition.auth}" is not in manifest auth.modes [${this.config.auth.modes.join(", ")}] (spec [P-AUTH-1]).`,
      );
    }
    for (const [i, aff] of (a.definition.affordances ?? []).entries()) {
      const target = this.actions.get(aff.action);
      if (!target)
        throw new ActionDefinitionError(
          a.name,
          `affordance targets "${aff.action}", which is not a registered action. Provided actions may only point at actions added with register() (spec [P-AFF-1]).`,
        );
      validateAffordanceBinding(a.name, i, aff, target.definition.input);
    }
    this.vetted.add(a);
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
        !this.getAction(a.definition.deprecated.replacedBy)
      ) {
        throw new ActionDefinitionError(
          a.name,
          `deprecated.replacedBy "${a.definition.deprecated.replacedBy}" is not a registered action.`,
        );
      }
    }
    for (const flow of this.config.flows ?? []) {
      for (const step of flow.steps) {
        if (!this.getAction(step))
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
      live: this.hasLive()
        ? ({ url: `${this.tenantBaseUrl(t)}${WIRE.path.state}` } as Live)
        : undefined,
    }) as Manifest;
  }

  /** Whether the site publishes live state: a `revision` provider or any action with `availability`. */
  hasLive(): boolean {
    if (this.config.revision) return true;
    for (const a of this.allActions()) if (a.spec.availability) return true;
    return false;
  }

  /**
   * The manifest as the HTTP endpoint serves it: `describe()` plus `live.rev` and each declaring
   * action's `availability`, computed for an anonymous caller (the manifest is cacheable and shared).
   * Per-caller availability is served by `/axe/state`.
   */
  async describeLive(
    tenant?: TenantInfo | null,
    request: Request | null = null,
  ): Promise<Manifest> {
    const m = this.describe(tenant);
    if (!this.hasLive()) return m;
    const t = tenant ?? null;
    const rev = await this.currentRevision(request, t);
    if (rev !== undefined) m.live = { ...m.live, rev };
    const actions: ActionDefinition[] = [];
    for (const a of this.allActions()) {
      if (!a.spec.availability) {
        actions.push(a.definition);
        continue;
      }
      const availability = await this.availabilityOf(a, {
        action: a.name,
        identity: null,
        tenant: t,
        request,
      });
      actions.push(availability ? { ...a.definition, availability } : a.definition);
    }
    m.actions = actions;
    return m;
  }

  /** The document served at `/axe/state`, for one caller. */
  async liveState(
    identity: Identity | null,
    tenant: TenantInfo | null,
    request: Request | null = null,
  ): Promise<LiveState> {
    const state: LiveState = { actions: {} };
    const rev = await this.currentRevision(request, tenant);
    if (rev !== undefined) state.rev = rev;
    for (const a of this.allActions()) {
      let siteKey: SiteKeyContext | null = null;
      if (a.spec.availability && a.definition.auth === WIRE.authMode.site && request) {
        const v = await this.verifySite(request, a.name);
        if (v.kind === "ok") siteKey = v.siteKey;
      }
      state.actions[a.name] = a.spec.availability
        ? ((await this.availabilityOf(a, {
            action: a.name,
            identity,
            tenant,
            request,
            siteKey,
          })) ?? {
            available: false,
            reason: "unavailable",
          })
        : { available: true };
    }
    return state;
  }

  /** The current revision from the provider, or undefined when there is none or it failed (reported to `onError`). */
  private async currentRevision(
    request: Request | null,
    tenant: TenantInfo | null,
  ): Promise<Revision | undefined> {
    if (!this.config.revision) return undefined;
    try {
      const caller = request ? this.callers.get(request) : undefined;
      const rev = await this.config.revision({ request, tenant, ...(caller ?? {}) });
      if (isRevision(rev)) return rev;
      throw new Error(
        `revision() returned ${JSON.stringify(rev)}; a revision is a non-empty string or a finite number.`,
      );
    } catch (e) {
      try {
        await this.config.onError?.(
          {
            endpoint: "action",
            action: "",
            request: request ?? new Request(this.config.baseUrl),
            context: {},
            tenant,
          },
          e,
        );
      } catch (hookErr) {
        console.error("[axe] onError hook failed", hookErr);
      }
      return undefined;
    }
  }

  /**
   * Run an action's `availability` hook and normalize it to the wire shape. Agent-read text in it is
   * held to [P-HON-1]; a violation is reported to `onError` and the availability is withheld (undefined).
   */
  private async availabilityOf(
    a: RegisteredAction,
    ctx: AvailabilityContext,
  ): Promise<Availability | undefined> {
    if (!a.spec.availability) return undefined;
    const hookCtx: HookContext = {
      endpoint: "action",
      action: a.name,
      request: ctx.request ?? new Request(this.config.baseUrl),
      context: {},
      tenant: ctx.tenant,
    };
    try {
      const raw = await a.spec.availability(ctx);
      if (raw.available) return { available: true };
      if (!raw.reason?.trim())
        throw new Error(
          `Action "${a.name}" reported available: false without a reason (spec [P-LIVE-5]).`,
        );
      const out: Availability = { available: false, reason: raw.reason };
      if (raw.requires?.length)
        out.requires = raw.requires.map((e) => this.toWireAccept(a.name, e));
      if (raw.handoff) out.handoff = { ...raw.handoff };
      const texts = [
        out.reason,
        ...(out.requires ?? []).flatMap((r) => [r.title, r.description, r.instructions ?? ""]),
        out.handoff?.instructions ?? "",
        out.handoff?.whatAgentShouldSayToUser ?? "",
      ];
      for (const t of texts)
        for (const re of AGENT_DIRECTIVE_PATTERNS) {
          const m = re.exec(t);
          if (m)
            throw new Error(
              `Action "${a.name}" availability text contains an instruction aimed at the agent ("${m[0]}") (spec [P-HON-1]).`,
            );
        }
      return out;
    } catch (e) {
      try {
        await this.config.onError?.(hookCtx, e);
      } catch (hookErr) {
        console.error("[axe] onError hook failed", hookErr);
      }
      return undefined;
    }
  }

  /**
   * The stale check (spec [P-LIVE-3]): when the site has a revision and the request carried
   * `expectedRev`, refuse with `conflict` unless they match. Returns undefined when the call may proceed.
   */
  private async staleCheck(
    expectedRev: Revision | undefined,
    request: Request,
    tenant: TenantInfo | null,
  ): Promise<Result | undefined> {
    if (expectedRev === undefined || !this.config.revision) return undefined;
    const current = await this.currentRevision(request, tenant);
    if (current === undefined)
      return {
        status: WIRE.status.error,
        error: fail(
          WIRE.error.internal,
          "The site could not determine its current revision. The site has been notified.",
          { retryable: true },
        ).error,
      };
    if (sameRevision(expectedRev, current)) return undefined;
    return {
      status: WIRE.status.error,
      error: fail(
        WIRE.error.conflict,
        `The site changed since you observed it (you saw revision ${String(expectedRev)}, it is now ${String(current)}). Nothing was applied; read the current state and decide again.`,
        { retryable: true, details: { expectedRev, currentRev: current } },
      ).error,
      rev: current,
    };
  }

  /** A `(Request) => Promise<Response>` for the whole protocol surface. Adapters wrap this. */
  fetchHandler(): (request: Request, adapter?: AdapterContext) => Promise<Response> {
    return (request, adapter) => this.handle(request, adapter);
  }

  /**
   * Record that the human finished a handoff. Call this from the page at the handoff
   * `url` (read the `axe_handoff` query parameter). Returns false, and records nothing, when the id
   * is unknown or expired, the handoff was minted for another tenant than `tenant`, the resume
   * token was already used, `onBehalfOf` differs from the user the handoff is bound to, or a login
   * handoff was already completed by a different user ([P-TOK-6]).
   */
  async completeHandoff(
    handoffId: string,
    completion: { onBehalfOf?: string; data?: JsonValue; tenant?: string | null } = {},
  ): Promise<boolean> {
    const record = await this.tokens.get(handoffId);
    if (!record || record.type !== "resume" || record.expiresAt <= Date.now()) return false;
    if ((record.tenant ?? null) !== (completion.tenant ?? null)) return false;
    if (await this.idempotency.get(tokenOperationKey("resume", record.tenant, record.id)))
      return false;
    if (record.login) {
      const prior = record.completion?.onBehalfOf;
      if (prior !== undefined && prior !== completion.onBehalfOf) return false;
    } else {
      const bound = parsePrincipal(record.principal).user;
      if (bound !== null && completion.onBehalfOf !== undefined && completion.onBehalfOf !== bound)
        return false;
    }
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

    // Browser-shaped writes are refused before a body, identity, or token is looked at ([P-TRANS-1..4]).
    const refused = evaluateRequestPolicy(request, this.policy, {
      path,
      siteUrls: [this.config.baseUrl, tenant?.baseUrl],
      isReadOnly: (name) => this.getAction(name)?.definition.readOnly === true,
    });
    if (refused) return this.respond(request, tenant, refused, undefined);

    if (method === "GET" && (path === WIRE.path.manifest || path === WIRE.path.manifestAlias)) {
      const manifest = await this.describeLive(tenant, request);
      // A strong validator over the rendered document, so agents can revalidate cheaply ([P-DISC-10]).
      const etag = `"${(await hashJson(manifest)).slice(0, 32)}"`;
      const caching = {
        "Cache-Control": `public, max-age=${this.config.manifestCacheSeconds ?? 300}`,
        ETag: etag,
      };
      const ifNoneMatch = request.headers.get("If-None-Match");
      if (
        ifNoneMatch &&
        ifNoneMatch.split(",").some((t) => t.trim().replace(/^W\//, "") === etag)
      ) {
        const h = this.headers(request, caching);
        h.delete(WIRE.header.contentType);
        return new Response(null, { status: 304, headers: h });
      }
      return this.json(request, manifest, 200, caching);
    }
    if (path === WIRE.path.state && this.hasLive()) {
      if (method !== "GET") return this.methodNotAllowed(request, "GET, OPTIONS");
      const identity = await this.establishIdentity(request, adapter);
      this.callers.set(request, { identity, siteKey: null });
      const state = await this.liveState(identity, tenant, request);
      return this.json(request, state, 200, {
        "Cache-Control": "no-store",
        Vary: WIRE.header.authorization,
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
        const a = this.getAction(name);
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
      const ra = result.error.details?.["retryAfter"];
      if (result.error.code === WIRE.error.rateLimited) {
        extra[WIRE.header.retryAfter] = String(typeof ra === "number" ? ra : 60);
      } else if (typeof ra === "number") {
        // An operation in progress ([P-OP-2]) says when to retry, like a rate limit does.
        extra[WIRE.header.retryAfter] = String(ra);
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
    // Every envelope carries the site's revision when it has one ([P-LIVE-2]). A replayed
    // envelope keeps the revision its change produced.
    if (this.config.revision && result.rev === undefined) {
      const rev = await this.currentRevision(hookCtx.request, hookCtx.tenant);
      if (rev !== undefined) result.rev = rev;
    }
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
    binding: { inputHash: string; principal: string | null; tenant: string | null },
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
    binding: { inputHash: string; principal: string | null; tenant: string | null },
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

  /**
   * Claim one operation ([P-OP-1]): `run` when this request holds the claim and must settle it,
   * `replay` with the stored envelope for the same operation, `conflict` when the key was used for
   * a different one, and `busy` while another request holds the claim (answered with a retryable
   * `conflict`, or `pending` on a poll).
   */
  private async claimOperation(
    key: string,
    fingerprint: string,
    reuseMessage: string,
  ): Promise<
    | { kind: "run"; owner: string; fingerprint: string; operationId: string }
    | { kind: "replay" | "conflict"; result: Result }
    | { kind: "busy"; retryAfter: number; result: Result }
  > {
    const owner = randomId();
    const leaseSeconds = this.config.operationLeaseSeconds ?? DEFAULT_OPERATION_LEASE_SECONDS;
    const got = await this.idempotency.claim(key, {
      fingerprint,
      owner,
      leaseSeconds,
      ttlSeconds: this.config.idempotencyTtlSeconds ?? DEFAULT_IDEMPOTENCY_TTL_SECONDS,
    });
    const conflict = (): Result => ({
      status: WIRE.status.error,
      error: fail(WIRE.error.conflict, reuseMessage).error,
    });
    if (got.outcome === "acquired")
      return { kind: "run", owner, fingerprint, operationId: await hashJson(key) };
    if (got.outcome === "completed")
      return got.record.fingerprint === fingerprint
        ? { kind: "replay", result: got.record.result }
        : { kind: "conflict", result: conflict() };
    if (got.fingerprint !== fingerprint) return { kind: "conflict", result: conflict() };
    const retryAfter = Math.min(
      5,
      Math.max(1, Math.ceil((got.leaseExpiresAt - Date.now()) / 1000)),
    );
    return {
      kind: "busy",
      retryAfter,
      result: {
        status: WIRE.status.error,
        error: fail(
          WIRE.error.conflict,
          "The same request is still being processed. Retry after the delay to receive its result.",
          { retryable: true, details: { operationStatus: "in_progress", retryAfter } },
        ).error,
      },
    };
  }

  /**
   * Settle a claim this request holds ([P-OP-3]): store a non-error result for replay, and release
   * the claim on an `error` so the operation may be retried. `storeErrors` keeps a terminal error
   * (a poll's). A lost lease is reported to `onError`; the result still goes to this caller.
   */
  private async settleOperation(
    hookCtx: HookContext,
    key: string,
    claim: { owner: string; fingerprint: string },
    result: Result,
    storeErrors = false,
  ): Promise<void> {
    if (result.status === WIRE.status.error && !storeErrors) {
      await this.idempotency.release(key, claim.owner);
      return;
    }
    const stored = await this.idempotency.complete(
      key,
      claim.owner,
      { fingerprint: claim.fingerprint, result, createdAt: Date.now() },
      this.config.idempotencyTtlSeconds ?? DEFAULT_IDEMPOTENCY_TTL_SECONDS,
    );
    if (!stored) {
      try {
        await this.config.onError?.(
          hookCtx,
          new Error(
            `The operation claim for "${hookCtx.action}" expired before the result was stored, and another request took it over. Raise operationLeaseSeconds above the handler's running time.`,
          ),
        );
      } catch (e) {
        console.error("[axe] onError hook failed", e);
      }
    }
  }

  /**
   * Verify a site key for `action` ([P-AUTH-2], [P-TOK-7]): `missing` without a bearer key or a
   * `verifySiteKey`, `invalid` when it returns false, `forbidden` when its allowlist leaves the
   * action out, otherwise the key's principal id.
   */
  private async verifySite(
    request: Request,
    action: string,
  ): Promise<
    { kind: "missing" | "invalid" | "forbidden" } | { kind: "ok"; siteKey: SiteKeyContext }
  > {
    const verify = this.config.auth.verifySiteKey;
    const key = this.bearer(request);
    if (!verify || !key) return { kind: "missing" };
    const verdict = await verify(key, request);
    if (!verdict) return { kind: "invalid" };
    const described = typeof verdict === "object" ? verdict : {};
    if (described.actions && !described.actions.includes(action)) return { kind: "forbidden" };
    const siteKey: SiteKeyContext = described.id
      ? { id: described.id }
      : { id: `key-${await this.signer.keyedHash("axe-site-key", key)}`, derived: true };
    if (described.actions) siteKey.actions = described.actions;
    return { kind: "ok", siteKey };
  }

  /**
   * The one authorization check for a token's follow-up ([P-TOK-6]): the request must resolve to
   * exactly the principal the token was minted for: the same site key (verified again, so a revoked
   * or narrowed key stops working) and the same user, or none. The tenant was checked by
   * `loadToken`. Undefined means refuse with the same `not_found` as an unknown token.
   */
  private async authorizeToken(
    record: TokenRecord,
    request: Request,
    adapter: AdapterContext,
  ): Promise<{ identity: Identity | null; siteKey: SiteKeyContext | null } | undefined> {
    const want = parsePrincipal(record.principal);
    let siteKey: SiteKeyContext | null = null;
    if (want.site !== null) {
      const v = await this.verifySite(request, record.action);
      if (v.kind !== "ok" || v.siteKey.id !== want.site) return undefined;
      siteKey = v.siteKey;
    }
    const identity = await this.establishIdentity(request, adapter);
    if ((identity?.onBehalfOf ?? null) !== want.user) return undefined;
    this.callers.set(request, { identity, siteKey });
    return { identity, siteKey };
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
    const a = this.getAction(name);
    const read = await this.readBody(request);
    const context = this.sanitizeContext("body" in read ? read.body["context"] : undefined);
    const hookCtx = this.hook("action", name, request, context, tenant);
    if (proto) return this.runHooksAndFinish(hookCtx, proto, startedAt, WIRE.ladder.error, null);
    if (!a) {
      // An action that is gone may be gone because its own last invocation removed it (a Surface
      // row that leaves the board when drafted). A retry of that attempt is the same attempt
      // ([P-IDEM-2]): answer it from the idempotency store before saying the name is unknown.
      const replay =
        "body" in read
          ? await this.replayForUnknown(name, read.body, request, adapter, tenant)
          : undefined;
      if (replay)
        return this.runHooksAndFinish(
          hookCtx,
          replay,
          startedAt,
          ladderFor(replay),
          kindFor(replay),
        );
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
    }
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

    const expectedRev = this.readExpectedRev(body);
    if (expectedRev === false)
      return this.runHooksAndFinish(hookCtx, badExpectedRev(), startedAt, WIRE.ladder.error, null);

    const outcome = await this.invokeAction(
      a,
      body["input"],
      context,
      request,
      tenant,
      adapter,
      body["idempotencyKey"],
      hookCtx,
      undefined,
      expectedRev,
    );
    return this.runHooksAndFinish(hookCtx, outcome.result, startedAt, outcome.ladder, outcome.kind);
  }

  /**
   * The stored envelope for a retried `idempotencyKey` whose action no longer exists. The principal
   * is resolved as for any call ([P-TOK-7]): the user `authenticate` or the adapter establishes,
   * with the site key when one verifies (its allowlist, when it has one, must still name the
   * action). Both the combined and the user-only scope are looked up, since the definition that
   * said whether the action was `site` is gone. Nothing is claimed.
   */
  private async replayForUnknown(
    name: string,
    body: Record<string, unknown>,
    request: Request,
    adapter: AdapterContext,
    tenant: TenantInfo | null,
  ): Promise<Result | undefined> {
    const key = body["idempotencyKey"];
    if (typeof key !== "string" || key.length === 0 || key.length > 256 || !("input" in body))
      return undefined;
    const identity = await this.establishIdentity(request, adapter);
    const site = await this.verifySite(request, name);
    const principals = [
      ...(site.kind === "ok" ? [principalOf(identity?.onBehalfOf, site.siteKey.id)] : []),
      principalOf(identity?.onBehalfOf, null),
    ];
    const fingerprint = await hashJson(body["input"] as JsonValue);
    for (const principal of principals) {
      const prior = await this.idempotency.get(
        idempotencyStorageKey({ tenant: tenant?.id ?? null, action: name, principal, key }),
      );
      if (prior) return prior.fingerprint === fingerprint ? prior.result : undefined;
    }
    return undefined;
  }

  /** `expectedRev` from a request body: a revision, undefined when absent, or false when malformed. */
  private readExpectedRev(body: Record<string, unknown>): Revision | undefined | false {
    if (
      !("expectedRev" in body) ||
      body["expectedRev"] === undefined ||
      body["expectedRev"] === null
    )
      return undefined;
    return isRevision(body["expectedRev"]) ? body["expectedRev"] : false;
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
    expectedRev?: Revision,
  ): Promise<{ result: Result; ladder: Ladder; kind: string | null }> {
    const def = a.definition;
    const err = (result: Result): { result: Result; ladder: Ladder; kind: string | null } => ({
      result,
      ladder: WIRE.ladder.error,
      kind: null,
    });

    // Auth: the site key first for a `site` action, then the user ([P-TOK-7]).
    let identity: Identity | null = presetIdentity ?? null;
    let siteKey: SiteKeyContext | null = null;
    if (def.auth === WIRE.authMode.site) {
      const v = await this.verifySite(request, a.name);
      if (v.kind === "missing")
        return err({
          status: WIRE.status.error,
          error: fail(
            WIRE.error.unauthorized,
            `Action "${a.name}" requires site authentication: send Authorization: Bearer <api-key>.`,
          ).error,
        });
      if (v.kind === "invalid")
        return err({
          status: WIRE.status.error,
          error: fail(WIRE.error.unauthorized, "The API key is not valid.").error,
        });
      if (v.kind === "forbidden")
        return err({
          status: WIRE.status.error,
          error: fail(WIRE.error.forbidden, `This API key may not call "${a.name}".`).error,
        });
      if (v.kind === "ok") siteKey = v.siteKey;
    }
    if (!identity) identity = await this.establishIdentity(request, adapter);
    this.callers.set(request, { identity, siteKey });
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
    // Tokens, idempotency keys, and operation claims are scoped to the acting principal: the site
    // key, the user, or both ([P-TOK-6], [P-TOK-7]).
    const principal = principalOf(identity?.onBehalfOf, siteKey?.id);
    const binding = { inputHash, principal, tenant: tenant?.id ?? null };

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
      // A stale observation is refused before a human is asked to sign in ([P-LIVE-3]).
      const stale = await this.staleCheck(expectedRev, request, tenant);
      if (stale) return err(stale);
      const login: NonNullable<TokenRecord["login"]> = { input, context };
      if (key !== undefined) login.idempotencyKey = key;
      if (expectedRev !== undefined) login.expectedRev = expectedRev;
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
        login,
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

    // Claim the operation ([P-IDEM-2], [P-OP-1]): exactly one request with this key runs; a retry
    // is answered from the stored envelope, or told to wait while the first is still running.
    let storageKey: string | undefined;
    let claim: { owner: string; fingerprint: string; operationId: string } | undefined;
    if (key !== undefined) {
      storageKey = idempotencyStorageKey({
        tenant: binding.tenant,
        action: a.name,
        principal: binding.principal,
        key,
      });
      const c = await this.claimOperation(
        storageKey,
        inputHash,
        "This idempotencyKey was already used with different input. Use a new key for a new request (spec [P-IDEM-3]).",
      );
      if (c.kind === "replay")
        return { result: c.result, ladder: ladderFor(c.result), kind: kindFor(c.result) };
      if (c.kind !== "run") return err(c.result);
      claim = c;
    }
    const refuse = async (result: Result) => {
      if (claim && storageKey) await this.idempotency.release(storageKey, claim.owner);
      return err(result);
    };

    // The state the agent saw: refused before the handler runs, after the replay lookup so a
    // retried request is answered from the stored envelope ([P-LIVE-3], [P-LIVE-4]). A stale
    // request releases its claim, so the key may be retried once the agent has re-read the state.
    const stale = await this.staleCheck(expectedRev, request, tenant);
    if (stale) return refuse(stale);
    const availability =
      (await this.availabilityOf(a, { action: a.name, identity, tenant, request, siteKey })) ??
      null;

    // onRequest hook may short-circuit.
    let intent: ResultIntent | undefined;
    try {
      const short = await this.config.onRequest?.(hookCtx);
      if (isIntent(short)) intent = short;
    } catch (e) {
      if (e instanceof AXEError) intent = e.intent;
      else {
        if (claim && storageKey) await this.idempotency.release(storageKey, claim.owner);
        throw e;
      }
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
          ...(claim ? { operationId: claim.operationId } : {}),
          emit: this.emitterFor(a.name, tenant),
          availability,
          ...(expectedRev !== undefined ? { expectedRev } : {}),
          ...helpers,
        }),
      );
    }
    let result: Result;
    try {
      result = await this.materialize(intent, a, hookCtx, binding, this.tenantBaseUrl(tenant));
    } catch (e) {
      if (claim && storageKey) await this.idempotency.release(storageKey, claim.owner);
      throw e;
    }
    if (claim && storageKey) await this.settleOperation(hookCtx, storageKey, claim, result);
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
    const expectedRev = this.readExpectedRev(read.body);
    if (expectedRev === false) return finish(badExpectedRev());
    // Signature, binding, tenant, and principal are checked before anything about the token is
    // revealed; every failure is the same not_found ([P-TOK-3], [P-TOK-6]).
    const loaded = await loadToken(
      this.signer,
      this.tokens,
      continuationToken,
      "continuation",
      tenant?.id ?? null,
    );
    if (loaded.kind === "invalid") return finish(unknownToken("continuation"));
    const record = loaded.record;
    const auth = await this.authorizeToken(record, request, adapter);
    if (!auth) return finish(unknownToken("continuation"));
    const { identity, siteKey } = auth;
    hookCtx.action = record.action;
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
    // One use of the token ([P-REQ-9], [P-OP-1]): the same kind and payload again is answered from
    // the stored envelope; anything else after a success is conflict.
    const opKey = tokenOperationKey("continue", record.tenant, record.id);
    const claim = await this.claimOperation(
      opKey,
      await hashJson({ kind, payload: payload as JsonValue }),
      "This continuation token was already used with a different kind or payload.",
    );
    if (claim.kind !== "run") return finish(claim.result, kind);
    const a = this.getAction(record.action);
    const refuse = async (result: Result) => {
      await this.idempotency.release(opKey, claim.owner);
      return finish(result, kind);
    };
    if (!a)
      return refuse({
        status: WIRE.status.error,
        error: fail(WIRE.error.notFound, `Action "${record.action}" is no longer available.`).error,
      });
    if (!a.spec.onContinue) {
      return refuse({
        status: WIRE.status.error,
        error: fail(
          WIRE.error.internal,
          `Action "${a.name}" offered requirements but defines no onContinue. The site has been notified.`,
        ).error,
      });
    }
    const authedContext: RequestContext = identity
      ? { ...context, onBehalfOf: identity.onBehalfOf }
      : context;
    hookCtx.context = authedContext;
    // A stale observation is refused before the hook runs and does not consume the token.
    const stale = await this.staleCheck(expectedRev, request, tenant);
    if (stale) return refuse(stale);
    const intent = await this.runHandler(hookCtx, () =>
      a.spec.onContinue!({
        kind,
        payload: payload as JsonValue,
        state: record.state as JsonValue,
        context: authedContext,
        request,
        tenant,
        identity,
        siteKey,
        action: a.name,
        operationId: claim.operationId,
        emit: this.emitterFor(a.name, tenant),
        availability: null,
        ...(expectedRev !== undefined ? { expectedRev } : {}),
        ...helpers,
      }),
    );
    const result = await this.materialize(
      intent,
      a,
      hookCtx,
      { inputHash: record.inputHash, principal: record.principal, tenant: record.tenant },
      this.tenantBaseUrl(tenant),
    );
    await this.settleOperation(hookCtx, opKey, claim, result);
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
    const expectedRev = this.readExpectedRev(read.body);
    if (expectedRev === false) return finish(badExpectedRev());
    const loaded = await loadToken(
      this.signer,
      this.tokens,
      resumeToken,
      "resume",
      tenant?.id ?? null,
    );
    if (loaded.kind === "invalid") return finish(unknownToken("resume"));
    const record = loaded.record;
    // A login handoff is the one identity transition ([P-AUTH-4], [P-TOK-6]): minted anonymously,
    // it runs as the user the site recorded with completeHandoff. The caller must be anonymous or
    // that same user. Every other resume token requires the principal it was minted for.
    let auth: { identity: Identity | null; siteKey: SiteKeyContext | null } | undefined;
    if (record.login) {
      const caller = await this.establishIdentity(request, adapter);
      const who = record.completion?.onBehalfOf;
      auth =
        !caller || (who !== undefined && caller.onBehalfOf === who)
          ? { identity: caller, siteKey: null }
          : undefined;
      if (auth) this.callers.set(request, auth);
    } else {
      auth = await this.authorizeToken(record, request, adapter);
    }
    if (!auth) return finish(unknownToken("resume"));
    const { identity, siteKey } = auth;
    hookCtx.action = record.action;
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
    if (record.login && !record.completion?.onBehalfOf)
      return finish({
        status: WIRE.status.error,
        error: fail(WIRE.error.conflict, "Sign-in has not completed yet.", {
          retryable: true,
          details: { handoffStatus: "open" },
        }).error,
      });
    // One use of the token ([P-HAND-6], [P-OP-1]): a repeat is answered from the stored envelope.
    const opKey = tokenOperationKey("resume", record.tenant, record.id);
    const claim = await this.claimOperation(
      opKey,
      await hashJson({}),
      "This resume token was already used.",
    );
    if (claim.kind !== "run") return finish(claim.result);
    const refuse = async (result: Result) => {
      await this.idempotency.release(opKey, claim.owner);
      return finish(result);
    };
    const a = this.getAction(record.action);
    if (!a)
      return refuse({
        status: WIRE.status.error,
        error: fail(WIRE.error.notFound, `Action "${record.action}" is no longer available.`).error,
      });
    if (record.login) {
      const who = record.completion!.onBehalfOf!;
      // The action has not run yet, so the revision the agent observed on the original call still
      // stands unless the resume presents a fresher one.
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
        expectedRev ?? record.login.expectedRev,
      );
      await this.settleOperation(hookCtx, opKey, claim, outcome.result);
      return finish(outcome.result);
    }
    if (!a.spec.onResume) {
      return refuse({
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
    const stale = await this.staleCheck(expectedRev, request, tenant);
    if (stale) return refuse(stale);
    const intent = await this.runHandler(hookCtx, () =>
      a.spec.onResume!({
        state: record.state as JsonValue,
        completion: record.completion,
        context: authedContext,
        request,
        tenant,
        identity,
        siteKey,
        action: a.name,
        operationId: claim.operationId,
        emit: this.emitterFor(a.name, tenant),
        availability: null,
        ...(expectedRev !== undefined ? { expectedRev } : {}),
        ...helpers,
      }),
    );
    const result = await this.materialize(
      intent,
      a,
      hookCtx,
      { inputHash: record.inputHash, principal: record.principal, tenant: record.tenant },
      this.tenantBaseUrl(tenant),
    );
    await this.settleOperation(hookCtx, opKey, claim, result);
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
    const loaded = await loadToken(this.signer, this.tokens, token, "poll", tenant?.id ?? null);
    if (loaded.kind === "invalid") return finish(unknownToken("poll"));
    const record = loaded.record;
    // Authorized before anything is returned, the terminal result included ([P-POLL-1]).
    const auth = await this.authorizeToken(record, request, adapter);
    if (!auth) return finish(unknownToken("poll"));
    const { identity, siteKey } = auth;
    hookCtx.action = record.action;
    if (identity) hookCtx.context = { onBehalfOf: identity.onBehalfOf };
    const pendingAgain = (retryAfter: number): Result => ({
      status: WIRE.status.pending,
      pollUrl: `${this.tenantBaseUrl(tenant)}${WIRE.path.poll}/${encodeURIComponent(token)}`,
      retryAfter: Math.max(1, Math.round(retryAfter)),
      expiresAt: new Date(record.expiresAt).toISOString(),
    });
    // One onPoll at a time per token; the first terminal result is stored and returned to every
    // later poll ([P-PEND-2], [P-POLL-2]).
    const opKey = tokenOperationKey("poll", record.tenant, record.id);
    const claim = await this.claimOperation(opKey, "poll", "");
    if (claim.kind === "busy") return finish(pendingAgain(claim.retryAfter));
    if (claim.kind !== "run") return finish(claim.result);
    const a = this.getAction(record.action);
    if (!a?.spec.onPoll) {
      await this.idempotency.release(opKey, claim.owner);
      return finish({
        status: WIRE.status.error,
        error: fail(WIRE.error.notFound, `Action "${record.action}" is no longer available.`).error,
      });
    }
    const intent = await this.runHandler(hookCtx, () =>
      a.spec.onPoll!({
        state: record.state as JsonValue,
        context: hookCtx.context,
        request,
        tenant,
        identity,
        siteKey,
        action: a.name,
        operationId: claim.operationId,
        emit: this.emitterFor(a.name, tenant),
        availability: null,
        ...helpers,
      }),
    );
    if (intent[INTENT] === "pending") {
      await this.idempotency.release(opKey, claim.owner);
      return finish(pendingAgain(intent.retryAfter ?? 5));
    }
    const result = await this.materialize(
      intent,
      a,
      hookCtx,
      { inputHash: record.inputHash, principal: record.principal, tenant: record.tenant },
      this.tenantBaseUrl(tenant),
    );
    // A terminal error is terminal too: it is stored like any other result.
    await this.settleOperation(hookCtx, opKey, claim, result, true);
    return finish(result);
  }
}

/** The one answer to every token that cannot be used by this caller here ([P-TOK-3], [P-TOK-6]). */
function unknownToken(type: "continuation" | "resume" | "poll"): Result {
  const message =
    type === "continuation"
      ? "Unknown or expired continuation token. Call the action again to get a new one."
      : type === "resume"
        ? "Unknown or expired resume token."
        : "Unknown or expired poll token.";
  return { status: WIRE.status.error, error: fail(WIRE.error.notFound, message).error };
}

function badExpectedRev(): Result {
  return {
    status: WIRE.status.error,
    error: fail(
      WIRE.error.invalidInput,
      "expectedRev must be the revision you observed: a non-empty string or a number (spec [P-LIVE-1]).",
      {
        issues: [
          {
            path: "/expectedRev",
            message: "must be a string or a number",
            expected: "string | number",
          },
        ],
      },
    ).error,
  };
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
