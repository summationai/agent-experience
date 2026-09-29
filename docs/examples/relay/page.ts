// The page side of the relay: connect the page's surface for the signed-in person. Runs in the
// browser, after the controls are registered.
import { createSurface } from "@summationai/axe-surface";
import type { Surface } from "@summationai/axe-surface";
import { connectRelay, localMcpService, relayOptions } from "@summationai/axe-relay/client";
import type { RelayConnection, RelayStatus } from "@summationai/axe-relay/client";

const surface = createSurface({ app: "studio-schedule" });

// #region connect
// Your backend mints a short-lived relay token for the signed-in person (see the next example);
// the page asks for one on every connection and before the current one expires.
const relay = connectRelay(surface, {
  url: "wss://relay.yogastudio.example/tab",
  getToken: async () => {
    const res = await fetch("/api/relay-token", { method: "POST", credentials: "same-origin" });
    if (!res.ok) throw new Error("not signed in");
    return ((await res.json()) as { token: string }).token;
  },
});
// #endregion connect

// #region approval
// Only high-risk controls wait for the person; a control that declares confirm runs without it.
export const strict = connectRelay(surface, {
  url: "wss://relay.yogastudio.example/tab",
  getToken: () => "token-from-your-backend",
  requireApproval: (row) => row.effect?.risk === "high",
});
// #endregion approval

// #region rekey
// The person switched studios (tenants) without a reload: leave under the old identity and
// connect again with a token for the new one. No agent of the old tenant reaches the page after.
export function onStudioSwitched(): void {
  relay.rekey();
}
// #endregion rekey

// #region own-indicator
// Render the indicator with your own design system: turn the built-in one off and drive yours
// from onStatus. Your UI must show that an agent is connected and offer Stop and the approvals.
export function connectWithOwnIndicator(
  s: Surface,
  render: (status: RelayStatus, controls: RelayConnection) => void,
): RelayConnection {
  const connection: RelayConnection = connectRelay(s, {
    url: "wss://relay.yogastudio.example/tab",
    getToken: () =>
      fetch("/api/relay-token", { method: "POST" }).then(
        async (r) => ((await r.json()) as { token: string }).token,
      ),
    indicator: false,
    onStatus: (status) => render(status, connection),
  });
  return connection;
}
// #endregion own-indicator

// #region dynamic
// With server-side rendering, load the client in an effect: importing it touches no window,
// document, or WebSocket, and connecting happens only in the browser.
export async function startRelayInBrowser(s: Surface): Promise<() => void> {
  const { connectRelay: connect, localMcpService: local } =
    await import("@summationai/axe-relay/client");
  const connection = connect(s, local());
  return () => connection.disconnect();
}
// #endregion dynamic

// #region dev
// Local development against the company-side service (`pnpm mcp:dev` in the SDK checkout): the
// service hands out development tab tokens on loopback and shows an agent pairing code in the tab.
if (location.hostname === "localhost") {
  connectRelay(surface, localMcpService());
}
// #endregion dev

// #region unattended
// One line for both modes: in a hidden session a host opened for the person, the host injected
// the connection (`window.__AXE_RELAY__`: no pairing, no indicator, approvals in the agent's
// client); in a normal browser, the attended development relay below.
export function connectEitherWay(s: Surface): RelayConnection {
  return connectRelay(s, relayOptions(localMcpService()));
}
// #endregion unattended

// #region both
// A person is looking, but may also approve from the agent's client: whichever answers first.
export const either = connectRelay(surface, {
  url: "wss://relay.yogastudio.example/tab",
  getToken: () => "token-from-your-backend",
  approvals: "both",
});
// #endregion both

export { relay };
