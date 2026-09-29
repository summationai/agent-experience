# `axe`

CLI for installing and validating Agent Experience Surface.

Give a coding agent the self-contained installation prompt:

```sh
npx @summationai/axe surface prompt
```

Or install directly in a supported React Router, Next.js, Vite/React, React, or plain HTML application:

```sh
npx @summationai/axe surface init --dry-run
npx @summationai/axe surface init --yes --install
```

The default output supports browser-native WebMCP and a provider-injected hosted connection. The consuming application does not run an MCP server. See the repository [getting-started guide](https://github.com/summationai/agent-experience/blob/main/docs/getting-started.md) and [application/provider boundary](https://github.com/summationai/agent-experience/blob/main/docs/architecture.md).
