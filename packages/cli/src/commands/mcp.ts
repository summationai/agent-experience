import { createMcpServer, serveStdio } from "@summationai/axe-mcp";
import type { CommandContext } from "../index";
import { parse, requireUrl } from "./shared";

export async function mcp(ctx: CommandContext): Promise<number> {
  const { values, positionals } = parse(ctx.args, { auth: { type: "string" } });
  const url = requireUrl(positionals[0], "axe mcp <url>");
  const derived = await createMcpServer(
    url,
    values.auth ? { client: { auth: String(values.auth) } } : {},
  );
  ctx.stderr(
    `axe mcp: serving ${derived.manifest.name} (${derived.tools.length} tools) over stdio`,
  );
  await serveStdio(derived);
  // Keep the process alive until the transport closes.
  await new Promise<void>((resolveDone) => {
    derived.server.onclose = () => resolveDone();
  });
  return 0;
}
