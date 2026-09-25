import { describe, expect, it } from "vitest";
import { createServer, request as httpRequest, type IncomingMessage } from "node:http";
import { createAXE, action, z } from "@axe/core";
import type { AXEConfig } from "@axe/core";
import { axeNext, axeNextPages } from "../src/index";

function server(overrides: Partial<AXEConfig> = {}) {
  const axe = createAXE({
    name: "Northgate University Admissions",
    description:
      "Check application status, upload transcripts and recommendation letters, and schedule campus visits.",
    baseUrl: "https://admissions.northgate.example",
    auth: { modes: ["none", "user"], userLoginUrl: "https://admissions.northgate.example/login" },
    secret: "0123456789abcdef0123456789abcdef",
    ...overrides,
  });
  axe.register(
    action("applications.status", {
      title: "Check application status",
      description:
        "Returns the current status of the applicant's admission application, missing documents, and the decision date if released.",
      readOnly: true,
      risk: "none",
      auth: "user",
      input: z.object({}),
      output: z.object({ status: z.string(), applicant: z.string() }),
      handler: async ({ context }) => ({
        status: "under-review",
        applicant: context.onBehalfOf ?? "",
      }),
    }),
  );
  return axe;
}

describe("axeNext (App Router)", () => {
  it("returns GET/POST/OPTIONS handlers that share context injection", async () => {
    const { GET, POST, OPTIONS } = axeNext(server(), {
      context: (req) => ({
        identity: req.headers.get("cookie") === "sid=1" ? { onBehalfOf: "applicant-9" } : null,
      }),
    });
    const m = await GET(new Request("https://admissions.northgate.example/.well-known/axe.json"));
    expect(m.status).toBe(200);
    const r = await POST(
      new Request("https://admissions.northgate.example/axe/actions/applications.status", {
        method: "POST",
        headers: { cookie: "sid=1" },
        body: JSON.stringify({ input: {} }),
      }),
    );
    expect(((await r.json()) as { output: { applicant: string } }).output.applicant).toBe(
      "applicant-9",
    );
    const o = await OPTIONS(
      new Request("https://admissions.northgate.example/axe/actions/applications.status", {
        method: "OPTIONS",
      }),
    );
    expect(o.status).toBe(204);
  });
});

describe("axeNextPages (Pages API)", () => {
  it("adapts Node req/res with a pre-parsed body", async () => {
    const pages = axeNextPages(server(), {
      origin: "https://admissions.northgate.example",
      context: (req) => ({
        identity: req.headers["x-user"] ? { onBehalfOf: String(req.headers["x-user"]) } : null,
      }),
    });
    const http = createServer((req, res) => {
      // Simulate Next's body parsing.
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        const text = Buffer.concat(chunks).toString();
        void pages(Object.assign(req, { body: text ? JSON.parse(text) : undefined }), res);
      });
    });
    await new Promise<void>((r) => http.listen(0, () => r()));
    const port = (http.address() as { port: number }).port;
    const m = await fetch(`http://127.0.0.1:${port}/.well-known/axe.json`);
    expect(m.status).toBe(200);
    const r = await fetch(`http://127.0.0.1:${port}/axe/actions/applications.status`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-user": "applicant-3" },
      body: JSON.stringify({ input: {} }),
    });
    expect(((await r.json()) as { output: { applicant: string } }).output.applicant).toBe(
      "applicant-3",
    );
    await new Promise<void>((r) => http.close(() => r()));
  });
});

describe("request policy through the Next adapters [P-TRANS-1] [P-TRANS-2]", () => {
  const SITE = "https://admissions.northgate.example";
  function writable() {
    const writes: string[] = [];
    const axe = createAXE({
      name: "Northgate University Admissions",
      description:
        "Check application status, upload transcripts and recommendation letters, and schedule campus visits.",
      baseUrl: SITE,
      auth: { modes: ["none", "user"], userLoginUrl: `${SITE}/login` },
      secret: "0123456789abcdef0123456789abcdef",
    });
    axe.register(
      action("visits.schedule", {
        title: "Schedule a campus visit",
        description:
          "Books a campus visit for the signed-in applicant on the given date and returns the visit id.",
        risk: "low",
        reversible: true,
        auth: "user",
        input: z.object({ date: z.string() }),
        output: z.object({ visitId: z.string() }),
        handler: async ({ input, context }) => {
          writes.push(`${context.onBehalfOf}:${input.date}`);
          return { visitId: `v-${input.date}` };
        },
      }),
    );
    const identity = (
      cookie: string | null | undefined,
      authorization: string | null | undefined,
    ) =>
      cookie === "sid=1"
        ? { onBehalfOf: "applicant-9" }
        : authorization === "Bearer t"
          ? { onBehalfOf: "applicant-3" }
          : null;
    return { axe, writes, identity };
  }
  const envelope = (date: string) => JSON.stringify({ input: { date }, idempotencyKey: date });

  describe("App Router", () => {
    it("refuses cross-origin cookie writes and non-JSON writes; runs same-origin and bearer JSON", async () => {
      const { axe, writes, identity } = writable();
      const { POST } = axeNext(axe, {
        context: (req) => ({
          identity: identity(req.headers.get("cookie"), req.headers.get("authorization")),
        }),
      });
      const call = (headers: Record<string, string>, body: string) =>
        POST(new Request(`${SITE}/axe/actions/visits.schedule`, { method: "POST", headers, body }));
      const csrf = await call(
        { "content-type": "text/plain", origin: "https://evil.example", cookie: "sid=1" },
        envelope("d1"),
      );
      const form = await call(
        { "content-type": "application/x-www-form-urlencoded", authorization: "Bearer t" },
        `${envelope("d2")}=`,
      );
      const same = await call(
        { "content-type": "application/json", origin: SITE, cookie: "sid=1" },
        envelope("d3"),
      );
      const bearer = await call(
        { "content-type": "application/json", authorization: "Bearer t" },
        envelope("d4"),
      );
      expect([csrf.status, form.status, same.status, bearer.status]).toEqual([403, 400, 200, 200]);
      expect(writes).toEqual(["applicant-9:d3", "applicant-3:d4"]);
    });
  });

  describe("Pages API", () => {
    /**
     * Next's Pages API body parser, as it behaves: JSON bodies become objects, form bodies
     * become objects, and every other content type (missing included) becomes a string.
     */
    function nextBodyParser(req: IncomingMessage, text: string): unknown {
      const type = (req.headers["content-type"] ?? "text/plain").split(";")[0]!.trim();
      if (!text) return undefined;
      if (type === "application/json" || type === "application/ld+json") return JSON.parse(text);
      if (type === "application/x-www-form-urlencoded")
        return Object.fromEntries(new URLSearchParams(text));
      return text;
    }

    it("keeps the sent content type, so parsed text and form bodies are still refused", async () => {
      const { axe, writes, identity } = writable();
      const pages = axeNextPages(axe, {
        origin: SITE,
        context: (req) => ({
          identity: identity(req.headers.cookie, req.headers.authorization),
        }),
      });
      const http = createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", () => {
          const body = nextBodyParser(req, Buffer.concat(chunks).toString());
          void pages(Object.assign(req, { body }), res);
        });
      });
      await new Promise<void>((r) => http.listen(0, () => r()));
      const port = (http.address() as { port: number }).port;
      const call = async (headers: Record<string, string>, body: string) =>
        (
          await fetch(`http://127.0.0.1:${port}/axe/actions/visits.schedule`, {
            method: "POST",
            headers,
            body,
          })
        ).status;
      const results = [
        await call({ "content-type": "text/plain", authorization: "Bearer t" }, envelope("p1")),
        await call(
          { "content-type": "application/x-www-form-urlencoded", authorization: "Bearer t" },
          `${envelope("p2")}=`,
        ),
        await call(
          { "content-type": "text/plain", origin: "https://evil.example", cookie: "sid=1" },
          envelope("p3"),
        ),
        await call(
          { "content-type": "application/json", origin: SITE, cookie: "sid=1" },
          envelope("p4"),
        ),
        await call(
          { "content-type": "application/json", authorization: "Bearer t" },
          envelope("p5"),
        ),
      ];
      expect(results).toEqual([400, 400, 403, 200, 200]);
      expect(writes).toEqual(["applicant-9:p4", "applicant-3:p5"]);
      await new Promise<void>((r) => http.close(() => r()));
    });
  });
});

describe("axeNextPages deep parsed body [P-LIM-2]", () => {
  it("a deeply nested body Next already parsed is invalid_input, not a 500", async () => {
    const pages = axeNextPages(server(), { origin: "https://admissions.northgate.example" });
    const http = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        void pages(Object.assign(req, { body: JSON.parse(Buffer.concat(chunks).toString()) }), res);
      });
    });
    await new Promise<void>((r) => http.listen(0, () => r()));
    const port = (http.address() as { port: number }).port;
    const n = 20_000;
    const r = await fetch(`http://127.0.0.1:${port}/axe/actions/applications.status`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: `{"input":{"x":${"[".repeat(n)}${"]".repeat(n)}}}`,
    });
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: { code: string } }).error.code).toBe("invalid_input");
    await new Promise<void>((r) => http.close(() => r()));
  });
});

describe("axeNextPages body limit [P-LIM-1]", () => {
  /** Send headers and the first bytes of a body, never the rest; resolve with the response. */
  function partialPost(port: number, headers: Record<string, string>, first: Buffer) {
    return new Promise<{ status: number; body: string }>((resolve) => {
      const req = httpRequest(
        {
          host: "127.0.0.1",
          port,
          path: "/axe/actions/applications.status",
          method: "POST",
          headers,
        },
        (res) => {
          let body = "";
          res.on("data", (c: Buffer) => (body += c.toString()));
          res.on("end", () => {
            resolve({ status: res.statusCode ?? 0, body });
            req.destroy();
          });
        },
      );
      req.on("error", () => undefined);
      req.write(first);
    });
  }

  it(
    "an unparsed raw body is read only past maxBodyBytes and refused with 413, declared or chunked",
    { timeout: 5000 },
    async () => {
      // bodyParser: false in the route config: Next leaves the stream unread.
      const pages = axeNextPages(server({ maxBodyBytes: 100 * 1024 }), {
        origin: "https://admissions.northgate.example",
      });
      const http = createServer((req, res) => void pages(req, res));
      await new Promise<void>((r) => http.listen(0, () => r()));
      const port = (http.address() as { port: number }).port;
      const declared = await partialPost(
        port,
        { "content-type": "application/json", "content-length": String(10 * 1024 * 1024) },
        Buffer.alloc(64 * 1024, 0x20),
      );
      const chunked = await partialPost(
        port,
        { "content-type": "application/json" },
        Buffer.alloc(200 * 1024, 0x20),
      );
      expect([declared.status, chunked.status]).toEqual([413, 413]);
      expect(JSON.parse(chunked.body).error.details.reason).toBe("payload_too_large");
      await new Promise<void>((r) => http.close(() => r()));
    },
  );
});
