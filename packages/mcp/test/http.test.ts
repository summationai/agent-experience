// Streamable HTTP lifecycle and request identity (review item 9). Every test runs the SDK's own
// MCP client over a real HTTP listener on 127.0.0.1.
import { afterEach, describe, expect, it } from "vitest";
import { StreamableHTTPError } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createMcpServer, protectedResourceMetadata, serveHttp } from "../src/index";
import type { McpHttpHandler } from "../src/index";
import { apartmentsAXE } from "../../core/test/fixtures/apartments";
import { listen } from "./listen";
import type { Listening } from "./listen";
import { httpClient, notesSite, structured, text, verifier } from "./fixtures";
import type { HttpMcpClient } from "./fixtures";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  while (cleanup.length) await cleanup.pop()!().catch(() => undefined);
});

async function mount(handler: McpHttpHandler): Promise<Listening> {
  const l = await listen((req) => handler(req));
  cleanup.push(
    () => l.close(),
    () => handler.close(),
  );
  return l;
}

async function connect(url: string, token?: string): Promise<HttpMcpClient> {
  const c = await httpClient(url, token);
  cleanup.push(() => c.client.close());
  return c;
}

/** An in-process notes site served over MCP HTTP, each caller mapped to their own AXE identity. */
async function notesOverHttp(sessions: boolean | { clock: () => number; idleTimeoutMs: number }) {
  const site = notesSite();
  // A zero poll budget returns a pending result at once, so axe_poll is exercised.
  const handler = serveHttp(await createMcpServer(site.axe, { pollBudgetMs: 0 }), {
    sessions,
    auth: { verifier, requiredScopes: ["notes"], resource: "https://mcp.example/mcp" },
    clientFor: (authInfo) => ({ identity: { onBehalfOf: String(authInfo.extra!["sub"]) } }),
  });
  const l = await mount(handler);
  return { ...site, handler, url: `${l.url}/mcp` };
}

describe("serveHttp over a real listener", () => {
  it("stateless: a real HTTP client initializes, lists tools, and calls tools, and so does a second client", async () => {
    const { axe } = apartmentsAXE();
    const handler = serveHttp(await createMcpServer(axe));
    const l = await mount(handler);
    for (const name of ["first", "second"]) {
      const { client } = await connect(`${l.url}/mcp`);
      const { tools } = await client.listTools();
      expect(
        tools.map((t) => t.name),
        name,
      ).toContain("units_search");
      const r = await client.callTool({
        name: "units_search",
        arguments: { location: "Bellevue, WA" },
      });
      expect(structured<{ status: string }>(r).status).toBe("ok");
    }
    // Concurrent clients, each on its own per-request server and transport.
    const clients = await Promise.all([1, 2, 3].map(() => connect(`${l.url}/mcp`)));
    const results = await Promise.all(
      clients.map(({ client }) =>
        client.callTool({ name: "units_search", arguments: { location: "Seattle, WA" } }),
      ),
    );
    expect(results.map((r) => structured<{ status: string }>(r).status)).toEqual([
      "ok",
      "ok",
      "ok",
    ]);
    expect(handler.sessionCount).toBe(0);
  });

  it("sessions: separate clients get separate sessions; continue, resume, and poll follow-ups work; DELETE closes the session", async () => {
    const { url, handler, state } = await notesOverHttp(true);
    const a = await connect(url, "tok-alice");
    const b = await connect(url, "tok-alice");
    expect(a.transport.sessionId).toBeTruthy();
    expect(b.transport.sessionId).toBeTruthy();
    expect(a.transport.sessionId).not.toBe(b.transport.sessionId);
    expect(handler.sessionCount).toBe(2);

    // needs_input, then axe_continue
    const started = await a.client.callTool({ name: "notes_create", arguments: { text: "hi" } });
    const token = structured<{ continuationToken: string }>(started).continuationToken;
    const done = await a.client.callTool({
      name: "axe_continue",
      arguments: {
        continuationToken: token,
        kind: "contact.email",
        payload: { email: "a@x.example" },
      },
    });
    expect(structured<{ output: { owner: string } }>(done).output.owner).toBe("alice");

    // needs_human, then axe_resume
    const share = await a.client.callTool({ name: "notes_share", arguments: { id: "N-1" } });
    const resumeToken = structured<{ handoff: { resumeToken: string } }>(share).handoff.resumeToken;
    const resumed = await b.client.callTool({ name: "axe_resume", arguments: { resumeToken } });
    expect(structured<{ output: { by: string } }>(resumed).output.by).toBe("alice");

    // pending, then axe_poll in the session that received the pollUrl
    const derivedPoll = await a.client.callTool({ name: "reports_build", arguments: {} });
    const { pollUrl } = structured<{ pollUrl: string; status: string }>(derivedPoll);
    expect(structured<{ status: string }>(derivedPoll).status).toBe("pending");
    state.reportReady = true;
    // The other session of the same user was not issued this URL.
    const foreign = await b.client.callTool({ name: "axe_poll", arguments: { pollUrl } });
    expect(foreign.isError).toBe(true);
    expect(text(foreign)).toContain("only polls a pollUrl this server returned");
    const polled = await a.client.callTool({ name: "axe_poll", arguments: { pollUrl } });
    expect(structured<{ output: { owner: string; count: number } }>(polled).output).toEqual({
      owner: "alice",
      count: 1,
    });

    // DELETE ends the session: the server forgets it, and its id is answered 404.
    const closedId = a.transport.sessionId!;
    await a.transport.terminateSession();
    expect(handler.sessionCount).toBe(1);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Bearer tok-alice",
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "Mcp-Session-Id": closedId,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(res.status).toBe(404);
  });

  it("sessions: deferred login can bind each anonymous session to its own dynamic identity", async () => {
    const site = notesSite();
    const identities = new Map<string, string>();
    const handler = serveHttp(await createMcpServer(site.axe), {
      sessions: true,
      anonymousSessionClientFor: (sessionId) => ({
        identity: { onBehalfOf: identities.get(sessionId) ?? `waiting:${sessionId}` },
      }),
    });
    const l = await mount(handler);
    const a = await connect(`${l.url}/mcp`);
    const b = await connect(`${l.url}/mcp`);
    expect(a.transport.sessionId).toBeTruthy();
    expect(b.transport.sessionId).toBeTruthy();
    expect(a.transport.sessionId).not.toBe(b.transport.sessionId);

    identities.set(a.transport.sessionId!, "alice");
    identities.set(b.transport.sessionId!, "bob");
    const [alice, bob] = await Promise.all([
      a.client.callTool({ name: "notes_whoami", arguments: {} }),
      b.client.callTool({ name: "notes_whoami", arguments: {} }),
    ]);
    expect(structured<{ output: { user: string } }>(alice).output.user).toBe("alice");
    expect(structured<{ output: { user: string } }>(bob).output.user).toBe("bob");
  });

  it("sessions: an idle session expires with 404, and the client re-initializes", async () => {
    let now = 1_000_000;
    const { url, handler } = await notesOverHttp({ clock: () => now, idleTimeoutMs: 60_000 });
    const first = await connect(url, "tok-alice");
    expect((await first.client.listTools()).tools.length).toBeGreaterThan(0);
    now += 60_000;
    const err = await first.client.listTools().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(StreamableHTTPError);
    expect((err as StreamableHTTPError).code).toBe(404);
    expect(handler.sessionCount).toBe(0);
    // The MCP transport rule: on 404 start a new session with a new initialize.
    const again = await connect(url, "tok-alice");
    expect(again.transport.sessionId).not.toBe(first.transport.sessionId);
    const who = await again.client.callTool({ name: "notes_whoami", arguments: {} });
    expect(structured<{ output: { user: string } }>(who).output.user).toBe("alice");
  });

  it("two authenticated users are isolated: each call reaches AXE as its own principal, and neither can continue, poll, or join the other's work", async () => {
    for (const sessions of [true, false]) {
      const { url, state } = await notesOverHttp(sessions);
      const alice = await connect(url, "tok-alice");
      const bob = await connect(url, "tok-bob");
      const [wa, wb] = await Promise.all([
        alice.client.callTool({ name: "notes_whoami", arguments: {} }),
        bob.client.callTool({ name: "notes_whoami", arguments: {} }),
      ]);
      expect(structured<{ output: { user: string } }>(wa).output.user).toBe("alice");
      expect(structured<{ output: { user: string } }>(wb).output.user).toBe("bob");

      // Alice's continuation token, presented by Bob, is an unknown token to the site; nothing runs.
      const started = await alice.client.callTool({
        name: "notes_create",
        arguments: { text: "a" },
      });
      const token = structured<{ continuationToken: string }>(started).continuationToken;
      const stolen = await bob.client.callTool({
        name: "axe_continue",
        arguments: {
          continuationToken: token,
          kind: "contact.email",
          payload: { email: "b@x.example" },
        },
      });
      expect(stolen.isError).toBe(true);
      expect(text(stolen)).toContain("not_found");
      expect(state.runs).toEqual(["create:alice"]);

      // Alice's pollUrl was never issued to Bob's session or principal; nothing is fetched.
      const report = await alice.client.callTool({ name: "reports_build", arguments: {} });
      const { pollUrl } = structured<{ pollUrl: string }>(report);
      const runsBefore = state.runs.length;
      const peek = await bob.client.callTool({ name: "axe_poll", arguments: { pollUrl } });
      expect(peek.isError).toBe(true);
      expect(text(peek)).toContain("only polls a pollUrl this server returned");
      expect(state.runs.length).toBe(runsBefore);

      // Alice finishes her own work as herself.
      const mine = await alice.client.callTool({
        name: "axe_continue",
        arguments: {
          continuationToken: token,
          kind: "contact.email",
          payload: { email: "a@x.example" },
        },
      });
      expect(structured<{ output: { owner: string } }>(mine).output.owner).toBe("alice");
      expect(state.runs.slice(0, 1).concat(state.runs.slice(-1))).toEqual([
        "create:alice",
        "continue:alice",
      ]);

      if (sessions) {
        // Bob presenting Alice's session id is answered like an unknown session.
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: "Bearer tok-bob",
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
            "Mcp-Session-Id": alice.transport.sessionId!,
          },
          body: JSON.stringify({ jsonrpc: "2.0", id: 9, method: "tools/list" }),
        });
        expect(res.status).toBe(404);
      }
    }
  });

  it("a URL source: every call reaches the AXE site with the caller's own credential", async () => {
    const seen: (string | null)[] = [];
    const ref: { site?: ReturnType<typeof notesSite> } = {};
    const axeListener = await listen((req) => {
      seen.push(req.headers.get("authorization"));
      return ref.site!.axe.handle(req);
    });
    cleanup.push(() => axeListener.close());
    ref.site = notesSite(axeListener.url);
    // A token for the AXE site, as a token exchange (RFC 8693) with its authorization server would
    // return it; the MCP access token itself is not forwarded.
    const exchanged = (sub: string) => `user:${sub}`;
    const handler = serveHttp(await createMcpServer(axeListener.url), {
      sessions: true,
      auth: { verifier },
      clientFor: (authInfo) => ({ client: { auth: exchanged(String(authInfo.extra!["sub"])) } }),
    });
    const l = await mount(handler);
    const alice = await connect(`${l.url}/mcp`, "tok-alice");
    const bob = await connect(`${l.url}/mcp`, "tok-bob");
    seen.length = 0;
    const [ra, rb] = await Promise.all([
      alice.client.callTool({ name: "notes_whoami", arguments: {} }),
      bob.client.callTool({ name: "notes_whoami", arguments: {} }),
    ]);
    expect(structured<{ output: { user: string } }>(ra).output.user).toBe("alice");
    expect(structured<{ output: { user: string } }>(rb).output.user).toBe("bob");
    const actionCalls = seen.filter((h) => h !== null);
    expect(actionCalls.sort()).toEqual(["Bearer user:alice", "Bearer user:bob"]);
    expect(seen).not.toContain("Bearer tok-alice");
    expect(seen).not.toContain("Bearer tok-bob");
  });

  it("acts as an OAuth resource server: 401 with resource metadata, 403 for scope, refused audience, and the metadata document", async () => {
    const meta = protectedResourceMetadata({
      resource: "https://mcp.example/mcp",
      authorizationServers: ["https://auth.example"],
      scopesSupported: ["notes"],
    });
    expect(meta.path).toBe("/.well-known/oauth-protected-resource/mcp");
    expect(meta.url).toBe("https://mcp.example/.well-known/oauth-protected-resource/mcp");
    const doc = (await meta.handler(new Request(meta.url)).json()) as Record<string, unknown>;
    expect(doc).toMatchObject({
      resource: "https://mcp.example/mcp",
      authorization_servers: ["https://auth.example"],
      scopes_supported: ["notes"],
    });
    const site = notesSite();
    const handler = serveHttp(await createMcpServer(site.axe), {
      auth: {
        verifier,
        requiredScopes: ["notes"],
        resource: "https://mcp.example/mcp",
        resourceMetadataUrl: meta.url,
      },
      clientFor: (authInfo) => ({ identity: { onBehalfOf: String(authInfo.extra!["sub"]) } }),
    });
    const l = await mount(handler);
    const post = (token?: string, origin?: string) =>
      fetch(`${l.url}/mcp`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(origin ? { Origin: origin } : {}),
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      });
    const none = await post();
    expect(none.status).toBe(401);
    expect(none.headers.get("www-authenticate")).toBe(
      `Bearer scope="notes", resource_metadata="${meta.url}"`,
    );
    const bad = await post("tok-forged");
    expect(bad.status).toBe(401);
    expect(bad.headers.get("www-authenticate")).toContain('error="invalid_token"');
    const elsewhere = await post("tok-elsewhere");
    expect(elsewhere.status).toBe(401);
    const noScope = await post("tok-noscope");
    expect(noScope.status).toBe(403);
    expect(noScope.headers.get("www-authenticate")).toContain('error="insufficient_scope"');
    const foreignOrigin = await post("tok-alice", "https://evil.example");
    expect(foreignOrigin.status).toBe(403);
    const ok = await post("tok-alice");
    expect(ok.status).toBe(200);
    await expect(connect(`${l.url}/mcp`)).rejects.toThrow();
  });

  it("refuses to share one identity among HTTP callers unless told to", async () => {
    const { axe } = apartmentsAXE();
    const withAuth = await createMcpServer(axe, { client: { auth: "user:dana" } });
    expect(() => serveHttp(withAuth)).toThrow(/allowSharedCredentials/);
    expect(() => serveHttp(withAuth, { allowSharedCredentials: true })).not.toThrow();
    expect(() => serveHttp(withAuth, { auth: { verifier } })).toThrow(/needs `clientFor`/);
  });
});
