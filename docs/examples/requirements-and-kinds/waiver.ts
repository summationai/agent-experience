/**
 * Sunrise Yoga Studio: booking a class can need a consent (the liability waiver) and a
 * payment (the drop-in rate). One function decides what is still missing, so the handler
 * and onContinue cannot disagree.
 */
import { createAXE, action, needsInput, z } from "@axe/core";
import { kinds, accept, type AcceptInput } from "@axe/core/kinds";

const axe = createAXE({
  name: "Sunrise Yoga Studio",
  description:
    "Search upcoming yoga classes by date and style, see instructor names and spots left, and (once signed in) book or cancel a spot.",
  baseUrl: "https://sunriseyoga.example",
  humanFallbackUrl: "https://sunriseyoga.example",
  auth: { modes: ["none", "user"], userLoginUrl: "https://sunriseyoga.example/login" },
  secret: process.env.AXE_SECRET,
});

// #region waiver
const WAIVER = {
  url: "https://sunriseyoga.example/policies/liability-waiver",
  version: "2026-03",
  scope: "class-attendance-liability",
};

// The registry schema, tightened to this exact policy. The server then rejects a consent
// for any other document or version at validation time (spec [K-3], [P-HON-6]).
const waiverConsent: AcceptInput = {
  kind: kinds.consent.terms.kind,
  title: "Liability waiver",
  description: `Acknowledge the Sunrise Yoga liability waiver, version ${WAIVER.version}, for class attendance.`,
  schema: kinds.consent.terms.schema
    .extend({
      policyUrl: z.enum([WAIVER.url]),
      policyVersion: z.enum([WAIVER.version]),
      scope: z.enum([WAIVER.scope]),
    })
    .strict(),
  sensitive: false,
  instructions: `Liability waiver: the student confirms they are able to participate and releases Sunrise Yoga from liability for ordinary injuries during class. Full text at ${WAIVER.url}.`,
};
// #endregion waiver

// #region action
axe.register(
  action("classes.book", {
    title: "Book a spot in a class",
    description:
      "Reserves one spot in a class for the signed-in student. First-time students acknowledge the liability waiver; students without a membership pay the drop-in rate. Returns the booking id. Cancellation is free up to 12 hours before the class.",
    risk: "medium",
    idempotent: true,
    reversible: true,
    auth: "user",
    input: z.object({ classId: z.string().describe("Class id from classes.search") }).strict(),
    output: z.object({ bookingId: z.string(), classId: z.string() }),
    handler: async ({ input, context }) => nextStep(input.classId, context.onBehalfOf!),
    onContinue: async ({ kind, payload, state }) => {
      const { classId, studentId } = state as { classId: string; studentId: string };
      if (kind === "consent.terms") {
        await students.recordWaiver(studentId, payload as { policyVersion: string; acceptedAt: string });
      } else if (kind === "payment.card") {
        await payments.chargeDropIn(studentId, classId, payload as { token: string; provider: string });
      }
      return nextStep(classId, studentId);
    },
  }),
);

async function nextStep(classId: string, studentId: string) {
  const student = await students.get(studentId);
  const cls = await classes.get(classId);
  if (student.waiverVersion !== WAIVER.version) {
    return needsInput({
      reason: "consent_required",
      message: "Sunrise Yoga requires an acknowledged liability waiver before a first class, and again when the waiver changes.",
      accepts: [waiverConsent],
      state: { classId, studentId },
    });
  }
  if (!student.hasMembership && !(await payments.hasPaid(studentId, classId))) {
    return needsInput({
      reason: "payment_required",
      message: `The drop-in rate for this class is $${cls.dropInUsd}. Members attend at no charge.`,
      accepts: [accept(kinds.payment.card, { description: `Card token to charge $${cls.dropInUsd} for one drop-in class.` })],
      state: { classId, studentId },
    });
  }
  return classes.book(classId, studentId);
}
// #endregion action

// Stand-ins for your student records, payments, and schedule.
const students = {
  async get(_studentId: string) {
    return { waiverVersion: null as string | null, hasMembership: false };
  },
  async recordWaiver(_studentId: string, _consent: { policyVersion: string; acceptedAt: string }) {},
};
const payments = {
  async hasPaid(_studentId: string, _classId: string) {
    return false;
  },
  async chargeDropIn(_studentId: string, _classId: string, _card: { token: string; provider: string }) {},
};
const classes = {
  async get(_classId: string) {
    return { dropInUsd: 24 };
  },
  async book(classId: string, studentId: string) {
    return { bookingId: `b_${classId}_${studentId}`, classId };
  },
};

export { axe };
