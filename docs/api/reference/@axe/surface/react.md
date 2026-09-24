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

#### Parameters

##### entry

[`Entry`](index.md#entry)

##### deps

`DependencyList`

##### target?

[`Surface`](index.md#surface) = `defaultSurface`

#### Returns

`void`
