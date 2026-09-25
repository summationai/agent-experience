/**
 * The AXE conformance suite: discovery, manifest, runtime behavior, and the full
 * escalation ladder, run against any URL. Each check cites the spec requirements it
 * verifies. Run it against staging: the ladder checks call mutating actions.
 */
import type {
  Accept,
  ActionDefinition,
  LiveState,
  Manifest,
  NeedsInputResult,
  Result,
  JsonValue,
  JsonSchema,
} from "@axe/core/types";
import {
  LiveStateSchema,
  ManifestSchema,
  PlatformIndexSchema,
  ResultSchema,
  validateJsonSchema,
  schemasStructurallyEqual,
} from "@axe/core/schemas";
import {
  resolveDisplay,
  validateDisplay,
  validateAffordances,
  validatePagination,
  validateFreshness,
  schemaMentionsReserved,
  validateAffordanceBinding,
} from "@axe/core/display";
import { lintManifest, isBareQuerySearch, lintAgentText } from "@axe/core/lint";
import { WELL_KNOWN_KINDS, isCustomKind, kindJsonSchema, suggestedReason } from "@axe/core/kinds";
import { getPointer } from "@axe/core";
import * as WIRE from "@axe/core/vocabulary";
import { samplePayload } from "../helpers";

export type CheckStatus = "pass" | "fail" | "warn" | "skip";

export interface Check {
  id: string;
  title: string;
  status: CheckStatus;
  /** Spec requirement ids this check verifies. */
  requirements: string[];
  detail: string;
  /** Doc section that explains the fix. */
  docs: string;
}

export interface ConformanceReport {
  url: string;
  manifestUrl: string | null;
  manifest: Manifest | null;
  checks: Check[];
  passed: number;
  failed: number;
  warnings: number;
  skipped: number;
  /** True when no check failed. */
  ok: boolean;
  /** Observations the audit reuses. */
  observations: Observations;
}

export interface Observations {
  /** Every `needs_input` seen, with the action that produced it. */
  needsInput: { action: string; result: NeedsInputResult }[];
  /** Every `needs_human` seen. */
  needsHuman: { action: string; reason: string }[];
  /** Actions called live and whether each returned a non-error status. */
  calls: { action: string; status: string }[];
  /** Per-action outputs from live example runs, for display and parity checks. */
  outputs: { action: string; output: unknown }[];
  /** Whether a mutating action with a usable idempotency path was found. */
  idempotencyReplayWorked: boolean | null;
  tokenTamperRejected: boolean | null;
  hintFound: "link" | "robots" | "header" | null;
  /** The `/axe/state` document, when the manifest advertises live state and the endpoint answered. */
  liveState: LiveState | null;
}

export interface ConformanceOptions {
  fetch?: (input: string | URL, init?: RequestInit) => Promise<Response>;
  /** Bearer token for `user` or `site` actions, so the ladder can be exercised. */
  auth?: string;
  headers?: Record<string, string>;
  /** Skip checks that call mutating actions. */
  noMutate?: boolean;
  /** Vendor to present in `context.agent`. */
  vendor?: string;
  /** Per-request timeout. Default 15000 ms. */
  timeoutMs?: number;
  /** Explicit action + input known to return `needs_input`, when examples do not. */
  ladder?: { action: string; input: JsonValue };
}

const DOCS = {
  discovery: "docs/deploying.md#discovery",
  manifest: "docs/concepts.md#manifest",
  actions: "docs/designing-actions.md",
  display: "docs/presenting-results.md",
  ladder: "docs/requirements-and-kinds.md",
  handoff: "docs/human-handoff.md",
  idempotency: "docs/concepts.md#idempotency",
  errors: "docs/testing-and-conformance.md#reading-the-report",
  honesty: "docs/audit.md#honesty-rules",
  auth: "docs/auth.md",
  cors: "docs/deploying.md#cors",
  security: "docs/security.md",
  live: "docs/live-state.md",
  limits: "docs/deploying.md#limits-and-retention",
};

class Runner {
  readonly checks: Check[] = [];
  /** Raw bodies of error responses, scanned for leaked internals. */
  readonly errorBodies: string[] = [];
  readonly obs: Observations = {
    needsInput: [],
    needsHuman: [],
    calls: [],
    outputs: [],
    idempotencyReplayWorked: null,
    tokenTamperRejected: null,
    hintFound: null,
    liveState: null,
  };
  private readonly f: (input: string | URL, init?: RequestInit) => Promise<Response>;
  manifest: Manifest | null = null;
  manifestUrl: string | null = null;
  base = "";

  constructor(
    readonly url: string,
    readonly options: ConformanceOptions,
  ) {
    this.f = options.fetch ?? fetch;
  }

  add(
    id: string,
    title: string,
    status: CheckStatus,
    requirements: string[],
    detail: string,
    docs: string,
  ): void {
    this.checks.push({ id, title, status, requirements, detail, docs });
  }

  async request(path: string, init: RequestInit = {}, anonymous = false): Promise<Response> {
    const headers = new Headers(init.headers ?? {});
    headers.set("Accept", "application/json");
    for (const [k, v] of Object.entries(this.options.headers ?? {})) headers.set(k, v);
    if (anonymous) headers.delete(WIRE.header.authorization);
    else if (this.options.auth && !headers.has(WIRE.header.authorization))
      headers.set(WIRE.header.authorization, `Bearer ${this.options.auth}`);
    if (init.body && !headers.has(WIRE.header.contentType))
      headers.set(WIRE.header.contentType, "application/json");
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 15_000);
    try {
      const target = path.startsWith("http") ? path : `${this.base}${path}`;
      return await this.f(target, { ...init, headers, signal: controller.signal });
    } finally {
      clearTimeout(t);
    }
  }

  async post(
    path: string,
    body: unknown,
    extraHeaders: Record<string, string> = {},
    anonymous = false,
  ): Promise<{ res: Response; json: unknown }> {
    const res = await this.request(
      path,
      {
        method: "POST",
        body: JSON.stringify(body),
        headers: extraHeaders,
      },
      anonymous,
    );
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    if (res.status >= 400) this.errorBodies.push(text);
    return { res, json };
  }

  context(): Record<string, unknown> {
    return {
      agent: {
        name: "axe-conformance",
        version: "0.1",
        vendor: this.options.vendor ?? "AXE Conformance",
      },
    };
  }

  async invoke(
    action: ActionDefinition,
    input: unknown,
    idempotencyKey?: string,
    expectedRev?: string | number,
  ): Promise<{ res: Response; result: Result | null }> {
    const body: Record<string, unknown> = { input, context: this.context() };
    if (!action.readOnly) body["idempotencyKey"] = idempotencyKey ?? crypto.randomUUID();
    if (expectedRev !== undefined) body["expectedRev"] = expectedRev;
    const { res, json } = await this.post(
      `${WIRE.path.actions}/${encodeURIComponent(action.name)}`,
      body,
    );
    const result = isResult(json) ? json : null;
    if (result) this.obs.calls.push({ action: action.name, status: result.status });
    return { res, result };
  }

  callable(a: ActionDefinition): boolean {
    if (a.auth === WIRE.authMode.none) return true;
    return Boolean(this.options.auth);
  }
}

/** A valid but different input: append to a free-form string field, or add a property when the schema allows it. */
function variantInput(action: ActionDefinition, input: JsonValue): Record<string, unknown> {
  const obj = { ...((input ?? {}) as Record<string, unknown>) };
  const props = (action.input["properties"] ?? {}) as Record<string, JsonSchema>;
  for (const [name, schema] of Object.entries(props)) {
    if (
      schema["type"] === "string" &&
      !schema["enum"] &&
      !schema["format"] &&
      !schema["pattern"] &&
      schema["const"] === undefined &&
      typeof obj[name] === "string"
    ) {
      obj[name] = `${obj[name] as string}-variant`;
      return obj;
    }
  }
  obj["axeConformanceVariant"] = 1;
  return obj;
}

function isResult(v: unknown): v is Result {
  return !!v && typeof v === "object" && typeof (v as Result).status === "string";
}

function errorCode(r: Result | null): string | undefined {
  return r && r.status === WIRE.status.error ? r.error.code : undefined;
}

function stripReservedDeep(output: unknown, itemsPointer?: string): unknown {
  if (!output || typeof output !== "object") return output;
  const top = { ...(output as Record<string, unknown>) };
  delete top[WIRE.field.axeReserved];
  if (itemsPointer) {
    const arr = getPointer(top, itemsPointer);
    if (Array.isArray(arr)) {
      const cleaned = arr.map((el) => {
        if (el && typeof el === "object" && !Array.isArray(el)) {
          const c = { ...(el as Record<string, unknown>) };
          delete c[WIRE.field.axeReserved];
          return c;
        }
        return el;
      });
      // Only top-level pointers are rewritten; deeper ones are rare in practice.
      const key = itemsPointer.slice(1);
      if (!key.includes("/")) top[key] = cleaned;
    }
  }
  return top;
}

// ---------------------------------------------------------------------------
// Phases
// ---------------------------------------------------------------------------

async function discovery(r: Runner): Promise<void> {
  const origin = new URL(r.url).origin;
  r.base = origin;
  let res: Response | null = null;
  try {
    res = await r.request(`${origin}${WIRE.path.manifest}`);
  } catch (e) {
    r.add(
      "discovery.well-known",
      `Manifest at ${WIRE.path.manifest}`,
      "fail",
      ["P-DISC-1"],
      `Request failed: ${(e as Error).message}`,
      DOCS.discovery,
    );
    return;
  }
  let body: unknown = null;
  try {
    body = res.ok ? await res.json() : null;
  } catch {
    body = null;
  }
  if (res.ok && body && typeof body === "object") {
    r.add(
      "discovery.well-known",
      `Manifest at ${WIRE.path.manifest}`,
      "pass",
      ["P-DISC-1"],
      `HTTP ${res.status}`,
      DOCS.discovery,
    );
    r.manifest = body as Manifest;
    r.manifestUrl = `${origin}${WIRE.path.manifest}`;
  } else {
    const alias = await r.request(`${origin}${WIRE.path.manifestAlias}`).catch(() => null);
    let aliasBody: unknown = null;
    try {
      aliasBody = alias?.ok ? await alias.json() : null;
    } catch {
      aliasBody = null;
    }
    if (alias?.ok && aliasBody && typeof aliasBody === "object") {
      r.add(
        "discovery.well-known",
        `Manifest at ${WIRE.path.manifest}`,
        "fail",
        ["P-DISC-1"],
        `HTTP ${res.status} at ${WIRE.path.manifest}; the manifest was found at ${WIRE.path.manifestAlias} instead. Serve it at .well-known so agents find it on the first try.`,
        DOCS.discovery,
      );
      r.manifest = aliasBody as Manifest;
      r.manifestUrl = `${origin}${WIRE.path.manifestAlias}`;
      res = alias;
    } else {
      r.add(
        "discovery.well-known",
        `Manifest at ${WIRE.path.manifest}`,
        "fail",
        ["P-DISC-1"],
        `HTTP ${res.status} and no manifest at ${WIRE.path.manifestAlias} either.`,
        DOCS.discovery,
      );
      return;
    }
  }
  if (r.manifest?.baseUrl) {
    try {
      r.base = new URL(r.manifest.baseUrl).toString().replace(/\/$/, "");
    } catch {
      r.base = origin;
    }
  }
  const alias = await r.request(`${WIRE.path.manifestAlias}`).catch(() => null);
  r.add(
    "discovery.alias",
    `Manifest also at ${WIRE.path.manifestAlias}`,
    alias?.ok ? "pass" : "warn",
    ["P-DISC-2"],
    alias?.ok
      ? `HTTP ${alias.status}`
      : `Not served (HTTP ${alias?.status ?? "n/a"}). Optional, but the SDK serves it for hosts that cannot use .well-known.`,
    DOCS.discovery,
  );

  const ct = res.headers.get(WIRE.header.contentType) ?? "";
  const cc = res.headers.get("cache-control") ?? "";
  const maxAge = /max-age=(\d+)/.exec(cc)?.[1];
  const ctOk = ct.includes("application/json");
  const cacheOk = maxAge !== undefined && Number(maxAge) >= 60;
  r.add(
    "discovery.headers",
    "Manifest Content-Type and Cache-Control",
    ctOk ? (cacheOk ? "pass" : "warn") : "fail",
    ["P-DISC-3"],
    `Content-Type: ${ct || "(none)"}; Cache-Control: ${cc || "(none)"}${cacheOk ? "" : ". Allow caching for at least 60 seconds."}`,
    DOCS.discovery,
  );
  r.add(
    "runtime.protocol-header",
    `${WIRE.header.protocol} header on the manifest`,
    res.headers.get(WIRE.header.protocol) ? "pass" : "fail",
    ["P-VER-2", "P-VER-3"],
    `${WIRE.header.protocol}: ${res.headers.get(WIRE.header.protocol) ?? "(missing)"}`,
    DOCS.discovery,
  );

  // Hints: robots.txt directive, link tag, or header on the human page.
  let hint: Observations["hintFound"] = null;
  try {
    const robots = await r.request(`${origin}/robots.txt`);
    if (robots.ok) {
      const text = await robots.text();
      if (new RegExp(`^(${WIRE.robots.manifest}|${WIRE.robots.index}):\\s*\\S+`, "im").test(text))
        hint = "robots";
    }
  } catch {
    // ignore
  }
  if (!hint) {
    try {
      const home = await r.request(`${origin}/`, { headers: { Accept: "text/html" } });
      if (home.headers.get(WIRE.header.manifest)) hint = "header";
      else if ((home.headers.get("content-type") ?? "").includes("text/html")) {
        const html = (await home.text()).slice(0, 200_000);
        if (new RegExp(`<link[^>]+rel=["']?${WIRE.link.manifestRel}`, "i").test(html))
          hint = "link";
      }
    } catch {
      // ignore
    }
  }
  r.obs.hintFound = hint;
  r.add(
    "discovery.hints",
    "Discovery hint (robots.txt directive, link tag, or header)",
    hint ? "pass" : "warn",
    ["P-DISC-6"],
    hint
      ? `Found via ${hint}`
      : `No ${WIRE.robots.manifest} line in robots.txt, no <link rel="${WIRE.link.manifestRel}">, no ${WIRE.header.manifest} header on the home page. Optional, but it helps agents that start from a page URL.`,
    DOCS.discovery,
  );
}

async function manifestChecks(r: Runner): Promise<void> {
  const m = r.manifest!;
  const parsed = ManifestSchema.safeParse(m);
  r.add(
    "manifest.schema",
    "Manifest validates against the schema",
    parsed.success ? "pass" : "fail",
    ["P-MAN-1", "P-ACT-1", "P-DISP-7"],
    parsed.success
      ? `${m.actions.length} actions`
      : parsed.error.issues
          .slice(0, 8)
          .map((i) => `${i.path.join(".") || "/"}: ${i.message}`)
          .join("; "),
    DOCS.manifest,
  );
  if (!parsed.success) return;

  r.add(
    "manifest.protocol",
    "Protocol version",
    m.protocol === WIRE.protocol.version ? "pass" : /^axe\/0\./.test(m.protocol) ? "warn" : "fail",
    ["P-VER-1"],
    `protocol: ${m.protocol} (this suite implements ${WIRE.protocol.version})`,
    DOCS.manifest,
  );

  let https = false;
  try {
    const u = new URL(m.baseUrl);
    https = u.protocol === "https:" || ["localhost", "127.0.0.1"].includes(u.hostname);
  } catch {
    https = false;
  }
  r.add(
    "manifest.https",
    "baseUrl uses HTTPS",
    https ? "pass" : "fail",
    ["P-MAN-2"],
    m.baseUrl,
    DOCS.security,
  );

  const names = m.actions.map((a) => a.name);
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  r.add(
    "manifest.unique-names",
    "Action names are unique",
    dupes.length ? "fail" : "pass",
    ["P-ACT-2"],
    dupes.length ? `Duplicates: ${[...new Set(dupes)].join(", ")}` : `${names.length} unique names`,
    DOCS.actions,
  );

  const untruthful = m.actions
    .filter((a) => !a.readOnly && a.risk === WIRE.risk.none)
    .map((a) => a.name);
  const lies = m.actions
    .filter(
      (a) =>
        a.readOnly &&
        /\b(create|submit|book|cancel|delete|update|pay|reschedule|apply|reserve|purchase|order|send|sign)\b/i.test(
          a.name.replace(/[.-]/g, " "),
        ),
    )
    .map((a) => a.name);
  r.add(
    "manifest.truthful-metadata",
    "readOnly / risk metadata is consistent",
    untruthful.length || lies.length ? "fail" : "pass",
    ["P-ACT-3", "P-HON-7"],
    [
      untruthful.length ? `Mutating actions with risk none: ${untruthful.join(", ")}` : "",
      lies.length ? `Declared readOnly but named like a mutation: ${lies.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("; ") || "All consistent",
    DOCS.actions,
  );

  const nonObject = m.actions
    .filter((a) => a.input["type"] !== "object" || a.output["type"] !== "object")
    .map((a) => a.name);
  r.add(
    "manifest.object-schemas",
    "input and output schemas are objects",
    nonObject.length ? "fail" : "pass",
    ["P-ACT-4"],
    nonObject.length ? nonObject.join(", ") : "All object schemas",
    DOCS.actions,
  );

  const exampleProblems: string[] = [];
  let exampleCount = 0;
  for (const a of m.actions) {
    for (const [i, ex] of (a.examples ?? []).entries()) {
      exampleCount++;
      const inIssues = validateJsonSchema(a.input, ex.input);
      const outIssues = validateJsonSchema(
        a.output,
        stripReservedDeep(ex.output, a.display?.items),
      );
      if (inIssues.length)
        exampleProblems.push(
          `${a.name}.examples[${i}].input: ${inIssues[0]!.path} ${inIssues[0]!.message}`,
        );
      if (outIssues.length)
        exampleProblems.push(
          `${a.name}.examples[${i}].output: ${outIssues[0]!.path} ${outIssues[0]!.message}`,
        );
    }
  }
  const withoutExamples = m.actions.filter((a) => !a.examples?.length).map((a) => a.name);
  r.add(
    "manifest.examples-validate",
    "Examples validate against their schemas",
    exampleProblems.length ? "fail" : withoutExamples.length ? "warn" : "pass",
    ["P-ACT-5"],
    exampleProblems.length
      ? exampleProblems.slice(0, 5).join("; ")
      : withoutExamples.length
        ? `${exampleCount} examples valid; no examples on: ${withoutExamples.join(", ")}`
        : `${exampleCount} examples valid`,
    DOCS.actions,
  );

  const reserved = m.actions.filter((a) => schemaMentionsReserved(a.output)).map((a) => a.name);
  r.add(
    "manifest.reserved-key",
    `Output schemas do not declare ${WIRE.field.axeReserved}`,
    reserved.length ? "fail" : "pass",
    ["P-ACT-6", "P-AFF-5"],
    reserved.length ? reserved.join(", ") : "None declare it",
    DOCS.display,
  );

  const badLen = m.actions
    .filter((a) => a.description.trim().length < 40 || a.description.trim().length > 400)
    .map((a) => `${a.name} (${a.description.trim().length})`);
  const manifestLen = m.description.trim().length;
  r.add(
    "manifest.description-length",
    "Descriptions are 40–400 characters",
    badLen.length || manifestLen < 40 || manifestLen > 400 ? "fail" : "pass",
    ["P-ACT-7"],
    [
      manifestLen < 40 || manifestLen > 400 ? `manifest.description (${manifestLen})` : "",
      ...badLen,
    ]
      .filter(Boolean)
      .join(", ") || "All within range",
    DOCS.actions,
  );

  const lint = lintManifest(m);
  const directives = lint.filter((i) => i.rule === "agent-directive");
  const persuasion = lint.filter((i) => i.rule === "persuasion");
  r.add(
    "manifest.honesty",
    "Agent-read text: no directives to the agent, no persuasion",
    directives.length ? "fail" : persuasion.length ? "warn" : "pass",
    ["P-MAN-3", "P-ACT-7", "P-REQ-4", "P-HAND-3", "P-HON-1", "P-HON-2"],
    [...directives, ...persuasion]
      .slice(0, 6)
      .map((i) => `${i.location}: "${i.excerpt}"`)
      .join("; ") || "Clean",
    DOCS.honesty,
  );

  const badAuth = m.actions
    .filter((a) => !m.auth.modes.includes(a.auth))
    .map((a) => `${a.name} (${a.auth})`);
  r.add(
    "manifest.auth-modes",
    "Every action auth mode is declared in auth.modes",
    badAuth.length ? "fail" : "pass",
    ["P-AUTH-1"],
    badAuth.length ? badAuth.join(", ") : `modes: ${m.auth.modes.join(", ")}`,
    DOCS.auth,
  );

  // Display pointers against schemas.
  const displayProblems: string[] = [];
  const itemSchemas = new Map<string, JsonSchema>();
  for (const a of m.actions) {
    if (!a.display) {
      itemSchemas.set(a.name, a.output);
      continue;
    }
    try {
      itemSchemas.set(a.name, validateDisplay(a.name, a.display, a.output));
      if (!a.display.item?.url)
        displayProblems.push(`${a.name}: display.item.url missing (SHOULD)`);
    } catch (e) {
      displayProblems.push((e as Error).message);
      itemSchemas.set(a.name, a.output);
    }
  }
  const hardDisplay = displayProblems.filter((p) => !p.includes("(SHOULD)"));
  r.add(
    "manifest.display-pointers",
    "display pointers resolve against output schemas",
    hardDisplay.length ? "fail" : displayProblems.length ? "warn" : "pass",
    ["P-DISP-1", "P-DISP-2", "P-DISP-3"],
    displayProblems.slice(0, 5).join("; ") ||
      `${m.actions.filter((a) => a.display).length} displays valid`,
    DOCS.display,
  );

  // Affordances.
  const affProblems: string[] = [];
  const byName = new Map(m.actions.map((a) => [a.name, a]));
  for (const a of m.actions) {
    if (!a.affordances) continue;
    try {
      const unresolved = validateAffordances(
        a.name,
        a.affordances,
        itemSchemas.get(a.name) ?? a.output,
        a.output,
        (n) => byName.get(n)?.input,
      );
      for (const t of unresolved)
        affProblems.push(`${a.name}: affordance target "${t}" is not in the manifest`);
      for (const [i, aff] of a.affordances.entries()) {
        const target = byName.get(aff.action);
        if (target) validateAffordanceBinding(a.name, i, aff, target.input);
      }
    } catch (e) {
      affProblems.push((e as Error).message);
    }
  }
  r.add(
    "manifest.affordances",
    "Affordances target real actions, bind real inputs, ≤6 with ≤1 primary",
    affProblems.length ? "fail" : "pass",
    ["P-AFF-1", "P-AFF-2", "P-HON-4"],
    affProblems.slice(0, 5).join("; ") ||
      `${m.actions.reduce((n, a) => n + (a.affordances?.length ?? 0), 0)} affordances valid`,
    DOCS.display,
  );

  const pagProblems: string[] = [];
  for (const a of m.actions) {
    try {
      validatePagination(a.name, a.pagination, a.input, a.output);
    } catch (e) {
      pagProblems.push((e as Error).message);
    }
  }
  r.add(
    "manifest.pagination",
    "pagination pointers resolve",
    pagProblems.length ? "fail" : "pass",
    ["P-AFF-7"],
    pagProblems.join("; ") || `${m.actions.filter((a) => a.pagination).length} paginated actions`,
    DOCS.display,
  );

  const freshProblems: string[] = [];
  for (const a of m.actions) {
    try {
      validateFreshness(a.name, a.freshness, a.output);
    } catch (e) {
      freshProblems.push((e as Error).message);
    }
  }
  r.add(
    "manifest.freshness",
    "freshness pointers resolve",
    freshProblems.length ? "fail" : "pass",
    ["P-AFF-8"],
    freshProblems.join("; ") ||
      `${m.actions.filter((a) => a.freshness).length} actions declare freshness`,
    DOCS.display,
  );

  const bare = m.actions.filter((a) => isBareQuerySearch(a.input)).map((a) => a.name);
  r.add(
    "manifest.structured-filters",
    "Search inputs expose structured filters",
    bare.length ? "warn" : "pass",
    ["P-AFF-9"],
    bare.length ? `Free-text-only search: ${bare.join(", ")}` : "No bare query searches",
    DOCS.actions,
  );

  const flowProblems = (m.flows ?? []).flatMap((f) =>
    f.steps.filter((s) => !byName.has(s)).map((s) => `${f.name}: step "${s}" not in manifest`),
  );
  r.add(
    "manifest.flows",
    "Flow steps name real actions",
    flowProblems.length ? "fail" : "pass",
    ["P-FLOW-1"],
    flowProblems.join("; ") || `${m.flows?.length ?? 0} flows`,
    DOCS.manifest,
  );

  const vendor = (r.options.vendor ?? "AXE Conformance").toLowerCase();
  const policy = m.policies?.agents;
  const denied =
    policy?.deny?.some((d) => d.toLowerCase() === vendor) ||
    (policy?.allow &&
      !policy.allow.includes("*") &&
      !policy.allow.some((a) => a.toLowerCase() === vendor));
  r.add(
    "manifest.agents-policy",
    "policies.agents evaluated for this vendor",
    "pass",
    ["P-DISC-11", "P-DISC-12"],
    denied
      ? `Vendor "${vendor}" is denied; live checks that call actions are skipped.`
      : policy
        ? `allow: ${policy.allow?.join(", ") ?? "*"}; deny: ${policy.deny?.join(", ") ?? "(none)"}`
        : "No agent policy (all vendors permitted)",
    DOCS.security,
  );
  if (denied) r.options.noMutate = true;

  if (m.indexUrl) {
    try {
      const idx = await r.request(m.indexUrl);
      const body = idx.ok ? await idx.json() : null;
      const p = PlatformIndexSchema.safeParse(body);
      let originOk = true;
      if (p.success) {
        for (const s of p.data.sites.slice(0, 3)) {
          try {
            const sm = await r.request(s.manifestUrl);
            const smb = (await sm.json()) as Manifest;
            if (new URL(smb.baseUrl).origin !== new URL(s.manifestUrl).origin) originOk = false;
          } catch {
            originOk = false;
          }
        }
      }
      r.add(
        "manifest.index",
        "Platform index is valid and tenant origins match",
        p.success && originOk ? "pass" : "fail",
        ["P-DISC-8", "P-DISC-9", "P-DISC-10"],
        p.success
          ? `${p.data.sites.length} sites on first page${p.data.next ? ", paginated" : ""}${originOk ? "" : "; a tenant manifest baseUrl origin differs from its manifestUrl"}`
          : `Invalid: ${p.error?.issues[0]?.message ?? `HTTP ${idx.status}`}`,
        "docs/platforms.md",
      );
    } catch (e) {
      r.add(
        "manifest.index",
        "Platform index is valid",
        "fail",
        ["P-DISC-8"],
        `Could not fetch ${m.indexUrl}: ${(e as Error).message}`,
        "docs/platforms.md",
      );
    }
  } else {
    r.add(
      "manifest.index",
      "Platform index (when referenced)",
      "skip",
      ["P-DISC-8", "P-DISC-9", "P-DISC-10"],
      "No indexUrl in the manifest.",
      "docs/platforms.md",
    );
  }
}

async function runtime(r: Runner): Promise<void> {
  const m = r.manifest!;
  const first = m.actions.find((a) => r.callable(a)) ?? m.actions[0];

  // Unknown action → 404 not_found envelope.
  {
    const { res, json } = await r.post(`${WIRE.path.actions}/axe-conformance.unknown`, {
      input: {},
      context: r.context(),
    });
    const code = errorCode(isResult(json) ? json : null);
    r.add(
      "runtime.unknown-action",
      "Unknown action → 404 with not_found envelope",
      res.status === 404 && code === WIRE.error.notFound ? "pass" : "fail",
      ["P-INV-5", "P-INV-6"],
      `HTTP ${res.status}, code ${code ?? "(no envelope)"}`,
      DOCS.errors,
    );
    if (res.headers.get(WIRE.header.protocol) === null)
      r.add(
        "runtime.protocol-header",
        `${WIRE.header.protocol} on error responses`,
        "fail",
        ["P-VER-2"],
        "Missing on the 404 response",
        DOCS.discovery,
      );
  }

  if (!first) {
    r.add(
      "runtime.invalid-input",
      "Invalid input → invalid_input with issues",
      "skip",
      ["P-INV-2", "P-ERR-3", "P-INV-6"],
      "No actions in the manifest.",
      DOCS.errors,
    );
    return;
  }

  // Missing input member.
  {
    const { res, json } = await r.post(`${WIRE.path.actions}/${first.name}`, {
      context: r.context(),
    });
    const code = errorCode(isResult(json) ? json : null);
    r.add(
      "runtime.missing-input",
      "Envelope without input → invalid_input",
      res.status === 400 && code === WIRE.error.invalidInput ? "pass" : "fail",
      ["P-INV-1"],
      `HTTP ${res.status}, code ${code ?? "(none)"} on ${first.name}`,
      DOCS.errors,
    );
  }

  // An oversized body is refused before it is read in full ([P-LIM-1]). The body streams up to
  // 32 MiB and is never valid JSON, so no handler can run whatever the server does with it.
  {
    const cap = 32 * 1024 * 1024;
    const enc = new TextEncoder();
    const chunk = enc.encode("x".repeat(64 * 1024));
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent === 0) {
          const head = enc.encode('{"input":{"axeConformancePad":"');
          sent += head.byteLength;
          controller.enqueue(head);
        } else if (sent >= cap) {
          controller.close();
        } else {
          sent += chunk.byteLength;
          controller.enqueue(chunk);
        }
      },
    });
    let res: Response | undefined;
    let json: unknown = null;
    try {
      res = await r.request(`${WIRE.path.actions}/${first.name}`, {
        method: "POST",
        body,
        duplex: "half",
      } as RequestInit);
      json = JSON.parse(await res.text());
    } catch {
      // Reported below.
    }
    const result = isResult(json) ? json : null;
    const reason =
      result?.status === WIRE.status.error ? result.error.details?.["reason"] : undefined;
    const envelope =
      res?.status === 413 &&
      errorCode(result) === WIRE.error.invalidInput &&
      reason === WIRE.reason.payloadTooLarge;
    // A 413 without an envelope was refused in front of the AXE server (a proxy, or a body
    // parser mounted before it): the limit holds, but the agent gets no result envelope.
    r.add(
      "runtime.body-limit",
      "A body over the server's limit → 413 invalid_input, payload_too_large, before it is read in full",
      envelope ? "pass" : res?.status === 413 && !result ? "warn" : "fail",
      ["P-LIM-1"],
      res
        ? `HTTP ${res.status}, code ${errorCode(result) ?? "(none)"}, reason ${String(reason ?? "(none)")}, after sending ${sent} bytes${res.status === 413 && !result ? "; refused in front of the AXE server without a result envelope (mount the AXE middleware before body parsers)" : ""}`
        : `No response after sending ${sent} bytes`,
      DOCS.limits,
    );
  }

  // Deep nesting is refused as input, not a server failure ([P-LIM-2]).
  {
    const depth = 20_000;
    const res = await r
      .request(`${WIRE.path.actions}/${first.name}`, {
        method: "POST",
        body: `{"input":{"axeConformanceDeep":${"[".repeat(depth)}${"]".repeat(depth)}},"idempotencyKey":"${crypto.randomUUID()}"}`,
      })
      .catch(() => undefined);
    let json: unknown = null;
    try {
      json = res ? JSON.parse(await res.text()) : null;
    } catch {
      json = null;
    }
    const code = errorCode(isResult(json) ? json : null);
    r.add(
      "runtime.nesting-limit",
      `A body nested ${depth} levels deep → 4xx invalid_input, not a server error`,
      res && res.status >= 400 && res.status < 500 && code === WIRE.error.invalidInput
        ? "pass"
        : "fail",
      ["P-LIM-2"],
      res ? `HTTP ${res.status}, code ${code ?? "(none)"}` : "No response",
      DOCS.limits,
    );
  }

  // Invalid input with a bogus property and a wrong type.
  {
    const props = Object.keys((first.input["properties"] ?? {}) as object);
    const bogus: Record<string, unknown> = { axeConformanceBogusField: 1 };
    if (props[0]) bogus[props[0]] = { unexpected: true };
    const { res, json } = await r.post(`${WIRE.path.actions}/${first.name}`, {
      input: bogus,
      context: r.context(),
      idempotencyKey: crypto.randomUUID(),
    });
    const result = isResult(json) ? json : null;
    const code = errorCode(result);
    const issues = result?.status === WIRE.status.error ? result.error.details?.issues : undefined;
    const hasPaths =
      Array.isArray(issues) &&
      issues.length > 0 &&
      issues.every((i) => typeof i.path === "string" && typeof i.message === "string");
    const additionalAllowed = first.input["additionalProperties"] !== false && !props[0];
    r.add(
      "runtime.invalid-input",
      "Invalid input → 400 invalid_input naming each path",
      code === WIRE.error.invalidInput && res.status === 400 && hasPaths
        ? "pass"
        : additionalAllowed && result?.status !== WIRE.status.error
          ? "warn"
          : "fail",
      ["P-INV-2", "P-ERR-3", "P-INV-6"],
      code === WIRE.error.invalidInput
        ? `${issues?.length ?? 0} issues: ${(issues ?? []).map((i) => i.path).join(", ")}`
        : additionalAllowed
          ? `${first.name} accepts unknown properties and has no typed fields to violate; declare additionalProperties: false.`
          : `HTTP ${res.status}, code ${code ?? result?.status ?? "(none)"}`,
      DOCS.errors,
    );
  }

  // Unsupported version.
  {
    const { res, json } = await r.post(
      `${WIRE.path.actions}/${first.name}`,
      { input: {}, context: r.context() },
      { [WIRE.header.protocol]: "axe/99.0" },
    );
    const code = errorCode(isResult(json) ? json : null);
    r.add(
      "runtime.unsupported-version",
      `${WIRE.header.protocol}: axe/99.0 → unsupported`,
      code === WIRE.error.unsupported ? "pass" : "fail",
      ["P-VER-5"],
      `HTTP ${res.status}, code ${code ?? "(none)"}`,
      DOCS.discovery,
    );
  }

  // Unknown envelope fields ignored.
  {
    const readable = m.actions.find((a) => a.readOnly && a.examples?.length && r.callable(a));
    if (readable) {
      const { result } = await r.invoke({ ...readable }, readable.examples![0]!.input);
      const ok = result && result.status !== WIRE.status.error;
      const { json } = await r.post(`${WIRE.path.actions}/${readable.name}`, {
        input: readable.examples![0]!.input,
        context: r.context(),
        axeFutureField: { nested: true },
      });
      const res2 = isResult(json) ? json : null;
      r.add(
        "runtime.unknown-fields-ignored",
        "Unknown envelope fields are ignored",
        ok && res2 && res2.status === result?.status ? "pass" : "fail",
        ["P-VER-4"],
        `${readable.name}: ${result?.status ?? "no envelope"} → ${res2?.status ?? "no envelope"} with an extra field`,
        DOCS.discovery,
      );
    } else {
      r.add(
        "runtime.unknown-fields-ignored",
        "Unknown envelope fields are ignored",
        "skip",
        ["P-VER-4"],
        "No callable read-only action with an example.",
        DOCS.discovery,
      );
    }
  }

  // GET definition.
  {
    const res = await r.request(`${WIRE.path.actions}/${first.name}`);
    const okStatus = res.status === 200 || res.status === 404 || res.status === 405;
    r.add(
      "runtime.get-definition",
      `GET ${WIRE.path.actions}/{name} returns the definition or 404/405`,
      okStatus ? "pass" : "fail",
      ["P-INV-4"],
      `HTTP ${res.status}`,
      DOCS.manifest,
    );
  }

  // Continue and resume endpoints with garbage tokens.
  {
    const { res, json } = await r.post(WIRE.path.continue, {
      continuationToken: "axe-conformance-garbage",
      kind: WIRE.kind.contactEmail,
      payload: { email: "a@b.co" },
    });
    const code = errorCode(isResult(json) ? json : null);
    r.add(
      "runtime.continue-endpoint",
      `${WIRE.path.continue} rejects unknown tokens with not_found`,
      code === WIRE.error.notFound && res.status === 404 ? "pass" : "fail",
      ["P-REQ-7", "P-TOK-3"],
      `HTTP ${res.status}, code ${code ?? "(none)"}`,
      DOCS.ladder,
    );
  }
  {
    const { res, json } = await r.post(WIRE.path.resume, {
      resumeToken: "axe-conformance-garbage",
    });
    const code = errorCode(isResult(json) ? json : null);
    r.add(
      "runtime.resume-endpoint",
      `${WIRE.path.resume} rejects unknown tokens with not_found`,
      code === WIRE.error.notFound && res.status === 404 ? "pass" : "fail",
      ["P-HAND-4", "P-TOK-3"],
      `HTTP ${res.status}, code ${code ?? "(none)"}`,
      DOCS.handoff,
    );
  }

  // Envelope schema on a live call.
  {
    const readable = m.actions.find((a) => a.readOnly && a.examples?.length && r.callable(a));
    if (readable) {
      const { result, res } = await r.invoke(readable, readable.examples![0]!.input);
      const parsed = ResultSchema.safeParse(result);
      r.add(
        "runtime.envelope-schema",
        "Live results validate against the result envelope schema",
        parsed.success ? "pass" : "fail",
        ["P-RES-1", "P-ERR-1"],
        parsed.success
          ? `${readable.name} → ${result!.status} (HTTP ${res.status})`
          : parsed.error.issues
              .slice(0, 3)
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; "),
        DOCS.errors,
      );
    } else {
      r.add(
        "runtime.envelope-schema",
        "Live results validate against the result envelope schema",
        "skip",
        ["P-RES-1", "P-ERR-1"],
        "No callable read-only action with an example.",
        DOCS.errors,
      );
    }
  }

  // Example round trips with output validation and display resolution.
  {
    const problems: string[] = [];
    let ran = 0;
    for (const a of m.actions.filter((x) => x.readOnly && x.examples?.length && r.callable(x))) {
      const { result } = await r.invoke(a, a.examples![0]!.input);
      ran++;
      if (!result) {
        problems.push(`${a.name}: no envelope`);
        continue;
      }
      if (result.status !== WIRE.status.ok) {
        problems.push(
          `${a.name}: ${result.status}${result.status === WIRE.status.error ? ` ${result.error.code}: ${result.error.message}` : ""}`,
        );
        continue;
      }
      r.obs.outputs.push({ action: a.name, output: result.output });
      const issues = validateJsonSchema(
        a.output,
        stripReservedDeep(result.output, a.display?.items),
      );
      if (issues.length)
        problems.push(`${a.name}: live output ${issues[0]!.path} ${issues[0]!.message}`);
      if (a.display) {
        const presented = resolveDisplay(a, result.output);
        const bad = presented.items.filter((i) => !i.id || !i.title);
        if (bad.length)
          problems.push(`${a.name}: ${bad.length} item(s) resolved without id or title`);
        if (presented.items.some((i) => i.affordances.length > 6))
          problems.push(`${a.name}: more than 6 affordances on an item`);
      }
    }
    r.add(
      "runtime.example-roundtrip",
      "Read actions return ok for their examples; outputs validate; display resolves",
      ran === 0 ? "skip" : problems.length ? "fail" : "pass",
      ["P-DISP-2"],
      problems.slice(0, 5).join("; ") ||
        (ran
          ? `${ran} read actions round-tripped`
          : "No callable read-only actions with examples."),
      DOCS.display,
    );
  }

  // Pagination round trip.
  {
    const paged = m.actions.find(
      (a) => a.pagination && a.readOnly && a.examples?.length && r.callable(a),
    );
    if (!paged) {
      r.add(
        "runtime.pagination-roundtrip",
        "Pagination cursor round-trips",
        "skip",
        ["P-AFF-7"],
        "No paginated read action with an example.",
        DOCS.display,
      );
    } else {
      const { result } = await r.invoke(paged, paged.examples![0]!.input);
      if (result?.status === WIRE.status.ok) {
        const cursor = getPointer(result.output, paged.pagination!.cursorOut);
        if (cursor === null || cursor === undefined) {
          r.add(
            "runtime.pagination-roundtrip",
            "Pagination cursor round-trips",
            "pass",
            ["P-AFF-7"],
            `${paged.name}: single page (cursorOut is ${cursor === null ? "null" : "absent"})`,
            DOCS.display,
          );
        } else {
          const input = { ...(paged.examples![0]!.input as Record<string, unknown>) };
          const key = paged.pagination!.cursorIn.slice(1);
          input[key] = cursor;
          const { result: page2 } = await r.invoke(paged, input);
          r.add(
            "runtime.pagination-roundtrip",
            "Pagination cursor round-trips",
            page2?.status === WIRE.status.ok ? "pass" : "fail",
            ["P-AFF-7"],
            `${paged.name}: second page → ${page2?.status ?? "no envelope"}`,
            DOCS.display,
          );
        }
      } else {
        r.add(
          "runtime.pagination-roundtrip",
          "Pagination cursor round-trips",
          "fail",
          ["P-AFF-7"],
          `${paged.name} example did not return ok (${result?.status ?? "no envelope"})`,
          DOCS.display,
        );
      }
    }
  }

  // CORS.
  {
    const res = await r.request(`${WIRE.path.actions}/${first.name}`, {
      method: "OPTIONS",
      headers: { Origin: "https://agent.example", "Access-Control-Request-Method": "POST" },
    });
    const allow = res.headers.get("access-control-allow-origin");
    if (!allow) {
      r.add(
        "runtime.cors",
        "CORS preflight (when enabled)",
        "skip",
        ["P-INV-9"],
        "CORS is not enabled (no Access-Control-Allow-Origin on preflight). Enable it only if browser-based agents should call you.",
        DOCS.cors,
      );
    } else {
      const methods = res.headers.get("access-control-allow-methods") ?? "";
      const headers = (res.headers.get("access-control-allow-headers") ?? "").toLowerCase();
      const ok =
        res.status === 204 &&
        /POST/.test(methods) &&
        headers.includes(WIRE.header.protocol.toLowerCase()) &&
        headers.includes("authorization");
      r.add(
        "runtime.cors",
        "CORS preflight allows POST, Authorization, and AXE-Protocol",
        ok ? "pass" : "fail",
        ["P-INV-9"],
        `HTTP ${res.status}; methods: ${methods}; headers: ${headers}`,
        DOCS.cors,
      );
    }
  }

  // Rate limit header.
  {
    if (m.policies?.rateLimit) {
      const res = await r.request(WIRE.path.manifest);
      const v = res.headers.get(WIRE.header.rateLimitPolicy);
      r.add(
        "runtime.rate-limit-header",
        `${WIRE.header.rateLimitPolicy} header when policies.rateLimit is declared`,
        v ? "pass" : "warn",
        ["P-AGENT-2"],
        v
          ? `${WIRE.header.rateLimitPolicy}: ${v}`
          : `policies.rateLimit is declared but no ${WIRE.header.rateLimitPolicy} header is sent.`,
        "docs/deploying.md#rate-limiting",
      );
    } else {
      r.add(
        "runtime.rate-limit-header",
        "Rate limit declared",
        "warn",
        ["P-AGENT-2"],
        "No policies.rateLimit in the manifest. Declare one so agents pace themselves.",
        "docs/deploying.md#rate-limiting",
      );
    }
  }

  // A state-changing POST whose body is not labeled JSON is refused ([P-TRANS-1]). A browser
  // sends text/plain to any origin without a preflight, so accepting it opens a CSRF path.
  {
    const target =
      m.actions.find((a) => !a.readOnly && a.examples?.length && r.callable(a)) ??
      m.actions.find((a) => !a.readOnly);
    const title = "text/plain POST to a mutating action → unsupported";
    if (!target || r.options.noMutate) {
      r.add(
        "runtime.json-content-type",
        title,
        "skip",
        ["P-TRANS-1"],
        r.options.noMutate ? "Skipped: --no-mutate." : "The manifest declares no mutating action.",
        DOCS.security,
      );
    } else {
      const res = await r.request(`${WIRE.path.actions}/${encodeURIComponent(target.name)}`, {
        method: "POST",
        headers: { [WIRE.header.contentType]: "text/plain;charset=UTF-8" },
        body: JSON.stringify({
          input: target.examples?.[0]?.input ?? {},
          context: r.context(),
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const text = await res.text();
      let json: unknown = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
      if (res.status >= 400) r.errorBodies.push(text);
      const result = isResult(json) ? json : null;
      const code = errorCode(result);
      r.add(
        "runtime.json-content-type",
        title,
        code === WIRE.error.unsupported
          ? "pass"
          : result && result.status !== WIRE.status.error
            ? "fail"
            : "warn",
        ["P-TRANS-1"],
        code === WIRE.error.unsupported
          ? `${target.name} refused a text/plain body`
          : result && result.status !== WIRE.status.error
            ? `${target.name} accepted a text/plain body (status ${result.status}). A cross-origin page can send that without a preflight; require Content-Type: application/json.`
            : `${target.name} refused a text/plain body with ${code ?? `HTTP ${res.status}`}, not unsupported; it may have refused for another reason first.`,
        DOCS.security,
      );
    }
  }

  // Idempotency.
  {
    const mutating = m.actions.find(
      (a) => !a.readOnly && a.examples?.length && r.callable(a) && !a.humanHandoff,
    );
    const target =
      mutating ?? m.actions.find((a) => !a.readOnly && a.examples?.length && r.callable(a));
    if (!target || r.options.noMutate) {
      const why = r.options.noMutate
        ? "Skipped: --no-mutate."
        : "No callable mutating action with an example. Provide --auth to exercise user actions.";
      r.add(
        "runtime.idempotency-required",
        "Mutating call without idempotencyKey → invalid_input",
        "skip",
        ["P-IDEM-1"],
        why,
        DOCS.idempotency,
      );
      r.add(
        "runtime.idempotency-replay",
        "Same key + same input → identical result",
        "skip",
        ["P-IDEM-2"],
        why,
        DOCS.idempotency,
      );
      r.add(
        "runtime.idempotency-conflict",
        "Same key + different input → conflict",
        "skip",
        ["P-IDEM-3"],
        why,
        DOCS.idempotency,
      );
    } else {
      const input = target.examples![0]!.input;
      const { json } = await r.post(`${WIRE.path.actions}/${target.name}`, {
        input,
        context: r.context(),
      });
      const code = errorCode(isResult(json) ? json : null);
      r.add(
        "runtime.idempotency-required",
        "Mutating call without idempotencyKey → invalid_input",
        code === WIRE.error.invalidInput ? "pass" : "warn",
        ["P-IDEM-1"],
        code === WIRE.error.invalidInput
          ? `${target.name} requires a key`
          : `${target.name} accepted a call without a key (status ${isResult(json) ? json.status : "?"}). Requiring one makes agent retries safe.`,
        DOCS.idempotency,
      );
      const key = crypto.randomUUID();
      const a1 = await r.invoke(target, input, key);
      const a2 = await r.invoke(target, input, key);
      const same =
        a1.result &&
        a2.result &&
        JSON.stringify(a1.result) === JSON.stringify(a2.result) &&
        a1.result.status !== WIRE.status.error;
      r.obs.idempotencyReplayWorked = Boolean(same);
      r.add(
        "runtime.idempotency-replay",
        "Same key + same input → identical result",
        same ? "pass" : "fail",
        ["P-IDEM-2"],
        same
          ? `${target.name}: replay returned the original ${a1.result!.status}`
          : `${target.name}: first ${a1.result?.status ?? "?"}, replay ${a2.result?.status ?? "?"}${a1.result?.status === WIRE.status.error ? ` (${(a1.result as { error: { message: string } }).error.message})` : ""}`,
        DOCS.idempotency,
      );
      const different = variantInput(target, input);
      const { json: j3 } = await r.post(`${WIRE.path.actions}/${target.name}`, {
        input: different,
        context: r.context(),
        idempotencyKey: key,
      });
      const c3 = errorCode(isResult(j3) ? j3 : null);
      r.add(
        "runtime.idempotency-conflict",
        "Same key + different input → conflict",
        c3 === WIRE.error.conflict ? "pass" : c3 === WIRE.error.invalidInput ? "warn" : "fail",
        ["P-IDEM-3"],
        c3 === WIRE.error.conflict
          ? "conflict returned"
          : c3 === WIRE.error.invalidInput
            ? "The variant input was rejected as invalid before the key was checked. Acceptable, but the check could not confirm conflict detection."
            : `Got ${c3 ?? (isResult(j3) ? j3.status : "no envelope")}`,
        DOCS.idempotency,
      );
    }
  }

  const leaked = r.errorBodies.filter((t) => /\n\s+at\s|node_modules|Traceback|<html/i.test(t));
  r.add(
    "runtime.error-hygiene",
    "Error bodies contain no stack traces or internals",
    leaked.length ? "fail" : "pass",
    ["P-ERR-2"],
    leaked.length
      ? `${leaked.length} of ${r.errorBodies.length} error responses leaked a stack trace or HTML error page.`
      : `${r.errorBodies.length} error responses checked`,
    DOCS.security,
  );
}

async function ladder(r: Runner): Promise<void> {
  const m = r.manifest!;
  const skipAll = (why: string) => {
    for (const [id, title, reqs] of [
      [
        "ladder.needs-input-shape",
        "needs_input carries ordered accepts with schemas",
        ["P-REQ-1", "P-REQ-2", "P-REQ-5"],
      ],
      ["ladder.sensitive-kinds", "Sensitive kinds are marked sensitive", ["P-REQ-3"]],
      [
        "ladder.continue-invalid",
        "continue with an invalid payload → invalid_input, token kept",
        ["P-REQ-8"],
      ],
      ["ladder.continue-valid", "continue with a valid payload → non-error", ["P-REQ-7"]],
      ["ladder.continue-replay", "Repeated continuation → original envelope", ["P-REQ-9"]],
      ["ladder.fallback-resume", "fallback handoff resumes", ["P-REQ-6", "P-HAND-4"]],
      ["ladder.resume-replay", "Repeated resume → original envelope", ["P-HAND-6"]],
      ["ladder.handoff-shape", "Handoff has every member", ["P-HAND-1"]],
      ["ladder.token-ttl", "Token lifetimes within recommended bounds", ["P-TOK-5"]],
      ["runtime.token-tamper", "Tampered token → not_found", ["P-TOK-3"]],
      [
        "ladder.token-principal",
        "Token presented without the caller's credentials → not_found",
        ["P-TOK-6"],
      ],
      ["ladder.fake-kinds", "No custom kind duplicates a well-known kind", ["P-HON-5"]],
      ["ladder.consent-scope", "Consent requirements reference version and scope", ["P-HON-6"]],
      [
        "ladder.needs-human-avoidable",
        "needs_human not used where a well-known kind would do",
        ["P-RES-2", "P-HAND-2"],
      ],
    ] as [string, string, string[]][]) {
      r.add(id, title, "skip", reqs, why, DOCS.ladder);
    }
  };
  if (r.options.noMutate) return skipAll("Skipped: --no-mutate.");

  // Find an action that returns needs_input.
  let target: ActionDefinition | undefined;
  let input: JsonValue | undefined;
  let ni: NeedsInputResult | undefined;
  const candidates: { a: ActionDefinition; input: JsonValue }[] = [];
  if (r.options.ladder) {
    const a = m.actions.find((x) => x.name === r.options.ladder!.action);
    if (a) candidates.push({ a, input: r.options.ladder.input });
  }
  for (const a of m.actions)
    if (!a.readOnly && a.examples?.length && r.callable(a))
      candidates.push({ a, input: a.examples[0]!.input });
  for (const c of candidates) {
    const { result } = await r.invoke(c.a, c.input);
    if (result?.status === WIRE.status.needsInput) {
      target = c.a;
      input = c.input;
      ni = result;
      r.obs.needsInput.push({ action: c.a.name, result });
      break;
    }
    if (result?.status === WIRE.status.needsHuman)
      r.obs.needsHuman.push({ action: c.a.name, reason: result.handoff.reason });
  }
  // Handoff shape from any needs_human observed.
  for (const c of candidates) {
    if (target && c.a.name === target.name) continue;
    if (r.obs.needsHuman.some((h) => h.action === c.a.name)) continue;
  }
  const seenHandoffs: {
    action: string;
    url: string;
    expiresAt: string;
    resumeToken: string;
    complete: boolean;
  }[] = [];
  for (const c of candidates) {
    const { result } = await r.invoke(c.a, c.input);
    if (result?.status === WIRE.status.needsHuman) {
      const h = result.handoff;
      seenHandoffs.push({
        action: c.a.name,
        url: h.url,
        expiresAt: h.expiresAt,
        resumeToken: h.resumeToken,
        complete: [
          h.reason,
          h.instructions,
          h.url,
          h.resumeToken,
          h.expiresAt,
          h.whatAgentShouldSayToUser,
        ].every((v) => typeof v === "string" && v.length > 0),
      });
      if (!r.obs.needsHuman.some((x) => x.action === c.a.name))
        r.obs.needsHuman.push({ action: c.a.name, reason: h.reason });
    }
  }
  if (ni?.fallback)
    seenHandoffs.push({
      action: target!.name,
      url: ni.fallback.url,
      expiresAt: ni.fallback.expiresAt,
      resumeToken: ni.fallback.resumeToken,
      complete: Object.values(ni.fallback).every((v) => typeof v === "string" && v.length > 0),
    });
  r.add(
    "ladder.handoff-shape",
    "Handoff has every member",
    seenHandoffs.length === 0 ? "skip" : seenHandoffs.every((h) => h.complete) ? "pass" : "fail",
    ["P-HAND-1"],
    seenHandoffs.length
      ? `${seenHandoffs.length} handoff(s) from ${[...new Set(seenHandoffs.map((h) => h.action))].join(", ")}`
      : "No needs_human observed.",
    DOCS.handoff,
  );

  const avoidable = r.obs.needsHuman.filter(
    (h) =>
      /payment|deposit|identity|consent|document|address|email|phone/i.test(h.reason) &&
      h.reason !== WIRE.reason.loginRequired,
  );
  r.add(
    "ladder.needs-human-avoidable",
    "needs_human not used where a well-known kind would do",
    avoidable.length ? "fail" : "pass",
    ["P-RES-2", "P-HAND-2"],
    avoidable.length
      ? avoidable
          .map(
            (h) =>
              `${h.action}: reason "${h.reason}" looks like a requirement a well-known kind covers; return needs_input first.`,
          )
          .join("; ")
      : `${r.obs.needsHuman.length} needs_human observed, none avoidable by reason`,
    DOCS.ladder,
  );

  if (!target || !ni || input === undefined) {
    const why = candidates.length
      ? "No callable action returned needs_input for its example. Pass --ladder <action> <input-json> to name one."
      : "No callable mutating action with an example. Provide --auth to exercise user actions.";
    for (const [id, title, reqs] of [
      [
        "ladder.needs-input-shape",
        "needs_input carries ordered accepts with schemas",
        ["P-REQ-1", "P-REQ-2", "P-REQ-5"],
      ],
      ["ladder.sensitive-kinds", "Sensitive kinds are marked sensitive", ["P-REQ-3"]],
      [
        "ladder.continue-invalid",
        "continue with an invalid payload → invalid_input, token kept",
        ["P-REQ-8"],
      ],
      ["ladder.continue-valid", "continue with a valid payload → non-error", ["P-REQ-7"]],
      ["ladder.continue-replay", "Repeated continuation → original envelope", ["P-REQ-9"]],
      ["ladder.fallback-resume", "fallback handoff resumes", ["P-REQ-6", "P-HAND-4"]],
      ["ladder.resume-replay", "Repeated resume → original envelope", ["P-HAND-6"]],
      ["ladder.token-ttl", "Token lifetimes within recommended bounds", ["P-TOK-5"]],
      ["runtime.token-tamper", "Tampered token → not_found", ["P-TOK-3"]],
      [
        "ladder.token-principal",
        "Token presented without the caller's credentials → not_found",
        ["P-TOK-6"],
      ],
      ["ladder.fake-kinds", "No custom kind duplicates a well-known kind", ["P-HON-5"]],
      ["ladder.consent-scope", "Consent requirements reference version and scope", ["P-HON-6"]],
    ] as [string, string, string[]][]) {
      r.add(id, title, "skip", reqs, why, DOCS.ladder);
    }
    return;
  }

  // Shape.
  const shapeOk =
    ni.accepts.length > 0 &&
    ni.accepts.every(
      (a) => a.kind && a.title && a.description && a.schema && typeof a.sensitive === "boolean",
    ) &&
    /^[a-z][a-z0-9_]*$/.test(ni.reason) &&
    ni.message.length > 0;
  const convention = suggestedReason(ni.accepts[0]!.kind);
  r.add(
    "ladder.needs-input-shape",
    "needs_input carries ordered accepts with schemas",
    shapeOk ? "pass" : "fail",
    ["P-REQ-1", "P-REQ-2", "P-REQ-5"],
    `${target.name}: reason ${ni.reason}${convention && convention !== ni.reason ? ` (convention for ${ni.accepts[0]!.kind.split(".")[0]} kinds is ${convention})` : ""}; accepts ${ni.accepts.map((a) => a.kind).join(", ")}`,
    DOCS.ladder,
  );

  const sensitiveMismatch = ni.accepts.filter((a) => {
    const wk = WELL_KNOWN_KINDS.find((k) => k.kind === a.kind);
    return wk && wk.sensitive && !a.sensitive;
  });
  r.add(
    "ladder.sensitive-kinds",
    "Sensitive kinds are marked sensitive",
    sensitiveMismatch.length ? "fail" : "pass",
    ["P-REQ-3"],
    sensitiveMismatch.length
      ? `Marked sensitive: false but sensitive by registry: ${sensitiveMismatch.map((a) => a.kind).join(", ")}`
      : "Consistent with the registry",
    DOCS.ladder,
  );

  const fakes = ni.accepts.filter(
    (a) =>
      isCustomKind(a.kind) &&
      WELL_KNOWN_KINDS.some((k) => schemasStructurallyEqual(kindJsonSchema(k), a.schema)),
  );
  r.add(
    "ladder.fake-kinds",
    "No custom kind duplicates a well-known kind",
    fakes.length ? "fail" : "pass",
    ["P-HON-5"],
    fakes.length
      ? `Custom kinds structurally identical to well-known ones: ${fakes.map((a) => a.kind).join(", ")}`
      : `${ni.accepts.filter((a) => isCustomKind(a.kind)).length} custom kinds checked`,
    DOCS.honesty,
  );

  const consent = ni.accepts.filter((a) => a.kind.startsWith("consent."));
  const consentOk = consent.every((a) => {
    const req = (a.schema["required"] ?? []) as string[];
    return req.includes("policyVersion") && req.includes("scope") && req.includes("policyUrl");
  });
  r.add(
    "ladder.consent-scope",
    "Consent requirements reference version and scope",
    consent.length === 0 ? "skip" : consentOk ? "pass" : "fail",
    ["P-HON-6"],
    consent.length ? `${consent.length} consent kind(s)` : "No consent kinds offered.",
    DOCS.honesty,
  );

  const ttlMin = (new Date(ni.expiresAt).getTime() - Date.now()) / 60000;
  const fbHours = ni.fallback
    ? (new Date(ni.fallback.expiresAt).getTime() - Date.now()) / 3600000
    : null;
  r.add(
    "ladder.token-ttl",
    "Token lifetimes within recommended bounds",
    ttlMin > 0 && ttlMin <= 16 && (fbHours === null || (fbHours > 0 && fbHours <= 25))
      ? "pass"
      : "warn",
    ["P-TOK-5"],
    `continuation ≈ ${Math.round(ttlMin)} min${fbHours !== null ? `, resume ≈ ${Math.round(fbHours)} h` : ""}`,
    DOCS.security,
  );

  // Tamper.
  {
    const t = ni.continuationToken;
    const tampered = t.slice(0, -3) + (t.endsWith("AAA") ? "BBB" : "AAA");
    const { json } = await r.post(WIRE.path.continue, {
      continuationToken: tampered,
      kind: ni.accepts[0]!.kind,
      payload: {},
    });
    const code = errorCode(isResult(json) ? json : null);
    r.obs.tokenTamperRejected = code === WIRE.error.notFound;
    r.add(
      "runtime.token-tamper",
      "Tampered token → not_found",
      code === WIRE.error.notFound ? "pass" : "fail",
      ["P-TOK-3"],
      `code ${code ?? "(none)"}`,
      DOCS.security,
    );
  }

  // Invalid payload.
  const entry: Accept | undefined =
    ni.accepts.find((a) => samplePayload(a.kind) !== undefined) ?? ni.accepts[0];
  {
    const { json, res } = await r.post(WIRE.path.continue, {
      continuationToken: ni.continuationToken,
      kind: entry!.kind,
      payload: { axeConformanceInvalid: true },
    });
    const result = isResult(json) ? json : null;
    const code = errorCode(result);
    const issues = result?.status === WIRE.status.error ? result.error.details?.issues : undefined;
    r.add(
      "ladder.continue-invalid",
      "continue with an invalid payload → invalid_input, token kept",
      code === WIRE.error.invalidInput &&
        res.status === 400 &&
        Array.isArray(issues) &&
        issues.length > 0
        ? "pass"
        : "fail",
      ["P-REQ-8"],
      `kind ${entry!.kind}: HTTP ${res.status}, code ${code ?? result?.status ?? "(none)"}, ${issues?.length ?? 0} issues`,
      DOCS.ladder,
    );
  }
  // Wrong kind.
  {
    const { json } = await r.post(WIRE.path.continue, {
      continuationToken: ni.continuationToken,
      kind: "x-axe-conformance.not-offered",
      payload: {},
    });
    const code = errorCode(isResult(json) ? json : null);
    if (code !== WIRE.error.invalidInput)
      r.add(
        "ladder.continue-invalid",
        "continue with a kind not in accepts → invalid_input",
        "fail",
        ["P-REQ-8"],
        `code ${code ?? "(none)"}`,
        DOCS.ladder,
      );
  }
  // The same token without the credentials it was minted with. The kind is not offered, so an
  // authorized request is invalid_input and nothing runs either way ([P-TOK-6]).
  {
    if (!r.options.auth) {
      r.add(
        "ladder.token-principal",
        "Token presented without the caller's credentials → not_found",
        "skip",
        ["P-TOK-6"],
        "No --auth: the token was minted anonymously and is not bound to a principal.",
        DOCS.auth,
      );
    } else {
      const { json } = await r.post(
        WIRE.path.continue,
        {
          continuationToken: ni.continuationToken,
          kind: "x-axe-conformance.not-offered",
          payload: {},
        },
        {},
        true,
      );
      const code = errorCode(isResult(json) ? json : null);
      const bound = target.auth !== WIRE.authMode.none;
      r.add(
        "ladder.token-principal",
        "Token presented without the caller's credentials → not_found",
        code === WIRE.error.notFound ? "pass" : bound ? "fail" : "warn",
        ["P-TOK-6"],
        code === WIRE.error.notFound
          ? `${target.name}: refused as an unknown token`
          : `${target.name}: anonymous presentation got ${code ?? "a non-error"}${bound ? "" : " (the action is auth none; the server may not have bound the token to the credential)"}`,
        DOCS.auth,
      );
    }
  }
  // Valid payload.
  const payload = samplePayload(entry!.kind);
  if (payload === undefined) {
    r.add(
      "ladder.continue-valid",
      "continue with a valid payload → non-error",
      "skip",
      ["P-REQ-7"],
      `Only custom kinds offered (${ni.accepts.map((a) => a.kind).join(", ")}); no sample payload available.`,
      DOCS.ladder,
    );
    r.add(
      "ladder.continue-replay",
      "Repeated continuation → original envelope",
      "skip",
      ["P-REQ-9"],
      "Depends on a successful continue.",
      DOCS.ladder,
    );
  } else {
    const { json, res } = await r.post(WIRE.path.continue, {
      continuationToken: ni.continuationToken,
      kind: entry!.kind,
      payload,
    });
    const result = isResult(json) ? json : null;
    const good = result && result.status !== WIRE.status.error;
    r.add(
      "ladder.continue-valid",
      "continue with a valid payload → non-error",
      good ? "pass" : "fail",
      ["P-REQ-7"],
      `kind ${entry!.kind}: HTTP ${res.status} → ${result?.status ?? "no envelope"}${result?.status === WIRE.status.error ? ` ${result.error.code}: ${result.error.message}` : ""}`,
      DOCS.ladder,
    );
    if (result) r.obs.calls.push({ action: target.name, status: result.status });
    const { json: j2 } = await r.post(WIRE.path.continue, {
      continuationToken: ni.continuationToken,
      kind: entry!.kind,
      payload,
    });
    const c2 = errorCode(isResult(j2) ? j2 : null);
    const same = JSON.stringify(j2) === JSON.stringify(json);
    r.add(
      "ladder.continue-replay",
      "Repeated continuation → original envelope",
      good ? (same ? "pass" : "fail") : "skip",
      ["P-REQ-9", "P-OP-1"],
      good
        ? same
          ? "the same kind and payload returned the original envelope"
          : `replay → ${c2 ?? (isResult(j2) ? j2.status : "no envelope")}, not the original envelope`
        : "Depends on a successful continue.",
      DOCS.ladder,
    );
  }

  // Fallback → resume on a fresh needs_input.
  if (!ni.fallback) {
    r.add(
      "ladder.fallback-resume",
      "fallback handoff resumes",
      "skip",
      ["P-REQ-6", "P-HAND-4"],
      `${target.name} offers no fallback handoff (agents will ask their user instead).`,
      DOCS.handoff,
    );
    r.add(
      "ladder.resume-replay",
      "Repeated resume → original envelope",
      "skip",
      ["P-HAND-6"],
      "No fallback handoff.",
      DOCS.handoff,
    );
  } else {
    const { result: fresh } = await r.invoke(target, input);
    if (fresh?.status !== WIRE.status.needsInput || !fresh.fallback) {
      r.add(
        "ladder.fallback-resume",
        "fallback handoff resumes",
        "fail",
        ["P-REQ-6", "P-HAND-4"],
        `Second call to ${target.name} returned ${fresh?.status ?? "no envelope"} instead of needs_input with a fallback.`,
        DOCS.handoff,
      );
      return;
    }
    const { json, res } = await r.post(WIRE.path.resume, {
      resumeToken: fresh.fallback.resumeToken,
    });
    const result = isResult(json) ? json : null;
    const gated =
      result?.status === WIRE.status.error &&
      result.error.code === WIRE.error.conflict &&
      result.error.details?.["handoffStatus"] === "open";
    const good = result && (result.status !== WIRE.status.error || gated);
    r.add(
      "ladder.fallback-resume",
      "fallback handoff resumes",
      good ? "pass" : "fail",
      ["P-REQ-6", "P-HAND-4"],
      gated
        ? "Resume is gated on completion (conflict with handoffStatus open), as the protocol allows."
        : `HTTP ${res.status} → ${result?.status ?? "no envelope"}${result?.status === WIRE.status.error ? ` ${result.error.code}` : ""}`,
      DOCS.handoff,
    );
    if (good && !gated) {
      const { json: j2 } = await r.post(WIRE.path.resume, {
        resumeToken: fresh.fallback.resumeToken,
      });
      const c2 = errorCode(isResult(j2) ? j2 : null);
      const same = JSON.stringify(j2) === JSON.stringify(json);
      r.add(
        "ladder.resume-replay",
        "Repeated resume → original envelope",
        same ? "pass" : "fail",
        ["P-HAND-6", "P-OP-1"],
        same
          ? "a repeated resume returned the original envelope"
          : `replay → ${c2 ?? (isResult(j2) ? j2.status : "no envelope")}, not the original envelope`,
        DOCS.handoff,
      );
    } else {
      r.add(
        "ladder.resume-replay",
        "Repeated resume → original envelope",
        "skip",
        ["P-HAND-6"],
        "Depends on a successful resume.",
        DOCS.handoff,
      );
    }
  }
}

const LIVE_CHECKS: [string, string, string[]][] = [
  [
    "live.state-endpoint",
    `${WIRE.path.state} returns the live state, uncached`,
    ["P-LIVE-7", "P-LIVE-8"],
  ],
  ["live.rev-on-envelopes", "Every envelope carries rev", ["P-LIVE-2"]],
  [
    "live.stale-conflict",
    "A stale expectedRev → 409 conflict with expectedRev and currentRev",
    ["P-LIVE-1", "P-LIVE-3"],
  ],
  ["live.fresh-accepted", "The current rev as expectedRev is accepted", ["P-LIVE-3"]],
  ["live.reasons", "Every unavailable action says why, in plain language", ["P-LIVE-5"]],
  [
    "live.availability-honored",
    "An action reported unavailable does not complete with ok",
    ["P-LIVE-6"],
  ],
];

/** Live state and revisions (spec §21). Every check skips when the manifest does not advertise `live`. */
async function live(r: Runner): Promise<void> {
  const m = r.manifest!;
  const skipAll = (why: string) => {
    for (const [id, title, reqs] of LIVE_CHECKS) r.add(id, title, "skip", reqs, why, DOCS.live);
  };
  if (!m.live) return skipAll("The manifest does not advertise live state (no `live` member).");
  const byId = new Map(LIVE_CHECKS.map((c) => [c[0], c] as const));
  const add = (id: string, status: CheckStatus, detail: string) => {
    const [, title, reqs] = byId.get(id)!;
    r.add(id, title, status, reqs, detail, DOCS.live);
  };

  // State endpoint.
  const stateUrl = m.live.url ?? `${r.base}${WIRE.path.state}`;
  let state: LiveState | null = null;
  try {
    const res = await r.request(stateUrl);
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    const parsed = LiveStateSchema.safeParse(json);
    const cc = (res.headers.get("cache-control") ?? "").toLowerCase();
    const noStore = cc.includes("no-store");
    if (res.ok && parsed.success) {
      state = parsed.data as LiveState;
      r.obs.liveState = state;
    }
    const missing = m.actions.filter((a) => !state?.actions[a.name]).map((a) => a.name);
    add(
      "live.state-endpoint",
      res.ok && parsed.success && noStore && missing.length === 0 ? "pass" : "fail",
      !res.ok
        ? `HTTP ${res.status} at ${stateUrl}`
        : !parsed.success
          ? `Invalid state document: ${parsed.error.issues
              .slice(0, 3)
              .map((i) => `${i.path.join(".") || "/"}: ${i.message}`)
              .join("; ")}`
          : [
              `rev ${state?.rev === undefined ? "(none)" : String(state?.rev)}; ${Object.keys(state?.actions ?? {}).length} actions`,
              noStore ? "" : `Cache-Control is "${cc || "(none)"}"; it must be no-store.`,
              missing.length ? `Actions missing from state: ${missing.join(", ")}` : "",
            ]
              .filter(Boolean)
              .join(". "),
    );
  } catch (e) {
    add("live.state-endpoint", "fail", `Request to ${stateUrl} failed: ${(e as Error).message}`);
  }

  // Reasons: every unavailable entry (manifest and state) has a plain-language reason with no directive.
  {
    const entries: { where: string; reason: string | undefined }[] = [];
    for (const a of m.actions)
      if (a.availability && !a.availability.available)
        entries.push({ where: `manifest ${a.name}`, reason: a.availability.reason });
    for (const [name, av] of Object.entries(state?.actions ?? {}))
      if (!av.available) entries.push({ where: `state ${name}`, reason: av.reason });
    const missing = entries.filter((e) => !e.reason?.trim());
    const directives = entries.filter(
      (e) =>
        e.reason &&
        lintAgentText(e.reason, { location: e.where }).some((i) => i.rule === "agent-directive"),
    );
    add(
      "live.reasons",
      missing.length || directives.length ? "fail" : "pass",
      entries.length === 0
        ? "No unavailable actions observed."
        : [
            missing.length ? `No reason: ${missing.map((e) => e.where).join(", ")}` : "",
            directives.length
              ? `Agent-directed text in reason: ${directives.map((e) => e.where).join(", ")}`
              : "",
          ]
            .filter(Boolean)
            .join("; ") || `${entries.length} unavailable action(s), each with a reason`,
    );
  }

  const readable = m.actions.find((a) => a.readOnly && a.examples?.length && r.callable(a));
  const rev = state?.rev;
  if (!readable) {
    const why = "No callable read-only action with an example.";
    add("live.rev-on-envelopes", "skip", why);
    add("live.stale-conflict", "skip", why);
    add("live.fresh-accepted", "skip", why);
  } else if (rev === undefined) {
    const why = "The site publishes availability but no revision (state.rev is absent).";
    add("live.rev-on-envelopes", "skip", why);
    add("live.stale-conflict", "skip", why);
    add("live.fresh-accepted", "skip", why);
  } else {
    const input = readable.examples![0]!.input;
    const { result } = await r.invoke(readable, input);
    add(
      "live.rev-on-envelopes",
      result && result.rev !== undefined ? "pass" : "fail",
      result
        ? result.rev !== undefined
          ? `${readable.name} → ${result.status} at rev ${String(result.rev)}`
          : `${readable.name} → ${result.status} without rev; a site with a revision stamps every envelope.`
        : "No envelope.",
    );
    const stale = typeof rev === "number" ? rev - 1 : `${rev}-axe-conformance-stale`;
    const { res, result: conflict } = await r.invoke(readable, input, undefined, stale);
    const details =
      conflict?.status === WIRE.status.error ? (conflict.error.details ?? {}) : undefined;
    const ok =
      conflict?.status === WIRE.status.error &&
      conflict.error.code === WIRE.error.conflict &&
      res.status === 409 &&
      conflict.error.retryable === true &&
      details?.[WIRE.field.expectedRev] === stale &&
      details?.[WIRE.field.currentRev] !== undefined;
    add(
      "live.stale-conflict",
      ok ? "pass" : "fail",
      ok
        ? `expectedRev ${String(stale)} → conflict; currentRev ${String(details?.[WIRE.field.currentRev])}`
        : `expectedRev ${String(stale)} → HTTP ${res.status}, ${conflict ? (conflict.status === WIRE.status.error ? `${conflict.error.code} (retryable ${conflict.error.retryable}, details ${JSON.stringify(conflict.error.details ?? null)})` : conflict.status) : "no envelope"}`,
    );
    const { result: fresh } = await r.invoke(readable, input, undefined, rev);
    const freshOk = fresh && fresh.status !== WIRE.status.error;
    const moved = fresh?.status === WIRE.status.error && fresh.error.code === WIRE.error.conflict;
    add(
      "live.fresh-accepted",
      freshOk ? "pass" : moved ? "warn" : "fail",
      freshOk
        ? `expectedRev ${String(rev)} → ${fresh.status}`
        : moved
          ? `The revision moved between reading state and calling (now ${String(fresh.error.details?.[WIRE.field.currentRev])}); run again on a quiet site.`
          : `expectedRev ${String(rev)} → ${fresh ? (fresh.status === WIRE.status.error ? fresh.error.code : fresh.status) : "no envelope"}`,
    );
  }

  // Availability honored: an action the state reports unavailable must not complete with ok.
  {
    const unavailable = m.actions.filter((a) => {
      const av = state?.actions[a.name];
      return av && !av.available && a.examples?.length && r.callable(a);
    });
    const targets = r.options.noMutate ? unavailable.filter((a) => a.readOnly) : unavailable;
    if (targets.length === 0) {
      add(
        "live.availability-honored",
        "skip",
        unavailable.length
          ? "Skipped: --no-mutate."
          : "No callable action with an example is reported unavailable.",
      );
    } else {
      const completed: string[] = [];
      for (const a of targets) {
        const { result } = await r.invoke(a, a.examples![0]!.input);
        if (result?.status === WIRE.status.ok) completed.push(a.name);
      }
      add(
        "live.availability-honored",
        completed.length ? "fail" : "pass",
        completed.length
          ? `Reported unavailable but returned ok: ${completed.join(", ")}`
          : `${targets.length} unavailable action(s) refused`,
      );
    }
  }
}

/** Run the conformance suite against a site. */
export async function runConformance(
  url: string,
  options: ConformanceOptions = {},
): Promise<ConformanceReport> {
  const r = new Runner(url, { ...options });
  await discovery(r);
  if (r.manifest) {
    await manifestChecks(r);
    const schemaOk = r.checks.find((c) => c.id === "manifest.schema")?.status === "pass";
    if (schemaOk) {
      await runtime(r);
      await live(r);
      await ladder(r);
    }
  }
  const count = (s: CheckStatus) => r.checks.filter((c) => c.status === s).length;
  return {
    url,
    manifestUrl: r.manifestUrl,
    manifest: r.manifest,
    checks: r.checks,
    passed: count("pass"),
    failed: count("fail"),
    warnings: count("warn"),
    skipped: count("skip"),
    ok: count("fail") === 0,
    observations: r.obs,
  };
}

/** Plain-text table for terminals. */
export function formatConformanceTable(
  report: ConformanceReport,
  options: { color?: boolean } = {},
): string {
  const c = options.color ?? false;
  const paint = (s: string, code: number) => (c ? `\u001b[${code}m${s}\u001b[0m` : s);
  const icon: Record<CheckStatus, string> = {
    pass: paint("PASS", 32),
    fail: paint("FAIL", 31),
    warn: paint("WARN", 33),
    skip: paint("SKIP", 90),
  };
  const lines = [
    `AXE conformance: ${report.url}`,
    report.manifestUrl ? `Manifest: ${report.manifestUrl}` : "Manifest: not found",
    "",
  ];
  const width = Math.max(...report.checks.map((k) => k.id.length), 10);
  for (const k of report.checks) {
    lines.push(`${icon[k.status]}  ${k.id.padEnd(width)}  ${k.title}`);
    if (k.status !== "pass")
      lines.push(
        `${" ".repeat(6)}${" ".repeat(width)}  ${k.detail}${k.status === "fail" ? `  → ${k.docs}` : ""}`,
      );
  }
  lines.push(
    "",
    `${report.passed} passed, ${report.failed} failed, ${report.warnings} warnings, ${report.skipped} skipped. ${report.ok ? "Conformant." : "Not conformant."}`,
  );
  return lines.join("\n");
}
