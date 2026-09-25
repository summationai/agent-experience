import { action, z } from "@axe/core";
import { lintAction } from "@axe/core/lint";
import { schemaProblems, validateJsonSchema } from "@axe/core/json-schema";

// #region refined
// A check JSON Schema cannot express: the visit must be on a weekday. The published input
// schema says "a date string" and marks the node x-axe-refined, so an agent knows a
// well-formed date can still be refused with invalid_input. The description says why.
export const scheduleVisit = action("visits.schedule", {
  title: "Schedule a campus visit",
  description:
    "Books a campus tour for the applicant on a weekday and returns the visit id and start time.",
  risk: "low",
  input: z.object({
    date: z.iso
      .date()
      .refine(
        (d) => ![0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay()),
        "weekends are closed",
      )
      .describe("Visit date, a weekday, e.g. 2026-10-06"),
  }),
  output: z.object({ visitId: z.string(), startsAt: z.string() }),
  handler: async ({ input }) => ({ visitId: "v_1", startsAt: `${input.date}T10:00:00-07:00` }),
});

// scheduleVisit.definition.input.properties.date carries "x-axe-refined": true, and the lint
// reports it as a `refined-schema` warning so the author decides it is said clearly enough.
for (const issue of lintAction(scheduleVisit.definition))
  if (issue.rule === "refined-schema") console.warn(`${issue.location}: ${issue.message}`);
// #endregion refined

// #region problems
// A hand-written JSON Schema, checked before it is published. Each problem is a construct the
// SDK's validator would refuse to apply (so every payload would fail) or a risky pattern.
const payment = {
  type: "object",
  properties: {
    reference: { type: "string", pattern: "^(\\w+\\s?)*$" }, // backtracks: warning
    iban: { type: "string", format: "iban" }, // no checker, no pattern: error
  },
  unevaluatedProperties: false, // not in the subset: error
};
for (const p of schemaProblems(payment)) console.log(p.severity, p.path, p.message);

// The validator fails closed on the same schema: the payload is refused, never accepted as if
// the unsupported keyword were absent.
console.log(validateJsonSchema(payment, { reference: "ok", iban: "DE89370400440532013000" }));
// #endregion problems
