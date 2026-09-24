/**
 * Zod schemas for every wire document (manifest, action, request, result, index,
 * event), used to validate documents the SDK did not produce and to generate
 * `spec/schemas/*.json`. Also re-exports the dependency-free JSON Schema validator.
 */
import { z } from "zod";
import { WIRE } from "./vocabulary";
import { toJsonSchema } from "./zod-json-schema";
import type { JsonSchema } from "./types";

export { validateJsonSchema, schemasStructurallyEqual, deepEqual } from "./json-schema";
export { toJsonSchema } from "./zod-json-schema";

const enumOf = <T extends Record<string, string>>(o: T) =>
  z.enum(Object.values(o) as [T[keyof T], ...T[keyof T][]]);

export const RiskSchema = enumOf(WIRE.risk);
export const AuthModeSchema = enumOf(WIRE.authMode);
export const StatusSchema = enumOf(WIRE.status);
export const ErrorCodeSchema = enumOf(WIRE.error);
export const LadderSchema = enumOf(WIRE.ladder);
export const DisplayKindSchema = enumOf(WIRE.displayKind);
export const FormatSchema = enumOf(WIRE.format);
export const CompareSchema = enumOf(WIRE.compare);
export const PeriodSchema = enumOf(WIRE.period);
export const ToneSchema = enumOf(WIRE.tone);

export const ACTION_NAME = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;
export const KIND_NAME =
  /^(payment|identity|document|contact|consent)\.[a-z][a-z0-9-]*$|^x-[a-z0-9]+(-[a-z0-9]+)*\.[a-z][a-z0-9-]*$/;
export const PROTOCOL_VERSION = /^axe\/\d+\.\d+$/;

const JsonPointerSchema = z
  .string()
  .regex(/^(\/([^/~]|~0|~1)*)*$/, "RFC 6901 JSON Pointer")
  .describe("RFC 6901 JSON Pointer");
const JsonSchemaSchema = z
  .record(z.string(), z.unknown())
  .describe("A JSON Schema (draft 2020-12) document");
const JsonValueSchema: z.ZodType<unknown> = z.unknown();
const UrlSchema = z.string().url();

export const PriceDisplaySchema = z
  .object({ amount: JsonPointerSchema, currency: z.string(), period: PeriodSchema.optional() })
  .strict();

export const AttributeDisplaySchema = z
  .object({
    label: z.string().min(1),
    path: JsonPointerSchema,
    format: FormatSchema.optional(),
    compare: CompareSchema.optional(),
  })
  .strict();

export const ItemDisplaySchema = z
  .object({
    id: JsonPointerSchema,
    title: JsonPointerSchema,
    subtitle: JsonPointerSchema.optional(),
    summary: JsonPointerSchema.optional(),
    image: z.union([JsonPointerSchema, z.array(JsonPointerSchema)]).optional(),
    url: JsonPointerSchema.optional(),
    price: PriceDisplaySchema.optional(),
    attributes: z.array(AttributeDisplaySchema).optional(),
    badges: z.array(JsonPointerSchema).optional(),
  })
  .strict();

export const DisplaySchema = z
  .object({
    kind: DisplayKindSchema,
    items: JsonPointerSchema.optional(),
    item: ItemDisplaySchema.optional(),
    suggestedComparison: z.array(z.string()).optional(),
    emptyMessage: z.string().optional(),
    disclaimer: z.string().optional(),
  })
  .strict();

export const AffordanceSchema = z
  .object({
    action: z.string().regex(ACTION_NAME),
    title: z.string().min(1),
    input: z.record(z.string(), JsonPointerSchema),
    primary: z.boolean().optional(),
  })
  .strict();

export const DynamicAffordanceSchema = z
  .object({
    action: z.string().regex(ACTION_NAME),
    title: z.string().min(1),
    input: z.record(z.string(), JsonValueSchema),
    primary: z.boolean().optional(),
  })
  .strict();

export const PaginationSchema = z
  .object({
    cursorIn: JsonPointerSchema,
    cursorOut: JsonPointerSchema,
    pageSize: z.object({ default: z.number().int().min(1), max: z.number().int().min(1) }).strict(),
  })
  .strict();

export const FreshnessSchema = z
  .object({
    cacheTtlSeconds: z.number().min(0).optional(),
    validUntil: JsonPointerSchema.optional(),
  })
  .strict();

export const ActionExampleSchema = z
  .object({ input: JsonValueSchema, output: JsonValueSchema })
  .strict();

export const AcceptSchema = z
  .object({
    kind: z.string().regex(KIND_NAME),
    title: z.string().min(1),
    description: z.string().min(1),
    schema: JsonSchemaSchema,
    sensitive: z.boolean(),
    instructions: z.string().optional(),
  })
  .strict();

/** A site revision: an opaque string or number. */
export const RevisionSchema = z.union([z.string().min(1), z.number()]);

/** `manifest.live`. */
export const LiveSchema = z
  .object({ rev: RevisionSchema.optional(), url: UrlSchema.optional() })
  .strict();

/** A handoff declared on an unavailable action: the Handoff object without the token members. */
export const HandoffSpecSchema = z
  .object({
    reason: z.string().min(1),
    instructions: z.string().min(1),
    url: UrlSchema,
    whatAgentShouldSayToUser: z.string().min(1),
  })
  .strict();

/** `action.availability` and the entries of `/axe/state`. A reason is required when unavailable. */
export const AvailabilitySchema = z.discriminatedUnion("available", [
  z.object({ available: z.literal(true) }).strict(),
  z
    .object({
      available: z.literal(false),
      reason: z.string().min(1),
      requires: z.array(AcceptSchema).min(1).optional(),
      handoff: HandoffSpecSchema.optional(),
    })
    .strict(),
]);

/** The document served at `/axe/state`. */
export const LiveStateSchema = z
  .object({
    rev: RevisionSchema.optional(),
    actions: z.record(z.string().regex(ACTION_NAME), AvailabilitySchema),
  })
  .strict();

export const ActionSchema = z
  .object({
    name: z.string().regex(ACTION_NAME),
    title: z.string().min(1),
    description: z.string().min(1),
    input: JsonSchemaSchema,
    output: JsonSchemaSchema,
    readOnly: z.boolean(),
    idempotent: z.boolean(),
    reversible: z.boolean(),
    risk: RiskSchema,
    auth: AuthModeSchema,
    examples: z.array(ActionExampleSchema).optional(),
    display: DisplaySchema.optional(),
    affordances: z.array(AffordanceSchema).max(6).optional(),
    pagination: PaginationSchema.optional(),
    freshness: FreshnessSchema.optional(),
    humanHandoff: z
      .object({ reasons: z.array(z.string()) })
      .strict()
      .optional(),
    deprecated: z
      .object({ since: z.string(), replacedBy: z.string().regex(ACTION_NAME).optional() })
      .strict()
      .optional(),
    availability: AvailabilitySchema.optional(),
  })
  .strict();

export const ManifestAuthSchema = z
  .object({ modes: z.array(AuthModeSchema).min(1), userLoginUrl: UrlSchema.optional() })
  .strict();

export const PoliciesSchema = z
  .object({
    rateLimit: z
      .object({
        requestsPerMinute: z.number().int().min(1),
        burst: z.number().int().min(1).optional(),
      })
      .strict()
      .optional(),
    termsUrl: UrlSchema.optional(),
    dataRetention: z.string().optional(),
    agents: z
      .object({ allow: z.array(z.string()).optional(), deny: z.array(z.string()).optional() })
      .strict()
      .optional(),
  })
  .strict();

export const ContactSchema = z
  .object({ email: z.string().email().optional(), url: UrlSchema.optional() })
  .strict();

export const BrandSchema = z
  .object({
    name: z.string().optional(),
    logoUrl: UrlSchema.optional(),
    accentColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{3,8}$/)
      .optional(),
    tone: ToneSchema.optional(),
  })
  .strict();

export const FlowSchema = z
  .object({
    name: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    steps: z.array(z.string().regex(ACTION_NAME)).min(1),
  })
  .strict();

export const ManifestSchema = z
  .object({
    protocol: z.string().regex(PROTOCOL_VERSION),
    name: z.string().min(1),
    description: z.string().min(1),
    baseUrl: UrlSchema,
    humanFallbackUrl: UrlSchema.optional(),
    auth: ManifestAuthSchema,
    actions: z.array(ActionSchema),
    flows: z.array(FlowSchema).optional(),
    policies: PoliciesSchema.optional(),
    contact: ContactSchema.optional(),
    brand: BrandSchema.optional(),
    indexUrl: UrlSchema.optional(),
    updatedAt: z.string().datetime({ offset: true }).optional(),
    live: LiveSchema.optional(),
  })
  .strict();

export const AgentIdentificationSchema = z
  .object({
    name: z.string().min(1),
    version: z.string().optional(),
    vendor: z.string().optional(),
    contact: z.string().optional(),
  })
  .strict();

export const RequestContextSchema = z
  .object({
    onBehalfOf: z.string().optional(),
    locale: z.string().optional(),
    timezone: z.string().optional(),
    agent: AgentIdentificationSchema.optional(),
    sessionId: z.string().optional(),
  })
  .strict();

export const RequestEnvelopeSchema = z
  .object({
    input: JsonValueSchema,
    context: RequestContextSchema.optional(),
    idempotencyKey: z.string().max(256).optional(),
    expectedRev: RevisionSchema.optional(),
  })
  .strict();

export const ContinueRequestSchema = z
  .object({
    continuationToken: z.string().min(1),
    kind: z.string().regex(KIND_NAME),
    payload: JsonValueSchema,
    expectedRev: RevisionSchema.optional(),
  })
  .strict();

export const ResumeRequestSchema = z
  .object({ resumeToken: z.string().min(1), expectedRev: RevisionSchema.optional() })
  .strict();

export const HandoffSchema = z
  .object({
    reason: z.string().min(1),
    instructions: z.string().min(1),
    url: UrlSchema,
    resumeToken: z.string().min(1),
    expiresAt: z.string().datetime({ offset: true }),
    whatAgentShouldSayToUser: z.string().min(1),
  })
  .strict();

export const ValidationIssueSchema = z
  .object({ path: z.string(), message: z.string(), expected: z.string().optional() })
  .strict();

export const ErrorBodySchema = z
  .object({
    code: ErrorCodeSchema,
    message: z.string().min(1),
    retryable: z.boolean(),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const OkResultSchema = z
  .object({
    status: z.literal(WIRE.status.ok),
    output: JsonValueSchema,
    rev: RevisionSchema.optional(),
  })
  .strict();
export const NeedsInputResultSchema = z
  .object({
    status: z.literal(WIRE.status.needsInput),
    reason: z.string().min(1),
    message: z.string().min(1),
    accepts: z.array(AcceptSchema).min(1),
    continuationToken: z.string().min(1),
    expiresAt: z.string().datetime({ offset: true }),
    fallback: HandoffSchema.optional(),
    rev: RevisionSchema.optional(),
  })
  .strict();
export const NeedsHumanResultSchema = z
  .object({
    status: z.literal(WIRE.status.needsHuman),
    handoff: HandoffSchema,
    rev: RevisionSchema.optional(),
  })
  .strict();
export const PendingResultSchema = z
  .object({
    status: z.literal(WIRE.status.pending),
    pollUrl: UrlSchema,
    retryAfter: z.number().int().min(1),
    expiresAt: z.string().datetime({ offset: true }).optional(),
    rev: RevisionSchema.optional(),
  })
  .strict();
export const ErrorResultSchema = z
  .object({
    status: z.literal(WIRE.status.error),
    error: ErrorBodySchema,
    rev: RevisionSchema.optional(),
  })
  .strict();

export const ResultSchema = z.discriminatedUnion("status", [
  OkResultSchema,
  NeedsInputResultSchema,
  NeedsHumanResultSchema,
  PendingResultSchema,
  ErrorResultSchema,
]);

export const IndexSiteSchema = z
  .object({
    name: z.string().min(1),
    manifestUrl: UrlSchema,
    updatedAt: z.string().datetime({ offset: true }),
    tags: z.array(z.string()).optional(),
  })
  .strict();

export const PlatformIndexSchema = z
  .object({
    protocol: z.string().regex(PROTOCOL_VERSION),
    platform: z.object({ name: z.string().min(1), url: UrlSchema }).strict(),
    sites: z.array(IndexSiteSchema),
    next: UrlSchema.optional(),
  })
  .strict();

export const EventSchema = z
  .object({
    schemaVersion: z.literal(1),
    ts: z.string().datetime({ offset: true }),
    action: z.string(),
    status: StatusSchema,
    ladder: LadderSchema,
    agent: z
      .object({
        vendor: z.string().optional(),
        name: z.string().optional(),
        version: z.string().optional(),
      })
      .strict()
      .nullable(),
    latencyMs: z.number().int().min(0),
    kind: z.string().nullable(),
    errorCode: ErrorCodeSchema.nullable(),
    tenant: z.string().nullable(),
  })
  .strict();

export const ActionEventSchema = z
  .object({
    schemaVersion: z.literal(1),
    ts: z.string().datetime({ offset: true }),
    action: z.string(),
    event: z.string(),
    status: StatusSchema,
    errorCode: ErrorCodeSchema.nullable(),
    actor: z.string().nullable(),
    details: z.record(z.string(), JsonValueSchema),
    tenant: z.string().nullable(),
  })
  .strict();

/** The JSON Schemas published under `spec/schemas/`, keyed by file stem. */
export function specJsonSchemas(): Record<string, JsonSchema> {
  const withId = (id: string, schema: z.ZodType): JsonSchema => ({
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `https://axe.dev/schemas/${WIRE.protocol.version.replace("/", "-")}/${id}.schema.json`,
    ...toJsonSchema(schema, "input"),
  });
  return {
    manifest: withId("manifest", ManifestSchema),
    request: withId("request", RequestEnvelopeSchema),
    continue: withId("continue", ContinueRequestSchema),
    resume: withId("resume", ResumeRequestSchema),
    result: withId("result", ResultSchema),
    index: withId("index", PlatformIndexSchema),
    event: withId("event", EventSchema),
    "action-event": withId("action-event", ActionEventSchema),
    state: withId("state", LiveStateSchema),
  };
}
