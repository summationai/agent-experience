/**
 * Well-known requirement kinds (spec/KINDS.md), as Zod schemas with metadata.
 *
 * ```ts
 * import { kinds, accept } from "@summationai/axe-core/kinds";
 * needsInput({
 *   reason: "payment_required",
 *   message: "A $500 refundable deposit is required.",
 *   accepts: [accept(kinds.payment.achDebit, { description: "Authorize a one-time ACH debit." })],
 * });
 * ```
 */
import { z } from "zod";
import { WIRE } from "./vocabulary";
import type { JsonSchema } from "./types";
import { toJsonSchema } from "./zod-json-schema";

/** A well-known or custom kind: its wire name, payload schema, and defaults for an `accepts[]` entry. */
export interface KindDefinition<S extends z.ZodType = z.ZodType> {
  readonly kind: string;
  readonly title: string;
  readonly description: string;
  readonly schema: S;
  readonly sensitive: boolean;
}

/** A server-side `accepts[]` entry: like the wire `Accept` but with a Zod schema. */
export interface AcceptInput {
  kind: string;
  title?: string;
  description: string;
  schema: z.ZodType | JsonSchema;
  sensitive: boolean;
  instructions?: string;
}

function def<S extends z.ZodType>(
  kind: string,
  title: string,
  description: string,
  schema: S,
  sensitive: boolean,
): KindDefinition<S> {
  return Object.freeze({ kind, title, description, schema, sensitive });
}

const currency = z
  .string()
  .regex(/^[A-Z]{3}$/, "ISO 4217 code")
  .describe("ISO 4217 currency code, e.g. USD");
const money = z.number().min(0).describe("Amount in major units");
const country = z
  .string()
  .regex(/^[A-Z]{2}$/)
  .describe("ISO 3166-1 alpha-2 country code");

export const paymentCard = def(
  WIRE.kind.paymentCard,
  "Payment card",
  "A tokenized payment card from the agent's wallet.",
  z
    .object({
      token: z.string().min(1).describe("PSP-issued single-use or network token"),
      provider: z.string().min(1).describe("Payment service provider, e.g. stripe"),
      brand: z.string().min(1).optional().describe("Card network, lowercase"),
      last4: z
        .string()
        .regex(/^[0-9]{4}$/)
        .optional(),
      expMonth: z.number().int().min(1).max(12).optional(),
      expYear: z.number().int().min(2000).max(2100).optional(),
      billingPostalCode: z.string().min(1).optional(),
      amount: money.optional(),
      currency: currency.optional(),
    })
    .strict(),
  true,
);

export const paymentAchDebit = def(
  WIRE.kind.paymentAchDebit,
  "Bank account (ACH)",
  "Authorization for a one-time ACH debit from a US bank account.",
  z
    .object({
      accountHolderName: z.string().min(1),
      routingNumber: z
        .string()
        .regex(/^[0-9]{9}$/)
        .describe("ABA routing number"),
      accountNumber: z.string().regex(/^[0-9]{4,17}$/),
      accountType: z.enum(["checking", "savings"]),
      amount: money,
      currency,
      authorizedAt: z
        .string()
        .datetime({ offset: true })
        .describe("When the user authorized the debit"),
      authorizationText: z
        .string()
        .min(1)
        .describe("The exact authorization text the user agreed to"),
    })
    .strict(),
  true,
);

export const paymentWireConfirmation = def(
  WIRE.kind.paymentWireConfirmation,
  "Wire transfer confirmation",
  "Confirmation that a wire was sent following the site's instructions.",
  z
    .object({
      referenceNumber: z.string().min(1).describe("Bank reference, IMAD, or OMAD"),
      amount: money,
      currency,
      sentAt: z.string().datetime({ offset: true }),
      bankName: z.string().min(1).optional(),
    })
    .strict(),
  false,
);

export const paymentInvoice = def(
  WIRE.kind.paymentInvoice,
  "Invoice on net terms",
  "Request to be invoiced instead of paying now.",
  z
    .object({
      companyName: z.string().min(1),
      billingEmail: z.string().email(),
      purchaseOrderNumber: z.string().min(1).optional(),
      netTermsDays: z.number().int().min(0).max(180).optional(),
      taxId: z.string().min(1).optional(),
    })
    .strict(),
  false,
);

export const identityGovernmentId = def(
  WIRE.kind.identityGovernmentId,
  "Government-issued ID",
  "Details from a passport, driver's license, national ID, or residence permit.",
  z
    .object({
      documentType: z.enum(["passport", "drivers-license", "national-id", "residence-permit"]),
      documentNumber: z.string().min(1),
      issuingCountry: country,
      fullName: z.string().min(1).describe("Name as printed on the document"),
      dateOfBirth: z.string().date().optional(),
      expiresOn: z.string().date().optional(),
    })
    .strict(),
  true,
);

export const identityDateOfBirth = def(
  WIRE.kind.identityDateOfBirth,
  "Date of birth",
  "The user's date of birth.",
  z.object({ dateOfBirth: z.string().date() }).strict(),
  true,
);

export const identitySsnLast4 = def(
  WIRE.kind.identitySsnLast4,
  "Last four of SSN",
  "Last four digits of a US Social Security number.",
  z.object({ last4: z.string().regex(/^[0-9]{4}$/) }).strict(),
  true,
);

export const documentUrl = def(
  WIRE.kind.documentUrl,
  "Document by URL",
  "A document the site fetches from an HTTPS URL.",
  z
    .object({
      url: z.string().url().describe("HTTPS URL the site fetches once"),
      mimeType: z.string().min(1).describe("e.g. application/pdf"),
      filename: z.string().min(1).optional(),
      sizeBytes: z.number().int().min(0).optional(),
    })
    .strict(),
  false,
);

export const documentBase64 = def(
  WIRE.kind.documentBase64,
  "Document upload",
  "A document uploaded inline as base64.",
  z
    .object({
      filename: z.string().min(1),
      mimeType: z.string().min(1),
      contentBase64: z.string().min(1).describe("Standard base64 without a data URL prefix"),
    })
    .strict(),
  false,
);

export const contactEmail = def(
  WIRE.kind.contactEmail,
  "Email address",
  "An email address for the user.",
  z.object({ email: z.string().email() }).strict(),
  false,
);

export const contactPhone = def(
  WIRE.kind.contactPhone,
  "Phone number",
  "A phone number for the user in E.164 form.",
  z
    .object({
      phone: z
        .string()
        .regex(/^\+[1-9][0-9]{6,14}$/)
        .describe("E.164, e.g. +14255550100"),
      canReceiveSms: z.boolean().optional(),
    })
    .strict(),
  false,
);

export const contactAddress = def(
  WIRE.kind.contactAddress,
  "Postal address",
  "A postal address for the user.",
  z
    .object({
      line1: z.string().min(1),
      line2: z.string().min(1).optional(),
      city: z.string().min(1),
      region: z.string().min(1).optional().describe("State, province, or prefecture"),
      postalCode: z.string().min(1).optional(),
      country,
    })
    .strict(),
  false,
);

export const consentTerms = def(
  WIRE.kind.consentTerms,
  "Consent to terms",
  "Acknowledgment of one specific policy version for one specific scope.",
  z
    .object({
      policyUrl: z.string().url(),
      policyVersion: z.string().min(1).describe("Exact version identifier or date"),
      scope: z.string().min(1).describe("What the consent covers"),
      acceptedAt: z.string().datetime({ offset: true }),
      acceptedBy: z.string().min(1).optional(),
    })
    .strict(),
  false,
);

/** Every well-known kind, grouped by namespace. */
export const kinds = Object.freeze({
  payment: Object.freeze({
    card: paymentCard,
    achDebit: paymentAchDebit,
    wireConfirmation: paymentWireConfirmation,
    invoice: paymentInvoice,
  }),
  identity: Object.freeze({
    governmentId: identityGovernmentId,
    dateOfBirth: identityDateOfBirth,
    ssnLast4: identitySsnLast4,
  }),
  document: Object.freeze({
    url: documentUrl,
    base64: documentBase64,
  }),
  contact: Object.freeze({
    email: contactEmail,
    phone: contactPhone,
    address: contactAddress,
  }),
  consent: Object.freeze({
    terms: consentTerms,
  }),
});

/** Flat list of every well-known kind definition. */
export const WELL_KNOWN_KINDS: readonly KindDefinition[] = Object.freeze([
  paymentCard,
  paymentAchDebit,
  paymentWireConfirmation,
  paymentInvoice,
  identityGovernmentId,
  identityDateOfBirth,
  identitySsnLast4,
  documentUrl,
  documentBase64,
  contactEmail,
  contactPhone,
  contactAddress,
  consentTerms,
]);

/** Look up a well-known kind by wire name. */
export function wellKnownKind(name: string): KindDefinition | undefined {
  return WELL_KNOWN_KINDS.find((k) => k.kind === name);
}

/** Whether a kind name is a valid custom kind (`x-<org>.<name>`). */
export function isCustomKind(name: string): boolean {
  return /^x-[a-z0-9]+(-[a-z0-9]+)*\.[a-z][a-z0-9-]*$/.test(name);
}

/** Whether a kind name is syntactically valid: well-known or custom. */
export function isValidKindName(name: string): boolean {
  return wellKnownKind(name) !== undefined || isCustomKind(name);
}

/**
 * Define a custom kind under your own namespace. The name must be `x-<org>.<name>`.
 * Throws when the name is malformed or collides with a well-known namespace.
 */
export function customKind<S extends z.ZodType>(spec: {
  kind: string;
  title: string;
  description: string;
  schema: S;
  sensitive: boolean;
}): KindDefinition<S> {
  if (!isCustomKind(spec.kind)) {
    throw new Error(
      `Custom kind "${spec.kind}" must be named x-<org>.<name> (lowercase, kebab-case). Well-known namespaces (payment, identity, document, contact, consent) are reserved; see spec/KINDS.md.`,
    );
  }
  return def(spec.kind, spec.title, spec.description, spec.schema, spec.sensitive);
}

/**
 * Restrict a document kind to specific MIME types. Returns a new definition whose
 * schema is a restriction of the registry schema, which spec/KINDS.md [K-3] permits.
 */
export function withMimeTypes<S extends z.ZodObject>(
  kind: KindDefinition<S>,
  mimeTypes: readonly [string, ...string[]],
): KindDefinition<z.ZodObject> {
  const shape = kind.schema.shape as Record<string, z.ZodType>;
  if (!("mimeType" in shape)) {
    throw new Error(`withMimeTypes: kind "${kind.kind}" has no mimeType member`);
  }
  const restricted = kind.schema.extend({ mimeType: z.enum(mimeTypes) }).strict();
  return def(kind.kind, kind.title, kind.description, restricted, kind.sensitive);
}

/**
 * Build an `accepts[]` entry from a kind definition. `description` should say what
 * this requirement is for in the context of the action; `instructions` is relayed to
 * the user or acted on by the agent (wire details, where to obtain a document).
 */
export function accept(
  kind: KindDefinition,
  options: {
    description?: string;
    title?: string;
    instructions?: string;
    sensitive?: boolean;
  } = {},
): AcceptInput {
  if (options.sensitive === false && kind.sensitive) {
    throw new Error(
      `accept(): kind "${kind.kind}" is sensitive by definition and cannot be marked sensitive: false (spec/KINDS.md [K-4]).`,
    );
  }
  const entry: AcceptInput = {
    kind: kind.kind,
    title: options.title ?? kind.title,
    description: options.description ?? kind.description,
    schema: kind.schema,
    sensitive: options.sensitive ?? kind.sensitive,
  };
  if (options.instructions !== undefined) entry.instructions = options.instructions;
  return entry;
}

/**
 * The conventional `reason` string for a requirement whose kinds share a namespace:
 * `payment_required`, `identity_required`, `document_required`, `consent_required`.
 * Returns undefined for contact kinds and custom kinds, which take site-specific reasons.
 */
export function suggestedReason(kindName: string): string | undefined {
  const namespace = kindName.split(".")[0];
  switch (namespace) {
    case "payment":
      return WIRE.reason.paymentRequired;
    case "identity":
      return WIRE.reason.identityRequired;
    case "document":
      return WIRE.reason.documentRequired;
    case "consent":
      return WIRE.reason.consentRequired;
    default:
      return undefined;
  }
}

/** JSON Schema for a kind's payload, as it appears on the wire. */
export function kindJsonSchema(kind: KindDefinition): JsonSchema {
  return toJsonSchema(kind.schema, "input");
}
