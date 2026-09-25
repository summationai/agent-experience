// The fixture application's page script: easy mode (`autoSurface`) plus the relay connection an
// app's generated code makes, preferring the connection a host injected (`injectedRelay()` reads
// `window.__AXE_RELAY__`). Bundled for the browser, as an application would ship it.
import { autoSurface } from "@axe/surface/auto";
import { connectRelay, injectedRelay } from "@axe/relay/client";

const handle = autoSurface({ expose: true });
const injected = injectedRelay();
(window as unknown as Record<string, unknown>)["hostFixture"] = {
  mode: injected?.mode ?? null,
  connection: injected ? connectRelay(handle.surface, injected) : null,
};
