// The relay as its own process, driven over stdio by the MCP SDK's client, as Claude Code runs
// `claude mcp add surface -- npx @summationai/axe@latest relay --dev --stdio`. The page (jsdom) connects to the
// child's WebSocket port, which the child reports on stderr.
import { afterEach, describe, expect, it } from "vitest";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mintRelayToken } from "../src/token";
import { APP_ORIGIN, SECRET, noJsdom, openPage, registerPlan, wrap } from "./helpers";
import type { Agent, Page } from "./helpers";

const cleanup: (() => unknown)[] = [];
afterEach(async () => {
  while (cleanup.length) await Promise.resolve(cleanup.pop()!()).catch(() => undefined);
});

const BIN = join(__dirname, "../src/bin.ts");

/** Start `axe relay` as a child process speaking MCP on stdio; resolve with the agent and the tab URL. */
async function spawnRelay(
  args: string[],
  env: Record<string, string> = {},
): Promise<{ agent: Agent; tabUrl: string; httpUrl: string; stderr: string[] }> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", BIN, ...args],
    cwd: join(__dirname, ".."),
    env: { ...(process.env as Record<string, string>), ...env },
    stderr: "pipe",
  });
  const stderr: string[] = [];
  const listening = new Promise<string>((resolve, reject) => {
    let buf = "";
    transport.stderr!.on("data", (chunk: Buffer) => {
      buf += chunk.toString();
      stderr.push(chunk.toString());
      const m = /listening for tabs on (ws:\/\/\S+)/.exec(buf);
      if (m) resolve(m[1]!);
    });
    setTimeout(() => reject(new Error(`the relay did not start: ${buf}`)), 20_000).unref();
  });
  const client = new Client({ name: "stdio-test-agent", version: "0" });
  await client.connect(transport);
  cleanup.push(() => client.close());
  const tabUrl = await listening;
  const agent = wrap(client, () => client.close());
  return { agent, tabUrl, httpUrl: tabUrl.replace(/^ws/, "http").replace(/\/tab$/, ""), stderr };
}

async function page(): Promise<Page> {
  const p = await openPage();
  cleanup.push(() => p.close());
  registerPlan(p);
  return p;
}

describe.skipIf(noJsdom)("axe relay over stdio", () => {
  it("--dev --stdio: the page connects with a development token, the agent pairs with the code the tab shows, then acts", async () => {
    const { agent, tabUrl, httpUrl, stderr } = await spawnRelay([
      "--dev",
      "--stdio",
      "--port",
      "0",
    ]);
    expect(stderr.join("")).toContain("connectRelay(surface");
    const p = await page();
    p.connect({ url: tabUrl, getToken: p.api.devToken(httpUrl) });
    const shown = await p.status((s) => s.state === "pairing");
    const paired = await agent.call("relay_pair", { code: shown.pairingCode! });
    expect(paired.result.status, paired.text).toBe("ok");
    const v = await agent.call("surface_observe");
    expect(v.result.status, v.text).toBe("ok");
    const rev = (v.result.output as { rev: number }).rev;
    const done = await agent.call("surface_set-field", {
      entryId: "plan:name",
      text: "From stdio",
      expectedRev: rev,
    });
    expect(done.result.status, done.text).toBe("ok");
    expect(p.calls).toEqual(["set-name:From stdio:dev (agent via relay)"]);
  });

  it("--stdio for a named principal: tabs sign in with tokens signed by AXE_RELAY_SECRET; another principal's tab is out of reach", async () => {
    const { agent, tabUrl } = await spawnRelay(
      [
        "--stdio",
        "--port",
        "0",
        "--principal",
        "alice",
        "--tenant",
        "acme",
        "--origin",
        APP_ORIGIN,
      ],
      { AXE_RELAY_SECRET: SECRET },
    );
    expect((await agent.client.listTools()).tools.map((t) => t.name)).not.toContain("relay_pair");
    const mine = await page();
    mine.connect({
      url: tabUrl,
      getToken: () => mintRelayToken({ principal: "alice", tenant: "acme" }, SECRET),
    });
    await mine.status((s) => s.state === "connected");
    const theirs = await page();
    theirs.connect({
      url: tabUrl,
      getToken: () => mintRelayToken({ principal: "bob", tenant: "acme" }, SECRET),
    });
    await theirs.status((s) => s.state === "connected");
    const tabs = (await agent.call("relay_tabs")).result.output!["tabs"] as unknown[];
    expect(tabs).toHaveLength(1);
    const v = await agent.call("surface_observe");
    const rev = (v.result.output as { rev: number }).rev;
    const done = await agent.call("surface_run-control", {
      entryId: "plan:submit",
      expectedRev: rev,
    });
    expect(done.result.status, done.text).toBe("ok");
    expect(mine.calls).toEqual(["submit:alice (agent via relay)"]);
    expect(theirs.calls).toEqual([]);
  });
});
