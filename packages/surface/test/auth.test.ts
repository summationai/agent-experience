/**
 * Authorization and privacy at the seam ([S-AUTH-*], [S-PRV-*]): who may observe, read the ledger,
 * and act through the bridge, one surface per caller when the server hosts many, and what a
 * sensitive field's value may never reach. Every protected path is exercised over HTTP through
 * `axe.handle(new Request(...))`, not only through manifest flags.
 */
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createAXE } from "@summationai/axe-core";
import type { AuthConfig, TenantInfo } from "@summationai/axe-core";
import type {
  AXEActionEvent,
  ErrorResult,
  LiveState,
  Manifest,
  NeedsHumanResult,
  OkResult,
} from "@summationai/axe-core/types";
import { createSurface, describeEntry, surfaceAttributes } from "../src/index";
import type { Surface } from "../src/index";
import { scopedSurfaces, surfaceActions } from "../src/axe";
import type { SurfaceActionsOptions, SurfaceResolver } from "../src/axe";

const BASE = "http://localhost:5173";
const SECRET = "0123456789abcdef0123456789abcdef";
const SSN = "123-45-6789";

/** Bearer `user:<name>` is that user; bearer `key:<id>` is a site key. */
const authenticate: NonNullable<AuthConfig["authenticate"]> = (req) => {
  const m = /^Bearer user:(.+)$/.exec(req.headers.get("Authorization") ?? "");
  return m ? { onBehalfOf: m[1]! } : null;
};

function record(options: { sensitive?: boolean } = {}) {
  const s = createSurface({ app: "records" });
  const calls: string[] = [];
  let ssn = SSN;
  const sync = () =>
    s.register({
      id: "ssn",
      kind: "field",
      role: "textbox",
      name: "Social security number",
      value: ssn,
      ...(options.sensitive === false ? {} : { sensitive: true }),
      edit: {
        maxLength: 11,
        set: (text, actor) => {
          calls.push(`ssn:${actor}`);
          ssn = text;
          sync();
          s.bump();
        },
      },
    });
  sync();
  s.register({
    id: "save",
    kind: "action",
    role: "button",
    name: "Save the record",
    effect: { mutates: "record", risk: "low" },
    handler: (actor) => {
      calls.push(`save:${actor}`);
      s.bump();
    },
  });
  s.register({
    id: "archive",
    kind: "action",
    role: "button",
    name: "Archive the record",
    state: { available: false, reason: "the record has an open claim for Dana Reyes" },
    effect: { mutates: "record", risk: "high" },
    handler: () => undefined,
  });
  return { surface: s, calls };
}

function serve(
  source: Surface | SurfaceResolver,
  bridgeOptions: SurfaceActionsOptions = {},
  config: {
    auth?: AuthConfig;
    revision?: Surface;
    tenant?: (request: Request) => TenantInfo | null;
  } = {},
) {
  const events: AXEActionEvent[] = [];
  const axe = createAXE({
    name: "Records",
    description:
      "A records desk: observe the open record, edit its fields, and save or archive it under one revision.",
    baseUrl: BASE,
    auth: config.auth ?? { modes: ["none", "user"], authenticate },
    secret: SECRET,
    onActionEvent: (e) => void events.push(e),
    ...(config.revision ? { revision: config.revision.currentRev } : {}),
    ...(config.tenant ? { tenant: config.tenant } : {}),
  });
  axe.addProvider(surfaceActions(source, bridgeOptions));
  const raw = async (path: string, init: RequestInit = {}) => {
    const res = await axe.handle(new Request(`${BASE}${path}`, init));
    return { status: res.status, text: await res.text() };
  };
  const post = async (path: string, body: unknown, headers: Record<string, string> = {}) =>
    JSON.parse(
      (
        await raw(path, {
          method: "POST",
          headers: { "content-type": "application/json", ...headers },
          body: JSON.stringify(body),
        })
      ).text,
    ) as unknown;
  const act = (
    name: string,
    input: unknown,
    expectedRev: number | undefined,
    headers: Record<string, string> = {},
  ) =>
    post(
      `/axe/actions/${name}`,
      {
        input,
        idempotencyKey: crypto.randomUUID(),
        ...(expectedRev === undefined ? {} : { expectedRev }),
      },
      headers,
    );
  const state = async (headers: Record<string, string> = {}) =>
    JSON.parse((await raw("/axe/state", { headers })).text) as LiveState;
  const manifest = async (headers: Record<string, string> = {}) =>
    JSON.parse((await raw("/.well-known/axe.json", { headers })).text) as Manifest;
  const flush = () => new Promise((r) => setTimeout(r, 0));
  return { axe, raw, post, act, state, manifest, events, flush };
}

const as = (user: string) => ({ Authorization: `Bearer user:${user}` });

describe("who may observe and act through the bridge [S-AUTH-1] to [S-AUTH-3]", () => {
  it("every generated action defaults to auth user, and a public server refuses the provider rather than serving it", async () => {
    const { surface } = record();
    expect(
      surfaceActions(surface)
        .actions()
        .map((a) => [a.name, a.definition.auth]),
    ).toEqual([
      ["surface.observe", "user"],
      ["surface.ledger", "user"],
      ["surface.ssn", "user"],
      ["surface.save", "user"],
      ["surface.archive", "user"],
    ]);
    // createAXE's default is public ({ modes: ["none"] }): the provider is refused on the first
    // request instead of serving the surface to anyone.
    const axe = createAXE({
      name: "Records",
      description:
        "A records desk: observe the open record, edit its fields, and save or archive it under one revision.",
      baseUrl: BASE,
      secret: SECRET,
    });
    axe.addProvider(surfaceActions(surface));
    expect(() => axe.describe()).toThrow(/auth "user" is not in manifest auth\.modes \[none\]/);
    await expect(
      axe.handle(
        new Request(`${BASE}/axe/actions/surface.observe`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ input: {} }),
        }),
      ),
    ).rejects.toThrow(/not in manifest auth\.modes/);
    expect(() => surfaceActions(surface, { auth: "public" as never })).toThrow(/auth must be one/);
  });

  it("an anonymous request cannot observe, read the ledger, or act on a protected surface; a signed-in user can", async () => {
    const { surface, calls } = record({ sensitive: false });
    const { act, post, raw, state, manifest } = serve(surface, {}, { revision: surface });
    for (const [path, body] of [
      ["/axe/actions/surface.observe", { input: {} }],
      ["/axe/actions/surface.ledger", { input: {} }],
      ["/axe/actions/surface.ssn", { input: { text: "000-00-0000" }, expectedRev: 0 }],
      ["/axe/actions/surface.save", { input: {}, expectedRev: 0 }],
    ] as const) {
      const res = await raw(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, idempotencyKey: crypto.randomUUID() }),
      });
      const r = JSON.parse(res.text) as ErrorResult;
      expect([path, res.status, r.error.code]).toEqual([path, 401, "unauthorized"]);
      expect(res.text).not.toContain(SSN);
    }
    expect(calls).toEqual([]);
    expect(surface.ledger()).toEqual([]);
    // The anonymous views read nothing from the surface: no values, no reasons.
    const anonState = JSON.stringify(await state());
    const anonManifest = JSON.stringify(await manifest());
    for (const text of [anonState, anonManifest]) {
      expect(text).not.toContain(SSN);
      expect(text).not.toContain("Dana Reyes");
    }
    expect((await state()).actions["surface.archive"]).toEqual({ available: true });
    // Signed in, the same requests run as that user, and /axe/state reads the surface for them.
    const seen = (await post(
      "/axe/actions/surface.observe",
      { input: {} },
      as("dana"),
    )) as OkResult<{
      entries: { id: string; value?: unknown }[];
    }>;
    expect(seen.output.entries.find((e) => e.id === "ssn")!.value).toBe(SSN);
    expect((await state(as("dana"))).actions["surface.archive"]).toEqual({
      available: false,
      reason: "the record has an open claim for Dana Reyes",
    });
    const ok = (await act("surface.save", {}, 0, as("dana"))) as OkResult<{ actor: string }>;
    expect(ok.output.actor).toBe("dana");
    expect(calls).toEqual(["save:dana"]);
  });

  it("with a login page configured, an anonymous act is a login handoff and nothing runs", async () => {
    const { surface, calls } = record();
    const { act } = serve(
      surface,
      {},
      {
        auth: { modes: ["user"], authenticate, userLoginUrl: `${BASE}/login` },
        revision: surface,
      },
    );
    const r = (await act("surface.save", {}, 0)) as NeedsHumanResult;
    expect(r.status).toBe("needs_human");
    expect(r.handoff.reason).toBe("login_required");
    expect(calls).toEqual([]);
    expect(surface.ledger()).toEqual([]);
  });

  it("the read side and each entry can take their own mode: public observe, protected mutations, one public control", async () => {
    const { surface, calls } = record();
    const { act, post, manifest } = serve(
      surface,
      { read: "none", authFor: (e) => (e.id === "save" ? "none" : undefined) },
      { revision: surface },
    );
    const m = await manifest();
    expect(m.actions.map((a) => [a.name, a.auth])).toEqual([
      ["surface.observe", "none"],
      ["surface.ledger", "none"],
      ["surface.ssn", "user"],
      ["surface.save", "none"],
      ["surface.archive", "user"],
    ]);
    const seen = (await post("/axe/actions/surface.observe", { input: {} })) as OkResult<unknown>;
    expect(seen.status).toBe("ok");
    const edit = (await act("surface.ssn", { text: "000-00-0000" }, 0)) as ErrorResult;
    expect(edit.error.code).toBe("unauthorized");
    const save = (await act("surface.save", {}, 0)) as OkResult<{ actor: string }>;
    expect(save.output.actor).toBe("agent");
    expect(calls).toEqual(["save:agent"]);
  });

  it("site mode: no key is unauthorized, a key outside its allowlist is forbidden, a valid key acts", async () => {
    const { surface, calls } = record();
    const { act } = serve(
      surface,
      { auth: "site" },
      {
        auth: {
          modes: ["site"],
          verifySiteKey: (key) =>
            key === "key:partner" ? { id: "partner", actions: ["surface.save"] } : false,
        },
        revision: surface,
      },
    );
    expect(((await act("surface.save", {}, 0)) as ErrorResult).error.code).toBe("unauthorized");
    expect(
      ((await act("surface.save", {}, 0, { Authorization: "Bearer key:other" })) as ErrorResult)
        .error.code,
    ).toBe("unauthorized");
    expect(
      (
        (await act("surface.ssn", { text: "1" }, 0, {
          Authorization: "Bearer key:partner",
        })) as ErrorResult
      ).error.code,
    ).toBe("forbidden");
    const ok = (await act("surface.save", {}, 0, {
      Authorization: "Bearer key:partner",
    })) as OkResult<unknown>;
    expect(ok.status).toBe("ok");
    expect(calls).toEqual(["save:agent"]);
  });

  it("an explicitly public surface works as before", async () => {
    const { surface, calls } = record({ sensitive: false });
    const { act, post } = serve(surface, { auth: "none" }, { revision: surface });
    const seen = (await post("/axe/actions/surface.observe", { input: {} })) as OkResult<{
      entries: { id: string; value?: unknown }[];
    }>;
    expect(seen.output.entries.find((e) => e.id === "ssn")!.value).toBe(SSN);
    expect(((await act("surface.save", {}, 0)) as OkResult<unknown>).status).toBe("ok");
    expect(calls).toEqual(["save:agent"]);
  });
});

describe("one surface per caller [S-AUTH-4]", () => {
  /** The template: the application's shape, with no one's data in it. */
  function template() {
    const t = createSurface({ app: "notes" });
    t.register({
      id: "note",
      kind: "field",
      role: "textbox",
      name: "Private note",
      edit: { set: () => undefined },
    });
    t.register({
      id: "publish",
      kind: "action",
      role: "button",
      name: "Publish the note",
      effect: { mutates: "note" },
      handler: () => undefined,
    });
    return t;
  }
  function notes(key: string) {
    const s = createSurface({ app: "notes" });
    let note = "";
    const sync = () => {
      s.register({
        id: "note",
        kind: "field",
        role: "textbox",
        name: "Private note",
        value: note,
        edit: {
          set: (text) => {
            note = text;
            sync();
            s.bump();
          },
        },
      });
      s.register({
        id: "publish",
        kind: "action",
        role: "button",
        name: "Publish the note",
        state: note
          ? { available: true }
          : { available: false, reason: `nothing written by ${key}` },
        effect: { mutates: "note" },
        handler: () => {
          s.bump();
        },
      });
    };
    sync();
    return s;
  }
  const tenants = (req: Request): TenantInfo => {
    const id = req.headers.get("x-tenant") ?? "acme";
    return { id, name: id, baseUrl: BASE };
  };
  type Observed = OkResult<{ rev: number; entries: { id: string; value?: unknown }[] }>;

  it("two users see only their own state, values, and ledger; anonymous callers get nothing", async () => {
    const scopes = scopedSurfaces({ create: (key) => notes(key) });
    const { act, post, state, manifest } = serve(scopes.resolve, { template: template() });
    const noteOf = async (user: string) =>
      (
        (await post("/axe/actions/surface.observe", { input: {} }, as(user))) as Observed
      ).output.entries.find((e) => e.id === "note")!.value;
    const alice = (await act(
      "surface.note",
      { text: "alice's secret" },
      0,
      as("alice"),
    )) as OkResult<{
      rev: number;
    }>;
    expect(alice.output.rev).toBe(1);
    // Bob's surface is his own: at rev 0, empty, and his publish reports his own reason.
    expect(await noteOf("bob")).toBe("");
    expect(await noteOf("alice")).toBe("alice's secret");
    expect((await state(as("bob"))).actions["surface.publish"]).toMatchObject({
      available: false,
    });
    expect((await state(as("alice"))).actions["surface.publish"]).toEqual({ available: true });
    const bobLedger = (await post(
      "/axe/actions/surface.ledger",
      { input: {} },
      as("bob"),
    )) as OkResult<{
      entries: unknown[];
    }>;
    expect(bobLedger.output.entries).toEqual([]);
    // Bob acting at alice's revision is judged against his own surface.
    const stale = (await act("surface.publish", {}, 1, as("bob"))) as ErrorResult;
    expect(stale.error.code).toBe("conflict");
    expect(scopes.size()).toBe(2);
    // The manifest is the template: no user's value or reason appears anonymously.
    const anon = JSON.stringify(await manifest()) + JSON.stringify(await state());
    expect(anon).not.toContain("alice");
    expect(
      ((await post("/axe/actions/surface.observe", { input: {} })) as ErrorResult).error.code,
    ).toBe("unauthorized");
  });

  it("the same user on two tenants gets two surfaces", async () => {
    const scopes = scopedSurfaces({ create: (key) => notes(key) });
    const { act, post } = serve(scopes.resolve, { template: template() }, { tenant: tenants });
    await act("surface.note", { text: "acme only" }, 0, { ...as("dana"), "x-tenant": "acme" });
    const other = (await post(
      "/axe/actions/surface.observe",
      { input: {} },
      { ...as("dana"), "x-tenant": "globex" },
    )) as Observed;
    expect(other.output.entries.find((e) => e.id === "note")!.value).toBe("");
    expect(scopes.size()).toBe(2);
  });

  it("the cache is bounded by size and by idle time, and a caller with no scope is refused", async () => {
    let t = 0;
    const evicted: string[] = [];
    const scopes = scopedSurfaces({
      create: (key) => notes(key),
      max: 2,
      idleMs: 1000,
      now: () => t,
      onEvict: (key) => void evicted.push(key),
    });
    const ctx = (user: string | null) => ({
      identity: user ? { onBehalfOf: user } : null,
      tenant: null,
      siteKey: null,
      request: null,
    });
    const a = scopes.resolve(ctx("a"));
    expect(scopes.resolve(ctx("a"))).toBe(a);
    scopes.resolve(ctx("b"));
    scopes.resolve(ctx("c"));
    expect(evicted).toEqual([JSON.stringify([null, "a"])]);
    t = 5000;
    scopes.resolve(ctx("d"));
    expect(evicted).toHaveLength(3);
    expect(scopes.size()).toBe(1);
    expect(scopes.resolve(ctx(null))).toBeNull();
    // A resolver that returns nothing for a signed-in caller: forbidden, with no detail.
    const { post } = serve(() => null, { template: template() });
    expect(
      ((await post("/axe/actions/surface.observe", { input: {} }, as("x"))) as ErrorResult).error
        .code,
    ).toBe("forbidden");
  });

  it("a resolver without a template is refused at construction", () => {
    expect(() => surfaceActions(() => null)).toThrow(/needs `template`/);
  });
});

describe("sensitive values and ledger text [S-PRV-1] to [S-PRV-3]", () => {
  it("a sensitive field's value never appears in observe, describeEntry, or the DOM mirror, locally or over HTTP", async () => {
    const { surface } = record();
    const row = surface.observe().entries.find((e) => e.id === "ssn")!;
    expect(row.sensitive).toBe(true);
    expect("value" in row).toBe(false);
    for (const text of [
      JSON.stringify(surface.observe()),
      describeEntry(surface.get("ssn")!),
      describeEntry(row),
      JSON.stringify(surfaceAttributes(surface.get("ssn")!)),
      JSON.stringify(surface.attributesFor("ssn")),
    ])
      expect(text).not.toContain(SSN);
    expect(describeEntry(row)).toContain("value hidden");
    const host: { __surface?: { observe: () => unknown } } = {};
    surface.expose(host);
    expect(JSON.stringify(host.__surface!.observe())).not.toContain(SSN);
    const { post } = serve(surface, {}, { revision: surface });
    const r = (await post("/axe/actions/surface.observe", { input: {} }, as("dana"))) as OkResult<{
      entries: { id: string; sensitive?: boolean }[];
    }>;
    expect(r.output.entries.find((e) => e.id === "ssn")!.sensitive).toBe(true);
    expect(JSON.stringify(r)).not.toContain(SSN);
  });

  it("the typed text of a sensitive field is not in the ledger or the action events, for acts that ran and acts that were refused", async () => {
    const { surface } = record();
    // Without the server's revision the surface's own guard refuses a stale act, and ledgers it.
    const { act, post, events, flush } = serve(surface);
    const typed = ["987-65-4321", "987-65-4321-0000", "111-22-3333"];
    expect(
      ((await act("surface.ssn", { text: typed[0] }, 0, as("dana"))) as OkResult<unknown>).status,
    ).toBe("ok");
    expect(
      ((await act("surface.ssn", { text: typed[1] }, 1, as("dana"))) as ErrorResult).error.code,
    ).toBe("invalid_input");
    expect(
      ((await act("surface.ssn", { text: typed[2] }, 0, as("dana"))) as ErrorResult).error.code,
    ).toBe("conflict");
    // A numeric target that never resolved: the surface holds a sensitive field, so no text is kept.
    await surface.act({ op: "TYPE_TEXT", target: 9, text: typed[2]!, expectedRev: 0 });
    expect(surface.ledger().map((e) => [e.status, "text" in e, "textHash" in e])).toEqual([
      ["ok", false, false],
      ["invalid_input", false, false],
      ["conflict", false, false],
      ["conflict", false, false],
    ]);
    const ledger = await post("/axe/actions/surface.ledger", { input: {} }, as("dana"));
    await flush();
    expect(events).toHaveLength(3);
    for (const text of [
      JSON.stringify(ledger),
      JSON.stringify(events),
      JSON.stringify(surface.ledger()),
    ])
      for (const t of typed) expect(text).not.toContain(t);
  });

  it("the ledger's text policy: keep by default, omit, hash, and a redact function", async () => {
    const note = (s: Surface) =>
      s.register({
        id: "note",
        kind: "field",
        role: "textbox",
        name: "Note",
        edit: { set: () => undefined },
      });
    const run = async (s: Surface) => {
      note(s);
      await s.act({
        op: "TYPE_TEXT",
        target: "note",
        text: "card 4111 1111 1111 1111",
        expectedRev: 0,
      });
      await s.act({ op: "TYPE_TEXT", target: "note", text: "stale", expectedRev: 7 });
      return s.ledger().map(({ text, textHash }) => ({ text, textHash }));
    };
    expect(await run(createSurface())).toEqual([
      { text: "card 4111 1111 1111 1111", textHash: undefined },
      { text: "stale", textHash: undefined },
    ]);
    const none = { text: undefined, textHash: undefined };
    expect(await run(createSurface({ ledger: { text: "omit" } }))).toEqual([none, none]);
    const hashed = await run(createSurface({ ledger: { text: "hash" } }));
    expect(hashed[0]!.text).toBeUndefined();
    expect(hashed[0]!.textHash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashed[1]!.textHash).toBe(createHash("sha256").update("stale").digest("hex"));
    const redact = vi.fn((text: string) => text.replace(/\d{4} \d{4} \d{4} (\d{4})/, "**** $1"));
    expect(await run(createSurface({ ledger: { redact } }))).toEqual([
      { text: "card **** 1111", textHash: undefined },
      { text: "stale", textHash: undefined },
    ]);
    expect(redact).toHaveBeenCalledWith("card 4111 1111 1111 1111", "note");
  });

  it("redactEvent rewrites the details of every surface.act event, run or refused", async () => {
    const { surface } = record();
    const { act, events, flush } = serve(
      surface,
      {
        redactEvent: (details, { action, entryId }) => ({
          ...details,
          target: `${action}:${entryId.length}`,
        }),
      },
      { revision: surface },
    );
    await act("surface.save", {}, 0, as("dana"));
    await act("surface.archive", {}, 1, as("dana"));
    await flush();
    expect(events.map((e) => [e.status, e.details.target])).toEqual([
      ["ok", "surface.save:4"],
      ["error", "surface.archive:7"],
    ]);
  });
});
