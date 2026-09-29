/**
 * StudioHost: a scheduling platform that hosts many studios. One AXE declaration
 * serves every tenant; a resolver decides which studio a request belongs to.
 */
// #region imports
import express from "express";
import { axeExpress, type NodeRequestLike } from "@summationai/axe-express";
import {
  createAXE,
  action,
  z,
  type IndexConfig,
  type Manifest,
  type TenantInfo,
} from "@summationai/axe-core";
// #endregion imports

// #region tenants
// Stand-ins for your tenants table and your class schedule.
interface Studio {
  id: string;
  host: string;
  name: string;
  description: string;
  accentColor: string;
  requestsPerMinute: number;
  deniedVendors: string[];
  updatedAt: string;
}
const studios: Studio[] = [
  {
    id: "st_101",
    host: "sunriseyoga.example",
    name: "Sunrise Yoga Studio",
    description:
      "Search upcoming yoga classes by date and style, see instructor names and spots left, and (once signed in) book or cancel a spot.",
    accentColor: "#e0a458",
    requestsPerMinute: 60,
    deniedVendors: [],
    updatedAt: "2026-09-01T00:00:00Z",
  },
  {
    id: "st_102",
    host: "moonpilates.example",
    name: "Moon Pilates",
    description:
      "Find reformer and mat Pilates sessions by date and level, check equipment availability, and reserve a reformer once signed in.",
    accentColor: "#3b3f8f",
    requestsPerMinute: 30,
    deniedVendors: ["scraperco"],
    updatedAt: "2026-09-12T00:00:00Z",
  },
  {
    id: "st_103",
    host: "riverbarre.example",
    name: "River Barre",
    description:
      "Browse barre classes by date and instructor, see spots left, and book or join a waitlist once signed in.",
    accentColor: "#2f7a5a",
    requestsPerMinute: 60,
    deniedVendors: [],
    updatedAt: "2026-08-20T00:00:00Z",
  },
];
const db = {
  async studioByHost(host: string) {
    return studios.find((s) => s.host === host) ?? null;
  },
  async allStudios() {
    return studios;
  },
  // One page of studios for the index. `page` is the cursor from the previous page's `next`.
  async studiosPage(page: string | null, size: number) {
    const start = page ? Number(page) : 0;
    const slice = studios.slice(start, start + size);
    const next = start + size < studios.length ? String(start + size) : null;
    return { studios: slice, next };
  },
  async searchClasses(studioId: string, filters: { from: string; to?: string | undefined }) {
    return SCHEDULE.filter(
      (c) =>
        c.studioId === studioId &&
        c.startsAt.slice(0, 10) >= filters.from &&
        (!filters.to || c.startsAt.slice(0, 10) <= filters.to),
    );
  },
};
const SCHEDULE = [
  {
    studioId: "st_101",
    id: "c_101",
    title: "Morning Vinyasa",
    startsAt: "2026-10-01T14:00:00Z",
    instructor: "Priya N.",
    spotsLeft: 6,
    url: "https://sunriseyoga.example/classes/c_101",
  },
  {
    studioId: "st_102",
    id: "c_201",
    title: "Reformer Level 1",
    startsAt: "2026-10-01T16:00:00Z",
    instructor: "Dana K.",
    spotsLeft: 3,
    url: "https://moonpilates.example/classes/c_201",
  },
  {
    studioId: "st_103",
    id: "c_301",
    title: "Barre Fundamentals",
    startsAt: "2026-10-01T17:30:00Z",
    instructor: "Lena O.",
    spotsLeft: 8,
    url: "https://riverbarre.example/classes/c_301",
  },
];

// A tenant is the per-studio overlay on the shared declaration: the fields that differ
// between studios, and nothing else. Actions are never per tenant.
function tenantInfo(studio: Studio): TenantInfo {
  const baseUrl = `https://${studio.host}`;
  return {
    id: studio.id,
    name: studio.name,
    baseUrl,
    description: studio.description,
    humanFallbackUrl: baseUrl,
    brand: { name: studio.name, accentColor: studio.accentColor, tone: "casual" },
    policies: {
      rateLimit: { requestsPerMinute: studio.requestsPerMinute },
      termsUrl: `${baseUrl}/terms`,
      ...(studio.deniedVendors.length > 0 ? { agents: { deny: studio.deniedVendors } } : {}),
    },
    contact: { email: `hello@${studio.host}` },
    auth: { userLoginUrl: `${baseUrl}/login` },
    indexUrl: "https://studiohost.example/.well-known/axe-index.json",
    updatedAt: studio.updatedAt,
  };
}
// #endregion tenants

// #region pilot
// Rollout gate. Start with a named cohort; flip to "everyone" when the pilot is clean.
const PILOT_COHORT = new Set(["st_101", "st_102"]);
const ROLLOUT: "pilot" | "everyone" = "pilot";

function enabledForAgents(studio: Studio): boolean {
  return ROLLOUT === "everyone" || PILOT_COHORT.has(studio.id);
}
// #endregion pilot

// #region resolver
// Called once per request. Returning null makes every endpoint answer not_found for
// that host, and no manifest is served there. The index is the one exception.
async function resolveTenant(request: Request): Promise<TenantInfo | null> {
  const host = new URL(request.url).hostname;
  const studio = await db.studioByHost(host);
  if (!studio || !enabledForAgents(studio)) return null;
  return tenantInfo(studio);
}
// #endregion resolver

// #region index
// Served at /.well-known/axe-index.json on the platform's origin. One page per call;
// `page` is whatever the previous page put in `next`, or null for the first page.
const index: IndexConfig = {
  platform: { name: "StudioHost", url: "https://studiohost.example" },
  sites: async (page) => {
    const { studios, next } = await db.studiosPage(page, 1000);
    return {
      sites: studios.filter(enabledForAgents).map((s) => ({
        name: s.name,
        manifestUrl: `https://${s.host}/.well-known/axe.json`,
        updatedAt: s.updatedAt,
        tags: ["fitness", "scheduling"],
      })),
      next,
    };
  },
};
// #endregion index

// #region create
export const axe = createAXE({
  // Platform-level values. A tenant overrides each of these; the platform's own host
  // (studiohost.example) resolves to no tenant and serves only the index.
  name: "StudioHost",
  description:
    "Class scheduling for independent fitness studios. Each studio publishes its own manifest at its own domain; this platform publishes the index of them.",
  baseUrl: "https://studiohost.example",
  humanFallbackUrl: "https://studiohost.example",
  auth: { modes: ["none", "user"] },
  policies: { rateLimit: { requestsPerMinute: 60 }, termsUrl: "https://studiohost.example/terms" },
  contact: { email: "agents@studiohost.example" },
  tenant: resolveTenant,
  index,
  secret: process.env.AXE_SECRET,
});
// #endregion create

// #region handler
const ClassSchema = z.object({
  id: z.string(),
  title: z.string(),
  startsAt: z.string().datetime(),
  instructor: z.string(),
  spotsLeft: z.number().int(),
  url: z.string(),
});

axe.register(
  action("classes.search", {
    title: "Search upcoming classes",
    description:
      "Find this studio's upcoming classes by date range. Returns up to 50 classes with start time, instructor, spots left, and a link to the class page. Does not book anything.",
    readOnly: true,
    risk: "none",
    input: z.object({
      from: z.string().date().describe("Earliest class date, YYYY-MM-DD"),
      to: z.string().date().optional().describe("Latest class date, YYYY-MM-DD"),
    }),
    output: z.object({ classes: z.array(ClassSchema) }),
    display: {
      kind: "list",
      items: "/classes",
      item: {
        id: "/id",
        title: "/title",
        subtitle: "/instructor",
        url: "/url",
        attributes: [
          { label: "Starts", path: "/startsAt", format: "datetime", compare: "lower-better" },
          { label: "Spots left", path: "/spotsLeft", format: "number", compare: "higher-better" },
        ],
      },
      disclaimer:
        "Availability changes quickly. Confirm on the class page before planning around it.",
    },
    examples: [
      {
        input: { from: "2026-10-01" },
        output: {
          classes: [
            {
              id: "c_101",
              title: "Morning Vinyasa",
              startsAt: "2026-10-01T14:00:00Z",
              instructor: "Priya N.",
              spotsLeft: 6,
              url: "https://sunriseyoga.example/classes/c_101",
            },
          ],
        },
      },
    ],
    // Every handler receives the resolved tenant. Scope every query by tenant.id, and
    // never let an id from one studio's input reach another studio's rows.
    handler: async ({ input, tenant, fail }) => {
      if (!tenant)
        return fail("unavailable", "This action is only served on a studio's own domain.");
      const classes = await db.searchClasses(tenant.id, input);
      return { classes: classes.map(({ studioId: _studioId, ...c }) => c) };
    },
  }),
);
// #endregion handler

// #region describe
// Static generation: build every enabled studio's manifest at deploy time and publish
// each one at its own domain. The output is exactly what the live endpoint serves.
export async function manifestsForAllTenants(): Promise<Map<string, Manifest>> {
  const out = new Map<string, Manifest>();
  for (const studio of await db.allStudios()) {
    if (!enabledForAgents(studio)) continue;
    out.set(studio.host, axe.describe(tenantInfo(studio)));
  }
  return out;
}
// #endregion describe

// #region adapter
interface StudioRequest extends NodeRequestLike {
  studio?: Studio | null;
}

const app = express();
app.use(express.json());

// Your existing middleware already knows which studio a request is for.
app.use(async (req, _res, next) => {
  (req as StudioRequest).studio = await db.studioByHost(req.hostname);
  next();
});

// Pass it through the adapter context instead of resolving twice. When the context
// supplies no tenant, the server falls back to the resolver above, so unknown hosts
// still get not_found.
app.use(
  axeExpress(axe, {
    context: async (req) => {
      const studio = (req as StudioRequest).studio;
      return { tenant: studio && enabledForAgents(studio) ? tenantInfo(studio) : null };
    },
  }),
);

app.listen(Number(process.env.PORT ?? 3000));
// #endregion adapter
