/**
 * `action()` builds a typed, validated action definition. Validation at
 * registration catches structural problems (bad pointers, unknown affordance
 * bindings, reserved keys, untruthful metadata, agent-directed text) before an
 * agent ever sees the manifest.
 */
import type { z } from "zod";
import type {
  ActionDefinition,
  ActionExample,
  Affordance,
  AXEActionEventInput,
  AuthMode,
  Availability,
  HandoffSpec,
  Revision,
  Brand,
  Contact,
  ManifestAuth,
  Policies,
  Deprecation,
  Display,
  Freshness,
  JsonSchema,
  JsonValue,
  Pagination,
  RequestContext,
  Risk,
} from "./types";
import type { ResultIntent } from "./results";
import type { Identity } from "./server";
import type { fail, handoff, needsInput, ok, pending, unavailable } from "./results";
import type { AcceptInput } from "./kinds";
import { toJsonSchema } from "./zod-json-schema";
import {
  DisplayValidationError,
  schemaMentionsReserved,
  validateAffordances,
  validateDisplay,
  validateFreshness,
  validatePagination,
} from "./display";
import { AGENT_DIRECTIVE_PATTERNS, agentReadText } from "./lint";
import { WIRE } from "./vocabulary";

export type MaybePromise<T> = T | Promise<T>;

/** What a handler may return: the output value itself, or an intent from `ok`, `needsInput`, `handoff`, `pending`, `fail`. */
export type HandlerReturn<O> = O | ResultIntent<O>;

/** Information about the tenant serving this request, on multi-tenant platforms. */
export interface TenantInfo {
  /** Stable identifier; appears on events as `tenant`. */
  id: string;
  name: string;
  baseUrl: string;
  description?: string;
  humanFallbackUrl?: string;
  brand?: Brand;
  policies?: Policies;
  contact?: Contact;
  auth?: Partial<ManifestAuth>;
  indexUrl?: string;
  updatedAt?: string;
}

/** The helpers every handler receives. They are also importable from `@axe/core`. */
export interface ResultHelpers {
  ok: typeof ok;
  needsInput: typeof needsInput;
  handoff: typeof handoff;
  pending: typeof pending;
  fail: typeof fail;
  unavailable: typeof unavailable;
}

/**
 * What an action's `availability` hook returns: available, or unavailable with a reason in the
 * site's own words and, optionally, the kinds that would make it available (`requires`, with Zod or
 * JSON Schemas) and a step only a human can take (`handoff`).
 */
export type AvailabilityInput =
  | { available: true }
  | { available: false; reason: string; requires?: AcceptInput[]; handoff?: HandoffSpec };

/** Passed to an action's `availability` hook. Identity is null for the manifest's anonymous view. */
export interface AvailabilityContext {
  action: string;
  identity: Identity | null;
  tenant: TenantInfo | null;
  /** The request being served; null when the manifest is described outside a request. */
  request: Request | null;
}

interface BaseContext extends ResultHelpers {
  /** The action name. */
  action: string;
  /** The sanitized request context. `onBehalfOf` is the authenticated identity, never the agent's claim. */
  context: RequestContext;
  /** The identity your `authenticate` function or adapter established, with any `claims`; null when anonymous. */
  identity: Identity | null;
  /** For `site` mode: what `verifySiteKey` returned about the key, when it returned an object. */
  siteKey: { id?: string; actions?: string[] } | null;
  /** The underlying Web request, for headers and the site's own session lookups. */
  request: Request;
  /** The tenant, on platforms. */
  tenant: TenantInfo | null;
  /**
   * Record what the action did as an action event (spec/EVENTS.md, "Action events") for the
   * server's `onActionEvent` sinks. Fire-and-forget: it never delays or affects the result.
   */
  emit: (event: AXEActionEventInput) => void;
  /** The revision the agent said it observed, when the request carried `expectedRev`. Already checked against `revision` when one is configured. */
  expectedRev?: Revision;
  /** The action's current availability for this caller, when the action declares an `availability` hook; null otherwise. */
  availability: Availability | null;
}

export interface HandlerContext<I> extends BaseContext {
  input: I;
}

export interface ContinueContext<S> extends BaseContext {
  /** The kind the agent chose from `accepts`. */
  kind: string;
  /** The payload, already validated against that kind's schema. */
  payload: JsonValue;
  /** The `state` passed to `needsInput`. */
  state: S;
}

export interface ResumeContext<S> extends BaseContext {
  /** The `state` passed to `handoff`. */
  state: S;
  /** What `completeHandoff` recorded, if the site called it. */
  completion: { at: string; onBehalfOf?: string; data?: JsonValue } | undefined;
}

export interface PollContext<S> extends BaseContext {
  /** The `state` passed to `pending`. */
  state: S;
}

export interface ActionSpec<
  I extends z.ZodType,
  O extends z.ZodType,
  S extends JsonValue = JsonValue,
> {
  title: string;
  description: string;
  input: I;
  output: O;
  /** Default false. */
  readOnly?: boolean;
  /** Default: true when readOnly, otherwise false. */
  idempotent?: boolean;
  /** Default: true when readOnly, otherwise false. */
  reversible?: boolean;
  risk: Risk;
  /** Default `none`. */
  auth?: AuthMode;
  examples?: { input: z.input<I>; output: z.input<O> }[];
  display?: Display;
  affordances?: Affordance[];
  pagination?: Pagination;
  freshness?: Freshness;
  humanHandoff?: { reasons: string[] };
  deprecated?: Deprecation;
  /**
   * Whether the action can be done right now, and if not, why (spec §21). Rendered into the
   * manifest (anonymous view) and `/axe/state` (per caller), and delivered to the handler as
   * `availability`. The runtime does not refuse the call for you: the handler stays the one door,
   * and returns `unavailable(availability)` or climbs the ladder.
   */
  availability?: (ctx: AvailabilityContext) => MaybePromise<AvailabilityInput>;
  handler: (ctx: HandlerContext<z.output<I>>) => MaybePromise<HandlerReturn<z.input<O>>>;
  onContinue?: (ctx: ContinueContext<S>) => MaybePromise<HandlerReturn<z.input<O>>>;
  onResume?: (ctx: ResumeContext<S>) => MaybePromise<HandlerReturn<z.input<O>>>;
  onPoll?: (ctx: PollContext<S>) => MaybePromise<HandlerReturn<z.input<O>>>;
}

/** A registered action: the wire definition plus the runtime pieces. */
export interface RegisteredAction<
  I extends z.ZodType = z.ZodType,
  O extends z.ZodType = z.ZodType,
  S extends JsonValue = JsonValue,
> {
  name: string;
  spec: ActionSpec<I, O, S>;
  definition: ActionDefinition;
  /** The item schema derived from `display`, for later affordance checks. */
  itemSchema: JsonSchema;
  /** Affordance targets not registered at the time this action was; checked at finalization. */
  unresolvedTargets: string[];
}

/**
 * A source of actions that change while the server runs (spec [S-AXE-1]: one action per live
 * control). The server consults providers, after the actions registered with `register()`,
 * whenever it enumerates actions (the manifest, `/axe/state`, the MCP tool list) or looks one
 * up by name (an invocation, a continue, a resume, a poll). Every action a provider returns is
 * built with `action()`, so it was linted when it was built; the server checks its `auth` mode
 * and its name's uniqueness when it first sees it.
 */
export interface ActionProvider {
  /** The actions offered right now, in a stable order. */
  actions(): readonly RegisteredAction[];
  /**
   * One action by name, or undefined. Lets the server invoke without scanning `actions()`;
   * without it the server scans, which is fine for a handful of actions and not for hundreds.
   */
  get?(name: string): RegisteredAction | undefined;
  /**
   * Subscribe to changes in the set. The server forwards them to its `onActionsChanged`
   * listeners; the derived MCP server sends `notifications/tools/list_changed`.
   */
  onChange?(listener: () => void): () => void;
}

export const ACTION_NAME_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/;

/** Thrown for structural problems in an action definition. The message says what to change. */
export class ActionDefinitionError extends Error {
  constructor(
    readonly action: string,
    message: string,
  ) {
    super(`Action "${action}": ${message}`);
    this.name = "ActionDefinitionError";
  }
}

/**
 * Define an action. Throws `ActionDefinitionError` or `DisplayValidationError` when the
 * definition cannot be published as declared. Register the result with `axe.register()`.
 */
export function action<I extends z.ZodType, O extends z.ZodType, S extends JsonValue = JsonValue>(
  name: string,
  spec: ActionSpec<I, O, S>,
): RegisteredAction<I, O, S> {
  if (!ACTION_NAME_PATTERN.test(name)) {
    throw new ActionDefinitionError(
      name,
      `name must be namespaced kebab-case segments joined by dots, e.g. "appointments.reschedule" (pattern ${ACTION_NAME_PATTERN}).`,
    );
  }
  if (!spec.title?.trim()) throw new ActionDefinitionError(name, "title is required.");
  if (!spec.description?.trim())
    throw new ActionDefinitionError(
      name,
      "description is required. Write it for an agent: what it does, what it returns, what it commits the user to.",
    );
  if (typeof spec.handler !== "function")
    throw new ActionDefinitionError(name, "handler must be a function.");

  const readOnly = spec.readOnly ?? false;
  const idempotent = spec.idempotent ?? readOnly;
  const reversible = spec.reversible ?? readOnly;
  const auth = spec.auth ?? WIRE.authMode.none;
  if (!readOnly && spec.risk === WIRE.risk.none) {
    throw new ActionDefinitionError(
      name,
      `risk "none" is only valid for readOnly actions (spec [P-ACT-3]). Choose low, medium, or high for an action that changes state.`,
    );
  }

  const input = toJsonSchema(spec.input, "input");
  const output = toJsonSchema(spec.output, "output");
  if (input["type"] !== "object")
    throw new ActionDefinitionError(name, "input must be a z.object() (spec [P-ACT-4]).");
  if (output["type"] !== "object")
    throw new ActionDefinitionError(name, "output must be a z.object() (spec [P-ACT-4]).");
  if (schemaMentionsReserved(output)) {
    throw new ActionDefinitionError(
      name,
      `output schema declares the reserved key "${WIRE.field.axeReserved}". Return dynamic affordances under it at runtime, but do not declare it (spec [P-ACT-6]).`,
    );
  }

  const examples: ActionExample[] = [];
  for (const [i, ex] of (spec.examples ?? []).entries()) {
    const inR = spec.input.safeParse(ex.input);
    if (!inR.success)
      throw new ActionDefinitionError(
        name,
        `examples[${i}].input does not validate against the input schema: ${inR.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")}`,
      );
    const outR = spec.output.safeParse(ex.output);
    if (!outR.success)
      throw new ActionDefinitionError(
        name,
        `examples[${i}].output does not validate against the output schema: ${outR.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")}`,
      );
    examples.push({ input: ex.input as JsonValue, output: ex.output as JsonValue });
  }

  const definition: ActionDefinition = {
    name,
    title: spec.title,
    description: spec.description,
    input,
    output,
    readOnly,
    idempotent,
    reversible,
    risk: spec.risk,
    auth,
  };
  if (examples.length > 0) definition.examples = examples;
  if (spec.display) definition.display = spec.display;
  if (spec.affordances) definition.affordances = spec.affordances;
  if (spec.pagination) definition.pagination = spec.pagination;
  if (spec.freshness) definition.freshness = spec.freshness;
  if (spec.humanHandoff) definition.humanHandoff = spec.humanHandoff;
  if (spec.deprecated) definition.deprecated = spec.deprecated;

  let itemSchema: JsonSchema = output;
  if (spec.display) itemSchema = validateDisplay(name, spec.display, output);
  validatePagination(name, spec.pagination, input, output);
  validateFreshness(name, spec.freshness, output);

  const unresolvedTargets = spec.affordances
    ? validateAffordances(name, spec.affordances, itemSchema, output, () => undefined)
    : [];

  for (const t of agentReadText(definition)) {
    for (const re of AGENT_DIRECTIVE_PATTERNS) {
      const m = re.exec(t.text);
      if (m) {
        throw new ActionDefinitionError(
          name,
          `${t.location} contains an instruction aimed at the agent ("${m[0]}"). Agent-read text describes capability and constraints; it never tells the agent how to behave (spec [P-HON-1]). Rewrite it.`,
        );
      }
    }
  }

  return { name, spec, definition, itemSchema, unresolvedTargets };
}

export { DisplayValidationError };
