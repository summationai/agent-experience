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

***

<a id="surfaceproviderprops"></a>

### SurfaceProviderProps

#### Extends

- [`UseAutoSurfaceOptions`](#useautosurfaceoptions)

#### Properties

<a id="children"></a>

##### children?

```ts
optional children?: ReactNode;
```

<a id="config"></a>

##### config?

```ts
optional config?: SurfaceConfig;
```

The configuration overlay. Keep its identity stable (a module constant or `useMemo`); a new object reconfigures.

###### Inherited from

[`UseAutoSurfaceOptions`](#useautosurfaceoptions).[`config`](#config-1)

<a id="enabled"></a>

##### enabled?

```ts
optional enabled?: boolean;
```

Feature flag: false starts nothing (and stops a running scan). Default true.

###### Inherited from

[`UseAutoSurfaceOptions`](#useautosurfaceoptions).[`enabled`](#enabled-1)

<a id="expose"></a>

##### expose?

```ts
optional expose?: boolean;
```

Publish `window.__surface` with `coverage()`. Default false.

###### Inherited from

[`UseAutoSurfaceOptions`](#useautosurfaceoptions).[`expose`](#expose-1)

<a id="flag"></a>

##### flag?

```ts
optional flag?: boolean;
```

Feature flag, the same as `enabled`: false starts nothing.

<a id="hidden"></a>

##### hidden?

```ts
optional hidden?: "unavailable" | "skip";
```

What to do with a control that is on the page but not shown (`hidden`, `display: none`, a
closed `<details>`): `skip` (the default) leaves it out; `unavailable` lists it with the reason
"not shown on the page".

###### Inherited from

[`AutoSurfaceOptions`](auto.md#autosurfaceoptions).[`hidden`](auto.md#hidden)

<a id="layout"></a>

##### layout?

```ts
optional layout?: boolean;
```

Read layout (sizes, `checkVisibility`). Default: true in browsers, false under jsdom.

###### Inherited from

[`AutoSurfaceOptions`](auto.md#autosurfaceoptions).[`layout`](auto.md#layout)

<a id="location"></a>

##### location?

```ts
optional location?: unknown;
```

The router's location, when the app has one (`useLocation()` of React Router, `usePathname()`
of Next): a change re-scans at once. Without it, `pushState`, `replaceState`, and `popstate`
are watched, which covers routers built on the History API.

###### Inherited from

[`UseAutoSurfaceOptions`](#useautosurfaceoptions).[`location`](#location-1)

<a id="now"></a>

##### now?

```ts
optional now?: () => Date;
```

Clock for coverage timestamps.

###### Returns

`Date`

###### Inherited from

[`AutoSurfaceOptions`](auto.md#autosurfaceoptions).[`now`](auto.md#now)

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

###### Inherited from

[`AutoSurfaceOptions`](auto.md#autosurfaceoptions).[`observe`](auto.md#observe)

<a id="revision"></a>

##### revision?

```ts
optional revision?: "none" | "bump";
```

Move the surface's revision when the derived set changes (`bump`, the default), or leave the revision to the application (`none`).

###### Inherited from

[`AutoSurfaceOptions`](auto.md#autosurfaceoptions).[`revision`](auto.md#revision)

<a id="root"></a>

##### root?

```ts
optional root?: RefObject<Element | null>;
```

Derive from this element instead of `document.body`.

###### Inherited from

[`SurfaceProviderProps`](#surfaceproviderprops).[`root`](#root)

<a id="route"></a>

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

###### Inherited from

[`AutoSurfaceOptions`](auto.md#autosurfaceoptions).[`route`](auto.md#route-1)

<a id="surface"></a>

##### surface?

```ts
optional surface?: Surface;
```

The surface to register on. Default the module-level `surface` of `@axe/surface`, the one `useSurface` registers on, so declared and derived entries share one table.

###### Inherited from

[`UseAutoSurfaceOptions`](#useautosurfaceoptions).[`surface`](#surface-1)

***

<a id="useautosurfaceoptions"></a>

### UseAutoSurfaceOptions

#### Extends

- `Omit`\<[`AutoSurfaceOptions`](auto.md#autosurfaceoptions), `"root"` \| `"surface"` \| `"config"` \| `"expose"`\>

#### Extended by

- [`SurfaceProviderProps`](#surfaceproviderprops)

#### Properties

<a id="config-1"></a>

##### config?

```ts
optional config?: SurfaceConfig;
```

The configuration overlay. Keep its identity stable (a module constant or `useMemo`); a new object reconfigures.

<a id="enabled-1"></a>

##### enabled?

```ts
optional enabled?: boolean;
```

Feature flag: false starts nothing (and stops a running scan). Default true.

<a id="expose-1"></a>

##### expose?

```ts
optional expose?: boolean;
```

Publish `window.__surface` with `coverage()`. Default false.

<a id="hidden-1"></a>

##### hidden?

```ts
optional hidden?: "unavailable" | "skip";
```

What to do with a control that is on the page but not shown (`hidden`, `display: none`, a
closed `<details>`): `skip` (the default) leaves it out; `unavailable` lists it with the reason
"not shown on the page".

###### Inherited from

[`AutoSurfaceOptions`](auto.md#autosurfaceoptions).[`hidden`](auto.md#hidden)

<a id="layout-1"></a>

##### layout?

```ts
optional layout?: boolean;
```

Read layout (sizes, `checkVisibility`). Default: true in browsers, false under jsdom.

###### Inherited from

[`AutoSurfaceOptions`](auto.md#autosurfaceoptions).[`layout`](auto.md#layout)

<a id="location-1"></a>

##### location?

```ts
optional location?: unknown;
```

The router's location, when the app has one (`useLocation()` of React Router, `usePathname()`
of Next): a change re-scans at once. Without it, `pushState`, `replaceState`, and `popstate`
are watched, which covers routers built on the History API.

<a id="now-1"></a>

##### now?

```ts
optional now?: () => Date;
```

Clock for coverage timestamps.

###### Returns

`Date`

###### Inherited from

[`AutoSurfaceOptions`](auto.md#autosurfaceoptions).[`now`](auto.md#now)

<a id="observe-1"></a>

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

###### Inherited from

[`AutoSurfaceOptions`](auto.md#autosurfaceoptions).[`observe`](auto.md#observe)

<a id="revision-1"></a>

##### revision?

```ts
optional revision?: "none" | "bump";
```

Move the surface's revision when the derived set changes (`bump`, the default), or leave the revision to the application (`none`).

###### Inherited from

[`AutoSurfaceOptions`](auto.md#autosurfaceoptions).[`revision`](auto.md#revision)

<a id="root-1"></a>

##### root?

```ts
optional root?: RefObject<Element | null>;
```

Derive from this element instead of `document.body`.

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

###### Inherited from

[`AutoSurfaceOptions`](auto.md#autosurfaceoptions).[`route`](auto.md#route-1)

<a id="surface-1"></a>

##### surface?

```ts
optional surface?: Surface;
```

The surface to register on. Default the module-level `surface` of `@axe/surface`, the one `useSurface` registers on, so declared and derived entries share one table.

## Functions

<a id="surfaceprovider"></a>

### SurfaceProvider()

```ts
function SurfaceProvider(props): FunctionComponentElement<ProviderProps<AutoSurfaceHandle | null>>;
```

Derive the surface from the page this tree renders. Put it near the root:

```tsx
<SurfaceProvider config={surfaceConfig} flag={flags.agentSurface} expose>
  <App />
</SurfaceProvider>
```

#### Parameters

##### props

[`SurfaceProviderProps`](#surfaceproviderprops)

#### Returns

`FunctionComponentElement`\<`ProviderProps`\<[`AutoSurfaceHandle`](auto.md#autosurfacehandle) \| `null`\>\>

***

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

<a id="useautosurface"></a>

### useAutoSurface()

```ts
function useAutoSurface(options?): AutoSurfaceHandle | null;
```

Start `autoSurface` on mount (when `enabled`), and stop it on unmount. Returns the handle once it has started, else null.

#### Parameters

##### options?

[`UseAutoSurfaceOptions`](#useautosurfaceoptions) = `{}`

#### Returns

[`AutoSurfaceHandle`](auto.md#autosurfacehandle) \| `null`

***

<a id="useautosurfacehandle"></a>

### useAutoSurfaceHandle()

```ts
function useAutoSurfaceHandle(): AutoSurfaceHandle | null;
```

The handle of the nearest `SurfaceProvider`, or null before it has started (and on the server).

#### Returns

[`AutoSurfaceHandle`](auto.md#autosurfacehandle) \| `null`

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
