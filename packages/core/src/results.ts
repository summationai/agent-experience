/**
 * Result intents: what handlers return. They are plain descriptors; the runtime
 * turns them into wire envelopes (minting and storing tokens as needed).
 */
import type { AcceptInput } from "./kinds";
import type {
  Availability,
  ErrorBody,
  ErrorCode,
  JsonObject,
  JsonValue,
  ValidationIssue,
} from "./types";
import { WIRE } from "./vocabulary";

export const INTENT: unique symbol = Symbol.for("axe.intent");

export interface OkIntent<O = unknown> {
  readonly [INTENT]: "ok";
  output: O;
}

export interface HandoffIntent {
  readonly [INTENT]: "handoff";
  reason: string;
  instructions: string;
  /** The human-facing page. A function receives the handoff id so the URL can embed it. */
  url: string | ((handoffId: string) => string);
  whatAgentShouldSayToUser: string;
  /** Server-side state delivered to `onResume`. Must be JSON-serializable. */
  state?: JsonValue;
  /** Token lifetime. Default 24 hours. */
  ttlSeconds?: number;
  /** Append `?axe_handoff=<id>` to `url` (default true). */
  appendHandoffId?: boolean;
  /** Refuse `/axe/resume` with `conflict` until `completeHandoff()` is called for this handoff. Default false. */
  requireCompletion?: boolean;
  /**
   * Makes this handoff an approval request (spec §9.3): the human approves the exact call on the
   * site's own page with `approveHandoff`, and the resume runs only while every binding still
   * holds. Set by `requestApproval`; the action must declare `approvalState`.
   */
  approval?: ApprovalRequest;
}

/** What an approval request carries beyond a handoff. Stored server-side; never sent to the agent. */
export interface ApprovalRequest {
  /**
   * What the approval page shows the person about the operation, in the site's words (for example
   * the rows that will change). The page SHOULD also render the current state from the site's own
   * store; the preview is what the agent's call looked like when it was made.
   */
  preview?: JsonValue;
}

export interface NeedsInputIntent {
  readonly [INTENT]: "needs_input";
  reason: string;
  message: string;
  accepts: AcceptInput[];
  /** Server-side state delivered to `onContinue`. Must be JSON-serializable. */
  state?: JsonValue;
  /** Reached only when the agent can satisfy none of `accepts`. */
  fallback?: HandoffIntent;
  /** Token lifetime. Default 15 minutes. */
  ttlSeconds?: number;
}

export interface PendingIntent {
  readonly [INTENT]: "pending";
  /** Seconds the agent should wait before polling. Default 5. */
  retryAfter?: number;
  /** Server-side state delivered to `onPoll`. */
  state?: JsonValue;
  /** Use your own poll URL instead of the SDK's `/axe/poll/{token}`. */
  pollUrl?: string;
  /** How long the poll token stays valid. Default 1 hour. */
  ttlSeconds?: number;
}

export interface ErrorIntent {
  readonly [INTENT]: "error";
  error: ErrorBody;
}

export type ResultIntent<O = unknown> =
  OkIntent<O> | NeedsInputIntent | HandoffIntent | PendingIntent | ErrorIntent;

export function isIntent(value: unknown): value is ResultIntent {
  return typeof value === "object" && value !== null && INTENT in (value as object);
}

/** Explicitly mark a value as the action's output. Returning the plain value is equivalent. */
export function ok<O>(output: O): OkIntent<O> {
  return { [INTENT]: "ok", output };
}

/** Ask the agent for something it may hold. See spec §8. */
export function needsInput(spec: Omit<NeedsInputIntent, typeof INTENT>): NeedsInputIntent {
  if (!spec.accepts || spec.accepts.length === 0) {
    throw new Error(
      "needsInput(): `accepts` must list at least one kind the agent could provide. If nothing an agent holds could help, return handoff() instead.",
    );
  }
  if (!spec.reason || !spec.message) {
    throw new Error(
      "needsInput(): `reason` (a short snake_case code) and `message` (agent-facing prose) are required.",
    );
  }
  return { [INTENT]: "needs_input", ...spec };
}

/** Hand off to the human. Return it directly for `needs_human`, or pass it as `fallback` to needsInput(). See spec §9. */
export function handoff(spec: Omit<HandoffIntent, typeof INTENT>): HandoffIntent {
  for (const key of ["reason", "instructions", "url", "whatAgentShouldSayToUser"] as const) {
    if (!spec[key]) {
      throw new Error(
        `handoff(): \`${key}\` is required. Every Handoff member is required by the protocol (spec [P-HAND-1]).`,
      );
    }
  }
  return { [INTENT]: "handoff", ...spec };
}

/** The default lifetime of an approval request: one hour. A shorter window than a plain handoff's 24 hours, since the state it is bound to keeps moving. */
export const APPROVAL_TTL_SECONDS = 60 * 60;

/** The default `reason` of an approval handoff. */
export const APPROVAL_REQUIRED = "approval_required";

/**
 * Ask a person to approve this exact call before it runs (spec §9.3). Return it from an action's
 * `handler` for a consequential operation. The agent receives `needs_human` with a handoff to
 * `url`, the site's own approval page; the runtime records the call's input, the acting principal,
 * the tenant, and the state the action's `approvalState` reports now. The person approves or
 * cancels on that page with `approveHandoff` or `cancelHandoff`; the agent then calls
 * `/axe/resume`, and `onResume` runs with `approval` set only while the approval stands and the
 * state still matches. An agent cannot approve its own request: nothing it can send marks the
 * handoff approved.
 */
export function requestApproval(
  spec: Omit<HandoffIntent, typeof INTENT | "approval" | "requireCompletion" | "reason"> & {
    reason?: string;
    preview?: JsonValue;
  },
): HandoffIntent {
  const { preview, reason, ...rest } = spec;
  const intent = handoff({
    ...rest,
    reason: reason ?? APPROVAL_REQUIRED,
    ttlSeconds: rest.ttlSeconds ?? APPROVAL_TTL_SECONDS,
  });
  intent.requireCompletion = true;
  intent.approval = preview === undefined ? {} : { preview };
  return intent;
}

/** Report long-running work; define `onPoll` on the action to produce the eventual result. See spec §10. */
export function pending(spec: Omit<PendingIntent, typeof INTENT> = {}): PendingIntent {
  return { [INTENT]: "pending", ...spec };
}

export interface FailOptions {
  retryable?: boolean;
  details?: JsonObject;
  issues?: ValidationIssue[];
}

/** Return a structured error. Prefer this over throwing: thrown errors become a generic `internal`. */
export function fail(code: ErrorCode, message: string, options: FailOptions = {}): ErrorIntent {
  const error: ErrorBody = {
    code,
    message,
    retryable:
      options.retryable ?? (code === WIRE.error.rateLimited || code === WIRE.error.unavailable),
  };
  if (options.details || options.issues) {
    error.details = { ...(options.details ?? {}) };
    if (options.issues) error.details.issues = options.issues;
  }
  return { [INTENT]: "error", error };
}

/**
 * Refuse a call because the action is not available right now (spec §21). `details` mirrors the
 * availability: `reason`, and `requires` / `handoff` when declared, so the agent learns what would
 * change that. The message defaults to the reason.
 */
export function unavailable(
  availability: Extract<Availability, { available: false }>,
  options: { message?: string; retryable?: boolean } = {},
): ErrorIntent {
  const details: JsonObject = { reason: availability.reason };
  if (availability.requires) details.requires = availability.requires as unknown as JsonValue;
  if (availability.handoff) details.handoff = { ...availability.handoff };
  return fail(WIRE.error.unavailable, options.message ?? availability.reason, {
    retryable: options.retryable ?? true,
    details,
  });
}

/** Throwable form of `fail()`, for code paths deep inside a handler. The runtime converts it. */
export class AXEError extends Error {
  readonly intent: ErrorIntent;
  constructor(code: ErrorCode, message: string, options: FailOptions = {}) {
    super(message);
    this.name = "AXEError";
    this.intent = fail(code, message, options);
  }
  get code(): ErrorCode {
    return this.intent.error.code;
  }
}
