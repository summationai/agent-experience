// The DOM mirror: the names an agent reads through observe() are the accessible names a browser
// agent or a screen reader reads on the page, from the same entries.
// #region attributes
import { describeEntry, surfaceAttributes, surfaceSelector } from "@axe/surface";
import type { Entry } from "@axe/surface";
import { surface } from "./board";

// Rendering by hand: carry every attribute the helper returns on the element that receives the
// interaction. The application keeps its own disabled logic; the mirror only reports it.
export function renderButton(entry: Entry, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  for (const [attribute, value] of Object.entries(surfaceAttributes(entry)))
    button.setAttribute(attribute, value);
  button.disabled = entry.kind === "action" && entry.state?.available === false;
  button.textContent = "Draft";
  button.addEventListener("click", onClick);
  return button;
}
// #endregion attributes

// #region mirror
// Re-rendering a control that stays on screen: read the live availability, so a freeze shows
// with its reason and a reason from the previous render is removed.
export function mirror(element: Element, id: string): void {
  const update = surface.attributesFor(id);
  if (!update) return;
  for (const name of update.remove) element.removeAttribute(name);
  for (const [name, value] of Object.entries(update.set)) element.setAttribute(name, value);
}
// #endregion mirror

// #region follow
// Keep one control's mirror current outside React: `subscribe` fires after every change a reader
// could see, registration and an application-owned `setRev` included. Returns the unsubscribe.
export function follow(element: Element, id: string): () => void {
  mirror(element, id);
  return surface.subscribe(() => mirror(element, id));
}
// #endregion follow

// #region selector
// A browser agent or a test goes from an observed row to its control with one query, whatever
// the id contains.
export function controlFor(id: string): Element | null {
  return document.querySelector(surfaceSelector(id));
}
// #endregion selector

// #region describe
// One line per entry, for an agent log or as the control's aria-description.
export function logSurface(): void {
  for (const row of surface.observe().entries) console.log(describeEntry(row));
}
// #endregion describe
