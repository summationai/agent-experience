// #region all
import type { AXEClient, RunOutcome } from "@axe/client";
import { present, toMarkdown } from "@axe/client/present";
import type { JsonSchema } from "@axe/core/types";

/** The shape every framework wants: OpenAI `functions`, LangChain tools, MCP tools. */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: JsonSchema;
}

/** MCP-compatible tool name: dots become underscores. */
export function toolName(actionName: string): string {
  return actionName.replace(/\./g, "_");
}

/** One tool per action. The input schema is the action's, unchanged. */
export function toolDefinitions(client: AXEClient): ToolDefinition[] {
  return client.manifest().actions.map((a) => ({
    name: toolName(a.name),
    description: [
      a.description,
      `Risk: ${a.risk}.`,
      a.readOnly
        ? "Read-only."
        : `Changes state; ${a.reversible ? "reversible" : "not reversible"}.`,
      a.auth !== "none" ? `Requires ${a.auth} authentication.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    parameters: { ...a.input, type: "object" },
  }));
}

/** Turn a run() outcome into text a model can act on. */
export function describeOutcome(client: AXEClient, outcome: RunOutcome): string {
  switch (outcome.status) {
    case "ok":
      return outcome.action.display
        ? `${toMarkdown(present(outcome.action, outcome.result, client.manifest().brand))}\n\nRaw output:\n${JSON.stringify(outcome.result.output)}`
        : JSON.stringify(outcome.result.output);
    case "needs_input": {
      const r = outcome.result;
      const options = r.accepts
        .map(
          (a) =>
            `- ${a.kind}: ${a.title}. ${a.description}${a.sensitive ? " (sensitive: confirm with the user)" : ""}`,
        )
        .join("\n");
      return `The site needs one of the following (${r.reason}): ${r.message}\n${options}\nAlready tried: ${outcome.tried.join(", ") || "none"}. Ask the user for the first option you can collect.`;
    }
    case "needs_human":
      return `A human must act on the site. Tell the user: "${outcome.handoff.whatAgentShouldSayToUser}" Send them to ${outcome.handoff.url}. What they do there: ${outcome.handoff.instructions}. Resume token kept by the host.`;
    case "pending":
      return `Still processing. The host will poll ${outcome.result.pollUrl} and report back.`;
    case "error": {
      const e = outcome.result.error;
      const issues = e.details?.issues?.map((i) => `${i.path || "/"}: ${i.message}`).join("; ");
      return `Error ${e.code}: ${e.message}${issues ? ` Problems: ${issues}. Fix these fields and call again.` : ""}${e.retryable ? " Retryable." : ""}`;
    }
  }
}

/** A dispatcher: tool name plus parsed arguments in, text for the model out. */
export function dispatcher(client: AXEClient): (name: string, args: unknown) => Promise<string> {
  const byTool = new Map(client.manifest().actions.map((a) => [toolName(a.name), a.name]));
  return async (name, args) => {
    const actionName = byTool.get(name);
    if (!actionName) return `Unknown tool ${name}.`;
    return describeOutcome(client, await client.run(actionName, args));
  };
}
// #endregion all
