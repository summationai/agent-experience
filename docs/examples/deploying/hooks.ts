// #region all
import { createAXE } from "@axe/core";
import type { HookContext } from "@axe/core";
import { otelSink } from "@axe/core/events";
import { metrics } from "@opentelemetry/api";

// Stand-ins for your structured logger and your APM client.
const log = {
  info: (fields: Record<string, unknown>) => console.log(JSON.stringify(fields)),
  error: (fields: Record<string, unknown>) => console.error(JSON.stringify(fields)),
};
const apm = {
  captureException(_error: unknown, _tags: Record<string, string>): void {},
};

// #region fields
// The same fields on every line, so one request id ties the request, the result, and your
// own application logs together. The request id never enters an AXE event.
function fields(ctx: HookContext): Record<string, unknown> {
  return {
    requestId: ctx.request.headers.get("x-request-id"),
    endpoint: ctx.endpoint,
    action: ctx.action,
    vendor: ctx.context.agent?.vendor ?? "unknown",
    tenant: ctx.tenant?.id ?? null,
  };
}
// #endregion fields

// #region hooks
export const axe = createAXE({
  name: "Northgate University Admissions",
  description:
    "Check application status, upload transcripts and recommendation letters, and schedule campus visits for prospective students.",
  baseUrl: "https://admissions.northgate.example",
  auth: { modes: ["none", "user"], userLoginUrl: "https://admissions.northgate.example/login" },
  secret: process.env.AXE_SECRET,
  onRequest: (ctx) => {
    log.info({ msg: "axe.request", ...fields(ctx) });
  },
  onResult: (ctx, result) => {
    // Log the status, never result.output, result.accepts, or result.handoff.
    log.info({ msg: "axe.result", ...fields(ctx), status: result.status });
  },
  onError: (ctx, error) => {
    log.error({
      msg: "axe.error",
      ...fields(ctx),
      error: error instanceof Error ? error.message : String(error),
    });
    apm.captureException(error, { action: ctx.action, endpoint: ctx.endpoint });
  },
  onEvent: otelSink({ meter: metrics.getMeter("axe") }),
});
// #endregion hooks
// #endregion all
