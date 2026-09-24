// Action events: every act through the bridge, run or refused, reaches the server's onActionEvent
// sinks with the actor and the ledger seq. Keep these sinks apart from analytics: they name people.
// #region events
import { createAXE } from "@axe/core";
import { jsonlFileSink } from "@axe/core/node";
import type { AXEActionEvent } from "@axe/core/types";
import { surfaceActions } from "@axe/surface/axe";
import { surface } from "./board";

declare function notifyCommissioner(message: string): void;

export const axe = createAXE({
  name: "Fantasy Draft",
  description:
    "A draft board: observe which players can be drafted right now, then draft, undo, or flag them under one revision.",
  baseUrl: "https://draft.example",
  auth: { modes: ["none", "user"], userLoginUrl: "https://draft.example/login" },
  secret: process.env.AXE_SECRET,
  onActionEvent: [
    jsonlFileSink("/var/log/draft/ledger.jsonl"),
    (e: AXEActionEvent) => {
      if (e.status === "error")
        notifyCommissioner(
          `${e.actor ?? "an agent"} was refused (${e.errorCode}) at #${e.details.seq}`,
        );
    },
  ],
});

axe.addProvider(surfaceActions(surface, { namespace: "board", auth: "user" }));
// #endregion events
