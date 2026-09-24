[AXE API reference](../../README.md) / [@axe/core](README.md) / kinds

# kinds

## Interfaces

<a id="acceptinput"></a>

### AcceptInput

A server-side `accepts[]` entry: like the wire `Accept` but with a Zod schema.

#### Properties

<a id="description"></a>

##### description

```ts
description: string;
```

<a id="instructions"></a>

##### instructions?

```ts
optional instructions?: string;
```

<a id="kind"></a>

##### kind

```ts
kind: string;
```

<a id="schema"></a>

##### schema

```ts
schema: 
  | JsonSchema
| ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>;
```

<a id="sensitive"></a>

##### sensitive

```ts
sensitive: boolean;
```

<a id="title"></a>

##### title?

```ts
optional title?: string;
```

***

<a id="kinddefinition"></a>

### KindDefinition

A well-known or custom kind: its wire name, payload schema, and defaults for an `accepts[]` entry.

#### Type Parameters

##### S

`S` *extends* `z.ZodType` = `z.ZodType`

#### Properties

<a id="description-1"></a>

##### description

```ts
readonly description: string;
```

<a id="kind-1"></a>

##### kind

```ts
readonly kind: string;
```

<a id="schema-1"></a>

##### schema

```ts
readonly schema: S;
```

<a id="sensitive-1"></a>

##### sensitive

```ts
readonly sensitive: boolean;
```

<a id="title-1"></a>

##### title

```ts
readonly title: string;
```

## Variables

<a id="consentterms"></a>

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

***

<a id="contactaddress"></a>

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

***

<a id="contactemail"></a>

### contactEmail

```ts
const contactEmail: KindDefinition<ZodObject<{
  email: ZodString;
}, $strict>>;
```

***

<a id="contactphone"></a>

### contactPhone

```ts
const contactPhone: KindDefinition<ZodObject<{
  canReceiveSms: ZodOptional<ZodBoolean>;
  phone: ZodString;
}, $strict>>;
```

***

<a id="documentbase64"></a>

### documentBase64

```ts
const documentBase64: KindDefinition<ZodObject<{
  contentBase64: ZodString;
  filename: ZodString;
  mimeType: ZodString;
}, $strict>>;
```

***

<a id="documenturl"></a>

### documentUrl

```ts
const documentUrl: KindDefinition<ZodObject<{
  filename: ZodOptional<ZodString>;
  mimeType: ZodString;
  sizeBytes: ZodOptional<ZodNumber>;
  url: ZodString;
}, $strict>>;
```

***

<a id="identitydateofbirth"></a>

### identityDateOfBirth

```ts
const identityDateOfBirth: KindDefinition<ZodObject<{
  dateOfBirth: ZodString;
}, $strict>>;
```

***

<a id="identitygovernmentid"></a>

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

***

<a id="identityssnlast4"></a>

### identitySsnLast4

```ts
const identitySsnLast4: KindDefinition<ZodObject<{
  last4: ZodString;
}, $strict>>;
```

***

<a id="kinds"></a>

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

Every well-known kind, grouped by namespace.

***

<a id="paymentachdebit"></a>

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

***

<a id="paymentcard"></a>

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

***

<a id="paymentinvoice"></a>

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

***

<a id="paymentwireconfirmation"></a>

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

***

<a id="well_known_kinds"></a>

### WELL\_KNOWN\_KINDS

```ts
const WELL_KNOWN_KINDS: readonly KindDefinition[];
```

Flat list of every well-known kind definition.

## Functions

<a id="accept"></a>

### accept()

```ts
function accept(kind, options?): AcceptInput;
```

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

<a id="customkind"></a>

### customKind()

```ts
function customKind<S>(spec): KindDefinition<S>;
```

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

<a id="iscustomkind"></a>

### isCustomKind()

```ts
function isCustomKind(name): boolean;
```

Whether a kind name is a valid custom kind (`x-<org>.<name>`).

#### Parameters

##### name

`string`

#### Returns

`boolean`

***

<a id="isvalidkindname"></a>

### isValidKindName()

```ts
function isValidKindName(name): boolean;
```

Whether a kind name is syntactically valid: well-known or custom.

#### Parameters

##### name

`string`

#### Returns

`boolean`

***

<a id="kindjsonschema"></a>

### kindJsonSchema()

```ts
function kindJsonSchema(kind): JsonSchema;
```

JSON Schema for a kind's payload, as it appears on the wire.

#### Parameters

##### kind

[`KindDefinition`](#kinddefinition)

#### Returns

[`JsonSchema`](types.md#jsonschema)

***

<a id="suggestedreason"></a>

### suggestedReason()

```ts
function suggestedReason(kindName): string | undefined;
```

The conventional `reason` string for a requirement whose kinds share a namespace:
`payment_required`, `identity_required`, `document_required`, `consent_required`.
Returns undefined for contact kinds and custom kinds, which take site-specific reasons.

#### Parameters

##### kindName

`string`

#### Returns

`string` \| `undefined`

***

<a id="wellknownkind"></a>

### wellKnownKind()

```ts
function wellKnownKind(name): 
  | KindDefinition<ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>>
  | undefined;
```

Look up a well-known kind by wire name.

#### Parameters

##### name

`string`

#### Returns

  \| [`KindDefinition`](#kinddefinition)\<`ZodType`\<`unknown`, `unknown`, `$ZodTypeInternals`\<`unknown`, `unknown`\>\>\>
  \| `undefined`

***

<a id="withmimetypes"></a>

### withMimeTypes()

```ts
function withMimeTypes<S>(kind, mimeTypes): KindDefinition<ZodObject<$ZodLooseShape, $strip>>;
```

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
