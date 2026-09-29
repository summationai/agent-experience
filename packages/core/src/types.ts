/**
 * Wire-level types for the AXE protocol. Everything in this file describes JSON
 * that crosses the network, exactly as `spec/AXE-PROTOCOL.md` defines it.
 * Nothing here depends on Zod, so agent-side packages can import these types
 * without pulling in a schema library.
 */
import type {
  WireAuthMode,
  WireCompare,
  WireDisplayKind,
  WireError,
  WireFormat,
  WireLadder,
  WirePeriod,
  WireRisk,
  WireStatus,
  WireTone,
} from "./vocabulary";

/** A JSON value. */
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
/** A JSON object. */
export type JsonObject = { [key: string]: JsonValue };

/** A JSON Schema document (draft 2020-12). Kept loose on purpose; the SDK generates these. */
export type JsonSchema = { [key: string]: unknown };

/** An RFC 6901 JSON Pointer, for example `/units` or `/price/amount`. */
export type JsonPointer = string;

export type Risk = WireRisk;
export type AuthMode = WireAuthMode;
export type ResultStatus = WireStatus;
export type ErrorCode = WireError;
export type Ladder = WireLadder;
export type DisplayKind = WireDisplayKind;
export type AttributeFormat = WireFormat;
export type CompareDirection = WireCompare;
export type PricePeriod = WirePeriod;
export type BrandTone = WireTone;

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

export interface ManifestAuth {
  modes: AuthMode[];
  userLoginUrl?: string;
}

export interface RateLimitPolicy {
  requestsPerMinute: number;
  burst?: number;
}

export interface AgentPolicy {
  allow?: string[];
  deny?: string[];
}

export interface Policies {
  rateLimit?: RateLimitPolicy;
  termsUrl?: string;
  dataRetention?: string;
  agents?: AgentPolicy;
}

export interface Contact {
  email?: string;
  url?: string;
}

export interface Brand {
  name?: string;
  logoUrl?: string;
  accentColor?: string;
  tone?: BrandTone;
}

export interface Flow {
  name: string;
  title: string;
  description: string;
  steps: string[];
}

export interface Manifest {
  protocol: string;
  name: string;
  description: string;
  baseUrl: string;
  humanFallbackUrl?: string;
  auth: ManifestAuth;
  actions: ActionDefinition[];
  flows?: Flow[];
  policies?: Policies;
  contact?: Contact;
  brand?: Brand;
  indexUrl?: string;
  updatedAt?: string;
  /** The site publishes live state: a revision and per-action availability. See spec §21. */
  live?: Live;
}

// ---------------------------------------------------------------------------
// Live state and revisions (spec §21)
// ---------------------------------------------------------------------------

/** A site's revision: an opaque string or number that moves with every change an agent could observe. */
export type Revision = string | number;

/** `manifest.live`: where live state is served, and the revision when the manifest was rendered. */
export interface Live {
  /** The revision at manifest render time. Manifests are cached; prefer `url`. */
  rev?: Revision;
  /** Absolute URL of the state endpoint (`/axe/state`), served with `Cache-Control: no-store`. */
  url?: string;
}

/**
 * A handoff declared on an unavailable action: the Handoff object without the token members.
 * `url` is optional here: a step taken inside the application itself has no page to send the
 * person to. Such a handoff is reported (in `availability` and in `error.details.handoff`) and
 * never becomes `needs_human`, whose Handoff needs a `url` to resume from ([P-HAND-1]).
 */
export type HandoffSpec = Omit<Handoff, "resumeToken" | "expiresAt" | "url"> & { url?: string };

/** Whether an action can be done right now, and if not, why and what would change that. */
export type Availability =
  | { available: true; reason?: undefined; requires?: undefined; handoff?: undefined }
  | {
      available: false;
      /** Plain language, in the site's words. Agent-read text. */
      reason: string;
      /** `accepts`-shaped kinds that would make the action available. */
      requires?: Accept[];
      /** A step only a human can take. */
      handoff?: HandoffSpec;
    };

/** The document at `/axe/state`. */
export interface LiveState {
  rev?: Revision;
  /** Every action in the manifest; one that declares no availability is `{ available: true }`. */
  actions: Record<string, Availability>;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export interface PriceDisplay {
  amount: JsonPointer;
  currency: JsonPointer | string;
  period?: PricePeriod;
}

export interface AttributeDisplay {
  label: string;
  path: JsonPointer;
  format?: AttributeFormat;
  compare?: CompareDirection;
}

export interface ItemDisplay {
  id: JsonPointer;
  title: JsonPointer;
  subtitle?: JsonPointer;
  summary?: JsonPointer;
  image?: JsonPointer | JsonPointer[];
  url?: JsonPointer;
  price?: PriceDisplay;
  attributes?: AttributeDisplay[];
  badges?: JsonPointer[];
}

export interface Display {
  kind: DisplayKind;
  items?: JsonPointer;
  item?: ItemDisplay;
  suggestedComparison?: string[];
  emptyMessage?: string;
  disclaimer?: string;
}

/** A statically declared affordance. `input` values are JSON Pointers relative to the item. */
export interface Affordance {
  action: string;
  title: string;
  input: Record<string, JsonPointer>;
  primary?: boolean;
}

/** A dynamic affordance returned under `_axe`. `input` values are concrete. */
export interface DynamicAffordance {
  action: string;
  title: string;
  input: Record<string, JsonValue>;
  primary?: boolean;
  /** The revision the item was observed at; presented as the request envelope's `expectedRev` when the affordance is followed (spec §21). */
  expectedRev?: Revision;
}

/** The reserved `_axe` member on an output or item. */
export interface AxeReserved {
  affordances?: DynamicAffordance[];
}

export interface Pagination {
  cursorIn: JsonPointer;
  cursorOut: JsonPointer;
  pageSize: { default: number; max: number };
}

export interface Freshness {
  cacheTtlSeconds?: number;
  validUntil?: JsonPointer;
}

export interface ActionExample {
  input: JsonValue;
  output: JsonValue;
}

export interface Deprecation {
  since: string;
  replacedBy?: string;
}

/** An action as it appears in the manifest. */
export interface ActionDefinition {
  name: string;
  title: string;
  description: string;
  input: JsonSchema;
  output: JsonSchema;
  readOnly: boolean;
  idempotent: boolean;
  reversible: boolean;
  risk: Risk;
  auth: AuthMode;
  examples?: ActionExample[];
  display?: Display;
  affordances?: Affordance[];
  pagination?: Pagination;
  freshness?: Freshness;
  humanHandoff?: { reasons: string[] };
  deprecated?: Deprecation;
  /** Computed at render time: whether the action can be done right now (the anonymous view in the manifest). */
  availability?: Availability;
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export interface AgentIdentification {
  name: string;
  version?: string;
  vendor?: string;
  contact?: string;
}

export interface RequestContext {
  onBehalfOf?: string;
  locale?: string;
  timezone?: string;
  agent?: AgentIdentification;
  sessionId?: string;
}

export interface RequestEnvelope<I = JsonValue> {
  input: I;
  context?: RequestContext;
  idempotencyKey?: string;
  /** The revision the agent observed. A server with a revision refuses the call with `conflict` when it moved. */
  expectedRev?: Revision;
}

export interface ContinueRequest {
  continuationToken: string;
  kind: string;
  payload: JsonValue;
  expectedRev?: Revision;
}

export interface ResumeRequest {
  resumeToken: string;
  expectedRev?: Revision;
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export interface Accept {
  kind: string;
  title: string;
  description: string;
  schema: JsonSchema;
  sensitive: boolean;
  instructions?: string;
}

export interface Handoff {
  reason: string;
  instructions: string;
  url: string;
  resumeToken: string;
  expiresAt: string;
  whatAgentShouldSayToUser: string;
}

export interface ValidationIssue {
  path: JsonPointer;
  message: string;
  expected?: string;
}

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  details?: JsonObject & { issues?: ValidationIssue[] };
}

export interface OkResult<O = JsonValue> {
  status: "ok";
  output: O;
  /** The revision the change produced, when the site has one. */
  rev?: Revision;
}

export interface NeedsInputResult {
  status: "needs_input";
  reason: string;
  message: string;
  accepts: Accept[];
  continuationToken: string;
  expiresAt: string;
  fallback?: Handoff;
  rev?: Revision;
}

export interface NeedsHumanResult {
  status: "needs_human";
  handoff: Handoff;
  rev?: Revision;
}

export interface PendingResult {
  status: "pending";
  pollUrl: string;
  retryAfter: number;
  expiresAt?: string;
  rev?: Revision;
}

export interface ErrorResult {
  status: "error";
  error: ErrorBody;
  /** The site's current revision, when it has one. On a stale `conflict` it equals `details.currentRev`. */
  rev?: Revision;
}

/** The result envelope: every AXE response body is one of these. */
export type Result<O = JsonValue> =
  OkResult<O> | NeedsInputResult | NeedsHumanResult | PendingResult | ErrorResult;

// ---------------------------------------------------------------------------
// Platform index
// ---------------------------------------------------------------------------

export interface IndexSite {
  name: string;
  manifestUrl: string;
  updatedAt: string;
  tags?: string[];
}

export interface PlatformIndex {
  protocol: string;
  platform: { name: string; url: string };
  sites: IndexSite[];
  next?: string;
}

// ---------------------------------------------------------------------------
// Events (see spec/EVENTS.md)
// ---------------------------------------------------------------------------

export interface EventAgent {
  vendor?: string;
  name?: string;
  version?: string;
}

export interface AXEEvent {
  schemaVersion: 1;
  ts: string;
  action: string;
  status: ResultStatus;
  ladder: Ladder;
  agent: EventAgent | null;
  latencyMs: number;
  kind: string | null;
  errorCode: ErrorCode | null;
  tenant: string | null;
}

/**
 * An event an action emits about its own work (spec/EVENTS.md, "Action events"): a ledger line
 * rather than a request metric. Unlike `AXEEvent` it names the `actor`, because attribution is
 * its purpose, so it goes to `onActionEvent` sinks and never to the analytics `onEvent` sinks.
 */
export interface AXEActionEvent {
  schemaVersion: 1;
  ts: string;
  /** The action whose handler emitted the event; for a continue or resume, the originating action. */
  action: string;
  /** What happened, as a dotted name in the action's namespace: `surface.act`. */
  event: string;
  /** Outcome of the work the event records. */
  status: ResultStatus;
  errorCode: ErrorCode | null;
  /** Who the work was done as, in the application's terms; `null` when the action has no actor. */
  actor: string | null;
  /** What the action chooses to record: ids, revisions, sequence numbers. Never a payload. */
  details: Record<string, JsonValue>;
  tenant: string | null;
}

/** What a handler passes to `emit`; the server fills in `schemaVersion`, `ts`, `action`, and `tenant`. */
export interface AXEActionEventInput {
  event: string;
  /** Default `ok`. */
  status?: ResultStatus;
  errorCode?: ErrorCode | null;
  actor?: string | null;
  details?: Record<string, JsonValue>;
}
