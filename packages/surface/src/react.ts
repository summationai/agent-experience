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
import { surface as defaultSurface, surfaceAttributes } from "./index";
import * as WIRE from "@axe/core/vocabulary";

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
 * name a browser agent or screen reader reads is the name `observe()` reports.
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
  return toSurfaceProps(surfaceAttributes(entry));
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
