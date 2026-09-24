[AXE API reference](../../README.md) / [@axe/surface](README.md) / react

# react

## Functions

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
re-registered when they change, which is how availability and values stay current.

Transient states belong in `deps` too: a `saving` or `loading` flag, an open modal, anything the
component uses to disable its own control. Left out, the surface keeps reporting the control
available while the UI has frozen it, and an act runs into a disabled control ([S-REV-5]). For a
state that spans the whole page, `surface.freeze(reason)` is the shorter route.

#### Parameters

##### entry

[`Entry`](index.md#entry)

##### deps

`DependencyList`

##### target?

[`Surface`](index.md#surface) = `defaultSurface`

#### Returns

`void`
