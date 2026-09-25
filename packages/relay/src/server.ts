/**
 * @axe/relay/server: the broker between a signed-in person's live browser tab and an agent
 * outside the browser (spec/SURFACE.md §9.1, [S-RELAY-1] to [S-RELAY-9]).
 *
 * Tabs connect with `connectRelay` from `@axe/relay/client` and authenticate with a short-lived
 * relay token the application's backend minted for the signed-in person. For each tab the relay
 * keeps a mirror of its surface (`TabMirror`) and presents it to the existing bridge: the tools
 * an agent sees are `domainActions` from `@axe/surface/axe` on a `createAXE` server, derived to
 * MCP by `@axe/mcp`, over HTTP (`serveHttp` with sessions and an OAuth `verifier`) or stdio.
 * Nothing about tool mapping, the ladder, the ledger, or the action events is reimplemented here:
 * the relay supplies a per-caller surface resolver whose surfaces forward `act` to the tab.
 *
 * An agent reaches only the tabs whose token named the same principal and tenant as the agent's
 * own verified identity; a tab reaches nothing but its own record.
 */
import { createServer } from "node:http";
import type { IncomingMessage, Server as HttpServer, ServerResponse } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { WebSocketServer } from "ws";
import type { WebSocket as NodeWebSocket, RawData } from "ws";
import { action, createAXE, z } from "@axe/core";
import type { AdapterContext, AXE, Identity, TenantInfo } from "@axe/core";
import type { ErrorResult, JsonValue } from "@axe/core/types";
import { createSurface } from "@axe/surface";
import type { ActRequest, ActResult, LedgerEntry, Observation, Surface } from "@axe/surface";
import { domainActions } from "@axe/surface/axe";
import type { DomainActionSpec, SurfaceContext } from "@axe/surface/axe";
import { createMcpServer, serveHttp, serveStdio } from "@axe/mcp";
import type {
  AuthInfo,
  AxeLike,
  DerivedMcpServer,
  McpHttpHandler,
  OAuthTokenVerifier,
} from "@axe/mcp";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { TabMirror } from "./mirror";
import type { TabLink } from "./mirror";
import { CLOSE, ID_PATTERN, RELAY_PROTOCOL } from "./protocol";
import type { RelayMessage, RelayPrincipal, TabMessage } from "./protocol";
import { mintRelayToken, verifyRelayToken } from "./token";

export { mintRelayToken, verifyRelayToken, MAX_RELAY_TOKEN_TTL, RELAY_AUDIENCE } from "./token";
export type {
  MintRelayTokenInput,
  RelayClaimValue,
  RelayTokenClaims,
  VerifyRelayTokenOptions,
} from "./token";
export type { RelayPrincipal } from "./protocol";
export { CLOSE as RELAY_CLOSE, RELAY_PROTOCOL } from "./protocol";
export { TabMirror } from "./mirror";
export type { TabLink } from "./mirror";

/** A value, or a promise of one. */
export type MaybePromise<T> = T | Promise<T>;

/** What `authenticateTab` receives besides the token. */
export interface TabAuthContext {
  /** The page's origin, already checked against `origins`. */
  origin: string;
}

/** How the relay authenticates the agent side over HTTP: an OAuth 2.1 resource server. */
export interface RelayAgentAuth {
  /** Verifies the bearer access token on every MCP request (`@axe/mcp`'s `auth.verifier`). */
  verifier: OAuthTokenVerifier;
  /** The principal and tenant a verified token speaks for, or null to refuse it. */
  identify: (authInfo: AuthInfo) => MaybePromise<RelayPrincipal | null>;
  requiredScopes?: string[];
  /** This endpoint's canonical URL (RFC 8707 resource). */
  resource?: string;
  resourceMetadataUrl?: string;
}

/** One line of the relay's own audit stream (connections, refusals, Stop, pairing). */
export type RelayEvent =
  | { type: "tab.connected"; tabId: string; principal: string; tenant: string; origin: string }
  | { type: "tab.refused"; reason: string; origin: string | null }
  | { type: "tab.disconnected"; tabId: string; principal: string; tenant: string }
  | { type: "tab.stopped"; tabId: string; principal: string; tenant: string }
  | { type: "agent.paired"; agent: string; principal: string; tenant: string }
  | { type: "pairing.failed"; agent: string };

export interface RelayOptions {
  /**
   * The HMAC secret relay tokens are signed with (`mintRelayToken`), at least 32 characters.
   * Required unless `authenticateTab` is given or `devPairing` is on (which uses a random
   * per-process secret for its development tokens).
   */
  secret?: string;
  /**
   * Authenticate a tab yourself instead of with a relay token signed by `secret`: return the
   * principal and tenant the token speaks for, or null to refuse. Never accept a session cookie
   * here; the page sends only what your backend minted for this purpose.
   */
  authenticateTab?: (
    token: string,
    context: TabAuthContext,
  ) => MaybePromise<(RelayPrincipal & { expiresAt?: number }) | null>;
  /**
   * The page origins allowed to connect a tab. Each is an exact origin (`https://app.example.com`),
   * a subdomain pattern (`https://*.example.com`, which does not match the apex), or any port
   * (`http://localhost:*`); or pass a function. Required unless `devPairing` is on, where the
   * default is any port on `http://localhost`, `http://127.0.0.1`, and `http://[::1]`.
   */
  origins?: string[] | ((origin: string) => boolean);
  /** The `aud` relay tokens must carry. Default `axe-relay`. */
  audience?: string;
  /** Tenants this relay serves; a tab or an agent of any other tenant is refused. Default: any. */
  tenants?: string[];
  /** How agents authenticate over HTTP. Without it (and without `devPairing`) `/mcp` is not served. */
  agentAuth?: RelayAgentAuth;
  /**
   * Local development only: agents pair with a tab by typing the code its indicator shows, and
   * the relay serves development tokens at `POST /dev/token`. Refused unless the relay listens on
   * loopback; every request must come from loopback with a loopback `Host`.
   */
  devPairing?: boolean;
  /** The principal development tokens name. Default `{ principal: "dev", tenant: "dev" }`. */
  devPrincipal?: RelayPrincipal;
  /** The bearer key `/mcp` accepts in development. Default: random per process (printed by the CLI). */
  devAgentKey?: string;
  /** Namespace of the tab's tools: `surface` gives `surface_observe`, `surface_set-field`, ... */
  namespace?: string;
  /**
   * The parameterized actions for every tab. Default: `domainActions`' own set (`set-field`,
   * `run-control`, `load-more`). `autoActions` from `@axe/surface/auto` fits here.
   */
  domains?: DomainActionSpec[];
  /** The relay's public URL, as the AXE manifest names it. Default `http://localhost`. */
  baseUrl?: string;
  /** Name and description of the MCP server. */
  name?: string;
  description?: string;
  /** How long to wait for a tab to answer an act, in ms. Default 30000. */
  actTimeoutMs?: number;
  /** How long to wait for a fresh snapshot before serving the last one, in ms. Default 5000. */
  syncTimeoutMs?: number;
  /** How long an act waits for a reconnecting tab (a reload), in ms. Default 10000. */
  reconnectGraceMs?: number;
  /** How long a disconnected or stopped tab stays listed, in ms. Default 600000. */
  tabRetentionMs?: number;
  /** Every frame in and out of a tab connection, for debugging and tests. */
  onFrame?: (direction: "in" | "out", tabId: string | null, data: string) => void;
  /** The relay's audit stream. */
  onEvent?: (event: RelayEvent) => void;
}

/** A tab as `relay_tabs` and `relay.tabs()` list it. */
export interface RelayTabInfo {
  tabId: string;
  title: string;
  origin: string;
  path: string;
  state: "connected" | "reconnecting" | "stopped";
  selected: boolean;
  connectedAt: string;
  lastActiveAt: string;
  rev: number;
}

export interface RelayListenOptions {
  /** Default `127.0.0.1`. */
  host?: string;
  /** Default 0 (any free port). */
  port?: number;
}

export interface RelayAddress {
  /** `http://host:port` */
  url: string;
  /** Where tabs connect: `ws://host:port/tab`. */
  tabUrl: string;
  /** Where agents connect over HTTP: `http://host:port/mcp`. */
  mcpUrl: string;
  port: number;
  host: string;
}

export interface Relay {
  /** The AXE server the tools are derived from. */
  readonly axe: AXE;
  /** The development bearer key for `/mcp`, when `devPairing` is on. */
  readonly devAgentKey: string | null;
  /** Start an HTTP server for tabs (`/tab`), agents (`/mcp`), and development tokens. */
  listen(options?: RelayListenOptions): Promise<RelayAddress>;
  /** Serve on an existing Node HTTP server: upgrades on `/tab` and requests on `/mcp` and `/dev/token`. */
  attach(server: HttpServer): void;
  /** The HTTP routes (`/mcp`, `/dev/token`, `/health`) as a fetch handler, for a framework that gives you Web `Request`s. */
  handle(request: Request, context?: { remoteAddress?: string }): Promise<Response>;
  /** The MCP server over stdio, for one local agent (`claude mcp add ... -- axe relay --dev --stdio`). */
  serveStdio(options?: { as?: RelayPrincipal }): Promise<DerivedMcpServer>;
  /** The tabs of one principal, most recently active first. */
  tabs(who: RelayPrincipal): RelayTabInfo[];
  close(): Promise<void>;
}

/** The actor a tab records for an act from the relay. */
export function relayActor(principal: string): string {
  return `${principal} (agent via relay)`;
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** Whether a socket address is loopback. */
export function isLoopbackAddress(address: string | undefined | null): boolean {
  if (!address) return false;
  const a = address.replace(/^::ffff:/, "");
  return a === "::1" || /^127\.\d+\.\d+\.\d+$/.test(a);
}

function hostnameOf(hostHeader: string | undefined | null): string | null {
  if (!hostHeader) return null;
  try {
    return new URL(`http://${hostHeader}`).hostname;
  } catch {
    return null;
  }
}

const DEV_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/;

// Crockford base32 without I, L, O, U: codes a person can read aloud and type.
const CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function pairingCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}
function normalizeCode(code: string): string {
  const s = code
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4)}` : s;
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function errorResult(
  code: ErrorResult["error"]["code"],
  message: string,
  retryable = false,
  details?: Record<string, JsonValue>,
): ErrorResult {
  return { status: "error", error: { code, message, retryable, ...(details ? { details } : {}) } };
}

type TabState = "connected" | "disconnected" | "stopped";

/** One browser tab: its connection, its mirror, and the requests in flight. */
class TabRecord implements TabLink {
  ws: NodeWebSocket | null = null;
  state: TabState = "disconnected";
  instance = "";
  /** The instance whose first snapshot has arrived; change notices before it are ignored. */
  syncedInstance = "";
  title = "";
  path = "";
  origin = "";
  jti: string | null = null;
  expiresAt = 0;
  connectedAt = Date.now();
  lastActive = Date.now();
  leftAt = 0;
  pairing: { code: string; expiresAt: number } | null = null;
  toldActive = false;
  readonly mirror: TabMirror;
  /** The state now (read after an await, where TypeScript would keep an earlier narrowing). */
  now(): TabState {
    return this.state;
  }
  private nextId = 1;
  private readonly pending = new Map<
    number,
    {
      resolve: (m: TabMessage) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private readonly waiters = new Set<() => void>();
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    readonly key: string,
    readonly tabId: string,
    readonly principal: string,
    readonly tenant: string,
    private readonly relay: RelayCore,
  ) {
    // A random base per tab keeps two tabs' revisions apart, so a revision read from one tab
    // cannot pass the check of another.
    this.mirror = new TabMirror(this, 1000, randomInt(1, 1_000_000) * 1_000_000);
  }

  send(message: RelayMessage): boolean {
    const ws = this.ws;
    if (!ws || ws.readyState !== ws.OPEN) return false;
    const data = JSON.stringify(message);
    this.relay.frame("out", this.tabId, data);
    ws.send(data);
    return true;
  }

  attach(ws: NodeWebSocket, instance: string, expiresAt: number, jti: string | null): void {
    this.ws = ws;
    this.state = "connected";
    this.instance = instance;
    this.expiresAt = expiresAt;
    this.jti = jti;
    this.connectedAt = Date.now();
    this.lastActive = Date.now();
    this.toldActive = false;
    this.armExpiry();
    for (const w of [...this.waiters]) w();
  }

  armExpiry(): void {
    clearTimeout(this.expiryTimer);
    const left = this.expiresAt - Date.now();
    this.expiryTimer = setTimeout(
      () => {
        // [S-RELAY-3] A token outlives no connection: renew it in-band, or the tab is closed.
        this.ws?.close(CLOSE.unauthorized, "the relay token expired");
      },
      Math.max(0, Math.min(left, 2 ** 31 - 1)),
    );
    (this.expiryTimer as { unref?: () => void }).unref?.();
  }

  detach(ws: NodeWebSocket): void {
    if (this.ws !== ws) return;
    this.ws = null;
    clearTimeout(this.expiryTimer);
    if (this.state !== "stopped") this.state = "disconnected";
    this.leftAt = Date.now();
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(new Error("disconnected"));
      this.pending.delete(id);
    }
  }

  stop(): void {
    this.state = "stopped";
    this.leftAt = Date.now();
    this.pairing = null;
    for (const w of [...this.waiters]) w();
  }

  answer(re: number, message: TabMessage): void {
    const p = this.pending.get(re);
    if (!p) return;
    clearTimeout(p.timer);
    this.pending.delete(re);
    p.resolve(message);
  }

  /** Adopt a snapshot, starting a new instance's revision space on its first one. */
  adopt(observation: Observation, ledger: LedgerEntry[]): void {
    if (!observation || typeof observation.rev !== "number" || !Array.isArray(observation.entries))
      return;
    this.mirror.beginInstance(this.instance, observation.rev);
    this.syncedInstance = this.instance;
    this.mirror.apply(observation, Array.isArray(ledger) ? ledger : []);
  }

  private request(build: (id: number) => RelayMessage, timeoutMs: number): Promise<TabMessage> {
    const id = this.nextId++;
    return new Promise<TabMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("timeout"));
      }, timeoutMs);
      (timer as { unref?: () => void }).unref?.();
      this.pending.set(id, { resolve, reject, timer });
      if (!this.send(build(id))) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(new Error("disconnected"));
      }
    });
  }

  /** Wait for the tab to be connected (a reload in progress), up to `ms`. */
  private async connected(ms: number): Promise<boolean> {
    if (this.state === "connected") return true;
    if (this.state === "stopped") return false;
    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        this.waiters.delete(done);
        resolve();
      };
      const timer = setTimeout(done, ms);
      (timer as { unref?: () => void }).unref?.();
      this.waiters.add(done);
    });
    return this.now() === "connected";
  }

  /** Ask the tab for its current table and ledger; keep the last snapshot if it does not answer. */
  async sync(): Promise<void> {
    if (!(await this.connected(this.mirror.hasView() ? 0 : this.relay.reconnectGraceMs))) return;
    try {
      const m = await this.request(
        (id) => ({
          t: "sync",
          id,
          since: this.syncedInstance === this.instance ? this.mirror.since() : 0,
        }),
        this.relay.syncTimeoutMs,
      );
      if (m.t === "snapshot") this.adopt(m.observation, m.ledger);
    } catch {
      // Serve the last snapshot; an act still goes to the tab, which decides.
    }
  }

  markActive(): void {
    if (this.toldActive) return;
    this.toldActive = this.send({ t: "agent", state: "active" });
  }

  stoppedResult(): ErrorResult {
    return errorResult(
      "forbidden",
      "The person stopped agent access in this tab. Nothing was applied. Ask them to reconnect the tab (reload it) if they want you to continue.",
      false,
      { reason: "stopped" },
    );
  }

  async act(request: ActRequest): Promise<{
    result: ActResult | ErrorResult;
    observation?: Observation;
    ledger?: LedgerEntry[];
  }> {
    if (this.state === "stopped") return { result: this.stoppedResult() };
    if (!(await this.connected(this.relay.reconnectGraceMs)))
      return {
        result:
          this.now() === "stopped"
            ? this.stoppedResult()
            : errorResult(
                "unavailable",
                "The tab is not connected (it may be reloading or closed). Nothing was applied; call relay_tabs, then observe again.",
                true,
                { reason: "tab_disconnected" },
              ),
      };
    this.markActive();
    // A reloaded page is a new instance: its first snapshot fixes the translation of revisions.
    if (this.syncedInstance !== this.instance) await this.sync();
    if (this.syncedInstance !== this.instance)
      return {
        result: errorResult(
          "unavailable",
          "The tab has not reported its controls yet. Nothing was applied; observe again.",
          true,
          { reason: "tab_syncing" },
        ),
      };
    const forwarded: ActRequest = {
      ...request,
      expectedRev:
        typeof request.expectedRev === "number"
          ? this.mirror.toTabRev(request.expectedRev)
          : request.expectedRev,
    };
    const since = this.mirror.since();
    try {
      const m = await this.request(
        (id) => ({ t: "act", id, since, request: forwarded }),
        this.relay.actTimeoutMs,
      );
      if (m.t !== "result") throw new Error("unexpected reply");
      this.lastActive = Date.now();
      return { result: m.result, observation: m.observation, ledger: m.ledger };
    } catch (e) {
      const lost = e instanceof Error && e.message === "disconnected";
      return {
        result:
          this.now() === "stopped"
            ? this.stoppedResult()
            : errorResult(
                "unavailable",
                lost
                  ? "The tab went away while the act was in flight. If it ran, the revision moved: observe again before deciding whether to retry."
                  : "The tab did not answer in time. If the act ran, the revision moved: observe again before deciding whether to retry.",
                true,
                { reason: lost ? "tab_disconnected" : "tab_timeout" },
              ),
      };
    }
  }

  async fulfill(entryId: string, kind: string, payload: JsonValue, actor: string): Promise<void> {
    if (!(await this.connected(this.relay.reconnectGraceMs)))
      throw new Error("The tab is not connected.");
    const m = await this.request(
      (id) => ({ t: "fulfill", id, entryId, kind, payload, actor }),
      this.relay.actTimeoutMs,
    );
    if (m.t === "fulfilled" && m.error) throw new Error(m.error);
  }

  info(selected: boolean): RelayTabInfo {
    return {
      tabId: this.tabId,
      title: this.title,
      origin: this.origin,
      path: this.path,
      state:
        this.state === "connected"
          ? "connected"
          : this.state === "stopped"
            ? "stopped"
            : "reconnecting",
      selected,
      connectedAt: new Date(this.connectedAt).toISOString(),
      lastActiveAt: new Date(this.lastActive).toISOString(),
      rev: this.mirror.rev(),
    };
  }
}

/** Who is calling on the agent side, as the relay established it. */
interface AgentCaller {
  /** Selection and pairing are kept per agent. */
  agent: string;
  who: RelayPrincipal | null;
}

interface RelayCore {
  readonly reconnectGraceMs: number;
  readonly syncTimeoutMs: number;
  readonly actTimeoutMs: number;
  frame(direction: "in" | "out", tabId: string | null, data: string): void;
}

const principalKey = (who: RelayPrincipal): string => JSON.stringify([who.tenant, who.principal]);

/** Create a relay. See `RelayOptions` and docs/relay.md. */
export function createRelay(options: RelayOptions = {}): Relay {
  const dev = options.devPairing === true;
  const devSecret = randomBytes(32).toString("hex");
  if (!options.secret && !options.authenticateTab && !dev)
    throw new Error("createRelay: pass secret (for mintRelayToken tokens) or authenticateTab.");
  if (options.secret !== undefined && options.secret.length < 32)
    throw new Error("createRelay: secret must be at least 32 characters.");
  if (
    !dev &&
    (!options.origins || (Array.isArray(options.origins) && options.origins.length === 0))
  )
    throw new Error("createRelay: origins must list the page origins allowed to connect a tab.");
  const originRule: ((origin: string) => boolean) | null =
    typeof options.origins === "function"
      ? options.origins
      : options.origins && options.origins.length
        ? originMatcher(options.origins)
        : null;
  const devPrincipal = options.devPrincipal ?? { principal: "dev", tenant: "dev" };
  const devAgentKey = dev
    ? (options.devAgentKey ?? `axd_${randomBytes(24).toString("hex")}`)
    : null;
  const ns = options.namespace ?? "surface";
  const retention = options.tabRetentionMs ?? 600_000;
  const core: RelayCore = {
    reconnectGraceMs: options.reconnectGraceMs ?? 10_000,
    syncTimeoutMs: options.syncTimeoutMs ?? 5000,
    actTimeoutMs: options.actTimeoutMs ?? 30_000,
    frame: (direction, tabId, data) => options.onFrame?.(direction, tabId, data),
  };
  const emit = (event: RelayEvent): void => {
    try {
      options.onEvent?.(event);
    } catch {
      // an audit sink's failure is not the relay's
    }
  };

  const tenantAllowed = (tenant: string): boolean =>
    !options.tenants || options.tenants.includes(tenant);
  const originAllowed = (origin: string | undefined): origin is string => {
    if (!origin) return false;
    if (originRule) return originRule(origin);
    return dev && DEV_ORIGIN.test(origin);
  };

  // ---------------------------------------------------------------------------------------------
  // Tabs, pairing, and selection.
  // ---------------------------------------------------------------------------------------------
  const tabs = new Map<string, TabRecord>();
  const revoked = new Map<string, number>(); // jti -> expiry (ms)
  const paired = new Map<string, RelayPrincipal>(); // agent -> principal (development)
  const selection = new Map<string, string>(); // agent -> tab key
  const failures = new Map<string, { count: number; until: number }>();
  let globalFailures: number[] = [];

  const tabsOf = (who: RelayPrincipal): TabRecord[] =>
    [...tabs.values()]
      .filter((t) => t.principal === who.principal && t.tenant === who.tenant)
      .sort((a, b) => b.lastActive - a.lastActive);

  const agentPaired = (who: RelayPrincipal): boolean => {
    if (!dev) return true;
    for (const p of paired.values()) if (principalKey(p) === principalKey(who)) return true;
    return false;
  };

  /** The tab an agent acts on: its selection, else the most recently active live tab (then kept). */
  const pick = (caller: AgentCaller, remember: boolean): TabRecord | null => {
    if (!caller.who) return null;
    const mine = tabsOf(caller.who);
    const selected = selection.get(caller.agent);
    const held = selected ? mine.find((t) => t.key === selected) : undefined;
    if (held) return held;
    const chosen =
      mine.find((t) => t.state === "connected") ??
      mine.find((t) => t.state === "disconnected") ??
      mine[0] ??
      null;
    // [S-RELAY-5] The default is pinned once used, so a revision read from one tab is never
    // presented to another because a different tab became active in between.
    if (chosen && remember) selection.set(caller.agent, chosen.key);
    return chosen;
  };

  const sweep = setInterval(
    () => {
      const now = Date.now();
      for (const [key, t] of tabs)
        if (t.state !== "connected" && now - t.leftAt > retention) {
          tabs.delete(key);
          for (const [agent, k] of selection) if (k === key) selection.delete(agent);
        }
      for (const [jti, exp] of revoked) if (exp < now) revoked.delete(jti);
    },
    Math.max(1000, Math.min(retention, 60_000)),
  );
  (sweep as { unref?: () => void }).unref?.();

  // ---------------------------------------------------------------------------------------------
  // The AXE server over the tabs: domainActions on a per-caller resolver, plus the relay's own
  // actions (list and select tabs; pair in development).
  // ---------------------------------------------------------------------------------------------
  const callerOf = (identity: Identity | null | undefined): AgentCaller | null => {
    const claims = identity?.claims;
    if (!identity || !claims || typeof claims["relayAgent"] !== "string") return null;
    const agent = claims["relayAgent"];
    if (claims["relayUnpaired"] === true) return { agent, who: null };
    const tenant = claims["relayTenant"];
    if (typeof tenant !== "string") return null;
    return { agent, who: { principal: identity.onBehalfOf, tenant } };
  };

  const placeholder = (hint: string): Surface => {
    const s = createSurface({ app: "no tab" });
    s.setObjects(() => ({ relay: hint }));
    return s;
  };
  const NO_TAB =
    "No browser tab is connected for you. Ask the person to open the application in their browser, signed in, and keep the tab open; then call relay_tabs.";
  const UNPAIRED =
    "This agent is not paired with a tab yet. Ask the person for the pairing code shown in their tab, then call relay_pair with it.";

  const resolver = async (ctx: SurfaceContext): Promise<Surface | null> => {
    const caller = callerOf(ctx.identity);
    if (!caller) return null;
    if (!caller.who) return placeholder(UNPAIRED);
    const tab = pick(caller, true);
    if (!tab) return placeholder(NO_TAB);
    await tab.sync();
    tab.markActive();
    return tab.mirror.surface;
  };

  const axe = createAXE({
    name: options.name ?? "Surface relay",
    description:
      options.description ??
      "The person's open browser tab of this application, through its Surface. relay_tabs lists the tabs you can reach and which one you act on. surface_observe returns the tab's controls, with what can be done now and why not the rest, under one rev; pass that rev as expectedRev to surface_set-field, surface_run-control, or surface_load-more. Every act runs in the page as the person's own control would, and is recorded in the tab's ledger. A control that needs approval asks the person in the tab: tell them, and call again after they approve.",
    baseUrl: options.baseUrl ?? "http://localhost",
    // The AXE runtime is reached only in-process, from the MCP bridge, which passes the caller's
    // identity as the adapter context; no request authenticates itself, and the relay serves no
    // /axe/* routes over HTTP.
    auth: { modes: ["user"], authenticate: () => null },
    secret: randomBytes(32).toString("hex"),
    // Every envelope carries the caller's tab revision, and a stale expectedRev is refused before
    // the act is forwarded ([S-AXE-4]); the tab checks it again.
    revision: (ctx) => {
      const caller = callerOf(ctx.identity);
      const tab = caller ? pick(caller, false) : null;
      return tab ? tab.mirror.rev() : 0;
    },
  });

  const bridge = domainActions(resolver, {
    namespace: ns,
    template: createSurface(),
    actor: (ctx) => relayActor(ctx.onBehalfOf ?? "agent"),
    ...(options.domains ? { domains: options.domains } : {}),
  });
  axe.addProvider(bridge);

  const TabInfoSchema = z.object({
    tabId: z.string(),
    title: z.string(),
    origin: z.string(),
    path: z.string(),
    state: z.enum(["connected", "reconnecting", "stopped"]),
    selected: z.boolean(),
    connectedAt: z.string(),
    lastActiveAt: z.string(),
    rev: z.number(),
  });

  const listFor = (caller: AgentCaller): RelayTabInfo[] => {
    if (!caller.who) return [];
    const current = pick(caller, false);
    return tabsOf(caller.who).map((t) => t.info(t === current));
  };

  axe.register(
    action("relay.tabs", {
      title: "List your open tabs",
      description:
        "Lists the browser tabs of this application that are connected for you, most recently active first, and which one the surface tools act on (selected). A tab that is reconnecting may be reloading; a stopped tab was stopped by the person.",
      readOnly: true,
      risk: "none",
      auth: "user",
      input: z.object({}).strict(),
      output: z.object({
        principal: z.string().nullable(),
        tabs: z.array(TabInfoSchema),
        hint: z.string().optional(),
      }),
      examples: [{ input: {}, output: { principal: "dev", tabs: [] } }],
      handler: ({ identity, fail }) => {
        const caller = callerOf(identity);
        if (!caller) return fail("unauthorized", "The relay could not identify this agent.");
        const list = listFor(caller);
        const out: { principal: string | null; tabs: RelayTabInfo[]; hint?: string } = {
          principal: caller.who?.principal ?? null,
          tabs: list,
        };
        if (!caller.who) out.hint = UNPAIRED;
        else if (list.length === 0) out.hint = NO_TAB;
        return out;
      },
    }),
  );

  axe.register(
    action("relay.select-tab", {
      title: "Choose the tab to act on",
      description:
        "Makes one of your tabs (a tabId from relay_tabs) the tab the surface tools observe and act on. Observe again after choosing: revisions differ between tabs.",
      risk: "low",
      idempotent: true,
      reversible: true,
      auth: "user",
      input: z.object({ tabId: z.string().min(1).max(64) }).strict(),
      output: z.object({ selected: TabInfoSchema }),
      examples: [
        {
          input: { tabId: "k3Jd0aQ1c8mZ" },
          output: {
            selected: {
              tabId: "k3Jd0aQ1c8mZ",
              title: "Plan",
              origin: "http://localhost:3000",
              path: "/plan",
              state: "connected",
              selected: true,
              connectedAt: "2026-01-01T00:00:00.000Z",
              lastActiveAt: "2026-01-01T00:00:00.000Z",
              rev: 1000000,
            },
          },
        },
      ],
      handler: ({ identity, input, fail }) => {
        const caller = callerOf(identity);
        if (!caller?.who) return fail("forbidden", UNPAIRED);
        const tab = tabsOf(caller.who).find((t) => t.tabId === input.tabId);
        // Another principal's tab id is as unknown as a made-up one.
        if (!tab) return fail("not_found", "No tab of yours has that tabId; call relay_tabs.");
        selection.set(caller.agent, tab.key);
        return { selected: tab.info(true) };
      },
    }),
  );

  if (dev) {
    axe.register(
      action("relay.pair", {
        title: "Pair with a tab (development)",
        description:
          "Development only. Pairs this agent with the person's tab using the pairing code the tab shows; afterwards the surface tools act on that person's tabs. Ask the person for the code; never guess one.",
        risk: "low",
        idempotent: false,
        reversible: true,
        auth: "user",
        input: z.object({ code: z.string().min(4).max(32) }).strict(),
        output: z.object({
          principal: z.string(),
          tenant: z.string(),
          tabs: z.array(TabInfoSchema),
        }),
        examples: [
          { input: { code: "7K2M-Q9XD" }, output: { principal: "dev", tenant: "dev", tabs: [] } },
        ],
        handler: ({ identity, input, fail }) => {
          const caller = callerOf(identity);
          if (!caller) return fail("unauthorized", "The relay could not identify this agent.");
          const now = Date.now();
          globalFailures = globalFailures.filter((t) => now - t < 60_000);
          const f = failures.get(caller.agent);
          if ((f && f.until > now) || globalFailures.length >= 30)
            return fail(
              "rate_limited",
              "Too many wrong pairing codes; wait a minute and ask the person for the code again.",
              {
                retryable: true,
              },
            );
          const code = normalizeCode(input.code);
          const tab = [...tabs.values()].find(
            (t) => t.state === "connected" && t.pairing && safeEqual(t.pairing.code, code),
          );
          if (!tab) {
            const count = (f?.count ?? 0) + 1;
            failures.set(caller.agent, {
              count: count >= 5 ? 0 : count,
              until: count >= 5 ? now + 60_000 : 0,
            });
            globalFailures.push(now);
            emit({ type: "pairing.failed", agent: caller.agent });
            return fail(
              "not_found",
              "That pairing code does not match an open tab. Ask the person to read it again from the tab.",
            );
          }
          failures.delete(caller.agent);
          const who = { principal: tab.principal, tenant: tab.tenant };
          paired.set(caller.agent, who);
          selection.set(caller.agent, tab.key);
          for (const t of tabsOf(who)) {
            t.pairing = null;
            t.send({ t: "agent", state: "paired" });
          }
          emit({ type: "agent.paired", agent: caller.agent, ...who });
          return { ...who, tabs: listFor({ agent: caller.agent, who }) };
        },
      }),
    );
  }

  // ---------------------------------------------------------------------------------------------
  // Agent identity: what the AXE runtime sees for each MCP caller.
  // ---------------------------------------------------------------------------------------------
  const tenantInfo = (tenant: string): TenantInfo => ({
    id: tenant,
    name: tenant,
    baseUrl: options.baseUrl ?? "http://localhost",
  });
  const adapterFor = (agent: string, who: RelayPrincipal | null): AdapterContext => {
    const resolved = who ?? (dev ? (paired.get(agent) ?? null) : null);
    if (!resolved)
      return {
        identity: {
          onBehalfOf: "unpaired agent",
          claims: { relayAgent: agent, relayUnpaired: true },
        },
      };
    return {
      identity: {
        onBehalfOf: resolved.principal,
        claims: { relayAgent: agent, relayTenant: resolved.tenant },
      },
      tenant: tenantInfo(resolved.tenant),
    };
  };

  const axeLike = (fallback?: () => AdapterContext): AxeLike => ({
    handle: (request, adapter) => axe.handle(request, adapter ?? fallback?.()),
    describe: () => axe.describe(),
    describeLive: () => axe.describeLive(),
    onActionsChanged: (listener) => axe.onActionsChanged(listener),
  });

  const devVerifier: OAuthTokenVerifier = {
    async verifyAccessToken(token: string): Promise<AuthInfo> {
      if (!devAgentKey || !safeEqual(token, devAgentKey))
        throw new InvalidTokenError("Unknown development key.");
      return { token, clientId: "dev", scopes: [], extra: { sub: "dev-agent" } };
    },
  };

  let httpMcp: Promise<McpHttpHandler | null> | null = null;
  const mcpHandler = (): Promise<McpHttpHandler | null> => {
    if (httpMcp) return httpMcp;
    httpMcp = (async () => {
      if (!options.agentAuth && !dev) return null;
      const derived = await createMcpServer(axeLike(), { name: options.name ?? "Surface relay" });
      const agentAuth = options.agentAuth;
      return serveHttp(derived, {
        sessions: true,
        auth: agentAuth
          ? {
              verifier: agentAuth.verifier,
              ...(agentAuth.requiredScopes ? { requiredScopes: agentAuth.requiredScopes } : {}),
              ...(agentAuth.resource ? { resource: agentAuth.resource } : {}),
              ...(agentAuth.resourceMetadataUrl
                ? { resourceMetadataUrl: agentAuth.resourceMetadataUrl }
                : {}),
            }
          : { verifier: devVerifier },
        clientFor: async (authInfo) => {
          if (!agentAuth) return adapterFor("dev-http", null);
          const who = await agentAuth.identify(authInfo);
          // [S-RELAY-2] The agent's own verified identity decides which tabs it reaches.
          if (!who || !tenantAllowed(who.tenant)) return { identity: null };
          return adapterFor(JSON.stringify([who.tenant, who.principal, authInfo.clientId]), who);
        },
      });
    })();
    return httpMcp;
  };

  // ---------------------------------------------------------------------------------------------
  // Tab connections.
  // ---------------------------------------------------------------------------------------------
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 8 * 1024 * 1024,
    handleProtocols: (protocols) => (protocols.has(RELAY_PROTOCOL) ? RELAY_PROTOCOL : false),
  });

  const authenticate = async (
    token: string,
    origin: string,
  ): Promise<(RelayPrincipal & { expiresAt: number; jti: string | null }) | null> => {
    if (options.authenticateTab) {
      const who = await options.authenticateTab(token, { origin });
      if (!who) return null;
      return {
        principal: who.principal,
        tenant: who.tenant,
        expiresAt: who.expiresAt ?? Date.now() + 600_000,
        jti: null,
      };
    }
    const secrets = [options.secret, dev ? devSecret : undefined].filter((s): s is string => !!s);
    for (const secret of secrets) {
      const claims = await verifyRelayToken(
        token,
        secret,
        options.audience ? { audience: options.audience } : {},
      );
      if (claims) {
        if (revoked.has(claims.jti)) return null;
        return {
          principal: claims.principal,
          tenant: claims.tenant,
          expiresAt: claims.exp * 1000,
          jti: claims.jti,
        };
      }
    }
    return null;
  };

  const onConnection = (ws: NodeWebSocket, origin: string): void => {
    let record: TabRecord | null = null;
    let alive = true;
    const helloTimer = setTimeout(() => ws.close(CLOSE.helloTimeout, "no hello"), 10_000);
    (helloTimer as { unref?: () => void }).unref?.();
    const ping = setInterval(() => {
      if (!alive) return ws.terminate();
      alive = false;
      ws.ping();
    }, 30_000);
    (ping as { unref?: () => void }).unref?.();
    ws.on("pong", () => (alive = true));
    const refuse = (code: number, reason: string) => {
      emit({ type: "tab.refused", reason, origin });
      ws.close(code, reason);
    };
    let queue: Promise<void> = Promise.resolve();
    ws.on("message", (raw: RawData, isBinary: boolean) => {
      if (isBinary) return refuse(CLOSE.badMessage, "text frames only");
      const data = raw.toString();
      core.frame("in", record?.tabId ?? null, data);
      queue = queue.then(() => handle(data)).catch(() => ws.close(CLOSE.badMessage, "bad message"));
    });
    const handle = async (data: string): Promise<void> => {
      let m: TabMessage;
      try {
        m = JSON.parse(data) as TabMessage;
      } catch {
        return refuse(CLOSE.badMessage, "not JSON");
      }
      if (!record) {
        if (m.t !== "hello" || m.v !== 1 || typeof m.token !== "string")
          return refuse(CLOSE.badMessage, "hello first");
        if (!ID_PATTERN.test(String(m.tabId)) || !ID_PATTERN.test(String(m.instance)))
          return refuse(CLOSE.badMessage, "bad tab id");
        clearTimeout(helloTimer);
        const who = await authenticate(m.token, origin);
        if (!who) return refuse(CLOSE.unauthorized, "the relay token is invalid or expired");
        if (!tenantAllowed(who.tenant))
          return refuse(CLOSE.forbidden, "this relay does not serve that tenant");
        if (ws.readyState !== ws.OPEN) return;
        const key = JSON.stringify([who.tenant, who.principal, m.tabId]);
        let tab = tabs.get(key);
        if (!tab) {
          tab = new TabRecord(key, m.tabId, who.principal, who.tenant, core);
          tabs.set(key, tab);
        }
        const previous = tab.ws;
        if (previous && previous !== ws) {
          tab.detach(previous);
          previous.close(CLOSE.replaced, "another connection took this tab id");
        }
        tab.origin = origin;
        tab.title = String(m.title ?? "").slice(0, 200);
        tab.path = String(m.path ?? "").slice(0, 500);
        tab.attach(ws, m.instance, who.expiresAt, who.jti);
        record = tab;
        if (dev && !agentPaired(who))
          tab.pairing = { code: pairingCode(), expiresAt: who.expiresAt };
        tab.send({
          t: "ready",
          tabId: tab.tabId,
          principal: who.principal,
          tenant: who.tenant,
          actor: relayActor(who.principal),
          expiresAt: who.expiresAt,
          agent: agentPaired(who),
          ...(tab.pairing ? { pairing: tab.pairing } : {}),
        });
        emit({
          type: "tab.connected",
          tabId: tab.tabId,
          principal: who.principal,
          tenant: who.tenant,
          origin,
        });
        // The first snapshot of this page instance starts its revision space.
        void tab.sync();
        return;
      }
      const tab = record;
      switch (m.t) {
        case "snapshot":
        case "result":
        case "fulfilled":
          if (m.t !== "fulfilled" && m.observation) {
            // A result carries the table after the act; the requester adopts it through the mirror.
            if (m.t === "snapshot") tab.adopt(m.observation, m.ledger);
            else tab.mirror.beginInstance(tab.instance, m.observation.rev);
          }
          tab.answer(m.re, m);
          return;
        case "changed":
          tab.lastActive = Date.now();
          if (tab.syncedInstance === tab.instance && typeof m.rev === "number")
            tab.mirror.noteRev(m.rev);
          return;
        case "active":
          tab.lastActive = Date.now();
          return;
        case "renew": {
          const who = await authenticate(m.token, origin);
          if (!who || who.principal !== tab.principal || who.tenant !== tab.tenant)
            return refuse(CLOSE.unauthorized, "the renewed token is not valid for this tab");
          if (tab.jti && tab.jti !== who.jti) revoked.set(tab.jti, tab.expiresAt);
          tab.expiresAt = who.expiresAt;
          tab.jti = who.jti;
          tab.armExpiry();
          tab.send({ t: "renewed", expiresAt: who.expiresAt });
          return;
        }
        case "leave": {
          // The page's person or tenant changed: nothing of this record may reach the new one's
          // agents, and no agent of the old principal may reach the page any more.
          if (tab.jti) revoked.set(tab.jti, tab.expiresAt);
          tab.stop();
          tab.detach(ws);
          tabs.delete(tab.key);
          for (const [agent, k] of selection) if (k === tab.key) selection.delete(agent);
          const who = { principal: tab.principal, tenant: tab.tenant };
          if (tabsOf(who).length === 0)
            for (const [agent, p] of paired)
              if (principalKey(p) === principalKey(who)) paired.delete(agent);
          record = null;
          ws.close(1000, "left");
          return;
        }
        case "stop":
          // [S-RELAY-4] Stop revokes the token and refuses every further act on this tab.
          if (tab.jti) revoked.set(tab.jti, tab.expiresAt);
          tab.stop();
          emit({
            type: "tab.stopped",
            tabId: tab.tabId,
            principal: tab.principal,
            tenant: tab.tenant,
          });
          ws.close(CLOSE.stopped, "stopped by the person");
          return;
        default:
          return refuse(CLOSE.badMessage, "unknown message");
      }
    };
    ws.on("close", () => {
      clearTimeout(helloTimer);
      clearInterval(ping);
      if (record) {
        record.detach(ws);
        if (record.state !== "stopped")
          emit({
            type: "tab.disconnected",
            tabId: record.tabId,
            principal: record.principal,
            tenant: record.tenant,
          });
      }
    });
    ws.on("error", () => undefined);
  };

  /** Loopback checks for development: the peer and the Host header must both be loopback. */
  const devRefusal = (remote: string | undefined, host: string | undefined): string | null => {
    if (!dev) return null;
    if (!isLoopbackAddress(remote)) return "development pairing serves loopback clients only";
    const name = hostnameOf(host);
    if (!name || !LOOPBACK_HOSTS.has(name))
      return "development pairing needs a loopback Host header";
    return null;
  };

  const onUpgrade = (req: IncomingMessage, socket: Socket, head: Buffer): void => {
    const url = new URL(req.url ?? "/", "http://relay.invalid");
    const reject = (status: number, why: string) => {
      emit({ type: "tab.refused", reason: why, origin: req.headers.origin ?? null });
      socket.write(
        `HTTP/1.1 ${status} ${status === 404 ? "Not Found" : "Forbidden"}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`,
      );
      socket.destroy();
    };
    if (url.pathname !== "/tab") return reject(404, "unknown path");
    const devWhy = devRefusal(req.socket.remoteAddress, req.headers.host);
    if (devWhy) return reject(403, devWhy);
    const origin = req.headers.origin;
    // [S-RELAY-2] Only the application's own pages connect a tab.
    if (!originAllowed(origin)) return reject(403, `origin ${origin ?? "(none)"} is not allowed`);
    wss.handleUpgrade(req, socket, head, (ws) => onConnection(ws, origin));
  };

  // ---------------------------------------------------------------------------------------------
  // HTTP routes.
  // ---------------------------------------------------------------------------------------------
  const json = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
    });

  const handle = async (
    request: Request,
    context: { remoteAddress?: string } = {},
  ): Promise<Response> => {
    const url = new URL(request.url);
    const devWhy = devRefusal(context.remoteAddress, request.headers.get("host") ?? url.host);
    if (devWhy) return json(403, { error: devWhy });
    if (url.pathname === "/health") return json(200, { ok: true });
    if (url.pathname === "/dev/token") {
      if (!dev) return json(404, { error: "not found" });
      const origin = request.headers.get("origin") ?? undefined;
      if (origin !== undefined && !originAllowed(origin))
        return json(403, { error: `origin ${origin} is not allowed` });
      const cors: Record<string, string> = origin
        ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
        : {};
      if (request.method === "OPTIONS")
        return new Response(null, {
          status: 204,
          headers: { ...cors, "Access-Control-Allow-Methods": "POST" },
        });
      if (request.method !== "POST") return json(405, { error: "POST" }, cors);
      const token = await mintRelayToken({ ...devPrincipal, ttl: 600 }, devSecret);
      return json(200, { token }, cors);
    }
    if (url.pathname === "/mcp") {
      const h = await mcpHandler();
      if (!h)
        return json(404, { error: "this relay serves no agents over HTTP (configure agentAuth)" });
      return h(request);
    }
    return json(404, { error: "not found" });
  };

  const servers = new Set<HttpServer>();
  const sockets = new Set<Socket>();
  const attach = (server: HttpServer): void => {
    servers.add(server);
    server.on("upgrade", onUpgrade);
    server.on("connection", (s: Socket) => {
      sockets.add(s);
      s.on("close", () => sockets.delete(s));
    });
    server.on("request", (req: IncomingMessage, res: ServerResponse) => {
      const path = (req.url ?? "/").split("?")[0];
      if (path !== "/mcp" && path !== "/dev/token" && path !== "/health") return;
      void serveNode(req, res, handle);
    });
  };

  let stdio: DerivedMcpServer | null = null;

  return {
    axe,
    devAgentKey,
    attach,
    handle,
    async listen(opts = {}) {
      const host = opts.host ?? "127.0.0.1";
      if (dev && !LOOPBACK_HOSTS.has(host))
        throw new Error(
          `devPairing is for local development and listens on loopback only; refusing to listen on ${host}.`,
        );
      const server = createServer();
      attach(server);
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(opts.port ?? 0, host, () => {
          server.off("error", reject);
          resolve();
        });
      });
      const port = (server.address() as AddressInfo).port;
      const shown = host.includes(":") ? `[${host}]` : host;
      const base = `http://${shown}:${port}`;
      return { url: base, tabUrl: `ws://${shown}:${port}/tab`, mcpUrl: `${base}/mcp`, port, host };
    },
    async serveStdio(opts = {}) {
      if (!opts.as && !dev)
        throw new Error(
          "serveStdio: pass `as` (the principal this local agent acts for), or turn on devPairing.",
        );
      const as = opts.as ?? null;
      if (as && !tenantAllowed(as.tenant))
        throw new Error("serveStdio: this relay does not serve that tenant.");
      const derived = await createMcpServer(
        axeLike(() => adapterFor("stdio", as)),
        {
          name: options.name ?? "Surface relay",
        },
      );
      await serveStdio(derived);
      stdio = derived;
      return derived;
    },
    tabs(who) {
      return tabsOf(who).map((t) => t.info(false));
    },
    async close() {
      clearInterval(sweep);
      for (const t of tabs.values()) t.ws?.close(1001, "relay shutting down");
      wss.close();
      const h = httpMcp ? await httpMcp : null;
      await h?.close();
      await stdio?.server.close().catch(() => undefined);
      for (const s of sockets) s.destroy();
      await Promise.all(
        [...servers].map((s) => new Promise<void>((resolve) => s.close(() => resolve()))),
      );
    },
  };
}

/**
 * An origin allowlist from patterns: exact origins, `https://*.example.com` (subdomains only, not
 * the apex), and `http://localhost:*` (any port). Anything else is refused when the relay is
 * created, so a typo never widens the list.
 */
export function originMatcher(patterns: string[]): (origin: string) => boolean {
  const rules = patterns.map((p) => {
    const m =
      /^(https?):\/\/(\*\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)*|\[[0-9a-f:.]+\])(?::(\d{1,5}|\*))?$/i.exec(
        p,
      );
    if (!m)
      throw new Error(
        `createRelay: origin ${JSON.stringify(p)} must be an origin such as https://app.example.com, https://*.example.com, or http://localhost:*.`,
      );
    return {
      scheme: m[1]!.toLowerCase(),
      wild: !!m[2],
      host: m[3]!.toLowerCase(),
      port: m[4] ?? null,
    };
  });
  return (origin) => {
    const o = /^(https?):\/\/([a-z0-9.-]+|\[[0-9a-f:.]+\])(?::(\d{1,5}))?$/i.exec(origin);
    if (!o) return false;
    const scheme = o[1]!.toLowerCase();
    const host = o[2]!.toLowerCase();
    const port = o[3] ?? (scheme === "https" ? "443" : "80");
    return rules.some(
      (r) =>
        r.scheme === scheme &&
        (r.wild ? host.endsWith(`.${r.host}`) : host === r.host) &&
        (r.port === "*" || (r.port ?? (scheme === "https" ? "443" : "80")) === port),
    );
  };
}

/** Serve one Node request through a Web fetch handler, streaming the response (MCP answers with SSE). */
async function serveNode(
  req: IncomingMessage,
  res: ServerResponse,
  handler: (request: Request, context: { remoteAddress?: string }) => Promise<Response>,
): Promise<void> {
  try {
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (Array.isArray(v)) for (const x of v) headers.append(k, x);
      else if (v !== undefined) headers.set(k, v);
    }
    const method = req.method ?? "GET";
    const init: RequestInit & { duplex?: string } = { method, headers };
    if (method !== "GET" && method !== "HEAD") {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const c of req) {
        size += (c as Buffer).length;
        if (size > 4 * 1024 * 1024) {
          res.writeHead(413).end();
          return;
        }
        chunks.push(c as Buffer);
      }
      init.body = Buffer.concat(chunks);
    }
    const host = req.headers.host ?? "relay.invalid";
    const request = new Request(new URL(req.url ?? "/", `http://${host}`), init);
    const remote = req.socket.remoteAddress;
    const response = await handler(request, remote ? { remoteAddress: remote } : {});
    const out: Record<string, string> = {};
    response.headers.forEach((v, k) => (out[k] = v));
    res.writeHead(response.status, out);
    if (!response.body) return void res.end();
    const reader = response.body.getReader();
    res.on("close", () => void reader.cancel().catch(() => undefined));
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (e) {
    if (!res.headersSent) res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(e instanceof Error ? e.message : String(e));
  }
}
