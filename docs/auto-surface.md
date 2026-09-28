# Easy mode: derive, then refine

A [Surface](surface.md) is exact when every control registers itself, and that takes work in every component. Easy mode starts from the other end. `@axe/surface/auto` reads what your page already tells screen readers (roles, accessible names, disabled states and their descriptions, values, the dialogs and headings controls sit in) and registers an entry for each control. An agent then observes the page as a table with reasons and one revision, and acts through the same events a person's click or typing causes.

Installation alone should get you most of a good surface. What the page cannot say (a better name, what a button really changes, that a field is private, that a control needs the person's approval) goes in a configuration you review in a diff. What must be exact (a write that checks the revision on the server) you declare. The contract is `spec/SURFACE.md` §10.

## Start

<!-- include: examples/auto/start.ts#start -->
```ts
import { autoSurface, formatCoverage } from "@axe/surface/auto";

export const handle = autoSurface({ expose: true });

// What was derived, how sure each name is, and what the page could not say.
console.log(formatCoverage(handle.coverage()));
```
<!-- /include -->

`autoSurface` scans the document body (or the `root` you pass), registers the entries on a new surface (or the `surface` you pass), and re-scans whenever the page changes. `expose: true` publishes `window.__surface` for browser-driving agents, with `coverage()` beside `observe`, `act`, and `ledger`. In React, put the provider near the root:

<!-- include: examples/auto/provider.ts#provider -->
```ts
import { createElement } from "react";
import type { ReactNode } from "react";
import { SurfaceProvider } from "@axe/surface/react";
import { surfaceConfig } from "./config";

export function AgentReady({ children, on }: { children: ReactNode; on: boolean }) {
  return createElement(
    SurfaceProvider,
    { config: surfaceConfig, flag: on, expose: true },
    children,
  );
}
```
<!-- /include -->

`SurfaceProvider` (or `useAutoSurface`) starts the scan in an effect on mount, so a server render derives nothing and nothing touches `document` at import. It registers on the module-level `surface` that `useSurface` uses, so declared and derived entries share one table. It re-scans after pushState, replaceState, and `popstate`; pass your router's location as `location` to re-scan on its changes too. `flag` is a feature flag: false starts nothing. `useAutoSurfaceHandle` returns the running handle. React 18 and 19 are both tested.

The handle's surface is an ordinary surface:

<!-- include: examples/auto/start.ts#act -->
```ts
// The handle's surface is an ordinary surface: observe, act, ledger.
export async function saveProfile(): Promise<void> {
  const { surface } = handle;
  const view = surface.observe();
  const save = view.entries.find((row) => row.name === "Save profile");
  if (!save) return;
  const result = await surface.act({ op: "CLICK", target: save.id, expectedRev: view.rev });
  if (result.status === "ok")
    console.log("changed", result.output.changed, "said", result.output.notices);
  else console.log(result.error.code, result.error.message);
}
```
<!-- /include -->

## The three tiers

Every entry says which tier it is in, in `tier` on its observe row (declared entries carry none). This is separate from a ledger entry's `source`, which says whether `act`, the application (`record`), or the server wrote it.

| Tier      | Comes from                                                        | An act runs                             | You can rely on                                                                                 |
| --------- | ----------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| derived   | the page's accessibility semantics                                | the events a person's input causes      | the outcome a person would get from that control at that moment; names and risks are heuristics |
| annotated | derived, refined by a configuration rule or `data-surface-*`      | the same events                         | as derived, with names, reasons, and effects someone reviewed                                    |
| declared  | `register`, `useSurface`, `declare`, or a rule's `handler`        | your application's function             | everything the Surface contract states, including a server-side conditional write               |

A derived act cannot put the revision into your server's write, because a click has nowhere to carry it. The surface still refuses an act whose revision is stale, since it re-reads the page before every act, but a write that must check the server's state belongs in the declared tier.

## What is derived

- **Entries.** Buttons, links, `summary`, menu items, tabs, switches, checkboxes, radios, options, tree items, and list triggers become actions. Inputs, selects, textareas, and contenteditable editors become fields. Grids, tables, listboxes, trees, and scrolling lists become collections. Landmarks become places `navigate` can go. Hidden controls are left out; controls behind an open modal are listed as unavailable, with the dialog named.
- **Names.** The accessible name, in the order a browser computes it: `aria-labelledby`, `aria-label`, the label, text content, `title`, then `placeholder`. When the page gives none, a weaker guess: text just before a field, a rich-text editor's `data-placeholder`, an icon's class (`lucide-trash-2` reads as "trash"), a link's last path segment. Each name records where it came from (`nameFrom` in coverage) and how confident it is.
- **Availability and reasons.** `disabled`, `aria-disabled`, `readonly`, `inert`, `aria-busy`, and a modal in front are unavailable. The reason is the page's own when it has one: `data-surface-reason`, `aria-describedby` or `aria-errormessage` (an empty one counts as none), a `title` on the control or its tooltip wrapper, or the errors of the form a submit button belongs to ("Email: Enter a work email"). Otherwise "disabled in the page".
- **Values.** A field's value, a select's chosen label, a checkbox's `{ checked }`, a toggle's `{ pressed }`, a tab's `{ selected }`, a disclosure's `{ expanded }`. Never a password, a card field, or a one-time code: those are sensitive, carry no value, and are read only to agents.
- **Keys.** An entry's id is `<route>#<containers>/<role>:<name>`, for example `/settings#main/section:danger-zone/button:delete-project`. The route replaces numeric and UUID segments with `:id`; the containers are landmarks, dialogs, menus, named regions, a table row's label, and the nearest heading. Keys survive re-renders and most DOM restructuring. They change when the visible name changes (a count in a label, another language), when the row label or heading changes, or when a new landmark wraps the control; two controls with the same key get `~2`, `~3`, which shifts when one is inserted before another. Put `data-surface-id` on the element, or an `id` in a rule, wherever a key must never move.
- **Acting.** A click is `pointerdown`, `mousedown`, focus, `pointerup`, `mouseup`, and `click()`, so menus that open on pointer down open. Typing sets the value through the element's native setter and fires `input` and `change`, so React's `onChange` runs. A select takes a label or a value. A rich-text editor gets `beforeinput` and an insertText edit. A list loads more through its "Load more" button or by scrolling. After acting, the surface waits for the page to settle, re-scans, and reports what changed and any text that appeared in a toast or status line as `notices`.
- **Staleness.** Every DOM change that alters an entry moves the revision; one that alters nothing does not. An act presenting an old revision is refused as `conflict`.


A subtree marked `data-surface-ignore` is never read: put it on your own agent UI (a chat panel, a debug drawer) so an agent does not drive the tools meant for driving it. The relay's in-page indicator carries it, and the scan skips the indicator whether or not it is marked, so an agent can never press the person's Stop, Approve, or Deny.
## Safety defaults

Every derived action gets a risk from its role, words, styling, and surroundings, and the default policy asks the person before anything high risk.

- **Low:** tabs, options, disclosures, menu triggers, links within the site, router buttons inside a `nav`/`role="navigation"` landmark, controls explicitly marked `data-surface-navigation`, checkboxes and radios inside a form, row selection, and names that start with a view word (open, show, filter, sort, search, close, cancel, next, export). Use the marker on the exact custom button that only changes location, not on an ancestor containing other controls. Destructive wording or styling still wins.
- **Medium:** submit buttons and names that start with a commit word (save, create, update, add, assign, rename), switches and checkboxes outside a form, links that leave the site.
- **High:** destructive words anywhere in the name (delete, remove, archive, revoke, disconnect, cancel subscription, reset, purge, overwrite, send, publish, pay, purchase, invite, transfer, share, sign out, and more), destructive styling (a `danger` or `destructive` class, `data-variant="destructive"`, a red button), a control that opens an `alertdialog`, the affirmative button of a confirmation dialog, and anything the heuristics do not recognize.

Word lists are English and live in `lexicon`, where you can extend or replace them. The policy decides per level: `allow`, `approve`, or `deny`, with `approve` for high by default. An entry that needs approval is unavailable with a reason ("needs the person's approval (name matches “delete”)") and a handoff whose `reason` is `approval_required` and whose sentence tells the agent what to ask. The person approves one control, for one act, from your own page:

<!-- include: examples/auto/approve.ts#approve -->
```ts
import { handle } from "./start";

// Wire this to a button the person clicks in your own approval prompt: never to anything an
// agent can call.
export function onPersonApproved(entryId: string): void {
  handle.approve(entryId, { uses: 1, ttlMs: 2 * 60_000 });
}
```
<!-- /include -->

Coverage lists every high-risk entry and every control the heuristics did not recognize, with a rule to paste for each, so lowering a risk is a reviewed change.

## Configuration

A `SurfaceConfig` is a plain object: keep it in a JSON or TypeScript file and review it like code.

<!-- include: examples/auto/config.ts#config -->
```ts
import type { SurfaceConfig } from "@axe/surface/auto";

export const surfaceConfig: SurfaceConfig = {
  app: "Acme back office",
  routes: { exclude: ["/admin/**"] },
  policy: { high: "approve" },
  groups: {
    refunds: {
      title: "Refund an order",
      description: "Refunds one order to the card it was paid with.",
      risk: "high",
    },
  },
  rules: [
    // Say what an icon-only button does.
    { match: { selector: "button.row-menu" }, name: "Open the order's actions" },
    // A button the heuristics did not recognize: say what it changes and how risky it is.
    {
      match: { route: "/orders/:id", role: "button", name: "Recalculate" },
      name: "Recalculate the order's totals",
      effect: { mutates: "order", risk: "low", reversible: true },
    },
    // The page gives no reason when Ship is disabled; the application's words do.
    { match: { name: "Ship" }, reason: "an order ships once it is paid and packed" },
    // Fold every refund button into one domain action.
    { match: { name: "/^refund/i" }, group: "refunds" },
    // A private field, and a developer toolbar agents never see.
    { match: { name: "Tax ID" }, sensitive: true },
    { match: { selector: "#dev-toolbar *" }, hide: true },
  ],
};
```
<!-- /include -->

**Matching.** A rule's `match` holds when every member given holds: `key` (exact, or a glob), `id` (the element's `data-surface-id`), `selector` (CSS), `route` (a glob such as `/orders/:id` or `/admin/**`), `role`, and `name` (case-insensitive, or `/regex/flags`). Every matching rule applies in order; later fields win.

**What a rule can say.**

| Field               | Effect                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| `name`, `object`    | What the control does, in your words, and what it belongs to.                                     |
| `id`                | Pin the entry id.                                                                                 |
| `role`              | With `selector`, bring in a clickable element that has no role.                                   |
| `reason`, `state`   | The reason to report when the control is unavailable; force `available` or `unavailable`.        |
| `effect`            | `mutates`, `risk`, `reversible`, `idempotent`, `confirm`, `text`, merged over the derived effect. |
| `sensitive`, `editable` | Make a field private; let an agent type into a private field.                                 |
| `hide`              | Leave the control out.                                                                            |
| `approval`          | Require the person's approval (true) or never (false), whatever the risk.                        |
| `group`             | Fold the control into a domain action declared under `groups`.                                    |
| `handler`           | Run your application's function instead of the page's events: the declared tier.                  |

At the top level: `app`, `routes` (`include` and `exclude` globs), `lexicon`, `policy`, `groups`, `sensitive` and `exclude` selectors, `read` (regions and exclusions for reading the page), `declare` (entries registered as they are), `landmarks`, and `navigate` (how the navigate entry opens a path: your router's function, `link`, `history`, or `location`). `checkConfig` returns a configuration's problems as sentences; `handle.configure(next)` swaps it in and re-scans, so you can iterate with the page open.

A rule's handler is how a derived control becomes declared without touching the component:

<!-- include: examples/auto/handler.ts#handler -->
```ts
import { SurfaceConflict } from "@axe/surface";
import type { SurfaceConfig } from "@axe/surface/auto";

declare function archiveOrder(
  id: string,
  expectedRev: number,
): Promise<{ ok: boolean; rev: number }>;

export const withHandler: SurfaceConfig = {
  rules: [
    {
      match: { route: "/orders/:id", name: "Archive order" },
      effect: { mutates: "order", risk: "medium", reversible: true },
      approval: false,
      handler: async ({ element, expectedRev }) => {
        const id = element?.closest("[data-order-id]")?.getAttribute("data-order-id");
        if (!id) throw new SurfaceConflict("The order is no longer on the page.");
        const result = await archiveOrder(id, expectedRev);
        if (!result.ok) throw new SurfaceConflict(undefined, { currentRev: result.rev });
        return { notices: ["Order archived"] };
      },
    },
  ],
};
```
<!-- /include -->

## Coverage

`handle.coverage()` describes the page as it stands: counts by kind, tier, and name confidence; each entry with its key, `nameFrom`, confidence, risk and why, policy, and a selector; the entries waiting on approval; the configuration rules that matched nothing (`staleConfig`: `stale` on their own route, `unmatched` anywhere so far); and the gaps, each with the markup fix and a rule to paste. `formatCoverage` renders it as Markdown. An excerpt from the reference application's plan page:

```md
# Surface coverage: /plan

30 entries at rev 1: 11 actions, 18 fields, 1 collections. Derived 10, annotated 20, declared 0.
Names: 27 high confidence, 3 medium, 0 low. 6 unavailable now; 3 need the person's approval; 1 gaps.

## Needs the person (3)

| Entry | Risk | Policy | Why |
| --- | --- | --- | --- |
| Sign out (`/plan#main/navigation/button:sign-out`) | high | approve | name matches “sign out” |
| Approve and lock (`/plan#main/section:fy27-h1-demand/button:approve-and-lock`) | high | approve | name matches “approve” |
| Freeze (pause agents, cancel their requests) (`/plan#main/section:fy27-h1-demand/button:freeze-pause-agents-cancel-their-request`) | high | approve | not recognized; treated as a high-risk change until configured |
```

The gaps it reports: unnamed and icon-only controls, weak names, duplicate names, likely duplicates of declared entries, clickable elements with no role, canvas and SVG charts (naming Highcharts, SpreadJS, Recharts, and others when it can tell), cross-origin frames, virtualized grids (only the rendered rows are on the surface), file inputs, closed shadow roots, and controls whose effect was not recognized. Under "Content an agent cannot read" it lists what `read` reports by title only: charts and canvases drawn as graphics, closed shadow roots, and cross-origin frames (`unreadable` in the report). Coverage is not a score. Each gap is the next edit to the page or to the configuration.

## Reading the page

Controls are half of what a page says. The other half is its content: the project's status, the owner and due date beside it, a table of tasks, the report a button just generated. `handle.read()` returns that content, as the page shows it to the person:

<!-- include: examples/auto/read.ts#read -->
```ts
import { formatRead } from "@axe/surface/auto";

// The whole page, as sections by heading: text, fields, tables, lists.
const page = handle.read();
const status = page.sections.find((s) => s.heading === "Project status");
console.log(status?.fields); // [{ label: "Status", value: "At risk" }, { label: "Owner", ... }]

// One region, filtered, bounded; the cursor continues where a page of the result stopped.
const tasks = handle.read({ region: "Open tasks", query: "overdue", maxRows: 20 });
if (tasks.nextCursor) handle.read({ region: "Open tasks", cursor: tasks.nextCursor });

// Markdown for an agent or a terminal.
console.log(formatRead(page));
```
<!-- /include -->

A read is `{ route, path, title, rev, sections, notices, truncated, nextCursor, redacted }`, and each section is `{ heading, level, text, fields, tables, lists, opaque }`. An excerpt of `formatRead` on a project page of the first target application, which has no landmarks, a status card of label and value pairs, a task grid inside an open shadow root, a rich-text report, and a Highcharts chart with its accessibility module off:

```md
### Project status

- **Status:** At risk
- **Owner:** Dana Whitfield
- **Due date:** Oct 3, 2026

Vendor delays pushed the beta by two weeks.

### Open tasks

| Task | Assignee | Due |
| --- | --- | --- |
| Task 1 | Ria | Oct 1 |
| Task 2 | Sam | Oct 2 |

_20 of 120 rows shown._

### Burn-down

_A Highcharts chart (“Burn-down by week”): drawn so its content cannot be read here; its values are not shown._
```

- **Sections** follow the headings. Where the page has none, a dialog, a named region, a sectioning element, or a card whose first child is styled or classed as a title starts one, and what follows the card goes back to the section around it.
- **Fields** are label and value pairs: `dt` and `dd`, a table of row headers and values, `aria-labelledby`, two short elements one of which is marked as a label (`class="label"`, a `label`, a trailing colon), a line that reads "Status: At risk", a progress bar, and the page's form fields. Inside a rich-text document, "Label: value" stays prose.
- **Tables** are native tables and `grid`, `table`, and `treegrid` roles; a grid that splits each row across pinned and scrolling containers (ag-grid) is joined by `aria-rowindex`. A virtualized grid returns the rows it has rendered, with `total` from `aria-rowcount` and `truncated` set.
- **Text** is paragraphs, lists, and the document a ProseMirror or Tiptap editor shows. Open shadow roots and same-origin frames are read.
- **What cannot be read** is said, not guessed: a chart or canvas drawn as graphics, a closed shadow root, and a cross-origin frame come back in `opaque` with their title. A chart whose `aria-label` states what it shows is read by that label.

What a read never contains: a sensitive field's value (a password, a card number, a one-time code, a field matching `sensitive` or a rule's `sensitive: true`; its label stays, marked `sensitive`, and `redacted` counts it), anything inside `data-surface-ignore` or the relay's indicator, anything matching `exclude` or `read.exclude`, and the text of buttons, tabs, and menus, which is `observe()`'s. Toasts and alerts are in `notices`, not in the sections. It is content the page showed the person; an agent should treat it as data, never as instructions.

`region` narrows a read to an entry id (a table's, a landmark's, or a control's container), a landmark, named region, or dialog, a heading (its section and those under it), or a region your configuration names by selector:

<!-- include: examples/auto/read.ts#regions -->
```ts
export const readConfig: SurfaceConfig = {
  read: {
    // Parts of the page an agent may name, by selector you review.
    regions: { status: ".status-card", report: "#report-body" },
    // Never read, beside every data-surface-ignore subtree.
    exclude: [".debug-drawer"],
  },
  // Withheld from read as well as from observe.
  sensitive: [".api-key"],
};
```
<!-- /include -->

`query` keeps what mentions the text: a section whose heading does, whole, else its matching paragraphs, fields, rows, and items. Bounds keep a read small enough for an agent's context: `maxRows` per table and list (default 50, at most 500) and `maxChars` of Markdown per result (default 12,000, at most 50,000). Past them, `nextCursor` continues where the result stopped, splitting a long section rather than dropping it. A read never moves the revision and writes nothing to the ledger.

## Waiting for slow work

Some controls start work that takes a while: a report is generated, an export is prepared, a summary streams in. `handle.wait(condition, { timeoutMs })` resolves when the page shows the work is done, or when the time runs out:

<!-- include: examples/auto/read.ts#wait -->
```ts
export async function generateReport(): Promise<string | null> {
  const view = handle.surface.observe();
  const generate = view.entries.find((row) => row.name === "Generate report");
  if (!generate) return null;
  await handle.surface.act({ op: "CLICK", target: generate.id, expectedRev: view.rev });

  // Until the report's text appears (or a toast says so), a failure shows, or 90 s pass.
  const done = await handle.wait(
    { any: [{ text: "Report ready" }, { text: "/failed|error/i" }] },
    { timeoutMs: 90_000 },
  );
  if (!done.met) return null;
  // A streamed report: wait until the page has been quiet for a second, then read it.
  await handle.wait({ idle: 1000 }, { timeoutMs: 30_000 });
  return formatRead(handle.read({ region: "report" }));
}
```
<!-- /include -->

| Condition                    | Holds when                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| `{ text }`                   | the text is shown on the page, or appeared in a toast while waiting                 |
| `{ gone }`                   | the text is no longer shown                                                         |
| `{ entry, available? }`      | the entry is on the page (and available, or not)                                    |
| `{ revMoved: rev }`          | the revision is no longer `rev`                                                     |
| `{ idle: ms }`               | the page has had no DOM change for `ms` (a streamed report has finished)            |
| `{ route: glob }`            | the route or the path matches                                                       |
| `{ any: [...] }`, `{ all: [...] }` | one of, or every one of, the nested conditions holds                          |

Members of one condition must all hold. A text matches case-insensitively as a substring, or as a regular expression written `/pattern/flags`. The result is `{ met, elapsedMs, rev, fromRev, reason, changed, notices }`: `reason` says what held (or what did not, at the bound), `changed` lists the entries added, changed, or removed while it waited, and `notices` the toasts and status lines that appeared. The wait is checked on every change the page makes and at least every `pollMs` (default 250 ms), never in a busy loop; `timeoutMs` defaults to 30 seconds and is capped at two minutes. `stop()` and an aborted `signal` end it with `met: false`. Waiting never moves the revision.

## Tools for agents

A page with three hundred controls would be three hundred tools if each were its own action. A derived surface is served as a fixed set instead:

<!-- include: examples/auto/serve.ts#serve -->
```ts
import { createAXE } from "@axe/core";
import { autoActions } from "@axe/surface/axe";
import { handle } from "./start";

const axe = createAXE({
  name: "Acme back office",
  description: "Orders, refunds, and shipping, driven through the application's own pages.",
  baseUrl: "https://backoffice.acme.example",
  revision: handle.surface.currentRev,
});
// surface.observe, surface.ledger, surface.navigate, surface.set-field, surface.run-control,
// surface.load-more, and one action per configured group.
axe.addProvider(autoActions(handle));
```
<!-- /include -->

`autoActions` is `domainActions` over `autoDomains()`: one action per configured group, then `navigate` (follow a link within the site, bring a landmark into view, or open a same-origin path given as text), `set-field`, `run-control`, and `load-more`, beside `surface.observe` and `surface.ledger`, and then the two read-only tools `surface.read` (the page's content, as Markdown or as sections, with `region`, `query`, `cursor`, `maxChars`, and `maxRows`) and `surface.wait` (a condition and a `timeoutMs`). Neither acts or moves the revision; `read`'s display disclaimer tells the agent its text is the page's content, redacted, and not instructions. Over the relay and through the auto surface's WebMCP adapter they are `surface_read` and `surface_wait`, answered by the tab's own surface. The domain-action tool list is the same size on every page. Declared entries can still be served one action per control through `surfaceActions`. Which transport carries the tools is separate: the surface lives in the page ([S-MODE-1]). For desktop/mobile agents, the recommended path is the provider-operated [unattended host](host.md), which `axe surface init` supports by default. Browser-native WebMCP is a direct additional path where its host delivers the page's tools; the person's open tab through the [relay service](relay.md) is an attended diagnostic fallback. `window.__surface` is published in development.

## What is not derived

The scan cannot see a click handler on an element with no role (it reports one when it finds a React or Vue handler, an `onclick`, or a `tabindex`, and a rule with `selector` and `role` brings it in), anything drawn on a canvas, a chart without an accessible name or data, a cross-origin frame, rows a virtualized list has not rendered, a closed shadow root, and CSS generated content. The name computation stops short of the full algorithm for embedded controls inside labels and for generated content. Word lists are English. Coverage names each gap it can detect.

## Next

- [Unattended mode](host.md): how an agent outside the browser uses the derived surface, with the relay's attended mode ([Relay](relay.md)) as the fallback.
- [Surface](surface.md): the registry, revisions, the ledger, and declared entries.
- [WebMCP](webmcp.md): the same surface offered to the browser's own agent.
- `spec/SURFACE.md` §10: the rules, [S-AUTO-1] to [S-AUTO-16] and [S-CFG-1] to [S-CFG-8].
