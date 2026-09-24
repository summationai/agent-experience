/**
 * Northgate University Admissions: a document requirement with two accepted kinds.
 * `document.url` is restricted to PDFs; both entries are marked sensitive because a
 * transcript is an education record.
 */
// #region imports
import { createAXE, action, z } from "@axe/core";
import { kinds, accept, withMimeTypes } from "@axe/core/kinds";
// #endregion imports

const axe = createAXE({
  name: "Northgate University Admissions",
  description:
    "Check application status, upload transcripts and recommendation letters, and schedule campus visits for prospective students.",
  baseUrl: "https://admissions.northgate.example",
  humanFallbackUrl: "https://admissions.northgate.example",
  auth: { modes: ["none", "user"], userLoginUrl: "https://admissions.northgate.example/login" },
  secret: process.env.AXE_SECRET,
});

const MAX_TRANSCRIPT_BYTES = 10 * 1024 * 1024;

// #region action
axe.register(
  action("transcripts.upload", {
    title: "Upload a transcript",
    description:
      "Attaches an official transcript to the signed-in applicant's application. Accepts a PDF by URL or as an inline upload of at most 10 MB. Returns the document id and the updated list of missing documents.",
    risk: "low",
    idempotent: true,
    reversible: true,
    auth: "user",
    input: z.object({ issuingSchool: z.string().describe("Name of the school that issued the transcript") }).strict(),
    output: z.object({ documentId: z.string(), missingDocuments: z.array(z.string()) }),
    handler: async ({ input, context, needsInput }) =>
      needsInput({
        reason: "document_required",
        message: `Provide the official transcript from ${input.issuingSchool} as a PDF.`,
        accepts: [
          // Most automatable first: an agent that already holds the file at a URL needs no encoding step.
          accept(withMimeTypes(kinds.document.url, ["application/pdf"]), {
            description: "An HTTPS URL to the transcript PDF. Northgate fetches it once, within 15 minutes of this response.",
            sensitive: true,
          }),
          accept(withMimeTypes(kinds.document.base64, ["application/pdf"]), {
            description: "The transcript PDF inline, at most 10 MB before base64 encoding.",
            sensitive: true,
          }),
        ],
        // Delivered to onContinue. Never sent to the agent.
        state: { applicantId: context.onBehalfOf!, issuingSchool: input.issuingSchool },
      }),
    onContinue: async ({ kind, payload, state, fail }) => {
      const { applicantId, issuingSchool } = state as { applicantId: string; issuingSchool: string };
      // The payload already validated against the chosen entry's schema; the casts only name the shape.
      const file =
        kind === "document.url"
          ? await fetchDocument(payload as { url: string; mimeType: string })
          : decodeDocument(payload as { mimeType: string; contentBase64: string });
      if (file.bytes.byteLength > MAX_TRANSCRIPT_BYTES) {
        // An error from onContinue does not consume the token; the agent can retry with a smaller file.
        return fail("invalid_input", "The transcript is larger than 10 MB.", {
          issues: [{ path: "/payload", message: "decoded size exceeds 10 MB", expected: "at most 10485760 bytes" }],
        });
      }
      const documentId = await documents.store(applicantId, issuingSchool, file);
      return { documentId, missingDocuments: await documents.missing(applicantId) };
    },
  }),
);
// #endregion action

interface StoredFile {
  mimeType: string;
  bytes: Uint8Array;
}

async function fetchDocument(doc: { url: string; mimeType: string }): Promise<StoredFile> {
  const response = await fetch(doc.url);
  return { mimeType: doc.mimeType, bytes: new Uint8Array(await response.arrayBuffer()) };
}

function decodeDocument(doc: { mimeType: string; contentBase64: string }): StoredFile {
  return { mimeType: doc.mimeType, bytes: new Uint8Array(Buffer.from(doc.contentBase64, "base64")) };
}

// Stand-ins for your document store.
const documents = {
  async store(_applicantId: string, _issuingSchool: string, _file: StoredFile) {
    return "doc_7f3a";
  },
  async missing(_applicantId: string) {
    return ["recommendation-letter"];
  },
};

export { axe };
