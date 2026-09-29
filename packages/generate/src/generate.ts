/**
 * `generate()`: merge sources, apply overrides and policy, refuse to invent, lint, and hand back
 * actions ready for `axe.register()` together with every warning that explains a gap.
 */
import type { z } from "@summationai/axe-core";
import { action, ActionDefinitionError, DisplayValidationError } from "@summationai/axe-core";
import type { ActionSpec, RegisteredAction } from "@summationai/axe-core";
import type { Risk } from "@summationai/axe-core/types";
import { lintAction } from "@summationai/axe-core/lint";
import { WIRE } from "@summationai/axe-core/vocabulary";
import type {
  ActionOverride,
  ActionSource,
  GeneratedAction,
  GenerateOptions,
  GenerateResult,
  GenerateWarning,
  NamePattern,
  Provenance,
} from "./types";

const RISK_ORDER: Record<Risk, number> = { none: 0, low: 1, medium: 2, high: 3 };

function matches(pattern: NamePattern, value: string): boolean {
  if (pattern instanceof RegExp) return pattern.test(value);
  if (!pattern.includes("*")) return pattern === value;
  const re = new RegExp(
    "^" +
      pattern
        .split("*")
        .map((p) => p.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"))
        .join(".*") +
      "$",
  );
  return re.test(value);
}

function matchesAny(patterns: NamePattern[] | undefined, candidate: GeneratedAction): boolean {
  if (!patterns) return false;
  return patterns.some((p) => matches(p, candidate.name) || matches(p, candidate.provenance.ref));
}

/** Copy defined members only, so specs satisfy `exactOptionalPropertyTypes`. */
function assignDefined<T extends object>(target: T, source: Partial<T>): void {
  for (const [k, v] of Object.entries(source)) {
    if (v !== undefined) (target as Record<string, unknown>)[k] = v;
  }
}

/**
 * Turn action candidates into registered actions. Nothing is invented: a candidate without a
 * description or a risk is left out, with a warning naming the source reference and the missing
 * field, unless an override supplies it.
 */
export function generate(sources: ActionSource[], options: GenerateOptions = {}): GenerateResult {
  const overrides = options.overrides ?? {};
  const policy = options.policy ?? {};
  const warnings: GenerateWarning[] = [];
  const actions: RegisteredAction[] = [];
  const provenance: Record<string, Provenance> = {};
  const usedOverrides = new Set<string>();
  const taken = new Set<string>();

  const candidates: GeneratedAction[] = [];
  for (const source of sources) {
    const yielded = source.actions();
    const list = Array.isArray(yielded) ? yielded : yielded.actions;
    if (!Array.isArray(yielded)) for (const w of yielded.warnings ?? []) warnings.push(w);
    for (const c of list) {
      candidates.push(c);
      for (const w of c.warnings ?? []) warnings.push(w);
    }
  }

  for (const candidate of candidates) {
    const ref = candidate.provenance.ref;
    const override: ActionOverride | undefined =
      overrides[candidate.name] ?? overrides[ref] ?? undefined;
    if (overrides[candidate.name]) usedOverrides.add(candidate.name);
    else if (overrides[ref]) usedOverrides.add(ref);

    const name = override?.name ?? candidate.name;
    const drop = (
      code: GenerateWarning["code"],
      message: string,
      field?: string,
      extra: Partial<GenerateWarning> = {},
    ) => {
      const w: GenerateWarning = { code, action: name, ref, message, dropped: true, ...extra };
      if (field !== undefined) w.field = field;
      warnings.push(w);
    };

    if (override?.exclude) {
      drop("excluded", "Left out by an override with exclude: true.");
      continue;
    }
    if (matchesAny(policy.exclude, candidate)) {
      drop("excluded", "Left out by policy.exclude.");
      continue;
    }
    if (policy.include && !matchesAny(policy.include, candidate)) {
      drop("excluded", "Not matched by policy.include.");
      continue;
    }

    // Merge: the source's spec, then the override on top.
    const spec: Partial<ActionSpec<z.ZodType, z.ZodType>> & {
      input: z.ZodType;
      output: z.ZodType;
      handler: ActionSpec<z.ZodType, z.ZodType>["handler"];
    } = { ...candidate.spec };
    if (override) {
      const { exclude: _e, name: _n, examples, ...rest } = override;
      assignDefined(spec, rest as Partial<ActionSpec<z.ZodType, z.ZodType>>);
      if (examples)
        spec.examples = examples as NonNullable<ActionSpec<z.ZodType, z.ZodType>["examples"]>;
    }

    if (spec.risk === undefined) {
      const fallback =
        typeof policy.defaultRisk === "function"
          ? policy.defaultRisk(candidate)
          : policy.defaultRisk;
      if (fallback !== undefined) spec.risk = fallback;
    }
    if (spec.readOnly && spec.risk === undefined) spec.risk = WIRE.risk.low;

    if (!spec.description?.trim()) {
      drop(
        "missing-description",
        `${ref} has no description. Write one (40 to 400 characters: what it does, what it returns, what it commits the user to) in overrides["${name}"].description. The generator does not invent descriptions.`,
        "description",
      );
      continue;
    }
    if (spec.risk === undefined) {
      drop(
        "missing-risk",
        `${ref} changes state and nothing declares its risk. Set overrides["${name}"].risk to low, medium, or high, or set policy.defaultRisk.`,
        "risk",
      );
      continue;
    }
    if (!spec.title?.trim()) {
      drop("missing-description", `${ref} has no title. Set overrides["${name}"].title.`, "title");
      continue;
    }
    if (policy.maxRisk !== undefined && RISK_ORDER[spec.risk] > RISK_ORDER[policy.maxRisk]) {
      drop("excluded", `Risk ${spec.risk} is above policy.maxRisk (${policy.maxRisk}).`, "risk");
      continue;
    }
    if (taken.has(name)) {
      drop(
        "duplicate-name",
        `${ref} resolves to "${name}", which an earlier candidate already took. Rename it with an override.`,
      );
      continue;
    }

    let registered: RegisteredAction;
    try {
      registered = action(name, spec as ActionSpec<z.ZodType, z.ZodType>);
    } catch (e) {
      if (e instanceof ActionDefinitionError || e instanceof DisplayValidationError) {
        drop("invalid-definition", e.message);
        continue;
      }
      throw e;
    }

    const issues = lintAction(registered.definition);
    let fatal = false;
    for (const issue of issues) {
      const w: GenerateWarning = {
        code: "lint",
        action: name,
        ref,
        field: issue.location,
        message: issue.message,
        lint: issue,
      };
      if (issue.severity === "error") {
        fatal = true;
        w.dropped = true;
      } else if (policy.requireInputDescriptions && issue.rule === "missing-input-descriptions") {
        fatal = true;
        w.dropped = true;
        w.code = "excluded";
      }
      warnings.push(w);
    }
    if (fatal) continue;

    taken.add(name);
    actions.push(registered);
    provenance[name] = candidate.provenance;
  }

  for (const key of Object.keys(overrides)) {
    if (!usedOverrides.has(key)) {
      warnings.push({
        code: "unknown-override",
        action: key,
        message: `overrides["${key}"] matches no generated action name or source reference.`,
      });
    }
  }

  return { actions, warnings, provenance };
}

/** Register every generated action on an AXE server. Returns the server for chaining. */
export function registerGenerated<T extends { register(a: RegisteredAction): unknown }>(
  axe: T,
  generated: Pick<GenerateResult, "actions">,
): T {
  for (const a of generated.actions) axe.register(a);
  return axe;
}

/** One line per warning, for terminals and build logs. */
export function formatWarnings(warnings: readonly GenerateWarning[]): string {
  return warnings
    .map((w) => {
      const where = [w.action, w.ref && w.ref !== w.action ? `(${w.ref})` : undefined]
        .filter(Boolean)
        .join(" ");
      const mark = w.dropped ? "✗" : "!";
      return `${mark} ${w.code}${where ? ` ${where}` : ""}${w.field ? ` ${w.field}` : ""}: ${w.message}`;
    })
    .join("\n");
}
