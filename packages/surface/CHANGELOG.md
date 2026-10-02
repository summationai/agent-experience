# @summationai/axe-surface

## 1.2.0

### Minor Changes

- 3701f7a: Easy mode offers a table row made focusable on purpose (`tabindex` 0 or more, in a table or grid) as an action that opens its item, low risk. The admin app's Users and Tenants tables open a user or tenant only through a row click, so an agent could see the list but never reach a detail page or its Edit button.

### Patch Changes

- 8832355: `SurfaceProfile` and `SurfaceProfileSource` are exported from `@summationai/axe-surface/auto`, where a generated `surface.config` already imports `SurfaceConfig`. `axe surface init`'s next steps report the profile and `agent-site.server` as done once the integrator has wired them, instead of repeating the instructions.
- Updated dependencies [2c81422]
- Updated dependencies [c611fa2]
- Updated dependencies [50254a7]
- Updated dependencies [b80d034]
  - @summationai/axe-core@1.2.0

## 1.1.0

### Minor Changes

- WebMCP without a relay, headless: `axe host --dev --webmcp --stdio` serves a page's own WebMCP tools to a desktop agent from headless Chromium, with the person asked before high-risk controls (a host-delivered approver, [S-WEB-6]) and the page's own tool hints. `exposeWebMcp(surface, { granularity: "domain" })` offers a fixed tool set taking entry ids (`surface_navigate`, `surface_set-field`, `surface_run-control`, `surface_load-more`) with an observe tool that filters and pages ([S-WEB-7]). Easy mode reads tenants, tables, and filter strips as the choices they are, reads a listing rendered as buttons, reads through `display: contents`, and never puts script text in notices. `axe surface coverage --state` reuses a saved sign-in and reads each page once it settles.
- Easy mode reads a lone row named for an item (a folder holding one subfolder, `connector_test`) as opening that item, not an unrecognized high-risk change.

### Patch Changes

- @summationai/axe-core@1.1.0
