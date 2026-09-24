[AXE API reference](../../README.md) / [@axe/core](README.md) / node

# node

## Functions

<a id="jsonlfilesink"></a>

### jsonlFileSink()

```ts
function jsonlFileSink(path): (event) => Promise<void>;
```

Sink: append JSON lines to a file. Node only. The file handle is opened lazily and
writes are serialized, so events never interleave. Accepts request events and action events.

#### Parameters

##### path

`string`

#### Returns

(`event`) => `Promise`\<`void`\>
