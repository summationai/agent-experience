# Plan Board demo

This is the quick demo: one file, one process, no sign-in. For the full workflow (sessions for two people on two teams, a server store with a revision column and conditional writes, approvals bound to the call and decided on the app's own page, receipts, one history, and browser tests), use the reference application in `examples/plan-review` ([docs/reference-app.md](../../reference-app.md)). Its "Approve March" button is a demo shortcut, not the SDK's approval primitive ([docs/human-oversight.md](../../human-oversight.md)).

A local demo of one application shared by a person and an agent. `plan-board.ts` serves a three-month demand plan: the page at http://localhost:4000 is the person's view, and the same controls are served as AXE actions that `axe mcp` turns into MCP tools for an agent. Both act through the same handlers, under one revision, and every act lands in the ledger with who made it, as does the person's approval and any call the server refuses as stale.

Run it with `pnpm demo` after `pnpm install && pnpm -r build`. Connect an agent with the command the server prints. The walkthrough is in the pull request description and in the session that produced it; the short version:

1. Ask the agent to read the board, then to raise January's demand.
2. Edit a month in the browser, then ask the agent to change the same month without re-reading: it gets `conflict` and nothing is applied.
3. Ask the agent to lock March: it is handed back to the person with a link. Press "Approve March" in the page, then tell the agent to continue.
4. Ask the agent to read the ledger (`plan.ledger`). Every revision move has an entry: the acts of both participants, the refused ones with an error status, the approval (recorded by the app with `surface.record`, marked "recorded" on the page and `source: "application"` in the ledger), and the agent's stale edit from step 2 (refused by the server before any control ran and recorded by the bridge, marked "refused by server" and `source: "server"`, with the revision the agent presented).

`docs/test/demo.test.ts` runs this sequence against the script on a free port and checks the ledger has no revision gap.

The two bearer tokens (`dana-browser`, `dana-agent`) are fixed demo sessions. The server is for a laptop only.
