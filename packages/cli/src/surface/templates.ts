/**
 * The files `axe surface init` writes. Each generated file carries MARKER so a second run knows
 * the file is its own. Every name taken from `@summationai/axe-surface/auto`, `@summationai/axe-surface/react`, or
 * `@summationai/axe-relay/client` comes from ./api, so reconciling those packages is one file.
 */
import { AUTO_OPTIONS, MODULES, NAMES, PAGE_GLOBAL, PROVIDER_PROPS } from "./api";
import type { Framework } from "./detect";
import type { Style } from "./edit";

export const MARKER = "written by `axe surface init`";

/** The component the root edit wraps the app in; defined in the generated surface file. */
export const WRAPPER = "AgentSurface";

export type FlagSpec =
  | { kind: "default" }
  | { kind: "env"; name: string }
  /** `call` (a hook or a function, e.g. `useFeatureFlag("ui_axe_surface")`) of `name` from `module`. */
  | { kind: "call"; module: string; name: string; call: string };

export interface TemplateOptions {
  framework: Framework;
  typescript: boolean;
  style: Style;
  flag: FlagSpec;
  /** Include the out-of-browser relay/service or injected-host adapter. */
  remote?: boolean;
  /** Relay URL when `--relay` or `--relay-dev` was given. */
  relay?: string;
  appId: string;
  appName: string;
  /** Offer the Surface to the agent web: domain tools, for an agent with nothing installed. */
  agentWeb?: boolean;
}

/** Environment access per framework: how the generated code reads a build-time variable. */
function envOf(framework: Framework): {
  dev: string;
  read: (name: string) => string;
  prefix: string;
} | null {
  if (framework === "react-router" || framework === "vite-react")
    return { dev: "import.meta.env.DEV", read: (n) => `import.meta.env.${n}`, prefix: "VITE_" };
  if (framework === "next")
    return {
      dev: `process.env.NODE_ENV === "development"`,
      read: (n) => `process.env.${n}`,
      prefix: "NEXT_PUBLIC_",
    };
  return null;
}

/** The default flag's variable name for a framework, e.g. `VITE_SURFACE`. */
export function defaultFlagName(framework: Framework): string | undefined {
  const env = envOf(framework);
  return env ? `${env.prefix}SURFACE` : undefined;
}

/** Re-render a template written with double quotes, semicolons, and two-space indentation. */
function styled(source: string, style: Style): string {
  let out = source;
  if (style.quote === "'")
    out = out
      .split("\n")
      .map((line) =>
        line.trimStart().startsWith("//") ? line : line.replace(/"([^"'\n]*)"/g, "'$1'"),
      )
      .join("\n");
  if (!style.semi)
    out = out
      .split("\n")
      .map((line) => (line.trimStart().startsWith("//") ? line : line.replace(/;$/, "")))
      .join("\n");
  if (style.unit !== "  ")
    out = out.replace(/^((?: {2})+)/gm, (m) => style.unit.repeat(m.length / 2));
  return out;
}

/** `text` as `//` comment lines of at most 100 characters. */
function comment(text: string): string[] {
  const out: string[] = [];
  let line = "//";
  for (const word of text.split(" ")) {
    if (line.length + 1 + word.length > 100) {
      out.push(line);
      line = "//";
    }
    line += ` ${word}`;
  }
  out.push(line);
  return out;
}

const LOCAL_DEV = `typeof location !== "undefined" && ["localhost", "127.0.0.1"].includes(location.hostname)`;

interface Gate {
  /** Lines at module scope (imports excluded). */
  module: string[];
  /** Lines inside the component body, for a hook-style flag. */
  body: string[];
  imports: string[];
  /** One comment line saying when it is on. */
  says: string;
}

/** With the optional remote adapter, always on when the provider supplied a scoped connection. */
const HOSTED = `${NAMES.injectedRelay}() !== null`;
const HOSTED_SAYS =
  "Always on after a provider browser handoff or in an optional `axe host` session (both are read by `injectedRelay()`).";

function gate(o: TemplateOptions): Gate {
  const env = envOf(o.framework);
  const dev = env ? env.dev : LOCAL_DEV;
  const hosted = o.remote ? ` || ${HOSTED}` : "";
  const hostedSays = o.remote ? ` ${HOSTED_SAYS}` : "";
  const devLine = env ? `const development = ${dev};` : `const development =\n  ${dev};`;
  if (o.flag.kind === "default")
    return {
      imports: [],
      module: [devLine, "const enabled = true;"],
      body: [],
      says: `Always on: Surface is a browser-local description of controls, not a separately deployed service.${hostedSays}`,
    };
  if (o.flag.kind === "call") {
    const hook = /^use[A-Z0-9]/.test(o.flag.name);
    return {
      imports: [`import { ${o.flag.name} } from "${o.flag.module}";`],
      module: [devLine],
      body: [`const enabled = ${o.flag.call}${hosted};`],
      says: `On when ${o.flag.call} (from ${o.flag.module}) is true; that ${hook ? "hook" : "check"} decides every environment.${hook ? " A hook needs its provider above the mount: mount below it with --mount." : ""}${hostedSays}`,
    };
  }
  if (!env)
    return {
      imports: [],
      module: [devLine, `const enabled = development${hosted};`],
      body: [],
      says: `On when the page is served from localhost; off everywhere else.${hostedSays} Replace \`development\` in \`enabled\` with your feature-flag check to turn it on elsewhere.`,
    };
  const name = o.flag.name;
  return {
    imports: [],
    module: [devLine, `const enabled = development || ${env.read(name)} === "1"${hosted};`],
    body: [],
    says: `On in development, and in a build made with ${name}=1. Production builds are off unless that is set.${hostedSays}`,
  };
}

interface RelayLines {
  imports: string[];
  module: string[];
  /** The expression for the connection options, or null for none (`options` in the code). */
  options: string;
}

/**
 * The relay connection. Always a scoped connection the provider supplied (browser handoff, or an
 * optional unattended `axe host` session); with `--relay-dev`, the development relay otherwise
 * (attended: the person's own tab, with pairing); with `--relay <url>`, the company-side service.
 */
function relayLines(o: TemplateOptions): RelayLines {
  if (!o.remote) return { imports: [], module: [], options: "null" };
  const injected = `${NAMES.injectedRelay}()`;
  const imports = (extra: string[] = []) => [
    `import { ${[NAMES.connectRelay, ...extra, NAMES.injectedRelay].join(", ")} } from "${MODULES.relayClient}";`,
  ];
  const intro = [
    "",
    "// The relay carries the page's surface to an agent outside the browser (an MCP client). The",
    "// provider supplies a scoped connection through its browser handoff or optional host;",
  ];
  if (!o.relay)
    return {
      imports: imports(),
      module: [
        ...intro,
        "// anywhere else nothing connects. `axe surface init --relay-dev` adds the development relay",
        "// for a person's own tab (attended mode, with pairing).",
      ],
      options: injected,
    };
  const env = envOf(o.framework);
  const url = env
    ? `${env.read(`${env.prefix}SURFACE_RELAY_URL`)} ?? "${o.relay}"`
    : `"${o.relay}"`;
  // The local MCP service hands the page a token for its development principal; a production
  // deployment replaces this with its authenticated company-side endpoint.
  const dev = /^(?:https?|wss?):\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(o.relay);
  const httpBase = o.relay.replace(/^ws(s?):/, "http$1:").replace(/\/tab$/, "");
  const localUrl = env
    ? `${env.read(`${env.prefix}SURFACE_RELAY_URL`)} ?? "${httpBase}"`
    : `"${httpBase}"`;
  const tokenLine = dev
    ? `  ...${NAMES.localMcpService}(${localUrl}), // local service; production uses its authenticated endpoint`
    : `  getToken: () => fetch("/api/relay-token", { method: "POST" }).then((r) => r.json()).then((b) => b.token), // your endpoint that mints a relay token for the signed-in user`;
  return {
    imports: imports(dev ? [NAMES.localMcpService] : []),
    module: [
      ...intro,
      dev
        ? "// otherwise, in development, the person's own tab connects to the local MCP service"
        : "// otherwise the person's own tab connects to the company-side service (attended mode).",
      ...(dev ? ["// (`pnpm mcp:dev` in the SDK checkout, attended mode, with pairing)."] : []),
      ...(env ? [`// Override the URL with ${env.prefix}SURFACE_RELAY_URL.`] : []),
      "const relay = {",
      ...(dev ? [] : [`  url: ${url},`]),
      tokenLine,
      "  // indicator: false, // hides the relay's on-page indicator, whose text is not translated",
      "};",
    ],
    options: dev ? `${injected} ?? (development ? relay : null)` : `${injected} ?? relay`,
  };
}

/** The React component that wraps the app root: `surface.tsx` (or `.jsx`). */
export function reactSurfaceFile(o: TemplateOptions): string {
  const g = gate(o);
  const r = relayLines(o);
  const ts = o.typescript;
  const props = [
    `${PROVIDER_PROPS.config}={surfaceConfig}`,
    `${PROVIDER_PROPS.flag}={enabled}`,
    `${PROVIDER_PROPS.expose}={development}`,
    // The agent web reads the page through WebMCP; domain tools keep its list fixed however many
    // controls the page has.
    o.agentWeb ? `${PROVIDER_PROPS.webMcp}={{ granularity: "domain" }}` : PROVIDER_PROPS.webMcp,
    ...(o.remote
      ? [
          `${PROVIDER_PROPS.onReady}={(handle) => {`,
          `  const options = ${r.options};`,
          "  if (!options) return;",
          `  const connection = ${NAMES.connectRelay}(handle.surface, options);`,
          "  return () => connection.disconnect();",
          "}}",
        ]
      : []),
  ];
  const open = !o.remote
    ? [`    <${NAMES.provider} ${props.join(" ")}>`]
    : [`    <${NAMES.provider}`, ...props.map((p) => `      ${p}`), "    >"];
  const lines = [
    ...(o.framework === "next" ? [`"use client";`, ""] : []),
    `// Agent Surface for this app, ${MARKER}. Yours to edit.`,
    "//",
    `// <${WRAPPER}> wraps the app root. On, autoSurface discovers the controls under it and, in`,
    `// development, publishes window.${PAGE_GLOBAL} for \`axe surface coverage\` and browser agents.`,
    "// It also registers the live controls with a browser-native agent when WebMCP is available.",
    "// Off, it renders its children and nothing else. Overlay config: ./surface.config.",
    `// Nothing here runs at import time: the provider starts discovery${o.remote ? " and the remote connection" : ""} in an effect,`,
    "// so a server render renders the children only.",
    "//",
    ...comment(g.says),
    ...(ts ? [`import type { ReactNode } from "react";`] : []),
    `import { ${NAMES.provider} } from "${MODULES.react}";`,
    ...r.imports,
    ...g.imports,
    `import surfaceConfig from "./surface.config";`,
    "",
    ...g.module,
    ...r.module,
    "",
    ts
      ? `export function ${WRAPPER}({ children }: { children: ReactNode }) {`
      : `export function ${WRAPPER}({ children }) {`,
    ...g.body.map((l) => `  ${l}`),
    "  return (",
    ...open,
    "      {children}",
    `    </${NAMES.provider}>`,
    "  );",
    "}",
    "",
  ];
  return styled(lines.join("\n"), o.style);
}

/** The plain-page setup: `surface.js`, loaded by a module script tag. */
export function plainSurfaceFile(o: TemplateOptions): string {
  const g = gate(o);
  const r = relayLines(o);
  const lines = [
    `// Agent Surface for this page, ${MARKER}. Yours to edit.`,
    "//",
    ...comment(g.says),
    "//",
    `// ${MODULES.auto} is a bare module specifier: load this file through your bundler, or map`,
    "// the specifier with an import map to the package's built files.",
    `import { ${NAMES.autoSurface} } from "${MODULES.auto}";`,
    `import { ${NAMES.exposeWebMcp} } from "${MODULES.webMcp}";`,
    ...r.imports,
    ...g.imports,
    `import surfaceConfig from "./surface.config.js";`,
    "",
    ...g.module,
    ...g.body,
    ...r.module,
    "",
    "if (enabled) {",
    "  // expose publishes window.__surface for `axe surface coverage` and browser-driving agents.",
    `  const handle = ${NAMES.autoSurface}({ ${AUTO_OPTIONS.root}: document.body, ${AUTO_OPTIONS.config}: surfaceConfig, expose: development });`,
    `  ${NAMES.exposeWebMcp}(handle.surface);`,
    ...(o.remote
      ? [
          `  const options = ${r.options};`,
          `  if (options) ${NAMES.connectRelay}(handle.surface, options);`,
        ]
      : []),
    "}",
    "",
  ];
  return styled(lines.join("\n"), o.style);
}

const EXAMPLES = [
  "  // Nothing here is required: autoSurface discovers the page's controls on its own. Run",
  "  // `axe surface coverage <url>` and add a rule for each gap it lists, most important first.",
  "  // A rule matches by `key` (from coverage), `id` (data-surface-id), `selector`, `route`,",
  "  // `role`, or `name`, and overrides what was derived.",
  "  //",
  "  // rules: [",
  '  //   // rename: the name an agent reads, stated as the outcome ("Lock March", not "Lock button").',
  '  //   { match: { selector: "#lock-month" }, name: "Lock the month" },',
  "  //   // reason: why a disabled control is unavailable, in the app's own words.",
  '  //   { match: { selector: "[data-testid=submit-plan]" }, reason: "the plan has unsaved edits" },',
  "  //   // risk: how much a mistaken act costs; never none for a control that changes state.",
  '  //   { match: { selector: "button.archive" }, effect: { mutates: "plans", risk: "medium" } },',
  "  //   // hide: controls an agent should never see (debug panels, the app's own chat).",
  '  //   { match: { selector: ".debug-panel" }, hide: true },',
  "  //   // handler: run the app's own function instead of a synthetic click (the declared tier).",
  '  //   { match: { selector: "#export-csv" }, handler: () => exportCsv() },',
  "  //   // approval: a person approves on the page before this runs.",
  '  //   { match: { selector: "button.delete-plan" }, approval: true },',
  "  //   // group: fold controls into one domain action (a key of `groups`).",
  '  //   { match: { selector: "#toolbar button" }, group: "plan-toolbar" },',
  "  //   // sensitive: an agent may set the field (with `editable`) but never reads its value back.",
  '  //   { match: { selector: "input[name=salary]" }, sensitive: true },',
  "  // ],",
];

/** The starter config: an empty overlay with commented examples. */
export function configFile(o: TemplateOptions): string {
  const header = [
    `// Surface config for this app, ${MARKER}. Yours to edit.`,
    "//",
    "// The overlay on what autoSurface discovers: names, reasons, risk, and approvals that the",
    "// page alone cannot tell it. An empty overlay is a working start.",
  ];
  const lines = o.typescript
    ? [
        ...header,
        `import type { ${NAMES.config} } from "${MODULES.auto}";`,
        "",
        `const surfaceConfig: ${NAMES.config} = {`,
        "  profile: {",
        `    id: ${JSON.stringify(o.appId)},`,
        `    name: ${JSON.stringify(o.appName)},`,
        "    // Wire this to the app's existing auth source: unknown only while it resolves.",
        '    authentication: { state: "unknown" },',
        "  },",
        ...EXAMPLES,
        "};",
        "",
        "export default surfaceConfig;",
        "",
      ]
    : [
        ...header,
        "",
        `/** @type {import("${MODULES.auto}").${NAMES.config}} */`,
        "const surfaceConfig = {",
        "  profile: {",
        `    id: ${JSON.stringify(o.appId)},`,
        `    name: ${JSON.stringify(o.appName)},`,
        "    // Wire this to the app's existing auth source: unknown only while it resolves.",
        '    authentication: { state: "unknown" },',
        "  },",
        ...EXAMPLES,
        "};",
        "",
        "export default surfaceConfig;",
        "",
      ];
  return styled(lines.join("\n"), o.style);
}

/** The module the agent site imports: the site's side of the agent web, for the site's server. */
export const AGENT_SITE_MODULE = "@summationai/axe-core/agent-site";

/**
 * `agent-site.server.ts`: the site's agent pages (connect an agent session, approve an action, type
 * a value), for the application's own server. `identify` and `session` come from the application's
 * own sign-in, so they are left to fill in; until then every page sends the person to sign in and
 * no session connects.
 */
export function agentSiteFile(o: { typescript: boolean; style: Style }): string {
  const ts = o.typescript;
  const lines = [
    `// The agent web's pages on this site, ${MARKER}. Yours to edit. Server only.`,
    "//",
    "// An agent with nothing installed reaches this application through the agent web service,",
    "// following links. What it cannot do goes to these pages, on this site, signed in with this",
    "// site's own session: /agent/signin (connect the agent to the person), /agent/approve/<id> (a",
    "// high-risk action), /agent/input/<id> (a value the person types). /agent sends an agent that",
    "// found the site on to the agent web's /start. docs/agent-web.md has the whole flow.",
    "//",
    "// AXE_AGENT_WEB_SECRET is shared with the agent web service; AXE_AGENT_WEB_URL is where this",
    "// server reaches it, and AXE_AGENT_WEB_PUBLIC_URL where agents do (default: the same).",
    `import { agentSiteHandler } from "${AGENT_SITE_MODULE}";`,
    ...(ts ? [`import type { AgentSiteIdentity } from "${AGENT_SITE_MODULE}";`] : []),
    "",
    "export const agentSite = agentSiteHandler({",
    '  serviceUrl: process.env.AXE_AGENT_WEB_URL ?? "http://127.0.0.1:4719",',
    "  agentUrl: process.env.AXE_AGENT_WEB_PUBLIC_URL ?? process.env.AXE_AGENT_WEB_URL,",
    '  secret: process.env.AXE_AGENT_WEB_SECRET ?? "",',
    "  // The signed-in person for this request, from this application's own server-side session:",
    "  // a stable principal (the same one every time), and the tenant or workspace if there is one.",
    "  // Null when signed out: the page then sends the person to sign in first.",
    ts
      ? "  identify: async (request: Request): Promise<AgentSiteIdentity | null> => {"
      : "  identify: async (request) => {",
    "    // TODO(agent-web): read this application's session for `request`.",
    "    void request;",
    "    return null;",
    "  },",
    "  // The application session the agent's headless page runs with, for that person. Mint one",
    "  // for the agent with the application's own session code, so it can be ended on its own; in",
    "  // development, passing on the person's own session cookies is acceptable.",
    ts
      ? "  session: async (request: Request, who: AgentSiteIdentity) => {"
      : "  session: async (request, who) => {",
    "    // TODO(agent-web): return { cookies: [...] } or { storageState } for `who`.",
    "    void request;",
    "    void who;",
    '    throw new Error("agent-web: session() is not implemented yet (agent-site.server)");',
    "  },",
    "  // This application's sign-in page, returning to `returnTo` afterwards.",
    "  loginUrl: (returnTo) => `/login?redirectTo=${encodeURIComponent(returnTo)}`,",
    "});",
    "",
  ];
  return styled(lines.join("\n"), o.style);
}

/** A React Router resource route for `/agent` and `/agent/*` that answers with the agent site. */
export function reactRouterAgentRoute(o: {
  importPath: string;
  typescript: boolean;
  style: Style;
}): string {
  const ts = o.typescript;
  const lines = [
    `// The agent web's pages on this site (/agent and /agent/*), ${MARKER}. See agent-site.server.`,
    ...(ts ? ['import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";'] : []),
    `import { agentSite } from "${o.importPath}";`,
    "",
    ts
      ? "export async function loader({ request }: LoaderFunctionArgs) {"
      : "export async function loader({ request }) {",
    '  return (await agentSite(request)) ?? new Response("Not found", { status: 404 });',
    "}",
    "",
    ts
      ? "export async function action({ request }: ActionFunctionArgs) {"
      : "export async function action({ request }) {",
    '  return (await agentSite(request)) ?? new Response("Not found", { status: 404 });',
    "}",
    "",
  ];
  return styled(lines.join("\n"), o.style);
}

/** A Next.js App Router route for `/agent` and `/agent/*` that answers with the agent site. */
export function nextAgentRoute(o: {
  importPath: string;
  typescript: boolean;
  style: Style;
}): string {
  const lines = [
    `// The agent web's pages on this site (/agent and /agent/*), ${MARKER}. See agent-site.server.`,
    `import { agentSite } from "${o.importPath}";`,
    "",
    'export const runtime = "nodejs";',
    'export const dynamic = "force-dynamic";',
    "",
    o.typescript
      ? "const handle = async (request: Request) =>"
      : "const handle = async (request) =>",
    '  (await agentSite(request)) ?? new Response("Not found", { status: 404 });',
    "",
    "export const GET = handle;",
    "export const POST = handle;",
    "",
  ];
  return styled(lines.join("\n"), o.style);
}
