import { describe, expect, it } from "vitest";
import {
  TokenSigner,
  mintToken,
  loadToken,
  MemoryTokenStore,
  hashJson,
  canonicalJson,
  base64UrlDecode,
} from "../src/tokens";
import { DEFAULT_IDEMPOTENCY_TTL_SECONDS } from "../src/idempotency";
import { createAXE, action, z } from "../src/index";
import { apartmentsAXE, call, json } from "./fixtures/apartments";
import type { ErrorResult, OkResult, NeedsInputResult, AXEEvent } from "../src/types";
import { WIRE } from "../src/vocabulary";

describe("tokens [P-TOK-2] [P-TOK-4]", () => {
  it("token record holds state; wire token carries only binding fields", async () => {
    const signer = new TokenSigner("0123456789abcdef0123456789abcdef");
    const store = new MemoryTokenStore();
    const minted = await mintToken(signer, {
      type: "continuation",
      action: "a.b",
      inputHash: "h",
      onBehalfOf: "u1",
      tenant: null,
      ttlSeconds: 60,
      state: { secret: "server-only" },
    });
    await store.set(minted.record.id, minted.record, 60);
    const [body] = minted.token.split(".") as [string, string];
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as Record<
      string,
      unknown
    >;
    expect(Object.keys(payload).sort()).toEqual(["a", "e", "h", "id", "n", "t", "u"]);
    expect(JSON.stringify(payload)).not.toContain("server-only");
    const loaded = await loadToken(signer, store, minted.token, "continuation");
    expect(loaded.kind).toBe("ok");
    if (loaded.kind === "ok") expect(loaded.record.state).toEqual({ secret: "server-only" });
    // A record whose binding was altered server-side no longer matches the token.
    minted.record.onBehalfOf = "u2";
    await store.set(minted.record.id, minted.record, 60);
    expect((await loadToken(signer, store, minted.token, "continuation")).kind).toBe("invalid");
    // Different secret → invalid.
    expect(
      (
        await loadToken(
          new TokenSigner("another-secret-another-secret-1"),
          store,
          minted.token,
          "continuation",
        )
      ).kind,
    ).toBe("invalid");
  });

  it("hashes canonical JSON regardless of key order", async () => {
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: 3 }] })).toBe('{"a":[{"c":3,"d":2}],"b":1}');
    expect(await hashJson({ b: 1, a: 2 })).toBe(await hashJson({ a: 2, b: 1 }));
    expect(await hashJson({ a: 1 })).not.toBe(await hashJson({ a: 2 }));
  });

  it("DEFAULT_IDEMPOTENCY_TTL_SECONDS is 24 hours [P-IDEM-4]", () => {
    expect(DEFAULT_IDEMPOTENCY_TTL_SECONDS).toBe(86400);
  });

  it("rejects short secrets", () => {
    expect(() => new TokenSigner("short")).toThrow(/16 characters/);
  });
});

describe("site auth [P-AUTH-2]", () => {
  function server() {
    const axe = createAXE({
      name: "Wholesale Co",
      description:
        "B2B ordering for wholesale customers: check stock levels and place purchase orders against an approved account.",
      baseUrl: "https://wholesale.example",
      auth: {
        modes: ["none", "site"],
        verifySiteKey: async (key) =>
          key === "good"
            ? true
            : key === "limited"
              ? { id: "acme", actions: ["stock.check"] }
              : false,
      },
      secret: "0123456789abcdef0123456789abcdef",
    });
    axe.register(
      action("stock.check", {
        title: "Check stock",
        description:
          "Returns the on-hand quantity and next restock date for a SKU at the requesting account's default warehouse.",
        readOnly: true,
        risk: "none",
        auth: "site",
        input: z.object({ sku: z.string().describe("SKU") }),
        output: z.object({ onHand: z.number() }),
        handler: async () => ({ onHand: 4 }),
      }),
    );
    axe.register(
      action("orders.place", {
        title: "Place order",
        description:
          "Places a purchase order against the account's net terms and returns the order number and expected ship date.",
        risk: "high",
        idempotent: true,
        reversible: false,
        auth: "site",
        input: z.object({
          sku: z.string().describe("SKU"),
          qty: z.number().int().describe("Quantity"),
        }),
        output: z.object({ orderNumber: z.string() }),
        handler: async () => ({ orderNumber: "PO-1" }),
      }),
    );
    return axe;
  }

  it("site auth: missing key is unauthorized, disallowed key is forbidden", async () => {
    const axe = server();
    const noKey = await json<ErrorResult>(
      await call(axe, "POST", "/axe/actions/stock.check", { input: { sku: "A" } }),
    );
    expect(noKey.error.code).toBe(WIRE.error.unauthorized);
    const badKey = await json<ErrorResult>(
      await call(
        axe,
        "POST",
        "/axe/actions/stock.check",
        { input: { sku: "A" } },
        { Authorization: "Bearer nope" },
      ),
    );
    expect(badKey.error.code).toBe(WIRE.error.unauthorized);
    const good = await json<OkResult>(
      await call(
        axe,
        "POST",
        "/axe/actions/stock.check",
        { input: { sku: "A" } },
        { Authorization: "Bearer good" },
      ),
    );
    expect(good.status).toBe("ok");
    const limitedOk = await json<OkResult>(
      await call(
        axe,
        "POST",
        "/axe/actions/stock.check",
        { input: { sku: "A" } },
        { Authorization: "Bearer limited" },
      ),
    );
    expect(limitedOk.status).toBe("ok");
    const forbidden = await json<ErrorResult>(
      await call(
        axe,
        "POST",
        "/axe/actions/orders.place",
        { input: { sku: "A", qty: 1 }, idempotencyKey: "k" },
        { Authorization: "Bearer limited" },
      ),
    );
    expect(forbidden.error.code).toBe(WIRE.error.forbidden);
  });
});

describe("identity and events", () => {
  it("handlers see the authenticated identity [P-AUTH-3]", async () => {
    const { axe } = apartmentsAXE();
    let seen: string | undefined;
    axe.register(
      action("me.show", {
        title: "Me",
        description:
          "Returns the identity the runtime established for the request, used to test pass-through authentication.",
        readOnly: true,
        risk: "none",
        auth: "user",
        input: z.object({}),
        output: z.object({ me: z.string() }),
        handler: async ({ context }) => {
          seen = context.onBehalfOf;
          return { me: context.onBehalfOf ?? "" };
        },
      }),
    );
    await call(
      axe,
      "POST",
      "/axe/actions/me.show",
      { input: {} },
      { Authorization: "Bearer user:lee" },
    );
    expect(seen).toBe("lee");
  });

  it("events contain no payloads [P-REQ-10] [E-2]", async () => {
    const events: AXEEvent[] = [];
    const { axe } = apartmentsAXE({ onEvent: (e) => void events.push(e) });
    const ni = await json<NeedsInputResult>(
      await call(
        axe,
        "POST",
        "/axe/actions/applications.submit",
        { input: { unitId: "u_204" }, idempotencyKey: "k" },
        { Authorization: "Bearer user:dana" },
      ),
    );
    const secret = "000123454471";
    await call(
      axe,
      "POST",
      "/axe/continue",
      {
        continuationToken: ni.continuationToken,
        kind: WIRE.kind.paymentAchDebit,
        payload: {
          accountHolderName: "Dana",
          routingNumber: "125000024",
          accountNumber: secret,
          accountType: "checking",
          amount: 500,
          currency: "USD",
          authorizedAt: "2026-09-23T18:41:10Z",
          authorizationText: "ok",
        },
      },
      { Authorization: "Bearer user:dana" },
    );
    await new Promise((r) => setTimeout(r, 0));
    const dump = JSON.stringify(events);
    expect(events).toHaveLength(2);
    expect(dump).not.toContain(secret);
    expect(dump).not.toContain("u_204");
    expect(dump).not.toContain("dana");
    expect(dump).not.toContain(ni.continuationToken.slice(0, 20));
  });
});
