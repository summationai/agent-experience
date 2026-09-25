// The ledger: every act through the surface, run or refused, with who asked and which revisions it
// spanned; the changes the application made outside `act` and recorded itself; and, served through
// the bridge, the calls the server refused before the surface. An agent reads what happened since
// it looked; a person reads what the agent did.
// #region ledger
import { surface } from "./board";

// After observe() returned { rev, ledgerSeq }, an agent asks what happened after that snapshot.
export function whatHappenedSince(ledgerSeq: number): string[] {
  return surface
    .ledger({ since: ledgerSeq })
    .map((e) =>
      e.status === "ok"
        ? `#${e.seq} ${e.actor} ${e.op} ${e.target} (rev ${e.revBefore} -> ${e.revAfter})`
        : `#${e.seq} ${e.actor} ${e.op} ${e.target}: refused, ${e.status}, nothing applied`,
    );
}

// The person's view of the agent's work: newest twenty entries by the agent.
export function agentActivity() {
  return surface.ledger({ actor: "agent", limit: 20 });
}
// #endregion ledger

// #region record
// The commissioner undoes a pick from the page's own admin menu, which is not a registered control,
// so the change never passes through act. Make the change, move the revision, then record it with
// the revision read before, so the entry spans the move and the ledger has no gap.
export function undoPickFromAdminMenu(playerId: string, undo: () => void): void {
  const revBefore = surface.currentRev();
  undo();
  surface.bump({ what: `undo:${playerId}` });
  surface.record({
    op: "UNDO",
    target: `pick:me:${playerId}`,
    actor: "commissioner",
    changed: [`pick:me:${playerId}`],
    revBefore,
  });
}
// The entry: { op: "UNDO", actor: "commissioner", revBefore: 7, revAfter: 8, status: "ok",
// source: "application", ... }. record runs no handler and does not move the revision itself.
// #endregion record
