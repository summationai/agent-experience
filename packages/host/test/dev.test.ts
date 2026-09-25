// Development mode and the command line: loopback only, a development key, the watch page,
// `axe host login` (headless here), and `axe host --dev --stdio` as its own process driven by
// the MCP SDK's client over stdio, as Claude Code runs it.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createHost } from "../src/index";
import { runHostCli } from "../src/cli";
import { chromiumMissing, httpAgent, observe, row, startFixture, until, wrap } from "./helpers";
import type { Fixture } from "./helpers";

let missing: string | null = null;
let fixture: Fixture;
let dir: string;
beforeAll(async () => {
  missing = await chromiumMissing();
  if (missing) console.warn(`[host dev tests] browser cases skipped: no Chromium (${missing})`);
  fixture = await startFixture();
  dir = await mkdtemp(join(tmpdir(), "axe-host-"));
});
afterAll(async () => {
  await fixture?.close();
});

const cleanup: (() => unknown)[] = [];
afterEach(async () => {
  while (cleanup.length) await Promise.resolve(cleanup.pop()!()).catch(() => undefined);
});

const BIN = join(__dirname, "../src/bin.ts");

describe("development mode", () => {
  it("refuses to listen on anything but loopback, and refuses non-loopback peers and Host headers", async () => {
    const host = createHost({ appUrl: fixture.url, dev: true });
    cleanup.push(() => host.close());
    await expect(host.listen({ host: "0.0.0.0" })).rejects.toThrow(/loopback only/);
    const far = await host.handle(new Request("http://127.0.0.1/health"), {
      remoteAddress: "10.1.2.3",
    });
    expect(far.status).toBe(403);
    const rebound = await host.handle(new Request("http://evil.example/health"), {
      remoteAddress: "127.0.0.1",
    });
    expect(rebound.status).toBe(403);
    const near = await host.handle(new Request("http://127.0.0.1/health"), {
      remoteAddress: "127.0.0.1",
    });
    expect(near.status).toBe(200);
    expect(() => createHost({ appUrl: fixture.url, dev: true, agentAuth: {} as never })).toThrow(
      /exclusive/,
    );
  });

  it("/mcp needs the development key; the watch page shows the session and Stop closes it", async (ctx) => {
    if (missing) return ctx.skip();
    const host = createHost({ appUrl: fixture.url, dev: { agentKey: "axh_test_key_0123456789" } });
    cleanup.push(() => host.close());
    const address = await host.listen();
    const anonymous = await fetch(address.mcpUrl, { method: "POST", body: "{}" });
    expect(anonymous.status).toBe(401);
    await expect(httpAgent(address.mcpUrl, "wrong")).rejects.toThrow();

    const page = await fetch(address.watchUrl!);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("Stop session");
    const before = await fetch(`${address.watchUrl}/screenshot.png`);
    expect(before.status).toBe(404);
    // Watching starts nothing.
    expect(host.sessions()).toEqual([]);

    const agent = await httpAgent(address.mcpUrl, "axh_test_key_0123456789");
    cleanup.push(() => agent.close());
    const { rows } = await observe(agent);
    // No saved sign-in: the app opens signed out.
    expect(row(rows, "Display name").value).toBe("");
    expect(host.sessions()).toMatchObject([{ principal: "dev", tenant: "dev" }]);

    const shot = await fetch(`${address.watchUrl}/screenshot.png`);
    expect(shot.status).toBe(200);
    expect(shot.headers.get("content-type")).toBe("image/png");
    const foreignStop = await fetch(`${address.watchUrl}/stop`, {
      method: "POST",
      headers: { Origin: "http://evil.example" },
    });
    expect(foreignStop.status).toBe(403);
    const stop = await fetch(`${address.watchUrl}/stop`, { method: "POST" });
    expect(await stop.json()).toEqual({ closed: true, held: true });
    expect(host.sessions()).toEqual([]);
    // A wrong watch key is not found.
    const guessed = await fetch(`${address.url}/watch/0000/screenshot.png`);
    expect(guessed.status).toBe(404);
  });
});

describe("axe host (command line)", () => {
  it("without --dev it explains that production is code; --dev needs --app", async () => {
    const err: string[] = [];
    expect(await runHostCli(["--app", fixture.url], { stderr: (l) => err.push(l) })).toBe(1);
    expect(err.join("\n")).toContain("createHost({ appUrl, agentAuth, sessionFor })");
    expect(await runHostCli(["--dev"], { stderr: (l) => err.push(l) })).toBe(1);
    expect(err.join("\n")).toContain("--app <url> is required");
  });

  it("--dev prints the Claude Code and Claude Desktop configuration with absolute paths", async () => {
    const out: string[] = [];
    let stop: () => void = () => undefined;
    const until_ = new Promise<void>((r) => (stop = r));
    const state = join(dir, "print-state.json");
    const run = runHostCli(
      ["--dev", "--app", fixture.url, "--port", "0", "--state", state, "--name", "summation"],
      {
        stdout: (l) => {
          out.push(l);
          if (l.startsWith("Watch the hidden session")) stop();
        },
        stderr: () => undefined,
        until: until_,
        self: { command: "/abs/node", args: ["/abs/axe.js", "host"] },
      },
    );
    expect(await run).toBe(0);
    const text = out.join("\n");
    expect(text).toMatch(/serving MCP on http:\/\/127\.0\.0\.1:\d+\/mcp/);
    expect(text).toMatch(
      /claude mcp add --transport http summation http:\/\/127\.0\.0\.1:\d+\/mcp --header "Authorization: Bearer axh_[0-9a-f]+"/,
    );
    expect(text).toContain(
      `claude mcp add summation -- /abs/node /abs/axe.js host --dev --stdio --app ${fixture.url} --state ${state}`,
    );
    expect(text).toContain('"command": "/abs/node"');
    expect(text).toContain(`"${state}"`);
    expect(text).toContain("axe host login");
  });

  it("login saves the signed-in session, and --dev --stdio drives the app with it", async (ctx) => {
    if (missing) return ctx.skip();
    const state = join(dir, "state.json");
    const out: string[] = [];
    const saved = until(async () => {
      try {
        return (await readFile(state, "utf8")).includes('"operator"');
      } catch {
        return false;
      }
    }, 20_000);
    const code = await runHostCli(
      ["login", `${fixture.origin}/login`, "--state", state, "--headless"],
      {
        stdout: (l) => out.push(l),
        stderr: (l) => out.push(l),
        stdin: null,
        until: saved.then(() => undefined),
      },
    );
    expect(code, out.join("\n")).toBe(0);
    expect((await stat(state)).mode & 0o777).toBe(0o600);
    expect(out.join("\n")).toContain("keep it private");

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["--import", "tsx", BIN, "--dev", "--stdio", "--app", fixture.url, "--state", state],
      cwd: join(__dirname, ".."),
      env: { ...(process.env as Record<string, string>) },
      stderr: "pipe",
    });
    const logs: string[] = [];
    transport.stderr!.on("data", (c: Buffer) => logs.push(c.toString()));
    const client = new Client({ name: "stdio-host-test", version: "0" });
    await client.connect(transport);
    cleanup.push(() => client.close());
    const agent = wrap(client, () => client.close());
    const { rows } = await observe(agent);
    expect(row(rows, "Display name").value, logs.join("")).toBe("operator");
    const shot = await agent.call("host_screenshot");
    expect(shot.content.some((c) => c.type === "image")).toBe(true);
    expect(logs.join("")).toContain("serving MCP on");
    expect(logs.join("")).toContain("Signed in with the session saved in");
  });

  it("a storage state file that is not JSON fails the session with a clear message", async (ctx) => {
    if (missing) return ctx.skip();
    const bad = join(dir, "bad.json");
    await writeFile(bad, "not json");
    const { storageStateSession } = await import("../src/index");
    const host = createHost({
      appUrl: fixture.url,
      dev: { agentKey: "axh_test_key_bad_state_01" },
      sessionFor: storageStateSession(bad),
    });
    cleanup.push(() => host.close());
    const address = await host.listen();
    const agent = await httpAgent(address.mcpUrl, "axh_test_key_bad_state_01");
    cleanup.push(() => agent.close());
    const r = await agent.call("relay_tabs");
    expect(r.result.status).toBe("error");
    expect(r.text).toContain("is not JSON");
  });
});
