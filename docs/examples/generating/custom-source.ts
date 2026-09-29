/**
 * A source of your own: any registry with typed inputs and a function to call can yield candidates.
 */
// #region source
import { z } from "@summationai/axe-core";
import type { ActionSource, GeneratedAction } from "@summationai/axe-generate";

interface Command {
  id: string;
  summary?: string;
  help?: string;
  params: z.ZodObject;
  mutates: boolean;
  run: (params: unknown) => Promise<unknown>;
}

export function fromCommands(commands: Command[]): ActionSource {
  return {
    source: "commands",
    actions: () =>
      commands.map((c): GeneratedAction => ({
        name: `tools.${c.id}`,
        spec: {
          title: c.summary ?? c.id,
          // Leave description out when the registry has none: generate() reports the gap
          // and leaves the action out until an override fills it.
          ...(c.help ? { description: c.help } : {}),
          input: c.params,
          output: z.object({ result: z.unknown() }),
          readOnly: !c.mutates,
          handler: async ({ input }) => ({ result: await c.run(input) }),
        },
        provenance: { source: "commands", ref: c.id },
      })),
  };
}
// #endregion source
