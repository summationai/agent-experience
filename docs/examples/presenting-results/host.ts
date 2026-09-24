/**
 * The page that hosts a toHTML() document (directly or in an iframe) listens for the
 * selection and follows the affordance with the agent's client.
 */
import type { AXEClient } from "@axe/client";

declare const client: AXEClient;

// #region listen
interface AxeSelect {
  itemId: string;
  action: string;
  input: Record<string, unknown>;
}

// Rendered inline: the button dispatches on window.
window.addEventListener("axe:select", async (event) => {
  const { action, input } = (event as CustomEvent<AxeSelect>).detail;
  // Bound inputs are partial; add anything else the target's input schema requires before invoking.
  const result = await client.invoke(action, input);
  console.log(result.status);
});

// Rendered in an iframe: the same detail arrives by postMessage.
window.addEventListener("message", (event: MessageEvent<{ type?: string; detail?: AxeSelect }>) => {
  if (event.data?.type !== "axe:select" || !event.data.detail) return;
  const { action, input } = event.data.detail;
  void client.invoke(action, input);
});
// #endregion listen
