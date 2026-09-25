/**
 * Schema boundaries (spec §5.4, [P-SCHEMA-1] to [P-SCHEMA-6]): the JSON Schema validator fails
 * closed on what it cannot apply and never throws, never reaches the prototype chain, and never
 * loops; Zod checks that JSON Schema cannot express are marked in the manifest and linted; and
 * the idempotency fingerprint is the input as sent, so a transform cannot merge distinct inputs.
 */
import { describe, expect, it } from "vitest";
import { createAXE, action, z } from "../src/index";
import {
  validateJsonSchema,
  schemaProblems,
  isBacktrackingPattern,
  SUPPORTED_SCHEMA_KEYWORDS,
} from "../src/json-schema";
import { lintAction } from "../src/lint";
import { toJsonSchema } from "../src/zod-json-schema";
import type { JsonSchema } from "../src/types";
import type { ErrorResult, NeedsHumanResult, OkResult, Result } from "../src/types";
import { WIRE } from "../src/vocabulary";

const v = (schema: JsonSchema, value: unknown) => validateJsonSchema(schema, value);

describe("validator: own members only [P-SCHEMA-1]", () => {
  it("__proto__, constructor, and toString are ordinary keys: additionalProperties: false refuses them", () => {
    const schema = {
      type: "object",
      properties: { a: { type: "string" } },
      additionalProperties: false,
    };
    const issues = v(schema, JSON.parse('{"__proto__": 1, "constructor": 2, "toString": 3}'));
    expect(issues.map((i) => i.path).sort()).toEqual(["/__proto__", "/constructor", "/toString"]);
  });

  it("a required key is not satisfied by the prototype chain", () => {
    expect(v({ type: "object", required: ["toString"] }, {})).toHaveLength(1);
  });

  it("a $ref cannot resolve through the prototype chain", () => {
    expect(v({ $ref: "#/constructor" }, 1)[0]?.message).toContain("unresolvable");
  });
});

describe("validator: fails closed and never throws [P-SCHEMA-2]", () => {
  it("a $ref loop that consumes nothing is an issue, not a stack overflow", () => {
    expect(v({ $ref: "#" }, 1)[0]?.message).toContain("circular");
    const mutual = {
      $defs: { a: { $ref: "#/$defs/b" }, b: { $ref: "#/$defs/a" } },
      $ref: "#/$defs/a",
    };
    expect(v(mutual, {})[0]?.message).toContain("circular");
  });

  it("a recursive schema still validates a recursive value", () => {
    const tree = {
      type: "object",
      properties: { name: { type: "string" }, children: { type: "array", items: { $ref: "#" } } },
      required: ["name"],
    };
    expect(v(tree, { name: "a", children: [{ name: "b", children: [] }] })).toEqual([]);
    expect(v(tree, { name: "a", children: [{ children: [] }] })[0]?.path).toBe("/children/0/name");
  });

  it("a value nested deeper than the validator follows is an issue, not a stack overflow", () => {
    let value: unknown = [];
    for (let i = 0; i < 10_000; i++) value = [value];
    const issues = v(
      { $defs: { n: { type: "array", items: { $ref: "#/$defs/n" } } }, $ref: "#/$defs/n" },
      value,
    );
    expect(issues[0]?.message).toContain("nesting deeper");
  });

  it("a pattern that does not compile refuses the value instead of throwing", () => {
    expect(v({ type: "string", pattern: "(" }, "a")[0]?.message).toContain("does not compile");
  });

  it("a format the validator cannot check refuses the value unless a pattern carries it", () => {
    expect(v({ type: "string", format: "hostname" }, "anything")).toHaveLength(1);
    expect(v({ type: "string", format: "hostname", pattern: "^[a-z.]+$" }, "a.example")).toEqual(
      [],
    );
    expect(v({ type: "string", format: "ipv4" }, "1.2.3.4")).toEqual([]);
    expect(v({ type: "string", format: "ipv4" }, "999.1.1.1")).toHaveLength(1);
  });

  it("a keyword the validator does not implement refuses the value; annotations and x- keys are ignored", () => {
    for (const keyword of [
      "unevaluatedProperties",
      "dependencies",
      "$dynamicRef",
      "additionalItems",
    ]) {
      const issues = v({ type: "object", [keyword]: false }, {});
      expect(issues[0]?.message, keyword).toContain(keyword);
    }
    expect(
      v({ type: "object", items: [{ type: "string" }] } as JsonSchema, {})[0]?.message,
    ).toContain("prefixItems");
    expect(
      v({ type: "string", title: "t", description: "d", examples: ["x"], "x-anything": 1 }, "x"),
    ).toEqual([]);
  });

  it("non-local refs and plain-name fragments are unresolvable", () => {
    expect(v({ $ref: "https://example.com/schema.json" }, 1)[0]?.message).toContain("unresolvable");
    expect(v({ $ref: "#anchor" }, 1)[0]?.message).toContain("unresolvable");
  });

  it("implements the 2020-12 keywords it used to ignore", () => {
    expect(
      v({ type: "array", uniqueItems: true }, [
        { a: 1, b: 2 },
        { b: 2, a: 1 },
      ]),
    ).toHaveLength(1);
    expect(v({ type: "object", minProperties: 2 }, { a: 1 })).toHaveLength(1);
    expect(v({ type: "object", maxProperties: 1 }, { a: 1, b: 2 })).toHaveLength(1);
    expect(v({ type: "object", propertyNames: { pattern: "^[a-z]+$" } }, { A: 1 })).toHaveLength(1);
    expect(
      v(
        {
          type: "object",
          patternProperties: { "^x": { type: "string" } },
          additionalProperties: false,
        },
        { x1: 5 },
      ),
    ).toHaveLength(1);
    expect(
      v(
        {
          type: "object",
          patternProperties: { "^x": { type: "string" } },
          additionalProperties: false,
        },
        { x1: "ok" },
      ),
    ).toEqual([]);
    expect(v({ type: "object", dependentRequired: { card: ["cvc"] } }, { card: "4" })).toHaveLength(
      1,
    );
    expect(
      v({ type: "object", dependentSchemas: { card: { required: ["cvc"] } } }, { card: "4" }),
    ).toHaveLength(1);
    const ifThen = {
      if: { required: ["a"] },
      then: { required: ["b"] },
      else: { required: ["c"] },
    };
    expect(v(ifThen, { a: 1 })).toHaveLength(1);
    expect(v(ifThen, { a: 1, b: 1 })).toEqual([]);
    expect(v(ifThen, {})).toHaveLength(1);
    expect(v({ type: "array", contains: { const: 3 } }, [1, 2])).toHaveLength(1);
    expect(v({ type: "array", contains: { const: 3 }, maxContains: 1 }, [3, 3])).toHaveLength(1);
    expect(v({ type: "array", contains: { const: 3 }, minContains: 2 }, [3, 1, 3])).toEqual([]);
  });

  it("the keyword lists are published", () => {
    expect(SUPPORTED_SCHEMA_KEYWORDS.assertions).toContain("patternProperties");
    expect(SUPPORTED_SCHEMA_KEYWORDS.assertions).not.toContain("unevaluatedProperties");
    expect(SUPPORTED_SCHEMA_KEYWORDS.formats).toContain("date-time");
  });
});

describe("validator: multipleOf on decimals [P-SCHEMA-3]", () => {
  it("is exact on the decimal values as written", () => {
    expect(v({ type: "number", multipleOf: 0.1 }, 0.3)).toEqual([]);
    expect(v({ type: "number", multipleOf: 0.01 }, 19.99)).toEqual([]);
    expect(v({ type: "number", multipleOf: 0.1 }, 0.30000000000000004)).toHaveLength(1);
    expect(v({ type: "number", multipleOf: 0.01 }, 1e-7)).toHaveLength(1);
    expect(v({ type: "integer", multipleOf: 5 }, 15)).toEqual([]);
    expect(v({ type: "integer", multipleOf: 5 }, 16)).toHaveLength(1);
    expect(v({ type: "number", multipleOf: 0 }, 1)).toHaveLength(1);
  });
});

describe("patterns and backtracking [P-SCHEMA-4]", () => {
  it("flags quantified groups whose body ends in a loose repetition, and not Zod's built-in patterns", () => {
    for (const p of ["(a+)+$", "(a*)*", "^(\\w+\\s?)*$", "(x+x+)+y", "(\\d+){2,}"])
      expect(isBacktrackingPattern(p), p).toBe(true);
    for (const p of [
      "^[a-z]+$",
      "(?:[0-9a-zA-Z+/]{4})*",
      "^(\\d{3})+$",
      "(\\w+\\.)*",
      "(?:a+){1,5}",
    ])
      expect(isBacktrackingPattern(p), p).toBe(false);
    const builtins = toJsonSchema(
      z.object({
        a: z.email(),
        b: z.uuid(),
        c: z.iso.datetime(),
        d: z.base64(),
        e: z.ipv6(),
        f: z.hostname(),
        g: z.string().startsWith("x").endsWith("y"),
        h: z.cidrv6(),
        i: z.url(),
        j: z.jwt(),
      }),
      "input",
    );
    expect(schemaProblems(builtins)).toEqual([]);
  });

  it("schemaProblems reports what the validator would refuse, with paths", () => {
    const problems = schemaProblems({
      type: "object",
      properties: {
        a: { type: "string", pattern: "(" },
        b: { type: "string", format: "hostname" },
        c: { type: "string", pattern: "^(a+)+$" },
        d: { $ref: "#/$defs/missing" },
        e: { type: "object", unevaluatedProperties: false },
      },
    });
    expect(problems.map((p) => [p.path, p.keyword, p.severity])).toEqual([
      ["/properties/a", "pattern", "error"],
      ["/properties/b", "format", "error"],
      ["/properties/c", "pattern", "warning"],
      ["/properties/d", "$ref", "error"],
      ["/properties/e", "unevaluatedProperties", "error"],
    ]);
  });
});

describe("refinements are marked, not hidden [P-SCHEMA-5]", () => {
  const input = z.object({
    code: z.string().refine((s) => s !== "0000", "not 0000"),
    when: z.date().optional(),
    count: z.preprocess((x) => Number(x), z.number()),
    plain: z.string().min(2),
    shaped: z.string().transform((s) => s.length),
  });

  it("toJsonSchema marks every input node the server checks beyond JSON Schema with x-axe-refined", () => {
    const json = toJsonSchema(input, "input") as {
      properties: Record<string, Record<string, unknown>>;
    };
    expect(json.properties["code"]?.[WIRE.field.axeRefined]).toBe(true);
    expect(json.properties["when"]?.[WIRE.field.axeRefined]).toBe(true);
    expect(json.properties["count"]?.[WIRE.field.axeRefined]).toBe(true);
    expect(json.properties["plain"]?.[WIRE.field.axeRefined]).toBeUndefined();
    expect(json.properties["shaped"]?.[WIRE.field.axeRefined]).toBeUndefined();
    expect(toJsonSchema(input, "output")).not.toHaveProperty([
      "properties",
      "code",
      WIRE.field.axeRefined,
    ]);
  });

  it("the lint warns for each refined node, and the validator ignores the annotation", () => {
    const a = action("test.refined", {
      title: "Refined",
      description:
        "Accepts a code with a server-side check that JSON Schema cannot express, for review.",
      risk: "low",
      input,
      output: z.object({ ok: z.boolean() }),
      handler: async () => ({ ok: true }),
    });
    const refined = lintAction(a.definition).filter((i) => i.rule === "refined-schema");
    expect(refined.map((i) => i.location)).toEqual([
      "test.refined.input#/properties/code",
      "test.refined.input#/properties/when",
      "test.refined.input#/properties/count",
    ]);
    expect(refined.every((i) => i.severity === "warning")).toBe(true);
    expect(
      validateJsonSchema(a.definition.input, { code: "1234", count: 1, plain: "ab", shaped: "x" }),
    ).toEqual([]);
  });

  it("the lint reports an unsupported construct in an action schema as an error", () => {
    const def = {
      ...action("test.plain", {
        title: "Plain",
        description:
          "A plain action used to check schema lint rules on a hand-edited definition here.",
        readOnly: true,
        risk: "none",
        input: z.object({}),
        output: z.object({ ok: z.boolean() }),
        handler: async () => ({ ok: true }),
      }).definition,
    };
    def.input = { type: "object", properties: { a: { type: "string", pattern: "(" } } };
    const issues = lintAction(def);
    expect(issues.find((i) => i.rule === "unsupported-schema")?.severity).toBe("error");
  });
});

const SECRET = "0123456789abcdef0123456789abcdef";
const BASE = "https://schema.example";

async function post(axe: ReturnType<typeof createAXE>, path: string, body: unknown) {
  const res = await axe.handle(
    new Request(BASE + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  return (await res.json()) as Result;
}

describe("input transformation and the fingerprint [P-SCHEMA-6]", () => {
  function server() {
    const seen: string[] = [];
    const axe = createAXE({
      name: "Schema",
      description: "Review test application for checking schema boundaries and fingerprints.",
      baseUrl: BASE,
      secret: SECRET,
      auth: { modes: ["none", "user"], userLoginUrl: `${BASE}/login` },
    });
    const input = z.object({
      at: z.string().transform((s) => new Date(s)),
      note: z.string().default("none"),
    });
    const handler = async ({ input }: { input: { at: Date; note: string } }) => {
      seen.push(`${input.at.toISOString()}|${input.note}`);
      return { at: input.at.toISOString(), note: input.note };
    };
    const output = z.object({ at: z.string(), note: z.string() });
    axe.register(
      action("test.when", {
        title: "When",
        description:
          "Records a date for the review and returns it, to check fingerprints of transforms.",
        risk: "low",
        input,
        output,
        handler,
      }),
    );
    axe.register(
      action("test.signed", {
        title: "Signed",
        description:
          "Records a date for a signed-in user and returns it, to check login resume replays.",
        risk: "low",
        auth: "user",
        input,
        output,
        handler,
      }),
    );
    return { axe, seen };
  }

  it("the same key with a different date is conflict, even though both parse to a Date", async () => {
    const { axe, seen } = server();
    const first = (await post(axe, "/axe/actions/test.when", {
      input: { at: "2026-01-01T00:00:00Z" },
      idempotencyKey: "k1",
    })) as OkResult;
    expect(first.status).toBe("ok");
    const second = (await post(axe, "/axe/actions/test.when", {
      input: { at: "2027-06-01T00:00:00Z" },
      idempotencyKey: "k1",
    })) as ErrorResult;
    expect(second.status).toBe("error");
    expect(second.error.code).toBe(WIRE.error.conflict);
    expect(seen).toHaveLength(1);
  });

  it("the fingerprint is the input as sent: a default filled in by the schema is a different request", async () => {
    const { axe, seen } = server();
    await post(axe, "/axe/actions/test.when", {
      input: { at: "2026-01-01T00:00:00Z" },
      idempotencyKey: "k2",
    });
    const replay = (await post(axe, "/axe/actions/test.when", {
      input: { at: "2026-01-01T00:00:00Z" },
      idempotencyKey: "k2",
    })) as OkResult;
    expect(replay.status).toBe("ok");
    const explicit = (await post(axe, "/axe/actions/test.when", {
      input: { at: "2026-01-01T00:00:00Z", note: "none" },
      idempotencyKey: "k2",
    })) as ErrorResult;
    expect(explicit.error.code).toBe(WIRE.error.conflict);
    expect(seen).toHaveLength(1);
  });

  it("a login resume parses the input as sent once, so a transform does not run twice", async () => {
    const { axe, seen } = server();
    const h = (await post(axe, "/axe/actions/test.signed", {
      input: { at: "2026-03-01T00:00:00Z" },
      idempotencyKey: "k3",
    })) as NeedsHumanResult;
    expect(h.status).toBe("needs_human");
    const id = new URL(h.handoff.url).searchParams.get(WIRE.query.handoff)!;
    expect(await axe.completeHandoff(id, { onBehalfOf: "dana" })).toBe(true);
    const done = (await post(axe, "/axe/resume", {
      resumeToken: h.handoff.resumeToken,
    })) as OkResult<{
      at: string;
    }>;
    expect(done.status).toBe("ok");
    expect(done.output.at).toBe("2026-03-01T00:00:00.000Z");
    expect(seen).toEqual(["2026-03-01T00:00:00.000Z|none"]);
  });
});

describe("continuation payloads against a schema the validator cannot apply", () => {
  it("a payload schema whose pattern does not compile is invalid_input, not a crash", async () => {
    const axe = createAXE({
      name: "Schema",
      description: "Review test application for checking schema boundaries and fingerprints.",
      baseUrl: BASE,
      secret: SECRET,
    });
    axe.register(
      action("test.ask", {
        title: "Ask",
        description:
          "Asks for a value against a broken schema, to check the continue endpoint fails closed.",
        risk: "low",
        input: z.object({}),
        output: z.object({ ok: z.boolean() }),
        handler: async ({ needsInput }) =>
          needsInput({
            reason: "more_info",
            message: "Provide a test value.",
            accepts: [
              {
                kind: "x-review.value",
                description: "Test value",
                schema: { type: "string", pattern: "(" },
                sensitive: false,
              },
            ],
          }),
        onContinue: async () => ({ ok: true }),
      }),
    );
    const ni = (await post(axe, "/axe/actions/test.ask", { input: {}, idempotencyKey: "q" })) as {
      continuationToken: string;
    };
    const r = (await post(axe, "/axe/continue", {
      continuationToken: ni.continuationToken,
      kind: "x-review.value",
      payload: "anything",
    })) as ErrorResult;
    expect(r.status).toBe("error");
    expect(r.error.code).toBe(WIRE.error.invalidInput);
    expect(r.error.details?.issues?.[0]?.message).toContain("does not compile");
  });
});
