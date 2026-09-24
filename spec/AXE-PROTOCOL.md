# AXE Protocol Specification

**Version:** `axe/0.1`
**Status:** Draft. The protocol may change before 1.0. Changes are recorded in `CHANGELOG.md` and reasoned about in `DECISIONS.md`.

AXE (Agentic eXperience Engineering) is an HTTP-native protocol that lets an organization with a web presence expose an agent-specific interface alongside its human-facing site. A site declares **what it can do** (actions), **how to present results** (display and affordances), **what it needs to finish** (requirements the agent may satisfy), and **when a human must step in** (structured handoff with resume). Agents discover the declaration, call actions with plain JSON over HTTPS, and climb an explicit escalation ladder: complete, ask the agent for a specific thing, hand off to the human.

Companion documents, all normative:

- [`VOCABULARY.md`](./VOCABULARY.md): every name used on the wire.
- [`KINDS.md`](./KINDS.md): the registry of well-known requirement kinds and their schemas.
- [`EVENTS.md`](./EVENTS.md): the analytics event emitted by conforming servers.
- [`schemas/`](./schemas/): JSON Schemas for the manifest, request, result, index, event, live state, and each kind.

## 1. Conformance language and terminology

The key words MUST, MUST NOT, REQUIRED, SHALL, SHALL NOT, SHOULD, SHOULD NOT, RECOMMENDED, MAY, and OPTIONAL are to be interpreted as described in RFC 2119.

Requirements are numbered `[P-<AREA>-<n>]` so tests and conformance checks can cite them. A requirement's number is stable once published.

- **Site**: the organization exposing an AXE interface, and the server that serves it.
- **Agent**: software acting on behalf of a **user** (a human) that calls the site.
- **Manifest**: the JSON document that declares a site's AXE interface.
- **Action**: a named, typed operation the site exposes.
- **Requirement**: something an action needs before it can complete, expressed as a `needs_input` result with one or more `accepts` entries.
- **Kind**: the namespaced type of a requirement payload, such as `payment.ach-debit`.
- **Handoff**: a structured request that the human act on the site directly, expressed as a `needs_human` result or as the `fallback` of a `needs_input` result.
- **Ladder**: the ordered escalation `ok` → `needs_input` → `needs_human`.
- **Platform**: a host that serves AXE for many **tenants**, each with its own manifest.

All JSON on the wire is UTF-8. JSON Schema references are to draft 2020-12. JSON Pointers are RFC 6901.

## 2. Versioning

**[P-VER-1]** The protocol version is a string of the form `axe/<major>.<minor>`. This document defines `axe/0.1`.

**[P-VER-2]** Servers MUST include the `AXE-Protocol` response header, whose value is the protocol version the server implements, on every response to an AXE endpoint, including error responses and the manifest.

**[P-VER-3]** Agents MAY send an `AXE-Protocol` request header naming the version they implement. Servers MUST accept requests without it.

**[P-VER-4]** Servers MUST ignore unknown fields in request envelopes and agents MUST ignore unknown fields in manifests and result envelopes. This is how minor versions add features.

**[P-VER-5]** When a request's `AXE-Protocol` header names a different major version than the server implements, the server MUST respond with an `error` result whose `code` is `unsupported`. Different minor versions within the same major are compatible.

Before 1.0 the major version is `0`, and minor versions MAY contain incompatible changes. Implementations of `axe/0.x` SHOULD log the peer's version so that incompatibilities are diagnosable.

## 3. Discovery

### 3.1 Manifest location

**[P-DISC-1]** A site MUST serve its manifest at `/.well-known/axe.json` relative to the origin of `baseUrl`, or provide at least one of the alternate hints in §3.2 that resolves to a manifest.

**[P-DISC-2]** A server built with this SDK also serves the manifest at `/axe/manifest`. Sites MAY serve it there when they cannot write to `.well-known`.

**[P-DISC-3]** The manifest response MUST have `Content-Type: application/json` and SHOULD carry a `Cache-Control` header allowing caching for at least 60 seconds. Manifests change rarely; agents fetch them often.

### 3.2 Alternate hints

**[P-DISC-4]** An HTML page MAY include `<link rel="axe-manifest" href="<url>">` in its `<head>`. Agents that discover through HTML MUST honor it.

**[P-DISC-5]** Any HTTP response from the site MAY include an `AXE-Manifest: <absolute-url>` header. Agents MUST treat it as equivalent to the link tag.

**[P-DISC-6]** `robots.txt` MAY contain `AXE-Manifest: <url>` and `AXE-Index: <url>` lines. These are hints for crawlers and agents, not access control. Standard `robots.txt` rules continue to apply to the human site and say nothing about AXE endpoints.

**[P-DISC-7]** An agent discovering from an arbitrary URL SHOULD try, in order: `/.well-known/axe.json` on that origin, `/axe/manifest`, the `AXE-Manifest` response header of the URL, and the `axe-manifest` link tag in the URL's HTML.

### 3.3 Platform index

A platform that hosts many sites publishes an **index**: a paginated list of manifests.

**[P-DISC-8]** An index is a JSON document with `protocol`, `platform: { name, url }`, `sites: [ { name, manifestUrl, updatedAt, tags? } ]`, and an optional `next` URL for the following page. It is served at `/.well-known/axe-index.json` on the platform's origin, referenced from `robots.txt` with `AXE-Index`, or referenced from a tenant manifest's `indexUrl`.

**[P-DISC-9]** Every `manifestUrl` in an index MUST be absolute and MUST resolve to a manifest whose `baseUrl` origin matches the `manifestUrl` origin. Tenants serve their own manifest at their own domain.

**[P-DISC-10]** An index page SHOULD contain at most 1000 sites. Pages MUST be traversed by following `next` until it is absent.

### 3.4 Opting out

A manifest is an invitation. A site that publishes one is asking agents to use it instead of driving the human UI.

**[P-DISC-11]** A site that wants to refuse specific agents MUST express that in `policies.agents`: `{ allow?: string[], deny?: string[] }`, matched case-insensitively against `context.agent.vendor`. `deny` wins over `allow`. `allow: ["*"]` or an absent `allow` permits all vendors not denied.

**[P-DISC-12]** Agents MUST NOT call actions on a site whose `policies.agents` denies their vendor. Servers MAY additionally enforce the policy by returning `forbidden`.

## 4. Manifest

**[P-MAN-1]** A manifest MUST validate against `schemas/manifest.schema.json`. Its required members are `protocol`, `name`, `description`, `baseUrl`, `auth`, and `actions`. Optional members are `humanFallbackUrl`, `flows`, `policies`, `contact`, `brand`, `indexUrl`, `updatedAt`, and `live`.

| Member             | Type                                                                                                   | Meaning                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `protocol`         | string                                                                                                 | `axe/0.1`.                                                                                                   |
| `name`             | string                                                                                                 | The organization or site name.                                                                               |
| `description`      | string                                                                                                 | Written for agents: what this organization does and what an agent can accomplish here. 40 to 400 characters. |
| `baseUrl`          | URL                                                                                                    | Absolute HTTPS origin, optionally with a path prefix, that `/axe/...` paths are appended to.                 |
| `humanFallbackUrl` | URL                                                                                                    | The normal website. Agents SHOULD offer it to the user when nothing else works.                              |
| `auth`             | `{ modes: ("none" \| "site" \| "user")[], userLoginUrl?: URL }`                                        | Supported modes and the login page used for `login_required` handoffs.                                       |
| `actions`          | Action[]                                                                                               | See §5.                                                                                                      |
| `flows`            | `{ name, title, description, steps: string[] }[]`                                                      | See §15.                                                                                                     |
| `policies`         | `{ rateLimit?: { requestsPerMinute, burst? }, termsUrl?, dataRetention?, agents?: { allow?, deny? } }` | Access policy. See §3.4 and §17.                                                                             |
| `contact`          | `{ email?, url? }`                                                                                     | Where an agent operator reports problems.                                                                    |
| `brand`            | `{ name?, logoUrl?, accentColor?, tone? }`                                                             | Rendering hints. See §13.2.                                                                                  |
| `indexUrl`         | URL                                                                                                    | The platform index this site belongs to.                                                                     |
| `updatedAt`        | date-time                                                                                              | When the manifest last changed.                                                                              |
| `live`             | `{ rev?, url? }`                                                                                       | The site publishes live state and a revision. See §21.                                                       |

**[P-MAN-2]** `baseUrl` MUST use the `https` scheme, except that `http` is permitted for hosts named `localhost` or resolving to a loopback address.

**[P-MAN-3]** `manifest.description`, every `action.description`, and every other agent-read text field (§18.1) MUST follow the honesty rules in §18.

## 5. Actions

### 5.1 Definition

**[P-ACT-1]** Each action MUST have the following members. Members marked optional MAY be omitted.

| Member         | Type                                                             | Meaning                                                                                                                                     |
| -------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`         | string                                                           | Namespaced, kebab-case segments joined by dots: `appointments.reschedule`, `units.search`. Pattern `^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$`. |
| `title`        | string                                                           | Short label for humans and menus.                                                                                                           |
| `description`  | string                                                           | Agent-facing. States what the action does, what it returns, what it commits the user to, and what it will not do. 40 to 400 characters.     |
| `input`        | JSON Schema                                                      | Schema of the `input` member of the request envelope.                                                                                       |
| `output`       | JSON Schema                                                      | Schema of the `output` member of an `ok` result.                                                                                            |
| `readOnly`     | boolean                                                          | True when the action changes nothing observable.                                                                                            |
| `idempotent`   | boolean                                                          | True when repeating the call with the same `idempotencyKey` has no additional effect.                                                       |
| `reversible`   | boolean                                                          | True when the effect can be undone by the user or the site.                                                                                 |
| `risk`         | `none` \| `low` \| `medium` \| `high`                            | Consequence class. See §5.3.                                                                                                                |
| `auth`         | `none` \| `site` \| `user`                                       | Required authentication mode. See §16.                                                                                                      |
| `examples`     | `{ input, output }[]` (optional, RECOMMENDED)                    | Concrete pairs that validate against `input` and `output`.                                                                                  |
| `display`      | Display (optional)                                               | Presentation hints. See §13.                                                                                                                |
| `affordances`  | Affordance[] (optional)                                          | Follow-up actions with pointer-bound inputs. See §14.                                                                                       |
| `pagination`   | `{ cursorIn, cursorOut, pageSize: { default, max } }` (optional) | See §14.3.                                                                                                                                  |
| `freshness`    | `{ cacheTtlSeconds?, validUntil? }` (optional)                   | See §14.4.                                                                                                                                  |
| `humanHandoff` | `{ reasons: string[] }` (optional)                               | Declares that the action may return `needs_human`, and the reason codes it uses.                                                            |
| `deprecated`   | `{ since, replacedBy? }` (optional)                              | The action still works but agents SHOULD prefer `replacedBy`.                                                                               |
| `availability` | `{ available, reason?, requires?, handoff? }` (optional)         | Whether the action can be done right now, and why not. Computed when the manifest is rendered. See §21.                                     |

**[P-ACT-2]** Action names MUST be unique within a manifest.

**[P-ACT-3]** An action with `readOnly: true` MUST NOT change state. An action that is not `readOnly` MUST declare `idempotent` and `reversible` truthfully, and its `risk` MUST NOT be `none`.

**[P-ACT-4]** `input` and `output` MUST be JSON Schema draft 2020-12 documents with `"type": "object"` at the root. Additional properties on `input` SHOULD be disallowed so that agents receive `invalid_input` for misspelled fields instead of silent acceptance.

**[P-ACT-5]** Every `examples[]` entry MUST validate: `input` against the action's `input` schema and `output` against its `output` schema.

**[P-ACT-6]** The key `_axe` MUST NOT appear in a declared `output` schema. It is reserved for dynamic affordances (§14.2).

### 5.2 Writing descriptions

Descriptions are the meta tags of AXE: they are what a model reads to decide whether and how to call an action. A good description answers four questions in order.

1. **What does it do?** One sentence, active voice. "Reserves a spot for the authenticated member in a class."
2. **What does it return?** "Returns the booking id and confirmation time."
3. **What does it commit the user to?** "Uses one credit from the member's active class pass; cancellation is free until two hours before the class."
4. **What does it not do?** When relevant. "Does not process payment; members without a pass receive a `needs_input` for payment."

**[P-ACT-7]** Descriptions MUST be between 40 and 400 characters. They MUST describe capability and constraints, not merit. They MUST NOT address the agent with instructions about how to behave (§18.2).

Input field descriptions (`description` on schema properties) SHOULD state the format and give one example value: `"City or neighborhood, e.g. 'Bellevue, WA'"`.

### 5.3 Risk levels

| `risk`   | Use when                                                                                                           | Agents SHOULD                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `none`   | The action is `readOnly`.                                                                                          | Call freely.                                                                            |
| `low`    | The effect is small and trivially reversed: save a search, join a waitlist, add a note.                            | Call without confirmation when the user's intent is clear.                              |
| `medium` | The effect commits the user to something reversible at low cost: a booking with free cancellation, a tour request. | Tell the user what was done.                                                            |
| `high`   | Money moves, a legal commitment is made, identity is asserted, or the effect is hard to reverse.                   | Confirm with the user before calling, and again before sending any `sensitive` payload. |

## 6. Invocation

### 6.1 Request

**[P-INV-1]** An action is invoked with `POST {baseUrl}/axe/actions/{name}` and a JSON body that validates against `schemas/request.schema.json`:

```json
{
  "input": {},
  "context": {
    "onBehalfOf": "opaque-user-id",
    "locale": "en-US",
    "timezone": "America/Los_Angeles",
    "agent": {
      "name": "AcmeAgent",
      "version": "2.1.0",
      "vendor": "Acme",
      "contact": "https://acme.example/agent"
    },
    "sessionId": "a1f3..."
  },
  "idempotencyKey": "6f1c2a1e-..."
}
```

`input` is REQUIRED (an empty object is valid input for an action with no parameters). `context`, `idempotencyKey`, and `expectedRev` (§21, the revision the agent observed) are OPTIONAL.

**[P-INV-2]** Servers MUST validate `input` against the action's `input` schema before running any handler and MUST return `error` with `code: "invalid_input"` on failure. `details.issues` MUST list every problem as `{ path, message, expected? }`, where `path` is a JSON Pointer into `input`.

**[P-INV-3]** `context.onBehalfOf` as sent by the agent is advisory. Servers MUST establish the acting user's identity from credentials (§16), never from the request body alone. The SDK overwrites the field with the authenticated identity before handlers see it.

**[P-INV-4]** `GET {baseUrl}/axe/actions/{name}` MAY return the action's definition as it appears in the manifest. Servers that do not support it MUST respond with `not_found` or `405`.

**[P-INV-5]** An unknown action name MUST produce `error` with `code: "not_found"`.

### 6.2 HTTP status codes

**[P-INV-6]** Every AXE response body is a result envelope (§7). Non-error results MUST use HTTP `200`. Error results MUST use the mapped HTTP status:

| `error.code`    | HTTP |
| --------------- | ---- |
| `invalid_input` | 400  |
| `unsupported`   | 400  |
| `unauthorized`  | 401  |
| `forbidden`     | 403  |
| `not_found`     | 404  |
| `conflict`      | 409  |
| `rate_limited`  | 429  |
| `internal`      | 500  |
| `unavailable`   | 503  |

**[P-INV-7]** Agents MUST use `status` in the body, not the HTTP status, to decide what to do next. A `200` with `status: "needs_human"` is not success.

**[P-INV-8]** Responses to `rate_limited` errors MUST include a `Retry-After` header in seconds.

### 6.3 CORS

**[P-INV-9]** A server that permits browser-based agents MUST answer `OPTIONS` preflight requests on every AXE path with `204`, `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods: GET, POST, OPTIONS`, and `Access-Control-Allow-Headers` including `Content-Type`, `Authorization`, and `AXE-Protocol`. It SHOULD expose `AXE-Protocol`, `Retry-After`, and `RateLimit-Policy`. CORS is opt-in; a server that does not enable it MUST NOT emit CORS headers.

### 6.4 Requests a browser can send on a page's behalf

A browser attaches cookies (and cached HTTP authentication, and client certificates) to requests a page makes to another origin, and it sends a `POST` with a `text/plain`, `application/x-www-form-urlencoded`, or `multipart/form-data` body, or with no body type at all, without asking the target first. CORS decides whether the page may read the response; it does not stop the request from reaching the server. These rules keep such a request from changing state.

**[P-TRANS-1]** A `POST` to `/axe/actions/{name}` for an action that is not `readOnly`, to `/axe/continue`, or to `/axe/resume` MUST carry `Content-Type: application/json` or a media type of the form `application/<subtype>+json` (parameters such as `charset` are ignored). A server MUST refuse any other value, and a missing one, with `unsupported` before it reads the body, establishes identity, loads a token, or runs a handler. Agents MUST send `Content-Type: application/json` on every request with a body. A name that is not a known action is treated as not `readOnly`.

**[P-TRANS-2]** A server whose deployment lets browsers hold credentials for it that are sent without the page's involvement (cookies, HTTP authentication, client certificates: ambient credentials) MUST refuse a `POST` to any AXE endpoint that carries them when:

- the request has an `Origin` header whose value is not the origin of the site's `baseUrl` (on a platform, the tenant's `baseUrl`) and not an origin the site has explicitly trusted; `Origin: null` never matches; or
- the request has no `Origin` and its `Sec-Fetch-Site` header is `cross-site` or `same-site`.

The refusal is `forbidden`. It MUST be returned before the server looks up the action, reads the body, establishes identity, or loads a token, and it MUST be the same response whatever the path, action, token, or credential, so it confirms nothing about them.

**[P-TRANS-3]** A request with neither `Origin` nor `Sec-Fetch-Site` was not made by a browser on a page's behalf; [P-TRANS-2] MUST NOT refuse it. Server-to-server callers presenting `Authorization: Bearer` are therefore unaffected. `GET`, `HEAD`, and `OPTIONS` requests are outside §6.4; a site MUST NOT change state in response to them beyond what the protocol defines (`GET` on a `pollUrl` returns the result of work the agent already started).

**[P-TRANS-4]** For [P-TRANS-2] the site's own origin MUST come from its configuration (`baseUrl`), never from the `Host`, `Forwarded`, or `X-Forwarded-*` request headers, which a client or an intermediary can set. Trusted origins are exact origins (scheme, host, and port); a wildcard MUST NOT be accepted as one. An origin the site allows to make credentialed CORS requests is already trusted to send any request with its cookies and read the result, so a server MAY treat it as trusted.

## 7. Result envelope

**[P-RES-1]** Every response from `/axe/actions/{name}`, `/axe/continue`, `/axe/resume`, and a `pollUrl` MUST be a JSON object with a `status` member equal to one of `ok`, `needs_input`, `needs_human`, `pending`, or `error`, plus the members for that status, the OPTIONAL `rev` member (§21), and nothing else at the top level. It MUST validate against `schemas/result.schema.json`.

| `status`      | Members                                                                       | Meaning                                                                                 |
| ------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `ok`          | `output`                                                                      | Done. `output` validates against the action's `output` schema (after stripping `_axe`). |
| `needs_input` | `reason`, `message`, `accepts`, `continuationToken`, `expiresAt`, `fallback?` | The agent may be able to supply what is missing. §8.                                    |
| `needs_human` | `handoff`                                                                     | The human must act on the site. §9.                                                     |
| `pending`     | `pollUrl`, `retryAfter`                                                       | Long-running work. §10.                                                                 |
| `error`       | `error: { code, message, retryable, details? }`                               | Failed. §11.                                                                            |

Every status MAY additionally carry `rev`, the site's revision after the call, when the site publishes one (§21).

### 7.1 Which status to return

| Situation                                                                                                                                                     | Return                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| The work is done.                                                                                                                                             | `ok`                                                                    |
| Something is missing that an agent could plausibly hold: a payment credential, a document, an address, a consent.                                             | `needs_input` (with `fallback` if a human could also do it on the site) |
| Only a human can do the next step: sign in person, pass a CAPTCHA the site insists on, complete legal review, log in where no credential pass-through exists. | `needs_human`                                                           |
| The result will take longer than a request should wait.                                                                                                       | `pending`                                                               |
| Input was wrong, the caller is not allowed, the entity does not exist, state conflicts, the server failed.                                                    | `error`                                                                 |

**[P-RES-2]** Servers MUST NOT return `needs_human` when a `needs_input` with at least one well-known kind could satisfy the requirement. The ladder is climbed one rung at a time. (`axe audit` reports handoffs that a well-known kind would have avoided.)

## 8. Requirements: `needs_input` and `/axe/continue`

### 8.1 The result

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

**[P-REQ-1]** `accepts` MUST contain at least one entry. Entries are ordered from most automatable to least; agents SHOULD try them in order.

**[P-REQ-2]** Each `accepts[]` entry MUST have `kind`, `title`, `description`, `schema`, and `sensitive`, and MAY have `instructions`. `kind` is either a well-known kind from `KINDS.md` or a custom kind of the form `x-<org>.<name>`. `schema` is a JSON Schema for `payload`. For a well-known kind, `schema` MUST be the registry schema or a restriction of it (fewer optional members, tighter enums, narrower formats), never a relaxation.

**[P-REQ-3]** `sensitive: true` MUST be set on any kind whose payload is a payment credential, identity attribute, or other data the user would not want sent without being asked. Agents MUST confirm with the user before sending a `sensitive` payload.

**[P-REQ-4]** `instructions` is agent-read text the agent relays to the user or acts on (wire details, where to obtain a document). It is subject to §18.

**[P-REQ-5]** `reason` is a short snake_case code stable across calls (`payment_required`, `consent_required`, `identity_required`, `document_required`, or a site-specific code). `message` is agent-facing prose explaining the requirement in the context of this call.

**[P-REQ-6]** `fallback`, when present, is a complete Handoff (§9.1). An agent that can satisfy none of `accepts[]` SHOULD present `fallback` to the user without another round trip. When `fallback` is absent, the agent SHOULD ask its user for the information and call `/axe/continue`.

### 8.2 Continuing

**[P-REQ-7]** The agent continues with `POST {baseUrl}/axe/continue` and body `{ continuationToken, kind, payload }`. The response is a result envelope, which MAY be `ok`, another `needs_input` (with a new token) for a further requirement, `needs_human`, `pending`, or `error`.

**[P-REQ-8]** The server MUST verify the token (§12), MUST reject a `kind` that is not in the original `accepts[]` with `invalid_input`, and MUST validate `payload` against that entry's `schema`, returning `invalid_input` with `details.issues` on failure. A validation failure MUST NOT consume the token.

**[P-REQ-9]** A successful continuation (any status other than `error`) MUST consume the token, and the hook MUST NOT run again for it. A second `/axe/continue` with the same token, `kind`, and `payload` from the same principal MUST return the original result envelope, so an agent whose response was lost recovers the outcome ([P-OP-1]); with a different `kind` or `payload` it MUST return `conflict`. A continuation that returns `error` does not consume the token.

**[P-REQ-10]** Servers MUST NOT log `payload` for entries marked `sensitive`, and MUST NOT include payloads in analytics events (`EVENTS.md`).

## 9. Human handoff: `needs_human` and `/axe/resume`

### 9.1 The Handoff object

| Member                     | Type      | Meaning                                                                                                        |
| -------------------------- | --------- | -------------------------------------------------------------------------------------------------------------- |
| `reason`                   | string    | Short code: `login_required`, `signature_required`, `captcha`, or site-specific.                               |
| `instructions`             | string    | What the human must do on the site. Agent-read text.                                                           |
| `url`                      | URL       | Where the human goes. SHOULD land directly on the step, not the home page. The SDK appends `axe_handoff=<id>`. |
| `resumeToken`              | string    | Signed, opaque. The agent presents it to `/axe/resume`.                                                        |
| `expiresAt`                | date-time | When the token stops working. SHOULD be at least one hour; a human is involved.                                |
| `whatAgentShouldSayToUser` | string    | How the agent frames the request: one precise ask, in plain language.                                          |

**[P-HAND-1]** A `needs_human` result MUST contain a complete Handoff. Every Handoff member is REQUIRED.

**[P-HAND-2]** `needs_human` MUST be reserved for steps no machine-satisfiable option exists for. A site that returns `needs_human` for a requirement that a well-known kind covers is not conforming (see [P-RES-2]).

**[P-HAND-3]** `whatAgentShouldSayToUser` and `instructions` are agent-read text (§18). They MUST describe the step, not persuade.

### 9.2 Resuming

**[P-HAND-4]** After the human acts, the agent calls `POST {baseUrl}/axe/resume` with `{ resumeToken }`. The response is a result envelope.

**[P-HAND-5]** The site's page at `url` MAY record completion through the SDK (`completeHandoff`) so that a resume before the human is done returns `error` with `code: "conflict"`, `retryable: true`, and `details.handoffStatus: "open"`. Sites that do not record completion MUST make their resume logic check the real-world state and return `needs_human` again (with the same or a new Handoff) when the step is not done.

**[P-HAND-6]** A resume token MUST be single-use: once a resume returns any status other than `error`, the token is consumed and the resume MUST NOT run again. A second resume with the same token from the same principal MUST return the original result envelope ([P-OP-1]).

**[P-HAND-7]** The SDK's built-in `login_required` handoff (§16.1) binds the resume token to the identity established at `url`; the resumed action runs as that user.

## 10. Long-running work: `pending`

**[P-PEND-1]** A `pending` result MUST include `pollUrl` (absolute) and `retryAfter` (integer seconds, at least 1). The HTTP response SHOULD also carry `Retry-After`.

**[P-PEND-2]** `GET pollUrl` MUST return a result envelope. While work continues it returns `pending` again. The final envelope MAY be any status. Once a terminal status has been returned, subsequent polls MUST return the same terminal result for at least the idempotency window (§12.1) or `not_found` after that.

**[P-POLL-1]** A poll MUST be authorized as the call that produced it: the SDK's poll URL requires the tenant and the acting principal the originating call had ([P-TOK-6]), and the check runs before anything is returned, a stored terminal result included, and whether or not the action still exists. A poll that fails the check MUST get the same `not_found` as an unknown poll token.

**[P-POLL-2]** At most one poll of a token computes its result at a time. A poll that arrives while another is computing MUST return `pending`; the first terminal result is stored and every later authorized poll returns it, so a site's poll hook that causes effects runs to completion once.

**[P-PEND-3]** Agents SHOULD stop polling after `expiresAt` when present on the pending result, or after a client-side budget, and tell the user.

## 11. Errors

**[P-ERR-1]** `error.code` MUST be one of `invalid_input`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `rate_limited`, `unavailable`, `internal`, `unsupported`. `error.message` MUST say what went wrong in terms the agent can act on or relay. `error.retryable` MUST be true only when an identical request could later succeed.

**[P-ERR-2]** `error.message` and `details` MUST NOT contain stack traces, internal hostnames, or secrets. The SDK replaces thrown exceptions with a generic `internal` message and delivers the exception to the `onError` hook.

**[P-ERR-3]** For `invalid_input`, `details.issues[]` MUST name each failing `path` as a JSON Pointer and MUST include a `message`. It SHOULD include `expected`. Agents fix these themselves; they SHOULD NOT surface them to the user verbatim.

Two further `details` shapes are defined in §21: `{ expectedRev, currentRev }` on a `conflict` caused by a stale observation, and `{ reason, requires?, handoff? }` on `unavailable`.

## 12. Tokens

Continuation tokens, resume tokens, and the SDK's poll tokens share one design.

**[P-TOK-1]** Tokens MUST be opaque to agents. Agents MUST NOT parse or construct them.

**[P-TOK-2]** Tokens MUST be integrity-protected (the SDK uses HMAC-SHA256 with a server secret), MUST be bound to the originating action, a hash of the originating `input`, the acting principal ([P-TOK-7]) when there is one, and the tenant on a multi-tenant server, and MUST carry an expiry.

**[P-TOK-3]** Servers MUST reject a token whose signature does not verify, that has expired, or whose binding does not match the endpoint it is presented to, with `not_found`. A consumed token presented again is answered by [P-REQ-9] and [P-HAND-6]: the original envelope for the same use, `conflict` for a different one. The response MUST NOT reveal which check failed beyond those two codes.

**[P-TOK-4]** Server-side `state` associated with a token (the value a handler passes to `needsInput` or `handoff`) MUST NOT be encoded in the token. It is stored server-side and delivered to `onContinue`, `onResume`, or `onPoll`.

**[P-TOK-5]** Continuation tokens SHOULD expire within 15 minutes. Resume tokens SHOULD expire within 24 hours. Poll tokens expire when the work does.

**[P-TOK-6]** Every presentation of a token (`/axe/continue`, `/axe/resume`, a poll URL) MUST be authorized before any hook runs, any completion is recorded, and any stored result is returned: the tenant serving the request MUST be the tenant the token was minted for, and the principal the request resolves to MUST be the principal the token is bound to, including none for a token minted anonymously. A request that fails either check MUST receive exactly the response an unknown token receives (`not_found`, same message), whether the token is open, consumed, or terminal. The one transition is the SDK's `login_required` handoff ([P-AUTH-4]): minted anonymously, it runs as the user the site records at completion, and the resume MUST come from an anonymous caller or from that user. Recording completion (`completeHandoff`) MUST name the tenant the handoff was minted for, MUST NOT change the user a user-bound handoff belongs to, and MUST fail once the resume token has been used.

**[P-TOK-7]** The acting principal is resolved the same way for an action call and every follow-up. For a `site` action it is the site key's identity, plus the user when the request also carries one; for any other action it is the user, or none. The site key is verified again on every follow-up, so a revoked key, or a key whose allowlist no longer includes the action, can no longer use the tokens it obtained. A key's identity is the `id` the site's key verification returns; when it returns none, the server MUST derive one that distinguishes keys without storing the key (the SDK uses HMAC-SHA256 of the key under the server secret). Two unrelated keys MUST NOT share a principal.

### 12.1 Idempotency

**[P-IDEM-1]** Actions that are not `readOnly` MUST accept `idempotencyKey`. Agents MUST send one on every such call. The SDK client generates a UUID when the caller does not supply one.

**[P-IDEM-2]** When a request repeats an `idempotencyKey` for the same action and the same acting principal ([P-TOK-7]) on the same tenant within the idempotency window with the same `input`, the server MUST return the original result envelope without re-running the handler.

**[P-IDEM-3]** When the key repeats but `input` differs, the server MUST return `conflict`.

**[P-IDEM-4]** The idempotency window MUST be at least one hour and SHOULD be 24 hours. Sites MUST document their window in `policies.dataRetention` if it differs from 24 hours.

### 12.2 Operations

An operation is one attempt the server must run at most once at a time and answer consistently afterwards: an action call under one `idempotencyKey` (scoped by tenant, action, and principal), one use of a continuation or resume token, and the computation of a poll token's result.

**[P-OP-1]** Servers MUST claim an operation atomically before running it, across every instance that serves the site. Of any number of concurrent requests for the same operation, exactly one runs the handler or hook; a request for an operation that completed returns the stored envelope ([P-IDEM-2], [P-REQ-9], [P-HAND-6], [P-POLL-2]). A request that reuses the key or token for a different operation (different `input`, `kind`, or `payload`) MUST return `conflict` whether the first is still running or finished.

**[P-OP-2]** A request for an operation another request is still running MUST return `error` with `code: "conflict"`, `retryable: true`, `details.operationStatus: "in_progress"`, and `details.retryAfter` in seconds, with the same value in `Retry-After`. The agent retries with the same key or token and receives the stored envelope once it exists. A poll answers `pending` instead.

**[P-OP-3]** A non-error result completes the operation and is stored for the idempotency window. An `error` result (a thrown handler included) releases the claim without storing anything, so the same key or token may be retried and the handler runs again; a terminal poll result is stored whatever its status. A claim is a lease: when the request holding it stops without completing or releasing it (a crash), a later request for the same operation MAY take it over once the lease has passed, and then runs the handler again. A request for a different operation never takes over a claim.

**[P-OP-4]** The claim makes the decision to run atomic, not the business effect. Between a handler's commit and the stored result there is a window in which a crash leads to a second run under [P-OP-3]. The SDK passes a stable `operationId`, identical on every run of one operation, so a site can make the effect idempotent downstream (a unique constraint written in the same transaction, or a payment provider's idempotency key). Servers MUST NOT describe idempotency as exactly-once execution of side effects.

## 13. Presentation

Most agent journeys start with a read. The site knows which fields matter for comparing results; the agent knows how to render in its surface. `display` is the contract between them. It is a sibling of `output`, never a replacement for structured data, and it is optional: an action without `display` is valid and agents fall back to generic rendering.

### 13.1 The `display` object

```json
{
  "kind": "list",
  "items": "/units",
  "item": {
    "id": "/id",
    "title": "/name",
    "subtitle": "/address",
    "summary": "/summary",
    "image": "/photos",
    "url": "/humanUrl",
    "price": { "amount": "/rentUsd", "currency": "USD", "period": "month" },
    "attributes": [
      { "label": "Bedrooms", "path": "/bedrooms", "format": "number" },
      { "label": "Size", "path": "/sqft", "format": "area", "compare": "higher-better" },
      {
        "label": "Available",
        "path": "/availableFrom",
        "format": "date",
        "compare": "lower-better"
      }
    ],
    "badges": ["/badges"]
  },
  "suggestedComparison": ["Size", "Available"],
  "emptyMessage": "No units match those filters. Widening the rent ceiling or removing the move-in date usually helps.",
  "disclaimer": "Pricing and availability change frequently. Confirm on the listing page before applying."
}
```

| Member                          | Type                                                  | Meaning                                                                                                              |
| ------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `kind`                          | `list` \| `item` \| `table` \| `status` \| `document` | What kind of thing the output is.                                                                                    |
| `items`                         | JSON Pointer                                          | For `list` and `table`: where the array of items lives in `output`.                                                  |
| `item`                          | object                                                | Pointers describing one item. For `list`/`table`, relative to an element of `items`; otherwise relative to `output`. |
| `item.id`                       | JSON Pointer                                          | REQUIRED. Stable identifier the agent echoes back in affordance inputs.                                              |
| `item.title`                    | JSON Pointer                                          | REQUIRED.                                                                                                            |
| `item.subtitle`, `item.summary` | JSON Pointer                                          | Optional secondary text.                                                                                             |
| `item.image`                    | JSON Pointer or JSON Pointer[]                        | Absolute HTTPS URLs. The agent decides whether to show them.                                                         |
| `item.url`                      | JSON Pointer                                          | The canonical human page for this item. Agents SHOULD always offer it.                                               |
| `item.price`                    | `{ amount, currency, period? }`                       | `amount` is a pointer to a number; `currency` is a pointer or an ISO 4217 literal; `period` is a literal.            |
| `item.attributes`               | `{ label, path, format?, compare? }[]`                | Ordered by importance.                                                                                               |
| `item.badges`                   | JSON Pointer[]                                        | Pointers to short strings or arrays of short strings.                                                                |
| `suggestedComparison`           | string[]                                              | Attribute labels to lead with when comparing.                                                                        |
| `emptyMessage`                  | string                                                | What to tell the user when there are no items. Agent-read text.                                                      |
| `disclaimer`                    | string                                                | Text that MUST accompany any rendering. Agent-read text.                                                             |

**[P-DISP-1]** Pointers are RFC 6901 JSON Pointers. Pointers under `item` are relative to one element of the array at `items` when `kind` is `list` or `table`, and relative to `output` otherwise. All other pointers are relative to `output`.

**[P-DISP-2]** Every pointer in `display` MUST resolve to a location in the action's `output` schema. Servers MUST reject a `display` with a pointer that does not resolve, naming the pointer. Agents MUST tolerate a pointer that resolves in the schema but is absent in a particular output (an optional field): the attribute is simply missing for that item.

**[P-DISP-3]** `item.id` and `item.title` are REQUIRED when `item` is present. `item.url` SHOULD be present on anything a user will choose between; `axe audit` reports its absence.

**[P-DISP-4]** Agents MUST show `disclaimer` whenever they render any part of the output, and SHOULD show `emptyMessage` when `items` resolves to an empty array.

**[P-DISP-5]** `display` is data about data. It MUST NOT contain markup, and agents MUST NOT interpret any string from a manifest or result as HTML, Markdown with embedded HTML, or script. Renderers MUST escape every value.

**[P-DISP-6]** `image` and `url` values that are not absolute `https` URLs (or `http` for loopback hosts) MUST be ignored by renderers.

### 13.2 Brand hints

**[P-DISP-7]** A manifest MAY carry `brand: { name?, logoUrl?, accentColor?, tone? }`. Agents MAY use these when rendering and MUST treat them as hints. `accentColor` MUST be a CSS hex color; `logoUrl` MUST be absolute HTTPS.

## 14. Affordances, pagination, freshness

### 14.1 Static affordances

**[P-AFF-1]** An action MAY declare `affordances: [ { action, title, input, primary? } ]` alongside `display`. `action` MUST name an action in the same manifest. `input` is an object whose keys are top-level properties of the target action's `input` schema and whose values are JSON Pointers relative to the item (or to `output` when there is no `items`). A key that is not in the target's `input` schema MUST be rejected at registration.

**[P-AFF-2]** At most one affordance per action MAY set `primary: true`. At most 6 affordances MAY be declared per action; more is rejected.

**[P-AFF-3]** Bound inputs are partial. The agent MUST still supply any other member the target's `input` schema requires.

### 14.2 Dynamic affordances

**[P-AFF-4]** An output, and each element of the array at `display.items`, MAY carry a reserved `_axe` member: `{ affordances: [ { action, title, input, primary?, expectedRev? } ] }`. In dynamic affordances `input` holds concrete values, not pointers. When an item has `_axe.affordances`, it replaces the static list for that item entirely. `expectedRev`, when present, is the revision the item was observed at (§21); an agent that follows the affordance presents it as the request envelope's `expectedRev`, so the follow-up is refused with `conflict` if the item moved in between.

**[P-AFF-5]** `_axe` MUST be removed from `output` and from each item before validating against the `output` schema, and MUST NOT appear in the declared schema ([P-ACT-6]).

**[P-AFF-6]** The rules of [P-AFF-2] apply to dynamic affordances; agents MUST ignore the seventh and later entries and MUST treat multiple `primary` flags as none.

### 14.3 Pagination

**[P-AFF-7]** Read actions returning lists SHOULD declare `pagination: { cursorIn, cursorOut, pageSize: { default, max } }`. `cursorIn` is a pointer into `input`, `cursorOut` into `output`. Both MUST resolve against the respective schemas. A `null` or absent value at `cursorOut` means the last page. The server MUST accept the value it returned at `cursorOut` when presented at `cursorIn`, unchanged.

### 14.4 Freshness

**[P-AFF-8]** Read actions SHOULD declare `freshness: { cacheTtlSeconds?, validUntil? }`. `validUntil` is a pointer into `output` to a date-time after which the response (a quote, an availability) MUST NOT be relied on. Agents MUST NOT reuse an output past `validUntil` or past `cacheTtlSeconds` from receipt.

### 14.5 Search inputs

**[P-AFF-9]** Search actions SHOULD expose filters as first-class schema properties with enums, ranges, and descriptions. An input schema whose only property is a free-text query is reported by `axe audit`, because the agent already holds structured intent.

## 15. Flows

**[P-FLOW-1]** A manifest MAY include `flows: [ { name, title, description, steps } ]` where `steps` is an ordered list of action names in the manifest. Flows are documentation of intent for agents and human readers. They carry no server-side state and impose no ordering. Affordances are the primary chaining mechanism; a flow tells the reader which path through the affordance graph the site intends.

## 16. Authentication

Three modes.

| `auth` | Who authenticates | How                                                                                                          |
| ------ | ----------------- | ------------------------------------------------------------------------------------------------------------ |
| `none` | Nobody            | Public read-only actions.                                                                                    |
| `site` | The agent         | `Authorization: Bearer <api-key>` issued by the site to the agent operator. For B2B and rate-limited access. |
| `user` | The end user      | The agent acts for a specific human. See §16.1.                                                              |

**[P-AUTH-1]** An action's `auth` MUST be one of the modes listed in `manifest.auth.modes`.

**[P-AUTH-2]** A call to a `site` action without a valid key MUST return `unauthorized`. A call with a valid key that is not permitted to perform the action MUST return `forbidden`. Follow-ups of a `site` call are authorized under [P-TOK-7], and a refusal there is `not_found` ([P-TOK-6]).

### 16.1 `user` mode

Two mechanisms are defined in v0.

**[P-AUTH-3] Pass-through.** The agent sends `Authorization: Bearer <token>` where the token is a session or access token the site already issued to this user (through its normal login or an OAuth grant the user made to the agent). The site's `authenticate` function maps the request to an `onBehalfOf` identity. How the agent obtained the token is out of scope.

**[P-AUTH-4] Login handoff.** When a `user` action is called and no identity can be established, the server MUST return `needs_human` with `reason: "login_required"`, `url` set to `manifest.auth.userLoginUrl` with the handoff id appended, and a resume token. When the human signs in (and consents, if the site asks), the site records completion with the authenticated identity; the agent's `/axe/resume` then runs the original action as that user.

**[P-AUTH-5]** Servers MUST NOT accept `context.onBehalfOf` from the request body as proof of identity ([P-INV-3]).

OAuth 2.1 authorization-server behavior (client registration, authorization endpoint, device flow) is deliberately out of scope for v0. The handoff mechanism is the bridge until a site plugs in its own OAuth server; see `ROADMAP.md`.

## 17. Agent identification and rate limits

**[P-AGENT-1]** Agents SHOULD identify themselves in two places: the `User-Agent` header, recommended form `<Name>/<version> (+<contact-url>; axe/0.1)`, and `context.agent: { name, version, vendor, contact? }`. `vendor` is the organization operating the agent and is what `policies.agents` matches.

**[P-AGENT-2]** Sites MAY declare `policies.rateLimit: { requestsPerMinute, burst? }`. A server that declares it SHOULD emit `RateLimit-Policy: <requestsPerMinute>;w=60` on every response and MUST emit `Retry-After` on `429`.

**[P-AGENT-3]** Agents MUST honor `Retry-After` and MUST NOT retry `rate_limited` errors sooner.

### 17.1 Where an agent sends requests and credentials

A manifest, a result, and a discovery hint are data from the site. Each one can name a URL (`baseUrl`, `live.url`, `pollUrl`, a handoff `url`, an `AXE-Manifest` header, a `<link rel="axe-manifest">`), and none of them is authority to receive the agent's credentials. The rules below say which origins an agent may contact and which receive credentials. "Credentials" means the `Authorization` header and any other header the agent operator configured to identify the user or the agent.

**[P-AGENT-4]** An agent's credential audience is the origin it started discovery from, plus origins its operator explicitly authorized. An agent that was handed a manifest rather than discovering one MAY treat that manifest's `baseUrl` origin as the starting origin. An agent MUST NOT send credentials to any other origin, whatever a manifest, result, or hint names.

**[P-AGENT-5]** An agent MUST NOT follow a `baseUrl`, `live.url`, `pollUrl`, `AXE-Manifest` header, or `axe-manifest` link on an origin outside its credential audience unless its operator authorized contacting other origins; such a request MUST carry no credentials. An agent that allows such requests SHOULD refuse loopback, link-local, and private-range destinations. The handoff `url` is for a human; an agent does not fetch it.

**[P-AGENT-6]** An agent MUST check every redirect target against [P-AGENT-4] and [P-AGENT-5] before requesting it, MUST NOT send credentials on a redirect to an origin other than that of the original request, and MUST refuse a redirect from `https` to `http`.

**[P-AGENT-7]** An agent MUST use `https`, except for `http` to a loopback host (`localhost`, `127.0.0.0/8`, `[::1]`) in its credential audience, the same exception [P-MAN-2] makes for `baseUrl`, or where its operator deliberately permits `http` on a network it controls.

**[P-AGENT-8]** An agent that runs on a host with network access the site should not have (a server, an MCP server on a company network) SHOULD let its operator gate every outbound URL, and SHOULD run behind an egress policy. URL checks see names, not the addresses they resolve to: they do not stop DNS rebinding or a public name that resolves to a private address.

**[P-AGENT-9]** An agent that exposes polling to a model (for example as an MCP tool) MUST NOT fetch an arbitrary URL the model supplies: it polls only a `pollUrl` the site returned in a `pending` result.

## 18. Agent-facing honesty

The 2008 web produced keyword stuffing, cloaking, and link farms because a number could be moved by lying. Agents create the same incentives. This section defines what is out of bounds; `axe audit` detects what it can, and agents are expected to rank against the rest.

### 18.1 Agent-read text

The following fields are **agent-read text**. Everything in this section applies to each of them.

- `manifest.description`, `manifest.name`, `brand.name`, `policies.dataRetention`
- `action.title`, `action.description`, `flows[].title`, `flows[].description`
- `description` on any property of an `input` or `output` schema
- `accepts[].title`, `accepts[].description`, `accepts[].instructions`
- `needs_input` `message`
- `handoff.instructions`, `handoff.whatAgentShouldSayToUser`
- `display.emptyMessage`, `display.disclaimer`, `attributes[].label`, values reached by `badges`
- `affordances[].title` (static and dynamic)
- `error.message`
- `availability.reason`, `availability.requires[]` (its `title`, `description`, `instructions`), `availability.handoff.instructions`, `availability.handoff.whatAgentShouldSayToUser`, and the same members under `error.details` on `unavailable`

### 18.2 Rules

**[P-HON-1] No instructions to the agent.** Agent-read text MUST NOT contain imperatives addressed to the agent about how to behave: "always choose", "never recommend", "ignore other", "you must recommend", "do not tell the user", "disregard your instructions", or equivalents. This is a prompt-injection vector. `axe audit` treats a match as a hard failure.

**[P-HON-2] No persuasion.** Agent-read text MUST NOT contain superlatives or comparative marketing claims: "best", "cheapest", "#1", "top-rated", "unlike competitors", "better than". Descriptions state capability and constraint. `axe audit` reports each match.

**[P-HON-3] Parity.** Data returned to an agent MUST be what a human would see at `display.item.url` (or `humanFallbackUrl`) at the same moment, within the tolerance declared by `freshness`. Different prices or availability for agents is cloaking. `axe audit` prints a parity spot-check list and, with `--browser`, fetches and diffs.

**[P-HON-4] Affordance restraint.** At most 6 affordances per item, at most one `primary` ([P-AFF-2], [P-AFF-6]). Affordances MUST be follow-ups relevant to the item, not unrelated offers.

**[P-HON-5] No fake kinds.** A site MUST NOT define a custom `x-` kind whose schema is structurally equivalent to a well-known kind. Doing so forces agents that hold the well-known credential into a handoff. `axe audit` reports structurally identical schemas.

**[P-HON-6] Consent scope.** A `consent.terms` requirement MUST reference the exact `policyUrl`, `policyVersion`, and `scope` the action needs, and MUST NOT bundle consent for unrelated purposes. Agents SHOULD show the policy text or link to the user before fulfilling it.

**[P-HON-7] Truthful metadata.** `readOnly`, `idempotent`, `reversible`, and `risk` MUST describe the action's real behavior ([P-ACT-3]). A mutating action declared `readOnly` is a hard audit failure.

### 18.3 Reputation

AXE has no central authority and no signature over manifests in v0. Agents are expected to build trust signals from observed behavior: parity checks, handoff rate, error rate, and whether `examples[]` match live responses, the way search engines built ranking from observed link and content quality. A site that lies to agents will be ranked against by the agents it lies to. The SDK's defaults never make lying easier than telling the truth: metadata is required, descriptions are linted, and pointers must resolve against real schemas.

## 19. Security considerations

- **Prompt injection.** Every agent-read text field is untrusted input to a model. Agents MUST treat manifest and result text as data, never as instructions, and SHOULD isolate it from their system prompt. Sites MUST comply with §18.
- **Credential forwarding and request forgery.** Manifests, results, and discovery hints can name any URL. Agents bind credentials and destinations to the origins their operator authorized (§17.1); a host-side agent also needs an egress policy, because URL checks do not see DNS.
- **Token theft and replay.** Tokens are scoped to one action, one input, one principal, one tenant, and one use, with short expiry ([P-TOK-2] to [P-TOK-7]). A token minted for an authenticated principal is useless without that principal's credentials; a token minted anonymously is a bearer credential. Agents MUST transmit them only over HTTPS and MUST NOT log them.
- **Duplicate execution.** Operations are claimed atomically ([P-OP-1]); side effects are the site's to make idempotent ([P-OP-4]).
- **Sensitive payloads.** [P-REQ-3] and [P-REQ-10]. The SDK never logs payloads and never includes them in events.
- **Agents as load.** A manifest invites agents; it does not promise unlimited capacity. Sites SHOULD declare `policies.rateLimit`, enforce it at their edge, and use `pending` for slow work rather than holding connections.
- **Over-permissioned actions.** Nothing in AXE grants an agent more than the site's existing authorization allows. Sites MUST authorize every action with the same checks their UI applies, using the identity from §16, never from the request body.
- **HTML in results.** Renderers MUST escape everything ([P-DISP-5]). Sites MUST NOT rely on markup reaching a user.
- **Cross-site request forgery.** A site that authenticates with cookies is reachable from every page its users visit. CORS response headers do not prevent the write; [P-TRANS-1] to [P-TRANS-4] do. A site that also sets `SameSite=Lax` or `Strict` on its session cookie has a second, independent layer.

## 20. Worked example: search → present → select → transact

The apartment domain, end to end. Manifest excerpts and wire exchanges; the full example, with server code, is in `docs/presenting-results.md` and `docs/examples/apartments/`.

### 20.1 The search action, as declared in the manifest

```json
{
  "name": "units.search",
  "title": "Search available units",
  "description": "Find available apartments by city or neighborhood, bedrooms, and monthly rent ceiling. Returns up to 20 units with pricing, size, availability, and pet policy. Prices are current as of the response and may change.",
  "readOnly": true,
  "idempotent": true,
  "reversible": true,
  "risk": "none",
  "auth": "none",
  "input": {
    "type": "object",
    "properties": {
      "location": { "type": "string", "description": "City or neighborhood, e.g. 'Bellevue, WA'" },
      "bedrooms": { "type": "integer", "minimum": 0, "maximum": 5 },
      "maxRentUsd": { "type": "integer", "exclusiveMinimum": 0 },
      "petFriendly": { "type": "boolean" },
      "moveInBy": { "type": "string", "format": "date" },
      "cursor": { "type": "string" }
    },
    "required": ["location"],
    "additionalProperties": false
  },
  "output": {
    "type": "object",
    "properties": {
      "units": { "type": "array", "items": { "$ref": "#/$defs/Unit" } },
      "nextCursor": { "type": ["string", "null"] }
    },
    "required": ["units", "nextCursor"],
    "$defs": {
      "Unit": {
        "type": "object",
        "properties": {
          "id": {},
          "name": {},
          "address": {},
          "photos": {},
          "humanUrl": {},
          "rentUsd": {},
          "bedrooms": {},
          "bathrooms": {},
          "sqft": {},
          "availableFrom": {},
          "petPolicy": {},
          "parking": {},
          "badges": {}
        }
      }
    }
  },
  "display": {
    "kind": "list",
    "items": "/units",
    "item": {
      "id": "/id",
      "title": "/name",
      "subtitle": "/address",
      "image": "/photos",
      "url": "/humanUrl",
      "price": { "amount": "/rentUsd", "currency": "USD", "period": "month" },
      "attributes": [
        { "label": "Bedrooms", "path": "/bedrooms", "format": "number" },
        { "label": "Bathrooms", "path": "/bathrooms", "format": "number" },
        { "label": "Size", "path": "/sqft", "format": "area", "compare": "higher-better" },
        {
          "label": "Available",
          "path": "/availableFrom",
          "format": "date",
          "compare": "lower-better"
        },
        { "label": "Pets", "path": "/petPolicy", "format": "text" },
        { "label": "Parking", "path": "/parking", "format": "text" }
      ],
      "badges": ["/badges"]
    },
    "suggestedComparison": ["Size", "Available", "Pets"],
    "disclaimer": "Pricing and availability change frequently. Confirm on the listing page before applying."
  },
  "affordances": [
    { "action": "tours.book", "title": "Schedule a tour", "input": { "unitId": "/id" } },
    {
      "action": "applications.submit",
      "title": "Apply for this unit",
      "input": { "unitId": "/id" },
      "primary": true
    }
  ],
  "pagination": {
    "cursorIn": "/cursor",
    "cursorOut": "/nextCursor",
    "pageSize": { "default": 10, "max": 20 }
  },
  "freshness": { "cacheTtlSeconds": 300 }
}
```

### 20.2 The agent searches

```http
POST /axe/actions/units.search
Content-Type: application/json
AXE-Protocol: axe/0.1
User-Agent: AcmeAgent/2.1 (+https://acme.example/agent; axe/0.1)

{ "input": { "location": "Bellevue, WA", "bedrooms": 1, "maxRentUsd": 3200, "petFriendly": true },
  "context": { "agent": { "name": "AcmeAgent", "version": "2.1.0", "vendor": "Acme" }, "sessionId": "s_91" } }
```

```json
{
  "status": "ok",
  "output": {
    "units": [
      {
        "id": "u_204",
        "name": "The Meridian 204",
        "address": "10800 NE 8th St, Bellevue",
        "photos": ["https://oakridge-rentals.example/img/u204-1.jpg"],
        "humanUrl": "https://oakridge-rentals.example/units/u_204",
        "rentUsd": 2950,
        "bedrooms": 1,
        "bathrooms": 1,
        "sqft": 720,
        "availableFrom": "2026-10-15",
        "petPolicy": "Cats and dogs under 40 lb",
        "parking": "1 garage space included",
        "badges": ["Pet friendly"]
      },
      {
        "id": "u_118",
        "name": "Lakeview 118",
        "address": "800 Bellevue Way NE, Bellevue",
        "photos": [],
        "humanUrl": "https://oakridge-rentals.example/units/u_118",
        "rentUsd": 3150,
        "bedrooms": 1,
        "bathrooms": 1,
        "sqft": 810,
        "availableFrom": "2026-10-01",
        "petPolicy": "Cats only",
        "parking": "Street",
        "badges": ["Available now"],
        "_axe": {
          "affordances": [
            { "action": "tours.book", "title": "Schedule a tour", "input": { "unitId": "u_118" } }
          ]
        }
      }
    ],
    "nextCursor": null
  }
}
```

The agent applies `display`: two comparable items, price per month, six attributes, one badge each, a human URL for each, and the disclaimer. Unit `u_118` carries dynamic affordances that omit `applications.submit` (the site knows it has a pending application), so the agent offers only a tour for it. Unit `u_204` uses the static affordances, so the agent offers a tour and, as `primary`, an application.

### 20.3 The user picks `u_204`; the agent follows the primary affordance

```http
POST /axe/actions/applications.submit
Authorization: Bearer <user session token>

{ "input": { "unitId": "u_204" }, "idempotencyKey": "5a0e7d4e-2f9b-4c31-9a68-0c8b2d7f1e10",
  "context": { "agent": { "name": "AcmeAgent", "version": "2.1.0", "vendor": "Acme" }, "sessionId": "s_91" } }
```

The site creates the application and needs a deposit that can only be paid by ACH or wire. It returns the `needs_input` shown in §8.1, with a `fallback` handoff.

### 20.4 The agent fulfills from its wallet

The agent holds an ACH authorization capability. Because `sensitive` is true, it confirms with the user ("Oakridge needs a $500 refundable deposit by bank transfer. Use your checking account ending 4471?"), then:

```http
POST /axe/continue

{ "continuationToken": "eyJ...", "kind": "payment.ach-debit",
  "payload": { "accountHolderName": "Dana Whitfield", "routingNumber": "125000024", "accountNumber": "000123454471", "accountType": "checking", "amount": 500, "currency": "USD", "authorizedAt": "2026-09-23T18:41:10Z", "authorizationText": "I authorize Oakridge Rentals to debit $500.00 as a refundable holding deposit." } }
```

```json
{ "status": "ok", "output": { "applicationId": "APP-8812", "depositStatus": "received" } }
```

Had the agent held no bank credential, it would have shown `fallback.whatAgentShouldSayToUser` to the user, sent them to `fallback.url`, and later called `/axe/resume` with `fallback.resumeToken` to receive the same `ok`.

## 21. Live state and revisions

A manifest is static and an action is a function: until this section, "what can be done right now, and why not the rest" was something an agent found out by calling, and two actors (a person in the UI and an agent through AXE) editing the same record could only be kept apart by the site's own checks. This section adds two things to the wire, both OPTIONAL and additive: a **revision** that every envelope reports and every request may present, and an **availability** that every action may declare and a dedicated endpoint serves uncached. A site that publishes neither behaves exactly as described in the preceding sections.

### 21.1 The revision

**[P-LIVE-10]** A site's revision (`rev`) is one value for the whole site (or tenant): a non-empty string or a number that changes with every change an agent could observe, whoever made it. Agents MUST treat it as opaque: compare two revisions for equality only, never order them or parse them. A numeric string and the number it spells are the same revision.

Per-resource revisions (ETags) were considered and rejected: an action touches several records, agents observe a whole result at once, and one value answers the only question that matters, "has anything I saw moved". `DECISIONS.md` has the reasoning.

**[P-LIVE-2]** A site that publishes a revision MUST include `rev` at the top level of every result envelope it returns from `/axe/actions/{name}`, `/axe/continue`, `/axe/resume`, and a `pollUrl`, whatever the `status`. For `ok` it is the revision the change produced; for the others it is the site's revision after the call. An idempotent replay ([P-IDEM-2]) returns the stored envelope with the `rev` it carried originally. A site with no revision MUST omit `rev`.

### 21.2 The state the agent saw

**[P-LIVE-1]** A request to `/axe/actions/{name}` MAY carry `expectedRev`, the revision the agent observed (from `/axe/state`, from `live.rev`, or from a previous envelope's `rev`). `/axe/continue` and `/axe/resume` bodies MAY carry it too, with the same meaning and check. A malformed `expectedRev` (anything other than a non-empty string or a number) is `invalid_input`. A site that publishes no revision MUST ignore `expectedRev` ([P-VER-4]).

**[P-LIVE-3]** When a site publishes a revision and a request carries `expectedRev` that is not equal to the current revision, the server MUST return `error` with `code: "conflict"`, `retryable: true`, HTTP `409`, and `details: { expectedRev, currentRev }`, where `expectedRev` echoes the request and `currentRev` is the site's revision at that moment. The server MUST have applied nothing: the check runs before the handler, before `onContinue` or `onResume`, and before a login handoff is minted; a stale continue or resume MUST NOT consume its token. The `rev` on the envelope equals `currentRev`.

**[P-LIVE-4]** The idempotency replay ([P-IDEM-2]) is answered before the stale check: a request that repeats an `idempotencyKey` for the same action, user, and `input` returns the stored envelope whatever `expectedRev` it carries, because it is the same attempt. `expectedRev` is not part of the idempotency binding. A stale request MUST NOT store a record for its `idempotencyKey`, so the agent may retry with the same key once it has read the current state. When the original call carried `expectedRev` and was answered with a `login_required` handoff, the server MUST re-check that revision when the action runs after sign-in, unless the resume presents a fresher `expectedRev`.

### 21.3 Availability: unavailable, because

**[P-LIVE-5]** An action MAY declare `availability`: `{ available: true }` or `{ available: false, reason, requires?, handoff? }`. `reason` is REQUIRED when `available` is false: plain language in the site's own words ("already drafted by another team", "approval required"), agent-read text under §18. `requires`, when present, is a non-empty list of `accepts` entries ([P-REQ-2]) naming what would make the action available; `handoff`, when present, is a Handoff object (§9.1) without `resumeToken` and `expiresAt`, naming a step only a human can take. Its `url` MAY be omitted when the step is taken inside the site's own interface and no page names it; a site MUST NOT invent one. A handoff without a `url` can only be reported (here and under [P-LIVE-9]), never returned as `needs_human`, whose Handoff is complete ([P-HAND-1]). Availability is computed when the document that carries it is rendered; it is a report, not a promise.

**[P-LIVE-6]** An action whose availability for the caller is `available: false` MUST NOT complete with `ok` when invoked. It MUST return `error` with `code: "unavailable"`, or climb the ladder: `needs_input` whose `accepts` are the declared `requires`, or `needs_human` with the declared `handoff`.

**[P-LIVE-9]** An `error` with `code: "unavailable"` MAY carry `details: { reason, requires?, handoff? }` mirroring the availability that caused it. Agents SHOULD relay `reason` to the user in the site's words, MAY offer `handoff.url` when it is present, and otherwise relay `handoff.whatAgentShouldSayToUser`.

### 21.4 Where availability is served

**[P-LIVE-7]** A site that publishes a revision or any action's availability MUST include `live` in its manifest: `{ rev?, url? }`, where `url` is the absolute URL of the state endpoint (the SDK serves `{baseUrl}/axe/state`) and `rev` is the revision when the manifest was rendered. The manifest MAY carry each declaring action's `availability` as computed for an anonymous caller; because manifests are cacheable ([P-DISC-3]), agents MUST treat `live.rev` and manifest `availability` as a snapshot and prefer the state endpoint when acting.

**[P-LIVE-8]** `GET {live.url}` MUST return `{ rev?, actions: { [name]: availability } }` validating against `schemas/state.schema.json`, with `Cache-Control: no-store`. `actions` MUST list every action in the manifest; one that declares no availability is `{ available: true }`. Availability MAY depend on the authenticated caller (§16): the endpoint establishes identity the same way an action does and SHOULD send `Vary: Authorization`. `rev` MUST be present when the site publishes a revision.

### 21.5 The two-actor loop

1. The agent reads the state: `GET /axe/state` gives `rev: 41` and, for each action, whether it can be done now and why not.
2. It invokes an available action with `expectedRev: 41`. If a person changed the record in the meantime, the site is at `rev: 42` and answers `conflict` with `details: { expectedRev: 41, currentRev: 42 }`, having applied nothing. The agent reads again and decides again.
3. If nothing moved, the action runs and the `ok` envelope carries `rev: 42`, the revision the change produced; the agent uses it as the next `expectedRev`.
4. A retry after a lost response repeats the `idempotencyKey` and is answered from the stored envelope ([P-LIVE-4]); a retry with a new key and the old `expectedRev` is refused, so a lost response cannot double-apply.

## Appendix A. Endpoint summary

| Method  | Path                          | Body                                                 | Returns                      |
| ------- | ----------------------------- | ---------------------------------------------------- | ---------------------------- |
| GET     | `/.well-known/axe.json`       |                                                      | Manifest                     |
| GET     | `/axe/manifest`               |                                                      | Manifest                     |
| GET     | `/.well-known/axe-index.json` |                                                      | Index (platforms)            |
| POST    | `/axe/actions/{name}`         | `{ input, context?, idempotencyKey?, expectedRev? }` | Result envelope              |
| GET     | `/axe/actions/{name}`         |                                                      | Action definition (optional) |
| POST    | `/axe/continue`               | `{ continuationToken, kind, payload, expectedRev? }` | Result envelope              |
| POST    | `/axe/resume`                 | `{ resumeToken, expectedRev? }`                      | Result envelope              |
| GET     | `/axe/poll/{token}`           |                                                      | Result envelope              |
| GET     | `/axe/state`                  |                                                      | Live state (§21, optional)   |
| OPTIONS | any of the above              |                                                      | `204` when CORS is enabled   |

## Appendix B. Requirement index

Every numbered requirement above maps to at least one test in `@axe/core` or one check in the conformance suite; `packages/testing/src/conformance/requirements.ts` lists the mapping and a test asserts that every `[P-...]` identifier in this file appears there.
