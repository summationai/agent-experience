/**
 * @axe/surface: an application's registry of its own live controls, for agents.
 *
 * Every control that matters registers one entry: a stable id, a name that states the outcome,
 * the object it belongs to, its availability with a reason (and, optionally, what would make it
 * available), the AXE risk metadata of what it does, and the very handler the control calls.
 * From that table the surface derives `observe()`, an indexed snapshot under one revision, and
 * `act()`, the one way an agent changes anything, refused when the revision moved.
 *
 * Surface reports; it never decides. Availability is whatever the application computed to disable
 * its own control, and a handler runs exactly as a click would. See spec/SURFACE.md.
 */
import type {
  Accept,
  ErrorCode,
  JsonSchema,
  JsonValue,
  OkResult,
  ErrorResult,
  Result,
  Risk,
  ValidationIssue,
} from "@axe/core/types";
import type { AcceptInput } from "@axe/core/kinds";
import type { HandoffSpec as WireHandoffSpec } from "@axe/core/types";
import { validateJsonSchema } from "@axe/core/json-schema";
import * as WIRE from "@axe/core/vocabulary";

export type MaybePromise<T> = T | Promise<T>;
export type Op = "CLICK" | "TOGGLE" | "TYPE_TEXT" | "SCROLL_DOWN";
export type EntryKind = "action" | "field" | "collection";

/**
 * Where an entry came from, which is also what it guarantees ([S-AUTO-1]): `derived` was read from
 * the rendered page by `autoSurface` and acts through the page's own events; `annotated` is derived
 * and refined by configuration or `data-surface-*` attributes; `declared` was registered by the
 * application (or given a real handler by configuration) and runs the application's own function.
 * An entry without `source` is declared.
 */
export type EntrySource = "derived" | "annotated" | "declared";

/**
 * Who moves the revision. `surface`: the application calls `bump()` after every change, and
 * `freeze`/`thaw` move the revision too. `app`: the application adopts its own revision with
 * `setRev()` (a server counter), and `freeze`/`thaw` leave it alone, since a freeze is not a change
 * of the application's state. Unless pinned by `createSurface({ revision })`, the mode follows the
 * last call: `bump()` makes it `surface`, `setRev()` makes it `app`.
 */
export type RevisionMode = "surface" | "app";

/**
 * The structural shape of a validation schema the surface accepts beside a JSON Schema: anything
 * with `safeParse`, which is a Zod schema. The surface never imports Zod; it calls `safeParse` to
 * validate and uses the `toJsonSchema` you configure to publish the schema in `observe()`.
 */
export interface SchemaLike {
  safeParse(value: unknown): {
    success: boolean;
    error?: { issues: { path: (string | number | symbol)[]; message: string }[] };
  };
}

/**
 * Renders a Zod schema as JSON Schema for `observe()`. `toJsonSchema` from `@axe/core` fits as it
 * is; the parameter is typed `never` so that a converter over any concrete schema type fits too.
 */
export type SchemaConverter = (schema: never, io: "input") => JsonSchema;

/**
 * What a handler, a field's `set`, or a collection's `more` may return (or resolve to) to tell the
 * surface what it did: `changed`, the entry ids whose state moved, and `rev`, the application's
 * revision after the change, adopted as `setRev(rev)` would adopt it before the act result is
 * built. Applications with a server revision report both here, since their revision arrives after
 * the handler; the surface otherwise infers `changed` only from a revision that moved during the
 * handler. Any other return value is ignored.
 */
export interface HandlerReport {
  changed?: string[];
  rev?: number;
  /**
   * The application refused the write because its own precondition failed (a conditional write
   * found a newer revision). `act` returns `conflict` with `details.currentRev`, records a refusal,
   * and adopts nothing from the report. Throwing a `SurfaceConflict` does the same.
   */
  conflict?: { currentRev?: number };
  /**
   * Text the page showed in response (a toast, a status line), for the agent to read in the act's
   * output. `autoSurface` reports what appeared while the page settled ([S-AUTO-5]).
   */
  notices?: string[];
}

/**
 * What `act` passes to the handler, a field's `set`, or a collection's `more` as its last argument,
 * so a server-state handler can carry the precondition into its own write
 * (`UPDATE ... WHERE revision = $expectedRev`) and refuse with a `SurfaceConflict` when it fails.
 */
export interface ActContext {
  /** The entry id the act resolved to. */
  id: string;
  op: Op;
  /** The revision the agent observed and presented; equal to the surface's revision when the handler starts. */
  expectedRev: number;
  actor: string;
}

/**
 * Thrown by a handler whose own precondition failed: the backend holds a newer revision than the
 * one the act presented, so nothing was written. `act` maps it to `conflict` with
 * `details.currentRev` (when given), records a refusal in the ledger, and moves nothing.
 */
export class SurfaceConflict extends Error {
  /** The backend's revision, when the handler knows it. Reported, never adopted. */
  readonly currentRev?: number;
  constructor(
    message = "The application refused the write: its state changed since the revision the act presented.",
    options: { currentRev?: number } = {},
  ) {
    super(message);
    this.name = "SurfaceConflict";
    if (typeof options.currentRev === "number" && Number.isFinite(options.currentRev))
      this.currentRev = options.currentRev;
  }
}

/** A `SurfaceConflict`, including one from another copy of this module (checked by name). */
function isSurfaceConflict(value: unknown): value is SurfaceConflict {
  return (
    value instanceof SurfaceConflict || (value instanceof Error && value.name === "SurfaceConflict")
  );
}

/** What a control does, in AXE's terms. `undoable` is accepted as a legacy alias of `reversible`. */
export interface Effect {
  /** Name of the state this action changes, for example `draft`, `locks`, `prefs`. */
  mutates: string;
  /** Repeating the action has no additional effect. Default false. */
  idempotent?: boolean;
  /** The effect can be undone by the user or the application. Default false. */
  reversible?: boolean;
  /** @deprecated Use `reversible`. */
  undoable?: boolean;
  /** AXE risk level. Default `medium`. */
  risk?: Risk;
  /** The act must carry `confirm: true`. */
  confirm?: boolean;
  /** The handler takes free text; this is the prompt for it ("reason for the lock"). */
  text?: string;
}

/**
 * A handoff the application declares for a control only a human can activate. `url` is the page
 * where the person takes the step; leave it out when the step is taken inside the application
 * itself (a menu, a dialog) and no page names it. Without a `url` the handoff is reported in
 * `act`'s `error.details.handoff` and in the bridge's `availability`, and never becomes
 * `needs_human`, whose resume needs a page to come back from.
 */
export interface HandoffSpec {
  reason: string;
  instructions: string;
  url?: string;
  whatAgentShouldSayToUser: string;
}

/** Why a control is unavailable, and what would change that. */
export type Availability =
  | { available: true; reason?: null }
  | {
      available: false;
      /** Plain language, in the application's own words: "already drafted by another team". */
      reason: string;
      /** Kinds an agent could supply to make the control available, and how to apply one. */
      requires?: {
        accepts: AcceptInput[];
        fulfill: (kind: string, payload: JsonValue, actor: string) => MaybePromise<void>;
      };
      /** A step only a human can take on the application. */
      handoff?: HandoffSpec;
    };

export interface ActionEntry {
  id: string;
  kind: "action";
  role: "button" | "switch" | "menuitem" | "link" | string;
  name: string | (() => string);
  object?: string;
  state?: Availability;
  effect: Effect;
  /**
   * The control's own toggle or selection state, when it has one, as the page shows it:
   * `{ checked }` for a checkbox, switch, or radio (`true`, `false`, or `"mixed"`), `{ pressed }`
   * for a toggle button, `{ selected }` for a tab or option, `{ expanded }` for a disclosure. Never
   * part of the `name` ([S-DOM-1]).
   */
  value?: JsonValue;
  source?: EntrySource;
  /** The control's own handler. May return a `HandlerReport`; `context` carries the presented `expectedRev`. */
  handler: (
    actor: string,
    text: string | undefined,
    context: ActContext,
  ) => MaybePromise<HandlerReport | unknown>;
}

export interface FieldEntry {
  id: string;
  kind: "field";
  role: "textbox" | "searchbox" | "spinbutton" | string;
  name: string | (() => string);
  object?: string;
  value?: JsonValue;
  /**
   * The value is private ([S-PRV-1]): it never appears in `observe()`, `describeEntry`, the DOM
   * mirror, or the ledger's `text` (successful acts and refusals alike), and the bridge's action
   * events never carry it. The row says `sensitive: true` instead of carrying `value`.
   */
  sensitive?: boolean;
  source?: EntrySource;
  edit:
    | { op?: "TYPE_TEXT"; readOnly: true; reason?: string }
    | {
        op?: "TYPE_TEXT";
        readOnly?: false;
        maxLength?: number;
        /**
         * Validate the typed text before `set` runs: a JSON Schema for a string, or a Zod schema
         * (anything with `safeParse`). A Zod schema needs `toJsonSchema` configured on the surface
         * so `observe()` can publish it; the surface itself stays free of Zod.
         */
        schema?: JsonSchema | SchemaLike;
        /** The control's own setter. May return a `HandlerReport`; `context` carries the presented `expectedRev`. */
        set: (
          text: string,
          actor: string,
          context: ActContext,
        ) => MaybePromise<HandlerReport | unknown>;
      };
}

export interface CollectionEntry {
  id: string;
  kind: "collection";
  role: "grid" | "list" | "table" | string;
  name: string | (() => string);
  object?: string;
  total?: number | null;
  loaded?: number | null;
  filter?: JsonValue;
  sort?: JsonValue;
  source?: EntrySource;
  /** Load more. Present makes the collection actionable with `SCROLL_DOWN`. May return a `HandlerReport`. */
  more?: (context: ActContext) => MaybePromise<HandlerReport | unknown>;
}

export type Entry = ActionEntry | FieldEntry | CollectionEntry;

/** One row of `observe()`. */
export interface ObservedEntry {
  index: number | null;
  id: string;
  kind: EntryKind;
  role: string;
  name: string;
  object: string | null;
  rev: number;
  /** Present on an entry that is not declared ([S-AUTO-1]): `derived` or `annotated`. */
  source?: Exclude<EntrySource, "declared">;
  state?: {
    available: boolean;
    reason: string | null;
    requires?: Accept[];
    handoff?: WireHandoffSpec;
  };
  effect?: {
    mutates: string;
    readOnly: false;
    idempotent: boolean;
    reversible: boolean;
    risk: Risk;
    confirm?: boolean;
    text?: string;
  };
  value?: JsonValue | null;
  /** Present on a sensitive field ([S-PRV-1]), which carries no `value`. */
  sensitive?: true;
  edit?: {
    op: "TYPE_TEXT";
    maxLength: number | null;
    readOnly: boolean;
    reason: string | null;
    schema?: JsonSchema;
  };
  total?: number | null;
  loaded?: number | null;
  filter?: JsonValue | null;
  sort?: JsonValue | null;
}

export interface Observation {
  protocol: string;
  app: string;
  rev: number;
  at: string;
  entries: ObservedEntry[];
  objects: Record<string, JsonValue>;
  /** Present while the application holds a `freeze`: every entry is unavailable for this reason. */
  frozen?: Frozen;
  /** The latest ledger `seq`, so an agent can ask `ledger({ since })` for what happened since it looked. */
  ledgerSeq: number;
}

/** The transient state a `freeze` reports on every entry. */
export interface Frozen {
  reason: string;
}

/** Releases one `freeze`. Calling it more than once is harmless. */
export type Thaw = () => void;

export interface ActRequest {
  op: Op;
  /** Entry id (preferred) or the `index` from the observation the agent is acting on. */
  target: string | number;
  text?: string;
  /** The revision the agent observed. Required. */
  expectedRev: number;
  actor?: string;
  confirm?: boolean;
}

export interface ActOutput {
  rev: number;
  id: string;
  actor: string;
  changed: string[];
  /** The ledger entry this act wrote. */
  seq: number;
  /** What the page said in response, when the handler reported it (`HandlerReport.notices`). */
  notices?: string[];
}

/** `act()` returns the AXE result envelope: `ok`, or `error` with `conflict` (stale), `not_found`, `invalid_input`, or `unavailable`. Every result carries the `seq` of its ledger entry (`output.seq`, or `error.details.seq`). */
export type ActResult = OkResult<ActOutput> | ErrorResult;

/** One line of the ledger: an act that ran, or a refusal, with who asked and which revisions it spanned (spec [S-LED-*]). */
export interface LedgerEntry {
  /** 1-based, increasing by one per act; never reused. */
  seq: number;
  /** When the entry was written. */
  at: string;
  /** The `op` as requested. */
  op: string;
  /** The entry id the act resolved to; for a refusal before the target resolved, the target as requested. */
  target: string | number | null;
  actor: string;
  /** The revision when the act arrived. */
  revBefore: number;
  /** The revision when the entry was written: after the handler ran, or unchanged for a refusal. */
  revAfter: number;
  /** `ok` when the handler ran and returned; otherwise the error code the act was refused with (`internal` when the handler threw). */
  status: "ok" | ErrorCode;
  /** The text the act carried, when the ledger's text policy keeps it ([S-PRV-2]); never for a sensitive field. */
  text?: string;
  /** SHA-256 of the text, hex, when the ledger's text policy is `hash` ([S-PRV-2]). A correlation value, not secrecy: guessable text can be recovered from it. */
  textHash?: string;
  /** Entry ids whose state the act moved; empty for a refusal. */
  changed: string[];
  /**
   * A revision the handler reported that the surface did not adopt because it is lower than the
   * revision at completion (a newer one arrived while the handler ran) [S-REV-6].
   */
  ignoredRev?: number;
}

export interface LedgerQuery {
  /** Only entries with `seq` greater than this, oldest first, so an agent can ask what happened since it looked. */
  since?: number;
  /** Only entries by this actor. */
  actor?: string;
  /** At most this many entries: the oldest after `since` when `since` is given (so a reader can page forward), else the newest. */
  limit?: number;
}

export interface SurfaceOptions {
  app?: string;
  /** Clock for `observe().at`; injectable for deterministic tests and builds. */
  now?: () => Date;
  /**
   * Ledger retention and text policy. `max` is the number of most recent entries kept; default
   * 1000. `text` is what the ledger keeps of the free text an act carried ([S-PRV-2]): `keep` (the
   * default), `hash` (`textHash` only), or `omit`; a sensitive field's text is never kept whatever
   * the policy. `redact` rewrites kept text (return `undefined` to drop it), for example to mask
   * an account number inside a note.
   */
  ledger?: LedgerOptions;
  /**
   * Pin who moves the revision (`RevisionMode`). Omitted, the mode follows the last of `bump()`
   * (`surface`) and `setRev()` (`app`), starting as `surface`.
   */
  revision?: RevisionMode;
  /**
   * Converts a Zod schema to JSON Schema for `observe()`: pass `toJsonSchema` from `@axe/core`.
   * Required only when an entry carries a Zod schema (`edit.schema`, `requires.accepts[].schema`);
   * the surface does not import Zod itself, so a browser bundle without Zod stays without it.
   */
  toJsonSchema?: SchemaConverter;
}

/** What the ledger keeps of the free text an act carried ([S-PRV-2]). */
export type LedgerTextPolicy = "keep" | "hash" | "omit";

export interface LedgerOptions {
  max?: number;
  text?: LedgerTextPolicy;
  redact?: (text: string, entryId: string | null) => string | undefined;
}

export interface Surface {
  configure(options: { app?: string; toJsonSchema?: SurfaceOptions["toJsonSchema"] }): void;
  register(entry: Entry): void;
  unregister(id: string): void;
  /** Drop every entry whose id starts with `prefix` and is not in `keep`. Adapters that re-scan a rendered region use this. */
  reconcile(prefix: string, keep: Set<string>): void;
  /**
   * Report every entry unavailable with `reason` while a transient state lasts (a save in flight,
   * a modal open), and notify `onChange` listeners now and again on `thaw`. In `surface` revision
   * mode the revision moves on both ends, so an act planned before the freeze is refused as
   * `conflict`; in `app` mode it stays with the application's revision, so such an act is
   * `unavailable` while frozen and accepted afterwards exactly when the application's revision did
   * not move. Freezes nest: the surface thaws when the last one is released.
   */
  freeze(reason: string): Thaw;
  /** Adopt a persisted revision if it is ahead of the current one. Leaves the revision mode alone. */
  seedRev(n: number): void;
  /** The application owns the counter: adopt its value as is. Marks the revision `app`-owned unless pinned. */
  setRev(n: number): void;
  currentRev(): number;
  /** Who moves the revision right now: `surface` (`bump`) or `app` (`setRev`). */
  revisionMode(): RevisionMode;
  /** Advance the revision after a change and notify listeners. Marks the revision `surface`-owned unless pinned. */
  bump(meta?: Record<string, JsonValue>): number;
  onChange(fn: (event: { rev: number } & Record<string, JsonValue>) => void): () => void;
  /**
   * Call `fn` after every change to what `observe()`, `availability()`, or `attributesFor()` can
   * report: `register`, `unregister` and `reconcile` that changed the table, `bump`, `setRev`,
   * `seedRev` that adopted a revision, `freeze`, `thaw`, and `reset` ([S-OBS-4]). Returns the
   * unsubscribe function. The shape `useSyncExternalStore` takes; `useSurfaceProps` uses it.
   * `onChange` keeps its narrower meaning and does not fire on registration.
   */
  subscribe(fn: () => void): () => void;
  setObjects(fn: () => Record<string, JsonValue>): void;
  observe(): Observation;
  act(
    request: ActRequest,
    options?: { run?: (fn: () => MaybePromise<unknown>) => MaybePromise<unknown> },
  ): Promise<ActResult>;
  /** The ledger: every act and every refusal, oldest first. See `LedgerQuery` for `since`, `actor`, and `limit`. */
  ledger(query?: LedgerQuery): LedgerEntry[];
  /** Publish `observe`, `act`, `ledger`, and `rev` on a host object (`window.__surface`) for browser agents. */
  expose(
    host?: object | null,
    options?: { run?: (fn: () => MaybePromise<unknown>) => MaybePromise<unknown> },
  ): void;
  /** Look up a registered entry. */
  get(id: string): Entry | undefined;
  /** Every registered entry, in registration order. */
  entries(): Entry[];
  /**
   * A counter that moves on every `register`, `unregister`, `reconcile`, and `reset`, and on nothing
   * else: a `bump` alone leaves it. Consumers that derive something per entry (the AXE bridge's one
   * action per control) rebuild when it changes and reuse their work when it has not.
   */
  registryVersion(): number;
  /**
   * The live availability of one entry as the AXE bridge publishes it ([S-AXE-6]): an action's own
   * `state` (with `requires` as `accepts` entries), a field's read-only reason, whether a collection
   * can load more, and the freeze's reason for every kind while frozen. Undefined for an unknown id.
   */
  availability(id: string): EntryAvailability | undefined;
  /**
   * The DOM mirror for one registered entry as it stands now ([S-DOM-1]): `set`, the attributes
   * the control carries, computed from `availability(id)` so a freeze shows as `aria-disabled` or
   * `aria-readonly` with the freeze's reason; and `remove`, every canonical Surface attribute
   * (`SURFACE_ATTRIBUTES`) not in `set`, so a renderer that applies both never leaves last
   * render's reason behind. Undefined for an unknown id.
   */
  attributesFor(id: string): SurfaceAttributeUpdate | undefined;
  /** Forget everything. Tests. */
  reset(): void;
}

/** What `availability(id)` returns: the wire shape of an unavailable-with-reason report. */
export type EntryAvailability =
  | { available: true }
  | {
      available: false;
      reason: string;
      requires?: Accept[];
      handoff?: WireHandoffSpec;
    };

/** What `attributesFor(id)` returns: attributes to set, and canonical attributes to remove. */
export interface SurfaceAttributeUpdate {
  set: SurfaceAttributes;
  remove: string[];
}

/** Every attribute the DOM mirror may set ([S-DOM-1]), from the vocabulary's `domAttribute` table. */
export const SURFACE_ATTRIBUTES: readonly string[] = Object.freeze(
  Object.values(WIRE.domAttribute),
);

/** A Zod schema, structurally: anything with `safeParse`. The surface never imports Zod. */
function isSchemaLike(value: unknown): value is SchemaLike {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { safeParse?: unknown }).safeParse === "function"
  );
}

/** A handler's return value, when it is a `HandlerReport`. */
function reportOf(value: unknown): HandlerReport | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const v = value as { changed?: unknown; rev?: unknown; conflict?: unknown; notices?: unknown };
  const out: HandlerReport = {};
  if (Array.isArray(v.changed)) out.changed = v.changed.map(String);
  if (typeof v.rev === "number" && Number.isFinite(v.rev)) out.rev = v.rev;
  if (typeof v.conflict === "object" && v.conflict !== null) {
    const current = (v.conflict as { currentRev?: unknown }).currentRev;
    out.conflict =
      typeof current === "number" && Number.isFinite(current) ? { currentRev: current } : {};
  }
  if (Array.isArray(v.notices) && v.notices.length) out.notices = v.notices.map(String);
  return out.changed || out.rev !== undefined || out.conflict || out.notices ? out : undefined;
}

function nameOf(e: Entry): string {
  return typeof e.name === "function" ? e.name() : e.name;
}

/** A field whose value is private [S-PRV-1]. */
function isSensitive(e: Entry | ObservedEntry): boolean {
  return e.kind === "field" && !!e.sensitive;
}

const NEEDS_CONVERTER =
  "is a Zod schema; pass toJsonSchema from @axe/core as createSurface({ toJsonSchema }) or configure({ toJsonSchema }), or register a JSON Schema.";

function errorResult(
  code: ErrorResult["error"]["code"],
  message: string,
  extra: {
    retryable?: boolean;
    details?: Record<string, JsonValue>;
    issues?: ValidationIssue[];
  } = {},
): ErrorResult {
  const error: ErrorResult["error"] = { code, message, retryable: extra.retryable ?? false };
  if (extra.details || extra.issues) {
    error.details = { ...(extra.details ?? {}) };
    if (extra.issues) error.details.issues = extra.issues;
  }
  return { status: WIRE.status.error, error };
}

/** Create a surface. Applications usually create one per page and call `expose()`. */
export function createSurface(options: SurfaceOptions = {}): Surface {
  const entries = new Map<string, Entry>();
  const listeners = new Set<(event: { rev: number } & Record<string, JsonValue>) => void>();
  // [S-OBS-4] Store subscribers: told after every change a reader could see, registration included.
  const subscribers = new Set<() => void>();
  const changed = (): void => {
    for (const fn of [...subscribers]) fn();
  };
  let rev = 0;
  let app = options.app ?? "app";
  let objectsFn: () => Record<string, JsonValue> = () => ({});
  const now = options.now ?? (() => new Date());
  // Active freezes, oldest first. The newest reason is the one reported.
  const freezes: Frozen[] = [];
  const frozenNow = (): Frozen | undefined => freezes[freezes.length - 1];
  const log: LedgerEntry[] = [];
  let seq = 0;
  const ledgerMax = Math.max(0, options.ledger?.max ?? 1000);
  const textPolicy: LedgerTextPolicy = options.ledger?.text ?? "keep";
  const redactText = options.ledger?.redact;
  /**
   * What the ledger keeps of an act's text [S-PRV-2]. A sensitive field's text is never kept; a
   * target that did not resolve to an entry is treated as sensitive while any sensitive entry is
   * registered, since a refusal before resolution cannot tell which row it meant.
   */
  const ledgerTextFor = (
    text: string | undefined,
    target: string | number | null,
  ): Pick<LedgerEntry, "text" | "textHash"> => {
    if (text === undefined || textPolicy === "omit") return {};
    const e = typeof target === "string" ? entries.get(target) : undefined;
    if (e ? isSensitive(e) : [...entries.values()].some(isSensitive)) return {};
    if (textPolicy === "hash") return { textHash: sha256Hex(text) };
    const id = e ? e.id : null;
    const kept = redactText ? redactText(text, id) : text;
    return kept === undefined ? {} : { text: kept };
  };
  let registryVersion = 0;
  // Who moves the revision [S-REV-1]: pinned by the option, else the last of bump/setRev.
  const pinnedMode = options.revision;
  let mode: RevisionMode = pinnedMode ?? "surface";
  let convert = options.toJsonSchema;
  // Write ordering [S-ACT-9]: acts run one at a time, in the order they were claimed. `queued`
  // counts acts claimed and not yet settled; `tail` settles when the last of them has. `epoch`
  // moves on every commit that may have changed state, so an act claimed at a revision before a
  // commit that left the revision where it was (an app-owned revision that arrives later) is
  // still refused ([S-ACT-10]).
  let queued = 0;
  let tail: Promise<unknown> = Promise.resolve();
  let epoch = 0;
  const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
    const exec = async (): Promise<T> => {
      try {
        return await fn();
      } finally {
        queued -= 1;
      }
    };
    queued += 1;
    // An idle surface starts the act now, within the call, as it always has; a busy one waits.
    const turn = queued === 1 ? exec() : tail.then(exec);
    tail = turn.catch(() => undefined);
    return turn;
  };
  // JSON Schema renderings of Zod schemas, one conversion per schema object.
  const converted = new WeakMap<SchemaLike, JsonSchema>();
  const jsonSchemaOf = (schema: JsonSchema | SchemaLike): JsonSchema | undefined => {
    if (!isSchemaLike(schema)) return schema;
    if (!convert) return undefined;
    let out = converted.get(schema);
    if (!out) {
      out = convert(schema as never, "input");
      converted.set(schema, out);
    }
    return out;
  };
  const toAccept = (entry: AcceptInput): Accept => {
    const out: Accept = {
      kind: entry.kind,
      title: entry.title ?? entry.kind,
      description: entry.description,
      schema: jsonSchemaOf(entry.schema as JsonSchema | SchemaLike) ?? {},
      sensitive: entry.sensitive,
    };
    if (entry.instructions !== undefined) out.instructions = entry.instructions;
    return out;
  };
  const notify = (meta: Record<string, JsonValue>): void => {
    for (const fn of listeners) fn({ ...meta, rev });
    changed();
  };

  /** One entry's availability, honoring a freeze; shared by `observe()` and `availability()`. */
  const availabilityOf = (e: Entry, frozen: Frozen | undefined): EntryAvailability => {
    if (frozen) return { available: false, reason: frozen.reason };
    if (e.kind === "action") {
      const s = e.state ?? { available: true };
      if (s.available) return { available: true };
      const out: EntryAvailability = { available: false, reason: s.reason || "unavailable" };
      if (s.requires) out.requires = s.requires.accepts.map(toAccept);
      if (s.handoff) out.handoff = { ...s.handoff };
      return out;
    }
    if (e.kind === "field") {
      return e.edit.readOnly
        ? { available: false, reason: e.edit.reason ?? "read only" }
        : { available: true };
    }
    return typeof e.more === "function"
      ? { available: true }
      : { available: false, reason: "cannot load more" };
  };

  /** The DOM mirror set for an entry given its availability; shared by `surfaceAttributes` and `attributesFor`. */
  const attributesOf = (e: Entry, a: EntryAvailability): SurfaceAttributes => {
    const out = baseAttributes(e);
    if (e.kind === "collection" || a.available) return out;
    out[e.kind === "field" ? WIRE.domAttribute.readOnly : WIRE.domAttribute.disabled] = "true";
    out[WIRE.domAttribute.surfaceReason] = a.reason;
    return out;
  };

  const surface: Surface = {
    configure({ app: name, toJsonSchema }) {
      if (name) app = String(name);
      if (toJsonSchema) convert = toJsonSchema;
    },
    register(entry) {
      if (!entry || typeof entry.id !== "string" || !entry.kind)
        throw new Error("surface.register: `id` and `kind` are required.");
      if (entry.kind === "action") {
        if (typeof entry.handler !== "function")
          throw new Error(`surface.register(${entry.id}): an action needs a handler.`);
        if (!entry.effect || typeof entry.effect.mutates !== "string")
          throw new Error(
            `surface.register(${entry.id}): an action needs effect.mutates, the name of the state it changes.`,
          );
        const s = entry.state;
        if (s && !s.available && s.requires && !convert)
          s.requires.accepts.forEach((a, i) => {
            if (isSchemaLike(a.schema))
              throw new Error(
                `surface.register(${entry.id}): state.requires.accepts[${i}].schema ${NEEDS_CONVERTER}`,
              );
          });
      } else if (entry.kind === "field") {
        if (!entry.edit) throw new Error(`surface.register(${entry.id}): a field needs edit.`);
        if (!entry.edit.readOnly && typeof (entry.edit as { set?: unknown }).set !== "function")
          throw new Error(`surface.register(${entry.id}): an editable field needs edit.set.`);
        if (!entry.edit.readOnly && isSchemaLike(entry.edit.schema) && !convert)
          throw new Error(`surface.register(${entry.id}): edit.schema ${NEEDS_CONVERTER}`);
      } else if (entry.kind !== "collection") {
        throw new Error(
          `surface.register(${(entry as Entry).id}): kind must be action, field, or collection.`,
        );
      }
      entries.set(entry.id, entry);
      registryVersion += 1;
      changed();
    },
    unregister(id) {
      if (!entries.delete(id)) return;
      registryVersion += 1;
      changed();
    },
    reconcile(prefix, keep) {
      const before = registryVersion;
      for (const id of [...entries.keys()])
        if (id.startsWith(prefix) && !keep.has(id)) {
          entries.delete(id);
          registryVersion += 1;
        }
      if (registryVersion !== before) changed();
    },
    freeze(reason) {
      const hold: Frozen = { reason: String(reason || "busy") };
      freezes.push(hold);
      // [S-FRZ-2] A freeze is a change an agent could observe. When the surface owns the
      // revision it moves; when the application owns it, the freeze is reported on every
      // entry and to listeners, and the revision stays the application's.
      if (mode === "surface") surface.bump({ frozen: hold.reason });
      else notify({ frozen: hold.reason });
      let released = false;
      const thaw: Thaw = () => {
        if (released) return;
        released = true;
        const i = freezes.indexOf(hold);
        if (i >= 0) freezes.splice(i, 1);
        if (mode === "surface") surface.bump({ thawed: hold.reason });
        else notify({ thawed: hold.reason });
      };
      return thaw;
    },
    seedRev(n) {
      if (!Number.isFinite(n) || n <= rev) return;
      rev = n;
      changed();
    },
    setRev(n) {
      if (!Number.isFinite(n)) return;
      rev = n;
      if (!pinnedMode) mode = "app";
      changed();
    },
    currentRev: () => rev,
    revisionMode: () => mode,
    bump(meta = {}) {
      if (!pinnedMode) mode = "surface";
      rev += 1;
      notify(meta);
      return rev;
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    subscribe(fn) {
      subscribers.add(fn);
      return () => void subscribers.delete(fn);
    },
    setObjects(fn) {
      objectsFn = typeof fn === "function" ? fn : () => ({});
    },
    observe() {
      let i = 0;
      const out: ObservedEntry[] = [];
      const frozen = frozenNow();
      for (const e of entries.values()) {
        const row: ObservedEntry = {
          index: null,
          id: e.id,
          kind: e.kind,
          role: e.role,
          name: nameOf(e),
          object: e.object ?? null,
          rev,
        };
        if (e.source && e.source !== "declared") row.source = e.source;
        if (e.kind === "action") {
          // A freeze supersedes the control's own state: nothing is actionable, and there is
          // nothing to fulfill or hand off until it lifts.
          const a = availabilityOf(e, frozen);
          if (a.available) {
            row.state = { available: true, reason: null };
            row.index = ++i;
          } else {
            row.state = { available: false, reason: a.reason };
            if (a.requires) row.state.requires = a.requires;
            if (a.handoff) row.state.handoff = a.handoff;
          }
          const f = e.effect;
          row.effect = {
            mutates: f.mutates,
            readOnly: false,
            idempotent: f.idempotent ?? false,
            reversible: f.reversible ?? f.undoable ?? false,
            risk: f.risk ?? WIRE.risk.medium,
          };
          if (f.confirm) row.effect.confirm = true;
          if (f.text) row.effect.text = f.text;
          if (e.value !== undefined) row.value = e.value;
        } else if (e.kind === "field") {
          // [S-PRV-1] A sensitive field says so and carries no value.
          if (e.sensitive) row.sensitive = true;
          else row.value = e.value ?? null;
          const ed = e.edit;
          const readOnly = !!ed.readOnly || !!frozen;
          row.edit = {
            op: WIRE.op.typeText,
            maxLength: readOnly ? null : (ed.maxLength ?? null),
            readOnly,
            reason: frozen ? frozen.reason : ed.readOnly ? (ed.reason ?? "read only") : null,
          };
          if (!readOnly && !ed.readOnly && ed.schema) {
            const schema = jsonSchemaOf(ed.schema);
            if (schema) row.edit.schema = schema;
          }
          if (!readOnly) row.index = ++i;
        } else {
          row.total = e.total ?? null;
          row.loaded = e.loaded ?? null;
          row.filter = e.filter ?? null;
          row.sort = e.sort ?? null;
          if (typeof e.more === "function" && !frozen) row.index = ++i;
        }
        out.push(row);
      }
      const view: Observation = {
        protocol: WIRE.protocol.version,
        app,
        rev,
        at: now().toISOString(),
        entries: out,
        objects: objectsFn(),
        ledgerSeq: seq,
      };
      if (frozen) view.frozen = { reason: frozen.reason };
      return view;
    },
    async act(
      req,
      {
        run: runner = (fn: () => MaybePromise<unknown>) => fn(),
      }: { run?: (fn: () => MaybePromise<unknown>) => MaybePromise<unknown> } = {},
    ) {
      const {
        op,
        target,
        text,
        expectedRev,
        actor = "agent",
        confirm = false,
      } = req ?? ({} as ActRequest);
      // The ledger [S-LED-*]: one entry per act, written whether the handler ran or the act was
      // refused. `err` below records the refusal and stamps its seq on the error; `run` records a
      // handler that threw. `revBefore` is the revision when the act was last checked: at the
      // claim for a refusal there, else when the act reached execution [S-LED-5].
      let revBefore = rev;
      let resolved: string | null = null;
      const record = (
        status: LedgerEntry["status"],
        changed: string[],
        ignoredRev?: number,
      ): number => {
        const entry: LedgerEntry = {
          seq: ++seq,
          at: now().toISOString(),
          op: String(op),
          target: resolved ?? target ?? null,
          actor,
          revBefore,
          revAfter: rev,
          status,
          changed,
        };
        Object.assign(entry, ledgerTextFor(text, resolved ?? target ?? null));
        if (ignoredRev !== undefined) entry.ignoredRev = ignoredRev;
        log.push(entry);
        if (log.length > ledgerMax) log.splice(0, log.length - ledgerMax);
        return entry.seq;
      };
      const err = (
        code: ErrorResult["error"]["code"],
        message: string,
        extra?: Parameters<typeof errorResult>[2],
      ): ErrorResult => {
        const result = errorResult(code, message, extra);
        const details = result.error.details ?? {};
        details[WIRE.field.seq] = record(code, []);
        result.error.details = details;
        return result;
      };
      if (typeof expectedRev !== "number") {
        return err(
          WIRE.error.invalidInput,
          "expectedRev is required: pass the rev from the observation you are acting on.",
          {
            issues: [
              { path: `/${WIRE.field.expectedRev}`, message: "is required", expected: "number" },
            ],
          },
        );
      }
      if (!(Object.values(WIRE.op) as string[]).includes(op)) {
        return err(
          WIRE.error.invalidInput,
          `Unknown op "${String(op)}". Ops: ${Object.values(WIRE.op).join(", ")}.`,
          {
            issues: [
              {
                path: `/${WIRE.field.op}`,
                message: "unknown op",
                expected: Object.values(WIRE.op).join(" | "),
              },
            ],
          },
        );
      }
      // [S-ACT-6] A target is a non-empty id or a non-negative integer index. Anything else
      // (null, a fraction, NaN, a boolean, an object) is refused here, before any lookup could
      // land it on a row.
      const validTarget =
        (typeof target === "string" && target.length > 0) ||
        (typeof target === "number" && Number.isInteger(target) && target >= 0);
      if (!validTarget) {
        return err(
          WIRE.error.invalidInput,
          "target must be an entry id (a non-empty string) or an index (a non-negative integer) from the observation you are acting on.",
          {
            issues: [
              {
                path: `/${WIRE.field.target}`,
                message: "must be a non-empty string id or a non-negative integer index",
                expected: "string | integer >= 0",
              },
            ],
          },
        );
      }
      // [S-ACT-2] The revision guard runs at the claim, before the target is resolved, so an index
      // observed at an older revision can never land on the row that slid into its slot, and a
      // stale act is refused without waiting behind acts already in flight.
      const stale = (): ErrorResult =>
        err(
          WIRE.error.conflict,
          `The application changed since you observed it (you saw rev ${expectedRev}, it is now ${rev}). Nothing was applied; observe again and choose again.`,
          { retryable: true, details: { expectedRev, currentRev: rev } },
        );
      if (expectedRev !== rev) return stale();
      /**
       * Every check that runs before the handler, in order. Returns the refusal (already
       * ledgered) or what to invoke. It runs at the claim, so a refusal never waits behind acts in
       * flight, and again when a queued act reaches execution [S-ACT-9].
       */
      const prepare = (
        claimEpoch?: number,
      ): ErrorResult | { row: ObservedEntry; invoke: (context: ActContext) => unknown } => {
        revBefore = rev;
        resolved = null;
        // [S-ACT-2] The revision guard runs before the target is resolved, so an index observed at
        // an older revision can never land on the row that slid into its slot.
        if (expectedRev !== rev)
          return err(
            WIRE.error.conflict,
            `The application changed since you observed it (you saw rev ${expectedRev}, it is now ${rev}). Nothing was applied; observe again and choose again.`,
            { retryable: true, details: { expectedRev, currentRev: rev } },
          );
        // [S-ACT-10] A predecessor claimed at the same revision committed without moving it (an
        // app-owned revision the handler did not report): this act was planned on the state that
        // commit replaced.
        if (claimEpoch !== undefined && epoch !== claimEpoch)
          return err(
            WIRE.error.conflict,
            `Another act committed at rev ${rev} while yours waited, and the application has not reported its new revision yet. Nothing was applied; observe again and choose again.`,
            { retryable: true, details: { expectedRev, currentRev: rev } },
          );
        const view = surface.observe();
        // [S-ACT-7] An index resolves only through the observation at this revision, where only
        // actionable rows carry one; an unavailable row (index null) can never be reached by number.
        const row =
          typeof target === "number"
            ? view.entries.find((r) => r.index !== null && r.index === target)
            : view.entries.find((r) => r.id === target);
        if (!row) {
          return err(
            WIRE.error.notFound,
            typeof target === "number"
              ? `No entry has index ${target} at rev ${rev}.`
              : `No entry with id "${target}".`,
            { details: { rev } },
          );
        }
        const e = entries.get(row.id)!;
        resolved = row.id;
        // [S-FRZ-3] While frozen, every act is refused with the freeze's reason; no handler runs.
        if (view.frozen) {
          return err(
            WIRE.error.unavailable,
            `"${row.name}" is not available: ${view.frozen.reason}.`,
            {
              retryable: true,
              details: { rev, reason: view.frozen.reason, frozen: { reason: view.frozen.reason } },
            },
          );
        }
        if (e.kind === "action") {
          if (op !== WIRE.op.click && op !== WIRE.op.toggle)
            return err(
              WIRE.error.invalidInput,
              `${op} is not valid on a ${e.role}; use ${WIRE.op.click} or ${WIRE.op.toggle}.`,
            );
          if (row.state && !row.state.available) {
            const details: Record<string, JsonValue> = {
              rev,
              reason: row.state.reason ?? "unavailable",
            };
            if (row.state.requires) details.requires = row.state.requires as unknown as JsonValue;
            if (row.state.handoff) details.handoff = row.state.handoff as unknown as JsonValue;
            return err(
              WIRE.error.unavailable,
              `"${row.name}" is not available: ${row.state.reason}.`,
              { retryable: true, details },
            );
          }
          if (e.effect.confirm && !confirm)
            return err(WIRE.error.invalidInput, `"${row.name}" requires confirm: true.`, {
              issues: [
                {
                  path: `/${WIRE.field.confirm}`,
                  message: "is required for this action",
                  expected: "true",
                },
              ],
            });
          return { row, invoke: (context) => e.handler(actor, text, context) };
        }
        if (e.kind === "field") {
          if (op !== WIRE.op.typeText)
            return err(
              WIRE.error.invalidInput,
              `${op} is not valid on a ${e.role}; use ${WIRE.op.typeText}.`,
            );
          const ed = e.edit;
          if (ed.readOnly)
            return err(
              WIRE.error.unavailable,
              `"${row.name}" is read only: ${ed.reason ?? "read only"}.`,
              { retryable: false, details: { rev, reason: ed.reason ?? "read only" } },
            );
          const t = text ?? "";
          if (ed.maxLength && t.length > ed.maxLength)
            return err(WIRE.error.invalidInput, `Text is longer than ${ed.maxLength} characters.`, {
              issues: [
                {
                  path: `/${WIRE.field.text}`,
                  message: `must be at most ${ed.maxLength} characters`,
                },
              ],
            });
          if (ed.schema) {
            // A Zod schema validates through its own safeParse; a JSON Schema through the SDK's
            // validator. Neither path imports Zod here.
            const issues: ValidationIssue[] = isSchemaLike(ed.schema)
              ? issuesOf(ed.schema.safeParse(t))
              : validateJsonSchema(ed.schema, t).map((i) => ({
                  ...i,
                  path: `/${WIRE.field.text}${i.path}`,
                }));
            if (issues.length)
              return err(WIRE.error.invalidInput, `Text does not match the field's schema.`, {
                issues,
              });
          }
          return { row, invoke: (context) => ed.set(t, actor, context) };
        }
        if (op !== WIRE.op.scrollDown)
          return err(
            WIRE.error.invalidInput,
            `${op} is not valid on a collection; use ${WIRE.op.scrollDown}.`,
          );
        const more = e.more;
        if (typeof more !== "function")
          return err(WIRE.error.unavailable, `"${row.name}" cannot load more.`, {
            details: { rev },
          });
        return { row, invoke: (context) => more(context) };
      };
      const claimed = prepare();
      if ("status" in claimed) return claimed;
      // [S-ACT-9] The claim holds this revision; the act waits for every act claimed before it.
      // An idle surface runs it now, with nothing in between; a queued act is checked again.
      const claimEpoch = epoch;
      const idle = queued === 0;
      return enqueue(async (): Promise<ActResult> => {
        const ready = idle ? claimed : prepare(claimEpoch);
        if ("status" in ready) return ready;
        const { row } = ready;
        const before = rev;
        revBefore = rev;
        const context: ActContext = { id: row.id, op, expectedRev, actor };
        let report: HandlerReport | undefined;
        let refused: { currentRev?: number } | undefined;
        try {
          report = reportOf(await runner(() => ready.invoke(context) as MaybePromise<unknown>));
          if (report?.conflict) refused = { ...report.conflict };
        } catch (e) {
          // [S-ACT-11] The application's own precondition failed: a refusal, not a failure.
          if (!isSurfaceConflict(e)) {
            // A handler that threw may have written something; acts claimed at this revision
            // before it are refused rather than assumed safe.
            epoch += 1;
            record(WIRE.error.internal, []);
            throw e;
          }
          refused = {};
          if (typeof e.currentRev === "number") refused.currentRev = e.currentRev;
        }
        // [S-ACT-11] The handler refused under its own precondition: `conflict`, a refusal in the
        // ledger, and nothing from the report adopted.
        if (refused) {
          const currentRev = refused.currentRev ?? rev;
          return err(
            WIRE.error.conflict,
            `The application refused "${row.name}": its state changed since rev ${expectedRev}${refused.currentRev !== undefined ? ` (it is at rev ${refused.currentRev})` : ""}. Nothing was applied; observe again and choose again.`,
            { retryable: true, details: { expectedRev, currentRev } },
          );
        }
        // [S-ACT-1] What changed is what the handler reported; when it reported nothing, the
        // entry itself if the revision moved during the handler, else nothing. A reported `rev`
        // is the application's revision after the change, adopted before the result is built,
        // unless a newer revision arrived while the handler ran [S-REV-6].
        let ignoredRev: number | undefined;
        if (report?.rev !== undefined) {
          if (report.rev < rev) ignoredRev = report.rev;
          else surface.setRev(report.rev);
        }
        const changed = report?.changed ?? (rev !== before ? [row.id] : []);
        // [S-ACT-10] A commit that may have changed state closes the claims taken before it at this
        // revision. It provably changed nothing only when the revision stayed put and either the
        // handler said so (`changed: []`) or the surface owns the revision (a change would have
        // bumped it).
        const mayHaveChanged =
          changed.length > 0 || rev !== before || (mode === "app" && report?.changed === undefined);
        if (mayHaveChanged) epoch += 1;
        const output: ActOutput = {
          rev,
          id: row.id,
          actor,
          changed,
          seq: record(WIRE.status.ok, changed, ignoredRev),
        };
        if (report?.notices) output.notices = report.notices;
        return { status: WIRE.status.ok, output };
      });
    },
    ledger({ since, actor: who, limit } = {}) {
      let out: LedgerEntry[] = log;
      if (since !== undefined) out = out.filter((e) => e.seq > since);
      if (who !== undefined) out = out.filter((e) => e.actor === who);
      if (limit !== undefined && limit >= 0 && out.length > limit)
        out = since !== undefined ? out.slice(0, limit) : out.slice(out.length - limit);
      return [...out];
    },
    expose(host = typeof window !== "undefined" ? window : null, opts) {
      if (!host) return;
      (host as { __surface?: unknown }).__surface = {
        observe: surface.observe,
        act: (req: ActRequest) => surface.act(req, opts),
        ledger: (query?: LedgerQuery) => surface.ledger(query),
        rev: surface.currentRev,
      };
    },
    get: (id) => entries.get(id),
    entries: () => [...entries.values()],
    registryVersion: () => registryVersion,
    availability(id) {
      const e = entries.get(id);
      return e ? availabilityOf(e, frozenNow()) : undefined;
    },
    attributesFor(id) {
      const e = entries.get(id);
      if (!e) return undefined;
      const set = attributesOf(e, availabilityOf(e, frozenNow()));
      return { set, remove: SURFACE_ATTRIBUTES.filter((name) => !(name in set)) };
    },
    reset() {
      entries.clear();
      registryVersion += 1;
      listeners.clear();
      freezes.length = 0;
      log.length = 0;
      seq = 0;
      rev = 0;
      mode = pinnedMode ?? "surface";
      convert = options.toJsonSchema;
      app = options.app ?? "app";
      objectsFn = () => ({});
      // Store subscribers are mounted components; they stay and read the empty table.
      changed();
    },
  };
  return surface;
}

/** Convenience: a module-level surface with the same function names as the original `lib/surface.js`. */
export const surface: Surface = createSurface();
export const {
  configure,
  register,
  unregister,
  reconcile,
  freeze,
  seedRev,
  setRev,
  currentRev,
  bump,
  onChange,
  setObjects,
  observe,
  act,
  ledger,
  expose,
} = surface;

export type { Result, Accept, JsonValue, Risk };

/** Issues from a `safeParse` result, with paths under `/text`. */
function issuesOf(result: ReturnType<SchemaLike["safeParse"]>): ValidationIssue[] {
  if (result.success) return [];
  return (result.error?.issues ?? []).map((i) => ({
    path: `/${WIRE.field.text}${i.path.map((p) => `/${String(p)}`).join("")}`,
    message: i.message,
  }));
}

// ---------------------------------------------------------------------------------------------
// DOM mirror (spec §7). Framework-free: these read an entry (registered or observed) and return
// strings, so any renderer can carry the same names a browser agent reads through `observe()`.
// ---------------------------------------------------------------------------------------------

/** Attributes a rendered control carries, as `surfaceAttributes` returns them. Values are strings; React callers use `useSurfaceProps`. */
export type SurfaceAttributes = Record<string, string>;

function isObserved(entry: Entry | ObservedEntry): entry is ObservedEntry {
  return "index" in entry && "rev" in entry;
}

/** The attributes every entry carries: name, id, kind, and object. */
function baseAttributes(entry: Entry | ObservedEntry): SurfaceAttributes {
  const out: SurfaceAttributes = {
    [WIRE.domAttribute.label]: isObserved(entry) ? entry.name : nameOf(entry),
    [WIRE.domAttribute.surfaceId]: entry.id,
    [WIRE.domAttribute.surfaceKind]: entry.kind,
  };
  if (entry.object) out[WIRE.domAttribute.surfaceObject] = entry.object;
  return out;
}

/**
 * The attributes the control for `entry` carries [S-DOM-1], read from the entry itself: `aria-label`
 * (the entry name, so browser agents and screen readers read the outcome), `data-surface-id`,
 * `data-surface-kind`, `data-surface-object` when the entry has one, `aria-disabled="true"` plus
 * `data-surface-reason` on an unavailable action, and `aria-readonly="true"` plus
 * `data-surface-reason` on a read-only field. Collections carry the common set only. Set them on
 * the element that receives the interaction; `surfaceSelector(id)` finds it again.
 *
 * This is the static reading: it knows the entry's own `state` and `edit` and nothing of a freeze,
 * and it returns only what to set. For a control that is re-rendered while the surface lives, use
 * `surface.attributesFor(id)`, which reads the live availability and also says what to remove.
 */
export function surfaceAttributes(entry: Entry | ObservedEntry): SurfaceAttributes {
  const out = baseAttributes(entry);
  if (entry.kind === "action") {
    const s = entry.state ?? { available: true, reason: null };
    if (!s.available) {
      out[WIRE.domAttribute.disabled] = "true";
      out[WIRE.domAttribute.surfaceReason] = s.reason || "unavailable";
    }
  } else if (entry.kind === "field" && entry.edit?.readOnly) {
    out[WIRE.domAttribute.readOnly] = "true";
    out[WIRE.domAttribute.surfaceReason] = entry.edit.reason ?? "read only";
  }
  return out;
}

/**
 * A CSS selector for the control that carries `data-surface-id` equal to `id` [S-DOM-3]. The id
 * is quoted and escaped, so ids with colons, spaces, quotes, or backslashes work as they are.
 */
export function surfaceSelector(id: string): string {
  const escaped = String(id).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\a ");
  return `[${WIRE.domAttribute.surfaceId}="${escaped}"]`;
}

/**
 * One plain-text line about an entry, for a screen reader or an agent log [S-DOM-4]:
 * `Draft Jahmyr Gibbs (RB): unavailable, already drafted by another team; mutates draft, reversible, risk medium`.
 */
export function describeEntry(entry: Entry | ObservedEntry): string {
  const name = isObserved(entry) ? entry.name : nameOf(entry);
  if (entry.kind === "action") {
    const s = entry.state ?? { available: true, reason: null };
    const f = entry.effect;
    const parts = [`mutates ${f?.mutates ?? "state"}`];
    if (f?.idempotent) parts.push("idempotent");
    const reversible = isObserved(entry)
      ? !!f?.reversible
      : !!((f as Effect | undefined)?.reversible ?? (f as Effect | undefined)?.undoable);
    parts.push(reversible ? "reversible" : "not reversible");
    parts.push(`risk ${f?.risk ?? WIRE.risk.medium}`);
    if (f?.confirm) parts.push("confirm required");
    const availability = s.available ? "available" : `unavailable, ${s.reason || "unavailable"}`;
    return `${name}: ${availability}; ${parts.join(", ")}`;
  }
  if (entry.kind === "field") {
    const ed = entry.edit;
    const parts: string[] = [];
    parts.push(ed?.readOnly ? `read only, ${ed.reason ?? "read only"}` : "editable");
    // [S-PRV-1] A sensitive field's value is never described.
    if (isSensitive(entry)) parts.push("value hidden");
    else if (entry.value !== undefined && entry.value !== null)
      parts.push(`value ${JSON.stringify(entry.value)}`);
    const max = ed && !ed.readOnly ? ed.maxLength : null;
    if (max) parts.push(`up to ${max} characters`);
    return `${name}: ${parts.join(", ")}`;
  }
  const total = entry.total ?? null;
  const loaded = entry.loaded ?? null;
  const parts: string[] = [];
  if (loaded !== null && total !== null) parts.push(`${loaded} of ${total} loaded`);
  else if (total !== null) parts.push(`${total} items`);
  else if (loaded !== null) parts.push(`${loaded} loaded`);
  else parts.push("collection");
  const more = isObserved(entry) ? entry.index !== null : typeof entry.more === "function";
  parts.push(more ? "can load more" : "cannot load more");
  return `${name}: ${parts.join(", ")}`;
}

// ---------------------------------------------------------------------------------------------
// SHA-256 (FIPS 180-4), synchronous and dependency-free, for the ledger's `hash` text policy. The
// surface runs in browsers, where Web Crypto is asynchronous, and the ledger is written in-line.
// ---------------------------------------------------------------------------------------------
const K256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

/** Hex SHA-256 of a string's UTF-8 bytes. */
function sha256Hex(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const bitLength = bytes.length * 8;
  const padded = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(padded.length - 4, bitLength >>> 0);
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15]!;
      const b = w[i - 2]!;
      const s0 = rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3);
      const s1 = rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, k] = [h[0]!, h[1]!, h[2]!, h[3]!, h[4]!, h[5]!, h[6]!, h[7]!];
    for (let i = 0; i < 64; i++) {
      const t1 =
        (k + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K256[i]! + w[i]!) >>>
        0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      k = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0]! + a) >>> 0;
    h[1] = (h[1]! + b) >>> 0;
    h[2] = (h[2]! + c) >>> 0;
    h[3] = (h[3]! + d) >>> 0;
    h[4] = (h[4]! + e) >>> 0;
    h[5] = (h[5]! + f) >>> 0;
    h[6] = (h[6]! + g) >>> 0;
    h[7] = (h[7]! + k) >>> 0;
  }
  return Array.from(h, (x) => x.toString(16).padStart(8, "0")).join("");
}
