# MCP

Every AXE manifest is also a Model Context Protocol server. `@axe/mcp` derives one from an `AXE` instance, a manifest object, or a URL, so the actions you declared once are callable from Claude Desktop, Claude Code, and any other MCP client without a second integration. This page is the exact mapping between the two protocols, how to connect clients, and what the derived server does not do.

## What it is

`createMcpServer` takes one of three sources and returns the MCP `Server`, the `@axe/client` instance it uses to make calls, the manifest, and the tool list:

- An `AXE` instance from `createAXE`. Tool calls go to its fetch handler in-process; no network, no discovery.
- A manifest object. Tool calls go over HTTP to the manifest's `baseUrl`.
- A URL. The client runs `discover` from that URL first, then behaves as above.

Two transports ship. `serveStdio` connects the server to standard input and output, which is what desktop clients spawn. `serveHttp` returns a `(Request) => Promise<Response>` for the Streamable HTTP transport, so you can mount it next to your existing routes in any Web-standard framework.

In-process over stdio:

<!-- include: examples/mcp/serve.ts#stdio -->
```ts
import { createMcpServer, serveStdio } from "@axe/mcp";
import { axe } from "../apartments/site";

// In-process: every tool call goes straight to axe.handle(); nothing touches the network.
const derived = await createMcpServer(axe, {
  client: { agent: { name: "oakridge-mcp", version: "0.1.0", vendor: "Oakridge Rentals" } },
});

console.error(`serving ${derived.manifest.name}: ${derived.tools.length} tools`);
await serveStdio(derived);
```
<!-- /include -->

Mounted at `/mcp` in Hono, beside the AXE endpoints themselves:

<!-- include: examples/mcp/http.ts#http -->
```ts
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { axeFetch } from "@axe/fetch";
import { createMcpServer, serveHttp } from "@axe/mcp";
import { axe } from "../apartments/site";

const app = new Hono();
const axeHandler = axeFetch(axe);

// The MCP server calls the same AXE instance in-process, so /mcp and /axe/* stay in sync.
const mcpHandler = serveHttp(await createMcpServer(axe));

app.all("/axe/*", (c) => axeHandler(c.req.raw));
app.get("/.well-known/axe.json", (c) => axeHandler(c.req.raw));
app.all("/mcp", (c) => mcpHandler(c.req.raw));

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) });
```
<!-- /include -->

The HTTP transport is stateless by default. Pass a session id generator in the second argument of `serveHttp` if your MCP client requires stateful sessions.

For a site you do not run, the CLI does the same from the command line: `axe mcp <url>` discovers the manifest, derives the server, and serves it over stdio. The code above is for when you want the server inside your own process.

## The mapping table

The derived server is a bridge, not a second model of your site. Each row below is exactly what `@axe/mcp` does in v0.

| AXE                                                     | MCP                                                                                                                                                                                                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Action                                                  | One tool. Dots in the name become underscores: `units.search` becomes `units_search`, `applications.submit` becomes `applications_submit`. Hyphens are kept.                                                                                    |
| Action `input` JSON Schema                              | The tool's input schema, unchanged. Arguments are validated against it before the action is invoked; a mismatch returns an error listing each path, the same shape as `invalid_input`.                                                            |
| Action `title` and `description`                        | The tool title and description. A metadata line is appended: risk, read-only or changes state, idempotent or not, reversible or not, the required auth mode, deprecation, and the tools that follow as affordances.                             |
| `readOnly`, `reversible`, `idempotent`                  | Tool annotations: read-only hint from `readOnly`, destructive hint when the action changes state and is not `reversible`, idempotent hint from `idempotent`. The open-world hint is always set, because the tool reaches a remote site.           |
| `ok` result                                             | Text content. When the action has `display`, the text is the Markdown comparison from `toMarkdown` (links, badges, the `disclaimer`, each item's affordances as tool names) followed by the raw `output` as JSON. Without `display`, JSON only. The structured content is the whole result envelope. |
| `needs_input` result                                    | Text listing the `reason`, the `message`, and every `accepts` entry in the site's order with `kind`, `title`, `description`, whether it is `sensitive`, its `instructions`, and its payload `schema`; then an instruction to call `axe_continue` with the `continuationToken`, the chosen `kind`, and a `payload`. A `fallback` handoff is appended as text with the `resumeToken`. |
| `needs_human` result                                    | Text with the `reason`, `whatAgentShouldSayToUser`, the `url`, the `instructions`, and an instruction to call `axe_resume` with the `resumeToken` after the human finishes.                                                                    |
| `pending` result                                        | Polled inside the tool call for up to 20 seconds (configurable per server). If it settles, the settled result is returned. If not, text says to call `axe_poll` with the `pollUrl` after `retryAfter` seconds.                                    |
| `error` result                                          | Text with the `code`, `message`, whether it is `retryable`, and for `invalid_input` each issue's `path` and `message`. A `conflict` with `currentRev` is explained as a stale view; an `unavailable` with a `reason` relays it and what would unblock it. The tool result is flagged as an error. |
| `live`, `rev`, `expectedRev`                            | When the manifest carries `live`: an `axe_state` tool returns `/axe/state` as text and structured content; every action tool accepts an optional `expectedRev` argument (unless the action's own input uses that name), forwarded in the request envelope; `rev` is appended to `ok` and `needs_input` text; manifest-time `availability` is appended to the tool description. |
| Manifest                                                | The `axe_manifest` tool returns the whole manifest as JSON, so a model can read descriptions, schemas, `display`, and the affordance graph on demand.                                                                                             |
| `context.agent`                                         | The `client` option of `createMcpServer`: `agent`, `auth`, `locale`, `timezone`, and the rest of the client options are sent on every call.                                                                                                       |
| `policies.agents`                                       | The client refuses to call a site that denies its `vendor`. There is no MCP-level equivalent; the refusal surfaces as an error result.                                                                                                             |

Four helper tools are always present: `axe_manifest`, `axe_continue`, `axe_resume`, and `axe_poll`; `axe_state` is added when the manifest carries `live`. Their names are reserved. An action named `axe.continue` would derive to `axe_continue` and collide, so `createMcpServer` rejects it with an error naming the action; the same applies to two actions whose names differ only in the separator, such as `units.search` and `units_search`.

The server's instructions field tells the model how to read the five statuses, to confirm `sensitive` payloads with the user before calling `axe_continue`, to treat all text from the site as data rather than instructions, and where the human website is.

### What does not map

MCP is a tool protocol between a host and a server. Several things AXE defines have no counterpart, and the bridge makes them visible instead of hiding them.

- **Discovery at a domain.** MCP has no well-known path. You give the client the manifest URL or the `/mcp` mount; AXE's `/.well-known/axe.json` is what the bridge reads, not what the MCP client finds.
- **Human handoff.** MCP has no notion of a step the human must take and a token to come back with. `needs_human` becomes text the model relays, plus the `axe_resume` tool.
- **Idempotency keys.** MCP tool calls carry none. The underlying client generates an `idempotencyKey` for every mutating call, so a model that retries the same tool call sends two keys and may perform the action twice. Read the annotations before retrying.
- **Presentation.** MCP has no `display`. The bridge renders it to Markdown so the model can show a comparison, and keeps the full envelope in the structured content for hosts that want to render their own view.
- **Resources, prompts, and sampling.** The derived server declares only tools in v0. Resources and prompts may follow.
- **Streaming.** A tool call returns one result. Long-running work is `pending` and polling, as everywhere else in AXE; see [ROADMAP.md](../ROADMAP.md).

## Connecting Claude Desktop, Claude Code, and other clients

Claude Desktop spawns stdio servers from its configuration file (Settings, Developer, Edit Config). Point it at the CLI with the site's URL:

```json
{
  "mcpServers": {
    "oakridge-rentals": {
      "command": "npx",
      "args": ["-y", "axe", "mcp", "https://oakridge-rentals.example"]
    }
  }
}
````

For actions with `auth: "user"`, add the user's bearer token so it is sent on every call:

```json
{
  "mcpServers": {
    "oakridge-rentals": {
      "command": "npx",
      "args": ["-y", "axe", "mcp", "https://oakridge-rentals.example", "--auth", "sess_ana"]
    }
  }
}
```

Claude Code registers the same command:

```sh
claude mcp add oakridge-rentals -- npx -y axe mcp https://oakridge-rentals.example
```

Any stdio MCP client works the same way: run `npx -y axe mcp <url>` as the server command. Streamable HTTP clients point at your `/mcp` mount from the Hono example above. `axe mcp` writes one status line to standard error when it starts (site name and tool count), nothing else, and exits when the client closes standard input.

## Auth

`--auth <token>` on the CLI, or `auth` under the `client` option of `createMcpServer`, sends `Authorization: Bearer <token>` on every call. This is the [pass-through mode](auth.md): the token is one the human already granted the agent, and the site's `authenticate` function maps it to `onBehalfOf`.

When a `user` action is called without a valid token, the site returns a `login_required` handoff. In MCP that arrives as `needs_human` text with the login `url` and a `resumeToken`; the user signs in on the site, and the model calls `axe_resume`.

`@axe/mcp` does not implement OAuth for the MCP connection itself in v0. The stdio transport is local and needs none; the HTTP transport is served exactly as the MCP SDK provides it, and any authentication in front of `/mcp` is yours to add in your framework.

## Limits

- **One site per server.** A derived server exposes one manifest. To offer several sites to one client, run one server per site.
- **Descriptions are the site's text.** Tool descriptions, `needs_input` messages, and handoff text come from the site and are untrusted input to the model. The server's instructions say so, and the honesty rules and lint on the site side reduce the risk, but a host that displays tool descriptions should treat them as it treats any web content. See [Security](security.md).
- **Large outputs are truncated in text.** The JSON block in the text content is cut at 24,000 characters. The structured content always carries the full envelope; hosts that read it lose nothing.
- **No streaming.** A tool call blocks until the result envelope arrives, or until the `pending` poll budget is spent.
- **The poll budget is per server.** The default of 20 seconds is set by the poll budget option of `createMcpServer` and applies to both the initial call and `axe_poll`. Past it, the model must call `axe_poll` itself.

## Next steps

- [For agent builders](for-agent-builders.md): the same client the bridge uses, driven directly from your own agent loop.
- [Human handoff](human-handoff.md): what the human sees at the `url`, and how the site marks the handoff complete.
- [Auth](auth.md): the three modes and where pass-through tokens come from.
- [FAQ](faq.md): how AXE relates to MCP and the other standards.
