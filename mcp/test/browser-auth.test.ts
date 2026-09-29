import { describe, expect, it, vi } from "vitest";
import { createBrowserAuth } from "../src/browser-auth";

describe("provider browser authentication", () => {
  it("uses OAuth with PKCE, returns only to a human-session URL, and establishes a provider browser identity", async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes(".well-known"))
        return Response.json({
          issuer: "https://auth.example",
          authorization_endpoint: "https://auth.example/authorize",
          token_endpoint: "https://auth.example/token",
          registration_endpoint: "https://auth.example/register",
        });
      if (url === "https://auth.example/register")
        return Response.json({ client_id: "browser-client" });
      if (url === "https://auth.example/token")
        return Response.json({ access_token: "verified-browser-token", token_type: "Bearer" });
      return new Response("unexpected", { status: 500 });
    });
    const auth = createBrowserAuth({
      publicOrigin: "https://agents.example",
      authorizationServers: ["https://auth.example"],
      scopes: ["surface:act"],
      resource: "https://agents.example/mcp",
      verifier: {
        async verifyAccessToken(token) {
          expect(token).toBe("verified-browser-token");
          return {
            token,
            clientId: "browser-client",
            scopes: ["surface:act"],
            extra: { sub: "person-1", org: "team-1" },
          };
        },
      },
      fetch: fetcher as typeof fetch,
    });

    expect(() => auth.signInUrl("https://evil.example/human-session/app/link/")).toThrow(
      /outside the human-session routes/,
    );
    const returnTo = "https://agents.example/human-session/example/link-token/";
    const startUrl = auth.signInUrl(returnTo);
    const start = await auth.handle(new Request(startUrl));
    expect(start?.status).toBe(302);
    const authorization = new URL(start!.headers.get("location")!);
    expect(authorization.origin).toBe("https://auth.example");
    expect(authorization.searchParams.get("client_id")).toBe("browser-client");
    expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorization.searchParams.get("resource")).toBe("https://agents.example/mcp");

    const callback = new URL("https://agents.example/human-auth/callback");
    callback.searchParams.set("state", authorization.searchParams.get("state")!);
    callback.searchParams.set("code", "authorization-code");
    const finished = await auth.handle(new Request(callback));
    expect(finished?.status).toBe(302);
    expect(finished?.headers.get("location")).toBe(returnTo);
    const setCookie = finished!.headers.get("set-cookie")!;
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=Lax");
    const browserCookie = setCookie.split(";", 1)[0]!;
    expect(
      auth.authInfo(
        new Request(returnTo, {
          headers: { cookie: browserCookie },
        }),
      )?.extra,
    ).toEqual({ sub: "person-1", org: "team-1" });

    expect(await auth.handle(new Request(callback))).toMatchObject({ status: 400 });
  });

  it("uses a pre-registered public client when dynamic registration is unavailable", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        issuer: "https://auth.example",
        authorization_endpoint: "https://auth.example/authorize",
        token_endpoint: "https://auth.example/token",
      }),
    );
    const auth = createBrowserAuth({
      publicOrigin: "https://agents.example",
      authorizationServers: ["https://auth.example"],
      scopes: [],
      resource: "https://agents.example/mcp",
      clientId: "registered-browser-client",
      verifier: { verifyAccessToken: vi.fn() },
      fetch: fetcher,
    });
    const start = await auth.handle(
      new Request(auth.signInUrl("https://agents.example/human-session/example/link-token/")),
    );
    expect(new URL(start!.headers.get("location")!).searchParams.get("client_id")).toBe(
      "registered-browser-client",
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
