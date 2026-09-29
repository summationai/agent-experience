[AXE API reference](../../README.md) / [@summationai/axe-client](README.md) / present

# present

## Interfaces

<a id="htmloptions"></a>

### HtmlOptions

#### Properties

<a id="heading"></a>

##### heading?

```ts
optional heading?: string;
```

Text of the heading above the results.

<a id="layout"></a>

##### layout?

```ts
optional layout?: "table" | "cards";
```

`cards` (default for list) or `table`.

<a id="locale"></a>

##### locale?

```ts
optional locale?: string;
```

<a id="title"></a>

##### title?

```ts
optional title?: string;
```

Page title. Defaults to the brand name or the action name.

***

<a id="markdownoptions"></a>

### MarkdownOptions

#### Properties

<a id="affordances"></a>

##### affordances?

```ts
optional affordances?: boolean;
```

Include the affordances list under the table. Default true.

<a id="locale-1"></a>

##### locale?

```ts
optional locale?: string;
```

<a id="maxcolumns"></a>

##### maxColumns?

```ts
optional maxColumns?: number;
```

Cap the number of attribute columns. Default 6.

***

<a id="presentedattribute"></a>

### PresentedAttribute

#### Properties

<a id="compare"></a>

##### compare?

```ts
optional compare?: WireCompare;
```

<a id="format"></a>

##### format

```ts
format: WireFormat;
```

<a id="label"></a>

##### label

```ts
label: string;
```

<a id="value"></a>

##### value

```ts
value: unknown;
```

***

<a id="presenteditem"></a>

### PresentedItem

#### Properties

<a id="affordances-1"></a>

##### affordances

```ts
affordances: ResolvedAffordance[];
```

<a id="attributes"></a>

##### attributes

```ts
attributes: PresentedAttribute[];
```

<a id="badges"></a>

##### badges

```ts
badges: string[];
```

<a id="id"></a>

##### id

```ts
id: string;
```

<a id="images"></a>

##### images

```ts
images: string[];
```

<a id="price"></a>

##### price?

```ts
optional price?: PresentedPrice;
```

<a id="raw"></a>

##### raw

```ts
raw: unknown;
```

The raw item with `_axe` removed.

<a id="subtitle"></a>

##### subtitle?

```ts
optional subtitle?: string;
```

<a id="summary"></a>

##### summary?

```ts
optional summary?: string;
```

<a id="title-1"></a>

##### title

```ts
title: string;
```

<a id="url"></a>

##### url?

```ts
optional url?: string;
```

***

<a id="presentedresult"></a>

### PresentedResult

The normalized, renderer-ready form of an `ok` result.

#### Properties

<a id="action"></a>

##### action

```ts
action: string;
```

<a id="brand"></a>

##### brand?

```ts
optional brand?: Brand;
```

<a id="disclaimer"></a>

##### disclaimer?

```ts
optional disclaimer?: string;
```

<a id="emptymessage"></a>

##### emptyMessage?

```ts
optional emptyMessage?: string;
```

<a id="items"></a>

##### items

```ts
items: PresentedItem[];
```

<a id="kind"></a>

##### kind

```ts
kind: WireDisplayKind | "generic";
```

<a id="output"></a>

##### output

```ts
output: unknown;
```

The output with every `_axe` key removed.

<a id="rev"></a>

##### rev?

```ts
optional rev?: Revision;
```

The revision the result carried, when the site has one.

<a id="suggestedcomparison"></a>

##### suggestedComparison

```ts
suggestedComparison: string[];
```

***

<a id="resolvedaffordance"></a>

### ResolvedAffordance

#### Properties

<a id="action-1"></a>

##### action

```ts
action: string;
```

<a id="expectedrev"></a>

##### expectedRev?

```ts
optional expectedRev?: Revision;
```

From a dynamic affordance: the revision to present as the request envelope's `expectedRev`.

<a id="input"></a>

##### input

```ts
input: Record<string, unknown>;
```

<a id="primary"></a>

##### primary

```ts
primary: boolean;
```

<a id="title-2"></a>

##### title

```ts
title: string;
```

## Functions

<a id="escapehtml"></a>

### escapeHtml()

```ts
function escapeHtml(s): string;
```

#### Parameters

##### s

`unknown`

#### Returns

`string`

***

<a id="formatprice"></a>

### formatPrice()

```ts
function formatPrice(price, locale?): string;
```

#### Parameters

##### price

`PresentedPrice`

##### locale?

`string` = `"en-US"`

#### Returns

`string`

***

<a id="formatvalue"></a>

### formatValue()

```ts
function formatValue(attr, locale?): string;
```

Format an attribute for humans. Locale-aware where it can be, plain otherwise.

#### Parameters

##### attr

[`PresentedAttribute`](#presentedattribute)

##### locale?

`string` = `"en-US"`

#### Returns

`string`

***

<a id="present"></a>

### present()

```ts
function present(
   action, 
   result, 
   brand?
): PresentedResult;
```

Apply an action's `display` to an `ok` result. Throws when the result is not `ok`.

#### Parameters

##### action

[`ActionDefinition`](index.md#actiondefinition)

##### result

[`Result`](index.md#result)

##### brand?

`Brand`

#### Returns

[`PresentedResult`](#presentedresult)

***

<a id="statetomarkdown"></a>

### stateToMarkdown()

```ts
function stateToMarkdown(state, manifest?): string;
```

Render a live-state document as Markdown: what can be done right now, and why not the rest.
Titles come from the manifest when given; otherwise action names are shown.

#### Parameters

##### state

[`LiveState`](index.md#livestate)

##### manifest?

[`Manifest`](index.md#manifest-1)

#### Returns

`string`

***

<a id="tohtml"></a>

### toHTML()

```ts
function toHTML(presented, options?): string;
```

A self-contained, dependency-free comparison page. Cards or a table, responsive,
brand-aware, with the disclaimer, a link per item, and affordance buttons that dispatch
`CustomEvent("axe:select", { detail: { itemId, action, input } })`.

#### Parameters

##### presented

[`PresentedResult`](#presentedresult)

##### options?

[`HtmlOptions`](#htmloptions) = `{}`

#### Returns

`string`

***

<a id="tomarkdown"></a>

### toMarkdown()

```ts
function toMarkdown(presented, options?): string;
```

A comparison table for chat surfaces, with links, badges, the disclaimer, and each item's affordances.

#### Parameters

##### presented

[`PresentedResult`](#presentedresult)

##### options?

[`MarkdownOptions`](#markdownoptions) = `{}`

#### Returns

`string`
