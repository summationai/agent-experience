import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionLoginRequired } from "@axe/host";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  brokeredSessionFor,
  hostedEnvironmentConfig,
  introspectionVerifier,
  startHostedMcpServiceFromEnv,
  userInfoVerifier,
} from "../src/hosted";
import type { HostedMcpService } from "../src/hosted";
import { handoffEnvironmentConfig, startHandoffMcpServiceFromEnv } from "../src/handoff";
import type { HandoffMcpService } from "../src/handoff";
import {
  localUnattendedEnvironmentConfig,
  localUnattendedHostOptions,
  startLocalUnattendedMcpServiceFromEnv,
} from "../src/local-unattended";
import type { LocalUnattendedMcpService } from "../src/local-unattended";

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
let handoffService: HandoffMcpService | undefined;
let localUnattendedService: LocalUnattendedMcpService | undefined;
let handoffClient: Client | undefined;

afterEach(async () => {
  await handoffClient?.close().catch(() => undefined);
  await service?.close();
  await handoffService?.close();
  await localUnattendedService?.close();
  handoffClient = undefined;
  service = undefined;
  handoffService = undefined;
  localUnattendedService = undefined;
});

describe("local unattended MCP service", () => {
  const LOCAL_UNATTENDED_ENV = {
    AXE_HOST_APP_URL: "http://localhost:5173/login",
    AXE_MCP_AGENT_KEY: "local-test-key",
    HOST: "127.0.0.1",
    PORT: "0",
  };

  it("is loopback-only and needs no OAuth, application broker, or saved session", async () => {
    expect(localUnattendedEnvironmentConfig(LOCAL_UNATTENDED_ENV)).toMatchObject({
      appUrl: "http://localhost:5173/login",
      agentKey: "local-test-key",
      principal: "local-user",
      tenant: "unselected",
      host: "127.0.0.1",
      port: 0,
    });
    expect(localUnattendedEnvironmentConfig(LOCAL_UNATTENDED_ENV)).not.toHaveProperty("statePath");
    expect(() =>
      localUnattendedEnvironmentConfig({
        ...LOCAL_UNATTENDED_ENV,
        AXE_HOST_APP_URL: "https://app.example/login",
      }),
    ).toThrow(/loopback/);
    expect(() =>
      localUnattendedEnvironmentConfig({ ...LOCAL_UNATTENDED_ENV, HOST: "0.0.0.0" }),
    ).toThrow(/loopback/);

    localUnattendedService = await startLocalUnattendedMcpServiceFromEnv(LOCAL_UNATTENDED_ENV);
    const health = await fetch(`${localUnattendedService.address.url}/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ ok: true });
    // The browser is lazy: starting and probing the service does not open an app page.

    const transport = new StreamableHTTPClientTransport(
      new URL(localUnattendedService.address.mcpUrl),
      { requestInit: { headers: { Authorization: "Bearer local-test-key" } } },
    );
    handoffClient = new Client({ name: "local-unattended-test", version: "0" });
    await handoffClient.connect(transport as unknown as Transport);
    expect(handoffClient.getInstructions()).toContain(
      "never ask the person to sign in in another tab",
    );
    expect(handoffClient.getInstructions()).toContain(
      "enter them through the reported Surface fields",
    );
    const tools = (await handoffClient.listTools()).tools.map((tool) => tool.name);
    expect(tools).toContain("relay_tabs");
    expect(tools).not.toContain("relay_pair");
  });

  it("accepts an optional saved state and explicit browser binary", () => {
    expect(
      localUnattendedEnvironmentConfig({
        ...LOCAL_UNATTENDED_ENV,
        AXE_HOST_STATE_PATH: ".axe/summation.json",
        AXE_HOST_BROWSER_EXECUTABLE_PATH: "/Applications/Chromium.app/chromium",
        AXE_HOST_START_PATH: "/",
      }),
    ).toMatchObject({
      statePath: expect.stringMatching(/\.axe\/summation\.json$/),
      executablePath: "/Applications/Chromium.app/chromium",
      startPath: "/",
    });
  });

  it("serves one-time approval links as the configured local person", async () => {
    const config = localUnattendedEnvironmentConfig({
      ...LOCAL_UNATTENDED_ENV,
      AXE_HOST_DEV_PRINCIPAL: "person-1",
      AXE_HOST_DEV_TENANT: "tenant-1",
    });
    const options = localUnattendedHostOptions(config);
    const relay = options.relay as {
      approvals?: { identify?: (request: Request) => unknown };
    };

    expect(await relay.approvals?.identify?.(new Request("http://127.0.0.1/approve/test"))).toEqual({
      principal: "person-1",
      tenant: "tenant-1",
    });
    expect(options.description).toContain("present that ordinary clickable link");
    expect(options.description).toContain("Do not open or approve the link yourself");
  });
});

describe("provider-operated browser handoff", () => {
  const HANDOFF_ENV = {
    AXE_HOST_APP_URL: "https://app.example/",
    AXE_HOST_PUBLIC_MCP_URL: "https://agents.example/mcp",
    AXE_HOST_AUTHORIZATION_SERVERS: "https://auth.example/",
    AXE_HOST_SCOPES: "surface:read surface:act",
    AXE_HOST_OAUTH_USERINFO_URL: "https://auth.example/me",
    AXE_HOST_PRINCIPAL_CLAIM: "identity.user_id",
    AXE_HOST_TENANT_CLAIM: "identity.org_id",
    HOST: "127.0.0.1",
    PORT: "0",
  };
  const LOCAL_HANDOFF_ENV = {
    AXE_HOST_APP_URL: "http://localhost:5173/login",
    AXE_HOST_PUBLIC_MCP_URL: "http://127.0.0.1:4717/mcp",
    AXE_HOST_AUTH_MODE: "local",
    HOST: "127.0.0.1",
    PORT: "0",
  };

  it("requires no application session broker", () => {
    expect(handoffEnvironmentConfig(HANDOFF_ENV)).toMatchObject({
      appUrl: "https://app.example/",
      publicMcpUrl: "https://agents.example/mcp",
      authMode: "oauth",
      allowedOrigins: ["https://app.example"],
      port: 0,
    });
    expect(handoffEnvironmentConfig(HANDOFF_ENV)).not.toHaveProperty("sessionBrokerUrl");
  });

  it("opens the local application's own login without OAuth or pairing", async () => {
    expect(handoffEnvironmentConfig(LOCAL_HANDOFF_ENV)).toMatchObject({
      appUrl: "http://localhost:5173/login",
      publicMcpUrl: "http://127.0.0.1:4717/mcp",
      authMode: "local",
      authorizationServers: [],
      allowedOrigins: ["http://localhost:5173"],
    });
    expect(() =>
      handoffEnvironmentConfig({
        ...LOCAL_HANDOFF_ENV,
        AXE_HOST_APP_URL: "https://app.example/login",
      }),
    ).toThrow(/requires loopback/);

    const fetcher = vi.fn<typeof fetch>(() =>
      Promise.reject(new Error("local auth must not make an OAuth request")),
    );
    handoffService = await startHandoffMcpServiceFromEnv(LOCAL_HANDOFF_ENV, { fetch: fetcher });
    const transport = new StreamableHTTPClientTransport(new URL(handoffService.address.mcpUrl));
    handoffClient = new Client({ name: "local-handoff-test", version: "0" });
    await handoffClient.connect(transport as unknown as Transport);
    expect(fetcher).not.toHaveBeenCalled();

    const result = await handoffClient.callTool({ name: "relay_tabs", arguments: {} });
    const structured = result.structuredContent as {
      status: string;
      handoff: { reason: string; url: string; whatAgentShouldSayToUser: string };
    };
    expect(structured).toMatchObject({
      status: "needs_human",
      handoff: {
        reason: "application_login_required",
        whatAgentShouldSayToUser: expect.stringContaining("local Summation sign-in page"),
      },
    });
    const publicHandoff = new URL(structured.handoff.url);
    expect(publicHandoff.pathname).toMatch(/^\/connect\//);
    const landing = await fetch(`${handoffService.address.url}${publicHandoff.pathname}`);
    expect(landing.status).toBe(200);
    expect(await landing.text()).toContain("http://localhost:5173/login");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("initializes silently and starts contextual OAuth only when relay_tabs is called", async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url === "https://auth.example/.well-known/oauth-authorization-server")
        return new Response(
          JSON.stringify({
            issuer: "https://auth.example/",
            authorization_endpoint: "https://auth.example/oauth/authorize",
            token_endpoint: "https://auth.example/oauth/token",
            registration_endpoint: "https://auth.example/oauth/register",
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      if (url === "https://auth.example/oauth/register" && init?.method === "POST")
        return new Response(JSON.stringify({ client_id: "agent-experience" }), {
          headers: { "Content-Type": "application/json" },
        });
      if (url === "https://auth.example/oauth/token" && init?.method === "POST")
        return new Response(JSON.stringify({ access_token: "summation-token" }), {
          headers: { "Content-Type": "application/json" },
        });
      if (url === "https://auth.example/me")
        return new Response(
          JSON.stringify({
            authenticated: true,
            identity: { user_id: "person-1", org_id: "team-1", scopes: ["surface:act"] },
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      throw new Error(`Unexpected fetch: ${url}`);
    });
    handoffService = await startHandoffMcpServiceFromEnv(HANDOFF_ENV, { fetch: fetcher });

    const transport = new StreamableHTTPClientTransport(new URL(handoffService.address.mcpUrl));
    handoffClient = new Client({ name: "handoff-test", version: "0" });
    await handoffClient.connect(transport as unknown as Transport);
    expect(fetcher).not.toHaveBeenCalled();
    expect(handoffClient.getInstructions()).toContain("only when the person asks");

    const result = await handoffClient.callTool({ name: "relay_tabs", arguments: {} });
    const structured = result.structuredContent as {
      status: string;
      handoff: { reason: string; url: string };
    };
    expect(structured).toMatchObject({
      status: "needs_human",
      handoff: { reason: "application_login_required" },
    });
    expect(fetcher).not.toHaveBeenCalled();

    const publicLogin = new URL(structured.handoff.url);
    const localLogin = `${handoffService.address.url}${publicLogin.pathname}`;
    const explanation = await fetch(localLogin);
    expect(explanation.status).toBe(200);
    expect(await explanation.text()).toContain("You asked your agent to use Summation");
    expect(fetcher).not.toHaveBeenCalled();

    const start = await fetch(`${localLogin}/start`, { redirect: "manual" });
    expect(start.status).toBe(302);
    const authorization = new URL(start.headers.get("location")!);
    expect(authorization.href).toContain("https://auth.example/oauth/authorize?");
    expect(fetcher).toHaveBeenCalledTimes(2);

    const callback = await fetch(
      `${handoffService.address.url}/oauth/callback?state=${authorization.searchParams.get("state")}&code=approved`,
      { redirect: "manual" },
    );
    expect(callback.status).toBe(302);
    expect(new URL(callback.headers.get("location")!).pathname).toMatch(/^\/connect\//);
    expect(fetcher).toHaveBeenCalledTimes(4);

    const connectedIdentity = await handoffClient.callTool({ name: "relay_tabs", arguments: {} });
    expect(connectedIdentity.structuredContent).toMatchObject({
      status: "needs_human",
      handoff: { reason: "application_tab_required" },
    });

    expect((await fetch(`${handoffService.address.url}/unknown`)).status).toBe(404);
  });
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

  it("verifies opaque application OAuth tokens through an identity endpoint", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          authenticated: true,
          identity: {
            user_id: "user-1",
            org_id: "org-1",
            scopes: ["agent:read", "agent:write"],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const verifier = userInfoVerifier(
      {
        userInfoUrl: "https://api.example/v1/me",
        principalClaim: "identity.user_id",
        tenantClaim: "identity.org_id",
        publicMcpUrl: "https://agents.example/mcp",
      },
      fetcher,
    );
    const info = await verifier.verifyAccessToken("opaque-user-session");
    expect(info).toMatchObject({
      clientId: "oauth-user",
      scopes: ["agent:read", "agent:write"],
      extra: { identity: { user_id: "user-1", org_id: "org-1" } },
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.example/v1/me",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer opaque-user-session" }),
      }),
    );

    fetcher.mockResolvedValueOnce(new Response(null, { status: 401 }));
    await expect(verifier.verifyAccessToken("expired")).rejects.toBeInstanceOf(InvalidTokenError);
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

  it("can exchange the caller's application-issued OAuth token for its browser session", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ cookies: [{ name: "app_session", value: "browser" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const sessionFor = brokeredSessionFor(
      {
        sessionBrokerUrl: "https://api.example/v1/auth/agent-session",
        sessionBrokerAuth: "caller",
      },
      fetcher,
    );
    await sessionFor({
      principal: "user-1",
      tenant: "org-1",
      authInfo: { token: "opaque-user-session", clientId: "claude", scopes: ["agent:read"] },
    });
    expect(fetcher.mock.calls[0]![1]!.headers).toMatchObject({
      Authorization: "Bearer opaque-user-session",
    });
    await expect(
      sessionFor({ principal: "user-1", tenant: "org-1", authInfo: null }),
    ).rejects.toThrow(/requires MCP authentication/);
  });

  it("turns a broker login challenge into a password-free application handoff", async () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          loginUrl: "https://app.example/agent-login?request=opaque-one-time-code",
          instructions: "Sign in to Summation in this window.",
          whatAgentShouldSayToUser: "Please connect your Summation account.",
          expiresAt,
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    );
    const sessionFor = brokeredSessionFor(hostedEnvironmentConfig(ENV), fetcher);
    let thrown: unknown;
    try {
      await sessionFor({ principal: "person-1", tenant: "team-1", authInfo: null });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(SessionLoginRequired);
    expect(thrown).toMatchObject({
      url: "https://app.example/agent-login?request=opaque-one-time-code",
      instructions: "Sign in to Summation in this window.",
      whatAgentShouldSayToUser: "Please connect your Summation account.",
      expiresAt: Date.parse(expiresAt),
    });

    // A refusal without a login page remains a refusal, not a fabricated sign-in flow.
    fetcher.mockResolvedValueOnce(new Response(null, { status: 403 }));
    await expect(
      sessionFor({ principal: "person-1", tenant: "team-1", authInfo: null }),
    ).resolves.toBeNull();
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
