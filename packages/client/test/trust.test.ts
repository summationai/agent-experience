import { describe, expect, it } from "vitest";
import { AXEClient, AXETrustError, discover, isOk } from "../src/index";
import type { DestinationRequest, Manifest, PendingResult } from "../src/index";
import { present, toMarkdown } from "../src/present";
import { apartmentsAXE } from "../../core/test/fixtures/apartments";

/** One captured outbound request: where it went and which credentials it carried. */
interface Seen {
  url: string;
  method: string;
  authorization: string | undefined;
  apiKey: string | undefined;
  redirect: RequestRedirect | undefined;
}

type Route = (url: URL, init: RequestInit | undefined) => Response | Promise<Response> | undefined;

/** A mocked network: every request is recorded; the first route that answers wins; else 404. */
function network(...routes: Route[]) {
  const seen: Seen[] = [];
  const fetch = async (input: string | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const h = new Headers(init?.headers);
    seen.push({
      url: url.href,
      method: init?.method ?? "GET",
      authorization: h.get("authorization") ?? undefined,
      apiKey: h.get("x-api-key") ?? undefined,
      redirect: init?.redirect,
    });
    for (const route of routes) {
      const res = await route(url, init);
      if (res) return res;
    }
    return new Response("not found", { status: 404 });
  };
  /** Requests that reached `origin`. */
  const at = (origin: string) => seen.filter((s) => new URL(s.url).origin === origin);
  return { fetch, seen, at };
}

const OK = () => Response.json({ status: "ok", output: { done: true } });

function manifest(baseUrl: string, extra: Partial<Manifest> = {}): Manifest {
  return {
    protocol: "axe/0.1",
    name: "Trust test",
    description: "A site used to test where the client sends credentials.",
    baseUrl,
    auth: { modes: ["user"] },
    actions: [
      {
        name: "things.read",
        title: "Read things",
        description: "Reads things.",
        readOnly: true,
        risk: "none",
        auth: "user",
        input: { type: "object" },
        output: { type: "object" },
      },
    ],
    ...extra,
  } as Manifest;
}

/** Serve `m` at `/.well-known/axe.json` on `origin`. */
const wellKnown =
  (origin: string, m: Manifest): Route =>
  (url) =>
    url.origin === origin && url.pathname === "/.well-known/axe.json"
      ? Response.json(m)
      : undefined;

const credentials = { auth: "private-token", headers: { "x-api-key": "secret-key" } };

describe("destination policy: credential audience [P-AGENT-4] [P-AGENT-5]", () => {
  it("refuses a discovered manifest whose baseUrl is on another origin; nothing reaches it", async () => {
    const net = network(
      wellKnown("https://trusted.example", manifest("https://untrusted.example")),
      OK,
    );
    await expect(
      AXEClient.discover("https://trusted.example", { ...credentials, fetch: net.fetch }),
    ).rejects.toThrow(AXETrustError);
    expect(net.at("https://untrusted.example")).toEqual([]);
    // discover() then new AXEClient(): the manifest remembers where it was found.
    const { manifest: m } = await discover("https://trusted.example", { fetch: net.fetch });
    const client = new AXEClient(m, { ...credentials, fetch: net.fetch });
    await expect(client.invoke("things.read", {})).rejects.toThrow(/not an authorized origin/);
    expect(client.checkDestination("https://untrusted.example/axe/actions/x")).toMatchObject({
      allowed: false,
    });
    expect(net.at("https://untrusted.example")).toEqual([]);
  });

  it("sends credentials to a cross-origin baseUrl listed in trust.origins; run() and present work", async () => {
    const { axe } = apartmentsAXE();
    const api = "https://api.oakridge-rentals.example";
    const m = { ...axe.describe(), baseUrl: api };
    const net = network(wellKnown("https://oakridge-rentals.example", m), (url, init) =>
      url.origin === api
        ? axe.handle(new Request(`https://oakridge-rentals.example${url.pathname}`, init))
        : undefined,
    );
    const client = await AXEClient.discover("https://oakridge-rentals.example", {
      ...credentials,
      auth: "user:dana",
      fetch: net.fetch,
      trust: { origins: [`${api}/ignored/path`] },
    });
    const outcome = await client.run("units.search", { location: "Bellevue, WA" });
    expect(outcome.status).toBe("ok");
    if (outcome.status === "ok")
      expect(toMarkdown(present(outcome.action, outcome.result))).toContain("The Meridian 204");
    const calls = net.at(api);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((c) => c.authorization === "Bearer user:dana")).toBe(true);
    expect(calls.every((c) => c.apiKey === "secret-key")).toBe(true);
  });

  it("allowCrossOrigin contacts other https origins without auth or headers", async () => {
    const net = network(
      wellKnown("https://trusted.example", manifest("https://actions.example")),
      OK,
    );
    const client = await AXEClient.discover("https://trusted.example", {
      ...credentials,
      fetch: net.fetch,
      trust: { allowCrossOrigin: true },
    });
    expect(isOk(await client.invoke("things.read", {}))).toBe(true);
    const [call] = net.at("https://actions.example");
    expect(call).toMatchObject({ authorization: undefined, apiKey: undefined });
    expect(client.checkDestination("https://actions.example/x")).toEqual({
      allowed: true,
      credentialed: false,
    });
  });

  it("allowCrossOrigin still refuses loopback, link-local, and private host names", async () => {
    const client = new AXEClient(manifest("https://trusted.example"), {
      trust: { allowCrossOrigin: true },
    });
    for (const u of [
      "https://127.0.0.1/x",
      "https://2130706433/x",
      "https://localhost/x",
      "https://metadata.internal/x",
      "https://169.254.169.254/latest/meta-data",
      "https://10.0.0.7/x",
      "https://172.20.1.1/x",
      "https://192.168.1.1/x",
      "https://[::1]/x",
      "https://[fd00::1]/x",
      "https://[::ffff:127.0.0.1]/x",
    ]) {
      expect(client.checkDestination(u).allowed, u).toBe(false);
    }
  });

  it("refuses live.url and pollUrl on unauthorized origins, and accepts them same-origin", async () => {
    const net = network(
      (url) =>
        url.pathname === "/axe/state"
          ? Response.json({ rev: 1, actions: { "things.read": { available: true } } })
          : undefined,
      OK,
    );
    const foreignLive = new AXEClient(
      manifest("https://trusted.example", { live: { url: "https://state.example/axe/state" } }),
      { ...credentials, fetch: net.fetch },
    );
    await expect(foreignLive.state()).rejects.toThrow(AXETrustError);
    const pending = (pollUrl: string): PendingResult => ({
      status: "pending",
      pollUrl,
      retryAfter: 1,
    });
    await expect(
      foreignLive.poll(pending("https://attacker.example/axe/poll/t"), { maxWaitMs: 5_000 }),
    ).rejects.toThrow(AXETrustError);
    expect(net.seen).toEqual([]);
    const local = new AXEClient(
      manifest("https://trusted.example", { live: { url: "https://trusted.example/axe/state" } }),
      { ...credentials, fetch: net.fetch },
    );
    expect((await local.state()).rev).toBe(1);
    const polled = await local.poll(pending("https://trusted.example/axe/poll/t"), {
      maxWaitMs: 5_000,
    });
    expect(isOk(polled)).toBe(true);
    expect(net.seen.every((s) => s.authorization === "Bearer private-token")).toBe(true);
  });
});

describe("destination policy: redirects [P-AGENT-6]", () => {
  const redirectTo =
    (status: number, location: string): Route =>
    (url) =>
      url.origin === "https://trusted.example"
        ? new Response(null, { status, headers: { location } })
        : undefined;

  for (const status of [301, 302, 303, 307, 308]) {
    it(`does not follow a ${status} to an unauthorized origin, and never forwards credentials`, async () => {
      const net = network(redirectTo(status, "https://attacker.example/steal"), OK);
      const client = new AXEClient(manifest("https://trusted.example"), {
        ...credentials,
        fetch: net.fetch,
      });
      await expect(client.invoke("things.read", {})).rejects.toThrow(/redirected from/);
      expect(net.at("https://attacker.example")).toEqual([]);
      expect(net.seen[0]!.redirect).toBe("manual");
      // Even when the target origin may be contacted, credentials stay behind.
      const open = network(redirectTo(status, "https://other.example/axe/actions/x"), OK);
      const crossing = new AXEClient(manifest("https://trusted.example"), {
        ...credentials,
        fetch: open.fetch,
        trust: { origins: ["https://other.example"] },
      });
      expect(isOk(await crossing.invoke("things.read", {}))).toBe(true);
      const [hop] = open.at("https://other.example");
      expect(hop).toMatchObject({ authorization: undefined, apiKey: undefined });
      expect(hop!.method).toBe(status === 307 || status === 308 ? "POST" : "GET");
    });
  }

  it("follows a same-origin redirect with credentials", async () => {
    const net = network(
      (url) =>
        url.pathname === "/axe/actions/things.read"
          ? new Response(null, {
              status: 308,
              headers: { location: "/v2/axe/actions/things.read" },
            })
          : undefined,
      OK,
    );
    const client = new AXEClient(manifest("https://trusted.example"), {
      ...credentials,
      fetch: net.fetch,
    });
    expect(isOk(await client.invoke("things.read", {}))).toBe(true);
    expect(net.seen.map((s) => [s.url, s.authorization])).toEqual([
      ["https://trusted.example/axe/actions/things.read", "Bearer private-token"],
      ["https://trusted.example/v2/axe/actions/things.read", "Bearer private-token"],
    ]);
  });

  it("refuses an https-to-http redirect, even to loopback and even with allowHttp: true", async () => {
    for (const trust of [{}, { allowHttp: true as const }]) {
      const net = network(redirectTo(307, "http://trusted.example/axe/actions/things.read"), OK);
      const client = new AXEClient(manifest("https://trusted.example"), {
        ...credentials,
        fetch: net.fetch,
        trust,
      });
      await expect(client.invoke("things.read", {})).rejects.toThrow(/downgrade from https/);
      expect(net.seen).toHaveLength(1);
    }
  });

  it("refuses a response the fetch implementation redirected across origins by itself, and opaque redirects", async () => {
    const followed = new Response(JSON.stringify({ status: "ok", output: {} }));
    Object.defineProperty(followed, "redirected", { value: true });
    Object.defineProperty(followed, "url", { value: "https://attacker.example/x" });
    const a = new AXEClient(manifest("https://trusted.example"), { fetch: async () => followed });
    await expect(a.invoke("things.read", {})).rejects.toThrow(/followed a redirect/);
    const opaque = new Response(null, { status: 200 });
    Object.defineProperty(opaque, "type", { value: "opaqueredirect" });
    const b = new AXEClient(manifest("https://trusted.example"), { fetch: async () => opaque });
    await expect(b.invoke("things.read", {})).rejects.toThrow(/cannot be checked/);
  });
});

describe("destination policy: schemes [P-AGENT-7]", () => {
  it("allows http only for loopback origins the caller chose, unless told otherwise", async () => {
    for (const base of ["http://localhost:3000", "http://127.0.0.1:8787", "http://[::1]:3000"]) {
      const net = network(OK);
      const client = new AXEClient(manifest(base), { ...credentials, fetch: net.fetch });
      expect(isOk(await client.invoke("things.read", {})), base).toBe(true);
      expect(net.seen[0]!.authorization).toBe("Bearer private-token");
      await expect(
        new AXEClient(manifest(base), { fetch: net.fetch, trust: { allowHttp: false } }).invoke(
          "things.read",
          {},
        ),
      ).rejects.toThrow(/plain http is refused/);
    }
    const net = network(OK);
    await expect(
      new AXEClient(manifest("http://shop.example"), { ...credentials, fetch: net.fetch }).invoke(
        "things.read",
        {},
      ),
    ).rejects.toThrow(/plain http is refused/);
    await expect(discover("http://shop.example", { fetch: net.fetch })).rejects.toThrow(
      AXETrustError,
    );
    expect(net.seen).toEqual([]);
    // A remote manifest cannot point a live.url at the operator's loopback services.
    const remote = new AXEClient(
      manifest("https://trusted.example", { live: { url: "http://127.0.0.1:9000/admin" } }),
      { fetch: net.fetch, trust: { allowCrossOrigin: true } },
    );
    await expect(remote.state()).rejects.toThrow(AXETrustError);
    expect(
      new AXEClient(manifest("http://intranet.example"), {
        trust: { allowHttp: true },
      }).checkDestination("http://intranet.example/axe/actions/x").allowed,
    ).toBe(true);
    expect(
      new AXEClient(manifest("https://a.example")).checkDestination("file:///etc/passwd"),
    ).toMatchObject({ allowed: false });
  });
});

describe("destination policy: discovery hints [P-AGENT-5]", () => {
  const page =
    (link: string): Route =>
    (url) =>
      url.origin === "https://trusted.example" && url.pathname === "/"
        ? new Response(`<html><head><link rel="axe-manifest" href="${link}"></head></html>`, {
            headers: { "content-type": "text/html", "AXE-Manifest": link },
          })
        : undefined;

  it("does not follow an AXE-Manifest header or link tag to an unauthorized origin", async () => {
    const m = manifest("https://trusted.example");
    const net = network(page("https://cdn.example/axe.json"), (url) =>
      url.origin === "https://cdn.example" ? Response.json(m) : undefined,
    );
    await expect(
      discover("https://trusted.example/", { fetch: net.fetch, headers: { "x-api-key": "k" } }),
    ).rejects.toThrow(/Refused by the destination policy/);
    expect(net.at("https://cdn.example")).toEqual([]);
    const allowed = await discover("https://trusted.example/", {
      fetch: net.fetch,
      headers: { "x-api-key": "k" },
      trust: { allowCrossOrigin: true },
    });
    expect(allowed.via).toBe("header");
    expect(net.at("https://cdn.example").every((s) => s.apiKey === undefined)).toBe(true);
    // Discovered on trusted.example: the client's credentials stay anchored there.
    const client = new AXEClient(allowed.manifest, { ...credentials, fetch: net.fetch });
    expect(client.checkDestination("https://trusted.example/axe/actions/x").credentialed).toBe(
      true,
    );
    expect(client.checkDestination("https://cdn.example/x").allowed).toBe(false);
  });

  it("follows a discovery redirect to an authorized origin only", async () => {
    const m = manifest("https://www.trusted.example");
    const net = network(
      (url) =>
        url.origin === "https://trusted.example"
          ? new Response(null, {
              status: 301,
              headers: { location: `https://www.trusted.example${url.pathname}` },
            })
          : undefined,
      wellKnown("https://www.trusted.example", m),
    );
    await expect(discover("https://trusted.example", { fetch: net.fetch })).rejects.toThrow(
      AXETrustError,
    );
    expect(net.at("https://www.trusted.example")).toEqual([]);
    const client = await AXEClient.discover("https://trusted.example", {
      fetch: net.fetch,
      trust: { origins: ["https://www.trusted.example"] },
    });
    expect(client.manifest().baseUrl).toBe("https://www.trusted.example");
  });
});

describe("destination policy: network boundary hook [P-AGENT-8]", () => {
  it("destinationPolicy sees every outbound URL, redirects included, and can refuse any", async () => {
    const calls: DestinationRequest[] = [];
    const net = network(
      (url) =>
        url.pathname === "/axe/actions/things.read"
          ? new Response(null, { status: 307, headers: { location: "/moved" } })
          : undefined,
      OK,
    );
    const client = new AXEClient(manifest("https://trusted.example"), {
      ...credentials,
      fetch: net.fetch,
      trust: {
        destinationPolicy: (req) => {
          calls.push(req);
          return !req.url.includes("/axe/poll/");
        },
      },
    });
    expect(isOk(await client.invoke("things.read", {}))).toBe(true);
    expect(calls).toEqual([
      {
        url: "https://trusted.example/axe/actions/things.read",
        kind: "action",
        credentialed: true,
      },
      {
        url: "https://trusted.example/moved",
        kind: "action",
        credentialed: true,
        redirectedFrom: "https://trusted.example/axe/actions/things.read",
      },
    ]);
    const before = net.seen.length;
    await expect(
      client.poll(
        { status: "pending", pollUrl: "https://trusted.example/axe/poll/t", retryAfter: 1 },
        { maxWaitMs: 5_000 },
      ),
    ).rejects.toThrow(/destinationPolicy returned false/);
    expect(net.seen.length).toBe(before);
  });
});
