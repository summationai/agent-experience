/**
 * The names `axe surface init` writes into an application and `axe surface coverage` reads from a
 * page, in one place: the names and props of `@axe/surface/auto`, `@axe/surface/react`, and
 * `@axe/relay/client` that generated code uses. Keep it, and the type stubs in
 * test/fixtures/_stubs that typecheck generated code, in step with those packages.
 */

/** Module specifiers the generated code imports from. */
export const MODULES = {
  /** `SurfaceProvider` (React). */
  react: "@axe/surface/react",
  /** `autoSurface`, `SurfaceConfig`, `formatCoverage`. */
  auto: "@axe/surface/auto",
  /** `connectRelay`, `relayOptions`. */
  relayClient: "@axe/relay/client",
} as const;

/** Exported names the generated code uses. */
export const NAMES = {
  provider: "SurfaceProvider",
  autoSurface: "autoSurface",
  config: "SurfaceConfig",
  formatCoverage: "formatCoverage",
  connectRelay: "connectRelay",
  /** The injected connection of a host running the app for an agent (`axe host`), else the app's own. */
  relayOptions: "relayOptions",
} as const;

/**
 * Props the generated root component passes to `SurfaceProvider`.
 * Agreed: `config` and `flag` (a boolean the app computes; off renders children only).
 * `expose` publishes `window.__surface`; `onReady` is called with the `autoSurface` handle from
 * an effect once the scan starts (never during a server render) and may return a cleanup.
 */
export const PROVIDER_PROPS = {
  config: "config",
  flag: "flag",
  expose: "expose",
  onReady: "onReady",
} as const;

/**
 * The option `autoSurface({ root, surface, config })` is called with in the plain-HTML setup.
 * `expose` is an `autoSurface` option (`true` publishes on `window`).
 */
export const AUTO_OPTIONS = { root: "root", config: "config" } as const;

/** The tab endpoint of the development relay `axe relay --dev` (port 4717, path `/tab`). */
export const DEV_RELAY_URL = "ws://127.0.0.1:4717/tab";

/** Packages `--install` adds. */
export const PACKAGES = {
  surface: "@axe/surface",
  relay: "@axe/relay",
  /** A dependency of both; named in overrides for tarball installs. */
  core: "@axe/core",
} as const;

/** What `expose` publishes on the page, and what coverage reads. */
export const PAGE_GLOBAL = "__surface";
