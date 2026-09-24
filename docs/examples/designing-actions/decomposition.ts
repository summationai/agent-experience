/**
 * Oakridge Rentals: the same two-page application form, decomposed badly (one action
 * per page) and well (one action per intention).
 */
import { createAXE, action, z } from "@axe/core";

export const axe = createAXE({
  name: "Oakridge Rentals",
  description:
    "Search available apartments in the Seattle area, schedule tours, submit rental applications with a holding deposit, and sign leases.",
  baseUrl: "https://oakridge-rentals.example",
  auth: { modes: ["none", "user"], userLoginUrl: "https://oakridge-rentals.example/login" },
  secret: process.env.AXE_SECRET,
});

// Stand-ins for your existing service layer.
const drafts = {
  async start(_details: { unitId: string; fullName: string; phone: string }) {
    return { draftId: "D-4471" };
  },
  async addEmployment(_draftId: string, _details: { employer: string; monthlyIncomeUsd: number }) {
    return { readyToSubmit: true };
  },
};
const applications = {
  async submit(
    _input: {
      unitId: string;
      applicant: { fullName: string; phone: string; employer: string; monthlyIncomeUsd: number };
    },
    _applicantId: string,
  ) {
    return { applicationId: "APP-8812", depositStatus: "pending" as const };
  },
};

// #region bad
// One action per page. The agent has to carry a draft id between calls, the site
// has to persist half-finished drafts, and nothing here says what the user is
// committing to until the last page.
axe.register(
  action("pages.application-step-1", {
    title: "Application, page 1 of 2",
    description:
      "Saves the applicant details from the first page of the rental application form and returns a draft id to pass to page 2.",
    risk: "low",
    idempotent: true,
    reversible: true,
    auth: "user",
    input: z.object({ unitId: z.string(), fullName: z.string(), phone: z.string() }),
    output: z.object({ draftId: z.string() }),
    handler: async ({ input }) => drafts.start(input),
  }),
);
axe.register(
  action("pages.application-step-2", {
    title: "Application, page 2 of 2",
    description:
      "Saves employment and income details against a draft id from page 1 and returns whether the draft is ready to submit.",
    risk: "low",
    idempotent: true,
    reversible: true,
    auth: "user",
    input: z.object({ draftId: z.string(), employer: z.string(), monthlyIncomeUsd: z.number() }),
    output: z.object({ readyToSubmit: z.boolean() }),
    handler: async ({ input }) => drafts.addEmployment(input.draftId, input),
  }),
);
// ...and pages.search-results, pages.unit-detail, pages.tour-scheduling, pages.deposit.
// #endregion bad

// #region good
// One intention, one outcome. Everything the human typed across two pages is one
// input; the deposit is a requirement the handler raises, not a page.
axe.register(
  action("applications.submit", {
    title: "Submit a rental application",
    description:
      "Submits a rental application for a unit and places a refundable holding deposit. The deposit can only be paid by ACH or wire; card payments are not accepted. Returns the application id and deposit status.",
    risk: "high",
    idempotent: true,
    reversible: true,
    auth: "user",
    input: z
      .object({
        unitId: z.string().describe("Unit id from units.search, e.g. 'u_204'"),
        applicant: z
          .object({
            fullName: z.string().describe("Legal name as it will appear on the lease"),
            phone: z.string().describe("Phone number in E.164 format, e.g. '+12065550142'"),
            employer: z.string().describe("Current employer"),
            monthlyIncomeUsd: z.number().int().describe("Gross monthly income in USD, e.g. 7200"),
          })
          .describe("Everything the two-page form used to collect"),
      })
      .strict(),
    output: z.object({ applicationId: z.string(), depositStatus: z.enum(["pending", "received"]) }),
    examples: [
      {
        input: {
          unitId: "u_204",
          applicant: {
            fullName: "Dana Whitfield",
            phone: "+12065550142",
            employer: "Cascade Analytics",
            monthlyIncomeUsd: 7200,
          },
        },
        output: { applicationId: "APP-8812", depositStatus: "pending" },
      },
    ],
    handler: async ({ input, context }) => applications.submit(input, context.onBehalfOf!),
  }),
);
// #endregion good
