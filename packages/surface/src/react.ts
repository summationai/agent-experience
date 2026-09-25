/**
 * @axe/surface/react: keep one entry registered while a component is mounted.
 *
 * Refresh replaces the entry in place rather than unregister-then-register: the table is an
 * insertion-ordered map, and delete-then-set would move a row to the end every time a sibling
 * re-rendered, so an agent's index would jump. Only unmount, or a change of the entry's `id` or of
 * the target surface, removes the row.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { DependencyList } from "react";
import type { Entry, JsonValue, Surface } from "./index";
import { surface as defaultSurface, surfaceAttributes } from "./index";
import * as WIRE from "@axe/core/vocabulary";

// Layout effects register before the browser paints, so a control never shows a frame with the
// previous registration's attributes. On the server neither kind runs; `useEffect` avoids React's
// server warning for `useLayoutEffect`.
const useIsomorphicLayoutEffect = typeof document === "undefined" ? useEffect : useLayoutEffect;

/**
 * The entry registered for a component: the caller's entry with every function the surface calls
 * on an act (`handler`, `edit.set`, `more`, `state.requires.fulfill`) replaced by a stable wrapper
 * that calls the same function on the latest rendered entry. A handler therefore never runs a
 * closure from an older render, whatever `deps` list, and a new closure alone does not re-register.
 */
function delegating(entry: Entry, latest: { current: Entry }): Entry {
  if (entry.kind === "action") {
    const out = { ...entry };
    out.handler = (...args) => {
      const now = latest.current;
      return (now.kind === "action" ? now : entry).handler(...args);
    };
    const s = entry.state;
    if (s && !s.available && s.requires) {
      out.state = {
        ...s,
        requires: {
          ...s.requires,
          fulfill: (kind: string, payload: JsonValue, actor: string) => {
            const now = latest.current;
            const r =
              now.kind === "action" && now.state && !now.state.available
                ? now.state.requires
                : undefined;
            return (r ?? s.requires!).fulfill(kind, payload, actor);
          },
        },
      };
    }
    return out;
  }
  if (entry.kind === "field") {
    const edit = entry.edit;
    if (edit.readOnly) return entry;
    return {
      ...entry,
      edit: {
        ...edit,
        set: (...args) => {
          const now = latest.current;
          const e = now.kind === "field" && !now.edit.readOnly ? now.edit : edit;
          return e.set(...args);
        },
      },
    };
  }
  if (typeof entry.more !== "function") return entry;
  const more = entry.more;
  return {
    ...entry,
    more: (...args) => {
      const now = latest.current;
      return (now.kind === "collection" && typeof now.more === "function" ? now.more : more)(
        ...args,
      );
    },
  };
}

/**
 * `entry` is the object `register` takes. `deps` are the values it was computed from; the entry is
 * re-registered in place when they change, which is how availability and values stay current.
 *
 * Transient states belong in `deps` too: a `saving` or `loading` flag, an open modal, anything the
 * component uses to disable its own control. Left out, the surface keeps reporting the control
 * available while the UI has frozen it, and an act runs into a disabled control ([S-REV-5]). For a
 * state that spans the whole page, `surface.freeze(reason)` is the shorter route.
 *
 * Functions need not be in `deps`: an act always runs the handler (and `edit.set`, `more`,
 * `requires.fulfill`) of the latest render. The registration belongs to the pair of `entry.id` and
 * `target`: when either changes, the previous pair is unregistered and the new one registered, and
 * unmount unregisters the current pair. Strict Mode's extra mount and unmount leave the same table.
 */
export function useSurface(
  entry: Entry,
  deps: DependencyList,
  target: Surface = defaultSurface,
): void {
  const latest = useRef(entry);
  useIsomorphicLayoutEffect(() => {
    latest.current = entry;
  });
  // Ownership: the cleanup removes exactly the pair this effect registered, on unmount or when the
  // id or the target changes. It runs before the refresh below registers the new pair.
  useIsomorphicLayoutEffect(() => () => target.unregister(entry.id), [target, entry.id]);
  // Refresh: register (or replace in place) when the pair or the caller's `deps` change. `deps` is
  // the caller's list on purpose: the entry is a fresh object every render, so depending on it would
  // re-register on every render; the caller names the values the entry was computed from.
  useIsomorphicLayoutEffect(
    () => target.register(delegating(entry, latest)),
    [target, entry.id, ...deps],
  );
}

/**
 * The DOM attributes of one entry as React props [S-DOM-1]: what `surfaceAttributes` returns, with
 * `aria-disabled` and `aria-readonly` as booleans. Spreads onto `button`, `input`, `div`, or any
 * element that receives the control's interaction.
 */
export interface SurfaceProps {
  "aria-label": string;
  "aria-disabled"?: boolean;
  "aria-readonly"?: boolean;
  "data-surface-id": string;
  "data-surface-kind": string;
  "data-surface-object"?: string;
  "data-surface-reason"?: string;
}

/**
 * `useSurface` plus the control's attributes: registers `entry` while mounted (refreshing it in
 * place when `deps` change) and returns the props the rendered control spreads, so the accessible
 * name a browser agent or screen reader reads is the name `observe()` reports. The props follow
 * the surface's live availability (`surface.attributesFor`): while the surface is frozen the
 * control reads `aria-disabled` or `aria-readonly` with the freeze's reason, and the component
 * re-renders when that changes.
 *
 * ```tsx
 * const props = useSurfaceProps(entry, [available, reason]);
 * return <button {...props} disabled={!available} onClick={draft}>Draft</button>;
 * ```
 */
export function useSurfaceProps(
  entry: Entry,
  deps: DependencyList,
  target: Surface = defaultSurface,
): SurfaceProps {
  useSurface(entry, deps, target);
  // The live attributes as a string, so React re-renders only when they differ. Before the
  // registering effect has run (and on the server), the entry's own state stands in for the live
  // availability. `subscribe` fires on registration as well as on revision moves and freezes
  // ([S-OBS-4]), so a change made by another writer reaches the control too.
  const id = entry.id;
  const own = JSON.stringify(surfaceAttributes(entry));
  const subscribe = useCallback(
    (onStoreChange: () => void) => target.subscribe(onStoreChange),
    [target],
  );
  const snapshot = useCallback(() => {
    const live = target.attributesFor(id);
    return live ? JSON.stringify(live.set) : own;
  }, [target, id, own]);
  const rendered = useSyncExternalStore(subscribe, snapshot, snapshot);
  return toSurfaceProps(JSON.parse(rendered) as Record<string, string>);
}

/** Convert the string attributes into React props: boolean-valued ARIA attributes become booleans. */
export function toSurfaceProps(attributes: Record<string, string>): SurfaceProps {
  const out: Record<string, string | boolean> = {};
  for (const [key, value] of Object.entries(attributes)) {
    out[key] =
      key === WIRE.domAttribute.disabled || key === WIRE.domAttribute.readOnly
        ? value === "true"
        : value;
  }
  return out as unknown as SurfaceProps;
}

// Easy mode: derive the surface from the rendered page ([S-AUTO-12]).
export { SurfaceProvider, useAutoSurface, useAutoSurfaceHandle } from "./react-auto";
export type { SurfaceProviderProps, UseAutoSurfaceOptions } from "./react-auto";
