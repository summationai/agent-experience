// Fixtures for the MCP HTTP tests: a small notes site that records which principal each handler
// ran for, a token verifier standing in for an external authorization server, and an MCP client
// over real HTTP.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { ElicitRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type {
  ClientCapabilities,
  ElicitRequest,
  ElicitResult,
} from "@modelcontextprotocol/sdk/types.js";
import { InvalidTokenError } from "@modelcontextprotocol/sdk/server/auth/errors.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { OAuthTokenVerifier } from "@modelcontextprotocol/sdk/server/auth/provider.js";
import { createAXE, action, accept, kinds, z } from "../../core/src/index";

export interface NotesState {
  /** One entry per handler, continuation, resume, or poll run: `<what>:<onBehalfOf>`. */
  runs: string[];
  notes: Map<string, { owner: string; text: string; email?: string }>;
  reportReady: boolean;
}

/**
 * A notes site. `user` auth: pass-through tokens `Bearer user:<id>` for HTTP callers, or an identity
 * from the adapter context for in-process callers.
 */
export function notesSite(baseUrl = "https://notes.example") {
  const state: NotesState = { runs: [], notes: new Map(), reportReady: false };
  const axe = createAXE({
    name: "Notes",
    description: "Personal notes: create a note, share it, and build a report of your notes.",
    baseUrl,
    auth: {
      modes: ["user"],
      authenticate: (req) => {
        const m = /^Bearer user:(.+)$/.exec(req.headers.get("authorization") ?? "");
        return m ? { onBehalfOf: m[1]! } : null;
      },
    },
    secret: "0123456789abcdef0123456789abcdef",
  });
  axe.register(
    action("notes.whoami", {
      title: "Who am I",
      description: "Returns the user the site sees for this call.",
      readOnly: true,
      risk: "none",
      auth: "user",
      input: z.object({}).strict(),
      output: z.object({ user: z.string() }),
      handler: async ({ identity }) => ({ user: identity!.onBehalfOf }),
    }),
  );
  axe.register(
    action("notes.create", {
      title: "Create a note",
      description:
        "Creates a note owned by the caller. Asks for the caller's email address first and returns the note id.",
      risk: "low",
      auth: "user",
      input: z.object({ text: z.string() }).strict(),
      output: z.object({ id: z.string(), owner: z.string() }),
      handler: async ({ input, identity, needsInput }) => {
        state.runs.push(`create:${identity!.onBehalfOf}`);
        return needsInput({
          reason: "consent_required",
          message: "An email address is needed to create a note.",
          accepts: [accept(kinds.contact.email, { description: "Where to send the note." })],
          state: { text: input.text },
        });
      },
      onContinue: async ({ identity, payload, state: s }) => {
        const owner = identity!.onBehalfOf;
        state.runs.push(`continue:${owner}`);
        const id = `N-${state.notes.size + 1}`;
        state.notes.set(id, {
          owner,
          text: (s as { text: string }).text,
          email: (payload as { email: string }).email,
        });
        return { id, owner };
      },
    }),
  );
  axe.register(
    action("notes.share", {
      title: "Share a note",
      description:
        "Shares a note publicly. A person confirms on the site, then the share completes.",
      risk: "medium",
      auth: "user",
      input: z.object({ id: z.string() }).strict(),
      output: z.object({ shared: z.string(), by: z.string() }),
      handler: async ({ input, identity, handoff }) => {
        state.runs.push(`share:${identity!.onBehalfOf}`);
        return handoff({
          reason: "consent_required",
          instructions: "Confirm the share on the note's page.",
          url: `${baseUrl}/notes/${input.id}/share`,
          whatAgentShouldSayToUser: "Please confirm the share on the site, then tell me.",
          state: { id: input.id },
        });
      },
      onResume: async ({ identity, state: s }) => {
        state.runs.push(`resume:${identity!.onBehalfOf}`);
        return { shared: (s as { id: string }).id, by: identity!.onBehalfOf };
      },
    }),
  );
  axe.register(
    action("reports.build", {
      title: "Build a report",
      description: "Builds a report of the caller's notes; the result is delivered by polling.",
      risk: "low",
      auth: "user",
      input: z.object({}).strict(),
      output: z.object({ owner: z.string(), count: z.number() }),
      handler: async ({ identity, pending }) => {
        state.runs.push(`report:${identity!.onBehalfOf}`);
        return pending({ retryAfter: 1 });
      },
      onPoll: async ({ identity, pending }) => {
        const owner = identity!.onBehalfOf;
        state.runs.push(`poll:${owner}`);
        if (!state.reportReady) return pending({ retryAfter: 1 });
        return { owner, count: [...state.notes.values()].filter((n) => n.owner === owner).length };
      },
    }),
  );
  return { axe, state };
}

/** Access tokens as an external authorization server would issue them for `https://mcp.example/mcp`. */
export const TOKENS: Record<string, { sub: string; scopes: string[]; resource?: string }> = {
  "tok-alice": { sub: "alice", scopes: ["notes"] },
  "tok-bob": { sub: "bob", scopes: ["notes"] },
  "tok-noscope": { sub: "carol", scopes: [] },
  "tok-elsewhere": { sub: "alice", scopes: ["notes"], resource: "https://other.example/mcp" },
};

export const verifier: OAuthTokenVerifier = {
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const t = TOKENS[token];
    if (!t) throw new InvalidTokenError("Unknown token");
    const info: AuthInfo = {
      token,
      clientId: "host-app",
      scopes: t.scopes,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
      extra: { sub: t.sub },
    };
    if (t.resource) info.resource = new URL(t.resource);
    return info;
  },
};

export interface HttpMcpClient {
  client: Client;
  transport: StreamableHTTPClientTransport;
}

/**
 * The SDK's MCP client over Streamable HTTP, optionally with a bearer token on every request, and
 * optionally declaring capabilities (elicitation, extensions) with an elicitation handler.
 */
export async function httpClient(
  url: string,
  token?: string,
  options: { capabilities?: ClientCapabilities; onElicit?: ElicitHandler } = {},
): Promise<HttpMcpClient> {
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
  });
  const client = new Client(
    { name: "http-test", version: "0" },
    options.capabilities ? { capabilities: options.capabilities } : {},
  );
  if (options.onElicit)
    client.setRequestHandler(ElicitRequestSchema, (req) => options.onElicit!(req.params));
  await client.connect(transport as unknown as Transport);
  return { client, transport };
}

export type ElicitHandler = (
  params: ElicitRequest["params"],
) => Promise<ElicitResult> | ElicitResult;

export function text(r: unknown): string {
  const content = (r as { content?: { text?: string }[] }).content ?? [];
  return content.map((c) => c.text ?? "").join("\n");
}

export function structured<T = Record<string, unknown>>(r: unknown): T {
  return (r as { structuredContent?: unknown }).structuredContent as T;
}

/** A promise with its resolver, for barriers. */
export function deferred<T = void>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}
