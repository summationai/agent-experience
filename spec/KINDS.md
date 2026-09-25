# AXE Well-Known Kinds

**Version:** `axe/0.1`. Normative. Schemas in this file are generated into [`schemas/kinds/`](./schemas/kinds/) from `@axe/core/kinds` and a test asserts they match.

A **kind** names the type of payload an agent can submit to satisfy a `needs_input` requirement. Well-known kinds exist so that an agent's wallet or credential store can fulfill a requirement automatically: when a site asks for `payment.ach-debit`, every conforming agent knows the shape without reading prose.

This registry defines payload shapes and the validation rules below. It does not define how a credential is issued, whether a payment clears, or whether an identity document is genuine; those are decided by the site's payment provider and its own checks. A payload that validates against a kind is well-formed, not accepted. The existence of a kind is not evidence that any agent wallet supports it.

Rules:

**[K-1]** Kind names are namespace-dot-name, kebab-case: `payment.ach-debit`. Well-known namespaces are `payment`, `identity`, `document`, `contact`, and `consent`. Sites MUST NOT define new kinds in these namespaces.

**[K-2]** Custom kinds MUST be named `x-<org>.<name>`, for example `x-oakridge.guarantor-form`. A custom kind's schema MUST NOT be structurally equivalent to a well-known kind's schema (see protocol §18.2, [P-HON-5]).

**[K-3]** In an `accepts[]` entry for a well-known kind, `schema` MUST be the registry schema below or a restriction of it: the site MAY drop optional members, tighten enums, or add `format` constraints. It MUST NOT add required members or relax types.

**[K-4]** `sensitive` defaults given below are the minimum. A site MAY mark any kind `sensitive: true`; it MUST NOT mark a kind listed as sensitive below as `sensitive: false`.

**[K-5]** Payloads are validated by the server on `/axe/continue` against the entry's `schema`. Validation failures return `invalid_input` and do not consume the continuation token.

**[K-6]** Servers MUST NOT log payloads of sensitive kinds and MUST NOT emit them in events. Continuation tokens SHOULD expire within 15 minutes when any accepted kind is sensitive.

All schemas are `"type": "object"` with `"additionalProperties": false`. Strings are non-empty unless noted. Money is a number in major units with an ISO 4217 `currency`.

## payment

### `payment.card`

A tokenized card from the agent's wallet. The token is issued by a payment service provider the site accepts; the raw PAN never appears. Sensitive.

| Member              | Type                         | Required | Meaning                                                     |
| ------------------- | ---------------------------- | -------- | ----------------------------------------------------------- |
| `token`             | string                       | yes      | PSP-issued single-use or network token.                     |
| `provider`          | string                       | yes      | PSP identifier, e.g. `stripe`, `adyen`, `braintree`.        |
| `brand`             | string                       | no       | Card network, lowercase: `visa`, `mastercard`, `amex`, ...  |
| `last4`             | string, pattern `^[0-9]{4}$` | no       | For display and confirmation.                               |
| `expMonth`          | integer 1–12                 | no       |                                                             |
| `expYear`           | integer                      | no       | Four digits.                                                |
| `billingPostalCode` | string                       | no       |                                                             |
| `amount`            | number ≥ 0                   | no       | Amount the user authorized, when the requirement names one. |
| `currency`          | string, pattern `^[A-Z]{3}$` | no       |                                                             |

### `payment.ach-debit`

Authorization for a one-time ACH debit from a US bank account. Sensitive.

| Member              | Type                            | Required | Meaning                                                     |
| ------------------- | ------------------------------- | -------- | ----------------------------------------------------------- |
| `accountHolderName` | string                          | yes      |                                                             |
| `routingNumber`     | string, pattern `^[0-9]{9}$`    | yes      | ABA routing number.                                         |
| `accountNumber`     | string, pattern `^[0-9]{4,17}$` | yes      |                                                             |
| `accountType`       | `checking` \| `savings`         | yes      |                                                             |
| `amount`            | number ≥ 0                      | yes      | Amount authorized.                                          |
| `currency`          | string, pattern `^[A-Z]{3}$`    | yes      | `USD` for ACH.                                              |
| `authorizedAt`      | date-time                       | yes      | When the user gave authorization.                           |
| `authorizationText` | string                          | yes      | The exact text the user agreed to. Required by NACHA rules. |

### `payment.wire-confirmation`

Confirmation that the user sent a wire transfer following the site's `accepts[].instructions`. Not sensitive.

| Member            | Type                         | Required | Meaning                      |
| ----------------- | ---------------------------- | -------- | ---------------------------- |
| `referenceNumber` | string                       | yes      | Bank reference or IMAD/OMAD. |
| `amount`          | number ≥ 0                   | yes      |                              |
| `currency`        | string, pattern `^[A-Z]{3}$` | yes      |                              |
| `sentAt`          | date-time                    | yes      |                              |
| `bankName`        | string                       | no       | Sending bank.                |

### `payment.invoice`

Request to be invoiced on net terms instead of paying now. The site decides whether to grant terms. Not sensitive.

| Member                | Type            | Required | Meaning                                 |
| --------------------- | --------------- | -------- | --------------------------------------- |
| `companyName`         | string          | yes      |                                         |
| `billingEmail`        | string, `email` | yes      |                                         |
| `purchaseOrderNumber` | string          | no       |                                         |
| `netTermsDays`        | integer 0–180   | no       | Requested terms; the site may override. |
| `taxId`               | string          | no       | VAT or EIN when the site requires it.   |

## identity

### `identity.government-id`

Details from a government-issued identity document. Sensitive.

| Member           | Type                                                                   | Required | Meaning                     |
| ---------------- | ---------------------------------------------------------------------- | -------- | --------------------------- |
| `documentType`   | `passport` \| `drivers-license` \| `national-id` \| `residence-permit` | yes      |                             |
| `documentNumber` | string                                                                 | yes      |                             |
| `issuingCountry` | string, pattern `^[A-Z]{2}$`                                           | yes      | ISO 3166-1 alpha-2.         |
| `fullName`       | string                                                                 | yes      | As printed on the document. |
| `dateOfBirth`    | date                                                                   | no       |                             |
| `expiresOn`      | date                                                                   | no       |                             |

### `identity.date-of-birth`

| Member        | Type | Required |
| ------------- | ---- | -------- |
| `dateOfBirth` | date | yes      |

Sensitive.

### `identity.ssn-last-4`

| Member  | Type                         | Required |
| ------- | ---------------------------- | -------- |
| `last4` | string, pattern `^[0-9]{4}$` | yes      |

Sensitive.

## document

Sites SHOULD restrict `mimeType` with an `enum` in their `accepts[].schema` when only some types are accepted, and state a size limit in `accepts[].description`.

### `document.url`

A document the site fetches from a URL the agent controls or the user has shared. Not sensitive by default; sites MUST mark it sensitive when the document is (a transcript, a medical record).

| Member      | Type          | Required | Meaning                                                 |
| ----------- | ------------- | -------- | ------------------------------------------------------- |
| `url`       | string, `uri` | yes      | HTTPS. The site fetches it once; it MAY be short-lived. |
| `mimeType`  | string        | yes      | e.g. `application/pdf`.                                 |
| `filename`  | string        | no       |                                                         |
| `sizeBytes` | integer ≥ 0   | no       |                                                         |

### `document.base64`

Inline upload. Sites SHOULD state the maximum size; the SDK enforces a 10 MiB default on the decoded size. The request body limit applies first ([P-LIM-1]): with the SDK's default `maxBodyBytes` of 1 MiB, an inline document can be about 750 KiB, and a site that accepts larger ones raises `maxBodyBytes` (base64 is four bytes for every three).

| Member          | Type   | Required | Meaning                              |
| --------------- | ------ | -------- | ------------------------------------ |
| `filename`      | string | yes      |                                      |
| `mimeType`      | string | yes      |                                      |
| `contentBase64` | string | yes      | Standard base64, no data URL prefix. |

## contact

Not sensitive by default. Sites collecting contact data for a minor or in a regulated context MUST mark it sensitive.

### `contact.email`

| Member  | Type            | Required |
| ------- | --------------- | -------- |
| `email` | string, `email` | yes      |

### `contact.phone`

| Member          | Type                                   | Required | Meaning |
| --------------- | -------------------------------------- | -------- | ------- |
| `phone`         | string, pattern `^\+[1-9][0-9]{6,14}$` | yes      | E.164.  |
| `canReceiveSms` | boolean                                | no       |         |

### `contact.address`

| Member       | Type                         | Required | Meaning                         |
| ------------ | ---------------------------- | -------- | ------------------------------- |
| `line1`      | string                       | yes      |                                 |
| `line2`      | string                       | no       |                                 |
| `city`       | string                       | yes      |                                 |
| `region`     | string                       | no       | State, province, or prefecture. |
| `postalCode` | string                       | no       |                                 |
| `country`    | string, pattern `^[A-Z]{2}$` | yes      | ISO 3166-1 alpha-2.             |

## consent

### `consent.terms`

Acknowledgment of one specific policy version for one specific scope. See protocol [P-HON-6]. Not sensitive, but agents SHOULD show the policy to the user before fulfilling.

| Member          | Type          | Required | Meaning                                                                 |
| --------------- | ------------- | -------- | ----------------------------------------------------------------------- |
| `policyUrl`     | string, `uri` | yes      | The document the user is agreeing to.                                   |
| `policyVersion` | string        | yes      | Exact version identifier or date of the document.                       |
| `scope`         | string        | yes      | What the consent covers, e.g. `rental-application-background-check`.    |
| `acceptedAt`    | date-time     | yes      |                                                                         |
| `acceptedBy`    | string        | no       | Name or identifier of the person consenting, when the site requires it. |

The `accepts[]` entry for a `consent.terms` requirement SHOULD carry, in `instructions`, the policy title and a one-sentence summary of what is being agreed to, so the agent can relay it.

## Adding to this registry

The registry is governed informally in v0 (see `ROADMAP.md`). Proposals add a section here, a definition in `@axe/core/kinds`, a row in `VOCABULARY.md`, and a regenerated schema, in one change.
