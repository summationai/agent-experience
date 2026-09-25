/**
 * `autoActions`: the recommended AXE bridge for an auto surface ([S-AUTO-11]). Generic tools, not
 * one per widget: `domainActions` over `autoDomains()` (one action per configured group, then
 * `navigate`, `set-field`, `run-control`, `load-more`), with `<ns>.observe` and `<ns>.ledger`.
 * Declared entries still get their own per-control actions from `surfaceActions` when an
 * application wants them.
 */
import type { Surface } from "./index";
import type { AutoSurfaceHandle } from "./auto";
import { autoDomains } from "./auto-domains";
import { domainActions } from "./axe";
import type { DomainActionsOptions, DomainBridge } from "./axe";

/**
 * The domain-action bridge for an auto surface. Pass the handle (so configured `groups` become
 * actions) or a bare surface. `domains` in `options` replaces the auto set. The set is fixed for
 * the life of the bridge; a later `handle.configure()` that adds a group needs a new bridge.
 */
export function autoActions(
  source: AutoSurfaceHandle | Surface,
  options: DomainActionsOptions = {},
): DomainBridge {
  const handle = "surface" in source && "coverage" in source ? source : null;
  const surface = handle ? handle.surface : (source as Surface);
  const groups = handle?.config().groups;
  const domains =
    options.domains ??
    autoDomains({
      ...(groups ? { groups } : {}),
      ...(options.fields?.risk ? { fieldRisk: options.fields.risk } : {}),
    });
  return domainActions(surface, { ...options, domains });
}
