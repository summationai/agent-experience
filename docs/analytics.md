# Analytics

Every request that reaches an action, a continuation, a resume, or a poll produces one event. Events are the Webmaster Tools half of AXE: they tell you which agents call you, which actions they use, where the [escalation ladder](concepts.md#the-escalation-ladder) falls to a human, and how long you take. This page covers the event shape, the sinks that receive it, and the queries worth running on the first day.

The normative text is [`spec/EVENTS.md`](../spec/EVENTS.md). Nothing here adds to it.

## The event schema

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

| Member          | Type                                                                           | Meaning                                                                                                        |
| --------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `schemaVersion` | integer                                                                        | `1`. Present on every event so a consumer can migrate when the shape changes.                                  |
| `ts`            | date-time                                                                      | When the response was produced.                                                                                |
| `action`        | string                                                                         | The action name. For a continue, resume, or poll it is the originating action, recovered from the token.       |
| `status`        | `ok`, `needs_input`, `needs_human`, `pending`, `error`                         | The `status` of the result envelope that was returned.                                                         |
| `ladder`        | `ok`, `needs_input`, `continued`, `needs_human`, `resumed`, `pending`, `error` | Which rung produced the event. See the table below.                                                            |
| `agent`         | `{ vendor?, name?, version? }` or `null`                                       | From `context.agent`, else parsed from `User-Agent` when it follows the recommended form, else `null`.         |
| `latencyMs`     | integer ≥ 0                                                                    | Server-side wall time from request receipt to response.                                                        |
| `kind`          | string or `null`                                                               | On `continued`: the kind the agent submitted. On `needs_input`: the first kind in `accepts`. Otherwise `null`. |
| `errorCode`     | error code or `null`                                                           | `error.code` when `status` is `error`.                                                                         |
| `tenant`        | string or `null`                                                               | The tenant id on [platforms](platforms.md), else `null`.                                                       |

`status` says what the agent received. `ladder` says which endpoint produced it, so you can compute funnels without joining requests together:

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

For `continued` and `resumed` events, `status` carries the outcome. "Continuations that succeeded" is `ladder = 'continued' AND status = 'ok'`. A `needs_human` that came out of a continuation (the agent supplied a payload and the site still needed the human) shows as `ladder = 'continued' AND status = 'needs_human'`.

Events contain no personally identifiable information and no payloads, by construction: the TypeScript type has no field that could carry them. There is no `input`, no `output`, no `payload`, no token, no `onBehalfOf`, no IP address. A sink cannot leak what it never receives. Manifest and index fetches do not produce events, and an idempotent replay produces one just as the original did.

## Sinks

A sink is any function of an event: `(event: AXEEvent) => void | Promise<void>`. Pass one sink or an array to `onEvent`. Three ship in `@axe/core/events`:

- `consoleSink` writes one JSON line per event to stdout. Pass your own writer to send the line elsewhere.
- `jsonlFileSink` takes a path and appends JSON lines to it, opening the file lazily and serializing writes so lines never interleave. Node only.
- `otelSink` takes a meter and an optional tracer, and records a counter and a histogram, plus one span per event when the tracer is present. The parameter types are structural subsets of OpenTelemetry's meter and tracer, so `@axe/core` has no OpenTelemetry dependency and you pass the real objects from `@opentelemetry/api`.

The fourth export, combineSinks, fans events out to several sinks and isolates failures; it takes an error callback so a broken sink reports instead of disappearing. The array form of `onEvent` uses it internally with a callback that logs to stderr.

<!-- include: examples/analytics/sinks.ts#wiring -->
```ts
export const axe = createAXE({
  name: "Northgate University Admissions",
  description:
    "Check application status, upload transcripts and recommendation letters, and schedule campus visits for prospective students.",
  baseUrl: process.env.AXE_BASE_URL ?? "https://admissions.northgate.example",
  auth: { modes: ["none", "user"], userLoginUrl: "https://admissions.northgate.example/login" },
  secret: process.env.AXE_SECRET,
  onEvent: combineSinks(
    [
      consoleSink(),
      jsonlFileSink(process.env.AXE_EVENTS_PATH ?? "./axe-events.jsonl"),
      // The real @opentelemetry/api objects satisfy MeterLike and TracerLike structurally.
      otelSink({ meter: metrics.getMeter("axe"), tracer: trace.getTracer("axe") }),
      handoffCounter,
    ],
    (error) => console.error("axe event sink failed", error),
  ),
});
```
<!-- /include -->

Writing your own sink is the same as writing the counter above:

<!-- include: examples/analytics/sinks.ts#custom -->
```ts
// Any function of an event is a sink. This one keeps a running count of handoffs per action.
const handoffsByAction = new Map<string, number>();

function handoffCounter(event: AXEEvent): void {
  if (event.status !== "needs_human") return;
  handoffsByAction.set(event.action, (handoffsByAction.get(event.action) ?? 0) + 1);
}
```
<!-- /include -->

Sinks run after the response is determined, on a microtask, and they never delay or fail the response. A sink that throws or rejects is reported through the error callback and the agent sees the result it was going to see anyway. This is rule [E-3] of the spec, and it means a sink that posts to a slow analytics endpoint costs you nothing on the request path. It also means a sink must not be the only place a mutation is recorded: events are telemetry, not a ledger.

### The OpenTelemetry metrics

`otelSink` records two instruments, both with the attributes `action`, `status`, `ladder`, `vendor` (the agent's vendor, or `unknown`), and `tenant` (the tenant id, or an empty string), plus `errorCode` and `kind` when the event has them:

| Instrument     | Type      | Unit | Prometheus name after export                                 |
| -------------- | --------- | ---- | ------------------------------------------------------------ |
| `axe.requests` | counter   |      | axe_requests_total                                           |
| `axe.latency`  | histogram | ms   | axe_latency_bucket, axe_latency_sum, axe_latency_count       |

OpenTelemetry exporters replace dots with underscores and append a total suffix to monotonic counters. Some also append the unit, giving you axe_latency_milliseconds_bucket instead; check your exporter's output once and adjust the queries below.

## Day-one questions

The SQL assumes a Postgres table named axe_events with one row per event and the `agent` object flattened into three columns:

```sql
CREATE TABLE axe_events (
  ts             timestamptz NOT NULL,
  action         text        NOT NULL,
  status         text        NOT NULL,
  ladder         text        NOT NULL,
  agent_vendor   text,
  agent_name     text,
  agent_version  text,
  latency_ms     integer     NOT NULL,
  kind           text,
  error_code     text,
  tenant         text,
  schema_version smallint    NOT NULL
);
CREATE INDEX ON axe_events (ts);
CREATE INDEX ON axe_events (action, ts);
````

The PromQL runs against the two instruments above. Every query below has both forms.

### 1. Which agents are calling us?

The vendor mix over seven days. `unknown` means the agent sent neither `context.agent` nor a parseable `User-Agent`; a large `unknown` share is worth a line in your terms asking agents to identify themselves.

```sql
SELECT coalesce(agent_vendor, 'unknown') AS vendor,
       count(*)                           AS calls,
       round(100.0 * count(*) / sum(count(*)) OVER (), 1) AS pct
FROM axe_events
WHERE ts >= now() - interval '7 days'
GROUP BY 1
ORDER BY calls DESC;
```

```promql
sum by (vendor) (increase(axe_requests_total[7d]))
```

### 2. Which actions get used?

Calls per action, then per action per vendor. An action nobody calls is either undiscoverable (check its description against [Writing descriptions](designing-actions.md#writing-descriptions)) or not something agents need.

```sql
SELECT action, count(*) AS calls
FROM axe_events
WHERE ts >= now() - interval '7 days'
GROUP BY 1
ORDER BY calls DESC;

SELECT action, coalesce(agent_vendor, 'unknown') AS vendor, count(*) AS calls
FROM axe_events
WHERE ts >= now() - interval '7 days'
GROUP BY 1, 2
ORDER BY action, calls DESC;
```

```promql
sum by (action) (increase(axe_requests_total[7d]))

sum by (action, vendor) (increase(axe_requests_total[7d]))
```

### 3. Where does the ladder fall to `needs_human`?

This is the fix list. Every handoff is a step an agent could not finish, and the actions with the highest handoff rate are where a well-known kind or a better description pays off first. The numerator counts every `needs_human` outcome, including those reached through a continuation; the denominator counts first-touch invocations, so continuations and resumes are not double-counted.

```sql
SELECT action,
       count(*) FILTER (WHERE status = 'needs_human')                    AS handoffs,
       count(*) FILTER (WHERE ladder NOT IN ('continued', 'resumed'))    AS invocations,
       round(100.0 * count(*) FILTER (WHERE status = 'needs_human')
             / nullif(count(*) FILTER (WHERE ladder NOT IN ('continued', 'resumed')), 0), 1) AS handoff_pct
FROM axe_events
WHERE ts >= now() - interval '7 days'
GROUP BY action
ORDER BY handoff_pct DESC NULLS LAST;
```

```promql
sum by (action) (rate(axe_requests_total{status="needs_human"}[1h]))
  / sum by (action) (rate(axe_requests_total{ladder!~"continued|resumed"}[1h]))
```

Then look at which requirements you are offering and how often agents can satisfy them. On a `needs_input` event `kind` is the first entry in `accepts`; on a `continued` event it is the kind the agent chose, which may be a later entry. Read the two counts as "how often we asked, leading with this kind" and "how often an agent answered with this kind".

```sql
SELECT action, kind,
       count(*) FILTER (WHERE ladder = 'needs_input')                     AS offered,
       count(*) FILTER (WHERE ladder = 'continued')                       AS continued,
       count(*) FILTER (WHERE ladder = 'continued' AND status = 'ok')     AS continued_ok
FROM axe_events
WHERE ts >= now() - interval '7 days' AND kind IS NOT NULL
GROUP BY 1, 2
ORDER BY offered DESC;
```

```promql
sum by (action, kind) (increase(axe_requests_total{ladder="needs_input"}[7d]))

sum by (action, kind) (increase(axe_requests_total{ladder="continued", status="ok"}[7d]))
  / sum by (action, kind) (increase(axe_requests_total{ladder="continued"}[7d]))
```

A kind that is offered often and continued rarely is one agents do not hold. Consider a second entry in `accepts` that they might, per [Designing requirements](designing-actions.md#designing-requirements).

### 4. What is our agent-side conversion?

The funnel for Oakridge Rentals is `units.search` → `applications.submit` invoked → `applications.submit` reached `ok`. The last step counts `status = 'ok'` regardless of ladder, so an application that finished through an ACH continuation or after a deposit handoff counts as a conversion.

```sql
SELECT date_trunc('day', ts)::date AS day,
       count(*) FILTER (WHERE action = 'units.search' AND ladder = 'ok')                                    AS searches,
       count(*) FILTER (WHERE action = 'applications.submit' AND ladder NOT IN ('continued', 'resumed'))    AS submit_invoked,
       count(*) FILTER (WHERE action = 'applications.submit' AND status = 'ok')                             AS submit_ok
FROM axe_events
WHERE ts >= now() - interval '30 days'
GROUP BY 1
ORDER BY 1;
```

```promql
sum(increase(axe_requests_total{action="units.search", ladder="ok"}[1d]))

sum(increase(axe_requests_total{action="applications.submit", ladder!~"continued|resumed"}[1d]))

sum(increase(axe_requests_total{action="applications.submit", status="ok"}[1d]))
```

This funnel is aggregate, not per session. Events carry no `sessionId` and no `onBehalfOf`, so you cannot follow one agent from its search to its application. That is deliberate: an agent-chosen session id in a telemetry stream is a correlation key, and correlation keys are how anonymized data stops being anonymous. Per-day counts and ratios answer the business question without it. If you need true per-session attribution, do it in your own request logs with the hooks described in [What is deliberately not in the events](#what-is-deliberately-not-in-the-events).

### 5. What is p95 latency per action?

`latencyMs` is server-side time, from request receipt to response. It excludes the network and includes your handler.

```sql
SELECT action,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_ms,
       percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms) AS p50_ms,
       count(*) AS calls
FROM axe_events
WHERE ts >= now() - interval '24 hours'
GROUP BY action
ORDER BY p95_ms DESC;
```

```promql
histogram_quantile(0.95, sum by (action, le) (rate(axe_latency_bucket[5m])))
```

An action whose p95 approaches an agent's client timeout should return `pending` and finish through `onPoll`; see [The escalation ladder](concepts.md#the-escalation-ladder).

### 6. Error rate by code, and who sends bad input

The first query is the error mix. The second finds the vendors that hit `invalid_input` most on each action. A vendor whose agents keep failing validation on one action is telling you that the input schema's descriptions are not doing their job; the fix is usually a description on the field and an example in `examples`, not a looser schema.

```sql
SELECT error_code, count(*) AS errors,
       round(100.0 * count(*) / (SELECT count(*) FROM axe_events WHERE ts >= now() - interval '7 days'), 2) AS pct_of_all
FROM axe_events
WHERE ts >= now() - interval '7 days' AND status = 'error'
GROUP BY 1
ORDER BY errors DESC;

SELECT coalesce(agent_vendor, 'unknown') AS vendor, action,
       count(*) FILTER (WHERE error_code = 'invalid_input') AS invalid_input,
       count(*)                                             AS calls,
       round(100.0 * count(*) FILTER (WHERE error_code = 'invalid_input') / count(*), 1) AS pct
FROM axe_events
WHERE ts >= now() - interval '7 days'
GROUP BY 1, 2
HAVING count(*) >= 20
ORDER BY pct DESC;
```

```promql
sum by (errorCode) (rate(axe_requests_total{status="error"}[1h]))

sum by (vendor, action) (rate(axe_requests_total{errorCode="invalid_input"}[1d]))
  / sum by (vendor, action) (rate(axe_requests_total[1d]))
```

`internal` errors are thrown exceptions your handler did not convert with `fail`. They should be near zero; each one is also delivered to `onError`.

### 7. Per-tenant versions, on platforms

On a [platform](platforms.md) every event carries the tenant id. Add `tenant` to the grouping of any query above. The handoff rate per tenant, for example, tells you which tenants' configurations are sending agents to humans:

```sql
SELECT tenant, action,
       round(100.0 * count(*) FILTER (WHERE status = 'needs_human')
             / nullif(count(*) FILTER (WHERE ladder NOT IN ('continued', 'resumed')), 0), 1) AS handoff_pct,
       count(*) AS events
FROM axe_events
WHERE ts >= now() - interval '7 days' AND tenant IS NOT NULL
GROUP BY 1, 2
HAVING count(*) >= 50
ORDER BY handoff_pct DESC NULLS LAST;
```

```promql
sum by (tenant, action) (rate(axe_requests_total{status="needs_human"}[1d]))
  / sum by (tenant, action) (rate(axe_requests_total{ladder!~"continued|resumed"}[1d]))
```

For a single tenant's view, filter with `WHERE tenant = 'oakridge'` or the label matcher `{tenant="oakridge"}`.

## Loading JSON lines into a warehouse

The file sink produces one JSON object per line, which every warehouse reads. With DuckDB the file is a table as it stands; the `agent` object is a struct you address with a dot:

```sql
SELECT agent.vendor AS vendor, count(*) AS calls
FROM read_json_auto('axe-events.jsonl')
GROUP BY 1 ORDER BY 2 DESC;

CREATE TABLE axe_events AS
SELECT ts::TIMESTAMPTZ AS ts, action, status, ladder,
       agent.vendor AS agent_vendor, agent.name AS agent_name, agent.version AS agent_version,
       latencyMs AS latency_ms, kind, errorCode AS error_code, tenant, schemaVersion AS schema_version
FROM read_json_auto('axe-events.jsonl');
```

For Postgres, flatten with jq and copy. Null members become empty CSV fields, which Postgres reads as NULL:

```sh
jq -r '[.ts, .action, .status, .ladder, .agent.vendor, .agent.name, .agent.version,
        .latencyMs, .kind, .errorCode, .tenant, .schemaVersion] | @csv' axe-events.jsonl > axe-events.csv

psql "$DATABASE_URL" -c "\copy axe_events (ts, action, status, ladder, agent_vendor, agent_name, agent_version, latency_ms, kind, error_code, tenant, schema_version) FROM 'axe-events.csv' WITH (FORMAT csv)"
```

Rotate the file with your log rotation and ship it the way you ship other logs. The sink appends; it does not rotate.

## What is deliberately not in the events

Rule [E-2] of the spec lists what an event must never contain: `input`, `output`, `payload`, `state`, tokens, `onBehalfOf`, `sessionId`, IP addresses, or any header value other than the parsed agent fields. The SDK enforces this by giving the event type no place to put them. You can add sinks freely, export events to a third party, and give analysts access to the table, because the table cannot contain a deposit amount, a transcript, or a user id.

The cost is that events alone cannot answer "what did this user do" or "which input produced this error". When you need that, correlate in your own logs, on your own terms:

- Read your request id from the request in `onRequest` and `onResult`, and log it with the action and status. The [Observability hooks](deploying.md#observability-hooks) section shows the wiring.
- Keep that request id, and anything derived from it, out of the AXE event. Do not wrap a sink to append it. The point of the separation is that the events table stays safe to share.
- If you log input for debugging, redact payloads of `sensitive` kinds before the log line is written. The SDK validates a payment or identity payload against its schema and passes it to `onContinue`; it never logs it, and neither should you. [Security](security.md) covers this in detail.

## Next steps

- [Deploying](deploying.md): the hooks, rate limiting, and rollout steps that produce the events you query here.
- [Designing actions](designing-actions.md): what to change when the handoff rate or the `invalid_input` rate is high.
- [Platforms](platforms.md): serving many tenants from one deployment, and what `tenant` means on the events.
- [Event spec](../spec/EVENTS.md): the normative shape and rules.
