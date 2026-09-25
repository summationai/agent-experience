/**
 * Relay tokens: short-lived credentials an application's backend mints for the signed-in person
 * and hands to its own page, which presents one to the relay when it connects. A relay token is a
 * JSON Web Token signed with HMAC-SHA256 (`alg: HS256`) under a key used for nothing else, so a
 * backend can mint it with this helper or with any JWT library:
 *
 *   { "sub": "<user id>", "org": "<tenant id>", "aud": "axe-relay", "iat": ..., "exp": ..., "jti": "..." }
 *
 * `sub` is the principal and `org` the tenant; other claims (a member id, say) are carried and
 * returned. The relay checks the signature, the algorithm, the audience, and the expiry, and
 * refuses a token that lives longer than a day. It is never a session cookie: the page's session
 * stays with the application.
 *
 * Web Crypto only, so the same code runs in Node 20+, edge runtimes, Deno, and Bun.
 */
import type { RelayPrincipal } from "./protocol";

export type { RelayPrincipal };

/** The longest lifetime a relay token may have, in seconds: one day. Minutes are the intended scale. */
export const MAX_RELAY_TOKEN_TTL = 24 * 60 * 60;
/** The audience relay tokens carry unless you choose another. */
export const RELAY_AUDIENCE = "axe-relay";
const MIN_SECRET = 32;
const RESERVED = new Set(["sub", "org", "aud", "iat", "exp", "jti", "nbf", "iss"]);

type Claim = string | number | boolean | null;

export interface MintRelayTokenInput extends RelayPrincipal {
  /** Lifetime in seconds. Default 600 (ten minutes); at most one day. The page renews in-band. */
  ttl?: number;
  /** The `aud` claim. Default `axe-relay`; the relay's `audience` option must match. */
  audience?: string;
  /** Extra claims to carry, such as a member id (`{ mid: "m_42" }`). Registered claim names are refused. */
  claims?: Record<string, Claim>;
  /** Clock in ms, for tests. */
  now?: number;
}

/** What `verifyRelayToken` returns for a valid token. */
export interface RelayTokenClaims extends RelayPrincipal {
  /** Expiry, seconds since the epoch. */
  exp: number;
  /** Issued at, seconds since the epoch (the verification time when the token has none). */
  iat: number;
  /** The token's id, or a digest of the token when it has none; the relay revokes it on Stop. */
  jti: string;
  /** Every claim the token carried, as sent. */
  claims: Record<string, unknown>;
}

export interface VerifyRelayTokenOptions {
  /** The audience to require. Default `axe-relay`. */
  audience?: string;
  /** Clock in ms, for tests. */
  now?: number;
}

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) throw new Error("not base64url");
  const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function checkSecret(secret: string): void {
  if (typeof secret !== "string" || secret.length < MIN_SECRET)
    throw new Error(`relay token secret must be at least ${MIN_SECRET} characters.`);
}

async function keyFor(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return b64url(bytes);
}

const HEADER = b64url(enc.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));

/**
 * Mint a relay token for the signed-in person. Call it in your backend, in a request your own
 * session authenticated, and return the token to your own page (never in a URL).
 */
export async function mintRelayToken(input: MintRelayTokenInput, secret: string): Promise<string> {
  checkSecret(secret);
  if (typeof input.principal !== "string" || !input.principal)
    throw new Error("mintRelayToken: principal is required.");
  if (typeof input.tenant !== "string" || !input.tenant)
    throw new Error("mintRelayToken: tenant is required.");
  const ttl = input.ttl ?? 600;
  if (!Number.isFinite(ttl) || ttl <= 0 || ttl > MAX_RELAY_TOKEN_TTL)
    throw new Error(`mintRelayToken: ttl must be between 1 and ${MAX_RELAY_TOKEN_TTL} seconds.`);
  for (const k of Object.keys(input.claims ?? {}))
    if (RESERVED.has(k)) throw new Error(`mintRelayToken: claims must not set the registered claim "${k}".`);
  const iat = Math.floor((input.now ?? Date.now()) / 1000);
  const payload = {
    ...(input.claims ?? {}),
    sub: input.principal,
    org: input.tenant,
    aud: input.audience ?? RELAY_AUDIENCE,
    iat,
    exp: iat + Math.floor(ttl),
    jti: randomId(),
  };
  const body = `${HEADER}.${b64url(enc.encode(JSON.stringify(payload)))}`;
  const sig = await crypto.subtle.sign("HMAC", await keyFor(secret), enc.encode(body));
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

/**
 * Check a relay token: the HS256 signature, the audience, the expiry, and a lifetime of at most
 * one day. Returns its principal (`sub`), tenant (`org`), and claims, or null for any token that
 * is not valid now. Never throws for a bad token.
 */
export async function verifyRelayToken(
  token: string,
  secret: string,
  options: VerifyRelayTokenOptions = {},
): Promise<RelayTokenClaims | null> {
  checkSecret(secret);
  if (typeof token !== "string" || token.length > 8192) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  let header: { alg?: unknown; typ?: unknown };
  let payload: Record<string, unknown>;
  let sig: Uint8Array;
  try {
    header = JSON.parse(new TextDecoder().decode(unb64url(parts[0]!))) as typeof header;
    payload = JSON.parse(new TextDecoder().decode(unb64url(parts[1]!))) as Record<string, unknown>;
    sig = unb64url(parts[2]!);
  } catch {
    return null;
  }
  // Only HS256: never `none`, never an algorithm the token chooses for itself.
  if (header?.alg !== "HS256") return null;
  const ok = await crypto.subtle.verify(
    "HMAC",
    await keyFor(secret),
    sig as BufferSource,
    enc.encode(`${parts[0]}.${parts[1]}`),
  );
  if (!ok || typeof payload !== "object" || payload === null) return null;
  const { sub, org, aud, exp, iat, nbf, jti } = payload;
  if (typeof sub !== "string" || !sub || typeof org !== "string" || !org) return null;
  const audience = options.audience ?? RELAY_AUDIENCE;
  const audOk = typeof aud === "string" ? aud === audience : Array.isArray(aud) && aud.includes(audience);
  if (!audOk) return null;
  const now = Math.floor((options.now ?? Date.now()) / 1000);
  if (typeof exp !== "number" || !Number.isFinite(exp) || exp <= now) return null;
  if (typeof nbf === "number" && nbf > now) return null;
  const issued = typeof iat === "number" && Number.isFinite(iat) ? iat : now;
  // A relay token is short-lived by construction; a long-lived one is refused.
  if (exp - Math.min(issued, now) > MAX_RELAY_TOKEN_TTL) return null;
  const id =
    typeof jti === "string" && jti
      ? jti
      : b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(token))));
  return { principal: sub, tenant: org, exp, iat: issued, jti: id, claims: { ...payload } };
}
