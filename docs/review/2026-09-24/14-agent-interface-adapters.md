# 14. Existing agent interfaces through adapters (WebMCP, elicitation, MCP Apps)

Phase 3. Branch `review/adapters`, based on `herz/surface-integration` at `7284f6a` (phases 1 and 2 merged).

## Finding

The review said AXE described itself as filling gaps that the agent ecosystem already fills in part, and that it should meet existing agent interfaces through adapters: WebMCP in the browser, MCP elicitation for requirements and handoffs, MCP Apps for presentation, and MCP's OAuth resource-server model for authorization.

Verified at `7284f6a`:

- `@axe/mcp` rendered every `needs_input` and `needs_human` as text and never used elicitation, even with a client that declared it. Its server declared only `tools`, so no MCP Apps view could exist.
- `docs/mcp.md` "What does not map" already named elicitation and MCP Apps as counterparts "this bridge does not use yet" (item 10 changed it), but `docs/faq.md` said MCP gives a site no escalation ladder, no `display` hints, and no human-handoff semantics, and mentioned neither elicitation, Apps, nor MCP's OAuth model. The FAQ's OAuth answer did not separate verifying tokens (which `@axe/mcp` does since item 9) from issuing them (which nothing in the SDK does).
- A Surface could be reached by a browser agent only through `expose(window)` or the DOM; there was no WebMCP path. The `@axe/surface` plus `/react` browser bundle was 31,370 bytes minified.
- `docs/why-axe.md`, `docs/for-agent-builders.md`, and `README.md` made no incorrect claim about MCP; they did not mention these MCP features either.

## Change

### WebMCP: `@axe/surface/webmcp`

`packages/surface/src/webmcp.ts` (new subpath export; `tsup.config.ts`, `package.json` `exports` and typesVersions, `typedoc.json`):

- `exposeWebMcp(surface, options)`: finds `document.modelContext` with `registerTool` (or `options.modelContext`; `null` disables). Absent: registers nothing and returns `{ supported: false, reason }`. Present: registers `surface_observe` (read-only, `untrustedContentHint`) and one tool per action, non-sensitive field, and collection with `more`. Descriptions come from `describeEntry`, plus what the tool does and, when unavailable, the handoff or the kinds that would unblock it. Input schema `{ expectedRev?, text? (the field's schema and maxLength), confirm? }` with `additionalProperties: false`. `consequentialHint` on a control that is not reversible.
- Follows `subscribe`, diffs by name, description, schema, and annotations, and re-registers only what changed (abort the old signal, register again). Rounds are serialized, since the draft rejects a duplicate name. `unavailable: "describe" | "omit"`.
- `execute` calls `surface.act` with the call's `expectedRev`, or the surface's current revision when omitted; `actor` defaults to `webmcp`; `run` is forwarded. Result: `{ content: [text], structuredContent: envelope, isError? }`.
- `webMcpToolNames(ids, prefix)`: letters, digits, `_`, `-`; an FNV-1a hash of the id on a collision or on the observe tool's name; at most 128 characters.
- The browser API is reached only in resolveModelContext and registerOne.

Spec: `spec/SURFACE.md` v0.7, §8 "WebMCP: the browser's own agent", [S-WEB-1] to [S-WEB-5]; provenance line.

### Elicitation in `@axe/mcp`

`packages/mcp/src/elicitation.ts` (new) and `packages/mcp/src/index.ts` (`finish`, offerPage, and an `Interaction` built in the CallTool handler):

- `elicitationModes(capabilities)`: `{}` means form only (the specification's backwards-compatibility rule).
- `isSensitiveAccept`: `sensitive: true`, `payment.*`, `identity.*`, `credential(s).*`, and kind names containing password, passcode, secret, token, api-key, private-key, OTP, or PIN.
- `toFormSchema`: the MCP form subset (flat object of string, number, integer, boolean, single- and multi-select enum; string formats email, uri, date, date-time). Nested objects, unions, and references return null; a primitive schema is wrapped as `value`.
- planElicitation: walk `accepts` in order; the first non-sensitive kind with a form rendering gets a form; a sensitive kind met first gets URL mode if the client declared it and the `fallback` URL is https (or loopback http), else nothing.
- Form `accept`: `/axe/continue` with the token, the kind, the answer, and the call's `expectedRev`, as the same caller; a `pending` continuation is polled within the budget; up to three forms per tool call. `decline`, `cancel`, or an error: the original result with a note.
- `needs_human` with URL mode: the handoff URL is offered, except for `login_required`. `accept` is reported as consent to open, and the resume token stays in the text.
- The request is sent with relatedRequestId (on the tool call's own response stream over HTTP), the call's abort signal, and `timeout` (option `elicitation.timeoutMs`, default 600000). `elicitation: false` turns it off.

Spec: §22 [P-MCP-6] (form mode), [P-MCP-7] (sensitive kinds, URL mode, `login_required`, the handoff page identifies the user). Mapped in `packages/testing/src/conformance/requirements.ts`.

### MCP Apps view in `@axe/mcp` (experimental)

`packages/mcp/src/apps.ts` (new): the extension id, the MIME type, `ui://axe/presentation`, and the view's HTML. In `index.ts` the server declares `resources: {}` unless `apps: false`. `tools/list` adds `_meta.ui.resourceUri` to `display` tools, `resources/list` lists the view, and `ok` results carry `_meta["axe/presentation"].html` (from `toHTML`), all only when `capabilities.extensions["io.modelcontextprotocol/ui"].mimeTypes` includes `text/html;profile=mcp-app`. `resources/read` serves the view with `_meta.ui.prefersBorder`. `formatResult(result, action, brand, { presentation })`.

The view: inline style and script only; sends `ui/initialize` (protocol version `2026-01-26`) and `ui/notifications/initialized`, renders on `ui/notifications/tool-result`; accepts messages only from `window.parent`; parses the HTML with `DOMParser`; removes `script`, `iframe`, `object`, `embed`, `form`, `link`, `meta`, `base`, the affordance buttons, every `on*` and `srcdoc` attribute, and non-http(s) `href` and `src`; falls back to the text content in a `<pre>`; routes link clicks through `ui/open-link` when the host offers openLinks.

Spec: §22 [P-MCP-8].

### Docs, vocabulary, and the rest

- `docs/webmcp.md` (new; `docs/README.md` item 15; `site/build.mjs` "Reference" group); example `docs/examples/webmcp/page.ts`.
- `docs/mcp.md`: mapping rows for `ok`, `needs_input`, `needs_human`; "What maps to MCP's own features, and what does not" replaces "What does not map"; new sections "Elicitation" and "MCP Apps view (experimental)"; example `docs/examples/mcp/elicitation.ts`.
- `docs/surface.md`: a paragraph pointing to WebMCP after `expose`.
- `spec/VOCABULARY.md` "Agent interface adapters": `exposeWebMcp`, `modelContext`, `registerTool`, `consequentialHint`, `requestedSchema`; `packages/core/src/vocabulary.ts` regenerated.
- `CHANGELOG.md`, `DECISIONS.md` ("Existing agent interfaces"), `.changeset/agent-interface-adapters.md`, API reference regenerated.

### Docs corrections

| File | Old claim | New text |
| --- | --- | --- |
| `docs/faq.md`, "How is this different from MCP?" | MCP alone does not give a site "an escalation ladder (a tool either returns or errors), `display` hints, and human handoff semantics". | MCP has elicitation (form and URL modes), the Apps extension, and OAuth resource-server authorization, and the derived server uses them; WebMCP plays that role in the browser. AXE adds discovery at a domain, typed kinds with shared shapes and sensitivity, a three-rung ladder whose follow-ups resume with tokens bound to caller and tenant, revision-guarded live state, and honesty rules with an audit. |
| `docs/faq.md`, "What about authentication and OAuth?" | "No OAuth 2.1 authorization server ships in v0." (nothing on the resource-server side) | Kept and marked deliberate; added that `@axe/mcp` is a resource server (verifies each token, publishes RFC 9728 metadata) and issuing tokens stays with the site's authorization server. |
| `docs/mcp.md`, "What does not map" | Handoff and presentation had no counterpart the bridge used ("this bridge does not use it yet"); "The derived server declares only tools in v0." | Three lists: what maps to MCP's own features (elicitation, Apps, OAuth resource server; issuing tokens deliberately out of scope), what AXE adds, and what has no counterpart (discovery, idempotency keys, prompts and sampling, streaming). |
| `docs/why-axe.md`, "An MCP server for free" | (no MCP comparison) | Adds that the derived server uses elicitation and the Apps extension with clients that support them. |
| `docs/for-agent-builders.md`, opening | (no MCP comparison) | One sentence: the derived server uses elicitation and Apps when the client declares them. |

`README.md` makes no claim that MCP lacks these features and is unchanged. `llms.txt` is left to the coordinator.

## Tests

`packages/surface/test/webmcp.test.ts` (jsdom; a fake `document.modelContext` enforcing the draft's `registerTool` checks: name characters and length, duplicate name, empty description; abort unregisters; results serialized to JSON as the draft specifies):

- without WebMCP: registers nothing, says so, and leaves the page and expose() working (absent API, an object without `registerTool`, `modelContext: null`)
- registers an observe tool and one tool per control, with describeEntry text and JSON input schemas; a sensitive field is never exposed
- acts through the page's own surface at the latest revision, passes expectedRev, and maps the result to text and structured content
- follows availability: a changed reason re-registers the tool, `omit` drops an unavailable control, and a freeze is described
- maps ids to valid, stable, unique tool names and reports a refused registration

`packages/surface/test/bundle.test.ts`: the `@axe/surface` plus `/react` bundle contains no `webmcp` input (new assertion); `@axe/surface/webmcp` bundles alone for the browser without Zod or React (new test; 34,627 bytes alone, since it includes the main entry; about 5.6 kB on top of `@axe/surface`).

`packages/mcp/test/elicitation.test.ts` (the SDK `Client`, with and without the capability):

- in memory: a client without the capability gets the needs_input text as before; a form-capable client is asked for a non-sensitive kind in a flat form, and the answer continues the action; decline and cancel return the needs_input result to the model, whose axe_continue still works; a sensitive kind is never put in a form, URL mode offers the site's page when the client has it, otherwise the text (form-only and form+URL clients); needs_human is offered as the site's page in URL mode, never in a form, login_required is left to MCP authorization; `elicitation: false` keeps every result as text; only schemas in the form subset become forms, sensitivity is decided before the schema
- over real HTTP (`serveHttp` behind `node:http` on 127.0.0.1, SDK `StreamableHTTPClientTransport`, the OAuth verifier and `clientFor`): over HTTP sessions the form reaches the calling client mid-call, and the continuation runs as that caller (a second user without the capability gets text; the site records `create:alice`, `continue:alice`, `create:bob`); over HTTP sessions a URL-capable client is offered the handoff page; stateless HTTP cannot carry a server request, so the client gets the text

`packages/mcp/test/apps.test.ts`: a host that negotiated the extension gets the ui:// view on display tools and the escaped rendering with each result (an injected `<img onerror>` and `<script>` come out escaped; the view has no external script, link, frame, or URL); a host without the extension sees no view, no resource, and the same text result (also a host declaring another MIME type, and `apps: false`); over HTTP sessions the view is negotiated per session.

`packages/mcp/test/apps-view.test.ts` (jsdom, a stand-in host in the parent window speaking the extension's messages): the view initializes with the host, renders the escaped presentation, and runs nothing from the result; without a presentation in the result, the view shows the text content.

Restoring `packages/mcp/src/index.ts` to `7284f6a` removes exports the new test files import, so they fail to load. With the code in place but both features off by default (checked by flipping the two defaults), nine of the thirteen elicitation and Apps tests fail; the four that pass are "a client without the capability", "`elicitation: false`", the stateless-HTTP test, and the schema unit test, which pin the fallback. The existing `mcp.test.ts`, `http.test.ts`, and `freshness.test.ts` pass unchanged; their clients declare neither capability.

## Limitations

- WebMCP is a draft behind a flag and an origin trial in one browser (Chrome 149 and later, as of September 2026). The adapter was tested against a fake that implements the documented shape, not in Chrome. If the draft changes, resolveModelContext and registerOne change. Earlier builds with `navigator.modelContext` are not detected.
- The WebMCP adapter offers no ledger tool and no way to supply a `requires` kind to an unavailable control; the AXE bridge's `/axe/continue` does that server-side.
- Elicitation needs a connection that can carry a server request during the call. Stateless HTTP cannot, so its clients always get text.
- URL-mode elicitation does not wait for the user, and the bridge sends no `notifications/elicitation/complete`, since it cannot observe completion on the site. The model still calls `axe_resume`.
- One form per `needs_input`, for the first suitable kind. A site whose preferred kind is sensitive gets URL mode or text even when a later kind would fit a form. Dropped keywords (formats outside the four) are checked by the site on continue, so a user can submit a value the site refuses with `invalid_input`.
- The sensitivity rule is a floor over the site's flag plus a name heuristic; a custom sensitive kind with an innocuous name must be marked `sensitive: true`, as [K-4] already requires.
- The Apps view is experimental and was tested under jsdom with a stand-in host, not in a shipping host. It shows no images (the host's default CSP allows none from other origins and the view declares no resourceDomains), and it hides the affordance buttons rather than wiring them to `tools/call`. The server announces the `resources` capability to every client.
- MCP authorization-server operation (issuing tokens) is not provided, deliberately; `@axe/mcp` remains a resource server (item 9).

## Sources verified

All read on 2026-09-24 with a web fetch. Claims in code and docs rest on these unless listed as unverified.

- WebMCP specification, W3C Web Machine Learning Community Group, Draft Community Group Report of 17 September 2026, <https://webmachinelearning.github.io/webmcp/>: `ModelContext` on `Document` (`document.modelContext`), `[SecureContext]`; `registerTool(tool, { signal, exposedTo })` returns a promise resolved after registration; rejects with `InvalidStateError` for an empty name, a name over 128 characters or with characters other than ASCII alphanumerics, `_`, `-`, `.`, a duplicate name, or an empty description; aborting the signal unregisters; getTools, executeTool; `toolchange`, `toolactivated`, `toolcancel` events; the `execute(input, { signal })` result is serialized to a JSON string; annotations `readOnlyHint`, `untrustedContentHint`, `consequentialHint`, `debugging`. No `navigator.modelContext`, provideContext, unregisterTool, or clearContext.
- WebMCP explainer, <https://github.com/webmachinelearning/webmcp>: the same `document.modelContext` shape; an example `execute` returning `{ content: [{ type: "text", text }] }`.
- Chrome, "WebMCP", <https://developer.chrome.com/docs/ai/webmcp>, last updated 7 August 2026: origin trial from Chrome 149, flag `chrome://flags/#enable-webmcp-testing`, "under active discussion and subject to change". Chrome, imperative API page, <https://developer.chrome.com/docs/ai/webmcp/imperative-api>, last updated 21 September 2026: `document.modelContext.registerTool`, feature detection with `document.modelContext?.registerTool`.
- MCP specification 2025-11-25, "Elicitation", <https://modelcontextprotocol.io/specification/2025-11-25/client/elicitation>: capability `elicitation: { form, url }`, `{}` equals form only, servers must not send undeclared modes; form `requestedSchema` limited to flat primitive properties (formats email, uri, date, date-time; enums with and without titles; multi-select arrays); servers must not use form mode for passwords, API keys, access tokens, or payment credentials and must use URL mode for them; URL mode carries elicitationId and `url`, and `accept` is consent, not completion; `notifications/elicitation/complete` is optional; the URL must not be pre-authenticated or carry sensitive user data; the server must verify that the user who opens the URL is the user who started the elicitation; URL mode must not be used to authorize the user to the MCP server itself.
- MCP specification 2025-11-25, "Authorization", <https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization>: an MCP server is an OAuth 2.1 resource server and the authorization server may be separate; servers must implement RFC 9728 protected-resource metadata, validate token audience, answer 401 and 403 with `WWW-Authenticate`, and must not pass tokens through; authorization is optional, and stdio servers should take credentials from the environment.
- MCP Apps overview, <https://apps.extensions.modelcontextprotocol.io/api/documents/overview.html>, and specification SEP-1865 "MCP Apps", status Stable, version 2026-01-26, <https://github.com/modelcontextprotocol/ext-apps> (`specification/2026-01-26/apps.mdx`): extension id `io.modelcontextprotocol/ui`; the host declares `capabilities.extensions[...]` with `mimeTypes: ["text/html;profile=mcp-app"]`; servers SHOULD check it before registering UI tools and declare nothing themselves; resources are `ui://…` with that MIME type, served by `resources/read` as `text`, and may be left out of `resources/list`; tools use `_meta.ui.resourceUri` (the flat `ui/resourceUri` is deprecated); `_meta.ui.prefersBorder` and `_meta.ui.csp`; view messages `ui/initialize` (protocol version `2026-01-26`), `ui/notifications/initialized`, `ui/notifications/tool-input`, `ui/notifications/tool-result` carrying a `CallToolResult`; `ui/open-link` needs the host's openLinks; default CSP `default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' data:; connect-src 'none'`; hosts without Apps treat the tool as text-only.
- Installed `@modelcontextprotocol/sdk` 1.30.1 (read in `node_modules`): `Server.elicitInput(params, options)` checks `elicitation.form` and `url` and validates form answers against `requestedSchema`; `ElicitRequestFormParamsSchema`, `ElicitRequestURLParamsSchema` (`url` must parse as a URL); the client-capabilities schema normalizes `elicitation: {}` to `{ form: {} }`; `ClientCapabilities.extensions` is a free record. No types or helpers for MCP Apps.

Unverified: the WebMCP adapter in Chrome itself (no browser run); the Apps view in a shipping host (only jsdom with a stand-in host); that hosts pass the tool result's `_meta` to the view unchanged (the specification says the notification's params are the `CallToolResult`, which includes `_meta`).

## Status

done
