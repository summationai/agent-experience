import type { AXEClient, RunOutcome, ActionDefinition, Result } from "@summationai/axe-client";
import { present, toMarkdown } from "@summationai/axe-client/present";

/** The conversation surface your agent talks through. */
interface Conversation {
  say(text: string): void;
  remember(key: string, value: string): void;
}

// #region loop
export async function act(
  client: AXEClient,
  actionName: string,
  input: unknown,
  chat: Conversation,
): Promise<void> {
  // run() invokes, tries your fulfillers on needs_input, polls pending, and only then settles.
  const outcome = await client.run(actionName, input);
  await settle(client, outcome, chat);
}

async function settle(client: AXEClient, outcome: RunOutcome, chat: Conversation): Promise<void> {
  const site = client.manifest().name;
  switch (outcome.status) {
    case "ok": {
      // Present. With display, render the comparison; without, summarize the output yourself.
      if (outcome.action.display) {
        chat.say(toMarkdown(present(outcome.action, outcome.result, client.manifest().brand)));
      } else {
        chat.say(JSON.stringify(outcome.result.output));
      }
      return;
    }

    case "needs_input": {
      // Fulfillers were tried (outcome.tried lists the kinds). Ask the user for the specific
      // thing the site named, in the site's order of preference. Never a generic "I couldn't".
      const want =
        outcome.result.accepts.find((a) => !outcome.tried.includes(a.kind)) ??
        outcome.result.accepts[0];
      if (!want) return chat.say(outcome.result.message);
      chat.say(
        `${outcome.result.message} To continue I need ${want.title.toLowerCase()}: ${want.description}`,
      );
      if (want.instructions) chat.say(want.instructions);
      chat.remember("continuationToken", outcome.result.continuationToken);
      return;
    }

    case "needs_human": {
      // Say what the site asked you to say, give the URL, keep the token, resume later.
      const h = outcome.handoff;
      chat.say(`${h.whatAgentShouldSayToUser} ${h.url}`);
      chat.remember(`resumeToken:${outcome.action.name}`, h.resumeToken);
      return;
    }

    case "pending": {
      // run() already polled for its budget. Poll once more, then tell the user what to expect.
      const later = await client.poll(outcome.result, { maxWaitMs: 60_000 });
      if (later.status === "pending") {
        chat.say(
          `${site} is still working on this. I'll check back in ${later.retryAfter} seconds.`,
        );
        chat.remember(`pollUrl:${outcome.action.name}`, later.pollUrl);
        return;
      }
      return settle(client, outcomeFrom(outcome.action, later), chat);
    }

    case "error": {
      const e = outcome.result.error;
      if (e.code === "invalid_input" && e.details?.issues) {
        // Your mistake, not the user's: fix the listed paths and call again.
        const fixes = e.details.issues.map((i) => `${i.path || "/"}: ${i.message}`).join("; ");
        chat.remember("lastInvalidInput", fixes);
        return;
      }
      if (e.retryable) {
        // rate_limited and unavailable were already retried `retries` times by run().
        chat.say(`${site} is temporarily unavailable. I'll try again shortly.`);
        return;
      }
      // Report the site's message; it was written for this situation.
      chat.say(`${site} reported: ${e.message}`);
      return;
    }
  }
}

/** Lift a polled result envelope back into the shape run() returns. */
function outcomeFrom(action: ActionDefinition, result: Result): RunOutcome {
  switch (result.status) {
    case "ok":
      return { status: "ok", result, action };
    case "needs_input":
      return result.fallback
        ? { status: "needs_human", handoff: result.fallback, result, action }
        : { status: "needs_input", result, action, tried: [] };
    case "needs_human":
      return { status: "needs_human", handoff: result.handoff, result, action };
    case "pending":
      return { status: "pending", result, action };
    case "error":
      return { status: "error", result, action };
  }
}
// #endregion loop
