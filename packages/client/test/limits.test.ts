/**
 * Client limits (docs/for-agent-builders.md, "Timeouts, cancellation, and budgets"): every request
 * has a timeout and honors the caller's signal, response bodies are bounded while they are read,
 * polling has a budget, and a malformed document from a site is an `AXEClientError`, never a
 * crash later on. Timers are faked; nothing sleeps.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AXEClient, AXEClientError, discover } from "../src/index";
import type { Fulfiller, Manifest, PendingResult } from "../src/index";
import { present } from "../src/present";

const BASE = "https://limits.example";

function manifest(extra: Partial<Manifest> = {}): Manifest {
  return {
    protocol: "axe/0.1",
    name: "Limits",
    description: "A site used to test client limits.",
    baseUrl: BASE,
    auth: { modes: ["none"] },
    actions: [
      {
        name: "things.read",
        title: "Read things",
        description: "Reads things.",
        readOnly: true,
        idempotent: true,
        reversible: true,
        risk: "none",
        auth: "none",
        input: { type: "object" },
        output: { type: "object" },
      },
      {
        name: "things.make",
        title: "Make a thing",
        description: "Makes a thing.",
        readOnly: false,
        idempotent: true,
        reversible: true,
        risk: "low",
        auth: "none",
        input: { type: "object" },
        output: { type: "object" },
      },
    ],
    ...extra,
  };
}

type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;

/** A mocked network that records calls and rejects when the request's signal aborts. */
function network(handler: Handler) {
  const calls: string[] = [];
  const fetch = (input: string | URL, init: RequestInit = {}): Promise<Response> => {
    calls.push(String(input));
    return new Promise((resolve, reject) => {
      const signal = init.signal;
      if (signal?.aborted) return reject(signal.reason);
      signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
      Promise.resolve(handler(new URL(String(input)), init)).then(resolve, reject);
    });
  };
  return { fetch, calls };
}

/** A response whose body never ends until `signal` aborts, like a stalled connection. */
function stalledBody(signal: AbortSignal | null | undefined): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"status":'));
      signal?.addEventListener("abort", () => controller.error(signal.reason), { once: true });
    },
  });
  return new Response(stream, { headers: { "content-type": "application/json" } });
}

const never = () => new Promise<Response>(() => undefined);
const json = (body: unknown, init: ResponseInit = {}) => Response.json(body, init);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("timeouts", () => {
  it("a request that never answers fails with a timeout after timeoutMs", async () => {
    const net = network(never);
    const client = new AXEClient(manifest(), { fetch: net.fetch, timeoutMs: 500 });
    const p = client.invoke("things.read", {});
    const assertion = expect(p).rejects.toThrow(/timed out after 500 ms/);
    await vi.advanceTimersByTimeAsync(500);
    await assertion;
    await expect(p).rejects.toBeInstanceOf(AXEClientError);
  });

  it("a body that stalls after the headers is covered by the same timeout", async () => {
    const net = network((_u, init) => stalledBody(init.signal));
    const client = new AXEClient(manifest(), { fetch: net.fetch, timeoutMs: 500 });
    const p = client.invoke("things.read", {});
    const assertion = expect(p).rejects.toThrow(/timed out after 500 ms/);
    await vi.advanceTimersByTimeAsync(500);
    await assertion;
  });

  it("the default timeout is 30 seconds, and a finished request leaves no timer behind", async () => {
    const hung = new AXEClient(manifest(), { fetch: network(never).fetch });
    const p = hung.invoke("things.read", {});
    const assertion = expect(p).rejects.toThrow(/timed out after 30000 ms/);
    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;

    const fine = new AXEClient(manifest(), {
      fetch: network(() => json({ status: "ok", output: {} })).fetch,
    });
    await fine.invoke("things.read", {});
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("cancellation: a caller-supplied signal on every public method", () => {
  it("aborting mid-request rejects with an AXEClientError", async () => {
    const net = network(never);
    const client = new AXEClient(manifest(), { fetch: net.fetch });
    const ctl = new AbortController();
    const p = client.invoke("things.read", {}, { signal: ctl.signal });
    const assertion = expect(p).rejects.toThrow(/was aborted/);
    ctl.abort();
    await assertion;
  });

  it("an already-aborted signal sends nothing, on invoke, continue, resume, poll, state, run, and discover", async () => {
    const net = network(() => json({ status: "ok", output: {} }));
    const client = new AXEClient(manifest({ live: { url: `${BASE}/axe/state` } }), {
      fetch: net.fetch,
    });
    const signal = AbortSignal.abort();
    const pending: PendingResult = {
      status: "pending",
      pollUrl: `${BASE}/axe/poll/t`,
      retryAfter: 1,
    };
    const calls = [
      client.invoke("things.read", {}, { signal }),
      client.continue("t", "x-a.b", {}, { signal }),
      client.resume("t", { signal }),
      client.poll(pending, { signal }),
      client.state({ signal }),
      client.run("things.read", {}, { signal }),
      discover(BASE, { fetch: net.fetch, signal }),
      AXEClient.discover(BASE, { fetch: net.fetch }, { signal }),
    ];
    for (const [i, p] of calls.entries())
      await expect(p, String(i)).rejects.toBeInstanceOf(AXEClientError);
    expect(net.calls).toEqual([]);
  });

  it("aborting discovery stops it instead of trying the next candidate", async () => {
    const ctl = new AbortController();
    const net = network(never);
    const p = discover(BASE, { fetch: net.fetch, signal: ctl.signal });
    const assertion = expect(p).rejects.toThrow(/was aborted/);
    await vi.advanceTimersByTimeAsync(10);
    ctl.abort();
    await assertion;
    expect(net.calls).toHaveLength(1);
  });
});

describe("response size", () => {
  it("a Content-Length above maxResponseBytes is refused before the body is read", async () => {
    let pulled = 0;
    const net = network(
      () =>
        new Response(
          new ReadableStream({
            pull(c) {
              pulled++;
              c.enqueue(new Uint8Array(1024));
            },
          }),
          { headers: { "content-length": String(50 * 1024 * 1024) } },
        ),
    );
    const client = new AXEClient(manifest(), { fetch: net.fetch, maxResponseBytes: 4096 });
    await expect(client.invoke("things.read", {})).rejects.toThrow(/larger than maxResponseBytes/);
    expect(pulled).toBeLessThanOrEqual(1);
  });

  it("a body without Content-Length is read up to the limit, then cancelled", async () => {
    const stats = { pulled: 0, cancelled: false };
    const net = network(
      () =>
        new Response(
          new ReadableStream({
            pull(c) {
              stats.pulled += 1024;
              c.enqueue(new Uint8Array(1024).fill(0x20));
            },
            cancel() {
              stats.cancelled = true;
            },
          }),
        ),
    );
    const client = new AXEClient(manifest(), { fetch: net.fetch, maxResponseBytes: 8 * 1024 });
    await expect(client.invoke("things.read", {})).rejects.toThrow(/larger than maxResponseBytes/);
    expect(stats.cancelled).toBe(true);
    expect(stats.pulled).toBeLessThanOrEqual(16 * 1024);
  });

  it("the default limit is 4 MiB, on results and on discovery", async () => {
    const big = { status: "ok", output: { pad: "x".repeat(5 * 1024 * 1024) } };
    const client = new AXEClient(manifest(), { fetch: network(() => json(big)).fetch });
    await expect(client.invoke("things.read", {})).rejects.toThrow(/4194304 bytes/);
    const huge = manifest({
      actions: Array.from({ length: 30_000 }, (_, i) => ({
        ...manifest().actions[0]!,
        name: `things.read-${i}`,
        description: "x".repeat(200),
      })),
    });
    await expect(discover(BASE, { fetch: network(() => json(huge)).fetch })).rejects.toThrow(
      /larger than maxResponseBytes/,
    );
  });
});

describe("polling budget", () => {
  const pendingAt = (retryAfter: unknown): unknown => ({
    status: "pending",
    pollUrl: `${BASE}/axe/poll/t`,
    retryAfter,
  });

  it("a site that says retryAfter 0 is polled at most once a second, not in a loop", async () => {
    const net = network(() => json(pendingAt(0)));
    const client = new AXEClient(manifest(), { fetch: net.fetch });
    const p = client.poll(pendingAt(0) as PendingResult, {
      maxWaitMs: 10_000,
      maxPollAttempts: 1000,
    });
    await vi.advanceTimersByTimeAsync(10_000);
    const last = await p;
    expect(last.status).toBe("pending");
    expect(net.calls.length).toBeGreaterThan(5);
    expect(net.calls.length).toBeLessThanOrEqual(10);
  });

  it("maxPollAttempts bounds the number of polls, default 60", async () => {
    const net = network(() => json(pendingAt(1)));
    const client = new AXEClient(manifest(), { fetch: net.fetch });
    const p = client.poll(pendingAt(1) as PendingResult, {
      maxPollAttempts: 3,
      maxWaitMs: 600_000,
    });
    await vi.advanceTimersByTimeAsync(600_000);
    expect((await p).status).toBe("pending");
    expect(net.calls).toHaveLength(3);

    const net2 = network(() => json(pendingAt(1)));
    const p2 = new AXEClient(manifest(), { fetch: net2.fetch }).poll(
      pendingAt(1) as PendingResult,
      {
        maxWaitMs: 600_000,
      },
    );
    await vi.advanceTimersByTimeAsync(600_000);
    await p2;
    expect(net2.calls).toHaveLength(60);
  });

  it("a long retryAfter is clamped to what is left of maxWaitMs", async () => {
    const net = network(() => json({ status: "ok", output: {} }));
    const client = new AXEClient(manifest(), { fetch: net.fetch });
    const p = client.poll(pendingAt(3600) as PendingResult, { maxWaitMs: 5000 });
    await vi.advanceTimersByTimeAsync(5000);
    expect((await p).status).toBe("ok");
  });

  it("run() shares one budget across every poll of the run", async () => {
    let step = 0;
    const net = network((url) => {
      if (url.pathname.startsWith("/axe/actions/")) return json(pendingAt(1));
      if (url.pathname === "/axe/continue") return json(pendingAt(1));
      step++;
      return step === 1
        ? json({
            status: "needs_input",
            reason: "more_info",
            message: "One more thing.",
            accepts: [
              {
                kind: "x-t.v",
                title: "V",
                description: "A value.",
                schema: { type: "string" },
                sensitive: false,
              },
            ],
            continuationToken: "c",
            expiresAt: "2026-10-01T00:00:00Z",
          })
        : json(pendingAt(1));
    });
    const fulfiller: Fulfiller = { kinds: ["x-t.v"], fulfill: () => "v" };
    const client = new AXEClient(manifest(), { fetch: net.fetch, fulfillers: [fulfiller] });
    const p = client.run("things.make", {}, { maxPollAttempts: 3, maxWaitMs: 600_000 });
    await vi.advanceTimersByTimeAsync(600_000);
    expect((await p).status).toBe("pending");
    expect(net.calls.filter((c) => c.includes("/axe/poll/"))).toHaveLength(3);
  });
});

describe("malformed documents from a site are AXEClientError", () => {
  const cases: [string, unknown][] = [
    ["an array", [1, 2]],
    ["an unknown status", { status: "done" }],
    ["status only through __proto__", JSON.parse('{"__proto__": {"status": "ok", "output": {}}}')],
    ["ok without output", { status: "ok" }],
    [
      "needs_input without accepts",
      { status: "needs_input", reason: "r", message: "m", continuationToken: "t", expiresAt: "e" },
    ],
    [
      "needs_input with a null accepts entry",
      {
        status: "needs_input",
        reason: "r",
        message: "m",
        continuationToken: "t",
        expiresAt: "e",
        accepts: [null],
      },
    ],
    [
      "needs_human without handoff.url",
      {
        status: "needs_human",
        handoff: {
          reason: "r",
          instructions: "i",
          resumeToken: "t",
          expiresAt: "e",
          whatAgentShouldSayToUser: "w",
        },
      },
    ],
    [
      "pending with a string retryAfter",
      { status: "pending", pollUrl: `${BASE}/axe/poll/t`, retryAfter: "soon" },
    ],
    ["pending without pollUrl", { status: "pending", retryAfter: 1 }],
    ["error without error", { status: "error" }],
    [
      "error with a numeric code",
      { status: "error", error: { code: 4, message: "m", retryable: false } },
    ],
    ["a rev that is an object", { status: "ok", output: {}, rev: { v: 1 } }],
  ];
  for (const [label, body] of cases) {
    it(`invoke and run: ${label}`, async () => {
      const client = new AXEClient(manifest(), { fetch: network(() => json(body)).fetch });
      await expect(client.invoke("things.read", {})).rejects.toBeInstanceOf(AXEClientError);
      await expect(client.run("things.read", {})).rejects.toThrow(/not an AXE result envelope/);
    });
  }

  it("__proto__ keys in an output stay data: nothing is polluted and present() works", async () => {
    const body =
      '{"status":"ok","output":{"__proto__":{"polluted":true},"constructor":{"x":1},"title":"t"}}';
    const client = new AXEClient(manifest(), {
      fetch: network(() => new Response(body, { headers: { "content-type": "application/json" } }))
        .fetch,
    });
    const outcome = await client.run("things.read", {});
    expect(outcome.status).toBe("ok");
    expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
    if (outcome.status !== "ok") return;
    const shown = present(outcome.action, outcome.result);
    expect(shown.items).toHaveLength(1);
  });

  it("a deeply nested output does not crash run() or present()", async () => {
    const n = 50_000;
    const body = `{"status":"ok","output":{"deep":${"[".repeat(n)}${"]".repeat(n)}}}`;
    const client = new AXEClient(manifest(), {
      fetch: network(() => new Response(body, { headers: { "content-type": "application/json" } }))
        .fetch,
    });
    const outcome = await client.run("things.read", {});
    expect(outcome.status).toBe("ok");
    if (outcome.status === "ok")
      expect(() => present(outcome.action, outcome.result)).not.toThrow();
  });

  it("discover() rejects malformed manifests and says why", async () => {
    const bad: [string, unknown][] = [
      ["null action", { ...manifest(), actions: [null] }],
      [
        "action name not a string",
        { ...manifest(), actions: [{ ...manifest().actions[0], name: 7 }] },
      ],
      [
        "missing readOnly",
        { ...manifest(), actions: [{ ...manifest().actions[0], readOnly: undefined }] },
      ],
      ["deny is a string", { ...manifest(), policies: { agents: { deny: "acme" } } }],
      ["live.url is a number", { ...manifest(), live: { url: 5 } }],
      [
        "baseUrl only via __proto__",
        JSON.parse(
          `{"protocol":"axe/0.1","name":"n","description":"d","actions":[],"__proto__":{"baseUrl":"${BASE}"}}`,
        ),
      ],
    ];
    for (const [label, body] of bad) {
      const net = network((url) =>
        url.pathname === "/"
          ? new Response("<html></html>", { headers: { "content-type": "text/html" } })
          : json(body),
      );
      await expect(discover(BASE, { fetch: net.fetch }), label).rejects.toThrow(
        /Not usable: .*not a well-formed manifest/,
      );
    }
    const good = network(() => json(manifest()));
    expect((await discover(BASE, { fetch: good.fetch })).manifest.name).toBe("Limits");
  });

  it("state() rejects a live-state document with the wrong shape", async () => {
    for (const body of [
      { actions: null },
      { actions: [] },
      { actions: { "a.b": { available: "yes" } } },
    ]) {
      const client = new AXEClient(manifest({ live: { url: `${BASE}/axe/state` } }), {
        fetch: network(() => json(body)).fetch,
      });
      await expect(client.state()).rejects.toThrow(/not a live-state document/);
    }
  });
});
