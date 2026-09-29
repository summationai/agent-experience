// The model-driven benchmark runner: a skeleton, deliberately not run (review item 17).
//
// It uses the same scenarios, faults, and outcome checks as the scripted harness (../scenarios.ts)
// so that a later, authorized run with real agents is scored the same way. It refuses to start
// unless environment variables name a provider and its credential and acknowledge the cost; with
// them set it prints the plan it would execute and stops, because no provider adapter is written
// yet. It imports no provider SDK and sends nothing anywhere.
import { SCENARIOS } from "../scenarios";

export const REQUIRED_ENV = [
  ["AXE_EVAL_MODEL_PROVIDER", "which agent to drive, for example anthropic-mcp or browser-agent"],
  ["AXE_EVAL_MODEL_CREDENTIAL_ENV", "the name of the variable that holds the provider credential"],
  ["AXE_EVAL_ACCEPT_COST", "set to yes: a run calls a paid model API"],
] as const;

export const LANES = [
  {
    variant: "v1",
    agent:
      "a browser agent (screenshots or the accessibility tree) driving the page with generic markup",
  },
  {
    variant: "v2",
    agent: "the same browser agent on the page with accessible names and the Surface DOM mirror",
  },
  {
    variant: "v3",
    agent: "a tool-calling model connected to the basic tools over MCP (eval/basic-mcp.ts)",
  },
  {
    variant: "v4",
    agent: "a tool-calling model connected to the derived AXE MCP server (`axe mcp <url>`)",
  },
  {
    variant: "v2 + WebMCP",
    agent:
      "a browser agent that reads the page surface through document.modelContext (@summationai/axe-surface/webmcp), only where the browser provides the API",
  },
] as const;

export interface Plan {
  provider: string;
  runsPerCell: number;
  lanes: typeof LANES;
  scenarios: { id: string; task: string; fault: string }[];
  steps: string[];
}

export function planFor(provider: string, runsPerCell: number): Plan {
  return {
    provider,
    runsPerCell,
    lanes: LANES,
    scenarios: SCENARIOS.map((s) => ({ id: s.id, task: s.task, fault: s.fault })),
    steps: [
      "build the app once and start it per variant with PLAN_REVIEW_VARIANT and PLAN_REVIEW_TEST_RESET=1",
      "per run: reset the app, apply the scenario's setup, sign the agent in as bob on Acme (page variants) or give it bob's agent token (tool variants)",
      "give the agent the scenario's task text and nothing else; inject the same fault through the same hooks as the scripted harness",
      "play the person with the same scripted steps (alice's edit, approval, or lock) when the scenario calls for them",
      "score with checkOutcome against the app's snapshot; never with the agent's own account of what it did",
      "record provider-reported input and output tokens, wall time, tool calls, and the transcript; report tokens only as the provider reported them",
      "write docs/review/<date>/data/model-evaluation-<date>.{json,md} beside the scripted results, with the model, version, and settings",
    ],
  };
}

export function missingEnv(env: Record<string, string | undefined>): string[] {
  const missing: string[] = REQUIRED_ENV.filter(([k]) => !env[k]).map(([k]) => k);
  if (env["AXE_EVAL_ACCEPT_COST"] && env["AXE_EVAL_ACCEPT_COST"] !== "yes")
    missing.push("AXE_EVAL_ACCEPT_COST (must be yes)");
  const credentialVar = env["AXE_EVAL_MODEL_CREDENTIAL_ENV"];
  if (credentialVar && !env[credentialVar])
    missing.push(`${credentialVar} (named credential is empty)`);
  return missing;
}

function main(): number {
  const missing = missingEnv(process.env);
  if (missing.length) {
    console.error("The model-driven runner is opt-in and has never been run. Refusing to start.");
    console.error("Missing:");
    for (const m of missing) console.error(`  ${m}`);
    console.error("Required:");
    for (const [k, why] of REQUIRED_ENV) console.error(`  ${k}: ${why}`);
    console.error("The deterministic harness needs none of this: pnpm eval.");
    return 2;
  }
  const runsArg = process.argv.find((a) => a.startsWith("--runs="));
  const plan = planFor(
    process.env["AXE_EVAL_MODEL_PROVIDER"]!,
    runsArg ? Number(runsArg.slice(7)) : 5,
  );
  console.log("Would run (nothing has been sent):");
  console.log(JSON.stringify(plan, null, 2));
  console.error(
    `No adapter for provider "${plan.provider}" exists in this repository. Write one in eval/model/ and review the cost before running.`,
  );
  return 3;
}

if (process.argv[1] && /model[\\/]run\.ts$/.test(process.argv[1])) process.exit(main());
