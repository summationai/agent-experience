import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { serviceConfig } from "../src/config";
import { startMcpService } from "../src/service";
import type { McpService } from "../src/service";

let service: McpService | undefined;
let client: Client | undefined;

afterEach(async () => {
  await client?.close().catch(() => undefined);
  await service?.close();
  client = undefined;
  service = undefined;
});

describe("Agent Experience MCP service", () => {
  it("validates environment configuration", async () => {
    expect(serviceConfig({})).toMatchObject({
      host: "127.0.0.1",
      port: 4717,
      agentKey: "axd_agent_experience_local",
    });
    expect(
      serviceConfig({
        AXE_MCP_PORT: "0",
        AXE_MCP_ALLOWED_ORIGINS: "http://localhost:5173, http://127.0.0.1:5174",
      }).origins,
    ).toEqual(["http://localhost:5173", "http://127.0.0.1:5174"]);
    expect(() => serviceConfig({ AXE_MCP_PORT: "nope" })).toThrow(/AXE_MCP_PORT/);
    expect(() => serviceConfig({ AXE_MCP_HOST: "0.0.0.0" })).toThrow(/loopback host/);
    await expect(startMcpService({ host: "0.0.0.0", port: 0 })).rejects.toThrow(/loopback host/);
  });

  it("serves health, setup metadata, and relay-first MCP instructions and tools", async () => {
    service = await startMcpService({ port: 0, agentKey: "test-local-key" });
    const health = await fetch(`${service.address.url}/health`);
    expect(await health.json()).toEqual({ ok: true });

    const discovery = await fetch(service.address.discoveryUrl);
    expect(await discovery.json()).toMatchObject({
      transport: "streamable-http",
      mcpUrl: service.address.mcpUrl,
      tabUrl: service.address.tabUrl,
      workflow: [
        "Call relay_tabs.",
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
      ],
    });

    const transport = new StreamableHTTPClientTransport(new URL(service.address.mcpUrl), {
      requestInit: { headers: { Authorization: "Bearer test-local-key" } },
    });
    client = new Client({ name: "service-test", version: "0" });
    await client.connect(transport as unknown as Transport);
    expect(client.getInstructions()).toContain("Start with relay_tabs");
    const names = (await client.listTools()).tools.map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "relay_tabs",
        "relay_pair",
        "surface_read",
        "surface_observe",
        "surface_wait",
        "surface_set-field",
        "surface_run-control",
      ]),
    );
  });

  it("refuses an MCP client with the wrong bearer key", async () => {
    service = await startMcpService({ port: 0, agentKey: "right-key" });
    const transport = new StreamableHTTPClientTransport(new URL(service.address.mcpUrl), {
      requestInit: { headers: { Authorization: "Bearer wrong-key" } },
    });
    client = new Client({ name: "unauthorized-test", version: "0" });
    await expect(client.connect(transport as unknown as Transport)).rejects.toThrow();
  });
});
