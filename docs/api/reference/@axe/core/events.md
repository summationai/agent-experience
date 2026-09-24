[AXE API reference](../../README.md) / [@axe/core](README.md) / events

# events

## Interfaces

<a id="meterlike"></a>

### MeterLike

Structural subset of an OpenTelemetry `Meter`, so `@axe/core` needs no OTel dependency.

#### Methods

<a id="createcounter"></a>

##### createCounter()

```ts
createCounter(name, options?): object;
```

###### Parameters

###### name

`string`

###### options?

###### description?

`string`

###### unit?

`string`

###### Returns

`object`

###### add()

```ts
add(value, attributes?): void;
```

###### Parameters

###### value

`number`

###### attributes?

`Record`\<`string`, `string` \| `number` \| `boolean`\>

###### Returns

`void`

<a id="createhistogram"></a>

##### createHistogram()

```ts
createHistogram(name, options?): object;
```

###### Parameters

###### name

`string`

###### options?

###### description?

`string`

###### unit?

`string`

###### Returns

`object`

###### record()

```ts
record(value, attributes?): void;
```

###### Parameters

###### value

`number`

###### attributes?

`Record`\<`string`, `string` \| `number` \| `boolean`\>

###### Returns

`void`

***

<a id="tracerlike"></a>

### TracerLike

Structural subset of an OpenTelemetry `Tracer`.

#### Methods

<a id="startspan"></a>

##### startSpan()

```ts
startSpan(name, options?): object;
```

###### Parameters

###### name

`string`

###### options?

###### attributes?

`Record`\<`string`, `string` \| `number` \| `boolean`\>

###### startTime?

`number` \| `Date`

###### Returns

`object`

###### end()

```ts
end(endTime?): void;
```

###### Parameters

###### endTime?

`number` \| `Date`

###### Returns

`void`

###### setAttribute()

```ts
setAttribute(key, value): unknown;
```

###### Parameters

###### key

`string`

###### value

`string` \| `number` \| `boolean`

###### Returns

`unknown`

###### setStatus()

```ts
setStatus(status): unknown;
```

###### Parameters

###### status

###### code

`number`

###### message?

`string`

###### Returns

`unknown`

## Type Aliases

<a id="eventsink"></a>

### EventSink

```ts
type EventSink = (event) => void | Promise<void>;
```

Anything that receives events. Errors are swallowed and reported to `onSinkError`.

#### Parameters

##### event

[`AXEEvent`](types.md#axeevent)

#### Returns

`void` \| `Promise`\<`void`\>

## Functions

<a id="combinesinks"></a>

### combineSinks()

```ts
function combineSinks(sinks, onSinkError?): EventSink;
```

Fan events out to several sinks, isolating failures.

#### Parameters

##### sinks

readonly [`EventSink`](#eventsink)[]

##### onSinkError?

(`error`) => `void`

#### Returns

[`EventSink`](#eventsink)

***

<a id="consolesink"></a>

### consoleSink()

```ts
function consoleSink(write?): EventSink;
```

Sink: one JSON line per event on stdout.

#### Parameters

##### write?

(`line`) => `void`

#### Returns

[`EventSink`](#eventsink)

***

<a id="jsonlfilesink"></a>

### jsonlFileSink()

```ts
function jsonlFileSink(path): EventSink;
```

Sink: append JSON lines to a file. Node only. The file handle is opened lazily and
writes are serialized, so events never interleave.

#### Parameters

##### path

`string`

#### Returns

[`EventSink`](#eventsink)

***

<a id="otelsink"></a>

### otelSink()

```ts
function otelSink(options): EventSink;
```

Sink: record an `axe.requests` counter and an `axe.latency` histogram, and optionally
a span per event. Pass the real objects from `@opentelemetry/api`:

```ts
otelSink({ meter: metrics.getMeter("axe"), tracer: trace.getTracer("axe") })
```

#### Parameters

##### options

###### meter

[`MeterLike`](#meterlike)

###### tracer?

[`TracerLike`](#tracerlike)

#### Returns

[`EventSink`](#eventsink)

***

<a id="parseuseragent"></a>

### parseUserAgent()

```ts
function parseUserAgent(header): EventAgent | null;
```

Parse the recommended `User-Agent` form `Name/1.2 (+https://contact; axe/0.1)` into an EventAgent.

#### Parameters

##### header

`string` \| `null` \| `undefined`

#### Returns

[`EventAgent`](types.md#eventagent) \| `null`

## References

<a id="axeevent"></a>

### AXEEvent

Re-exports [AXEEvent](types.md#axeevent)

***

<a id="eventagent"></a>

### EventAgent

Re-exports [EventAgent](types.md#eventagent)
