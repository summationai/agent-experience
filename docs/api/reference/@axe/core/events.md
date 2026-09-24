[AXE API reference](../../README.md) / [@axe/core](README.md) / events

# events

## Interfaces

### MeterLike

Defined in: [packages/core/src/events.ts:35](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/events.ts#L35)

Structural subset of an OpenTelemetry `Meter`, so `@axe/core` needs no OTel dependency.

#### Methods

##### createCounter()

```ts
createCounter(name, options?): object;
```

Defined in: [packages/core/src/events.ts:36](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/events.ts#L36)

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

##### createHistogram()

```ts
createHistogram(name, options?): object;
```

Defined in: [packages/core/src/events.ts:40](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/events.ts#L40)

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

### TracerLike

Defined in: [packages/core/src/events.ts:47](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/events.ts#L47)

Structural subset of an OpenTelemetry `Tracer`.

#### Methods

##### startSpan()

```ts
startSpan(name, options?): object;
```

Defined in: [packages/core/src/events.ts:48](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/events.ts#L48)

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

### EventSink

```ts
type EventSink = (event) => void | Promise<void>;
```

Defined in: [packages/core/src/events.ts:10](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/events.ts#L10)

Anything that receives events. Errors are swallowed and reported to `onSinkError`.

#### Parameters

##### event

[`AXEEvent`](types.md#axeevent)

#### Returns

`void` \| `Promise`\<`void`\>

## Functions

### combineSinks()

```ts
function combineSinks(sinks, onSinkError?): EventSink;
```

Defined in: [packages/core/src/events.ts:109](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/events.ts#L109)

Fan events out to several sinks, isolating failures.

#### Parameters

##### sinks

readonly [`EventSink`](#eventsink)[]

##### onSinkError?

(`error`) => `void`

#### Returns

[`EventSink`](#eventsink)

***

### consoleSink()

```ts
function consoleSink(write?): EventSink;
```

Defined in: [packages/core/src/events.ts:13](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/events.ts#L13)

Sink: one JSON line per event on stdout.

#### Parameters

##### write?

(`line`) => `void`

#### Returns

[`EventSink`](#eventsink)

***

### jsonlFileSink()

```ts
function jsonlFileSink(path): EventSink;
```

Defined in: [packages/core/src/events.ts:23](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/events.ts#L23)

Sink: append JSON lines to a file. Node only. The file handle is opened lazily and
writes are serialized, so events never interleave.

#### Parameters

##### path

`string`

#### Returns

[`EventSink`](#eventsink)

***

### otelSink()

```ts
function otelSink(options): EventSink;
```

Defined in: [packages/core/src/events.ts:66](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/events.ts#L66)

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

### parseUserAgent()

```ts
function parseUserAgent(header): EventAgent | null;
```

Defined in: [packages/core/src/events.ts:101](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/core/src/events.ts#L101)

Parse the recommended `User-Agent` form `Name/1.2 (+https://contact; axe/0.1)` into an EventAgent.

#### Parameters

##### header

`string` \| `null` \| `undefined`

#### Returns

[`EventAgent`](types.md#eventagent) \| `null`

## References

### AXEEvent

Re-exports [AXEEvent](types.md#axeevent)

***

### EventAgent

Re-exports [EventAgent](types.md#eventagent)
