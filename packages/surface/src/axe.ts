/**
 * @axe/surface/axe: the seam between Surface and AXE. A surface becomes two AXE actions:
 * `<ns>.observe` (read-only, with display and per-entry affordances) and `<ns>.act` (mutating,
 * revision-guarded). Refusals map onto the escalation ladder: an unavailable control that declares
 * `requires` becomes `needs_input`; one that declares a `handoff` becomes `needs_human`; a stale
 * revision is `conflict`.
 */
import { action, z } from "@axe/core";
import type { RegisteredAction } from "@axe/core";
import type { JsonValue } from "@axe/core/types";
import * as WIRE from "@axe/core/vocabulary";
import type { ActRequest, Surface } from "./index";

export interface SurfaceActionsOptions {
  /** Action namespace. Default `surface`, giving `surface.observe` and `surface.act`. */
  namespace?: string;
  /** Actor recorded for acts that arrive through AXE. Default: the authenticated `onBehalfOf`, else `agent`. */
  actor?: (context: { onBehalfOf?: string }) => string;
  /** How the application runs handlers (for example React's `flushSync`). */
  run?: (fn: () => unknown) => unknown;
  /** Risk to declare for `act`. Default `medium`; declare `high` when the surface can move money or sign. */
  risk?: "low" | "medium" | "high";
}

const ObservedEntrySchema = z.object({
  index: z.number().int().nullable(),
  id: z.string(),
  kind: z.enum(["action", "field", "collection"]),
  role: z.string(),
  name: z.string(),
  object: z.string().nullable(),
  rev: z.number().int(),
  state: z
    .object({
      available: z.boolean(),
      reason: z.string().nullable(),
      requires: z.array(z.record(z.string(), z.unknown())).optional(),
      handoff: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  effect: z.record(z.string(), z.unknown()).optional(),
  value: z.unknown().optional(),
  edit: z.record(z.string(), z.unknown()).optional(),
  total: z.number().nullable().optional(),
  loaded: z.number().nullable().optional(),
  filter: z.unknown().optional(),
  sort: z.unknown().optional(),
});

/** Build the two AXE actions for a surface. Register both with `axe.register()`. */
export function surfaceActions(
  surface: Surface,
  options: SurfaceActionsOptions = {},
): RegisteredAction[] {
  const ns = options.namespace ?? "surface";
  const observeName = `${ns}.observe`;
  const actName = `${ns}.act`;
  const actorFor = options.actor ?? ((ctx) => ctx.onBehalfOf ?? "agent");

  const ObserveOutput = z.object({
    protocol: z.string(),
    app: z.string(),
    rev: z.number().int(),
    at: z.string(),
    entries: z.array(ObservedEntrySchema),
    objects: z.record(z.string(), z.unknown()),
    frozen: z.object({ reason: z.string() }).optional(),
  });
  const observe = action(observeName, {
    title: "Observe the application",
    description:
      "Returns the application's live table of controls under one revision: what can be done right now (indexed), what cannot and why, current field values, and the domain objects behind them. Read this before acting and pass its rev to act.",
    readOnly: true,
    risk: "none",
    input: z.object({}).strict(),
    output: ObserveOutput,
    display: {
      kind: "list",
      items: "/entries",
      item: {
        id: "/id",
        title: "/name",
        subtitle: "/object",
        attributes: [
          { label: "Kind", path: "/kind", format: "text" },
          { label: "Available", path: "/state/available", format: "boolean" },
          { label: "Why not", path: "/state/reason", format: "text" },
          { label: "Value", path: "/value", format: "text" },
          { label: "Index", path: "/index", format: "number" },
        ],
      },
      suggestedComparison: ["Available", "Why not"],
      emptyMessage: "The application has no controls registered right now.",
      disclaimer:
        "The table is a snapshot at the given rev. An act with an older rev is refused and applies nothing.",
    },
    handler: async () => {
      const view = surface.observe();
      // Dynamic affordances: every actionable row leads to act with its id and op pre-bound.
      const entries = view.entries.map((row) => {
        if (row.index === null) return row;
        const op =
          row.kind === "action"
            ? row.role === "switch"
              ? WIRE.op.toggle
              : WIRE.op.click
            : row.kind === "field"
              ? WIRE.op.typeText
              : WIRE.op.scrollDown;
        return {
          ...row,
          _axe: {
            affordances: [
              {
                action: actName,
                title: row.name,
                input: { target: row.id, op, expectedRev: view.rev },
                primary: true,
              },
            ],
          },
        };
      });
      return { ...view, entries } as unknown as z.infer<typeof ObserveOutput>;
    },
  });

  const act = action(actName, {
    title: "Act on a control",
    description:
      "Runs one control's own handler, exactly as a click or a keystroke would, guarded by the revision you observed. Refused with conflict when the application changed since your observation; nothing is applied. Pass the entry id as target, the op for its kind, text for fields, and confirm for actions that require it.",
    risk: options.risk ?? "medium",
    idempotent: false,
    reversible: false,
    input: z
      .object({
        target: z
          .union([z.string(), z.number().int()])
          .describe("Entry id from observe (preferred) or its index"),
        op: z
          .enum([WIRE.op.click, WIRE.op.toggle, WIRE.op.typeText, WIRE.op.scrollDown])
          .describe("Operation for the entry's kind"),
        text: z.string().optional().describe("Text for a field, or free text an action asks for"),
        expectedRev: z.number().int().describe("The rev from the observation you are acting on"),
        confirm: z
          .boolean()
          .optional()
          .describe("Required true for actions whose effect declares confirm"),
      })
      .strict(),
    output: z.object({
      rev: z.number().int(),
      id: z.string(),
      actor: z.string(),
      changed: z.array(z.string()),
    }),
    humanHandoff: { reasons: ["unavailable"] },
    handler: async ({ input, context, needsInput, handoff, fail }) => {
      const request: ActRequest = {
        op: input.op,
        target: input.target,
        expectedRev: input.expectedRev,
        actor: actorFor(context),
      };
      if (input.text !== undefined) request.text = input.text;
      if (input.confirm !== undefined) request.confirm = input.confirm;
      const result = await surface.act(request, options.run ? { run: options.run } : {});
      if (result.status === WIRE.status.ok) return result.output;
      const details = result.error.details ?? {};
      // Ask the agent first: the control declared kinds that would make it available.
      const entry = typeof input.target === "string" ? surface.get(input.target) : undefined;
      const state = entry?.kind === "action" ? entry.state : undefined;
      if (result.error.code === WIRE.error.unavailable && state && !state.available) {
        if (state.requires) {
          const spec = state.requires;
          return needsInput({
            reason: "unavailable",
            message: `${result.error.message} Provide one of the following to continue.`,
            accepts: spec.accepts,
            state: { request: request as unknown as JsonValue },
            ...(state.handoff
              ? {
                  fallback: handoff({
                    ...state.handoff,
                    state: { request: request as unknown as JsonValue },
                  }),
                }
              : {}),
          });
        }
        if (state.handoff)
          return handoff({ ...state.handoff, state: { request: request as unknown as JsonValue } });
      }
      return fail(result.error.code, result.error.message, {
        retryable: result.error.retryable,
        details: details as Record<string, JsonValue>,
      });
    },
    onContinue: async ({ kind, payload, state, context, fail }) => {
      const saved = (state as unknown as { request: ActRequest }).request;
      const entry = typeof saved.target === "string" ? surface.get(saved.target) : undefined;
      const availability = entry?.kind === "action" ? entry.state : undefined;
      if (!availability || availability.available || !availability.requires)
        return fail(
          WIRE.error.conflict,
          "The control no longer has a requirement to satisfy; observe again.",
          { retryable: true },
        );
      await availability.requires.fulfill(kind, payload, actorFor(context));
      const again = await surface.act(
        { ...saved, expectedRev: surface.currentRev(), actor: actorFor(context) },
        options.run ? { run: options.run } : {},
      );
      if (again.status === WIRE.status.ok) return again.output;
      return fail(again.error.code, again.error.message, { retryable: again.error.retryable });
    },
    onResume: async ({ state, context, fail }) => {
      const saved = (state as unknown as { request: ActRequest }).request;
      const again = await surface.act(
        { ...saved, expectedRev: surface.currentRev(), actor: actorFor(context) },
        options.run ? { run: options.run } : {},
      );
      if (again.status === WIRE.status.ok) return again.output;
      return fail(again.error.code, again.error.message, { retryable: again.error.retryable });
    },
  });

  return [observe as unknown as RegisteredAction, act as unknown as RegisteredAction];
}
