// The page side of unattended mode: nothing new. The provider `axe surface init` mounted
// connects with the connection a host injected, and with the app's own relay otherwise.
import { autoSurface } from "@axe/surface/auto";
import { connectRelay, injectedRelay, relayOptions } from "@axe/relay/client";

// #region page
const handle = autoSurface({ root: document.body });
// In the host's hidden browser, `window.__AXE_RELAY__` is set before this script runs;
// relayOptions returns it (unattended: no indicator, approvals through the agent). In a
// person's own browser it returns the options given (attended).
connectRelay(
  handle.surface,
  relayOptions({
    url: "wss://relay.yogastudio.example/tab",
    getToken: () =>
      fetch("/api/relay-token", { method: "POST" }).then(
        async (r) => ((await r.json()) as { token: string }).token,
      ),
  }),
);
// #endregion page

// #region gate
// A development-only gate must still let a hosted session connect.
export const relayWanted = (dev: boolean): boolean => dev || injectedRelay() !== null;
// #endregion gate
