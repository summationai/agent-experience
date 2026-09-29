/**
 * Northgate University Admissions: a chained requirement. Uploading a transcript
 * first needs the document, then (for some applicants) a consent. Each continue
 * may return another `needs_input`.
 */
import { createAXE, action, z } from "@summationai/axe-core";
import { kinds, accept, withMimeTypes } from "@summationai/axe-core/kinds";

export const axe = createAXE({
  name: "Northgate University Admissions",
  description:
    "Check application status, upload transcripts and recommendation letters, and schedule campus visits for prospective students.",
  baseUrl: "https://admissions.northgate.example",
  auth: { modes: ["none", "user"], userLoginUrl: "https://admissions.northgate.example/login" },
  secret: process.env.AXE_SECRET,
});

// Stand-ins for your existing admissions service.
const admissions = {
  async storeTranscript(_applicantId: string, _document: unknown) {
    return { transcriptId: "TR-3391" };
  },
  async hasReleaseConsent(_applicantId: string) {
    return false;
  },
  async recordConsent(_applicantId: string, _consent: unknown) {},
  async status(_applicantId: string) {
    return { transcriptId: "TR-3391", status: "received" as const };
  },
};

// #region chained
// The state travels server-side with the token; the agent only sees the next requirement.
type UploadState = { applicantId: string; step: "document" | "consent" };

axe.register(
  action("transcripts.upload", {
    title: "Upload a transcript",
    description:
      "Attaches an official transcript (PDF) to the signed-in applicant's file. First-time uploaders are also asked to consent to the records-release policy. Returns the transcript id and its review status. Does not change the application decision.",
    risk: "medium",
    idempotent: true,
    reversible: true,
    auth: "user",
    input: z
      .object({ school: z.string().describe("Issuing institution, e.g. 'Lincoln High School'") })
      .strict(),
    output: z.object({ transcriptId: z.string(), status: z.enum(["received", "under-review"]) }),
    examples: [
      {
        input: { school: "Lincoln High School" },
        output: { transcriptId: "TR-3391", status: "received" },
      },
    ],
    handler: async ({ context, needsInput }) =>
      needsInput({
        reason: "document_required",
        message: "An official transcript is required. PDF only, 10 MB maximum.",
        accepts: [
          accept(withMimeTypes(kinds.document.url, ["application/pdf"]), {
            description:
              "A URL Northgate can fetch the transcript PDF from within the next 15 minutes.",
          }),
          accept(withMimeTypes(kinds.document.base64, ["application/pdf"]), {
            description: "The transcript PDF uploaded inline.",
          }),
        ],
        state: { applicantId: context.onBehalfOf!, step: "document" } satisfies UploadState,
      }),
    onContinue: async ({ kind, payload, state, needsInput }) => {
      const s = state as UploadState;
      if (s.step === "document") {
        await admissions.storeTranscript(s.applicantId, payload);
        if (await admissions.hasReleaseConsent(s.applicantId))
          return admissions.status(s.applicantId);
        // Second rung of the chain: a new requirement, a new token, the same action.
        return needsInput({
          reason: "consent_required",
          message:
            "Northgate needs your consent to share this transcript with the faculty review committee.",
          accepts: [
            accept(kinds.consent.terms, {
              description:
                "Acknowledge the records-release policy (version 2026-08) for the scope 'transcript-review'.",
              instructions:
                "Policy text: https://admissions.northgate.example/policies/records-release/2026-08",
            }),
          ],
          state: { ...s, step: "consent" } satisfies UploadState,
        });
      }
      // s.step === "consent": kind is consent.terms, payload is validated against its schema.
      await admissions.recordConsent(s.applicantId, { kind, payload });
      return admissions.status(s.applicantId);
    },
  }),
);
// #endregion chained
