[AXE API reference](../../README.md) / [@axe/core](README.md) / schemas

# schemas

## Variables

<a id="acceptschema"></a>

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

***

<a id="action_name"></a>

### ACTION\_NAME

```ts
const ACTION_NAME: RegExp;
```

***

<a id="actionexampleschema"></a>

### ActionExampleSchema

```ts
const ActionExampleSchema: ZodObject<{
  input: ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>;
  output: ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>;
}, $strict>;
```

***

<a id="actionschema"></a>

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

***

<a id="affordanceschema"></a>

### AffordanceSchema

```ts
const AffordanceSchema: ZodObject<{
  action: ZodString;
  input: ZodRecord<ZodString, ZodString>;
  primary: ZodOptional<ZodBoolean>;
  title: ZodString;
}, $strict>;
```

***

<a id="agentidentificationschema"></a>

### AgentIdentificationSchema

```ts
const AgentIdentificationSchema: ZodObject<{
  contact: ZodOptional<ZodString>;
  name: ZodString;
  vendor: ZodOptional<ZodString>;
  version: ZodOptional<ZodString>;
}, $strict>;
```

***

<a id="attributedisplayschema"></a>

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

***

<a id="authmodeschema"></a>

### AuthModeSchema

```ts
const AuthModeSchema: ZodEnum<{
  none: "none";
  site: "site";
  user: "user";
}>;
```

***

<a id="brandschema"></a>

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

***

<a id="compareschema"></a>

### CompareSchema

```ts
const CompareSchema: ZodEnum<{
  higher-better: "higher-better";
  lower-better: "lower-better";
  neutral: "neutral";
}>;
```

***

<a id="contactschema"></a>

### ContactSchema

```ts
const ContactSchema: ZodObject<{
  email: ZodOptional<ZodString>;
  url: ZodOptional<ZodString>;
}, $strict>;
```

***

<a id="continuerequestschema"></a>

### ContinueRequestSchema

```ts
const ContinueRequestSchema: ZodObject<{
  continuationToken: ZodString;
  kind: ZodString;
  payload: ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>;
}, $strict>;
```

***

<a id="displaykindschema"></a>

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

***

<a id="displayschema"></a>

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

***

<a id="dynamicaffordanceschema"></a>

### DynamicAffordanceSchema

```ts
const DynamicAffordanceSchema: ZodObject<{
  action: ZodString;
  input: ZodRecord<ZodString, ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>>;
  primary: ZodOptional<ZodBoolean>;
  title: ZodString;
}, $strict>;
```

***

<a id="errorbodyschema"></a>

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

***

<a id="errorcodeschema"></a>

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

***

<a id="errorresultschema"></a>

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

***

<a id="eventschema"></a>

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

***

<a id="flowschema"></a>

### FlowSchema

```ts
const FlowSchema: ZodObject<{
  description: ZodString;
  name: ZodString;
  steps: ZodArray<ZodString>;
  title: ZodString;
}, $strict>;
```

***

<a id="formatschema"></a>

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

***

<a id="freshnessschema"></a>

### FreshnessSchema

```ts
const FreshnessSchema: ZodObject<{
  cacheTtlSeconds: ZodOptional<ZodNumber>;
  validUntil: ZodOptional<ZodString>;
}, $strict>;
```

***

<a id="handoffschema"></a>

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

***

<a id="indexsiteschema"></a>

### IndexSiteSchema

```ts
const IndexSiteSchema: ZodObject<{
  manifestUrl: ZodString;
  name: ZodString;
  tags: ZodOptional<ZodArray<ZodString>>;
  updatedAt: ZodString;
}, $strict>;
```

***

<a id="itemdisplayschema"></a>

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

***

<a id="kind_name"></a>

### KIND\_NAME

```ts
const KIND_NAME: RegExp;
```

***

<a id="ladderschema"></a>

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

***

<a id="manifestauthschema"></a>

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

***

<a id="manifestschema"></a>

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

***

<a id="needshumanresultschema"></a>

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

***

<a id="needsinputresultschema"></a>

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

***

<a id="okresultschema"></a>

### OkResultSchema

```ts
const OkResultSchema: ZodObject<{
  output: ZodType<unknown, unknown, $ZodTypeInternals<unknown, unknown>>;
  status: ZodLiteral<"ok">;
}, $strict>;
```

***

<a id="paginationschema"></a>

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

***

<a id="pendingresultschema"></a>

### PendingResultSchema

```ts
const PendingResultSchema: ZodObject<{
  expiresAt: ZodOptional<ZodString>;
  pollUrl: ZodString;
  retryAfter: ZodNumber;
  status: ZodLiteral<"pending">;
}, $strict>;
```

***

<a id="periodschema"></a>

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

***

<a id="platformindexschema"></a>

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

***

<a id="policiesschema"></a>

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

***

<a id="pricedisplayschema"></a>

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

***

<a id="protocol_version"></a>

### PROTOCOL\_VERSION

```ts
const PROTOCOL_VERSION: RegExp;
```

***

<a id="requestcontextschema"></a>

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

***

<a id="requestenvelopeschema"></a>

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

***

<a id="resultschema"></a>

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

***

<a id="resumerequestschema"></a>

### ResumeRequestSchema

```ts
const ResumeRequestSchema: ZodObject<{
  resumeToken: ZodString;
}, $strict>;
```

***

<a id="riskschema"></a>

### RiskSchema

```ts
const RiskSchema: ZodEnum<{
  high: "high";
  low: "low";
  medium: "medium";
  none: "none";
}>;
```

***

<a id="statusschema"></a>

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

***

<a id="toneschema"></a>

### ToneSchema

```ts
const ToneSchema: ZodEnum<{
  casual: "casual";
  formal: "formal";
  neutral: "neutral";
}>;
```

***

<a id="validationissueschema"></a>

### ValidationIssueSchema

```ts
const ValidationIssueSchema: ZodObject<{
  expected: ZodOptional<ZodString>;
  message: ZodString;
  path: ZodString;
}, $strict>;
```

## Functions

<a id="specjsonschemas"></a>

### specJsonSchemas()

```ts
function specJsonSchemas(): Record<string, JsonSchema>;
```

The JSON Schemas published under `spec/schemas/`, keyed by file stem.

#### Returns

`Record`\<`string`, [`JsonSchema`](types.md#jsonschema)\>

## References

<a id="deepequal"></a>

### deepEqual

Re-exports [deepEqual](index.md#deepequal)

***

<a id="schemasstructurallyequal"></a>

### schemasStructurallyEqual

Re-exports [schemasStructurallyEqual](index.md#schemasstructurallyequal)

***

<a id="tojsonschema"></a>

### toJsonSchema

Re-exports [toJsonSchema](index.md#tojsonschema)

***

<a id="validatejsonschema"></a>

### validateJsonSchema

Re-exports [validateJsonSchema](index.md#validatejsonschema)
