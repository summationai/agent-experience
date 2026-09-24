# AXE Events

**Version:** event `schemaVersion` `1`, shipped with `axe/0.1`. Normative for servers built with the SDK; recommended for other implementations. The JSON Schema is [`schemas/event.schema.json`](./schemas/event.schema.json).

Every request that reaches an action, a continuation, a resume, or a poll produces exactly one event. Events are the Webmaster Tools half of AXE: they answer which agents call you, which actions they use, where the ladder falls to a human, and how long you take. They contain **no personally identifiable information and no payloads**, by construction: the type has no field that could carry them.

## Shape

```json
{
  "schemaVersion": 1,
  "ts": "2026-09-23T18:41:12.204Z",
  "action": "applications.submit",
  "status": "needs_input",
  "ladder": "needs_input",
  "agent": { "vendor": "Acme", "name": "AcmeAgent", "version": "2.1.0" },
  "latencyMs": 184,
  "kind": "payment.ach-debit",
  "errorCode": null,
  "tenant": "oakridge"
}
```

| Member          | Type                                                                                       | Required | Meaning                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------- |
| `schemaVersion` | integer                                                                                    | yes      | `1`.                                                                                                       |
| `ts`            | date-time                                                                                  | yes      | When the response was produced.                                                                            |
| `action`        | string                                                                                     | yes      | The action name. For a continue, resume, or poll it is the _originating_ action, recovered from the token. |
| `status`        | `ok` \| `needs_input` \| `needs_human` \| `pending` \| `error`                             | yes      | The `status` of the result envelope returned.                                                              |
| `ladder`        | `ok` \| `needs_input` \| `continued` \| `needs_human` \| `resumed` \| `pending` \| `error` | yes      | Which rung produced this event. See below.                                                                 |
| `agent`         | `{ vendor?, name?, version? }` or `null`                                                   | yes      | From `context.agent`, else parsed from `User-Agent` when it follows the recommended form, else `null`.     |
| `latencyMs`     | integer ≥ 0                                                                                | yes      | Server-side wall time from request receipt to response.                                                    |
| `kind`          | string or `null`                                                                           | yes      | On `continued`: the kind submitted. On `needs_input`: the first accepted kind. Otherwise `null`.           |
| `errorCode`     | error code or `null`                                                                       | yes      | `error.code` when `status` is `error`.                                                                     |
| `tenant`        | string or `null`                                                                           | yes      | Tenant id on platforms, else `null`.                                                                       |

## Ladder semantics

`ladder` records _which endpoint and outcome_ produced the event, so that funnels can be computed without joining requests.

| Endpoint              | Result `status` | `ladder`                                                              |
| --------------------- | --------------- | --------------------------------------------------------------------- |
| `/axe/actions/{name}` | `ok`            | `ok`                                                                  |
| `/axe/actions/{name}` | `needs_input`   | `needs_input`                                                         |
| `/axe/actions/{name}` | `needs_human`   | `needs_human`                                                         |
| `/axe/actions/{name}` | `pending`       | `pending`                                                             |
| `/axe/actions/{name}` | `error`         | `error`                                                               |
| `/axe/continue`       | any             | `continued`                                                           |
| `/axe/resume`         | any             | `resumed`                                                             |
| `/axe/poll/{token}`   | any             | `pending` while pending; the terminal status's ladder value otherwise |

For `continued` and `resumed` events, `status` carries the outcome, so "continues that succeeded" is `ladder = 'continued' AND status = 'ok'`.

## Rules

**[E-1]** Servers MUST emit exactly one event per handled request to an action, continue, resume, or poll endpoint. Manifest and index fetches do not produce events.

**[E-2]** Events MUST NOT contain `input`, `output`, `payload`, `state`, tokens, `onBehalfOf`, `sessionId`, IP addresses, or any header value other than the parsed `agent` fields.

**[E-3]** Events MUST be emitted after the response is determined and MUST NOT delay the response; sinks are invoked asynchronously and a failing sink MUST NOT affect the result.

**[E-4]** Servers MUST include `schemaVersion` so consumers can migrate.

## Sinks

`@axe/core/events` ships three sinks that accept `AXEEvent` objects: `consoleSink()` (one JSON line per event on stdout), `jsonlFileSink(path)` (append-only JSON lines), and `otelSink({ meter, tracer? })` (an `axe.requests` counter with `action`, `status`, `ladder`, `vendor`, and `tenant` attributes, an `axe.latency` histogram in milliseconds, and an optional span per event). Any function `(event: AXEEvent) => void | Promise<void>` is a sink.

`docs/analytics.md` holds the day-one queries against this shape.
