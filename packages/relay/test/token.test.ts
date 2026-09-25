import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { MAX_RELAY_TOKEN_TTL, mintRelayToken, verifyRelayToken } from "../src/token";
import { SECRET } from "./helpers";

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
/** A token an application backend mints with its own JWT code, not with this helper. */
function appMinted(
  payload: Record<string, unknown>,
  header: Record<string, unknown> = { alg: "HS256", typ: "JWT" },
) {
  const body = `${b64(header)}.${b64(payload)}`;
  return `${body}.${createHmac("sha256", SECRET).update(body).digest("base64url")}`;
}

describe("relay tokens", () => {
  it("mint and verify: principal is sub, tenant is org, extra claims are carried", async () => {
    const token = await mintRelayToken(
      { principal: "u_1", tenant: "o_1", claims: { mid: "m_7" } },
      SECRET,
    );
    expect(token.split(".")).toHaveLength(3);
    const claims = await verifyRelayToken(token, SECRET);
    expect(claims).toMatchObject({
      principal: "u_1",
      tenant: "o_1",
      claims: { mid: "m_7", aud: "axe-relay" },
    });
    expect(claims!.exp - claims!.iat).toBe(600);
  });

  it("accepts a token the application minted with its own HS256 code, with the audience checked", async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = appMinted({
      sub: "u_2",
      org: "o_9",
      mid: "m_1",
      aud: "axe-relay",
      exp: now + 300,
    });
    expect(await verifyRelayToken(token, SECRET)).toMatchObject({
      principal: "u_2",
      tenant: "o_9",
    });
    // No jti: the relay revokes by a digest of the token.
    expect((await verifyRelayToken(token, SECRET))!.jti).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await verifyRelayToken(token, SECRET, { audience: "billing" })).toBeNull();
    const arr = appMinted({ sub: "u_2", org: "o_9", aud: ["x", "axe-relay"], exp: now + 300 });
    expect(await verifyRelayToken(arr, SECRET)).not.toBeNull();
  });

  it("refuses tampered, unsigned, other-key, expired, not-yet-valid, long-lived, and malformed tokens", async () => {
    const now = Math.floor(Date.now() / 1000);
    const good = await mintRelayToken({ principal: "alice", tenant: "acme" }, SECRET);
    const [h, p, s] = good.split(".");
    const other = { ...JSON.parse(Buffer.from(p!, "base64url").toString()), sub: "mallory" };
    const cases: [string, string][] = [
      ["tampered", `${h}.${b64(other)}.${s}`],
      ["alg none", `${b64({ alg: "none" })}.${p}.`],
      [
        "alg HS512 claimed",
        appMinted({ sub: "a", org: "b", aud: "axe-relay", exp: now + 60 }, { alg: "HS512" }),
      ],
      ["expired", appMinted({ sub: "a", org: "b", aud: "axe-relay", exp: now - 1 })],
      [
        "not yet valid",
        appMinted({ sub: "a", org: "b", aud: "axe-relay", exp: now + 60, nbf: now + 30 }),
      ],
      [
        "long-lived",
        appMinted({
          sub: "a",
          org: "b",
          aud: "axe-relay",
          iat: now,
          exp: now + MAX_RELAY_TOKEN_TTL + 60,
        }),
      ],
      ["no audience", appMinted({ sub: "a", org: "b", exp: now + 60 })],
      ["no tenant", appMinted({ sub: "a", aud: "axe-relay", exp: now + 60 })],
      ["garbage", "not.a.token"],
      ["two parts", "abc.def"],
    ];
    for (const [name, token] of cases)
      expect(await verifyRelayToken(token, SECRET), name).toBeNull();
    expect(await verifyRelayToken(good, "another-secret-0123456789abcdef-0123456")).toBeNull();
  });

  it("refuses a short secret, a missing principal, reserved claims, and a ttl over a day", async () => {
    await expect(mintRelayToken({ principal: "a", tenant: "b" }, "short")).rejects.toThrow(/32/);
    await expect(mintRelayToken({ principal: "", tenant: "b" }, SECRET)).rejects.toThrow(
      /principal/,
    );
    await expect(
      mintRelayToken({ principal: "a", tenant: "b", claims: { sub: "x" } }, SECRET),
    ).rejects.toThrow(/registered/);
    await expect(
      mintRelayToken({ principal: "a", tenant: "b", ttl: MAX_RELAY_TOKEN_TTL + 1 }, SECRET),
    ).rejects.toThrow(/ttl/);
  });
});
