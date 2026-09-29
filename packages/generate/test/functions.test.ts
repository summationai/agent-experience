import { describe, expect, it } from "vitest";
import { createAXE, z } from "@summationai/axe-core";
import { ManifestSchema } from "@summationai/axe-core/schemas";
import type { OkResult } from "@summationai/axe-core/types";
import { invokeAction } from "@summationai/axe-testing";
import {
  fromFunctions,
  fromTRPCRouter,
  generate,
  registerGenerated,
  formatWarnings,
} from "../src/index";
import type { TRPCRouterLike } from "../src/index";

const Class = z.object({ id: z.string(), title: z.string(), startsAt: z.string() });

// The functions an app already has.
async function findClasses(from: string) {
  return [{ id: "c1", title: "Sunrise flow", startsAt: `${from}T06:30:00Z` }];
}
async function bookClass(input: { classId: string }, who: string) {
  return { bookingId: `b_${input.classId}_${who}` };
}

function serve(actions: ReturnType<typeof generate>["actions"]) {
  const axe = createAXE({
    name: "Sunrise Yoga Studio",
    description:
      "Search upcoming yoga classes by date and style; signed-in members can book a spot in a class.",
    baseUrl: "http://localhost:3000",
    auth: {
      modes: ["none", "user"],
      authenticate: async (req) => {
        const m = /^Bearer user:(.+)$/.exec(req.headers.get("Authorization") ?? "");
        return m ? { onBehalfOf: m[1]! } : null;
      },
    },
    secret: "0123456789abcdef0123456789abcdef",
  });
  return registerGenerated(axe, { actions });
}

describe("fromFunctions", () => {
  it("turns a typed function table into actions, with the app's functions as handlers", async () => {
    const generated = generate([
      fromFunctions({
        "classes.search": {
          title: "Search upcoming classes",
          description:
            "Find classes on or after a date. Returns up to 50 classes with start time and title.",
          readOnly: true,
          input: z.object({ from: z.string().date().describe("Earliest date, YYYY-MM-DD") }),
          output: z.object({ classes: z.array(Class) }),
          handler: async ({ from }) => ({ classes: await findClasses(from) }),
        },
        "classes.book": {
          description:
            "Books one spot in a class for the signed-in member. Free cancellation until two hours before the class starts.",
          risk: "medium",
          reversible: true,
          auth: "user",
          input: z.object({ classId: z.string().describe("Class id from classes.search") }),
          output: z.object({ bookingId: z.string() }),
          handler: (input, ctx) => bookClass(input, ctx.context.onBehalfOf ?? "anon"),
        },
      }),
    ]);
    expect(generated.actions.map((a) => a.name)).toEqual(["classes.search", "classes.book"]);
    const search = generated.actions[0]!.definition;
    expect([search.readOnly, search.risk, search.idempotent, search.reversible]).toEqual([
      true,
      "low",
      true,
      true,
    ]);
    const book = generated.actions[1]!.definition;
    expect(book.title).toBe("Book");
    expect([book.readOnly, book.risk, book.reversible, book.auth]).toEqual([
      false,
      "medium",
      true,
      "user",
    ]);
    expect(generated.provenance["classes.book"]).toEqual({
      source: "functions",
      ref: "classes.book",
    });

    const axe = serve(generated.actions);
    expect(ManifestSchema.safeParse(axe.describe()).success).toBe(true);
    const r = (await invokeAction(axe, "classes.search", { from: "2026-10-01" })) as OkResult<{
      classes: unknown[];
    }>;
    expect(r.output.classes).toEqual([
      { id: "c1", title: "Sunrise flow", startsAt: "2026-10-01T06:30:00Z" },
    ]);
    const booked = (await invokeAction(
      axe,
      "classes.book",
      { classId: "c1" },
      { identity: { onBehalfOf: "dana" } },
    )) as OkResult<{ bookingId: string }>;
    expect(booked.output.bookingId).toBe("b_c1_dana");
  });

  it("refuses to invent: no description or no risk on a mutation leaves the entry out", () => {
    const generated = generate([
      fromFunctions({
        "classes.cancel": {
          input: z.object({ bookingId: z.string() }),
          handler: async () => ({}),
        },
        "classes.waitlist": {
          description:
            "Adds the member to the waitlist for a full class and notifies them when a spot opens.",
          input: z.object({ classId: z.string() }),
          handler: async () => ({}),
        },
      }),
    ]);
    expect(generated.actions).toEqual([]);
    const codes = generated.warnings.filter((w) => w.dropped).map((w) => `${w.action}:${w.code}`);
    expect(codes).toEqual(["classes.cancel:missing-description", "classes.waitlist:missing-risk"]);
    expect(generated.warnings.find((w) => w.code === "missing-output")!.action).toBe(
      "classes.cancel",
    );
    expect(formatWarnings(generated.warnings)).toContain("✗ missing-risk classes.waitlist risk:");

    const withPolicy = generate(
      [
        fromFunctions({
          "classes.waitlist": {
            description:
              "Adds the member to the waitlist for a full class and notifies them when a spot opens.",
            input: z.object({ classId: z.string() }),
            handler: async () => ({}),
          },
        }),
      ],
      { policy: { defaultRisk: (a) => (a.name.endsWith(".waitlist") ? "low" : undefined) } },
    );
    expect(withPolicy.actions[0]!.definition.risk).toBe("low");
    expect(withPolicy.actions[0]!.definition.output).toMatchObject({ type: "object" });
  });
});

describe("fromTRPCRouter (structural)", () => {
  // A router shaped like tRPC's, hand-built so the test needs no tRPC dependency.
  const procedures = {
    "classes.list": {
      _def: {
        type: "query" as const,
        inputs: [z.object({ from: z.string().describe("Earliest date") })],
        output: z.object({ classes: z.array(Class) }),
        meta: {
          description:
            "Lists classes on or after a date. Returns up to 50 classes with start time and title.",
        },
      },
    },
    "classes.book": {
      _def: {
        type: "mutation" as const,
        inputs: [z.object({ classId: z.string() }), z.object({ note: z.string().optional() })],
        meta: {
          title: "Book a class",
          description:
            "Books one spot in a class for the signed-in member. Free cancellation until two hours before.",
          risk: "medium" as const,
          reversible: true,
        },
      },
    },
    "classes.undocumented": {
      _def: { type: "mutation" as const, inputs: [z.object({})] },
    },
    "live.updates": { _def: { type: "subscription" as const, inputs: [] } },
    "classes.count": { _def: { query: true, inputs: [z.string()] } },
  };
  const router: TRPCRouterLike<{ user: string }> = {
    _def: { procedures },
    createCaller: (ctx) => ({
      classes: {
        list: async (input: { from: string }) => ({ classes: await findClasses(input.from) }),
        book: async (input: { classId: string; note?: string }) => bookClass(input, ctx.user),
      },
    }),
  };

  it("queries become read actions, mutations need meta.risk, the rest are reported", async () => {
    const generated = generate([
      fromTRPCRouter(router, {
        createContext: (ctx) => ({ user: ctx.context.onBehalfOf ?? "anon" }),
      }),
    ]);
    expect(generated.actions.map((a) => a.name)).toEqual(["classes.list", "classes.book"]);
    const list = generated.actions[0]!.definition;
    expect([list.readOnly, list.risk, list.title]).toEqual([true, "low", "List"]);
    const book = generated.actions[1]!.definition;
    expect([book.readOnly, book.risk, book.reversible, book.title]).toEqual([
      false,
      "medium",
      true,
      "Book a class",
    ]);
    expect(Object.keys(book.input["properties"] as object)).toEqual(["classId", "note"]);
    expect(book.output).toMatchObject({ type: "object" });
    const dropped = generated.warnings.filter((w) => w.dropped).map((w) => `${w.action}:${w.code}`);
    expect(dropped).toEqual([
      "live.updates:excluded",
      "classes.count:unsupported-schema",
      "classes.undocumented:missing-description",
    ]);
    expect(generated.provenance["classes.list"]).toEqual({
      source: "trpc",
      ref: "trpc:classes.list",
    });

    const axe = serve(generated.actions);
    const r = (await invokeAction(
      axe,
      "classes.book",
      { classId: "c1" },
      { identity: { onBehalfOf: "dana" } },
    )) as OkResult<{ bookingId: string }>;
    expect(r.output).toEqual({ bookingId: "b_c1_dana" });
  });
});
