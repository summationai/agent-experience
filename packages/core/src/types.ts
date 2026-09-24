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
}

export interface ContinueRequest {
  continuationToken: string;
  kind: string;
  payload: JsonValue;
}

export interface ResumeRequest {
  resumeToken: string;
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
}

export interface NeedsInputResult {
  status: "needs_input";
  reason: string;
  message: string;
  accepts: Accept[];
  continuationToken: string;
  expiresAt: string;
  fallback?: Handoff;
}

export interface NeedsHumanResult {
  status: "needs_human";
  handoff: Handoff;
}

export interface PendingResult {
  status: "pending";
  pollUrl: string;
  retryAfter: number;
  expiresAt?: string;
}

export interface ErrorResult {
  status: "error";
  error: ErrorBody;
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
