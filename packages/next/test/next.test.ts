import { describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { createAXE, action, z } from "@axe/core";
import { axeNext, axeNextPages } from "../src/index";

function server() {
  const axe = createAXE({
    name: "Northgate University Admissions",
    description:
      "Check application status, upload transcripts and recommendation letters, and schedule campus visits.",
    baseUrl: "https://admissions.northgate.example",
    auth: { modes: ["none", "user"], userLoginUrl: "https://admissions.northgate.example/login" },
    secret: "0123456789abcdef0123456789abcdef",
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
