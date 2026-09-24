# Getting started

In about 15 minutes you will install the SDK, expose one read-only action from an existing app, verify it with the conformance suite, and call it from Claude Desktop through MCP. Every command below is shown with the output you should see.

This tutorial uses a yoga studio. Nothing in it is specific to yoga; swap in your own domain as you go.

## Prerequisites

- Node 20 or newer.
- An existing Express, Next.js, or fetch-based app (Hono, Remix, Cloudflare Workers, Bun, Deno, SvelteKit). If you have none, the Express server below is complete on its own.

## 1. Install

```sh
npm install @axe/core @axe/express
npm install -D axe tsx
```

Use `@axe/next` or `@axe/fetch` instead of `@axe/express` for those frameworks. The `axe` package is the CLI; `tsx` lets the CLI load your TypeScript directly.

## 2. Declare one action

Create `axe.ts`. It creates the server object and registers a single read-only action that wraps a function you already have (here, an in-memory list standing in for your database).

<!-- include: examples/getting-started/axe.ts#all -->
```ts
import { createAXE, action, z } from "@axe/core";

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
);```
<!-- /include -->

Three things to notice:

- `description` is written for a model: what it does, what it returns, what it does not do. Agents choose actions by reading these. See [Designing actions](designing-actions.md#writing-descriptions).
- `display` tells agents which fields matter when a user compares classes, where the human page is, and what caveat must accompany any rendering. It is data about data, never markup. See [Presenting results](presenting-results.md).
- `examples` are real input/output pairs. They are validated against the schemas at registration and used by `axe conformance` and `axe audit` to exercise the action.

You can also scaffold this file with `axe init`, which asks for your framework and writes both `axe.ts` and the mount file.

## 3. Mount it

### Express

<!-- include: examples/getting-started/server-express.ts#all -->
```ts
import express from "express";
import { axeExpress } from "@axe/express";
import { axe } from "./axe";

const app = express();
app.use(express.json());

// Serves /.well-known/axe.json and every /axe/* endpoint. Everything else falls through.
app.use(axeExpress(axe));

app.get("/", (_req, res) => {
  res.send("Sunrise Yoga Studio");
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});```
<!-- /include -->

Run it:

```sh
npx tsx server.ts
````

```
Listening on http://localhost:3000
```

### Next.js (App Router)

Create `app/axe/[...axe]/route.ts` and `app/.well-known/axe.json/route.ts`, each with the same three exports:

<!-- include: examples/getting-started/route.ts#all -->
```ts
import { axeNext } from "@axe/next";
import { axe } from "./axe";

export const { GET, POST, OPTIONS } = axeNext(axe);```
<!-- /include -->

See [Next.js integration](integrations/next.md) for the Pages API and for passing your session into `context`.

### Hono, Remix, Workers, Bun, Deno, SvelteKit

<!-- include: examples/getting-started/server-fetch.ts#all -->
```ts
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { axeFetch } from "@axe/fetch";
import { axe } from "./axe";

const app = new Hono();
const handler = axeFetch(axe);

app.all("/axe/*", (c) => handler(c.req.raw));
app.get("/.well-known/axe.json", (c) => handler(c.req.raw));
app.get("/", (c) => c.text("Sunrise Yoga Studio"));

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) });```
<!-- /include -->

See [fetch integration](integrations/fetch.md) for each framework's exact mount.

## 4. Look at it the way an agent does

```sh
npx axe inspect http://localhost:3000
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

The manifest itself is plain JSON at `/.well-known/axe.json`. Any agent can call the action with `fetch`:

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

## 5. Validate and run conformance

`axe validate` loads your file, validates the manifest against the schema, and lints the agent-read text:

```sh
npx axe validate ./axe.ts
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
npx axe conformance http://localhost:3000
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
35 passed, 0 failed, 1 warnings, 18 skipped. Conformant.
```

The skipped checks exercise mutating actions and the escalation ladder; they run once you add a mutating action and pass `--auth`. The one warning is a hint you can fix with a single line in `robots.txt`; see [Deploying](deploying.md#discovery).

`axe audit` gives you the AXE Score and a fix list, in the style of Lighthouse:

```sh
npx axe audit http://localhost:3000
```

```
AXE Score: 89 / 100   http://localhost:3000/
...
Fix list (highest impact first):
 1. +7.5 Affordance graph is connected: reads lead somewhere, transactions are reachable [Actionable]
    classes.search returns a list but offers no affordances
    See docs/presenting-results.md#affordances
 2. +3.2 robots.txt directive, link tag, or header points at the manifest [Discoverable]
    Add "AXE-Manifest: <url>" to robots.txt or <link rel="axe-manifest"> to your pages.
    See docs/deploying.md#discovery
```

A single read action with no follow-up is a dead end for an agent; the next thing to add is a booking action and an affordance from each class to it. [Designing actions](designing-actions.md) walks through exactly that.

## 6. Connect Claude Desktop

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

Claude calls `classes_search` with `{ "from": "2026-10-01", "style": "yin" }`, and because the action declares `display`, the tool result includes a comparison table with a link to each class alongside the raw JSON. For Claude Code, run `claude mcp add sunrise-yoga -- npx -y axe mcp http://localhost:3000`. Details and the full mapping are in [MCP](mcp.md).

## What you have

- A manifest at `/.well-known/axe.json` that any agent can discover.
- One typed, described, presentable action at `/axe/actions/classes.search`.
- A passing conformance check and an audit score with a fix list.
- An MCP server derived from the same declaration.

Everything from here is additive. You never have to change what you shipped today to add a booking action, a payment requirement, or a human handoff.

## Next steps

- [Concepts](concepts.md) for the vocabulary you will see in every other page.
- [Designing actions](designing-actions.md) to add a mutating action with an idempotency key and a `needs_input` requirement.
- [Deploying](deploying.md) before you put this in front of real agents: secret, CORS, caching, rate limits.
