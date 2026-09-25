// Browser-level tests: real pages in Chromium against `next start`, an agent calling the AXE
// endpoint over HTTP with its bearer token, and an in-page agent using window.__surface.
import { expect, test } from "@playwright/test";
import type { APIRequestContext, Browser, Page } from "@playwright/test";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

test.beforeEach(async ({ request }) => {
  const r = await request.post("/api/test/reset", { data: {} });
  expect(r.ok()).toBe(true);
});

async function signIn(browser: Browser, user: string, tenant: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page
    .getByRole("button", {
      name: new RegExp(`Sign in as ${user}, ${tenant === "acme" ? "Acme" : "Globex"}`),
    })
    .click();
  await page.waitForURL("**/plan");
  await expect(page.getByTestId("who")).toHaveText(user);
  return page;
}

/** An agent outside the browser, calling the AXE endpoint with the token the site issued. */
function agent(request: APIRequestContext, token: string) {
  const headers = { authorization: `Bearer ${token}`, "user-agent": "E2EAgent/1.0" };
  let n = 0;
  return {
    state: async () => (await (await request.get("/axe/state", { headers })).json()) as Json,
    invoke: async (
      name: string,
      input: Json,
      expectedRev?: number,
      key = `e2e-${Date.now()}-${n++}`,
    ) =>
      (await (
        await request.post(`/axe/actions/${name}`, {
          headers,
          data: {
            input,
            idempotencyKey: key,
            ...(expectedRev !== undefined ? { expectedRev } : {}),
          },
        })
      ).json()) as Json,
    resume: async (resumeToken: string) =>
      (await (
        await request.post("/axe/resume", { headers, data: { resumeToken } })
      ).json()) as Json,
  };
}

const observe = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __surface: { observe(): Json } }).__surface.observe(),
  );

test("sign in, then an agent in the page drafts a value and saves it through the page's own Save", async ({
  browser,
}) => {
  const page = await signIn(browser, "alice", "acme");
  const obs = await observe(page);
  const ids = (obs.entries as Json[]).map((e) => e.id);
  expect(ids).toEqual(
    expect.arrayContaining(["save", "dialog:approvals", "scroll:2027-03", "draft:Widgets:2027-01"]),
  );
  expect(obs.rev).toBe(1);
  // Browser-local: typing changes the unsaved draft only.
  const typed = await page.evaluate(
    (rev) =>
      (window as unknown as { __surface: { act(r: Json): Promise<Json> } }).__surface.act({
        op: "TYPE_TEXT",
        target: "draft:Widgets:2027-01",
        text: "4321",
        expectedRev: rev,
        actor: "in-page agent",
      }),
    obs.rev,
  );
  expect(typed.status).toBe("ok");
  await expect(page.getByLabel("Widgets, January 2027")).toHaveValue("4321");
  await expect(page.getByTestId("rev")).toHaveText("Revision 1");
  // The Save control is the page's button: it posts with this person's session.
  const saved = await page.evaluate(
    (rev) =>
      (window as unknown as { __surface: { act(r: Json): Promise<Json> } }).__surface.act({
        op: "CLICK",
        target: "save",
        expectedRev: rev,
        actor: "in-page agent",
      }),
    obs.rev,
  );
  expect(saved.status).toBe("ok");
  await expect(page.getByTestId("rev")).toHaveText("Revision 2");
  await expect(page.getByTestId("history")).toContainText("alice Changed 1 value");
  // The page's controls are not on the server: the manifest has only the plan actions.
  const manifest = (await (await page.request.get("/.well-known/axe.json")).json()) as Json;
  expect((manifest.actions as Json[]).map((a) => a.name)).toEqual([
    "plan.read",
    "plan.set-value",
    "plan.submit",
    "plan.approve",
    "plan.history",
  ]);
});

test("two people in two tabs edit the same cell: one save succeeds, the other is refused and keeps its draft", async ({
  browser,
}) => {
  const alice = await signIn(browser, "alice", "acme");
  const bob = await signIn(browser, "bob", "acme");
  await alice.getByLabel("Gaskets, March 2027").fill("1500");
  await bob.getByLabel("Gaskets, March 2027").fill("900");
  await alice.getByRole("button", { name: "Save 1 unsaved change" }).click();
  await expect(alice.getByTestId("message")).toHaveText("Saved 1 change.");
  // bob's tab refreshes to revision 2 by polling, but his draft was typed at revision 1.
  await expect(bob.getByTestId("rev")).toHaveText("Revision 2");
  await bob.getByRole("button", { name: "Save 1 unsaved change" }).click();
  await expect(bob.getByTestId("message")).toContainText("The plan changed since you loaded it");
  await expect(bob.getByLabel("Gaskets, March 2027")).toHaveValue("900");
  await expect(alice.getByLabel("Gaskets, March 2027")).toHaveValue("1500");
  // bob chooses to keep his value on the new plan, and saves it deliberately.
  await bob.getByRole("button", { name: "Keep my drafts on the current plan" }).click();
  await bob.getByRole("button", { name: "Save 1 unsaved change" }).click();
  await expect(bob.getByTestId("message")).toHaveText("Saved 1 change.");
  await expect(alice.getByLabel("Gaskets, March 2027")).toHaveValue("900");
});

test("a person changes the plan between the agent's observe and act: the agent is refused, re-reads, and continues", async ({
  browser,
  request,
}) => {
  const alice = await signIn(browser, "alice", "acme");
  const a = agent(request, "demo-agent-bob-acme");
  const seen = await a.state();
  await alice.getByLabel("Brackets, June 2027").fill("42");
  await alice.getByRole("button", { name: "Save 1 unsaved change" }).click();
  await expect(alice.getByTestId("rev")).toHaveText(`Revision ${seen.rev + 1}`);
  const stale = await a.invoke(
    "plan.set-value",
    { item: "Brackets", month: "2027-06", value: 7 },
    seen.rev,
  );
  expect(stale.error.code).toBe("conflict");
  const fresh = await a.invoke(
    "plan.set-value",
    { item: "Brackets", month: "2027-06", value: 7 },
    stale.rev,
  );
  expect(fresh.status).toBe("ok");
  await expect(alice.getByLabel("Brackets, June 2027")).toHaveValue("7");
  await expect(alice.getByTestId("history")).toContainText("agent for bob Changed 1 value");
});

test("navigation: the page's controls leave the surface on a route change; the server's plan is untouched", async ({
  browser,
}) => {
  const page = await signIn(browser, "alice", "acme");
  expect(((await observe(page)).entries as Json[]).length).toBeGreaterThan(20);
  await page.getByRole("link", { name: "History" }).click();
  await page.waitForURL("**/history");
  await expect(page.getByTestId("history-rev")).toHaveText("Plan revision 1");
  expect((await observe(page)).entries).toEqual([]);
  await page.getByRole("link", { name: "Back to the plan" }).click();
  await page.waitForURL("**/plan");
  await expect
    .poll(async () => ((await observe(page)).entries as Json[]).length)
    .toBeGreaterThan(20);
});

test("approval: the agent asks, the approver approves on the app's page, the agent resumes and gets a receipt", async ({
  browser,
  request,
}) => {
  const a = agent(request, "demo-agent-bob-acme");
  const rev = (await a.state()).rev;
  const sub = await a.invoke("plan.submit", { planId: "acme-fy27-h1" }, rev);
  const ask = await a.invoke("plan.approve", { planId: "acme-fy27-h1" }, sub.rev);
  expect(ask.status).toBe("needs_human");
  const early = await a.resume(ask.handoff.resumeToken);
  expect(early.error.details.handoffStatus).toBe("open");
  // bob, a planner, sees the request but cannot approve it.
  const bob = await signIn(browser, "bob", "acme");
  await bob.goto(new URL(ask.handoff.url).pathname);
  await expect(bob.getByText("Only an approver can approve this request.")).toBeVisible();
  // alice approves with her own session.
  const alice = await signIn(browser, "alice", "acme");
  await alice.goto(new URL(ask.handoff.url).pathname);
  await expect(alice.getByTestId("asked-by")).toContainText("An agent acting for bob");
  await expect(alice.getByTestId("asked-by")).toContainText("E2EAgent/1.0");
  await expect(alice.getByTestId("approval-input")).toHaveText('{"planId":"acme-fy27-h1"}');
  await expect(alice.getByTestId("bound-rev")).toContainText(`Plan revision ${sub.rev}`);
  await alice.getByRole("button", { name: "Approve this request" }).click();
  await expect(alice.getByTestId("decision-message")).toHaveText(
    "Approved. The agent can now continue.",
  );
  const done = await a.resume(ask.handoff.resumeToken);
  expect(done.status).toBe("ok");
  expect(done.output.receipt).toMatchObject({
    approvedBy: "alice",
    requestedFor: "bob",
    revBefore: sub.rev,
    revAfter: sub.rev + 1,
    changes: [{ field: "status", from: "submitted", to: "locked" }],
  });
  await alice.goto("/plan");
  await expect(alice.getByTestId("status")).toHaveText("Status: locked");
  const history = alice.getByTestId("history");
  await expect(history).toContainText("agent for bob Locked for bob, approved by alice");
  await expect(history).toContainText("alice Approved the agent's request to lock the plan");
  await expect(history).toContainText("agent for bob Asked for approval to lock the plan");
});

test("takeover: freezing the plan from the page cancels the agent's request and pauses it", async ({
  browser,
  request,
}) => {
  const a = agent(request, "demo-agent-bob-acme");
  const rev = (await a.state()).rev;
  const sub = await a.invoke("plan.submit", { planId: "acme-fy27-h1" }, rev);
  const ask = await a.invoke("plan.approve", { planId: "acme-fy27-h1" }, sub.rev);
  const alice = await signIn(browser, "alice", "acme");
  await alice.getByRole("button", { name: /^Freeze/ }).click();
  await expect(alice.getByTestId("frozen")).toHaveText("Frozen by alice: agents paused");
  const r = await a.resume(ask.handoff.resumeToken);
  expect(r.error.details.handoffStatus).toBe("cancelled");
  const st = await a.state();
  expect(st.actions["plan.approve"].reason).toBe(
    "alice froze the plan; agents cannot change it until a person unfreezes it",
  );
  await alice.goto(new URL(ask.handoff.url).pathname);
  await expect(alice.getByTestId("approval-status")).toHaveText("Status: cancelled");
});

test("a cross-site request with the person's cookie is refused on the app's endpoints and on AXE", async ({
  browser,
}) => {
  const page = await signIn(browser, "alice", "acme");
  const evil = { origin: "https://evil.example", "content-type": "application/json" };
  const r1 = await page.request.post("/api/plan/submit", {
    headers: evil,
    data: { expectedRev: 1 },
  });
  expect(r1.status()).toBe(403);
  const r2 = await page.request.post("/axe/actions/plan.submit", {
    headers: evil,
    data: { input: { planId: "acme-fy27-h1" }, idempotencyKey: "csrf", expectedRev: 1 },
  });
  expect(r2.status()).toBe(403);
  expect(((await r2.json()) as Json).error.details.reason).toBe("cross_origin_refused");
  await page.reload();
  await expect(page.getByTestId("status")).toHaveText("Status: draft");
});
