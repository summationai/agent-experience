// The agent web end to end, against real headless Chromium: an agent that can only follow links
// (GET, no cookies, and only URLs it has already seen, as a model's web fetch does), a person on
// the site's own pages, and a Surface offered through WebMCP. Skipped where Chromium cannot start.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build } from "esbuild";
import { createServer } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { createAgentWeb } from "../src/agent-web";
import type { AgentWeb } from "../src/agent-web";
import { agentSiteHandler } from "@summationai/axe-core/agent-site";
import { chromiumMissing } from "./helpers";

const missing = await chromiumMissing();
const SECRET = "s".repeat(40);
const AGENT = "https://agent.example";
const SITE = "https://site.example";

// The application: signed in by its `session` cookie; an easy-mode Surface offered through WebMCP.
const appPage = (
  user: string | null,
) => `<!doctype html><html><head><meta charset="utf-8"><title>Board</title></head>
<body><main><h1>Board</h1><p id="who">${user ? `Signed in as ${user}` : "Signed out"}</p>
<p>Count: <output id="count">0</output></p><p id="status"></p>
<button id="add" type="button">Add one</button>
<label>Greeting <input id="greeting"></label>
<label>Quantity <input id="qty" type="number"></label>
<button id="delete" type="button">Delete everything</button>
</main><script>
  let count = 0;
  document.getElementById("add").addEventListener("click", () => { document.getElementById("count").textContent = String(++count); });
  document.getElementById("delete").addEventListener("click", () => { document.getElementById("status").textContent = "Everything deleted"; });
</script><script src="/bundle.js"></script></body></html>`;

let app: Server;
let appUrl = "";
let web: AgentWeb;

const listen = (s: Server) =>
  new Promise<number>((r) => s.listen(0, "127.0.0.1", () => r((s.address() as AddressInfo).port)));

beforeAll(async () => {
  if (missing) return;
  const bundle = (
    await build({
      entryPoints: [fileURLToPath(new URL("./fixtures/webmcp-entry.ts", import.meta.url))],
      bundle: true,
      write: false,
      format: "iife",
      platform: "browser",
      target: "es2022",
      logLevel: "silent",
    })
  ).outputFiles[0]!.text;
  app = createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0];
    if (path === "/bundle.js") {
      res.writeHead(200, { "Content-Type": "text/javascript" });
      return void res.end(bundle);
    }
    const user = /(?:^|; )session=([^;]+)/.exec(req.headers.cookie ?? "")?.[1] ?? null;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(appPage(user ? decodeURIComponent(user) : null));
  });
  appUrl = `http://localhost:${await listen(app)}`;
});

afterAll(async () => {
  await web?.close();
  app?.close();
});

/** A model's web fetch: GET only, no cookies, and only URLs it has already seen. */
class Agent {
  readonly seen = new Set<string>();
  readonly fetched: string[] = [];
  constructor(
    private readonly service: AgentWeb,
    userMessage: string,
  ) {
    this.learn(userMessage);
  }
  private learn(text: string) {
    for (const m of text.matchAll(/https?:\/\/[^\s)\]"'<>*]+/g))
      this.seen.add(m[0].replace(/[.,;:]+$/, ""));
  }
  async get(url: string): Promise<string> {
    if (!this.seen.has(url)) throw new Error(`url_not_in_prior_context: ${url}`);
    this.fetched.push(url);
    const r = await this.service.handle(new Request(url));
    const text = await r.text();
    this.learn(text);
    return text;
  }
  /** The link on the line that mentions `label`, in a page it read. */
  link(page: string, label: RegExp | string): string {
    const line = page
      .split("\n")
      .find((l) => (typeof label === "string" ? l.includes(label) : label.test(l)));
    const url = line && /https?:\/\/\S+/.exec(line)?.[0].replace(/[).,;]+$/, "");
    if (!url) throw new Error(`no link for ${label} in:\n${page}`);
    return url;
  }
}

/** The person, in their own browser, on the site: signed in there with its own cookie. */
function person(principal: string) {
  const site = agentSiteHandler({
    serviceUrl: AGENT,
    secret: SECRET,
    identify: (req) => {
      const u = /(?:^|; )site_user=([^;]+)/.exec(req.headers.get("cookie") ?? "")?.[1];
      return u ? { principal: u, displayName: u } : null;
    },
    // A session for the agent's headless page, minted by the site for this person.
    session: (_req, who) => ({ cookies: [{ name: "session", value: who.principal }] }),
    // Relative, as a site usually answers: the browser resolves it against the site's origin.
    loginUrl: (returnTo) => `/login?returnTo=${encodeURIComponent(returnTo)}`,
    fetch: (input, init) => web.handle(new Request(String(input), init)),
  });
  const cookie = `site_user=${principal}`;
  return {
    open: async (url: string) => {
      const r = await site(new Request(url, { headers: { cookie } }));
      return { status: r!.status, html: await r!.text() };
    },
    submit: async (url: string, fields: Record<string, string>) => {
      const got = await site(new Request(url, { headers: { cookie } }));
      const nonce = /name="nonce" value="([^"]+)"/.exec(await got!.text())?.[1] ?? "";
      const r = await site(
        new Request(url, {
          method: "POST",
          headers: { cookie, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ nonce, ...fields }),
        }),
      );
      return { status: r!.status, html: await r!.text() };
    },
    signedOut: site,
  };
}

describe.skipIf(missing)("agent web: an agent with only web fetch, a person on the site", () => {
  it("starts in the agent, signs in on the site, and reads, clicks, types, and asks, all by links", async () => {
    web = createAgentWeb({
      publicUrl: AGENT,
      siteUrl: SITE,
      appUrl,
      startPath: "/board?granularity=domain",
      appName: "Board",
      siteSecret: SECRET,
    });
    const agent = new Agent(web, `Use ${AGENT}/start to add one on my board.`);
    const dana = person("dana");

    // 1. The agent starts. The person signs in on the site and confirms the code the agent showed.
    const start = await agent.get(`${AGENT}/start`);
    const code = /\*\*([A-Z0-9]{3}-[A-Z0-9]{3})\*\*/.exec(start)![1]!;
    const signin = /https:\/\/site\.example\/agent\/signin\?agent_session=\S+/.exec(start)![0];
    const early = await agent.get(agent.link(start, "continue"));
    expect(early).toContain("has not connected this session yet");
    const confirm = await dana.open(signin);
    expect(confirm.html).toContain(code);
    expect((await dana.submit(signin, { decision: "connect" })).html).toContain("Connected");

    // 2. Signed in as the person: the page's content and its controls, each a link.
    let page = await agent.get(agent.link(early, "continue"));
    expect(page).toContain("Board, as dana");
    expect(page).toContain("Signed in as dana");
    expect(page).toContain("**Count:** 0");

    // 3. A click.
    page = await agent.get(agent.link(page, "Add one:"));
    expect(page).toContain("**Count:** 1");

    // 4. A number, digit by digit, without typing: 1, 2, done.
    let pad = await agent.get(agent.link(page, /Quantity.*enter a number/));
    pad = await agent.get(/\[1\]\((\S+?)\)/.exec(pad)![1]!);
    pad = await agent.get(/\[2\]\((\S+?)\)/.exec(pad)![1]!);
    expect(pad).toContain("So far: **12**");
    page = await agent.get(agent.link(pad, "Done, set it to 12"));
    expect(page).toContain('Quantity (now "12")');

    // 5. Free text: the person types it on the site's page; the agent only learns it was set.
    const ask = await agent.get(agent.link(page, /Greeting.*ask the person/));
    const input = /https:\/\/site\.example\/agent\/input\/\S+/.exec(ask)![0];
    expect((await dana.submit(input, { text: "Hello from Dana" })).html).toContain("Saved");
    page = await agent.get(agent.link(ask, "continue"));
    expect(page).toContain("The person set Greeting");
    expect(page).toContain('Greeting (now "Hello from Dana")');

    // 6. A high-risk control: nothing runs until the person approves on the site.
    const risky = await agent.get(agent.link(page, "Delete everything"));
    expect(risky).toContain("Approval needed");
    expect(risky).not.toContain("Everything deleted");
    const approve = /https:\/\/site\.example\/agent\/approve\/\S+/.exec(risky)![0];
    const shown = await dana.open(approve);
    expect(shown.html).toContain("Approve “Delete everything”?");
    expect((await dana.submit(approve, { decision: "approve" })).html).toContain("Approved");
    page = await agent.get(agent.link(risky, "continue"));
    expect(page).toContain("Everything deleted");

    // Everything the agent fetched came from its own message or an earlier page.
    expect(agent.fetched.every((u) => u.startsWith(AGENT))).toBe(true);
  }, 90_000);

  it("refuses what it must: made-up links, replays, other people, and calls without the secret", async () => {
    const agent = new Agent(web, `${AGENT}/start`);
    const start = await agent.get(`${AGENT}/start`);
    const sid = /agent_session=(\S+)/.exec(start)![1]!;
    // A link the agent composed itself is not one it has seen.
    await expect(agent.get(`${AGENT}/s/${sid}/made-up`)).rejects.toThrow(
      "url_not_in_prior_context",
    );
    // The site API needs the shared secret.
    const anon = await web.handle(new Request(`${AGENT}/api/sessions/${sid}`));
    expect(anon.status).toBe(401);
    // Signed out, the site sends the person to its sign-in page.
    const out = await person("dana").signedOut(
      new Request(`${SITE}/agent/signin?agent_session=${sid}`),
    );
    expect(out!.status).toBe(303);
    expect(out!.headers.get("location")).toBe(
      `/login?returnTo=${encodeURIComponent(`/agent/signin?agent_session=${sid}`)}`,
    );
    // Connect as dana; then eve cannot answer dana's requests, and a second connect is refused.
    const signin = `${SITE}/agent/signin?agent_session=${sid}`;
    await person("dana").submit(signin, { decision: "connect" });
    expect((await person("eve").open(signin)).status).toBe(409);
    let page = await agent.get(agent.link(start, "continue"));
    const risky = await agent.get(agent.link(page, "Delete everything"));
    const approve = /https:\/\/site\.example\/agent\/approve\/\S+/.exec(risky)![0];
    expect((await person("eve").open(approve)).status).toBe(403);
    // A forged form (no valid nonce) is not a decision.
    const forged = await person("dana").signedOut(
      new Request(approve, {
        method: "POST",
        headers: { cookie: "site_user=dana", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ nonce: "x", decision: "approve" }),
      }),
    );
    expect(forged!.status).toBe(400);
    // Declined: nothing runs, and the agent is told.
    await person("dana").submit(approve, { decision: "deny" });
    page = await agent.get(agent.link(risky, "continue"));
    expect(page).toContain("declined");
    expect(page).not.toContain("Everything deleted");
    // An act link is used once.
    const add = agent.link(page, "Add one:");
    await agent.get(add);
    expect(await agent.get(add)).toContain("Already done: Add one");
    // `/agent` on the site is where an agent that found the site starts: on to the agent web.
    const entry = await agentSiteHandler({
      serviceUrl: "http://127.0.0.1:4719",
      agentUrl: AGENT,
      secret: SECRET,
      identify: () => null,
      session: () => ({}),
      loginUrl: () => "/login",
    })(new Request(`${SITE}/agent`));
    expect(entry!.status).toBe(303);
    expect(entry!.headers.get("location")).toBe(`${AGENT}/start`);
    // Every page forbids caching: it is one person's, at one moment.
    const r = await web.handle(new Request(`${AGENT}/start`));
    expect(r.headers.get("cache-control")).toContain("no-store");
  }, 90_000);

  it("with textInUrl, an agent that composes URLs types a value itself, once", async () => {
    const composing = createAgentWeb({
      publicUrl: AGENT,
      siteUrl: SITE,
      appUrl,
      startPath: "/board?granularity=domain",
      appName: "Board",
      siteSecret: SECRET,
      textInUrl: true,
    });
    try {
      const start = await (await composing.handle(new Request(`${AGENT}/start`))).text();
      const sid = /agent_session=(\S+)/.exec(start)![1]!;
      const site = agentSiteHandler({
        serviceUrl: AGENT,
        secret: SECRET,
        identify: () => ({ principal: "dana" }),
        session: () => ({ cookies: [{ name: "session", value: "dana" }] }),
        loginUrl: () => "/login",
        fetch: (input, init) => composing.handle(new Request(String(input), init)),
      });
      const signin = `${SITE}/agent/signin?agent_session=${sid}`;
      const form = await (await site(new Request(signin)))!.text();
      const nonce = /name="nonce" value="([^"]+)"/.exec(form)![1]!;
      await site(
        new Request(signin, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ nonce, decision: "connect" }),
        }),
      );
      const view = /continue: (\S+)/.exec(start)![1]!;
      const page = await (await composing.handle(new Request(view))).text();
      const line = page.split("\n").find((l) => l.startsWith("- Greeting (now"))!;
      expect(line).toContain("type it yourself: ");
      const template = /type it yourself: (\S+)\?text=/.exec(line)![1]!;
      // The agent composes the value into the URL.
      const typed = await (
        await composing.handle(
          new Request(`${template}?text=${encodeURIComponent("Hi, from Claude")}`),
        )
      ).text();
      expect(typed).toContain('Greeting (now "Hi, from Claude")');
      const again = await (await composing.handle(new Request(`${template}?text=twice`))).text();
      expect(again).toContain("Already done: Greeting");
      // Without the option, no page offers it.
      const strict = await (await web.handle(new Request(`${AGENT}/start`))).text();
      expect(strict).not.toContain("type it yourself");
    } finally {
      await composing.close();
    }
  }, 90_000);
});

describe("the agent web answered from the site's own origin", () => {
  it("an agent that starts at the site's /agent follows only links on the site", async () => {
    const web = createAgentWeb({
      publicUrl: `${SITE}/agent`,
      siteUrl: SITE,
      appUrl: "http://127.0.0.1:9",
      appName: "Board",
      siteSecret: SECRET,
    });
    const seen: string[] = [];
    const site = agentSiteHandler({
      serviceUrl: "http://127.0.0.1:4719",
      secret: SECRET,
      identify: () => null,
      session: () => ({}),
      loginUrl: () => "/login",
      fetch: (input, init) => {
        seen.push(String(input));
        return web.handle(new Request(String(input), init));
      },
    });
    const ua = { "user-agent": "Claude-User (test)" };
    const start = await site(new Request(`${SITE}/agent`, { headers: ua }));
    expect(start!.status).toBe(200);
    expect(start!.headers.get("cache-control")).toContain("no-store");
    const text = await start!.text();
    // Every link on the page is on the site: the session links under /agent/s/, the sign-in page.
    const links = text.match(/https?:\/\/\S+/g)!;
    expect(links.length).toBeGreaterThan(1);
    for (const l of links) expect(l.startsWith(`${SITE}/agent/`), l).toBe(true);
    const next = /continue: (\S+)/.exec(text)![1]!;
    const pending = await site(new Request(next, { headers: ua }));
    expect(await pending!.text()).toContain("has not connected this session yet");
    // The site passed /agent on as the service's /start, and /agent/s/... as /s/...
    expect(seen[0]).toBe("http://127.0.0.1:4719/start");
    expect(seen[1]).toMatch(/^http:\/\/127\.0\.0\.1:4719\/s\//);
    // The service's site API is not reachable through the site, and only GET and HEAD pass.
    const api = await site(new Request(`${SITE}/agent/api/sessions/x`));
    expect(api!.status).not.toBe(200);
    await site(new Request(next, { method: "POST" }));
    expect(seen).toHaveLength(2);
  });

  it("has no agent pages until it has a secret", async () => {
    const site = agentSiteHandler({
      serviceUrl: "http://127.0.0.1:9",
      secret: "",
      identify: () => null,
      session: () => ({}),
      loginUrl: () => "/login",
      fetch: () => Promise.reject(new Error("not called")),
    });
    expect(await site(new Request(`${SITE}/agent`))).toBeNull();
    expect(await site(new Request(`${SITE}/agent/signin?agent_session=x`))).toBeNull();
  });

  it("says so when the service is down", async () => {
    const site = agentSiteHandler({
      serviceUrl: "http://127.0.0.1:9",
      secret: SECRET,
      identify: () => null,
      session: () => ({}),
      loginUrl: () => "/login",
      fetch: () => Promise.reject(new Error("ECONNREFUSED")),
    });
    const res = await site(new Request(`${SITE}/agent`));
    expect(res!.status).toBe(502);
  });
});
