# Easy mode: derive, then refine

A [Surface](surface.md) is exact when every control registers itself, and that takes work in every component. Easy mode starts from the other end. `@axe/surface/auto` reads what your page already tells screen readers (roles, accessible names, disabled states and their descriptions, values, the dialogs and headings controls sit in) and registers an entry for each control. An agent then observes the page as a table with reasons and one revision, and acts through the same events a person's click or typing causes.

Installation alone should get you most of a good surface. What the page cannot say (a better name, what a button really changes, that a field is private, that a control needs the person's approval) goes in a configuration you review in a diff. What must be exact (a write that checks the revision on the server) you declare. The contract is `spec/SURFACE.md` §10.

## Start

<!-- include: examples/auto/start.ts#start -->
<!-- /include -->

`autoSurface` scans the document body (or the `root` you pass), registers the entries on a new surface (or the `surface` you pass), and re-scans whenever the page changes. `expose: true` publishes `window.__surface` for browser-driving agents, with `coverage()` beside `observe`, `act`, and `ledger`. In React, put the provider near the root:

<!-- include: examples/auto/provider.ts#provider -->
<!-- /include -->

`SurfaceProvider` (or `useAutoSurface`) starts the scan in an effect on mount, so a server render derives nothing and nothing touches `document` at import. It registers on the module-level `surface` that `useSurface` uses, so declared and derived entries share one table. It re-scans after pushState, replaceState, and `popstate`; pass your router's location as `location` to re-scan on its changes too. `flag` is a feature flag: false starts nothing. `useAutoSurfaceHandle` returns the running handle. React 18 and 19 are both tested.

The handle's surface is an ordinary surface:

<!-- include: examples/auto/start.ts#act -->
<!-- /include -->

## The three tiers

Every entry says where it came from, in `source` on its observe row (declared entries carry none).

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

## Safety defaults

Every derived action gets a risk from its role, words, styling, and surroundings, and the default policy asks the person before anything high risk.

- **Low:** tabs, options, disclosures, menu triggers, links within the site, checkboxes and radios inside a form, row selection, and names that start with a view word (open, show, filter, sort, search, close, cancel, next, export).
- **Medium:** submit buttons and names that start with a commit word (save, create, update, add, assign, rename), switches and checkboxes outside a form, links that leave the site.
- **High:** destructive words anywhere in the name (delete, remove, archive, revoke, disconnect, cancel subscription, reset, purge, overwrite, send, publish, pay, purchase, invite, transfer, share, sign out, and more), destructive styling (a `danger` or `destructive` class, `data-variant="destructive"`, a red button), a control that opens an `alertdialog`, the affirmative button of a confirmation dialog, and anything the heuristics do not recognize.

Word lists are English and live in `lexicon`, where you can extend or replace them. The policy decides per level: `allow`, `approve`, or `deny`, with `approve` for high by default. An entry that needs approval is unavailable with a reason ("needs the person's approval (name matches “delete”)") and a handoff whose `reason` is `approval_required` and whose sentence tells the agent what to ask. The person approves one control, for one act, from your own page:

<!-- include: examples/auto/approve.ts#approve -->
<!-- /include -->

Coverage lists every high-risk entry and every control the heuristics did not recognize, with a rule to paste for each, so lowering a risk is a reviewed change.

## Configuration

A `SurfaceConfig` is a plain object: keep it in a JSON or TypeScript file and review it like code.

<!-- include: examples/auto/config.ts#config -->
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

At the top level: `app`, `routes` (`include` and `exclude` globs), `lexicon`, `policy`, `groups`, `sensitive` and `exclude` selectors, `declare` (entries registered as they are), `landmarks`, and `navigate` (how the navigate entry opens a path: your router's function, `link`, `history`, or `location`). `checkConfig` returns a configuration's problems as sentences; `handle.configure(next)` swaps it in and re-scans, so you can iterate with the page open.

A rule's handler is how a derived control becomes declared without touching the component:

<!-- include: examples/auto/handler.ts#handler -->
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

The gaps it reports: unnamed and icon-only controls, weak names, duplicate names, likely duplicates of declared entries, clickable elements with no role, canvas and SVG charts (naming Highcharts, SpreadJS, Recharts, and others when it can tell), cross-origin frames, virtualized grids (only the rendered rows are on the surface), file inputs, closed shadow roots, and controls whose effect was not recognized. Coverage is not a score. Each gap is the next edit to the page or to the configuration.

## Tools for agents

A page with three hundred controls would be three hundred tools if each were its own action. A derived surface is served as a fixed set instead:

<!-- include: examples/auto/serve.ts#serve -->
<!-- /include -->

`autoActions` is `domainActions` over `autoDomains()`: one action per configured group, then `navigate` (follow a link within the site, bring a landmark into view, or open a same-origin path given as text), `set-field`, `run-control`, and `load-more`, beside `surface.observe` and `surface.ledger`. The tool list is the same size on every page. Declared entries can still be served one action per control through `surfaceActions`. Which transport carries the tools (an in-page relay to MCP, WebMCP, or `window.__surface`) is separate: the surface lives in the page ([S-MODE-1]).

## What is not derived

The scan cannot see a click handler on an element with no role (it reports one when it finds a React or Vue handler, an `onclick`, or a `tabindex`, and a rule with `selector` and `role` brings it in), anything drawn on a canvas, a chart without an accessible name or data, a cross-origin frame, rows a virtualized list has not rendered, a closed shadow root, and CSS generated content. The name computation stops short of the full algorithm for embedded controls inside labels and for generated content. Word lists are English. Coverage names each gap it can detect.

## Next

- [Surface](surface.md): the registry, revisions, the ledger, and declared entries.
- [WebMCP](webmcp.md): the same surface offered to the browser's own agent.
- `spec/SURFACE.md` §10: the rules, [S-AUTO-1] to [S-AUTO-13] and [S-CFG-1] to [S-CFG-8].
