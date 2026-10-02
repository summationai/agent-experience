import { describe, expect, it } from "vitest";
import { runRelayCli } from "../src/cli";

async function run(args: string[], env: Record<string, string> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  let stop!: () => void;
  const until = new Promise<void>((r) => (stop = r));
  const exit = runRelayCli(args, {
    stdout: (l) => out.push(l),
    stderr: (l) => err.push(l),
    env,
    until,
  });
  return { out, err, stop, exit };
}

describe("axe relay", () => {
  it("--dev prints the page snippet and the claude mcp add commands, with the development key", async () => {
    const r = await run(["--dev", "--port", "0", "--dev-key", "axd_test_key"]);
    await new Promise<void>((resolve) => {
      const t = setInterval(() => {
        if (r.out.some((l) => l.includes("pair with code"))) {
          clearInterval(t);
          resolve();
        }
      }, 5);
    });
    const text = r.out.join("\n");
    expect(text).toMatch(/listening for tabs on ws:\/\/127\.0\.0\.1:\d+\/tab/);
    expect(text).toMatch(
      /connectRelay\(surface, \{ url: "ws:\/\/127\.0\.0\.1:\d+\/tab", getToken: devToken\("http:\/\/127\.0\.0\.1:\d+"\) \}\)/,
    );
    expect(text).toMatch(
      /claude mcp add --transport http surface http:\/\/127\.0\.0\.1:\d+\/mcp --header "Authorization: Bearer axd_test_key"/,
    );
    expect(text).toContain(
      "claude mcp add surface -- npx @summationai/axe@latest relay --dev --stdio",
    );
    r.stop();
    expect(await r.exit).toBe(0);
  });

  it("without --dev it needs a named principal, an origin, and AXE_RELAY_SECRET", async () => {
    const r = await run(["--stdio", "--principal", "alice"]);
    expect(await r.exit).toBe(1);
    expect(r.err.join("\n")).toContain("AXE_RELAY_SECRET");
  });

  it("refuses a public interface in development", async () => {
    const r = await run(["--dev", "--host", "0.0.0.0", "--port", "0"]);
    expect(await r.exit).toBe(1);
    expect(r.err.join("\n")).toContain("loopback only");
  });
});
