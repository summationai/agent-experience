# Body Spray SDK

**Agentic eXperience Engineering — because your site should smell good to agents too.**

A TypeScript SDK for exposing an application's existing capabilities to people and to agents through the same logic. You wrap functions you already have as typed actions, or register the live controls of a running app. Both get explicit permissions (who may call what, as which principal), availability with a reason, one result shape with five statuses (`ok`, `needs_input`, `needs_human`, `pending`, `error`), human approval bound to the exact call, and retries that replay a completed operation's result instead of running it again ([limits](docs/security.md#known-gaps)).

Agents reach that logic through interfaces they already use: an MCP server (`@axe/mcp`), WebMCP tools in the browser (`@axe/surface/webmcp`), or the page's own controls, which carry the same names in the DOM for browser agents. AXE (`axe/0.1`) is the HTTP representation underneath. It is useful on its own, but you do not need agents to adopt it: publishing a manifest does not make an arbitrary agent find or use your site.

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

Mount `handler` in Express, Next, Hono, Remix, Workers, Bun, or Deno (one line each, see the adapters). An MCP client connects through `npx axe mcp https://sunriseyoga.example`, and an AXE client can read `/.well-known/axe.json` and call `POST /axe/actions/classes.search` directly.

The package-only path for an existing web app, where a browser-native agent uses the app's own UI:

```sh
npm install @axe/surface
npx axe surface init --yes
```

The package keeps the live controls, revision, ledger, and handlers in the page. It registers them directly with a browser-native agent through WebMCP where supported, publishes the same semantics in the DOM, and exposes `window.__surface` in development. There is no standalone MCP server or relay in this path.

An agent outside the browser is optional. `axe surface init --remote` adds the browser client for an injected host connection; `--relay-dev` or `--relay <url>` adds the attended relay. Those adapters can present the same package-held surface over MCP without moving authority out of the page ([Unattended mode](docs/host.md), [Relay](docs/relay.md)).

- **[Getting started](docs/getting-started.md)** — Surface in an existing app in four steps, and from `npm install` to a passing AXE conformance check in 15 minutes.
- **[Concepts](docs/concepts.md)** — manifest, actions, display and affordances, the result envelope, the escalation ladder.
- **[Protocol spec](spec/AXE-PROTOCOL.md)** — normative, with [well-known kinds](spec/KINDS.md), [events](spec/EVENTS.md), and the [vocabulary](spec/VOCABULARY.md).
- **[All docs](docs/README.md)** — designing actions, presenting results, requirements and kinds, human handoff, auth, integrations, MCP, agent builders, testing, security, audit, analytics, platforms, deploying, API reference, FAQ.
- **For agents implementing this:** [llms.txt](llms.txt) — how to integrate AXE and Surface into an existing application, with the rules, the packaging, the tests, and the reading order.

## What is and is not claimed

The repository makes four kinds of claim, each with its own evidence:

- **Protocol conformance.** `axe conformance` checks the wire behavior it can exercise against a URL. A skipped check was not verified. See [Testing and conformance](docs/testing-and-conformance.md#what-conformance-does-not-show).
- **Tested security properties.** Token binding, atomic operations, authorization of polls and Surface reads, CSRF, and the rest are pinned by named tests in the SDK's suites, listed per property in the [review checklist](docs/review/2026-09-24/README.md). They cover this code, not your deployment or your handlers.
- **Measured task effectiveness.** A scripted harness measures task outcomes against the reference app, as a regression signal. It is not a measure of model performance. See [Evaluation](docs/evaluation.md).
- **Heuristic checks.** The honesty lints are regular expressions and the parity check is a sample. See [What a score does not mean](docs/audit.md#what-a-score-does-not-mean).

None of this is evidence of production readiness, agent adoption, or commercial value. Who benefits first is a hypothesis: teams building interactive business applications (planning tools, administrative workflows) where people and agents share work. The [roadmap](ROADMAP.md) says which parts are open SDK work and which are commercial hypotheses.

## Website

Open `site/dist/index.html` from disk for the landing page and every doc as a static site; it needs no server and makes no network requests. The same directory deploys as plain static files anywhere. `pnpm site:build` regenerates it from `docs/`; see [docs/site.md](docs/site.md).

## Packages

The packages share one set of application logic and differ in how a caller reaches it: an HTTP runtime and its framework adapters, an MCP server, a browser registry with WebMCP and DOM adapters, a relay from a live tab to an MCP agent, a host that runs the app headless for the agent's person, a client, and tools that test and measure the result.

| Package         | What it is                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `@axe/core`     | Protocol types, schemas, well-known kinds, and the framework-free server runtime.                                         |
| `@axe/client`   | Agent-side client: discover, invoke, continue, resume, present.                                                           |
| `@axe/mcp`      | Derive an MCP server (stdio or Streamable HTTP) from any AXE site, with elicitation and MCP Apps where the client has them. |
| `@axe/express`  | Express and Connect adapter.                                                                                              |
| `@axe/next`     | Next.js App Router and Pages API adapter.                                                                                 |
| `@axe/fetch`    | Adapter for Web-standard handlers: Hono, Remix, Workers, Bun, Deno, SvelteKit.                                            |
| `@axe/surface`  | Live-state registry for a running app: controls with reasons and one revision, served as AXE actions, WebMCP tools, or DOM attributes. |
| `@axe/relay`    | Optional remote adapter: a broker that lets an agent outside the browser drive a signed-in person's live tab through its surface. |
| `@axe/host`     | Optional unattended adapter: runs the app in a headless browser for the signed-in person, with no pairing. |
| `@axe/generate` | Derive actions from an OpenAPI document, a zod-typed function table, or a tRPC router; refuses to invent.                 |
| `@axe/testing`  | Conformance suite, AXE audit, drift check, and test helpers.                                                              |
| `axe`           | CLI: `axe init`, `axe validate`, `axe inspect`, `axe preview`, `axe conformance`, `axe audit`, `axe mcp`, `axe generate`, `axe relay`, `axe host`. |

## Developing

```sh
pnpm install
pnpm -r build && pnpm -r test && pnpm -r typecheck && pnpm lint
```

See [CONTRIBUTING.md](CONTRIBUTING.md). Licensed under [Apache-2.0](LICENSE).
