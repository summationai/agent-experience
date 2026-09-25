// The page side of unattended mode: nothing new. The provider `axe surface init` mounted
// connects with the connection a host injected, and nothing connects anywhere else.
import { autoSurface } from "@axe/surface/auto";
import { connectRelay, injectedRelay } from "@axe/relay/client";

// #region page
const handle = autoSurface({ root: document.body });
// In the host's hidden browser, `window.__AXE_RELAY__` is set before this script runs, and
// injectedRelay() returns it (unattended: no indicator, approvals through the agent). In a
// person's own browser it returns null, and nothing connects.
const options = injectedRelay();
if (options) connectRelay(handle.surface, options);
// #endregion page

// #region fallback
// The attended fallback: the person's own tab connects to your relay when no host injected one.
export const relayConnection = (dev: boolean) =>
  injectedRelay() ??
  (dev
    ? {
        url: "wss://relay.yogastudio.example/tab",
        getToken: () =>
          fetch("/api/relay-token", { method: "POST" }).then(
            async (r) => ((await r.json()) as { token: string }).token,
          ),
      }
    : null);
// #endregion fallback

// #region gate
// A feature flag that is off for the person must still let a hosted session turn the surface on.
export const surfaceOn = (flag: boolean): boolean => flag || injectedRelay() !== null;
// #endregion gate
