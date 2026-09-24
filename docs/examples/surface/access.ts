// Who can observe and act through the bridge: the modes, one surface per caller, and privacy.
import { createAXE } from "@axe/core";
import { createSurface } from "@axe/surface";
import type { Surface } from "@axe/surface";
import { scopedSurfaces, surfaceActions } from "@axe/surface/axe";

declare function verifySession(request: Request): Promise<{ userId: string } | null>;
declare function loadNotes(userId: string): { note: string; accountNumber: string };
declare function saveNote(userId: string, text: string): Promise<number>;

// #region modes
// A public read side over protected controls, with one control anyone may use. Every mode used
// must be in the server's auth.modes; `none` here publishes every value observe returns.
export function publicBoard(surface: Surface) {
  return surfaceActions(surface, {
    namespace: "board",
    auth: "user",
    read: "none",
    authFor: (entry) => (entry.id === "refresh" ? "none" : undefined),
  });
}

// A demo or a test harness that is deliberately public says so.
export function demoBridge(surface: Surface) {
  // Public on purpose: a sandbox board with no real data.
  return surfaceActions(surface, { namespace: "demo", auth: "none" });
}
// #endregion modes

// #region scoped
// One surface per signed-in user (and per tenant, on a platform). The template is the
// application's shape: the controls every user has, named without anyone's data. It is what the
// manifest and the MCP tool list show.
const template = createSurface({ app: "notes" });
registerNotes(template, "", async () => undefined);

// Each user's surface holds that user's values and runs that user's handlers.
const scopes = scopedSurfaces({
  create: (_key, { identity }) => {
    const userId = identity!.onBehalfOf;
    const s = createSurface({ app: "notes", revision: "app", ledger: { text: "hash" } });
    registerNotes(s, loadNotes(userId).note, (text) => saveNote(userId, text));
    return s;
  },
  max: 500, // surfaces kept; the least recently used goes first
  idleMs: 15 * 60 * 1000, // a surface unused this long is dropped
});

export const axe = createAXE({
  name: "Notes",
  description:
    "Private notes: read and edit the signed-in user's note and see what an agent changed in it.",
  baseUrl: "https://notes.example",
  auth: {
    modes: ["user"],
    authenticate: async (request) => {
      const session = await verifySession(request);
      return session ? { onBehalfOf: session.userId } : null;
    },
  },
  secret: process.env.AXE_SECRET,
  // No `revision`: each user's surface has its own, and its own guard checks expectedRev.
});
axe.addProvider(surfaceActions(scopes.resolve, { namespace: "notes", template }));
// #endregion scoped

// #region sensitive
function registerNotes(
  s: Surface,
  note: string,
  save: (text: string) => Promise<number | undefined>,
): void {
  s.register({
    id: "note",
    kind: "field",
    role: "textbox",
    name: "Private note",
    value: note,
    edit: {
      maxLength: 2000,
      set: async (text) => {
        const rev = await save(text);
        return rev === undefined ? undefined : { changed: ["note"], rev };
      },
    },
  });
  s.register({
    id: "account",
    kind: "field",
    role: "textbox",
    name: "Account number for payouts",
    // Never in observe(), describeEntry, the ledger's text, or an action event.
    sensitive: true,
    value: "",
    edit: { set: async () => undefined },
  });
}
// #endregion sensitive
