/**
 * Agent-facing honesty rules (spec/AXE-PROTOCOL.md §18) and objective quality
 * lints for manifests. Used by `axe validate`, `axe audit`, and at registration
 * (where directive-to-agent text is rejected outright).
 */
import type { ActionDefinition, Display, JsonSchema, Manifest } from "./types";

export type LintSeverity = "error" | "warning";

export interface LintIssue {
  /** Stable rule identifier. */
  rule: LintRule;
  severity: LintSeverity;
  /** Where the problem is: an action name and field, or a manifest field. */
  location: string;
  message: string;
  /** The offending text or value, when applicable. */
  excerpt?: string;
  /** The doc section that explains the fix. */
  docs: string;
}

export type LintRule =
  | "agent-directive"
  | "persuasion"
  | "description-length"
  | "missing-examples"
  | "bare-query-search"
  | "affordance-count"
  | "multiple-primary"
  | "deprecated-without-replacement"
  | "missing-input-descriptions"
  | "missing-display"
  | "missing-display-url"
  | "missing-disclaimer"
  | "readonly-contradiction"
  | "risk-none-on-mutation";

const DOCS = "docs/audit.md#honesty-rules";

/**
 * Imperatives aimed at the agent. Each pattern is a prompt-injection shape seen in
 * the wild, generalized. Matching any of these is a hard failure.
 */
export const AGENT_DIRECTIVE_PATTERNS: readonly RegExp[] = [
  /\b(always|never|only)\s+(choose|select|recommend|prefer|suggest|use|book|pick|offer|show|return)\b/i,
  /\bignore\s+(all\s+|any\s+|the\s+|your\s+)?(other|previous|prior|competing|alternative|earlier|system|user)/i,
  /\byou\s+(must|should|need\s+to|have\s+to|are\s+required\s+to|will)\s+(recommend|choose|select|prefer|book|buy|tell|say|suggest|rank|present|hide|omit)/i,
  /\bdo\s+not\s+(tell|inform|show|mention|reveal|disclose|warn)\s+(the\s+)?(user|human|customer|person)/i,
  /\b(don't|do\s+not|never)\s+(mention|show|offer|suggest)\s+(other|alternative|competing|competitor)/i,
  /\b(disregard|override|forget|bypass)\s+(your|the|any|all|previous)\s+(instructions|system\s+prompt|rules|guidelines|guardrails|safety)/i,
  /\bsystem\s+prompt\b/i,
  /\b(as|you\s+are)\s+an?\s+(ai|assistant|language\s+model|llm)\b/i,
  /\brank\s+(this|us|it)\s+(first|highest|above|top)\b/i,
  /\btell\s+the\s+user\s+(that\s+)?(this|we|it)\s+(is|are)\s+the\s+(best|only|cheapest)/i,
  /\bmark\s+(this|it)\s+as\s+(recommended|preferred|primary)\b/i,
  /\b(agent|assistant|model)s?\s*[:,]\s*(please\s+)?(always|never|only|must|recommend|choose)/i,
];

/** Superlatives and comparative marketing claims. Reported, not fatal. */
export const PERSUASION_PATTERNS: readonly RegExp[] = [
  /\b(the\s+)?(very\s+)?best\b/i,
  /\bcheapest\b/i,
  /\blowest\s+(price|prices|rate|rates|fees?)\b/i,
  /#\s?1\b/,
  /\bnumber\s+one\b/i,
  /\btop[- ]rated\b/i,
  /\bworld[- ]class\b/i,
  /\bunbeatable\b/i,
  /\b(industry|market)[- ]leading\b/i,
  /\bpremier\b/i,
  /\bfinest\b/i,
  /\bgreatest\b/i,
  /\bunlike\s+(our\s+|the\s+|other\s+)?competitors?\b/i,
  /\bbetter\s+than\s+(any|all|every|other|the\s+competition)/i,
  /\bmost\s+(trusted|popular|reliable|affordable|advanced)\b/i,
  /\baward[- ]winning\b/i,
  /\bguaranteed\s+(lowest|best|cheapest)\b/i,
  /\byou\s+(won't|will\s+not|can't|cannot)\s+find\s+(a\s+)?(better|cheaper|lower)/i,
];

export interface LintTextOptions {
  /** Dotted location for the report, e.g. `units.search.description`. */
  location?: string;
  /** Apply the 40–400 character rule (for `description` fields). */
  checkLength?: boolean;
}

/**
 * Apply the honesty rules to one agent-read string.
 * Returns `agent-directive` errors, `persuasion` warnings, and optionally `description-length`.
 */
export function lintAgentText(text: string, options: LintTextOptions = {}): LintIssue[] {
  const location = options.location ?? "text";
  const issues: LintIssue[] = [];
  for (const re of AGENT_DIRECTIVE_PATTERNS) {
    const m = re.exec(text);
    if (m) {
      issues.push({
        rule: "agent-directive",
        severity: "error",
        location,
        message:
          "Agent-read text contains an instruction aimed at the agent. Describe capability and constraints; never tell the agent how to behave (spec §18.2 [P-HON-1]).",
        excerpt: m[0],
        docs: DOCS,
      });
      break;
    }
  }
  for (const re of PERSUASION_PATTERNS) {
    const m = re.exec(text);
    if (m) {
      issues.push({
        rule: "persuasion",
        severity: "warning",
        location,
        message:
          "Agent-read text contains a superlative or comparative claim. State what the action does and returns; leave out merit (spec §18.2 [P-HON-2]).",
        excerpt: m[0],
        docs: DOCS,
      });
      break;
    }
  }
  if (options.checkLength) {
    const len = text.trim().length;
    if (len < 40 || len > 400) {
      issues.push({
        rule: "description-length",
        severity: len < 40 ? "error" : "warning",
        location,
        message: `Description is ${len} characters; the protocol requires 40 to 400. State what it does, what it returns, and what it commits the user to (spec §5.2 [P-ACT-7]).`,
        docs: "docs/designing-actions.md#writing-descriptions",
      });
    }
  }
  return issues;
}

/** Collect every agent-read string in a schema's property descriptions. */
function schemaDescriptions(
  schema: JsonSchema,
  prefix: string,
  out: { location: string; text: string }[],
): void {
  const props = schema["properties"];
  if (props && typeof props === "object") {
    for (const [key, sub] of Object.entries(props as Record<string, JsonSchema>)) {
      if (sub && typeof sub === "object") {
        if (typeof sub["description"] === "string") {
          out.push({ location: `${prefix}.${key}.description`, text: sub["description"] });
        }
        schemaDescriptions(sub, `${prefix}.${key}`, out);
      }
    }
  }
  const items = schema["items"];
  if (items && typeof items === "object")
    schemaDescriptions(items as JsonSchema, `${prefix}[]`, out);
  const defs = schema["$defs"];
  if (defs && typeof defs === "object") {
    for (const [key, sub] of Object.entries(defs as Record<string, JsonSchema>)) {
      schemaDescriptions(sub, `${prefix}.$defs.${key}`, out);
    }
  }
}

/** Every agent-read text field of an action, as (location, text) pairs. */
export function agentReadText(
  action: ActionDefinition,
): { location: string; text: string; isDescription: boolean }[] {
  const out: { location: string; text: string; isDescription: boolean }[] = [];
  const a = action.name;
  out.push({ location: `${a}.title`, text: action.title, isDescription: false });
  out.push({ location: `${a}.description`, text: action.description, isDescription: true });
  const descs: { location: string; text: string }[] = [];
  schemaDescriptions(action.input, `${a}.input`, descs);
  schemaDescriptions(action.output, `${a}.output`, descs);
  for (const d of descs) out.push({ ...d, isDescription: false });
  const d: Display | undefined = action.display;
  if (d) {
    if (d.emptyMessage)
      out.push({
        location: `${a}.display.emptyMessage`,
        text: d.emptyMessage,
        isDescription: false,
      });
    if (d.disclaimer)
      out.push({ location: `${a}.display.disclaimer`, text: d.disclaimer, isDescription: false });
    for (const attr of d.item?.attributes ?? []) {
      out.push({
        location: `${a}.display.item.attributes[${attr.label}].label`,
        text: attr.label,
        isDescription: false,
      });
    }
  }
  for (const aff of action.affordances ?? []) {
    out.push({
      location: `${a}.affordances[${aff.action}].title`,
      text: aff.title,
      isDescription: false,
    });
  }
  return out;
}

/** Whether an input schema is a "search box": its only property is free text. */
export function isBareQuerySearch(input: JsonSchema): boolean {
  const props = input["properties"];
  if (!props || typeof props !== "object") return false;
  const entries = Object.entries(props as Record<string, JsonSchema>);
  if (entries.length !== 1) return false;
  const [name, schema] = entries[0]!;
  return (
    /^(q|query|search|text|keywords?)$/i.test(name) &&
    schema["type"] === "string" &&
    !schema["enum"]
  );
}

/** Whether an action's name or title suggests it searches or lists things. */
function looksLikeSearch(action: ActionDefinition): boolean {
  return /\b(search|list|find|browse|lookup|query)\b/i.test(
    `${action.name.replace(/[.-]/g, " ")} ${action.title}`,
  );
}

/** Whether an action's output schema has an array at its top level. */
function outputHasList(action: ActionDefinition): boolean {
  const props = action.output["properties"];
  if (!props || typeof props !== "object") return false;
  return Object.values(props as Record<string, JsonSchema>).some(
    (p) => p && typeof p === "object" && (p["type"] === "array" || p["items"] !== undefined),
  );
}

/** Apply every lint rule to one action. */
export function lintAction(action: ActionDefinition): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const t of agentReadText(action)) {
    issues.push(...lintAgentText(t.text, { location: t.location, checkLength: t.isDescription }));
  }
  if (!action.examples || action.examples.length === 0) {
    issues.push({
      rule: "missing-examples",
      severity: "warning",
      location: `${action.name}.examples`,
      message:
        "No examples. Agents and auditors use examples to understand real outputs and to check display pointers.",
      docs: "docs/designing-actions.md#examples",
    });
  }
  if (isBareQuerySearch(action.input)) {
    issues.push({
      rule: "bare-query-search",
      severity: "warning",
      location: `${action.name}.input`,
      message:
        "The only input is a free-text query. Expose filters as structured fields with enums and ranges; the agent already holds structured intent (spec §14.5 [P-AFF-9]).",
      docs: "docs/designing-actions.md#designing-read-actions",
    });
  }
  const affordances = action.affordances ?? [];
  if (affordances.length > 6) {
    issues.push({
      rule: "affordance-count",
      severity: "error",
      location: `${action.name}.affordances`,
      message: `${affordances.length} affordances declared; the maximum is 6 (spec §14.1 [P-AFF-2]).`,
      docs: "docs/presenting-results.md#affordances",
    });
  }
  if (affordances.filter((a) => a.primary).length > 1) {
    issues.push({
      rule: "multiple-primary",
      severity: "error",
      location: `${action.name}.affordances`,
      message:
        "More than one affordance is marked primary; at most one is allowed (spec §14.1 [P-AFF-2]).",
      docs: "docs/presenting-results.md#affordances",
    });
  }
  if (action.deprecated && !action.deprecated.replacedBy) {
    issues.push({
      rule: "deprecated-without-replacement",
      severity: "warning",
      location: `${action.name}.deprecated`,
      message:
        "Deprecated without a replacement. Name the action agents should use instead in deprecated.replacedBy.",
      docs: "docs/designing-actions.md#deprecating-actions",
    });
  }
  const inputProps = action.input["properties"];
  if (inputProps && typeof inputProps === "object") {
    const missing = Object.entries(inputProps as Record<string, JsonSchema>)
      .filter(([, p]) => !p || typeof p !== "object" || typeof p["description"] !== "string")
      .map(([k]) => k);
    if (missing.length > 0) {
      issues.push({
        rule: "missing-input-descriptions",
        severity: "warning",
        location: `${action.name}.input`,
        message: `Input fields without a description: ${missing.join(", ")}. Say what each field means and give an example value.`,
        docs: "docs/designing-actions.md#writing-descriptions",
      });
    }
  }
  if (action.readOnly && looksLikeSearch(action) && outputHasList(action) && !action.display) {
    issues.push({
      rule: "missing-display",
      severity: "warning",
      location: `${action.name}.display`,
      message:
        "A read action that returns a list has no display hints. Agents will render generically; add display so users can compare results.",
      docs: "docs/presenting-results.md",
    });
  }
  if (action.display?.item && !action.display.item.url) {
    issues.push({
      rule: "missing-display-url",
      severity: "warning",
      location: `${action.name}.display.item.url`,
      message:
        "display.item.url is missing. It is the human-facing escape hatch and the parity check target (spec §13.1 [P-DISP-3]).",
      docs: "docs/presenting-results.md#url-and-disclaimer",
    });
  }
  if (action.display && !action.display.disclaimer) {
    issues.push({
      rule: "missing-disclaimer",
      severity: "warning",
      location: `${action.name}.display.disclaimer`,
      message:
        "display.disclaimer is missing. State the accuracy or pricing caveat that must accompany any rendering.",
      docs: "docs/presenting-results.md#url-and-disclaimer",
    });
  }
  if (!action.readOnly && action.risk === "none") {
    issues.push({
      rule: "risk-none-on-mutation",
      severity: "error",
      location: `${action.name}.risk`,
      message:
        "A mutating action cannot have risk none (spec §5.1 [P-ACT-3]). Use low, medium, or high.",
      docs: "docs/designing-actions.md#choosing-risk",
    });
  }
  if (
    action.readOnly &&
    /\b(create|submit|book|cancel|delete|update|pay|reschedule|apply|reserve|purchase|order|send)\b/i.test(
      action.name.replace(/[.-]/g, " "),
    )
  ) {
    issues.push({
      rule: "readonly-contradiction",
      severity: "error",
      location: `${action.name}.readOnly`,
      message:
        "The action is declared readOnly but its name describes a mutation. Declare metadata truthfully (spec §18.2 [P-HON-7]).",
      docs: "docs/audit.md#actionable",
    });
  }
  return issues;
}

/** Apply every lint rule to a manifest. */
export function lintManifest(manifest: Manifest): LintIssue[] {
  const issues: LintIssue[] = [];
  issues.push(...lintAgentText(manifest.name, { location: "manifest.name" }));
  issues.push(
    ...lintAgentText(manifest.description, { location: "manifest.description", checkLength: true }),
  );
  if (manifest.brand?.name)
    issues.push(...lintAgentText(manifest.brand.name, { location: "manifest.brand.name" }));
  if (manifest.policies?.dataRetention) {
    issues.push(
      ...lintAgentText(manifest.policies.dataRetention, {
        location: "manifest.policies.dataRetention",
      }),
    );
  }
  for (const flow of manifest.flows ?? []) {
    issues.push(...lintAgentText(flow.title, { location: `flows.${flow.name}.title` }));
    issues.push(...lintAgentText(flow.description, { location: `flows.${flow.name}.description` }));
  }
  for (const action of manifest.actions) issues.push(...lintAction(action));
  return issues;
}

/** True when any issue is an error. */
export function hasLintErrors(issues: readonly LintIssue[]): boolean {
  return issues.some((i) => i.severity === "error");
}
