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
}

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
}

/** `act()` returns the AXE result envelope: `ok`, or `error` with `conflict` (stale), `not_found`, `invalid_input`, or `unavailable`. */
export type ActResult = OkResult<ActOutput> | ErrorResult;

export interface SurfaceOptions {
  app?: string;
  /** Clock for `observe().at`; injectable for deterministic tests and builds. */
  now?: () => Date;
}

export interface Surface {
  configure(options: { app?: string }): void;
  register(entry: Entry): void;
  unregister(id: string): void;
  /** Drop every entry whose id starts with `prefix` and is not in `keep`. Adapters that re-scan a rendered region use this. */
  reconcile(prefix: string, keep: Set<string>): void;
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
  /** Publish `observe`, `act`, and `rev` on a host object (`window.__surface`) for browser agents. */
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

function err(
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
          if (s.available) {
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
          row.edit = {
            op: WIRE.op.typeText,
            maxLength: ed.readOnly ? null : (ed.maxLength ?? null),
            readOnly: !!ed.readOnly,
            reason: ed.readOnly ? (ed.reason ?? "read only") : null,
          };
          if (!ed.readOnly && ed.schema)
            row.edit.schema = isZodSchema(ed.schema)
              ? toJsonSchema(ed.schema, "input")
              : (ed.schema as JsonSchema);
          if (!ed.readOnly) row.index = ++i;
        } else {
          row.total = e.total ?? null;
          row.loaded = e.loaded ?? null;
          row.filter = e.filter ?? null;
          row.sort = e.sort ?? null;
          if (typeof e.more === "function") row.index = ++i;
        }
        out.push(row);
      }
      return {
        protocol: WIRE.protocol.version,
        app,
        rev,
        at: now().toISOString(),
        entries: out,
        objects: objectsFn(),
      };
    },
    async act(
      req,
      {
        run = (fn: () => MaybePromise<unknown>) => fn(),
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
      if (expectedRev !== rev) {
        return err(
          WIRE.error.conflict,
          `The application changed since you observed it (you saw rev ${expectedRev}, it is now ${rev}). Nothing was applied; observe again and choose again.`,
          { retryable: true, details: { rev, expectedRev } },
        );
      }
      const view = surface.observe();
      const row =
        typeof target === "number"
          ? view.entries.find((r) => r.index === target)
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
      const before = rev;
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
      return {
        status: WIRE.status.ok,
        output: { rev, id: row.id, actor, changed: rev !== before ? [row.id] : [] },
      };
    },
    expose(host = typeof window !== "undefined" ? window : null, opts) {
      if (!host) return;
      (host as { __surface?: unknown }).__surface = {
        observe: surface.observe,
        act: (req: ActRequest) => surface.act(req, opts),
        rev: surface.currentRev,
      };
    },
    get: (id) => entries.get(id),
    reset() {
      entries.clear();
      listeners.clear();
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
  seedRev,
  setRev,
  currentRev,
  bump,
  onChange,
  setObjects,
  observe,
  act,
  expose,
} = surface;

export type { Result, Accept, JsonValue, Risk };
