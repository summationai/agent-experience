# @summationai/axe-host

## 1.1.0

### Minor Changes

- WebMCP without a relay, headless: `axe host --dev --webmcp --stdio` serves a page's own WebMCP tools to a desktop agent from headless Chromium, with the person asked before high-risk controls (a host-delivered approver, [S-WEB-6]) and the page's own tool hints. `exposeWebMcp(surface, { granularity: "domain" })` offers a fixed tool set taking entry ids (`surface_navigate`, `surface_set-field`, `surface_run-control`, `surface_load-more`) with an observe tool that filters and pages ([S-WEB-7]). Easy mode reads tenants, tables, and filter strips as the choices they are, reads a listing rendered as buttons, reads through `display: contents`, and never puts script text in notices. `axe surface coverage --state` reuses a saved sign-in and reads each page once it settles.
- The agent web (experimental): a page's Surface for an agent with nothing installed. `axe host --dev --agent-web` serves the page as Markdown pages of single-use links, backed by the headless WebMCP bridge, so an agent that can only follow links (Claude Desktop, with no connector) reads and acts in the person's own account; `--text-in-url` lets an agent that composes URLs type a value as `?text=`. The person connects the session, approves high-risk actions, and types free text on the site's own pages (`agentSiteHandler` in `@summationai/axe-core/agent-site`). The dev log names each request's user agent, fetch metadata, and `Signature-Agent`.

### Patch Changes

- Updated dependencies
  - @summationai/axe-surface@1.1.0
  - @summationai/axe-relay@1.1.0
  - @summationai/axe-core@1.1.0
  - @summationai/axe-mcp@1.1.0
