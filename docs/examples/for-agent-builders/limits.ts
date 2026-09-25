// #region limits
import { AXEClient, AXEClientError, isPending } from "@axe/client";

const client = await AXEClient.discover("https://oakridge-rentals.example", {
  auth: () => process.env.OAKRIDGE_TOKEN,
  timeoutMs: 10_000, // each request, redirects and body included (default 30000)
  maxResponseBytes: 1024 * 1024, // largest body read from the site (default 4 MiB)
});

// The user can stop the agent at any time: one signal for everything this turn does.
const turn = new AbortController();
process.once("SIGINT", () => turn.abort());

try {
  const outcome = await client.run(
    "applications.submit",
    { applicationId: "APP-8812" },
    {
      signal: turn.signal,
      // Polling budget for the whole run: at most 20 polls and two minutes, whatever
      // retryAfter says. Waits are at least one second apart.
      maxPollAttempts: 20,
      maxWaitMs: 120_000,
    },
  );
  if (outcome.status === "pending" && isPending(outcome.result)) {
    // The budget ran out: tell the user the work is still running and where to look.
    console.log(`Still processing; check again later (${outcome.result.pollUrl}).`);
  }
} catch (e) {
  // A timeout, an abort, an oversized or malformed response: nothing the site sent is used.
  if (e instanceof AXEClientError) console.error(e.message);
  else throw e;
}
// #endregion limits
