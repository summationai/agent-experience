import { describe, expect, it } from "vitest";
import { apartmentsAXE, call, json } from "./fixtures/apartments";
import { ManifestSchema, PlatformIndexSchema, ResultSchema, specJsonSchemas } from "../src/schemas";
import { validateJsonSchema } from "../src/json-schema";
import { createAXE, action, z } from "../src/index";
import type { Manifest, PlatformIndex, ErrorResult, Result, AXEEvent } from "../src/types";
import type { TenantInfo } from "../src/action";
import { WIRE } from "../src/vocabulary";

describe("manifest", () => {
  it("is served at both locations with cache headers and validates against the schema [P-DISC-1] [P-DISC-2] [P-DISC-3] [P-MAN-1]", async () => {
    const { axe } = apartmentsAXE();
    for (const path of [WIRE.path.manifest, WIRE.path.manifestAlias]) {
      const res = await call(axe, "GET", path);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("application/json");
      expect(res.headers.get("Cache-Control")).toContain("max-age=300");
      expect(res.headers.get(WIRE.header.protocol)).toBe(WIRE.protocol.version);
      const m = await json<Manifest>(res);
      const parsed = ManifestSchema.safeParse(m);
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
      expect(m.protocol).toBe(WIRE.protocol.version);
      expect(m.actions.map((a) => a.name)).toEqual([
        "units.search",
        "tours.book",
        "applications.submit",
        "leases.sign",
      ]);
    }
  });

  it("validates against the generated JSON Schema too", async () => {
    const { axe } = apartmentsAXE();
    const schemas = specJsonSchemas();
    expect(validateJsonSchema(schemas["manifest"]!, axe.describe())).toEqual([]);
    const res = await json<Result>(
      await call(axe, "POST", "/axe/actions/units.search", { input: { location: "x" } }),
    );
    expect(validateJsonSchema(schemas["result"]!, res)).toEqual([]);
    expect(ResultSchema.safeParse(res).success).toBe(true);
  });

  it("actions carry JSON Schema draft 2020-12 objects with descriptions and defaults resolved [P-ACT-4]", () => {
    const { axe } = apartmentsAXE();
    const search = axe.describe().actions[0]!;
    expect(search.input["type"]).toBe("object");
    expect(search.input["additionalProperties"]).toBe(false);
    const props = search.input["properties"] as Record<string, Record<string, unknown>>;
    expect(props["location"]!["description"]).toContain("Bellevue");
    expect(search.readOnly).toBe(true);
    expect(search.idempotent).toBe(true);
    expect(search.examples).toHaveLength(1);
  });

  it("a site that says nothing about auth is public: auth defaults to { modes: [none] }", () => {
    const axe = createAXE({
      name: "Public Site",
      description: "A public site with one read-only action and no login of any kind.",
      baseUrl: "https://public.example",
      secret: "0123456789abcdef0123456789abcdef",
    });
    expect(axe.describe().auth).toEqual({ modes: ["none"] });
    expect(ManifestSchema.safeParse(axe.describe()).success).toBe(true);
    // A user-mode action still needs the mode declared; the message says how.
    expect(() =>
      axe.register(
        action("me.profile", {
          title: "My profile",
          description: "Returns the signed-in user's profile.",
          readOnly: true,
          risk: "none",
          auth: "user",
          input: z.object({}),
          output: z.object({}),
          handler: () => ({}),
        }),
      ),
    ).toThrow(/auth "user" is not in manifest auth.modes \[none\]/);
    // An explicit but empty auth is a bad value, not a missing option.
    expect(() =>
      createAXE({
        name: "Public Site",
        description: "A public site with one read-only action and no login of any kind.",
        baseUrl: "https://public.example",
        auth: { modes: [] },
      }),
    ).toThrow(/Omit `auth` for a public site/);
  });

  it("rejects actions whose auth mode is not in manifest auth.modes [P-AUTH-1]", () => {
    const axe = createAXE({
      name: "Studio",
      description: "Book yoga classes and view schedules for a small neighborhood studio.",
      baseUrl: "https://studio.example",
      auth: { modes: ["none"] },
      secret: "0123456789abcdef0123456789abcdef",
    });
    expect(() =>
      axe.register(
        action("classes.book", {
          title: "Book",
          description:
            "Reserves a spot for the authenticated member using their active class pass and returns the booking id.",
          risk: "medium",
          auth: "user",
          input: z.object({ classId: z.string() }),
          output: z.object({ bookingId: z.string() }),
          handler: async () => ({ bookingId: "b" }),
        }),
      ),
    ).toThrow(/auth "user" is not in manifest auth.modes/);
  });

  it("rejects duplicate names [P-ACT-2] and validates config", () => {
    const { axe } = apartmentsAXE();
    expect(() =>
      axe.register(
        action("units.search", {
          title: "Dup",
          description:
            "A duplicate action name used to verify uniqueness enforcement at registration time.",
          readOnly: true,
          risk: "none",
          input: z.object({}),
          output: z.object({}),
          handler: async () => ({}),
        }),
      ),
    ).toThrow(/already registered/);
    expect(() =>
      createAXE({
        name: "x",
        description: "y",
        baseUrl: "http://insecure.example",
        auth: { modes: ["none"] },
      }),
    ).toThrow(/https/);
    expect(() =>
      createAXE({
        name: "x",
        description: "y",
        baseUrl: "https://a.example",
        auth: { modes: ["user"] },
      }),
    ).toThrow(/userLoginUrl/);
    expect(() =>
      createAXE({
        name: "x",
        description: "y",
        baseUrl: "https://a.example",
        auth: { modes: ["site"] },
      }),
    ).toThrow(/verifySiteKey/);
    expect(() =>
      createAXE({
        name: "x",
        description: "y",
        baseUrl: "https://a.example",
        auth: { modes: ["none"] },
        secret: "short",
      }),
    ).toThrow(/16 characters/);
  });

  it("finalize() catches dangling affordance targets and flow steps [P-AFF-1] [P-FLOW-1]", () => {
    const axe = createAXE({
      name: "Studio",
      description: "Book yoga classes and view schedules for a small neighborhood studio.",
      baseUrl: "https://studio.example",
      auth: { modes: ["none"] },
      secret: "0123456789abcdef0123456789abcdef",
      flows: [{ name: "f", title: "F", description: "d", steps: ["classes.missing"] }],
    });
    axe.register(
      action("classes.search", {
        title: "Search",
        description:
          "Find classes by date range, style, instructor, or level. Returns up to 50 results with times and open spots.",
        readOnly: true,
        risk: "none",
        input: z.object({}),
        output: z.object({ classes: z.array(z.object({ id: z.string() })) }),
        display: { kind: "list", items: "/classes", item: { id: "/id", title: "/id" } },
        affordances: [{ action: "classes.book", title: "Book", input: { classId: "/id" } }],
        handler: async () => ({ classes: [] }),
      }),
    );
    expect(() => axe.describe()).toThrow(/affordance targets "classes.book"/);
  });

  it("serves a 404 envelope for unknown paths and rejects non-loopback http", async () => {
    const { axe } = apartmentsAXE();
    const res = await call(axe, "GET", "/axe/nothing");
    expect(res.status).toBe(404);
    expect((await json<ErrorResult>(res)).error.code).toBe(WIRE.error.notFound);
  });

  it("honors a baseUrl path prefix", async () => {
    const { axe } = apartmentsAXE({ baseUrl: "https://oakridge-rentals.example/api/v2" });
    const res = await axe.handle(
      new Request("https://oakridge-rentals.example/api/v2/.well-known/axe.json"),
    );
    expect(res.status).toBe(200);
    const direct = await axe.handle(
      new Request("https://oakridge-rentals.example/.well-known/axe.json"),
    );
    expect(direct.status).toBe(200);
  });
});

describe("CORS [P-INV-9]", () => {
  it("is off by default and on when configured", async () => {
    const off = apartmentsAXE().axe;
    const pre = await off.handle(
      new Request("https://oakridge-rentals.example/axe/actions/units.search", {
        method: "OPTIONS",
        headers: { Origin: "https://agent.example" },
      }),
    );
    expect(pre.status).toBe(204);
    expect(pre.headers.get("Access-Control-Allow-Origin")).toBeNull();

    const on = apartmentsAXE({
      cors: { origins: ["https://agent.example"], allowCredentials: true },
    }).axe;
    const pre2 = await on.handle(
      new Request("https://oakridge-rentals.example/axe/actions/units.search", {
        method: "OPTIONS",
        headers: { Origin: "https://agent.example" },
      }),
    );
    expect(pre2.status).toBe(204);
    expect(pre2.headers.get("Access-Control-Allow-Origin")).toBe("https://agent.example");
    expect(pre2.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, OPTIONS");
    expect(pre2.headers.get("Access-Control-Allow-Headers")).toContain(WIRE.header.protocol);
    expect(pre2.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    const res = await on.handle(
      new Request("https://oakridge-rentals.example/.well-known/axe.json", {
        headers: { Origin: "https://agent.example" },
      }),
    );
    expect(res.headers.get("Access-Control-Expose-Headers")).toContain(WIRE.header.retryAfter);
    const denied = await on.handle(
      new Request("https://oakridge-rentals.example/.well-known/axe.json", {
        headers: { Origin: "https://evil.example" },
      }),
    );
    expect(denied.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});

describe("multi-tenant platforms [P-DISC-8] [P-DISC-9]", () => {
  const tenants: Record<string, TenantInfo> = {
    "sunrise.studios.example": {
      id: "sunrise",
      name: "Sunrise Yoga",
      baseUrl: "https://sunrise.studios.example",
      description:
        "Book, reschedule, and cancel classes at Sunrise Yoga in Ballard, and check the weekly schedule.",
      brand: { accentColor: "#ff9900" },
    },
    "moon.studios.example": {
      id: "moon",
      name: "Moon Pilates",
      baseUrl: "https://moon.studios.example",
      policies: { agents: { deny: ["ScraperCo"] } },
    },
    "river.studios.example": {
      id: "river",
      name: "River Barre",
      baseUrl: "https://river.studios.example",
      auth: { userLoginUrl: "https://river.studios.example/members/login" },
    },
  };

  function platform() {
    const axe = createAXE({
      name: "StudioHost",
      description:
        "Scheduling platform for boutique fitness studios. Each studio serves its own AXE manifest for class search and booking.",
      baseUrl: "https://studios.example",
      auth: { modes: ["none", "user"], userLoginUrl: "https://studios.example/login" },
      secret: "0123456789abcdef0123456789abcdef",
      tenant: (req) => tenants[new URL(req.url).hostname] ?? null,
      index: {
        platform: { name: "StudioHost", url: "https://studios.example" },
        sites: (page) => {
          const all = Object.values(tenants).map((t) => ({
            name: t.name,
            manifestUrl: `${t.baseUrl}${WIRE.path.manifest}`,
            updatedAt: "2026-09-01T00:00:00Z",
          }));
          if (page === null) return { sites: all.slice(0, 2), next: "2" };
          return { sites: all.slice(2) };
        },
      },
    });
    axe.register(
      action("classes.search", {
        title: "Search classes",
        description:
          "Find upcoming classes by date and style. Returns class times, instructors, and open spots for the next two weeks.",
        readOnly: true,
        risk: "none",
        input: z.object({ from: z.string().date().describe("Start date") }),
        output: z.object({ classes: z.array(z.object({ id: z.string(), title: z.string() })) }),
        display: {
          kind: "list",
          items: "/classes",
          item: { id: "/id", title: "/title" },
          disclaimer: "Availability changes; confirm on the studio site.",
        },
        handler: async ({ tenant }) => ({ classes: [{ id: `${tenant?.id}-1`, title: "Vinyasa" }] }),
      }),
    );
    return axe;
  }

  it("serves a correct manifest per tenant from one action set", async () => {
    const axe = platform();
    const manifests: Manifest[] = [];
    for (const host of Object.keys(tenants)) {
      const res = await axe.handle(new Request(`https://${host}/.well-known/axe.json`));
      expect(res.status).toBe(200);
      const m = await json<Manifest>(res);
      expect(ManifestSchema.safeParse(m).success).toBe(true);
      manifests.push(m);
    }
    expect(manifests.map((m) => m.name)).toEqual(["Sunrise Yoga", "Moon Pilates", "River Barre"]);
    expect(manifests.map((m) => m.baseUrl)).toEqual(Object.values(tenants).map((t) => t.baseUrl));
    expect(manifests[0]!.brand?.accentColor).toBe("#ff9900");
    expect(manifests[0]!.description).toContain("Ballard");
    expect(manifests[1]!.description).toContain("Scheduling platform");
    expect(manifests[1]!.policies?.agents?.deny).toEqual(["ScraperCo"]);
    expect(manifests[2]!.auth.userLoginUrl).toBe("https://river.studios.example/members/login");
    expect(manifests[0]!.auth.userLoginUrl).toBe("https://studios.example/login");
    expect(manifests.every((m) => m.actions.length === 1)).toBe(true);
  });

  it("passes the tenant to handlers, scopes events, and enforces tenant policies", async () => {
    const events: AXEEvent[] = [];
    const axe = platform();
    axe.config.onEvent = (e) => void events.push(e);
    // onEvent set after construction is not wired; construct with it instead:
    const axe2 = createAXE({ ...axe.config, onEvent: (e) => void events.push(e) });
    for (const a of axe.definitions) axe2.register(axe.getAction(a.name)!);
    const r = await json<{ output: { classes: { id: string }[] } }>(
      await axe2.handle(
        new Request("https://moon.studios.example/axe/actions/classes.search", {
          method: "POST",
          body: JSON.stringify({ input: { from: "2026-10-01" } }),
        }),
      ),
    );
    expect(r.output.classes[0]!.id).toBe("moon-1");
    const denied = await json<ErrorResult>(
      await axe2.handle(
        new Request("https://moon.studios.example/axe/actions/classes.search", {
          method: "POST",
          body: JSON.stringify({
            input: { from: "2026-10-01" },
            context: { agent: { name: "S", vendor: "ScraperCo" } },
          }),
        }),
      ),
    );
    expect(denied.error.code).toBe(WIRE.error.forbidden);
    const unknownHost = await axe2.handle(
      new Request("https://nobody.studios.example/.well-known/axe.json"),
    );
    expect(unknownHost.status).toBe(404);
    await new Promise((r) => setTimeout(r, 0));
    expect(events[0]!.tenant).toBe("moon");
  });

  it("serves a paginated, valid axe-index.json [P-DISC-10]", async () => {
    const axe = platform();
    const first = await json<PlatformIndex>(
      await axe.handle(new Request("https://studios.example/.well-known/axe-index.json")),
    );
    expect(PlatformIndexSchema.safeParse(first).success).toBe(true);
    expect(first.sites).toHaveLength(2);
    expect(first.next).toBe("https://studios.example/.well-known/axe-index.json?page=2");
    const second = await json<PlatformIndex>(await axe.handle(new Request(first.next!)));
    expect(second.sites).toHaveLength(1);
    expect(second.next).toBeUndefined();
    for (const s of [...first.sites, ...second.sites]) {
      const m = await json<Manifest>(await axe.handle(new Request(s.manifestUrl)));
      expect(new URL(m.baseUrl).origin).toBe(new URL(s.manifestUrl).origin);
    }
  });
});
