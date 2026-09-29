/**
 * @summationai/axe-relay/client: let an agent outside the browser drive this tab's surface, through a relay
 * server the page connects to.
 *
 * `connectRelay(surface, options)` opens one WebSocket from the page to the relay, authenticates
 * with a short-lived relay token your backend minted for the signed-in person, and then answers
 * the relay: snapshots of `surface.observe()` and the ledger, and acts, which run through
 * `surface.act` in this page, so the page's act queue, revision check, availability, handlers,
 * and ledger apply exactly as for a click. While connected it shows an in-page indicator with a
 * Stop control; Stop disconnects and refuses every further act from the relay. A high-risk act
 * (or one whose effect asks for confirmation) waits for the person to approve it in the indicator.
 *
 * Unattended mode (`mode: "unattended"`, usually from `injectedRelay()`): the tab runs in a hidden
 * browser session a host started for the person, so there is no indicator by default, and the
 * person approves in the agent's own MCP client instead; the relay tells the tab (`approve`).
 *
 * Browser-native only: no framework, no Zod, no Node built-ins. See docs/relay.md.
 */
import type {
  ActRequest,
  ActResult,
  LedgerEntry,
  ObservedEntry,
  Surface,
} from "@summationai/axe-surface";
import type { ErrorResult, JsonValue } from "@summationai/axe-core/types";
import { CLOSE, ID_PATTERN, RELAY_HANDOFF_WINDOW_PREFIX, RELAY_PROTOCOL } from "./protocol";
import type { RelayApprovalChannel, RelayMessage, RelayMode, TabMessage } from "./protocol";

export { RELAY_PROTOCOL };
export type { RelayApprovalChannel, RelayMode };

/**
 * Where the connection stands. `connecting`: opening the first connection. `pairing`: connected
 * in development mode and waiting for an agent to pair with the code shown. `connected`: an agent
 * may act. `acting`: an agent has read or acted through this tab. `reconnecting`: the connection
 * dropped and the client is retrying. `disconnected`: the application disposed this connection
 * without revoking the tab (for example, a component unmounted). `stopped`: the person pressed
 * Stop (or `stop()` was called). `refused`: the relay refused the page (origin, tenant, or token),
 * and the client does not retry.
 */
export type RelayState =
  | "connecting"
  | "pairing"
  | "connected"
  | "acting"
  | "reconnecting"
  | "disconnected"
  | "stopped"
  | "refused";

/** An act waiting for the person's decision in the page. */
export interface RelayApproval {
  id: string;
  entryId: string;
  /** The control's name, in the application's words. */
  name: string;
  /** The text the act carries, when it has one and the entry is not sensitive. */
  text?: string;
  /** When the request lapses, ms since the epoch. */
  expiresAt: number;
  state: "pending" | "approved" | "denied";
}

/** What `onStatus` receives and `connection.status()` returns. */
export interface RelayStatus {
  state: RelayState;
  /** This browser tab's id; kept across reloads in `sessionStorage`. */
  tabId: string;
  /** The person the relay recognized from the token; null before `ready`. */
  principal: string | null;
  /** The development pairing code to give the agent, while in `pairing`. */
  pairingCode: string | null;
  /** Acts waiting for the person's approval. */
  approvals: RelayApproval[];
  /** Why the relay refused or the connection stopped, when it said. */
  reason: string | null;
}

export interface ConnectRelayOptions {
  /** The relay's tab endpoint: `wss://relay.example.com/tab`. An `http(s)` URL is converted, and a bare origin gets `/tab`. */
  url: string;
  /** A relay token your backend minted for the signed-in person (`mintRelayToken`). */
  token?: string;
  /**
   * Returns a fresh relay token; called on every connection and before the current one expires,
   * so the connection outlives any one token. Prefer it to `token`.
   */
  getToken?: () => string | Promise<string>;
  /** Told after every change of `RelayStatus`. */
  onStatus?: (status: RelayStatus) => void;
  /**
   * `attended` (the default): a person is looking at this tab. `unattended`: the tab runs in a
   * hidden browser session a host started for the person (`injectedRelay()` says so), so the
   * indicator is off by default and approvals go to the agent's MCP client.
   */
  mode?: RelayMode;
  /**
   * Where the person decides an act that needs approval: `page` (the indicator's Approve and
   * Deny, or your own UI), `agent` (the relay asks through the calling agent's MCP client, and
   * tells this tab the answer), or `both` (whichever answers first). Default `page` when
   * attended, `agent` when unattended. Only with `agent` or `both` does the tab accept a decision
   * from the relay.
   */
  approvals?: RelayApprovalChannel;
  /**
   * The in-page indicator: `true` (the default when attended) renders a small fixed panel in the
   * page's corner, an `Element` renders it inside that element, and `false` (the default when
   * unattended) renders nothing, in which case your own UI must show `onStatus` and offer
   * `stop()`, `approve()`, and `deny()` when a person is looking.
   */
  indicator?: boolean | Element;
  /**
   * Which acts wait for the person's approval in the page. Default: an action whose effect is
   * `risk: "high"` or declares `confirm`. Return false to let an entry run without approval.
   */
  requireApproval?: (row: ObservedEntry) => boolean;
  /** How long an approval request stays open, in ms. Default 300000 (five minutes). */
  approvalTtlMs?: number;
  /** Reconnect backoff. Default: from 500 ms, doubling, at most 30000 ms, with jitter. */
  backoff?: { initialMs?: number; maxMs?: number };
  /** The WebSocket constructor. Default: the global one. */
  WebSocket?: typeof WebSocket;
  /** Where the tab id is kept across reloads. Default `sessionStorage`; `null` keeps it in memory. */
  storage?: Pick<Storage, "getItem" | "setItem"> | null;
  /** What the agent's tab list shows for this page. Default: `document.title` and `location.pathname` (never the query). */
  describe?: () => { title: string; path: string };
}

/** What `connectRelay` returns. */
export interface RelayConnection {
  readonly tabId: string;
  status(): RelayStatus;
  /** Dispose this page connection without revoking access; a later connection may reattach. */
  disconnect(): void;
  /** Disconnect for good (the Stop button): the relay revokes the token and refuses further acts. */
  stop(): void;
  /** Approve a pending act; the agent's next identical call runs it. Returns false for an unknown id. */
  approve(id: string): boolean;
  /** Deny a pending act; the agent's next identical call is refused. Returns false for an unknown id. */
  deny(id: string): boolean;
  /**
   * The signed-in person or the tenant changed in the page (a tenant switch without a reload):
   * leave the relay under the old identity, dropping every pending approval, and connect again
   * with `token` or a fresh `getToken()`. The relay forgets the old tab record and revokes its
   * token, so no agent of the old principal or tenant reaches the page afterwards.
   */
  rekey(token?: string): void;
}

const TAB_ID_KEY = "axe-relay:tab-id";

function randomId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function defaultStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** The relay's tab endpoint from what the application passed. */
export function tabEndpoint(url: string): string {
  const u = new URL(url);
  if (u.protocol === "http:") u.protocol = "ws:";
  else if (u.protocol === "https:") u.protocol = "wss:";
  if (u.pathname === "" || u.pathname === "/") u.pathname = "/tab";
  u.hash = "";
  return u.href;
}

/**
 * A `getToken` for local development: asks the local MCP service (or the lower-level
 * `axe relay --dev` process) for a development token. The relay serves it on loopback only, to
 * allowed origins only; never use this in production, where an authenticated service issues a
 * token for the signed-in person.
 */
export function devToken(relayUrl: string): () => Promise<string> {
  const u = new URL(relayUrl);
  if (u.protocol === "ws:") u.protocol = "http:";
  else if (u.protocol === "wss:") u.protocol = "https:";
  const endpoint = new URL("/dev/token", u.origin).href;
  return async () => {
    const res = await fetch(endpoint, { method: "POST", credentials: "omit" });
    if (!res.ok) throw new Error(`The relay refused a development token (${res.status}).`);
    const body = (await res.json()) as { token?: unknown };
    if (typeof body.token !== "string") throw new Error("The relay sent no token.");
    return body.token;
  };
}

/** Default origin of the company-side MCP service while it is run locally. */
export const LOCAL_MCP_SERVICE_URL = "http://127.0.0.1:4717";

/**
 * Connection options for the local Agent Experience MCP service. The website receives a
 * short-lived development tab token from the service; desktop agents authenticate separately at
 * its `/mcp` endpoint and pair with the code shown in the page.
 */
export function localMcpService(serviceUrl = LOCAL_MCP_SERVICE_URL): ConnectRelayOptions {
  return { url: serviceUrl, getToken: devToken(serviceUrl) };
}

/** The global an optional host sets before page code runs: `window.__AXE_RELAY__`. */
export const INJECTED_RELAY_GLOBAL = "__AXE_RELAY__";
const HANDOFF_STORAGE_KEY = "axe-relay:handoff";

/** What a host puts in `window.__AXE_RELAY__`. */
export interface InjectedRelayConfig {
  /** The relay's tab endpoint. */
  url: string;
  /** A relay token the host minted for the person the session is for. */
  token: string;
  mode: RelayMode;
  /** Show the in-page indicator. Default: on when attended, off when unattended. */
  indicator?: boolean;
  /** Optional: a function (an exposed binding) that returns a fresh token, for sessions that outlive one. */
  getToken?: () => string | Promise<string>;
}

interface HandoffBootstrap {
  service: string;
  handoffToken?: string;
  sessionToken?: string;
}

function handoffBootstrap(): HandoffBootstrap | null {
  let storage: Storage | null = null;
  try {
    storage = typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    storage = null;
  }
  try {
    const named = typeof window === "undefined" ? "" : window.name;
    if (named.startsWith(RELAY_HANDOFF_WINDOW_PREFIX)) {
      const value = JSON.parse(named.slice(RELAY_HANDOFF_WINDOW_PREFIX.length)) as HandoffBootstrap;
      if (typeof value.service === "string" && typeof value.handoffToken === "string") {
        storage?.setItem(HANDOFF_STORAGE_KEY, JSON.stringify(value));
        window.name = "";
      }
    }
  } catch {
    // A malformed or inaccessible window name is not a relay instruction.
  }
  try {
    const raw = storage?.getItem(HANDOFF_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as HandoffBootstrap;
    const service = new URL(value.service);
    if (service.protocol !== "https:" && service.protocol !== "http:") return null;
    if (
      (typeof value.handoffToken !== "string" || !value.handoffToken) &&
      (typeof value.sessionToken !== "string" || !value.sessionToken)
    )
      return null;
    return { ...value, service: service.origin };
  } catch {
    return null;
  }
}

function handoffRelay(): ConnectRelayOptions | null {
  const bootstrap = handoffBootstrap();
  if (!bootstrap) return null;
  let sessionToken = bootstrap.sessionToken;
  const handoffToken = bootstrap.handoffToken;
  if (!sessionToken && !handoffToken) return null;
  return {
    url: bootstrap.service,
    mode: "attended",
    indicator: true,
    getToken: async () => {
      if (sessionToken) return sessionToken;
      const response = await fetch(new URL("/connect/exchange", bootstrap.service), {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: handoffToken!,
        credentials: "omit",
      });
      if (!response.ok)
        throw new Error(`The relay connection handoff was refused (${response.status}).`);
      const body = (await response.json()) as { token?: unknown };
      if (typeof body.token !== "string" || !body.token)
        throw new Error("The relay connection handoff returned no token.");
      sessionToken = body.token;
      try {
        sessionStorage.setItem(
          HANDOFF_STORAGE_KEY,
          JSON.stringify({ service: bootstrap.service, sessionToken }),
        );
      } catch {
        // The live page can still use the in-memory token when storage is unavailable.
      }
      return sessionToken;
    },
  };
}

/**
 * A scoped provider connection as `connectRelay` options: either `window.__AXE_RELAY__` from an
 * optional host, or a one-time browser handoff persisted in this tab's session storage. Reads at
 * call time, never at import. Neither path uses pairing.
 */
export function injectedRelay(): ConnectRelayOptions | null {
  const raw = (globalThis as Record<string, unknown>)[INJECTED_RELAY_GLOBAL];
  if (!raw || typeof raw !== "object") return handoffRelay();
  const c = raw as Partial<InjectedRelayConfig>;
  if (typeof c.url !== "string" || !c.url) return null;
  const hasToken = typeof c.token === "string" && c.token.length > 0;
  if (!hasToken && typeof c.getToken !== "function") return null;
  const mode: RelayMode = c.mode === "attended" ? "attended" : "unattended";
  return {
    url: c.url,
    ...(hasToken ? { token: c.token as string } : {}),
    ...(typeof c.getToken === "function" ? { getToken: c.getToken } : {}),
    mode,
    indicator: typeof c.indicator === "boolean" ? c.indicator : mode === "attended",
  };
}

/**
 * `injectedRelay()` when a host injected a connection, else `fallback` (your attended relay, such
 * as the development one). The injected connection replaces the fallback's `url`, token,
 * `mode`, `approvals`, and `indicator`; the fallback's other options (`onStatus`,
 * `requireApproval`, `describe`, ...) are kept. `connectRelay(surface, relayOptions(dev))`.
 */
export function relayOptions(fallback: ConnectRelayOptions): ConnectRelayOptions {
  const injected = injectedRelay();
  if (!injected) return fallback;
  const {
    url: _url,
    token: _token,
    getToken: _getToken,
    mode: _mode,
    approvals: _approvals,
    indicator: _indicator,
    ...rest
  } = fallback;
  return { ...rest, ...injected };
}

/** The surface's own approval gate (an auto-derived surface's policy), shared by symbol. */
const APPROVER = Symbol.for("axe.surface.approver");
/** The surface's page-content reader (`read`, `wait`; `CONTENT` in `@summationai/axe-surface/auto`). */
const CONTENT = Symbol.for("axe.surface.content");

interface PageContentLike {
  read(options: unknown): unknown;
  wait(condition: unknown, options: unknown): Promise<unknown>;
}

function defaultRequireApproval(row: ObservedEntry): boolean {
  if (row.kind !== "action") return false;
  // A control the surface itself holds for the person's approval: the same request, one decision.
  const gated =
    row.state?.available === false &&
    (row.state as { handoff?: { reason?: string; url?: string } } | undefined)?.handoff?.reason ===
      "approval_required";
  return gated || row.effect?.risk === "high" || row.effect?.confirm === true;
}

function errorOf(
  code: ErrorResult["error"]["code"],
  message: string,
  details?: Record<string, JsonValue>,
  retryable = false,
): ErrorResult {
  return {
    status: "error",
    error: { code, message, retryable, ...(details ? { details } : {}) },
  };
}

/**
 * Connect this page's surface to a relay so an authorized agent can observe and act on it.
 * Returns at once; the connection opens, authenticates, and reconnects in the background.
 */
export function connectRelay(surface: Surface, options: ConnectRelayOptions): RelayConnection {
  if (!options.token && !options.getToken)
    throw new Error(
      "connectRelay: pass token or getToken (a relay token for the signed-in person).",
    );
  const endpoint = tabEndpoint(options.url);
  const WS = options.WebSocket ?? (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;
  if (!WS) throw new Error("connectRelay: this environment has no WebSocket.");
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const requireApproval = options.requireApproval ?? defaultRequireApproval;
  const mode: RelayMode = options.mode === "unattended" ? "unattended" : "attended";
  const channel: RelayApprovalChannel =
    options.approvals ?? (mode === "unattended" ? "agent" : "page");
  const fromAgent = channel !== "page";
  const approvalTtl = options.approvalTtlMs ?? 300_000;
  const initialBackoff = options.backoff?.initialMs ?? 500;
  const maxBackoff = options.backoff?.maxMs ?? 30_000;
  const describe =
    options.describe ??
    (() => ({
      title: typeof document !== "undefined" ? document.title : "",
      path: typeof location !== "undefined" ? location.pathname : "",
    }));

  const readTabId = (): string => {
    try {
      const kept = storage?.getItem(TAB_ID_KEY);
      if (kept && ID_PATTERN.test(kept)) return kept;
    } catch {
      // storage blocked: an id for this page only
    }
    return newTabId();
  };
  const newTabId = (): string => {
    const id = randomId();
    try {
      storage?.setItem(TAB_ID_KEY, id);
    } catch {
      // as above
    }
    return id;
  };
  let tabId = readTabId();
  const instance = randomId();

  let ws: WebSocket | null = null;
  let stopped = false;
  let everReady = false;
  let attempt = 0;
  let unauthorizedInRow = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let renewTimer: ReturnType<typeof setTimeout> | undefined;
  let changeTimer: ReturnType<typeof setTimeout> | undefined;
  let actor = "agent via relay";
  const approvals = new Map<string, RelayApproval & { key: string }>();
  /** Acts running in the page, by the relay's request id. */
  const inflight = new Map<number, { since: number; request: ActRequest; entryId: string }>();
  const status: RelayStatus = {
    state: "connecting",
    tabId,
    principal: null,
    pairingCode: null,
    approvals: [],
    reason: null,
  };

  const wanted = options.indicator ?? mode === "attended";
  const indicator =
    wanted === false || (typeof document === "undefined" && !(wanted && wanted !== true))
      ? null
      : createIndicator(wanted === true ? null : wanted, channel !== "agent", {
          stop: () => connection.stop(),
          approve: (id) => connection.approve(id),
          deny: (id) => connection.deny(id),
        });

  const publish = (patch: Partial<RelayStatus> = {}): void => {
    Object.assign(status, patch, { tabId });
    const now = Date.now();
    for (const [id, a] of approvals) if (a.expiresAt <= now) approvals.delete(id);
    status.approvals = [...approvals.values()]
      .filter((a) => a.state === "pending")
      .map(({ key: _key, ...a }) => ({ ...a }));
    indicator?.update(status);
    try {
      options.onStatus?.({ ...status, approvals: status.approvals.map((a) => ({ ...a })) });
    } catch {
      // a listener's failure is not the connection's
    }
  };

  const send = (message: TabMessage): void => {
    if (ws && ws.readyState === WS.OPEN) ws.send(JSON.stringify(message));
  };

  const ledgerSince = (since: number): LedgerEntry[] =>
    surface.ledger(Number.isFinite(since) && since >= 0 ? { since } : {});

  const lastSeq = (): number => surface.ledger({ limit: 1 })[0]?.seq ?? 0;

  // Change notifications [S-OBS-4]: coalesced, a revision and a ledger position; the relay asks
  // for the full table when an agent reads.
  const offChange = surface.subscribe(() => {
    if (changeTimer !== undefined || stopped) return;
    changeTimer = setTimeout(() => {
      changeTimer = undefined;
      const d = describe();
      send({
        t: "changed",
        rev: surface.currentRev(),
        ledgerSeq: lastSeq(),
        title: String(d.title ?? "").slice(0, 200),
        path: String(d.path ?? "").slice(0, 500),
      });
    }, 25);
  });

  const onActive = (): void => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    send({ t: "active" });
  };
  const onUnload = (): void => {
    // An act whose click navigated this page (a link, a form that posts and reloads) never
    // settles here: say so before the socket closes, so the agent is told the act ran. Only for
    // an unload that began as a navigation (`beforeunload` fired): a page closed by its browser
    // (a host ending the session) leaves the relay to report the outcome as unknown.
    for (const [id, a] of navigating ? inflight : []) {
      let seq = lastSeq();
      try {
        seq =
          surface.record({ op: a.request.op, target: a.entryId, actor, changed: [] }).seq ?? seq;
      } catch {
        // the answer stands without its ledger line
      }
      send({
        t: "result",
        re: id,
        result: {
          status: "ok",
          output: {
            rev: surface.currentRev(),
            id: a.entryId,
            actor,
            changed: [],
            seq,
            navigated: true,
            notices: [
              "The page navigated while acting: the act ran and the page is loading another page. Observe (or read) the new page before acting again.",
            ],
          },
        },
        observation: surface.observe(),
        ledger: ledgerSince(a.since),
      });
    }
    inflight.clear();
    // Leaving the page is not Stop: the token is not revoked, and a reload reattaches.
    shutDown(1000, "unload", "disconnected", null);
  };
  let navigating = false;
  const onBeforeUnload = (): void => {
    navigating = true;
  };
  if (typeof addEventListener === "function") {
    addEventListener("focus", onActive);
    addEventListener("beforeunload", onBeforeUnload);
    addEventListener("pagehide", onUnload);
  }
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onActive);

  const detach = (): void => {
    offChange();
    if (typeof removeEventListener === "function") {
      removeEventListener("focus", onActive);
      removeEventListener("beforeunload", onBeforeUnload);
      removeEventListener("pagehide", onUnload);
    }
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onActive);
  };

  const shutDown = (code: number, reason: string, state: RelayState, why: string | null): void => {
    stopped = true;
    clearTimeout(retryTimer);
    clearTimeout(renewTimer);
    clearTimeout(changeTimer);
    for (const a of approvals.values()) a.state = "denied";
    detach();
    const socket = ws;
    ws = null;
    if (socket && socket.readyState <= WS.OPEN) {
      try {
        socket.close(code, reason);
      } catch {
        // already closing
      }
    }
    publish({ state, reason: why, pairingCode: null });
    indicator?.destroy();
  };

  let staticToken = options.token;
  let nextToken: string | undefined;
  // Moves on every rekey, so a connection attempt begun under the old identity gives up.
  let generation = 0;
  const tokenNow = async (): Promise<string> => {
    if (nextToken !== undefined) {
      const t = nextToken;
      nextToken = undefined;
      return t;
    }
    return options.getToken ? await options.getToken() : (staticToken as string);
  };

  const scheduleRetry = (): void => {
    if (stopped) return;
    const base = Math.min(maxBackoff, initialBackoff * 2 ** attempt);
    attempt += 1;
    const delay = base * (0.5 + Math.random() / 2);
    publish({ state: everReady ? "reconnecting" : "connecting" });
    retryTimer = setTimeout(() => void open(), delay);
  };

  const scheduleRenew = (expiresAt: number): void => {
    clearTimeout(renewTimer);
    if (!options.getToken) return;
    const left = expiresAt - Date.now();
    const lead = Math.min(60_000, Math.max(1000, left * 0.2));
    renewTimer = setTimeout(
      () => {
        void (async () => {
          try {
            send({ t: "renew", token: await tokenNow() });
          } catch {
            // the relay closes at expiry; the reconnect asks for a token again
          }
        })();
      },
      Math.max(0, left - lead),
    );
  };

  /** An act from the relay, gated by the person's approval when the entry calls for it. */
  const runAct = async (id: number, since: number, request: ActRequest): Promise<void> => {
    const reply = (result: ActResult | ErrorResult): void =>
      send({
        t: "result",
        re: id,
        result,
        observation: surface.observe(),
        ledger: ledgerSince(since),
      });
    if (stopped) return reply(errorOf("forbidden", "The person stopped agent access in this tab."));
    const view = surface.observe();
    const row =
      typeof request.target === "number"
        ? view.entries.find((r) => r.index !== null && r.index === request.target)
        : view.entries.find((r) => r.id === request.target);
    if (row && requireApproval(row)) {
      const key = JSON.stringify([
        row.id,
        request.op,
        request.text ?? null,
        request.confirm ?? false,
        request.expectedRev,
      ]);
      const now = Date.now();
      let held: (RelayApproval & { key: string }) | undefined;
      for (const a of approvals.values()) if (a.key === key && a.expiresAt > now) held = a;
      if (held?.state === "approved") {
        approvals.delete(held.id);
        publish();
      } else if (held?.state === "denied") {
        approvals.delete(held.id);
        publish();
        return reply(
          errorOf(
            "forbidden",
            `The person declined "${row.name}" in the tab. Do not retry it unless they ask you to.`,
            { reason: "approval_denied", entryId: row.id },
          ),
        );
      } else {
        if (!held) {
          // One open request per control: a newer one (another revision or text) replaces it.
          for (const [aid, a] of approvals) if (a.entryId === row.id) approvals.delete(aid);
          held = {
            id: randomId(),
            key,
            entryId: row.id,
            name: row.name,
            expiresAt: now + approvalTtl,
            state: "pending",
          };
          if (request.text !== undefined && !row.sensitive) held.text = request.text;
          approvals.set(held.id, held);
          publish();
        }
        return reply(
          errorOf(
            "unavailable",
            channel === "agent"
              ? `"${row.name}" needs the person's approval before it runs, and no one is looking at this tab: the relay asks them through your MCP client. When they approve, call this tool again with the same arguments and the same expectedRev. Nothing was applied.`
              : `"${row.name}" needs the person's approval in the tab before it runs. Ask them to approve it in the page's agent panel, then call this tool again with the same arguments and the same expectedRev. Nothing was applied.`,
            {
              reason: "approval_required",
              approval: { id: held.id, expiresAt: new Date(held.expiresAt).toISOString() },
              rev: request.expectedRev,
              whatAgentShouldSayToUser:
                channel === "agent"
                  ? `I would like to "${row.name}". Please approve it when your client asks, if you agree.`
                  : `I would like to "${row.name}" in your open tab. Please approve it in the agent panel on the page if you agree.`,
            },
            true,
          ),
        );
      }
    }
    if (status.state === "connected") publish({ state: "acting" });
    let result: ActResult;
    inflight.set(id, { since, request, entryId: row?.id ?? String(request.target) });
    try {
      result = await surface.act({ ...request, actor });
    } catch (e) {
      if (!inflight.delete(id)) return;
      // The handler threw; the surface recorded it as `internal` [S-LED-4].
      return reply(
        errorOf(
          "internal",
          `The page's handler failed: ${e instanceof Error ? e.message : String(e)}`,
        ),
      );
    }
    // Answered already when the page unloaded mid-act.
    if (!inflight.delete(id)) return;
    reply(result);
  };

  const onMessage = (data: unknown): void => {
    if (typeof data !== "string") return;
    let m: RelayMessage;
    try {
      m = JSON.parse(data) as RelayMessage;
    } catch {
      return;
    }
    switch (m.t) {
      case "ready":
        everReady = true;
        attempt = 0;
        unauthorizedInRow = 0;
        actor = m.actor;
        scheduleRenew(m.expiresAt);
        publish({
          state:
            m.pairing && !m.agent ? "pairing" : status.state === "acting" ? "acting" : "connected",
          principal: m.principal,
          pairingCode: m.pairing && !m.agent ? m.pairing.code : null,
          reason: null,
        });
        return;
      case "renewed":
        scheduleRenew(m.expiresAt);
        return;
      case "agent":
        publish({
          state:
            m.state === "active" ? "acting" : status.state === "acting" ? "acting" : "connected",
          pairingCode: null,
        });
        return;
      case "sync":
        send({
          t: "snapshot",
          re: m.id,
          observation: surface.observe(),
          ledger: ledgerSince(m.since),
        });
        return;
      case "act":
        void runAct(m.id, m.since, m.request);
        return;
      case "record": {
        // A refusal the relay's runtime made before this page ([S-AXE-14]). Recorded under this
        // connection's relay actor, like the agent's acts, so the page's ledger has no gap.
        try {
          if (stopped) throw new Error("The person stopped agent access in this tab.");
          surface.record({ ...m.change, actor });
          send({
            t: "recorded",
            re: m.id,
            observation: surface.observe(),
            ledger: ledgerSince(m.since),
          });
        } catch (e) {
          send({ t: "recorded", re: m.id, error: e instanceof Error ? e.message : String(e) });
        }
        return;
      }
      case "approve":
      case "deny": {
        // A decision the person made outside the page (the agent's MCP client, or the relay's
        // approval page), accepted only when this page said approvals may come from the agent.
        let ok = false;
        let error: string | undefined;
        const a = approvals.get(String(m.approval));
        const want = m.t === "approve" ? "approved" : "denied";
        if (stopped) error = "The person stopped agent access in this tab.";
        else if (!fromAgent) error = "This tab takes approvals in the page only.";
        else if (!a || a.expiresAt <= Date.now())
          error = "No such approval is open (it lapsed or was replaced).";
        else if (a.state === "pending") {
          if (m.t === "approve") grant(a);
          else a.state = "denied";
          ok = true;
          try {
            surface.record({
              op: m.t,
              target: a.entryId,
              actor: String(m.by || "the person").slice(0, 200),
              changed: [],
            });
          } catch {
            // the decision stands without its ledger line
          }
          publish();
        } else ok = a.state === want;
        send({
          t: "decided",
          re: m.id,
          ok,
          ...(error ? { error } : {}),
          observation: surface.observe(),
          ledger: ledgerSince(m.since),
        });
        return;
      }
      case "read":
      case "wait": {
        void (async () => {
          try {
            if (stopped) throw new Error("the person stopped agent access in this tab");
            const content = (surface as unknown as Record<symbol, PageContentLike | undefined>)[
              CONTENT
            ];
            if (!content)
              throw new Error(
                "this page does not publish its content: it runs no auto surface (autoSurface from @summationai/axe-surface/auto)",
              );
            if (status.state === "connected") publish({ state: "acting" });
            const result =
              m.t === "read"
                ? await content.read(m.options ?? {})
                : await content.wait(m.condition, m.options ?? {});
            send({ t: "content", re: m.id, result: result as JsonValue });
          } catch (e) {
            send({ t: "content", re: m.id, error: e instanceof Error ? e.message : String(e) });
          }
        })();
        return;
      }
      case "fulfill": {
        void (async () => {
          try {
            if (stopped) throw new Error("The person stopped agent access in this tab.");
            const e = surface.get(m.entryId);
            const requires =
              e?.kind === "action" && e.state && !e.state.available ? e.state.requires : undefined;
            if (!requires) throw new Error("The control no longer has a requirement to satisfy.");
            await requires.fulfill(m.kind, m.payload, actor);
            // The table after fulfill, so the relay re-acts at the revision it moved to.
            send({
              t: "fulfilled",
              re: m.id,
              observation: surface.observe(),
              ledger: ledgerSince(m.since),
            });
          } catch (e) {
            send({ t: "fulfilled", re: m.id, error: e instanceof Error ? e.message : String(e) });
          }
        })();
        return;
      }
    }
  };

  const open = async (): Promise<void> => {
    if (stopped) return;
    const gen = generation;
    let token: string;
    try {
      token = await tokenNow();
    } catch (e) {
      if (gen !== generation) return;
      publish({ reason: e instanceof Error ? e.message : String(e) });
      return scheduleRetry();
    }
    if (stopped || gen !== generation) return;
    let socket: WebSocket;
    try {
      socket = new WS(endpoint, RELAY_PROTOCOL);
    } catch (e) {
      publish({ reason: e instanceof Error ? e.message : String(e) });
      return scheduleRetry();
    }
    ws = socket;
    socket.onopen = () => {
      const d = describe();
      send({
        t: "hello",
        v: 1,
        token,
        tabId,
        instance,
        title: String(d.title ?? "").slice(0, 200),
        path: String(d.path ?? "").slice(0, 500),
        mode,
        approvals: channel,
      });
    };
    socket.onmessage = (ev: MessageEvent) => onMessage(ev.data);
    socket.onclose = (ev: CloseEvent) => {
      // A socket this client already replaced says nothing about the current one.
      if (ws !== socket) return;
      ws = null;
      clearTimeout(renewTimer);
      if (stopped) return;
      const why = ev.reason || null;
      if (ev.code === CLOSE.forbidden) return shutDown(1000, "refused", "refused", why);
      if (ev.code === CLOSE.stopped) return shutDown(1000, "stopped", "stopped", why);
      if (ev.code === CLOSE.unauthorized) {
        unauthorizedInRow += 1;
        if (!options.getToken || unauthorizedInRow >= 3)
          return shutDown(1000, "refused", "refused", why ?? "the relay token was refused");
      }
      if (ev.code === CLOSE.replaced) {
        // Another tab carries this id (a duplicated tab copies sessionStorage): take a new one.
        tabId = newTabId();
        attempt = 0;
      }
      publish({ reason: why });
      scheduleRetry();
    };
  };

  /** Grant one approval: the relay's gate and the surface's own gate, so one decision runs the act. */
  const grant = (a: RelayApproval): void => {
    a.state = "approved";
    // An auto-derived surface holds unrecognized or destructive controls for approval itself.
    const approver = (surface as unknown as Record<symbol, unknown>)[APPROVER];
    if (typeof approver === "function") {
      try {
        (approver as (entryId: string) => boolean)(a.entryId);
      } catch {
        // The surface's gate refusing leaves the act to its own refusal.
      }
    }
  };

  const connection: RelayConnection = {
    get tabId() {
      return tabId;
    },
    status: () => ({ ...status, approvals: status.approvals.map((a) => ({ ...a })) }),
    disconnect() {
      if (stopped) return;
      // A framework cleanup is not the person's Stop. Close the socket normally so the relay
      // keeps the tab as reconnecting and a remount can reattach with the same tab id.
      shutDown(1000, "connection disposed", "disconnected", null);
    },
    stop() {
      if (stopped) return;
      send({ t: "stop" });
      shutDown(1000, "stopped by the person", "stopped", "stopped in the page");
    },
    approve(id) {
      const a = approvals.get(id);
      if (!a || a.state !== "pending" || stopped) return false;
      grant(a);
      publish();
      return true;
    },
    deny(id) {
      const a = approvals.get(id);
      if (!a || a.state !== "pending") return false;
      a.state = "denied";
      publish();
      return true;
    },
    rekey(token) {
      if (stopped) return;
      generation += 1;
      if (token !== undefined) {
        staticToken = token;
        nextToken = token;
      }
      const socket = ws;
      ws = null;
      if (socket && socket.readyState === WS.OPEN) {
        socket.send(JSON.stringify({ t: "leave" } satisfies TabMessage));
        socket.close(1000, "rekey");
      } else if (socket) {
        try {
          socket.close(1000, "rekey");
        } catch {
          // not open yet
        }
      }
      clearTimeout(retryTimer);
      clearTimeout(renewTimer);
      approvals.clear();
      everReady = false;
      attempt = 0;
      unauthorizedInRow = 0;
      publish({ state: "connecting", principal: null, pairingCode: null, reason: null });
      void open();
    },
  };

  publish();
  void open();
  return connection;
}

// ---------------------------------------------------------------------------------------------
// The in-page indicator: a small panel in a shadow root, so the page's styles do not reach it.
// It is not registered on the surface: no agent can press Stop or Approve through the relay.
// ---------------------------------------------------------------------------------------------

interface Indicator {
  update(status: RelayStatus): void;
  destroy(): void;
}

const STYLE = `
:host { all: initial; }
.panel { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; max-width: 320px;
  font: 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; color: #f5f5f4;
  background: #1c1917; border-radius: 10px; box-shadow: 0 4px 16px rgba(0,0,0,.25); padding: 10px 12px; }
.inline { position: static; }
.row { display: flex; align-items: center; gap: 8px; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; flex: none; }
.dot.wait { background: #eab308; }
.msg { flex: 1; }
.code { font: 600 14px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .08em; }
.sub { color: #a8a29e; font-size: 12px; margin-top: 4px; }
button { font: inherit; border: 1px solid #57534e; background: #292524; color: inherit;
  border-radius: 6px; padding: 2px 10px; cursor: pointer; }
button:focus-visible { outline: 2px solid #60a5fa; outline-offset: 1px; }
button.primary { background: #f5f5f4; color: #1c1917; border-color: #f5f5f4; }
.ask { border-top: 1px solid #44403c; margin-top: 8px; padding-top: 8px; }
.ask .actions { display: flex; gap: 6px; margin-top: 6px; }
`;

function createIndicator(
  container: Element | null,
  showApprovals: boolean,
  handlers: { stop(): void; approve(id: string): void; deny(id: string): void },
): Indicator {
  const doc = container?.ownerDocument ?? document;
  const host = doc.createElement("div");
  host.setAttribute("data-axe-relay-indicator", "");
  // Keep the indicator out of an auto-derived surface: Stop, Approve, and Deny are for the person.
  host.setAttribute("data-surface-ignore", "");
  const root: ShadowRoot | HTMLElement =
    typeof host.attachShadow === "function" ? host.attachShadow({ mode: "open" }) : host;
  const style = doc.createElement("style");
  style.textContent = STYLE;
  const panel = doc.createElement("div");
  panel.className = container ? "panel inline" : "panel";
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-label", "Agent access");
  root.append(style, panel);
  let mounted = false;
  const el = (tag: string, cls?: string, text?: string): HTMLElement => {
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  return {
    update(status) {
      const visible = ["pairing", "connected", "acting", "reconnecting"].includes(status.state);
      if (!visible) {
        host.remove();
        mounted = false;
        return;
      }
      if (!mounted) {
        (container ?? doc.body ?? doc.documentElement).append(host);
        mounted = true;
      }
      panel.replaceChildren();
      const row = el("div", "row");
      row.append(
        el("span", status.state === "acting" || status.state === "connected" ? "dot" : "dot wait"),
      );
      const msg = el("div", "msg");
      msg.setAttribute("role", "status");
      msg.setAttribute("aria-live", "polite");
      if (status.state === "pairing") {
        msg.append("Agent pairing code: ", el("span", "code", status.pairingCode ?? ""));
        msg.append(el("div", "sub", "Give this code to your agent to let it act in this tab."));
      } else if (status.state === "reconnecting") {
        msg.textContent = "Agent access is reconnecting…";
      } else if (status.state === "acting") {
        msg.textContent = "An agent is acting in this tab";
      } else {
        msg.textContent = "An agent can act in this tab";
      }
      const stop = el("button", undefined, "Stop");
      stop.setAttribute("type", "button");
      stop.setAttribute("data-action", "stop");
      stop.setAttribute("aria-label", "Stop the agent in this tab");
      stop.addEventListener("click", () => handlers.stop());
      row.append(msg, stop);
      panel.append(row);
      for (const a of showApprovals ? status.approvals : []) {
        const ask = el("div", "ask");
        ask.setAttribute("data-approval", a.id);
        ask.append(el("div", undefined, `The agent asks to: ${a.name}`));
        if (a.text !== undefined) ask.append(el("div", "sub", `With: ${a.text}`));
        const actions = el("div", "actions");
        const yes = el("button", "primary", "Approve");
        yes.setAttribute("type", "button");
        yes.setAttribute("data-action", "approve");
        yes.addEventListener("click", () => handlers.approve(a.id));
        const no = el("button", undefined, "Deny");
        no.setAttribute("type", "button");
        no.setAttribute("data-action", "deny");
        no.addEventListener("click", () => handlers.deny(a.id));
        actions.append(yes, no);
        ask.append(actions);
        panel.append(ask);
      }
    },
    destroy() {
      host.remove();
      mounted = false;
    },
  };
}
