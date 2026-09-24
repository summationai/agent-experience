// src/hooks.server.ts — SvelteKit answers AXE paths before its own router runs.
// #region all
import { axeFetch, isAxePath } from "@axe/fetch";
import { axe } from "./axe";
import { customerFrom, type SessionLookup } from "./session";

// @sveltejs/kit is not installed in this repository, so `Handle` and `RequestEvent`
// are declared structurally with only the members we use. In your app, import
// `Handle` from "@sveltejs/kit" and declare `App.Platform` in app.d.ts.
type Platform = { env?: { SESSIONS?: SessionLookup } } | undefined;
type RequestEvent = { request: Request; url: URL; platform: Platform };
type Handle = (input: {
  event: RequestEvent;
  resolve: (event: RequestEvent) => Promise<Response>;
}) => Promise<Response>;

const handler = axeFetch<Platform>(axe, {
  // `platform` is set by adapter-cloudflare and friends; on adapter-node it is undefined.
  context: async (request, platform) => ({
    identity: await customerFrom(request, platform?.env?.SESSIONS),
  }),
});

export const handle: Handle = async ({ event, resolve }) => {
  if (isAxePath(event.url.pathname)) return handler(event.request, event.platform);
  return resolve(event);
};
// #endregion all
