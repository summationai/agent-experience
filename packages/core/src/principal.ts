/**
 * The acting principal (spec [P-TOK-6]): who a token, an idempotency key, and an operation claim
 * belong to. One string encodes the site key's identity, the user's, or both, so a user whose id
 * happens to look like a site id can never share a scope with that site.
 */

/** What a `site` call resolved to: the key's stable id, and the actions it may call when limited. */
export interface SiteKeyContext {
  /**
   * The id `verifySiteKey` returned; when it returned `true` or an object without `id`, a keyed
   * hash of the presented key (HMAC-SHA256 under the server `secret`), so two unrelated keys never
   * share a scope and the raw key is never stored.
   */
  id: string;
  /** The allowlist `verifySiteKey` returned, when it limited the key. */
  actions?: string[];
  /** True when `id` is the keyed hash because `verifySiteKey` returned no id. */
  derived?: true;
}

/** Encode a principal. Null when the call is anonymous and carries no site key. */
export function principalOf(user: string | null | undefined, site: string | null | undefined) {
  const parts: string[] = [];
  if (site) parts.push(`site:${encodeURIComponent(site)}`);
  if (user) parts.push(`user:${encodeURIComponent(user)}`);
  return parts.length ? parts.join(" ") : null;
}

/** Decode a principal from `principalOf`. */
export function parsePrincipal(principal: string | null | undefined): {
  user: string | null;
  site: string | null;
} {
  const out = { user: null as string | null, site: null as string | null };
  for (const part of (principal ?? "").split(" ")) {
    if (part.startsWith("user:")) out.user = decodeURIComponent(part.slice(5));
    else if (part.startsWith("site:")) out.site = decodeURIComponent(part.slice(5));
  }
  return out;
}
