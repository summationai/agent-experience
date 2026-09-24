import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { createAXE, action, z } from "@axe/core";
import { axeFetch, isAxePath } from "../src/index";

function server() {
  const axe = createAXE({
    name: "City of Fernwood",
    description:
      "Pay parking tickets, look up citation status, and request hearings for the City of Fernwood.",
    baseUrl: "http://localhost:8787",
    auth: {
      modes: ["none", "user"],
      authenticate: async (req) =>
        req.headers.get("cookie")?.includes("sid=") ? { onBehalfOf: "resident-1" } : null,
    },
    secret: "0123456789abcdef0123456789abcdef",
  });
  axe.register(
    action("citations.lookup", {
      title: "Look up a citation",
      description:
        "Returns the status, amount due, and due date of a parking citation by citation number and license plate.",
      readOnly: true,
      risk: "none",
      input: z.object({
        citationNumber: z.string().describe("Citation number"),
        plate: z.string().describe("License plate"),
      }),
      output: z.object({ status: z.string(), amountDue: z.number() }),
      handler: async () => ({ status: "open", amountDue: 45 }),
    }),
  );
  return axe;
}

describe("axeFetch", () => {
  it("is a plain fetch handler", async () => {
    const handler = axeFetch(server());
    const res = await handler(new Request("http://localhost:8787/.well-known/axe.json"));
    expect(res.status).toBe(200);
    expect(res.headers.get("AXE-Protocol")).toBe("axe/0.1");
  });

  it("mounts in Hono and injects context", async () => {
    const seen: string[] = [];
    const handler = axeFetch<{ ENV: string }>(server(), {
      context: (req, env) => {
        seen.push(env?.ENV ?? "");
        return {
          identity: req.headers.get("x-user") ? { onBehalfOf: req.headers.get("x-user")! } : null,
        };
      },
    });
    const app = new Hono<{ Bindings: { ENV: string } }>();
    app.all("/axe/*", (c) => handler(c.req.raw, c.env));
    app.get("/.well-known/axe.json", (c) => handler(c.req.raw, c.env));
    const res = await app.fetch(
      new Request("http://localhost:8787/axe/actions/citations.lookup", {
        method: "POST",
        body: JSON.stringify({ input: { citationNumber: "C1", plate: "ABC123" } }),
      }),
      { ENV: "prod" },
    );
    expect(((await res.json()) as { status: string }).status).toBe("ok");
    expect(seen).toEqual(["prod"]);
    expect(isAxePath("/axe/actions/x.y")).toBe(true);
    expect(isAxePath("/about")).toBe(false);
  });
});
