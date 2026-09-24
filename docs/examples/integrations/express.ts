// A complete Express app for Sunrise Yoga Studio with AXE mounted at the root.
// In your app the `axe` section is axe.ts and the `mount` section is server.ts.
import express from "express";
import { createAXE, action, z, type TenantInfo } from "@axe/core";
import { axeExpress } from "@axe/express";

// #region axe
export const axe = createAXE({
  name: "Sunrise Yoga Studio",
  description:
    "Search upcoming yoga classes by date and style, see instructor names and spots left, and (once signed in) book or cancel a spot.",
  baseUrl: process.env.AXE_BASE_URL ?? "http://localhost:3000",
  humanFallbackUrl: "http://localhost:3000",
  // `user` mode needs a login page for the login_required handoff. Pass-through comes from the adapter below.
  auth: { modes: ["none", "user"], userLoginUrl: "http://localhost:3000/login" },
  secret: process.env.AXE_SECRET,
});

axe.register(
  action("classes.book", {
    title: "Book a spot in a class",
    description:
      "Books one spot in the given class for the signed-in member and returns the booking id. Cancellation is free until two hours before the class starts. Requires the member to be signed in.",
    risk: "medium",
    idempotent: true,
    reversible: true,
    auth: "user",
    input: z.object({ classId: z.string().describe("Class id, as returned by classes.search") }),
    output: z.object({
      bookingId: z.string(),
      classId: z.string(),
      startsAt: z.string().datetime(),
    }),
    examples: [
      {
        input: { classId: "c_102" },
        output: { bookingId: "b_9001", classId: "c_102", startsAt: "2026-10-01T03:00:00Z" },
      },
    ],
    // `auth: "user"` guarantees an identity here: without one the SDK has already
    // returned a login_required handoff instead of calling the handler.
    handler: async ({ input, context }) => bookings.create(context.onBehalfOf!, input.classId),
  }),
);
// #endregion axe

// #region session
// Stand-in for express-session or your own auth middleware. It reads a `sid`
// cookie, looks the session up, and attaches `req.session`. express-session's
// types augment IncomingMessage the same way, which is why `req.session` is
// visible inside the adapter's `context` callback.
declare module "http" {
  interface IncomingMessage {
    session?: { memberId: string };
  }
}

const SESSIONS = new Map<string, string>([["s_demo", "m_4471"]]);

function session(): express.RequestHandler {
  return (req, _res, next) => {
    const sid = /(?:^|;\s*)sid=([^;]+)/.exec(req.headers.cookie ?? "")?.[1];
    const memberId = sid ? SESSIONS.get(sid) : undefined;
    if (memberId) req.session = { memberId };
    next();
  };
}
// #endregion session

// #region mount
const app = express();
app.use(express.json());
app.use(session());

// Mount at the root. The middleware answers /.well-known/axe* and /axe/* and
// calls next() for everything else, so your own routes are unaffected.
app.use(
  axeExpress(axe, {
    context: (req) => ({
      identity: req.session ? { onBehalfOf: req.session.memberId } : null,
    }),
  }),
);

app.get("/", (_req, res) => {
  res.send("Sunrise Yoga Studio");
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
// #endregion mount

// #region origin
// Behind a proxy that does not forward Host or X-Forwarded-*, fix the public origin.
const behindProxy = axeExpress(axe, { origin: "https://sunriseyoga.example" });
// #endregion origin

// #region tenant
// On a platform that hosts many studios, resolve the tenant from the host and
// return it next to the identity. Handlers receive it as `tenant`.
function mountForPlatform(host: express.Express) {
  host.use(
    axeExpress(axe, {
      context: async (req) => ({
        tenant: await tenants.byHost(req.headers.host ?? ""),
        identity: req.session ? { onBehalfOf: req.session.memberId } : null,
      }),
    }),
  );
}
// #endregion tenant

// Stand-ins for your database.
const bookings = {
  async create(memberId: string, classId: string) {
    return {
      bookingId: `b_${memberId.slice(2)}_${classId}`,
      classId,
      startsAt: "2026-10-01T03:00:00Z",
    };
  },
};

const tenants = {
  async byHost(host: string): Promise<TenantInfo | null> {
    const slug = host.split(".")[0];
    return slug ? { id: slug, name: `${slug} yoga`, baseUrl: `https://${host}` } : null;
  },
};

void behindProxy;
void mountForPlatform;
