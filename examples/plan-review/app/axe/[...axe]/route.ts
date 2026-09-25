// The AXE endpoints: /axe/actions/{name}, /axe/continue, /axe/resume, /axe/poll, /axe/state.
import { axeNext } from "@axe/next";
import { getAXE } from "../../../lib/axe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const { GET, POST, OPTIONS } = axeNext(getAXE());
