import { describe, expect, it } from "vitest";
import { validateJsonSchema, schemasStructurallyEqual } from "../src/json-schema";
import {
  kinds,
  kindJsonSchema,
  WELL_KNOWN_KINDS,
  accept,
  customKind,
  withMimeTypes,
  isValidKindName,
  suggestedReason,
} from "../src/kinds";
import { z } from "zod";
import { toJsonSchema } from "../src/zod-json-schema";

describe("validateJsonSchema", () => {
  const schema = {
    type: "object",
    properties: {
      name: { type: "string", minLength: 2 },
      age: { type: "integer", minimum: 0, maximum: 150 },
      email: { type: "string", format: "email" },
      role: { enum: ["a", "b"] },
      tags: { type: "array", items: { type: "string" }, maxItems: 2 },
      addr: { $ref: "#/$defs/Addr" },
      when: { type: ["string", "null"], format: "date" },
      either: { anyOf: [{ type: "number" }, { type: "boolean" }] },
    },
    required: ["name"],
    additionalProperties: false,
    $defs: {
      Addr: {
        type: "object",
        properties: { zip: { type: "string", pattern: "^[0-9]{5}$" } },
        required: ["zip"],
      },
    },
  };

  it("accepts valid values", () => {
    expect(
      validateJsonSchema(schema, {
        name: "Al",
        age: 3,
        email: "a@b.co",
        role: "a",
        tags: ["x"],
        addr: { zip: "98004" },
        when: null,
        either: true,
      }),
    ).toEqual([]);
  });

  it("reports each problem with a pointer path", () => {
    const issues = validateJsonSchema(schema, {
      name: "A",
      age: -1,
      email: "nope",
      role: "c",
      tags: ["1", "2", "3"],
      addr: { zip: "abc" },
      when: "2026-13-01x",
      extra: 1,
      either: "s",
    });
    const byPath = Object.fromEntries(issues.map((i) => [i.path, i.message]));
    expect(byPath["/name"]).toContain("at least 2");
    expect(byPath["/age"]).toContain(">= 0");
    expect(byPath["/email"]).toContain("email");
    expect(byPath["/role"]).toContain("one of");
    expect(byPath["/tags"]).toContain("at most 2");
    expect(byPath["/addr/zip"]).toContain("pattern");
    expect(byPath["/when"]).toContain("date");
    expect(byPath["/extra"]).toContain("not a known property");
    expect(byPath["/either"]).toContain("alternative");
    expect(validateJsonSchema(schema, {})[0]).toEqual({
      path: "/name",
      message: "is required",
      expected: "present",
    });
    expect(validateJsonSchema(schema, { name: 5 })[0]!.expected).toBe("string");
  });

  it("agrees with Zod on every well-known kind schema", () => {
    const good: Record<string, unknown> = {
      "payment.card": { token: "tok_1", provider: "stripe", last4: "4242" },
      "payment.ach-debit": {
        accountHolderName: "D",
        routingNumber: "125000024",
        accountNumber: "0001234",
        accountType: "checking",
        amount: 1,
        currency: "USD",
        authorizedAt: "2026-01-01T00:00:00Z",
        authorizationText: "ok",
      },
      "payment.wire-confirmation": {
        referenceNumber: "R1",
        amount: 500,
        currency: "USD",
        sentAt: "2026-01-01T00:00:00Z",
      },
      "payment.invoice": { companyName: "Acme", billingEmail: "ap@acme.example" },
      "identity.government-id": {
        documentType: "passport",
        documentNumber: "X1",
        issuingCountry: "US",
        fullName: "Dana Whitfield",
      },
      "identity.date-of-birth": { dateOfBirth: "1990-01-01" },
      "identity.ssn-last-4": { last4: "1234" },
      "document.url": { url: "https://files.example/t.pdf", mimeType: "application/pdf" },
      "document.base64": { filename: "t.pdf", mimeType: "application/pdf", contentBase64: "AAAA" },
      "contact.email": { email: "a@b.co" },
      "contact.phone": { phone: "+14255550100" },
      "contact.address": { line1: "1 Main", city: "Bellevue", country: "US" },
      "consent.terms": {
        policyUrl: "https://x.example/terms",
        policyVersion: "2026-01",
        scope: "background-check",
        acceptedAt: "2026-01-01T00:00:00Z",
      },
    };
    for (const k of WELL_KNOWN_KINDS) {
      const schema = kindJsonSchema(k);
      const value = good[k.kind];
      expect(value, k.kind).toBeDefined();
      expect(validateJsonSchema(schema, value), k.kind).toEqual([]);
      expect(k.schema.safeParse(value).success, k.kind).toBe(true);
      // An extra property fails in both.
      expect(validateJsonSchema(schema, { ...(value as object), bogus: 1 }).length).toBeGreaterThan(
        0,
      );
      expect(k.schema.safeParse({ ...(value as object), bogus: 1 }).success).toBe(false);
      expect(validateJsonSchema(schema, {}).length).toBeGreaterThan(0);
    }
  });
});

describe("kinds", () => {
  it("accept() builds an entry and refuses to un-sensitize", () => {
    const e = accept(kinds.payment.achDebit, {
      description: "Deposit",
      instructions: "Use memo APP-1",
    });
    expect(e.kind).toBe("payment.ach-debit");
    expect(e.sensitive).toBe(true);
    expect(e.title).toBe("Bank account (ACH)");
    expect(() => accept(kinds.identity.ssnLast4, { sensitive: false })).toThrow(
      /cannot be marked sensitive: false/,
    );
    expect(accept(kinds.contact.email, { sensitive: true }).sensitive).toBe(true);
  });

  it("custom kinds must use the x- prefix", () => {
    expect(() =>
      customKind({
        kind: "payment.crypto",
        title: "C",
        description: "d",
        schema: z.object({}),
        sensitive: true,
      }),
    ).toThrow(/x-<org>/);
    const k = customKind({
      kind: "x-oakridge.guarantor-form",
      title: "Guarantor",
      description: "d",
      schema: z.object({ name: z.string() }),
      sensitive: false,
    });
    expect(k.kind).toBe("x-oakridge.guarantor-form");
    expect(isValidKindName("x-oakridge.guarantor-form")).toBe(true);
    expect(isValidKindName("oakridge.form")).toBe(false);
    expect(isValidKindName("payment.card")).toBe(true);
  });

  it("withMimeTypes restricts the schema", () => {
    const pdfOnly = withMimeTypes(kinds.document.url, ["application/pdf"]);
    expect(
      pdfOnly.schema.safeParse({ url: "https://x.example/a.pdf", mimeType: "image/png" }).success,
    ).toBe(false);
    expect(
      pdfOnly.schema.safeParse({ url: "https://x.example/a.pdf", mimeType: "application/pdf" })
        .success,
    ).toBe(true);
    expect(() => withMimeTypes(kinds.contact.email as never, ["x"])).toThrow(/no mimeType/);
  });

  it("suggests conventional reasons by namespace", () => {
    expect(suggestedReason("payment.card")).toBe("payment_required");
    expect(suggestedReason("identity.ssn-last-4")).toBe("identity_required");
    expect(suggestedReason("document.url")).toBe("document_required");
    expect(suggestedReason("consent.terms")).toBe("consent_required");
    expect(suggestedReason("contact.email")).toBeUndefined();
    expect(suggestedReason("x-acme.thing")).toBeUndefined();
  });

  it("structural equality ignores annotations [P-HON-5]", () => {
    const a = kindJsonSchema(kinds.contact.email);
    const b = toJsonSchema(
      z.object({ email: z.string().email().describe("Your email") }).strict(),
      "input",
    );
    expect(schemasStructurallyEqual(a, b)).toBe(true);
    const c = toJsonSchema(
      z.object({ email: z.string().email(), name: z.string() }).strict(),
      "input",
    );
    expect(schemasStructurallyEqual(a, c)).toBe(false);
  });
});
