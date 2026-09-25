// Evaluation variant v3's basic tools (lib/basic-tools.ts). They answer in v3 and as shipped.
import { handleBasicTool } from "../../../lib/basic-tools";
import { basicToolsEnabled, notFound } from "../../../lib/variant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = async (request: Request, ctx: { params: Promise<{ name: string }> }) =>
  basicToolsEnabled() ? handleBasicTool(request, (await ctx.params).name) : notFound();
