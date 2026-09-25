/**
 * The names `axe surface init` writes into an application and `axe surface coverage` reads from a
 * page, in one place. `@axe/surface/auto` and `@axe/relay` are built in parallel with this
 * command; the names below are the agreed ones, and every exact signature this file had to guess
 * is marked TODO(merge). When those packages land, reconcile this file (and the stubs in
 * test/fixtures/_stubs, which pin the guessed shapes) and the generated code follows.
 */

/** Module specifiers the generated code imports from. */
export const MODULES = {
  /** `SurfaceProvider` (React). */
  react: "@axe/surface/react",
  /** `autoSurface`, `SurfaceConfig`, `formatCoverage`. */
  auto: "@axe/surface/auto",
  /** `connectRelay`. */
  relayClient: "@axe/relay/client",
} as const;

/** Exported names the generated code uses. */
export const NAMES = {
  provider: "SurfaceProvider",
  autoSurface: "autoSurface",
  config: "SurfaceConfig",
  formatCoverage: "formatCoverage",
  connectRelay: "connectRelay",
} as const;

/**
 * Props the generated root component passes to `SurfaceProvider`.
 * Agreed: `config` and `flag` (a boolean the app computes; off renders children only).
 * TODO(merge): `expose` (publish `window.__surface`) and `onReady` (called with the `autoSurface`
 * handle once it starts, from an effect, so never during a server render; may return a cleanup)
 * are guesses. The generated component relies on the provider starting everything in an effect.
 */
export const PROVIDER_PROPS = {
  config: "config",
  flag: "flag",
  expose: "expose",
  onReady: "onReady",
} as const;

/**
 * The option `autoSurface({ root, surface, config })` is called with in the plain-HTML setup.
 * TODO(merge): whether `expose` is an `autoSurface` option or a call on `handle.surface` is a
 * guess; the plain setup calls `handle.surface.expose(window)`, which exists on every surface today.
 */
export const AUTO_OPTIONS = { root: "root", config: "config" } as const;

/** The development relay `axe relay --dev` listens on. TODO(merge): the port is a guess. */
export const DEV_RELAY_URL = "ws://localhost:4777";

/** Packages `--install` adds. */
export const PACKAGES = {
  surface: "@axe/surface",
  relay: "@axe/relay",
  /** A dependency of both; named in overrides for tarball installs. */
  core: "@axe/core",
} as const;

/** What `expose` publishes on the page, and what coverage reads. */
export const PAGE_GLOBAL = "__surface";
