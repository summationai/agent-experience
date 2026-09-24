import { describe, expect, it } from "vitest";
import { AXEClient, isOk, isError, isPending, isNeedsHuman } from "../src/index";
import { present, toMarkdown, toHTML } from "../src/present";
import type { Manifest } from "@axe/core/types";
import { apartmentsAXE, UNITS } from "../../core/test/fixtures/apartments";

const manifestOf = (axe: { describe(): Manifest }) => axe.describe();

describe("client protocol behavior", () => {
  it("narrows on status, never HTTP status [P-INV-7]", async () => {
    const { axe } = apartmentsAXE();
    const client = new AXEClient(manifestOf(axe), {
      fetch: async () =>
        new Response(
          JSON.stringify({
            status: "needs_human",
            handoff: {
              reason: "r",
              instructions: "i",
              url: "https://x.example",
              resumeToken: "t",
              expiresAt: "2030-01-01T00:00:00Z",
              whatAgentShouldSayToUser: "s",
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    });
    const r = await client.invoke("units.search", { location: "x" });
    expect(isOk(r)).toBe(false);
    expect(isNeedsHuman(r)).toBe(true);
    const client2 = new AXEClient(manifestOf(axe), {
      fetch: async () =>
        new Response(JSON.stringify({ status: "ok", output: { units: [], nextCursor: null } }), {
          status: 500,
        }),
    });
    expect(isOk(await client2.invoke("units.search", { location: "x" }))).toBe(true);
    const client3 = new AXEClient(manifestOf(axe), {
      fetch: async () => new Response("<html>oops</html>", { status: 502 }),
    });
    await expect(client3.invoke("units.search", { location: "x" })).rejects.toThrow(/not JSON/);
  });

  it("poll honors maxWaitMs and returns the last pending result [P-PEND-3]", async () => {
    const { axe } = apartmentsAXE();
    let polls = 0;
    const client = new AXEClient(manifestOf(axe), {
      fetch: async () => {
        polls++;
        return new Response(
          JSON.stringify({
            status: "pending",
            pollUrl: "https://oakridge-rentals.example/axe/poll/t",
            retryAfter: 1,
          }),
          { headers: { "content-type": "application/json" } },
        );
      },
    });
    const r = await client.poll(
      { status: "pending", pollUrl: "https://oakridge-rentals.example/axe/poll/t", retryAfter: 1 },
      { maxWaitMs: 50 },
    );
    expect(isPending(r)).toBe(true);
    expect(polls).toBe(1);
  });

  it("treats tokens as opaque strings [P-TOK-1]", async () => {
    const { axe } = apartmentsAXE();
    const sent: string[] = [];
    const client = new AXEClient(manifestOf(axe), {
      fetch: async (_u, init) => {
        sent.push(String(init?.body));
        return new Response(
          JSON.stringify({
            status: "error",
            error: { code: "not_found", message: "x", retryable: false },
          }),
          { status: 404, headers: { "content-type": "application/json" } },
        );
      },
    });
    const weird = "not.even.base64!!";
    const r = await client.continue(weird, "contact.email", { email: "a@b.co" });
    expect(isError(r)).toBe(true);
    expect(JSON.parse(sent[0]!)).toMatchObject({ continuationToken: weird });
    await client.resume(weird);
    expect(JSON.parse(sent[1]!)).toMatchObject({ resumeToken: weird });
  });

  it("sends User-Agent and context.agent [P-AGENT-1]", async () => {
    const { axe } = apartmentsAXE();
    let headers: Headers | undefined;
    let body: Record<string, unknown> | undefined;
    const client = new AXEClient(manifestOf(axe), {
      agent: {
        name: "AcmeAgent",
        version: "2.1",
        vendor: "Acme",
        contact: "https://acme.example/agent",
      },
      locale: "en-US",
      timezone: "America/Los_Angeles",
      sessionId: "s_1",
      fetch: async (_u, init) => {
        headers = new Headers(init?.headers);
        body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({ status: "ok", output: { units: [], nextCursor: null } }),
          { headers: { "content-type": "application/json" } },
        );
      },
    });
    await client.invoke("units.search", { location: "x" });
    expect(headers!.get("user-agent")).toBe("AcmeAgent/2.1 (+https://acme.example/agent; axe/0.1)");
    expect(headers!.get("axe-protocol")).toBe("axe/0.1");
    expect(body!["context"]).toEqual({
      agent: {
        name: "AcmeAgent",
        version: "2.1",
        vendor: "Acme",
        contact: "https://acme.example/agent",
      },
      locale: "en-US",
      timezone: "America/Los_Angeles",
      sessionId: "s_1",
    });
  });
});

describe("renderer guarantees", () => {
  const def = () => apartmentsAXE().axe.describe().actions[0]!;

  it("toMarkdown and toHTML always include the disclaimer [P-DISP-4]", () => {
    const p = present(def(), { status: "ok", output: { units: UNITS, nextCursor: null } });
    expect(toMarkdown(p)).toContain("Pricing and availability change frequently");
    expect(toHTML(p)).toContain("Pricing and availability change frequently");
    const empty = present(def(), { status: "ok", output: { units: [], nextCursor: null } });
    expect(toMarkdown(empty)).toContain("Pricing and availability change frequently");
    expect(toHTML(empty)).toContain("Pricing and availability change frequently");
  });

  it("toHTML escapes everything [P-DISP-5]", () => {
    const nasty = {
      ...UNITS[0]!,
      name: `<img src=x onerror=alert(1)>`,
      address: `"><script>x()</script>`,
      petPolicy: "<b>none</b>",
      badges: [`<svg onload=alert(1)>`],
    };
    const html = toHTML(
      present(
        def(),
        { status: "ok", output: { units: [nasty], nextCursor: null } },
        { name: `<script>brand</script>`, accentColor: "red; background:url(javascript:1)" },
      ),
    );
    expect(html).not.toMatch(/<img src=x/);
    expect(html).not.toContain("<script>x()");
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("<script>brand");
    expect(html).toContain("--axe-accent:#1f3a5f");
    expect((html.match(/<script>/g) ?? []).length).toBe(1);
  });

  it("toHTML ignores unsafe URLs [P-DISP-6]", () => {
    const unsafe = {
      ...UNITS[0]!,
      humanUrl: "ftp://files.example/x",
      photos: ["http://not-local.example/a.jpg", "javascript:void(0)"],
    };
    const html = toHTML(
      present(
        def(),
        { status: "ok", output: { units: [unsafe], nextCursor: null } },
        { logoUrl: "http://insecure.example/logo.png" },
      ),
    );
    expect(html).not.toContain("ftp://");
    expect(html).not.toContain("not-local.example");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("insecure.example");
    expect(html).not.toContain("<img");
  });
});
