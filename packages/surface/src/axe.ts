/**
 * @axe/surface/axe: the seam between Surface and AXE. Every entry on the surface becomes its own
 * AXE action, named `<ns>.<slug>` after the entry id, with the entry's `name` as its title, its
 * `effect` as its risk metadata, and its live `state` as its `availability`; beside them stand
 * `<ns>.observe` (read-only, the indexed table with an affordance per actionable row) and
 * `<ns>.ledger` (read-only: what has been done and refused). Refusals map onto the escalation
 * ladder: an unavailable control that declares `requires` becomes `needs_input`; one that declares
 * a `handoff` with a `url` becomes `needs_human` (a handoff without one is reported in
 * `error.details.handoff`); a stale revision is `conflict`. Every act, run or refused, is also
 * emitted as an action event (`surface.act`) on the server's `onActionEvent` sinks, with the actor
 * and the ledger `seq`. A collection that cannot load more has no action; it stays a row of
 * `<ns>.observe`.
 *
 * The set of actions follows the registry: `surfaceActions()` returns an `ActionProvider` for
 * `axe.addProvider()`, consulted whenever the manifest, `/axe/state`, or the MCP tool list is
 * rendered, so rows that register and unregister as the page changes appear and disappear on the
 * next request. The revision the agent observed travels as the request envelope's `expectedRev`
 * (protocol §21); pass `revision: surface.currentRev` to `createAXE` so the server checks it and
 * stamps `rev` on every envelope.
 *
 * Who may observe and act is the bridge's to declare ([S-AUTH-1] to [S-AUTH-6]): every action it
 * generates carries `auth: "user"` unless the options say otherwise, so a server whose
 * `auth.modes` has no `user` (including `createAXE`'s public default) refuses the provider on
 * its first request instead of serving the surface to anyone. A public surface is an explicit
 * `auth: "none"`. A server that hosts one surface per user or tenant passes a resolver instead of
 * a surface (`scopedSurfaces` builds one with a bounded cache) and a `template` for the action set.
 */
import { action, z } from "@axe/core";
import type {
  ActionProvider,
  AvailabilityInput,
  Identity,
  RegisteredAction,
  TenantInfo,
} from "@axe/core";
import type { AuthMode, AXEActionEventInput, JsonValue, Risk } from "@axe/core/types";
import * as WIRE from "@axe/core/vocabulary";
import type { ActRequest, ActResult, Entry, MaybePromise, Op, Surface } from "./index";

/** Action event name for every act that goes through the bridge. */
export const SURFACE_ACT_EVENT = "surface.act";

/**
 * Who is asking, as the AXE runtime established it: the input to a `SurfaceResolver` and to a
 * scope key. `identity` is the authenticated user (null when anonymous), `siteKey` what
 * `verifySiteKey` returned for a `site` action (null otherwise, and always null in an
 * availability check), `request` the request being served (null when the manifest is described
 * outside one).
 */
export interface SurfaceContext {
  identity: Identity | null;
  tenant: TenantInfo | null;
  siteKey: { id?: string; actions?: string[] } | null;
  request: Request | null;
}

/**
 * Returns the surface for the caller ([S-AUTH-4]), or null or undefined when the caller has none.
 * Called at most once per request; `scopedSurfaces` returns one with a bounded cache.
 */
export type SurfaceResolver = (context: SurfaceContext) => MaybePromise<Surface | null | undefined>;

export interface SurfaceActionsOptions {
  /**
   * Who may call the actions the bridge generates ([S-AUTH-1]): `user` (the default), `site`, or
   * `none`. Every mode used must be in the server's `auth.modes`, or the server refuses the
   * provider on its first request, so a public server cannot serve a surface by accident. `none`
   * makes the surface public over HTTP: pass it only for data you would publish on the open web.
   */
  auth?: AuthMode;
  /** The mode of `<ns>.observe` and `<ns>.ledger`, the read side ([S-AUTH-2]). Default: `auth`. */
  read?: AuthMode;
  /** The mode of one entry's action, overriding `auth` for it ([S-AUTH-2]); undefined keeps `auth`. */
  authFor?: (entry: Entry) => AuthMode | undefined;
  /**
   * With a resolver in place of a surface ([S-AUTH-4]): the surface whose entries define the
   * action set, the same for every caller, as the manifest shows it. Its entries are the
   * application's shape (names without anyone's data); each caller's own surface supplies the
   * state, the values, and the handlers. Required with a resolver, ignored with a surface.
   */
  template?: Surface;
  /**
   * Rewrites the `details` of each `surface.act` action event before it is emitted ([S-PRV-3]).
   * The bridge already leaves out text and values; use this to drop or mask ids that are
   * themselves personal (an entry id built from an email address, for example).
   */
  redactEvent?: (
    details: Record<string, JsonValue>,
    context: { action: string; entryId: string },
  ) => Record<string, JsonValue>;
  /** Action namespace. Default `surface`, giving `surface.observe`, `surface.ledger`, and `surface.<slug>` per entry. */
  namespace?: string;
  /** Actor recorded for acts that arrive through AXE. Default: the authenticated `onBehalfOf`, else `agent`. */
  actor?: (context: { onBehalfOf?: string }) => string;
  /** How the application runs handlers (for example React's `flushSync`). */
  run?: (fn: () => unknown) => unknown;
  /** Metadata declared for field entries, which carry no `effect` of their own. Default `risk: "medium"`, `reversible: false`. */
  fields?: { risk?: Exclude<Risk, "none">; reversible?: boolean };
  /**
   * Called when an entry cannot be published as an action (its text fails the honesty lint, for
   * example). The entry stays in `<ns>.observe`; it has no action of its own. Default: `console.warn`, once per entry.
   */
  onError?: (error: unknown, entryId: string) => void;
}

/** What `surfaceActions()` returns: an `ActionProvider` for `axe.addProvider()`, plus the name map. */
export interface SurfaceBridge extends ActionProvider {
  /** The AXE action name for an entry id, `<ns>.<slug>` ([S-AXE-7]). Stable for the life of the bridge. */
  actionNameFor(entryId: string): string;
  /** The entry id an action name resolves to, or undefined when the bridge never issued it. */
  entryIdFor(actionName: string): string | undefined;
  /** `<ns>.observe`, `<ns>.ledger`, then one action per registered entry, in registration order. */
  actions(): readonly RegisteredAction[];
  get(name: string): RegisteredAction | undefined;
  /** Fires when entries were registered or unregistered since the last revision move; a `bump` alone does not fire it. */
  onChange(listener: () => void): () => void;
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
  sensitive: z.literal(true).optional(),
  edit: z.record(z.string(), z.unknown()).optional(),
  total: z.number().nullable().optional(),
  loaded: z.number().nullable().optional(),
  filter: z.unknown().optional(),
  sort: z.unknown().optional(),
});

const LedgerEntrySchema = z.object({
  seq: z.number().int(),
  at: z.string(),
  op: z.string(),
  target: z.union([z.string(), z.number().int()]).nullable(),
  actor: z.string(),
  revBefore: z.number().int(),
  revAfter: z.number().int(),
  status: z.string(),
  text: z.string().optional(),
  textHash: z.string().optional(),
  changed: z.array(z.string()),
});

const ActOutputSchema = z.object({
  rev: z.number().int(),
  id: z.string(),
  actor: z.string(),
  changed: z.array(z.string()),
  seq: z.number().int(),
});

const MODES: readonly string[] = Object.values(WIRE.authMode);

/** An auth mode from the options, checked so a typo fails at construction rather than on a request. */
function checkMode(mode: AuthMode, option: string): AuthMode {
  if (!MODES.includes(mode))
    throw new Error(
      `surfaceActions: ${option} must be one of ${MODES.join(", ")}; received ${JSON.stringify(mode)}.`,
    );
  return mode;
}

/** Slugs the bridge keeps for its own actions; an entry whose id slugs to one of them gets a hash suffix. */
const RESERVED_SLUGS = new Set(["observe", "ledger", "act"]);

/**
 * The plain slug of an entry id ([S-AXE-7]): lowercase; every run of characters outside `a-z0-9`
 * becomes one hyphen; leading and trailing hyphens are dropped; a slug that is empty or starts with
 * a digit is prefixed with `e-` so it fits the action-name grammar ([P-ACT-1]).
 */
export function entrySlug(entryId: string): string {
  const s = entryId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!s) return "e";
  return /^[a-z]/.test(s) ? s : `e-${s}`;
}

/** FNV-1a (32-bit) of a string, base 36: the suffix that separates two ids with the same plain slug. */
function shortHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

function nameOf(e: Entry): string {
  return typeof e.name === "function" ? e.name() : e.name;
}

function opFor(e: Entry): Op {
  if (e.kind === "action") return e.role === "switch" ? WIRE.op.toggle : WIRE.op.click;
  if (e.kind === "field") return WIRE.op.typeText;
  return WIRE.op.scrollDown;
}

const MAX_DESCRIPTION = 400;

/** Keep a composed description inside [P-ACT-7]'s bounds whatever the entry name's length. */
function clampDescription(text: string): string {
  return text.length <= MAX_DESCRIPTION ? text : `${text.slice(0, MAX_DESCRIPTION - 1)}…`;
}

/** The revision as the surface counts it: numbers as they are, numeric strings converted, anything else left for the surface to refuse. */
function toSurfaceRev(rev: string | number | undefined): number | undefined {
  if (typeof rev === "string" && /^-?\d+$/.test(rev)) return Number(rev);
  return rev as number | undefined;
}

/**
 * Derive the AXE actions for a surface: `<ns>.observe`, `<ns>.ledger`, and one action per entry.
 * Hand the result to `axe.addProvider()`; the set follows the registry from then on.
 */
export function surfaceActions(
  source: Surface | SurfaceResolver,
  options: SurfaceActionsOptions = {},
): SurfaceBridge {
  const scoped = typeof source === "function";
  const template = scoped ? options.template : source;
  if (!template)
    throw new Error(
      "surfaceActions: a resolver needs `template`, the surface whose entries define the action set every caller sees.",
    );
  const surface: Surface = template;
  const writeMode = checkMode(options.auth ?? WIRE.authMode.user, "auth");
  const readMode = checkMode(options.read ?? writeMode, "read");
  const modeFor = (e: Entry): AuthMode => {
    const m = options.authFor?.(e);
    return m === undefined ? writeMode : checkMode(m, `authFor(${e.id})`);
  };
  // One resolution per request: the availability hooks of /axe/state and the handler of an act
  // share it, so a resolver that creates or loads a surface does it once.
  const resolved = new WeakMap<Request, Promise<Surface | null>>();
  const resolveFor = (ctx: SurfaceContext): Promise<Surface | null> => {
    if (!scoped) return Promise.resolve(source);
    const run = async () => (await (source as SurfaceResolver)(ctx)) ?? null;
    if (!ctx.request) return run();
    let p = resolved.get(ctx.request);
    if (!p) {
      p = run();
      resolved.set(ctx.request, p);
    }
    return p;
  };
  const ns = options.namespace ?? "surface";
  const observeName = `${ns}.observe`;
  const ledgerName = `${ns}.ledger`;
  const actorFor = options.actor ?? ((ctx) => ctx.onBehalfOf ?? "agent");
  const runOpts = options.run ? { run: options.run } : {};
  const fieldRisk = options.fields?.risk ?? WIRE.risk.medium;
  const fieldReversible = options.fields?.reversible ?? false;
  const onError =
    options.onError ??
    ((error: unknown, entryId: string) =>
      console.warn(
        `[axe/surface] entry "${entryId}" is not published as an action: ${error instanceof Error ? error.message : String(error)}`,
      ));

  // ---------------------------------------------------------------------------------------------
  // Names [S-AXE-7]: a sticky, bidirectional map. An id keeps its slug for the life of the bridge,
  // so an action name never comes to mean a different control, and a row that leaves and returns
  // gets its name back.
  // ---------------------------------------------------------------------------------------------
  const slugById = new Map<string, string>();
  const idBySlug = new Map<string, string>();
  const slugFor = (id: string): string => {
    const known = slugById.get(id);
    if (known) return known;
    const plain = entrySlug(id);
    let slug = plain;
    if (RESERVED_SLUGS.has(slug) || idBySlug.has(slug)) slug = `${plain}-${shortHash(id)}`;
    for (let n = 2; idBySlug.has(slug); n++) slug = `${plain}-${shortHash(id)}-${n}`;
    slugById.set(id, slug);
    idBySlug.set(slug, id);
    return slug;
  };
  const actionNameFor = (id: string): string => `${ns}.${slugFor(id)}`;
  const entryIdFor = (name: string): string | undefined =>
    name.startsWith(`${ns}.`) ? idBySlug.get(name.slice(ns.length + 1)) : undefined;

  /** Run one act and emit it as an action event, whether it ran or was refused [S-AXE-5]. */
  const perform = async (
    surface: Surface,
    request: ActRequest,
    emit: (event: AXEActionEventInput) => void,
  ): Promise<ActResult> => {
    const result = await surface.act(request, runOpts);
    const seq =
      result.status === WIRE.status.ok
        ? result.output.seq
        : (result.error.details?.[WIRE.field.seq] as number | undefined);
    const entry = seq === undefined ? undefined : surface.ledger({ since: seq - 1, limit: 1 })[0];
    const details: Record<string, JsonValue> = {
      [WIRE.field.op]: request.op,
      [WIRE.field.target]: entry?.target ?? request.target,
      [WIRE.field.revBefore]: entry?.revBefore ?? surface.currentRev(),
      [WIRE.field.revAfter]: entry?.revAfter ?? surface.currentRev(),
      [WIRE.field.changed]: entry?.changed ?? [],
    };
    if (seq !== undefined) details[WIRE.field.seq] = seq;
    // [S-PRV-3] The event names what happened, never the text or a value; `redactEvent` may
    // rewrite the rest.
    const entryId = String(request.target);
    emit({
      event: SURFACE_ACT_EVENT,
      status: result.status,
      errorCode: result.status === WIRE.status.error ? result.error.code : null,
      actor: entry?.actor ?? request.actor ?? null,
      details: options.redactEvent
        ? options.redactEvent(details, { action: actionNameFor(entryId), entryId })
        : details,
    });
    return result;
  };

  type Fail = Parameters<RegisteredAction["spec"]["handler"]>[0]["fail"];

  /** Re-act at the current revision after a continue or a resume [S-AXE-2]. */
  const again = async (
    surface: Surface,
    saved: ActRequest,
    context: { onBehalfOf?: string },
    emit: (event: AXEActionEventInput) => void,
    fail: Fail,
  ) => {
    const result = await perform(
      surface,
      { ...saved, expectedRev: surface.currentRev(), actor: actorFor(context) },
      emit,
    );
    if (result.status === WIRE.status.ok) return result.output;
    return fail(result.error.code, result.error.message, {
      retryable: result.error.retryable,
      details: (result.error.details ?? {}) as Record<string, JsonValue>,
    });
  };

  /**
   * The caller's surface in a handler, or the refusal when there is none [S-AUTH-4]: `unauthorized`
   * for a caller the runtime could not identify, `forbidden` for one it could. Neither says
   * whether any other caller has a surface.
   */
  const callerSurface = async (ctx: {
    identity: Identity | null;
    tenant: TenantInfo | null;
    siteKey: { id?: string; actions?: string[] } | null;
    request: Request;
    fail: Fail;
  }): Promise<{ surface: Surface } | { refused: ReturnType<Fail> }> => {
    const s = await resolveFor({
      identity: ctx.identity,
      tenant: ctx.tenant,
      siteKey: ctx.siteKey,
      request: ctx.request,
    });
    if (s) return { surface: s };
    return {
      refused:
        ctx.identity || ctx.siteKey
          ? ctx.fail(WIRE.error.forbidden, "This caller has no access to the application.")
          : ctx.fail(
              WIRE.error.unauthorized,
              "The application acts for an authenticated caller; send credentials.",
            ),
    };
  };

  // ---------------------------------------------------------------------------------------------
  // The read side: the table and the ledger, unchanged by churn.
  // ---------------------------------------------------------------------------------------------
  const ObserveOutput = z.object({
    protocol: z.string(),
    app: z.string(),
    rev: z.number().int(),
    at: z.string(),
    entries: z.array(ObservedEntrySchema),
    objects: z.record(z.string(), z.unknown()),
    frozen: z.object({ reason: z.string() }).optional(),
    ledgerSeq: z.number().int(),
  });
  const observe = action(observeName, {
    title: "Observe the application",
    description:
      "Returns the application's live table of controls under one revision: what can be done right now (indexed), what cannot and why, current field values, and the domain objects behind them. Each actionable row names its own action; pass the rev as expectedRev when calling it.",
    readOnly: true,
    risk: "none",
    auth: readMode,
    input: z.object({}).strict(),
    output: ObserveOutput,
    examples: [
      {
        input: {},
        output: {
          protocol: WIRE.protocol.version,
          app: "app",
          rev: 0,
          at: "2026-01-01T00:00:00.000Z",
          entries: [],
          objects: {},
          ledgerSeq: 0,
        },
      },
    ],
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
    handler: async (ctx) => {
      ensure();
      const caller = await callerSurface(ctx);
      if ("refused" in caller) return caller.refused;
      const view = caller.surface.observe();
      // Dynamic affordances [S-AXE-1]: every actionable row leads to its own action, with the
      // revision it was observed at as the envelope's expectedRev.
      const entries = view.entries.map((row) => {
        if (row.index === null) return row;
        const name = actionNameFor(row.id);
        if (!byName.has(name)) return row;
        return {
          ...row,
          _axe: {
            affordances: [
              { action: name, title: row.name, input: {}, expectedRev: view.rev, primary: true },
            ],
          },
        };
      });
      return { ...view, entries } as unknown as z.infer<typeof ObserveOutput>;
    },
  }) as unknown as RegisteredAction;

  const ledger = action(ledgerName, {
    title: "Read the ledger",
    description:
      "Returns what has been done through the application's surface, oldest first: every act that ran and every act that was refused, with who asked, the op and the target, the revisions before and after, and the outcome. Pass since (a seq you have already seen) to read only what happened after it, and limit to cap the count.",
    readOnly: true,
    risk: "none",
    auth: readMode,
    input: z
      .object({
        since: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Return entries with seq greater than this; observe gives ledgerSeq"),
        limit: z.number().int().min(1).optional().describe("At most this many entries"),
      })
      .strict(),
    output: z.object({
      ledgerSeq: z.number().int(),
      entries: z.array(LedgerEntrySchema),
    }),
    examples: [{ input: {}, output: { ledgerSeq: 0, entries: [] } }],
    display: {
      kind: "list",
      items: "/entries",
      item: {
        id: "/seq",
        title: "/target",
        subtitle: "/actor",
        attributes: [
          { label: "Seq", path: "/seq", format: "number" },
          { label: "Op", path: "/op", format: "text" },
          { label: "Status", path: "/status", format: "text" },
          { label: "Rev before", path: "/revBefore", format: "number" },
          { label: "Rev after", path: "/revAfter", format: "number" },
          { label: "At", path: "/at", format: "datetime" },
        ],
      },
      emptyMessage: "Nothing has been done through the surface yet.",
      disclaimer:
        "A refusal is an entry whose status is an error code and whose changed list is empty; nothing was applied.",
    },
    handler: async (ctx) => {
      const caller = await callerSurface(ctx);
      if ("refused" in caller) return caller.refused;
      const { input } = ctx;
      const query: { since?: number; limit?: number } = {};
      if (input.since !== undefined) query.since = input.since;
      if (input.limit !== undefined) query.limit = input.limit;
      return {
        ledgerSeq: caller.surface.observe().ledgerSeq,
        entries: caller.surface.ledger(query),
      };
    },
  }) as unknown as RegisteredAction;

  // ---------------------------------------------------------------------------------------------
  // One action per entry [S-AXE-1], [S-AXE-6].
  // ---------------------------------------------------------------------------------------------
  const describeAction = (e: Entry, title: string): string => {
    const on = e.object ? ` on ${e.object}` : "";
    const tail =
      "Returns the new revision and the changed entry ids. Refused with conflict when the application changed since expectedRev";
    if (e.kind === "action") {
      const f = e.effect;
      const extras = [
        f.confirm ? "needs confirm: true" : "",
        f.text ? `takes free text (${f.text})` : "",
      ].filter(Boolean);
      return clampDescription(
        `Runs the application's "${title}" control${on} through its own handler, as a click would; changes ${f.mutates}${extras.length ? `; ${extras.join("; ")}` : ""}. ${tail}, and unavailable with the application's reason when the control is disabled.`,
      );
    }
    if (e.kind === "field") {
      const max =
        !e.edit.readOnly && e.edit.maxLength ? `, at most ${e.edit.maxLength} characters` : "";
      return clampDescription(
        `Sets the application's "${title}" field${on} through its own setter, as typing would${max}. ${tail}, and unavailable with the reason when the field is read only.`,
      );
    }
    return clampDescription(
      `Asks the application's "${title}" collection${on} to load more, as scrolling would. ${tail}, and unavailable while the application is busy.`,
    );
  };

  // The input schema describes the shape: `text` is a string, `confirm` a boolean. The surface's
  // own checks ([S-ACT-3]: maxLength, the field's schema, a required confirm) run in the surface,
  // so a refusal is ledgered and emitted [S-LED-1]; here they would be refused before it.
  const inputFor = (e: Entry): z.ZodType => {
    if (e.kind === "action") {
      const shape: Record<string, z.ZodType> = {};
      if (e.effect.confirm)
        shape[WIRE.field.confirm] = z
          .boolean()
          .optional()
          .describe(
            "Must be true: the application requires explicit confirmation for this control",
          );
      if (e.effect.text) shape[WIRE.field.text] = z.string().optional().describe(e.effect.text);
      return z.object(shape).strict();
    }
    if (e.kind === "field") {
      const ed = e.edit;
      const bound = !ed.readOnly && ed.maxLength ? `; at most ${ed.maxLength} characters` : "";
      return z
        .object({
          [WIRE.field.text]: z.string().describe(`The new value, as it would be typed${bound}`),
        })
        .strict();
    }
    return z.object({}).strict();
  };

  const buildEntryAction = (e: Entry): RegisteredAction => {
    const name = actionNameFor(e.id);
    const title = nameOf(e);
    const op = opFor(e);
    const risk: Risk =
      e.kind === "action"
        ? (e.effect.risk ?? WIRE.risk.medium)
        : e.kind === "field"
          ? fieldRisk
          : WIRE.risk.low;
    const idempotent =
      e.kind === "action" ? (e.effect.idempotent ?? false) : e.kind === "field" ? true : false;
    const reversible =
      e.kind === "action"
        ? (e.effect.reversible ?? e.effect.undoable ?? false)
        : e.kind === "field"
          ? fieldReversible
          : false;
    // Only a handoff with a page to come back from can become needs_human [S-AXE-2].
    const declaredHandoff =
      e.kind === "action" && e.state && !e.state.available && e.state.handoff?.url
        ? e.state.handoff
        : undefined;
    const mode = modeFor(e);
    // [S-AUTH-5] The availability hook serves the manifest (always anonymous) and /axe/state (per
    // caller). A protected entry is never read for a caller the runtime has not identified: the
    // report is the protocol's default for an action without one, `{ available: true }`, and
    // `auth` says who may call it. Reading the surface there would publish its state to anyone.
    const availability = async (ctx: {
      identity: Identity | null;
      tenant: TenantInfo | null;
      request: Request | null;
    }): Promise<AvailabilityInput> => {
      if (mode !== WIRE.authMode.none && !ctx.identity) return { available: true };
      const s = await resolveFor({ ...ctx, siteKey: null });
      if (!s) return { available: true };
      const a = s.availability(e.id);
      if (!a) return { available: false, reason: "the control is no longer on the page" };
      if (a.available) return { available: true };
      const out: AvailabilityInput = { available: false, reason: a.reason };
      if (a.requires) out.requires = a.requires;
      if (a.handoff) out.handoff = a.handoff;
      return out;
    };
    const built = action(name, {
      title,
      description: describeAction(e, title),
      risk,
      idempotent,
      reversible,
      auth: mode,
      input: inputFor(e),
      output: ActOutputSchema,
      ...(declaredHandoff ? { humanHandoff: { reasons: [declaredHandoff.reason] } } : {}),
      availability,
      handler: async (ctx) => {
        const { input, context, emit, expectedRev, needsInput, handoff, fail } = ctx;
        const caller = await callerSurface(ctx);
        if ("refused" in caller) return caller.refused;
        const surface = caller.surface;
        const args = input as { text?: string; confirm?: true };
        const request: ActRequest = {
          op,
          target: e.id,
          expectedRev: toSurfaceRev(expectedRev) as number,
          actor: actorFor(context),
        };
        if (args.text !== undefined) request.text = args.text;
        if (args.confirm !== undefined) request.confirm = args.confirm;
        const result = await perform(surface, request, emit);
        if (result.status === WIRE.status.ok) return result.output;
        const details = (result.error.details ?? {}) as Record<string, JsonValue>;
        // Climb the ladder [S-AXE-2]: the control declared kinds that would make it available, or a
        // step a human takes at a page. A freeze is neither, and a handoff without a url has no
        // page to resume from: both stay `error` with the details the surface reported.
        const live = surface.get(e.id);
        const state = live?.kind === "action" ? live.state : undefined;
        if (
          result.error.code === WIRE.error.unavailable &&
          state &&
          !state.available &&
          !details[WIRE.field.frozen]
        ) {
          const saved = { request: request as unknown as JsonValue };
          const page = state.handoff?.url
            ? { ...state.handoff, url: state.handoff.url }
            : undefined;
          if (state.requires) {
            return needsInput({
              reason: "unavailable",
              message: `${result.error.message} Provide one of the following to continue.`,
              accepts: state.requires.accepts,
              state: saved,
              ...(page ? { fallback: handoff({ ...page, state: saved }) } : {}),
            });
          }
          if (page) return handoff({ ...page, state: saved });
        }
        return fail(result.error.code, result.error.message, {
          retryable: result.error.retryable,
          details,
        });
      },
      onContinue: async (ctx) => {
        const { kind, payload, state, context, emit, fail } = ctx;
        const caller = await callerSurface(ctx);
        if ("refused" in caller) return caller.refused;
        const surface = caller.surface;
        const saved = (state as unknown as { request: ActRequest }).request;
        const live = surface.get(e.id);
        const availability = live?.kind === "action" ? live.state : undefined;
        if (!availability || availability.available || !availability.requires)
          return fail(
            WIRE.error.conflict,
            "The control no longer has a requirement to satisfy; observe again.",
            { retryable: true },
          );
        await availability.requires.fulfill(kind, payload, actorFor(context));
        return again(surface, saved, context, emit, fail);
      },
      onResume: async (ctx) => {
        const { state, context, emit, fail } = ctx;
        const caller = await callerSurface(ctx);
        if ("refused" in caller) return caller.refused;
        const saved = (state as unknown as { request: ActRequest }).request;
        return again(caller.surface, saved, context, emit, fail);
      },
    });
    return built as unknown as RegisteredAction;
  };

  // The set follows the registry: rebuilt when `registryVersion` moved, reused otherwise; within
  // a rebuild, an entry object that was already published keeps its action.
  const cache = new WeakMap<Entry, RegisteredAction>();
  const failed = new WeakSet<Entry>();
  let builtVersion = -1;
  let built: RegisteredAction[] = [];
  let byName = new Map<string, RegisteredAction>();
  const ensure = (): void => {
    const version = surface.registryVersion();
    if (version === builtVersion) return;
    const list: RegisteredAction[] = [observe, ledger];
    const map = new Map<string, RegisteredAction>([
      [observeName, observe],
      [ledgerName, ledger],
    ]);
    for (const e of surface.entries()) {
      // [S-AXE-6] A collection that cannot load more has nothing to invoke; it stays a row of observe.
      if (e.kind === "collection" && typeof e.more !== "function") continue;
      let a = cache.get(e);
      if (!a) {
        if (failed.has(e)) continue;
        try {
          a = buildEntryAction(e);
        } catch (error) {
          failed.add(e);
          onError(error, e.id);
          continue;
        }
        cache.set(e, a);
      }
      list.push(a);
      map.set(a.name, a);
    }
    built = list;
    byName = map;
    builtVersion = version;
  };

  return {
    actionNameFor,
    entryIdFor,
    actions() {
      ensure();
      return built;
    },
    get(name) {
      ensure();
      return byName.get(name);
    },
    onChange(listener) {
      let last = surface.registryVersion();
      return surface.onChange(() => {
        const version = surface.registryVersion();
        if (version === last) return;
        last = version;
        listener();
      });
    },
  };
}

export interface ScopedSurfacesOptions {
  /** Create the surface for a scope the first time a caller in it arrives, or again after eviction. */
  create: (key: string, context: SurfaceContext) => Surface;
  /**
   * The scope a caller belongs to, or null for a caller with none (then the bridge refuses it).
   * Default: the tenant id and the principal (the user's `onBehalfOf`, else `site:<key id>`), so
   * two users, two partners, or one user on two tenants never share a surface.
   */
  key?: (context: SurfaceContext) => string | null;
  /** At most this many surfaces are kept; the least recently used is evicted first. Default 1000. */
  max?: number;
  /** A surface unused for this long is evicted. Default 30 minutes. */
  idleMs?: number;
  /** Clock, in milliseconds; injectable for tests. */
  now?: () => number;
  /** Called with each evicted surface, for example to persist what it holds. */
  onEvict?: (key: string, surface: Surface) => void;
}

/** What `scopedSurfaces()` returns: the resolver for `surfaceActions`, plus the cache it keeps. */
export interface ScopedSurfaces {
  resolve: SurfaceResolver;
  /** The scope key for a caller, as `resolve` computes it. */
  keyFor(context: SurfaceContext): string | null;
  /** The live surface for a key, without creating one or refreshing its lifetime. */
  get(key: string): Surface | undefined;
  /** Evict a scope now (a user signed out, a tenant was removed). */
  delete(key: string): boolean;
  /** How many surfaces are live. */
  size(): number;
}

/** The default scope key [S-AUTH-4]: tenant and principal; null when there is no principal. */
function defaultScopeKey(ctx: SurfaceContext): string | null {
  const principal = ctx.identity?.onBehalfOf ?? (ctx.siteKey?.id ? `site:${ctx.siteKey.id}` : null);
  return principal === null ? null : JSON.stringify([ctx.tenant?.id ?? null, principal]);
}

/**
 * One surface per scope, created on first use and evicted when idle or when the cache is full
 * ([S-AUTH-4]). Pass `resolve` to `surfaceActions` with a `template`.
 */
export function scopedSurfaces(options: ScopedSurfacesOptions): ScopedSurfaces {
  const keyFor = options.key ?? defaultScopeKey;
  const max = Math.max(1, options.max ?? 1000);
  const idleMs = options.idleMs ?? 30 * 60 * 1000;
  const now = options.now ?? (() => Date.now());
  // Insertion order is recency order: a hit is deleted and set again.
  const live = new Map<string, { surface: Surface; at: number }>();
  const evict = (key: string): boolean => {
    const held = live.get(key);
    if (!held) return false;
    live.delete(key);
    options.onEvict?.(key, held.surface);
    return true;
  };
  const sweep = (t: number): void => {
    for (const [key, held] of live) if (t - held.at > idleMs) evict(key);
  };
  return {
    keyFor,
    resolve(context) {
      const key = keyFor(context);
      if (key === null) return null;
      const t = now();
      sweep(t);
      let held = live.get(key);
      if (held) live.delete(key);
      else held = { surface: options.create(key, context), at: t };
      held.at = t;
      live.set(key, held);
      while (live.size > max) evict(live.keys().next().value as string);
      return held.surface;
    },
    get: (key) => live.get(key)?.surface,
    delete: evict,
    size: () => live.size,
  };
}
