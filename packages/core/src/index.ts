/**
 * @axe/core: protocol types, schemas, well-known kinds, and the framework-free
 * server runtime.
 *
 * ```ts
 * import { createAXE, action, z } from "@axe/core";
 * ```
 */
/** Zod, re-exported so integrators use one version. @hidden */
export { z } from "zod";
export { createAXE, AXE, MAX_BASE64_DOCUMENT_BYTES } from "./server";
export type {
  AXEConfig,
  AuthConfig,
  CorsConfig,
  IndexConfig,
  Identity,
  SiteKeyVerdict,
  HookContext,
  AdapterContext,
  Endpoint,
  RevisionContext,
  RevisionProvider,
} from "./server";
export {
  evaluateRequestPolicy,
  resolveRequestPolicy,
  isJsonContentType,
  isAcceptedOrigin,
  hasAmbientCredentials,
  normalizeOrigin,
} from "./request-policy";
export type {
  RequestPolicyConfig,
  ResolvedRequestPolicy,
  OriginCheck,
  PolicyContext,
} from "./request-policy";
export { action, ActionDefinitionError, ACTION_NAME_PATTERN } from "./action";
export type {
  ActionProvider,
  ActionSpec,
  RegisteredAction,
  HandlerContext,
  ContinueContext,
  ResumeContext,
  PollContext,
  HandlerReturn,
  ResultHelpers,
  TenantInfo,
  MaybePromise,
  AvailabilityInput,
  AvailabilityContext,
} from "./action";
export { ok, needsInput, handoff, pending, fail, unavailable, AXEError, isIntent } from "./results";
export type {
  ResultIntent,
  OkIntent,
  NeedsInputIntent,
  HandoffIntent,
  PendingIntent,
  ErrorIntent,
  FailOptions,
} from "./results";
export { MemoryTokenStore, TokenSigner, hashJson, canonicalJson } from "./tokens";
export type { TokenStore, TokenRecord, TokenType } from "./tokens";
export { DEFAULT_MAX_ENTRIES, DEFAULT_SWEEP_INTERVAL_MS } from "./retention";
export type { RetentionOptions } from "./retention";
export {
  MemoryIdempotencyStore,
  DEFAULT_IDEMPOTENCY_TTL_SECONDS,
  DEFAULT_OPERATION_LEASE_SECONDS,
} from "./idempotency";
export type {
  IdempotencyStore,
  IdempotencyRecord,
  ClaimRequest,
  ClaimOutcome,
} from "./idempotency";
export type { SiteKeyContext } from "./principal";
export { DisplayValidationError, resolveDisplay, stripReserved, MAX_AFFORDANCES } from "./display";
export type {
  PresentedResult,
  PresentedItem,
  PresentedAttribute,
  PresentedPrice,
  ResolvedAffordance,
} from "./display";
export { getPointer, parsePointer, escapeToken, resolvePointerInSchema } from "./pointer";
export { validateJsonSchema, schemasStructurallyEqual, deepEqual } from "./json-schema";
export { toJsonSchema, isZodSchema } from "./zod-json-schema";
export {
  kinds,
  accept,
  customKind,
  withMimeTypes,
  wellKnownKind,
  isCustomKind,
  isValidKindName,
  WELL_KNOWN_KINDS,
  kindJsonSchema,
} from "./kinds";
export type { KindDefinition, AcceptInput } from "./kinds";
export {
  lintAgentText,
  lintAction,
  lintManifest,
  hasLintErrors,
  agentReadText,
  isBareQuerySearch,
  AGENT_DIRECTIVE_PATTERNS,
  PERSUASION_PATTERNS,
} from "./lint";
export type { LintIssue, LintRule, LintSeverity, LintTextOptions } from "./lint";
export { consoleSink, otelSink, combineSinks, parseUserAgent } from "./events";
export type { ActionEventSink, EventSink, MeterLike, TracerLike } from "./events";
export { WIRE, WIRE_ENTRIES } from "./vocabulary";
export type * from "./types";
