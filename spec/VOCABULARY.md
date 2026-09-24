# AXE Vocabulary

This file is the canonical list of every name that appears on the wire, in the SDK's public API, in the CLI, and in the derived MCP server. Every other document, every package, and every test refers to these names and nothing else.

**This file is the source of truth for code.** `scripts/gen-vocabulary.mjs` parses the tables below and generates `packages/core/src/vocabulary.ts`, exported as `WIRE` from `@axe/core/vocabulary`. A test regenerates the file and fails if it differs from what is committed. A second test (the drift test in `@axe/testing`) scans every Markdown page in `spec/`, `docs/`, and the root `README.md` and fails if an inline code span that looks like a wire name is not in this file, or if a name in this file is never mentioned in the docs or never used in source.

Rules for editing:

- One row per name. Names are exact, including case.
- `Key` is the TypeScript property under `WIRE.<category>`; it is camelCase and unique within its category.
- Do not rename a shipped name before 1.0 without a `DECISIONS.md` entry and a changeset.

## Protocol

| Category | Key     | Name      | Where                                                        | Meaning                                                                     |
| -------- | ------- | --------- | ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| protocol | version | `axe/0.1` | manifest `protocol`, index `protocol`, `AXE-Protocol` header | The protocol version implemented by this SDK. Format `axe/<major>.<minor>`. |

## Paths

| Category | Key           | Name                          | Where | Meaning                                                                                         |
| -------- | ------------- | ----------------------------- | ----- | ----------------------------------------------------------------------------------------------- |
| path     | manifest      | `/.well-known/axe.json`       | HTTP  | Primary manifest location. `GET` returns the manifest.                                          |
| path     | manifestAlias | `/axe/manifest`               | HTTP  | Secondary manifest location for hosts that cannot serve `.well-known`.                          |
| path     | index         | `/.well-known/axe-index.json` | HTTP  | Platform index of tenant manifests.                                                             |
| path     | actions       | `/axe/actions`                | HTTP  | Prefix for action invocation. `POST /axe/actions/{name}` invokes; `GET` returns the definition. |
| path     | continue      | `/axe/continue`               | HTTP  | `POST` to satisfy a `needs_input` requirement.                                                  |
| path     | resume        | `/axe/resume`                 | HTTP  | `POST` after a human handoff completes.                                                         |
| path     | poll          | `/axe/poll`                   | HTTP  | Prefix for the SDK's default `pending` poll URLs: `GET /axe/poll/{token}`.                      |

## Headers

| Category | Key             | Name               | Where                     | Meaning                                                                                 |
| -------- | --------------- | ------------------ | ------------------------- | --------------------------------------------------------------------------------------- |
| header   | protocol        | `AXE-Protocol`     | HTTP response and request | Protocol version. Servers send it on every response; agents may send it on requests.    |
| header   | manifest        | `AXE-Manifest`     | HTTP response             | Absolute URL of the manifest, for sites that cannot serve `.well-known`.                |
| header   | retryAfter      | `Retry-After`      | HTTP response             | Seconds to wait, on `429` and on `pending` results.                                     |
| header   | rateLimitPolicy | `RateLimit-Policy` | HTTP response             | Declared rate limit, emitted when `policies.rateLimit` is set, e.g. `60;w=60`.          |
| header   | authorization   | `Authorization`    | HTTP request              | `Bearer <token>` for `site` and `user` auth modes.                                      |
| header   | userAgent       | `User-Agent`       | HTTP request              | Agent self-identification, e.g. `AcmeAgent/2.1 (+https://acme.example/agent; axe/0.1)`. |
| header   | contentType     | `Content-Type`     | HTTP                      | Always `application/json` for AXE requests and responses.                               |

## Discovery hints

| Category | Key         | Name           | Where         | Meaning                                                                   |
| -------- | ----------- | -------------- | ------------- | ------------------------------------------------------------------------- |
| link     | manifestRel | `axe-manifest` | HTML `<head>` | `<link rel="axe-manifest" href="...">` points to the manifest.            |
| robots   | manifest    | `AXE-Manifest` | `robots.txt`  | `AXE-Manifest: <url>` directive. A hint, not access control.              |
| robots   | index       | `AXE-Index`    | `robots.txt`  | `AXE-Index: <url>` directive pointing at a platform index.                |
| query    | handoff     | `axe_handoff`  | handoff `url` | Query parameter the SDK appends to a handoff URL carrying the handoff id. |

## Result statuses

| Category | Key        | Name          | Where           | Meaning                                                                                   |
| -------- | ---------- | ------------- | --------------- | ----------------------------------------------------------------------------------------- |
| status   | ok         | `ok`          | result `status` | The action completed. `output` is present.                                                |
| status   | needsInput | `needs_input` | result `status` | The action needs something the agent may be able to provide. `accepts` lists the options. |
| status   | needsHuman | `needs_human` | result `status` | A human must act on the site. `handoff` is present.                                       |
| status   | pending    | `pending`     | result `status` | Long-running work. Poll `pollUrl` after `retryAfter` seconds.                             |
| status   | error      | `error`       | result `status` | The action failed. `error` is present.                                                    |

## Error codes

| Category | Key          | Name            | Where        | Meaning                                                                                                         |
| -------- | ------------ | --------------- | ------------ | --------------------------------------------------------------------------------------------------------------- |
| error    | invalidInput | `invalid_input` | `error.code` | Input or payload failed schema validation. `details.issues` names each path.                                    |
| error    | unauthorized | `unauthorized`  | `error.code` | Credentials are missing or invalid for the action's `auth` mode.                                                |
| error    | forbidden    | `forbidden`     | `error.code` | Credentials are valid but this principal may not perform the action.                                            |
| error    | notFound     | `not_found`     | `error.code` | Unknown action, unknown token, or a referenced entity does not exist.                                           |
| error    | conflict     | `conflict`      | `error.code` | State conflict: idempotency key reused with different input, token already consumed, handoff not yet completed. |
| error    | rateLimited  | `rate_limited`  | `error.code` | Too many requests. `Retry-After` is set.                                                                        |
| error    | unavailable  | `unavailable`   | `error.code` | Temporarily unavailable. Retry later.                                                                           |
| error    | internal     | `internal`      | `error.code` | Unexpected server failure.                                                                                      |
| error    | unsupported  | `unsupported`   | `error.code` | Unsupported protocol major version or unsupported feature.                                                      |

## Ladder (event) values

| Category | Key        | Name          | Where          | Meaning                                                                                |
| -------- | ---------- | ------------- | -------------- | -------------------------------------------------------------------------------------- |
| ladder   | ok         | `ok`          | event `ladder` | An action or continuation completed with `ok`.                                         |
| ladder   | needsInput | `needs_input` | event `ladder` | An action returned `needs_input`.                                                      |
| ladder   | continued  | `continued`   | event `ladder` | A `/axe/continue` request was processed (the resulting `status` is on the same event). |
| ladder   | needsHuman | `needs_human` | event `ladder` | An action or continuation returned `needs_human`.                                      |
| ladder   | resumed    | `resumed`     | event `ladder` | A `/axe/resume` request was processed.                                                 |
| ladder   | pending    | `pending`     | event `ladder` | An action returned `pending`.                                                          |
| ladder   | error      | `error`       | event `ladder` | An action, continuation, or resume returned `error`.                                   |

## Enumerations on actions and display

| Category    | Key          | Name            | Where                                | Meaning                                                                                  |
| ----------- | ------------ | --------------- | ------------------------------------ | ---------------------------------------------------------------------------------------- |
| risk        | none         | `none`          | action `risk`                        | Reading public data. Nothing changes.                                                    |
| risk        | low          | `low`           | action `risk`                        | Small, easily reversed change (save a search, add to a waitlist).                        |
| risk        | medium       | `medium`        | action `risk`                        | Commits the user to something reversible (a booking with free cancellation).             |
| risk        | high         | `high`          | action `risk`                        | Money, legal commitment, identity, or hard-to-reverse effects.                           |
| authMode    | none         | `none`          | action `auth`, manifest `auth.modes` | No credentials required.                                                                 |
| authMode    | site         | `site`          | action `auth`, manifest `auth.modes` | The agent authenticates with an API key.                                                 |
| authMode    | user         | `user`          | action `auth`, manifest `auth.modes` | The agent acts for an authenticated end user.                                            |
| displayKind | list         | `list`          | `display.kind`                       | A list of comparable items at `display.items`.                                           |
| displayKind | item         | `item`          | `display.kind`                       | A single item described by `display.item`.                                               |
| displayKind | table        | `table`         | `display.kind`                       | A list best shown as rows and columns.                                                   |
| displayKind | status       | `status`        | `display.kind`                       | The state of one thing (an order, an application).                                       |
| displayKind | document     | `document`      | `display.kind`                       | A long text or file the agent should summarize or link.                                  |
| format      | text         | `text`          | `attributes[].format`                | Plain text.                                                                              |
| format      | number       | `number`        | `attributes[].format`                | A number, no unit.                                                                       |
| format      | currency     | `currency`      | `attributes[].format`                | Money; the value is a number and the currency comes from `price` or the attribute label. |
| format      | date         | `date`          | `attributes[].format`                | ISO 8601 date.                                                                           |
| format      | datetime     | `datetime`      | `attributes[].format`                | ISO 8601 date-time.                                                                      |
| format      | boolean      | `boolean`       | `attributes[].format`                | True or false.                                                                           |
| format      | area         | `area`          | `attributes[].format`                | Area in square feet unless the label says otherwise.                                     |
| format      | distance     | `distance`      | `attributes[].format`                | Distance; the unit is stated in the label.                                               |
| format      | duration     | `duration`      | `attributes[].format`                | ISO 8601 duration or minutes as a number.                                                |
| format      | list         | `list`          | `attributes[].format`                | An array of short strings.                                                               |
| compare     | higherBetter | `higher-better` | `attributes[].compare`               | Larger values are preferable when comparing.                                             |
| compare     | lowerBetter  | `lower-better`  | `attributes[].compare`               | Smaller values are preferable when comparing.                                            |
| compare     | neutral      | `neutral`       | `attributes[].compare`               | No ordering preference.                                                                  |
| period      | once         | `once`          | `price.period`                       | One-time price.                                                                          |
| period      | hour         | `hour`          | `price.period`                       | Price per hour.                                                                          |
| period      | day          | `day`           | `price.period`                       | Price per day.                                                                           |
| period      | month        | `month`         | `price.period`                       | Price per month.                                                                         |
| period      | year         | `year`          | `price.period`                       | Price per year.                                                                          |
| tone        | formal       | `formal`        | `brand.tone`                         | Formal register when the agent speaks for the site.                                      |
| tone        | neutral      | `neutral`       | `brand.tone`                         | Neutral register.                                                                        |
| tone        | casual       | `casual`        | `brand.tone`                         | Casual register.                                                                         |

## Well-known kinds

| Category | Key                     | Name                        | Where            | Meaning                                                         |
| -------- | ----------------------- | --------------------------- | ---------------- | --------------------------------------------------------------- |
| kind     | paymentCard             | `payment.card`              | `accepts[].kind` | A tokenized payment card from the agent's wallet.               |
| kind     | paymentAchDebit         | `payment.ach-debit`         | `accepts[].kind` | Authorization for a one-time ACH debit.                         |
| kind     | paymentWireConfirmation | `payment.wire-confirmation` | `accepts[].kind` | Confirmation that a wire was sent per `accepts[].instructions`. |
| kind     | paymentInvoice          | `payment.invoice`           | `accepts[].kind` | Request to be invoiced on net terms.                            |
| kind     | identityGovernmentId    | `identity.government-id`    | `accepts[].kind` | Government-issued identity document details.                    |
| kind     | identityDateOfBirth     | `identity.date-of-birth`    | `accepts[].kind` | Date of birth.                                                  |
| kind     | identitySsnLast4        | `identity.ssn-last-4`       | `accepts[].kind` | Last four digits of a US Social Security number.                |
| kind     | documentUrl             | `document.url`              | `accepts[].kind` | A document the site can fetch from a URL.                       |
| kind     | documentBase64          | `document.base64`           | `accepts[].kind` | A document uploaded inline as base64.                           |
| kind     | contactEmail            | `contact.email`             | `accepts[].kind` | An email address.                                               |
| kind     | contactPhone            | `contact.phone`             | `accepts[].kind` | A phone number.                                                 |
| kind     | contactAddress          | `contact.address`           | `accepts[].kind` | A postal address.                                               |
| kind     | consentTerms            | `consent.terms`             | `accepts[].kind` | Acknowledgment of a specific policy version and scope.          |
| kind     | customPrefix            | `x-`                        | `accepts[].kind` | Prefix for site-defined kinds: `x-<org>.<name>`.                |

## Reason conventions

| Category | Key              | Name                | Where                          | Meaning                                                             |
| -------- | ---------------- | ------------------- | ------------------------------ | ------------------------------------------------------------------- |
| reason   | loginRequired    | `login_required`    | `needs_human` `handoff.reason` | Emitted by the SDK when a `user` action is called without identity. |
| reason   | paymentRequired  | `payment_required`  | `needs_input` `reason`         | Recommended reason string when `accepts` are payment kinds.         |
| reason   | consentRequired  | `consent_required`  | `needs_input` `reason`         | Recommended reason string when `accepts` are consent kinds.         |
| reason   | identityRequired | `identity_required` | `needs_input` `reason`         | Recommended reason string when `accepts` are identity kinds.        |
| reason   | documentRequired | `document_required` | `needs_input` `reason`         | Recommended reason string when `accepts` are document kinds.        |

## MCP tool names

| Category | Key      | Name           | Where      | Meaning                                                                                 |
| -------- | -------- | -------------- | ---------- | --------------------------------------------------------------------------------------- |
| tool     | continue | `axe_continue` | MCP server | Satisfy a `needs_input` requirement with a chosen `kind` and `payload`.                 |
| tool     | resume   | `axe_resume`   | MCP server | Resume after a human handoff with a `resumeToken`.                                      |
| tool     | manifest | `axe_manifest` | MCP server | Return the site's manifest so the model can read descriptions and the affordance graph. |
| tool     | poll     | `axe_poll`     | MCP server | Poll a `pending` result's `pollUrl` until it settles.                                   |

## CLI commands

| Category | Key         | Name              | Where | Meaning                                                     |
| -------- | ----------- | ----------------- | ----- | ----------------------------------------------------------- |
| cli      | init        | `axe init`        | CLI   | Scaffold an `axe.ts` for a framework.                       |
| cli      | validate    | `axe validate`    | CLI   | Load an `axe.ts`, validate the manifest, lint descriptions. |
| cli      | inspect     | `axe inspect`     | CLI   | Discover and print a manifest and its affordance graph.     |
| cli      | preview     | `axe preview`     | CLI   | Call a read action and render the result to HTML.           |
| cli      | conformance | `axe conformance` | CLI   | Run the conformance suite against a URL.                    |
| cli      | audit       | `axe audit`       | CLI   | Produce the AXE Score and fix list.                         |
| cli      | mcp         | `axe mcp`         | CLI   | Serve any AXE site as an MCP server over stdio.             |

## Fields

Every JSON property name on the wire. `Where` uses dotted paths from the enclosing document: `manifest.`, `action.`, `request.`, `result.`, `handoff.`, `accepts[].`, `display.`, `event.`, `index.`.

| Category | Key                      | Name                       | Where                                                                                                              | Meaning                                                                            |
| -------- | ------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| field    | protocol                 | `protocol`                 | `manifest.protocol`, `index.protocol`                                                                              | Protocol version string.                                                           |
| field    | name                     | `name`                     | `manifest.name`, `action.name`, `brand.name`, `agent.name`, `platform.name`, `sites[].name`, `flows[].name`        | Identifier or display name, depending on context.                                  |
| field    | description              | `description`              | `manifest.description`, `action.description`, `accepts[].description`, `flows[].description`, schema `description` | Agent-facing text. Subject to the honesty rules.                                   |
| field    | baseUrl                  | `baseUrl`                  | `manifest.baseUrl`                                                                                                 | Absolute origin (and optional prefix) that `/axe/...` paths are relative to.       |
| field    | humanFallbackUrl         | `humanFallbackUrl`         | `manifest.humanFallbackUrl`                                                                                        | The normal website for humans.                                                     |
| field    | auth                     | `auth`                     | `manifest.auth`, `action.auth`                                                                                     | Manifest: supported modes and login URL. Action: required mode.                    |
| field    | modes                    | `modes`                    | `manifest.auth.modes`                                                                                              | Array of supported auth modes.                                                     |
| field    | userLoginUrl             | `userLoginUrl`             | `manifest.auth.userLoginUrl`                                                                                       | Where a human logs in and consents during a `login_required` handoff.              |
| field    | actions                  | `actions`                  | `manifest.actions`                                                                                                 | Array of action definitions.                                                       |
| field    | flows                    | `flows`                    | `manifest.flows`                                                                                                   | Optional named paths through the affordance graph.                                 |
| field    | steps                    | `steps`                    | `flows[].steps`                                                                                                    | Ordered action names in a flow.                                                    |
| field    | policies                 | `policies`                 | `manifest.policies`                                                                                                | Rate limit, terms, retention, and agent allow/deny.                                |
| field    | rateLimit                | `rateLimit`                | `manifest.policies.rateLimit`                                                                                      | `{ requestsPerMinute, burst? }`.                                                   |
| field    | requestsPerMinute        | `requestsPerMinute`        | `policies.rateLimit.requestsPerMinute`                                                                             | Sustained request budget per agent identity.                                       |
| field    | burst                    | `burst`                    | `policies.rateLimit.burst`                                                                                         | Short-term allowance above the sustained rate.                                     |
| field    | termsUrl                 | `termsUrl`                 | `manifest.policies.termsUrl`                                                                                       | Terms that govern agent access.                                                    |
| field    | dataRetention            | `dataRetention`            | `manifest.policies.dataRetention`                                                                                  | Plain-language note on how long submitted data is kept.                            |
| field    | agents                   | `agents`                   | `manifest.policies.agents`                                                                                         | `{ allow?, deny? }` lists of agent vendors. Deny wins.                             |
| field    | allow                    | `allow`                    | `policies.agents.allow`                                                                                            | Vendors permitted. `*` means all.                                                  |
| field    | deny                     | `deny`                     | `policies.agents.deny`                                                                                             | Vendors refused.                                                                   |
| field    | contact                  | `contact`                  | `manifest.contact`, `agent.contact`                                                                                | `{ email?, url? }` for the site; a URL or email for an agent.                      |
| field    | email                    | `email`                    | `contact.email`                                                                                                    | Contact email address.                                                             |
| field    | brand                    | `brand`                    | `manifest.brand`                                                                                                   | Rendering hints: `name`, `logoUrl`, `accentColor`, `tone`.                         |
| field    | logoUrl                  | `logoUrl`                  | `manifest.brand.logoUrl`                                                                                           | Absolute HTTPS URL of a logo.                                                      |
| field    | accentColor              | `accentColor`              | `manifest.brand.accentColor`                                                                                       | CSS hex color.                                                                     |
| field    | tone                     | `tone`                     | `manifest.brand.tone`                                                                                              | `formal`, `neutral`, or `casual`.                                                  |
| field    | indexUrl                 | `indexUrl`                 | `manifest.indexUrl`                                                                                                | Platform index this site belongs to.                                               |
| field    | updatedAt                | `updatedAt`                | `manifest.updatedAt`, `index.sites[].updatedAt`                                                                    | ISO 8601 timestamp of the last change.                                             |
| field    | platform                 | `platform`                 | `index.platform`                                                                                                   | `{ name, url }` of the hosting platform.                                           |
| field    | sites                    | `sites`                    | `index.sites`                                                                                                      | Array of `{ name, manifestUrl, updatedAt, tags? }`.                                |
| field    | manifestUrl              | `manifestUrl`              | `index.sites[].manifestUrl`                                                                                        | Absolute URL of a tenant's manifest.                                               |
| field    | tags                     | `tags`                     | `index.sites[].tags`                                                                                               | Free-form labels for filtering an index.                                           |
| field    | next                     | `next`                     | `index.next`                                                                                                       | URL of the next index page, or absent.                                             |
| field    | title                    | `title`                    | `action.title`, `accepts[].title`, `affordances[].title`, `display.item.title`, `flows[].title`                    | Short human-readable label.                                                        |
| field    | input                    | `input`                    | `action.input`, `request.input`, `affordances[].input`, `examples[].input`                                         | Input schema, input value, or bound input.                                         |
| field    | output                   | `output`                   | `action.output`, `result.output`, `examples[].output`                                                              | Output schema or output value.                                                     |
| field    | readOnly                 | `readOnly`                 | `action.readOnly`                                                                                                  | The action changes nothing.                                                        |
| field    | idempotent               | `idempotent`               | `action.idempotent`                                                                                                | Repeating with the same `idempotencyKey` has no additional effect.                 |
| field    | reversible               | `reversible`               | `action.reversible`                                                                                                | The effect can be undone through another action or by the site.                    |
| field    | risk                     | `risk`                     | `action.risk`                                                                                                      | `none`, `low`, `medium`, `high`.                                                   |
| field    | examples                 | `examples`                 | `action.examples`                                                                                                  | Array of `{ input, output }` pairs that validate against the schemas.              |
| field    | display                  | `display`                  | `action.display`                                                                                                   | Presentation hints for the output.                                                 |
| field    | affordances              | `affordances`              | `action.affordances`, `_axe.affordances`                                                                           | Follow-up actions with bound inputs. Static on the action, dynamic under `_axe`.   |
| field    | pagination               | `pagination`               | `action.pagination`                                                                                                | `{ cursorIn, cursorOut, pageSize }`.                                               |
| field    | cursorIn                 | `cursorIn`                 | `action.pagination.cursorIn`                                                                                       | JSON Pointer into `input` for the cursor.                                          |
| field    | cursorOut                | `cursorOut`                | `action.pagination.cursorOut`                                                                                      | JSON Pointer into `output` for the next cursor.                                    |
| field    | pageSize                 | `pageSize`                 | `action.pagination.pageSize`                                                                                       | `{ default, max }`.                                                                |
| field    | default                  | `default`                  | `pagination.pageSize.default`                                                                                      | Items per page when unspecified.                                                   |
| field    | max                      | `max`                      | `pagination.pageSize.max`                                                                                          | Largest page the action will return.                                               |
| field    | freshness                | `freshness`                | `action.freshness`                                                                                                 | `{ cacheTtlSeconds?, validUntil? }`.                                               |
| field    | cacheTtlSeconds          | `cacheTtlSeconds`          | `action.freshness.cacheTtlSeconds`                                                                                 | How long an agent may cache the output.                                            |
| field    | validUntil               | `validUntil`               | `action.freshness.validUntil`                                                                                      | JSON Pointer into `output` for a per-response expiry timestamp.                    |
| field    | humanHandoff             | `humanHandoff`             | `action.humanHandoff`                                                                                              | `{ reasons }`: whether and why the action may return `needs_human`.                |
| field    | reasons                  | `reasons`                  | `action.humanHandoff.reasons`                                                                                      | Reason strings the action may emit.                                                |
| field    | deprecated               | `deprecated`               | `action.deprecated`                                                                                                | `{ since, replacedBy? }`.                                                          |
| field    | since                    | `since`                    | `action.deprecated.since`                                                                                          | Date or version the deprecation began.                                             |
| field    | replacedBy               | `replacedBy`               | `action.deprecated.replacedBy`                                                                                     | Name of the replacement action.                                                    |
| field    | kind                     | `kind`                     | `display.kind`, `accepts[].kind`, `continue request kind`, `event.kind`                                            | Display kind, requirement kind, or the kind used to continue.                      |
| field    | items                    | `items`                    | `display.items`                                                                                                    | JSON Pointer into `output` locating the array of items.                            |
| field    | item                     | `item`                     | `display.item`                                                                                                     | Pointer map describing one item.                                                   |
| field    | id                       | `id`                       | `display.item.id`                                                                                                  | JSON Pointer to a stable identifier the agent echoes back.                         |
| field    | subtitle                 | `subtitle`                 | `display.item.subtitle`                                                                                            | JSON Pointer to a secondary line.                                                  |
| field    | summary                  | `summary`                  | `display.item.summary`                                                                                             | JSON Pointer to a one-paragraph summary.                                           |
| field    | image                    | `image`                    | `display.item.image`                                                                                               | JSON Pointer (or array of pointers) to absolute image URLs.                        |
| field    | url                      | `url`                      | `display.item.url`, `handoff.url`, `contact.url`, `platform.url`, `document.url` payload                           | The human-facing page for an item, a handoff, a contact, or a document.            |
| field    | price                    | `price`                    | `display.item.price`                                                                                               | `{ amount, currency, period? }`.                                                   |
| field    | amount                   | `amount`                   | `display.item.price.amount`, payment payloads                                                                      | JSON Pointer to a numeric amount, or a numeric amount.                             |
| field    | currency                 | `currency`                 | `display.item.price.currency`, payment payloads                                                                    | JSON Pointer or literal ISO 4217 code.                                             |
| field    | period                   | `period`                   | `display.item.price.period`                                                                                        | `once`, `hour`, `day`, `month`, `year`.                                            |
| field    | attributes               | `attributes`               | `display.item.attributes`                                                                                          | Ordered `{ label, path, format?, compare? }` entries.                              |
| field    | label                    | `label`                    | `attributes[].label`                                                                                               | Column heading for an attribute.                                                   |
| field    | path                     | `path`                     | `attributes[].path`, `error.details.issues[].path`                                                                 | JSON Pointer to the attribute value; or the path of a validation issue.            |
| field    | format                   | `format`                   | `attributes[].format`                                                                                              | How to render the attribute.                                                       |
| field    | compare                  | `compare`                  | `attributes[].compare`                                                                                             | Which direction is better.                                                         |
| field    | badges                   | `badges`                   | `display.item.badges`                                                                                              | JSON Pointers to short strings.                                                    |
| field    | suggestedComparison      | `suggestedComparison`      | `display.suggestedComparison`                                                                                      | Attribute labels to lead with.                                                     |
| field    | emptyMessage             | `emptyMessage`             | `display.emptyMessage`                                                                                             | What the agent tells the user when there are no items.                             |
| field    | disclaimer               | `disclaimer`               | `display.disclaimer`                                                                                               | Text that MUST accompany any rendering.                                            |
| field    | action                   | `action`                   | `affordances[].action`, `event.action`                                                                             | Name of the target or invoked action.                                              |
| field    | primary                  | `primary`                  | `affordances[].primary`                                                                                            | The one affordance to offer most prominently.                                      |
| field    | axeReserved              | `_axe`                     | `result.output._axe`, item `_axe`                                                                                  | Reserved key for dynamic `affordances`. Stripped before validation.                |
| field    | context                  | `context`                  | `request.context`                                                                                                  | `{ onBehalfOf?, locale?, timezone?, agent?, sessionId? }`.                         |
| field    | onBehalfOf               | `onBehalfOf`               | `request.context.onBehalfOf`                                                                                       | Opaque end-user identity established by the site's auth.                           |
| field    | locale                   | `locale`                   | `request.context.locale`                                                                                           | BCP 47 language tag.                                                               |
| field    | timezone                 | `timezone`                 | `request.context.timezone`                                                                                         | IANA time zone name.                                                               |
| field    | agent                    | `agent`                    | `request.context.agent`, `event.agent`                                                                             | `{ name, version, vendor, contact? }`.                                             |
| field    | version                  | `version`                  | `agent.version`                                                                                                    | Agent software version.                                                            |
| field    | vendor                   | `vendor`                   | `agent.vendor`                                                                                                     | Organization operating the agent; matched against `policies.agents`.               |
| field    | sessionId                | `sessionId`                | `request.context.sessionId`                                                                                        | Agent-chosen id correlating calls in one task.                                     |
| field    | idempotencyKey           | `idempotencyKey`           | `request.idempotencyKey`                                                                                           | Client-chosen key; replay returns the original result.                             |
| field    | status                   | `status`                   | `result.status`, `event.status`                                                                                    | Result discriminator.                                                              |
| field    | reason                   | `reason`                   | `result.reason`, `handoff.reason`                                                                                  | Short machine-readable code for why input or a human is needed.                    |
| field    | message                  | `message`                  | `result.message`, `error.message`                                                                                  | Agent-facing explanation.                                                          |
| field    | accepts                  | `accepts`                  | `result.accepts`                                                                                                   | Ordered alternatives that satisfy the requirement.                                 |
| field    | schema                   | `schema`                   | `accepts[].schema`                                                                                                 | JSON Schema for the payload of this kind.                                          |
| field    | sensitive                | `sensitive`                | `accepts[].sensitive`                                                                                              | Agents MUST confirm with the user before sending.                                  |
| field    | instructions             | `instructions`             | `accepts[].instructions`, `handoff.instructions`                                                                   | Agent-read text to relay (accepts) or what the human must do (handoff).            |
| field    | continuationToken        | `continuationToken`        | `result.continuationToken`, continue request                                                                       | Signed, opaque token identifying the open requirement.                             |
| field    | expiresAt                | `expiresAt`                | `result.expiresAt`, `handoff.expiresAt`                                                                            | ISO 8601 expiry of the token.                                                      |
| field    | fallback                 | `fallback`                 | `result.fallback`                                                                                                  | Embedded handoff to use when no `accepts` entry can be satisfied.                  |
| field    | payload                  | `payload`                  | continue request                                                                                                   | The value satisfying the chosen kind.                                              |
| field    | handoff                  | `handoff`                  | `result.handoff`                                                                                                   | `{ reason, instructions, url, resumeToken, expiresAt, whatAgentShouldSayToUser }`. |
| field    | resumeToken              | `resumeToken`              | `handoff.resumeToken`, resume request                                                                              | Signed, opaque token to resume after the human acts.                               |
| field    | whatAgentShouldSayToUser | `whatAgentShouldSayToUser` | `handoff.whatAgentShouldSayToUser`                                                                                 | How the agent should frame the handoff to its user.                                |
| field    | pollUrl                  | `pollUrl`                  | `result.pollUrl`                                                                                                   | Absolute URL to `GET` for the eventual result.                                     |
| field    | retryAfter               | `retryAfter`               | `result.retryAfter`                                                                                                | Seconds to wait before polling.                                                    |
| field    | error                    | `error`                    | `result.error`                                                                                                     | `{ code, message, retryable, details? }`.                                          |
| field    | code                     | `code`                     | `error.code`                                                                                                       | One of the error codes.                                                            |
| field    | retryable                | `retryable`                | `error.retryable`                                                                                                  | Whether an identical retry could succeed.                                          |
| field    | details                  | `details`                  | `error.details`                                                                                                    | Structured extra data; `issues` for `invalid_input`.                               |
| field    | issues                   | `issues`                   | `error.details.issues`                                                                                             | Array of `{ path, message, expected? }` validation problems.                       |
| field    | expected                 | `expected`                 | `error.details.issues[].expected`                                                                                  | What the schema wanted at `path`.                                                  |
| field    | schemaVersion            | `schemaVersion`            | `event.schemaVersion`                                                                                              | Event schema version, currently `1`.                                               |
| field    | ts                       | `ts`                       | `event.ts`                                                                                                         | ISO 8601 timestamp of the event.                                                   |
| field    | latencyMs                | `latencyMs`                | `event.latencyMs`                                                                                                  | Server-side processing time.                                                       |
| field    | ladder                   | `ladder`                   | `event.ladder`                                                                                                     | Where on the escalation ladder this request landed.                                |
| field    | errorCode                | `errorCode`                | `event.errorCode`                                                                                                  | `error.code` when `status` is `error`.                                             |
| field    | tenant                   | `tenant`                   | `event.tenant`                                                                                                     | Tenant id on multi-tenant platforms.                                               |

## Kind payload fields

Property names inside well-known kind payloads (`spec/KINDS.md`). `Where` names the kinds that carry the field.

| Category | Key | Name | Where | Meaning |
| -------- | --- | ---- | ----- | ------- |
| payload | token | `token` | `payment.card` | PSP-issued single-use or network token. |
| payload | provider | `provider` | `payment.card` | Payment service provider identifier. |
| payload | brand | `brand` | `payment.card` | Card network, lowercase. (Also `manifest.brand`, listed under fields.) |
| payload | last4 | `last4` | `payment.card`, `identity.ssn-last-4` | Last four digits. |
| payload | expMonth | `expMonth` | `payment.card` | Expiry month, 1–12. |
| payload | expYear | `expYear` | `payment.card` | Four-digit expiry year. |
| payload | billingPostalCode | `billingPostalCode` | `payment.card` | Billing postal code. |
| payload | accountHolderName | `accountHolderName` | `payment.ach-debit` | Name on the bank account. |
| payload | routingNumber | `routingNumber` | `payment.ach-debit` | ABA routing number. |
| payload | accountNumber | `accountNumber` | `payment.ach-debit` | Bank account number. |
| payload | accountType | `accountType` | `payment.ach-debit` | `checking` or `savings`. |
| payload | authorizedAt | `authorizedAt` | `payment.ach-debit` | When the user authorized the debit. |
| payload | authorizationText | `authorizationText` | `payment.ach-debit` | The exact authorization text the user agreed to. |
| payload | referenceNumber | `referenceNumber` | `payment.wire-confirmation` | Bank reference, IMAD, or OMAD. |
| payload | sentAt | `sentAt` | `payment.wire-confirmation` | When the wire was sent. |
| payload | bankName | `bankName` | `payment.wire-confirmation` | Sending bank. |
| payload | companyName | `companyName` | `payment.invoice` | Company to invoice. |
| payload | billingEmail | `billingEmail` | `payment.invoice` | Accounts-payable email. |
| payload | purchaseOrderNumber | `purchaseOrderNumber` | `payment.invoice` | Purchase order reference. |
| payload | netTermsDays | `netTermsDays` | `payment.invoice` | Requested payment terms in days. |
| payload | taxId | `taxId` | `payment.invoice` | VAT or EIN. |
| payload | documentType | `documentType` | `identity.government-id` | `passport`, `drivers-license`, `national-id`, or `residence-permit`. |
| payload | documentNumber | `documentNumber` | `identity.government-id` | Document number. |
| payload | issuingCountry | `issuingCountry` | `identity.government-id` | ISO 3166-1 alpha-2 country. |
| payload | fullName | `fullName` | `identity.government-id` | Name as printed on the document. |
| payload | dateOfBirth | `dateOfBirth` | `identity.government-id`, `identity.date-of-birth` | Date of birth. |
| payload | expiresOn | `expiresOn` | `identity.government-id` | Document expiry date. |
| payload | mimeType | `mimeType` | `document.url`, `document.base64` | MIME type of the document. |
| payload | filename | `filename` | `document.url`, `document.base64` | File name. |
| payload | sizeBytes | `sizeBytes` | `document.url` | Size in bytes. |
| payload | contentBase64 | `contentBase64` | `document.base64` | Base64-encoded content. |
| payload | phone | `phone` | `contact.phone` | E.164 phone number. |
| payload | canReceiveSms | `canReceiveSms` | `contact.phone` | Whether the number receives SMS. |
| payload | line1 | `line1` | `contact.address` | Address line 1. |
| payload | line2 | `line2` | `contact.address` | Address line 2. |
| payload | city | `city` | `contact.address` | City. |
| payload | region | `region` | `contact.address` | State, province, or prefecture. |
| payload | postalCode | `postalCode` | `contact.address` | Postal code. |
| payload | country | `country` | `contact.address` | ISO 3166-1 alpha-2 country. |
| payload | policyUrl | `policyUrl` | `consent.terms` | The policy document agreed to. |
| payload | policyVersion | `policyVersion` | `consent.terms` | Exact version identifier or date. |
| payload | scope | `scope` | `consent.terms` | What the consent covers. |
| payload | acceptedAt | `acceptedAt` | `consent.terms` | When consent was given. |
| payload | acceptedBy | `acceptedBy` | `consent.terms` | Who consented, when the site requires it. |

## SDK API

Public TypeScript identifiers that the docs refer to. Each must exist with this spelling in a package's exported types.

| Category | Key                  | Name                   | Where                 | Meaning                                                                    |
| -------- | -------------------- | ---------------------- | --------------------- | -------------------------------------------------------------------------- |
| api      | createAXE            | `createAXE`            | `@axe/core`           | Create a server instance from site configuration.                          |
| api      | action               | `action`               | `@axe/core`           | Define an action with schemas, metadata, and handlers.                     |
| api      | register             | `register`             | `@axe/core`           | Add an action to a server.                                                 |
| api      | describe             | `describe`             | `@axe/core`           | Return the manifest object, optionally for a tenant.                       |
| api      | fetchHandler         | `fetchHandler`         | `@axe/core`           | Get a `(Request) => Promise<Response>` for the whole protocol surface.     |
| api      | handler              | `handler`              | `@axe/core`           | The function that runs when an action is invoked.                          |
| api      | needsInput           | `needsInput`           | `@axe/core`           | Helper passed to handlers that mints a `needs_input` result.               |
| api      | onContinue           | `onContinue`           | `@axe/core`           | Action hook that receives a validated continuation.                        |
| api      | onResume             | `onResume`             | `@axe/core`           | Action hook that runs after a human handoff.                               |
| api      | onPoll               | `onPoll`               | `@axe/core`           | Action hook that produces the current result for a `pending` action.       |
| api      | state                | `state`                | `@axe/core`           | Server-side object attached to a token and delivered back to hooks.        |
| api      | completeHandoff      | `completeHandoff`      | `@axe/core`           | Record that the human finished a handoff, optionally binding identity.     |
| api      | resolveDisplay       | `resolveDisplay`       | `@axe/core/display`   | Apply `display` pointers to an output and return a `PresentedResult`.      |
| api      | kinds                | `kinds`                | `@axe/core/kinds`     | Typed definitions of every well-known kind.                                |
| api      | accept               | `accept`               | `@axe/core/kinds`     | Build an `accepts[]` entry from a kind definition.                         |
| api      | lintAgentText        | `lintAgentText`        | `@axe/core/lint`      | Apply the honesty rules to one string.                                     |
| api      | lintManifest         | `lintManifest`         | `@axe/core/lint`      | Apply all lint rules to a manifest.                                        |
| api      | onRequest            | `onRequest`            | `@axe/core`           | Hook called before an action runs; may short-circuit with a result.        |
| api      | onResult             | `onResult`             | `@axe/core`           | Hook called with every result envelope.                                    |
| api      | onError              | `onError`              | `@axe/core`           | Hook called when a handler throws.                                         |
| api      | onEvent              | `onEvent`              | `@axe/core`           | Hook receiving every analytics event; sinks attach here.                   |
| api      | consoleSink          | `consoleSink`          | `@axe/core/events`    | Event sink that prints one JSON line per event to stdout.                  |
| api      | jsonlFileSink        | `jsonlFileSink`        | `@axe/core/events`    | Event sink that appends JSON lines to a file.                              |
| api      | otelSink             | `otelSink`             | `@axe/core/events`    | Event sink that records OpenTelemetry metrics and spans.                   |
| api      | tokenStore           | `tokenStore`           | `@axe/core`           | Configuration slot for a `TokenStore` implementation.                      |
| api      | idempotencyStore     | `idempotencyStore`     | `@axe/core`           | Configuration slot for an `IdempotencyStore` implementation.               |
| api      | secret               | `secret`               | `@axe/core`           | HMAC secret used to sign tokens.                                           |
| api      | cors                 | `cors`                 | `@axe/core`           | Opt-in CORS configuration.                                                 |
| api      | authenticate         | `authenticate`         | `@axe/core`           | Site-supplied function that turns a request into an `onBehalfOf` identity. |
| api      | verifySiteKey        | `verifySiteKey`        | `@axe/core`           | Site-supplied function that validates a `site` mode bearer key.            |
| api      | index                | `index`                | `@axe/core`           | Configuration for serving a platform index.                                |
| api      | discover             | `discover`             | `@axe/client`         | Find a manifest from any URL.                                              |
| api      | manifest             | `manifest`             | `@axe/client`         | Return the loaded manifest.                                                |
| api      | invoke               | `invoke`               | `@axe/client`         | Call an action and return the result envelope.                             |
| api      | continue             | `continue`             | `@axe/client`         | Satisfy a `needs_input` requirement.                                       |
| api      | resume               | `resume`               | `@axe/client`         | Resume after a handoff.                                                    |
| api      | poll                 | `poll`                 | `@axe/client`         | Poll a `pending` result until it settles.                                  |
| api      | run                  | `run`                  | `@axe/client`         | Drive the whole escalation ladder with registered fulfillers.              |
| api      | fulfillers           | `fulfillers`           | `@axe/client`         | Client option: providers keyed by kind.                                    |
| api      | confirm              | `confirm`              | `@axe/client`         | Client callback invoked before sending a `sensitive` payload.              |
| api      | present              | `present`              | `@axe/client/present` | Turn an `ok` result into a `PresentedResult`.                              |
| api      | toMarkdown           | `toMarkdown`           | `@axe/client/present` | Render a `PresentedResult` as a Markdown comparison table.                 |
| api      | toHTML               | `toHTML`               | `@axe/client/present` | Render a `PresentedResult` as a self-contained HTML page.                  |
| api      | createMcpServer      | `createMcpServer`      | `@axe/mcp`            | Derive an MCP server from an AXE server or manifest URL.                   |
| api      | serveStdio           | `serveStdio`           | `@axe/mcp`            | Connect an MCP server to stdio.                                            |
| api      | serveHttp            | `serveHttp`            | `@axe/mcp`            | Get a fetch handler for the Streamable HTTP transport.                     |
| api      | axeExpress           | `axeExpress`           | `@axe/express`        | Express and Connect middleware.                                            |
| api      | axeNext              | `axeNext`              | `@axe/next`           | App Router route handlers.                                                 |
| api      | axeNextPages         | `axeNextPages`         | `@axe/next`           | Pages API route handler.                                                   |
| api      | axeFetch             | `axeFetch`             | `@axe/fetch`          | Web-standard fetch handler with context injection.                         |
| api      | runConformance       | `runConformance`       | `@axe/testing`        | Run the conformance suite against a URL.                                   |
| api      | runAudit             | `runAudit`             | `@axe/testing`        | Produce an AXE Score report for a URL.                                     |
| api      | createTestClient     | `createTestClient`     | `@axe/testing`        | In-process client bound to an AXE server for unit tests.                   |
| api      | checkVocabularyDrift | `checkVocabularyDrift` | `@axe/testing`        | The drift test as a function, for use in other repositories.               |
