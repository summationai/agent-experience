# WebMCP

WebMCP is a browser API through which a page registers tools for an agent built into the browser. `@summationai/axe-surface/webmcp` offers a [Surface](surface.md) through it: the page's controls become tools the browser's agent can call, each one running through the page's own surface with its revision guard, availability, and ledger. This page covers the status of the API, what the adapter registers, what it never registers, and what to use where the browser has no WebMCP.

For React easy mode, `<SurfaceProvider webMcp>` enables this direct route. It needs only `@summationai/axe-surface`; no MCP server or relay participates in that route. The recommended desktop-agent integration also installs `@summationai/axe-relay` and connects the same page-held Surface to the separately operated [Agent Experience MCP service](../mcp/README.md), because a generic desktop or headless-browser session does not receive a page's WebMCP tools automatically.

## Status

WebMCP is a draft, and most browsers do not have it. What this page and the adapter rest on, as read on 2026-09-24:

- The specification is a Draft Community Group Report of the W3C Web Machine Learning Community Group, dated 17 September 2026 ([webmachinelearning.github.io/webmcp](https://webmachinelearning.github.io/webmcp/); explainer at [github.com/webmachinelearning/webmcp](https://github.com/webmachinelearning/webmcp)). It exposes `document.modelContext` with `registerTool(tool, { signal })`; aborting the signal unregisters the tool.
- Chrome offers it for local testing behind `chrome://flags/#enable-webmcp-testing` and to sites in an origin trial from Chrome 149 ([developer.chrome.com/docs/ai/webmcp](https://developer.chrome.com/docs/ai/webmcp), updated 7 August 2026; the imperative API page, updated 21 September 2026). Chrome describes the API as under active discussion and subject to change.
- Earlier drafts put the API on the navigator object and had separate methods to provide a whole tool set and to unregister a tool by name. The current draft has neither, and the adapter does not look for them.

Treat the adapter as experimental for as long as the API is. It reaches the browser API in one function each for finding it and registering a tool, so a change in the draft is a small change in the adapter.

## Offering a surface

<!-- include: examples/webmcp/page.ts#expose -->

```ts
import { exposeWebMcp } from "@summationai/axe-surface/webmcp";
import { surface } from "../surface/board";

// Browser-driving agents keep reading window.__surface, whatever the browser supports.
surface.expose(typeof window !== "undefined" ? window : null);

// Registers surface_observe, page read/wait tools when this is an auto surface, and one tool per
// control when document.modelContext exists; otherwise registers nothing and says why. The human
// UI is the same either way.
const webmcp = exposeWebMcp(surface, { actor: "browser-agent" });
if (!webmcp.supported) console.info(`WebMCP not offered: ${webmcp.reason}`);
else void webmcp.ready().then(() => console.info("WebMCP:", webmcp.diagnostic()));

// A single-page app that tears the board down (a route change) closes it too.
export function leaveBoard(): void {
  webmcp.close();
}
```

<!-- /include -->

`exposeWebMcp(surface, options)` returns a handle: `supported` and, when false, `reason`; `tools()`, the names registered now; `ready()`, which resolves when the current registration round has settled; `diagnostic()`, which distinguishes unavailable, registering, ready, degraded, registration error, and closed states; and `close()`, which unregisters everything and stops following the surface. When React's `SurfaceProvider` also has `expose`, the same diagnostic is available at `window.__surface.webMcp()`.

Options:

- `modelContext`: the object to register with. Default: `document.modelContext` when it has `registerTool`. `null` turns the adapter off; an object of your own is for tests and polyfills.
- `prefix`: prepended to every tool name. Default `surface_`.
- `actor`: the `actor` the ledger records for acts made through these tools. Default `webmcp`.
- `unavailable`: `describe` (the default) registers an unavailable control with its reason; `omit` leaves it out until it is available.
- `observe`: register the observe tool. Default true.
- `content`: register read and wait tools when the surface came from `autoSurface`. Default true.
- `run`: wraps each handler run, as `surface.act`'s option does.
- `requestApproval`: trusted application UI for high-risk, confirmation, and `approval_required` controls. It receives the exact observed entry, act, and input and returns a boolean or `{ approved, actor }`. Without it, those calls are refused. It must resolve only from the person's interaction and must never be reachable by the agent.
- `onError`: called when the browser refuses a registration (another script holds the name, a permissions policy forbids tools).

<!-- include: examples/webmcp/page.ts#options -->

```ts
// Leave unavailable controls out instead of describing them, and use a prefix per page so two
// surfaces on one page do not collide.
export const quiet = exposeWebMcp(surface, { unavailable: "omit", prefix: "draft_" });
```

<!-- /include -->

## What is registered

- **`surface_observe`.** Read-only. Returns the observation: every entry's id, name, availability with its reason, and effect, under one revision, as text and as structured content. Sensitive field values are not in it ([S-PRV-1](../spec/SURFACE.md#61-authorization-and-privacy)).
- **`surface_read`.** Read-only, on an auto surface. Returns the headings, text, fields, tables, lists, notices, and named opaque regions that the page shows the person. It is bounded and paginated; private values are withheld and chart values are never guessed.
- **`surface_wait`.** Read-only, on an auto surface. Waits within a bound for visible text, a control's availability, a moved revision, a matching route, or an idle page, and reports what changed and which notices appeared. It is the direct way to follow work such as a report moving from “Preparing” to ready.
- **One tool per control that can be acted on.** An action (a click), a field that is not sensitive (typing text), a collection that can load more. The tool's description is the entry's `describeEntry` line, what the tool does, and for an unavailable control what would unblock it or what a person must do. The input schema takes an optional `expectedRev`, `text` for a field (with the field's own schema and `maxLength`), and `confirm` for a control that asks for confirmation. A control that is not reversible carries the `consequentialHint` annotation, which the draft defines for tools whose effect cannot be undone.

Tool names are the prefix and the entry id, with every character other than letters, digits, `_`, and `-` replaced by `_`: `pick:me:gibbs` becomes `surface_pick_me_gibbs`. Two ids that would share a name, or an id that would take the observe, read, or wait tool's name, get an eight-character hash of the id appended. A name is the same for an id every time, so an agent that learned it keeps it.

## Host compatibility and preflight

The browser is the WebMCP host. A package in the page can register tools only when that browser provides `document.modelContext.registerTool`; it cannot make a generic browser-automation or headless-computer-use session forward those tools to its model. Such a session may still click the ordinary UI, but that is not a Surface tool call and does not gain Surface's revision guard or ledger.

For ChatGPT desktop, use its built-in browser with site tools enabled and a model that supports site tools. OpenAI's [site-tools documentation](https://learn.chatgpt.com/docs/webmcp) describes that path; an external browser tab, a generic headless browser task, and a nested CLI agent are separate hosts and must not be assumed to inherit the page's tools.

Before asking an agent to act, verify all three layers:

1. `typeof document.modelContext?.registerTool === "function"` — the browser implements imperative WebMCP.
2. `await window.__surface?.webMcp?.()` in a development integration — registration settled with `state: "ready"` (or inspect its per-tool errors when `degraded` or `error`).
3. The browser's Site tools UI lists `surface_observe`, and, for an auto surface, `surface_read` and `surface_wait` — the host actually delivered them to the agent.

If step 1 fails, choose a compatible browser host. If step 2 fails, fix the reported registration errors. If step 3 fails while step 2 says ready, the browser host did not make the registered tools available to that task; changing tool descriptions or prompting the model cannot repair that transport boundary.

Use a fresh agent conversation for a clean acceptance test after installing or updating the page integration. A previous conversation may retain its earlier diagnosis and fallback plan. Also inspect project-local agent configuration: a leftover MCP server for the same application is a separate transport and can cause a nested CLI agent to choose that server even when browser-native Surface is installed.

## What is never registered

- **A sensitive field.** The person types it; no tool can fill it, and no tool text or result carries its value.
- **The ledger.** Acted-on text may be in it under the `keep` policy. `expose` still publishes it for browser-driving agents in the page.
- **A collection with nothing to load.**
- **Anything outside the page.** WebMCP tools run in the page with the user's own session, like `expose`. They add no reader the page did not have and are not a way to reach the surface from a server.

## Granularity

By default each control is its own tool, and its description carries the control's live state. That reads well on a small page, but the list grows with the page (27 tools on the reference plan page; a grid of 50 products by 12 months would be over 600), and every change of state re-registers the tools it touched.

`granularity: "domain"` registers a fixed set instead: the observe tool, read and wait on an auto surface, and one tool per domain action, the same names the relay serves.

```ts
exposeWebMcp(surface, { granularity: "domain" });
// <SurfaceProvider webMcp={{ granularity: "domain" }}>
```

| Tool                  | Acts on                                                                                                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `surface_set-field`   | a field: `{ entryId, text }`                                                                                                                                                            |
| `surface_navigate`    | on an auto surface, first: a link or landmark within the site, or a same-origin path as `text` on the navigate entry. Low risk, so a navigation is not mistaken for a consequential act |
| `surface_run-control` | an action (a button, a switch): `{ entryId, confirm? }`                                                                                                                                 |
| `surface_load-more`   | a collection that can load more: `{ entryId }`                                                                                                                                          |

Each takes `expectedRev` too. The agent finds ids with `surface_observe`, which filters (`query`, `kind`, `object`, `available`) and pages (`limit`, `cursor`) and names the tool for each row. A call with an id another tool acts on is refused with that tool's name. Pass your own `domains` (the specs of `domainActions`) to name groups the application would name, such as a `set-demand` for a month's forecast.

On the reference plan page, driven headless through the bridge, the forecast edit and save took 4 tools instead of 27 and sent no tool-list change instead of 10, with the same result on the server.

## Acting

A tool call is `surface.act` with the entry's id and op. With `expectedRev`, a page that changed since the agent observed it refuses the act as `conflict` and nothing runs. Without it, the act uses the page's revision at the moment of the call: the agent acts on the page as it is, and the surface's availability and confirmation checks still apply. The tool returns the act's envelope as structured content, one line of text (`Done: Lock March. The page is now at rev 3.`, or why not and what to do), and `isError` when the act was refused.

Every change the surface reports through `subscribe` re-derives the tools. A tool is registered again only when its name, description, schema, or annotations changed, so a revision bump alone costs nothing, and a control that became unavailable is re-registered with its reason (or dropped, with `unavailable: "omit"`).

### Trusted approval

`consequentialHint` is metadata, not an enforcement boundary. The adapter therefore refuses a high-risk action, an action with `confirm`, or an `approval_required` control unless `requestApproval` is configured. When the callback approves an auto-derived gate, the adapter opens that one gate and immediately makes the exact revision-bound act. It records the person's decision before the act in the page's ledger.

```ts
const webmcp = exposeWebMcp(surface, {
  requestApproval: async ({ entry, act }) => {
    // `showApprovalDialog` must resolve only from the person's click.
    const approved = await showApprovalDialog({
      title: entry.name,
      risk: entry.effect?.risk,
      expectedRev: act.expectedRev,
    });
    return { approved, actor: currentMemberName };
  },
});
```

Do not implement this callback with a DOM control included in the surface, a WebMCP tool, a message supplied by the agent, or an automatically accepted browser event.

## Where there is no WebMCP

Nothing is registered, `supported` is false, and the page works as before. The other ways in stay available:

- **Browser-driving agents** read and operate the ordinary page, or use `window.__surface` when their browser channel has JavaScript/CDP access and the application called `surface.expose(window)` ([S-DOM-2](../spec/SURFACE.md#7-browser-agents)). Generic browser clicks are not Surface calls.
- **Server-side agents** reach the same controls through the AXE bridge (`surfaceActions` from `@summationai/axe-surface/axe`, see [Surface](surface.md)) and, for MCP hosts, `@summationai/axe-mcp` ([MCP](mcp.md)), with the authorization rules those need.

An application that exposes its browser surface from one module with `expose(window)`, as the reference application under `examples/` is built to, adds the WebMCP adapter on the next line, as in the example above.

## Headless bridge (experimental)

WebMCP tools exist only in a loaded page, for the agent built into that browser: the explainer lists "fully autonomous workflows" without a browser UI as a non-goal. A desktop agent such as Claude Desktop has no browser of its own, so it cannot reach them directly. `axe host --dev --webmcp --stdio` gives it one: it opens the application in headless Chromium with WebMCP enabled, follows the page's tools through the DevTools protocol's WebMCP domain (the events for tools added and removed, and the command that invokes one), and serves them over MCP on stdio.

```sh
axe host login http://localhost:3000
claude mcp add plan -- npx @summationai/axe host --dev --webmcp --stdio --app http://localhost:3000 --start /plan
```

The page needs no relay connection and no host-specific code: `<SurfaceProvider webMcp>`, `exposeWebMcp`, or any `document.modelContext.registerTool` is the whole integration, and the same registration serves Chrome's built-in agent and ChatGPT's in-app browser. A high-risk control still needs the person: the bridge asks them in the agent's MCP client when it can show a form (elicitation), and otherwise opens a single-use approval page in the person's browser and tells the agent to call again after they decide; see [Approval in a headless page](#approval-in-a-headless-page). The bridge refuses navigations off the application's origin, reports a call whose page navigated or reloaded underneath it as outcome unknown, sends `tools/list_changed` as the page's tools change, and returns each answer only once the tools the call changed are registered again. It needs Chromium 150 or newer (the one Playwright installs qualifies).

Tried on 2026-09-29 against the reference application (`examples/plan-review`, which offers its page surface through `exposeWebMcp` in `app/SurfaceHost.tsx`), headless, signed in as bob at Acme, from a scripted MCP client over stdio:

| Step                                             | Bridge                                                | Relay path (review of 2026-09-25)   |
| ------------------------------------------------ | ----------------------------------------------------- | ----------------------------------- |
| Start: first `tools/list`, including the browser | 350 ms warm, 1.8 s cold                               | `relay_tabs` 296 ms, once listening |
| Observe                                          | 2 to 3 ms                                             | 3 to 12 ms                          |
| Type a forecast                                  | 73 ms, including the wait for the tool list to settle | `surface_set-field` 69 ms           |
| Save                                             | 22 ms, and the server's plan shows the value          | `surface_run-control` 67 ms         |

### Hints

The DevTools domain reports only a tool's read-only, untrusted-content, and autosubmit hints, so the bridge reads the rest where the page states them: it wraps `registerTool` before any page script runs and records each tool's title and hints from the registration itself. It then gives the agent MCP's hints:

| The page says | The agent gets |
| --- | --- |
| `readOnlyHint: true` | `readOnlyHint: true` |
| `consequentialHint: true` | `destructiveHint: true` |
| `consequentialHint: false` | `destructiveHint: false` |
| `idempotentHint` | `idempotentHint` |
| `title` | `title` |

MCP reads a tool that states nothing as destructive, so the adapter states `consequentialHint` both ways: `surface_navigate` and a reversible control arrive as not destructive, and an agent has no reason to ask the person before following a link. A hint a page does not state is left unstated, never guessed.

### Approval in a headless page

A headless page has no one to see the application's `requestApproval` UI. The bridge therefore installs a host approver before any page script runs (`INJECTED_APPROVER_GLOBAL`, a function page code cannot replace), and `exposeWebMcp` asks it instead of the page's UI ([S-WEB-6](../spec/SURFACE.md#8-webmcp-the-browsers-own-agent)). The bridge asks the person:

1. In the agent's own MCP client, when the client declares form elicitation: "Approve “Delete everything” on the board? It changes state, risk high." The answer is recorded in the page's ledger with who gave it, and the act runs or not within the same tool call.
2. Otherwise on a single-use approval page on loopback, opened in the person's browser (and written to the bridge's log). The tool call returns `approval_pending` and nothing runs; after the person decides, the agent's next call of the same tool uses that decision, once, for that control at that revision.

The approval link never appears in anything the agent receives. It is a credential for one decision, and an agent that can reach loopback could otherwise open it and press Approve itself. Tool calls on the page run one at a time, so a question always belongs to exactly one call, and the time the person takes does not count against the call's timeout.

What the bridge does not do yet, in the order it matters:

- **Identities and production.** The bridge runs one page for one development identity. The per-identity sessions, `sessionFor`, request rules, human sign-in handoff, and OAuth of `createHost` ([Host](host.md)) would move over by making the bridge an alternative to the relay inside `createHost`.
- **Stability.** WebMCP is behind `--enable-features=WebMCP` and its DevTools domain is experimental; both can change with Chromium.

## Bundle

`@summationai/axe-surface/webmcp` remains a separate entry for framework-free use. `SurfaceProvider` imports the small adapter so its `webMcp` prop works without another application dependency; ordinary hooks from `@summationai/axe-surface/react` still tree-shake it when the provider is not used.

## Next steps

- [Surface](surface.md): registering controls, availability, and the revision.
- [MCP](mcp.md): the server-side counterpart, with elicitation and the Apps view.
- [spec/SURFACE.md §8](../spec/SURFACE.md#8-webmcp-the-browsers-own-agent): the rules, [S-WEB-1] to [S-WEB-5].
