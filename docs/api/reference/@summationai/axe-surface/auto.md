[AXE API reference](../../README.md) / [@summationai/axe-surface](README.md) / auto

# auto

## Interfaces

<a id="autodomainsoptions"></a>

### AutoDomainsOptions

#### Properties

<a id="content"></a>

##### content?

```ts
optional content?: boolean;
```

Publish `read` and `wait` (the page's content, and waiting for slow work). Default true.

<a id="fieldrisk"></a>

##### fieldRisk?

```ts
optional fieldRisk?: "low" | "medium" | "high";
```

Risk declared for `set-field`. Default `medium`.

<a id="groups"></a>

##### groups?

```ts
optional groups?: Record<string, SurfaceGroup>;
```

The groups of the configuration (`SurfaceConfig.groups`): one domain action each, before the defaults.

***

<a id="autoentrymark"></a>

### AutoEntryMark

What an auto surface records on each entry it registers.

#### Properties

<a id="group"></a>

##### group?

```ts
optional group?: string;
```

<a id="key"></a>

##### key

```ts
key: string;
```

***

<a id="autoentrymeta"></a>

### AutoEntryMeta

What `autoSurface` knows about one registered entry beyond the entry itself.

#### Properties

<a id="confidence"></a>

##### confidence

```ts
confidence: Confidence;
```

<a id="group-1"></a>

##### group?

```ts
optional group?: string;
```

<a id="key-1"></a>

##### key

```ts
key: string;
```

<a id="namefrom"></a>

##### nameFrom

```ts
nameFrom: NameFrom;
```

<a id="policy"></a>

##### policy?

```ts
optional policy?: PolicyDecision;
```

<a id="risk"></a>

##### risk?

```ts
optional risk?: WireRisk;
```

<a id="riskwhy"></a>

##### riskWhy?

```ts
optional riskWhy?: string;
```

<a id="rules"></a>

##### rules

```ts
rules: number[];
```

Rule indexes that matched.

<a id="sensitive"></a>

##### sensitive?

```ts
optional sensitive?: boolean;
```

<a id="tier"></a>

##### tier

```ts
tier: EntryTier;
```

<a id="unrecognized"></a>

##### unrecognized?

```ts
optional unrecognized?: boolean;
```

***

<a id="autohandlercontext"></a>

### AutoHandlerContext

What a rule's `handler` receives: the declared tier, an application function in place of the page's events.

#### Properties

<a id="actor"></a>

##### actor

```ts
actor: string;
```

<a id="dispatch"></a>

##### dispatch

```ts
dispatch: () => Promise<void>;
```

Run the page's own events for this control (the derived act), when the handler wants both.

###### Returns

`Promise`\<`void`\>

<a id="element"></a>

##### element

```ts
element: Element | null;
```

The control on the page now, or null when the rule declares a control the page does not render.

<a id="entryid"></a>

##### entryId

```ts
entryId: string;
```

The entry id the act resolved to.

<a id="expectedrev"></a>

##### expectedRev

```ts
expectedRev: number;
```

The revision the agent presented, for a conditional write.

<a id="text"></a>

##### text

```ts
text: string | undefined;
```

The act's text: a field's new value, or an action's free text.

***

<a id="autosurfacehandle"></a>

### AutoSurfaceHandle

#### Properties

<a id="surface"></a>

##### surface

```ts
readonly surface: Surface;
```

The surface the entries are registered on: observe, act, ledger, bridges, as for any surface.

#### Methods

<a id="approve"></a>

##### approve()

```ts
approve(id, options?): boolean;
```

Record the person's approval of one gated control, for `uses` acts (default 1) within `ttlMs`
(default five minutes). Call it only from the person's own interaction (an approval prompt in
the page), never from anything an agent can reach. Returns false for an unknown id.

###### Parameters

###### id

`string`

###### options?

###### ttlMs?

`number`

###### uses?

`number`

###### Returns

`boolean`

<a id="config"></a>

##### config()

```ts
config(): SurfaceConfig;
```

The configuration in force.

###### Returns

[`SurfaceConfig`](#surfaceconfig)

<a id="configure"></a>

##### configure()

```ts
configure(config): void;
```

Replace the configuration and re-scan.

###### Parameters

###### config

[`SurfaceConfig`](#surfaceconfig)

###### Returns

`void`

<a id="coverage"></a>

##### coverage()

```ts
coverage(): Coverage;
```

The coverage report of the current page.

###### Returns

[`Coverage`](#coverage-1)

<a id="elementfor"></a>

##### elementFor()

```ts
elementFor(id): Element | undefined;
```

The element an entry was derived from, when it is on the page.

###### Parameters

###### id

`string`

###### Returns

`Element` \| `undefined`

<a id="expose"></a>

##### expose()

```ts
expose(host?): void;
```

Publish `window.__surface` (observe, act, ledger, rev, coverage, formatCoverage) on `host`.

###### Parameters

###### host?

`object` \| `null`

###### Returns

`void`

<a id="metafor"></a>

##### metaFor()

```ts
metaFor(id): AutoEntryMeta | undefined;
```

What the scan recorded about an entry.

###### Parameters

###### id

`string`

###### Returns

[`AutoEntryMeta`](#autoentrymeta) \| `undefined`

<a id="read"></a>

##### read()

```ts
read(options?): PageRead;
```

The content the page shows the person ([S-AUTO-14]): sections by heading with their text,
key-value fields, tables, and lists; charts and canvases reported by title only; private
values withheld; bounded by `maxChars` and `maxRows`, with a cursor for the rest. Never moves
the revision. `formatRead` renders it as Markdown.

###### Parameters

###### options?

[`ReadOptions`](#readoptions)

###### Returns

[`PageRead`](#pageread)

<a id="refresh"></a>

##### refresh()

```ts
refresh(): object;
```

Re-scan now. Returns the ids whose entry was added, changed, or removed.

###### Returns

`object`

###### changed

```ts
changed: string[];
```

<a id="route"></a>

##### route()

```ts
route(): string;
```

The route the keys are built from now.

###### Returns

`string`

<a id="stop"></a>

##### stop()

```ts
stop(): void;
```

Stop observing, unregister every derived and configured entry, and restore the surface.

###### Returns

`void`

<a id="wait"></a>

##### wait()

```ts
wait(condition, options?): Promise<WaitResult>;
```

Wait until a condition on the page holds or `timeoutMs` (default 30 s, at most 120 s) runs
out ([S-AUTO-15]): text appears or goes, an entry is (un)available, the revision moves, the
page goes quiet, the route matches. Resolves with `met`, what changed while it waited, and
the notices that appeared. Never moves the revision; `stop()` ends it with `met: false`.

###### Parameters

###### condition

[`WaitCondition`](#waitcondition)

###### options?

[`WaitOptions`](#waitoptions)

###### Returns

`Promise`\<[`WaitResult`](#waitresult)\>

***

<a id="autosurfaceoptions"></a>

### AutoSurfaceOptions

#### Properties

<a id="config-1"></a>

##### config?

```ts
optional config?: SurfaceConfig;
```

The configuration overlay; `handle.configure()` replaces it later.

<a id="expose-1"></a>

##### expose?

```ts
optional expose?: boolean | object;
```

Publish `window.__surface` (with `coverage()`) now: `true` for `window`, or a host object.

<a id="hidden"></a>

##### hidden?

```ts
optional hidden?: "unavailable" | "skip";
```

What to do with a control that is on the page but not shown (`hidden`, `display: none`, a
closed `<details>`): `skip` (the default) leaves it out; `unavailable` lists it with the reason
"not shown on the page".

<a id="layout"></a>

##### layout?

```ts
optional layout?: boolean;
```

Read layout (sizes, `checkVisibility`). Default: true in browsers, false under jsdom.

<a id="now"></a>

##### now?

```ts
optional now?: () => Date;
```

Clock for coverage timestamps.

###### Returns

`Date`

<a id="observe"></a>

##### observe?

```ts
optional observe?: object;
```

###### debounceMs?

```ts
optional debounceMs?: number;
```

Coalesce DOM changes for this long before re-scanning. Default 30 ms.

###### settle?

```ts
optional settle?: object;
```

After an act, wait for this long without a DOM change (bounded by `timeoutMs`) before reporting. Default 50 and 1500 ms.

###### settle.quietMs?

```ts
optional quietMs?: number;
```

###### settle.timeoutMs?

```ts
optional timeoutMs?: number;
```

<a id="revision"></a>

##### revision?

```ts
optional revision?: "none" | "bump";
```

Move the surface's revision when the derived set changes (`bump`, the default), or leave the revision to the application (`none`).

<a id="root"></a>

##### root?

```ts
optional root?: Element;
```

The part of the page to derive from. Default `document.body`.

<a id="route-1"></a>

##### route?

```ts
optional route?: (location) => string;
```

The route part of every key, from the location. Default: the pathname with numeric, UUID, and
long hexadecimal segments replaced by `:id`, so one record's page and the next share keys.

###### Parameters

###### location

`Location`

###### Returns

`string`

<a id="surface-1"></a>

##### surface?

```ts
optional surface?: Surface;
```

The surface to register on. Default: a new `createSurface({ app })`. Entries the application registers on it stay beside the derived ones.

***

<a id="coverage-1"></a>

### Coverage

#### Properties

<a id="app"></a>

##### app

```ts
app: string;
```

<a id="approvals"></a>

##### approvals

```ts
approvals: object[];
```

Controls an agent cannot use without the person: `approve` (asks) or `deny` (refused).

###### id

```ts
id: string;
```

###### name

```ts
name: string;
```

###### policy

```ts
policy: PolicyDecision;
```

###### risk

```ts
risk: WireRisk;
```

###### why

```ts
why: string;
```

<a id="at"></a>

##### at

```ts
at: string;
```

<a id="configerrors"></a>

##### configErrors

```ts
configErrors: string[];
```

Problems with the configuration itself.

<a id="counts"></a>

##### counts

```ts
counts: object;
```

###### awaitingApproval

```ts
awaitingApproval: number;
```

###### byConfidence

```ts
byConfidence: Record<Confidence, number>;
```

###### byKind

```ts
byKind: Record<EntryKind, number>;
```

###### byTier

```ts
byTier: Record<EntryTier, number>;
```

###### entries

```ts
entries: number;
```

###### gaps

```ts
gaps: number;
```

###### unavailable

```ts
unavailable: number;
```

<a id="entries"></a>

##### entries

```ts
entries: CoverageEntry[];
```

<a id="frames"></a>

##### frames

```ts
frames: object;
```

Same-origin frames read, and cross-origin frames skipped.

###### crossOrigin

```ts
crossOrigin: number;
```

###### sameOrigin

```ts
sameOrigin: number;
```

<a id="gaps"></a>

##### gaps

```ts
gaps: CoverageGap[];
```

<a id="rev"></a>

##### rev

```ts
rev: number;
```

<a id="route-2"></a>

##### route

```ts
route: string;
```

<a id="staleconfig"></a>

##### staleConfig

```ts
staleConfig: StaleRule[];
```

<a id="suggestions"></a>

##### suggestions

```ts
suggestions: SurfaceRule[];
```

Every gap's suggestion, in order: the starting point of a configuration.

<a id="unreadable"></a>

##### unreadable

```ts
unreadable: UnreadableRegion[];
```

Content an agent cannot read: `read` reports these by title only ([S-AUTO-14]).

***

<a id="coverageentry"></a>

### CoverageEntry

#### Properties

<a id="available"></a>

##### available

```ts
available: boolean;
```

<a id="confidence-1"></a>

##### confidence

```ts
confidence: Confidence;
```

<a id="group-2"></a>

##### group?

```ts
optional group?: string;
```

<a id="id"></a>

##### id

```ts
id: string;
```

<a id="key-2"></a>

##### key

```ts
key: string;
```

The derived key; equal to `id` unless a pin (`data-surface-id`, a rule's `id`) replaced it.

<a id="kind"></a>

##### kind

```ts
kind: EntryKind;
```

<a id="name"></a>

##### name

```ts
name: string;
```

<a id="namefrom-1"></a>

##### nameFrom

```ts
nameFrom: NameFrom;
```

<a id="object"></a>

##### object

```ts
object: string | null;
```

<a id="policy-1"></a>

##### policy?

```ts
optional policy?: PolicyDecision;
```

What the policy lets an agent do with it.

<a id="risk-1"></a>

##### risk?

```ts
optional risk?: WireRisk;
```

<a id="riskwhy-1"></a>

##### riskWhy?

```ts
optional riskWhy?: string;
```

Why the risk is what it is.

<a id="role"></a>

##### role

```ts
role: string;
```

<a id="selector"></a>

##### selector?

```ts
optional selector?: string;
```

<a id="sensitive-1"></a>

##### sensitive?

```ts
optional sensitive?: boolean;
```

<a id="tier-1"></a>

##### tier

```ts
tier: EntryTier;
```

***

<a id="coveragegap"></a>

### CoverageGap

#### Properties

<a id="entryid-1"></a>

##### entryId?

```ts
optional entryId?: string;
```

The entry the gap is about, when it was registered.

<a id="kind-1"></a>

##### kind

```ts
kind: GapKind;
```

<a id="markup"></a>

##### markup?

```ts
optional markup?: string;
```

The markup change that closes it at the source, when there is one ("add aria-label").

<a id="message"></a>

##### message

```ts
message: string;
```

One plain sentence on what is missing.

<a id="selector-1"></a>

##### selector?

```ts
optional selector?: string;
```

A selector for the element, when there is one.

<a id="suggestion"></a>

##### suggestion?

```ts
optional suggestion?: SurfaceRule;
```

A configuration rule that closes the gap, to paste into `rules` and edit.

***

<a id="formatcoverageoptions"></a>

### FormatCoverageOptions

#### Properties

<a id="entries-1"></a>

##### entries?

```ts
optional entries?: number | boolean;
```

Include the table of entries: `true` (all), a number (at most that many rows), or false. Default 200.

***

<a id="pagecontent"></a>

### PageContent

What a surface carries under `CONTENT`. In the page both are local; a relay mirror forwards them.

#### Methods

<a id="read-1"></a>

##### read()

```ts
read(options?): PageRead | Promise<PageRead>;
```

###### Parameters

###### options?

[`ReadOptions`](#readoptions)

###### Returns

[`PageRead`](#pageread) \| `Promise`\<[`PageRead`](#pageread)\>

<a id="wait-1"></a>

##### wait()

```ts
wait(condition, options?): Promise<WaitResult>;
```

###### Parameters

###### condition

[`WaitCondition`](#waitcondition)

###### options?

[`WaitOptions`](#waitoptions)

###### Returns

`Promise`\<[`WaitResult`](#waitresult)\>

***

<a id="pageread"></a>

### PageRead

The page's content as `read` returns it.

#### Properties

<a id="nextcursor"></a>

##### nextCursor?

```ts
optional nextCursor?: string;
```

<a id="notices"></a>

##### notices

```ts
notices: string[];
```

Alerts and toasts on the page now (they are not repeated in `sections`).

<a id="path"></a>

##### path

```ts
path: string;
```

The location's path.

<a id="reason"></a>

##### reason?

```ts
optional reason?: string;
```

Why nothing was read (an unknown region, a stale cursor), when that happened.

<a id="redacted"></a>

##### redacted

```ts
redacted: number;
```

How many private fields or regions were withheld.

<a id="region"></a>

##### region?

```ts
optional region?: string;
```

The region read, when one was asked for and found.

<a id="regions"></a>

##### regions?

```ts
optional regions?: string[];
```

With an unknown region: the regions this page has, to choose from.

<a id="rev-1"></a>

##### rev

```ts
rev: number;
```

The surface's revision when the page was read. Reading never moves it.

<a id="route-3"></a>

##### route

```ts
route: string;
```

The route keys are built from (`/projects/:id`).

<a id="sections"></a>

##### sections

```ts
sections: ReadSection[];
```

<a id="title"></a>

##### title

```ts
title: string;
```

<a id="truncated"></a>

##### truncated

```ts
truncated: boolean;
```

More content than this page of the result holds: follow `nextCursor`, or narrow with `region` or `query`.

***

<a id="readfield"></a>

### ReadField

A label and the value the page shows beside it. A sensitive field carries its label only.

#### Properties

<a id="label"></a>

##### label

```ts
label: string;
```

<a id="sensitive-2"></a>

##### sensitive?

```ts
optional sensitive?: true;
```

A private value (a password, a card number, a field the configuration marks): withheld.

<a id="value"></a>

##### value

```ts
value: string;
```

***

<a id="readlist"></a>

### ReadList

#### Properties

<a id="items"></a>

##### items

```ts
items: string[];
```

<a id="total"></a>

##### total?

```ts
optional total?: number;
```

<a id="truncated-1"></a>

##### truncated

```ts
truncated: boolean;
```

***

<a id="readopaque"></a>

### ReadOpaque

A region whose content cannot be read from the page: a chart or canvas drawn as graphics, a
closed shadow root, a cross-origin frame. Reported with its title so an agent can say it
exists; its values are never guessed.

#### Properties

<a id="kind-2"></a>

##### kind

```ts
kind: "canvas" | "frame" | "chart" | "closed-shadow";
```

<a id="library"></a>

##### library?

```ts
optional library?: string;
```

The library that drew it, when it can tell ("a Highcharts chart").

<a id="title-1"></a>

##### title

```ts
title: string;
```

***

<a id="readoptions"></a>

### ReadOptions

What `read` accepts. Every member is optional.

#### Properties

<a id="cursor"></a>

##### cursor?

```ts
optional cursor?: string;
```

`nextCursor` from the previous read, with the same region and query.

<a id="maxchars"></a>

##### maxChars?

```ts
optional maxChars?: number;
```

At most this many characters of Markdown per page of the result. Default 12000, at most 50000.

<a id="maxrows"></a>

##### maxRows?

```ts
optional maxRows?: number;
```

At most this many rows per table and items per list. Default 50, at most 500.

<a id="query"></a>

##### query?

```ts
optional query?: string;
```

Keep only what contains this text (case-insensitive): a section whose heading matches whole, else its matching paragraphs, fields, rows, and items.

<a id="region-1"></a>

##### region?

```ts
optional region?: string;
```

The part of the page to read: an entry id (a table's, a landmark's, or a control's container),
a region named in the configuration's `read.regions`, a landmark or named region or dialog,
or a heading (its section and the sections under it). Default: the whole page.

***

<a id="readsection"></a>

### ReadSection

#### Properties

<a id="fields"></a>

##### fields

```ts
fields: ReadField[];
```

<a id="heading"></a>

##### heading

```ts
heading: string;
```

The heading text; empty for content before the first heading.

<a id="level"></a>

##### level

```ts
level: number;
```

1 to 6 for a heading, 0 for content before the first one.

<a id="lists"></a>

##### lists

```ts
lists: ReadList[];
```

<a id="opaque"></a>

##### opaque?

```ts
optional opaque?: ReadOpaque[];
```

<a id="tables"></a>

##### tables

```ts
tables: ReadTable[];
```

<a id="text-1"></a>

##### text

```ts
text: string;
```

Paragraphs, separated by blank lines.

<a id="truncated-2"></a>

##### truncated?

```ts
optional truncated?: true;
```

Part of this section was cut to fit `maxChars`; the cursor continues it.

***

<a id="readtable"></a>

### ReadTable

#### Properties

<a id="caption"></a>

##### caption

```ts
caption: string;
```

<a id="columns"></a>

##### columns

```ts
columns: string[];
```

<a id="rows"></a>

##### rows

```ts
rows: string[][];
```

<a id="total-1"></a>

##### total?

```ts
optional total?: number;
```

Rows the table has in all, when the page says (`aria-rowcount`) or more than `rows` were rendered.

<a id="truncated-3"></a>

##### truncated

```ts
truncated: boolean;
```

Some rows are not in `rows`: past `maxRows`, not rendered (a virtualized grid), or filtered by `query`.

***

<a id="risklexicon"></a>

### RiskLexicon

Word lists, English by default, matched case-insensitively on whole words against a control's
name (and its `title`). `destructive` makes a control high risk, `commit` medium, `view` low.
A configuration's lists extend these unless `replace` is true.

#### Properties

<a id="commit"></a>

##### commit?

```ts
optional commit?: string[];
```

<a id="destructive"></a>

##### destructive?

```ts
optional destructive?: string[];
```

<a id="replace"></a>

##### replace?

```ts
optional replace?: boolean;
```

Use the configured lists instead of the defaults. Default false (extend).

<a id="view"></a>

##### view?

```ts
optional view?: string[];
```

***

<a id="riskverdict"></a>

### RiskVerdict

#### Properties

<a id="idempotent"></a>

##### idempotent

```ts
idempotent: boolean;
```

<a id="mutates"></a>

##### mutates

```ts
mutates: string;
```

The state the control changes, for `effect.mutates`: `location`, `view`, `form`, or `app`.

<a id="reversible"></a>

##### reversible

```ts
reversible: boolean;
```

<a id="risk-2"></a>

##### risk

```ts
risk: WireRisk;
```

<a id="unrecognized-1"></a>

##### unrecognized

```ts
unrecognized: boolean;
```

Nothing recognized the control; it is high risk because it is unknown.

<a id="why"></a>

##### why

```ts
why: string;
```

One line on why, for coverage: "name matches “delete”".

***

<a id="stalerule"></a>

### StaleRule

#### Properties

<a id="index"></a>

##### index

```ts
index: number;
```

Index in `rules`.

<a id="match"></a>

##### match

```ts
match: SurfaceMatch;
```

<a id="message-1"></a>

##### message

```ts
message: string;
```

<a id="status"></a>

##### status

```ts
status: "stale" | "unmatched";
```

`stale`: the rule is scoped to this route and matched nothing; `unmatched`: it has matched nothing yet anywhere.

***

<a id="surfaceconfig"></a>

### SurfaceConfig

#### Properties

<a id="app-1"></a>

##### app?

```ts
optional app?: string;
```

Legacy application label. Prefer `profile`, which has a stable connector id.

<a id="declare"></a>

##### declare?

```ts
optional declare?: Entry[];
```

Entries registered as they are, beside the derived ones: the declared tier.

<a id="exclude"></a>

##### exclude?

```ts
optional exclude?: string[];
```

Selectors never derived (a developer toolbar, a chat widget).

<a id="groups-1"></a>

##### groups?

```ts
optional groups?: Record<string, SurfaceGroup>;
```

Domain actions that rules fold controls into with `group`. Names: lowercase letters, digits, hyphens.

<a id="landmarks"></a>

##### landmarks?

```ts
optional landmarks?: boolean;
```

Register the page's landmarks as targets of `navigate`. Default true.

<a id="lexicon"></a>

##### lexicon?

```ts
optional lexicon?: RiskLexicon;
```

The risk word lists, extending the English defaults unless `replace` is set.

<a id="navigate"></a>

##### navigate?

```ts
optional navigate?: 
  | false
  | "link"
  | "location"
  | ((path) => MaybePromise<void>)
  | "history";
```

How the `navigate` entry opens a path: a function (your router's `navigate`), `link` (click a
link on the page with that path, else load it), `history` (`pushState` and `popstate`, for
routers that listen to it), `location` (a full load), or `false` for no `navigate` entry.
Default `link`.

<a id="policy-2"></a>

##### policy?

```ts
optional policy?: SurfacePolicy;
```

What an agent may do at each risk level. Default: allow `none`, `low`, `medium`; `approve` for `high`.

<a id="profile"></a>

##### profile?

```ts
optional profile?: SurfaceProfileSource;
```

Structured application identity and live context reported by `observe()`.

<a id="read-2"></a>

##### read?

```ts
optional read?: object;
```

What `read` may read ([S-AUTO-14]): `exclude` selectors are never read (beside `exclude` above
and every `data-surface-ignore` subtree), and `regions` names parts of the page by CSS
selector, so an agent can read `{ region: "status" }`.

###### exclude?

```ts
optional exclude?: string[];
```

###### regions?

```ts
optional regions?: Record<string, string>;
```

<a id="routes"></a>

##### routes?

```ts
optional routes?: object;
```

Routes to derive on (globs on the route); the rest derive nothing. Default: every route.

###### exclude?

```ts
optional exclude?: string[];
```

###### include?

```ts
optional include?: string[];
```

<a id="rules-1"></a>

##### rules?

```ts
optional rules?: SurfaceRule[];
```

Rules, applied in order; a later rule's fields win.

<a id="sensitive-3"></a>

##### sensitive?

```ts
optional sensitive?: string[];
```

More selectors whose fields are sensitive, beside passwords, card fields, and one-time codes.

***

<a id="surfacegroup"></a>

### SurfaceGroup

A domain action that folds matched controls together, for `autoActions`.

#### Properties

<a id="description"></a>

##### description

```ts
description: string;
```

<a id="idempotent-1"></a>

##### idempotent?

```ts
optional idempotent?: boolean;
```

<a id="reversible-1"></a>

##### reversible?

```ts
optional reversible?: boolean;
```

<a id="risk-3"></a>

##### risk?

```ts
optional risk?: "low" | "medium" | "high";
```

The highest risk of any control in the group. Default `high`.

<a id="title-2"></a>

##### title

```ts
title: string;
```

***

<a id="surfacematch"></a>

### SurfaceMatch

Which derived controls a rule applies to. Every member given must hold. `name` is compared
case-insensitively after collapsing whitespace, or as a regular expression written `/…/flags`;
`route` and `key` accept `*` (within a segment) and `**` (across segments) globs.

#### Properties

<a id="id-1"></a>

##### id?

```ts
optional id?: string;
```

The control's `data-surface-id`.

<a id="key-3"></a>

##### key?

```ts
optional key?: string;
```

The derived key, as coverage and `observe()` report it.

<a id="name-1"></a>

##### name?

```ts
optional name?: string;
```

The derived accessible name, or `/regex/flags`.

<a id="role-1"></a>

##### role?

```ts
optional role?: string;
```

The derived role (`button`, `link`, `textbox`, `checkbox`, `grid`, …).

<a id="route-4"></a>

##### route?

```ts
optional route?: string;
```

A glob on the route the page is at (`/projects/*`).

<a id="selector-2"></a>

##### selector?

```ts
optional selector?: string;
```

A CSS selector the control matches. Also brings in an element the scan would not pick (a clickable `div`).

***

<a id="surfacepolicy"></a>

### SurfacePolicy

#### Properties

<a id="high"></a>

##### high?

```ts
optional high?: PolicyDecision;
```

Default `approve`: the act is refused with a handoff that tells the agent to ask the person.

<a id="low"></a>

##### low?

```ts
optional low?: PolicyDecision;
```

<a id="medium"></a>

##### medium?

```ts
optional medium?: PolicyDecision;
```

<a id="none"></a>

##### none?

```ts
optional none?: PolicyDecision;
```

***

<a id="surfacerule"></a>

### SurfaceRule

A rule of a `SurfaceConfig`.

#### Properties

<a id="approval"></a>

##### approval?

```ts
optional approval?: boolean;
```

Require the person's approval before an agent acts (true), or never (false), whatever the risk.

<a id="editable"></a>

##### editable?

```ts
optional editable?: boolean;
```

Let an agent type into a sensitive field. Default false: a sensitive field is read only to agents.

<a id="effect"></a>

##### effect?

```ts
optional effect?: Partial<Pick<Effect, "text" | "mutates" | "confirm" | "idempotent" | "reversible" | "risk">>;
```

What the control changes and how risky that is; merged over the derived effect.

<a id="group-3"></a>

##### group?

```ts
optional group?: string;
```

Fold the control into this domain action (a key of `groups`).

<a id="handler"></a>

##### handler?

```ts
optional handler?: AutoHandler;
```

Run this application function instead of the page's events: the declared tier.

<a id="hide"></a>

##### hide?

```ts
optional hide?: boolean;
```

Leave the control out of the surface.

<a id="id-2"></a>

##### id?

```ts
optional id?: string;
```

Pin the entry id, as `data-surface-id` would.

<a id="match-1"></a>

##### match

```ts
match: SurfaceMatch;
```

<a id="name-2"></a>

##### name?

```ts
optional name?: string;
```

The name to publish in place of the derived one. States the outcome ([S-DOM-1]).

<a id="note"></a>

##### note?

```ts
optional note?: string;
```

A note for reviewers; ignored by the SDK.

<a id="object-1"></a>

##### object?

```ts
optional object?: string;
```

The object the control belongs to.

<a id="reason-1"></a>

##### reason?

```ts
optional reason?: string;
```

The reason to report when the control is unavailable, in the application's words.

<a id="role-2"></a>

##### role?

```ts
optional role?: string;
```

Treat a matched element as this role (to bring in a clickable `div`, or correct a role).

<a id="sensitive-4"></a>

##### sensitive?

```ts
optional sensitive?: boolean;
```

The field's value is private ([S-PRV-1]).

<a id="state"></a>

##### state?

```ts
optional state?: "unavailable" | "available";
```

Force the availability: `unavailable` needs `reason`.

***

<a id="unreadableregion"></a>

### UnreadableRegion

A region whose content `read` cannot return: a chart or canvas drawn as graphics, a closed shadow root, a cross-origin frame.

#### Properties

<a id="kind-3"></a>

##### kind

```ts
kind: "canvas" | "frame" | "chart" | "closed-shadow";
```

<a id="library-1"></a>

##### library?

```ts
optional library?: string;
```

<a id="message-2"></a>

##### message

```ts
message: string;
```

<a id="selector-3"></a>

##### selector

```ts
selector: string;
```

<a id="title-3"></a>

##### title

```ts
title: string;
```

***

<a id="waitcondition"></a>

### WaitCondition

What `wait` waits for. The members given in one object must all hold; `any` and `all` combine
nested conditions. A text is matched case-insensitively as a substring after collapsing
whitespace, or as a regular expression (a `RegExp`, or a string written `/pattern/flags`).

#### Properties

<a id="all"></a>

##### all?

```ts
optional all?: WaitCondition[];
```

<a id="any"></a>

##### any?

```ts
optional any?: WaitCondition[];
```

<a id="available-1"></a>

##### available?

```ts
optional available?: boolean;
```

<a id="entry"></a>

##### entry?

```ts
optional entry?: string;
```

The entry with this id is on the surface (and, with `available`, can or cannot be acted on).

<a id="gone"></a>

##### gone?

```ts
optional gone?: string | RegExp;
```

This text is no longer shown on the page.

<a id="idle"></a>

##### idle?

```ts
optional idle?: number;
```

The page has had no DOM mutation for this many milliseconds (a streamed report finished).

<a id="revmoved"></a>

##### revMoved?

```ts
optional revMoved?: number;
```

The surface's revision is no longer this one.

<a id="route-5"></a>

##### route?

```ts
optional route?: string;
```

The route or the location's path matches this glob (`/reports/*`).

<a id="text-2"></a>

##### text?

```ts
optional text?: string | RegExp;
```

This text is shown on the page, or appeared in a notice (a toast) during the wait.

***

<a id="waitoptions"></a>

### WaitOptions

#### Properties

<a id="pollms"></a>

##### pollMs?

```ts
optional pollMs?: number;
```

Check at least this often, beside every DOM change. Default 250, from 20 to 5000.

<a id="signal"></a>

##### signal?

```ts
optional signal?: AbortSignal;
```

Cancel the wait; it resolves with `met: false`.

<a id="timeoutms"></a>

##### timeoutMs?

```ts
optional timeoutMs?: number;
```

Give up after this long. Default 30000, at most 120000.

***

<a id="waitresult"></a>

### WaitResult

How a wait ended, and what changed while it ran.

#### Properties

<a id="changed"></a>

##### changed

```ts
changed: string[];
```

Entry ids added, changed, or removed while it waited.

<a id="elapsedms"></a>

##### elapsedMs

```ts
elapsedMs: number;
```

<a id="fromrev"></a>

##### fromRev

```ts
fromRev: number;
```

The revision when it started.

<a id="met"></a>

##### met

```ts
met: boolean;
```

<a id="notices-1"></a>

##### notices

```ts
notices: string[];
```

Text that appeared in a notice (a toast, an alert, a status line) while it waited.

<a id="reason-2"></a>

##### reason

```ts
reason: string;
```

What held, or why it ended without: a timeout, a cancel, the surface stopping.

<a id="rev-2"></a>

##### rev

```ts
rev: number;
```

The revision when it ended; waiting never moves it.

## Type Aliases

<a id="autohandler"></a>

### AutoHandler

```ts
type AutoHandler = (context) => MaybePromise<HandlerReport | unknown>;
```

#### Parameters

##### context

[`AutoHandlerContext`](#autohandlercontext)

#### Returns

[`MaybePromise`](index.md#maybepromise)\<[`HandlerReport`](index.md#handlerreport) \| `unknown`\>

***

<a id="confidence-2"></a>

### Confidence

```ts
type Confidence = "high" | "medium" | "low" | "none";
```

How far an agent can trust a derived name: from the page's own labels (high) down to a guess from an icon's class (low).

***

<a id="gapkind"></a>

### GapKind

```ts
type GapKind = 
  | "unnamed"
  | "icon-only"
  | "weak-name"
  | "duplicate-name"
  | "possible-duplicate"
  | "custom-widget"
  | "canvas"
  | "chart"
  | "cross-origin-frame"
  | "virtualized"
  | "file-input"
  | "closed-shadow"
  | "unclassified-risk";
```

***

<a id="namefrom-2"></a>

### NameFrom

```ts
type NameFrom = 
  | "pin"
  | "config"
  | "aria-labelledby"
  | "aria-label"
  | "label"
  | "text"
  | "alt"
  | "value"
  | "title"
  | "heading"
  | "placeholder"
  | "icon"
  | "href"
  | "nearby"
  | "role"
  | "declared"
  | "none";
```

Where a derived name came from, in the order the computation tries them.

***

<a id="policydecision"></a>

### PolicyDecision

```ts
type PolicyDecision = "allow" | "approve" | "deny";
```

What an agent may do with a derived control at each risk level.

## Variables

<a id="approver"></a>

### APPROVER

```ts
const APPROVER: typeof APPROVER;
```

Where a surface's approver lives, for a trusted channel that has just shown the person a request
(the relay's in-page panel) to grant it. A symbol, not an import, so such a channel need not load
this module. Never reachable by an agent: it is a property of the page's own object.

***

<a id="auto_meta"></a>

### AUTO\_META

```ts
const AUTO_META: typeof AUTO_META;
```

The key under which an auto surface marks the entries it registered (a global symbol, so every bundle of the package reads the same one).

***

<a id="content-1"></a>

### CONTENT

```ts
const CONTENT: typeof CONTENT;
```

Where a surface keeps its page-content reader (`read` and `wait`): a global symbol, so the
bridges (`<ns>.read`, `<ns>.wait`) and the relay's mirror find it on any surface, in any
bundle, without importing the derivation.

***

<a id="default_lexicon"></a>

### DEFAULT\_LEXICON

```ts
const DEFAULT_LEXICON: Required<Omit<RiskLexicon, "replace">>;
```

***

<a id="ignore_attribute"></a>

### IGNORE\_ATTRIBUTE

```ts
const IGNORE_ATTRIBUTE: "data-surface-ignore" = "data-surface-ignore";
```

Marks a subtree the scan never reads: the application's own agent UI, a debug panel.

***

<a id="navigate_entry_id"></a>

### NAVIGATE\_ENTRY\_ID

```ts
const NAVIGATE_ENTRY_ID: "page:navigate" = "page:navigate";
```

The id of the entry that opens a same-origin path.

***

<a id="read_limits"></a>

### READ\_LIMITS

```ts
const READ_LIMITS: object;
```

The bounds `read` and `wait` apply.

#### Type Declaration

<a id="maxchars-1"></a>

##### maxChars

```ts
readonly maxChars: object;
```

###### maxChars.default

```ts
readonly default: 12000 = 12_000;
```

###### maxChars.max

```ts
readonly max: 50000 = 50_000;
```

###### maxChars.min

```ts
readonly min: 200 = 200;
```

<a id="maxrows-1"></a>

##### maxRows

```ts
readonly maxRows: object;
```

###### maxRows.default

```ts
readonly default: 50 = 50;
```

###### maxRows.max

```ts
readonly max: 500 = 500;
```

###### maxRows.min

```ts
readonly min: 1 = 1;
```

***

<a id="wait_limits"></a>

### WAIT\_LIMITS

```ts
const WAIT_LIMITS: object;
```

#### Type Declaration

<a id="pollms-1"></a>

##### pollMs

```ts
readonly pollMs: object;
```

###### pollMs.default

```ts
readonly default: 250 = 250;
```

###### pollMs.max

```ts
readonly max: 5000 = 5_000;
```

###### pollMs.min

```ts
readonly min: 20 = 20;
```

<a id="timeoutms-1"></a>

##### timeoutMs

```ts
readonly timeoutMs: object;
```

###### timeoutMs.default

```ts
readonly default: 30000 = 30_000;
```

###### timeoutMs.max

```ts
readonly max: 120000 = 120_000;
```

## Functions

<a id="accessiblename"></a>

### accessibleName()

```ts
function accessibleName(
   el, 
   role, 
   ctx
): NameResult;
```

The accessible name of a control, and where it came from.

#### Parameters

##### el

`Element`

##### role

`string`

##### ctx

`ScanContext`

#### Returns

`NameResult`

***

<a id="autodomains"></a>

### autoDomains()

```ts
function autoDomains(options?): DomainSpec[];
```

The domain actions for an auto surface, in the order they are tried: one per configured group,
then `navigate` (links within the site, landmarks, and the `navigate` entry that opens a path),
`set-field`, `run-control` (every other action, declared `high` so every control fits),
`load-more`, then the read-only `read` and `wait` (unless `content: false`).

#### Parameters

##### options?

[`AutoDomainsOptions`](#autodomainsoptions) = `{}`

#### Returns

[`DomainSpec`](axe.md#domainspec)[]

***

<a id="automarkof"></a>

### autoMarkOf()

```ts
function autoMarkOf(entry): AutoEntryMark | undefined;
```

The mark an auto surface left on an entry, or undefined for an entry it did not register.

#### Parameters

##### entry

[`Entry`](index.md#entry)

#### Returns

[`AutoEntryMark`](#autoentrymark) \| `undefined`

***

<a id="autosurface"></a>

### autoSurface()

```ts
function autoSurface(options?): AutoSurfaceHandle;
```

Derive a surface from the rendered page and keep it current: scan now, re-scan on every DOM
change (coalesced), and register, replace, or unregister entries so the table matches the page.

#### Parameters

##### options?

[`AutoSurfaceOptions`](#autosurfaceoptions) = `{}`

#### Returns

[`AutoSurfaceHandle`](#autosurfacehandle)

***

<a id="checkcondition"></a>

### checkCondition()

```ts
function checkCondition(condition, depth?): string | null;
```

The problem with a wait condition, as a sentence, or null when it is sound: it must say
something, `available` needs `entry`, `idle` is a positive number of milliseconds, and nesting
is bounded.

#### Parameters

##### condition

`unknown`

##### depth?

`number` = `0`

#### Returns

`string` \| `null`

***

<a id="checkconfig"></a>

### checkConfig()

```ts
function checkConfig(config): string[];
```

The validation problems of a configuration, as plain sentences; empty when it is sound.

#### Parameters

##### config

[`SurfaceConfig`](#surfaceconfig)

#### Returns

`string`[]

***

<a id="contentdomains"></a>

### contentDomains()

```ts
function contentDomains(): ContentActionSpec[];
```

The read-only page-content actions ([S-AUTO-16]): `read` (what the page shows the person,
bounded and redacted) and `wait` (until a condition on the page holds). Neither acts on an
entry or moves the revision; both need a surface that carries a page-content reader
(`autoSurface` attaches one, and the relay's mirror forwards to the page's).

#### Returns

[`ContentActionSpec`](axe.md#contentactionspec)[]

***

<a id="contentof"></a>

### contentOf()

```ts
function contentOf(surface): PageContent | undefined;
```

The page-content reader a surface carries, or undefined.

#### Parameters

##### surface

`object`

#### Returns

[`PageContent`](#pagecontent) \| `undefined`

***

<a id="defaultroute"></a>

### defaultRoute()

```ts
function defaultRoute(location): string;
```

The default route: the pathname with id-like segments collapsed to `:id`.

#### Parameters

##### location

`Pick`\<`Location`, `"pathname"`\>

#### Returns

`string`

***

<a id="formatcoverage"></a>

### formatCoverage()

```ts
function formatCoverage(c, options?): string;
```

The coverage report as Markdown, for a terminal, a pull request, or an agent.

#### Parameters

##### c

[`Coverage`](#coverage-1)

##### options?

[`FormatCoverageOptions`](#formatcoverageoptions) = `{}`

#### Returns

`string`

***

<a id="formatread"></a>

### formatRead()

```ts
function formatRead(r): string;
```

A read as Markdown: what the page shows, for an agent or a terminal.

#### Parameters

##### r

[`PageRead`](#pageread)

#### Returns

`string`

***

<a id="globmatch"></a>

### globMatch()

```ts
function globMatch(glob, value): boolean;
```

#### Parameters

##### glob

`string`

##### value

`string`

#### Returns

`boolean`

***

<a id="roleof"></a>

### roleOf()

```ts
function roleOf(el): string;
```

The element's role: its explicit `role` when valid, else its implicit ARIA role; `""` when it has none worth reading.

#### Parameters

##### el

`Element`

#### Returns

`string`
