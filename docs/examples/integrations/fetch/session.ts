// session.ts — maps a Web Request to the signed-in customer.
// #region all
import type { Identity } from "@axe/core";

/** The two methods we use from a KV namespace, a Redis client, or a table. */
export interface SessionLookup {
  get(key: string): Promise<string | null>;
}

const LOCAL: SessionLookup = {
  async get(key) {
    return key === "s_demo" ? "cust_8812" : null;
  },
};

/**
 * A browser on your site sends the session cookie; an agent holding a token the
 * customer granted sends it as a bearer. Both resolve to the same identity.
 */
export async function customerFrom(request: Request, sessions: SessionLookup = LOCAL): Promise<Identity | null> {
  const bearer = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  const cookie = /(?:^|;\s*)fo_session=([^;]+)/.exec(request.headers.get("cookie") ?? "")?.[1];
  const sid = bearer ?? cookie;
  const customerId = sid ? await sessions.get(sid) : null;
  return customerId ? { onBehalfOf: customerId } : null;
}
// #endregion all
