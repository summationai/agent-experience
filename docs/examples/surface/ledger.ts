// The ledger: every act through the surface, run or refused, with who asked and which revisions it
// spanned. An agent reads what happened since it looked; a person reads what the agent did.
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
