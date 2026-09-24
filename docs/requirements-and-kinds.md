# Requirements and kinds

A requirement is the second rung of the [escalation ladder](concepts.md#the-escalation-ladder): the site cannot finish, but it can say exactly what would let it finish, in a shape an agent may already hold. This page is the full contract for `needs_input`, the registry of well-known kinds, how to use them in code, and how the server validates what comes back.

## The contract

A `needs_input` result has six members. This is the wire JSON from [spec §8.1](../spec/AXE-PROTOCOL.md#81-the-result), the Oakridge Rentals deposit:

```json
{
  "status": "needs_input",
  "reason": "payment_required",
  "message": "A refundable $500 holding deposit is required to submit. Cards are not accepted.",
  "accepts": [
    {
      "kind": "payment.ach-debit",
      "title": "Bank account (ACH)",
      "description": "Authorize a one-time ACH debit for the deposit.",
      "schema": { "type": "object", "properties": { "...": {} } },
      "sensitive": true
    },
    {
      "kind": "payment.wire-confirmation",
      "title": "Wire transfer",
      "description": "Provide the wire reference number after sending to the instructions below.",
      "schema": { "type": "object", "properties": { "...": {} } },
      "sensitive": false,
      "instructions": "Wire $500 to Oakridge Rentals, routing 021000021, account 123456789, memo APP-8812."
    }
  ],
  "continuationToken": "eyJ...",
  "expiresAt": "2026-09-23T19:40:00Z",
  "fallback": {
    "reason": "payment_required",
    "instructions": "Pay the holding deposit by ACH or wire on the application page.",
    "url": "https://oakridge-rentals.example/applications/APP-8812/deposit?axe_handoff=h_...",
    "resumeToken": "eyJ...",
    "expiresAt": "2026-09-24T18:40:00Z",
    "whatAgentShouldSayToUser": "Oakridge only takes the deposit by bank transfer, and I don't have bank details I can use for you. Can you complete it on their site? I'll finish the application once it's paid."
  }
}
```

| Member              | Meaning                                                                                                                                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reason`            | A short snake_case code, stable across calls. Use the conventions `payment_required`, `consent_required`, `identity_required`, `document_required`, or a site-specific code. Agents branch and log on it.                                    |
| `message`           | Agent-facing prose explaining the requirement in the context of this call: the amount, the document, the policy. Agent-read text under the [honesty rules](audit.md#honesty-rules).                                                          |
| `accepts`           | At least one entry, ordered from most automatable to least. Agents try them in order.                                                                                                                                                        |
| `continuationToken` | Signed and opaque. The agent presents it to `/axe/continue` with the chosen `kind` and a `payload`.                                                                                                                                          |
| `expiresAt`         | When the token stops working. Fifteen minutes by default.                                                                                                                                                                                    |
| `fallback`          | Optional. A complete Handoff (see [Human handoff](human-handoff.md)). An agent that can satisfy none of `accepts` presents it to the user without another round trip. Without it, the agent asks its user for the information and continues. |

The `accepts` entry is the unit an agent's wallet or credential store matches on:

| Member         | Meaning                                                                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `kind`         | A well-known kind from the registry below, or a custom kind of the form `x-<org>.<name>`.                                                                                                        |
| `title`        | A short label for the option. Defaults to the registry title.                                                                                                                                    |
| `description`  | What this requirement is for, in this action. "Authorize a one-time ACH debit for the deposit", not "ACH".                                                                                       |
| `schema`       | JSON Schema for `payload`. For a well-known kind, the registry schema or a restriction of it.                                                                                                    |
| `sensitive`    | Whether the agent must confirm with the user before sending. Payment credentials and identity attributes are always sensitive.                                                                   |
| `instructions` | Optional agent-read text the agent relays to the user or acts on: wire details, where to download a form, what a policy says. Anything the agent needs beyond the schema to produce the payload. |

The difference between `description` and `instructions`: `description` tells the agent what the option is; `instructions` tells it how to get the thing. A `payment.wire-confirmation` entry needs the bank details in `instructions` or no one can send the wire. A `consent.terms` entry should carry the policy title and a one-sentence summary so the agent can show the user what they are agreeing to.

## The well-known kind registry

Thirteen kinds in five namespaces, normative in [`spec/KINDS.md`](../spec/KINDS.md). Every kind's payload is an object with no additional properties; strings are non-empty; money is a number in major units with an ISO 4217 `currency`. The JSON Schemas under [`spec/schemas/kinds/`](../spec/schemas/kinds/) are generated from `@axe/core/kinds`, and a test fails if the two drift.

The registry exists so agents can hold credentials keyed by kind. If your requirement fits one of these, use it: an agent that holds a `payment.card` token fulfills your requirement in one confirmation, and cannot fulfill `x-yourorg.card` at all.

### payment

Kinds in this namespace name what the agent submits, not what the site does with it. The SDK never touches a card number: `payment.card` carries a PSP token you charge through the provider you already use.

`payment.card` — sensitive.

| Member              | Type                   | Required | Meaning                                                     |
| ------------------- | ---------------------- | -------- | ----------------------------------------------------------- |
| `token`             | string                 | yes      | PSP-issued single-use or network token.                     |
| `provider`          | string                 | yes      | PSP identifier: `stripe`, `adyen`, `braintree`.             |
| `brand`             | string                 | no       | Card network, lowercase.                                    |
| `last4`             | string, four digits    | no       | For display and confirmation.                               |
| `expMonth`          | integer 1–12           | no       |                                                             |
| `expYear`           | integer, four digits   | no       |                                                             |
| `billingPostalCode` | string                 | no       |                                                             |
| `amount`            | number ≥ 0             | no       | Amount the user authorized, when the requirement names one. |
| `currency`          | string, three capitals | no       |                                                             |

`payment.ach-debit` — sensitive. Authorization for a one-time debit from a US bank account.

| Member              | Type                    | Required | Meaning                                                     |
| ------------------- | ----------------------- | -------- | ----------------------------------------------------------- |
| `accountHolderName` | string                  | yes      |                                                             |
| `routingNumber`     | string, nine digits     | yes      | ABA routing number.                                         |
| `accountNumber`     | string, 4–17 digits     | yes      |                                                             |
| `accountType`       | `checking` or `savings` | yes      |                                                             |
| `amount`            | number ≥ 0              | yes      | Amount authorized.                                          |
| `currency`          | string, three capitals  | yes      | `USD` for ACH.                                              |
| `authorizedAt`      | date-time               | yes      | When the user gave authorization.                           |
| `authorizationText` | string                  | yes      | The exact text the user agreed to. Required by NACHA rules. |

`payment.wire-confirmation` — not sensitive. The site supplies bank details in `instructions`; the agent submits proof that the wire was sent.

| Member            | Type                   | Required | Meaning                      |
| ----------------- | ---------------------- | -------- | ---------------------------- |
| `referenceNumber` | string                 | yes      | Bank reference or IMAD/OMAD. |
| `amount`          | number ≥ 0             | yes      |                              |
| `currency`        | string, three capitals | yes      |                              |
| `sentAt`          | date-time              | yes      |                              |
| `bankName`        | string                 | no       | Sending bank.                |

`payment.invoice` — not sensitive. A request to be invoiced on net terms; the site decides whether to grant them.

| Member                | Type            | Required | Meaning                                 |
| --------------------- | --------------- | -------- | --------------------------------------- |
| `companyName`         | string          | yes      |                                         |
| `billingEmail`        | string, `email` | yes      |                                         |
| `purchaseOrderNumber` | string          | no       |                                         |
| `netTermsDays`        | integer 0–180   | no       | Requested terms; the site may override. |
| `taxId`               | string          | no       | VAT or EIN when the site requires it.   |

### identity

Every identity kind is sensitive.

`identity.government-id` — details from a government-issued document.

| Member           | Type                                                                | Required | Meaning                     |
| ---------------- | ------------------------------------------------------------------- | -------- | --------------------------- |
| `documentType`   | `passport`, `drivers-license`, `national-id`, or `residence-permit` | yes      |                             |
| `documentNumber` | string                                                              | yes      |                             |
| `issuingCountry` | string, two capitals                                                | yes      | ISO 3166-1 alpha-2.         |
| `fullName`       | string                                                              | yes      | As printed on the document. |
| `dateOfBirth`    | date                                                                | no       |                             |
| `expiresOn`      | date                                                                | no       |                             |

`identity.date-of-birth`

| Member        | Type | Required |
| ------------- | ---- | -------- |
| `dateOfBirth` | date | yes      |

`identity.ssn-last-4`

| Member  | Type                | Required |
| ------- | ------------------- | -------- |
| `last4` | string, four digits | yes      |

### document

Not sensitive by default. Mark a document kind sensitive when the document is: a transcript, a medical record, a tax form. Restrict `mimeType` when you accept only some types (see withMimeTypes below), and state a size limit in `description`. The SDK validates the shape of a document payload, not its size; enforce the limit in your handler, as the Northgate example below does.

`document.url` — a document the site fetches from a URL the agent controls or the user has shared.

| Member      | Type          | Required | Meaning                                                 |
| ----------- | ------------- | -------- | ------------------------------------------------------- |
| `url`       | string, `uri` | yes      | HTTPS. The site fetches it once; it may be short-lived. |
| `mimeType`  | string        | yes      | For example `application/pdf`.                          |
| `filename`  | string        | no       |                                                         |
| `sizeBytes` | integer ≥ 0   | no       |                                                         |

`document.base64` — inline upload.

| Member          | Type   | Required | Meaning                              |
| --------------- | ------ | -------- | ------------------------------------ |
| `filename`      | string | yes      |                                      |
| `mimeType`      | string | yes      |                                      |
| `contentBase64` | string | yes      | Standard base64, no data URL prefix. |

### contact

Not sensitive by default. Mark contact kinds sensitive when you collect them for a minor or in a regulated context.

`contact.email`

| Member  | Type            | Required |
| ------- | --------------- | -------- |
| `email` | string, `email` | yes      |

`contact.phone`

| Member          | Type          | Required | Meaning                  |
| --------------- | ------------- | -------- | ------------------------ |
| `phone`         | string, E.164 | yes      | `+` then 7 to 15 digits. |
| `canReceiveSms` | boolean       | no       |                          |

`contact.address`

| Member       | Type                 | Required | Meaning                         |
| ------------ | -------------------- | -------- | ------------------------------- |
| `line1`      | string               | yes      |                                 |
| `line2`      | string               | no       |                                 |
| `city`       | string               | yes      |                                 |
| `region`     | string               | no       | State, province, or prefecture. |
| `postalCode` | string               | no       |                                 |
| `country`    | string, two capitals | yes      | ISO 3166-1 alpha-2.             |

### consent

`consent.terms` — not sensitive. Acknowledgment of one specific policy version for one specific scope. Agents show the policy to the user before fulfilling it.

| Member          | Type          | Required | Meaning                                                                 |
| --------------- | ------------- | -------- | ----------------------------------------------------------------------- |
| `policyUrl`     | string, `uri` | yes      | The document the user is agreeing to.                                   |
| `policyVersion` | string        | yes      | Exact version identifier or date of the document.                       |
| `scope`         | string        | yes      | What the consent covers, such as `rental-application-background-check`. |
| `acceptedAt`    | date-time     | yes      |                                                                         |
| `acceptedBy`    | string        | no       | Name or identifier of the person consenting, when the site requires it. |

### Sensitivity is a floor

The registry's `sensitive` values are minimums. You may mark any kind sensitive; you may not mark a sensitive kind otherwise. `accept` throws if you pass `sensitive: false` for `payment.card`, `payment.ach-debit`, or any identity kind, with a message that cites the rule.

## Using kinds in code

Everything is in `@axe/core/kinds` (also re-exported from `@axe/core`).

- `kinds` is the registry as typed definitions grouped by namespace: `kinds.document.url`, `kinds.consent.terms`, and so on. Each definition carries the wire name, a title, a description, a Zod schema, and the default `sensitive`.
- `accept` builds an `accepts` entry from a definition. Pass `description` (what this requirement is for here), and optionally `title`, `instructions`, and `sensitive: true`.
- **withMimeTypes** restricts a document kind to specific MIME types by tightening `mimeType` to an enum. The result is a restriction of the registry schema, which the spec permits.
- **customKind** defines a kind under your own namespace. The name must be `x-<org>.<name>`; anything else throws.

Northgate admissions accepts a transcript by URL or inline, PDF only, and treats both as sensitive:

<!-- include: examples/requirements-and-kinds/transcript.ts#imports -->
```ts
import { createAXE, action, z } from "@axe/core";
import { kinds, accept, withMimeTypes } from "@axe/core/kinds";
```
<!-- /include -->

<!-- include: examples/requirements-and-kinds/transcript.ts#action -->
```ts
axe.register(
  action("transcripts.upload", {
    title: "Upload a transcript",
    description:
      "Attaches an official transcript to the signed-in applicant's application. Accepts a PDF by URL or as an inline upload of at most 10 MB. Returns the document id and the updated list of missing documents.",
    risk: "low",
    idempotent: true,
    reversible: true,
    auth: "user",
    input: z
      .object({
        issuingSchool: z.string().describe("Name of the school that issued the transcript"),
      })
      .strict(),
    output: z.object({ documentId: z.string(), missingDocuments: z.array(z.string()) }),
    handler: async ({ input, context, needsInput }) =>
      needsInput({
        reason: "document_required",
        message: `Provide the official transcript from ${input.issuingSchool} as a PDF.`,
        accepts: [
          // Most automatable first: an agent that already holds the file at a URL needs no encoding step.
          accept(withMimeTypes(kinds.document.url, ["application/pdf"]), {
            description:
              "An HTTPS URL to the transcript PDF. Northgate fetches it once, within 15 minutes of this response.",
            sensitive: true,
          }),
          accept(withMimeTypes(kinds.document.base64, ["application/pdf"]), {
            description: "The transcript PDF inline, at most 10 MB before base64 encoding.",
            sensitive: true,
          }),
        ],
        // Delivered to onContinue. Never sent to the agent.
        state: { applicantId: context.onBehalfOf!, issuingSchool: input.issuingSchool },
      }),
    onContinue: async ({ kind, payload, state, fail }) => {
      const { applicantId, issuingSchool } = state as {
        applicantId: string;
        issuingSchool: string;
      };
      // The payload already validated against the chosen entry's schema; the casts only name the shape.
      const file =
        kind === "document.url"
          ? await fetchDocument(payload as { url: string; mimeType: string })
          : decodeDocument(payload as { mimeType: string; contentBase64: string });
      if (file.bytes.byteLength > MAX_TRANSCRIPT_BYTES) {
        // An error from onContinue does not consume the token; the agent can retry with a smaller file.
        return fail("invalid_input", "The transcript is larger than 10 MB.", {
          issues: [
            {
              path: "/payload",
              message: "decoded size exceeds 10 MB",
              expected: "at most 10485760 bytes",
            },
          ],
        });
      }
      const documentId = await documents.store(applicantId, issuingSchool, file);
      return { documentId, missingDocuments: await documents.missing(applicantId) };
    },
  }),
);
```
<!-- /include -->

Three things to notice. The `state` object carries the applicant id and the school from the first call into `onContinue` without ever reaching the agent. The `payload` arrives already validated against the chosen entry's schema, so the casts only name the shape. And a `fail` from `onContinue` leaves the token usable, so the agent can retry with a smaller file.

Sunrise Yoga's booking action shows the two most common `reason` codes on one action. A student who has not acknowledged the current liability waiver gets `consent_required`; a student without a membership gets `payment_required`. Both `accepts` are one entry long because each requirement has one natural shape:

<!-- include: examples/requirements-and-kinds/waiver.ts#waiver -->
```ts
const WAIVER = {
  url: "https://sunriseyoga.example/policies/liability-waiver",
  version: "2026-03",
  scope: "class-attendance-liability",
};

// The registry schema, tightened to this exact policy. The server then rejects a consent
// for any other document or version at validation time (spec [K-3], [P-HON-6]).
const waiverConsent: AcceptInput = {
  kind: kinds.consent.terms.kind,
  title: "Liability waiver",
  description: `Acknowledge the Sunrise Yoga liability waiver, version ${WAIVER.version}, for class attendance.`,
  schema: kinds.consent.terms.schema
    .extend({
      policyUrl: z.enum([WAIVER.url]),
      policyVersion: z.enum([WAIVER.version]),
      scope: z.enum([WAIVER.scope]),
    })
    .strict(),
  sensitive: false,
  instructions: `Liability waiver: the student confirms they are able to participate and releases Sunrise Yoga from liability for ordinary injuries during class. Full text at ${WAIVER.url}.`,
};
```
<!-- /include -->

<!-- include: examples/requirements-and-kinds/waiver.ts#action -->
```ts
axe.register(
  action("classes.book", {
    title: "Book a spot in a class",
    description:
      "Reserves one spot in a class for the signed-in student. First-time students acknowledge the liability waiver; students without a membership pay the drop-in rate. Returns the booking id. Cancellation is free up to 12 hours before the class.",
    risk: "medium",
    idempotent: true,
    reversible: true,
    auth: "user",
    input: z.object({ classId: z.string().describe("Class id from classes.search") }).strict(),
    output: z.object({ bookingId: z.string(), classId: z.string() }),
    handler: async ({ input, context }) => nextStep(input.classId, context.onBehalfOf!),
    onContinue: async ({ kind, payload, state }) => {
      const { classId, studentId } = state as { classId: string; studentId: string };
      if (kind === "consent.terms") {
        await students.recordWaiver(
          studentId,
          payload as { policyVersion: string; acceptedAt: string },
        );
      } else if (kind === "payment.card") {
        await payments.chargeDropIn(
          studentId,
          classId,
          payload as { token: string; provider: string },
        );
      }
      return nextStep(classId, studentId);
    },
  }),
);

async function nextStep(classId: string, studentId: string) {
  const student = await students.get(studentId);
  const cls = await classes.get(classId);
  if (student.waiverVersion !== WAIVER.version) {
    return needsInput({
      reason: "consent_required",
      message:
        "Sunrise Yoga requires an acknowledged liability waiver before a first class, and again when the waiver changes.",
      accepts: [waiverConsent],
      state: { classId, studentId },
    });
  }
  if (!student.hasMembership && !(await payments.hasPaid(studentId, classId))) {
    return needsInput({
      reason: "payment_required",
      message: `The drop-in rate for this class is $${cls.dropInUsd}. Members attend at no charge.`,
      accepts: [
        accept(kinds.payment.card, {
          description: `Card token to charge $${cls.dropInUsd} for one drop-in class.`,
        }),
      ],
      state: { classId, studentId },
    });
  }
  return classes.book(classId, studentId);
}
```
<!-- /include -->

The waiver entry is built by hand rather than with `accept` so that the schema pins `policyUrl`, `policyVersion`, and `scope` to the exact policy. A consent for any other document fails validation on `/axe/continue` before your code runs. That is what the consent scope rule asks for, enforced by the schema rather than by a check you might forget.

## How agents fulfill kinds

An agent that supports AXE holds a wallet and a credential store keyed by kind. When a `needs_input` arrives, it walks `accepts` in order and asks each store whether it can produce a payload for that kind. `@axe/client` models this as a `Fulfiller`: a list of kinds and a function that returns a payload or nothing. The client's `run` drives the whole ladder: invoke, try each `accepts` entry against the registered `fulfillers`, call `/axe/continue`, follow a further `needs_input`, poll `pending`, and surface a handoff only when nothing else works.

Before any payload for an entry marked `sensitive` is sent, the client calls its `confirm` callback with the action, the entry, the payload, and your `message`. The agent shows the user a summary ("Oakridge needs a $500 refundable deposit by bank transfer. Use your checking account ending 4471?") and sends only on a yes. A client with no `confirm` skips sensitive options entirely, which is why a requirement that offers only sensitive kinds should carry a `fallback`.

This is also why `description` and `instructions` matter: they are what the agent reads aloud. [For agent builders](for-agent-builders.md) covers the client side in full.

## Custom kinds

A custom kind is legitimate when nothing in the registry describes the payload: a guarantor agreement, a pet's vaccination record, a purchase order in a format your ERP dictates. Oakridge Rentals needs a guarantor for some applicants:

<!-- include: examples/requirements-and-kinds/custom.ts#kind -->
```ts
// Nothing in the registry describes a guarantor agreement, so it is a custom kind.
// A custom kind that merely renamed payment.card or contact.address would be a fake kind ([P-HON-5]).
export const guarantorForm = customKind({
  kind: "x-oakridge.guarantor-form",
  title: "Guarantor agreement",
  description:
    "Who guarantees the lease, their relationship to the applicant, and the signed Oakridge guarantor form.",
  schema: z
    .object({
      guarantorName: z.string().min(1),
      relationship: z.enum(["parent", "guardian", "employer", "other"]),
      annualIncomeUsd: z.number().int().nonnegative(),
      signedFormUrl: z.string().url().describe("HTTPS URL of the signed guarantor form, PDF"),
    })
    .strict(),
  sensitive: true,
});
```
<!-- /include -->

<!-- include: examples/requirements-and-kinds/custom.ts#use -->
```ts
export function guarantorRequired(applicationId: string, rentUsd: number) {
  return needsInput({
    reason: "guarantor_required",
    message: `Applicants with verified income under three times the rent ($${rentUsd * 3}/month) need a guarantor.`,
    accepts: [
      accept(guarantorForm, {
        instructions:
          "Download the guarantor form at https://oakridge-rentals.example/forms/guarantor.pdf, have the guarantor sign it, and provide a URL Oakridge can fetch the signed PDF from.",
      }),
    ],
    state: { applicationId },
  });
}
```
<!-- /include -->

Three rules apply:

1. **Naming.** Custom kinds are `x-<org>.<name>`, kebab-case. customKind throws otherwise, and the well-known namespaces are closed to sites.
2. **No fake kinds.** A custom kind whose schema is structurally equivalent to a well-known kind's schema is a hard failure in `axe audit` and the conformance suite (spec [P-HON-5]). Renaming `payment.card` to `x-yourorg.card` does not give you anything; it forces every agent that holds a card token into a handoff it did not need.
3. **Consent scope.** A `consent.terms` requirement must name the exact `policyUrl`, `policyVersion`, and `scope` the action needs, and must not bundle consent for unrelated purposes (spec [P-HON-6]). If you need two consents, return two requirements, as the chaining section shows.

Expect agents to need a human for a custom kind more often than for a well-known one, since no wallet is pre-populated with it. Give the entry `instructions` that tell the agent exactly where to obtain the thing, and attach a `fallback` so a human can do it on your site.

## Validation on `/axe/continue`

The agent posts `{ continuationToken, kind, payload }`. The server:

1. Verifies the token's signature, expiry, binding, and tenant, and re-establishes the acting principal: the same user, the same site key (verified again), or none, exactly as when the token was minted. A tampered, expired, wrong-tenant, or wrong-principal token is `not_found`; the response does not say which.
2. Rejects a `kind` that is not in the original `accepts` with `invalid_input`; `issues` names `/kind` and lists the accepted kinds under `expected`.
3. Validates `payload` against that entry's stored JSON Schema. On failure it returns `invalid_input` with `issues`, each `path` a JSON Pointer prefixed with `/payload`, and **does not consume the token**. Agents fix their own mistakes and retry with the same token.
4. Claims the token, then runs your `onContinue`. Any status other than `error` consumes the token and stores the envelope. A second `/axe/continue` with the same token, kind, and payload returns that envelope without running `onContinue` again (a lost response is recoverable); with a different kind or payload it returns `conflict`. While the first is still running, a second gets a retryable `conflict` with `operationStatus` set to `in_progress`.

The validator is the SDK's own JSON Schema validator, running against the schema stored with the token, because a `TokenStore` backed by Redis can hold JSON but not Zod. Consequently the contract is the JSON-Schema-expressible subset of your Zod schema: types, `required`, `enum`, `pattern`, `format`, string lengths, numeric bounds. Zod refinements are not enforced on continue. Anything a refinement would have checked belongs in `onContinue`, returning `fail` with `issues`, as the transcript size check above does. The reasoning is in [DECISIONS.md](../DECISIONS.md).

## Chaining requirements

`onContinue` may return anything a handler may return. Returning another `needsInput` mints a new `continuationToken` and consumes the one just used; the agent sees a second `needs_input` and repeats. Returning `handoff` produces `needs_human`; returning `pending` starts a poll. `@axe/client` follows chains up to a configurable step limit.

Northgate verifies identity before asking for a FERPA release:

<!-- include: examples/requirements-and-kinds/chain.ts#action -->
```ts
axe.register(
  action("transcripts.release", {
    title: "Release a transcript to another institution",
    description:
      "Sends the signed-in applicant's official transcript to a named institution. Requires the applicant's date of birth for verification and a FERPA release naming that institution. Returns the release id and the date the transcript will arrive by.",
    risk: "high",
    idempotent: true,
    reversible: false,
    auth: "user",
    input: z
      .object({ recipient: z.string().describe("Institution that will receive the transcript") })
      .strict(),
    output: z.object({ releaseId: z.string(), deliveryBy: z.string() }),
    handler: async ({ input, context, needsInput }) =>
      needsInput({
        reason: "identity_required",
        message: "Confirm the applicant's date of birth before a transcript can be released.",
        accepts: [
          accept(kinds.identity.dateOfBirth, {
            description: "Date of birth as entered on the application.",
          }),
        ],
        state: { applicantId: context.onBehalfOf!, recipient: input.recipient, verified: false },
      }),
    onContinue: async ({ kind, payload, state, needsInput, fail }) => {
      const s = state as { applicantId: string; recipient: string; verified: boolean };
      if (kind === "identity.date-of-birth") {
        const matches = await registrar.verifyDateOfBirth(
          s.applicantId,
          (payload as { dateOfBirth: string }).dateOfBirth,
        );
        if (!matches) {
          // An error does not consume the token: the agent can correct the value and retry.
          return fail("invalid_input", "The date of birth does not match the application.", {
            issues: [{ path: "/payload/dateOfBirth", message: "does not match the application" }],
          });
        }
        // Second requirement. The response carries a new continuationToken; the first is consumed.
        return needsInput({
          reason: "consent_required",
          message: `Authorize release of the official transcript to ${s.recipient}.`,
          accepts: [
            accept(kinds.consent.terms, {
              description: `FERPA release covering one transcript sent to ${s.recipient}.`,
              instructions: `FERPA release, version 2026-01: Northgate may send the applicant's official transcript to ${s.recipient} once. Full text at https://admissions.northgate.example/policies/ferpa-release.`,
            }),
          ],
          state: { ...s, verified: true },
        });
      }
      if (kind === "consent.terms" && s.verified) {
        return registrar.release(
          s.applicantId,
          s.recipient,
          payload as { policyUrl: string; policyVersion: string; acceptedAt: string },
        );
      }
      // Unreachable in practice: the server rejects a kind that is not in the token's accepts.
      return fail("conflict", "Requirements were answered out of order. Call the action again.");
    },
  }),
);
```
<!-- /include -->

Carry what you have learned forward in `state`; each new `needsInput` gets its own. Keep chains short. An agent that has answered three requirements and receives a fourth will reasonably tell its user the site is not ready for agents. If two requirements are independent, consider whether one `needs_input` with two entries and a handler that accepts either is the better design; if both are always needed, a chain is honest about it.

## Security for sensitive payloads

- **The SDK never logs a payload and never puts one in an event.** Events carry the kind, the status, and the ladder position; the event type has no field a payload could occupy.
- **Your handler must not log it either.** Pass a `payment.card` token straight to your PSP; pass ACH details to the processor and keep the authorization record it returns; store the fact that identity was verified, not the document number.
- **Short lifetime.** Continuation tokens expire in 15 minutes by default. Shorten it with the ttlSeconds option on `needsInput` when every entry is sensitive; there is no reason for a card token to be presentable for longer than the agent needs to confirm with its user.
- **Single use.** A consumed token runs nothing again: the same payload gets the original envelope, a different one `conflict`.
- **Bound.** The token is tied to the action, the input hash, the acting principal, and the tenant. Presenting it under a different identity, or anonymously when it was minted for someone, is `not_found`. A token minted anonymously is a bearer credential: whoever holds it and the exact payload can read the stored envelope.
- **HTTPS only.** Tokens are bearer credentials and payloads are credentials. Serve `baseUrl` over HTTPS and nothing else.
- **Store only what the process needs.** Retention is a policy question; state it in `policies.dataRetention` so agents can relay it.

The threat model as a whole is in [Security](security.md).

## Next steps

- [Human handoff](human-handoff.md): the third rung, for the steps no kind can satisfy.
- [Designing actions](designing-actions.md#designing-requirements): choosing between one requirement with many options and a chain.
- [For agent builders](for-agent-builders.md): fulfillers, confirmation, and how a wallet is keyed by kind.
- [Kind registry](../spec/KINDS.md): the normative tables and the rules for proposing a new kind.
````
