import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { createConnectorRegistry } from "../src/connectors";
import type { RegisteredConnector } from "../src/connectors";
import { GENERIC_INSTRUCTIONS, startProviderService } from "../src/provider";
import type { ProviderService } from "../src/provider";

const connector = (
  id: string,
  displayName: string,
  aliases: string[] = [],
): RegisteredConnector => ({
  id,
  displayName,
  aliases,
  description: `${displayName} facts`,
  appUrl: `https://${id}.example/`,
  allowedOrigins: [`https://${id}.example`],
  surfaceId: id,
  identity: { principalClaim: "sub", contextClaim: "org" },
  session: { strategy: "none" },
});

let service: ProviderService | undefined;
let client: Client | undefined;

afterEach(async () => {
  await client?.close().catch(() => undefined);
  await service?.close();
  client = undefined;
  service = undefined;
});

describe("connector registry", () => {
  it("searches trusted discovery metadata without exposing bootstrap security details", () => {
    const registry = createConnectorRegistry([
      connector("acme-analytics", "Acme Analytics", ["acme"]),
      connector("plan-board", "Plan Board", ["planning"]),
    ]);

    expect(registry.defaultId).toBeNull();
    expect(registry.search("acme")).toEqual([
      {
        id: "acme-analytics",
        displayName: "Acme Analytics",
        aliases: ["acme"],
        description: "Acme Analytics facts",
      },
    ]);
    expect(registry.list()[0]).not.toHaveProperty("appUrl");
    expect(registry.list()[0]).not.toHaveProperty("allowedOrigins");
    expect(registry.list()[0]).not.toHaveProperty("session");
    expect(() =>
      createConnectorRegistry([
        connector("one", "One", ["shared"]),
        connector("two", "Two", ["shared"]),
      ]),
    ).toThrow(/belongs to both/);
    expect(() => createConnectorRegistry([connector("Not Valid", "Broken")])).toThrow(
      /stable lowercase connector id/,
    );
  });
});

describe("generic multi-application provider", () => {
  it("discovers and selects connectors without embedding application behavior", async () => {
    const registry = createConnectorRegistry([
      connector("acme-analytics", "Acme Analytics", ["acme"]),
      connector("plan-board", "Plan Board", ["planning"]),
    ]);
    service = await startProviderService({
      registry,
      verifier: {
        async verifyAccessToken(token) {
          return {
            token,
            clientId: "desktop-agent",
            scopes: ["surface:act"],
            extra: { sub: "person-1", org: "team-1" },
          };
        },
      },
      requiredScopes: ["surface:act"],
      resource: "https://agents.example/mcp",
      protectedResource: {
        resource: "https://agents.example/mcp",
        authorizationServers: ["https://auth.example/"],
        scopesSupported: ["surface:act"],
      },
      principal: (auth) => String(auth.extra?.["sub"] ?? ""),
      identify: (_connector, auth) => ({
        principal: String(auth.extra?.["sub"] ?? ""),
        tenant: String(auth.extra?.["org"] ?? ""),
      }),
      host: "127.0.0.1",
      port: 0,
    });

    const transport = new StreamableHTTPClientTransport(new URL(service.address.mcpUrl), {
      requestInit: { headers: { Authorization: "Bearer valid" } },
    });
    client = new Client({ name: "provider-test", version: "0" });
    await client.connect(transport as unknown as Transport);

    expect(client.getInstructions()).toContain(GENERIC_INSTRUCTIONS);
    expect(client.getInstructions()).not.toContain("Acme Analytics");
    const tools = (await client.listTools()).tools.map((tool) => tool.name);
    expect(tools).toEqual(expect.arrayContaining(["apps_search", "app_connect", "relay_tabs"]));
    expect(tools).not.toContain("relay_pair");

    const found = await client.callTool({ name: "apps_search", arguments: { query: "planning" } });
    expect(found.structuredContent).toEqual({
      applications: [
        {
          id: "plan-board",
          displayName: "Plan Board",
          aliases: ["planning"],
          description: "Plan Board facts",
        },
      ],
    });
    const selected = await client.callTool({
      name: "app_connect",
      arguments: { appId: "plan-board" },
    });
    expect(selected.structuredContent).toMatchObject({
      selected: { id: "plan-board", displayName: "Plan Board" },
    });
  });
});
