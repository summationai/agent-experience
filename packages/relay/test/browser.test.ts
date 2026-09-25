// A real browser: Chromium (Playwright) loads a page from a loopback server, runs a Surface and
// connectRelay over the browser's own WebSocket, and an MCP client drives it through the relay.
// The person presses the indicator's Stop in the real DOM. Skipped with a message when no
// Chromium build is installed (`pnpm --filter @axe/relay exec playwright install chromium`).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { mintRelayToken } from "../src/token";
import { SECRET, httpAgent, pageBundle, startRelay, until } from "./helpers";
import type { Agent, Running } from "./helpers";
import type { Browser } from "playwright";

let browser: Browser | null = null;
let skipReason = "";
beforeAll(async () => {
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch();
  } catch (e) {
    skipReason = e instanceof Error ? e.message.split("\n")[0]! : String(e);
    console.warn(`[relay browser test] skipped: no Chromium for Playwright (${skipReason})`);
  }
});
afterAll(async () => {
  await browser?.close();
});

const PAGE = (bundle: string, tabUrl: string, token: string) => `<!doctype html>
<html><head><title>Relay in Chromium</title></head>
<body><p id="count">0</p>
<script>${bundle}</script>
<script>
  const { createSurface, connectRelay } = window.relayPage;
  const surface = createSurface();
  let count = 0;
  surface.register({
    id: "counter:add", kind: "action", role: "button", name: "Add one",
    effect: { mutates: "counter", reversible: true, risk: "low" },
    handler: () => { count += 1; document.getElementById("count").textContent = String(count); surface.bump(); },
  });
  window.states = [];
  window.relay = connectRelay(surface, { url: ${JSON.stringify(tabUrl)}, token: ${JSON.stringify(token)},
    onStatus: (s) => window.states.push(s.state) });
</script></body></html>`;

describe("in Chromium", () => {
  it("an agent acts in a real page, and the person's Stop in the real DOM refuses every later act", async (ctx) => {
    if (!browser) return ctx.skip();
    const r: Running = await startRelay({ origins: ["http://localhost:*"] });
    const token = await mintRelayToken({ principal: "alice", tenant: "acme" }, SECRET);
    const html = PAGE(await pageBundle(), r.address.tabUrl, token);
    const server = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    let agent: Agent | undefined;
    const tab = await browser.newPage();
    try {
      await tab.goto(`http://localhost:${port}/board`);
      await tab.waitForFunction(() =>
        (window as unknown as { states: string[] }).states.includes("connected"),
      );
      await tab.getByText("An agent can act in this tab").waitFor();
      agent = await httpAgent(r.address.mcpUrl, "agent-alice");
      await until(() => r.relay.tabs({ principal: "alice", tenant: "acme" })[0]);
      const v = await agent.call("surface_observe");
      const rev = (v.result.output as { rev: number }).rev;
      const done = await agent.call("surface_run-control", {
        entryId: "counter:add",
        expectedRev: rev,
      });
      expect(done.result.status, done.text).toBe("ok");
      expect(await tab.locator("#count").textContent()).toBe("1");
      // Playwright's CSS locators pierce the indicator's open shadow root.
      await tab.getByText("An agent is acting in this tab").waitFor();
      await tab.locator('[data-action="stop"]').click();
      await tab.waitForFunction(() =>
        (window as unknown as { states: string[] }).states.includes("stopped"),
      );
      expect(await tab.locator("[data-axe-relay-indicator]").count()).toBe(0);
      await until(
        () => r.relay.tabs({ principal: "alice", tenant: "acme" })[0]?.state === "stopped",
      );
      const refused = await agent.call("surface_run-control", {
        entryId: "counter:add",
        expectedRev: rev + 1,
      });
      expect(refused.result.error!.code).toBe("forbidden");
      expect(await tab.locator("#count").textContent()).toBe("1");
    } finally {
      await tab.close();
      await agent?.close();
      await r.relay.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
