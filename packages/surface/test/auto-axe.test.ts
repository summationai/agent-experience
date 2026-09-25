// @vitest-environment jsdom
/**
 * `autoActions` serves a derived surface as a fixed set of generic tools ([S-AUTO-11]): the tool
 * list is the same size whether the page renders five controls or three hundred, acts run the
 * page's own events, and the approval gate reaches the agent as a refusal with a handoff.
 */
import { afterEach, describe, expect, it } from "vitest";
import { createAXE } from "@axe/core";
import type { ErrorResult, OkResult } from "@axe/core/types";
import { autoSurface } from "../src/auto";
import type { AutoSurfaceHandle, SurfaceConfig } from "../src/auto";
import { autoActions } from "../src/axe";

const BASE = "http://localhost:5173";
let handles: AutoSurfaceHandle[] = [];
afterEach(() => {
  for (const h of handles) h.stop();
  handles = [];
  document.body.innerHTML = "";
});

function serve(html: string, config: SurfaceConfig = {}) {
  document.body.innerHTML = html;
  const handle = autoSurface({
    config,
    observe: { debounceMs: 0, settle: { quietMs: 5, timeoutMs: 50 } },
  });
  handles.push(handle);
  const axe = createAXE({
    name: "Shop",
    description: "A shop's back office, derived from its pages.",
    baseUrl: BASE,
    auth: { modes: ["none"] },
    revision: handle.surface.currentRev,
  });
  const bridge = autoActions(handle, { auth: "none" });
  axe.addProvider(bridge);
  const post = async (name: string, input: unknown, expectedRev?: number) =>
    (await (
      await axe.handle(
        new Request(`${BASE}/axe/actions/${name}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            input,
            idempotencyKey: crypto.randomUUID(),
            ...(expectedRev !== undefined ? { expectedRev } : {}),
          }),
        }),
      )
    ).json()) as OkResult<Record<string, unknown>> | ErrorResult;
  return { handle, bridge, post, axe };
}

const page = (n: number) =>
  `<main><h1>Orders</h1><table aria-label="Orders"><tbody>${Array.from({ length: n }, (_, i) => `<tr><td>Order ${i}</td><td><button>Refund</button><button>View</button></td></tr>`).join("")}</tbody></table><label>Search <input></label></main>`;

describe("autoActions [S-AUTO-11]", () => {
  it("publishes the same generic tools whatever the page holds", () => {
    const small = serve(page(2))
      .bridge.actions()
      .map((a) => a.name);
    const large = serve(page(150))
      .bridge.actions()
      .map((a) => a.name);
    expect(small).toEqual(large);
    expect(small).toEqual([
      "surface.observe",
      "surface.ledger",
      "surface.navigate",
      "surface.set-field",
      "surface.run-control",
      "surface.load-more",
    ]);
  });

  it("acts through the page and refuses a gated control with the approval handoff", async () => {
    const { handle, post } = serve(page(2));
    let viewed = 0;
    document.querySelectorAll("button")[1]!.addEventListener("click", () => viewed++);
    const view = handle.surface
      .observe()
      .entries.find((r) => r.name === "View" && r.object === "Order 0")!;
    const ok = await post("surface.navigate", { entryId: view.id }, handle.surface.currentRev());
    // "View" is a view-only control, not a navigation: it acts through run-control.
    expect(ok.status).toBe("error");
    const ran = await post(
      "surface.run-control",
      { entryId: view.id },
      handle.surface.currentRev(),
    );
    expect(ran.status).toBe("ok");
    expect(viewed).toBe(1);
    const refund = handle.surface
      .observe()
      .entries.find((r) => r.name === "Refund" && r.object === "Order 1")!;
    const refused = (await post(
      "surface.run-control",
      { entryId: refund.id },
      handle.surface.currentRev(),
    )) as ErrorResult;
    expect(refused.status).toBe("error");
    expect(refused.error.code).toBe("unavailable");
    expect(JSON.stringify(refused.error.details)).toContain("approval_required");
  });

  it("a configured group becomes its own domain action", () => {
    const { bridge, handle } = serve(page(2), {
      groups: {
        refunds: {
          title: "Refund an order",
          description: "Refunds one order to the card it was paid with.",
          risk: "high",
        },
      },
      rules: [{ match: { name: "Refund" }, group: "refunds" }],
    });
    expect(bridge.actions().map((a) => a.name)).toContain("surface.refunds");
    const refund = handle.surface.observe().entries.find((r) => r.name === "Refund")!;
    expect(bridge.actionFor(refund.id)).toBe("surface.refunds");
  });
});
