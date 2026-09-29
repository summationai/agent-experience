// The manifest at /.well-known/axe.json. It answers in evaluation variant v4 and as shipped.
import { axeNext } from "@summationai/axe-next";
import { getAXE } from "../../../lib/axe";
import { axeEnabled, notFound } from "../../../lib/variant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const axe = axeNext(getAXE());
export const GET = (r: Request) => (axeEnabled() ? axe.GET(r) : notFound());
export const OPTIONS = (r: Request) => (axeEnabled() ? axe.OPTIONS(r) : notFound());
