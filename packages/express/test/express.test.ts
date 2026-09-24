import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { createAXE, action, z } from "@axe/core";
import { axeExpress } from "../src/index";

function server() {
  const axe = createAXE({
    name: "Sunrise Yoga Studio",
    description:
      "Book, reschedule, and cancel yoga classes; check schedules and instructor bios for a Ballard studio.",
    baseUrl: "http://localhost:0",
    auth: { modes: ["none", "user"], userLoginUrl: "http://localhost:0/login" },
    secret: "0123456789abcdef0123456789abcdef",
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
