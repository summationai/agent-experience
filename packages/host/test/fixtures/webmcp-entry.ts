// The fixture application's page script for the WebMCP bridge: easy mode (`autoSurface`) offered
// through WebMCP and nothing else, with no relay connection and no approval UI.
import { autoSurface } from "@summationai/axe-surface/auto";
import { exposeWebMcp } from "@summationai/axe-surface/webmcp";

const handle = autoSurface({ expose: true });
const webmcp = exposeWebMcp(handle.surface, { actor: "headless agent" });
(window as unknown as Record<string, unknown>)["webmcpFixture"] = { webmcp };
