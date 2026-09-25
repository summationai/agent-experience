// The page script the tests load into a jsdom window or a real browser: the SDK's surface and
// the relay client, bundled for the browser exactly as an application would ship them.
import { createSurface } from "@axe/surface";
import { connectRelay, devToken } from "../../src/client";

(globalThis as unknown as { relayPage: unknown }).relayPage = {
  createSurface,
  connectRelay,
  devToken,
};
