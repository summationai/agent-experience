/**
 * Northgate University Admissions: two requirements in sequence. The first onContinue
 * returns another needs_input, which mints a new continuation token and consumes the old one.
 */
import { createAXE, action, z } from "@axe/core";
import { kinds, accept } from "@axe/core/kinds";

const axe = createAXE({
  name: "Northgate University Admissions",
  description:
    "Check application status, upload transcripts and recommendation letters, and schedule campus visits for prospective students.",
  baseUrl: "https://admissions.northgate.example",
  humanFallbackUrl: "https://admissions.northgate.example",
  auth: { modes: ["none", "user"], userLoginUrl: "https://admissions.northgate.example/login" },
  secret: process.env.AXE_SECRET,
});

// #region action
axe.register(
  action("transcripts.release", {
    title: "Release a transcript to another institution",
    description:
      "Sends the signed-in applicant's official transcript to a named institution. Requires the applicant's date of birth for verification and a FERPA release naming that institution. Returns the release id and the date the transcript will arrive by.",
    risk: "high",
    idempotent: true,
    reversible: false,
    auth: "user",
    input: z.object({ recipient: z.string().describe("Institution that will receive the transcript") }).strict(),
    output: z.object({ releaseId: z.string(), deliveryBy: z.string() }),
    handler: async ({ input, context, needsInput }) =>
      needsInput({
        reason: "identity_required",
        message: "Confirm the applicant's date of birth before a transcript can be released.",
        accepts: [accept(kinds.identity.dateOfBirth, { description: "Date of birth as entered on the application." })],
        state: { applicantId: context.onBehalfOf!, recipient: input.recipient, verified: false },
      }),
    onContinue: async ({ kind, payload, state, needsInput, fail }) => {
      const s = state as { applicantId: string; recipient: string; verified: boolean };
      if (kind === "identity.date-of-birth") {
        const matches = await registrar.verifyDateOfBirth(s.applicantId, (payload as { dateOfBirth: string }).dateOfBirth);
        if (!matches) {
          // An error does not consume the token: the agent can correct the value and retry.
          return fail("invalid_input", "The date of birth does not match the application.", {
            issues: [{ path: "/payload/dateOfBirth", message: "does not match the application" }],
          });
        }
        // Second requirement. The response carries a new continuationToken; the first is consumed.
        return needsInput({
          reason: "consent_required",
          message: `Authorize release of the official transcript to ${s.recipient}.`,
          accepts: [
            accept(kinds.consent.terms, {
              description: `FERPA release covering one transcript sent to ${s.recipient}.`,
              instructions: `FERPA release, version 2026-01: Northgate may send the applicant's official transcript to ${s.recipient} once. Full text at https://admissions.northgate.example/policies/ferpa-release.`,
            }),
          ],
          state: { ...s, verified: true },
        });
      }
      if (kind === "consent.terms" && s.verified) {
        return registrar.release(s.applicantId, s.recipient, payload as { policyUrl: string; policyVersion: string; acceptedAt: string });
      }
      // Unreachable in practice: the server rejects a kind that is not in the token's accepts.
      return fail("conflict", "Requirements were answered out of order. Call the action again.");
    },
  }),
);
// #endregion action

// Stand-ins for the registrar's systems.
const registrar = {
  async verifyDateOfBirth(_applicantId: string, _dateOfBirth: string) {
    return true;
  },
  async release(applicantId: string, _recipient: string, _consent: { policyUrl: string; policyVersion: string; acceptedAt: string }) {
    return { releaseId: `rel_${applicantId}`, deliveryBy: "2026-10-07" };
  },
};

export { axe };
