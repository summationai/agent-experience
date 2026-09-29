// app/routes/axe.$.ts — a Remix resource route that owns /axe/*.
// #region all
import { axeFetch } from "@summationai/axe-fetch";
import { axe } from "./axe";
import { customerFrom } from "./session";

// Remix is not installed in this repository, so the argument shape is declared
// structurally. In your app, import LoaderFunctionArgs and ActionFunctionArgs
// from "@remix-run/node" (or "@remix-run/cloudflare") instead.
type RouteArgs = { request: Request };

const handler = axeFetch(axe, {
  context: async (request) => ({ identity: await customerFrom(request) }),
});

// GET and OPTIONS reach the loader; POST reaches the action.
export const loader = ({ request }: RouteArgs) => handler(request);
export const action = ({ request }: RouteArgs) => handler(request);
// #endregion all
