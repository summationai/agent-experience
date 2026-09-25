/**
 * MCP elicitation for the AXE ladder (review item 14, 2026-09-24).
 *
 * Written against the MCP specification 2025-11-25, "Elicitation" (checked 2026-09-24), and the
 * installed SDK 1.30.1 (`Server.elicitInput`, `ElicitRequestFormParams`, `ElicitRequestURLParams`):
 *
 * - A client that supports elicitation declares `capabilities.elicitation` with `form` and/or
 *   `url`; an empty object means form only. A server MUST NOT send a mode the client did not
 *   declare.
 * - Form mode collects a flat object of primitive properties (string, number, integer, boolean,
 *   single- and multi-select enums). Servers MUST NOT use it for sensitive information
 *   (passwords, API keys, access tokens, payment credentials) and MUST use URL mode for those.
 * - URL mode sends the user to a page out of band; `accept` means the user agreed to open it, not
 *   that the step is done.
 *
 * The bridge uses form mode for a `needs_input` whose chosen kind is not sensitive and whose
 * schema fits the form subset, then calls `/axe/continue` with the answer. A sensitive kind is
 * never put in a form: with URL mode and a page from the site (the `fallback` handoff, or a
 * `needs_human` handoff) the user is offered the page; otherwise the result goes to the model as
 * text, as before ([P-MCP-6], [P-MCP-7]).
 */
import type { Accept, JsonSchema, JsonValue } from "@axe/core/types";

/** The client's declared elicitation modes (spec: `{}` means form only). */
export interface ElicitationModes {
  form: boolean;
  url: boolean;
}

export function elicitationModes(capabilities: unknown): ElicitationModes {
  const e = (capabilities as { elicitation?: unknown } | undefined)?.elicitation;
  if (!e || typeof e !== "object") return { form: false, url: false };
  const o = e as { form?: unknown; url?: unknown };
  const empty = o.form === undefined && o.url === undefined;
  return {
    form: empty || (!!o.form && typeof o.form === "object"),
    url: !!o.url && typeof o.url === "object",
  };
}

/**
 * Kinds that are never collected through a form, whatever their `sensitive` flag says: payment
 * and identity kinds, credentials, and names that say secret, password, token, or key.
 */
const SENSITIVE_NAMESPACE = /^(payment|identity|credential|credentials)\./;
const SENSITIVE_WORD =
  /(^|[._-])(password|passcode|secret|token|api-?key|private-?key|otp|pin)([._-]|$)/i;

export function isSensitiveAccept(accept: Pick<Accept, "kind" | "sensitive">): boolean {
  return (
    accept.sensitive === true ||
    SENSITIVE_NAMESPACE.test(accept.kind) ||
    SENSITIVE_WORD.test(accept.kind)
  );
}

type Schema = Record<string, unknown>;

const STRING_FORMATS = new Set(["email", "uri", "date", "date-time"]);

function copyText(from: Schema, to: Schema): void {
  if (typeof from["title"] === "string") to["title"] = from["title"];
  if (typeof from["description"] === "string") to["description"] = from["description"];
}

/** One property in the form subset, or null when it has no form rendering. */
function primitive(p: unknown): Schema | null {
  if (!p || typeof p !== "object" || Array.isArray(p)) return null;
  const s = p as Schema;
  const out: Schema = {};
  copyText(s, out);
  const type = s["type"];
  if (type === "string") {
    out["type"] = "string";
    if (Array.isArray(s["enum"])) {
      if (!s["enum"].every((v) => typeof v === "string") || s["enum"].length === 0) return null;
      out["enum"] = s["enum"];
    } else if (Array.isArray(s["oneOf"])) {
      const options = s["oneOf"] as Schema[];
      if (!options.every((o) => o && typeof o["const"] === "string")) return null;
      out["oneOf"] = options.map((o) => ({
        const: o["const"],
        title: typeof o["title"] === "string" ? o["title"] : o["const"],
      }));
    } else {
      for (const k of ["minLength", "maxLength"]) if (typeof s[k] === "number") out[k] = s[k];
      if (typeof s["pattern"] === "string") out["pattern"] = s["pattern"];
      if (typeof s["format"] === "string" && STRING_FORMATS.has(s["format"]))
        out["format"] = s["format"];
    }
    if (typeof s["default"] === "string") out["default"] = s["default"];
    return out;
  }
  if (type === "number" || type === "integer") {
    out["type"] = type;
    for (const k of ["minimum", "maximum"]) if (typeof s[k] === "number") out[k] = s[k];
    if (typeof s["default"] === "number") out["default"] = s["default"];
    return out;
  }
  if (type === "boolean") {
    out["type"] = "boolean";
    if (typeof s["default"] === "boolean") out["default"] = s["default"];
    return out;
  }
  if (type === "array") {
    const items = s["items"] as Schema | undefined;
    if (!items || items["type"] !== "string" || !Array.isArray(items["enum"])) return null;
    if (!items["enum"].every((v) => typeof v === "string")) return null;
    out["type"] = "array";
    out["items"] = { type: "string", enum: items["enum"] };
    for (const k of ["minItems", "maxItems"]) if (typeof s[k] === "number") out[k] = s[k];
    return out;
  }
  return null;
}

/** A form-mode `requestedSchema` for a kind's payload schema, and whether the payload was wrapped. */
export interface FormSchema {
  requestedSchema: { type: "object"; properties: Record<string, Schema>; required?: string[] };
  /** The kind's payload is a single primitive, collected as the property `value`. */
  wrapped: boolean;
}

/**
 * The form subset of a payload schema, or null when any part of it has no form rendering (a
 * nested object, an array of objects, a union, a reference). Keywords outside the subset that
 * only narrow a value (a format other than the four, for instance) are dropped; the site
 * validates the payload again on `/axe/continue`.
 */
export function toFormSchema(schema: JsonSchema): FormSchema | null {
  const s = schema as Schema;
  if (s["type"] === "object") {
    const props = s["properties"];
    if (!props || typeof props !== "object" || Array.isArray(props)) return null;
    for (const k of ["anyOf", "oneOf", "allOf", "$ref", "not", "if", "patternProperties"])
      if (k in s) return null;
    const properties: Record<string, Schema> = {};
    for (const [name, p] of Object.entries(props as Record<string, unknown>)) {
      const converted = primitive(p);
      if (!converted) return null;
      properties[name] = converted;
    }
    if (Object.keys(properties).length === 0) return null;
    const required = Array.isArray(s["required"])
      ? (s["required"] as unknown[]).filter(
          (r): r is string => typeof r === "string" && r in properties,
        )
      : [];
    return {
      requestedSchema: { type: "object", properties, ...(required.length ? { required } : {}) },
      wrapped: false,
    };
  }
  const single = primitive(s);
  if (!single) return null;
  return {
    requestedSchema: { type: "object", properties: { value: single }, required: ["value"] },
    wrapped: true,
  };
}

/** A form's answer as the kind's payload. */
export function payloadFrom(
  form: FormSchema,
  content: Record<string, unknown> | undefined,
): JsonValue {
  const c = (content ?? {}) as Record<string, JsonValue>;
  return form.wrapped ? (c["value"] ?? null) : c;
}

/** What to do with a `needs_input`, in the site's order of preference. */
export type ElicitationPlan =
  { mode: "form"; accept: Accept; form: FormSchema } | { mode: "url" } | { mode: "none" };

/**
 * Walk `accepts` in order: the first kind that is not sensitive and has a form rendering is
 * asked for in a form; a sensitive kind met first means the step belongs on the site's page, so
 * URL mode if the caller can use it, otherwise nothing (the model gets the text). A kind that is
 * not sensitive but has no form rendering is skipped: the model can still supply it through
 * `axe_continue`.
 */
export function planElicitation(
  accepts: readonly Accept[],
  modes: ElicitationModes,
  pageUrl: string | undefined,
): ElicitationPlan {
  for (const accept of accepts) {
    if (isSensitiveAccept(accept)) {
      return modes.url && pageUrl && isOpenableUrl(pageUrl) ? { mode: "url" } : { mode: "none" };
    }
    if (!modes.form) continue;
    const form = toFormSchema(accept.schema);
    if (form) return { mode: "form", accept, form };
  }
  return { mode: "none" };
}

/** https, or http on a loopback host (development): the spec says servers SHOULD use https. */
export function isOpenableUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" ||
      (u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname))
    );
  } catch {
    return false;
  }
}
