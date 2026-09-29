/**
 * Shared types for `@summationai/axe-generate`: what a source yields, what `generate()` returns, and the
 * warnings that carry every decision the generator declined to make on the author's behalf.
 */
import type { z } from "@summationai/axe-core";
import type { ActionSpec, RegisteredAction } from "@summationai/axe-core";
import type { Risk } from "@summationai/axe-core/types";
import type { LintIssue } from "@summationai/axe-core/lint";

/** Where a generated action came from, so a reviewer can find the definition it mirrors. */
export interface Provenance {
  /** The source kind: `openapi`, `functions`, `trpc`, or a custom source's name. */
  source: string;
  /** The reference inside that source: `GET /orders/{id}`, `orders.list`, `#/paths/...`. */
  ref: string;
}

/**
 * An action as a source yields it: an `ActionSpec` whose honesty fields (`title`,
 * `description`, `risk`) may still be missing. `generate()` fills them from overrides and
 * policy, and leaves the action out when it cannot.
 */
export type GeneratedSpec = Omit<
  ActionSpec<z.ZodType, z.ZodType>,
  "title" | "description" | "risk"
> & {
  title?: string;
  description?: string;
  risk?: Risk;
};

export interface GeneratedAction {
  /** The action name, already in the AXE grammar when the source could manage it. */
  name: string;
  spec: GeneratedSpec;
  provenance: Provenance;
  /** Things the source noticed while deriving this action (a schema it could not convert, a derived name). */
  warnings?: GenerateWarning[];
}

/** What a source yields: candidates alone, or candidates plus warnings about the source as a whole. */
export type SourceOutput =
  GeneratedAction[] | { actions: GeneratedAction[]; warnings?: GenerateWarning[] };

/** Something that yields action candidates. `fromOpenAPI` and `fromFunctions` implement it. */
export interface ActionSource {
  /** The source kind, used in `provenance.source`. */
  readonly source: string;
  actions(): SourceOutput;
}

export type GenerateWarningCode =
  /** No description in the source and none supplied by an override. The action is left out. */
  | "missing-description"
  /** The source did not decide the risk and no override or policy did. The action is left out. */
  | "missing-risk"
  /** The source has no output schema; the action declares an open object. */
  | "missing-output"
  /** A schema construct the converter does not handle; `z.unknown()` was used in its place. */
  | "unsupported-schema"
  /** A parameter the handler cannot send (a cookie parameter, a non-JSON body). */
  | "unsupported-parameter"
  /** No operationId; the name was derived from the method and path. */
  | "derived-name"
  /** Two candidates resolved to the same name; the later one is left out. */
  | "duplicate-name"
  /** `action()` rejected the definition. The action is left out. */
  | "invalid-definition"
  /** A honesty lint error or warning on the definition. Errors leave the action out. */
  | "lint"
  /** Left out by the policy (`exclude`, `include`, `maxRisk`, `requireInputDescriptions`). */
  | "excluded"
  /** An override names an action no source produced. */
  | "unknown-override"
  /** Something about the source document itself (no servers, an unresolvable `$ref`). */
  | "source";

export interface GenerateWarning {
  code: GenerateWarningCode;
  /** The action name the warning is about, when there is one. */
  action?: string;
  /** The source reference, e.g. `GET /orders/{id}`. */
  ref?: string;
  /** The field the warning is about, e.g. `description`, `input.status`. */
  field?: string;
  message: string;
  /** True when the action was left out of the result because of this. */
  dropped?: boolean;
  /** The lint issue, for `lint` warnings. */
  lint?: LintIssue;
}

/** Per-action changes applied after the source has spoken and before the lints run. */
export interface ActionOverride {
  /** Leave the action out. */
  exclude?: boolean;
  /** Rename the action (the new name must follow the AXE grammar). */
  name?: string;
  title?: string;
  description?: string;
  risk?: Risk;
  readOnly?: boolean;
  idempotent?: boolean;
  reversible?: boolean;
  auth?: ActionSpec<z.ZodType, z.ZodType>["auth"];
  display?: ActionSpec<z.ZodType, z.ZodType>["display"];
  affordances?: ActionSpec<z.ZodType, z.ZodType>["affordances"];
  pagination?: ActionSpec<z.ZodType, z.ZodType>["pagination"];
  freshness?: ActionSpec<z.ZodType, z.ZodType>["freshness"];
  humanHandoff?: ActionSpec<z.ZodType, z.ZodType>["humanHandoff"];
  deprecated?: ActionSpec<z.ZodType, z.ZodType>["deprecated"];
  examples?: { input: unknown; output: unknown }[];
}

/** A name or reference pattern: a string with `*` wildcards, or a regular expression. */
export type NamePattern = string | RegExp;

export interface GeneratePolicy {
  /** Leave out actions whose name or source reference matches. */
  exclude?: NamePattern[];
  /** When set, keep only actions whose name or source reference matches. */
  include?: NamePattern[];
  /**
   * Risk for candidates whose source did not decide (`fromFunctions` entries without `risk`).
   * A function returns `undefined` to decline; the candidate is then left out.
   */
  defaultRisk?: Risk | ((action: GeneratedAction) => Risk | undefined);
  /** Leave out actions above this risk. Useful for a first rollout that exposes reads only. */
  maxRisk?: Risk;
  /** Leave out actions whose input fields lack descriptions, instead of reporting a lint warning. Default false. */
  requireInputDescriptions?: boolean;
}

export interface GenerateOptions {
  /** Keyed by action name or by source reference (`GET /orders/{id}`). */
  overrides?: Record<string, ActionOverride>;
  policy?: GeneratePolicy;
}

export interface GenerateResult {
  /** Ready for `axe.register()`. */
  actions: RegisteredAction[];
  /** Every decision the generator declined to make, and every action it left out, with the reason. */
  warnings: GenerateWarning[];
  /** Action name → where it came from. */
  provenance: Record<string, Provenance>;
}
