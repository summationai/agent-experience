/**
 * Oakridge Rentals: a custom kind for something no well-known kind covers.
 */
import { needsInput, z } from "@summationai/axe-core";
import { customKind, accept } from "@summationai/axe-core/kinds";

// #region kind
// Nothing in the registry describes a guarantor agreement, so it is a custom kind.
// A custom kind that merely renamed payment.card or contact.address would be a fake kind ([P-HON-5]).
export const guarantorForm = customKind({
  kind: "x-oakridge.guarantor-form",
  title: "Guarantor agreement",
  description:
    "Who guarantees the lease, their relationship to the applicant, and the signed Oakridge guarantor form.",
  schema: z
    .object({
      guarantorName: z.string().min(1),
      relationship: z.enum(["parent", "guardian", "employer", "other"]),
      annualIncomeUsd: z.number().int().nonnegative(),
      signedFormUrl: z.string().url().describe("HTTPS URL of the signed guarantor form, PDF"),
    })
    .strict(),
  sensitive: true,
});
// #endregion kind

// #region use
export function guarantorRequired(applicationId: string, rentUsd: number) {
  return needsInput({
    reason: "guarantor_required",
    message: `Applicants with verified income under three times the rent ($${rentUsd * 3}/month) need a guarantor.`,
    accepts: [
      accept(guarantorForm, {
        instructions:
          "Download the guarantor form at https://oakridge-rentals.example/forms/guarantor.pdf, have the guarantor sign it, and provide a URL Oakridge can fetch the signed PDF from.",
      }),
    ],
    state: { applicationId },
  });
}
// #endregion use
