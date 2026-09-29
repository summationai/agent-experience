// app/axe/[...axe]/route.ts
// #region all
import { axeNext } from "@summationai/axe-next";
import { axe } from "../../../axe";
import { applicantFromRequest } from "../../../lib/session";

export const { GET, POST, OPTIONS } = axeNext(axe, {
  // `null` means anonymous: a `user` action then returns a login_required handoff.
  context: async (request) => ({ identity: await applicantFromRequest(request) }),
});
// #endregion all
