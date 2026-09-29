// A server-state application: the revision is the server's, adopted with setRev, and the write
// itself is the second gate. The handler carries the revision the agent presented into its
// conditional write and refuses with a SurfaceConflict when the server has moved on.
// #region precondition
import { createSurface, SurfaceConflict } from "@summationai/axe-surface";

interface Plan {
  revision: number;
  cells: Record<string, string>;
}

// Stands in for the server: one branch revision, and a write that applies only at the expected
// revision (UPDATE ... SET value = $1, revision = revision + 1 WHERE revision = $expected).
const server: Plan = { revision: 129, cells: {} };
async function writeCell(id: string, value: string, expected: number): Promise<number | null> {
  if (server.revision !== expected) return null;
  server.cells[id] = value;
  server.revision += 1;
  return server.revision;
}

export const surface = createSurface({ app: "planning-app", revision: "app" });
surface.setRev(server.revision);

surface.register({
  id: "cell:demand:2026-03",
  kind: "field",
  role: "textbox",
  name: "Demand, March 2026",
  edit: {
    maxLength: 40,
    // The third argument is the act's context: the entry id and the expectedRev it presented.
    set: async (text, _actor, { id, expectedRev }) => {
      const rev = await writeCell(id, text, expectedRev);
      if (rev === null)
        throw new SurfaceConflict("The plan changed on the server.", {
          currentRev: server.revision,
        });
      // Report what changed and the revision the write produced; the surface adopts it.
      return { changed: [id], rev };
    },
  },
});
// #endregion precondition

// #region outcome
export async function typeDemand(text: string): Promise<string> {
  const view = surface.observe();
  const result = await surface.act({
    op: "TYPE_TEXT",
    target: "cell:demand:2026-03",
    text,
    expectedRev: view.rev,
  });
  if (result.status === "ok") return `saved at rev ${result.output.rev}`;
  // Refused by the surface (another act or a person moved first) or by the server's write:
  // either way nothing was applied, and the ledger records a conflict.
  if (result.error.code === "conflict") return "someone moved first; observe again";
  return result.error.message;
}
// #endregion outcome
