// Easy mode in a page: derive the surface from what the page renders, publish it for browser
// agents, and read what it could not tell.
// #region start
import { autoSurface, formatCoverage } from "@summationai/axe-surface/auto";

export const handle = autoSurface({ expose: true });

// What was derived, how sure each name is, and what the page could not say.
console.log(formatCoverage(handle.coverage()));
// #endregion start

// #region act
// The handle's surface is an ordinary surface: observe, act, ledger.
export async function saveProfile(): Promise<void> {
  const { surface } = handle;
  const view = surface.observe();
  const save = view.entries.find((row) => row.name === "Save profile");
  if (!save) return;
  const result = await surface.act({ op: "CLICK", target: save.id, expectedRev: view.rev });
  if (result.status === "ok")
    console.log("changed", result.output.changed, "said", result.output.notices);
  else console.log(result.error.code, result.error.message);
}
// #endregion act
