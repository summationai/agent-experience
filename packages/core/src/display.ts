/**
 * Presentation: validate `display`/`affordances`/`pagination`/`freshness` against
 * schemas, and resolve them against a real output into a `PresentedResult`.
 * Zod-free so `@axe/client` can bundle it.
 */
import type {
  ActionDefinition,
  Affordance,
  AttributeFormat,
  AxeReserved,
  Brand,
  CompareDirection,
  Display,
  DynamicAffordance,
  JsonPointer,
  JsonSchema,
  JsonValue,
  PricePeriod,
} from "./types";
import {
  getPointer,
  itemSchemaOf,
  parsePointer,
  resolvePointerInSchema,
  schemaIsArray,
} from "./pointer";
import { WIRE } from "./vocabulary";

export const MAX_AFFORDANCES = 6;
const RESERVED_KEY = WIRE.field.axeReserved;

// ---------------------------------------------------------------------------
// Validation at registration
// ---------------------------------------------------------------------------

/** Thrown when display, affordance, pagination, or freshness declarations do not fit the schemas. */
export class DisplayValidationError extends Error {
  constructor(
    readonly action: string,
    readonly location: string,
    message: string,
  ) {
    super(`Action "${action}": ${location}: ${message}`);
    this.name = "DisplayValidationError";
  }
}

function requirePointer(action: string, location: string, pointer: unknown): JsonPointer {
  if (typeof pointer !== "string") {
    throw new DisplayValidationError(
      action,
      location,
      `expected a JSON Pointer string, received ${JSON.stringify(pointer)}`,
    );
  }
  try {
    parsePointer(pointer);
  } catch (e) {
    throw new DisplayValidationError(action, location, (e as Error).message);
  }
  return pointer;
}

function requireResolves(
  action: string,
  location: string,
  pointer: JsonPointer,
  schema: JsonSchema,
  root: JsonSchema,
  what: string,
): JsonSchema {
  const sub = resolvePointerInSchema(schema, pointer, root);
  if (!sub) {
    throw new DisplayValidationError(
      action,
      location,
      `pointer "${pointer}" does not resolve to a location in the ${what} schema. Pointers are RFC 6901 and relative to ${what === "output" ? "the output object" : `one element of display.items`}; check the property name and nesting.`,
    );
  }
  return sub;
}

/**
 * Validate an action's `display` against its output schema. Returns the schema of
 * one item (the element schema at `display.items`, or the output schema itself).
 */
export function validateDisplay(action: string, display: Display, output: JsonSchema): JsonSchema {
  const root = output;
  let itemSchema: JsonSchema = output;
  const isCollection =
    display.kind === WIRE.displayKind.list || display.kind === WIRE.displayKind.table;
  if (isCollection) {
    if (display.items === undefined) {
      throw new DisplayValidationError(
        action,
        "display.items",
        `display.kind "${display.kind}" requires display.items, a pointer to the array of items in output`,
      );
    }
    const p = requirePointer(action, "display.items", display.items);
    const arr = requireResolves(action, "display.items", p, output, root, "output");
    if (!schemaIsArray(arr, root)) {
      throw new DisplayValidationError(
        action,
        "display.items",
        `pointer "${p}" resolves to a schema that is not an array`,
      );
    }
    const el = itemSchemaOf(arr, root);
    if (!el) {
      throw new DisplayValidationError(
        action,
        "display.items",
        `array at "${p}" has no items schema`,
      );
    }
    itemSchema = el;
  } else if (display.items !== undefined) {
    throw new DisplayValidationError(
      action,
      "display.items",
      `display.items is only valid when display.kind is "list" or "table"`,
    );
  }

  const item = display.item;
  if (!item) {
    if (isCollection)
      throw new DisplayValidationError(
        action,
        "display.item",
        "display.item is required for list and table displays",
      );
    return itemSchema;
  }
  const check = (loc: string, pointer: unknown) => {
    const p = requirePointer(action, loc, pointer);
    requireResolves(action, loc, p, itemSchema, root, isCollection ? "item" : "output");
  };
  check("display.item.id", item.id);
  check("display.item.title", item.title);
  if (item.subtitle !== undefined) check("display.item.subtitle", item.subtitle);
  if (item.summary !== undefined) check("display.item.summary", item.summary);
  if (item.url !== undefined) check("display.item.url", item.url);
  if (item.image !== undefined) {
    const list = Array.isArray(item.image) ? item.image : [item.image];
    list.forEach((p, i) => check(`display.item.image[${i}]`, p));
  }
  if (item.price) {
    check("display.item.price.amount", item.price.amount);
    if (item.price.currency.startsWith("/"))
      check("display.item.price.currency", item.price.currency);
    else if (!/^[A-Z]{3}$/.test(item.price.currency)) {
      throw new DisplayValidationError(
        action,
        "display.item.price.currency",
        `must be a JSON Pointer or an ISO 4217 code, received "${item.price.currency}"`,
      );
    }
  }
  const labels = new Set<string>();
  for (const [i, attr] of (item.attributes ?? []).entries()) {
    check(`display.item.attributes[${i}].path`, attr.path);
    if (!attr.label || !attr.label.trim()) {
      throw new DisplayValidationError(
        action,
        `display.item.attributes[${i}].label`,
        "label is required",
      );
    }
    if (labels.has(attr.label)) {
      throw new DisplayValidationError(
        action,
        `display.item.attributes[${i}].label`,
        `duplicate label "${attr.label}"`,
      );
    }
    labels.add(attr.label);
  }
  for (const [i, p] of (item.badges ?? []).entries()) check(`display.item.badges[${i}]`, p);
  for (const label of display.suggestedComparison ?? []) {
    if (!labels.has(label)) {
      throw new DisplayValidationError(
        action,
        "display.suggestedComparison",
        `"${label}" is not an attribute label`,
      );
    }
  }
  return itemSchema;
}

/**
 * Validate static affordances. `targetInput` returns the target action's input
 * schema, or `undefined` when the target is not (yet) registered; unresolved targets
 * are returned so the caller can check them later.
 */
export function validateAffordances(
  action: string,
  affordances: Affordance[],
  itemSchema: JsonSchema,
  root: JsonSchema,
  targetInput: (name: string) => JsonSchema | undefined,
): string[] {
  if (affordances.length > MAX_AFFORDANCES) {
    throw new DisplayValidationError(
      action,
      "affordances",
      `${affordances.length} affordances declared; the maximum is ${MAX_AFFORDANCES} (spec [P-AFF-2])`,
    );
  }
  const primaries = affordances.filter((a) => a.primary).length;
  if (primaries > 1) {
    throw new DisplayValidationError(
      action,
      "affordances",
      `${primaries} affordances are marked primary; at most one is allowed (spec [P-AFF-2])`,
    );
  }
  const unresolved: string[] = [];
  for (const [i, aff] of affordances.entries()) {
    const loc = `affordances[${i}]`;
    if (!aff.action || typeof aff.action !== "string") {
      throw new DisplayValidationError(action, `${loc}.action`, "must name a registered action");
    }
    if (!aff.title || !aff.title.trim()) {
      throw new DisplayValidationError(action, `${loc}.title`, "title is required");
    }
    for (const [key, pointer] of Object.entries(aff.input ?? {})) {
      const p = requirePointer(action, `${loc}.input.${key}`, pointer);
      requireResolves(action, `${loc}.input.${key}`, p, itemSchema, root, "item");
    }
    const target = targetInput(aff.action);
    if (!target) {
      unresolved.push(aff.action);
      continue;
    }
    validateAffordanceBinding(action, i, aff, target);
  }
  return unresolved;
}

/** Check that every bound key exists at the top level of the target action's input schema. */
export function validateAffordanceBinding(
  action: string,
  index: number,
  aff: Affordance,
  targetInput: JsonSchema,
): void {
  const props = (targetInput["properties"] ?? {}) as Record<string, unknown>;
  for (const key of Object.keys(aff.input ?? {})) {
    if (!(key in props)) {
      throw new DisplayValidationError(
        action,
        `affordances[${index}].input.${key}`,
        `"${key}" is not a top-level property of the input schema of "${aff.action}". Bound keys: ${Object.keys(props).join(", ") || "(none)"}.`,
      );
    }
  }
}

/** Validate pagination pointers against the input and output schemas. */
export function validatePagination(
  action: string,
  pagination: ActionDefinition["pagination"],
  input: JsonSchema,
  output: JsonSchema,
): void {
  if (!pagination) return;
  const cIn = requirePointer(action, "pagination.cursorIn", pagination.cursorIn);
  requireResolves(action, "pagination.cursorIn", cIn, input, input, "input");
  const cOut = requirePointer(action, "pagination.cursorOut", pagination.cursorOut);
  requireResolves(action, "pagination.cursorOut", cOut, output, output, "output");
  const { default: d, max } = pagination.pageSize;
  if (!Number.isInteger(d) || !Number.isInteger(max) || d < 1 || max < d) {
    throw new DisplayValidationError(
      action,
      "pagination.pageSize",
      `default (${d}) must be >= 1 and max (${max}) must be >= default`,
    );
  }
}

/** Validate freshness pointers against the output schema. */
export function validateFreshness(
  action: string,
  freshness: ActionDefinition["freshness"],
  output: JsonSchema,
): void {
  if (!freshness) return;
  if (freshness.validUntil !== undefined) {
    const p = requirePointer(action, "freshness.validUntil", freshness.validUntil);
    requireResolves(action, "freshness.validUntil", p, output, output, "output");
  }
  if (
    freshness.cacheTtlSeconds !== undefined &&
    (!Number.isFinite(freshness.cacheTtlSeconds) || freshness.cacheTtlSeconds < 0)
  ) {
    throw new DisplayValidationError(
      action,
      "freshness.cacheTtlSeconds",
      "must be a non-negative number",
    );
  }
}

/** Whether a JSON Schema mentions the reserved `_axe` key anywhere in `properties`. */
export function schemaMentionsReserved(schema: JsonSchema): boolean {
  const props = schema["properties"];
  if (props && typeof props === "object") {
    if (RESERVED_KEY in (props as Record<string, unknown>)) return true;
    for (const sub of Object.values(props as Record<string, unknown>)) {
      if (sub && typeof sub === "object" && schemaMentionsReserved(sub as JsonSchema)) return true;
    }
  }
  const items = schema["items"];
  if (items && typeof items === "object" && schemaMentionsReserved(items as JsonSchema))
    return true;
  const defs = schema["$defs"];
  if (defs && typeof defs === "object") {
    for (const sub of Object.values(defs as Record<string, unknown>)) {
      if (sub && typeof sub === "object" && schemaMentionsReserved(sub as JsonSchema)) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Resolution against a real output
// ---------------------------------------------------------------------------

export interface ResolvedAffordance {
  action: string;
  title: string;
  input: Record<string, unknown>;
  primary: boolean;
}

export interface PresentedAttribute {
  label: string;
  value: unknown;
  format: AttributeFormat;
  compare?: CompareDirection;
}

export interface PresentedPrice {
  amount: number;
  currency: string;
  period?: PricePeriod;
}

export interface PresentedItem {
  id: string;
  title: string;
  subtitle?: string;
  summary?: string;
  images: string[];
  url?: string;
  price?: PresentedPrice;
  attributes: PresentedAttribute[];
  badges: string[];
  affordances: ResolvedAffordance[];
  /** The raw item with `_axe` removed. */
  raw: unknown;
}

/** The normalized, renderer-ready form of an `ok` result. */
export interface PresentedResult {
  action: string;
  kind: Display["kind"] | "generic";
  items: PresentedItem[];
  suggestedComparison: string[];
  emptyMessage?: string;
  disclaimer?: string;
  brand?: Brand;
  /** The output with every `_axe` key removed. */
  output: unknown;
}

function str(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return undefined;
}

function isSafeUrl(v: unknown): v is string {
  if (typeof v !== "string") return false;
  try {
    const u = new URL(v);
    if (u.protocol === "https:") return true;
    return (
      u.protocol === "http:" &&
      (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]")
    );
  } catch {
    return false;
  }
}

/** Remove the reserved `_axe` key from an object (shallow) and return it separately. */
export function splitReserved(value: unknown): {
  value: unknown;
  reserved: AxeReserved | undefined;
} {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    RESERVED_KEY in (value as Record<string, unknown>)
  ) {
    const { [RESERVED_KEY]: reserved, ...rest } = value as Record<string, unknown>;
    return { value: rest, reserved: (reserved ?? undefined) as AxeReserved | undefined };
  }
  return { value, reserved: undefined };
}

/** Remove `_axe` from an output and from every element of the array at `itemsPointer`. */
export function stripReserved(output: unknown, itemsPointer?: JsonPointer): unknown {
  const top = splitReserved(output).value;
  if (itemsPointer === undefined || !top || typeof top !== "object") return top;
  const arr = getPointer(top, itemsPointer);
  if (!Array.isArray(arr)) return top;
  const cleaned = arr.map((el) => splitReserved(el).value);
  return setPointer(top, itemsPointer, cleaned);
}

function setPointer(root: unknown, pointer: JsonPointer, value: unknown): unknown {
  const tokens = parsePointer(pointer);
  if (tokens.length === 0) return value;
  const clone = (v: unknown): unknown =>
    Array.isArray(v) ? [...v] : v && typeof v === "object" ? { ...(v as object) } : v;
  const out = clone(root) as Record<string, unknown> | unknown[];
  let cur: unknown = out;
  for (let i = 0; i < tokens.length - 1; i++) {
    const t = tokens[i]!;
    const next = clone(Array.isArray(cur) ? cur[Number(t)] : (cur as Record<string, unknown>)[t]);
    if (Array.isArray(cur)) cur[Number(t)] = next;
    else (cur as Record<string, unknown>)[t] = next;
    cur = next;
  }
  const last = tokens[tokens.length - 1]!;
  if (Array.isArray(cur)) cur[Number(last)] = value;
  else (cur as Record<string, unknown>)[last] = value;
  return out;
}

function normalizeDynamic(list: DynamicAffordance[] | undefined): ResolvedAffordance[] | undefined {
  if (!Array.isArray(list)) return undefined;
  const out = list
    .filter((a) => a && typeof a.action === "string" && typeof a.title === "string")
    .slice(0, MAX_AFFORDANCES)
    .map((a) => ({
      action: a.action,
      title: a.title,
      input: { ...(a.input ?? {}) } as Record<string, unknown>,
      primary: a.primary === true,
    }));
  if (out.filter((a) => a.primary).length > 1) for (const a of out) a.primary = false;
  return out;
}

function bindStatic(affordances: Affordance[] | undefined, item: unknown): ResolvedAffordance[] {
  if (!affordances) return [];
  return affordances.slice(0, MAX_AFFORDANCES).map((a) => {
    const input: Record<string, unknown> = {};
    for (const [key, pointer] of Object.entries(a.input ?? {})) {
      const v = getPointer(item, pointer);
      if (v !== undefined) input[key] = v;
    }
    return { action: a.action, title: a.title, input, primary: a.primary === true };
  });
}

function presentItem(
  display: Display,
  action: ActionDefinition,
  rawItem: unknown,
  isCollection: boolean,
): PresentedItem {
  const { value: item, reserved } = splitReserved(rawItem);
  const d = display.item;
  const dynamic = normalizeDynamic(reserved?.affordances);
  const affordances = dynamic ?? bindStatic(action.affordances, item);
  if (!d) {
    return {
      id: "",
      title: action.title,
      images: [],
      attributes: [],
      badges: [],
      affordances,
      raw: item,
    };
  }
  const images: string[] = [];
  const imagePointers = d.image === undefined ? [] : Array.isArray(d.image) ? d.image : [d.image];
  for (const p of imagePointers) {
    const v = getPointer(item, p);
    const list = Array.isArray(v) ? v : [v];
    for (const u of list) if (isSafeUrl(u)) images.push(u);
  }
  const badges: string[] = [];
  for (const p of d.badges ?? []) {
    const v = getPointer(item, p);
    const list = Array.isArray(v) ? v : [v];
    for (const b of list) {
      const s = str(b);
      if (s) badges.push(s);
    }
  }
  const attributes: PresentedAttribute[] = [];
  for (const attr of d.attributes ?? []) {
    const value = getPointer(item, attr.path);
    if (value === undefined) continue;
    const entry: PresentedAttribute = {
      label: attr.label,
      value,
      format: attr.format ?? WIRE.format.text,
    };
    if (attr.compare) entry.compare = attr.compare;
    attributes.push(entry);
  }
  let price: PresentedPrice | undefined;
  if (d.price) {
    const amount = getPointer(item, d.price.amount);
    const currency = d.price.currency.startsWith("/")
      ? getPointer(item, d.price.currency)
      : d.price.currency;
    if (typeof amount === "number" && typeof currency === "string") {
      price = { amount, currency };
      if (d.price.period) price.period = d.price.period;
    }
  }
  const out: PresentedItem = {
    id: str(getPointer(item, d.id)) ?? "",
    title: str(getPointer(item, d.title)) ?? (isCollection ? "" : action.title),
    images,
    attributes,
    badges,
    affordances,
    raw: item,
  };
  const subtitle = d.subtitle ? str(getPointer(item, d.subtitle)) : undefined;
  if (subtitle) out.subtitle = subtitle;
  const summary = d.summary ? str(getPointer(item, d.summary)) : undefined;
  if (summary) out.summary = summary;
  const url = d.url ? getPointer(item, d.url) : undefined;
  if (isSafeUrl(url)) out.url = url;
  if (price) out.price = price;
  return out;
}

/**
 * Apply an action's `display` and `affordances` to an output. Dynamic `_axe.affordances`
 * on an item replace the static list for that item. Works for any action: one without
 * `display` yields a single generic item whose `raw` is the output.
 */
export function resolveDisplay(
  action: ActionDefinition,
  output: JsonValue | unknown,
  brand?: Brand,
): PresentedResult {
  const display = action.display;
  const base: PresentedResult = {
    action: action.name,
    kind: display?.kind ?? "generic",
    items: [],
    suggestedComparison: display?.suggestedComparison ?? [],
    output: stripReserved(output, display?.items),
  };
  if (display?.emptyMessage) base.emptyMessage = display.emptyMessage;
  if (display?.disclaimer) base.disclaimer = display.disclaimer;
  if (brand) base.brand = brand;

  if (!display) {
    const { value, reserved } = splitReserved(output);
    const affordances =
      normalizeDynamic(reserved?.affordances) ?? bindStatic(action.affordances, value);
    base.items = [
      {
        id: "",
        title: action.title,
        images: [],
        attributes: [],
        badges: [],
        affordances,
        raw: value,
      },
    ];
    return base;
  }
  const isCollection =
    display.kind === WIRE.displayKind.list || display.kind === WIRE.displayKind.table;
  if (isCollection && display.items !== undefined) {
    const top = splitReserved(output).value;
    const arr = getPointer(top, display.items);
    base.items = Array.isArray(arr) ? arr.map((el) => presentItem(display, action, el, true)) : [];
    return base;
  }
  base.items = [presentItem(display, action, output, false)];
  return base;
}
