# Agent Experience plugin

This is the distributable ChatGPT/Codex layer for the provider-operated hosted service. It gives the product a user-facing name, connects its remote tools, and tells the agent to discover and use a site's Surface before falling back to browser automation.

The checked-in MCP URL uses the reserved `.invalid` domain on purpose. A plugin cannot discover an arbitrary service URL at runtime, and a public ChatGPT plugin must name one stable public HTTPS endpoint. Configure a build after deploying [`mcp/`](../../mcp/README.md):

```sh
node plugins/agent-experience/scripts/configure.mjs \
  https://agents.your-company.example/mcp \
  /tmp/agent-experience-plugin
```

The output contains both the portable Agent Plugins manifests (`plugin.json`, `mcp.json`) and the current Codex compatibility manifests (`.codex-plugin/plugin.json`, `.mcp.json`). The endpoint in both files must exactly equal `AXE_HOST_PUBLIC_MCP_URL`, the OAuth token audience, and the protected resource identifier.

## User experience

After public submission, a person finds **Agent Experience** in ChatGPT's plugin directory and taps Install. Installation and ordinary ChatGPT startup do not open a login page. When the user asks a question such as “prepare my Summation weekly report,” the first relevant tool call starts or resumes a provider-hosted application session. The application's Surface—including organization and tenant selection—stays inside a private hidden browser; the user receives data and approvals in ChatGPT rather than watching page automation. There is no pairing code, manually pre-opened tab, local process, MCP URL, or developer-mode step in this target consumer flow.

Installation and account consent cannot be silently bypassed by a website package. They are the platform's trust boundary. A product can make this feel ordinary with a deep link or “Use in ChatGPT” entry point after the plugin is published, but it cannot pre-authorize itself inside a user's ChatGPT account.

## Release checklist

1. Deploy the hosted unattended service at a stable public HTTPS `/mcp` URL and configure its OAuth identity boundary plus the provider-owned application account/session exchange. The consuming application's browser package and mount remain its only SDK integration; the current service still models the session exchange as a broker contract while that provider service is built.
2. Generate the configured plugin directory with `scripts/configure.mjs`.
3. Register and test the MCP endpoint in ChatGPT developer mode, including fresh login, expired/revoked tokens, read-only work, writes, approval, and slow operations.
4. Validate the configured plugin and evaluate prompts that do and do not belong to the connected application.
5. Submit the endpoint and plugin to the universal plugin directory. Use a universal URL; the service resolves the signed-in principal and tenant from OAuth.

For local desktop validation of the no-visible-browser experience, use `pnpm mcp:unattended-dev` as documented in [`mcp/README.md`](../../mcp/README.md). Use `pnpm mcp:handoff-dev` for the attended fallback and `pnpm mcp:dev` only when deliberately testing the older code-pairing flow. The public plugin points at the provider's hosted service; the consuming site still installs only the browser package.
