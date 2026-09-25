// The person approves one gated control from the page itself.
// #region approve
import { handle } from "./start";

// Wire this to a button the person clicks in your own approval prompt: never to anything an
// agent can call.
export function onPersonApproved(entryId: string): void {
  handle.approve(entryId, { uses: 1, ttlMs: 2 * 60_000 });
}
// #endregion approve
