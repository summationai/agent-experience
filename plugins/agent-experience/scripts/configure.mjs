#!/usr/bin/env node
import { cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const source = resolve(fileURLToPath(new URL("..", import.meta.url)));
const endpoint = process.argv[2];
const output = resolve(process.argv[3] ?? "dist/agent-experience-plugin");

if (!endpoint) {
  process.stderr.write("Usage: node scripts/configure.mjs <https://host/mcp> [output-directory]\n");
  process.exitCode = 1;
} else {
  const parsed = new URL(endpoint);
  if (parsed.protocol !== "https:" || parsed.pathname !== "/mcp" || parsed.search || parsed.hash)
    throw new Error("The public plugin endpoint must be HTTPS and end in /mcp.");
  if (output === source || source.startsWith(`${output}/`) || output.startsWith(`${source}/`))
    throw new Error("The output directory must be separate from the plugin source directory.");
  if (
    await stat(output).then(
      () => true,
      () => false,
    )
  )
    throw new Error(`The output directory already exists: ${output}`);
  await mkdir(output, { recursive: true });
  await cp(source, output, {
    recursive: true,
    filter: (path) => path !== resolve(source, "dist"),
  });
  for (const file of ["mcp.json", ".mcp.json"]) {
    const path = resolve(output, file);
    const text = await readFile(path, "utf8");
    await writeFile(
      path,
      text.replace("https://configure-before-publishing.invalid/mcp", parsed.href),
    );
  }
  process.stdout.write(`Configured plugin: ${output}\nMCP endpoint: ${parsed.href}\n`);
}
