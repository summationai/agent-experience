# Body Spray SDK

**Agentic eXperience Engineering — because your site should smell good to agents too.**

A TypeScript SDK for exposing an application's existing capabilities to people and to agents through the same logic. You wrap functions you already have as typed actions, or register the live controls of a running app. Both get explicit permissions (who may call what, as which principal), availability with a reason, one result shape with five statuses (`ok`, `needs_input`, `needs_human`, `pending`, `error`), human approval bound to the exact call, and retries that replay a completed operation's result instead of running it again ([limits](docs/security.md#known-gaps)).

Agents reach that logic through interfaces they already use: the installable [Agent Experience ChatGPT plugin](plugins/agent-experience/README.md) backed by the company-operated service under [`mcp/`](mcp/README.md), WebMCP tools in compatible browsers (`@axe/surface/webmcp`), or the page's own controls. AXE (`axe/0.1`) is the HTTP representation underneath. It is useful on its own, but you do not need agents to adopt it: publishing a manifest does not make an arbitrary agent find or use your site.

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

For a consumer using ChatGPT on mobile or desktop, the production path is the public plugin plus a provider-operated private browser. The person installs **Agent Experience** once; startup stays silent, and a relevant request starts an identity-isolated application session whose Surface is used inside the agent conversation. There is no pairing code, customer MCP server, or developer tooling on the user's device. The only exceptional visible page is a secure provider view of that exact browser when the application itself requires human login. A trusted connector registry supplies each application's URL, origins, identity mapping, and optional session adapter; the running Surface supplies its authentication, controls, and live context. See [the application/provider boundary](docs/architecture.md) and [ChatGPT consumer path](docs/chatgpt-plugin.md).

For a product-shaped local demo of an existing web app's page-held Surface:

```sh
npm install @axe/surface @axe/relay
npx axe surface init --app-id example-app --app-name "Example App" --yes
# In the Agent Experience checkout, not the consuming app:
AXE_CONNECTOR_ID=example-app AXE_CONNECTOR_SURFACE_ID=example-app \
  AXE_HOST_APP_URL=http://localhost:5173/login pnpm mcp:unattended-dev
```

The package keeps the authoritative controls, authentication/context profile, revision, ledger, approval boundary, and handlers in the page. In unattended modes, `@axe/host` opens that page in a private browser and injects the relay before application code runs. If the Surface reports that it is signed out, the provider briefly presents that session's standard sign-in fields as a clean, revision-bound form, then resumes the original request after sign-in. The customer application adds no auth route, session broker, remote-browser code, or MCP server. The older attended and pairing modes remain available for diagnostics. See [Agent Experience MCP service](mcp/README.md), [ChatGPT consumer path](docs/chatgpt-plugin.md), and [Relay](docs/relay.md).

The generated integration supports both WebMCP and the provider-injected host path by default. An ordinary page load makes no remote connection; the relay starts only when a trusted host supplies a scoped connection. All paths present the same package-held Surface without moving application authority out of the page.

- **[Getting started](docs/getting-started.md)** — Surface in an existing app in four steps, and from `npm install` to a passing AXE conformance check in 15 minutes.
- **[Application/provider boundary](docs/architecture.md)** — what belongs in the trusted connector registry, the live Surface, and the generic MCP runtime.
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
| `@axe/relay`    | Browser relay client plus the reusable relay runtime used by the separately operated MCP service. |
| `@axe/host`     | Optional unattended adapter: runs the app in a headless browser for the signed-in person, with no pairing. |
| `@axe/generate` | Derive actions from an OpenAPI document, a zod-typed function table, or a tRPC router; refuses to invent.                 |
| `@axe/testing`  | Conformance suite, AXE audit, drift check, and test helpers.                                                              |
| `axe`           | CLI: `axe init`, `axe validate`, `axe inspect`, `axe preview`, `axe conformance`, `axe audit`, `axe mcp`, `axe generate`, `axe relay`, `axe host`. |

The private `@axe/mcp-service` application under [`mcp/`](mcp/README.md) composes the relay and unattended-host runtimes into the Node service operated by the package provider; it is a deployable application, not a dependency customers install.

## Developing

```sh
pnpm install
pnpm -r build && pnpm -r test && pnpm -r typecheck && pnpm lint
```

See [CONTRIBUTING.md](CONTRIBUTING.md). Licensed under [Apache-2.0](LICENSE).
