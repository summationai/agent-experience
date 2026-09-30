// The agent web's pages on this site: connect an agent session, approve an action, type a value.
import { agentSite } from "../../../lib/agent-site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handle = async (request: Request) =>
  (await agentSite(request)) ?? new Response("Not found", { status: 404 });

export const GET = handle;
export const POST = handle;
