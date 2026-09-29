import { describe, expect, it } from "vitest";
import { AXEClient, AXEClientError, isError, isOk } from "../src/index";
import type { Fulfiller } from "../src/index";
import { present, toMarkdown, toHTML, stateToMarkdown } from "../src/present";
import { liveAXE } from "../../core/test/fixtures/live";
import { apartmentsAXE } from "../../core/test/fixtures/apartments";

function fetchFor(axe: { handle(req: Request): Promise<Response> }) {
  const bodies: Record<string, unknown>[] = [];
  const f = async (input: string | URL, init?: RequestInit): Promise<Response> => {
    if (init?.body) bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
    return axe.handle(new Request(input, init));
  };
  return { fetch: f, bodies };
}

describe("@summationai/axe-client live state", () => {
  it("state() fetches /axe/state for the caller; live() reads the manifest", async () => {
    const { axe } = liveAXE();
    const client = await AXEClient.discover("https://ember-yoga.example", {
      fetch: fetchFor(axe).fetch,
      auth: "user:sam",
    });
    expect(client.live()?.url).toBe("https://ember-yoga.example/axe/state");
    expect(client.live()?.rev).toBe(41);
    const state = await client.state();
    expect(state.rev).toBe(41);
    const book = state.actions["classes.book"]!;
    expect(book.available).toBe(false);
    if (!book.available) expect(book.reason).toBe("no credits left on the member's pass");
    const md = stateToMarkdown(state, client.manifest());
    expect(md).toContain("As of revision 41.");
    expect(md).toContain("- Search classes (`classes.search`)");
    expect(md).toContain("Book a class (`classes.book`): no credits left on the member's pass");
    expect(md).toContain("would need `payment.card`");
    expect(md).toContain("a person can do it at https://ember-yoga.example/account/passes");
  });

  it("state() throws on a site without live state", async () => {
    const { axe } = apartmentsAXE();
    const client = await AXEClient.discover("https://oakridge-rentals.example", {
      fetch: fetchFor(axe).fetch,
    });
    expect(client.live()).toBeUndefined();
    await expect(client.state()).rejects.toThrow(AXEClientError);
  });

  it("invoke() passes expectedRev through; a stale one is conflict with both revisions", async () => {
    const { axe } = liveAXE();
    const { fetch, bodies } = fetchFor(axe);
    const client = await AXEClient.discover("https://ember-yoga.example", {
      fetch,
      auth: "user:dana",
    });
    const stale = await client.invoke(
      "classes.book",
      { classId: "yin-tue-1800" },
      { expectedRev: 40 },
    );
    expect(bodies.at(-1)!["expectedRev"]).toBe(40);
    expect(isError(stale) && stale.error.code).toBe("conflict");
    if (isError(stale)) expect(stale.error.details).toEqual({ expectedRev: 40, currentRev: 41 });
    expect(stale.rev).toBe(41);
    const fresh = await client.invoke<{ bookingId: string }>(
      "classes.book",
      { classId: "yin-tue-1800" },
      { expectedRev: stale.rev },
    );
    expect(isOk(fresh)).toBe(true);
    expect(fresh.rev).toBe(42);
    // Without the option, nothing is sent.
    await client.invoke("classes.search", {});
    expect("expectedRev" in bodies.at(-1)!).toBe(false);
  });

  it("run() tracks the revision through the ladder: the continuation carries the needs_input rev", async () => {
    let rev = 7;
    const { axe } = apartmentsAXE({ revision: () => rev });
    const { fetch, bodies } = fetchFor(axe);
    const fulfillers: Fulfiller[] = [
      {
        kinds: ["payment.wire-confirmation"],
        fulfill: () => ({
          referenceNumber: "W1",
          amount: 500,
          currency: "USD",
          sentAt: "2026-01-01T00:00:00Z",
        }),
      },
    ];
    const client = await AXEClient.discover("https://oakridge-rentals.example", {
      fetch,
      auth: "user:dana",
      fulfillers,
    });
    const outcome = await client.run(
      "applications.submit",
      { unitId: "u_204" },
      { expectedRev: 7 },
    );
    expect(outcome.status).toBe("ok");
    const invokeBody = bodies.find((b) => "input" in b)!;
    const continueBody = bodies.find((b) => "continuationToken" in b)!;
    expect(invokeBody["expectedRev"]).toBe(7);
    expect(continueBody["expectedRev"]).toBe(7);
    // Someone else moves the site between the needs_input and the continue: caught, not applied.
    const { axe: axe2, state } = apartmentsAXE({
      revision: () => rev,
      onResult: (ctx) => {
        if (ctx.endpoint === "action") rev = 8;
      },
    });
    const client2 = await AXEClient.discover("https://oakridge-rentals.example", {
      fetch: fetchFor(axe2).fetch,
      auth: "user:dana",
      fulfillers,
    });
    const raced = await client2.run("applications.submit", { unitId: "u_204" }, { expectedRev: 7 });
    expect(raced.status).toBe("error");
    if (raced.status === "error") expect(raced.result.error.code).toBe("conflict");
    expect([...state.applications.values()][0]!.status).toBe("draft");
  });

  it("present carries rev into toMarkdown and toHTML", async () => {
    const { axe } = liveAXE();
    const client = await AXEClient.discover("https://ember-yoga.example", {
      fetch: fetchFor(axe).fetch,
    });
    const r = await client.invoke("classes.search", {});
    const presented = present(client.action("classes.search")!, r);
    expect(presented.rev).toBe(41);
    expect(toMarkdown(presented)).toContain("_As of revision 41._");
    expect(toHTML(presented)).toContain('<p class="axe-rev">As of revision 41</p>');
    const { axe: plain } = apartmentsAXE();
    const c2 = await AXEClient.discover("https://oakridge-rentals.example", {
      fetch: fetchFor(plain).fetch,
    });
    const p2 = present(
      c2.action("units.search")!,
      await c2.invoke("units.search", { location: "Bellevue, WA" }),
    );
    expect(p2.rev).toBeUndefined();
    expect(toMarkdown(p2)).not.toContain("As of revision");
  });
});
