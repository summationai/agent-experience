/**
 * @axe/host: unattended mode (spec/SURFACE.md §9.2, [S-HOST-1] to [S-HOST-9]).
 *
 * The agent signs in (MCP OAuth, in the agent's own UI). For the principal and tenant its token
 * names, the host runs the application in a headless browser: one shared Chromium, one isolated
 * `BrowserContext` per identity, started on the agent's first tool call with the application
 * session `sessionFor` returns. The application's own page, with the `SurfaceProvider` that
 * `axe surface init` mounted, connects its surface to the relay with a relay token the host
 * minted for the same identity and injected before any page script ran (`window.__AXE_RELAY__`),
 * so no pairing is needed. The agent's tools are the relay's (`relay_tabs`, `surface_observe`,
 * `surface_run-control`, ...) plus `host_screenshot`; every act runs in the page, through the
 * application's own controls, as it would for the person.
 */
import { createServer } from "node:http";
import type { IncomingMessage, Server as HttpServer, ServerResponse } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Browser, BrowserContext, Page, Route, Request as PwRequest } from "playwright-core";
import { WIRE } from "@axe/core";
import type { AdapterContext } from "@axe/core";
import { createMcpServer, protectedResourceMetadata, serveHttp, serveStdio } from "@axe/mcp";
import type {
  AuthInfo,
  AxeLike,
  CallToolResult,
  DerivedMcpServer,
  ExtraTool,
  McpHttpHandler,
  OAuthTokenVerifier,
  ProtectedResourceOptions,
  ToolCallContext,
} from "@axe/mcp";
import {
  createRelay,
  isLoopbackAddress,
  mintRelayToken,
  originMatcher,
  relayAgentContext,
} from "@axe/relay/server";
import type { Relay, RelayAgentAuth, RelayEvent, RelayOptions } from "@axe/relay/server";
// The browser client's constant: importing it runs nothing (the client module touches no DOM at import).
import { INJECTED_RELAY_GLOBAL } from "@axe/relay/client";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { contextStorageState, SessionLoginRequired } from "./session";
import type { AppSession, HostIdentity, SessionFor } from "./session";
import { humanSessionLoginPage, humanSessionPage } from "./human-session";
import { watchPage } from "./watch";

/** How the host starts Chromium. */
export interface HostBrowserOptions {
  /**
   * Start the browser yourself (a remote browser, a custom build). Default: Playwright's
   * `chromium.launch` from `playwright-core`, which needs a Chromium it can find
   * (`npx playwright install chromium`, or `executablePath`).
   */
  launch?: () => Promise<Browser>;
  /** Default true. `false` shows the windows, for debugging. */
  headless?: boolean;
  /** A Chromium or Chrome executable, instead of Playwright's download. */
  executablePath?: string;
  /** Extra Chromium command-line switches. */
  args?: string[];
}

/** A visible, session-bound view used when the hosted Surface reports that it is signed out. */
export interface HostHumanHandoffOptions {
  /** Public origin serving the host. Required behind a proxy; inferred by `listen()` otherwise. */
  baseUrl?: string;
  /** Route prefix reserved for these pages. Default `/human-session`. */
  pathPrefix?: string;
  /** How long a link may control the page. Default ten minutes. */
  ttlMs?: number;
  /** Identify the person opening a production handoff page. Required outside development. */
  identify?: (request: Request) => HostIdentity | null | Promise<HostIdentity | null>;
  /** A provider login URL that returns to the given handoff URL after establishing `identify`. */
  signInUrl?: (returnTo: string) => string;
}

/** Local development: loopback only, one configured identity, a key for `/mcp`, a watch page. */
export interface HostDevOptions {
  /** The bearer key `/mcp` accepts. Default: random per process. */
  agentKey?: string;
  /** Who the agent acts as. Default `{ principal: "dev", tenant: "dev" }`. */
  identity?: HostIdentity;
}

export interface HostOptions {
  /** Trusted connector identity; the page's Surface profile is checked against its id. */
  application?: { id: string; name?: string };
  /** The application: its origin is the one origin the hosted pages run on by default. */
  appUrl: string;
  /** The path each session opens first, relative to `appUrl`. Default: `appUrl` itself. */
  startPath?: string;
  /**
   * The application session for an identity (cookies, a storage state, headers). Default: none,
   * for an application that needs no sign-in. See `storageStateSession` and `cookieSession`.
   */
  sessionFor?: SessionFor;
  /**
   * The relay the hosted pages connect to. Default: one the host creates in-process on loopback,
   * accepting tabs from `appUrl`'s origin only. Pass `RelayOptions` to adjust it (`domains`,
   * `namespace`, timeouts), or a `Relay` you run, with `relayUrl` and `relaySecret`.
   */
  relay?: Relay | Partial<RelayOptions>;
  /** With a `Relay` instance: the tab endpoint the hosted pages connect to (`ws://127.0.0.1:4717/tab`). */
  relayUrl?: string;
  /** With a `Relay` instance: the secret it verifies relay tokens with. */
  relaySecret?: string;
  browser?: HostBrowserOptions;
  /**
   * Provider-operated, session-bound browser authentication. Enabled automatically in local
   * development; production providers supply identity verification and a public HTTPS URL.
   */
  humanHandoff?: false | HostHumanHandoffOptions;
  /** Sessions running at once; starting one more closes the least recently used. Default 20. */
  maxSessions?: number;
  /** A session with no tool call for this long is closed; the next call starts it again. Default 900000 (15 minutes). */
  idleMs?: number;
  /** How long the first page may take to load and connect its surface, in ms. Default 30000. */
  navigationTimeoutMs?: number;
  /**
   * Origins, besides `appUrl`'s, a hosted page may navigate to (exact origins, `https://*.example.com`,
   * `http://localhost:*`), such as an identity provider's sign-in page. Every other navigation is
   * refused and the page stays where it was.
   */
  allowedOrigins?: string[];
  /**
   * `navigations` (the default): refuse navigations outside the allowed origins, top-level and in
   * frames. `all`: refuse every request outside them (scripts, images, `fetch`), for an application
   * that loads nothing from elsewhere.
   */
  restrict?: "navigations" | "all";
  /** Lifetime of each relay token the host mints, in seconds. Default 600; the page renews in-band. */
  tokenTtlSeconds?: number;
  /** The viewport of each hosted page. Default 1280 by 800. */
  viewport?: { width: number; height: number };
  /**
   * How agents authenticate over HTTP: an OAuth 2.1 resource server (`verifier`, and `identify`,
   * the principal and tenant a verified token speaks for). Without it (and without `dev`), `/mcp`
   * is not served and only stdio (`serveStdio({ as })`) reaches the host.
   */
  agentAuth?: RelayAgentAuth;
  /**
   * Serve RFC 9728 protected-resource metadata so MCP clients find your authorization server
   * (`resource` is the `/mcp` URL). Its URL is sent in `WWW-Authenticate` challenges.
   */
  protectedResource?: ProtectedResourceOptions;
  /** Local development. See `HostDevOptions`; `axe host --dev` turns it on. */
  dev?: boolean | HostDevOptions;
  /** Name and description of the MCP server. */
  name?: string;
  description?: string;
  /** The host's audit stream: sessions started, closed, and refused navigations. Never cookies or tokens. */
  onEvent?: (event: HostEvent) => void;
}

/** Why a session closed. `stopped`: Stop, by the agent (`relay_stop`), the person, or the owner. */
export type HostCloseReason = "idle" | "evicted" | "closed" | "crashed" | "stopped" | "shutdown";

/** One line of the host's audit stream. Carries no cookie, header, token, or query string. */
export type HostEvent =
  | { type: "session.starting"; principal: string; tenant: string }
  | { type: "session.ready"; principal: string; tenant: string; ms: number }
  | { type: "session.failed"; principal: string; tenant: string; reason: string }
  | { type: "session.closed"; principal: string; tenant: string; reason: HostCloseReason }
  | { type: "session.crashed"; principal: string; tenant: string }
  | {
      type: "request.blocked";
      principal: string;
      tenant: string;
      /** The refused origin, never the full URL. */
      origin: string;
      navigation: boolean;
    }
  | { type: "relay"; event: RelayEvent };

/** A running hosted session, as `host.sessions()` lists it. */
export interface HostSessionInfo {
  principal: string;
  tenant: string;
  /** The relay tab id of the session's page (stable across restarts of the session). */
  tabId: string;
  state: "starting" | "ready" | "down";
  /** The page's path (never its query). */
  path: string;
  startedAt: string;
  lastUsedAt: string;
}

export interface HostListenOptions {
  /** Default `127.0.0.1`. */
  host?: string;
  /** Default 0 (any free port). */
  port?: number;
}

export interface HostAddress {
  url: string;
  /** Where agents connect over HTTP. */
  mcpUrl: string;
  /** Development: the page that shows the hidden session, polling screenshots. */
  watchUrl: string | null;
  host: string;
  port: number;
}

export interface Host {
  /** The relay the hosted pages connect to. */
  readonly relay: Relay;
  /** Development: the bearer key `/mcp` accepts. */
  readonly devAgentKey: string | null;
  /**
   * Start the identity's session if it is not running (or has crashed), and resolve when its
   * page's surface is connected to the relay. Every tool call does this first.
   */
  session(who: HostIdentity, authInfo?: AuthInfo | null): Promise<HostSessionInfo>;
  /** The running sessions. */
  sessions(): HostSessionInfo[];
  /** A PNG of the identity's page, starting the session if needed. */
  screenshot(
    who: HostIdentity,
    options?: { fullPage?: boolean; authInfo?: AuthInfo | null },
  ): Promise<Buffer>;
  /** Close the identity's session; the next tool call starts a new one. Resolves false when none was running. */
  closeSession(who: HostIdentity): Promise<boolean>;
  /**
   * Stop, for the person or the owner: revoke the session's relay token, close the session, and
   * start none for this identity again until `resume(who)` (or a restart of the host).
   */
  stop(who: HostIdentity): Promise<void>;
  /** Allow sessions for an identity `stop` held. */
  resume(who: HostIdentity): void;
  /** With a `Relay` you run: pass its `onEvent` events here, so Stop in the relay closes the session. */
  relayEvent(event: RelayEvent): void;
  /** The Playwright page of a running session, for diagnostics and tests; null when none runs. */
  page(who: HostIdentity): Page | null;
  /**
   * Serve one AXE request for a caller through this host. Provider registries use this to route a
   * stable MCP endpoint to the selected connector without exposing a per-application MCP server.
   */
  handleAgent(
    request: Request,
    options: {
      who: HostIdentity;
      agent: string;
      authInfo?: AuthInfo | null;
      call?: ToolCallContext;
    },
  ): Promise<Response>;
  /** The HTTP routes (`/mcp`, protected-resource metadata, `/health`, and in development the watch page) as a fetch handler. */
  handle(request: Request, context?: { remoteAddress?: string }): Promise<Response>;
  /** Serve the HTTP routes on a new server. */
  listen(options?: HostListenOptions): Promise<HostAddress>;
  /** The MCP server over stdio, acting for `as` (default in development: the development identity). */
  serveStdio(options?: { as?: HostIdentity }): Promise<DerivedMcpServer>;
  close(): Promise<void>;
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const BINDING = "__axeHostRelayToken";
/** The relay client keeps its tab id under this sessionStorage key (`@axe/relay/client`). */
const TAB_ID_KEY = "axe-relay:tab-id";
/** Cloud metadata endpoints: never reachable from a hosted page, whatever the configuration. */
const METADATA_HOSTS = new Set(["169.254.169.254", "metadata.google.internal", "[fd00:ec2::254]"]);

const DEFAULT_DESCRIPTION =
  "The application, running for you in a browser session on the server and signed in as you (unattended mode): nobody needs to open the site. relay_tabs lists that session's tab. surface_observe returns the page's controls, with what can be done now and why not the rest, under one rev; pass that rev as expectedRev to surface_set-field, surface_run-control, or surface_load-more. Every act runs in the page through the application's own controls, as the person's click would, and is recorded in the tab's ledger. host_screenshot shows the page as it is now; act through the surface tools, not by reading pixels. A control that needs the person's approval is asked through you: tell them what it will do.";

class HostError extends Error {
  constructor(
    message: string,
    readonly reason = "host_session_unavailable",
  ) {
    super(message);
  }
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function originOf(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.origin : null;
  } catch {
    return null;
  }
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
}

function hostnameOf(hostHeader: string | undefined | null): string | null {
  if (!hostHeader) return null;
  try {
    return new URL(`http://${hostHeader}`).hostname;
  } catch {
    return null;
  }
}

function isRelay(x: unknown): x is Relay {
  return (
    typeof x === "object" &&
    x !== null &&
    "axe" in x &&
    typeof (x as { listen?: unknown }).listen === "function" &&
    typeof (x as { tabs?: unknown }).tabs === "function"
  );
}

/** An AXE error envelope as an HTTP response, for a tool call the host answers itself. */
function envelope(message: string, reason: string): Response {
  return new Response(
    JSON.stringify({
      status: "error",
      error: { code: "unavailable", message, retryable: true, details: { reason } },
    }),
    { status: 503, headers: { "Content-Type": "application/json" } },
  );
}

function resultEnvelope(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

interface StoredResponse {
  status: number;
  headers: [string, string][];
  body: Uint8Array;
}

interface StoredRequest {
  url: string;
  method: string;
  headers: [string, string][];
  body?: Uint8Array;
}

async function storeRequest(request: Request): Promise<StoredRequest> {
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  return {
    url: request.url,
    method: request.method,
    headers: [...request.headers.entries()],
    ...(hasBody ? { body: new Uint8Array(await request.arrayBuffer()) } : {}),
  };
}

function restoreRequest(request: StoredRequest): Request {
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    ...(request.body ? { body: request.body.slice() } : {}),
  });
}

async function storeResponse(response: Response): Promise<StoredResponse> {
  return {
    status: response.status,
    headers: [...response.headers.entries()],
    body: new Uint8Array(await response.arrayBuffer()),
  };
}

function restoreResponse(response: StoredResponse): Response {
  return new Response(response.body.slice(), {
    status: response.status,
    headers: response.headers,
  });
}

interface LoginHandoffRecord {
  key: string;
  request: StoredRequest;
  expiresAt: number;
  completed?: StoredResponse;
  running?: Promise<StoredResponse>;
}

interface HumanSessionRecord extends LoginHandoffRecord {
  linkToken: string;
  resumeToken: string;
  tabId: string;
  who: HostIdentity;
  /** Prefix for temporary DOM markers used only by the person's direct-entry overlays. */
  fieldNonce: string;
}

/**
 * The script the host adds to every document of a session, before the page's own scripts: in the
 * application's origin only, it keeps the relay tab id stable and defines `window.__AXE_RELAY__`.
 * Source text rather than a function, so no bundler's helpers leak into the page.
 */
function injectRelayScript(a: {
  origin: string;
  url: string;
  token: string;
  tabId: string;
  binding: string;
  global: string;
  tabIdKey: string;
}): string {
  return `(function (a) {
  if (location.origin !== a.origin) return;
  // The same tab id for every page of this session, and across restarts of the session, so the
  // relay reattaches the agent's selected tab instead of listing a new one.
  try { sessionStorage.setItem(a.tabIdKey, a.tabId); } catch (e) {}
  var mint = window[a.binding];
  var config = Object.freeze({
    url: a.url,
    token: a.token,
    mode: "unattended",
    indicator: false,
    getToken: function () { return mint(); }
  });
  Object.defineProperty(window, a.global, { value: config, writable: false, configurable: false, enumerable: false });
})(${JSON.stringify(a)});`;
}

interface Hosted {
  key: string;
  who: HostIdentity;
  tabId: string;
  context: BrowserContext | null;
  page: Page | null;
  state: "starting" | "ready" | "down";
  startedAt: number;
  lastUsed: number;
  idleTimer: ReturnType<typeof setTimeout> | undefined;
  lastGoodUrl: string;
}

/** Create a session host. See `HostOptions` and docs/host.md. */
export function createHost(options: HostOptions): Host {
  const appOrigin = originOf(options.appUrl);
  if (!appOrigin) throw new Error("createHost: appUrl must be an http(s) URL.");
  const startUrl = new URL(options.startPath ?? "", options.appUrl).href;
  if (originOf(startUrl) !== appOrigin)
    throw new Error("createHost: startPath must stay on appUrl's origin.");
  const dev = options.dev ? (options.dev === true ? {} : options.dev) : null;
  if (dev && options.agentAuth)
    throw new Error("createHost: dev and agentAuth are exclusive (development uses a local key).");
  const devIdentity: HostIdentity = dev?.identity ?? { principal: "dev", tenant: "dev" };
  const devAgentKey = dev ? (dev.agentKey ?? `axh_${randomBytes(24).toString("hex")}`) : null;
  const watchKey = dev ? randomBytes(16).toString("hex") : null;
  const maxSessions = options.maxSessions ?? 20;
  const idleMs = options.idleMs ?? 900_000;
  const navTimeout = options.navigationTimeoutMs ?? 30_000;
  const tokenTtl = options.tokenTtlSeconds ?? 600;
  const humanOptions =
    options.humanHandoff === false ? null : (options.humanHandoff ?? (dev ? {} : null));
  const humanPath = (() => {
    const raw = humanOptions?.pathPrefix?.trim() || "/human-session";
    const path = `/${raw.replace(/^\/+|\/+$/g, "")}`;
    if (path === "/mcp" || path === "/health" || path.startsWith("/.well-known/"))
      throw new Error("createHost: humanHandoff.pathPrefix conflicts with a host route.");
    return path;
  })();
  let humanBase = humanOptions?.baseUrl ? new URL(humanOptions.baseUrl) : null;
  if (
    humanBase &&
    humanBase.protocol !== "https:" &&
    !(humanBase.protocol === "http:" && LOOPBACK_HOSTS.has(humanBase.hostname))
  )
    throw new Error("createHost: humanHandoff.baseUrl must use https (or loopback http).");
  if (humanBase) {
    humanBase.pathname = "/";
    humanBase.search = "";
    humanBase.hash = "";
  }
  const humanTtl = humanOptions?.ttlMs ?? 10 * 60_000;
  if (!Number.isFinite(humanTtl) || humanTtl < 60_000 || humanTtl > 60 * 60_000)
    throw new Error("createHost: humanHandoff.ttlMs must be between one minute and one hour.");
  const restrictAll = options.restrict === "all";
  const extraOrigins = options.allowedOrigins?.length
    ? originMatcher(options.allowedOrigins)
    : () => false;
  const allowed = (origin: string): boolean => origin === appOrigin || extraOrigins(origin);
  const tabSalt = randomBytes(16).toString("hex");
  const emit = (event: HostEvent): void => {
    try {
      options.onEvent?.(event);
    } catch {
      // an audit sink's failure is not the host's
    }
  };

  // -------------------------------------------------------------------------------------------
  // The relay: the host's own on loopback, or one the application runs.
  // -------------------------------------------------------------------------------------------
  let relay: Relay;
  let relaySecret: string;
  let relayUrl: () => Promise<string>;
  const ownRelay = !isRelay(options.relay);
  if (isRelay(options.relay)) {
    if (!options.relayUrl || !options.relaySecret)
      throw new Error("createHost: with a Relay instance, pass relayUrl and relaySecret.");
    relay = options.relay;
    relaySecret = options.relaySecret;
    const given = options.relayUrl;
    relayUrl = () => Promise.resolve(given);
  } else {
    const given: Partial<RelayOptions> = options.relay ?? {};
    relaySecret = given.secret ?? options.relaySecret ?? randomBytes(32).toString("hex");
    const { agentAuth: _a, devPairing: _d, onEvent: relayOnEvent, ...rest } = given;
    relay = createRelay({
      name: options.name ?? "Hosted application",
      description: options.description ?? DEFAULT_DESCRIPTION,
      ...rest,
      ...(options.application ? { application: options.application } : {}),
      secret: relaySecret,
      origins: given.origins ?? [appOrigin],
      onEvent: (event) => {
        relayOnEvent?.(event);
        onRelayEvent(event);
      },
    });
    let started: Promise<string> | null = null;
    // Listen on first use, on loopback: tabs connect from this machine's browser, never from elsewhere.
    relayUrl = () => {
      started ??= relay.listen({ host: "127.0.0.1", port: 0 }).then((a) => a.tabUrl);
      started.catch(() => (started = null));
      return started;
    };
  }

  const mint = (who: HostIdentity): Promise<string> =>
    mintRelayToken(
      {
        principal: who.principal,
        tenant: who.tenant,
        ttl: tokenTtl,
        claims: { mode: "unattended" },
      },
      relaySecret,
    );

  // -------------------------------------------------------------------------------------------
  // The browser and the sessions.
  // -------------------------------------------------------------------------------------------
  let browser: Promise<Browser> | null = null;
  let closing = false;
  const sessions = new Map<string, Hosted>();
  const locks = new Map<string, Promise<unknown>>();
  const keyOf = (who: HostIdentity): string => JSON.stringify([who.tenant, who.principal]);
  /** Identities the person or the owner stopped: no session starts for them until `resume`. */
  const held = new Set<string>();
  /** Pending application-login handoffs, bound to the verified MCP identity that created them. */
  const loginHandoffs = new Map<string, LoginHandoffRecord>();
  /** Visible-browser handoffs, indexed separately by their URL and MCP resume capabilities. */
  const humanByLink = new Map<string, HumanSessionRecord>();
  const humanByResume = new Map<string, HumanSessionRecord>();

  const pruneLoginHandoffs = (): void => {
    const now = Date.now();
    for (const [token, handoff] of loginHandoffs)
      if (handoff.expiresAt <= now) loginHandoffs.delete(token);
    while (loginHandoffs.size >= 1000) loginHandoffs.delete(loginHandoffs.keys().next().value!);
    for (const [token, handoff] of humanByResume) {
      if (handoff.expiresAt > now) continue;
      humanByResume.delete(token);
      humanByLink.delete(handoff.linkToken);
    }
    while (humanByResume.size >= 1000) {
      const token = humanByResume.keys().next().value!;
      const handoff = humanByResume.get(token)!;
      humanByResume.delete(token);
      humanByLink.delete(handoff.linkToken);
    }
  };

  const browserNow = (): Promise<Browser> => {
    browser ??= (async () => {
      let b: Browser;
      if (options.browser?.launch) b = await options.browser.launch();
      else {
        const { chromium } = await import("playwright-core");
        try {
          b = await chromium.launch({
            headless: options.browser?.headless ?? true,
            ...(options.browser?.executablePath
              ? { executablePath: options.browser.executablePath }
              : {}),
            args: [
              // A hosted page on https connects to the relay on loopback; the browser is the
              // host's own, so its local-network prompts have no one to answer them.
              "--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests",
              ...(options.browser?.args ?? []),
            ],
          });
        } catch (e) {
          const first = e instanceof Error ? (e.message.split("\n")[0] ?? "") : String(e);
          throw new HostError(
            `Chromium could not start (${first}). Install it with \`npx playwright install chromium\`, or pass browser.executablePath or browser.launch.`,
          );
        }
      }
      b.on("disconnected", () => {
        browser = null;
        for (const s of sessions.values()) s.state = "down";
      });
      return b;
    })();
    browser.catch(() => (browser = null));
    return browser;
  };

  const withLock = async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    const prior = locks.get(key) ?? Promise.resolve();
    const run = prior.then(fn, fn);
    const tail = run.catch(() => undefined);
    locks.set(key, tail);
    try {
      return await run;
    } finally {
      if (locks.get(key) === tail) locks.delete(key);
    }
  };

  const info = (s: Hosted): HostSessionInfo => ({
    principal: s.who.principal,
    tenant: s.who.tenant,
    tabId: s.tabId,
    state: s.state,
    path: s.page && !s.page.isClosed() ? pathOf(s.page.url()) : "",
    startedAt: new Date(s.startedAt).toISOString(),
    lastUsedAt: new Date(s.lastUsed).toISOString(),
  });

  const tabConnected = (s: Hosted): boolean =>
    relay.tabs(s.who).some((t) => t.tabId === s.tabId && t.state === "connected");

  const waitConnected = async (s: Hosted, ms: number): Promise<boolean> => {
    const until = Date.now() + ms;
    for (;;) {
      if (tabConnected(s)) return true;
      if (s.state === "down" || Date.now() >= until) return false;
      await new Promise((r) => setTimeout(r, 25));
    }
  };

  const touch = (s: Hosted): void => {
    s.lastUsed = Date.now();
    clearTimeout(s.idleTimer);
    s.idleTimer = setTimeout(() => void closeKey(s.key, "idle"), idleMs);
    (s.idleTimer as { unref?: () => void }).unref?.();
  };

  const dispose = async (s: Hosted, reason: HostCloseReason): Promise<void> => {
    if (sessions.get(s.key) === s) sessions.delete(s.key);
    clearTimeout(s.idleTimer);
    s.state = "down";
    const context = s.context;
    s.context = null;
    s.page = null;
    for (const [token, handoff] of humanByResume)
      if (handoff.key === s.key) {
        humanByResume.delete(token);
        humanByLink.delete(handoff.linkToken);
      }
    await context?.close().catch(() => undefined);
    emit({ type: "session.closed", principal: s.who.principal, tenant: s.who.tenant, reason });
  };

  const closeKey = (key: string, reason: HostCloseReason): Promise<boolean> =>
    withLock(key, async () => {
      const s = sessions.get(key);
      if (!s) return false;
      await dispose(s, reason);
      return true;
    });

  /** [S-HOST-7] Refuse what the session may not load: other origins' navigations (or everything, with `restrict: "all"`). */
  const router =
    (s: Hosted, headers: Record<string, string> | undefined) =>
    async (route: Route, request: PwRequest): Promise<void> => {
      const origin = originOf(request.url());
      if (!origin) return route.continue().catch(() => undefined);
      const host = new URL(origin).host.toLowerCase();
      const navigation = request.isNavigationRequest();
      if (!allowed(origin) && (navigation || restrictAll || METADATA_HOSTS.has(host))) {
        emit({
          type: "request.blocked",
          principal: s.who.principal,
          tenant: s.who.tenant,
          origin,
          navigation,
        });
        // A 204 answer to a navigation leaves the page where it was: the application keeps
        // running, and its surface stays connected.
        return (
          navigation ? route.fulfill({ status: 204, body: "" }) : route.abort("blockedbyclient")
        ).catch(() => undefined);
      }
      if (headers && origin === appOrigin)
        return route
          .continue({ headers: { ...request.headers(), ...headers } })
          .catch(() => undefined);
      return route.continue().catch(() => undefined);
    };

  const launch = async (who: HostIdentity, authInfo: AuthInfo | null): Promise<Hosted> => {
    const key = keyOf(who);
    // Room for one more: close the least recently used sessions (never one that is starting).
    const live = [...sessions.values()].sort((a, b) => a.lastUsed - b.lastUsed);
    let count = live.length;
    for (const victim of live) {
      if (count < maxSessions) break;
      if (victim.state === "starting") continue;
      await dispose(victim, "evicted");
      count -= 1;
    }
    const s: Hosted = {
      key,
      who,
      tabId: createHash("sha256").update(`${tabSalt}\n${key}`).digest("base64url").slice(0, 22),
      context: null,
      page: null,
      state: "starting",
      startedAt: Date.now(),
      lastUsed: Date.now(),
      idleTimer: undefined,
      lastGoodUrl: startUrl,
    };
    sessions.set(key, s);
    emit({ type: "session.starting", principal: who.principal, tenant: who.tenant });
    const fail = async (reason: string, message: string): Promise<never> => {
      if (sessions.get(key) === s) sessions.delete(key);
      s.state = "down";
      await s.context?.close().catch(() => undefined);
      s.context = null;
      s.page = null;
      emit({ type: "session.failed", principal: who.principal, tenant: who.tenant, reason });
      throw new HostError(message);
    };
    let session: AppSession | null = null;
    if (options.sessionFor) {
      try {
        session = await options.sessionFor({ ...who, authInfo });
      } catch (error) {
        if (error instanceof SessionLoginRequired) {
          if (sessions.get(key) === s) sessions.delete(key);
          s.state = "down";
          emit({
            type: "session.failed",
            principal: who.principal,
            tenant: who.tenant,
            reason: "application login required",
          });
          throw error;
        }
        // The error may carry a credential; it is neither logged nor returned.
        return fail("sessionFor threw", "The application session for you could not be created.");
      }
      if (!session)
        return fail(
          "sessionFor refused",
          "The application has no session for you (sessionFor refused).",
        );
    }
    try {
      const [b, tabUrl, storageState, token] = await Promise.all([
        browserNow(),
        relayUrl(),
        contextStorageState(session),
        mint(who),
      ]);
      if (closing) return fail("shutdown", "The host is shutting down.");
      const context = await b.newContext({
        viewport: options.viewport ?? { width: 1280, height: 800 },
        // Service workers would fetch around the request rules below.
        serviceWorkers: "block",
        ...(storageState ? { storageState } : {}),
      });
      s.context = context;
      context.on("close", () => {
        if (s.context === context) s.state = "down";
      });
      if (session?.cookies?.length)
        await context.addCookies(
          session.cookies.map((c) => (c.url || c.domain ? c : { ...c, url: appOrigin })),
        );
      // Fresh relay tokens for the page, only for frames of the application's origin.
      await context.exposeBinding(BINDING, async (source) => {
        if (originOf(source.frame.url()) !== appOrigin)
          throw new Error("relay tokens are only for the application's own frames");
        return mint(who);
      });
      await context.addInitScript({
        content: injectRelayScript({
          origin: appOrigin,
          url: tabUrl,
          token,
          tabId: s.tabId,
          binding: BINDING,
          global: INJECTED_RELAY_GLOBAL,
          tabIdKey: TAB_ID_KEY,
        }),
      });
      await context.route("**/*", router(s, session?.headers));
      const page = await context.newPage();
      s.page = page;
      const down = () => {
        if (s.page !== page || s.state === "down") return;
        s.state = "down";
        emit({ type: "session.crashed", principal: who.principal, tenant: who.tenant });
      };
      page.on("crash", down);
      page.on("close", down);
      page.on("framenavigated", (frame) => {
        if (frame === page.mainFrame() && originOf(frame.url()) === appOrigin)
          s.lastGoodUrl = frame.url();
      });
      const t0 = Date.now();
      try {
        await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: navTimeout });
      } catch (e) {
        const first = e instanceof Error ? (e.message.split("\n")[0] ?? "") : String(e);
        return fail("navigation failed", `The application did not load: ${first}`);
      }
      if (!(await waitConnected(s, Math.max(1000, navTimeout - (Date.now() - t0)))))
        return fail(
          "surface not connected",
          `The application's page (${pathOf(page.url())}) did not connect its surface to the relay in time. Check that SurfaceProvider is mounted on that page, that it connects with window.${INJECTED_RELAY_GLOBAL} when present, and that the session is signed in (a redirect to a sign-in page means sessionFor's session was not accepted).`,
        );
      s.state = "ready";
      touch(s);
      emit({
        type: "session.ready",
        principal: who.principal,
        tenant: who.tenant,
        ms: Date.now() - s.startedAt,
      });
      return s;
    } catch (e) {
      if (e instanceof HostError) throw e;
      const first = e instanceof Error ? (e.message.split("\n")[0] ?? "") : String(e);
      return fail("browser error", `The hosted session could not start: ${first}`);
    }
  };

  // Stop in the relay ([S-HOST-8]): the agent's own `relay_stop` ends this session and the next
  // tool call may start another; the person's or the owner's Stop also holds the identity.
  function onRelayEvent(event: RelayEvent): void {
    emit({ type: "relay", event });
    if (event.type !== "tab.stopped") return;
    const key = keyOf(event);
    const s = sessions.get(key);
    if (event.by !== "agent") held.add(key);
    if (s && s.tabId === event.tabId) void closeKey(key, "stopped");
  }

  const ensure = (who: HostIdentity, authInfo: AuthInfo | null): Promise<Hosted> => {
    if (closing) return Promise.reject(new HostError("The host is shutting down."));
    const key = keyOf(who);
    if (held.has(key))
      return Promise.reject(
        new HostError(
          "The person stopped your hosted session of this application. Nothing was started or applied; do not continue unless they ask you to (they can allow it again).",
          "host_session_stopped",
        ),
      );
    return withLock(key, async () => {
      const s = sessions.get(key);
      if (s && s.state !== "down" && s.page && !s.page.isClosed()) {
        touch(s);
        // A human handoff may be visiting an identity provider, where the application's relay is
        // intentionally absent. Keep that exact page alive instead of interpreting the temporary
        // disconnect as a crash and reloading it underneath the person.
        if (
          [...humanByResume.values()].some(
            (record) => record.key === key && record.tabId === s.tabId && !record.completed,
          )
        )
          return s;
        if (tabConnected(s)) return s;
        // The page is alive but its tab is not connected (a reload, a lapsed token): wait a
        // moment, then reload the page once.
        if (await waitConnected(s, 2000)) return s;
        try {
          await s.page.goto(s.lastGoodUrl, { waitUntil: "domcontentloaded", timeout: navTimeout });
        } catch {
          // fall through to a restart
        }
        if (await waitConnected(s, navTimeout)) return s;
      }
      if (s) await dispose(s, "crashed");
      return launch(who, authInfo);
    });
  };

  // -------------------------------------------------------------------------------------------
  // The agent side: the relay's tools over MCP, each call first ensuring the caller's session.
  // -------------------------------------------------------------------------------------------
  const agentAuth: RelayAgentAuth | null = dev
    ? {
        verifier: {
          async verifyAccessToken(token: string): Promise<AuthInfo> {
            if (!devAgentKey || !safeEqual(token, devAgentKey))
              throw new InvalidTokenError("Unknown development key.");
            return { token, clientId: "dev", scopes: [], extra: { sub: devIdentity.principal } };
          },
        } satisfies OAuthTokenVerifier,
        identify: () => devIdentity,
      }
    : (options.agentAuth ?? null);
  const prm = options.protectedResource
    ? protectedResourceMetadata(options.protectedResource)
    : null;

  const authOf = new WeakMap<object, AuthInfo>();
  const whoOf = (ctx: AdapterContext | undefined): HostIdentity | null => {
    const id = ctx?.identity;
    const tenant = id?.claims?.["relayTenant"];
    return id && typeof tenant === "string" ? { principal: id.onBehalfOf, tenant } : null;
  };

  const loginHandoff = async (
    who: HostIdentity,
    request: Request,
    required: SessionLoginRequired,
  ): Promise<Response> => {
    pruneLoginHandoffs();
    const token = `axh_login_${randomBytes(32).toString("base64url")}`;
    loginHandoffs.set(token, {
      key: keyOf(who),
      request: await storeRequest(request),
      expiresAt: required.expiresAt,
    });
    return resultEnvelope({
      status: WIRE.status.needsHuman,
      handoff: {
        reason: "application_login_required",
        instructions: required.instructions,
        url: required.url,
        whatAgentShouldSayToUser: required.whatAgentShouldSayToUser,
        resumeToken: token,
        expiresAt: new Date(required.expiresAt).toISOString(),
      },
    });
  };

  const authenticationState = async (s: Hosted): Promise<string | undefined> =>
    (await relay.refresh(s.who, s.tabId))?.application?.authentication?.state;

  // Surface exists on the application, not on an external identity provider. Avoid waiting for a
  // relay reconnect on every status poll while the person is deliberately on the provider page.
  const currentAuthenticationState = async (s: Hosted): Promise<string | undefined> =>
    s.page && originOf(s.page.url()) === appOrigin ? authenticationState(s) : "signed-out";

  function humanSessionResult(record: HumanSessionRecord): Response {
    const page = new URL(`${humanPath}/${record.linkToken}/`, humanBase!).href;
    return resultEnvelope({
      status: WIRE.status.needsHuman,
      handoff: {
        reason: "application_login_required",
        instructions:
          "Open the secure session page and finish signing in there. It controls the exact private browser session already connected to the agent; do not sign in in another tab. When the page confirms sign-in, resume this request.",
        url: page,
        whatAgentShouldSayToUser: `Please finish signing in to ${options.application?.name ?? "the application"} in the secure session I opened. Your credentials stay out of this conversation.`,
        resumeToken: record.resumeToken,
        expiresAt: new Date(record.expiresAt).toISOString(),
      },
    });
  }

  const humanSessionHandoff = async (s: Hosted, request: Request): Promise<Response | null> => {
    if (!humanOptions || !humanBase || (await authenticationState(s)) !== "signed-out") return null;
    pruneLoginHandoffs();
    const linkToken = randomBytes(32).toString("base64url");
    const resumeToken = `axh_browser_${randomBytes(32).toString("base64url")}`;
    const record: HumanSessionRecord = {
      key: s.key,
      request: await storeRequest(request),
      expiresAt: Date.now() + humanTtl,
      linkToken,
      resumeToken,
      tabId: s.tabId,
      who: s.who,
      fieldNonce: randomBytes(12).toString("base64url"),
    };
    humanByLink.set(linkToken, record);
    humanByResume.set(resumeToken, record);
    return humanSessionResult(record);
  };

  const openHumanSession = (who: HostIdentity): HumanSessionRecord | null => {
    pruneLoginHandoffs();
    const key = keyOf(who);
    const record =
      [...humanByResume.values()].find(
        (candidate) => candidate.key === key && !candidate.completed,
      ) ?? null;
    if (!record) return null;
    const session = sessions.get(key);
    if (session?.page && !session.page.isClosed() && session.tabId === record.tabId) return record;
    humanByResume.delete(record.resumeToken);
    humanByLink.delete(record.linkToken);
    return null;
  };

  const loginResume = async (
    request: Request,
    who: HostIdentity,
    authInfo: AuthInfo | null,
    ctx: AdapterContext,
    call: ToolCallContext | undefined,
  ): Promise<Response | null> => {
    if (new URL(request.url).pathname !== WIRE.path.resume) return null;
    const body = (await request
      .clone()
      .json()
      .catch(() => null)) as Record<string, unknown> | null;
    const token = body?.[WIRE.field.resumeToken];
    if (typeof token !== "string") return null;
    pruneLoginHandoffs();
    if (token.startsWith("axh_browser_")) {
      const handoff = humanByResume.get(token);
      if (!handoff || handoff.key !== keyOf(who))
        return resultEnvelope(
          {
            status: WIRE.status.error,
            error: {
              code: "not_found",
              message: "That secure sign-in session is unknown or expired. Start again.",
              retryable: false,
            },
          },
          404,
        );
      if (handoff.completed) return restoreResponse(handoff.completed);
      const session = sessions.get(handoff.key);
      if (
        !session ||
        session.tabId !== handoff.tabId ||
        (await currentAuthenticationState(session)) !== "signed-in"
      )
        return resultEnvelope(
          {
            status: WIRE.status.error,
            error: {
              code: "conflict",
              message:
                "The application still reports that this private session is signed out. Nothing ran; finish signing in on the secure session page, then call axe_resume again with the same token.",
              retryable: true,
              details: {
                reason: "application_login_pending",
                handoff: { status: "open" },
              },
            },
          },
          409,
        );
      if (!handoff.running)
        handoff.running = (async () => {
          await session.page
            ?.evaluate((nonce) => {
              document
                .querySelectorAll<HTMLElement>(`[data-axe-human-field^="${nonce}-"]`)
                .forEach((element) => element.removeAttribute("data-axe-human-field"));
              if (
                document.documentElement
                  .getAttribute("data-axe-human-document")
                  ?.startsWith(`${nonce}-`)
              )
                document.documentElement.removeAttribute("data-axe-human-document");
            }, handoff.fieldNonce)
            .catch(() => undefined);
          const response = await relay.handleAgent(restoreRequest(handoff.request), ctx, call);
          const stored = await storeResponse(response);
          handoff.completed = stored;
          humanByLink.delete(handoff.linkToken);
          return stored;
        })();
      try {
        return restoreResponse(await handoff.running);
      } finally {
        delete handoff.running;
      }
    }
    if (!token.startsWith("axh_login_")) return null;
    const handoff = loginHandoffs.get(token);
    // Unknown, expired, and another identity's handoff are deliberately indistinguishable.
    if (!handoff || handoff.key !== keyOf(who))
      return resultEnvelope(
        {
          status: WIRE.status.error,
          error: {
            code: "not_found",
            message: "That application sign-in handoff is unknown or expired. Start again.",
            retryable: false,
          },
        },
        404,
      );
    if (handoff.completed) return restoreResponse(handoff.completed);
    if (!handoff.running) {
      handoff.running = (async () => {
        try {
          await ensure(who, authInfo);
        } catch (error) {
          if (error instanceof SessionLoginRequired)
            return storeResponse(
              resultEnvelope(
                {
                  status: WIRE.status.error,
                  error: {
                    code: "conflict",
                    message:
                      "The application has not completed sign-in yet. Nothing ran; ask the person to finish signing in, then call axe_resume again with the same token.",
                    retryable: true,
                    details: {
                      reason: "application_login_pending",
                      handoff: { status: "open" },
                    },
                  },
                },
                409,
              ),
            );
          return storeResponse(
            error instanceof HostError
              ? envelope(error.message, error.reason)
              : envelope("The hosted session could not start.", "host_session_unavailable"),
          );
        }
        const response = await relay.handleAgent(restoreRequest(handoff.request), ctx, call);
        const stored = await storeResponse(response);
        handoff.completed = stored;
        return stored;
      })();
    }
    try {
      return restoreResponse(await handoff.running);
    } finally {
      delete handoff.running;
    }
  };

  const axeFor = (fallback: AdapterContext | undefined): AxeLike => ({
    async handle(request, adapter, call) {
      const ctx = adapter ?? fallback;
      const who = whoOf(ctx);
      if (who) {
        const authInfo = (ctx?.identity && authOf.get(ctx.identity)) ?? null;
        const resumed = await loginResume(request, who, authInfo, ctx ?? {}, call);
        if (resumed) return resumed;
        const open = openHumanSession(who);
        if (open) return humanSessionResult(open);
        try {
          const session = await ensure(who, authInfo);
          const handoff = await humanSessionHandoff(session, request.clone());
          if (handoff) return handoff;
        } catch (e) {
          if (e instanceof SessionLoginRequired) return loginHandoff(who, request.clone(), e);
          return e instanceof HostError
            ? envelope(e.message, e.reason)
            : envelope("The hosted session could not start.", "host_session_unavailable");
        }
      }
      return relay.handleAgent(request, ctx ?? {}, call);
    },
    describe: () => relay.axe.describe(),
    describeLive: () => relay.axe.describeLive(),
    onActionsChanged: (listener) => relay.axe.onActionsChanged(listener),
  });

  const toolError = (text: string): CallToolResult => ({
    content: [{ type: "text", text }],
    isError: true,
  });

  const extraTools = (stdioWho: HostIdentity | null): ExtraTool[] => [
    {
      definition: {
        name: "host_screenshot",
        title: "Screenshot of your hosted session",
        description:
          "Returns a PNG of the application as your hosted browser session shows it now: the page the surface tools act on. Use it to show the person a result. Act through the surface tools, not by reading pixels.",
        inputSchema: {
          type: "object",
          properties: {
            fullPage: {
              type: "boolean",
              description: "Capture the whole scrollable page instead of the viewport.",
            },
          },
          additionalProperties: false,
        },
        annotations: {
          title: "Screenshot of your hosted session",
          readOnlyHint: true,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async call(args, context) {
        const who = context.authInfo
          ? agentAuth
            ? await agentAuth.identify(context.authInfo)
            : null
          : stdioWho;
        if (!who) return toolError("The host could not identify this agent.");
        try {
          const s = await ensure(who, context.authInfo ?? null);
          const png = await s.page!.screenshot({
            type: "png",
            fullPage: args["fullPage"] === true,
          });
          return {
            content: [
              { type: "image", data: png.toString("base64"), mimeType: "image/png" },
              {
                type: "text",
                text: `Your hosted session's page (${pathOf(s.page!.url())}) at ${new Date().toISOString()}.`,
              },
            ],
          };
        } catch (e) {
          return toolError(
            e instanceof SessionLoginRequired
              ? `${e.whatAgentShouldSayToUser} Open ${e.url}, finish signing in, then call relay_tabs before requesting another screenshot.`
              : e instanceof HostError
                ? e.message
                : "The screenshot could not be taken; try again.",
          );
        }
      },
    },
  ];

  const serverName = options.name ?? "Hosted application";
  let httpMcp: Promise<McpHttpHandler | null> | null = null;
  const mcpHandler = (): Promise<McpHttpHandler | null> => {
    httpMcp ??= (async () => {
      if (!agentAuth) return null;
      const derived = await createMcpServer(axeFor(undefined), {
        name: serverName,
        extraTools: extraTools(null),
      });
      return serveHttp(derived, {
        sessions: true,
        auth: {
          verifier: agentAuth.verifier,
          ...(agentAuth.requiredScopes ? { requiredScopes: agentAuth.requiredScopes } : {}),
          ...(agentAuth.resource ? { resource: agentAuth.resource } : {}),
          ...(agentAuth.resourceMetadataUrl || prm
            ? { resourceMetadataUrl: agentAuth.resourceMetadataUrl ?? prm!.url }
            : {}),
        },
        clientFor: async (authInfo) => {
          const who = await agentAuth.identify(authInfo);
          // [S-HOST-1] The agent's own verified identity decides whose session it drives.
          if (!who) return { identity: null };
          const ctx = relayAgentContext(
            JSON.stringify([who.tenant, who.principal, authInfo.clientId]),
            who,
          );
          authOf.set(ctx.identity!, authInfo);
          return ctx;
        },
      });
    })();
    return httpMcp;
  };

  // -------------------------------------------------------------------------------------------
  // HTTP routes.
  // -------------------------------------------------------------------------------------------
  const json = (status: number, body: unknown): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });

  const devRefusal = (
    remote: string | undefined,
    hostHeader: string | undefined,
  ): string | null => {
    if (!dev) return null;
    if (!isLoopbackAddress(remote)) return "the development host serves loopback clients only";
    const name = hostnameOf(hostHeader);
    if (!name || !LOOPBACK_HOSTS.has(name))
      return "the development host needs a loopback Host header";
    return null;
  };

  const humanHeaders = (type: string): Record<string, string> => ({
    "Content-Type": type,
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy":
      "default-src 'none'; img-src 'self' blob:; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'",
  });

  const humanRoute = async (request: Request, url: URL): Promise<Response | null> => {
    if (!humanOptions || !url.pathname.startsWith(`${humanPath}/`)) return null;
    pruneLoginHandoffs();
    const rest = url.pathname.slice(humanPath.length + 1);
    const [linkToken, operation = ""] = rest.split("/");
    if (!linkToken || !/^[A-Za-z0-9_-]{40,64}$/.test(linkToken))
      return json(404, { error: "not found" });
    const record = humanByLink.get(linkToken);
    const session = record ? sessions.get(record.key) : null;
    if (
      !record ||
      !session ||
      session.tabId !== record.tabId ||
      !session.page ||
      session.page.isClosed()
    )
      return new Response("This secure session is unavailable or expired.", {
        status: 410,
        headers: humanHeaders("text/plain; charset=utf-8"),
      });
    const identified = dev ? devIdentity : await humanOptions.identify?.(request);
    const authorized =
      identified?.principal === record.who.principal && identified.tenant === record.who.tenant;
    if (!authorized) {
      if (!operation && request.method === "GET" && humanOptions.signInUrl)
        return new Response(
          humanSessionLoginPage(
            options.application?.name ?? "the application",
            humanOptions.signInUrl(url.href),
          ),
          { status: 401, headers: humanHeaders("text/html; charset=utf-8") },
        );
      return json(401, { error: "sign in to the provider to open this secure session" });
    }
    touch(session);
    if (!operation && request.method === "GET")
      return new Response(humanSessionPage(options.application?.name ?? "the application"), {
        headers: humanHeaders("text/html; charset=utf-8"),
      });
    if (operation === "status" && request.method === "GET") {
      const state = await currentAuthenticationState(session);
      return new Response(
        JSON.stringify({
          complete: state === "signed-in",
          authentication: state ?? "unknown",
          path: pathOf(session.page.url()),
          title: (await session.page.title().catch(() => "")).slice(0, 200),
        }),
        { headers: humanHeaders("application/json") },
      );
    }
    if (operation === "screenshot.png" && request.method === "GET") {
      try {
        const png = await session.page.screenshot({ type: "png" });
        return new Response(new Uint8Array(png), {
          headers: humanHeaders("image/png"),
        });
      } catch {
        return json(409, { error: "the application page is changing; retry" });
      }
    }
    if (operation === "fields" && request.method === "GET") {
      const viewport = session.page.viewportSize();
      if (!viewport) return json(409, { error: "the application viewport is unavailable" });
      try {
        const fields = await session.page.evaluate(
          ([nonce, documentCandidate]) => {
            const win = window as unknown as Window & Record<string, unknown>;
            let documentMarker = document.documentElement.getAttribute("data-axe-human-document");
            if (!documentMarker?.startsWith(`${nonce}-`)) {
              documentMarker = `${nonce}-${documentCandidate}`;
              document.documentElement.setAttribute("data-axe-human-document", documentMarker);
            }
            const counterKey = `__axe_human_field_${documentMarker}`;
            let counter = Number(win[counterKey] ?? 0);
            const visible = [
              ...document.querySelectorAll<HTMLElement>(
                'input:not([type="hidden"]), textarea, [contenteditable]:not([contenteditable="false"])',
              ),
            ].filter((element) => {
              const style = getComputedStyle(element);
              const rect = element.getBoundingClientRect();
              const input = element instanceof HTMLInputElement ? element : null;
              return (
                !element.hasAttribute("disabled") &&
                !input?.readOnly &&
                style.visibility !== "hidden" &&
                style.display !== "none" &&
                Number(style.opacity) !== 0 &&
                rect.width >= 12 &&
                rect.height >= 12 &&
                rect.right > 0 &&
                rect.bottom > 0 &&
                rect.left < innerWidth &&
                rect.top < innerHeight
              );
            });
            const result = visible.slice(0, 50).map((element) => {
              let id = element.getAttribute("data-axe-human-field");
              if (!id?.startsWith(`${documentMarker}-`)) {
                id = `${documentMarker}-${++counter}`;
                element.setAttribute("data-axe-human-field", id);
              }
              const rect = element.getBoundingClientRect();
              const left = Math.max(0, rect.left);
              const top = Math.max(0, rect.top);
              const right = Math.min(innerWidth, rect.right);
              const bottom = Math.min(innerHeight, rect.bottom);
              const input = element instanceof HTMLInputElement ? element : null;
              const area = element instanceof HTMLTextAreaElement ? element : null;
              const rawType = input?.type ?? (area ? "textarea" : "text");
              const type = ["email", "password", "search", "tel", "text", "url"].includes(rawType)
                ? rawType
                : "text";
              const label =
                element.getAttribute("aria-label") ||
                input?.labels?.[0]?.innerText ||
                area?.labels?.[0]?.innerText ||
                element.getAttribute("placeholder") ||
                element.getAttribute("name") ||
                "Sign-in field";
              return {
                id,
                x: left,
                y: top,
                width: Math.max(0, right - left),
                height: Math.max(0, bottom - top),
                type,
                multiline: !!area || element.isContentEditable,
                label: label.trim().slice(0, 200),
                placeholder: (element.getAttribute("placeholder") ?? "").slice(0, 200),
                autocomplete: (element.getAttribute("autocomplete") ?? "").slice(0, 100),
                inputmode: (element.getAttribute("inputmode") ?? "").slice(0, 30),
              };
            });
            win[counterKey] = counter;
            return result;
          },
          [record.fieldNonce, randomBytes(8).toString("base64url")] as const,
        );
        return new Response(JSON.stringify({ viewport, fields }), {
          headers: humanHeaders("application/json"),
        });
      } catch {
        return json(409, { error: "the application fields are changing; retry" });
      }
    }
    if (operation === "input" && request.method === "POST") {
      if (request.headers.get("origin") !== humanBase?.origin)
        return json(403, { error: "cross-origin input refused" });
      const length = Number(request.headers.get("content-length") ?? "0");
      if (Number.isFinite(length) && length > 8192)
        return json(413, { error: "input is too large" });
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body || typeof body["type"] !== "string") return json(400, { error: "invalid input" });
      const page = session.page;
      try {
        switch (body["type"]) {
          case "field-focus":
          case "field-text": {
            const field = body["field"];
            if (
              typeof field !== "string" ||
              !field.startsWith(`${record.fieldNonce}-`) ||
              !/^[A-Za-z0-9_-]{18,100}$/.test(field)
            )
              return json(400, { error: "invalid field" });
            const target = page.locator(`[data-axe-human-field="${field}"]`).first();
            if (!(await target.count())) return json(409, { error: "the field changed; retry" });
            if (body["type"] === "field-focus") await target.focus();
            else {
              const value = body["text"];
              if (typeof value !== "string" || value.length > 4096)
                return json(400, { error: "invalid text" });
              await target.fill(value);
            }
            break;
          }
          case "pointer": {
            const x = Number(body["x"]);
            const y = Number(body["y"]);
            const viewport = page.viewportSize();
            if (
              !viewport ||
              !Number.isFinite(x) ||
              !Number.isFinite(y) ||
              x < 0 ||
              y < 0 ||
              x > viewport.width ||
              y > viewport.height
            )
              return json(400, { error: "invalid pointer coordinates" });
            await page.mouse.click(x, y);
            break;
          }
          case "key": {
            const key = body["key"];
            if (key !== "Enter") return json(400, { error: "invalid key" });
            await page.keyboard.press(key);
            break;
          }
          case "wheel": {
            const y = Number(body["y"]);
            if (!Number.isFinite(y) || Math.abs(y) > 2000)
              return json(400, { error: "invalid scroll distance" });
            await page.mouse.wheel(0, y);
            break;
          }
          default:
            return json(400, { error: "invalid input type" });
        }
      } catch {
        return json(409, { error: "the application page changed before input arrived; retry" });
      }
      return json(200, { ok: true });
    }
    return json(404, { error: "not found" });
  };

  const handle = async (
    request: Request,
    context: { remoteAddress?: string } = {},
  ): Promise<Response> => {
    const url = new URL(request.url);
    const why = devRefusal(context.remoteAddress, request.headers.get("host") ?? url.host);
    if (why) return json(403, { error: why });
    const human = await humanRoute(request, url);
    if (human) return human;
    if (url.pathname === "/health") return json(200, { ok: true });
    if (prm && url.pathname === prm.path) return prm.handler(request);
    if (url.pathname === "/mcp") {
      const h = await mcpHandler();
      if (!h)
        return json(404, { error: "this host serves no agents over HTTP (configure agentAuth)" });
      return h(request);
    }
    if (watchKey && url.pathname.startsWith(`/watch/${watchKey}`)) {
      const rest = url.pathname.slice(`/watch/${watchKey}`.length);
      const s = sessions.get(keyOf(devIdentity));
      if (rest === "" || rest === "/")
        return new Response(watchPage(options.appUrl), {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "Content-Security-Policy":
              "default-src 'none'; img-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'",
          },
        });
      if (rest === "/screenshot.png") {
        // Watching does not start a session, and does not keep one alive.
        if (!s?.page || s.page.isClosed() || s.state !== "ready")
          return json(404, { error: "no session is running", state: s?.state ?? "none" });
        try {
          const png = await s.page.screenshot({ type: "png" });
          return new Response(new Uint8Array(png), {
            headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
          });
        } catch {
          return json(404, { error: "no session is running" });
        }
      }
      if (rest === "/stop" && request.method === "POST") {
        const origin = request.headers.get("origin");
        if (origin && origin !== url.origin) return json(403, { error: "cross-origin" });
        const was = sessions.has(keyOf(devIdentity));
        await stop(devIdentity);
        return json(200, { closed: was, held: true });
      }
    }
    return json(404, { error: "not found" });
  };

  const stop = async (who: HostIdentity): Promise<void> => {
    const key = keyOf(who);
    held.add(key);
    for (const [token, handoff] of loginHandoffs)
      if (handoff.key === key) loginHandoffs.delete(token);
    for (const [token, handoff] of humanByResume)
      if (handoff.key === key) {
        humanByResume.delete(token);
        humanByLink.delete(handoff.linkToken);
      }
    const s = sessions.get(key);
    // Revoke the tab's token at the relay first, so nothing more runs in the page.
    if (s) relay.stop(who, s.tabId);
    await closeKey(key, "stopped");
  };

  const owned = new Set<HttpServer>();
  const sockets = new Set<Socket>();
  let stdio: DerivedMcpServer | null = null;

  return {
    relay,
    devAgentKey,
    async session(who, authInfo = null) {
      return info(await ensure(who, authInfo));
    },
    sessions: () => [...sessions.values()].map(info),
    async screenshot(who, opts = {}) {
      const s = await ensure(who, opts.authInfo ?? null);
      return s.page!.screenshot({ type: "png", fullPage: opts.fullPage === true });
    },
    closeSession: (who) => closeKey(keyOf(who), "closed"),
    stop,
    resume: (who) => void held.delete(keyOf(who)),
    relayEvent: (event) => onRelayEvent(event),
    page(who) {
      const s = sessions.get(keyOf(who));
      return s?.page && !s.page.isClosed() ? s.page : null;
    },
    async handleAgent(request, agentOptions) {
      const ctx = relayAgentContext(agentOptions.agent, agentOptions.who);
      if (ctx.identity && agentOptions.authInfo) authOf.set(ctx.identity, agentOptions.authInfo);
      const resumed = await loginResume(
        request,
        agentOptions.who,
        agentOptions.authInfo ?? null,
        ctx,
        agentOptions.call,
      );
      if (resumed) return resumed;
      const open = openHumanSession(agentOptions.who);
      if (open) return humanSessionResult(open);
      try {
        const session = await ensure(agentOptions.who, agentOptions.authInfo ?? null);
        const handoff = await humanSessionHandoff(session, request.clone());
        if (handoff) return handoff;
      } catch (error) {
        if (error instanceof SessionLoginRequired)
          return loginHandoff(agentOptions.who, request.clone(), error);
        return error instanceof HostError
          ? envelope(error.message, error.reason)
          : envelope("The hosted session could not start.", "host_session_unavailable");
      }
      return relay.handleAgent(request, ctx, agentOptions.call);
    },
    handle,
    async listen(opts = {}) {
      const host = opts.host ?? "127.0.0.1";
      if (dev && !LOOPBACK_HOSTS.has(host))
        throw new Error(
          `The development host listens on loopback only; refusing to listen on ${host}.`,
        );
      const server = createServer((req, res) => void serveNode(req, res, handle));
      owned.add(server);
      server.on("connection", (sock: Socket) => {
        sockets.add(sock);
        sock.on("close", () => sockets.delete(sock));
      });
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
      humanBase ??= new URL(base);
      return {
        url: base,
        mcpUrl: `${base}/mcp`,
        watchUrl: watchKey ? `${base}/watch/${watchKey}` : null,
        host,
        port,
      };
    },
    async serveStdio(opts = {}) {
      const as = opts.as ?? (dev ? devIdentity : null);
      if (!as)
        throw new Error(
          "serveStdio: pass `as` (the identity this local agent acts for), or use dev.",
        );
      const derived = await createMcpServer(axeFor(relayAgentContext("stdio", as)), {
        name: serverName,
        extraTools: extraTools(as),
      });
      await serveStdio(derived);
      stdio = derived;
      return derived;
    },
    async close() {
      closing = true;
      loginHandoffs.clear();
      humanByLink.clear();
      humanByResume.clear();
      await Promise.all([...sessions.values()].map((s) => dispose(s, "shutdown")));
      const b = browser ? await browser.catch(() => null) : null;
      browser = null;
      await b?.close().catch(() => undefined);
      const h = httpMcp ? await httpMcp : null;
      await h?.close();
      await stdio?.server.close().catch(() => undefined);
      if (ownRelay) await relay.close();
      for (const sock of sockets) sock.destroy();
      await Promise.all(
        [...owned].map((srv) => new Promise<void>((resolve) => srv.close(() => resolve()))),
      );
    },
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
    const init: RequestInit = { method, headers };
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
    const host = req.headers.host ?? "host.invalid";
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
