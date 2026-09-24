/**
 * Unit-test helpers for sites built with @axe/core.
 */
import type { Manifest, Result, JsonValue } from "@axe/core/types";
import { AXEClient } from "@axe/client";
import type { ClientOptions } from "@axe/client";
import * as WIRE from "@axe/core/vocabulary";
import { WELL_KNOWN_KINDS } from "@axe/core/kinds";

/** The subset of an `AXE` instance the helpers need. */
export interface AxeLike {
  handle(
    request: Request,
    adapter?: { identity?: { onBehalfOf: string } | null },
  ): Promise<Response>;
  describe(): Manifest;
}

export interface TestClientOptions extends ClientOptions {
  /** Act as this user without going through your `authenticate` function. */
  identity?: { onBehalfOf: string } | null;
}

/**
 * An `AXEClient` bound to an in-process server: no network, no port. Pass `identity`
 * to act as a signed-in user.
 */
export function createTestClient(axe: AxeLike, options: TestClientOptions = {}): AXEClient {
  const { identity, ...rest } = options;
  const inProcess = (input: string | URL, init?: RequestInit) =>
    axe.handle(new Request(input, init), identity !== undefined ? { identity } : {});
  return new AXEClient(axe.describe(), { ...rest, fetch: inProcess });
}

/**
 * Invoke one action in-process and return the raw result envelope. Adds an idempotency
 * key for mutating actions.
 */
export async function invokeAction<O = JsonValue>(
  axe: AxeLike,
  name: string,
  input: unknown,
  options: {
    identity?: { onBehalfOf: string } | null;
    idempotencyKey?: string;
    headers?: Record<string, string>;
  } = {},
): Promise<Result<O>> {
  const manifest = axe.describe();
  const def = manifest.actions.find((a) => a.name === name);
  const body: Record<string, unknown> = { input };
  if (def && !def.readOnly) body["idempotencyKey"] = options.idempotencyKey ?? crypto.randomUUID();
  const url = `${manifest.baseUrl.replace(/\/$/, "")}${WIRE.path.actions}/${encodeURIComponent(name)}`;
  const res = await axe.handle(
    new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...(options.headers ?? {}) },
      body: JSON.stringify(body),
    }),
    options.identity !== undefined ? { identity: options.identity } : {},
  );
  return (await res.json()) as Result<O>;
}

/** A valid sample payload for every well-known kind, for exercising `/axe/continue` in tests and conformance. */
export const SAMPLE_PAYLOADS: Readonly<Record<string, JsonValue>> = Object.freeze({
  [WIRE.kind.paymentCard]: {
    token: "tok_conformance",
    provider: "stripe",
    last4: "4242",
    brand: "visa",
  },
  [WIRE.kind.paymentAchDebit]: {
    accountHolderName: "Conformance Tester",
    routingNumber: "021000021",
    accountNumber: "000123456789",
    accountType: "checking",
    amount: 1,
    currency: "USD",
    authorizedAt: "2026-01-01T00:00:00Z",
    authorizationText: "Conformance test authorization.",
  },
  [WIRE.kind.paymentWireConfirmation]: {
    referenceNumber: "CONF-0001",
    amount: 1,
    currency: "USD",
    sentAt: "2026-01-01T00:00:00Z",
  },
  [WIRE.kind.paymentInvoice]: {
    companyName: "Conformance Co",
    billingEmail: "ap@conformance.example",
  },
  [WIRE.kind.identityGovernmentId]: {
    documentType: "passport",
    documentNumber: "X0000000",
    issuingCountry: "US",
    fullName: "Conformance Tester",
  },
  [WIRE.kind.identityDateOfBirth]: { dateOfBirth: "1990-01-01" },
  [WIRE.kind.identitySsnLast4]: { last4: "0000" },
  [WIRE.kind.documentUrl]: {
    url: "https://conformance.example/sample.pdf",
    mimeType: "application/pdf",
  },
  [WIRE.kind.documentBase64]: {
    filename: "sample.pdf",
    mimeType: "application/pdf",
    contentBase64: "JVBERi0=",
  },
  [WIRE.kind.contactEmail]: { email: "tester@conformance.example" },
  [WIRE.kind.contactPhone]: { phone: "+14255550100" },
  [WIRE.kind.contactAddress]: {
    line1: "1 Conformance Way",
    city: "Bellevue",
    region: "WA",
    postalCode: "98004",
    country: "US",
  },
  [WIRE.kind.consentTerms]: {
    policyUrl: "https://conformance.example/terms",
    policyVersion: "test",
    scope: "conformance",
    acceptedAt: "2026-01-01T00:00:00Z",
  },
});

/** Sample payload for a kind, or undefined for custom kinds. */
export function samplePayload(kind: string): JsonValue | undefined {
  return SAMPLE_PAYLOADS[kind];
}

/** Names of every well-known kind. */
export const WELL_KNOWN_KIND_NAMES: readonly string[] = WELL_KNOWN_KINDS.map((k) => k.kind);
