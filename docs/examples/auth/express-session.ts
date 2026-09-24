/**
 * Northgate University Admissions: `user` mode with the app's existing cookie session,
 * injected through the Express adapter's `context` option.
 */
import express from "express";
import { createAXE, action, z } from "@axe/core";
import { axeExpress } from "@axe/express";

// #region session
// Stand-in for your session store (express-session, iron-session, a sessions table).
const sessions = new Map<string, { applicantId: string; roles: string[] }>([
  ["s_7c1e9b", { applicantId: "applicant_4471", roles: ["applicant"] }],
]);

function sessionFromCookie(cookieHeader: string | undefined) {
  const match = /(?:^|;\s*)sid=([^;]+)/.exec(cookieHeader ?? "");
  return match?.[1] ? sessions.get(match[1]) : undefined;
}
// #endregion session

// Stand-in for your admissions service.
const admissions = {
  async status(applicantId: string) {
    return {
      applicationId: `NU-2027-${applicantId.slice(-4)}`,
      status: "under-review" as const,
      missingDocuments: [] as string[],
    };
  },
};

// #region create
const axe = createAXE({
  name: "Northgate University Admissions",
  description:
    "Check application status, upload transcripts and recommendation letters, and schedule campus visits for prospective students.",
  baseUrl: "https://admissions.northgate.example",
  humanFallbackUrl: "https://admissions.northgate.example",
  auth: {
    modes: ["none", "user"],
    // Where the SDK sends a human who is not signed in yet (a login_required handoff).
    userLoginUrl: "https://admissions.northgate.example/login",
  },
  secret: process.env.AXE_SECRET,
});
// #endregion create

// #region action
axe.register(
  action("applications.status", {
    title: "Check application status",
    description:
      "Returns the current status of the signed-in applicant's admission application and the list of missing documents. Does not change anything.",
    readOnly: true,
    risk: "none",
    auth: "user",
    input: z.object({}),
    output: z.object({
      applicationId: z.string(),
      status: z.enum(["incomplete", "under-review", "decided"]),
      missingDocuments: z.array(z.string()),
    }),
    examples: [
      {
        input: {},
        output: { applicationId: "NU-2027-4471", status: "under-review", missingDocuments: [] },
      },
    ],
    // `context.onBehalfOf` is the identity the adapter established. Whatever the agent
    // put in the request body's context.onBehalfOf was discarded before this ran.
    handler: async ({ context }) => admissions.status(context.onBehalfOf!),
  }),
);
// #endregion action

// #region mount
const app = express();
app.use(express.json());
app.use(
  axeExpress(axe, {
    context: (req) => {
      const session = sessionFromCookie(req.headers.cookie);
      // `identity: null` means anonymous. A `user` action then returns a login_required
      // handoff instead of running.
      return {
        identity: session
          ? { onBehalfOf: session.applicantId, claims: { roles: session.roles } }
          : null,
      };
    },
  }),
);
app.listen(3000);
// #endregion mount
