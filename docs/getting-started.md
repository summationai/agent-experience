# Getting started

There are two ways in. If you have a web application and want a desktop agent to drive it through the controls people already use, start with the Surface and MCP-service steps below. If you want to declare server operations as typed actions an agent calls over HTTP, skip to [Serve actions over AXE](#serve-actions-over-axe).

## Add Surface to an existing app in four steps

Out of the box Surface discovers the page's controls and keeps their authoritative live state, revision, ledger, and handlers in the page. The browser relay client connects that Surface to the separately operated Agent Experience MCP service, so the consuming application does not run a server. WebMCP remains an additional direct path where supported, and development publishes `window.__surface`. It works with React Router 7 (framework mode), the Next.js App Router, Vite with React, React under any other bundler, and plain HTML pages.

### 1. Install

```sh
npm install @summationai/axe-surface @summationai/axe-relay
```

The packages come from the summationai GitHub Packages registry: an `.npmrc` beside `package.json` maps the scope (`@summationai:registry=https://npm.pkg.github.com` and `//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}`), and `gh auth refresh -s read:packages && export NODE_AUTH_TOKEN=$(gh auth token)` supplies the token; see [Install from GitHub Packages](deploying.md#install-from-github-packages). Without registry access, `axe surface init --vendor <dir> --install` installs the `core`, `surface`, and `relay` tarballs packed with `scripts/pack-for-consumer.sh`, including the `overrides` (npm), `pnpm.overrides`, or root `resolutions` (Yarn) entry; see [Consume from a checkout](deploying.md#consume-from-a-checkout). Server dependencies remain in the provider-operated Agent Experience service.

### 2. Run `axe surface init`

```sh
npx @summationai/axe surface init --app-id acme-analytics --app-name "Acme Analytics" --dry-run
```

`axe surface init` detects the framework, the package manager (npm, pnpm, Yarn classic and Berry workspaces, bun), and the root component, and prints the diff it would make. For a React Router 7 app it is two lines in `app/root.tsx` plus two new files:

It is also the upgrade entry point: rerunning it applies narrowly defined safe migrations to files carrying its generated marker while preserving application-specific edits. Review the printed diff before accepting it.

```diff
 import "./app.css";
+import { AgentSurface } from "./surface";
@@
 export default function App() {
-  return <Outlet />;
+  return (
+    <AgentSurface>
+      <Outlet />
+    </AgentSurface>
+  );
 }
```

`app/surface.tsx` holds the `<AgentSurface>` component: a `SurfaceProvider` from `@summationai/axe-surface/react` with WebMCP enabled and an injected provider connection through `@summationai/axe-relay/client`. It is enabled by default; add an explicit `--flag` only when product rollout requires one. The generated structured profile publishes the stable application id and name plus live authentication/context facts. `app/surface.config.ts` is an empty overlay with commented examples. Nothing else in the app changes, and a second run changes nothing. Apply it:

```sh
npx @summationai/axe surface init --app-id acme-analytics --app-name "Acme Analytics" --yes
```

Options that matter on a real app:

- `--mount <file>`: mount in the highest application shell, including login and account/workspace selection routes. `init` lists the layouts it found.
- `--app-id` and `--app-name`: set the identity expected by the provider connector. Defaults are inferred from `package.json`; review them before applying.
- `--flag <NAME>`, `--flag <module>#<export>`, or `--flag-hook … --flag-import …`: deliberately gate Surface for a staged rollout. There is no flag by default.
- `--relay <url>`: connect a person's visible page to a company-operated relay when deliberately using the attended-tab shape.
- `--relay-dev`: connect a visible page to the loopback development relay and use code pairing as a diagnostic.
- `--browser-only`: omit the injected relay client and provide only browser-native WebMCP.

### 3. Register the application with the provider

The application team stops here. The provider adds a connector to its trusted registry with the application URL, allowed origins, identity claim mapping, and session strategy. It does not copy selectors, login steps, account names, or workflow instructions into MCP code. Those remain live Surface state.

For local provider development, set `AXE_CONNECTORS_FILE` and start the standalone service in the Agent Experience checkout—not in the consuming application:

```sh
AXE_CONNECTORS_FILE=./mcp/connectors.local.json pnpm mcp:hosted-dev
```

The public plugin names one stable provider `/mcp` endpoint. When a request names an application, the agent uses `apps_search` and `app_connect` when needed, then `relay_tabs`, `surface_read`, `surface_observe`, `surface_wait`, and the Surface action tools. One registered application is selected automatically. There is no application-owned MCP deployment or pairing step. See [`mcp/README.md`](../mcp/README.md).

Controls classified as high risk, controls that declare confirmation, and controls waiting on `approval_required` wait for the person through the active transport’s trusted approval channel: the agent client or a one-time approval page when unattended, and the page indicator when attended. An agent tool argument is never approval.

In a compatible browser, WebMCP also registers the same page-held Surface directly; use the [host preflight](webmcp.md#host-compatibility-and-preflight) when testing that optional path. In development, `window.__surface` remains available for diagnosis.

When an authenticated agent has no application session, the provider uses the selected connector's trusted session strategy or a one-time browser handoff. `injectedRelay()` recognizes the provider capability and connects automatically. The application adds no MCP server, token endpoint, session broker, or shared secret. See [ChatGPT consumer path](chatgpt-plugin.md).

### 4. Measure and refine

Run the coverage report and write config for the top gaps, or hand a coding agent the integration prompt:

```sh
npx @summationai/axe surface coverage http://localhost:5173 --routes /,/plans --out coverage.md
npx @summationai/axe surface prompt > integrate-surface.md
```

The report opens the app in headless Chromium through Playwright (install it with `npm install -D playwright && npx playwright install chromium` if it is not already there), calls `window.__surface.coverage()` on each page, and lists what the page could not say with the rule to paste for each. [Surface](surface.md) covers the model, and [Deploying](deploying.md) the rollout.

## Optional: direct one-application host development

To exercise the lower-level host directly instead of the provider registry:

```sh
npx @summationai/axe surface init --yes --install
npx @summationai/axe host login http://localhost:5173
claude mcp add myapp -- npx @summationai/axe host --dev --stdio --app http://localhost:5173
```

The host runs the app in a private browser and presents the surface over MCP. A brokered session may start it signed in; otherwise a `signed-out` Surface produces a secure view of that same browser for the person to authenticate without sending credentials through chat. The authoritative surface and every agent act remain in the page. This is useful for SDK development; production uses the provider registry and stable MCP endpoint described above. See [Unattended mode](host.md).

## Serve actions over AXE

In about 15 minutes you will install the SDK, expose one read-only action from an existing app, verify it with the conformance suite, and call it from Claude Desktop through MCP. Every command below is shown with the output you should see.

This tutorial uses a yoga studio. Nothing in it is specific to yoga; swap in your own domain as you go.

### Prerequisites

- Node 20 or newer.
- An existing Express, Next.js, or fetch-based app (Hono, Remix, Cloudflare Workers, Bun, Deno, SvelteKit). If you have none, the Express server below is complete on its own.

### 1. Install

```sh
npm install @summationai/axe-core @summationai/axe-express
npm install -D @summationai/axe tsx
```

Use `@summationai/axe-next` or `@summationai/axe-fetch` instead of `@summationai/axe-express` for those frameworks. The packages come from the summationai GitHub Packages registry: an `.npmrc` beside `package.json` maps the scope (`@summationai:registry=https://npm.pkg.github.com` and `//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}`), and `gh auth refresh -s read:packages && export NODE_AUTH_TOKEN=$(gh auth token)` supplies the token; see [Install from GitHub Packages](deploying.md#install-from-github-packages). The `@summationai/axe` package is the CLI (its command is `axe`); `tsx` lets the CLI load your TypeScript directly.

### 2. Declare one action

Create `axe.ts`. It creates the server object and registers a single read-only action that wraps a function you already have (here, an in-memory list standing in for your database).

<!-- include: examples/getting-started/axe.ts#all -->
```ts
import { createAXE, action, z } from "@summationai/axe-core";

export const axe = createAXE({
  name: "Sunrise Yoga Studio",
  description:
    "Search upcoming yoga classes by date and style, see instructor names and spots left, and (once signed in) book or cancel a spot.",
  baseUrl: process.env.AXE_BASE_URL ?? "http://localhost:3000",
  humanFallbackUrl: "http://localhost:3000",
  auth: { modes: ["none"] },
  policies: { rateLimit: { requestsPerMinute: 60 }, termsUrl: "http://localhost:3000/terms" },
  contact: { email: "hello@sunriseyoga.example" },
  // Signs continuation and resume tokens. Set AXE_SECRET in production (docs/deploying.md).
  secret: process.env.AXE_SECRET ?? "development-only-secret-change-me",
});

const ClassSchema = z.object({
  id: z.string(),
  title: z.string(),
  style: z.enum(["vinyasa", "yin", "hatha"]),
  startsAt: z.string().datetime(),
  instructor: z.string(),
  spotsLeft: z.number().int(),
  url: z.string(),
});

// In a real integration this is your database or your existing service layer.
const CLASSES: z.infer<typeof ClassSchema>[] = [
  {
    id: "c_101",
    title: "Morning Vinyasa",
    style: "vinyasa",
    startsAt: "2026-10-01T14:00:00Z",
    instructor: "Priya N.",
    spotsLeft: 6,
    url: "http://localhost:3000/classes/c_101",
  },
  {
    id: "c_102",
    title: "Candlelight Yin",
    style: "yin",
    startsAt: "2026-10-01T03:00:00Z",
    instructor: "Marcus L.",
    spotsLeft: 2,
    url: "http://localhost:3000/classes/c_102",
  },
  {
    id: "c_103",
    title: "Hatha Basics",
    style: "hatha",
    startsAt: "2026-10-02T17:00:00Z",
    instructor: "Priya N.",
    spotsLeft: 10,
    url: "http://localhost:3000/classes/c_103",
  },
];

axe.register(
  action("classes.search", {
    title: "Search upcoming classes",
    description:
      "Find upcoming classes by date range and style. Returns up to 50 classes with start time, instructor, and spots left. Does not book anything.",
    readOnly: true,
    risk: "none",
    input: z.object({
      from: z.string().date().describe("Earliest class date, YYYY-MM-DD"),
      to: z.string().date().optional().describe("Latest class date, YYYY-MM-DD"),
      style: z.enum(["vinyasa", "yin", "hatha"]).optional().describe("Yoga style"),
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
          { label: "Style", path: "/style", format: "text" },
          { label: "Spots left", path: "/spotsLeft", format: "number", compare: "higher-better" },
        ],
      },
      suggestedComparison: ["Starts", "Spots left"],
      disclaimer:
        "Availability changes quickly. Confirm on the class page before planning around it.",
    },
    examples: [{ input: { from: "2026-10-01" }, output: { classes: CLASSES } }],
    handler: async ({ input }) => ({
      classes: CLASSES.filter(
        (c) =>
          c.startsAt.slice(0, 10) >= input.from &&
          (!input.to || c.startsAt.slice(0, 10) <= input.to) &&
          (!input.style || c.style === input.style),
      ),
    }),
  }),
);
```
<!-- /include -->

Three things to notice:

- `description` is written for a model: what it does, what it returns, what it does not do. Agents choose actions by reading these. See [Designing actions](designing-actions.md#writing-descriptions).
- `display` tells agents which fields matter when a user compares classes, where the human page is, and what caveat must accompany any rendering. It is data about data, never markup. See [Presenting results](presenting-results.md).
- `examples` are real input/output pairs. They are validated against the schemas at registration and used by `axe conformance` and `axe audit` to exercise the action.

You can also scaffold this file with `axe init`, which asks for your framework and writes both `axe.ts` and the mount file.

### 3. Mount it

#### Express

<!-- include: examples/getting-started/server-express.ts#all -->
```ts
import express from "express";
import { axeExpress } from "@summationai/axe-express";
import { axe } from "./axe";

const app = express();

// Serves /.well-known/axe.json and every /axe/* endpoint. Everything else falls through.
// Mounted before any body parser, it reads its own request bodies within maxBodyBytes and
// answers an oversized one with an AXE envelope.
app.use(axeExpress(axe));
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("Sunrise Yoga Studio");
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
```
<!-- /include -->

Run it:

```sh
npx tsx server.ts
````

```
Listening on http://localhost:3000
```

#### Next.js (App Router)

Create `app/axe/[...axe]/route.ts` and `app/.well-known/axe.json/route.ts`, each with the same three exports:

<!-- include: examples/getting-started/route.ts#all -->
```ts
import { axeNext } from "@summationai/axe-next";
import { axe } from "./axe";

export const { GET, POST, OPTIONS } = axeNext(axe);
```
<!-- /include -->

See [Next.js integration](integrations/next.md) for the Pages API and for passing your session into `context`.

#### Hono, Remix, Workers, Bun, Deno, SvelteKit

<!-- include: examples/getting-started/server-fetch.ts#all -->
```ts
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { axeFetch } from "@summationai/axe-fetch";
import { axe } from "./axe";

const app = new Hono();
const handler = axeFetch(axe);

app.all("/axe/*", (c) => handler(c.req.raw));
app.get("/.well-known/axe.json", (c) => handler(c.req.raw));
app.get("/", (c) => c.text("Sunrise Yoga Studio"));

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) });
```
<!-- /include -->

See [fetch integration](integrations/fetch.md) for each framework's exact mount.

### 4. Look at it the way an agent does

```sh
npx @summationai/axe inspect http://localhost:3000
````

```
Sunrise Yoga Studio  (axe/0.1)
  Search upcoming yoga classes by date and style, see instructor names and spots left, and (once signed in) book or cancel a spot.
  manifest: http://localhost:3000/.well-known/axe.json (via well-known)
  baseUrl: http://localhost:3000   human site: http://localhost:3000
  auth modes: none
  rate limit: 60/min

Actions (1):
  classes.search  Search upcoming classes
    Find upcoming classes by date range and style. Returns up to 50 classes with start time, instructor, and spots left. Does not book anything.
    read-only · risk none · auth none · idempotent · reversible
    input: from: string, to?: string, style?: string
    display: list of /classes; attributes Starts, Style, Spots left
    examples: 1

Affordance graph:
  entry points: classes.search
```

The manifest itself is plain JSON at `/.well-known/axe.json`. Any HTTP client can call the action with `fetch`:

```sh
curl -s -X POST http://localhost:3000/axe/actions/classes.search \
  -H 'content-type: application/json' \
  -d '{"input":{"from":"2026-10-01","style":"yin"}}'
```

```json
{
  "status": "ok",
  "output": {
    "classes": [
      {
        "id": "c_102",
        "title": "Candlelight Yin",
        "style": "yin",
        "startsAt": "2026-10-01T03:00:00Z",
        "instructor": "Marcus L.",
        "spotsLeft": 2,
        "url": "http://localhost:3000/classes/c_102"
      }
    ]
  }
}
```

Every response is a result envelope with a `status`. The five statuses and when to return each are in [Concepts](concepts.md#the-result-envelope).

### 5. Validate and run conformance

`axe validate` loads your file, validates the manifest against the schema, and lints the agent-read text:

```sh
npx @summationai/axe validate ./axe.ts
```

```
./axe.ts exports `axe`: Sunrise Yoga Studio, 1 action(s)
✓ Manifest validates against the schema
  • classes.search — Search upcoming classes [read, risk none, auth none]
✓ No lint findings

0 error(s), 0 warning(s).
```

`axe conformance` runs the protocol suite against the live server. This is how you know you are done:

```sh
npx @summationai/axe conformance http://localhost:3000
```

```
AXE conformance: http://localhost:3000/
Manifest: http://localhost:3000/.well-known/axe.json

PASS  discovery.well-known            Manifest at /.well-known/axe.json
PASS  discovery.alias                 Manifest also at /axe/manifest
PASS  discovery.headers               Manifest Content-Type and Cache-Control
PASS  runtime.protocol-header         AXE-Protocol header on the manifest
WARN  discovery.hints                 Discovery hint (robots.txt directive, link tag, or header)
                                      No AXE-Manifest line in robots.txt, no <link rel="axe-manifest">, no AXE-Manifest header on the home page. Optional, but it helps agents that start from a page URL.
PASS  manifest.schema                 Manifest validates against the schema
...
PASS  runtime.example-roundtrip       Read actions return ok for their examples; outputs validate; display resolves
...
36 passed, 0 failed, 1 warnings, 27 skipped. Conformant.
Skipped checks were not verified: "Conformant" means no check failed, not that every requirement was exercised. Each skip's detail line says what the run lacked.
...
```

The skipped checks exercise mutating actions and the escalation ladder; they run once you add a mutating action and pass `--auth`. Until then they are not verified, which is what the second line says. The one warning is a hint you can fix with a single line in `robots.txt`; see [Deploying](deploying.md#discovery).

`axe audit` gives you the AXE Score and a fix list, in the style of Lighthouse:

```sh
npx @summationai/axe audit http://localhost:3000
```

```
AXE Score: 88 / 100   http://localhost:3000/
...
Fix list (highest impact first):
 1. +9.2 Affordance graph is connected: reads lead somewhere, transactions are reachable [Actionable]
    classes.search returns a list but offers no affordances
    See docs/presenting-results.md#affordances
 2. +3.2 robots.txt directive, link tag, or header points at the manifest [Discoverable]
    Add "AXE-Manifest: <url>" to robots.txt or <link rel="axe-manifest"> to your pages.
    See docs/deploying.md#discovery
```

A single read action with no follow-up is a dead end for an agent; the next thing to add is a booking action and an affordance from each class to it. [Designing actions](designing-actions.md) walks through exactly that.

### 6. Connect Claude Desktop

The same declaration is an MCP server. Add this to Claude Desktop's `claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "sunrise-yoga": {
      "command": "npx",
      "args": ["-y", "axe", "mcp", "http://localhost:3000"]
    }
  }
}
```

Restart Claude Desktop. It now has a `classes_search` tool (dots become underscores) whose description is your action's description. Ask it:

> What yin classes does Sunrise Yoga have on October 1st?

Claude calls `classes_search` with `{ "from": "2026-10-01", "style": "yin" }`, and because the action declares `display`, the tool result includes a comparison table with a link to each class alongside the raw JSON. For Claude Code, run `claude mcp add sunrise-yoga -- npx -y @summationai/axe mcp http://localhost:3000`. Details and the full mapping are in [MCP](mcp.md).

### What you have

- A manifest at `/.well-known/axe.json` that an AXE client can discover.
- One typed, described, presentable action at `/axe/actions/classes.search`.
- A passing conformance check (with the ladder checks skipped, so not yet verified) and an audit score with a fix list.
- An MCP server derived from the same declaration.

Everything from here is additive. You never have to change what you shipped today to add a booking action, a payment requirement, or a human handoff.

## Next steps

- [Concepts](concepts.md) for the vocabulary you will see in every other page.
- [Designing actions](designing-actions.md) to add a mutating action with an idempotency key and a `needs_input` requirement.
- [Deploying](deploying.md) before you put this in front of real agents: secret, CORS, caching, rate limits.
