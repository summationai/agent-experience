import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { request as httpRequest } from "node:http";
import type { Server } from "node:http";
import { createAXE, action, z } from "@axe/core";
import type { AXEConfig } from "@axe/core";
import { axeExpress } from "../src/index";

function server(overrides: Partial<AXEConfig> = {}) {
  const axe = createAXE({
    name: "Sunrise Yoga Studio",
    description:
      "Book, reschedule, and cancel yoga classes; check schedules and instructor bios for a Ballard studio.",
    baseUrl: "http://localhost:0",
    auth: { modes: ["none", "user"], userLoginUrl: "http://localhost:0/login" },
    secret: "0123456789abcdef0123456789abcdef",
    ...overrides,
  });
  axe.register(
    action("classes.search", {
      title: "Search upcoming classes",
      description:
        "Find classes by date range, style, instructor, or level. Returns up to 50 results with start times and open spots.",
      readOnly: true,
      risk: "none",
      input: z.object({ from: z.string().date().describe("Start date") }),
      output: z.object({ classes: z.array(z.object({ id: z.string(), title: z.string() })) }),
      handler: async () => ({ classes: [{ id: "c1", title: "Vinyasa" }] }),
    }),
  );
  axe.register(
    action("classes.book", {
      title: "Book a spot",
      description:
        "Reserves a spot for the authenticated member using their active class pass and returns the booking id and time.",
      risk: "medium",
      idempotent: true,
      reversible: true,
      auth: "user",
      input: z.object({ classId: z.string().describe("Class id") }),
      output: z.object({ bookingId: z.string(), member: z.string() }),
      handler: async ({ input, context }) => ({
        bookingId: `b-${input.classId}`,
        member: context.onBehalfOf ?? "",
      }),
    }),
  );
  return axe;
}

describe("axeExpress", () => {
  let http: Server;
  let base: string;
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as unknown as { session: { userId: string } | undefined }).session = req.headers[
        "x-session"
      ]
        ? { userId: String(req.headers["x-session"]) }
        : undefined;
      next();
    });
    app.use(
      axeExpress(server(), {
        context: (req) => ({
          identity: (req as unknown as { session?: { userId: string } }).session
            ? { onBehalfOf: (req as unknown as { session: { userId: string } }).session.userId }
            : null,
        }),
      }),
    );
    app.get("/", (_req, res) => res.send("human site"));
    await new Promise<void>((resolve) => {
      http = app.listen(0, () => resolve());
    });
    const addr = http.address() as { port: number };
    base = `http://127.0.0.1:${addr.port}`;
  });
  afterAll(() => new Promise<void>((r) => http.close(() => r())));

  it("serves the manifest and leaves other routes alone", async () => {
    const m = await fetch(`${base}/.well-known/axe.json`);
    expect(m.status).toBe(200);
    expect(m.headers.get("axe-protocol")).toBe("axe/0.1");
    expect(((await m.json()) as { name: string }).name).toBe("Sunrise Yoga Studio");
    expect(await (await fetch(`${base}/`)).text()).toBe("human site");
  });

  it("invokes actions with a pre-parsed JSON body and passes the session as identity", async () => {
    const r = await fetch(`${base}/axe/actions/classes.search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: { from: "2026-10-01" } }),
    });
    expect(((await r.json()) as { status: string }).status).toBe("ok");
    const b = await fetch(`${base}/axe/actions/classes.book`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-session": "member-7" },
      body: JSON.stringify({ input: { classId: "c1" }, idempotencyKey: "k" }),
    });
    const body = (await b.json()) as { status: string; output: { member: string } };
    expect(body.status).toBe("ok");
    expect(body.output.member).toBe("member-7");
    const anon = await fetch(`${base}/axe/actions/classes.book`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: { classId: "c1" }, idempotencyKey: "k" }),
    });
    expect(((await anon.json()) as { status: string }).status).toBe("needs_human");
  });

  it("a deeply nested body parsed by express.json() is invalid_input, not a 500 [P-LIM-2]", async () => {
    const n = 20_000;
    const r = await fetch(`${base}/axe/actions/classes.search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: `{"input":{"from":${"[".repeat(n)}${"]".repeat(n)}}}`,
    });
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: { code: string } }).error.code).toBe("invalid_input");
  });

  it("works without express.json() by reading the raw stream", async () => {
    const app = express();
    app.use(axeExpress(server()));
    const srv = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const port = (srv.address() as { port: number }).port;
    const r = await fetch(`http://127.0.0.1:${port}/axe/actions/classes.search`, {
      method: "POST",
      body: JSON.stringify({ input: { from: "2026-10-01" } }),
    });
    expect(((await r.json()) as { status: string }).status).toBe("ok");
    await new Promise<void>((res) => srv.close(() => res()));
  });
});

describe("axeExpress request policy [P-TRANS-1] [P-TRANS-2]", () => {
  const SITE = "http://localhost:0";
  let http: Server;
  let base: string;
  const writes: string[] = [];

  beforeAll(async () => {
    const axe = createAXE({
      name: "Sunrise Yoga Studio",
      description:
        "Book, reschedule, and cancel yoga classes; check schedules and instructor bios for a Ballard studio.",
      baseUrl: SITE,
      auth: { modes: ["none", "user"], userLoginUrl: `${SITE}/login` },
      requestPolicy: { trustedOrigins: ["https://partner.example"] },
      secret: "0123456789abcdef0123456789abcdef",
    });
    axe.register(
      action("classes.book", {
        title: "Book a spot",
        description:
          "Reserves a spot for the authenticated member using their active class pass and returns the booking id.",
        risk: "medium",
        reversible: true,
        auth: "user",
        input: z.object({ classId: z.string().describe("Class id") }),
        output: z.object({ bookingId: z.string() }),
        handler: async ({ input, context }) => {
          writes.push(`${context.onBehalfOf}:${input.classId}`);
          return { bookingId: `b-${input.classId}` };
        },
      }),
    );
    axe.register(
      action("classes.search", {
        title: "Search upcoming classes",
        description:
          "Find classes by date. Returns up to 50 results with start times and open spots.",
        readOnly: true,
        risk: "none",
        input: z.object({}),
        output: z.object({ count: z.number() }),
        handler: async () => ({ count: 3 }),
      }),
    );
    const app = express();
    // A typical stack: every body parser a site might already have mounted, so the adapter
    // sees bodies that were parsed as JSON, text, and form data before it runs.
    app.use(express.json());
    app.use(express.text());
    app.use(express.urlencoded({ extended: false }));
    app.use(
      axeExpress(axe, {
        context: (req) => ({
          identity: /(?:^|;\s*)sid=member-7\b/.test(req.headers.cookie ?? "")
            ? { onBehalfOf: "member-7" }
            : req.headers.authorization === "Bearer partner-token"
              ? { onBehalfOf: "member-9" }
              : null,
        }),
      }),
    );
    await new Promise<void>((resolve) => {
      http = app.listen(0, () => resolve());
    });
    base = `http://127.0.0.1:${(http.address() as { port: number }).port}`;
  });
  afterAll(() => new Promise<void>((r) => http.close(() => r())));

  const envelope = (classId: string) =>
    JSON.stringify({ input: { classId }, idempotencyKey: classId });
  const post = async (path: string, headers: Record<string, string>, body: string) => {
    const r = await fetch(`${base}${path}`, { method: "POST", headers, body });
    return {
      status: r.status,
      body: (await r.json()) as { status: string; error?: { code: string } },
    };
  };

  const simple: [string, Record<string, string>, string][] = [
    ["text/plain", { "content-type": "text/plain;charset=UTF-8" }, envelope("c-text")],
    [
      "form-encoded",
      { "content-type": "application/x-www-form-urlencoded" },
      `${envelope("c-form")}=`,
    ],
    [
      "multipart",
      { "content-type": "multipart/form-data; boundary=b" },
      `--b\r\nContent-Disposition: form-data; name="x"\r\n\r\n${envelope("c-multi")}\r\n--b--\r\n`,
    ],
  ];

  for (const [label, headers, body] of simple) {
    it(`a cross-origin ${label} POST with the session cookie is forbidden and nothing runs`, async () => {
      const r = await post(
        "/axe/actions/classes.book",
        { ...headers, origin: "https://evil.example", cookie: "sid=member-7" },
        body,
      );
      expect(r.status).toBe(403);
      expect(r.body.error?.code).toBe("forbidden");
      expect(writes).toEqual([]);
    });

    it(`a ${label} POST without an Origin is refused as unsupported even though a body parser ran`, async () => {
      const r = await post(
        "/axe/actions/classes.book",
        { ...headers, authorization: "Bearer partner-token" },
        body,
      );
      expect(r.status).toBe(400);
      expect(r.body.error?.code).toBe("unsupported");
      expect(writes).toEqual([]);
    });
  }

  it("a POST with no content type is refused as unsupported", async () => {
    const r = await fetch(`${base}/axe/actions/classes.book`, {
      method: "POST",
      headers: { authorization: "Bearer partner-token" },
      body: new Blob([envelope("c-none")]),
    });
    expect(r.status).toBe(400);
    expect(writes).toEqual([]);
  });

  it("an unparsed body behind a parser that set req.body = {} is read from the stream", async () => {
    // Express 4's json parser assigns `req.body = {}` to a request it skipped. The adapter must
    // read the real bytes, and keep their real content type, rather than send "{}" as JSON.
    const app = express();
    app.use((req, _res, next) => {
      (req as unknown as { body: unknown }).body = {};
      next();
    });
    app.use(
      axeExpress(
        createAXE({
          name: "Sunrise Yoga Studio",
          description:
            "Book, reschedule, and cancel yoga classes; check schedules and instructor bios.",
          baseUrl: SITE,
          secret: "0123456789abcdef0123456789abcdef",
        }).register(
          action("classes.search", {
            title: "Search upcoming classes",
            description:
              "Find classes by date. Returns up to 50 results with start times and open spots.",
            readOnly: true,
            risk: "none",
            input: z.object({ from: z.string() }),
            output: z.object({ from: z.string() }),
            handler: async ({ input }) => ({ from: input.from }),
          }),
        ),
      ),
    );
    const srv = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const port = (srv.address() as { port: number }).port;
    const r = await fetch(`http://127.0.0.1:${port}/axe/actions/classes.search`, {
      method: "POST",
      headers: { "content-type": "application/vnd.axe+json" },
      body: JSON.stringify({ input: { from: "2026-10-01" } }),
    });
    expect(await r.json()).toMatchObject({ status: "ok", output: { from: "2026-10-01" } });
    await new Promise<void>((res) => srv.close(() => res()));
  });

  it("same-origin and trusted-origin JSON with the cookie, and bearer JSON without an Origin, run", async () => {
    const same = await post(
      "/axe/actions/classes.book",
      { "content-type": "application/json", origin: SITE, cookie: "sid=member-7" },
      envelope("c-same"),
    );
    const trusted = await post(
      "/axe/actions/classes.book",
      {
        "content-type": "application/json",
        origin: "https://partner.example",
        cookie: "sid=member-7",
      },
      envelope("c-trusted"),
    );
    const bearer = await post(
      "/axe/actions/classes.book",
      { "content-type": "application/json", authorization: "Bearer partner-token" },
      envelope("c-bearer"),
    );
    expect([same.body.status, trusted.body.status, bearer.body.status]).toEqual(["ok", "ok", "ok"]);
    expect(writes).toEqual(["member-7:c-same", "member-7:c-trusted", "member-9:c-bearer"]);
  });

  it("GETs from a foreign origin with the cookie are unaffected", async () => {
    const r = await fetch(`${base}/.well-known/axe.json`, {
      headers: { origin: "https://evil.example", cookie: "sid=member-7" },
    });
    expect(r.status).toBe(200);
  });
});

/**
 * Send headers and the first bytes of a body, never the rest, and resolve with the response. A
 * server that buffers the whole body before answering never answers; the test times out.
 */
function partialPost(
  port: number,
  path: string,
  headers: Record<string, string>,
  first: Buffer,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve) => {
    const req = httpRequest({ host: "127.0.0.1", port, path, method: "POST", headers }, (res) => {
      let body = "";
      res.on("data", (c: Buffer) => (body += c.toString()));
      res.on("end", () => {
        resolve({ status: res.statusCode ?? 0, body });
        req.destroy();
      });
    });
    req.on("error", () => undefined);
    req.write(first);
  });
}

describe("axeExpress body limit [P-LIM-1]", () => {
  async function listen(maxBodyBytes: number) {
    const runs: string[] = [];
    const axe = server({ maxBodyBytes, onRequest: (ctx) => void runs.push(ctx.action) });
    const app = express();
    app.use(axeExpress(axe));
    const srv = await new Promise<Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    return { srv, port: (srv.address() as { port: number }).port, runs };
  }

  it(
    "a raw body whose Content-Length exceeds the limit is refused with 413 before it is read",
    { timeout: 5000 },
    async () => {
      const { srv, port, runs } = await listen(1024);
      const r = await partialPost(
        port,
        "/axe/actions/classes.search",
        { "content-type": "application/json", "content-length": String(10 * 1024 * 1024) },
        Buffer.alloc(64 * 1024, 0x20),
      );
      expect(r.status).toBe(413);
      expect(JSON.parse(r.body).error.details.reason).toBe("payload_too_large");
      expect(runs).toEqual([]);
      await new Promise<void>((res) => srv.close(() => res()));
    },
  );

  it(
    "a chunked raw body is read only past the limit, then refused with 413 without waiting for the rest",
    { timeout: 5000 },
    async () => {
      const { srv, port, runs } = await listen(100 * 1024);
      const r = await partialPost(
        port,
        "/axe/actions/classes.search",
        { "content-type": "application/json" },
        Buffer.alloc(200 * 1024, 0x20),
      );
      expect(r.status).toBe(413);
      expect(runs).toEqual([]);
      await new Promise<void>((res) => srv.close(() => res()));
    },
  );
});
