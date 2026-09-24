// lib/session.ts — maps the request's session cookie to an AXE identity.
// Replace the lookup with your auth library (next-auth, iron-session, Clerk, ...).
// #region all
import type { Identity } from "@axe/core";

const SESSIONS = new Map<string, string>([["s_demo", "applicant_0142"]]);

/** Web Request in: App Router route handlers receive one. */
export async function applicantFromRequest(request: Request): Promise<Identity | null> {
  return applicantFromCookieHeader(request.headers.get("cookie"));
}

/** Cookie header in: Pages API handlers expose it as req.headers.cookie. */
export async function applicantFromCookieHeader(
  cookie: string | null | undefined,
): Promise<Identity | null> {
  const sid = /(?:^|;\s*)ng_session=([^;]+)/.exec(cookie ?? "")?.[1];
  const applicantId = sid ? SESSIONS.get(sid) : undefined;
  return applicantId ? { onBehalfOf: applicantId } : null;
}
// #endregion all
