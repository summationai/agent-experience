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
  Handoff,
  JsonSchema,
  JsonValue,
  OkResult,
  ErrorResult,
  Result,
  Risk,
  ValidationIssue,
} from "@axe/core/types";
import type { AcceptInput } from "@axe/core/kinds";
import { isZodSchema, toJsonSchema } from "@axe/core";
import { validateJsonSchema } from "@axe/core/schemas";
import * as WIRE from "@axe/core/vocabulary";

export type MaybePromise<T> = T | Promise<T>;
export type Op = "CLICK" | "TOGGLE" | "TYPE_TEXT" | "SCROLL_DOWN";
export type EntryKind = "action" | "field" | "collection";

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

/** A handoff the application declares for a control only a human can activate. */
export interface HandoffSpec {
  reason: string;
  instructions: string;
  url: string;
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
  handler: (actor: string, text?: string) => MaybePromise<unknown>;
}

export interface FieldEntry {
  id: string;
  kind: "field";
  role: "textbox" | "searchbox" | "spinbutton" | string;
  name: string | (() => string);
  object?: string;
  value?: JsonValue;
  edit:
    | { op?: "TYPE_TEXT"; readOnly: true; reason?: string }
    | {
        op?: "TYPE_TEXT";
        readOnly?: false;
        maxLength?: number;
        /** Validate the typed text before `set` runs. A Zod schema or a JSON Schema for a string. */
        schema?: JsonSchema | { safeParse: unknown };
        set: (text: string, actor: string) => MaybePromise<unknown>;
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
  /** Load more. Present makes the collection actionable with `SCROLL_DOWN`. */
  more?: () => MaybePromise<unknown>;
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
  state?: {
    available: boolean;
    reason: string | null;
    requires?: Accept[];
    handoff?: Omit<Handoff, "resumeToken" | "expiresAt">;
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
  text?: string;
  /** Entry ids whose state the act moved; empty for a refusal. */
  changed: string[];
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
  /** Ledger retention. `max` is the number of most recent entries kept; default 1000. */
  ledger?: { max?: number };
}

export interface Surface {
  configure(options: { app?: string }): void;
  register(entry: Entry): void;
  unregister(id: string): void;
  /** Drop every entry whose id starts with `prefix` and is not in `keep`. Adapters that re-scan a rendered region use this. */
  reconcile(prefix: string, keep: Set<string>): void;
  /**
   * Report every entry unavailable with `reason` while a transient state lasts (a save in flight,
   * a modal open). Moves the revision now and again on `thaw`, so an act planned before the freeze
   * is refused as `conflict` and one planned during it as `unavailable`. Freezes nest: the surface
   * thaws when the last one is released.
   */
  freeze(reason: string): Thaw;
  /** Adopt a persisted revision if it is ahead of the current one. */
  seedRev(n: number): void;
  /** The application owns the counter: adopt its value as is. */
  setRev(n: number): void;
  currentRev(): number;
  /** Advance the revision after a change and notify listeners. */
  bump(meta?: Record<string, JsonValue>): number;
  onChange(fn: (event: { rev: number } & Record<string, JsonValue>) => void): () => void;
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
  /** Forget everything. Tests. */
  reset(): void;
}

function nameOf(e: Entry): string {
  return typeof e.name === "function" ? e.name() : e.name;
}

function toAccept(entry: AcceptInput): Accept {
  const out: Accept = {
    kind: entry.kind,
    title: entry.title ?? entry.kind,
    description: entry.description,
    schema: isZodSchema(entry.schema)
      ? toJsonSchema(entry.schema, "input")
      : (entry.schema as JsonSchema),
    sensitive: entry.sensitive,
  };
  if (entry.instructions !== undefined) out.instructions = entry.instructions;
  return out;
}

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

  const surface: Surface = {
    configure({ app: name }) {
      if (name) app = String(name);
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
      } else if (entry.kind === "field") {
        if (!entry.edit) throw new Error(`surface.register(${entry.id}): a field needs edit.`);
        if (!entry.edit.readOnly && typeof (entry.edit as { set?: unknown }).set !== "function")
          throw new Error(`surface.register(${entry.id}): an editable field needs edit.set.`);
      } else if (entry.kind !== "collection") {
        throw new Error(
          `surface.register(${(entry as Entry).id}): kind must be action, field, or collection.`,
        );
      }
      entries.set(entry.id, entry);
    },
    unregister(id) {
      entries.delete(id);
    },
    reconcile(prefix, keep) {
      for (const id of [...entries.keys()])
        if (id.startsWith(prefix) && !keep.has(id)) entries.delete(id);
    },
    freeze(reason) {
      const hold: Frozen = { reason: String(reason || "busy") };
      freezes.push(hold);
      surface.bump({ frozen: hold.reason });
      let released = false;
      const thaw: Thaw = () => {
        if (released) return;
        released = true;
        const i = freezes.indexOf(hold);
        if (i >= 0) freezes.splice(i, 1);
        surface.bump({ thawed: hold.reason });
      };
      return thaw;
    },
    seedRev(n) {
      if (Number.isFinite(n) && n > rev) rev = n;
    },
    setRev(n) {
      if (Number.isFinite(n)) rev = n;
    },
    currentRev: () => rev,
    bump(meta = {}) {
      rev += 1;
      for (const fn of listeners) fn({ ...meta, rev });
      return rev;
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
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
        if (e.kind === "action") {
          const s = e.state ?? { available: true };
          if (frozen) {
            // A freeze supersedes the control's own state: nothing is actionable, and there is
            // nothing to fulfill or hand off until it lifts.
            row.state = { available: false, reason: frozen.reason };
          } else if (s.available) {
            row.state = { available: true, reason: null };
            row.index = ++i;
          } else {
            row.state = { available: false, reason: s.reason || "unavailable" };
            if (s.requires) row.state.requires = s.requires.accepts.map(toAccept);
            if (s.handoff) row.state.handoff = { ...s.handoff };
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
        } else if (e.kind === "field") {
          row.value = e.value ?? null;
          const ed = e.edit;
          const readOnly = !!ed.readOnly || !!frozen;
          row.edit = {
            op: WIRE.op.typeText,
            maxLength: readOnly ? null : (ed.maxLength ?? null),
            readOnly,
            reason: frozen ? frozen.reason : ed.readOnly ? (ed.reason ?? "read only") : null,
          };
          if (!readOnly && !ed.readOnly && ed.schema)
            row.edit.schema = isZodSchema(ed.schema)
              ? toJsonSchema(ed.schema, "input")
              : (ed.schema as JsonSchema);
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
      // handler that threw.
      const revBefore = rev;
      let resolved: string | null = null;
      const record = (status: LedgerEntry["status"], changed: string[]): number => {
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
        if (text !== undefined) entry.text = text;
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
      const run = async (fn: () => MaybePromise<unknown>) => {
        try {
          return await runner(fn);
        } catch (e) {
          record(WIRE.error.internal, []);
          throw e;
        }
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
      // [S-ACT-2] The revision guard runs before the target is resolved, so an index observed at an
      // older revision can never land on the row that slid into its slot.
      if (expectedRev !== rev) {
        return err(
          WIRE.error.conflict,
          `The application changed since you observed it (you saw rev ${expectedRev}, it is now ${rev}). Nothing was applied; observe again and choose again.`,
          { retryable: true, details: { expectedRev, currentRev: rev } },
        );
      }
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
      const before = rev;
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
        await run(() => e.handler(actor, text));
      } else if (e.kind === "field") {
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
          const schema = isZodSchema(ed.schema)
            ? toJsonSchema(ed.schema, "input")
            : (ed.schema as JsonSchema);
          const issues = validateJsonSchema(schema, t).map((i) => ({
            ...i,
            path: `/${WIRE.field.text}${i.path}`,
          }));
          if (issues.length)
            return err(WIRE.error.invalidInput, `Text does not match the field's schema.`, {
              issues,
            });
        }
        await run(() => ed.set(t, actor));
      } else {
        if (op !== WIRE.op.scrollDown)
          return err(
            WIRE.error.invalidInput,
            `${op} is not valid on a collection; use ${WIRE.op.scrollDown}.`,
          );
        if (typeof e.more !== "function")
          return err(WIRE.error.unavailable, `"${row.name}" cannot load more.`, {
            details: { rev },
          });
        await run(() => e.more!());
      }
      const changed = rev !== before ? [row.id] : [];
      return {
        status: WIRE.status.ok,
        output: { rev, id: row.id, actor, changed, seq: record(WIRE.status.ok, changed) },
      };
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
    reset() {
      entries.clear();
      listeners.clear();
      freezes.length = 0;
      log.length = 0;
      seq = 0;
      rev = 0;
      app = options.app ?? "app";
      objectsFn = () => ({});
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

// ---------------------------------------------------------------------------------------------
// DOM mirror (spec §7). Framework-free: these read an entry (registered or observed) and return
// strings, so any renderer can carry the same names a browser agent reads through `observe()`.
// ---------------------------------------------------------------------------------------------

/** Attributes a rendered control carries, as `surfaceAttributes` returns them. Values are strings; React callers use `useSurfaceProps`. */
export type SurfaceAttributes = Record<string, string>;

function isObserved(entry: Entry | ObservedEntry): entry is ObservedEntry {
  return "index" in entry && "rev" in entry;
}

/**
 * The attributes the control for `entry` carries [S-DOM-1]: `aria-label` (the entry name, so
 * browser agents and screen readers read the outcome), `data-surface-id`, `data-surface-kind`,
 * `data-surface-object` when the entry has one, `aria-disabled="true"` plus `data-surface-reason`
 * on an unavailable action, and `aria-readonly="true"` plus `data-surface-reason` on a read-only
 * field. Collections carry the common set only. Set them on the element that receives the
 * interaction; `surfaceSelector(id)` finds it again.
 */
export function surfaceAttributes(entry: Entry | ObservedEntry): SurfaceAttributes {
  const name = isObserved(entry) ? entry.name : nameOf(entry);
  const out: SurfaceAttributes = {
    [WIRE.domAttribute.label]: name,
    [WIRE.domAttribute.surfaceId]: entry.id,
    [WIRE.domAttribute.surfaceKind]: entry.kind,
  };
  if (entry.object) out[WIRE.domAttribute.surfaceObject] = entry.object;
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
    if (entry.value !== undefined && entry.value !== null)
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
