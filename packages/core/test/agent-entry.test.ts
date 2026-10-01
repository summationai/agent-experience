import { describe, expect, it } from "vitest";
import { agentEntry } from "../src/agent-site";

const CLAUDE =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Claude/2.16120.0 Chrome/152.0.797";
const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36";

const get = (path: string, headers: Record<string, string> = {}, method = "GET") =>
  new Request(`https://app.example.com${path}`, { method, headers });

describe("agentEntry", () => {
  it("sends Claude's browser, arriving from outside, to /agent", () => {
    const res = agentEntry(get("/", { "user-agent": CLAUDE, "sec-fetch-site": "none", "sec-fetch-dest": "document" }));
    expect(res?.status).toBe(303);
    expect(res?.headers.get("location")).toBe("/agent");
    expect(res?.headers.get("cache-control")).toBe("no-store");
  });

  it("sends a fetcher that sends no fetch metadata", () => {
    expect(agentEntry(get("/login", { "user-agent": "Claude-User/1.0" }))?.status).toBe(303);
  });

  it("leaves a person's browser alone", () => {
    expect(agentEntry(get("/", { "user-agent": CHROME, "sec-fetch-site": "none" }))).toBeNull();
  });

  it("leaves navigation within the site alone, so a person can sign in in the agent's browser", () => {
    expect(
      agentEntry(get("/login?redirectTo=%2Fagent%2Fsignin", { "user-agent": CLAUDE, "sec-fetch-site": "same-origin" })),
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
    expect(agentEntry(get("/", { "user-agent": CLAUDE }), { basePath: "/for-agents/" })?.headers.get("location")).toBe(
      "/for-agents",
    );
  });
});
