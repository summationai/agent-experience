[AXE API reference](../../README.md) / [@axe/client](README.md) / present

# present

## Interfaces

### HtmlOptions

Defined in: [packages/client/src/present.ts:198](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/client/src/present.ts#L198)

#### Properties

##### heading?

```ts
optional heading?: string;
```

Defined in: [packages/client/src/present.ts:205](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/client/src/present.ts#L205)

Text of the heading above the results.

##### layout?

```ts
optional layout?: "table" | "cards";
```

Defined in: [packages/client/src/present.ts:203](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/client/src/present.ts#L203)

`cards` (default for list) or `table`.

##### locale?

```ts
optional locale?: string;
```

Defined in: [packages/client/src/present.ts:199](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/client/src/present.ts#L199)

##### title?

```ts
optional title?: string;
```

Defined in: [packages/client/src/present.ts:201](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/client/src/present.ts#L201)

Page title. Defaults to the brand name or the action name.

***

### MarkdownOptions

Defined in: [packages/client/src/present.ts:110](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/client/src/present.ts#L110)

#### Properties

##### affordances?

```ts
optional affordances?: boolean;
```

Defined in: [packages/client/src/present.ts:113](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/client/src/present.ts#L113)

Include the affordances list under the table. Default true.

##### locale?

```ts
optional locale?: string;
```

Defined in: [packages/client/src/present.ts:111](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/client/src/present.ts#L111)

##### maxColumns?

```ts
optional maxColumns?: number;
```

Defined in: [packages/client/src/present.ts:115](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/client/src/present.ts#L115)

Cap the number of attribute columns. Default 6.

***

### PresentedAttribute

Defined in: packages/core/dist/display.d.ts:42

#### Properties

##### compare?

```ts
optional compare?: WireCompare;
```

Defined in: packages/core/dist/display.d.ts:46

##### format

```ts
format: WireFormat;
```

Defined in: packages/core/dist/display.d.ts:45

##### label

```ts
label: string;
```

Defined in: packages/core/dist/display.d.ts:43

##### value

```ts
value: unknown;
```

Defined in: packages/core/dist/display.d.ts:44

***

### PresentedItem

Defined in: packages/core/dist/display.d.ts:53

#### Properties

##### affordances

```ts
affordances: ResolvedAffordance[];
```

Defined in: packages/core/dist/display.d.ts:63

##### attributes

```ts
attributes: PresentedAttribute[];
```

Defined in: packages/core/dist/display.d.ts:61

##### badges

```ts
badges: string[];
```

Defined in: packages/core/dist/display.d.ts:62

##### id

```ts
id: string;
```

Defined in: packages/core/dist/display.d.ts:54

##### images

```ts
images: string[];
```

Defined in: packages/core/dist/display.d.ts:58

##### price?

```ts
optional price?: PresentedPrice;
```

Defined in: packages/core/dist/display.d.ts:60

##### raw

```ts
raw: unknown;
```

Defined in: packages/core/dist/display.d.ts:65

The raw item with `_axe` removed.

##### subtitle?

```ts
optional subtitle?: string;
```

Defined in: packages/core/dist/display.d.ts:56

##### summary?

```ts
optional summary?: string;
```

Defined in: packages/core/dist/display.d.ts:57

##### title

```ts
title: string;
```

Defined in: packages/core/dist/display.d.ts:55

##### url?

```ts
optional url?: string;
```

Defined in: packages/core/dist/display.d.ts:59

***

### PresentedResult

Defined in: packages/core/dist/display.d.ts:68

The normalized, renderer-ready form of an `ok` result.

#### Properties

##### action

```ts
action: string;
```

Defined in: packages/core/dist/display.d.ts:69

##### brand?

```ts
optional brand?: Brand;
```

Defined in: packages/core/dist/display.d.ts:75

##### disclaimer?

```ts
optional disclaimer?: string;
```

Defined in: packages/core/dist/display.d.ts:74

##### emptyMessage?

```ts
optional emptyMessage?: string;
```

Defined in: packages/core/dist/display.d.ts:73

##### items

```ts
items: PresentedItem[];
```

Defined in: packages/core/dist/display.d.ts:71

##### kind

```ts
kind: WireDisplayKind | "generic";
```

Defined in: packages/core/dist/display.d.ts:70

##### output

```ts
output: unknown;
```

Defined in: packages/core/dist/display.d.ts:77

The output with every `_axe` key removed.

##### suggestedComparison

```ts
suggestedComparison: string[];
```

Defined in: packages/core/dist/display.d.ts:72

***

### ResolvedAffordance

Defined in: packages/core/dist/display.d.ts:36

#### Properties

##### action

```ts
action: string;
```

Defined in: packages/core/dist/display.d.ts:37

##### input

```ts
input: Record<string, unknown>;
```

Defined in: packages/core/dist/display.d.ts:39

##### primary

```ts
primary: boolean;
```

Defined in: packages/core/dist/display.d.ts:40

##### title

```ts
title: string;
```

Defined in: packages/core/dist/display.d.ts:38

## Functions

### escapeHtml()

```ts
function escapeHtml(s): string;
```

Defined in: [packages/client/src/present.ts:208](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/client/src/present.ts#L208)

#### Parameters

##### s

`unknown`

#### Returns

`string`

***

### formatPrice()

```ts
function formatPrice(price, locale?): string;
```

Defined in: [packages/client/src/present.ts:91](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/client/src/present.ts#L91)

#### Parameters

##### price

`PresentedPrice`

##### locale?

`string` = `"en-US"`

#### Returns

`string`

***

### formatValue()

```ts
function formatValue(attr, locale?): string;
```

Defined in: [packages/client/src/present.ts:37](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/client/src/present.ts#L37)

Format an attribute for humans. Locale-aware where it can be, plain otherwise.

#### Parameters

##### attr

[`PresentedAttribute`](#presentedattribute)

##### locale?

`string` = `"en-US"`

#### Returns

`string`

***

### present()

```ts
function present(
   action, 
   result, 
   brand?
): PresentedResult;
```

Defined in: [packages/client/src/present.ts:19](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/client/src/present.ts#L19)

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

### toHTML()

```ts
function toHTML(presented, options?): string;
```

Defined in: [packages/client/src/present.ts:266](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/client/src/present.ts#L266)

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

### toMarkdown()

```ts
function toMarkdown(presented, options?): string;
```

Defined in: [packages/client/src/present.ts:123](https://github.com/summationai/code/blob/02cb36fc6a443fe13de153801955d7b8a000acdf/axe/packages/client/src/present.ts#L123)

A comparison table for chat surfaces, with links, badges, the disclaimer, and each item's affordances.

#### Parameters

##### presented

[`PresentedResult`](#presentedresult)

##### options?

[`MarkdownOptions`](#markdownoptions) = `{}`

#### Returns

`string`
