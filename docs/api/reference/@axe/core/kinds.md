[AXE API reference](../../README.md) / [@axe/core](README.md) / kinds

# kinds

## Interfaces

### AcceptInput

Defined in: [packages/core/src/kinds.ts:28](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L28)

A server-side `accepts[]` entry: like the wire `Accept` but with a Zod schema.

#### Properties

##### description

```ts
description: string;
```

Defined in: [packages/core/src/kinds.ts:31](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L31)

##### instructions?

```ts
optional instructions?: string;
```

Defined in: [packages/core/src/kinds.ts:34](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L34)

##### kind

```ts
kind: string;
```

Defined in: [packages/core/src/kinds.ts:29](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L29)

##### schema

```ts
schema: 
  | JsonSchema
| ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>;
```

Defined in: [packages/core/src/kinds.ts:32](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L32)

##### sensitive

```ts
sensitive: boolean;
```

Defined in: [packages/core/src/kinds.ts:33](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L33)

##### title?

```ts
optional title?: string;
```

Defined in: [packages/core/src/kinds.ts:30](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L30)

***

### KindDefinition

Defined in: [packages/core/src/kinds.ts:19](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L19)

A well-known or custom kind: its wire name, payload schema, and defaults for an `accepts[]` entry.

#### Type Parameters

##### S

`S` *extends* `z.ZodType` = `z.ZodType`

#### Properties

##### description

```ts
readonly description: string;
```

Defined in: [packages/core/src/kinds.ts:22](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L22)

##### kind

```ts
readonly kind: string;
```

Defined in: [packages/core/src/kinds.ts:20](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L20)

##### schema

```ts
readonly schema: S;
```

Defined in: [packages/core/src/kinds.ts:23](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L23)

##### sensitive

```ts
readonly sensitive: boolean;
```

Defined in: [packages/core/src/kinds.ts:24](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L24)

##### title

```ts
readonly title: string;
```

Defined in: [packages/core/src/kinds.ts:21](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L21)

## Variables

### consentTerms

```ts
const consentTerms: KindDefinition<ZodObject<{
  acceptedAt: ZodString;
  acceptedBy: ZodOptional<ZodString>;
  policyUrl: ZodString;
  policyVersion: ZodString;
  scope: ZodString;
}, $strict>>;
```

Defined in: [packages/core/src/kinds.ts:243](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L243)

***

### contactAddress

```ts
const contactAddress: KindDefinition<ZodObject<{
  city: ZodString;
  country: ZodString;
  line1: ZodString;
  line2: ZodOptional<ZodString>;
  postalCode: ZodOptional<ZodString>;
  region: ZodOptional<ZodString>;
}, $strict>>;
```

Defined in: [packages/core/src/kinds.ts:226](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L226)

***

### contactEmail

```ts
const contactEmail: KindDefinition<ZodObject<{
  email: ZodString;
}, $strict>>;
```

Defined in: [packages/core/src/kinds.ts:202](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L202)

***

### contactPhone

```ts
const contactPhone: KindDefinition<ZodObject<{
  canReceiveSms: ZodOptional<ZodBoolean>;
  phone: ZodString;
}, $strict>>;
```

Defined in: [packages/core/src/kinds.ts:210](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L210)

***

### documentBase64

```ts
const documentBase64: KindDefinition<ZodObject<{
  contentBase64: ZodString;
  filename: ZodString;
  mimeType: ZodString;
}, $strict>>;
```

Defined in: [packages/core/src/kinds.ts:188](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L188)

***

### documentUrl

```ts
const documentUrl: KindDefinition<ZodObject<{
  filename: ZodOptional<ZodString>;
  mimeType: ZodString;
  sizeBytes: ZodOptional<ZodNumber>;
  url: ZodString;
}, $strict>>;
```

Defined in: [packages/core/src/kinds.ts:173](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L173)

***

### identityDateOfBirth

```ts
const identityDateOfBirth: KindDefinition<ZodObject<{
  dateOfBirth: ZodString;
}, $strict>>;
```

Defined in: [packages/core/src/kinds.ts:157](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L157)

***

### identityGovernmentId

```ts
const identityGovernmentId: KindDefinition<ZodObject<{
  dateOfBirth: ZodOptional<ZodString>;
  documentNumber: ZodString;
  documentType: ZodEnum<{
     drivers-license: "drivers-license";
     national-id: "national-id";
     passport: "passport";
     residence-permit: "residence-permit";
  }>;
  expiresOn: ZodOptional<ZodString>;
  fullName: ZodString;
  issuingCountry: ZodString;
}, $strict>>;
```

Defined in: [packages/core/src/kinds.ts:140](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L140)

***

### identitySsnLast4

```ts
const identitySsnLast4: KindDefinition<ZodObject<{
  last4: ZodString;
}, $strict>>;
```

Defined in: [packages/core/src/kinds.ts:165](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L165)

***

### kinds

```ts
const kinds: Readonly<{
  consent: Readonly<{
     terms: KindDefinition<ZodObject<{
        acceptedAt: ZodString;
        acceptedBy: ZodOptional<ZodString>;
        policyUrl: ZodString;
        policyVersion: ZodString;
        scope: ZodString;
     }, $strict>>;
  }>;
  contact: Readonly<{
     address: KindDefinition<ZodObject<{
        city: ZodString;
        country: ZodString;
        line1: ZodString;
        line2: ZodOptional<ZodString>;
        postalCode: ZodOptional<ZodString>;
        region: ZodOptional<ZodString>;
     }, $strict>>;
     email: KindDefinition<ZodObject<{
        email: ZodString;
     }, $strict>>;
     phone: KindDefinition<ZodObject<{
        canReceiveSms: ZodOptional<ZodBoolean>;
        phone: ZodString;
     }, $strict>>;
  }>;
  document: Readonly<{
     base64: KindDefinition<ZodObject<{
        contentBase64: ZodString;
        filename: ZodString;
        mimeType: ZodString;
     }, $strict>>;
     url: KindDefinition<ZodObject<{
        filename: ZodOptional<ZodString>;
        mimeType: ZodString;
        sizeBytes: ZodOptional<ZodNumber>;
        url: ZodString;
     }, $strict>>;
  }>;
  identity: Readonly<{
     dateOfBirth: KindDefinition<ZodObject<{
        dateOfBirth: ZodString;
     }, $strict>>;
     governmentId: KindDefinition<ZodObject<{
        dateOfBirth: ZodOptional<ZodString>;
        documentNumber: ZodString;
        documentType: ZodEnum<{
           drivers-license: "drivers-license";
           national-id: "national-id";
           passport: "passport";
           residence-permit: "residence-permit";
        }>;
        expiresOn: ZodOptional<ZodString>;
        fullName: ZodString;
        issuingCountry: ZodString;
     }, $strict>>;
     ssnLast4: KindDefinition<ZodObject<{
        last4: ZodString;
     }, $strict>>;
  }>;
  payment: Readonly<{
     achDebit: KindDefinition<ZodObject<{
        accountHolderName: ZodString;
        accountNumber: ZodString;
        accountType: ZodEnum<{
           checking: "checking";
           savings: "savings";
        }>;
        amount: ZodNumber;
        authorizationText: ZodString;
        authorizedAt: ZodString;
        currency: ZodString;
        routingNumber: ZodString;
     }, $strict>>;
     card: KindDefinition<ZodObject<{
        amount: ZodOptional<ZodNumber>;
        billingPostalCode: ZodOptional<ZodString>;
        brand: ZodOptional<ZodString>;
        currency: ZodOptional<ZodString>;
        expMonth: ZodOptional<ZodNumber>;
        expYear: ZodOptional<ZodNumber>;
        last4: ZodOptional<ZodString>;
        provider: ZodString;
        token: ZodString;
     }, $strict>>;
     invoice: KindDefinition<ZodObject<{
        billingEmail: ZodString;
        companyName: ZodString;
        netTermsDays: ZodOptional<ZodNumber>;
        purchaseOrderNumber: ZodOptional<ZodString>;
        taxId: ZodOptional<ZodString>;
     }, $strict>>;
     wireConfirmation: KindDefinition<ZodObject<{
        amount: ZodNumber;
        bankName: ZodOptional<ZodString>;
        currency: ZodString;
        referenceNumber: ZodString;
        sentAt: ZodString;
     }, $strict>>;
  }>;
}>;
```

Defined in: [packages/core/src/kinds.ts:260](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L260)

Every well-known kind, grouped by namespace.

***

### paymentAchDebit

```ts
const paymentAchDebit: KindDefinition<ZodObject<{
  accountHolderName: ZodString;
  accountNumber: ZodString;
  accountType: ZodEnum<{
     checking: "checking";
     savings: "savings";
  }>;
  amount: ZodNumber;
  authorizationText: ZodString;
  authorizedAt: ZodString;
  currency: ZodString;
  routingNumber: ZodString;
}, $strict>>;
```

Defined in: [packages/core/src/kinds.ts:80](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L80)

***

### paymentCard

```ts
const paymentCard: KindDefinition<ZodObject<{
  amount: ZodOptional<ZodNumber>;
  billingPostalCode: ZodOptional<ZodString>;
  brand: ZodOptional<ZodString>;
  currency: ZodOptional<ZodString>;
  expMonth: ZodOptional<ZodNumber>;
  expYear: ZodOptional<ZodNumber>;
  last4: ZodOptional<ZodString>;
  provider: ZodString;
  token: ZodString;
}, $strict>>;
```

Defined in: [packages/core/src/kinds.ts:57](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L57)

***

### paymentInvoice

```ts
const paymentInvoice: KindDefinition<ZodObject<{
  billingEmail: ZodString;
  companyName: ZodString;
  netTermsDays: ZodOptional<ZodNumber>;
  purchaseOrderNumber: ZodOptional<ZodString>;
  taxId: ZodOptional<ZodString>;
}, $strict>>;
```

Defined in: [packages/core/src/kinds.ts:124](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L124)

***

### paymentWireConfirmation

```ts
const paymentWireConfirmation: KindDefinition<ZodObject<{
  amount: ZodNumber;
  bankName: ZodOptional<ZodString>;
  currency: ZodString;
  referenceNumber: ZodString;
  sentAt: ZodString;
}, $strict>>;
```

Defined in: [packages/core/src/kinds.ts:108](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L108)

***

### WELL\_KNOWN\_KINDS

```ts
const WELL_KNOWN_KINDS: readonly KindDefinition[];
```

Defined in: [packages/core/src/kinds.ts:287](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L287)

Flat list of every well-known kind definition.

## Functions

### accept()

```ts
function accept(kind, options?): AcceptInput;
```

Defined in: [packages/core/src/kinds.ts:358](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L358)

Build an `accepts[]` entry from a kind definition. `description` should say what
this requirement is for in the context of the action; `instructions` is relayed to
the user or acted on by the agent (wire details, where to obtain a document).

#### Parameters

##### kind

[`KindDefinition`](#kinddefinition)

##### options?

###### description?

`string`

###### instructions?

`string`

###### sensitive?

`boolean`

###### title?

`string`

#### Returns

[`AcceptInput`](#acceptinput)

***

### customKind()

```ts
function customKind<S>(spec): KindDefinition<S>;
```

Defined in: [packages/core/src/kinds.ts:322](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L322)

Define a custom kind under your own namespace. The name must be `x-<org>.<name>`.
Throws when the name is malformed or collides with a well-known namespace.

#### Type Parameters

##### S

`S` *extends* `ZodType`\<`unknown`, `unknown`, `$ZodTypeInternals`\<`unknown`, `unknown`\>\>

#### Parameters

##### spec

###### description

`string`

###### kind

`string`

###### schema

`S`

###### sensitive

`boolean`

###### title

`string`

#### Returns

[`KindDefinition`](#kinddefinition)\<`S`\>

***

### isCustomKind()

```ts
function isCustomKind(name): boolean;
```

Defined in: [packages/core/src/kinds.ts:309](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L309)

Whether a kind name is a valid custom kind (`x-<org>.<name>`).

#### Parameters

##### name

`string`

#### Returns

`boolean`

***

### isValidKindName()

```ts
function isValidKindName(name): boolean;
```

Defined in: [packages/core/src/kinds.ts:314](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L314)

Whether a kind name is syntactically valid: well-known or custom.

#### Parameters

##### name

`string`

#### Returns

`boolean`

***

### kindJsonSchema()

```ts
function kindJsonSchema(kind): JsonSchema;
```

Defined in: [packages/core/src/kinds.ts:405](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L405)

JSON Schema for a kind's payload, as it appears on the wire.

#### Parameters

##### kind

[`KindDefinition`](#kinddefinition)

#### Returns

[`JsonSchema`](types.md#jsonschema)

***

### suggestedReason()

```ts
function suggestedReason(kindName): string | undefined;
```

Defined in: [packages/core/src/kinds.ts:388](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L388)

The conventional `reason` string for a requirement whose kinds share a namespace:
`payment_required`, `identity_required`, `document_required`, `consent_required`.
Returns undefined for contact kinds and custom kinds, which take site-specific reasons.

#### Parameters

##### kindName

`string`

#### Returns

`string` \| `undefined`

***

### wellKnownKind()

```ts
function wellKnownKind(name): 
  | KindDefinition<ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>>
  | undefined;
```

Defined in: [packages/core/src/kinds.ts:304](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L304)

Look up a well-known kind by wire name.

#### Parameters

##### name

`string`

#### Returns

  \| [`KindDefinition`](#kinddefinition)\<`ZodType`\<`unknown`, `unknown`, `$ZodTypeInternals`\<`unknown`, `unknown`\>\>\>
  \| `undefined`

***

### withMimeTypes()

```ts
function withMimeTypes<S>(kind, mimeTypes): KindDefinition<ZodObject<$ZodLooseShape, $strip>>;
```

Defined in: [packages/core/src/kinds.ts:341](https://github.com/summationai/code/blob/543afa0f64e4b716a23823cff19857d3afccd6d0/axe/packages/core/src/kinds.ts#L341)

Restrict a document kind to specific MIME types. Returns a new definition whose
schema is a restriction of the registry schema, which spec/KINDS.md [K-3] permits.

#### Type Parameters

##### S

`S` *extends* `ZodObject`\<`$ZodLooseShape`, `$strip`\>

#### Parameters

##### kind

[`KindDefinition`](#kinddefinition)\<`S`\>

##### mimeTypes

readonly \[`string`, `string`\]

#### Returns

[`KindDefinition`](#kinddefinition)\<`ZodObject`\<`$ZodLooseShape`, `$strip`\>\>
