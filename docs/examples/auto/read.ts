// Reading what the page shows, and waiting for slow work, on an auto surface.
import type { SurfaceConfig } from "@summationai/axe-surface/auto";
import { handle } from "./start";

// #region read
import { formatRead } from "@summationai/axe-surface/auto";

// The whole page, as sections by heading: text, fields, tables, lists.
const page = handle.read();
const status = page.sections.find((s) => s.heading === "Project status");
console.log(status?.fields); // [{ label: "Status", value: "At risk" }, { label: "Owner", ... }]

// One region, filtered, bounded; the cursor continues where a page of the result stopped.
const tasks = handle.read({ region: "Open tasks", query: "overdue", maxRows: 20 });
if (tasks.nextCursor) handle.read({ region: "Open tasks", cursor: tasks.nextCursor });

// Markdown for an agent or a terminal.
console.log(formatRead(page));
// #endregion read

// #region regions
export const readConfig: SurfaceConfig = {
  read: {
    // Parts of the page an agent may name, by selector you review.
    regions: { status: ".status-card", report: "#report-body" },
    // Never read, beside every data-surface-ignore subtree.
    exclude: [".debug-drawer"],
  },
  // Withheld from read as well as from observe.
  sensitive: [".api-key"],
};
// #endregion regions

// #region wait
export async function generateReport(): Promise<string | null> {
  const view = handle.surface.observe();
  const generate = view.entries.find((row) => row.name === "Generate report");
  if (!generate) return null;
  await handle.surface.act({ op: "CLICK", target: generate.id, expectedRev: view.rev });

  // Until the report's text appears (or a toast says so), a failure shows, or 90 s pass.
  const done = await handle.wait(
    { any: [{ text: "Report ready" }, { text: "/failed|error/i" }] },
    { timeoutMs: 90_000 },
  );
  if (!done.met) return null;
  // A streamed report: wait until the page has been quiet for a second, then read it.
  await handle.wait({ idle: 1000 }, { timeoutMs: 30_000 });
  return formatRead(handle.read({ region: "report" }));
}
// #endregion wait
