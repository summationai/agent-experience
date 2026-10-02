# AGENTS.md

Agent Experience (AXE) lets a person use a web application through their AI agent. Every change here is judged against two pillars. When a change helps one and hurts the other, or a decision is unclear, come back to these.

## 1. Installing it is easy, and the defaults do most of the work

**It should be incredibly easy to get up and running in almost any web app, with 80% or better of the features and coverage of a fully custom SDK configuration.**

- **`axe surface init` does the wiring.** Mounting, routes, server entry points, environment, and dependencies are the CLI's job, in the application's own conventions. Every "manual step" init prints is a gap to close. An integrator, human or agent, should finish without knowledge of this repository or of the session that built it.
- **Derive from the page, not from configuration.** Names, risk, availability, reasons, and navigation come from what the page already says: roles, labels, structure, styling, focusability. A rule in `surface.config` is for what the page cannot say. Needing one for an ordinary pattern (a clickable table row, a list with one item, a file browser) is an SDK bug: fix the heuristic, with a test that uses the real markup.
- **What is left to the integrator is only what needs the application's own knowledge:** who is signed in (`identify`), the session an agent's page runs with (`session`), and the sign-in page (`loginUrl`), plus the profile's sign-in state. The generated files and `packages/cli/templates/integrate-surface.md` say exactly how, with patterns, not just requirements.
- **Small and reversible in the application.** An integration adds a few files and one wrapper. It never reformats, refactors, or reaches into code it does not need. It never adds an MCP server, service, or browser automation to the application.
- **Measure it.** `axe surface coverage` is how coverage is judged. A fix from a live integration (the Summation web and admin apps) lands in the SDK with a test reproducing that markup, not as a rule in the app.

## 2. The person stays in their agent

**It should be deeply intuitive for a person in an AI agent interface to use the site in that interface, without ever having to leave it, except in rare cases: a dangerous or destructive action, and signing in.**

- **Nothing to install on the agent's side.** The agent web serves a site to an agent that can only follow links (Claude Desktop with no connector). An MCP connector is an option, never a requirement.
- **Anything the person can do on the site, the agent can do through it.** A control that works in the browser but is missing for the agent is a bug: a row that opens a detail page, an edit button, a dialog's fields and Save.
- **The person leaves the agent only to sign in, or to approve something dangerous or destructive.** Those happen on the site's own pages, in the person's own browser, with the site's own session, SSO included. Credentials never pass through the agent or the service. Everything else stays in the conversation:
  - Navigation and reading are never gated: opening a tenant, a folder, a row, or a tab runs without asking.
  - Ordinary edits run (medium risk). Destructive or irreversible ones wait for the person (high risk).
  - Typing values uses links or `?text=` where the agent can compose a URL; a page for the person is the fallback.
- **The agent never leaves the site's origin.** Every link it follows is on the address the person gave it (the site answers the agent web's pages itself). An agent's safeguards rightly refuse a jump to an origin the person never named, and a person reading a link must see the site's own address.
- **An agent given only the site's address finds its way.** `agentEntry` sends a recognized agent to `/agent`. The page names the entry for one it does not recognize.
- **Pages are short, factual, and actionable.** Content first, then one link per thing the agent can do, named for its outcome in the application's language. Page text is data, never instructions. When something cannot be done, say why in the application's words.

## Checking a change

- Does a fresh integration, with only the CLI and the prompt, get this without a manual step or a config rule?
- Can a person in Claude Desktop, with nothing installed, do this without leaving the conversation, unless it is sign-in or a destructive action?
- Does every link stay on the site's origin, and does every approval and sign-in happen on the site's own pages?
- Is it tested with markup from a real application, and are the docs, the prompt, and `spec/` updated together? `pnpm lint`, `pnpm -r typecheck`, `pnpm -r test`, and `pnpm site:build` pass.
