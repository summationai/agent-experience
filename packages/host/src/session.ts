/**
 * Identity to application session: what `sessionFor` returns, and the helpers the SDK ships.
 *
 * The SDK never issues an application session. The application does: in development from a
 * storage state an operator captured once (`axe host login`, `storageStateSession`), in
 * production from the verified identity of the agent's own sign-in (see docs/host.md,
 * "Production"). Nothing here logs a cookie, a header, or a token.
 */
import { readFile } from "node:fs/promises";
import type { AuthInfo } from "@axe/mcp";
import type { RelayPrincipal } from "@axe/relay/server";

/** Who a hosted session is for: one principal in one tenant, as the agent's sign-in named them. */
export type HostIdentity = RelayPrincipal;

/** What `sessionFor` receives. */
export interface SessionRequest extends HostIdentity {
  /**
   * The agent's verified access token, as the MCP endpoint's verifier returned it (HTTP), or null
   * (stdio and development, where the identity is configured rather than signed in). Use it to
   * exchange for an application session; never put it in the page.
   */
  authInfo: AuthInfo | null;
}

/** A cookie for the session's browser context. Without `url` or `domain`, it is set for the application's origin. */
export interface SessionCookie {
  name: string;
  value: string;
  url?: string;
  domain?: string;
  path?: string;
  /** Seconds since the epoch; omit for a session cookie. */
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

/** A Playwright storage state: cookies and each origin's `localStorage`. */
export interface StorageState {
  cookies: {
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: "Strict" | "Lax" | "None";
  }[];
  origins: { origin: string; localStorage: { name: string; value: string }[] }[];
}

/**
 * What a hosted session starts with, returned by `sessionFor`. Every part is optional; they
 * combine (the storage state first, then `cookies` and `localStorage` over it).
 */
export interface AppSession {
  /** A Playwright storage state: a file path or the object (`axe host login` writes one). */
  storageState?: string | StorageState;
  /** Cookies to set, such as the application's session cookie. */
  cookies?: SessionCookie[];
  /** Headers sent with every request to the application's origin, and to no other origin. */
  headers?: Record<string, string>;
  /** `localStorage` entries by origin: `{ "https://app.example.com": { key: "value" } }`. */
  localStorage?: Record<string, Record<string, string>>;
}

/**
 * A trusted application's session exchange can throw this when the person must sign in before it
 * can mint a browser session. The host turns it into an identity-bound MCP human handoff; the
 * password is entered only at `url` and never crosses the agent or this SDK.
 */
export class SessionLoginRequired extends Error {
  readonly url: string;
  readonly instructions: string;
  readonly whatAgentShouldSayToUser: string;
  /** Milliseconds since the epoch. */
  readonly expiresAt: number;

  constructor(options: {
    url: string;
    instructions?: string;
    whatAgentShouldSayToUser?: string;
    /** An RFC 3339 timestamp or milliseconds since the epoch. Default: ten minutes from now. */
    expiresAt?: string | number;
  }) {
    let login: URL;
    try {
      login = new URL(options.url);
    } catch {
      throw new Error("SessionLoginRequired: url must be an absolute http(s) URL.");
    }
    if (login.protocol !== "https:" && login.protocol !== "http:")
      throw new Error("SessionLoginRequired: url must be an absolute http(s) URL.");
    const expiresAt =
      options.expiresAt === undefined
        ? Date.now() + 10 * 60_000
        : typeof options.expiresAt === "number"
          ? options.expiresAt
          : Date.parse(options.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now())
      throw new Error("SessionLoginRequired: expiresAt must be a future timestamp.");
    const whatAgentShouldSayToUser =
      options.whatAgentShouldSayToUser?.trim() ||
      "Please sign in to the application so I can continue.";
    super(whatAgentShouldSayToUser);
    this.name = "SessionLoginRequired";
    this.url = login.href;
    this.instructions =
      options.instructions?.trim() ||
      "Sign in on the application's page, then return to your assistant and say you are done.";
    this.whatAgentShouldSayToUser = whatAgentShouldSayToUser;
    this.expiresAt = expiresAt;
  }
}

/**
 * Turns the agent's identity into the application session its hosted browser starts with. Return
 * null (or throw) to refuse: the agent is told its session could not start, and nothing runs.
 * Throw `SessionLoginRequired` to give the person a trusted sign-in page and let the agent resume
 * the original tool call after the session exchange succeeds.
 */
export type SessionFor = (
  request: SessionRequest,
) => AppSession | null | Promise<AppSession | null>;

/**
 * Development: every identity gets the storage state saved at `path` (by `axe host login`). The
 * file holds a signed-in person's cookies: keep it out of version control, and never use this in
 * production, where each identity must get its own session.
 */
export function storageStateSession(path: string): SessionFor {
  return () => ({ storageState: path });
}

/**
 * Cookies from your own code, for each identity: `cookieSession(async ({ principal, tenant,
 * authInfo }) => [{ name: "session", value: await mintSessionFor(principal, tenant) }])`. Return
 * null to refuse.
 */
export function cookieSession(
  cookies: (request: SessionRequest) => SessionCookie[] | null | Promise<SessionCookie[] | null>,
): SessionFor {
  return async (request) => {
    const list = await cookies(request);
    return list ? { cookies: list } : null;
  };
}

/** The storage state a context starts with: the session's own, with its `localStorage` merged in. */
export async function contextStorageState(
  session: AppSession | null,
): Promise<StorageState | undefined> {
  if (!session || (!session.storageState && !session.localStorage)) return undefined;
  let state: StorageState = { cookies: [], origins: [] };
  if (typeof session.storageState === "string") {
    const text = await readFile(session.storageState, "utf8").catch(() => {
      throw new Error(
        `The storage state file ${session.storageState} could not be read. Run \`axe host login <app url>\` to create it.`,
      );
    });
    try {
      state = JSON.parse(text) as StorageState;
    } catch {
      throw new Error(`The storage state file ${session.storageState} is not JSON.`);
    }
  } else if (session.storageState) {
    state = session.storageState;
  }
  const origins = new Map<string, Map<string, string>>();
  for (const o of state.origins ?? [])
    origins.set(o.origin, new Map((o.localStorage ?? []).map((e) => [e.name, e.value])));
  for (const [origin, entries] of Object.entries(session.localStorage ?? {})) {
    const m = origins.get(origin) ?? new Map<string, string>();
    for (const [k, v] of Object.entries(entries)) m.set(k, v);
    origins.set(origin, m);
  }
  return {
    cookies: state.cookies ?? [],
    origins: [...origins].map(([origin, m]) => ({
      origin,
      localStorage: [...m].map(([name, value]) => ({ name, value })),
    })),
  };
}
