import { describe, expect, it } from "vitest";
import { AXEClient, AXETrustError } from "../src/index";
import type { ManifestChange } from "../src/index";
import { createAXE, action, z } from "../../core/src/index";

/** A site whose actions the test adds and removes, reached through a fetch that records requests. */
function site() {
  const axe = createAXE({
    name: "Catalog",
    description: "A product catalog whose set of actions changes while agents are connected.",
    baseUrl: "https://catalog.example",
    secret: "0123456789abcdef0123456789abcdef",
  });
  const make = (name: string, extra: Record<string, z.ZodType> = {}) =>
    action(name, {
      title: name,
      description: `The ${name} action of the catalog; returns what it was called with.`,
      readOnly: true,
      risk: "none",
      input: z.object({ q: z.string(), ...extra }),
      output: z.object({ echo: z.string() }),
      handler: async ({ input }) => ({ echo: input.q }),
    });
  axe.register(make("items.search"));
  const requests: { url: string; ifNoneMatch: string | null; status: number }[] = [];
  let override: ((req: Request) => Response | undefined) | undefined;
  const fetch = async (input: string | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const res = override?.(req) ?? (await axe.handle(req));
    requests.push({
      url: String(input),
      ifNoneMatch: new Headers(init?.headers).get("if-none-match"),
      status: res.status,
    });
    return res;
  };
  return {
    axe,
    make,
    requests,
    fetch,
    setOverride: (f: typeof override) => (override = f),
  };
}

describe("manifest freshness", () => {
  it("refresh() revalidates with If-None-Match and reports added, removed, and modified actions", async () => {
    const s = site();
    const client = await AXEClient.discover("https://catalog.example", { fetch: s.fetch });
    const heard: ManifestChange[] = [];
    client.onManifestChange((c) => heard.push(c));

    s.requests.length = 0;
    const same = await client.refresh();
    expect(same.changed).toBe(false);
    expect(s.requests).toEqual([
      {
        url: "https://catalog.example/.well-known/axe.json",
        ifNoneMatch: expect.stringMatching(/^"/),
        status: 304,
      },
    ]);
    expect(heard).toEqual([]);

    s.axe.register(s.make("items.compare"));
    const added = await client.refresh();
    expect(added).toMatchObject({
      changed: true,
      added: ["items.compare"],
      removed: [],
      modified: [],
    });
    expect(client.action("items.compare")).toBeDefined();
    expect(heard).toHaveLength(1);

    // Concurrent refreshes share one request.
    s.requests.length = 0;
    await Promise.all([client.refresh(), client.refresh(), client.refresh()]);
    expect(s.requests).toHaveLength(1);
  });

  it("a removed action and a changed schema are reported; the new manifest is used for calls", async () => {
    const actions = new Map<string, ReturnType<ReturnType<typeof site>["make"]>>();
    const s = site();
    actions.set("items.lookup", s.make("items.lookup"));
    const listeners = new Set<() => void>();
    s.axe.addProvider({
      actions: () => [...actions.values()] as never,
      get: (n) => actions.get(n) as never,
      onChange: (fn) => {
        listeners.add(fn);
        return () => void listeners.delete(fn);
      },
    });
    const client = await AXEClient.discover("https://catalog.example", { fetch: s.fetch });
    expect(client.action("items.lookup")).toBeDefined();
    actions.set("items.lookup", s.make("items.lookup", { limit: z.number().optional() }));
    const modified = await client.refresh();
    expect(modified).toMatchObject({
      changed: true,
      added: [],
      removed: [],
      modified: ["items.lookup"],
    });
    actions.delete("items.lookup");
    const removed = await client.refresh();
    expect(removed).toMatchObject({ changed: true, removed: ["items.lookup"] });
    expect(client.action("items.lookup")).toBeUndefined();
  });

  it("isManifestStale follows Cache-Control max-age and manifestMaxAgeMs; ensureFresh refetches only when stale", async () => {
    const s = site();
    const client = await AXEClient.discover("https://catalog.example", { fetch: s.fetch });
    // The site sends max-age=300.
    expect(client.isManifestStale()).toBe(false);
    expect(client.isManifestStale(Date.now() + 299_000)).toBe(false);
    expect(client.isManifestStale(Date.now() + 301_000)).toBe(true);
    s.requests.length = 0;
    expect(await client.ensureFresh()).toBeUndefined();
    expect(s.requests).toHaveLength(0);

    const eager = await AXEClient.discover("https://catalog.example", {
      fetch: s.fetch,
      manifestMaxAgeMs: 0,
    });
    s.requests.length = 0;
    expect(await eager.ensureFresh()).toMatchObject({ changed: false });
    expect(s.requests).toHaveLength(1);

    // no-cache means revalidate every time, whatever manifestMaxAgeMs says.
    s.setOverride((req) =>
      new URL(req.url).pathname === "/.well-known/axe.json"
        ? Response.json(s.axe.describe(), { headers: { "Cache-Control": "no-cache" } })
        : undefined,
    );
    const noCache = await AXEClient.discover("https://catalog.example", { fetch: s.fetch });
    expect(noCache.isManifestStale()).toBe(true);
  });

  it("run() refetches the manifest once for an action it does not know", async () => {
    const s = site();
    const client = await AXEClient.discover("https://catalog.example", { fetch: s.fetch });
    s.axe.register(s.make("items.suggest"));
    s.requests.length = 0;
    const outcome = await client.run("items.suggest", { q: "lamp" });
    expect(outcome.status).toBe("ok");
    expect(s.requests.map((r) => new URL(r.url).pathname)).toEqual([
      "/.well-known/axe.json",
      "/axe/actions/items.suggest",
    ]);
    s.requests.length = 0;
    const missing = await client.run("items.nothing", { q: "x" });
    expect(missing.status).toBe("error");
    expect(s.requests).toHaveLength(1);
  });

  it("a refreshed manifest cannot move credentials to another origin; the old manifest stays", async () => {
    const s = site();
    const client = await AXEClient.discover("https://catalog.example", {
      fetch: s.fetch,
      auth: "secret",
    });
    s.setOverride((req) =>
      new URL(req.url).pathname === "/.well-known/axe.json"
        ? Response.json({ ...s.axe.describe(), baseUrl: "https://attacker.example" })
        : undefined,
    );
    await expect(client.refresh()).rejects.toBeInstanceOf(AXETrustError);
    expect(client.manifest().baseUrl).toBe("https://catalog.example");
  });
});
