/**
 * The request policy: which POSTs the runtime refuses before it reads a body, establishes an
 * identity, or looks at a token (spec [P-TRANS-1] to [P-TRANS-4]).
 *
 * Two rules, both aimed at requests a browser sends on a page's behalf without a preflight:
 *
 * - Content type. A body on a state-changing endpoint (a POST to an action that is not
 *   `readOnly`, or to `/axe/continue` or `/axe/resume`) must be `application/json` or a
 *   `+json` type. A browser can send `text/plain`, form-encoded, or multipart bodies to any
 *   origin without asking first; it cannot send `application/json` that way.
 * - Origin. A POST that carries ambient credentials (a `Cookie` header, by default) must come
 *   from the site's own origin or an origin the site trusts. The site's origin is taken from
 *   `baseUrl` (or the tenant's `baseUrl`), never from `Host`, `Forwarded`, or `X-Forwarded-*`.
 *   A request with neither `Origin` nor `Sec-Fetch-Site` is not a browser request and passes.
 *
 * Everything here is a pure function of a `Request` and the resolved configuration.
 */
import type { ErrorBody } from "./types";
import { WIRE } from "./vocabulary";

/** When the origin rule applies. */
export type OriginCheck = "cookie" | "always" | "off";

/** `createAXE({ requestPolicy })`: how the runtime treats browser-shaped POSTs. */
export interface RequestPolicyConfig {
  /**
   * Refuse a POST to a state-changing endpoint unless its `Content-Type` is `application/json`
   * or `application/*+json`. Default true.
   */
  requireJsonContentType?: boolean;
  /**
   * Origins, besides the origin of `baseUrl` (and of a tenant's `baseUrl`), whose browser
   * requests may carry ambient credentials. Exact origins such as `https://app.example`: a
   * scheme, a host, and a port when it is not the default. No wildcards, no paths.
   * Origins listed in `cors.origins` with `cors.allowCredentials` are trusted as well.
   */
  trustedOrigins?: string[];
  /**
   * `"cookie"` (default): check `Origin` on a POST that carries a `Cookie` header.
   * `"always"`: check it on every POST that names an origin, cookie or not, for sites whose
   * browsers hold other ambient credentials (HTTP authentication, client certificates).
   * `"off"`: never check it; the site enforces CSRF protection itself, in front of the runtime.
   */
  originCheck?: OriginCheck;
}

/** The policy after defaults and validation. */
export interface ResolvedRequestPolicy {
  requireJsonContentType: boolean;
  originCheck: OriginCheck;
  /** Normalized trusted origins, including credentialed CORS origins. */
  trustedOrigins: ReadonlySet<string>;
}

/** The parts of the server configuration the policy reads. */
export interface RequestPolicySource {
  requestPolicy?: RequestPolicyConfig;
  cors?: { origins: "*" | string[]; allowCredentials?: boolean };
}

/** The origin of an absolute URL or origin string, lowercased with the default port dropped; null when it has none. */
export function normalizeOrigin(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  return url.origin;
}

/** Validate and default a `requestPolicy`. Throws on a trusted origin that is not an exact origin. */
export function resolveRequestPolicy(source: RequestPolicySource): ResolvedRequestPolicy {
  const cfg = source.requestPolicy ?? {};
  const originCheck = cfg.originCheck ?? "cookie";
  if (!["cookie", "always", "off"].includes(originCheck)) {
    throw new Error(
      `createAXE: requestPolicy.originCheck must be "cookie", "always", or "off". Received ${JSON.stringify(originCheck)}.`,
    );
  }
  const trusted = new Set<string>();
  for (const raw of cfg.trustedOrigins ?? []) {
    const origin = typeof raw === "string" ? normalizeOrigin(raw) : null;
    if (!origin || origin !== raw.replace(/\/$/, "").toLowerCase()) {
      throw new Error(
        `createAXE: requestPolicy.trustedOrigins entry ${JSON.stringify(raw)} is not an exact origin. Write it as scheme://host[:port], for example https://app.example; wildcards and paths are not accepted.`,
      );
    }
    trusted.add(origin);
  }
  const cors = source.cors;
  if (cors?.allowCredentials && Array.isArray(cors.origins)) {
    for (const raw of cors.origins) {
      const origin = normalizeOrigin(raw);
      if (origin) trusted.add(origin);
    }
  }
  return {
    requireJsonContentType: cfg.requireJsonContentType !== false,
    originCheck,
    trustedOrigins: trusted,
  };
}

/** Whether a `Content-Type` value is JSON: `application/json` or `application/<x>+json`, parameters ignored. */
export function isJsonContentType(value: string | null | undefined): boolean {
  if (!value) return false;
  const type = value.split(";")[0]!.trim().toLowerCase();
  return type === "application/json" || /^application\/[a-z0-9!#$&^_.-]+\+json$/.test(type);
}

/** Whether the request carries credentials a browser attaches without being asked: a `Cookie` header. */
export function hasAmbientCredentials(request: Request): boolean {
  return (request.headers.get("cookie") ?? "").trim().length > 0;
}

/**
 * Whether a browser request came from an accepted origin. `Origin` decides when present
 * (`null` is never accepted); otherwise `Sec-Fetch-Site` of `cross-site` or `same-site` is
 * refused; a request with neither header is not from a browser and is accepted.
 */
export function isAcceptedOrigin(request: Request, accepted: ReadonlySet<string>): boolean {
  const origin = request.headers.get("origin");
  if (origin !== null) {
    const normalized = normalizeOrigin(origin.trim());
    return normalized !== null && accepted.has(normalized);
  }
  const site = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  return site !== "cross-site" && site !== "same-site";
}

/** What `evaluateRequestPolicy` needs to know about the request's place in the protocol. */
export interface PolicyContext {
  /** The request path with any `baseUrl` prefix removed. */
  path: string;
  /** Absolute URLs whose origins are the site's own: `baseUrl`, and the tenant's `baseUrl`. */
  siteUrls: (string | undefined | null)[];
  /** Whether the named action is declared `readOnly`. An unknown name counts as not read-only. */
  isReadOnly: (actionName: string) => boolean;
}

/** Which POST endpoint a path is, or null for anything the policy leaves alone. */
export function classifyPost(
  path: string,
  isReadOnly: (actionName: string) => boolean,
): "write" | "read" | null {
  if (path === WIRE.path.continue || path === WIRE.path.resume) return "write";
  const prefix = `${WIRE.path.actions}/`;
  if (!path.startsWith(prefix)) return null;
  let name: string;
  try {
    name = decodeURIComponent(path.slice(prefix.length));
  } catch {
    return "write";
  }
  return isReadOnly(name) ? "read" : "write";
}

/**
 * Apply the policy to one request. Returns the error to send, or undefined when the request
 * may proceed. Only POSTs to action, continue, and resume endpoints are ever refused; GET,
 * HEAD, and OPTIONS pass untouched.
 */
export function evaluateRequestPolicy(
  request: Request,
  policy: ResolvedRequestPolicy,
  ctx: PolicyContext,
): ErrorBody | undefined {
  if (request.method.toUpperCase() !== "POST") return undefined;
  const kind = classifyPost(ctx.path, ctx.isReadOnly);
  if (kind === null) return undefined;

  const checkOrigin =
    policy.originCheck === "always" ||
    (policy.originCheck === "cookie" && hasAmbientCredentials(request));
  if (checkOrigin) {
    const accepted = new Set(policy.trustedOrigins);
    for (const u of ctx.siteUrls) {
      const o = u ? normalizeOrigin(u) : null;
      if (o) accepted.add(o);
    }
    if (!isAcceptedOrigin(request, accepted)) {
      return {
        code: WIRE.error.forbidden,
        message:
          "This site does not accept credentialed requests from the origin that sent this one. Nothing was read or run.",
        retryable: false,
        details: { reason: WIRE.reason.crossOriginRefused },
      };
    }
  }

  if (
    kind === "write" &&
    policy.requireJsonContentType &&
    !isJsonContentType(request.headers.get(WIRE.header.contentType))
  ) {
    return {
      code: WIRE.error.unsupported,
      message:
        "Requests that can change state must send Content-Type: application/json. Nothing was read or run.",
      retryable: false,
      details: { reason: WIRE.reason.jsonRequired },
    };
  }
  return undefined;
}
