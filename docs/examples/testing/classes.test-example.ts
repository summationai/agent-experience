/**
 * Sunrise Yoga Studio: unit tests for the `classes.book` action, run in-process with
 * `@summationai/axe-testing`. No port is opened and no network is used.
 *
 * This file uses Node's built-in `node:test` and `node:assert` so it runs anywhere Node
 * runs (`node --import tsx --test classes.test-example.ts`). In your project, import
 * `describe`, `it`, and your assertion library from the test runner you already use.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createAXE, action, z } from "@summationai/axe-core";
import { kinds, accept } from "@summationai/axe-core/kinds";
import { createTestClient, invokeAction, samplePayload } from "@summationai/axe-testing";

// #region site
const axe = createAXE({
  name: "Sunrise Yoga Studio",
  description:
    "Search upcoming yoga classes by date and style, see instructor names and spots left, and (once signed in) book or cancel a spot.",
  baseUrl: "http://localhost:3000",
  humanFallbackUrl: "http://localhost:3000",
  // `user` mode with a login page: anonymous callers of a `user` action get a login handoff.
  auth: { modes: ["none", "user"], userLoginUrl: "http://localhost:3000/login" },
  secret: "test-only-secret-change-in-production",
});

// Stand-ins for the studio's database.
const CLASSES = new Map([["c_101", { title: "Morning Vinyasa", dropInUsd: 24 }]]);
const MEMBERS_WITH_PASS = new Set(["m_priya"]);
const bookings = {
  async create(memberId: string, classId: string) {
    return { bookingId: `b_${memberId}_${classId}` };
  },
};

type BookState = { memberId: string; classId: string };

axe.register(
  action("classes.book", {
    title: "Book a spot in a class",
    description:
      "Reserves one spot in an upcoming class for the signed-in member. Members with an active class pass are booked immediately; otherwise a drop-in fee is charged to a card. Returns the booking id. Cancellation is free until two hours before the class.",
    risk: "medium",
    reversible: true,
    auth: "user",
    input: z
      .object({
        classId: z.string().describe("Class id from classes.search"),
        guests: z
          .number()
          .int()
          .min(0)
          .max(3)
          .optional()
          .describe("Additional spots for guests, 0-3"),
      })
      .strict(),
    output: z.object({
      bookingId: z.string(),
      classId: z.string(),
      status: z.literal("confirmed"),
    }),
    examples: [
      {
        input: { classId: "c_101" },
        output: { bookingId: "b_m_priya_c_101", classId: "c_101", status: "confirmed" },
      },
    ],
    handler: async ({ input, context, needsInput, fail }) => {
      const memberId = context.onBehalfOf!;
      const cls = CLASSES.get(input.classId);
      if (!cls) return fail("not_found", `No upcoming class with id ${input.classId}.`);
      if (MEMBERS_WITH_PASS.has(memberId)) {
        const { bookingId } = await bookings.create(memberId, input.classId);
        return { bookingId, classId: input.classId, status: "confirmed" as const };
      }
      return needsInput({
        reason: "payment_required",
        message: `A $${cls.dropInUsd} drop-in fee applies without an active class pass.`,
        accepts: [accept(kinds.payment.card, { description: "Charge the drop-in fee to a card." })],
        state: { memberId, classId: input.classId } satisfies BookState,
      });
    },
    onContinue: async ({ state }) => {
      const { memberId, classId } = state as BookState;
      const { bookingId } = await bookings.create(memberId, classId);
      return { bookingId, classId, status: "confirmed" as const };
    },
  }),
);
// #endregion site

// #region tests
describe("classes.book", () => {
  it("books immediately for a member with an active pass", async () => {
    const client = createTestClient(axe, { identity: { onBehalfOf: "m_priya" } });
    const result = await client.invoke("classes.book", { classId: "c_101" });
    assert.equal(result.status, "ok");
    if (result.status === "ok") {
      assert.deepEqual(result.output, {
        bookingId: "b_m_priya_c_101",
        classId: "c_101",
        status: "confirmed",
      });
    }
  });

  it("hands off to the login page when the caller is anonymous", async () => {
    const result = await invokeAction(axe, "classes.book", { classId: "c_101" });
    assert.equal(result.status, "needs_human");
    if (result.status === "needs_human") {
      assert.equal(result.handoff.reason, "login_required");
      assert.ok(result.handoff.url.startsWith("http://localhost:3000/login"));
      assert.ok(result.handoff.resumeToken.length > 0);
    }
  });

  it("asks for a card without a pass, then books when the agent continues", async () => {
    const client = createTestClient(axe, { identity: { onBehalfOf: "m_guest" } });
    const first = await client.invoke("classes.book", { classId: "c_101" });
    assert.equal(first.status, "needs_input");
    if (first.status !== "needs_input") return;
    assert.equal(first.reason, "payment_required");
    assert.deepEqual(
      first.accepts.map((a) => a.kind),
      [kinds.payment.card.kind],
    );
    assert.equal(first.accepts[0]!.sensitive, true);

    // A valid payload for any well-known kind, so the test does not hand-roll one.
    const payload = samplePayload(kinds.payment.card.kind)!;
    const second = await client.continue(first.continuationToken, kinds.payment.card.kind, payload);
    assert.equal(second.status, "ok");
  });

  it("names each invalid input path", async () => {
    const result = await invokeAction(
      axe,
      "classes.book",
      { classId: "c_101", guests: 12 },
      { identity: { onBehalfOf: "m_priya" } },
    );
    assert.equal(result.status, "error");
    if (result.status === "error") {
      assert.equal(result.error.code, "invalid_input");
      assert.deepEqual(
        result.error.details?.issues?.map((i) => i.path),
        ["/guests"],
      );
    }
  });
});
// #endregion tests
