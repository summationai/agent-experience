import { describe, expect, it } from "vitest";
import {
  addAgentEntryToRootLoader,
  addConfigRoute,
  matchBracket,
  nextAgentEntryFile,
} from "../src/surface/agent-web-edits";

const ADMIN_ROUTES = `import type { RouteConfig } from "@react-router/dev/routes";
import { index, layout, route } from "@react-router/dev/routes";

export default [
  // tRPC API route
  route("api/trpc/*", "routes/api.trpc.$.tsx"),

  route("logout", "routes/logout.tsx"),

  layout("routes/_layout.tsx", [
    index("routes/_layout._index.tsx"),
    route("users", "routes/users/_index.tsx"),
  ]),
] satisfies RouteConfig;
`;

describe("addConfigRoute", () => {
  it("adds the agent route to the admin app's route config, once", () => {
    const out = addConfigRoute(ADMIN_ROUTES, "routes/agent.$.tsx") as string;
    expect(out).toContain('route("agent/*", "routes/agent.$.tsx"),\n] satisfies RouteConfig;');
    // Inside the top-level array, not the layout's.
    expect(out.indexOf('route("agent/*"')).toBeGreaterThan(out.indexOf("]),"));
    expect(addConfigRoute(out, "routes/agent.$.tsx")).toBe(out);
  });

  it("imports route when the config does not", () => {
    const out = addConfigRoute(
      `import { index } from "@react-router/dev/routes";\nexport default [index("routes/home.tsx")];\n`,
      "routes/agent.$.tsx",
    ) as string;
    expect(out).toContain('import { index, route } from "@react-router/dev/routes";');
    expect(out).toContain('index("routes/home.tsx"),');
    const bare = addConfigRoute(`export default [\n];\n`, "routes/agent.$.tsx") as string;
    expect(bare).toContain('import { route } from "@react-router/dev/routes";');
  });

  it("asks for a manual step when the default export is not an array", () => {
    expect(addConfigRoute(`export default flatRoutes();\n`, "routes/agent.$.tsx")).toHaveProperty(
      "manual",
    );
  });
});

describe("addAgentEntryToRootLoader", () => {
  it("the admin app's loader, whose request is renamed _request", () => {
    const root = `import type { LoaderFunctionArgs } from "react-router";

export async function loader({ request: _request }: LoaderFunctionArgs) {
  return {
    ENV: {},
  };
}
`;
    const out = addAgentEntryToRootLoader(root, { typescript: true }) as string;
    expect(out).toContain('import { agentEntry } from "@summationai/axe-core/agent-entry";');
    expect(out).toMatch(
      /loader\(\{ request: _request \}: LoaderFunctionArgs\) \{\n {2}\/\/ An agent's browser[^\n]*\n[^\n]*\n {2}const toAgent = agentEntry\(_request\);\n {2}if \(toAgent\) throw toAgent;\n {2}return \{/,
    );
    expect(addAgentEntryToRootLoader(out, { typescript: true })).toBe(out);
  });

  it("the web app's loader, with a typed destructured request and a return type", () => {
    const root = `export async function loader({ request }: { request: Request }): Promise<RootLoaderData> {
    if (request.method === "OPTIONS") throw data(null, { status: 204 });
    return load();
}
`;
    const out = addAgentEntryToRootLoader(root, { typescript: true }) as string;
    expect(out).toContain("Promise<RootLoaderData> {\n    // An agent's browser");
    expect(out).toContain(
      "    const toAgent = agentEntry(request);\n    if (toAgent) throw toAgent;\n    if (request.method",
    );
  });

  it("an args parameter, an arrow loader, and a destructure without request", () => {
    const args = addAgentEntryToRootLoader(`export function loader(args) {\n  return null;\n}\n`, {
      typescript: false,
    }) as string;
    expect(args).toContain("agentEntry(args.request)");
    const arrow = addAgentEntryToRootLoader(
      `export const loader = async ({ request }: LoaderFunctionArgs) => {\n  return null;\n};\n`,
      { typescript: true },
    ) as string;
    expect(arrow).toContain("=> {\n  // An agent's browser");
    expect(arrow).toContain("agentEntry(request)");
    const params = addAgentEntryToRootLoader(
      `export async function loader({ context }: LoaderFunctionArgs) {\n  return context;\n}\n`,
      { typescript: true },
    ) as string;
    expect(params).toContain("loader({ request, context }: LoaderFunctionArgs)");
  });

  it("adds a loader to a root that has none", () => {
    const out = addAgentEntryToRootLoader(
      `import { Outlet } from "react-router";\n\nexport default function App() {\n  return <Outlet />;\n}\n`,
      { typescript: true },
    ) as string;
    expect(out).toContain('import type { LoaderFunctionArgs } from "react-router";');
    expect(out).toContain(
      "export async function loader({ request }: LoaderFunctionArgs) {\n  const toAgent = agentEntry(request);\n  if (toAgent) throw toAgent;\n  return null;\n}",
    );
  });

  it("asks for a manual step for an expression-bodied arrow loader", () => {
    expect(
      addAgentEntryToRootLoader(`export const loader = ({ request }) => load(request);\n`, {
        typescript: false,
      }),
    ).toHaveProperty("manual");
  });
});

describe("nextAgentEntryFile and matchBracket", () => {
  it("writes proxy.ts for Next.js 16 and middleware.ts before", () => {
    expect(nextAgentEntryFile({ typescript: true, proxy: true })).toContain(
      "export function proxy(request: NextRequest) {\n  return agentEntry(request) ?? NextResponse.next();",
    );
    const mw = nextAgentEntryFile({ typescript: false, proxy: false });
    expect(mw).toContain("export function middleware(request) {");
    expect(mw).toContain('from "@summationai/axe-core/agent-entry"');
  });

  it("skips strings and comments", () => {
    const t = `[ "]", // ]\n  /* ] */ [1] ]`;
    expect(matchBracket(t, 0)).toBe(t.length - 1);
  });
});
