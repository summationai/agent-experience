import { describe, expect, it } from "vitest";
import { createTestClient, invokeAction, samplePayload } from "../src/helpers";
import { apartmentsAXE } from "../../core/test/fixtures/apartments";
import { isOk } from "@axe/client";

describe("test helpers", () => {
  it("createTestClient runs in-process with an injected identity", async () => {
    const { axe, state } = apartmentsAXE();
    const client = createTestClient(axe, { identity: { onBehalfOf: "dana" } });
    const r = await client.invoke<{ tourId: string }>("tours.book", {
      unitId: "u_204",
      at: "2026-10-02T17:00:00Z",
    });
    expect(isOk(r)).toBe(true);
    expect(state.tours).toHaveLength(1);
    const anon = createTestClient(axe);
    expect(
      (await anon.invoke("tours.book", { unitId: "u_204", at: "2026-10-02T17:00:00Z" })).status,
    ).toBe("needs_human");
  });

  it("invokeAction returns the raw envelope", async () => {
    const { axe } = apartmentsAXE();
    const r = await invokeAction<{ units: unknown[] }>(axe, "units.search", {
      location: "Bellevue, WA",
    });
    expect(r.status).toBe("ok");
    const ni = await invokeAction(
      axe,
      "applications.submit",
      { unitId: "u_204" },
      { identity: { onBehalfOf: "dana" } },
    );
    expect(ni.status).toBe("needs_input");
    expect(samplePayload("payment.ach-debit")).toBeDefined();
    expect(samplePayload("x-nope.thing")).toBeUndefined();
  });
});
