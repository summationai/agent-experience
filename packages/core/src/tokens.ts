/**
 * Signed, opaque tokens for continuation, resume, and poll, plus the pluggable
 * `TokenStore` that holds server-side state. See spec §12.
 *
 * Token format: `base64url(payload).base64url(hmacSha256(payload))`.
 * The payload binds type, id, action, input hash, acting user, tenant, and expiry.
 * `state` never enters the token; it lives in the store under the token id.
 */
import type { Accept, Handoff, JsonValue, RequestContext, Result, Revision } from "./types";

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
  onBehalfOf: string | null;
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
  /** Set once the token has been used. */
  consumedAt?: number;
  /** Poll only: the terminal result once produced. */
  terminal?: Result;
}

/**
 * Storage for token records. Implement with Redis, a KV store, or a database for
 * multi-instance deployments. The in-memory implementation is the default.
 */
export interface TokenStore {
  get(id: string): Promise<TokenRecord | undefined>;
  set(id: string, record: TokenRecord, ttlSeconds: number): Promise<void>;
  delete(id: string): Promise<void>;
}

/** In-memory `TokenStore` with expiry. Suitable for a single process. */
export class MemoryTokenStore implements TokenStore {
  private readonly map = new Map<string, { record: TokenRecord; expires: number }>();

  async get(id: string): Promise<TokenRecord | undefined> {
    const entry = this.map.get(id);
    if (!entry) return undefined;
    if (entry.expires <= Date.now()) {
      this.map.delete(id);
      return undefined;
    }
    return entry.record;
  }

  async set(id: string, record: TokenRecord, ttlSeconds: number): Promise<void> {
    this.map.set(id, { record, expires: Date.now() + ttlSeconds * 1000 });
  }

  async delete(id: string): Promise<void> {
    this.map.delete(id);
  }

  /** Number of live records, for tests. */
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
  onBehalfOf: string | null;
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
    u: options.onBehalfOf,
    n: options.tenant,
    e: expiresAt,
  });
  const record: TokenRecord = {
    id,
    type: options.type,
    action: options.action,
    inputHash: options.inputHash,
    onBehalfOf: options.onBehalfOf,
    tenant: options.tenant,
    expiresAt,
    state: options.state,
  };
  if (options.accepts) record.accepts = options.accepts;
  if (options.login) record.login = options.login;
  return { token, record, expiresAt: new Date(expiresAt).toISOString() };
}

/**
 * Verify a token and load its record, checking that the record matches the binding in the token.
 * Returns `{ kind: "invalid" }` for tampered/expired/unknown, `{ kind: "consumed" }` for used tokens.
 */
export async function loadToken(
  signer: TokenSigner,
  store: TokenStore,
  token: string,
  type: TokenType,
): Promise<
  | { kind: "ok"; record: TokenRecord }
  | { kind: "invalid" }
  | { kind: "consumed"; record: TokenRecord }
> {
  const payload = await signer.verify(token, type);
  if (!payload) return { kind: "invalid" };
  const record = await store.get(payload.id);
  if (
    !record ||
    record.type !== type ||
    record.action !== payload.a ||
    record.inputHash !== payload.h
  ) {
    return { kind: "invalid" };
  }
  if (
    (record.onBehalfOf ?? null) !== (payload.u ?? null) ||
    (record.tenant ?? null) !== (payload.n ?? null)
  ) {
    return { kind: "invalid" };
  }
  if (record.consumedAt !== undefined && type !== "poll") return { kind: "consumed", record };
  return { kind: "ok", record };
}
