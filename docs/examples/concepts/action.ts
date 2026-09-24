import { createAXE, action, z } from "@axe/core";

const axe = createAXE({
  name: "Northgate University Admissions",
  description: "Check application status, upload transcripts and recommendation letters, and schedule campus visits for prospective students.",
  baseUrl: "https://admissions.northgate.example",
  auth: { modes: ["none", "user"], userLoginUrl: "https://admissions.northgate.example/login" },
  secret: process.env.AXE_SECRET,
});

// #region action
axe.register(
  action("applications.status", {
    title: "Check application status",
    description:
      "Returns the current status of the signed-in applicant's admission application, the list of missing documents, and the decision date once released. Does not change anything.",
    readOnly: true,
    risk: "none",
    auth: "user",
    input: z.object({ term: z.enum(["fall-2027", "spring-2027"]).optional().describe("Admission term; defaults to the most recent application") }),
    output: z.object({
      applicationId: z.string(),
      status: z.enum(["incomplete", "under-review", "decided"]),
      missingDocuments: z.array(z.string()),
      decisionDate: z.string().nullable(),
    }),
    examples: [{ input: {}, output: { applicationId: "NU-2027-0142", status: "incomplete", missingDocuments: ["transcript"], decisionDate: null } }],
    handler: async ({ input, context }) => admissions.status(context.onBehalfOf!, input.term),
  }),
);
// #endregion action

const admissions = {
  async status(_applicantId: string, _term?: string) {
    return { applicationId: "NU-2027-0142", status: "incomplete" as const, missingDocuments: ["transcript"], decisionDate: null };
  },
};
