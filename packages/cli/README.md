# `axe`

CLI for installing and validating Agent Experience Surface.

Install Surface in a supported React Router, Next.js, Vite/React, React, or plain HTML application, from its directory:

```sh
npx @summationai/axe surface init --agent-web --dry-run
npx @summationai/axe surface init --agent-web --yes --install
```

A coding agent follows the self-contained integration prompt, printed by `npx @summationai/axe surface prompt` and shipped in this package as `templates/integrate-surface.md`. If the agent may not run `npx` (its permissions refuse downloaded code), it asks the person to run the second command above, then finishes the steps the prompt lists. It does not rebuild the generated files by hand.

The default output supports browser-native WebMCP and a provider-injected hosted connection. The consuming application does not run an MCP server. See the repository [getting-started guide](https://github.com/summationai/agent-experience/blob/main/docs/getting-started.md) and [application/provider boundary](https://github.com/summationai/agent-experience/blob/main/docs/architecture.md).
