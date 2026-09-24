/**
 * `fromOpenAPI`: one AXE action per OpenAPI 3.x operation. The document decides the name,
 * the flags, the schemas, and the HTTP call; the author decides, through overrides, everything
 * the document cannot honestly say (a missing description, a display shape, a human URL).
 */
import { z } from "@axe/core";
import type { HandlerContext } from "@axe/core";
import { fail, ACTION_NAME_PATTERN } from "@axe/core";
import type { AuthMode, ErrorCode, JsonObject, JsonSchema, JsonValue, Risk } from "@axe/core/types";
import { WIRE } from "@axe/core/vocabulary";
import { jsonSchemaToZod, resolveLocalRef } from "./json-schema-to-zod";
import type {
  ActionSource,
  GeneratedAction,
  GeneratedSpec,
  GenerateWarning,
  SourceOutput,
} from "./types";

// ---------------------------------------------------------------------------
// The slice of OpenAPI 3.x the generator reads. Kept loose: documents in the wild carry more.
// ---------------------------------------------------------------------------

export type HttpMethod = "GET" | "PUT" | "POST" | "DELETE" | "PATCH" | "HEAD";

export interface OpenAPIParameter {
  $ref?: string;
  name?: string;
  in?: "path" | "query" | "header" | "cookie";
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  schema?: JsonSchema;
}

export interface OpenAPIMediaType {
  schema?: JsonSchema;
}

export interface OpenAPIRequestBody {
  $ref?: string;
  description?: string;
  required?: boolean;
  content?: Record<string, OpenAPIMediaType>;
}

export interface OpenAPIResponse {
  $ref?: string;
  description?: string;
  content?: Record<string, OpenAPIMediaType>;
}

export type OpenAPISecurityRequirement = Record<string, string[]>;

export interface OpenAPIOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  deprecated?: boolean;
  tags?: string[];
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses?: Record<string, OpenAPIResponse>;
  security?: OpenAPISecurityRequirement[];
}

export interface OpenAPIPathItem {
  $ref?: string;
  summary?: string;
  description?: string;
  parameters?: OpenAPIParameter[];
  get?: OpenAPIOperation;
  put?: OpenAPIOperation;
  post?: OpenAPIOperation;
  delete?: OpenAPIOperation;
  patch?: OpenAPIOperation;
  head?: OpenAPIOperation;
  options?: OpenAPIOperation;
  trace?: OpenAPIOperation;
}

export interface OpenAPISecurityScheme {
  type?: "apiKey" | "http" | "oauth2" | "openIdConnect" | "mutualTLS" | string;
  scheme?: string;
  name?: string;
  in?: string;
}

export interface OpenAPIDocument {
  openapi?: string;
  info?: { title?: string; description?: string; version?: string };
  servers?: { url: string; description?: string }[];
  paths?: Record<string, OpenAPIPathItem>;
  components?: {
    schemas?: Record<string, JsonSchema>;
    parameters?: Record<string, OpenAPIParameter>;
    requestBodies?: Record<string, OpenAPIRequestBody>;
    responses?: Record<string, OpenAPIResponse>;
    securitySchemes?: Record<string, OpenAPISecurityScheme>;
  };
  security?: OpenAPISecurityRequirement[];
  [extension: string]: unknown;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface OpenAPIAuthOptions {
  /**
   * The AXE auth mode to declare for operations that have a security requirement. Default: by
   * the first scheme's type, `apiKey` → `site`, everything else (`http`, `oauth2`, `openIdConnect`) → `user`.
   */
  mode?: AuthMode;
  /** Forward the `Authorization` header of the AXE request to the upstream call. Default false. */
  forward?: boolean;
  /** Produce the upstream `Authorization` header value for a call (a service token, a per-user exchange). */
  token?: (ctx: HandlerContext<unknown>) => string | undefined | Promise<string | undefined>;
}

export interface OpenAPIOptions {
  /** Where the operations are served. Default: the document's first `servers[].url`, which must be absolute. */
  baseUrl?: string;
  /** The fetch implementation for upstream calls. Default `globalThis.fetch`. */
  fetch?: typeof globalThis.fetch;
  /** Static headers on every upstream call, or a function of the AXE call. */
  headers?:
    | Record<string, string>
    | ((ctx: HandlerContext<unknown>) => Record<string, string> | Promise<Record<string, string>>);
  auth?: OpenAPIAuthOptions;
  /** Risk by method. Default GET/HEAD `low`, POST/PUT/PATCH `medium`, DELETE `high`. */
  risk?: Partial<Record<HttpMethod, Risk>>;
  /** Namespace for paths without a static first segment. Default `api`. */
  namespace?: string;
  /** Include operations the document marks `deprecated`. Default false: they are left out with a warning. */
  includeDeprecated?: boolean;
}

const DEFAULT_RISK: Record<HttpMethod, Risk> = {
  GET: WIRE.risk.low,
  HEAD: WIRE.risk.low,
  POST: WIRE.risk.medium,
  PUT: WIRE.risk.medium,
  PATCH: WIRE.risk.medium,
  DELETE: WIRE.risk.high,
};

const METHODS: readonly HttpMethod[] = ["GET", "PUT", "POST", "DELETE", "PATCH", "HEAD"];

/** HTTP status → AXE error code. Unlisted 4xx are `internal`: they signal a generator or configuration problem, not agent input. */
export function errorCodeForStatus(status: number): ErrorCode {
  if (status === 400 || status === 422) return WIRE.error.invalidInput;
  if (status === 401) return WIRE.error.unauthorized;
  if (status === 403) return WIRE.error.forbidden;
  if (status === 404 || status === 410) return WIRE.error.notFound;
  if (status === 409 || status === 412 || status === 428) return WIRE.error.conflict;
  if (status === 429) return WIRE.error.rateLimited;
  if (status >= 500) return WIRE.error.unavailable;
  return WIRE.error.internal;
}

// ---------------------------------------------------------------------------
// Naming
// ---------------------------------------------------------------------------

/** Lower-case word tokens of an identifier: `getOrderById` → get, order, by, id; `list_orders-v2` → list, orders, v2. */
export function wordTokens(s: string): string[] {
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .map((t) => t.toLowerCase())
    .filter(Boolean);
}

function singular(t: string): string {
  return t.endsWith("s") && t.length > 3 ? t.slice(0, -1) : t;
}

function staticSegments(path: string): string[] {
  return path
    .split("/")
    .filter(Boolean)
    .filter((s) => !s.includes("{"))
    .filter((s) => !/^v\d+$/i.test(s) && s.toLowerCase() !== "api")
    .map((s) => wordTokens(s).join("-"))
    .filter(Boolean);
}

function methodVerb(method: HttpMethod, path: string): string {
  const endsWithParam = /\}\/?$/.test(path);
  switch (method) {
    case "GET":
      return endsWithParam ? "get" : "list";
    case "HEAD":
      return "head";
    case "POST":
      return "create";
    case "PUT":
    case "PATCH":
      return "update";
    case "DELETE":
      return "delete";
  }
}

/** The name derived from method and path when there is no usable operationId. */
export function derivedActionName(method: HttpMethod, path: string, namespace = "api"): string {
  const [ns, ...rest] = staticSegments(path);
  const verb = methodVerb(method, path);
  return `${ns ?? namespace}.${[verb, ...rest].join("-")}`;
}

/**
 * Sanitise an operationId to the AXE grammar. Dotted ids keep their segments; a flat id is
 * namespaced under the path's first static segment, with that word removed from the verb part
 * (`listOrders` on `/orders` → `orders.list`). Returns undefined when nothing valid comes out.
 */
export function actionNameFromOperationId(
  operationId: string,
  path: string,
  namespace = "api",
): string | undefined {
  let name: string;
  if (operationId.includes(".")) {
    name = operationId
      .split(".")
      .map((seg) => wordTokens(seg).join("-"))
      .filter(Boolean)
      .join(".");
  } else {
    const ns = staticSegments(path)[0] ?? namespace;
    const nsTokens = new Set(wordTokens(ns).map(singular));
    const verb = wordTokens(operationId).filter((t) => !nsTokens.has(singular(t)));
    if (verb.length === 0) return undefined;
    name = `${ns}.${verb.join("-")}`;
  }
  return ACTION_NAME_PATTERN.test(name) ? name : undefined;
}

function humanize(tokens: string[]): string {
  if (tokens.length === 0) return "";
  const [first, ...rest] = tokens;
  return [first!.charAt(0).toUpperCase() + first!.slice(1), ...rest].join(" ");
}

// ---------------------------------------------------------------------------
// The source
// ---------------------------------------------------------------------------

/** Derive AXE action candidates from an OpenAPI 3.x document. Feed the result to `generate()`. */
export function fromOpenAPI(document: OpenAPIDocument, options: OpenAPIOptions = {}): ActionSource {
  let cached: SourceOutput | undefined;
  return {
    source: "openapi",
    actions() {
      cached ??= deriveOpenAPIActions(document, options);
      return cached;
    },
  };
}

function deriveOpenAPIActions(document: OpenAPIDocument, options: OpenAPIOptions): SourceOutput {
  const out: GeneratedAction[] = [];
  const sourceWarnings: GenerateWarning[] = [];
  const baseUrl = (options.baseUrl ?? document.servers?.[0]?.url ?? "").replace(/\/+$/, "");
  if (!/^https?:\/\//.test(baseUrl)) {
    throw new Error(
      `fromOpenAPI: baseUrl is required when the document has no absolute servers[0].url (received ${JSON.stringify(baseUrl)}).`,
    );
  }
  const root = document as unknown as JsonSchema;
  const resolve = <T>(node: T | undefined): T | undefined => {
    let current: unknown = node;
    const seen = new Set<string>();
    while (
      current &&
      typeof current === "object" &&
      typeof (current as { $ref?: unknown }).$ref === "string"
    ) {
      const ref = (current as { $ref: string }).$ref;
      if (seen.has(ref)) return undefined;
      seen.add(ref);
      current = resolveLocalRef(root, ref);
    }
    return current as T | undefined;
  };

  for (const [path, rawItem] of Object.entries(document.paths ?? {})) {
    const item = resolve(rawItem);
    if (!item) continue;
    for (const method of METHODS) {
      const op = item[method.toLowerCase() as Lowercase<HttpMethod>];
      if (!op) continue;
      const ref = `${method} ${path}`;
      const warnings: GenerateWarning[] = [];
      const candidate = deriveOperation({
        document,
        root,
        resolve,
        options,
        baseUrl,
        path,
        method,
        op,
        pathParameters: item.parameters ?? [],
        ref,
        warnings,
      });
      if (candidate) out.push({ ...candidate, warnings });
      else sourceWarnings.push(...warnings);
    }
  }
  return { actions: out, warnings: sourceWarnings };
}

interface OperationContext {
  document: OpenAPIDocument;
  root: JsonSchema;
  resolve: <T>(node: T | undefined) => T | undefined;
  options: OpenAPIOptions;
  baseUrl: string;
  path: string;
  method: HttpMethod;
  op: OpenAPIOperation;
  pathParameters: OpenAPIParameter[];
  ref: string;
  warnings: GenerateWarning[];
}

interface ParamPlan {
  name: string;
  in: "path" | "query" | "header";
}

function deriveOperation(c: OperationContext): GeneratedAction | undefined {
  const { op, method, path, ref, options, warnings } = c;

  // Name.
  let name: string | undefined;
  if (op.operationId) name = actionNameFromOperationId(op.operationId, path, options.namespace);
  if (!name) {
    name = derivedActionName(method, path, options.namespace);
    warnings.push({
      code: "derived-name",
      action: name,
      ref,
      field: "name",
      message: op.operationId
        ? `operationId "${op.operationId}" does not reduce to a valid action name; "${name}" was derived from the method and path. Rename it with overrides["${ref}"].name if it should read differently.`
        : `No operationId; "${name}" was derived from the method and path. Rename it with overrides["${ref}"].name if it should read differently.`,
    });
  }

  if (op.deprecated && !options.includeDeprecated) {
    warnings.push({
      code: "excluded",
      action: name,
      ref,
      message:
        "The operation is marked deprecated in the document. Pass includeDeprecated: true to keep it.",
      dropped: true,
    });
    return undefined;
  }

  // Parameters: path-level first, operation-level overrides by (name, in).
  const params = new Map<string, OpenAPIParameter>();
  for (const raw of [...c.pathParameters, ...(op.parameters ?? [])]) {
    const p = c.resolve(raw);
    if (!p?.name || !p.in) continue;
    params.set(`${p.in}:${p.name}`, p);
  }
  const shape: Record<string, z.ZodType> = {};
  const plan: ParamPlan[] = [];
  for (const p of params.values()) {
    const where = p.in;
    if (where === undefined) continue;
    if (where === "cookie") {
      warnings.push({
        code: "unsupported-parameter",
        action: name,
        ref,
        field: `input.${p.name}`,
        message: `Cookie parameter "${p.name}" is not sent; the handler has no cookie jar. Supply it through headers if the upstream needs it.`,
      });
      continue;
    }
    const converted = jsonSchemaToZod(p.schema ?? { type: "string" }, {
      root: c.root,
      location: `${name}.input.${p.name}`,
    });
    for (const w of converted.warnings) warnings.push({ ...w, action: name, ref });
    let field = converted.schema;
    if (p.description) field = field.describe(p.description);
    const required = where === "path" || p.required === true;
    const dflt = p.schema?.["default"];
    shape[p.name!] = required
      ? field
      : dflt !== undefined
        ? field.default(dflt as never)
        : field.optional();
    plan.push({ name: p.name!, in: where });
  }

  // Request body.
  let bodyKeys: string[] | "nested" | undefined;
  const body = c.resolve(op.requestBody);
  if (body) {
    const media = jsonMedia(body.content);
    if (!media) {
      warnings.push({
        code: "unsupported-parameter",
        action: name,
        ref,
        field: "input",
        message: `The request body has no application/json content (${Object.keys(body.content ?? {}).join(", ") || "no content"}); it is not sent.`,
      });
    } else {
      const converted = jsonSchemaToZod(media.schema ?? {}, {
        root: c.root,
        location: `${name}.input`,
      });
      for (const w of converted.warnings) warnings.push({ ...w, action: name, ref });
      const bodySchema = converted.schema;
      const collides =
        bodySchema instanceof z.ZodObject && Object.keys(bodySchema.shape).some((k) => k in shape);
      if (bodySchema instanceof z.ZodObject && !collides) {
        const bodyShape = bodySchema.shape as Record<string, z.ZodType>;
        for (const [k, v] of Object.entries(bodyShape)) shape[k] = v;
        bodyKeys = Object.keys(bodyShape);
      } else {
        let field = bodySchema.describe(body.description ?? "The request body");
        if (!body.required) field = field.optional();
        shape["body"] = field;
        bodyKeys = "nested";
      }
    }
  }
  const input = z.object(shape).strict();

  // Output: the lowest 2xx response with JSON content.
  const responses = op.responses ?? {};
  const codes = Object.keys(responses)
    .filter((k) => /^2(\d\d|XX)$/i.test(k))
    .sort();
  let output: z.ZodType = z.object({});
  let wrapOutput = false;
  if (codes.length === 0) {
    warnings.push({
      code: "missing-output",
      action: name,
      ref,
      field: "output",
      message: "No 2xx response is documented; the action declares an empty output object.",
    });
  } else {
    const response = c.resolve(responses[codes[0]!]);
    const media = jsonMedia(response?.content);
    if (media?.schema) {
      const converted = jsonSchemaToZod(media.schema, { root: c.root, location: `${name}.output` });
      for (const w of converted.warnings) warnings.push({ ...w, action: name, ref });
      if (converted.schema instanceof z.ZodObject) output = converted.schema;
      else {
        output = z.object({ result: converted.schema });
        wrapOutput = true;
      }
    }
  }

  // Flags and metadata.
  const readOnly = method === "GET" || method === "HEAD";
  const idempotent = readOnly || method === "PUT" || method === "DELETE";
  const risk = options.risk?.[method] ?? DEFAULT_RISK[method];
  const auth = authModeFor(c, op);
  const titleTokens = op.operationId ? wordTokens(op.operationId) : name.split(".")[1]!.split("-");
  const title = op.summary?.trim() || humanize(titleTokens);
  const description =
    op.description?.trim() ||
    (op.summary && op.summary.trim().length >= 40 ? op.summary.trim() : undefined);

  const handler = makeHandler(c, { plan, bodyKeys, wrapOutput, hasBody: bodyKeys !== undefined });

  const spec: GeneratedSpec = {
    title,
    input,
    output,
    readOnly,
    idempotent,
    reversible: readOnly,
    risk,
    auth,
    handler,
  };
  if (description) spec.description = description;
  return { name, spec, provenance: { source: "openapi", ref } };
}

function jsonMedia(
  content: Record<string, OpenAPIMediaType> | undefined,
): OpenAPIMediaType | undefined {
  if (!content) return undefined;
  const key = Object.keys(content).find((k) => /^application\/(.*\+)?json\b/i.test(k));
  return key ? content[key] : undefined;
}

function authModeFor(c: OperationContext, op: OpenAPIOperation): AuthMode {
  const requirements = op.security ?? c.document.security ?? [];
  const open = requirements.length === 0 || requirements.some((r) => Object.keys(r).length === 0);
  if (open) return WIRE.authMode.none;
  if (c.options.auth?.mode) return c.options.auth.mode;
  const firstScheme = Object.keys(requirements[0]!)[0];
  const scheme = firstScheme ? c.document.components?.securitySchemes?.[firstScheme] : undefined;
  return scheme?.type === "apiKey" ? WIRE.authMode.site : WIRE.authMode.user;
}

interface HandlerPlan {
  plan: ParamPlan[];
  bodyKeys: string[] | "nested" | undefined;
  wrapOutput: boolean;
  hasBody: boolean;
}

function makeHandler(c: OperationContext, h: HandlerPlan): GeneratedSpec["handler"] {
  const { baseUrl, path, method, options } = c;
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const pathNames = new Set(h.plan.filter((p) => p.in === "path").map((p) => p.name));
  const queryNames = h.plan.filter((p) => p.in === "query").map((p) => p.name);
  const headerNames = h.plan.filter((p) => p.in === "header").map((p) => p.name);

  return async (ctx) => {
    const input = (ctx.input ?? {}) as Record<string, unknown>;

    const url = new URL(
      baseUrl +
        path.replace(/\{([^}]+)\}/g, (_m, key: string) => {
          if (!pathNames.has(key)) return `{${key}}`;
          return encodeURIComponent(String(input[key]));
        }),
    );
    for (const q of queryNames) {
      const v = input[q];
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) for (const item of v) url.searchParams.append(q, scalar(item));
      else url.searchParams.append(q, scalar(v));
    }

    const headers = new Headers({ accept: "application/json" });
    for (const hName of headerNames) {
      const v = input[hName];
      if (v !== undefined && v !== null) headers.set(hName, scalar(v));
    }
    const staticHeaders =
      typeof options.headers === "function" ? await options.headers(ctx) : options.headers;
    for (const [k, v] of Object.entries(staticHeaders ?? {})) headers.set(k, v);
    if (options.auth?.forward) {
      const incoming = ctx.request.headers.get(WIRE.header.authorization);
      if (incoming) headers.set(WIRE.header.authorization, incoming);
    }
    if (options.auth?.token) {
      const token = await options.auth.token(ctx);
      if (token) headers.set(WIRE.header.authorization, token);
    }

    let body: string | undefined;
    if (h.hasBody) {
      let payload: unknown;
      if (h.bodyKeys === "nested") payload = input["body"];
      else {
        const picked: Record<string, unknown> = {};
        for (const k of h.bodyKeys ?? []) if (input[k] !== undefined) picked[k] = input[k];
        payload = picked;
      }
      if (payload !== undefined) {
        body = JSON.stringify(payload);
        headers.set("content-type", "application/json");
      }
    }

    let response: Response;
    try {
      response = await fetchImpl(url, { method, headers, ...(body !== undefined ? { body } : {}) });
    } catch (e) {
      return fail(WIRE.error.unavailable, `${method} ${path} could not be reached.`, {
        retryable: true,
        details: { reason: e instanceof Error ? e.message : String(e) },
      });
    }

    const text = await response.text();
    let parsed: JsonValue = null;
    if (text) {
      try {
        parsed = JSON.parse(text) as JsonValue;
      } catch {
        parsed = text;
      }
    }

    if (!response.ok) {
      const code = errorCodeForStatus(response.status);
      const details: JsonObject = { status: response.status };
      if (parsed !== null) details["body"] = parsed;
      return fail(code, `${method} ${path} returned ${response.status}.`, {
        retryable: code === WIRE.error.rateLimited || code === WIRE.error.unavailable,
        details,
      });
    }
    if (h.wrapOutput) return { result: parsed };
    if (parsed === null) return {};
    return parsed;
  };
}

function scalar(v: unknown): string {
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}
