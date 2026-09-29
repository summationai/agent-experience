/**
 * MCP elicitation for the AXE ladder ([P-MCP-6], [P-MCP-7]), against the SDK's own client
 * declaring or not declaring the `elicitation` capability (form, URL, both), over the in-memory
 * transport and over real HTTP with `serveHttp` (sessions, where the server can send a request to
 * the client in the middle of a tool call; and stateless, where it cannot).
 */
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ElicitRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type {
  ClientCapabilities,
  ElicitRequest,
  ElicitResult,
} from "@modelcontextprotocol/sdk/types.js";
import { createMcpServer, isSensitiveAccept, serveHttp, toFormSchema } from "../src/index";
import type { McpServerOptions } from "../src/index";
import { planElicitation } from "../src/elicitation";
import { kinds, toJsonSchema } from "../../core/src/index";
import type { AxeLike } from "../src/index";
import { apartmentsAXE } from "../../core/test/fixtures/apartments";
import { httpClient, notesSite, structured, text, verifier } from "./fixtures";
import type { ElicitHandler } from "./fixtures";
import { listen } from "./listen";
import type { Listening } from "./listen";

type Params = ElicitRequest["params"];

async function inMemory(
  axe: AxeLike,
  auth: string,
  capabilities: ClientCapabilities | undefined,
  onElicit?: ElicitHandler,
  options: McpServerOptions = {},
) {
  const derived = await createMcpServer(axe, { ...options, client: { auth } });
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await derived.server.connect(serverT);
  const client = new Client({ name: "t", version: "0" }, capabilities ? { capabilities } : {});
  if (onElicit) client.setRequestHandler(ElicitRequestSchema, (req) => onElicit(req.params));
  await client.connect(clientT);
  return client;
}

/** An elicitation handler that records every request and answers from a script. */
function scripted(...answers: ElicitResult[]) {
  const seen: Params[] = [];
  const handler: ElicitHandler = (params) => {
    seen.push(params);
    return answers.shift() ?? { action: "cancel" };
  };
  return { seen, handler };
}

let servers: Listening[] = [];
afterEach(async () => {
  for (const s of servers) await s.close();
  servers = [];
});

describe("form and URL elicitation, in memory", () => {
  it("a client without the capability gets the needs_input text as before", async () => {
    const { axe, state } = notesSite();
    const client = await inMemory(axe, "user:alice", undefined);
    const r = await client.callTool({ name: "notes_create", arguments: { text: "hi" } });
    expect(structured<{ status: string }>(r).status).toBe("needs_input");
    expect(text(r)).toContain("kind `contact.email`");
    expect(text(r)).toContain("axe_continue");
    expect(text(r)).not.toContain("elicitation");
    expect(state.runs).toEqual(["create:alice"]);
  });

  it("a form-capable client is asked for a non-sensitive kind in a flat form, and the answer continues the action", async () => {
    const { axe, state } = notesSite();
    const { seen, handler } = scripted({
      action: "accept",
      content: { email: "alice@example.com" },
    });
    const client = await inMemory(axe, "user:alice", { elicitation: { form: {} } }, handler);
    const r = await client.callTool({ name: "notes_create", arguments: { text: "hi" } });
    expect(seen).toHaveLength(1);
    const req = seen[0] as Extract<Params, { requestedSchema: unknown }>;
    expect(req.mode).toBe("form");
    expect(req.message).toContain("An email address is needed to create a note.");
    expect(req.requestedSchema).toMatchObject({
      type: "object",
      properties: { email: { type: "string", format: "email" } },
      required: ["email"],
    });
    expect(structured(r)).toMatchObject({ status: "ok", output: { id: "N-1", owner: "alice" } });
    expect(text(r)).toContain("The user provided `contact.email` in a form the MCP client showed");
    expect(state.notes.get("N-1")).toEqual({
      owner: "alice",
      text: "hi",
      email: "alice@example.com",
    });
    expect(state.runs).toEqual(["create:alice", "continue:alice"]);
  });

  it("decline and cancel return the needs_input result to the model, whose axe_continue still works", async () => {
    const { axe, state } = notesSite();
    const { seen, handler } = scripted({ action: "decline" }, { action: "cancel" });
    const client = await inMemory(axe, "user:alice", { elicitation: {} }, handler);
    const declined = await client.callTool({ name: "notes_create", arguments: { text: "a" } });
    expect(structured<{ status: string }>(declined).status).toBe("needs_input");
    expect(text(declined)).toContain("The user declined to provide `contact.email`");
    expect(text(declined)).toContain("To continue, call `axe_continue`");
    const cancelled = await client.callTool({ name: "notes_create", arguments: { text: "b" } });
    expect(text(cancelled)).toContain("dismissed the form");
    expect(seen.map((p) => p.mode)).toEqual(["form", "form"]); // `{}` means form only
    const token = structured<{ continuationToken: string }>(cancelled).continuationToken;
    const done = await client.callTool({
      name: "axe_continue",
      arguments: {
        continuationToken: token,
        kind: "contact.email",
        payload: { email: "a@b.example" },
      },
    });
    expect(structured<{ status: string }>(done).status).toBe("ok");
    expect(state.runs).toEqual(["create:alice", "create:alice", "continue:alice"]);
  });

  it("a sensitive kind is never put in a form; URL mode offers the site's page when the client has it, otherwise the text", async () => {
    // applications.submit prefers payment.ach-debit (sensitive), then payment.wire-confirmation
    // (not flagged sensitive, but a payment kind), with a fallback page.
    const formOnly = scripted();
    const a = apartmentsAXE();
    const c1 = await inMemory(a.axe, "user:dana", { elicitation: { form: {} } }, formOnly.handler);
    const r1 = await c1.callTool({ name: "applications_submit", arguments: { unitId: "u_204" } });
    expect(formOnly.seen).toEqual([]);
    expect(structured<{ status: string }>(r1).status).toBe("needs_input");
    expect(text(r1)).toContain("SENSITIVE");

    const both = scripted({ action: "accept" });
    const b = apartmentsAXE();
    const c2 = await inMemory(
      b.axe,
      "user:dana",
      { elicitation: { form: {}, url: {} } },
      both.handler,
    );
    const r2 = await c2.callTool({ name: "applications_submit", arguments: { unitId: "u_204" } });
    expect(both.seen).toHaveLength(1);
    const req = both.seen[0] as Extract<Params, { mode: "url" }>;
    expect(req.mode).toBe("url");
    expect(req.url).toMatch(
      /^https:\/\/oakridge-rentals\.example\/applications\/APP-\d+\/deposit\?axe_handoff=[0-9a-f]+$/,
    );
    expect(req.elicitationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(req)).not.toContain("requestedSchema");
    const s2 = structured<{ status: string; fallback: { resumeToken: string } }>(r2);
    expect(s2.status).toBe("needs_input");
    expect(text(r2)).toContain(
      "the user agreed to open it (URL elicitation). That is not completion",
    );
    expect(text(r2)).toContain(s2.fallback.resumeToken);
  });

  it("needs_human is offered as the site's page in URL mode, never in a form; login_required is left to MCP authorization", async () => {
    const { axe } = notesSite();
    const url = scripted({ action: "decline" });
    const c = await inMemory(
      axe,
      "user:alice",
      { elicitation: { form: {}, url: {} } },
      url.handler,
    );
    const r = await c.callTool({ name: "notes_share", arguments: { id: "N-9" } });
    expect(url.seen).toHaveLength(1);
    expect(url.seen[0]).toMatchObject({ mode: "url" });
    expect((url.seen[0] as { url: string }).url).toMatch(
      /^https:\/\/notes\.example\/notes\/N-9\/share\?axe_handoff=[0-9a-f]+$/,
    );
    expect(text(r)).toContain("The user declined to open the site's page");
    expect(text(r)).toContain("axe_resume");

    const login = scripted({ action: "accept" });
    const a = apartmentsAXE();
    const anonymous = await inMemory(a.axe, "", { elicitation: { url: {} } }, login.handler);
    const r2 = await anonymous.callTool({
      name: "applications_submit",
      arguments: { unitId: "u_204" },
    });
    expect(structured<{ status: string; handoff: { reason: string } }>(r2)).toMatchObject({
      status: "needs_human",
      handoff: { reason: "login_required" },
    });
    expect(login.seen).toEqual([]);
  });

  it("`elicitation: false` keeps every result as text", async () => {
    const { axe } = notesSite();
    const { seen, handler } = scripted({ action: "accept", content: { email: "x@y.example" } });
    const c = await inMemory(axe, "user:alice", { elicitation: { form: {}, url: {} } }, handler, {
      elicitation: false,
    });
    const r = await c.callTool({ name: "notes_create", arguments: { text: "hi" } });
    expect(structured<{ status: string }>(r).status).toBe("needs_input");
    expect(seen).toEqual([]);
  });

  it("only schemas in the form subset become forms; sensitivity is decided before the schema", () => {
    const email = toFormSchema(toJsonSchema(kinds.contact.email.schema, "input"));
    expect(email?.requestedSchema.properties["email"]).toMatchObject({
      type: "string",
      format: "email",
    });
    expect(toFormSchema(toJsonSchema(kinds.contact.address.schema, "input"))).not.toBeNull();
    // A nested object has no form rendering.
    expect(
      toFormSchema({ type: "object", properties: { a: { type: "object", properties: {} } } }),
    ).toBeNull();
    // A single primitive is wrapped as `value`.
    expect(toFormSchema({ type: "string", enum: ["net30", "net60"] })).toEqual({
      requestedSchema: {
        type: "object",
        properties: { value: { type: "string", enum: ["net30", "net60"] } },
        required: ["value"],
      },
      wrapped: true,
    });
    expect(isSensitiveAccept({ kind: "payment.wire-confirmation", sensitive: false })).toBe(true);
    expect(isSensitiveAccept({ kind: "identity.date-of-birth", sensitive: true })).toBe(true);
    expect(isSensitiveAccept({ kind: "x-bank.api-key", sensitive: false })).toBe(true);
    expect(isSensitiveAccept({ kind: "contact.email", sensitive: false })).toBe(false);
    // A site-flagged sensitive kind with a perfectly flat schema still gets no form.
    const flagged = {
      kind: "x-club.member-note",
      title: "Note",
      description: "A private note.",
      schema: { type: "object", properties: { note: { type: "string" } } },
      sensitive: true,
    };
    expect(planElicitation([flagged], { form: true, url: false }, undefined).mode).toBe("none");
    expect(
      planElicitation([flagged], { form: true, url: true }, "https://club.example/n").mode,
    ).toBe("url");
    expect(planElicitation([flagged], { form: true, url: true }, "javascript:alert(1)").mode).toBe(
      "none",
    );
    const plan = planElicitation(
      [{ ...flagged, sensitive: false }],
      { form: false, url: true },
      undefined,
    );
    expect(plan.mode).toBe("none");
  });
});

describe("elicitation over real HTTP", () => {
  it("over HTTP sessions the form reaches the calling client mid-call, and the continuation runs as that caller", async () => {
    const { axe, state } = notesSite();
    const handler = serveHttp(await createMcpServer(axe), {
      sessions: true,
      auth: { verifier },
      clientFor: (info) => ({ identity: { onBehalfOf: String(info.extra?.["sub"]) } }),
    });
    const l = await listen(handler);
    servers.push(l);
    const alice = scripted({ action: "accept", content: { email: "alice@example.com" } });
    const a = await httpClient(`${l.url}/mcp`, "tok-alice", {
      capabilities: { elicitation: { form: {} } },
      onElicit: alice.handler,
    });
    const bob = await httpClient(`${l.url}/mcp`, "tok-bob"); // no elicitation capability
    const ra = await a.client.callTool({ name: "notes_create", arguments: { text: "from alice" } });
    const rb = await b_call(bob.client);
    expect(alice.seen).toHaveLength(1);
    expect(structured(ra)).toMatchObject({ status: "ok", output: { owner: "alice" } });
    expect(structured<{ status: string }>(rb).status).toBe("needs_input");
    expect(state.runs).toEqual(["create:alice", "continue:alice", "create:bob"]);
    await a.client.close();
    await bob.client.close();
    await handler.close();
  });

  it("over HTTP sessions a URL-capable client is offered the handoff page", async () => {
    const { axe } = notesSite();
    const handler = serveHttp(await createMcpServer(axe), {
      sessions: true,
      auth: { verifier },
      clientFor: (info) => ({ identity: { onBehalfOf: String(info.extra?.["sub"]) } }),
    });
    const l = await listen(handler);
    servers.push(l);
    const offer = scripted({ action: "accept" });
    const c = await httpClient(`${l.url}/mcp`, "tok-alice", {
      capabilities: { elicitation: { url: {} } },
      onElicit: offer.handler,
    });
    const r = await c.client.callTool({ name: "notes_share", arguments: { id: "N-1" } });
    expect(offer.seen[0]).toMatchObject({ mode: "url" });
    expect((offer.seen[0] as { url: string }).url).toContain(
      "https://notes.example/notes/N-1/share?axe_handoff=",
    );
    expect(text(r)).toContain("agreed to open it");
    await c.client.close();
    await handler.close();
  });

  it("stateless HTTP cannot carry a server request, so the client gets the text", async () => {
    const { axe } = notesSite();
    const handler = serveHttp(await createMcpServer(axe), {
      auth: { verifier },
      clientFor: (info) => ({ identity: { onBehalfOf: String(info.extra?.["sub"]) } }),
    });
    const l = await listen(handler);
    servers.push(l);
    const never = scripted({ action: "accept", content: { email: "x@y.example" } });
    const c = await httpClient(`${l.url}/mcp`, "tok-alice", {
      capabilities: { elicitation: { form: {}, url: {} } },
      onElicit: never.handler,
    });
    const r = await c.client.callTool({ name: "notes_create", arguments: { text: "hi" } });
    expect(structured<{ status: string }>(r).status).toBe("needs_input");
    expect(never.seen).toEqual([]);
    await c.client.close();
  });
});

function b_call(client: Client) {
  return client.callTool({ name: "notes_create", arguments: { text: "from bob" } });
}
