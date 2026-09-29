// Two granularities over one surface: one action per control, or a few parameterized actions.
// Both run the same handlers through `surface.act`, under the same revision, into the same ledger.
// #region domain
import { createAXE } from "@summationai/axe-core";
import { domainActions, surfaceActions } from "@summationai/axe-surface/axe";
import { surface } from "./board";

export const axe = createAXE({
  name: "Fantasy Draft",
  description:
    "A draft board: observe which players can be drafted right now, then draft, undo, or flag them under one revision.",
  baseUrl: "https://draft.example",
  auth: { modes: ["user"], userLoginUrl: "https://draft.example/login" },
  secret: process.env.AXE_SECRET,
  revision: surface.currentRev,
});

// A fixed set of actions: draft.observe, draft.ledger, draft.pick, draft.undo. The manifest and
// the MCP tool list stay the same whatever the board holds; the rows, their availability, and
// the action for each come from draft.observe, which pages 50 rows at a time.
export const domain = domainActions(surface, {
  namespace: "draft",
  domains: [
    {
      name: "pick",
      title: "Draft a player",
      description:
        "Drafts one player from the board for your team, as the row's Draft button would.",
      // Which entries this action acts on: the application's own grouping.
      covers: (entry) => entry.id.startsWith("pick:me:"),
      // True of every pick; an entry with a higher risk would be left uncovered and reported.
      risk: "medium",
      reversible: true,
    },
    {
      name: "undo",
      title: "Undo the last pick",
      description: "Puts the most recent pick back on the board.",
      covers: (entry) => entry.id === "undo",
      risk: "medium",
    },
  ],
});
axe.addProvider(domain);
// #endregion domain

// #region side-by-side
// While agents move over, serve the per-control actions beside them under another namespace.
// Tool names in each namespace stay stable; both share the surface's revision and ledger.
axe.addProvider(surfaceActions(surface, { namespace: "board" }));

domain.actionFor("pick:me:Gibbs"); // "draft.pick"
domain.covered("draft.undo"); // ["undo"]
// #endregion side-by-side

// #region call
// An agent reads one page of rows about one player, then acts on the row with its id and the rev
// it observed. The observe row carries the same call as an affordance with entryId bound.
export async function draftGibbs(post: (path: string, body: unknown) => Promise<unknown>) {
  const page = (await post("/axe/actions/draft.observe", {
    input: { query: "Gibbs", available: true, limit: 10 },
  })) as { output: { entries: { id: string }[] }; rev: number };
  const row = page.output.entries[0];
  if (!row) return undefined;
  return post("/axe/actions/draft.pick", {
    input: { entryId: row.id },
    expectedRev: page.rev,
    idempotencyKey: crypto.randomUUID(),
  });
}
// #endregion call
