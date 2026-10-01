# @summationai/axe

## 1.1.0

### Minor Changes

- WebMCP without a relay, headless: `axe host --dev --webmcp --stdio` serves a page's own WebMCP tools to a desktop agent from headless Chromium, with the person asked before high-risk controls (a host-delivered approver, [S-WEB-6]) and the page's own tool hints. `exposeWebMcp(surface, { granularity: "domain" })` offers a fixed tool set taking entry ids (`surface_navigate`, `surface_set-field`, `surface_run-control`, `surface_load-more`) with an observe tool that filters and pages ([S-WEB-7]). Easy mode reads tenants, tables, and filter strips as the choices they are, reads a listing rendered as buttons, reads through `display: contents`, and never puts script text in notices. `axe surface coverage --state` reuses a saved sign-in and reads each page once it settles.
- `axe surface init --agent-web` writes the site's side of the agent web: an `agent-site.server` module (fail-closed `identify` and `session` to finish) and an `/agent` route for Next.js and React Router file routes. The integration prompt covers wiring them, `agentEntry`, naming the entry in the page, and not gating navigation.

### Patch Changes

- Updated dependencies
  - @summationai/axe-host@1.1.0
  - @summationai/axe-relay@1.1.0
  - @summationai/axe-client@1.1.0
  - @summationai/axe-core@1.1.0
  - @summationai/axe-generate@1.1.0
  - @summationai/axe-mcp@1.1.0
  - @summationai/axe-testing@1.1.0
