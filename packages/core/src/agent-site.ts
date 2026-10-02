/**
 * @summationai/axe-core/agent-site: the site's side of the agent web, for the site's own server
 * (Node; it signs forms with node:crypto). The pages a person opens from an agent's deep link, on
 * the site's own origin, signed in with the site's own session. Mount it at `/agent` and
 * `/agent/*`:
 *
 *   const agent = agentSiteHandler({ serviceUrl, secret, identify, session, loginUrl });
 *   // in a route handler: return (await agent(request)) ?? next();
 *
 * - `/agent`: where an agent that found the site starts. By default the agent web's pages
 *   (`/agent`, `/agent/start`, `/agent/s/...`) are answered from this site, passed through to the
 *   service, so an agent stays on the site's origin; with `agentUrl`, a 303 to its `/start`.
 * - `agentEntry(request)`: in the site's page handler, sends an agent's browser arriving from
 *   outside on to `/agent` (also from `@summationai/axe-core/agent-entry`, which has no Node imports,
 *   for an Edge middleware).
 * - `/agent/signin?agent_session=<id>`: connect this agent session to the signed-in person (the
 *   page shows the code the agent showed; the person confirms it matches).
 * - `/agent/approve/<id>`: the exact high-risk action the agent asked for; Approve or Decline.
 * - `/agent/input/<id>`: a text field the agent cannot fill; the person types it here.
 *
 * Each form carries a nonce bound to the request, the person, and the site secret. The outcome goes
 * to the agent web service over its site API, authenticated with the same secret.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export { agentBrowsers, agentEntry, forwardCookies } from "./agent-entry";
export type { AgentEntryOptions } from "./agent-entry";

/** A cookie for the agent's headless page (Playwright's cookie shape). */
export interface AgentSiteCookie {
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

/** A whole browser storage state for the agent's headless page (Playwright's shape). */
export interface AgentSiteStorageState {
  cookies: Array<Required<Omit<AgentSiteCookie, "url">>>;
  origins: Array<{ origin: string; localStorage: Array<{ name: string; value: string }> }>;
}

/** What the site's server sends when the person connects a session. */
export interface BindRequest {
  principal: string;
  tenant?: string;
  displayName?: string;
  /** The application session for the headless page: cookies, or a whole storage state. */
  cookies?: AgentSiteCookie[];
  storageState?: AgentSiteStorageState;
}

/** An agent session, as the site API describes it to the site. */
export interface AgentSessionInfo {
  id: string;
  code: string;
  state: "pending" | "bound";
  appName: string;
  principal?: string;
}

/** A pending approval or text request, as the site API describes it to the site. */
export interface PendingInfo {
  id: string;
  kind: "approval" | "text";
  state: "open" | "done";
  principal: string | null;
  appName: string;
  /** An approval: the question, as the person reads it. */
  question?: { name: string; message: string; summary: string };
  /** A text request: the field it fills. */
  field?: { label: string; maxLength: number | null };
}

export interface AgentSiteIdentity {
  principal: string;
  tenant?: string;
  displayName?: string;
}

export interface AgentSiteOptions {
  /** The agent web service's origin, as the site's server reaches it. */
  serviceUrl: string;
  /**
   * Omit (the default) to serve the agent web's pages from this site: `/agent` (the start page),
   * `/agent/start`, and `/agent/s/...` are passed through to `serviceUrl`, so an agent never
   * leaves the site's origin (run the service with `--public <site>/agent`, its default). Set it
   * to the agent web's own public origin to send agents there instead, with a 303 from `/agent`
   * to `<agentUrl>/start`.
   */
  agentUrl?: string;
  /** The secret shared with the service (`siteSecret`). */
  secret: string;
  /** Where these pages live. Default `/agent`. */
  basePath?: string;
  /** The signed-in person for this request, or null. */
  identify: (request: Request) => Promise<AgentSiteIdentity | null> | AgentSiteIdentity | null;
  /**
   * The application session the agent's headless page runs with, for this person: cookies, or a
   * storage state. A site should mint a session for the agent rather than hand over the person's
   * own browser cookie; it can then end it on its own.
   */
  session: (
    request: Request,
    who: AgentSiteIdentity,
  ) =>
    | Promise<{ cookies?: AgentSiteCookie[]; storageState?: AgentSiteStorageState }>
    | {
        cookies?: AgentSiteCookie[];
        storageState?: AgentSiteStorageState;
      };
  /** The site's sign-in page, returning to `returnTo` afterwards. */
  loginUrl: (returnTo: string) => string;
  /** Replace the fetch the handler uses to reach the service (tests). */
  fetch?: typeof fetch;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function page(title: string, body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:34rem;margin:3rem auto;padding:0 1rem;color:#1a1a1a;background:#fff}code{font-size:1.4em;letter-spacing:.08em}button{font:inherit;padding:.5rem 1.2rem;margin-right:.5rem;border-radius:.4rem;border:1px solid #888;background:#f4f4f4;cursor:pointer}button.primary{background:#1a4fd6;color:#fff;border-color:#1a4fd6}textarea{font:inherit;width:100%;min-height:6rem}@media (prefers-color-scheme:dark){body{background:#161616;color:#eee}button{background:#2a2a2a;color:#eee}}</style></head><body>${body}</body></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "no-referrer",
      },
    },
  );
}

/** Request headers passed on to the agent web: what it logs to tell agents apart, and content negotiation. */
const FORWARDED = [
  "user-agent",
  "accept",
  "accept-language",
  "sec-fetch-site",
  "sec-fetch-dest",
  "signature-agent",
  "signature",
  "signature-input",
  "x-forwarded-for",
  "cf-connecting-ip",
];
/** Response headers passed back: the page's type, its no-store caching, and a redirect. */
const RETURNED = ["content-type", "cache-control", "location", "vary"];

export function agentSiteHandler(
  o: AgentSiteOptions,
): (request: Request) => Promise<Response | null> {
  const base = (o.basePath ?? "/agent").replace(/\/+$/, "");
  const service = o.serviceUrl.replace(/\/+$/, "");
  const agentUrl = o.agentUrl?.replace(/\/+$/, "");
  const doFetch = o.fetch ?? fetch;
  const api = (path: string, init: RequestInit = {}) =>
    doFetch(`${service}/api${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${o.secret}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  // The agent web's own pages, answered from this origin. The service's site API (`/api/...`)
  // is not among them: it needs the secret and only this server calls it.
  const passThrough = async (request: Request, target: string): Promise<Response> => {
    // The secret proves to the service that this is the site it serves.
    const headers = new Headers({ Authorization: `Bearer ${o.secret}` });
    for (const h of FORWARDED) {
      const v = request.headers.get(h);
      if (v) headers.set(h, v);
    }
    let res: Response;
    try {
      res = await doFetch(target, { method: request.method, headers, redirect: "manual" });
    } catch {
      return new Response("The agent web is not reachable from this site right now.\n", {
        status: 502,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
    const out = new Headers();
    for (const h of RETURNED) {
      const v = res.headers.get(h);
      if (v) out.set(h, v);
    }
    return new Response(request.method === "HEAD" ? null : res.body, {
      status: res.status,
      headers: out,
    });
  };
  const nonce = (...parts: string[]) =>
    createHmac("sha256", o.secret).update(parts.join("\n")).digest("base64url");
  const nonceOk = (given: string | null, ...parts: string[]) => {
    if (!given) return false;
    const want = Buffer.from(nonce(...parts));
    const got = Buffer.from(given);
    return want.length === got.length && timingSafeEqual(want, got);
  };

  return async (request) => {
    // Not set up (no shared secret): the site has no agent pages, so its routes answer as usual.
    if (!o.secret) return null;
    const url = new URL(request.url);
    // `/agent` itself is where an agent that found the site starts.
    const isEntry = url.pathname === base || url.pathname === `${base}/`;
    if (!agentUrl && (request.method === "GET" || request.method === "HEAD")) {
      const rest = url.pathname.slice(base.length);
      if (isEntry || rest === "/start" || rest.startsWith("/s/"))
        return passThrough(request, `${service}${isEntry ? "/start" : rest}${url.search}`);
    }
    if (agentUrl && isEntry && request.method === "GET")
      return new Response(`Agents start at ${agentUrl}/start\n`, {
        status: 303,
        headers: {
          Location: `${agentUrl}/start`,
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    if (!url.pathname.startsWith(`${base}/`)) return null;
    const rest = url.pathname
      .slice(base.length + 1)
      .split("/")
      .filter(Boolean);
    const who = await o.identify(request);
    // A relative sign-in path is the usual answer, and it must resolve against the origin the
    // person's browser is on (a proxy or a tunnel's), not the one this server sees.
    if (!who)
      return new Response(null, {
        status: 303,
        headers: { Location: o.loginUrl(url.pathname + url.search), "Cache-Control": "no-store" },
      });
    const form = request.method === "POST" ? await request.formData() : null;

    if (rest[0] === "signin") {
      const sid = url.searchParams.get("agent_session") ?? "";
      const r = await api(`/sessions/${encodeURIComponent(sid)}`);
      if (!r.ok)
        return page(
          "Link not valid",
          "<h1>This link is not valid</h1><p>Ask your agent to start again.</p>",
          404,
        );
      const s = (await r.json()) as AgentSessionInfo;
      if (s.state === "bound")
        return page(
          "Already connected",
          "<h1>Already connected</h1><p>This agent session is already connected. If that wasn't you, ask your agent to start again.</p>",
          409,
        );
      if (form) {
        if (!nonceOk(form.get("nonce") as string | null, "signin", sid, who.principal))
          return page("Not accepted", "<p>That was not accepted. Reload the page.</p>", 400);
        if (form.get("decision") !== "connect")
          return page(
            "Not connected",
            "<h1>Not connected</h1><p>Nothing was shared. You can close this tab.</p>",
          );
        const session = await o.session(request, who);
        const bind: BindRequest = {
          principal: who.principal,
          ...(who.tenant ? { tenant: who.tenant } : {}),
          ...(who.displayName ? { displayName: who.displayName } : {}),
          ...session,
        };
        const b = await api(`/sessions/${encodeURIComponent(sid)}/bind`, {
          method: "POST",
          body: JSON.stringify(bind),
        });
        return b.ok
          ? page(
              "Connected",
              `<h1>Connected</h1><p>Your agent can now work in ${esc(s.appName)} as ${esc(who.displayName ?? who.principal)}. Go back to it and tell it you are connected.</p>`,
            )
          : page(
              "Not connected",
              "<h1>Not connected</h1><p>The session could not be connected. Ask your agent to start again.</p>",
              502,
            );
      }
      return page(
        `Connect your agent to ${s.appName}`,
        `<h1>Connect your agent to ${esc(s.appName)}?</h1><p>Your agent showed you a code. Connect only if it is this one:</p><p><code>${esc(s.code)}</code></p><p>It will be able to read and use ${esc(s.appName)} as <strong>${esc(who.displayName ?? who.principal)}</strong>. It will ask you here before anything high-risk, and it never sees your password.</p><form method="post"><input type="hidden" name="nonce" value="${nonce("signin", sid, who.principal)}"><button class="primary" name="decision" value="connect">Connect</button><button name="decision" value="cancel">Cancel</button></form>`,
      );
    }

    if ((rest[0] === "approve" || rest[0] === "input") && rest[1]) {
      const pid = rest[1];
      const r = await api(`/pending/${encodeURIComponent(pid)}`);
      if (!r.ok)
        return page(
          "Link not valid",
          "<h1>This request is no longer open</h1><p>It was answered, or it lapsed. Ask your agent to try again.</p>",
          404,
        );
      const p = (await r.json()) as PendingInfo;
      // Only the person the session acts for answers it.
      if (p.principal !== who.principal)
        return page("Not yours", "<h1>This request is for another account</h1>", 403);
      if (p.state !== "open")
        return page(
          "Already answered",
          "<h1>Already answered</h1><p>Go back to your agent.</p>",
          409,
        );
      const kind = rest[0] === "approve" ? "approval" : "text";
      if (p.kind !== kind) return page("Link not valid", "<h1>This link is not valid</h1>", 404);
      if (form) {
        if (!nonceOk(form.get("nonce") as string | null, kind, pid, who.principal))
          return page("Not accepted", "<p>That was not accepted. Reload the page.</p>", 400);
        const body =
          kind === "approval"
            ? {
                principal: who.principal,
                by: who.displayName ?? who.principal,
                approve: form.get("decision") === "approve",
              }
            : {
                principal: who.principal,
                by: who.displayName ?? who.principal,
                text: String(form.get("text") ?? ""),
              };
        const a = await api(`/pending/${encodeURIComponent(pid)}`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        if (!a.ok)
          return page(
            "Not saved",
            "<h1>That could not be saved</h1><p>Go back to your agent and try again.</p>",
            502,
          );
        return page(
          "Done",
          kind === "approval"
            ? `<h1>${(body as { approve: boolean }).approve ? "Approved" : "Declined"}</h1><p>Go back to your agent and tell it you decided.</p>`
            : "<h1>Saved</h1><p>Go back to your agent and tell it you are done.</p>",
        );
      }
      const n = nonce(kind, pid, who.principal);
      return kind === "approval"
        ? page(
            `Approve ${p.question?.name ?? "this"}?`,
            `<h1>Approve “${esc(p.question?.name ?? "")}”?</h1><p>On ${esc(p.appName)}. ${esc(p.question?.summary ?? "")}</p><p>Your agent asked to do this in your account. Nothing runs unless you approve.</p><form method="post"><input type="hidden" name="nonce" value="${n}"><button class="primary" name="decision" value="approve">Approve</button><button name="decision" value="deny">Decline</button></form>`,
          )
        : page(
            `Type ${p.field?.label ?? "a value"}`,
            `<h1>${esc(p.field?.label ?? "")}</h1><p>Your agent needs this typed on ${esc(p.appName)}. It will not see what you type, only that it was set.</p><form method="post"><input type="hidden" name="nonce" value="${n}"><p><textarea name="text"${p.field?.maxLength ? ` maxlength="${p.field.maxLength}"` : ""} autofocus></textarea></p><button class="primary">Save</button></form>`,
          );
    }
    return page("Not found", "<h1>Not found</h1>", 404);
  };
}
