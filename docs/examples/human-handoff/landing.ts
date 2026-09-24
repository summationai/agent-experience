/**
 * Oakridge Rentals: the human-facing page a `signature_required` handoff lands on, and the
 * staff step that records completion so the agent's resume can proceed.
 */
// #region all
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { axeExpress } from "@axe/express";
import { axe } from "./axe";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(axeExpress(axe));

// The handoff url: https://oakridge-rentals.example/applications/:id/lease?axe_handoff=<id>
app.get("/applications/:id/lease", async (req, res) => {
  const handoffId = typeof req.query.axe_handoff === "string" ? req.query.axe_handoff : undefined;
  const application = await leasing.getApplication(req.params.id);
  if (!application) {
    res.status(404).send("Application not found.");
    return;
  }
  res.send(renderLeasePage(application, handoffId));
});

// Leasing staff confirm the in-person signature from their console. The handoff id travels
// with the page as a hidden field; only this trusted, staff-authenticated step calls completeHandoff.
app.post("/applications/:id/lease/signed", requireStaff, async (req, res) => {
  const { id } = req.params as { id: string };
  const { handoffId, signedBy } = req.body as { handoffId?: string; signedBy: string };
  const lease = await leasing.markSigned(id, signedBy);
  if (handoffId) {
    // Records completion. Returns false for an unknown or expired id, which is not an error here:
    // the human still signed; only the agent's resume link has lapsed.
    await axe.completeHandoff(handoffId, { onBehalfOf: lease.applicantId, data: { leaseId: lease.id } });
  }
  res.redirect(`/applications/${id}/lease?signed=1`);
});
// #endregion all

function renderLeasePage(application: { id: string; unitName: string }, handoffId: string | undefined) {
  return `<!doctype html><title>Sign your lease</title>
<h1>Lease for ${escapeHtml(application.unitName)}</h1>
<p>Bring photo ID to the Oakridge leasing office, 10800 NE 8th St, Bellevue, weekdays 9–5. Signing takes about 20 minutes.</p>
<p>Once you have signed, your assistant can confirm the lease for you.</p>
${handoffId ? `<input type="hidden" name="handoffId" value="${escapeHtml(handoffId)}">` : ""}`;
}

function requireStaff(req: Request, res: Response, next: NextFunction) {
  if (req.header("x-staff-session")) next();
  else res.status(403).send("Staff only.");
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// Stand-ins for your leasing system.
const leasing = {
  async getApplication(id: string) {
    return { id, unitName: "The Meridian 204" };
  },
  async markSigned(applicationId: string, _signedBy: string) {
    return { id: `L-${applicationId}`, applicantId: "applicant_dana" };
  },
};

app.listen(3000);
