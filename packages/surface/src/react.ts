/**
 * @axe/surface/react: keep one entry registered while a component is mounted.
 *
 * Refresh replaces the entry in place rather than unregister-then-register: the table is an
 * insertion-ordered map, and delete-then-set would move a row to the end every time a sibling
 * re-rendered, so an agent's index would jump. Only unmount removes the row.
 */
import { useEffect, useRef } from "react";
import type { DependencyList } from "react";
import type { Entry, Surface } from "./index";
import { surface as defaultSurface } from "./index";

/**
 * `entry` is the object `register` takes. `deps` are the values it was computed from; the entry is
 * re-registered when they change, which is how availability and values stay current.
 *
 * Transient states belong in `deps` too: a `saving` or `loading` flag, an open modal, anything the
 * component uses to disable its own control. Left out, the surface keeps reporting the control
 * available while the UI has frozen it, and an act runs into a disabled control ([S-REV-5]). For a
 * state that spans the whole page, `surface.freeze(reason)` is the shorter route.
 */
export function useSurface(
  entry: Entry,
  deps: DependencyList,
  target: Surface = defaultSurface,
): void {
  const id = useRef(entry.id);
  // `deps` is the caller's list on purpose: the entry is a fresh object every render, so depending on
  // it would re-register on every render; the caller names the values the entry was computed from.
  useEffect(() => {
    target.register(entry);
  }, deps);
  useEffect(() => () => target.unregister(id.current), [target]);
}
