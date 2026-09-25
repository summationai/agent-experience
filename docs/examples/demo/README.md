# Plan Board demo

A local demo of one application shared by a person and an agent. `plan-board.ts` serves a three-month demand plan: the page at http://localhost:4000 is the person's view, and the same controls are served as AXE actions that `axe mcp` turns into MCP tools for an agent. Both act through the same handlers, under one revision, and every act lands in the ledger with who made it.

Run it with `pnpm demo` after `pnpm install && pnpm -r build`. Connect an agent with the command the server prints. The walkthrough is in the pull request description and in the session that produced it; the short version:

1. Ask the agent to read the board, then to raise January's demand.
2. Edit a month in the browser, then ask the agent to change the same month without re-reading: it gets `conflict` and nothing is applied.
3. Ask the agent to lock March: it is handed back to the person with a link. Press "Approve March" in the page, then tell the agent to continue.

The two bearer tokens (`dana-browser`, `dana-agent`) are fixed demo sessions. The server is for a laptop only.
