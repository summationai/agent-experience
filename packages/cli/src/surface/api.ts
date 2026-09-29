/**
 * The names `axe surface init` writes into an application and `axe surface coverage` reads from a
 * page, in one place: the names and props of `@summationai/axe-surface/auto`, `@summationai/axe-surface/react`, and
 * `@summationai/axe-relay/client` that generated code uses. Keep it, and the type stubs in
 * test/fixtures/_stubs that typecheck generated code, in step with those packages.
 */

/** Module specifiers the generated code imports from. */
export const MODULES = {
  /** `SurfaceProvider` (React). */
  react: "@summationai/axe-surface/react",
  /** `autoSurface`, `SurfaceConfig`, `formatCoverage`. */
  auto: "@summationai/axe-surface/auto",
  /** `exposeWebMcp` for plain-HTML setup; React uses the provider prop. */
  webMcp: "@summationai/axe-surface/webmcp",
  /** `connectRelay`, `injectedRelay`, `devToken`, `localMcpService`. */
  relayClient: "@summationai/axe-relay/client",
} as const;

/** Exported names the generated code uses. */
export const NAMES = {
  provider: "SurfaceProvider",
  autoSurface: "autoSurface",
  config: "SurfaceConfig",
  formatCoverage: "formatCoverage",
  exposeWebMcp: "exposeWebMcp",
  connectRelay: "connectRelay",
  localMcpService: "localMcpService",
  /** The connection a host injected (`window.__AXE_RELAY__`), read when called; null elsewhere. */
  injectedRelay: "injectedRelay",
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
  webMcp: "webMcp",
  onReady: "onReady",
} as const;

/**
 * The option `autoSurface({ root, surface, config })` is called with in the plain-HTML setup.
 * `expose` is an `autoSurface` option (`true` publishes on `window`).
 */
export const AUTO_OPTIONS = { root: "root", config: "config" } as const;

/** The local company-side MCP service; it serves browser tabs at `/tab` and agents at `/mcp`. */
export const DEV_RELAY_URL = "http://127.0.0.1:4717";

/** Packages `--install` adds. */
export const PACKAGES = {
  surface: "@summationai/axe-surface",
  relay: "@summationai/axe-relay",
  /** A dependency of both; named in overrides for tarball installs. */
  core: "@summationai/axe-core",
} as const;

/** What `expose` publishes on the page, and what coverage reads. */
export const PAGE_GLOBAL = "__surface";
