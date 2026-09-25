/**
 * @axe/surface/axe: the seam between Surface and AXE. Two granularities, served by two functions
 * over the same machinery ([S-AXE-1], [S-AXE-10]):
 *
 * - `surfaceActions` (per control): every entry on the surface becomes its own AXE action, named
 *   `<ns>.<slug>` after the entry id, with the entry's `name` as its title, its `effect` as its
 *   risk metadata, and its live `state` as its `availability`.
 * - `domainActions` (per domain action): the application declares a small, fixed set of
 *   parameterized actions (`<ns>.set-field`, `<ns>.run-control`, or its own), each covering the
 *   entries it selects and taking the entry id as input. The tool list does not change as rows come
 *   and go; per-entry availability is read from `<ns>.observe` and reported by the act.
 *
 * Beside them stand `<ns>.observe` (read-only, the indexed table with an affordance per actionable
 * row, filtered and paged) and `<ns>.ledger` (read-only: what has been done and refused). Refusals
 * map onto the escalation ladder: an unavailable control that declares `requires` becomes
 * `needs_input`; one that declares a `handoff` with a `url` becomes `needs_human` (a handoff
 * without one is reported in `error.details.handoff`); a stale revision is `conflict`. Every act,
 * run or refused, is also emitted as an action event (`surface.act`) on the server's
 * `onActionEvent` sinks, with the actor and the ledger `seq`. The revision, the ledger, the
 * ladder, and the events are the same in both granularities.
 *
 * The set of actions follows the registry: both functions return an `ActionProvider` for
 * `axe.addProvider()`, consulted whenever the manifest, `/axe/state`, or the MCP tool list is
 * rendered. The revision the agent observed travels as the request envelope's `expectedRev`
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
import { action, lintAgentText, z } from "@axe/core";
import type {
  ActionProvider,
  AvailabilityInput,
  Identity,
  ProviderResultContext,
  RegisteredAction,
  TenantInfo,
} from "@axe/core";
import type { AuthMode, AXEActionEventInput, JsonValue, Result, Risk } from "@axe/core/types";
import * as WIRE from "@axe/core/vocabulary";
import { READ_LIMITS, WAIT_LIMITS, checkCondition, contentOf } from "./auto-content";
import type { PageRead, WaitCondition } from "./auto-content";
import { formatRead } from "./auto-read";
import { contentDomains } from "./auto-domains";
import type {
  ActRequest,
  ActResult,
  Entry,
  EntryKind,
  MaybePromise,
  Observation,
  ObservedEntry,
  Op,
  RecordRequest,
  Surface,
} from "./index";

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

/**
 * Page size of `<ns>.observe` ([S-OBS-5]). `pageSize` is the number of rows returned when the
 * call gives no `limit`; `maxPageSize` is the largest `limit` accepted. Both are published in
 * the action's `pagination`.
 */
export interface ObservePageOptions {
  pageSize?: number;
  maxPageSize?: number;
}

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
  /**
   * Page size of `<ns>.observe` ([S-OBS-5]). Default for `surfaceActions`: 1000 rows per page
   * and at most 1000, so a surface of up to 1000 rows is one page as before; for
   * `domainActions`: 50 rows per page and at most 200.
   */
  observe?: ObservePageOptions;
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
  /**
   * Called by the server for every result of the bridge's actions ([S-AXE-14]); `addProvider`
   * wires it, so there is nothing to pass to `createAXE`. A refusal the runtime made before an
   * entry action's handler ran (a stale `expectedRev` under [S-AXE-4], an input that fails the
   * schema, a missing `idempotencyKey`) is recorded in the caller's ledger with `source: "server"`,
   * the entry id and op the act would have had, and the actor of [S-AXE-3], when the runtime
   * admitted the caller under the action's `auth` mode. Everything else is left alone: an act the
   * surface saw is already in the ledger, and an unidentified caller of a protected action writes
   * nothing.
   */
  onResult(ctx: ProviderResultContext, result: Result): Promise<void>;
}

/**
 * One parameterized action of `domainActions` ([S-AXE-10]): a stable name, the application's own
 * title and description, the entries it acts on, and risk metadata that holds for every one of
 * them. The action takes `{ entryId, text?, confirm? }` and runs the entry's own op through
 * `surface.act`, exactly as the entry's per-control action would.
 */
export interface DomainActionSpec {
  /** The name under the namespace: `set-demand` is served as `<ns>.set-demand`. Lowercase letters, digits, hyphens. */
  name: string;
  /** What the action does, in the application's words ("Set a month's demand"). */
  title: string;
  /** Composed into the action's description, before the bridge's sentence on `entryId` and refusals. */
  description: string;
  /**
   * Which entries the action acts on. Asked once per registered entry object; an entry that more
   * than one spec covers belongs to the first. Select by `kind`, by `object` or id prefix, or by
   * `effect.mutates`: whatever makes a group the application would name.
   */
  covers: (entry: Entry) => boolean;
  /**
   * The highest risk of any entry the action acts on. An entry whose own risk is higher is not
   * covered: it is reported through `onError` and keeps its row in `<ns>.observe` without an
   * affordance, so the published risk is never lower than a control's own ([P-HON-7]).
   */
  risk: Exclude<Risk, "none">;
  /** True only when every covered entry is idempotent; an entry that is not is left uncovered. Default false. */
  idempotent?: boolean;
  /** True only when every covered entry is reversible; an entry that is not is left uncovered. Default false. */
  reversible?: boolean;
  /** Auth mode of this action; default the bridge's `auth`. */
  auth?: AuthMode;
  /**
   * The handoff reasons a covered control may return as `needs_human` (protocol `humanHandoff`).
   * The per-control action derives it from the entry; a parameterized action cannot know its
   * entries in advance, so the application declares it.
   */
  humanHandoff?: { reasons: string[] };
  /**
   * The `availability` reason when no entry the action covers can be acted on now (and the
   * surface is not frozen, when the freeze's reason is reported instead). Default: "nothing on
   * the page can be changed this way right now".
   */
  idleReason?: string;
}

/**
 * A read-only action over the page's content rather than an entry ([S-AUTO-16]): `read` returns
 * what the page shows the person, `wait` resolves when a condition on the page holds. It needs a
 * surface that carries a page-content reader (`autoSurface` attaches one; a relay mirror forwards
 * to the page's); on any other surface it is unavailable. It never acts and never moves the
 * revision.
 */
export interface ContentActionSpec {
  /** The name under the namespace: `read` is served as `<ns>.read`. */
  name: string;
  content: "read" | "wait";
  title: string;
  description: string;
  /** Auth mode; default the bridge's read mode. */
  auth?: AuthMode;
}

/** One action of `domainActions`: over entries (`DomainActionSpec`) or over the page's content. */
export type DomainSpec = DomainActionSpec | ContentActionSpec;

export interface DomainActionsOptions extends Omit<SurfaceActionsOptions, "authFor"> {
  /**
   * The parameterized actions, in the order they are published. Fixed for the life of the
   * bridge: the manifest and the MCP tool list do not change as rows register and unregister.
   * Default: `set-field` (every field), `run-control` (every action entry, declared `risk: "high"`,
   * not reversible, not idempotent, so every control fits), and `load-more` (every collection).
   */
  domains?: DomainSpec[];
  /**
   * Also publish the page-content actions `read` and `wait` (`contentDomains()`), when `domains`
   * does not already name them. Default false; `autoDomains()` includes them itself.
   */
  content?: boolean;
}

/** What `domainActions()` returns: an `ActionProvider` for `axe.addProvider()`, plus the coverage map. */
export interface DomainBridge extends ActionProvider {
  /** The action that acts on this entry now, or undefined when no spec covers it (or the id is unknown). */
  actionFor(entryId: string): string | undefined;
  /** The ids of the registered entries an action covers, in registration order. */
  covered(actionName: string): string[];
  /** `<ns>.observe`, `<ns>.ledger`, then the domain actions in declaration order. */
  actions(): readonly RegisteredAction[];
  get(name: string): RegisteredAction | undefined;
  /** The set never changes shape; the listener is accepted and never called. */
  onChange(listener: () => void): () => void;
  /**
   * As `SurfaceBridge.onResult` ([S-AXE-14]): records a refusal the runtime made before a domain
   * action's handler ran, with the input's `entryId` as the target when it has one (else the
   * action name) and the op that entry's own action would use.
   */
  onResult(ctx: ProviderResultContext, result: Result): Promise<void>;
}

/** The filters and paging `<ns>.observe` accepts ([S-OBS-5]). Every member is optional. */
export interface ObserveQuery {
  /** Only rows whose `object` is exactly this. */
  object?: string;
  kind?: EntryKind;
  /** `true`: only rows that can be acted on now (those with an `index`); `false`: only rows that cannot. */
  available?: boolean;
  /** Case-insensitive substring of the row's `name`, `id`, or `object`. */
  query?: string;
  /** Rows per page, at most the bridge's `maxPageSize`. */
  limit?: number;
  /** The `nextCursor` of the previous page, with the same filters. */
  cursor?: string;
}

const ObservedEntrySchema = z.object({
  index: z.number().int().nullable(),
  id: z.string(),
  kind: z.enum(["action", "field", "collection"]),
  role: z.string(),
  name: z.string(),
  object: z.string().nullable(),
  rev: z.number().int(),
  tier: z.enum(["derived", "annotated"]).optional(),
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
  ignoredRev: z.number().int().optional(),
  source: z.enum(["application", "server"]).optional(),
  expectedRev: z.number().int().optional(),
});

const ActOutputSchema = z.object({
  rev: z.number().int(),
  id: z.string(),
  actor: z.string(),
  changed: z.array(z.string()),
  seq: z.number().int(),
  notices: z.array(z.string()).optional(),
  navigated: z.boolean().optional(),
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

const RISK_ORDER: Record<Risk, number> = { none: 0, low: 1, medium: 2, high: 3 };

/** The risk metadata an entry's own action would declare ([S-AXE-6]). */
interface EntryMeta {
  risk: Risk;
  idempotent: boolean;
  reversible: boolean;
}

// -----------------------------------------------------------------------------------------------
// Observation filters and pages [S-OBS-5].
// -----------------------------------------------------------------------------------------------

const CURSOR_PREFIX = "c1";

function base64url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unbase64url(text: string): string {
  const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** The filters that define a result set; a cursor is valid only with the same ones. */
function filterKey(q: ObserveQuery): string {
  return shortHash(
    JSON.stringify([q.object ?? null, q.kind ?? null, q.available ?? null, q.query ?? null]),
  );
}

function matches(row: ObservedEntry, q: ObserveQuery): boolean {
  if (q.object !== undefined && row.object !== q.object) return false;
  if (q.kind !== undefined && row.kind !== q.kind) return false;
  if (q.available !== undefined && (row.index !== null) !== q.available) return false;
  if (q.query !== undefined && q.query !== "") {
    const needle = q.query.toLowerCase();
    const hay = `${row.name}\u0000${row.id}\u0000${row.object ?? ""}`.toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}

type PageResult =
  { rows: ObservedEntry[]; total: number; nextCursor?: string } | { invalid: string };

/**
 * One page of an observation: rows in registration order that match the filters, from the row
 * after the cursor's, at most `limit`. A cursor names the last row it returned and the row that
 * followed it (by id), and the position after the page. The next page starts after the last row;
 * if that row has left the table, at the row that followed it; if both have left, at the
 * position.
 */
function pageOf(view: Observation, q: ObserveQuery, limit: number): PageResult {
  const key = filterKey(q);
  const rows = view.entries.filter((r) => matches(r, q));
  let start = 0;
  if (q.cursor !== undefined) {
    const parts = q.cursor.split(".");
    if (parts.length !== 5 || parts[0] !== CURSOR_PREFIX || !/^\d+$/.test(parts[1]!))
      return { invalid: "is not a cursor this action returned" };
    if (parts[2] !== key) return { invalid: "was returned for different filters" };
    let last: string;
    let next: string;
    try {
      last = unbase64url(parts[3]!);
      next = unbase64url(parts[4]!);
    } catch {
      return { invalid: "is not a cursor this action returned" };
    }
    const at = rows.findIndex((r) => r.id === last);
    const follow = at >= 0 ? -1 : rows.findIndex((r) => r.id === next);
    start = at >= 0 ? at + 1 : follow >= 0 ? follow : Math.min(Number(parts[1]), rows.length);
  }
  const page = rows.slice(start, start + limit);
  const out: { rows: ObservedEntry[]; total: number; nextCursor?: string } = {
    rows: page,
    total: rows.length,
  };
  const end = start + page.length;
  if (end < rows.length && page.length > 0)
    out.nextCursor = [
      CURSOR_PREFIX,
      String(end),
      key,
      base64url(page[page.length - 1]!.id),
      base64url(rows[end]!.id),
    ].join(".");
  return out;
}

type Fail = Parameters<RegisteredAction["spec"]["handler"]>[0]["fail"];
type HandlerCtx = Parameters<RegisteredAction["spec"]["handler"]>[0];

/**
 * What both granularities share: caller resolution, the act with its action event, the ladder,
 * the re-act after a continue or a resume, and the read side (`<ns>.observe`, `<ns>.ledger`).
 */
function bridgeCore(
  source: Surface | SurfaceResolver,
  options: SurfaceActionsOptions,
  pageDefaults: { pageSize: number; maxPageSize: number },
) {
  const scoped = typeof source === "function";
  const template = scoped ? options.template : source;
  if (!template)
    throw new Error(
      "surfaceActions: a resolver needs `template`, the surface whose entries define the action set every caller sees.",
    );
  const surface: Surface = template;
  const writeMode = checkMode(options.auth ?? WIRE.authMode.user, "auth");
  const readMode = checkMode(options.read ?? writeMode, "read");
  const maxPageSize = Math.max(1, options.observe?.maxPageSize ?? pageDefaults.maxPageSize);
  const pageSize = Math.min(
    maxPageSize,
    Math.max(1, options.observe?.pageSize ?? pageDefaults.pageSize),
  );
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

  const metaOf = (e: Entry): EntryMeta => ({
    risk:
      e.kind === "action"
        ? (e.effect.risk ?? WIRE.risk.medium)
        : e.kind === "field"
          ? fieldRisk
          : WIRE.risk.low,
    idempotent:
      e.kind === "action" ? (e.effect.idempotent ?? false) : e.kind === "field" ? true : false,
    reversible:
      e.kind === "action"
        ? (e.effect.reversible ?? e.effect.undoable ?? false)
        : e.kind === "field"
          ? fieldReversible
          : false,
  });

  /** Run one act and emit it as an action event, whether it ran or was refused [S-AXE-5]. */
  const perform = async (
    surface: Surface,
    request: ActRequest,
    actionName: string,
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
        ? options.redactEvent(details, { action: actionName, entryId })
        : details,
    });
    return result;
  };

  /** Re-act at the current revision after a continue or a resume [S-AXE-2]. */
  const again = async (
    surface: Surface,
    saved: ActRequest,
    actionName: string,
    context: { onBehalfOf?: string },
    emit: (event: AXEActionEventInput) => void,
    fail: Fail,
  ) => {
    const result = await perform(
      surface,
      { ...saved, expectedRev: surface.currentRev(), actor: actorFor(context) },
      actionName,
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

  /**
   * Run one act for an action and climb the ladder on refusal [S-AXE-2]. Shared by both
   * granularities, so a parameterized action reports per-entry availability, `requires`, and a
   * handoff exactly as the entry's own action would.
   */
  const actAndClimb = async (
    surface: Surface,
    request: ActRequest,
    actionName: string,
    ctx: HandlerCtx,
  ) => {
    const { emit, needsInput, handoff, fail } = ctx;
    const result = await perform(surface, request, actionName, emit);
    if (result.status === WIRE.status.ok) return result.output;
    const details = (result.error.details ?? {}) as Record<string, JsonValue>;
    // Climb the ladder [S-AXE-2]: the control declared kinds that would make it available, or a
    // step a human takes at a page. A freeze is neither, and a handoff without a url has no
    // page to resume from: both stay `error` with the details the surface reported.
    const live = typeof request.target === "string" ? surface.get(request.target) : undefined;
    const state = live?.kind === "action" ? live.state : undefined;
    if (
      result.error.code === WIRE.error.unavailable &&
      state &&
      !state.available &&
      !details[WIRE.field.frozen]
    ) {
      const saved = { request: request as unknown as JsonValue };
      const page = state.handoff?.url ? { ...state.handoff, url: state.handoff.url } : undefined;
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
  };

  type ContinueCtx = Parameters<NonNullable<RegisteredAction["spec"]["onContinue"]>>[0];
  type ResumeCtx = Parameters<NonNullable<RegisteredAction["spec"]["onResume"]>>[0];

  /** `/axe/continue`: the application's `fulfill` runs, then the saved act at the current revision. */
  const continueAct = async (actionName: string, ctx: ContinueCtx) => {
    const { kind, payload, state, context, emit, fail } = ctx;
    const caller = await callerSurface(ctx);
    if ("refused" in caller) return caller.refused;
    const surface = caller.surface;
    const saved = (state as unknown as { request: ActRequest }).request;
    const live = typeof saved.target === "string" ? surface.get(saved.target) : undefined;
    const availability = live?.kind === "action" ? live.state : undefined;
    if (!availability || availability.available || !availability.requires)
      return fail(
        WIRE.error.conflict,
        "The control no longer has a requirement to satisfy; observe again.",
        { retryable: true },
      );
    await availability.requires.fulfill(kind, payload, actorFor(context));
    return again(surface, saved, actionName, context, emit, fail);
  };

  /** `/axe/resume`: the saved act at the current revision. */
  const resumeAct = async (actionName: string, ctx: ResumeCtx) => {
    const { state, context, emit, fail } = ctx;
    const caller = await callerSurface(ctx);
    if ("refused" in caller) return caller.refused;
    const saved = (state as unknown as { request: ActRequest }).request;
    return again(caller.surface, saved, actionName, context, emit, fail);
  };

  /**
   * The provider's `onResult` ([S-AXE-14]): a refusal the runtime made before one of the bridge's
   * acting handlers ran is recorded on the caller's surface, so the ledger has no gap where an
   * agent was refused. `describe` says, for an action name, whether it is one of this bridge's
   * acting actions and under which `auth` mode, and the target and op its act would have had.
   * Never double counted: a result a handler produced (`handled`), one carrying the `seq` of a
   * ledger entry, and a second call for the same request are all left alone.
   */
  const recorded = new WeakSet<Request>();
  const onResultFor =
    (
      modeOf: (name: string) => AuthMode | undefined,
      targetOf: (
        name: string,
        input: JsonValue | undefined,
        surface: Surface,
      ) => { target: string; op: Op },
    ) =>
    async (ctx: ProviderResultContext, result: Result): Promise<void> => {
      if (ctx.endpoint !== "action" || ctx.handled !== false) return;
      if (result.status !== WIRE.status.error) return;
      if (result.error.details?.[WIRE.field.seq] !== undefined) return;
      if (recorded.has(ctx.request)) return;
      const mode = modeOf(ctx.action);
      if (mode === undefined) return;
      // Only a caller the runtime admitted under the action's mode reaches the surface, so only
      // such a caller writes to its ledger [S-AUTH-3].
      const admitted =
        mode === WIRE.authMode.none ||
        (mode === WIRE.authMode.user && !!ctx.identity) ||
        (mode === WIRE.authMode.site && !!ctx.siteKey);
      if (!admitted) return;
      const s = await resolveFor({
        identity: ctx.identity,
        tenant: ctx.tenant,
        siteKey: ctx.siteKey,
        request: ctx.request,
      });
      if (!s) return;
      recorded.add(ctx.request);
      const { target, op } = targetOf(ctx.action, ctx.input, s);
      const change: RecordRequest = {
        op,
        target,
        // [S-AXE-3] as for an act: the authenticated `onBehalfOf` (the runtime may refuse before it
        // copies the identity into the context), else `agent`.
        actor: actorFor(
          ctx.identity ? { ...ctx.context, onBehalfOf: ctx.identity.onBehalfOf } : ctx.context,
        ),
        status: result.error.code,
        changed: [],
        source: "server",
      };
      const input = ctx.input;
      if (input && typeof input === "object" && !Array.isArray(input)) {
        const text = (input as Record<string, JsonValue>)[WIRE.field.text];
        if (typeof text === "string") change.text = text;
      }
      const presented = toSurfaceRev(ctx.expectedRev);
      if (typeof presented === "number" && Number.isFinite(presented))
        change.expectedRev = presented;
      s.record(change);
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
    total: z.number().int().describe("Rows that match the filters, on every page"),
    [WIRE.field.nextCursor]: z
      .string()
      .optional()
      .describe("Present when more rows match; pass it as cursor with the same filters"),
  });
  const ObserveInput = z
    .object({
      object: z.string().optional().describe("Only rows whose object is exactly this"),
      kind: z.enum(["action", "field", "collection"]).optional().describe("Only rows of this kind"),
      available: z
        .boolean()
        .optional()
        .describe("true: only rows that can be acted on now; false: only rows that cannot"),
      query: z
        .string()
        .max(200)
        .optional()
        .describe("Case-insensitive text found in the row's name, id, or object"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(maxPageSize)
        .optional()
        .describe(`Rows per page; default ${pageSize}, at most ${maxPageSize}`),
      cursor: z
        .string()
        .max(1024)
        .optional()
        .describe("nextCursor from the previous page, with the same filters"),
    })
    .strict();

  /**
   * `<ns>.observe`. `affordanceFor(row, surface)` names the action and bound input that act on an
   * actionable row in this granularity, or undefined when no action does.
   */
  const buildObserve = (
    ensure: () => void,
    affordanceFor: (
      row: ObservedEntry,
      surface: Surface,
    ) => { action: string; input: Record<string, JsonValue> } | undefined,
    rowsSentence: string,
  ): RegisteredAction =>
    action(observeName, {
      title: "Observe the application",
      description: `Returns the application's live controls under one revision: what can be done now (indexed), what cannot and why, field values, and the domain objects behind them. ${rowsSentence} Pass the rev as expectedRev when acting. Filter by object, kind, available, or query; page with limit and cursor.`,
      readOnly: true,
      risk: "none",
      auth: readMode,
      input: ObserveInput,
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
            total: 0,
          },
        },
      ],
      pagination: {
        cursorIn: "/cursor",
        cursorOut: "/nextCursor",
        pageSize: { default: pageSize, max: maxPageSize },
      },
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
        const q = ctx.input as ObserveQuery;
        const view = caller.surface.observe();
        const page = pageOf(view, q, q.limit ?? pageSize);
        if ("invalid" in page)
          return ctx.fail(WIRE.error.invalidInput, `cursor ${page.invalid}.`, {
            details: { issues: [{ path: "/cursor", message: page.invalid }] },
          });
        // Dynamic affordances [S-AXE-1], [S-AXE-10]: every actionable row leads to the action that
        // acts on it, with the revision it was observed at as the envelope's expectedRev.
        const entries = page.rows.map((row) => {
          if (row.index === null) return row;
          const target = affordanceFor(row, caller.surface);
          if (!target) return row;
          return {
            ...row,
            _axe: {
              affordances: [
                {
                  action: target.action,
                  title: row.name,
                  input: target.input,
                  expectedRev: view.rev,
                  primary: true,
                },
              ],
            },
          };
        });
        const out: Record<string, unknown> = { ...view, entries, total: page.total };
        if (page.nextCursor !== undefined) out[WIRE.field.nextCursor] = page.nextCursor;
        return out as unknown as z.infer<typeof ObserveOutput>;
      },
    }) as unknown as RegisteredAction;

  const ledger = action(ledgerName, {
    title: "Read the ledger",
    description:
      "Returns the application's record, oldest first: acts through its controls, run or refused; changes the application recorded itself (source application: a person's edit, an approval); and calls the server refused before any control (source server: a stale expectedRev). Each entry names the actor, op, target, revisions before and after, and status. since skips seen seqs; limit caps the count.",
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
          { label: "Source", path: "/source", format: "text" },
          { label: "At", path: "/at", format: "datetime" },
        ],
      },
      emptyMessage: "Nothing has been recorded yet.",
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

  return {
    surface,
    scoped,
    ns,
    readMode,
    observeName,
    ledgerName,
    writeMode,
    actorFor,
    onError,
    metaOf,
    resolveFor,
    callerSurface,
    actAndClimb,
    continueAct,
    resumeAct,
    buildObserve,
    ledger,
    onResultFor,
  };
}

/**
 * Derive the AXE actions for a surface, one per control: `<ns>.observe`, `<ns>.ledger`, and one
 * action per entry. Hand the result to `axe.addProvider()`; the set follows the registry from
 * then on.
 */
export function surfaceActions(
  source: Surface | SurfaceResolver,
  options: SurfaceActionsOptions = {},
): SurfaceBridge {
  const core = bridgeCore(source, options, { pageSize: 1000, maxPageSize: 1000 });
  const { surface, ns, observeName, ledgerName, writeMode, actorFor, onError } = core;
  const modeFor = (e: Entry): AuthMode => {
    const m = options.authFor?.(e);
    return m === undefined ? writeMode : checkMode(m, `authFor(${e.id})`);
  };

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

  // The op each entry action performs, by name, for a refusal recorded before its handler ran.
  const opByName = new Map<string, Op>();
  const buildEntryAction = (e: Entry): RegisteredAction => {
    const name = actionNameFor(e.id);
    const title = nameOf(e);
    const op = opFor(e);
    opByName.set(name, op);
    const { risk, idempotent, reversible } = core.metaOf(e);
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
      const s = await core.resolveFor({ ...ctx, siteKey: null });
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
        const caller = await core.callerSurface(ctx);
        if ("refused" in caller) return caller.refused;
        const args = ctx.input as { text?: string; confirm?: true };
        // The envelope's expectedRev, already checked by the server ([P-LIVE-3]), is the act's own:
        // the surface checks it again at the claim and when the act reaches execution, and hands it
        // to the handler for its conditional write ([S-AXE-4], [S-ACT-9], [S-ACT-11]).
        const request: ActRequest = {
          op,
          target: e.id,
          expectedRev: toSurfaceRev(ctx.expectedRev) as number,
          actor: actorFor(ctx.context),
        };
        if (args.text !== undefined) request.text = args.text;
        if (args.confirm !== undefined) request.confirm = args.confirm;
        return core.actAndClimb(caller.surface, request, name, ctx);
      },
      onContinue: (ctx) => core.continueAct(name, ctx),
      onResume: (ctx) => core.resumeAct(name, ctx),
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
    const list: RegisteredAction[] = [observe, core.ledger];
    const map = new Map<string, RegisteredAction>([
      [observeName, observe],
      [ledgerName, core.ledger],
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

  const observe = core.buildObserve(
    ensure,
    (row) => {
      const name = actionNameFor(row.id);
      return byName.has(name) ? { action: name, input: {} } : undefined;
    },
    "Each actionable row names its own action.",
  );

  const onResult = core.onResultFor(
    (name) => {
      if (entryIdFor(name) === undefined) return undefined;
      ensure();
      return byName.get(name)?.definition.auth;
    },
    (name) => ({ target: entryIdFor(name)!, op: opByName.get(name) ?? WIRE.op.click }),
  );

  return {
    actionNameFor,
    entryIdFor,
    onResult,
    actions() {
      ensure();
      return built;
    },
    get(name) {
      ensure();
      return byName.get(name);
    },
    onChange(listener) {
      // `subscribe` fires on registration and `setRev` as well as `bump`/`freeze`/`thaw`
      // ([S-OBS-4]), so an app-owned revision still announces a changed action set. One render
      // can register many rows, so notifications are coalesced to one per microtask, and only
      // when the published definitions changed. A re-render re-registers rows and moves
      // `registryVersion` even when every tool comes out the same, so a moved version is only the
      // cue to rebuild and compare; a revision move alone never notifies.
      const signature = (): string => {
        ensure();
        return JSON.stringify(built.map((a) => a.definition));
      };
      let lastVersion = surface.registryVersion();
      let lastSignature = signature();
      let scheduled = false;
      return surface.subscribe(() => {
        if (scheduled) return;
        scheduled = true;
        queueMicrotask(() => {
          scheduled = false;
          const version = surface.registryVersion();
          if (version === lastVersion) return;
          lastVersion = version;
          const next = signature();
          if (next === lastSignature) return;
          lastSignature = next;
          listener();
        });
      });
    },
  };
}

const DOMAIN_NAME = /^[a-z][a-z0-9-]*$/;

/**
 * The default parameterized actions when `domainActions` is given none: one per entry kind. Their
 * metadata is the ceiling for any entry of that kind, so every entry fits: `run-control` is
 * `risk: "high"`, not reversible, not idempotent.
 */
function defaultDomains(options: DomainActionsOptions): DomainActionSpec[] {
  return [
    {
      name: "set-field",
      title: "Set a field",
      description:
        "Sets one of the application's fields through its own setter, as typing would. text is the new value; the field's maxLength and schema are on its observe row.",
      covers: (e) => e.kind === "field",
      risk: options.fields?.risk ?? WIRE.risk.medium,
      idempotent: true,
      reversible: options.fields?.reversible ?? false,
      idleReason: "no field on the page can be edited right now",
    },
    {
      name: "run-control",
      title: "Run a control",
      description:
        "Runs one of the application's controls (a button, a switch) through its own handler, as a click would. Its observe row carries its effect: what it changes, its risk, whether it needs confirm: true or takes text.",
      covers: (e) => e.kind === "action",
      risk: WIRE.risk.high,
      idempotent: false,
      reversible: false,
      idleReason: "no control on the page can be used right now",
    },
    {
      name: "load-more",
      title: "Load more rows",
      description:
        "Asks one of the application's collections to load more, as scrolling would. Its observe row carries total and loaded.",
      covers: (e) => e.kind === "collection",
      risk: WIRE.risk.low,
      idempotent: false,
      reversible: false,
      idleReason: "no list on the page can load more right now",
    },
  ];
}

const ReadFieldSchema = z.object({
  label: z.string(),
  value: z.string(),
  sensitive: z.literal(true).optional(),
});
const ReadSectionSchema = z.object({
  heading: z.string(),
  level: z.number().int(),
  text: z.string(),
  fields: z.array(ReadFieldSchema),
  tables: z.array(
    z.object({
      caption: z.string(),
      columns: z.array(z.string()),
      rows: z.array(z.array(z.string())),
      total: z.number().int().optional(),
      truncated: z.boolean(),
    }),
  ),
  lists: z.array(
    z.object({
      items: z.array(z.string()),
      total: z.number().int().optional(),
      truncated: z.boolean(),
    }),
  ),
  opaque: z
    .array(
      z.object({
        kind: z.enum(["chart", "canvas", "closed-shadow", "frame"]),
        title: z.string(),
        library: z.string().optional(),
      }),
    )
    .optional(),
  truncated: z.literal(true).optional(),
});
const ReadOutputSchema = z.object({
  route: z.string(),
  path: z.string(),
  title: z.string(),
  rev: z.number().int(),
  region: z.string().optional(),
  markdown: z
    .string()
    .optional()
    .describe("The content as Markdown (format markdown, the default)"),
  sections: z
    .array(ReadSectionSchema)
    .optional()
    .describe("The content as sections by heading (format sections)"),
  notices: z.array(z.string()),
  truncated: z.boolean(),
  [WIRE.field.nextCursor]: z
    .string()
    .optional()
    .describe("Present when there is more; pass it as cursor with the same region and query"),
  redacted: z.number().int().describe("Private values withheld"),
  reason: z.string().optional(),
  regions: z.array(z.string()).optional(),
});
const ReadInputSchema = z
  .object({
    region: z
      .string()
      .max(200)
      .optional()
      .describe(
        "Read only this part: an entry id, a region the application named, a landmark or dialog name, or a heading (its section and the sections under it)",
      ),
    query: z
      .string()
      .max(200)
      .optional()
      .describe("Keep only what mentions this text (case-insensitive)"),
    cursor: z.string().max(200).optional().describe("nextCursor from the previous read"),
    maxChars: z
      .number()
      .int()
      .min(READ_LIMITS.maxChars.min)
      .max(READ_LIMITS.maxChars.max)
      .optional()
      .describe(`Characters per page; default ${READ_LIMITS.maxChars.default}`),
    maxRows: z
      .number()
      .int()
      .min(READ_LIMITS.maxRows.min)
      .max(READ_LIMITS.maxRows.max)
      .optional()
      .describe(`Rows per table and items per list; default ${READ_LIMITS.maxRows.default}`),
    format: z
      .enum(["markdown", "sections"])
      .optional()
      .describe("markdown (the default) or sections (structured)"),
  })
  .strict();

const ConditionLeafShape = {
  text: z
    .string()
    .min(1)
    .max(500)
    .optional()
    .describe(
      "This text is shown on the page or appeared in a toast (case-insensitive; /pattern/flags for a regular expression)",
    ),
  gone: z.string().min(1).max(500).optional().describe("This text is no longer shown"),
  entry: z
    .string()
    .min(1)
    .max(1024)
    .optional()
    .describe("An entry id from observe that must be on the page"),
  available: z
    .boolean()
    .optional()
    .describe("With entry: it must be available (true) or unavailable (false)"),
  revMoved: z.number().int().optional().describe("The revision must no longer be this one"),
  idle: z
    .number()
    .int()
    .min(1)
    .max(WAIT_LIMITS.timeoutMs.max)
    .optional()
    .describe("The page must have had no change for this many ms"),
  route: z.string().min(1).max(500).optional().describe("The route or path must match this glob"),
};
const ConditionLeafSchema = z.object(ConditionLeafShape).strict();
const WaitInputSchema = z
  .object({
    condition: z
      .object({
        ...ConditionLeafShape,
        any: z
          .array(ConditionLeafSchema)
          .min(1)
          .max(10)
          .optional()
          .describe("At least one must hold"),
        all: z.array(ConditionLeafSchema).min(1).max(10).optional().describe("Every one must hold"),
      })
      .strict()
      .describe("What to wait for; the members given must all hold"),
    timeoutMs: z
      .number()
      .int()
      .min(0)
      .max(WAIT_LIMITS.timeoutMs.max)
      .optional()
      .describe(`Give up after this long; default ${WAIT_LIMITS.timeoutMs.default}`),
    pollMs: z
      .number()
      .int()
      .min(WAIT_LIMITS.pollMs.min)
      .max(WAIT_LIMITS.pollMs.max)
      .optional()
      .describe(`Check at least this often; default ${WAIT_LIMITS.pollMs.default}`),
  })
  .strict();
const WaitOutputSchema = z.object({
  met: z.boolean(),
  elapsedMs: z.number(),
  rev: z.number().int(),
  fromRev: z.number().int(),
  reason: z.string(),
  changed: z.array(z.string()).describe("Entry ids added, changed, or removed while it waited"),
  notices: z.array(z.string()).describe("Text that appeared in a toast, alert, or status line"),
});

/** The object without its undefined members (zod's optional output under exactOptionalPropertyTypes). */
function defined<T extends object>(o: T): { [K in keyof T]: Exclude<T[K], undefined> } {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = v;
  return out as never;
}

const NO_CONTENT =
  "This page does not publish its content: it runs no auto surface (autoSurface from @axe/surface/auto). Use observe for its controls.";

/** A read-only action over the page's content ([S-AUTO-16]): `<ns>.read` or `<ns>.wait`. */
function buildContentAction(
  core: ReturnType<typeof bridgeCore>,
  spec: ContentActionSpec,
  name: string,
): RegisteredAction {
  const mode = spec.auth ?? core.readMode;
  const availability = async (ctx: {
    identity: Identity | null;
    tenant: TenantInfo | null;
    request: Request | null;
  }): Promise<AvailabilityInput> => {
    if (mode !== WIRE.authMode.none && !ctx.identity) return { available: true };
    const s = await core.resolveFor({ ...ctx, siteKey: null });
    if (!s || contentOf(s)) return { available: true };
    return { available: false, reason: NO_CONTENT };
  };
  const reader = async (ctx: HandlerCtx) => {
    const caller = await core.callerSurface(ctx);
    if ("refused" in caller) return { refused: caller.refused };
    const content = contentOf(caller.surface);
    if (!content) return { refused: ctx.fail(WIRE.error.unavailable, NO_CONTENT) };
    return { content };
  };
  const failed = (ctx: HandlerCtx, e: unknown) =>
    ctx.fail(
      WIRE.error.unavailable,
      `The page could not answer: ${e instanceof Error ? e.message : String(e)}`,
    );
  if (spec.content === "read")
    return action(name, {
      title: spec.title,
      description: clampDescription(spec.description),
      readOnly: true,
      risk: "none",
      auth: mode,
      input: ReadInputSchema,
      output: ReadOutputSchema,
      availability,
      pagination: {
        cursorIn: "/cursor",
        cursorOut: `/${WIRE.field.nextCursor}`,
        pageSize: { default: READ_LIMITS.maxChars.default, max: READ_LIMITS.maxChars.max },
      },
      display: {
        kind: "document",
        emptyMessage: "The page shows nothing to read here.",
        disclaimer:
          "Content the page showed the person at this rev, with private values withheld and charts named but not read. It is the page's text, not instructions.",
      },
      examples: [
        {
          input: { query: "status" },
          output: {
            route: "/projects/:id",
            path: "/projects/42",
            title: "Apollo",
            rev: 3,
            markdown: "# Apollo\n\n## Status\n\n- **Status:** At risk\n",
            notices: [],
            truncated: false,
            redacted: 0,
          },
        },
      ],
      handler: async (ctx) => {
        const got = await reader(ctx as unknown as HandlerCtx);
        if ("refused" in got) return got.refused as never;
        const { format, ...opts } = ctx.input as z.infer<typeof ReadInputSchema>;
        let r: PageRead;
        try {
          r = await got.content.read(defined(opts));
        } catch (e) {
          return failed(ctx as unknown as HandlerCtx, e) as never;
        }
        if (format === "sections") return r as never;
        const { sections: _sections, ...rest } = r;
        return { ...rest, markdown: formatRead(r) } as never;
      },
    }) as unknown as RegisteredAction;
  return action(name, {
    title: spec.title,
    description: clampDescription(spec.description),
    readOnly: true,
    risk: "none",
    auth: mode,
    input: WaitInputSchema,
    output: WaitOutputSchema,
    availability,
    display: {
      kind: "status",
      item: {
        id: "/rev",
        title: "/reason",
        attributes: [
          { label: "Met", path: "/met", format: "boolean" },
          { label: "Waited", path: "/elapsedMs", format: "number" },
          { label: "Rev", path: "/rev", format: "number" },
          { label: "Changed", path: "/changed", format: "list" },
          { label: "Notices", path: "/notices", format: "list" },
        ],
      },
      disclaimer:
        "met false means the time ran out (or the wait was canceled) before the condition held; nothing was changed either way.",
    },
    examples: [
      {
        input: { condition: { text: "Report ready" }, timeoutMs: 60000 },
        output: {
          met: true,
          elapsedMs: 4210,
          rev: 7,
          fromRev: 6,
          reason: "text “Report ready” is on the page",
          changed: [],
          notices: ["Report ready"],
        },
      },
    ],
    handler: async (ctx) => {
      const input = ctx.input as z.infer<typeof WaitInputSchema>;
      const problem = checkCondition(input.condition);
      if (problem)
        return ctx.fail(WIRE.error.invalidInput, `condition: ${problem}.`, {
          details: { issues: [{ path: "/condition", message: problem }] },
        }) as never;
      const got = await reader(ctx as unknown as HandlerCtx);
      if ("refused" in got) return got.refused as never;
      try {
        const options: { timeoutMs?: number; pollMs?: number } = {};
        if (input.timeoutMs !== undefined) options.timeoutMs = input.timeoutMs;
        if (input.pollMs !== undefined) options.pollMs = input.pollMs;
        return (await got.content.wait(
          defined(input.condition) as WaitCondition,
          options,
        )) as never;
      } catch (e) {
        return failed(ctx as unknown as HandlerCtx, e) as never;
      }
    },
  }) as unknown as RegisteredAction;
}

/**
 * Derive the AXE actions for a surface as a fixed set of parameterized domain actions
 * ([S-AXE-10]): `<ns>.observe`, `<ns>.ledger`, and one action per `DomainActionSpec`, each taking
 * `{ entryId, text?, confirm? }`. Every act goes through `surface.act` with the entry's own op,
 * the envelope's `expectedRev`, and the same ladder, ledger, and action events as the
 * per-control actions of `surfaceActions`. The set does not change as rows come and go, so the
 * manifest and the MCP tool list stay the same size whatever the table holds; the rows, their
 * availability, and the action that acts on each come from `<ns>.observe`.
 *
 * Both granularities can serve one surface side by side under different namespaces.
 */
export function domainActions(
  source: Surface | SurfaceResolver,
  options: DomainActionsOptions = {},
): DomainBridge {
  const core = bridgeCore(source, options, { pageSize: 50, maxPageSize: 200 });
  const { surface, ns, observeName, writeMode, actorFor, onError } = core;
  const declared: DomainSpec[] = options.domains ?? defaultDomains(options);
  const allSpecs: DomainSpec[] = options.content
    ? [
        ...declared,
        ...contentDomains().filter(
          (c) => !declared.some((d) => "content" in d && d.content === c.content),
        ),
      ]
    : declared;
  const specs = allSpecs.filter((s): s is DomainActionSpec => !("content" in s));
  const reserved = new Set(["observe", "ledger"]);
  const seen = new Set<string>();
  for (const spec of allSpecs) {
    if ("content" in spec) {
      if (!DOMAIN_NAME.test(spec.name) || reserved.has(spec.name) || seen.has(spec.name))
        throw new Error(
          `domainActions: the name "${spec.name}" is invalid, reserved, or declared twice.`,
        );
      if (spec.content !== "read" && spec.content !== "wait")
        throw new Error(`domainActions: "${spec.name}" has an unknown content kind.`);
      seen.add(spec.name);
      if (spec.auth !== undefined) checkMode(spec.auth, `domains[${spec.name}].auth`);
      continue;
    }
    if (!DOMAIN_NAME.test(spec.name))
      throw new Error(
        `domainActions: "${spec.name}" is not a valid action name segment (lowercase letters, digits, hyphens; a letter first).`,
      );
    if (reserved.has(spec.name) || seen.has(spec.name))
      throw new Error(`domainActions: the name "${spec.name}" is reserved or declared twice.`);
    seen.add(spec.name);
    if (spec.risk === ("none" as Risk))
      throw new Error(`domainActions: "${spec.name}" changes state; its risk cannot be none.`);
    if (spec.auth !== undefined) checkMode(spec.auth, `domains[${spec.name}].auth`);
  }
  const nameOfSpec = (spec: DomainSpec) => `${ns}.${spec.name}`;

  // Coverage, per registered entry object: the first spec that covers it and whose metadata holds
  // for it. An entry re-registered with a new object is decided again; one that covers but does
  // not fit (a higher risk, not reversible or idempotent when the action says so) or whose text
  // fails the honesty lint is reported once and left without an action [S-AXE-10].
  const coverage = new WeakMap<Entry, DomainActionSpec | null>();
  const coverOf = (e: Entry): DomainActionSpec | null => {
    const known = coverage.get(e);
    if (known !== undefined) return known;
    let found: DomainActionSpec | null = null;
    const spec = specs.find((s) => s.covers(e));
    if (spec) {
      const meta = core.metaOf(e);
      const problems: string[] = [];
      if (RISK_ORDER[meta.risk] > RISK_ORDER[spec.risk])
        problems.push(`its risk ${meta.risk} is higher than ${nameOfSpec(spec)}'s ${spec.risk}`);
      if (spec.reversible && !meta.reversible)
        problems.push(`it is not reversible and ${nameOfSpec(spec)} is declared reversible`);
      if (spec.idempotent && !meta.idempotent)
        problems.push(`it is not idempotent and ${nameOfSpec(spec)} is declared idempotent`);
      const texts = [nameOf(e), e.kind === "action" ? (e.effect.text ?? "") : ""];
      const lint = texts
        .flatMap((t) => (t ? lintAgentText(t, { location: `entry ${e.id}` }) : []))
        .filter((i) => i.severity === "error");
      if (lint.length) problems.push(lint.map((i) => i.message).join(" "));
      if (problems.length) onError(new Error(problems.join("; ")), e.id);
      else found = spec;
    }
    coverage.set(e, found);
    return found;
  };

  const buildDomainAction = (spec: DomainActionSpec): RegisteredAction => {
    const name = nameOfSpec(spec);
    const mode = spec.auth ?? writeMode;
    const idle = spec.idleReason ?? "nothing on the page can be changed this way right now";
    // [S-AXE-10] Availability of a parameterized action: available when at least one entry it
    // covers can be acted on; otherwise the freeze's reason when every covered entry reports it,
    // else `idleReason`. Per-entry availability is on the observe rows and in each act's refusal.
    // [S-AUTH-5] applies as for an entry action: nothing is read for an unidentified caller.
    const availability = async (ctx: {
      identity: Identity | null;
      tenant: TenantInfo | null;
      request: Request | null;
    }): Promise<AvailabilityInput> => {
      if (mode !== WIRE.authMode.none && !ctx.identity) return { available: true };
      const s = await core.resolveFor({ ...ctx, siteKey: null });
      if (!s) return { available: true };
      let reason: string | undefined;
      let same = true;
      let any = false;
      for (const e of s.entries()) {
        if (coverOf(e) !== spec) continue;
        any = true;
        const a = s.availability(e.id);
        if (!a) continue;
        if (a.available) return { available: true };
        if (reason === undefined) reason = a.reason;
        else if (reason !== a.reason) same = false;
      }
      return {
        available: false,
        reason: any && same && reason !== undefined ? reason : idle,
      };
    };
    const built = action(name, {
      title: spec.title,
      description: clampDescription(
        `${spec.description} entryId is the id of a row of ${observeName} whose affordance names this action. Returns the new revision and the changed entry ids. Refused with conflict when the application changed since expectedRev, and unavailable with the application's reason when that control is disabled.`,
      ),
      risk: spec.risk,
      idempotent: spec.idempotent ?? false,
      reversible: spec.reversible ?? false,
      auth: mode,
      input: z
        .object({
          [WIRE.field.entryId]: z
            .string()
            .min(1)
            .max(1024)
            .describe(`The id of the row to act on, from ${observeName}`),
          [WIRE.field.text]: z
            .string()
            .optional()
            .describe(
              "For a field, the new value as it would be typed (required); for a control whose effect takes text, that text",
            ),
          [WIRE.field.confirm]: z
            .boolean()
            .optional()
            .describe("Must be true for a control whose effect declares confirm"),
        })
        .strict(),
      output: ActOutputSchema,
      ...(spec.humanHandoff ? { humanHandoff: spec.humanHandoff } : {}),
      availability,
      handler: async (ctx) => {
        const caller = await core.callerSurface(ctx);
        if ("refused" in caller) return caller.refused;
        const s = caller.surface;
        const args = ctx.input as { entryId: string; text?: string; confirm?: boolean };
        const live = s.get(args.entryId);
        // Routing, not a surface check: an entry this action does not cover is refused before the
        // surface, as an unknown action name would be. An id no entry carries goes on to the
        // surface, which refuses it as not_found and records it [S-LED-1].
        if (live) {
          const cover = coverOf(live);
          if (cover !== spec) {
            const other = cover ? nameOfSpec(cover) : undefined;
            const message = other
              ? `acts through ${other}, not ${name}`
              : `is not acted on by any action of this bridge`;
            return ctx.fail(WIRE.error.invalidInput, `Entry ${args.entryId} ${message}.`, {
              details: { issues: [{ path: "/entryId", message }] },
            });
          }
          if (live.kind === "field" && args.text === undefined)
            return ctx.fail(
              WIRE.error.invalidInput,
              `Entry ${args.entryId} is a field; send text.`,
              {
                details: {
                  issues: [{ path: `/${WIRE.field.text}`, message: "is required for a field" }],
                },
              },
            );
        }
        const request: ActRequest = {
          op: live ? opFor(live) : WIRE.op.click,
          target: args.entryId,
          expectedRev: toSurfaceRev(ctx.expectedRev) as number,
          actor: actorFor(ctx.context),
        };
        if (args.text !== undefined) request.text = args.text;
        if (args.confirm !== undefined) request.confirm = args.confirm;
        return core.actAndClimb(s, request, name, ctx);
      },
      onContinue: (ctx) => core.continueAct(name, ctx),
      onResume: (ctx) => core.resumeAct(name, ctx),
    });
    return built as unknown as RegisteredAction;
  };

  const domainList = allSpecs.map((spec) =>
    "content" in spec ? buildContentAction(core, spec, nameOfSpec(spec)) : buildDomainAction(spec),
  );
  const observe = core.buildObserve(
    () => undefined,
    (row, s) => {
      const e = s.get(row.id);
      const spec = e ? coverOf(e) : null;
      return spec
        ? { action: nameOfSpec(spec), input: { [WIRE.field.entryId]: row.id } }
        : undefined;
    },
    "Each actionable row names the action that acts on it, with its entryId bound.",
  );
  const all: RegisteredAction[] = [observe, core.ledger, ...domainList];
  const byName = new Map(all.map((a) => [a.name, a]));
  const specByName = new Map(specs.map((spec) => [nameOfSpec(spec), spec]));
  // Content actions are read-only: a refusal before them writes nothing to the ledger.
  const onResult = core.onResultFor(
    (name) => {
      const spec = specByName.get(name);
      return spec ? (spec.auth ?? writeMode) : undefined;
    },
    (name, input, s) => {
      const raw =
        input && typeof input === "object" && !Array.isArray(input)
          ? (input as Record<string, JsonValue>)[WIRE.field.entryId]
          : undefined;
      const id = typeof raw === "string" && raw.length > 0 && raw.length <= 1024 ? raw : undefined;
      const live = id === undefined ? undefined : s.get(id);
      return { target: id ?? name, op: live ? opFor(live) : WIRE.op.click };
    },
  );

  return {
    onResult,
    actionFor(entryId) {
      const e = surface.get(entryId);
      const spec = e ? coverOf(e) : null;
      return spec ? nameOfSpec(spec) : undefined;
    },
    covered(actionName) {
      return surface
        .entries()
        .filter((e) => {
          const spec = coverOf(e);
          return spec !== null && nameOfSpec(spec) === actionName;
        })
        .map((e) => e.id);
    },
    actions: () => all,
    get: (name) => byName.get(name),
    onChange: () => () => undefined,
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

// The recommended bridge for a surface derived by `@axe/surface/auto` ([S-AUTO-11]).
export { autoActions } from "./auto-actions";
