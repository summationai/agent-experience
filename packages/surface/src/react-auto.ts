/**
 * `SurfaceProvider` and `useAutoSurface`: start `autoSurface` when a React tree mounts, re-scan
 * on route changes, and stop on unmount ([S-AUTO-12]). Nothing runs at import or during a server
 * render: the scan starts in an effect, so a server-rendered app (React Router framework mode,
 * Next) imports this safely.
 */
import { createContext, createElement, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import type { Surface } from "./index";
import { surface as defaultSurface } from "./index";
import { autoSurface } from "./auto";
import type { AutoSurfaceHandle, AutoSurfaceOptions, SurfaceConfig } from "./auto";

export interface UseAutoSurfaceOptions extends Omit<
  AutoSurfaceOptions,
  "root" | "surface" | "config" | "expose"
> {
  /** The configuration overlay. Keep its identity stable (a module constant or `useMemo`); a new object reconfigures. */
  config?: SurfaceConfig;
  /** Feature flag: false starts nothing (and stops a running scan). Default true. */
  enabled?: boolean;
  /** Publish `window.__surface` with `coverage()`. Default false. */
  expose?: boolean;
  /** Derive from this element instead of `document.body`. */
  root?: RefObject<Element | null>;
  /** The surface to register on. Default the module-level `surface` of `@axe/surface`, the one `useSurface` registers on, so declared and derived entries share one table. */
  surface?: Surface;
  /**
   * The router's location, when the app has one (`useLocation()` of React Router, `usePathname()`
   * of Next): a change re-scans at once. Without it, `pushState`, `replaceState`, and `popstate`
   * are watched, which covers routers built on the History API.
   */
  location?: unknown;
  /**
   * Called in an effect once the scan has started, with its handle: the place to connect the relay
   * (`connectRelay(handle.surface, …)`, usually after a dynamic `import()` so nothing loads during a
   * server render). May return a cleanup, or a promise of one; it runs before the scan stops.
   * The latest function is used; changing it does not restart the scan.
   */
  onReady?: (handle: AutoSurfaceHandle) => void | (() => void) | Promise<void | (() => void)>;
}

const AutoSurfaceContext = createContext<AutoSurfaceHandle | null>(null);

/** Start `autoSurface` on mount (when `enabled`), and stop it on unmount. Returns the handle once it has started, else null. */
export function useAutoSurface(options: UseAutoSurfaceOptions = {}): AutoSurfaceHandle | null {
  const {
    config,
    enabled = true,
    expose = false,
    root,
    surface = defaultSurface,
    location,
    onReady,
    ...rest
  } = options;
  const [handle, setHandle] = useState<AutoSurfaceHandle | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const restRef = useRef(rest);
  restRef.current = rest;
  const configRef = useRef(config);
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    const el = root?.current ?? undefined;
    const h = autoSurface({
      ...restRef.current,
      surface,
      ...(configRef.current ? { config: configRef.current } : {}),
      ...(el ? { root: el } : {}),
    });
    if (expose) h.expose(window);
    // Routers built on the History API change the URL without a DOM event of their own.
    const hist = window.history;
    const push = hist.pushState;
    const replace = hist.replaceState;
    const later = () => queueMicrotask(() => h.refresh());
    const wrappedPush: History["pushState"] = function (this: History, ...args) {
      push.apply(this, args);
      later();
    };
    const wrappedReplace: History["replaceState"] = function (this: History, ...args) {
      replace.apply(this, args);
      later();
    };
    hist.pushState = wrappedPush;
    hist.replaceState = wrappedReplace;
    setHandle(h);
    // onReady may be async (a dynamic import); a cleanup that arrives after teardown runs at once.
    let stopped = false;
    let cleanup: (() => void) | undefined;
    const settle = (c: void | (() => void)) => {
      if (typeof c !== "function") return;
      if (stopped) c();
      else cleanup = c;
    };
    try {
      const ready = onReadyRef.current?.(h);
      if (ready && typeof (ready as Promise<unknown>).then === "function")
        (ready as Promise<void | (() => void)>).then(settle, () => undefined);
      else settle(ready as void | (() => void));
    } catch {
      // The app's onReady failing must not stop the surface.
    }
    return () => {
      stopped = true;
      cleanup?.();
      if (hist.pushState === wrappedPush) hist.pushState = push;
      if (hist.replaceState === wrappedReplace) hist.replaceState = replace;
      h.stop();
      setHandle(null);
    };
  }, [enabled, expose, surface, root]);
  // A new configuration object reconfigures the running scan.
  useEffect(() => {
    if (configRef.current === config) return;
    configRef.current = config;
    handle?.configure(config ?? {});
  }, [config, handle]);
  // A router location change re-scans after the new route has rendered.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    handle?.refresh();
  }, [location, handle]);
  return handle;
}

export interface SurfaceProviderProps extends UseAutoSurfaceOptions {
  /** Feature flag, the same as `enabled`: false starts nothing. */
  flag?: boolean;
  /**
   * The tree to render: any React node. Typed `unknown` so an application whose `@types/react`
   * is another copy than the one the SDK was built against (a workspace, a linked checkout, React
   * 19 types over the SDK's React 18 ones) still typechecks.
   */
  children?: unknown;
}

/**
 * Derive the surface from the page this tree renders. Put it near the root:
 *
 * ```tsx
 * <SurfaceProvider config={surfaceConfig} flag={flags.agentSurface} expose>
 *   <App />
 * </SurfaceProvider>
 * ```
 */
export function SurfaceProvider(props: SurfaceProviderProps) {
  const { flag, children, enabled, ...rest } = props;
  const handle = useAutoSurface({ ...rest, enabled: flag ?? enabled ?? true });
  return createElement(AutoSurfaceContext.Provider, { value: handle }, children as ReactNode);
}

/** The handle of the nearest `SurfaceProvider`, or null before it has started (and on the server). */
export function useAutoSurfaceHandle(): AutoSurfaceHandle | null {
  return useContext(AutoSurfaceContext);
}
