import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { agentEntry, forwardCookies } from "../src/agent-entry";
import * as site from "../src/agent-site";

const CLAUDE =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Claude/2.16120.0 Chrome/152.0.797";
const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36";

const get = (path: string, headers: Record<string, string> = {}, method = "GET") =>
  new Request(`https://app.example.com${path}`, { method, headers });

describe("agentEntry", () => {
  it("sends Claude's browser, arriving from outside, to /agent", () => {
    const res = agentEntry(
      get("/", { "user-agent": CLAUDE, "sec-fetch-site": "none", "sec-fetch-dest": "document" }),
    );
    expect(res?.status).toBe(303);
    expect(res?.headers.get("location")).toBe("/agent");
    expect(res?.headers.get("cache-control")).toBe("no-store");
  });

  it("sends a fetcher that sends no fetch metadata", () => {
    expect(agentEntry(get("/login", { "user-agent": "Claude-User/1.0" }))?.status).toBe(303);
  });

  it("sends Google-Agent, ChatGPT-User and a signed agent", () => {
    const google =
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko; compatible; Google-Agent; +https://developers.google.com/crawling/docs/crawlers-fetchers/google-agent) Chrome/141.0.0.0 Safari/537.36";
    const chatgpt =
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot";
    expect(agentEntry(get("/", { "user-agent": google }))?.status).toBe(303);
    expect(agentEntry(get("/", { "user-agent": chatgpt }))?.status).toBe(303);
    expect(
      agentEntry(
        get("/", {
          "user-agent": CHROME,
          "signature-agent": '"https://chatgpt.com"',
          "sec-fetch-site": "none",
        }),
      )?.status,
    ).toBe(303);
  });

  it("leaves crawlers alone", () => {
    expect(
      agentEntry(
        get("/", {
          "user-agent": "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
        }),
      ),
    ).toBeNull();
    expect(
      agentEntry(
        get("/", {
          "user-agent": "Mozilla/5.0 (compatible; GPTBot/1.4; +https://openai.com/gptbot)",
        }),
      ),
    ).toBeNull();
  });

  it("leaves a person's browser alone", () => {
    expect(agentEntry(get("/", { "user-agent": CHROME, "sec-fetch-site": "none" }))).toBeNull();
  });

  it("leaves navigation within the site alone, so a person can sign in in the agent's browser", () => {
    expect(
      agentEntry(
        get("/login?redirectTo=%2Fagent%2Fsignin", {
          "user-agent": CLAUDE,
          "sec-fetch-site": "same-origin",
        }),
      ),
    ).toBeNull();
  });

  it("leaves the agent pages, other methods, subresources and ?agent=off alone", () => {
    const ua = { "user-agent": CLAUDE };
    expect(agentEntry(get("/agent", ua))).toBeNull();
    expect(agentEntry(get("/agent/signin?agent_session=x", ua))).toBeNull();
    expect(agentEntry(get("/", ua, "POST"))).toBeNull();
    expect(agentEntry(get("/favicon.ico", { ...ua, "sec-fetch-dest": "image" }))).toBeNull();
    expect(agentEntry(get("/?agent=off", ua))).toBeNull();
  });

  it("follows basePath", () => {
    expect(
      agentEntry(get("/", { "user-agent": CLAUDE }), { basePath: "/for-agents/" })?.headers.get(
        "location",
      ),
    ).toBe("/for-agents");
  });
});

describe("@summationai/axe-core/agent-entry", () => {
  it("has no Node imports, so an Edge middleware can use it", () => {
    const src = readFileSync(new URL("../src/agent-entry.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/from "node:/);
    expect(src).not.toMatch(/^import (?!type )/m);
  });

  it("is re-exported from agent-site", () => {
    expect(site.agentEntry).toBe(agentEntry);
    expect(site.forwardCookies).toBe(forwardCookies);
  });
});

describe("forwardCookies", () => {
  it("passes on the named cookies for the request's host", () => {
    const request = new Request("http://localhost:5175/agent/signin?agent_session=x", {
      headers: { cookie: "theme=dark; app_session=abc%3D1; app_jwt=eyJ.x.y" },
    });
    expect(forwardCookies(request, ["app_session", "app_jwt", "missing"])).toEqual([
      { name: "app_session", value: "abc=1", domain: "localhost", path: "/", sameSite: "Lax" },
      { name: "app_jwt", value: "eyJ.x.y", domain: "localhost", path: "/", sameSite: "Lax" },
    ]);
  });

  it("passes on a value that is not percent-encoded as sent", () => {
    const request = new Request("https://app.example/", { headers: { cookie: "s=100%" } });
    expect(forwardCookies(request, ["s"])[0]!.value).toBe("100%");
  });
});
