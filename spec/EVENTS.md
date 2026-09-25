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

## Action events

A request event says that an action was called and how it went. It cannot say what the action did, or for whom, because [E-2] forbids exactly that. Some actions have to: an action that changes an application's state on a person's behalf owes that person a record, with attribution. Action events are that record. A handler emits one with `emit` on its context; the server stamps it and delivers it to the `onActionEvent` sinks, a channel separate from the analytics `onEvent` sinks, so the two never mix. The JSON Schema is [`schemas/action-event.schema.json`](./schemas/action-event.schema.json).

```json
{
  "schemaVersion": 1,
  "ts": "2026-09-23T18:41:12.204Z",
  "action": "board.pick-me-gibbs",
  "event": "surface.act",
  "status": "ok",
  "errorCode": null,
  "actor": "dana",
  "details": {
    "seq": 12,
    "op": "CLICK",
    "target": "pick:me:Gibbs",
    "revBefore": 7,
    "revAfter": 8,
    "changed": ["pick:me:Gibbs"]
  },
  "tenant": null
}
```

| Member          | Type                                                           | Required | Meaning                                                                                              |
| --------------- | -------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `schemaVersion` | integer                                                        | yes      | `1`.                                                                                                 |
| `ts`            | date-time                                                      | yes      | When the event was emitted.                                                                          |
| `action`        | string                                                         | yes      | The action whose handler emitted it; for a continue or resume, the originating action.               |
| `event`         | string                                                         | yes      | What happened, as a dotted name in the action's namespace: `surface.act`.                            |
| `status`        | `ok` \| `needs_input` \| `needs_human` \| `pending` \| `error` | yes      | Outcome of the work the event records. Defaults to `ok`.                                             |
| `errorCode`     | error code or `null`                                           | yes      | The code when `status` is `error`.                                                                   |
| `actor`         | string or `null`                                               | yes      | Who the work was done as, in the application's terms. `null` when the action has no actor.           |
| `details`       | object                                                         | yes      | What the action chooses to record: identifiers, revisions, sequence numbers. Empty object when none. |
| `tenant`        | string or `null`                                               | yes      | Tenant id on platforms, else `null`.                                                                 |

**[E-5]** A handler, continuation, resume, or poll MAY emit any number of action events through `emit`. The server MUST stamp each with `schemaVersion`, `ts`, `action`, and `tenant`, and deliver it to the `onActionEvent` sinks only. Action events are not request events: they do not count toward [E-1] and MUST NOT be delivered to `onEvent` sinks.

**[E-6]** An action event MAY name the `actor`. It MUST NOT contain `input`, `output`, `payload`, `state`, tokens, `sessionId`, IP addresses, or header values; `details` is for identifiers, revisions, and sequence numbers that let a reader find the record in the application, not for the record itself.

**[E-7]** Emitting MUST NOT delay the response; sinks are invoked asynchronously and a failing sink MUST NOT affect the result.

`spec/SURFACE.md` [S-AXE-4] is the first use: the Surface bridge emits one `surface.act` event per act, run or refused, with the actor and the ledger `seq`.

### Approval events

The server itself emits the lifecycle of an approval request (`AXE-PROTOCOL.md` §9.3) as action events, so a site's history can show who asked, who decided, and what ran, beside the site's own records. `action` is the action the request would run; `details.handoffId` is the request's id (the one on the approval page).

| `event`                | `status`      | `actor`                                | Emitted when                                                                                   | Other `details`             |
| ---------------------- | ------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------- |
| `approval.requested`   | `needs_human` | the user the agent acts for, or `null` | a handler returned an approval request and its token was minted                                |                             |
| `approval.approved`    | `ok`          | the approver the site named            | the site recorded an approval                                                                  |                             |
| `approval.cancelled`   | `ok`          | who cancelled, as the site named them  | the site recorded a cancellation                                                               |                             |
| `approval.invalidated` | `error`       | `null`                                 | the bound state was found changed, at approval (`at: "approve"`) or at resume (`at: "resume"`) | `at`                        |
| `approval.executed`    | the result's  | the user the agent acts for, or `null` | a resume ran the approved operation; `status` and `errorCode` are the operation's result       | `approvedBy`, `operationId` |

**[E-8]** The approval events carry the request id, the actors, and the fields listed above. Under [E-6] they MUST NOT carry the recorded input, the bound state, the preview, or a cancellation reason. They are emitted once per transition; a replayed resume ([P-APPR-7]) emits nothing.

## Sinks

`@axe/core` ships three sinks that accept `AXEEvent` objects: `consoleSink()` (one JSON line per event on stdout) and `otelSink({ meter, tracer? })` in `@axe/core/events`, and `jsonlFileSink(path)` (append-only JSON lines, Node only) in `@axe/core/node`. `otelSink` records an `axe.requests` counter with `action`, `status`, `ladder`, `vendor`, and `tenant` attributes, an `axe.latency` histogram in milliseconds, and an optional span per event. Any function `(event: AXEEvent) => void | Promise<void>` is a sink. `consoleSink()` and `jsonlFileSink(path)` also accept action events, so they can be passed to `onActionEvent`; `otelSink` is for request events only.

`docs/analytics.md` holds the day-one queries against this shape.
