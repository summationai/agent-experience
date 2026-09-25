// The app's own endpoints for its pages. All logic is in lib/ui-api.ts so the Node tests call it
// without Next.
import { handleUi } from "../../../lib/ui-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = (request: Request) => handleUi(request);
export const POST = (request: Request) => handleUi(request);
