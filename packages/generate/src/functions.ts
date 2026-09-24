/**
 * `fromFunctions`: actions from a table of zod-typed functions (server actions, service methods,
 * the procedures behind a tRPC router). The table is the definition; nothing is written twice.
 */
import { z } from "@axe/core";
import type { ActionSpec, HandlerContext, HandlerReturn, MaybePromise } from "@axe/core";
import type { AuthMode, Risk } from "@axe/core/types";
import type { ActionSource, GeneratedAction, GeneratedSpec, GenerateWarning } from "./types";

type SpecExtras = Pick<
  ActionSpec<z.ZodType, z.ZodType>,
  | "display"
  | "affordances"
  | "pagination"
  | "freshness"
  | "humanHandoff"
  | "deprecated"
  | "onContinue"
  | "onResume"
  | "onPoll"
>;

/** One entry of a function table. `input` must be a `z.object()`; `output` defaults to an open object. */
export interface FunctionEntry<
  I extends z.ZodObject = z.ZodObject,
  O extends z.ZodType = z.ZodType,
> extends Partial<SpecExtras> {
  title?: string;
  /** Required for the action to be generated; the generator never writes one. */
  description?: string;
  input: I;
  output?: O;
  /** `(input, ctx)`: the function you already have, with the AXE context second when it wants it. */
  handler: (
    input: z.output<I>,
    ctx: HandlerContext<z.output<I>>,
  ) => MaybePromise<HandlerReturn<z.input<O>>>;
  readOnly?: boolean;
  idempotent?: boolean;
  reversible?: boolean;
  /** Required for mutations unless `policy.defaultRisk` supplies one. Reads default to `low`. */
  risk?: Risk;
  auth?: AuthMode;
  examples?: { input: z.input<I>; output: z.input<O> }[];
}

export type FunctionTable = Record<string, FunctionEntry>;

export interface FunctionsOptions {
  /** `provenance.source` for these actions. Default `functions`. */
  source?: string;
}

/**
 * Derive action candidates from a table keyed by action name. Each handler's `input` parameter
 * is typed from its entry's `input` schema; the return value is validated at runtime against
 * `output`.
 */
export function fromFunctions<S extends Record<string, z.ZodObject>>(
  table: { [K in keyof S]: FunctionEntry<S[K], z.ZodType> },
  options: FunctionsOptions = {},
): ActionSource {
  const source = options.source ?? "functions";
  return {
    source,
    actions() {
      return Object.entries(table as FunctionTable).map(([name, entry]) =>
        entryToCandidate(name, entry, source),
      );
    },
  };
}

function entryToCandidate(name: string, entry: FunctionEntry, source: string): GeneratedAction {
  const warnings: GenerateWarning[] = [];
  const {
    handler,
    output,
    title,
    description,
    risk,
    readOnly,
    idempotent,
    reversible,
    auth,
    examples,
    ...rest
  } = entry;
  let outputSchema: z.ZodType | undefined = output;
  if (!outputSchema) {
    outputSchema = z.object({}).loose();
    warnings.push({
      code: "missing-output",
      action: name,
      ref: name,
      field: "output",
      message:
        "No output schema; the action declares an open object, so agents are not told what it returns. Add output for a typed result.",
    });
  }
  const spec: GeneratedSpec = {
    input: entry.input,
    output: outputSchema,
    handler: (ctx) =>
      handler(ctx.input as Record<string, unknown>, ctx as HandlerContext<Record<string, unknown>>),
  };
  if (title !== undefined) spec.title = title;
  if (description !== undefined) spec.description = description;
  if (risk !== undefined) spec.risk = risk;
  if (readOnly !== undefined) spec.readOnly = readOnly;
  if (idempotent !== undefined) spec.idempotent = idempotent;
  if (reversible !== undefined) spec.reversible = reversible;
  if (auth !== undefined) spec.auth = auth;
  if (examples !== undefined) spec.examples = examples;
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined) (spec as unknown as Record<string, unknown>)[k] = v;
  }
  if (!title) spec.title = humanizeName(name);
  return { name, spec, provenance: { source, ref: name }, warnings };
}

function humanizeName(name: string): string {
  const last = name.split(".").pop() ?? name;
  const words = last.split("-").filter(Boolean);
  if (words.length === 0) return name;
  return [words[0]!.charAt(0).toUpperCase() + words[0]!.slice(1), ...words.slice(1)].join(" ");
}

// ---------------------------------------------------------------------------
// tRPC, structurally: no dependency on tRPC itself.
// ---------------------------------------------------------------------------

/** The `meta` a procedure can carry (`publicProcedure.meta({...})`) that the generator reads. */
export interface TRPCProcedureMeta {
  title?: string;
  description?: string;
  risk?: Risk;
  idempotent?: boolean;
  reversible?: boolean;
  auth?: AuthMode;
  [key: string]: unknown;
}

/** The slice of a tRPC procedure definition the adapter reads (v10 and v11 shapes). */
export interface TRPCProcedureLike {
  _def: {
    type?: "query" | "mutation" | "subscription";
    query?: boolean;
    mutation?: boolean;
    subscription?: boolean;
    inputs?: unknown[];
    output?: unknown;
    meta?: TRPCProcedureMeta;
  };
}

/** The slice of a tRPC router the adapter reads: a flat table of procedures by dotted path, and a caller factory. */
export interface TRPCRouterLike<Ctx = unknown> {
  _def: { procedures: Record<string, TRPCProcedureLike> };
  createCaller(ctx: Ctx): unknown;
}

export interface TRPCOptions<Ctx> {
  /** Build the tRPC context for a call from the AXE handler context. */
  createContext: (ctx: HandlerContext<unknown>) => MaybePromise<Ctx>;
  /** Prefix for action names when procedure paths have a single segment (`hello` → `<namespace>.hello`). Default `trpc`. */
  namespace?: string;
}

function isZodObject(v: unknown): v is z.ZodObject {
  return v instanceof z.ZodObject;
}

function isZodType(v: unknown): v is z.ZodType {
  return (
    typeof v === "object" &&
    v !== null &&
    "_zod" in v &&
    typeof (v as z.ZodType).safeParse === "function"
  );
}

/**
 * Derive action candidates from a tRPC router without depending on tRPC: procedures are read
 * from `_def.procedures`, called through `createCaller`. Queries are read-only; mutations need a
 * `risk` in their `meta` or an override; subscriptions are skipped.
 */
export function fromTRPCRouter<Ctx>(
  router: TRPCRouterLike<Ctx>,
  options: TRPCOptions<Ctx>,
): ActionSource {
  const namespace = options.namespace ?? "trpc";
  return {
    source: "trpc",
    actions() {
      const out: GeneratedAction[] = [];
      const skipped: GenerateWarning[] = [];
      for (const [path, procedure] of Object.entries(router._def.procedures)) {
        const def = procedure._def;
        const type =
          def.type ??
          (def.query
            ? "query"
            : def.mutation
              ? "mutation"
              : def.subscription
                ? "subscription"
                : undefined);
        const name = path.includes(".") ? path : `${namespace}.${path}`;
        const ref = `trpc:${path}`;
        if (type === "subscription" || type === undefined) {
          skipped.push({
            code: "excluded",
            action: name,
            ref,
            message: `Procedure "${path}" is a ${type ?? "procedure of unknown type"}; only queries and mutations become actions.`,
            dropped: true,
          });
          continue;
        }
        const warnings: GenerateWarning[] = [];
        const inputs = (def.inputs ?? []).filter(isZodType);
        let input: z.ZodObject;
        if (inputs.length === 0) input = z.object({});
        else if (inputs.every(isZodObject)) {
          input = inputs.reduce<z.ZodObject>(
            (acc, next) => acc.extend(next.shape as Record<string, z.ZodType>),
            z.object({}),
          );
        } else {
          skipped.push({
            code: "unsupported-schema",
            action: name,
            ref,
            field: "input",
            message: `Procedure "${path}" has an input that is not a z.object(); AXE inputs must be objects. Wrap it or expose it through fromFunctions.`,
            dropped: true,
          });
          continue;
        }
        let output: z.ZodType;
        let wrap = false;
        if (isZodType(def.output)) {
          if (def.output instanceof z.ZodObject) output = def.output;
          else {
            output = z.object({ result: def.output });
            wrap = true;
          }
        } else {
          output = z.object({}).loose();
          warnings.push({
            code: "missing-output",
            action: name,
            ref,
            field: "output",
            message: `Procedure "${path}" declares no .output(); the action declares an open object.`,
          });
        }
        const meta = def.meta ?? {};
        const spec: GeneratedSpec = {
          title: meta.title ?? humanizeName(name),
          input,
          output,
          readOnly: type === "query",
          handler: async (ctx) => {
            const caller = (await options.createContext(ctx)) as Ctx;
            const fn = resolveCaller(router.createCaller(caller), path);
            const result = await fn(ctx.input);
            return wrap ? { result } : result;
          },
        };
        if (meta.description) spec.description = meta.description;
        if (meta.risk) spec.risk = meta.risk;
        if (meta.idempotent !== undefined) spec.idempotent = meta.idempotent;
        if (meta.reversible !== undefined) spec.reversible = meta.reversible;
        if (meta.auth) spec.auth = meta.auth;
        out.push({ name, spec, provenance: { source: "trpc", ref }, warnings });
      }
      return { actions: out, warnings: skipped };
    },
  };
}

function resolveCaller(caller: unknown, path: string): (input: unknown) => Promise<unknown> {
  let node: unknown = caller;
  for (const seg of path.split(".")) {
    if (node === null || (typeof node !== "object" && typeof node !== "function")) break;
    node = (node as Record<string, unknown>)[seg];
  }
  if (typeof node !== "function") {
    throw new Error(`fromTRPCRouter: createCaller() has no procedure at "${path}".`);
  }
  return node as (input: unknown) => Promise<unknown>;
}
