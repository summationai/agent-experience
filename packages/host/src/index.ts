/**
 * @summationai/axe-host: unattended mode. The agent signs in; the SDK runs the application in a headless
 * browser for that person and the agent drives its real UI through the page's Surface, with no
 * pairing and no tab of the person's own. See docs/host.md and spec/SURFACE.md §9.2.
 */
export { createHost } from "./host";
/** Experimental: the agent web, a page's Surface for an agent with nothing installed (docs/agent-web.md). */
export { createAgentWeb } from "./agent-web";
export type {
  AgentWeb,
  AgentWebOptions,
  AgentSessionInfo,
  BindRequest,
  PendingInfo,
} from "./agent-web";
/** The global a host defines in the application's frames (`window.__AXE_RELAY__`), and its shape. */
export { INJECTED_RELAY_GLOBAL } from "@summationai/axe-relay/client";
export type { InjectedRelayConfig } from "@summationai/axe-relay/client";
export type {
  Host,
  HostAddress,
  HostBrowserOptions,
  HostCloseReason,
  HostDevOptions,
  HostEvent,
  HostHumanHandoffOptions,
  HostListenOptions,
  HostOptions,
  HostSessionInfo,
} from "./host";
export { cookieSession, SessionLoginRequired, storageStateSession } from "./session";
export type {
  AppSession,
  HostIdentity,
  SessionCookie,
  SessionFor,
  SessionRequest,
  StorageState,
} from "./session";
