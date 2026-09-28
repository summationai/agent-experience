[AXE API reference](../../README.md) / @axe/surface

# `@axe/surface`

Browser-native live controls for agents. Surface derives or registers the controls an application currently shows, reports availability and reasons under one revision, and acts through the same handlers a person uses.

```ts
import { autoSurface } from "@axe/surface/auto";

const handle = autoSurface({
  config: {
    profile: {
      id: "example-app",
      name: "Example App",
      authentication: { state: "unknown" },
    },
  },
});
```

The profile is structured application data. Connection URLs, origins, OAuth, and session exchange belong to the provider registry, not Surface. See [Surface](../../_media/surface.md) and the [application/provider boundary](../../_media/architecture.md).

## Modules

- [auto](auto.md)
- [axe](axe.md)
- [index](index.md)
- [react](react.md)
- [webmcp](webmcp.md)
