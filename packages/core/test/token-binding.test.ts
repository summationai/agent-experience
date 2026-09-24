/**
 * Token authorization (spec [P-TOK-6], [P-TOK-7], [P-POLL-1]): every use of a continuation, resume,
 * or poll token is checked against the tenant and the principal it was minted for, before any hook
 * runs and before any stored result is returned, and every refusal looks like an unknown token.
 */
import { describe, expect, it } from "vitest";
import { createAXE, action, z } from "../src/index";
import type { AXEConfig, ActionProvider, RegisteredAction, TenantInfo } from "../src/index";
import type {
  ErrorResult,
  NeedsHumanResult,
  NeedsInputResult,
  PendingResult,
  Result,
} from "../src/types";
import { WIRE } from "../src/vocabulary";

const SECRET = "0123456789abcdef0123456789abcdef";
const BASE = "https://review.example";
const requirement = {
  reason: "more_info",
  message: "Provide a test value.",
  accepts: [
    { kind: "x-review.value", description: "Test value", schema: z.string(), sensitive: false },
  ],
};
const spec = {
  title: "Test action",
  description: "Performs a test operation and returns the observed execution result for review.",
  risk: "low" as const,
  input: z.object({}),
  output: z.object({ value: z.string() }),
};

function tenantsOf(...ids: string[]): Record<string, TenantInfo> {
  return Object.fromEntries(
    ids.map((id) => [id, { id, name: `Tenant ${id}`, baseUrl: `${BASE}/${id}` }]),
  );
}

async function send(
  axe: ReturnType<typeof createAXE>,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: Result }> {
  const url = path.startsWith("http") ? path : BASE + path;
  const res = await axe.handle(
    new Request(url, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
  return { status: res.status, body: (await res.json()) as Result };
}

/** The refusal an unknown token gets; every authorization failure must look exactly like it. */
async function unknownShape(
  axe: ReturnType<typeof createAXE>,
  type: "continue" | "resume" | "poll",
  headers: Record<string, string> = {},
) {
  if (type === "continue")
    return send(
      axe,
      "POST",
      "/axe/continue",
      { continuationToken: "nope.nope", kind: "x-review.value", payload: "x" },
      headers,
    );
  if (type === "resume")
    return send(axe, "POST", "/axe/resume", { resumeToken: "nope.nope" }, headers);
  return send(axe, "GET", `/axe/poll/nope.nope`, undefined, headers);
}

describe("tenant binding [P-TOK-6]", () => {
  // Two tenants, each with a local user named alice: the user id alone never crosses tenants.
  function platform() {
    const tenants = tenantsOf("A", "B");
    const calls = { cont: 0, resume: 0, poll: 0 };
    const axe = createAXE({
      name: "Review",
      description: "Review test application for checking action execution and authentication.",
      baseUrl: BASE,
      secret: SECRET,
      auth: {
        modes: ["user"],
        authenticate: (r) =>
          r.headers.get("authorization") === "Bearer alice" ? { onBehalfOf: "alice" } : null,
      },
      tenant: (r) => tenants[r.headers.get("x-tenant") ?? "A"] ?? null,
    });
    axe.register(
      action("test.flow", {
        ...spec,
        auth: "user",
        input: z.object({ step: z.enum(["ask", "hand", "wait"]) }),
        handler: async ({ input, needsInput, handoff, pending }) =>
          input.step === "ask"
            ? needsInput(requirement)
            : input.step === "hand"
              ? handoff({
                  reason: "signature_required",
                  instructions: "Sign the form on the site.",
                  url: `${BASE}/sign`,
                  whatAgentShouldSayToUser: "The site needs your signature on its page.",
                })
              : pending({ retryAfter: 1 }),
        onContinue: async ({ tenant }) => {
          calls.cont++;
          return { value: `private-${tenant?.id}` };
        },
        onResume: async ({ tenant }) => {
          calls.resume++;
          return { value: `private-${tenant?.id}` };
        },
        onPoll: async ({ tenant }) => {
          calls.poll++;
          return { value: `private-${tenant?.id}` };
        },
      }),
    );
    return { axe, calls };
  }
  const alice = (tenant: string) => ({ authorization: "Bearer alice", "x-tenant": tenant });

  it("a continuation minted on tenant A is not_found on tenant B for the same local user id, and nothing runs", async () => {
    const { axe, calls } = platform();
    const ni = (
      await send(
        axe,
        "POST",
        "/axe/actions/test.flow",
        { input: { step: "ask" }, idempotencyKey: "k" },
        alice("A"),
      )
    ).body as NeedsInputResult;
    const other = await send(
      axe,
      "POST",
      "/axe/continue",
      { continuationToken: ni.continuationToken, kind: "x-review.value", payload: "x" },
      alice("B"),
    );
    expect(other).toEqual(await unknownShape(axe, "continue", alice("B")));
    expect(calls.cont).toBe(0);
    // Still usable where it was minted.
    const own = await send(
      axe,
      "POST",
      "/axe/continue",
      { continuationToken: ni.continuationToken, kind: "x-review.value", payload: "x" },
      alice("A"),
    );
    expect(own.body).toEqual({ status: "ok", output: { value: "private-A" } });
    // Once used, the stored result is not returned on B either.
    const replayB = await send(
      axe,
      "POST",
      "/axe/continue",
      { continuationToken: ni.continuationToken, kind: "x-review.value", payload: "x" },
      alice("B"),
    );
    expect(replayB).toEqual(await unknownShape(axe, "continue", alice("B")));
  });

  it("a resume token minted on tenant A is not_found on tenant B, before and after use", async () => {
    const { axe, calls } = platform();
    const h = (
      await send(
        axe,
        "POST",
        "/axe/actions/test.flow",
        { input: { step: "hand" }, idempotencyKey: "k" },
        alice("A"),
      )
    ).body as NeedsHumanResult;
    const before = await send(
      axe,
      "POST",
      "/axe/resume",
      { resumeToken: h.handoff.resumeToken },
      alice("B"),
    );
    expect(before).toEqual(await unknownShape(axe, "resume", alice("B")));
    expect(calls.resume).toBe(0);
    expect(
      (await send(axe, "POST", "/axe/resume", { resumeToken: h.handoff.resumeToken }, alice("A")))
        .body.status,
    ).toBe("ok");
    const after = await send(
      axe,
      "POST",
      "/axe/resume",
      { resumeToken: h.handoff.resumeToken },
      alice("B"),
    );
    expect(after).toEqual(await unknownShape(axe, "resume", alice("B")));
  });

  it("a poll token minted on tenant A is not_found on tenant B, pending and terminal", async () => {
    const { axe, calls } = platform();
    const p = (
      await send(
        axe,
        "POST",
        "/axe/actions/test.flow",
        { input: { step: "wait" }, idempotencyKey: "k" },
        alice("A"),
      )
    ).body as PendingResult;
    const path = new URL(p.pollUrl).pathname.replace(/^\/A/, "");
    const pendingB = await send(axe, "GET", path, undefined, alice("B"));
    expect(pendingB).toEqual(await unknownShape(axe, "poll", alice("B")));
    expect(calls.poll).toBe(0);
    expect((await send(axe, "GET", path, undefined, alice("A"))).body).toEqual({
      status: "ok",
      output: { value: "private-A" },
    });
    const terminalB = await send(axe, "GET", path, undefined, alice("B"));
    expect(terminalB).toEqual(await unknownShape(axe, "poll", alice("B")));
  });

  it("completeHandoff refuses a handoff minted for another tenant", async () => {
    const { axe } = platform();
    const h = (
      await send(
        axe,
        "POST",
        "/axe/actions/test.flow",
        { input: { step: "hand" }, idempotencyKey: "k" },
        alice("A"),
      )
    ).body as NeedsHumanResult;
    const id = new URL(h.handoff.url).searchParams.get(WIRE.query.handoff)!;
    expect(await axe.completeHandoff(id, { tenant: "B" })).toBe(false);
    expect(await axe.completeHandoff(id)).toBe(false);
    expect(await axe.completeHandoff(id, { tenant: "A", onBehalfOf: "alice" })).toBe(true);
  });
});

describe("principal binding [P-TOK-6]", () => {
  function server(overrides: Partial<AXEConfig> = {}) {
    let runs = 0;
    const axe = createAXE({
      name: "Review",
      description: "Review test application for checking action execution and authentication.",
      baseUrl: BASE,
      secret: SECRET,
      auth: {
        modes: ["none", "user"],
        userLoginUrl: `${BASE}/login`,
        authenticate: (r) => {
          const m = /^Bearer (\w+)$/.exec(r.headers.get("authorization") ?? "");
          return m ? { onBehalfOf: m[1]! } : null;
        },
      },
      ...overrides,
    });
    axe.register(
      action("test.ask", {
        ...spec,
        auth: "user",
        handler: async ({ needsInput }) => needsInput(requirement),
        onContinue: async ({ context }) => {
          runs++;
          return { value: `for ${context.onBehalfOf}` };
        },
      }),
    );
    axe.register(
      action("test.public", {
        ...spec,
        handler: async ({ needsInput }) => needsInput(requirement),
        onContinue: async ({ context }) => {
          runs++;
          return { value: `for ${context.onBehalfOf ?? "anyone"}` };
        },
      }),
    );
    axe.register(
      action("test.login", {
        ...spec,
        auth: "user",
        handler: async ({ context }) => {
          runs++;
          return { value: `booked for ${context.onBehalfOf}` };
        },
      }),
    );
    return { axe, runs: () => runs };
  }

  it("wrong user and anonymous presentations get exactly the unknown-token response, and nothing runs", async () => {
    const { axe, runs } = server();
    const ni = (
      await send(
        axe,
        "POST",
        "/axe/actions/test.ask",
        { input: {}, idempotencyKey: "k" },
        { authorization: "Bearer alice" },
      )
    ).body as NeedsInputResult;
    const body = { continuationToken: ni.continuationToken, kind: "x-review.value", payload: "x" };
    expect(await send(axe, "POST", "/axe/continue", body, { authorization: "Bearer bob" })).toEqual(
      await unknownShape(axe, "continue"),
    );
    expect(await send(axe, "POST", "/axe/continue", body)).toEqual(
      await unknownShape(axe, "continue"),
    );
    expect(runs()).toBe(0);
    expect(
      (await send(axe, "POST", "/axe/continue", body, { authorization: "Bearer alice" })).body,
    ).toEqual({ status: "ok", output: { value: "for alice" } });
    // The stored result is never replayed to another principal.
    expect(await send(axe, "POST", "/axe/continue", body, { authorization: "Bearer bob" })).toEqual(
      await unknownShape(axe, "continue"),
    );
    expect(runs()).toBe(1);
  });

  it("a token minted anonymously is not usable by a signed-in caller, which would change who it runs as", async () => {
    const { axe, runs } = server();
    const ni = (
      await send(axe, "POST", "/axe/actions/test.public", { input: {}, idempotencyKey: "k" })
    ).body as NeedsInputResult;
    const body = { continuationToken: ni.continuationToken, kind: "x-review.value", payload: "x" };
    expect(await send(axe, "POST", "/axe/continue", body, { authorization: "Bearer bob" })).toEqual(
      await unknownShape(axe, "continue"),
    );
    expect(runs()).toBe(0);
    expect((await send(axe, "POST", "/axe/continue", body)).body).toEqual({
      status: "ok",
      output: { value: "for anyone" },
    });
  });

  it("the login handoff is the one identity transition: anonymous to the user the site recorded", async () => {
    const { axe, runs } = server();
    const h = (
      await send(axe, "POST", "/axe/actions/test.login", { input: {}, idempotencyKey: "k" })
    ).body as NeedsHumanResult;
    expect(h.handoff.reason).toBe(WIRE.reason.loginRequired);
    const id = new URL(h.handoff.url).searchParams.get(WIRE.query.handoff)!;
    expect(await axe.completeHandoff(id, { onBehalfOf: "dana" })).toBe(true);
    // A second completion cannot switch the user.
    expect(await axe.completeHandoff(id, { onBehalfOf: "mallory" })).toBe(false);
    // Presented with another user's credential, the token is unknown.
    expect(
      await send(
        axe,
        "POST",
        "/axe/resume",
        { resumeToken: h.handoff.resumeToken },
        { authorization: "Bearer mallory" },
      ),
    ).toEqual(await unknownShape(axe, "resume", { authorization: "Bearer mallory" }));
    expect(runs()).toBe(0);
    // Anonymous (the agent that started it) or dana herself may resume.
    const done = await send(axe, "POST", "/axe/resume", { resumeToken: h.handoff.resumeToken });
    expect(done.body).toEqual({ status: "ok", output: { value: "booked for dana" } });
    const again = await send(
      axe,
      "POST",
      "/axe/resume",
      { resumeToken: h.handoff.resumeToken },
      { authorization: "Bearer dana" },
    );
    expect(again.body).toEqual(done.body);
    expect(runs()).toBe(1);
    // After use, completion can no longer be recorded.
    expect(await axe.completeHandoff(id, { onBehalfOf: "dana" })).toBe(false);
  });

  it("completeHandoff refuses a different user on a handoff bound to a user", async () => {
    const { axe } = server();
    axe.register(
      action("test.sign", {
        ...spec,
        auth: "user",
        handler: async ({ handoff }) =>
          handoff({
            reason: "signature_required",
            instructions: "Sign the form on the site.",
            url: `${BASE}/sign`,
            whatAgentShouldSayToUser: "The site needs your signature on its page.",
          }),
        onResume: async ({ completion }) => ({ value: String(completion?.onBehalfOf) }),
      }),
    );
    const h = (
      await send(
        axe,
        "POST",
        "/axe/actions/test.sign",
        { input: {}, idempotencyKey: "k" },
        { authorization: "Bearer alice" },
      )
    ).body as NeedsHumanResult;
    const id = new URL(h.handoff.url).searchParams.get(WIRE.query.handoff)!;
    expect(await axe.completeHandoff(id, { onBehalfOf: "bob" })).toBe(false);
    expect(await axe.completeHandoff(id, { onBehalfOf: "alice" })).toBe(true);
  });
});

describe("poll authorization [P-POLL-1]", () => {
  function server(providerActions?: { current: RegisteredAction[] }) {
    let polls = 0;
    const axe = createAXE({
      name: "Review",
      description: "Review test application for checking action execution and authentication.",
      baseUrl: BASE,
      secret: SECRET,
      auth: {
        modes: ["none", "user", "site"],
        authenticate: (r) =>
          r.headers.get("authorization") === "Bearer alice" ? { onBehalfOf: "alice" } : null,
        verifySiteKey: (key) =>
          key === "partner-key" ? { id: "partner" } : key === "other-key" ? { id: "other" } : false,
      },
    });
    const pendingAction = (name: string, auth: "user" | "site") =>
      action(name, {
        ...spec,
        auth,
        handler: async ({ pending }) => pending({ retryAfter: 1 }),
        onPoll: async () => {
          polls++;
          return { value: "private result" };
        },
      });
    axe.register(pendingAction("test.user-wait", "user"));
    axe.register(pendingAction("test.site-wait", "site"));
    if (providerActions) {
      providerActions.current = [pendingAction("test.gone-wait", "user")];
      const provider: ActionProvider = { actions: () => providerActions.current };
      axe.addProvider(provider);
    }
    return { axe, polls: () => polls };
  }

  it("a user-authenticated terminal result is not returned anonymously or to another user", async () => {
    const { axe, polls } = server();
    const alice = { authorization: "Bearer alice" };
    const p = (
      await send(
        axe,
        "POST",
        "/axe/actions/test.user-wait",
        { input: {}, idempotencyKey: "k" },
        alice,
      )
    ).body as PendingResult;
    expect(await send(axe, "GET", p.pollUrl)).toEqual(await unknownShape(axe, "poll"));
    expect(polls()).toBe(0);
    expect((await send(axe, "GET", p.pollUrl, undefined, alice)).body).toEqual({
      status: "ok",
      output: { value: "private result" },
    });
    const anon = await send(axe, "GET", p.pollUrl);
    expect(anon).toEqual(await unknownShape(axe, "poll"));
    expect(JSON.stringify(anon)).not.toContain("private");
    expect((await send(axe, "GET", p.pollUrl, undefined, alice)).body.status).toBe("ok");
    expect(polls()).toBe(1);
  });

  it("a site-authenticated terminal result needs the same site key", async () => {
    const { axe } = server();
    const partner = { authorization: "Bearer partner-key" };
    const p = (
      await send(
        axe,
        "POST",
        "/axe/actions/test.site-wait",
        { input: {}, idempotencyKey: "k" },
        partner,
      )
    ).body as PendingResult;
    expect((await send(axe, "GET", p.pollUrl, undefined, partner)).body.status).toBe("ok");
    for (const headers of [
      {},
      { authorization: "Bearer other-key" },
      { authorization: "Bearer revoked" },
    ])
      expect(await send(axe, "GET", p.pollUrl, undefined, headers)).toEqual(
        await unknownShape(axe, "poll", headers),
      );
  });

  it("the terminal result of an action that has since been removed is still authorized", async () => {
    const holder = { current: [] as RegisteredAction[] };
    const { axe } = server(holder);
    const alice = { authorization: "Bearer alice" };
    const p = (
      await send(
        axe,
        "POST",
        "/axe/actions/test.gone-wait",
        { input: {}, idempotencyKey: "k" },
        alice,
      )
    ).body as PendingResult;
    const done = await send(axe, "GET", p.pollUrl, undefined, alice);
    expect(done.body.status).toBe("ok");
    holder.current = [];
    expect(await send(axe, "GET", p.pollUrl)).toEqual(await unknownShape(axe, "poll"));
    expect((await send(axe, "GET", p.pollUrl, undefined, alice)).body).toEqual(done.body);
  });
});

describe("site-key principals [P-TOK-7]", () => {
  function server(keys: Record<string, boolean | { id?: string; actions?: string[] }>) {
    const seen: unknown[] = [];
    let runs = 0;
    const axe = createAXE({
      name: "Review",
      description: "Review test application for checking action execution and authentication.",
      baseUrl: BASE,
      secret: SECRET,
      auth: {
        modes: ["site"],
        verifySiteKey: (key) => keys[key] ?? false,
        authenticate: (r) => {
          const u = r.headers.get("x-user");
          return u ? { onBehalfOf: u } : null;
        },
      },
    });
    axe.register(
      action("test.site", {
        ...spec,
        auth: "site",
        handler: async ({ needsInput, siteKey }) => {
          seen.push(siteKey);
          return needsInput(requirement);
        },
        onContinue: async ({ siteKey, context }) => {
          runs++;
          seen.push(siteKey);
          return { value: `${siteKey?.id}/${context.onBehalfOf ?? "-"}` };
        },
      }),
    );
    axe.register(
      action("test.write", {
        ...spec,
        auth: "site",
        handler: async ({ siteKey }) => {
          runs++;
          return { value: `written by ${siteKey?.id}` };
        },
      }),
    );
    return { axe, seen, runs: () => runs };
  }
  const bearer = (key: string, user?: string) => ({
    authorization: `Bearer ${key}`,
    ...(user ? { "x-user": user } : {}),
  });
  async function ask(axe: ReturnType<typeof createAXE>, headers: Record<string, string>) {
    return (
      await send(axe, "POST", "/axe/actions/test.site", { input: {}, idempotencyKey: "k" }, headers)
    ).body as NeedsInputResult;
  }
  const cont = (t: string) => ({ continuationToken: t, kind: "x-review.value", payload: "x" });

  it("a workflow started with a site key continues with the same key and the handler sees its id", async () => {
    const { axe, seen } = server({ "partner-key": { id: "partner" } });
    const ni = await ask(axe, bearer("partner-key"));
    const r = await send(
      axe,
      "POST",
      "/axe/continue",
      cont(ni.continuationToken),
      bearer("partner-key"),
    );
    expect(r.body).toEqual({ status: "ok", output: { value: "partner/-" } });
    expect(seen).toEqual([{ id: "partner" }, { id: "partner" }]);
  });

  it("another partner, a revoked key, a narrowed key, or no key gets the unknown-token response", async () => {
    const keys: Record<string, boolean | { id?: string; actions?: string[] }> = {
      "partner-key": { id: "partner" },
      "other-key": { id: "other" },
    };
    const { axe, runs } = server(keys);
    const ni = await ask(axe, bearer("partner-key"));
    const unknown = await unknownShape(axe, "continue");
    expect(
      await send(axe, "POST", "/axe/continue", cont(ni.continuationToken), bearer("other-key")),
    ).toEqual(unknown);
    expect(await send(axe, "POST", "/axe/continue", cont(ni.continuationToken))).toEqual(unknown);
    keys["partner-key"] = { id: "partner", actions: ["test.write"] };
    expect(
      await send(axe, "POST", "/axe/continue", cont(ni.continuationToken), bearer("partner-key")),
    ).toEqual(unknown);
    keys["partner-key"] = false;
    expect(
      await send(axe, "POST", "/axe/continue", cont(ni.continuationToken), bearer("partner-key")),
    ).toEqual(unknown);
    expect(runs()).toBe(0);
    keys["partner-key"] = { id: "partner" };
    expect(
      (await send(axe, "POST", "/axe/continue", cont(ni.continuationToken), bearer("partner-key")))
        .body.status,
    ).toBe("ok");
  });

  it("keys verified as `true` or without an id are scoped by a keyed hash, never shared, never stored raw", async () => {
    const { axe, seen, runs } = server({ "key-one": true, "key-two": {} });
    const ni = await ask(axe, bearer("key-one"));
    const unknown = await unknownShape(axe, "continue");
    expect(
      await send(axe, "POST", "/axe/continue", cont(ni.continuationToken), bearer("key-two")),
    ).toEqual(unknown);
    const ok = await send(
      axe,
      "POST",
      "/axe/continue",
      cont(ni.continuationToken),
      bearer("key-one"),
    );
    expect(ok.body.status).toBe("ok");
    const first = seen[0] as { id: string; derived?: true };
    expect(first.derived).toBe(true);
    expect(first.id).toMatch(/^key-[A-Za-z0-9_-]{20,}$/);
    expect(JSON.stringify(seen)).not.toContain("key-one");
    // The same idempotencyKey from two unrelated `true` keys is two operations, not a shared replay.
    const w1 = await send(
      axe,
      "POST",
      "/axe/actions/test.write",
      { input: {}, idempotencyKey: "same" },
      bearer("key-one"),
    );
    const w2 = await send(
      axe,
      "POST",
      "/axe/actions/test.write",
      { input: {}, idempotencyKey: "same" },
      bearer("key-two"),
    );
    expect(w1.body).not.toEqual(w2.body);
    expect(runs()).toBe(3);
  });

  it("a site key with a forwarded user binds both: the same key with another user, or without the user, is refused", async () => {
    const { axe } = server({ "partner-key": { id: "partner" } });
    const ni = await ask(axe, bearer("partner-key", "dana"));
    const unknown = await unknownShape(axe, "continue");
    expect(
      await send(
        axe,
        "POST",
        "/axe/continue",
        cont(ni.continuationToken),
        bearer("partner-key", "lee"),
      ),
    ).toEqual(unknown);
    expect(
      await send(axe, "POST", "/axe/continue", cont(ni.continuationToken), bearer("partner-key")),
    ).toEqual(unknown);
    const r = await send(
      axe,
      "POST",
      "/axe/continue",
      cont(ni.continuationToken),
      bearer("partner-key", "dana"),
    );
    expect(r.body).toEqual({ status: "ok", output: { value: "partner/dana" } });
  });

  it("a disallowed action is forbidden and a revoked key unauthorized on invoke [P-AUTH-2]", async () => {
    const { axe } = server({ narrow: { id: "n", actions: ["test.site"] } });
    const f = await send(
      axe,
      "POST",
      "/axe/actions/test.write",
      { input: {}, idempotencyKey: "k" },
      bearer("narrow"),
    );
    expect((f.body as ErrorResult).error.code).toBe(WIRE.error.forbidden);
    const u = await send(
      axe,
      "POST",
      "/axe/actions/test.write",
      { input: {}, idempotencyKey: "k" },
      bearer("revoked"),
    );
    expect((u.body as ErrorResult).error.code).toBe(WIRE.error.unauthorized);
  });
});
