/**
 * Signed, opaque tokens for continuation, resume, and poll, plus the pluggable
 * `TokenStore` that holds server-side state. See spec §12.
 *
 * Token format: `base64url(payload).base64url(hmacSha256(payload))`.
 * The payload binds type, id, action, input hash, acting principal, tenant, and expiry.
 * `state` never enters the token; it lives in the store under the token id. Whether a token has
 * been used, and the envelope its use produced, live in the `IdempotencyStore` as an operation
 * claim (spec §12.2), not here.
 */
import type { Accept, Handoff, JsonValue, RequestContext, Revision } from "./types";
import { ExpiringMap } from "./retention";
import type { RetentionOptions } from "./retention";

export type TokenType = "continuation" | "resume" | "poll";

interface TokenPayload {
  t: TokenType;
  id: string;
  a: string;
  h: string;
  u: string | null;
  n: string | null;
  e: number;
}

/** What the server remembers about an outstanding token. Must be JSON-serializable. */
export interface TokenRecord {
  id: string;
  type: TokenType;
  action: string;
  inputHash: string;
  /**
   * The acting principal the token is bound to, as `principalOf` encodes it (`user:<id>`,
   * `site:<id>`, or both), or null for an anonymous call. Every endpoint that accepts the token
   * requires the same principal ([P-TOK-6]).
   */
  principal: string | null;
  tenant: string | null;
  expiresAt: number;
  /** Site-provided state for `onContinue` / `onResume` / `onPoll`. */
  state: JsonValue | undefined;
  /** Continuation only: the accepted entries, with JSON Schemas. */
  accepts?: Accept[];
  /** Resume only: the handoff as sent, so it can be re-served while open. */
  handoff?: Handoff;
  /** Resume only: whether the handoff was created by the SDK for login. */
  login?: {
    input: JsonValue;
    context: RequestContext;
    idempotencyKey?: string;
    /** The revision the agent observed on the original call; re-checked when the action runs after sign-in. */
    expectedRev?: Revision;
  };
  /** Resume only: refuse resume until completion is recorded. */
  requireCompletion?: boolean;
  /** Resume only: recorded by `completeHandoff`. */
  completion?: { at: string; onBehalfOf?: string; data?: JsonValue };
  /** Resume only: the person cancelled the handoff on the site (`cancelHandoff`); a resume is refused ([P-APPR-5]). */
  cancelled?: { at: string; by?: string; reason?: string };
  /** Resume only: the handoff is an approval request (spec §9.3). */
  approval?: ApprovalRecord;
}

/** What the server keeps about an approval request, beside the resume token's own binding. */
export interface ApprovalRecord {
  /** The call's input exactly as sent; its fingerprint is the token's input hash. */
  input: JsonValue;
  /** What `approvalState` returned at the request, and its canonical hash. */
  state: JsonValue;
  stateHash: string;
  /** The site's preview for the approval page. */
  preview?: JsonValue;
  /** The agent's self-identification from `User-Agent`, when it sent one. Not authenticated. */
  agent: { name: string; version: string } | null;
  requestedAt: string;
  /** Set by `approveHandoff`. */
  approved?: { at: string; by: string };
  /** Set when the bound state was found changed, at approval or at resume; permanent ([P-APPR-6]). */
  invalidated?: { at: string };
}

/**
 * Storage for token records. Implement with Redis, a KV store, or a database for
 * multi-instance deployments. The in-memory implementation is the default. Records are written
 * when a token is minted and when `completeHandoff` records a completion; single use is enforced
 * by an operation claim in the `IdempotencyStore`, so this store needs no atomic operation.
 */
export interface TokenStore {
  get(id: string): Promise<TokenRecord | undefined>;
  set(id: string, record: TokenRecord, ttlSeconds: number): Promise<void>;
  delete(id: string): Promise<void>;
}

/**
 * In-memory `TokenStore` with expiry. Suitable for a single process. Retention is bounded
 * ([P-LIM-4]): expired records are swept on writes at most once per `sweepIntervalMs`, and at
 * `maxEntries` the oldest records are evicted (an evicted token answers `not_found`). No timer
 * runs, so nothing keeps a process alive.
 */
export class MemoryTokenStore implements TokenStore {
  private readonly map: ExpiringMap<{ record: TokenRecord; expiresAt: number }>;

  constructor(options: RetentionOptions = {}) {
    this.map = new ExpiringMap("MemoryTokenStore", options);
  }

  async get(id: string): Promise<TokenRecord | undefined> {
    return this.map.get(id)?.record;
  }

  async set(id: string, record: TokenRecord, ttlSeconds: number): Promise<void> {
    this.map.set(id, { record, expiresAt: this.map.now() + ttlSeconds * 1000 });
  }

  async delete(id: string): Promise<void> {
    this.map.delete(id);
  }

  /** Drop every expired record now; returns how many. Writes do this on their own; see `sweepIntervalMs`. */
  sweep(): number {
    return this.map.sweep();
  }

  /** Drop every record. Later calls throw. There is no timer to stop. */
  close(): void {
    this.map.close();
  }

  /** Number of records held (expired ones not yet swept included), for tests. */
  get size(): number {
    return this.map.size;
  }
}

const encoder = new TextEncoder();

export function base64UrlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(text: string): Uint8Array<ArrayBuffer> {
  const padded =
    text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  const s = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** SHA-256 of a canonical JSON encoding, base64url. Used to bind tokens and idempotency keys to inputs. */
export async function hashJson(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(canonicalJson(value)));
  return base64UrlEncode(new Uint8Array(digest));
}

/** Deterministic JSON: object keys sorted recursively. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const keys = Object.keys(value as object).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`).join(",")}}`;
}

export function randomId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/** Signs and verifies tokens with one HMAC secret. */
export class TokenSigner {
  constructor(private readonly secret: string) {
    if (!secret || secret.length < 16) {
      throw new Error(
        "createAXE: `secret` must be a string of at least 16 characters. It signs continuation and resume tokens; generate one with `openssl rand -hex 32` and load it from your environment.",
      );
    }
  }

  /**
   * A keyed hash of `value` (HMAC-SHA256 under the secret, base64url). Used for a site key's
   * principal id when `verifySiteKey` returns no id, so the raw key is never stored.
   */
  async keyedHash(label: string, value: string): Promise<string> {
    const sig = await crypto.subtle.sign(
      "HMAC",
      await hmacKey(this.secret),
      encoder.encode(`${label}\n${value}`),
    );
    return base64UrlEncode(new Uint8Array(sig));
  }

  async sign(payload: TokenPayload): Promise<string> {
    const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
    const sig = await crypto.subtle.sign("HMAC", await hmacKey(this.secret), encoder.encode(body));
    return `${body}.${base64UrlEncode(new Uint8Array(sig))}`;
  }

  /** Returns the payload when the signature verifies and the token has not expired; otherwise `undefined`. */
  async verify(token: string, expectedType: TokenType): Promise<TokenPayload | undefined> {
    if (typeof token !== "string") return undefined;
    const dot = token.lastIndexOf(".");
    if (dot <= 0) return undefined;
    const body = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    let ok = false;
    try {
      ok = await crypto.subtle.verify(
        "HMAC",
        await hmacKey(this.secret),
        base64UrlDecode(sig),
        encoder.encode(body),
      );
    } catch {
      return undefined;
    }
    if (!ok) return undefined;
    let payload: TokenPayload;
    try {
      payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as TokenPayload;
    } catch {
      return undefined;
    }
    if (payload.t !== expectedType) return undefined;
    if (typeof payload.e !== "number" || payload.e <= Date.now()) return undefined;
    return payload;
  }
}

export interface MintOptions {
  type: TokenType;
  action: string;
  inputHash: string;
  principal: string | null;
  tenant: string | null;
  ttlSeconds: number;
  state: JsonValue | undefined;
  accepts?: Accept[];
  login?: TokenRecord["login"];
}

/** Create a token and its record; the caller stores the record (possibly after adding the handoff). */
export async function mintToken(
  signer: TokenSigner,
  options: MintOptions,
): Promise<{ token: string; record: TokenRecord; expiresAt: string }> {
  const id = randomId();
  const expiresAt = Date.now() + options.ttlSeconds * 1000;
  const token = await signer.sign({
    t: options.type,
    id,
    a: options.action,
    h: options.inputHash,
    u: options.principal,
    n: options.tenant,
    e: expiresAt,
  });
  const record: TokenRecord = {
    id,
    type: options.type,
    action: options.action,
    inputHash: options.inputHash,
    principal: options.principal,
    tenant: options.tenant,
    expiresAt,
    state: options.state,
  };
  if (options.accepts) record.accepts = options.accepts;
  if (options.login) record.login = options.login;
  return { token, record, expiresAt: new Date(expiresAt).toISOString() };
}

/**
 * Verify a token and load its record, checking that the record matches the binding in the token
 * and that the token was minted for the tenant serving this request ([P-TOK-6]). Every failure is
 * `{ kind: "invalid" }`, so a caller answers all of them with the same `not_found`. The acting
 * principal is checked by the server, which has to resolve it from the request first.
 */
export async function loadToken(
  signer: TokenSigner,
  store: TokenStore,
  token: string,
  type: TokenType,
  tenant: string | null,
): Promise<{ kind: "ok"; record: TokenRecord } | { kind: "invalid" }> {
  const payload = await signer.verify(token, type);
  if (!payload) return { kind: "invalid" };
  if ((payload.n ?? null) !== tenant) return { kind: "invalid" };
  const record = await store.get(payload.id);
  if (
    !record ||
    record.type !== type ||
    record.action !== payload.a ||
    record.inputHash !== payload.h ||
    record.expiresAt !== payload.e
  ) {
    return { kind: "invalid" };
  }
  if ((record.principal ?? null) !== (payload.u ?? null) || (record.tenant ?? null) !== tenant) {
    return { kind: "invalid" };
  }
  return { kind: "ok", record };
}
