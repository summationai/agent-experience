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

The profile is structured application data. Connection URLs, origins, OAuth, and session exchange belong to the provider registry, not Surface. See [Surface](https://github.com/summationai/agent-experience/blob/main/docs/surface.md) and the [application/provider boundary](https://github.com/summationai/agent-experience/blob/main/docs/architecture.md).
