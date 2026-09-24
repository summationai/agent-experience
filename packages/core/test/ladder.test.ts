import { describe, expect, it } from "vitest";
import { apartmentsAXE, call, json } from "./fixtures/apartments";
import type {
  Result,
  NeedsInputResult,
  NeedsHumanResult,
  OkResult,
  ErrorResult,
  AXEEvent,
} from "../src/types";
import { WIRE } from "../src/vocabulary";
import { fail } from "../src/results";

const USER = { Authorization: "Bearer user:dana" };
const ACH = {
  accountHolderName: "Dana Whitfield",
  routingNumber: "125000024",
  accountNumber: "000123454471",
  accountType: "checking",
  amount: 500,
  currency: "USD",
  authorizedAt: "2026-09-23T18:41:10Z",
  authorizationText:
    "I authorize Oakridge Rentals to debit $500.00 as a refundable holding deposit.",
};

describe("result envelope statuses", () => {
  it("ok: returns output and the protocol header [P-VER-2] [P-RES-1]", async () => {
    const { axe } = apartmentsAXE();
    const res = await call(axe, "POST", "/axe/actions/units.search", {
      input: { location: "Bellevue, WA" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get(WIRE.header.protocol)).toBe(WIRE.protocol.version);
    expect(res.headers.get(WIRE.header.rateLimitPolicy)).toBe("120;w=60");
    const body = await json<OkResult<{ units: unknown[] }>>(res);
    expect(body.status).toBe("ok");
    expect(body.output.units).toHaveLength(2);
  });

  it("needs_input: returns accepts, a token, expiry, and a fallback handoff [P-REQ-1] [P-REQ-2] [P-REQ-6]", async () => {
    const { axe } = apartmentsAXE();
    const res = await call(
      axe,
      "POST",
      "/axe/actions/applications.submit",
      { input: { unitId: "u_204" }, idempotencyKey: "k1" },
      USER,
    );
    const body = await json<NeedsInputResult>(res);
    expect(body.status).toBe("needs_input");
    expect(body.reason).toBe("payment_required");
    expect(body.accepts.map((a) => a.kind)).toEqual([
      WIRE.kind.paymentAchDebit,
      WIRE.kind.paymentWireConfirmation,
    ]);
    expect(body.accepts[0]!.sensitive).toBe(true);
    expect(body.accepts[0]!.schema["type"]).toBe("object");
    expect(body.accepts[1]!.instructions).toContain("Wire $500");
    expect(typeof body.continuationToken).toBe("string");
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(body.fallback?.resumeToken).toBeTypeOf("string");
    expect(body.fallback?.url).toContain(`${WIRE.query.handoff}=`);
  });

  it("needs_human: returns a complete handoff [P-HAND-1]", async () => {
    const { axe } = apartmentsAXE();
    const res = await call(
      axe,
      "POST",
      "/axe/actions/leases.sign",
      { input: { applicationId: "APP-1" }, idempotencyKey: "k2" },
      USER,
    );
    const body = await json<NeedsHumanResult>(res);
    expect(body.status).toBe("needs_human");
    for (const k of [
      "reason",
      "instructions",
      "url",
      "resumeToken",
      "expiresAt",
      "whatAgentShouldSayToUser",
    ] as const) {
      expect(body.handoff[k], k).toBeTruthy();
    }
  });

  it("error: unknown action is not_found with HTTP 404 [P-INV-5] [P-INV-6]", async () => {
    const { axe } = apartmentsAXE();
    const res = await call(axe, "POST", "/axe/actions/nope.nothing", { input: {} });
    expect(res.status).toBe(404);
    const body = await json<ErrorResult>(res);
    expect(body.status).toBe("error");
    expect(body.error.code).toBe(WIRE.error.notFound);
    expect(res.headers.get(WIRE.header.protocol)).toBe(WIRE.protocol.version);
  });

  it("error: invalid input names each path [P-INV-2] [P-ERR-3]", async () => {
    const { axe } = apartmentsAXE();
    const res = await call(axe, "POST", "/axe/actions/units.search", {
      input: { bedrooms: "two", extra: 1 },
    });
    expect(res.status).toBe(400);
    const body = await json<ErrorResult>(res);
    expect(body.error.code).toBe(WIRE.error.invalidInput);
    const paths = body.error.details!.issues!.map((i) => i.path).sort();
    expect(paths).toEqual(["/bedrooms", "/extra", "/location"]);
    expect(body.error.details!.issues!.find((i) => i.path === "/bedrooms")!.expected).toBe(
      "number",
    );
  });

  it("error: missing input member and non-JSON bodies are invalid_input [P-INV-1]", async () => {
    const { axe } = apartmentsAXE();
    const a = await json<ErrorResult>(
      await call(axe, "POST", "/axe/actions/units.search", { context: {} }),
    );
    expect(a.error.code).toBe(WIRE.error.invalidInput);
    const res = await axe.handle(
      new Request("https://oakridge-rentals.example/axe/actions/units.search", {
        method: "POST",
        body: "not json",
      }),
    );
    expect((await json<ErrorResult>(res)).error.code).toBe(WIRE.error.invalidInput);
  });

  it("error: unsupported protocol major version [P-VER-5]; minor differences accepted", async () => {
    const { axe } = apartmentsAXE();
    const bad = await call(
      axe,
      "POST",
      "/axe/actions/units.search",
      { input: { location: "x" } },
      { [WIRE.header.protocol]: "axe/1.0" },
    );
    expect((await json<ErrorResult>(bad)).error.code).toBe(WIRE.error.unsupported);
    const fine = await call(
      axe,
      "POST",
      "/axe/actions/units.search",
      { input: { location: "x" } },
      { [WIRE.header.protocol]: "axe/0.9" },
    );
    expect((await json<Result>(fine)).status).toBe("ok");
  });

  it("GET on an action returns its definition [P-INV-4]; other methods are rejected", async () => {
    const { axe } = apartmentsAXE();
    const res = await call(axe, "GET", "/axe/actions/units.search");
    expect(res.status).toBe(200);
    expect((await json<{ name: string }>(res)).name).toBe("units.search");
    expect((await call(axe, "DELETE", "/axe/actions/units.search")).status).toBe(405);
  });
});

describe("the escalation ladder", () => {
  it("needs_input → continue → ok, consuming the token [P-REQ-7] [P-REQ-9]", async () => {
    const { axe, state } = apartmentsAXE();
    const first = await json<NeedsInputResult>(
      await call(
        axe,
        "POST",
        "/axe/actions/applications.submit",
        { input: { unitId: "u_204" }, idempotencyKey: "k1" },
        USER,
      ),
    );
    const cont = await call(
      axe,
      "POST",
      "/axe/continue",
      { continuationToken: first.continuationToken, kind: WIRE.kind.paymentAchDebit, payload: ACH },
      USER,
    );
    const body = await json<OkResult<{ applicationId: string; depositStatus: string }>>(cont);
    expect(body.status).toBe("ok");
    expect(body.output.depositStatus).toBe("received");
    expect(state.applications.get(body.output.applicationId)!.status).toBe("submitted");
    const replay = await json<ErrorResult>(
      await call(
        axe,
        "POST",
        "/axe/continue",
        {
          continuationToken: first.continuationToken,
          kind: WIRE.kind.paymentAchDebit,
          payload: ACH,
        },
        USER,
      ),
    );
    expect(replay.error.code).toBe(WIRE.error.conflict);
  });

  it("continue rejects a kind not in accepts and an invalid payload without consuming the token [P-REQ-8]", async () => {
    const { axe } = apartmentsAXE();
    const first = await json<NeedsInputResult>(
      await call(
        axe,
        "POST",
        "/axe/actions/applications.submit",
        { input: { unitId: "u_204" }, idempotencyKey: "k1" },
        USER,
      ),
    );
    const wrongKind = await json<ErrorResult>(
      await call(
        axe,
        "POST",
        "/axe/continue",
        {
          continuationToken: first.continuationToken,
          kind: WIRE.kind.paymentCard,
          payload: { token: "t", provider: "stripe" },
        },
        USER,
      ),
    );
    expect(wrongKind.error.code).toBe(WIRE.error.invalidInput);
    expect(wrongKind.error.details!.issues![0]!.path).toBe("/kind");
    const badPayload = await call(
      axe,
      "POST",
      "/axe/continue",
      {
        continuationToken: first.continuationToken,
        kind: WIRE.kind.paymentAchDebit,
        payload: { ...ACH, routingNumber: "12", accountType: "money-market" },
      },
      USER,
    );
    expect(badPayload.status).toBe(400);
    const bp = await json<ErrorResult>(badPayload);
    expect(bp.error.code).toBe(WIRE.error.invalidInput);
    expect(bp.error.details!.issues!.map((i) => i.path).sort()).toEqual([
      "/payload/accountType",
      "/payload/routingNumber",
    ]);
    // Token still usable.
    const good = await json<Result>(
      await call(
        axe,
        "POST",
        "/axe/continue",
        {
          continuationToken: first.continuationToken,
          kind: WIRE.kind.paymentAchDebit,
          payload: ACH,
        },
        USER,
      ),
    );
    expect(good.status).toBe("ok");
  });

  it("needs_input → fallback handoff → resume → ok [P-HAND-4] [P-HAND-6]", async () => {
    const { axe } = apartmentsAXE();
    const first = await json<NeedsInputResult>(
      await call(
        axe,
        "POST",
        "/axe/actions/applications.submit",
        { input: { unitId: "u_118" }, idempotencyKey: "k1" },
        USER,
      ),
    );
    const resumed = await json<OkResult<{ applicationId: string }>>(
      await call(axe, "POST", "/axe/resume", { resumeToken: first.fallback!.resumeToken }, USER),
    );
    expect(resumed.status).toBe("ok");
    const again = await json<ErrorResult>(
      await call(axe, "POST", "/axe/resume", { resumeToken: first.fallback!.resumeToken }, USER),
    );
    expect(again.error.code).toBe(WIRE.error.conflict);
  });

  it("a gated handoff refuses resume until completeHandoff is called [P-HAND-5]", async () => {
    const { axe, state } = apartmentsAXE();
    const h = await json<NeedsHumanResult>(
      await call(
        axe,
        "POST",
        "/axe/actions/leases.sign",
        { input: { applicationId: "APP-1" }, idempotencyKey: "k" },
        USER,
      ),
    );
    const early = await json<ErrorResult>(
      await call(axe, "POST", "/axe/resume", { resumeToken: h.handoff.resumeToken }, USER),
    );
    expect(early.error.code).toBe(WIRE.error.conflict);
    expect(early.error.retryable).toBe(true);
    expect(early.error.details!["handoffStatus"]).toBe("open");
    const id = new URL(h.handoff.url).searchParams.get(WIRE.query.handoff)!;
    expect(await axe.completeHandoff(id, { data: { signedBy: "Dana" } })).toBe(true);
    expect(await axe.completeHandoff("nope")).toBe(false);
    const done = await json<OkResult<{ leaseId: string }>>(
      await call(axe, "POST", "/axe/resume", { resumeToken: h.handoff.resumeToken }, USER),
    );
    expect(done.status).toBe("ok");
    expect(state.leaseSignatures.has("APP-1")).toBe(true);
  });

  it("tokens bound to a user are rejected for another user [P-TOK-2]", async () => {
    const { axe } = apartmentsAXE();
    const first = await json<NeedsInputResult>(
      await call(
        axe,
        "POST",
        "/axe/actions/applications.submit",
        { input: { unitId: "u_204" }, idempotencyKey: "k1" },
        USER,
      ),
    );
    const other = await json<ErrorResult>(
      await call(
        axe,
        "POST",
        "/axe/continue",
        {
          continuationToken: first.continuationToken,
          kind: WIRE.kind.paymentAchDebit,
          payload: ACH,
        },
        { Authorization: "Bearer user:mallory" },
      ),
    );
    expect(other.error.code).toBe(WIRE.error.notFound);
    const anon = await json<ErrorResult>(
      await call(axe, "POST", "/axe/continue", {
        continuationToken: first.continuationToken,
        kind: WIRE.kind.paymentAchDebit,
        payload: ACH,
      }),
    );
    expect(anon.error.code).toBe(WIRE.error.notFound);
  });

  it("tampered and forged tokens are not_found, never conflict [P-TOK-3]", async () => {
    const { axe } = apartmentsAXE();
    const first = await json<NeedsInputResult>(
      await call(
        axe,
        "POST",
        "/axe/actions/applications.submit",
        { input: { unitId: "u_204" }, idempotencyKey: "k1" },
        USER,
      ),
    );
    const [body, sig] = first.continuationToken.split(".") as [string, string];
    // Replace the second-to-last character with one that differs from it, so the body always changes.
    const victim = body[body.length - 2];
    const flipped = body.slice(0, -2) + (victim === "A" ? "B" : "A") + body.slice(-1);
    for (const token of [
      `${flipped}.${sig}`,
      // The first signature character is fully significant; the last carries base64url padding bits.
      `${body}.${sig.startsWith("A") ? "B" : "A"}${sig.slice(1)}`,
      "garbage",
      "",
      `${body}`,
    ]) {
      const r = await json<ErrorResult>(
        await call(
          axe,
          "POST",
          "/axe/continue",
          { continuationToken: token, kind: WIRE.kind.paymentAchDebit, payload: ACH },
          USER,
        ),
      );
      expect(r.error.code, token).toBe(WIRE.error.notFound);
    }
    // A continuation token presented as a resume token is also not_found.
    const cross = await json<ErrorResult>(
      await call(axe, "POST", "/axe/resume", { resumeToken: first.continuationToken }, USER),
    );
    expect(cross.error.code).toBe(WIRE.error.notFound);
  });

  it("expired tokens are rejected [P-TOK-3]", async () => {
    const { axe } = apartmentsAXE();
    axe.register(
      (await import("../src/index")).action("quick.expire", {
        title: "Expires fast",
        description:
          "Test action whose continuation token expires immediately, used to verify expiry handling.",
        risk: "low",
        input: (await import("../src/index")).z.object({}),
        output: (await import("../src/index")).z.object({
          done: (await import("../src/index")).z.boolean(),
        }),
        handler: async ({ needsInput }) =>
          needsInput({
            reason: "x_required",
            message: "Need an email address to continue.",
            accepts: [
              (await import("../src/index")).accept(
                (await import("../src/index")).kinds.contact.email,
              ),
            ],
            ttlSeconds: 1,
          }),
        onContinue: async () => ({ done: true }),
      }),
    );
    const first = await json<NeedsInputResult>(
      await call(axe, "POST", "/axe/actions/quick.expire", { input: {}, idempotencyKey: "k" }),
    );
    await new Promise((r) => setTimeout(r, 1100));
    const r = await json<ErrorResult>(
      await call(axe, "POST", "/axe/continue", {
        continuationToken: first.continuationToken,
        kind: WIRE.kind.contactEmail,
        payload: { email: "a@b.co" },
      }),
    );
    expect(r.error.code).toBe(WIRE.error.notFound);
  });
});

describe("login handoff for user actions [P-AUTH-4] [P-HAND-7]", () => {
  it("returns login_required, then runs the action as the signed-in user after completion", async () => {
    const { axe, state } = apartmentsAXE();
    const h = await json<NeedsHumanResult>(
      await call(axe, "POST", "/axe/actions/tours.book", {
        input: { unitId: "u_204", at: "2026-10-02T17:00:00Z" },
        idempotencyKey: "k",
      }),
    );
    expect(h.status).toBe("needs_human");
    expect(h.handoff.reason).toBe(WIRE.reason.loginRequired);
    expect(h.handoff.url.startsWith("https://oakridge-rentals.example/login?")).toBe(true);
    const early = await json<ErrorResult>(
      await call(axe, "POST", "/axe/resume", { resumeToken: h.handoff.resumeToken }),
    );
    expect(early.error.code).toBe(WIRE.error.conflict);
    const id = new URL(h.handoff.url).searchParams.get(WIRE.query.handoff)!;
    await axe.completeHandoff(id, { onBehalfOf: "dana" });
    const done = await json<OkResult<{ tourId: string }>>(
      await call(axe, "POST", "/axe/resume", { resumeToken: h.handoff.resumeToken }),
    );
    expect(done.status).toBe("ok");
    expect(state.tours).toEqual([done.output.tourId]);
  });

  it("without a login URL, an anonymous call to a user action is unauthorized [P-AUTH-2]", async () => {
    const { axe } = apartmentsAXE({
      auth: { modes: ["none", "user"], authenticate: async () => null },
    });
    const r = await json<ErrorResult>(
      await call(axe, "POST", "/axe/actions/tours.book", {
        input: { unitId: "u_204", at: "2026-10-02T17:00:00Z" },
        idempotencyKey: "k",
      }),
    );
    expect(r.error.code).toBe(WIRE.error.unauthorized);
  });

  it("onBehalfOf in the body is ignored; handlers see the authenticated identity [P-INV-3] [P-AUTH-5]", async () => {
    const { axe } = apartmentsAXE();
    let seen: string | undefined;
    axe.register(
      (await import("../src/index")).action("who.ami", {
        title: "Who am I",
        description:
          "Test action that reports the authenticated identity the runtime established for the request.",
        readOnly: true,
        risk: "none",
        auth: "user",
        input: (await import("../src/index")).z.object({}),
        output: (await import("../src/index")).z.object({
          who: (await import("../src/index")).z.string(),
        }),
        handler: async ({ context }) => {
          seen = context.onBehalfOf;
          return { who: context.onBehalfOf ?? "" };
        },
      }),
    );
    const r = await json<OkResult<{ who: string }>>(
      await call(
        axe,
        "POST",
        "/axe/actions/who.ami",
        { input: {}, context: { onBehalfOf: "mallory" } },
        USER,
      ),
    );
    expect(r.output.who).toBe("dana");
    expect(seen).toBe("dana");
  });
});

describe("idempotency [P-IDEM-1..4]", () => {
  it("requires a key on mutating actions", async () => {
    const { axe } = apartmentsAXE();
    const r = await json<ErrorResult>(
      await call(
        axe,
        "POST",
        "/axe/actions/tours.book",
        { input: { unitId: "u_204", at: "2026-10-02T17:00:00Z" } },
        USER,
      ),
    );
    expect(r.error.code).toBe(WIRE.error.invalidInput);
    expect(r.error.details!.issues![0]!.path).toBe("/idempotencyKey");
  });

  it("replays the original result for the same key and input, and conflicts on different input", async () => {
    const { axe, state } = apartmentsAXE();
    const input = { unitId: "u_204", at: "2026-10-02T17:00:00Z" };
    const a = await json<OkResult<{ tourId: string }>>(
      await call(axe, "POST", "/axe/actions/tours.book", { input, idempotencyKey: "same" }, USER),
    );
    const b = await json<OkResult<{ tourId: string }>>(
      await call(axe, "POST", "/axe/actions/tours.book", { input, idempotencyKey: "same" }, USER),
    );
    expect(b.output.tourId).toBe(a.output.tourId);
    expect(state.tours).toHaveLength(1);
    const c = await json<ErrorResult>(
      await call(
        axe,
        "POST",
        "/axe/actions/tours.book",
        { input: { ...input, at: "2026-10-03T17:00:00Z" }, idempotencyKey: "same" },
        USER,
      ),
    );
    expect(c.error.code).toBe(WIRE.error.conflict);
    // A different user with the same key is a different scope.
    const d = await json<OkResult<{ tourId: string }>>(
      await call(
        axe,
        "POST",
        "/axe/actions/tours.book",
        { input, idempotencyKey: "same" },
        { Authorization: "Bearer user:lee" },
      ),
    );
    expect(d.output.tourId).not.toBe(a.output.tourId);
  });

  it("can be made optional", async () => {
    const { axe } = apartmentsAXE({ requireIdempotencyKey: false });
    const r = await json<Result>(
      await call(
        axe,
        "POST",
        "/axe/actions/tours.book",
        { input: { unitId: "u_204", at: "2026-10-02T17:00:00Z" } },
        USER,
      ),
    );
    expect(r.status).toBe("ok");
  });
});

describe("events [E-1..4]", () => {
  it("emits exactly one event per request with ladder values for every transition", async () => {
    const events: AXEEvent[] = [];
    const { axe } = apartmentsAXE({ onEvent: (e) => void events.push(e) });
    await call(axe, "GET", "/.well-known/axe.json");
    await call(axe, "POST", "/axe/actions/units.search", {
      input: { location: "x" },
      context: { agent: { name: "TestAgent", version: "1.0", vendor: "Acme" } },
    });
    const ni = await json<NeedsInputResult>(
      await call(
        axe,
        "POST",
        "/axe/actions/applications.submit",
        { input: { unitId: "u_204" }, idempotencyKey: "k" },
        USER,
      ),
    );
    await call(
      axe,
      "POST",
      "/axe/continue",
      { continuationToken: ni.continuationToken, kind: WIRE.kind.paymentAchDebit, payload: ACH },
      USER,
    );
    const nh = await json<NeedsHumanResult>(
      await call(
        axe,
        "POST",
        "/axe/actions/leases.sign",
        { input: { applicationId: "A" }, idempotencyKey: "k2" },
        USER,
      ),
    );
    const id = new URL(nh.handoff.url).searchParams.get(WIRE.query.handoff)!;
    await axe.completeHandoff(id);
    await call(axe, "POST", "/axe/resume", { resumeToken: nh.handoff.resumeToken }, USER);
    await call(axe, "POST", "/axe/actions/nope.x", { input: {} });
    await new Promise((r) => setTimeout(r, 0));
    expect(events.map((e) => e.ladder)).toEqual([
      WIRE.ladder.ok,
      WIRE.ladder.needsInput,
      WIRE.ladder.continued,
      WIRE.ladder.needsHuman,
      WIRE.ladder.resumed,
      WIRE.ladder.error,
    ]);
    expect(events[0]!.agent).toEqual({ vendor: "Acme", name: "TestAgent", version: "1.0" });
    expect(events[1]!.kind).toBe(WIRE.kind.paymentAchDebit);
    expect(events[2]!.status).toBe("ok");
    expect(events[2]!.action).toBe("applications.submit");
    expect(events[5]!.errorCode).toBe(WIRE.error.notFound);
    for (const e of events) {
      expect(e.schemaVersion).toBe(1);
      expect(Object.keys(e).sort()).toEqual([
        "action",
        "agent",
        "errorCode",
        "kind",
        "ladder",
        "latencyMs",
        "schemaVersion",
        "status",
        "tenant",
        "ts",
      ]);
      expect(JSON.stringify(e)).not.toContain("dana");
      expect(JSON.stringify(e)).not.toContain(ACH.accountNumber);
    }
  });

  it("parses the recommended User-Agent form when context.agent is absent", async () => {
    const events: AXEEvent[] = [];
    const { axe } = apartmentsAXE({ onEvent: (e) => void events.push(e) });
    await call(
      axe,
      "POST",
      "/axe/actions/units.search",
      { input: { location: "x" } },
      { "User-Agent": "AcmeAgent/2.1 (+https://acme.example; axe/0.1)" },
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(events[0]!.agent).toEqual({ name: "AcmeAgent", version: "2.1" });
  });

  it("a failing sink never affects the response [E-3]", async () => {
    const { axe } = apartmentsAXE({
      onEvent: () => {
        throw new Error("sink down");
      },
    });
    const r = await call(axe, "POST", "/axe/actions/units.search", { input: { location: "x" } });
    expect(r.status).toBe(200);
  });
});

describe("hooks and policies", () => {
  it("onRequest can short-circuit with rate_limited and Retry-After is set [P-INV-8]", async () => {
    const { axe } = apartmentsAXE({
      onRequest: () => fail(WIRE.error.rateLimited, "Slow down.", { details: { retryAfter: 30 } }),
    });
    const res = await call(axe, "POST", "/axe/actions/units.search", { input: { location: "x" } });
    expect(res.status).toBe(429);
    expect(res.headers.get(WIRE.header.retryAfter)).toBe("30");
    expect((await json<ErrorResult>(res)).error.retryable).toBe(true);
  });

  it("policies.agents deny wins over allow and is enforced [P-DISC-11] [P-DISC-12]", async () => {
    const { axe } = apartmentsAXE({ policies: { agents: { allow: ["*"], deny: ["ScraperCo"] } } });
    const denied = await json<ErrorResult>(
      await call(axe, "POST", "/axe/actions/units.search", {
        input: { location: "x" },
        context: { agent: { name: "S", vendor: "scraperco" } },
      }),
    );
    expect(denied.error.code).toBe(WIRE.error.forbidden);
    const fine = await json<Result>(
      await call(axe, "POST", "/axe/actions/units.search", {
        input: { location: "x" },
        context: { agent: { name: "S", vendor: "Acme" } },
      }),
    );
    expect(fine.status).toBe("ok");
  });

  it("thrown errors become a generic internal error and reach onError [P-ERR-2]", async () => {
    let captured: unknown;
    const { axe } = apartmentsAXE({ onError: (_c, e) => void (captured = e) });
    const core = await import("../src/index");
    axe.register(
      core.action("boom.now", {
        title: "Boom",
        description:
          "Test action that throws to verify the runtime hides internals from agents and reports them to onError.",
        readOnly: true,
        risk: "none",
        input: core.z.object({}),
        output: core.z.object({}),
        handler: async () => {
          throw new Error("db password is hunter2");
        },
      }),
    );
    const res = await call(axe, "POST", "/axe/actions/boom.now", { input: {} });
    expect(res.status).toBe(500);
    const body = await json<ErrorResult>(res);
    expect(body.error.code).toBe(WIRE.error.internal);
    expect(JSON.stringify(body)).not.toContain("hunter2");
    expect((captured as Error).message).toContain("hunter2");
  });

  it("output that violates the output schema is an internal error, not a leak", async () => {
    const { axe } = apartmentsAXE();
    const core = await import("../src/index");
    axe.register(
      core.action("bad.output", {
        title: "Bad output",
        description:
          "Test action returning output that does not match its declared schema, to verify server-side validation.",
        readOnly: true,
        risk: "none",
        input: core.z.object({}),
        output: core.z.object({ n: core.z.number() }),
        handler: async () => ({ n: "nope" }) as never,
      }),
    );
    const body = await json<ErrorResult>(
      await call(axe, "POST", "/axe/actions/bad.output", { input: {} }),
    );
    expect(body.error.code).toBe(WIRE.error.internal);
  });
});
