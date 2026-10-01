// The default parameterized actions of `domainActions`, shared with the WebMCP adapter's domain
// granularity. Type imports only: no Zod, so the page's WebMCP bundle can carry it.
import type { DomainActionSpec, DomainActionsOptions } from "./axe";

/**
 * The default parameterized actions when `domainActions` is given none: one per entry kind. Their
 * metadata is the ceiling for any entry of that kind, so every entry fits: `run-control` is
 * `risk: "high"`, not reversible, not idempotent.
 */
export function defaultDomains(
  options: Pick<DomainActionsOptions, "fields"> = {},
): DomainActionSpec[] {
  return [
    {
      name: "set-field",
      title: "Set a field",
      description:
        "Sets one of the application's fields through its own setter, as typing would. text is the new value; the field's maxLength and schema are on its observe row.",
      covers: (e) => e.kind === "field",
      risk: options.fields?.risk ?? "medium",
      idempotent: true,
      reversible: options.fields?.reversible ?? false,
      idleReason: "no field on the page can be edited right now",
    },
    {
      name: "run-control",
      title: "Run a control",
      description:
        "Runs one of the application's controls (a button, a switch) through its own handler, as a click would. Its observe row carries its effect: what it changes, its risk, whether it needs confirm: true or takes text.",
      covers: (e) => e.kind === "action",
      risk: "high",
      idempotent: false,
      reversible: false,
      idleReason: "no control on the page can be used right now",
    },
    {
      name: "load-more",
      title: "Load more rows",
      description:
        "Asks one of the application's collections to load more, as scrolling would. Its observe row carries total and loaded.",
      covers: (e) => e.kind === "collection",
      risk: "low",
      idempotent: false,
      reversible: false,
      idleReason: "no list on the page can load more right now",
    },
  ];
}
