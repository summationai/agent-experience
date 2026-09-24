/**
 * An agent that reads the state it is about to act on, acts with `expectedRev`, and reads again
 * when someone else moved first.
 */
import type { AXEClient } from "@axe/client";
import { isError, isOk } from "@axe/client";
import { stateToMarkdown } from "@axe/client/present";

// #region loop
export async function bookWhenOpen(client: AXEClient, classId: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    // What can be done right now, and why not the rest, for this member. Never cached.
    const state = await client.state();
    const booking = state.actions["classes.book"];
    if (booking && !booking.available) {
      // The site said why, in its own words; relay that, and what would change it.
      const unblock = booking.requires?.map((r) => r.kind).join(" or ");
      return `Can't book yet: ${booking.reason}.${unblock ? ` It would need ${unblock}.` : ""}`;
    }
    // Act on the state we saw. A change by the front desk in between is refused, not applied.
    const result = await client.invoke<{ bookingId: string }>(
      "classes.book",
      { classId },
      { expectedRev: state.rev },
    );
    if (isOk(result))
      return `Booked ${result.output.bookingId} (studio now at revision ${result.rev}).`;
    if (isError(result) && result.error.code === "conflict") continue; // read again, decide again
    if (isError(result)) return `${result.error.code}: ${result.error.message}`;
    return `The site needs more: ${result.status}.`;
  }
  return "The studio kept changing; try again in a moment.";
}

/** A one-screen summary of the live state for the user or the model. */
export async function summarize(client: AXEClient): Promise<string> {
  return stateToMarkdown(await client.state(), client.manifest());
}
// #endregion loop
