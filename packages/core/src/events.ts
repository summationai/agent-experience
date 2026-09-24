/**
 * Analytics events (spec/EVENTS.md) and the sinks that receive them.
 * Events carry no PII and no payloads by construction: the type has no field for them.
 */
import type { AXEEvent, EventAgent } from "./types";

export type { AXEEvent, EventAgent };

/** Anything that receives events. Errors are swallowed and reported to `onSinkError`. */
export type EventSink = (event: AXEEvent) => void | Promise<void>;

/** Sink: one JSON line per event on stdout. */
export function consoleSink(write: (line: string) => void = (l) => console.log(l)): EventSink {
  return (event) => {
    write(JSON.stringify(event));
  };
}

/**
 * Sink: append JSON lines to a file. Node only. The file handle is opened lazily and
 * writes are serialized, so events never interleave.
 */
export function jsonlFileSink(path: string): EventSink {
  let queue: Promise<void> = Promise.resolve();
  return (event) => {
    queue = queue.then(async () => {
      const { appendFile } = await import("node:fs/promises");
      await appendFile(path, JSON.stringify(event) + "\n", "utf8");
    });
    return queue;
  };
}

/** Structural subset of an OpenTelemetry `Meter`, so `@axe/core` needs no OTel dependency. */
export interface MeterLike {
  createCounter(
    name: string,
    options?: { description?: string; unit?: string },
  ): { add(value: number, attributes?: Record<string, string | number | boolean>): void };
  createHistogram(
    name: string,
    options?: { description?: string; unit?: string },
  ): { record(value: number, attributes?: Record<string, string | number | boolean>): void };
}

/** Structural subset of an OpenTelemetry `Tracer`. */
export interface TracerLike {
  startSpan(
    name: string,
    options?: { startTime?: number | Date; attributes?: Record<string, string | number | boolean> },
  ): {
    setAttribute(key: string, value: string | number | boolean): unknown;
    setStatus(status: { code: number; message?: string }): unknown;
    end(endTime?: number | Date): void;
  };
}

/**
 * Sink: record an `axe.requests` counter and an `axe.latency` histogram, and optionally
 * a span per event. Pass the real objects from `@opentelemetry/api`:
 *
 * ```ts
 * otelSink({ meter: metrics.getMeter("axe"), tracer: trace.getTracer("axe") })
 * ```
 */
export function otelSink(options: { meter: MeterLike; tracer?: TracerLike }): EventSink {
  const requests = options.meter.createCounter("axe.requests", {
    description: "AXE requests by action, status, and ladder",
  });
  const latency = options.meter.createHistogram("axe.latency", {
    description: "AXE server-side latency",
    unit: "ms",
  });
  return (event) => {
    const attributes: Record<string, string> = {
      action: event.action,
      status: event.status,
      ladder: event.ladder,
      vendor: event.agent?.vendor ?? "unknown",
      tenant: event.tenant ?? "",
    };
    if (event.errorCode) attributes["errorCode"] = event.errorCode;
    if (event.kind) attributes["kind"] = event.kind;
    requests.add(1, attributes);
    latency.record(event.latencyMs, attributes);
    if (options.tracer) {
      const end = new Date(event.ts);
      const start = new Date(end.getTime() - event.latencyMs);
      const span = options.tracer.startSpan(`axe ${event.action}`, {
        startTime: start,
        attributes,
      });
      if (event.status === "error")
        span.setStatus({ code: 2, message: event.errorCode ?? "error" });
      span.end(end);
    }
  };
}

/** Parse the recommended `User-Agent` form `Name/1.2 (+https://contact; axe/0.1)` into an EventAgent. */
export function parseUserAgent(header: string | null | undefined): EventAgent | null {
  if (!header) return null;
  const m = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.+-]+)/.exec(header.trim());
  if (!m) return null;
  return { name: m[1]!, version: m[2]! };
}

/** Fan events out to several sinks, isolating failures. */
export function combineSinks(
  sinks: readonly EventSink[],
  onSinkError?: (error: unknown) => void,
): EventSink {
  return (event) => {
    for (const sink of sinks) {
      try {
        const r = sink(event);
        if (r && typeof (r as Promise<void>).catch === "function") {
          (r as Promise<void>).catch((e) => onSinkError?.(e));
        }
      } catch (e) {
        onSinkError?.(e);
      }
    }
  };
}
