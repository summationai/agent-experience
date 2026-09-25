// Remote capability freshness and stable retries (review item 10), through the URL-based MCP
// path: a real AXE site on 127.0.0.1, `createMcpServer(url)`, `serveHttp`, and the SDK client.
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ToolListChangedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import { createMcpServer, serveHttp } from "../src/index";
import type { McpServerOptions } from "../src/index";
import { createAXE, action, accept, kinds, z } from "../../core/src/index";
import type { RegisteredAction } from "../../core/src/index";
import { listen } from "./listen";
import { deferred, httpClient, structured, text } from "./fixtures";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  while (cleanup.length) await cleanup.pop()!().catch(() => undefined);
});

/** An orders site whose action set the test changes, served over real HTTP. */
async function ordersSite() {
  const actions = new Map<string, RegisteredAction>();
  const listeners = new Set<() => void>();
  const runs: string[] = [];
  let gate: Promise<void> | undefined;
  let entered: (() => void) | undefined;
  const settled: Array<() => void> = [];
  const ref: { axe?: ReturnType<typeof createAXE> } = {};
  const l = await listen(async (req) => {
    const res = await ref.axe!.handle(req);
    if (req.method === "POST") for (const done of settled.splice(0)) done();
    return res;
  });
  cleanup.push(() => l.close());
  const axe = createAXE({
    name: "Orders",
    description: "Place and look up orders; the set of actions changes while agents are connected.",
    baseUrl: l.url,
    secret: "0123456789abcdef0123456789abcdef",
  });
  const place = (name: string) =>
    action(name, {
      title: `Place (${name})`,
      description: `Places an order for one item and returns the order number (${name}).`,
      risk: "medium",
      input: z.object({ item: z.string() }).strict(),
      output: z.object({ order: z.number(), item: z.string() }),
      handler: async ({ input }) => {
        runs.push(`${name}:${input.item}`);
        entered?.();
        if (gate) await gate;
        return { order: runs.length, item: input.item };
      },
    }) as unknown as RegisteredAction;
  ref.axe = axe;
  actions.set("orders.place", place("orders.place"));
  axe.addProvider({
    actions: () => [...actions.values()],
    get: (n) => actions.get(n),
    onChange: (fn) => {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
  });
  return {
    url: l.url,
    runs,
    add(name: string) {
      actions.set(name, place(name));
      for (const fn of listeners) fn();
    },
    remove(name: string) {
      actions.delete(name);
      for (const fn of listeners) fn();
    },
    /** Hold every handler until `release` is called; `entered` resolves when one has started. */
    hold(): { release: () => void; entered: Promise<void> } {
      const d = deferred();
      const e = deferred();
      gate = d.promise;
      entered = e.resolve;
      return {
        entered: e.promise,
        release: () => {
          gate = undefined;
          entered = undefined;
          d.resolve();
        },
      };
    },
    /** Resolves after the next POST to the site has been answered. */
    nextPostAnswered(): Promise<void> {
      return new Promise((resolve) => settled.push(resolve));
    },
  };
}

async function overHttp(siteUrl: string, options: McpServerOptions = {}) {
  const derived = await createMcpServer(siteUrl, options);
  const handler = serveHttp(derived, { sessions: true });
  const getOpened = deferred();
  const l = await listen(async (req) => {
    const res = await handler(req);
    if (req.method === "GET") getOpened.resolve();
    return res;
  });
  cleanup.push(
    () => l.close(),
    () => handler.close(),
  );
  return { derived, url: `${l.url}/mcp`, getOpened: getOpened.promise };
}

const names = async (client: Client) => (await client.listTools()).tools.map((t) => t.name);

describe("remote freshness through createMcpServer(url)", () => {
  it("a newly registered action becomes discoverable and callable; the session is told the tool list changed", async () => {
    const site = await ordersSite();
    const { derived, url, getOpened } = await overHttp(site.url);
    const { client } = await httpClient(url);
    cleanup.push(() => client.close());
    const changed = deferred();
    client.setNotificationHandler(ToolListChangedNotificationSchema, () => changed.resolve());
    expect(client.getServerCapabilities()).toMatchObject({ tools: { listChanged: true } });
    expect(await names(client)).not.toContain("orders_rush");
    await getOpened; // the client's server-to-client stream is open
    site.add("orders.rush");
    expect(await derived.refresh()).toBe(true);
    await changed.promise;
    expect(await names(client)).toContain("orders_rush");
    const r = await client.callTool({ name: "orders_rush", arguments: { item: "lamp" } });
    expect(structured<{ output: { item: string } }>(r).output.item).toBe("lamp");
    expect(site.runs).toEqual(["orders.rush:lamp"]);
    // Nothing changed: no second notification, refresh says so.
    expect(await derived.refresh()).toBe(false);
  });

  it("within the refresh bound, tools/list shows an added action and drops a removed one", async () => {
    const site = await ordersSite();
    // Bound of zero: every listing revalidates (a 304 when nothing changed).
    const { url } = await overHttp(site.url, { client: { manifestMaxAgeMs: 0 } });
    const { client } = await httpClient(url);
    cleanup.push(() => client.close());
    expect(await names(client)).toContain("orders_place");
    site.add("orders.rush");
    site.remove("orders.place");
    const now = await names(client);
    expect(now).toContain("orders_rush");
    expect(now).not.toContain("orders_place");
  });

  it("a call to a tool added since the last fetch refreshes once and runs; a removed tool says it was removed", async () => {
    const site = await ordersSite();
    const { url } = await overHttp(site.url);
    const { client } = await httpClient(url);
    cleanup.push(() => client.close());
    await names(client);
    site.add("orders.rush");
    const r = await client.callTool({ name: "orders_rush", arguments: { item: "desk" } });
    expect(r.isError).toBeUndefined();
    expect(site.runs).toEqual(["orders.rush:desk"]);
    site.remove("orders.place");
    const gone = await client.callTool({ name: "orders_place", arguments: { item: "desk" } });
    expect(gone.isError).toBe(true);
    expect(text(gone)).toContain('no longer offered: the site removed the action "orders.place"');
    expect(await names(client)).not.toContain("orders_place");
    const unknown = await client.callTool({ name: "orders_nothing", arguments: {} });
    expect(text(unknown)).toContain('Unknown tool "orders_nothing"');
  });
});

describe("stable retries", () => {
  it("an uncertain call retried with the same idempotencyKey runs the handler once; a second call without a key runs again", async () => {
    const site = await ordersSite();
    const { url } = await overHttp(site.url);
    const { client } = await httpClient(url);
    cleanup.push(() => client.close());
    const tool = (await client.listTools()).tools.find((t) => t.name === "orders_place")!;
    expect(Object.keys(tool.inputSchema.properties ?? {})).toContain("idempotencyKey");

    // The first attempt reaches the site and blocks in the handler; the host gives up on it.
    const { release, entered } = site.hold();
    const abort = new AbortController();
    const first = client
      .callTool(
        { name: "orders_place", arguments: { item: "chair", idempotencyKey: "op-1" } },
        undefined,
        { signal: abort.signal },
      )
      .catch((e: unknown) => e);
    await entered;
    abort.abort();
    expect(await first).toBeInstanceOf(Error);

    // A retry while the first is still running is told so, and nothing runs.
    const during = await client.callTool({
      name: "orders_place",
      arguments: { item: "chair", idempotencyKey: "op-1" },
    });
    expect(during.isError).toBe(true);
    expect(text(during)).toContain("Retryable: yes");
    expect(
      structured<{ error: { details: { operationStatus: string } } }>(during).error.details
        .operationStatus,
    ).toBe("in_progress");

    // The first attempt finishes on the site (the next POST answered is the held one). The retry
    // recovers its result.
    const answered = site.nextPostAnswered();
    release();
    await answered;
    const recovered = await client.callTool({
      name: "orders_place",
      arguments: { item: "chair", idempotencyKey: "op-1" },
    });
    expect(structured<{ status: string; output: { order: number } }>(recovered)).toMatchObject({
      status: "ok",
      output: { order: 1, item: "chair" },
    });
    expect(site.runs).toEqual(["orders.place:chair"]);

    // The same key for different arguments is refused, not applied.
    const misuse = await client.callTool({
      name: "orders_place",
      arguments: { item: "table", idempotencyKey: "op-1" },
    });
    expect(misuse.isError).toBe(true);
    expect(text(misuse)).toContain("conflict");

    // A deliberate second order, no key: it runs again even though the input matches.
    const again = await client.callTool({ name: "orders_place", arguments: { item: "chair" } });
    expect(structured<{ output: { order: number } }>(again).output.order).toBe(2);
    expect(site.runs).toEqual(["orders.place:chair", "orders.place:chair"]);
  });

  it("axe_continue and axe_resume take expectedRev; a stale one applies nothing and keeps the token", async () => {
    let rev = 7;
    const continued: string[] = [];
    const axe = createAXE({
      name: "Drafts",
      description: "A shared drafts board with a single revision for the whole board.",
      baseUrl: "https://drafts.example",
      secret: "0123456789abcdef0123456789abcdef",
      revision: () => rev,
    });
    axe.register(
      action("drafts.publish", {
        title: "Publish a draft",
        description: "Publishes a draft after asking for a contact address for the announcement.",
        risk: "medium",
        input: z.object({ id: z.string() }).strict(),
        output: z.object({ published: z.string() }),
        handler: async ({ input, needsInput }) =>
          needsInput({
            reason: "consent_required",
            message: "A contact address is needed for the announcement.",
            accepts: [accept(kinds.contact.email, { description: "Announcement contact." })],
            state: { id: input.id },
          }),
        onContinue: async ({ state }) => {
          continued.push((state as { id: string }).id);
          rev += 1;
          return { published: (state as { id: string }).id };
        },
      }),
    );
    const derived = await createMcpServer(axe);
    const [ct, st] = InMemoryTransport.createLinkedPair();
    await derived.server.connect(st);
    const client = new Client({ name: "t", version: "0" });
    await client.connect(ct);
    const tools = (await client.listTools()).tools;
    for (const n of ["axe_continue", "axe_resume"]) {
      const t = tools.find((x) => x.name === n)!;
      expect(Object.keys(t.inputSchema.properties ?? {}), n).toContain("expectedRev");
    }
    const started = await client.callTool({ name: "drafts_publish", arguments: { id: "d1" } });
    const token = structured<{ continuationToken: string }>(started).continuationToken;
    rev = 8; // someone else changed the board
    const args = {
      continuationToken: token,
      kind: "contact.email",
      payload: { email: "a@x.example" },
    };
    const stale = await client.callTool({
      name: "axe_continue",
      arguments: { ...args, expectedRev: 7 },
    });
    expect(stale.isError).toBe(true);
    expect(text(stale)).toContain("Stale: you acted on revision 7 but the site is at revision 8");
    expect(continued).toEqual([]);
    const fresh = await client.callTool({
      name: "axe_continue",
      arguments: { ...args, expectedRev: 8 },
    });
    expect(structured<{ status: string; rev: number }>(fresh)).toMatchObject({
      status: "ok",
      rev: 9,
    });
    expect(continued).toEqual(["d1"]);
    const badRev = await client.callTool({
      name: "axe_resume",
      arguments: { resumeToken: "x", expectedRev: {} },
    });
    expect(text(badRev)).toContain("expectedRev must be");
  });
});
