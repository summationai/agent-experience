// The manifest at /.well-known/axe.json.
import { axeNext } from "@axe/next";
import { getAXE } from "../../../lib/axe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, OPTIONS } = axeNext(getAXE());
