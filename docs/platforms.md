# Platforms

A platform hosts many sites on one codebase: a scheduling product with ten thousand studios, a storefront builder, a university system with forty campuses. Every site runs the same code with different data, a different domain, and a different name on the door. AXE treats that shape as a first-class case: you declare actions once, a resolver says which tenant a request belongs to, and every tenant gets its own manifest at its own domain.

This page uses StudioHost, a class-scheduling platform whose tenants include Sunrise Yoga Studio, Moon Pilates, and River Barre. The full example is [`docs/examples/platforms/platform.ts`](examples/platforms/platform.ts).

## One integration, every site

A single studio adopting AXE puts one site in front of agents. A platform adopting it puts every site it hosts in front of agents in the same deploy, with the same action set, the same conformance result, and the same audit fixes. The studios do nothing; they were never going to write an integration, and they do not have to. For agents, a platform index is the difference between finding one manifest and finding ten thousand.

The declaration does not change shape. `createAXE` takes the same fields it takes for a single site, plus a `tenant` resolver and an `index`. Handlers receive the resolved tenant and scope their queries by it. That is the whole platform surface. Platform plugins for specific hosts are on the [roadmap](../ROADMAP.md); the multi-tenant core described here is what they will be built on.

## Define actions once

Actions are never per tenant. Sunrise Yoga and Moon Pilates both expose `classes.search`, because they both run StudioHost's scheduler. What differs between them is data, and data is scoped inside the handler.

Start with the per-tenant overlay. A `TenantInfo` carries only the fields that differ between studios: the stable `id` that appears on every event, the `name`, the `baseUrl` at the studio's own domain, and optional overrides for the manifest fields covered in [Serve per-tenant manifests](#serve-per-tenant-manifests).

<!-- include: examples/platforms/platform.ts#tenants -->
```ts
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
```
<!-- /include -->

The resolver runs once per request and maps the request to a tenant, or to none. Resolve by hostname when tenants have their own domains or subdomains; that is the natural fit, because each tenant's manifest then sits at `/.well-known/axe.json` on its own origin.

<!-- include: examples/platforms/platform.ts#resolver -->
```ts
// Called once per request. Returning null makes every endpoint answer not_found for
// that host, and no manifest is served there. The index is the one exception.
async function resolveTenant(request: Request): Promise<TenantInfo | null> {
  const host = new URL(request.url).hostname;
  const studio = await db.studioByHost(host);
  if (!studio || !enabledForAgents(studio)) return null;
  return tenantInfo(studio);
}
```
<!-- /include -->

Pass the resolver to `createAXE`. The platform-level `name`, `description`, and `baseUrl` describe the platform itself; a tenant overrides each of them.

<!-- include: examples/platforms/platform.ts#create -->
```ts
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
```
<!-- /include -->

Every handler, `onContinue`, `onResume`, and `onPoll` receives `tenant` alongside `input` and `context`. Scope every query by the tenant's `id`. Tokens and idempotency keys are already bound to the tenant by the SDK, so a continuation minted on one studio's domain cannot be replayed on another's, but row-level isolation inside your data layer is yours to enforce.

<!-- include: examples/platforms/platform.ts#handler -->
```ts
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
```
<!-- /include -->

If tenants live under path prefixes on one host rather than on their own hostnames, resolve the tenant from the path in your framework, rewrite the URL to strip the prefix before it reaches the adapter, and set the tenant's `baseUrl` to include the prefix so the URLs the SDK mints (`pollUrl`, handoff `url` defaults) are correct. The SDK strips only the platform-level `baseUrl` path in v0. A prefixed manifest is not at a well-known location, so agents find it through the index or a discovery hint rather than by convention.

## Serve per-tenant manifests

With a resolver in place, a request for `/.well-known/axe.json` on a tenant's host returns that tenant's manifest. The SDK merges the `TenantInfo` over the platform config field by field: `name`, `baseUrl`, `description`, `humanFallbackUrl`, `brand`, `policies`, `contact`, `indexUrl`, `updatedAt`, and `auth.userLoginUrl` (and `auth.modes`, if you set it). Everything else, above all `actions` and `flows`, is shared. A host the resolver does not recognize gets `not_found` from every endpoint and no manifest at all.

Two studios' manifests differ only in those fields:

```jsonc
// https://sunriseyoga.example/.well-known/axe.json
{
  "protocol": "axe/0.1",
  "name": "Sunrise Yoga Studio",
  "description": "Search upcoming yoga classes by date and style, see instructor names and spots left, and (once signed in) book or cancel a spot.",
  "baseUrl": "https://sunriseyoga.example",
  "humanFallbackUrl": "https://sunriseyoga.example",
  "auth": { "modes": ["none", "user"], "userLoginUrl": "https://sunriseyoga.example/login" },
  "actions": [ /* identical on every tenant */ ],
  "policies": { "rateLimit": { "requestsPerMinute": 60 }, "termsUrl": "https://sunriseyoga.example/terms" },
  "contact": { "email": "hello@sunriseyoga.example" },
  "brand": { "name": "Sunrise Yoga Studio", "accentColor": "#e0a458", "tone": "casual" },
  "indexUrl": "https://studiohost.example/.well-known/axe-index.json",
  "updatedAt": "2026-09-01T00:00:00Z"
}
````

```jsonc
// https://moonpilates.example/.well-known/axe.json
{
  "protocol": "axe/0.1",
  "name": "Moon Pilates",
  "description": "Find reformer and mat Pilates sessions by date and level, check equipment availability, and reserve a reformer once signed in.",
  "baseUrl": "https://moonpilates.example",
  "humanFallbackUrl": "https://moonpilates.example",
  "auth": { "modes": ["none", "user"], "userLoginUrl": "https://moonpilates.example/login" },
  "actions": [/* identical on every tenant */],
  "policies": {
    "rateLimit": { "requestsPerMinute": 30 },
    "termsUrl": "https://moonpilates.example/terms",
    "agents": { "deny": ["scraperco"] },
  },
  "contact": { "email": "hello@moonpilates.example" },
  "brand": { "name": "Moon Pilates", "accentColor": "#3b3f8f", "tone": "casual" },
  "indexUrl": "https://studiohost.example/.well-known/axe-index.json",
  "updatedAt": "2026-09-12T00:00:00Z",
}
```

Each tenant's `description` is agent-read text and is subject to the [honesty rules](audit.md#honesty-rules) like any other. If tenants write their own, run them through `lintAgentText` before saving, and give them the same guidance as [Writing descriptions](designing-actions.md#writing-descriptions).

For static generation, `describe` takes a `TenantInfo` and returns the manifest the live endpoint would serve. Build one per enabled tenant at deploy time and publish it at that tenant's domain from your CDN, with `Content-Type: application/json` and a `Cache-Control` header of at least 60 seconds.

<!-- include: examples/platforms/platform.ts#describe -->
```ts
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
```
<!-- /include -->

## Publish axe-index.json

The index is how an agent finds every tenant without a directory. It is a paginated list of manifest URLs served at `/.well-known/axe-index.json` on the platform's own origin. Configure it with `index: { platform, sites }`; `sites` returns one page per call.

<!-- include: examples/platforms/platform.ts#index -->
```ts
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
```
<!-- /include -->

The wire document:

```json
{
  "protocol": "axe/0.1",
  "platform": { "name": "StudioHost", "url": "https://studiohost.example" },
  "sites": [
    { "name": "Sunrise Yoga Studio", "manifestUrl": "https://sunriseyoga.example/.well-known/axe.json", "updatedAt": "2026-09-01T00:00:00Z", "tags": ["fitness", "scheduling"] },
    { "name": "Moon Pilates", "manifestUrl": "https://moonpilates.example/.well-known/axe.json", "updatedAt": "2026-09-12T00:00:00Z", "tags": ["fitness", "scheduling"] }
  ],
  "next": "https://studiohost.example/.well-known/axe-index.json?page=2"
}
````

Four rules from [spec §3.3](../spec/AXE-PROTOCOL.md#33-platform-index):

- Keep each page to at most 1000 sites. The SDK builds the `next` URL from the platform `baseUrl` and the cursor you return; agents follow `next` until it is absent.
- Every `manifestUrl` is absolute, and the manifest it resolves to has a `baseUrl` on the same origin. Tenants serve their own manifest at their own domain; the index only points there. A platform that proxies every tenant's manifest from one host violates this rule.
- Each tenant manifest carries `indexUrl` pointing back at the index, so an agent that finds one studio can find the rest.
- Add `AXE-Index: https://studiohost.example/.well-known/axe-index.json` to the platform's `robots.txt`. It is a hint for crawlers, not access control.

The index is exempt from the tenant rule: the platform's own host resolves to no tenant, and the index is still served there. Fetching the index emits no event.

## Per-tenant brand and policies

`brand` gives renderers a name, a logo, an accent color, and a tone per tenant, so a comparison page for Moon Pilates does not look like one for River Barre. Agents treat these as hints; `accentColor` is a CSS hex color, `logoUrl` is absolute HTTPS. See [spec §13.2](../spec/AXE-PROTOCOL.md#132-brand-hints).

`policies.agents` is per tenant. A studio that wants to refuse a specific agent vendor puts it in `deny`, matched case-insensitively against `context.agent.vendor`; the SDK enforces the tenant's list (falling back to the platform's) by answering `forbidden`, and agents are required not to call a site that denies them in the first place.

`policies.rateLimit` is per tenant too, and it is a declaration. Moon Pilates declares 30 requests per minute above; nothing in the SDK counts requests. Enforce the limit at your edge, keyed by tenant and vendor, and return `Retry-After` on `429`. The `RateLimit-Policy` header the SDK emits reflects the platform-level `policies.rateLimit`, not the tenant's, in v0. See [Rate limiting](deploying.md#rate-limiting).

## Rollout strategy

Ship to a cohort before you ship to everyone. The resolver is the switch: return `null` for tenants not yet enabled, and they have no manifest and no endpoints, exactly as if the platform had never integrated.

<!-- include: examples/platforms/platform.ts#pilot -->
```ts
// Rollout gate. Start with a named cohort; flip to "everyone" when the pilot is clean.
const PILOT_COHORT = new Set(["st_101", "st_102"]);
const ROLLOUT: "pilot" | "everyone" = "pilot";

function enabledForAgents(studio: Studio): boolean {
  return ROLLOUT === "everyone" || PILOT_COHORT.has(studio.id);
}
```
<!-- /include -->

Then, in order:

1. Run `axe conformance https://sunriseyoga.example` and `axe audit https://sunriseyoga.example` against a pilot tenant's real domain. Conformance is per origin; a platform is conformant when each tenant is. Fix the audit list once and every tenant inherits the fix.
2. Watch events by `tenant`. Every event carries the tenant `id`; the [analytics](analytics.md) queries group by it, so you see per-studio handoff rates and error rates before the studios do.
3. Widen the cohort. Because tenants share one action set, the second thousand tenants behave like the first two.
4. Change actions by deprecating, never by removing. A removed action breaks every tenant at once; a `deprecated` action with `replacedBy` keeps working while agents move. See [Deprecating actions](designing-actions.md#deprecating-actions).

## How a tenant opts out

A manifest is an invitation, and a tenant can decline it in two ways.

The first is total: the resolver returns `null` for that tenant. No manifest is served at its domain, every endpoint answers `not_found`, and the tenant is left out of the index. Store the choice next to the tenant record and read it in the resolver, the same way the pilot gate does.

The second is selective: the tenant's `policies.agents` denies specific vendors, or allows only named ones. The manifest stays up for everyone else. Per [spec §3.4](../spec/AXE-PROTOCOL.md#34-opting-out), agents must not call actions on a site whose policy denies their vendor, and the SDK also refuses them with `forbidden`. `deny` wins over `allow`.

Standard `robots.txt` rules apply to the human site and say nothing about AXE endpoints; an opt-out belongs in the resolver or in `policies.agents`, not in a crawl directive.

## Adapter plumbing

If your framework already resolved the tenant before the request reaches AXE, pass it through the adapter's `context` option as `AdapterContext.tenant` rather than looking it up twice. Every adapter accepts the same shape; the Express form is below, and `axeNext` and `axeFetch` take an equivalent function.

<!-- include: examples/platforms/platform.ts#adapter -->
```ts
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
```
<!-- /include -->

Precedence matters. A tenant supplied by the adapter wins. When the adapter supplies none, the server calls the resolver from `createAXE`; only when that also returns `null` does the host get `not_found`. If you configure no resolver and the adapter returns `null`, the request is served as the platform itself, with the platform-level manifest. Keep the resolver configured even when the adapter normally supplies the tenant, so an unknown host cannot fall through to it.

## Next steps

- [Deploying](deploying.md) for CORS, manifest caching, rate limiting, and the stores you need across many instances.
- [Analytics](analytics.md) for the event schema and queries grouped by `tenant`.
- [Audit](audit.md) for the AXE Score you will run against each pilot tenant.
- [Protocol spec §3](../spec/AXE-PROTOCOL.md#3-discovery) for the normative index and opt-out rules.
````
