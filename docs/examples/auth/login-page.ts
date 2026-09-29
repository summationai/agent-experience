/**
 * Oakridge Rentals: the login page that closes a `login_required` handoff. This is your
 * existing login with two additions: the hidden handoff id and one `completeHandoff` call.
 */
import express from "express";
import type { AXE } from "@summationai/axe-core";

// Stand-in for your existing credential check and session issuance.
async function signIn(email: string, password: string) {
  if (email === "sam@example.com" && password === "correct horse battery staple") {
    return { applicantId: "applicant_2210", sessionId: "s_41d0" };
  }
  return null;
}

const escapeAttr = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function loginRoutes(axe: AXE): express.Router {
  const router = express.Router();
  router.use(express.urlencoded({ extended: false }));

  // #region login
  // GET /login?axe_handoff=<id>: the normal form, carrying the handoff id through.
  router.get("/login", (req, res) => {
    const handoffId = typeof req.query["axe_handoff"] === "string" ? req.query["axe_handoff"] : "";
    res.type("html").send(`
      <form method="post" action="/login">
        <input type="hidden" name="axe_handoff" value="${escapeAttr(handoffId)}">
        <label>Email <input name="email" type="email" required></label>
        <label>Password <input name="password" type="password" required></label>
        <button>Sign in</button>
      </form>`);
  });

  // POST /login: authenticate exactly as before, then record completion for the handoff.
  router.post("/login", async (req, res) => {
    const body = req.body as Record<string, string | undefined>;
    const user = await signIn(body["email"] ?? "", body["password"] ?? "");
    if (!user) {
      res.status(401).send("That email and password did not match.");
      return;
    }
    res.cookie("sid", user.sessionId, { httpOnly: true, secure: true, sameSite: "lax" });

    const handoffId = body["axe_handoff"];
    if (handoffId) {
      // Binds the resume token to this applicant. The agent's next POST /axe/resume runs
      // the original action with context.onBehalfOf set to user.applicantId.
      const known = await axe.completeHandoff(handoffId, { onBehalfOf: user.applicantId });
      res.send(
        known
          ? "You're signed in. Return to your assistant to continue."
          : "You're signed in. The assistant's link had expired; ask it to try again.",
      );
      return;
    }
    res.redirect("/account");
  });
  // #endregion login

  return router;
}
