[AXE API reference](../../README.md) / [@axe/surface](README.md) / react

# react

## Interfaces

<a id="surfaceprops"></a>

### SurfaceProps

The DOM attributes of one entry as React props [S-DOM-1]: what `surfaceAttributes` returns, with
`aria-disabled` and `aria-readonly` as booleans. Spreads onto `button`, `input`, `div`, or any
element that receives the control's interaction.

#### Properties

<a id="aria-disabled"></a>

##### aria-disabled?

```ts
optional aria-disabled?: boolean;
```

<a id="aria-label"></a>

##### aria-label

```ts
aria-label: string;
```

<a id="aria-readonly"></a>

##### aria-readonly?

```ts
optional aria-readonly?: boolean;
```

<a id="data-surface-id"></a>

##### data-surface-id

```ts
data-surface-id: string;
```

<a id="data-surface-kind"></a>

##### data-surface-kind

```ts
data-surface-kind: string;
```

<a id="data-surface-object"></a>

##### data-surface-object?

```ts
optional data-surface-object?: string;
```

<a id="data-surface-reason"></a>

##### data-surface-reason?

```ts
optional data-surface-reason?: string;
```

## Functions

<a id="tosurfaceprops"></a>

### toSurfaceProps()

```ts
function toSurfaceProps(attributes): SurfaceProps;
```

Convert the string attributes into React props: boolean-valued ARIA attributes become booleans.

#### Parameters

##### attributes

`Record`\<`string`, `string`\>

#### Returns

[`SurfaceProps`](#surfaceprops)

***

<a id="usesurface"></a>

### useSurface()

```ts
function useSurface(
   entry, 
   deps, 
   target?
): void;
```

`entry` is the object `register` takes. `deps` are the values it was computed from; the entry is
re-registered in place when they change, which is how availability and values stay current.

Transient states belong in `deps` too: a `saving` or `loading` flag, an open modal, anything the
component uses to disable its own control. Left out, the surface keeps reporting the control
available while the UI has frozen it, and an act runs into a disabled control ([S-REV-5]). For a
state that spans the whole page, `surface.freeze(reason)` is the shorter route.

Functions need not be in `deps`: an act always runs the handler (and `edit.set`, `more`,
`requires.fulfill`) of the latest render. The registration belongs to the pair of `entry.id` and
`target`: when either changes, the previous pair is unregistered and the new one registered, and
unmount unregisters the current pair. Strict Mode's extra mount and unmount leave the same table.

#### Parameters

##### entry

[`Entry`](index.md#entry)

##### deps

`DependencyList`

##### target?

[`Surface`](index.md#surface) = `defaultSurface`

#### Returns

`void`

***

<a id="usesurfaceprops"></a>

### useSurfaceProps()

```ts
function useSurfaceProps(
   entry, 
   deps, 
   target?
): SurfaceProps;
```

`useSurface` plus the control's attributes: registers `entry` while mounted (refreshing it in
place when `deps` change) and returns the props the rendered control spreads, so the accessible
name a browser agent or screen reader reads is the name `observe()` reports. The props follow
the surface's live availability (`surface.attributesFor`): while the surface is frozen the
control reads `aria-disabled` or `aria-readonly` with the freeze's reason, and the component
re-renders when that changes.

```tsx
const props = useSurfaceProps(entry, [available, reason]);
return <button {...props} disabled={!available} onClick={draft}>Draft</button>;
```

#### Parameters

##### entry

[`Entry`](index.md#entry)

##### deps

`DependencyList`

##### target?

[`Surface`](index.md#surface) = `defaultSurface`

#### Returns

[`SurfaceProps`](#surfaceprops)
