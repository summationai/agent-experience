import { describe, expect, it } from "vitest";
import {
  action,
  createAXE,
  evaluateRequestPolicy,
  hasAmbientCredentials,
  isAcceptedOrigin,
  isJsonContentType,
  normalizeOrigin,
  resolveRequestPolicy,
  z,
} from "../src/index";
import type { AXEConfig, RequestPolicyConfig } from "../src/index";

const SITE = "https://shop.example";
const SECRET = "0123456789abcdef0123456789abcdef";
const JSON_CT = { "content-type": "application/json" };

/** A cookie-session site: `sid=alice` is Alice's session; Bearer tokens work too. */
function site(extra: Partial<AXEConfig> = {}) {
  const writes: string[] = [];
  const axe = createAXE({
    name: "Fieldstone Outfitters",
    description:
      "Track orders and start returns for purchases from an online outdoor-clothing shop. Requires the customer to be signed in.",
    baseUrl: SITE,
    auth: {
      modes: ["none", "user"],
      authenticate: (req) => {
        if (/(?:^|;\s*)sid=alice\b/.test(req.headers.get("cookie") ?? ""))
          return { onBehalfOf: "alice" };
        if (req.headers.get("authorization") === "Bearer tok_bob") return { onBehalfOf: "bob" };
        return null;
      },
    },
    secret: SECRET,
    ...extra,
  });
  axe.register(
    action("orders.track", {
      title: "Track an order",
      description:
        "Returns the status of one of the signed-in customer's orders. Does not change anything.",
      readOnly: true,
      risk: "none",
      input: z.object({}),
      output: z.object({ status: z.string() }),
      handler: async () => ({ status: "shipped" }),
    }),
  );
  axe.register(
    action("returns.start", {
      title: "Start a return",
      description:
        "Opens a return for one delivered item and returns the return id. Cancel it from the order page before shipping.",
      risk: "medium",
      reversible: true,
      auth: "user",
      input: z.object({}),
      output: z.object({ returnId: z.string() }),
      handler: async ({ context }) => {
        writes.push(context.onBehalfOf!);
        return { returnId: `r-${context.onBehalfOf}` };
      },
    }),
  );
  return { axe, writes };
}

async function call(
  axe: ReturnType<typeof site>["axe"],
  path: string,
  init: { method?: string; headers?: Record<string, string>; body?: BodyInit } = {},
) {
  const res = await axe.handle(
    new Request(`${SITE}${path}`, {
      method: init.method ?? "POST",
      headers: init.headers ?? {},
      ...(init.body !== undefined ? { body: init.body } : {}),
    }),
  );
  const body = res.status === 204 ? null : ((await res.json()) as Record<string, unknown>);
  return { status: res.status, body };
}

const envelope = JSON.stringify({ input: {}, idempotencyKey: "k-1" });

describe("request policy primitives", () => {
  it("recognizes JSON content types and nothing else", () => {
    expect(isJsonContentType("application/json")).toBe(true);
    expect(isJsonContentType("Application/JSON; charset=utf-8")).toBe(true);
    expect(isJsonContentType("application/merge-patch+json")).toBe(true);
    for (const v of [
      null,
      "",
      "text/plain",
      "text/plain;charset=UTF-8",
      "application/x-www-form-urlencoded",
      "multipart/form-data; boundary=x",
      "text/json",
      "application/jsonx",
    ])
      expect(isJsonContentType(v), String(v)).toBe(false);
  });

  it("normalizes origins and refuses non-http ones", () => {
    expect(normalizeOrigin("https://Shop.Example:443")).toBe("https://shop.example");
    expect(normalizeOrigin("http://localhost:3000/")).toBe("http://localhost:3000");
    expect(normalizeOrigin("null")).toBeNull();
    expect(normalizeOrigin("file:///x")).toBeNull();
  });

  it("decides origins from Origin, then Sec-Fetch-Site, and accepts requests with neither", () => {
    const ok = new Set(["https://shop.example"]);
    const req = (h: Record<string, string>) => new Request(SITE, { method: "POST", headers: h });
    expect(isAcceptedOrigin(req({ origin: "https://shop.example" }), ok)).toBe(true);
    expect(isAcceptedOrigin(req({ origin: "https://evil.example" }), ok)).toBe(false);
    expect(isAcceptedOrigin(req({ origin: "null" }), ok)).toBe(false);
    expect(isAcceptedOrigin(req({ "sec-fetch-site": "same-origin" }), ok)).toBe(true);
    expect(isAcceptedOrigin(req({ "sec-fetch-site": "cross-site" }), ok)).toBe(false);
    expect(isAcceptedOrigin(req({ "sec-fetch-site": "same-site" }), ok)).toBe(false);
    expect(isAcceptedOrigin(req({}), ok)).toBe(true);
    expect(hasAmbientCredentials(req({ cookie: "sid=x" }))).toBe(true);
    expect(hasAmbientCredentials(req({ authorization: "Bearer x" }))).toBe(false);
  });

  it("validates trustedOrigins and trusts credentialed CORS origins", () => {
    expect(() => resolveRequestPolicy({ requestPolicy: { trustedOrigins: ["*"] } })).toThrow(
      /not an exact origin/,
    );
    expect(() =>
      resolveRequestPolicy({ requestPolicy: { trustedOrigins: ["https://a.example/app"] } }),
    ).toThrow(/not an exact origin/);
    expect(() =>
      resolveRequestPolicy({
        requestPolicy: {
          originCheck: "sometimes" as NonNullable<RequestPolicyConfig["originCheck"]>,
        },
      }),
    ).toThrow(/originCheck/);
    const p = resolveRequestPolicy({
      requestPolicy: { trustedOrigins: ["https://app.example"] },
      cors: { origins: ["https://agent.example"], allowCredentials: true },
    });
    expect([...p.trustedOrigins].sort()).toEqual(["https://agent.example", "https://app.example"]);
    expect(p.requireJsonContentType).toBe(true);
    expect(p.originCheck).toBe("cookie");
    const noCreds = resolveRequestPolicy({ cors: { origins: ["https://agent.example"] } });
    expect(noCreds.trustedOrigins.size).toBe(0);
  });

  it("leaves GET, OPTIONS, and paths other than action, continue, and resume alone", () => {
    const p = resolveRequestPolicy({ requestPolicy: { originCheck: "always" } });
    const ctx = { path: "/axe/state", siteUrls: [SITE], isReadOnly: () => false };
    const foreign = { origin: "https://evil.example", cookie: "sid=alice" };
    for (const method of ["GET", "OPTIONS", "HEAD"])
      expect(
        evaluateRequestPolicy(new Request(SITE, { method, headers: foreign }), p, {
          ...ctx,
          path: "/axe/actions/returns.start",
        }),
      ).toBeUndefined();
    expect(
      evaluateRequestPolicy(new Request(SITE, { method: "POST", headers: foreign }), p, ctx),
    ).toBeUndefined();
  });
});

describe("request policy: cross-origin writes with cookies are refused before anything runs", () => {
  const foreign = "https://evil.example";
  const shapes: [string, Record<string, string>, BodyInit | undefined][] = [
    ["text/plain", { "content-type": "text/plain;charset=UTF-8" }, envelope],
    ["form-encoded", { "content-type": "application/x-www-form-urlencoded" }, `${envelope}=`],
    [
      "multipart",
      { "content-type": "multipart/form-data; boundary=b" },
      `--b\r\n\r\n${envelope}\r\n--b--`,
    ],
    ["missing content-type", {}, envelope],
    ["application/json (preflighted, but still a foreign origin)", JSON_CT, envelope],
  ];
  for (const [label, headers, body] of shapes) {
    it(`${label} from a foreign Origin with a session cookie is forbidden`, async () => {
      const { axe, writes } = site();
      const r = await call(axe, "/axe/actions/returns.start", {
        headers: { ...headers, origin: foreign, cookie: "sid=alice" },
        ...(body !== undefined ? { body } : {}),
      });
      expect(r.status).toBe(403);
      expect(r.body).toMatchObject({
        status: "error",
        error: { code: "forbidden", details: { reason: "cross_origin_refused" } },
      });
      expect(writes).toEqual([]);
    });
  }

  it("the refusal does not depend on whether the action exists or the session is valid", async () => {
    const { axe } = site();
    const h = { ...JSON_CT, origin: foreign };
    const a = await call(axe, "/axe/actions/returns.start", {
      headers: { ...h, cookie: "sid=alice" },
      body: envelope,
    });
    const b = await call(axe, "/axe/actions/no.such.action", {
      headers: { ...h, cookie: "sid=nobody" },
      body: envelope,
    });
    const c = await call(axe, "/axe/continue", {
      headers: { ...h, cookie: "sid=alice" },
      body: "{}",
    });
    const d = await call(axe, "/axe/resume", { headers: { ...h, cookie: "x=1" }, body: "{}" });
    for (const r of [b, c, d]) expect(r).toEqual(a);
  });

  it("Origin: null and Sec-Fetch-Site: cross-site without Origin are forbidden", async () => {
    const { axe, writes } = site();
    const n = await call(axe, "/axe/actions/returns.start", {
      headers: { ...JSON_CT, origin: "null", cookie: "sid=alice" },
      body: envelope,
    });
    const s = await call(axe, "/axe/actions/returns.start", {
      headers: { ...JSON_CT, "sec-fetch-site": "cross-site", cookie: "sid=alice" },
      body: envelope,
    });
    expect([n.status, s.status]).toEqual([403, 403]);
    expect(writes).toEqual([]);
  });

  it("read-only POSTs with cookies are also origin-checked; GETs are not", async () => {
    const { axe } = site({ revision: () => 1 });
    const h = { origin: foreign, cookie: "sid=alice" };
    const post = await call(axe, "/axe/actions/orders.track", {
      headers: { ...JSON_CT, ...h },
      body: JSON.stringify({ input: {} }),
    });
    expect(post.status).toBe(403);
    for (const path of [
      "/.well-known/axe.json",
      "/axe/manifest",
      "/axe/actions/orders.track",
      "/axe/state",
    ]) {
      const r = await call(axe, path, { method: "GET", headers: h });
      expect(r.status, path).toBe(200);
    }
    expect(
      (await call(axe, "/axe/actions/returns.start", { method: "OPTIONS", headers: h })).status,
    ).toBe(204);
  });
});

describe("request policy: intended callers keep working", () => {
  it("same-origin JSON with the session cookie runs as the user", async () => {
    const { axe, writes } = site();
    const r = await call(axe, "/axe/actions/returns.start", {
      headers: { ...JSON_CT, origin: SITE, cookie: "sid=alice", "sec-fetch-site": "same-origin" },
      body: envelope,
    });
    expect(r.body).toMatchObject({ status: "ok", output: { returnId: "r-alice" } });
    expect(writes).toEqual(["alice"]);
  });

  it("Sec-Fetch-Site: same-origin without Origin is accepted", async () => {
    const { axe } = site();
    const r = await call(axe, "/axe/actions/returns.start", {
      headers: { ...JSON_CT, cookie: "sid=alice", "sec-fetch-site": "same-origin" },
      body: envelope,
    });
    expect(r.body?.["status"]).toBe("ok");
  });

  it("an origin in trustedOrigins or a credentialed CORS origin is accepted", async () => {
    const { axe } = site({
      requestPolicy: { trustedOrigins: ["https://app.shop.example"] },
      cors: { origins: ["https://agent.example"], allowCredentials: true },
    });
    for (const origin of ["https://app.shop.example", "https://agent.example"]) {
      const r = await call(axe, "/axe/actions/returns.start", {
        headers: { ...JSON_CT, origin, cookie: "sid=alice" },
        body: JSON.stringify({ input: {}, idempotencyKey: origin }),
      });
      expect(r.body?.["status"], origin).toBe("ok");
    }
  });

  it("the site origin comes from baseUrl, not from Host or X-Forwarded-Host", async () => {
    const { axe, writes } = site();
    const res = await axe.handle(
      new Request("https://evil.example/axe/actions/returns.start", {
        method: "POST",
        headers: {
          ...JSON_CT,
          origin: "https://evil.example",
          host: "evil.example",
          "x-forwarded-host": "evil.example",
          forwarded: "host=evil.example;proto=https",
          cookie: "sid=alice",
        },
        body: envelope,
      }),
    );
    expect(res.status).toBe(403);
    expect(writes).toEqual([]);
  });

  it("a tenant's baseUrl is that tenant's own origin", async () => {
    const { axe } = site({
      tenant: (req) =>
        new URL(req.url).hostname === "studio.example"
          ? { id: "t1", name: "Studio", baseUrl: "https://studio.example" }
          : null,
    });
    const r = await axe.handle(
      new Request("https://studio.example/axe/actions/returns.start", {
        method: "POST",
        headers: { ...JSON_CT, origin: "https://studio.example", cookie: "sid=alice" },
        body: envelope,
      }),
    );
    expect(((await r.json()) as { status: string }).status).toBe("ok");
  });

  it("server-to-server bearer calls with no Origin run", async () => {
    const { axe, writes } = site();
    const r = await call(axe, "/axe/actions/returns.start", {
      headers: { ...JSON_CT, authorization: "Bearer tok_bob" },
      body: envelope,
    });
    expect(r.body).toMatchObject({ status: "ok", output: { returnId: "r-bob" } });
    expect(writes).toEqual(["bob"]);
  });

  it("a public site with no cookies accepts cross-origin JSON", async () => {
    const { axe } = site();
    const r = await call(axe, "/axe/actions/orders.track", {
      headers: { ...JSON_CT, origin: "https://agent.example" },
      body: JSON.stringify({ input: {} }),
    });
    expect(r.body?.["status"]).toBe("ok");
  });

  it("originCheck always checks cookieless browser POSTs; off never checks", async () => {
    const always = site({ requestPolicy: { originCheck: "always" } }).axe;
    const a = await call(always, "/axe/actions/orders.track", {
      headers: { ...JSON_CT, origin: "https://agent.example" },
      body: JSON.stringify({ input: {} }),
    });
    expect(a.status).toBe(403);
    const off = site({ requestPolicy: { originCheck: "off" } });
    const o = await call(off.axe, "/axe/actions/returns.start", {
      headers: { ...JSON_CT, origin: "https://evil.example", cookie: "sid=alice" },
      body: envelope,
    });
    expect(o.body?.["status"]).toBe("ok");
  });
});

describe("request policy: state-changing POSTs must be JSON", () => {
  const nonJson: [string, Record<string, string>][] = [
    ["text/plain", { "content-type": "text/plain" }],
    ["form-encoded", { "content-type": "application/x-www-form-urlencoded" }],
    ["multipart", { "content-type": "multipart/form-data; boundary=b" }],
    ["missing", {}],
  ];
  for (const [label, headers] of nonJson) {
    it(`${label} content type on a mutating action is unsupported, even with a bearer token`, async () => {
      const { axe, writes } = site();
      const r = await call(axe, "/axe/actions/returns.start", {
        headers: { ...headers, authorization: "Bearer tok_bob" },
        body: envelope,
      });
      expect(r.status).toBe(400);
      expect(r.body).toMatchObject({
        status: "error",
        error: { code: "unsupported", details: { reason: "json_required" } },
      });
      expect(writes).toEqual([]);
    });
  }

  it("continue and resume require JSON; read-only actions do not", async () => {
    const { axe } = site();
    for (const path of ["/axe/continue", "/axe/resume", "/axe/actions/unknown.name"]) {
      const r = await call(axe, path, { headers: { "content-type": "text/plain" }, body: "{}" });
      expect(r.status, path).toBe(400);
      expect((r.body?.["error"] as { code: string }).code, path).toBe("unsupported");
    }
    const read = await call(axe, "/axe/actions/orders.track", {
      body: JSON.stringify({ input: {} }),
    });
    expect(read.body?.["status"]).toBe("ok");
  });

  it("requireJsonContentType: false restores the previous behavior", async () => {
    const { axe } = site({ requestPolicy: { requireJsonContentType: false } });
    const r = await call(axe, "/axe/actions/returns.start", {
      headers: { "content-type": "text/plain", authorization: "Bearer tok_bob" },
      body: envelope,
    });
    expect(r.body?.["status"]).toBe("ok");
  });
});
