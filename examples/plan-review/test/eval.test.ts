// The evaluation harness's own pieces (review item 17), without a browser or a server: the
// variant switch, the thin v3 tools, the outcome check, the statistics, and the model runner's
// refusal. The harness itself runs with `pnpm eval`.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { handleBasicTool } from "../lib/basic-tools";
import { agentTokenFor, store } from "../lib/store";
import { axeEnabled, basicToolsEnabled, pageView, variant } from "../lib/variant";
import { integrationEffort } from "../eval/integration";
import { wilson } from "../eval/meter";
import { missingEnv, planFor } from "../eval/model/run";
import { SCENARIOS, checkOutcome } from "../eval/scenarios";

const saved = { ...process.env };
beforeEach(() => store.reset());
afterEach(() => {
  process.env = { ...saved };
});

const tool = (name: string, args: unknown = {}, token = agentTokenFor("bob", "acme")) =>
  handleBasicTool(
    new Request(`http://localhost/tools/${name}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(args),
    }),
    name,
  ).then(async (r) => ({ status: r.status, body: (await r.json()) as Record<string, any> })); // eslint-disable-line @typescript-eslint/no-explicit-any

describe("the variant switch", () => {
  it("unset means everything as shipped; v1 alone strips the markup; each tool set answers in its own variant", () => {
    delete process.env["PLAN_REVIEW_VARIANT"];
    expect(variant()).toBe("all");
    expect(pageView().markup).toBe("semantic");
    expect(axeEnabled() && basicToolsEnabled()).toBe(true);
    process.env["PLAN_REVIEW_VARIANT"] = "v1";
    expect(pageView().markup).toBe("generic");
    expect(axeEnabled() || basicToolsEnabled()).toBe(false);
    process.env["PLAN_REVIEW_VARIANT"] = "v2";
    expect(pageView().markup).toBe("semantic");
    expect(axeEnabled() || basicToolsEnabled()).toBe(false);
    process.env["PLAN_REVIEW_VARIANT"] = "v3";
    expect([axeEnabled(), basicToolsEnabled()]).toEqual([false, true]);
    process.env["PLAN_REVIEW_VARIANT"] = "v4";
    expect([axeEnabled(), basicToolsEnabled()]).toEqual([true, false]);
    process.env["PLAN_REVIEW_UI_CHANGE"] = "1";
    expect(pageView().uiChange).toBe(true);
  });
});

describe("v3 basic tools", () => {
  it("call the same domain rules but write blind: a person's change in between is overwritten", async () => {
    expect((await tool("get_plan", {}, "not-a-token")).status).toBe(401);
    const read = await tool("get_plan");
    expect(read.body.plan.values["Gaskets|2027-03"]).toBe(1320);
    expect(read.body.plan).not.toHaveProperty("rev");
    // A person saves the same cell after the agent read it.
    store.write("acme", store.rev("acme"), { user: "alice", via: "ui" }, "plan.edit", (p) => {
      p.values["Gaskets|2027-03"] = 1500;
      return { changes: [], summary: "" };
    });
    const w = await tool("set_value", { item: "Gaskets", month: "2027-03", value: 1420 });
    expect(w.status).toBe(200);
    expect(store.plan("acme")!.values["Gaskets|2027-03"]).toBe(1420);
    // The domain's own refusals still apply: a planner cannot lock, and the reason comes back.
    await tool("submit_plan");
    const lock = await tool("lock_plan");
    expect(lock.status).toBe(409);
    expect(lock.body.error).toBe("bob is not an approver for this plan");
    const edit = await tool("set_value", { item: "Widgets", month: "2027-01", value: 1 });
    expect(edit.body.error).toBe(
      "The plan is submitted for approval; an approver must reopen it before values can change",
    );
  });
});

describe("outcome checks", () => {
  it("score the app's state and history: a lost update is an incorrect mutation even if the agent reports success", () => {
    const scenario = SCENARIOS.find((s) => s.id === "stale-observation")!;
    const seed = store.plan("acme")!.values;
    const plan = { ...store.plan("acme")!, values: { ...seed, "Gaskets|2027-03": 1420 } };
    const history = [
      {
        seq: 1,
        at: "",
        tenant: "acme",
        actor: "alice",
        via: "ui" as const,
        event: "plan.edit",
        summary: "",
        changes: [{ field: "Gaskets, March 2027", from: 1320, to: 1500 }],
        revBefore: 1,
        revAfter: 2,
      },
      {
        seq: 2,
        at: "",
        tenant: "acme",
        actor: "agent for bob",
        via: "axe" as const,
        event: "plan.edit",
        summary: "",
        changes: [{ field: "Gaskets, March 2027", from: 1500, to: 1420 }],
        revBefore: 2,
        revAfter: 3,
      },
    ];
    const out = checkOutcome(scenario, seed, { plan, history }, { reported: null });
    expect(out.success).toBe(false);
    expect(out.incorrectMutations).toBe(1);
    expect(out.mismatches).toEqual(["Gaskets|2027-03: expected 1600, found 1420"]);
  });

  it("the unavailable control counts only the app's own reason", () => {
    const scenario = SCENARIOS.find((s) => s.id === "unavailable")!;
    const plan = { ...store.plan("acme")!, status: "submitted" as const };
    const seed = plan.values;
    expect(
      checkOutcome(scenario, seed, { plan, history: [] }, { reported: "read only" }).success,
    ).toBe(false);
    expect(
      checkOutcome(scenario, seed, { plan, history: [] }, { reported: scenario.expectedReason! })
        .success,
    ).toBe(true);
  });
});

describe("statistics and effort", () => {
  it("Wilson intervals for five of five and zero of five", () => {
    const all = wilson(5, 5);
    expect(all.high).toBe(1);
    expect(all.low).toBeCloseTo(0.566, 3);
    const none = wilson(0, 5);
    expect(none.low).toBe(0);
    expect(none.high).toBeCloseTo(0.434, 3);
  });

  it("integration lines are counted from the source for v2, v3, and v4", () => {
    const counts = Object.fromEntries(integrationEffort().map((c) => [c.variant, c.lines]));
    expect(counts["v1"]).toBe(0);
    for (const v of ["v2", "v3", "v4"]) expect(counts[v]).toBeGreaterThan(0);
  });
});

describe("the model-driven runner", () => {
  it("refuses without a provider, a named credential, and an explicit cost acknowledgment", () => {
    expect(missingEnv({})).toEqual([
      "AXE_EVAL_MODEL_PROVIDER",
      "AXE_EVAL_MODEL_CREDENTIAL_ENV",
      "AXE_EVAL_ACCEPT_COST",
    ]);
    expect(
      missingEnv({
        AXE_EVAL_MODEL_PROVIDER: "x",
        AXE_EVAL_MODEL_CREDENTIAL_ENV: "X_KEY",
        AXE_EVAL_ACCEPT_COST: "sure",
      }),
    ).toEqual(["AXE_EVAL_ACCEPT_COST (must be yes)", "X_KEY (named credential is empty)"]);
    expect(
      missingEnv({
        AXE_EVAL_MODEL_PROVIDER: "x",
        AXE_EVAL_MODEL_CREDENTIAL_ENV: "X_KEY",
        X_KEY: "k",
        AXE_EVAL_ACCEPT_COST: "yes",
      }),
    ).toEqual([]);
    const plan = planFor("x", 5);
    expect(plan.scenarios.map((s) => s.id)).toEqual(SCENARIOS.map((s) => s.id));
  });
});
