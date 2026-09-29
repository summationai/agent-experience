// The fixture application's page script for the WebMCP bridge: easy mode (`autoSurface`) offered
// through WebMCP and nothing else, with no relay connection and no approval UI.
import { autoSurface } from "@summationai/axe-surface/auto";
import { exposeWebMcp } from "@summationai/axe-surface/webmcp";

const handle = autoSurface({ expose: true });
// `?granularity=domain` offers the fixed domain tools instead of one tool per control.
const granularity =
  new URLSearchParams(location.search).get("granularity") === "domain" ? "domain" : "control";
const webmcp = exposeWebMcp(handle.surface, { actor: "headless agent", granularity });
(window as unknown as Record<string, unknown>)["webmcpFixture"] = { webmcp };
