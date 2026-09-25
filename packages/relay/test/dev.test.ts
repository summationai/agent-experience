// Development pairing over real transports: loopback enforcement, development tokens, the
// pairing code shown in the tab, and the development key on /mcp.
import { afterEach, describe, expect, it } from "vitest";
import { request as httpRequest } from "node:http";
import { createRelay } from "../src/server";
import { httpAgent, openPage, registerPlan } from "./helpers";
import type { Agent, Page } from "./helpers";

const cleanup: (() => unknown)[] = [];
afterEach(async () => {
  while (cleanup.length) await Promise.resolve(cleanup.pop()!()).catch(() => undefined);
});

async function devRelay() {
  const relay = createRelay({ devPairing: true, reconnectGraceMs: 3000 });
  cleanup.push(() => relay.close());
  const address = await relay.listen({ host: "127.0.0.1", port: 0 });
  return { relay, address };
}

async function page(): Promise<Page> {
  const p = await openPage();
  cleanup.push(() => p.close());
  registerPlan(p);
  return p;
}

/** A raw HTTP request with a chosen Host header, which fetch does not allow setting. */
function rawRequest(
  port: number,
  path: string,
  headers: Record<string, string>,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: "127.0.0.1", port, path, method: "POST", headers }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

describe("development pairing", () => {
  it("is refused off loopback: listening on a public interface throws", async () => {
    const relay = createRelay({ devPairing: true });
    cleanup.push(() => relay.close());
    await expect(relay.listen({ host: "0.0.0.0", port: 0 })).rejects.toThrow(/loopback only/);
    // And a request whose peer is not loopback is refused by the route itself.
    const res = await relay.handle(new Request("http://127.0.0.1/dev/token", { method: "POST" }), {
      remoteAddress: "10.1.2.3",
    });
    expect(res.status).toBe(403);
    expect(await res.text()).toContain("loopback clients only");
  });

  it("refuses a request whose Host is not loopback (DNS rebinding), on /dev/token, /mcp, and the tab upgrade", async () => {
    const { address } = await devRelay();
    for (const path of ["/dev/token", "/mcp"]) {
      const res = await rawRequest(address.port, path, { Host: "evil.test" });
      expect(res.status, path).toBe(403);
      expect(res.body).toContain("loopback Host");
    }
    const upgrade = await rawRequest(address.port, "/tab", {
      Host: `rebind.test:${address.port}`,
      Connection: "Upgrade",
      Upgrade: "websocket",
      Origin: "http://localhost:5173",
      "Sec-WebSocket-Version": "13",
      "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
    }).catch((e: Error) => ({ status: 0, body: e.message }));
    expect(upgrade.status).toBe(403);
  });

  it("refuses /mcp without the development key", async () => {
    const { address } = await devRelay();
    await expect(httpAgent(address.mcpUrl, "not-the-key")).rejects.toThrow();
  });

  it("an agent pairs with the code the tab shows, then observes and acts; a wrong code is refused and repeated wrong codes are rate limited", async () => {
    const { relay, address } = await devRelay();
    const p = await page();
    p.connect({ url: address.tabUrl, getToken: p.api.devToken(address.url) });
    const shown = await p.status((s) => s.state === "pairing");
    expect(shown.pairingCode).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(p.indicator()?.textContent).toContain(`Agent pairing code: ${shown.pairingCode}`);

    const a: Agent = await httpAgent(address.mcpUrl, relay.devAgentKey!);
    cleanup.push(() => a.close());
    expect((await a.client.listTools()).tools.map((t) => t.name)).toContain("relay_pair");
    const before = await a.call("relay_tabs");
    expect(before.result.output).toMatchObject({ principal: null, tabs: [] });
    expect(String(before.result.output!["hint"])).toContain("relay_pair");
    const unpaired = await a.call("surface_observe");
    expect(JSON.stringify(unpaired.result.output)).toContain("not paired");

    const wrong = await a.call("relay_pair", { code: "0000-0000" });
    expect(wrong.result.error!.code).toBe("not_found");
    // Lower case and without the hyphen, as a person might type it.
    const pairedRes = await a.call("relay_pair", {
      code: shown.pairingCode!.replace("-", "").toLowerCase(),
    });
    expect(pairedRes.result.status, pairedRes.text).toBe("ok");
    expect(pairedRes.result.output).toMatchObject({ principal: "dev", tenant: "dev" });
    await p.status((s) => s.state === "connected" && s.pairingCode === null);
    expect(p.indicator()?.textContent).not.toContain("pairing code");

    const v = await a.call("surface_observe");
    const rev = (v.result.output as { rev: number }).rev;
    const done = await a.call("surface_run-control", { entryId: "plan:submit", expectedRev: rev });
    expect(done.result.status, done.text).toBe("ok");
    expect(p.calls).toEqual(["submit:dev (agent via relay)"]);

    // A second agent guessing codes is locked out after five wrong ones.
    const guesser: Agent = await httpAgent(address.mcpUrl, relay.devAgentKey!);
    cleanup.push(() => guesser.close());
    // It shares the development key, so it is the same agent to the relay and already paired;
    // guessing still counts.
    for (let i = 0; i < 5; i++) await guesser.call("relay_pair", { code: `ZZZZ-ZZZ${i}` });
    const locked = await guesser.call("relay_pair", { code: "ZZZZ-ZZZZ" });
    expect(locked.result.error!.code).toBe("rate_limited");
  });

  it("serves development tokens only to allowed origins", async () => {
    const { address } = await devRelay();
    const ok = await fetch(`${address.url}/dev/token`, {
      method: "POST",
      headers: { Origin: "http://localhost:5173" },
    });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    const bad = await fetch(`${address.url}/dev/token`, {
      method: "POST",
      headers: { Origin: "https://evil.test" },
    });
    expect(bad.status).toBe(403);
  });
});
