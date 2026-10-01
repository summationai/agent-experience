import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import * as WIRE from "@summationai/axe-core/vocabulary";
import type { CommandContext } from "../index";
import { parse } from "./shared";
import { npxCommand } from "../surface/api";

type Framework = "express" | "next" | "fetch";
const FRAMEWORKS: Framework[] = ["express", "next", "fetch"];

const AXE_TS = `import { createAXE, action, z } from "@summationai/axe-core";

// One read-only action is enough to be agent-visible. Add more as you go.
export const axe = createAXE({
  name: "Sunrise Yoga Studio",
  description:
    "Search upcoming yoga classes by date and style, see instructor bios, and (once signed in) book or cancel a spot.",
  baseUrl: process.env.AXE_BASE_URL ?? "http://localhost:3000",
  humanFallbackUrl: "http://localhost:3000",
  auth: { modes: ["none"] },
  policies: { rateLimit: { requestsPerMinute: 60 } },
  contact: { email: "hello@sunriseyoga.example" },
  // Tokens are signed with this. Set AXE_SECRET in production; see docs/deploying.md.
  secret: process.env.AXE_SECRET ?? "development-only-secret-change-me",
});

const ClassSchema = z.object({
  id: z.string(),
  title: z.string(),
  style: z.enum(["vinyasa", "yin", "hatha"]),
  startsAt: z.string().datetime(),
  instructor: z.string(),
  spotsLeft: z.number().int(),
  url: z.string(),
});

const CLASSES = [
  { id: "c_101", title: "Morning Vinyasa", style: "vinyasa" as const, startsAt: "2026-10-01T14:00:00Z", instructor: "Priya N.", spotsLeft: 6, url: "http://localhost:3000/classes/c_101" },
  { id: "c_102", title: "Candlelight Yin", style: "yin" as const, startsAt: "2026-10-01T03:00:00Z", instructor: "Marcus L.", spotsLeft: 2, url: "http://localhost:3000/classes/c_102" },
];

axe.register(
  action("classes.search", {
    title: "Search upcoming classes",
    description:
      "Find upcoming classes by date range and style. Returns up to 50 classes with start time, instructor, and spots left. Does not book anything.",
    readOnly: true,
    risk: "none",
    input: z.object({
      from: z.string().date().describe("Earliest class date, YYYY-MM-DD"),
      to: z.string().date().optional().describe("Latest class date, YYYY-MM-DD"),
      style: z.enum(["vinyasa", "yin", "hatha"]).optional().describe("Yoga style"),
    }),
    output: z.object({ classes: z.array(ClassSchema) }),
    display: {
      kind: "list",
      items: "/classes",
      item: {
        id: "/id",
        title: "/title",
        subtitle: "/instructor",
        url: "/url",
        attributes: [
          { label: "Starts", path: "/startsAt", format: "datetime", compare: "lower-better" },
          { label: "Style", path: "/style", format: "text" },
          { label: "Spots left", path: "/spotsLeft", format: "number", compare: "higher-better" },
        ],
      },
      suggestedComparison: ["Starts", "Spots left"],
      disclaimer: "Availability changes quickly. Confirm on the class page before planning around it.",
    },
    examples: [{ input: { from: "2026-10-01" }, output: { classes: CLASSES } }],
    handler: async ({ input }) => ({
      classes: CLASSES.filter((c) => c.startsAt.slice(0, 10) >= input.from && (!input.style || c.style === input.style)),
    }),
  }),
);
`;

const MOUNTS: Record<Framework, { file: string; content: string; note: string }> = {
  express: {
    file: "server.ts",
    content: `import express from "express";
import { axeExpress } from "@summationai/axe-express";
import { axe } from "./axe";

const app = express();
app.use(express.json());
app.use(axeExpress(axe));
app.get("/", (_req, res) => res.send("Sunrise Yoga Studio"));

app.listen(3000, () => console.log("Listening on http://localhost:3000"));
`,
    note: "Run it with: npx tsx server.ts",
  },
  next: {
    file: "app/axe/[...axe]/route.ts",
    content: `import { axeNext } from "@summationai/axe-next";
import { axe } from "../../../axe";

export const { GET, POST, OPTIONS } = axeNext(axe);
`,
    note: `Also create app${WIRE.path.manifest}/route.ts with the same three exports, or add a rewrite from ${WIRE.path.manifest} to ${WIRE.path.manifestAlias} in next.config.`,
  },
  fetch: {
    file: "server.ts",
    content: `import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { axeFetch } from "@summationai/axe-fetch";
import { axe } from "./axe";

const app = new Hono();
const handler = axeFetch(axe);
app.all("${WIRE.path.actions.split("/").slice(0, 2).join("/")}/*", (c) => handler(c.req.raw));
app.get("${WIRE.path.manifest}", (c) => handler(c.req.raw));
app.get("/", (c) => c.text("Sunrise Yoga Studio"));

serve({ fetch: app.fetch, port: 3000 }, () => console.log("Listening on http://localhost:3000"));
`,
    note: "Run it with: npx tsx server.ts (works the same in Remix loaders, Cloudflare Workers, Bun, Deno, and SvelteKit hooks)",
  },
};

export async function init(ctx: CommandContext): Promise<number> {
  const { values } = parse(ctx.args, {
    framework: { type: "string", short: "f" },
    dir: { type: "string", short: "d" },
    yes: { type: "boolean", short: "y" },
  });
  let framework = values.framework as Framework | undefined;
  const dir = resolve(String(values.dir ?? "."));
  if (!framework) {
    if (values.yes || !process.stdin.isTTY) framework = "express";
    else {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const answer = (await rl.question("Which framework? (express / next / fetch) [express]: "))
        .trim()
        .toLowerCase();
      rl.close();
      framework = (FRAMEWORKS.includes(answer as Framework) ? answer : "express") as Framework;
    }
  }
  if (!FRAMEWORKS.includes(framework))
    throw new Error(`--framework must be one of ${FRAMEWORKS.join(", ")}`);
  mkdirSync(dir, { recursive: true });
  const axePath = join(dir, "axe.ts");
  if (existsSync(axePath) && !values.yes)
    throw new Error(`${axePath} already exists. Pass --yes to overwrite.`);
  writeFileSync(axePath, AXE_TS);
  const mount = MOUNTS[framework];
  const mountPath = join(dir, mount.file);
  mkdirSync(join(mountPath, ".."), { recursive: true });
  if (!existsSync(mountPath) || values.yes) writeFileSync(mountPath, mount.content);
  const adapter = `@summationai/axe-${framework}`;
  ctx.stdout(`Wrote ${axePath}`);
  ctx.stdout(`Wrote ${mountPath}`);
  ctx.stdout("");
  ctx.stdout("Next steps:");
  ctx.stdout(
    `  1. Install: npm install @summationai/axe-core ${adapter}${framework === "fetch" ? " hono @hono/node-server" : framework === "express" ? " express" : ""} && npm install -D @summationai/axe tsx`,
  );
  ctx.stdout(
    `  2. Start your app (${mount.note}), then check it: ${npxCommand(WIRE.cli.inspect)} http://localhost:3000`,
  );
  ctx.stdout(
    `  3. Prove it works: ${npxCommand(WIRE.cli.conformance)} http://localhost:3000 — then ${npxCommand(WIRE.cli.mcp)} http://localhost:3000 to talk to it from Claude Desktop.`,
  );
  return 0;
}
