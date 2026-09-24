#!/usr/bin/env node
// Starts the getting-started Express example and runs `axe conformance` and `axe audit`
// against it, proving the tutorial works end to end. Exits non-zero on failure.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = 3210;
const base = `http://localhost:${port}`;

const server = spawn(
  process.execPath,
  ["--import", "tsx", "docs/examples/getting-started/server-express.ts"],
  {
    cwd: root,
    env: { ...process.env, PORT: String(port), AXE_BASE_URL: base },
    stdio: ["ignore", "pipe", "inherit"],
  },
);
server.stdout.on("data", (d) => process.stdout.write(`[server] ${d}`));

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`${base}/.well-known/axe.json`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("server did not start");
}

function runCli(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(root, "packages/cli/dist/index.js"), ...args], {
      cwd: root,
      stdio: "inherit",
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

let code = 1;
try {
  await waitForServer();
  const conformance = await runCli(["conformance", base]);
  const audit = await runCli(["audit", base, "--min-score", "80"]);
  code = conformance === 0 && audit === 0 ? 0 : 1;
} catch (e) {
  console.error(e);
} finally {
  server.kill();
}
process.exit(code);
