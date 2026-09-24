[AXE API reference](../../README.md) / [@axe/core](README.md) / schemas

# schemas

## Variables

### AcceptSchema

```ts
const AcceptSchema: ZodObject<{
  description: ZodString;
  instructions: ZodOptional<ZodString>;
  kind: ZodString;
  schema: ZodRecord<ZodString, ZodUnknown>;
  sensitive: ZodBoolean;
  title: ZodString;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:248](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L248)

***

### ACTION\_NAME

```ts
const ACTION_NAME: RegExp;
```

Defined in: [packages/core/src/schemas.ts:28](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L28)

***

### ActionExampleSchema

```ts
const ActionExampleSchema: ZodObject<{
  input: ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>;
  output: ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:114](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L114)

***

### ActionSchema

```ts
const ActionSchema: ZodObject<{
  affordances: ZodOptional<ZodArray<ZodObject<{
     action: ZodString;
     input: ZodRecord<ZodString, ZodString>;
     primary: ZodOptional<ZodBoolean>;
     title: ZodString;
  }, $strict>>>;
  auth: ZodEnum<{
     none: "none";
     site: "site";
     user: "user";
  }>;
  deprecated: ZodOptional<ZodObject<{
     replacedBy: ZodOptional<ZodString>;
     since: ZodString;
  }, $strict>>;
  description: ZodString;
  display: ZodOptional<ZodObject<{
     disclaimer: ZodOptional<ZodString>;
     emptyMessage: ZodOptional<ZodString>;
     item: ZodOptional<ZodObject<{
        attributes: ZodOptional<ZodArray<ZodObject<..., ...>>>;
        badges: ZodOptional<ZodArray<ZodString>>;
        id: ZodString;
        image: ZodOptional<ZodUnion<readonly [..., ...]>>;
        price: ZodOptional<ZodObject<{
           amount: ...;
           currency: ...;
           period: ...;
        }, $strict>>;
        subtitle: ZodOptional<ZodString>;
        summary: ZodOptional<ZodString>;
        title: ZodString;
        url: ZodOptional<ZodString>;
     }, $strict>>;
     items: ZodOptional<ZodString>;
     kind: ZodEnum<{
        document: "document";
        item: "item";
        list: "list";
        status: "status";
        table: "table";
     }>;
     suggestedComparison: ZodOptional<ZodArray<ZodString>>;
  }, $strict>>;
  examples: ZodOptional<ZodArray<ZodObject<{
     input: ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>;
     output: ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>;
  }, $strict>>>;
  freshness: ZodOptional<ZodObject<{
     cacheTtlSeconds: ZodOptional<ZodNumber>;
     validUntil: ZodOptional<ZodString>;
  }, $strict>>;
  humanHandoff: ZodOptional<ZodObject<{
     reasons: ZodArray<ZodString>;
  }, $strict>>;
  idempotent: ZodBoolean;
  input: ZodRecord<ZodString, ZodUnknown>;
  name: ZodString;
  output: ZodRecord<ZodString, ZodUnknown>;
  pagination: ZodOptional<ZodObject<{
     cursorIn: ZodString;
     cursorOut: ZodString;
     pageSize: ZodObject<{
        default: ZodNumber;
        max: ZodNumber;
     }, $strict>;
  }, $strict>>;
  readOnly: ZodBoolean;
  reversible: ZodBoolean;
  risk: ZodEnum<{
     high: "high";
     low: "low";
     medium: "medium";
     none: "none";
  }>;
  title: ZodString;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:118](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L118)

***

### AffordanceSchema

```ts
const AffordanceSchema: ZodObject<{
  action: ZodString;
  input: ZodRecord<ZodString, ZodString>;
  primary: ZodOptional<ZodBoolean>;
  title: ZodString;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:81](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L81)

***

### AgentIdentificationSchema

```ts
const AgentIdentificationSchema: ZodObject<{
  contact: ZodOptional<ZodString>;
  name: ZodString;
  vendor: ZodOptional<ZodString>;
  version: ZodOptional<ZodString>;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:211](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L211)

***

### AttributeDisplaySchema

```ts
const AttributeDisplaySchema: ZodObject<{
  compare: ZodOptional<ZodEnum<{
     higher-better: "higher-better";
     lower-better: "lower-better";
     neutral: "neutral";
  }>>;
  format: ZodOptional<ZodEnum<{
     area: "area";
     boolean: "boolean";
     currency: "currency";
     date: "date";
     datetime: "datetime";
     distance: "distance";
     duration: "duration";
     list: "list";
     number: "number";
     text: "text";
  }>>;
  label: ZodString;
  path: ZodString;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:47](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L47)

***

### AuthModeSchema

```ts
const AuthModeSchema: ZodEnum<{
  none: "none";
  site: "site";
  user: "user";
}>;
```

Defined in: [packages/core/src/schemas.ts:18](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L18)

***

### BrandSchema

```ts
const BrandSchema: ZodObject<{
  accentColor: ZodOptional<ZodString>;
  logoUrl: ZodOptional<ZodString>;
  name: ZodOptional<ZodString>;
  tone: ZodOptional<ZodEnum<{
     casual: "casual";
     formal: "formal";
     neutral: "neutral";
  }>>;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:172](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L172)

***

### CompareSchema

```ts
const CompareSchema: ZodEnum<{
  higher-better: "higher-better";
  lower-better: "lower-better";
  neutral: "neutral";
}>;
```

Defined in: [packages/core/src/schemas.ts:24](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L24)

***

### ContactSchema

```ts
const ContactSchema: ZodObject<{
  email: ZodOptional<ZodString>;
  url: ZodOptional<ZodString>;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:168](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L168)

***

### ContinueRequestSchema

```ts
const ContinueRequestSchema: ZodObject<{
  continuationToken: ZodString;
  kind: ZodString;
  payload: ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:238](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L238)

***

### DisplayKindSchema

```ts
const DisplayKindSchema: ZodEnum<{
  document: "document";
  item: "item";
  list: "list";
  status: "status";
  table: "table";
}>;
```

Defined in: [packages/core/src/schemas.ts:22](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L22)

***

### DisplaySchema

```ts
const DisplaySchema: ZodObject<{
  disclaimer: ZodOptional<ZodString>;
  emptyMessage: ZodOptional<ZodString>;
  item: ZodOptional<ZodObject<{
     attributes: ZodOptional<ZodArray<ZodObject<{
        compare: ZodOptional<ZodEnum<...>>;
        format: ZodOptional<ZodEnum<...>>;
        label: ZodString;
        path: ZodString;
     }, $strict>>>;
     badges: ZodOptional<ZodArray<ZodString>>;
     id: ZodString;
     image: ZodOptional<ZodUnion<readonly [ZodString, ZodArray<ZodString>]>>;
     price: ZodOptional<ZodObject<{
        amount: ZodString;
        currency: ZodString;
        period: ZodOptional<ZodEnum<{
           day: ...;
           hour: ...;
           month: ...;
           once: ...;
           year: ...;
        }>>;
     }, $strict>>;
     subtitle: ZodOptional<ZodString>;
     summary: ZodOptional<ZodString>;
     title: ZodString;
     url: ZodOptional<ZodString>;
  }, $strict>>;
  items: ZodOptional<ZodString>;
  kind: ZodEnum<{
     document: "document";
     item: "item";
     list: "list";
     status: "status";
     table: "table";
  }>;
  suggestedComparison: ZodOptional<ZodArray<ZodString>>;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:70](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L70)

***

### DynamicAffordanceSchema

```ts
const DynamicAffordanceSchema: ZodObject<{
  action: ZodString;
  input: ZodRecord<ZodString, ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>>;
  primary: ZodOptional<ZodBoolean>;
  title: ZodString;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:90](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L90)

***

### ErrorBodySchema

```ts
const ErrorBodySchema: ZodObject<{
  code: ZodEnum<{
     conflict: "conflict";
     forbidden: "forbidden";
     internal: "internal";
     invalid_input: "invalid_input";
     not_found: "not_found";
     rate_limited: "rate_limited";
     unauthorized: "unauthorized";
     unavailable: "unavailable";
     unsupported: "unsupported";
  }>;
  details: ZodOptional<ZodRecord<ZodString, ZodUnknown>>;
  message: ZodString;
  retryable: ZodBoolean;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:274](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L274)

***

### ErrorCodeSchema

```ts
const ErrorCodeSchema: ZodEnum<{
  conflict: "conflict";
  forbidden: "forbidden";
  internal: "internal";
  invalid_input: "invalid_input";
  not_found: "not_found";
  rate_limited: "rate_limited";
  unauthorized: "unauthorized";
  unavailable: "unavailable";
  unsupported: "unsupported";
}>;
```

Defined in: [packages/core/src/schemas.ts:20](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L20)

***

### ErrorResultSchema

```ts
const ErrorResultSchema: ZodObject<{
  error: ZodObject<{
     code: ZodEnum<{
        conflict: "conflict";
        forbidden: "forbidden";
        internal: "internal";
        invalid_input: "invalid_input";
        not_found: "not_found";
        rate_limited: "rate_limited";
        unauthorized: "unauthorized";
        unavailable: "unavailable";
        unsupported: "unsupported";
     }>;
     details: ZodOptional<ZodRecord<ZodString, ZodUnknown>>;
     message: ZodString;
     retryable: ZodBoolean;
  }, $strict>;
  status: ZodLiteral<"error">;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:308](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L308)

***

### EventSchema

```ts
const EventSchema: ZodObject<{
  action: ZodString;
  agent: ZodNullable<ZodObject<{
     name: ZodOptional<ZodString>;
     vendor: ZodOptional<ZodString>;
     version: ZodOptional<ZodString>;
  }, $strict>>;
  errorCode: ZodNullable<ZodEnum<{
     conflict: "conflict";
     forbidden: "forbidden";
     internal: "internal";
     invalid_input: "invalid_input";
     not_found: "not_found";
     rate_limited: "rate_limited";
     unauthorized: "unauthorized";
     unavailable: "unavailable";
     unsupported: "unsupported";
  }>>;
  kind: ZodNullable<ZodString>;
  ladder: ZodEnum<{
     continued: "continued";
     error: "error";
     needs_human: "needs_human";
     needs_input: "needs_input";
     ok: "ok";
     pending: "pending";
     resumed: "resumed";
  }>;
  latencyMs: ZodNumber;
  schemaVersion: ZodLiteral<1>;
  status: ZodEnum<{
     error: "error";
     needs_human: "needs_human";
     needs_input: "needs_input";
     ok: "ok";
     pending: "pending";
  }>;
  tenant: ZodNullable<ZodString>;
  ts: ZodString;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:338](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L338)

***

### FlowSchema

```ts
const FlowSchema: ZodObject<{
  description: ZodString;
  name: ZodString;
  steps: ZodArray<ZodString>;
  title: ZodString;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:184](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L184)

***

### FormatSchema

```ts
const FormatSchema: ZodEnum<{
  area: "area";
  boolean: "boolean";
  currency: "currency";
  date: "date";
  datetime: "datetime";
  distance: "distance";
  duration: "duration";
  list: "list";
  number: "number";
  text: "text";
}>;
```

Defined in: [packages/core/src/schemas.ts:23](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L23)

***

### FreshnessSchema

```ts
const FreshnessSchema: ZodObject<{
  cacheTtlSeconds: ZodOptional<ZodNumber>;
  validUntil: ZodOptional<ZodString>;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:107](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L107)

***

### HandoffSchema

```ts
const HandoffSchema: ZodObject<{
  expiresAt: ZodString;
  instructions: ZodString;
  reason: ZodString;
  resumeToken: ZodString;
  url: ZodString;
  whatAgentShouldSayToUser: ZodString;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:259](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L259)

***

### IndexSiteSchema

```ts
const IndexSiteSchema: ZodObject<{
  manifestUrl: ZodString;
  name: ZodString;
  tags: ZodOptional<ZodArray<ZodString>>;
  updatedAt: ZodString;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:320](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L320)

***

### ItemDisplaySchema

```ts
const ItemDisplaySchema: ZodObject<{
  attributes: ZodOptional<ZodArray<ZodObject<{
     compare: ZodOptional<ZodEnum<{
        higher-better: "higher-better";
        lower-better: "lower-better";
        neutral: "neutral";
     }>>;
     format: ZodOptional<ZodEnum<{
        area: "area";
        boolean: "boolean";
        currency: "currency";
        date: "date";
        datetime: "datetime";
        distance: "distance";
        duration: "duration";
        list: "list";
        number: "number";
        text: "text";
     }>>;
     label: ZodString;
     path: ZodString;
  }, $strict>>>;
  badges: ZodOptional<ZodArray<ZodString>>;
  id: ZodString;
  image: ZodOptional<ZodUnion<readonly [ZodString, ZodArray<ZodString>]>>;
  price: ZodOptional<ZodObject<{
     amount: ZodString;
     currency: ZodString;
     period: ZodOptional<ZodEnum<{
        day: "day";
        hour: "hour";
        month: "month";
        once: "once";
        year: "year";
     }>>;
  }, $strict>>;
  subtitle: ZodOptional<ZodString>;
  summary: ZodOptional<ZodString>;
  title: ZodString;
  url: ZodOptional<ZodString>;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:56](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L56)

***

### KIND\_NAME

```ts
const KIND_NAME: RegExp;
```

Defined in: [packages/core/src/schemas.ts:29](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L29)

***

### LadderSchema

```ts
const LadderSchema: ZodEnum<{
  continued: "continued";
  error: "error";
  needs_human: "needs_human";
  needs_input: "needs_input";
  ok: "ok";
  pending: "pending";
  resumed: "resumed";
}>;
```

Defined in: [packages/core/src/schemas.ts:21](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L21)

***

### ManifestAuthSchema

```ts
const ManifestAuthSchema: ZodObject<{
  modes: ZodArray<ZodEnum<{
     none: "none";
     site: "site";
     user: "user";
  }>>;
  userLoginUrl: ZodOptional<ZodString>;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:146](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L146)

***

### ManifestSchema

```ts
const ManifestSchema: ZodObject<{
  actions: ZodArray<ZodObject<{
     affordances: ZodOptional<ZodArray<ZodObject<{
        action: ZodString;
        input: ZodRecord<ZodString, ZodString>;
        primary: ZodOptional<ZodBoolean>;
        title: ZodString;
     }, $strict>>>;
     auth: ZodEnum<{
        none: "none";
        site: "site";
        user: "user";
     }>;
     deprecated: ZodOptional<ZodObject<{
        replacedBy: ZodOptional<ZodString>;
        since: ZodString;
     }, $strict>>;
     description: ZodString;
     display: ZodOptional<ZodObject<{
        disclaimer: ZodOptional<ZodString>;
        emptyMessage: ZodOptional<ZodString>;
        item: ZodOptional<ZodObject<{
           attributes: ...;
           badges: ...;
           id: ...;
           image: ...;
           price: ...;
           subtitle: ...;
           summary: ...;
           title: ...;
           url: ...;
        }, $strict>>;
        items: ZodOptional<ZodString>;
        kind: ZodEnum<{
           document: "document";
           item: "item";
           list: "list";
           status: "status";
           table: "table";
        }>;
        suggestedComparison: ZodOptional<ZodArray<ZodString>>;
     }, $strict>>;
     examples: ZodOptional<ZodArray<ZodObject<{
        input: ZodType<unknown, unknown, $ZodTypeInternals<..., ...>>;
        output: ZodType<unknown, unknown, $ZodTypeInternals<..., ...>>;
     }, $strict>>>;
     freshness: ZodOptional<ZodObject<{
        cacheTtlSeconds: ZodOptional<ZodNumber>;
        validUntil: ZodOptional<ZodString>;
     }, $strict>>;
     humanHandoff: ZodOptional<ZodObject<{
        reasons: ZodArray<ZodString>;
     }, $strict>>;
     idempotent: ZodBoolean;
     input: ZodRecord<ZodString, ZodUnknown>;
     name: ZodString;
     output: ZodRecord<ZodString, ZodUnknown>;
     pagination: ZodOptional<ZodObject<{
        cursorIn: ZodString;
        cursorOut: ZodString;
        pageSize: ZodObject<{
           default: ZodNumber;
           max: ZodNumber;
        }, $strict>;
     }, $strict>>;
     readOnly: ZodBoolean;
     reversible: ZodBoolean;
     risk: ZodEnum<{
        high: "high";
        low: "low";
        medium: "medium";
        none: "none";
     }>;
     title: ZodString;
  }, $strict>>;
  auth: ZodObject<{
     modes: ZodArray<ZodEnum<{
        none: "none";
        site: "site";
        user: "user";
     }>>;
     userLoginUrl: ZodOptional<ZodString>;
  }, $strict>;
  baseUrl: ZodString;
  brand: ZodOptional<ZodObject<{
     accentColor: ZodOptional<ZodString>;
     logoUrl: ZodOptional<ZodString>;
     name: ZodOptional<ZodString>;
     tone: ZodOptional<ZodEnum<{
        casual: "casual";
        formal: "formal";
        neutral: "neutral";
     }>>;
  }, $strict>>;
  contact: ZodOptional<ZodObject<{
     email: ZodOptional<ZodString>;
     url: ZodOptional<ZodString>;
  }, $strict>>;
  description: ZodString;
  flows: ZodOptional<ZodArray<ZodObject<{
     description: ZodString;
     name: ZodString;
     steps: ZodArray<ZodString>;
     title: ZodString;
  }, $strict>>>;
  humanFallbackUrl: ZodOptional<ZodString>;
  indexUrl: ZodOptional<ZodString>;
  name: ZodString;
  policies: ZodOptional<ZodObject<{
     agents: ZodOptional<ZodObject<{
        allow: ZodOptional<ZodArray<ZodString>>;
        deny: ZodOptional<ZodArray<ZodString>>;
     }, $strict>>;
     dataRetention: ZodOptional<ZodString>;
     rateLimit: ZodOptional<ZodObject<{
        burst: ZodOptional<ZodNumber>;
        requestsPerMinute: ZodNumber;
     }, $strict>>;
     termsUrl: ZodOptional<ZodString>;
  }, $strict>>;
  protocol: ZodString;
  updatedAt: ZodOptional<ZodString>;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:193](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L193)

***

### NeedsHumanResultSchema

```ts
const NeedsHumanResultSchema: ZodObject<{
  handoff: ZodObject<{
     expiresAt: ZodString;
     instructions: ZodString;
     reason: ZodString;
     resumeToken: ZodString;
     url: ZodString;
     whatAgentShouldSayToUser: ZodString;
  }, $strict>;
  status: ZodLiteral<"needs_human">;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:297](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L297)

***

### NeedsInputResultSchema

```ts
const NeedsInputResultSchema: ZodObject<{
  accepts: ZodArray<ZodObject<{
     description: ZodString;
     instructions: ZodOptional<ZodString>;
     kind: ZodString;
     schema: ZodRecord<ZodString, ZodUnknown>;
     sensitive: ZodBoolean;
     title: ZodString;
  }, $strict>>;
  continuationToken: ZodString;
  expiresAt: ZodString;
  fallback: ZodOptional<ZodObject<{
     expiresAt: ZodString;
     instructions: ZodString;
     reason: ZodString;
     resumeToken: ZodString;
     url: ZodString;
     whatAgentShouldSayToUser: ZodString;
  }, $strict>>;
  message: ZodString;
  reason: ZodString;
  status: ZodLiteral<"needs_input">;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:286](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L286)

***

### OkResultSchema

```ts
const OkResultSchema: ZodObject<{
  output: ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>;
  status: ZodLiteral<"ok">;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:283](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L283)

***

### PaginationSchema

```ts
const PaginationSchema: ZodObject<{
  cursorIn: ZodString;
  cursorOut: ZodString;
  pageSize: ZodObject<{
     default: ZodNumber;
     max: ZodNumber;
  }, $strict>;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:99](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L99)

***

### PendingResultSchema

```ts
const PendingResultSchema: ZodObject<{
  expiresAt: ZodOptional<ZodString>;
  pollUrl: ZodString;
  retryAfter: ZodNumber;
  status: ZodLiteral<"pending">;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:300](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L300)

***

### PeriodSchema

```ts
const PeriodSchema: ZodEnum<{
  day: "day";
  hour: "hour";
  month: "month";
  once: "once";
  year: "year";
}>;
```

Defined in: [packages/core/src/schemas.ts:25](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L25)

***

### PlatformIndexSchema

```ts
const PlatformIndexSchema: ZodObject<{
  next: ZodOptional<ZodString>;
  platform: ZodObject<{
     name: ZodString;
     url: ZodString;
  }, $strict>;
  protocol: ZodString;
  sites: ZodArray<ZodObject<{
     manifestUrl: ZodString;
     name: ZodString;
     tags: ZodOptional<ZodArray<ZodString>>;
     updatedAt: ZodString;
  }, $strict>>;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:329](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L329)

***

### PoliciesSchema

```ts
const PoliciesSchema: ZodObject<{
  agents: ZodOptional<ZodObject<{
     allow: ZodOptional<ZodArray<ZodString>>;
     deny: ZodOptional<ZodArray<ZodString>>;
  }, $strict>>;
  dataRetention: ZodOptional<ZodString>;
  rateLimit: ZodOptional<ZodObject<{
     burst: ZodOptional<ZodNumber>;
     requestsPerMinute: ZodNumber;
  }, $strict>>;
  termsUrl: ZodOptional<ZodString>;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:150](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L150)

***

### PriceDisplaySchema

```ts
const PriceDisplaySchema: ZodObject<{
  amount: ZodString;
  currency: ZodString;
  period: ZodOptional<ZodEnum<{
     day: "day";
     hour: "hour";
     month: "month";
     once: "once";
     year: "year";
  }>>;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:43](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L43)

***

### PROTOCOL\_VERSION

```ts
const PROTOCOL_VERSION: RegExp;
```

Defined in: [packages/core/src/schemas.ts:31](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L31)

***

### RequestContextSchema

```ts
const RequestContextSchema: ZodObject<{
  agent: ZodOptional<ZodObject<{
     contact: ZodOptional<ZodString>;
     name: ZodString;
     vendor: ZodOptional<ZodString>;
     version: ZodOptional<ZodString>;
  }, $strict>>;
  locale: ZodOptional<ZodString>;
  onBehalfOf: ZodOptional<ZodString>;
  sessionId: ZodOptional<ZodString>;
  timezone: ZodOptional<ZodString>;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:220](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L220)

***

### RequestEnvelopeSchema

```ts
const RequestEnvelopeSchema: ZodObject<{
  context: ZodOptional<ZodObject<{
     agent: ZodOptional<ZodObject<{
        contact: ZodOptional<ZodString>;
        name: ZodString;
        vendor: ZodOptional<ZodString>;
        version: ZodOptional<ZodString>;
     }, $strict>>;
     locale: ZodOptional<ZodString>;
     onBehalfOf: ZodOptional<ZodString>;
     sessionId: ZodOptional<ZodString>;
     timezone: ZodOptional<ZodString>;
  }, $strict>>;
  idempotencyKey: ZodOptional<ZodString>;
  input: ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:230](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L230)

***

### ResultSchema

```ts
const ResultSchema: ZodDiscriminatedUnion<[ZodObject<{
  output: ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>;
  status: ZodLiteral<"ok">;
}, $strict>, ZodObject<{
  accepts: ZodArray<ZodObject<{
     description: ZodString;
     instructions: ZodOptional<ZodString>;
     kind: ZodString;
     schema: ZodRecord<ZodString, ZodUnknown>;
     sensitive: ZodBoolean;
     title: ZodString;
  }, $strict>>;
  continuationToken: ZodString;
  expiresAt: ZodString;
  fallback: ZodOptional<ZodObject<{
     expiresAt: ZodString;
     instructions: ZodString;
     reason: ZodString;
     resumeToken: ZodString;
     url: ZodString;
     whatAgentShouldSayToUser: ZodString;
  }, $strict>>;
  message: ZodString;
  reason: ZodString;
  status: ZodLiteral<"needs_input">;
}, $strict>, ZodObject<{
  handoff: ZodObject<{
     expiresAt: ZodString;
     instructions: ZodString;
     reason: ZodString;
     resumeToken: ZodString;
     url: ZodString;
     whatAgentShouldSayToUser: ZodString;
  }, $strict>;
  status: ZodLiteral<"needs_human">;
}, $strict>, ZodObject<{
  expiresAt: ZodOptional<ZodString>;
  pollUrl: ZodString;
  retryAfter: ZodNumber;
  status: ZodLiteral<"pending">;
}, $strict>, ZodObject<{
  error: ZodObject<{
     code: ZodEnum<{
        conflict: "conflict";
        forbidden: "forbidden";
        internal: "internal";
        invalid_input: "invalid_input";
        not_found: "not_found";
        rate_limited: "rate_limited";
        unauthorized: "unauthorized";
        unavailable: "unavailable";
        unsupported: "unsupported";
     }>;
     details: ZodOptional<ZodRecord<ZodString, ZodUnknown>>;
     message: ZodString;
     retryable: ZodBoolean;
  }, $strict>;
  status: ZodLiteral<"error">;
}, $strict>], "status">;
```

Defined in: [packages/core/src/schemas.ts:312](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L312)

***

### ResumeRequestSchema

```ts
const ResumeRequestSchema: ZodObject<{
  resumeToken: ZodString;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:246](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L246)

***

### RiskSchema

```ts
const RiskSchema: ZodEnum<{
  high: "high";
  low: "low";
  medium: "medium";
  none: "none";
}>;
```

Defined in: [packages/core/src/schemas.ts:17](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L17)

***

### StatusSchema

```ts
const StatusSchema: ZodEnum<{
  error: "error";
  needs_human: "needs_human";
  needs_input: "needs_input";
  ok: "ok";
  pending: "pending";
}>;
```

Defined in: [packages/core/src/schemas.ts:19](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L19)

***

### ToneSchema

```ts
const ToneSchema: ZodEnum<{
  casual: "casual";
  formal: "formal";
  neutral: "neutral";
}>;
```

Defined in: [packages/core/src/schemas.ts:26](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L26)

***

### ValidationIssueSchema

```ts
const ValidationIssueSchema: ZodObject<{
  expected: ZodOptional<ZodString>;
  message: ZodString;
  path: ZodString;
}, $strict>;
```

Defined in: [packages/core/src/schemas.ts:270](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L270)

## Functions

### specJsonSchemas()

```ts
function specJsonSchemas(): Record<string, JsonSchema>;
```

Defined in: [packages/core/src/schemas.ts:361](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/schemas.ts#L361)

The JSON Schemas published under `spec/schemas/`, keyed by file stem.

#### Returns

`Record`\<`string`, [`JsonSchema`](types.md#jsonschema)\>

## References

### deepEqual

Re-exports [deepEqual](index.md#deepequal)

***

### schemasStructurallyEqual

Re-exports [schemasStructurallyEqual](index.md#schemasstructurallyequal)

***

### toJsonSchema

Re-exports [toJsonSchema](index.md#tojsonschema)

***

### validateJsonSchema

Re-exports [validateJsonSchema](index.md#validatejsonschema)
