// #region all
import { createAXE } from "@summationai/axe-core";
import { combineSinks, consoleSink, otelSink } from "@summationai/axe-core/events";
import type { AXEEvent } from "@summationai/axe-core/events";
import { jsonlFileSink } from "@summationai/axe-core/node";
import { metrics, trace } from "@opentelemetry/api";

// #region custom
// Any function of an event is a sink. This one keeps a running count of handoffs per action.
const handoffsByAction = new Map<string, number>();

function handoffCounter(event: AXEEvent): void {
  if (event.status !== "needs_human") return;
  handoffsByAction.set(event.action, (handoffsByAction.get(event.action) ?? 0) + 1);
}
// #endregion custom

// #region wiring
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
// #endregion wiring
// #endregion all
