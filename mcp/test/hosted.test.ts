import { afterEach, describe, expect, it, vi } from "vitest";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import {
  brokeredSessionFor,
  hostedEnvironmentConfig,
  introspectionVerifier,
  startHostedMcpServiceFromEnv,
} from "../src/hosted";
import type { HostedMcpService } from "../src/hosted";

const ENV = {
  AXE_HOST_APP_URL: "https://app.example/",
  AXE_HOST_PUBLIC_MCP_URL: "https://agents.example/mcp",
  AXE_HOST_AUTHORIZATION_SERVERS: "https://auth.example/",
  AXE_HOST_OAUTH_INTROSPECTION_URL: "https://auth.example/oauth/introspect",
  AXE_HOST_OAUTH_CLIENT_ID: "resource-server",
  AXE_HOST_OAUTH_CLIENT_SECRET: "resource-secret",
  AXE_HOST_SESSION_BROKER_URL: "https://app.example/internal/agent-session",
  AXE_HOST_SESSION_BROKER_TOKEN: "broker-secret",
  AXE_HOST_DEFAULT_TENANT: "example",
  AXE_HOST_SCOPES: "surface:read surface:act",
  HOST: "127.0.0.1",
  PORT: "0",
};

let service: HostedMcpService | undefined;

afterEach(async () => {
  await service?.close();
  service = undefined;
});

describe("provider-operated hosted MCP service", () => {
  it("requires the OAuth and application-session boundary", () => {
    expect(hostedEnvironmentConfig(ENV)).toMatchObject({
      appUrl: "https://app.example/",
      publicMcpUrl: "https://agents.example/mcp",
      authorizationServers: ["https://auth.example/"],
      scopes: ["surface:read", "surface:act"],
      defaultTenant: "example",
      port: 0,
    });
    expect(() => hostedEnvironmentConfig({})).toThrow(/AXE_HOST_PUBLIC_MCP_URL/);
    expect(() =>
      hostedEnvironmentConfig({ ...ENV, AXE_HOST_PUBLIC_MCP_URL: "https://agents.example/wrong" }),
    ).toThrow(/end in \/mcp/);
  });

  it("introspects the token, enforces its audience, and retains identity claims", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          active: true,
          sub: "person-1",
          org: "team-1",
          client_id: "chatgpt",
          scope: "surface:read surface:act",
          aud: ["https://agents.example/mcp"],
          exp: 1_900_000_000,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const verifier = introspectionVerifier(hostedEnvironmentConfig(ENV), fetcher);
    const info = await verifier.verifyAccessToken("user-access-token");
    expect(info).toMatchObject({
      clientId: "chatgpt",
      scopes: ["surface:read", "surface:act"],
      expiresAt: 1_900_000_000,
      extra: { sub: "person-1", org: "team-1" },
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://auth.example/oauth/introspect",
      expect.objectContaining({
        method: "POST",
        body: expect.any(URLSearchParams),
        headers: expect.objectContaining({ Authorization: expect.stringMatching(/^Basic /) }),
      }),
    );

    fetcher.mockResolvedValueOnce(
      new Response(JSON.stringify({ active: true, aud: "https://someone-else.example/mcp" })),
    );
    await expect(verifier.verifyAccessToken("wrong-audience")).rejects.toBeInstanceOf(
      InvalidTokenError,
    );
  });

  it("exchanges identity, never the MCP token, for a short-lived app session", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          cookies: [{ name: "app_session", value: "short-lived", secure: true }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const sessionFor = brokeredSessionFor(hostedEnvironmentConfig(ENV), fetcher);
    const session = await sessionFor({
      principal: "person-1",
      tenant: "team-1",
      authInfo: {
        token: "must-not-leave-the-service",
        clientId: "chatgpt",
        scopes: ["surface:act"],
      },
    });
    expect(session).toMatchObject({ cookies: [{ name: "app_session", value: "short-lived" }] });
    const request = fetcher.mock.calls[0]![1]!;
    expect(request.headers).toMatchObject({ Authorization: "Bearer broker-secret" });
    expect(String(request.body)).toBe(
      JSON.stringify({ principal: "person-1", tenant: "team-1", scopes: ["surface:act"] }),
    );
    expect(String(request.body)).not.toContain("must-not-leave-the-service");

    fetcher.mockResolvedValueOnce(
      new Response(JSON.stringify({ storageState: "/etc/passwd" }), { status: 200 }),
    );
    await expect(
      sessionFor({ principal: "person-1", tenant: "team-1", authInfo: null }),
    ).rejects.toThrow(/not a host file path/);
  });

  it("serves OAuth discovery from the same standalone process", async () => {
    service = await startHostedMcpServiceFromEnv(ENV);
    const metadata = await fetch(`${service.address.url}/.well-known/oauth-protected-resource/mcp`);
    expect(metadata.status).toBe(200);
    expect(await metadata.json()).toMatchObject({
      resource: "https://agents.example/mcp",
      authorization_servers: ["https://auth.example/"],
      scopes_supported: ["surface:read", "surface:act"],
    });
    const challenge = await fetch(service.address.mcpUrl, { method: "POST" });
    expect(challenge.status).toBe(401);
    expect(challenge.headers.get("www-authenticate")).toContain("resource_metadata=");
  });
});
