# Body Spray SDK

**Agentic eXperience Engineering — because your site should smell good to agents too.**

AXE is an open, HTTP-native protocol and a TypeScript SDK that let any organization with a website expose a streamlined, agent-specific interface next to its human one: what the site can do, how to present results, what it needs to finish, and when a human must step in. You wrap functions you already have; agents get a manifest, typed actions, a structured escalation ladder, and an MCP server for free.

[![CI](https://img.shields.io/badge/ci-github_actions-blue)](.github/workflows/ci.yml) [![Protocol](https://img.shields.io/badge/protocol-axe%2F0.1-informational)](spec/AXE-PROTOCOL.md) [![License](https://img.shields.io/badge/license-Apache--2.0-green)](LICENSE) [![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)

> **Status: v0.** The protocol is `axe/0.1` and may change before 1.0. Every change is recorded in [CHANGELOG.md](CHANGELOG.md) and reasoned about in [DECISIONS.md](DECISIONS.md).

<!-- include: examples/readme/axe.ts#shown -->
```ts
import { createAXE, action, z } from "@axe/core";

export const axe = createAXE({
  name: "Sunrise Yoga Studio",
  description: "Search upcoming yoga classes by date and style; signed-in members can book a spot.",
  baseUrl: "https://sunriseyoga.example",
  auth: { modes: ["none"] },
  secret: process.env.AXE_SECRET,
});

axe.register(
  action("classes.search", {
    title: "Search upcoming classes",
    description:
      "Find classes by date and style. Returns up to 50 classes with start time, instructor, and spots left.",
    readOnly: true,
    risk: "none",
    input: z.object({ from: z.string().date().describe("Earliest date, YYYY-MM-DD") }),
    output: z.object({
      classes: z.array(z.object({ id: z.string(), title: z.string(), startsAt: z.string() })),
    }),
    handler: async ({ input }) => ({ classes: await findClasses(input.from) }),
  }),
);

export const handler = axe.fetchHandler(); // (Request) => Promise<Response>
```
<!-- /include -->

Mount `handler` in Express, Next, Hono, Remix, Workers, Bun, or Deno (one line each, see the adapters), and an agent can now discover `/.well-known/axe.json`, call `POST /axe/actions/classes.search`, and connect through `npx axe mcp https://sunriseyoga.example`.

- **[Getting started](docs/getting-started.md)** — from `npm install` to a passing conformance check in 15 minutes.
- **[Concepts](docs/concepts.md)** — manifest, actions, display and affordances, the result envelope, the escalation ladder.
- **[Protocol spec](spec/AXE-PROTOCOL.md)** — normative, with [well-known kinds](spec/KINDS.md), [events](spec/EVENTS.md), and the [vocabulary](spec/VOCABULARY.md).
- **[All docs](docs/README.md)** — designing actions, presenting results, requirements and kinds, human handoff, auth, integrations, MCP, agent builders, testing, security, audit, analytics, platforms, deploying, API reference, FAQ.
- **For agents implementing this:** [llms.txt](llms.txt) — how to integrate AXE and Surface into an existing application, with the rules, the packaging, the tests, and the reading order.

## Website

Open `site/dist/index.html` from disk for the landing page and every doc as a static site; it needs no server and makes no network requests. The same directory deploys as plain static files anywhere. `pnpm site:build` regenerates it from `docs/`; see [docs/site.md](docs/site.md).

## Packages

| Package         | What it is                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `@axe/core`     | Protocol types, schemas, well-known kinds, and the framework-free server runtime.                                         |
| `@axe/client`   | Agent-side client: discover, invoke, continue, resume, present.                                                           |
| `@axe/mcp`      | Derive an MCP server (stdio or Streamable HTTP) from any AXE site.                                                        |
| `@axe/express`  | Express and Connect adapter.                                                                                              |
| `@axe/next`     | Next.js App Router and Pages API adapter.                                                                                 |
| `@axe/fetch`    | Adapter for Web-standard handlers: Hono, Remix, Workers, Bun, Deno, SvelteKit.                                            |
| `@axe/surface`  | Live-state registry for a running app: controls with reasons and one revision, served as AXE actions.                     |
| `@axe/generate` | Derive actions from an OpenAPI document, a zod-typed function table, or a tRPC router; refuses to invent.                 |
| `@axe/testing`  | Conformance suite, AXE audit, drift check, and test helpers.                                                              |
| `axe`           | CLI: `axe init`, `axe validate`, `axe inspect`, `axe preview`, `axe conformance`, `axe audit`, `axe mcp`, `axe generate`. |

## Developing

```sh
pnpm install
pnpm -r build && pnpm -r test && pnpm -r typecheck && pnpm lint
```

See [CONTRIBUTING.md](CONTRIBUTING.md). Licensed under [Apache-2.0](LICENSE).
