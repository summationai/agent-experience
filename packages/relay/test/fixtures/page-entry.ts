// The page script the tests load into a jsdom window or a real browser: the SDK's surface and
// the relay client, bundled for the browser exactly as an application would ship them.
import { createSurface } from "@summationai/axe-surface";
import { autoSurface } from "@summationai/axe-surface/auto";
import {
  connectRelay,
  devToken,
  localMcpService,
  injectedRelay,
  relayOptions,
} from "../../src/client";

(globalThis as unknown as { relayPage: unknown }).relayPage = {
  createSurface,
  autoSurface,
  connectRelay,
  devToken,
  localMcpService,
  injectedRelay,
  relayOptions,
};
