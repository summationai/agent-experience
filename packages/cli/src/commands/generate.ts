import { readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { ManifestSchema } from "@axe/core/schemas";
import type { AuthMode, Manifest } from "@axe/core/types";
import * as WIRE from "@axe/core/vocabulary";
import { fromOpenAPI, generate, formatWarnings } from "@axe/generate";
import type { GenerateWarning, OpenAPIDocument, OpenAPIOptions } from "@axe/generate";
import type { CommandContext } from "../index";
import { parse } from "./shared";

const USAGE = `Usage: ${WIRE.cli.generate} <openapi.json> [--base-url <url>] [--out <axe.json>] [--code <axe.ts>] [--json]`;

/** Read an OpenAPI document. JSON only: the CLI carries no YAML parser. */
export function readOpenAPIDocument(file: string): OpenAPIDocument {
  if (/\.ya?ml$/i.test(file)) {
    throw new Error(
      `${WIRE.cli.generate} reads JSON only. Convert the document first, for example \`npx js-yaml ${file} > openapi.json\`, and pass the JSON file.`,
    );
  }
  let text: string;
  try {
    text = readFileSync(resolve(file), "utf8");
  } catch {
    throw new Error(`Cannot read ${file}.`);
  }
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    throw new Error(`${file} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!doc || typeof doc !== "object" || !("paths" in doc)) {
    throw new Error(`${file} does not look like an OpenAPI document (no "paths" member).`);
  }
  return doc as OpenAPIDocument;
}

export async function generateCommand(ctx: CommandContext): Promise<number> {
  const { values, positionals } = parse(ctx.args, {
    "base-url": { type: "string" },
    out: { type: "string" },
    code: { type: "string" },
    json: { type: "boolean" },
  });
  const file = positionals[0];
  if (!file) throw new Error(USAGE);
  const document = readOpenAPIDocument(file);
  const options: OpenAPIOptions = {};
  if (values["base-url"]) options.baseUrl = values["base-url"];
  const generated = generate([fromOpenAPI(document, options)]);
  const baseUrl = (options.baseUrl ?? document.servers?.[0]?.url ?? "").replace(/\/+$/, "");

  const modes = [...new Set(generated.actions.map((a) => a.definition.auth))] as AuthMode[];
  if (modes.length === 0) modes.push(WIRE.authMode.none);
  const manifest: Manifest = {
    protocol: WIRE.protocol.version,
    name: document.info?.title ?? "Untitled API",
    description: document.info?.description ?? "",
    baseUrl,
    auth: { modes },
    actions: generated.actions.map((a) => a.definition),
  };
  const schema = ManifestSchema.safeParse(manifest);
  const dropped = generated.warnings.filter((w) => w.dropped);
  const kept = generated.warnings.filter((w) => !w.dropped);

  if (values.json) {
    ctx.stdout(
      JSON.stringify(
        {
          file,
          manifest,
          valid: schema.success,
          schemaIssues: schema.success ? [] : schema.error.issues,
          warnings: generated.warnings,
          provenance: generated.provenance,
        },
        null,
        2,
      ),
    );
  } else {
    ctx.stdout(
      `${file}: ${manifest.name}, ${manifest.actions.length} action(s) generated, ${dropped.length} left out`,
    );
    for (const a of manifest.actions) {
      const ref = generated.provenance[a.name]?.ref ?? "";
      ctx.stdout(
        `  • ${a.name} — ${a.title} [${a.readOnly ? "read" : "write"}, risk ${a.risk}, auth ${a.auth}]  ← ${ref}`,
      );
    }
    if (dropped.length > 0) {
      ctx.stdout("");
      ctx.stdout("Left out (the generator does not invent what the document lacks):");
      ctx.stdout(indent(formatWarnings(dropped)));
    }
    if (kept.length > 0) {
      ctx.stdout("");
      ctx.stdout("Warnings:");
      for (const line of summarizeWarnings(kept)) ctx.stdout(`  ${line}`);
    }
    ctx.stdout("");
    if (schema.success) ctx.stdout("✓ The generated manifest validates against the schema");
    else {
      ctx.stdout("✗ The generated manifest does not validate yet:");
      for (const i of schema.error.issues)
        ctx.stdout(`    ${i.path.join(".") || "/"}: ${i.message}`);
    }
  }

  if (values.out) {
    const out = resolve(values.out);
    writeFileSync(out, JSON.stringify(manifest, null, 2) + "\n");
    ctx.stdout(`wrote ${values.out}`);
  }
  if (values.code) {
    const code = resolve(values.code);
    writeFileSync(
      code,
      renderModule({
        documentPath: relative(dirname(code), resolve(file)) || file,
        manifest,
        baseUrl,
        dropped,
        generatedNames: manifest.actions.map((a) => a.name),
      }),
    );
    ctx.stdout(`wrote ${values.code}`);
  }
  return manifest.actions.length > 0 ? 0 : 1;
}

function indent(text: string): string {
  return text
    .split("\n")
    .map((l) => `  ${l}`)
    .join("\n");
}

/** Non-fatal warnings grouped by code and lint rule, with the actions they apply to. */
export function summarizeWarnings(warnings: GenerateWarning[]): string[] {
  const groups = new Map<string, Set<string>>();
  for (const w of warnings) {
    const key = w.code === "lint" && w.lint ? `lint/${w.lint.rule}` : w.code;
    if (!groups.has(key)) groups.set(key, new Set());
    groups
      .get(key)!
      .add(w.field && w.code === "unsupported-schema" ? w.field : (w.action ?? w.ref ?? "?"));
  }
  return [...groups.entries()].map(
    ([key, names]) => `! ${key} (${names.size}): ${[...names].sort().join(", ")}`,
  );
}

interface RenderInput {
  documentPath: string;
  manifest: Manifest;
  baseUrl: string;
  dropped: GenerateWarning[];
  generatedNames: string[];
}

/** The `axe.ts` starter: `fromOpenAPI` with an overrides block holding one TODO per dropped action. */
export function renderModule(r: RenderInput): string {
  const q = (s: string) => JSON.stringify(s);
  const modes = r.manifest.auth.modes;
  const authLines = [`    modes: ${JSON.stringify(modes)},`];
  if (modes.includes(WIRE.authMode.user)) {
    authLines.push(
      `    // TODO: where a human signs in during a login handoff, or provide authenticate() for pass-through.`,
      `    userLoginUrl: ${q(`${r.baseUrl}/login`)},`,
    );
  }
  if (modes.includes(WIRE.authMode.site)) {
    authLines.push(
      `    // TODO: validate the agent's API key.`,
      `    verifySiteKey: async (key) => key === process.env.AXE_SITE_KEY,`,
    );
  }
  const byAction = new Map<string, GenerateWarning[]>();
  for (const w of r.dropped) {
    const key = w.action ?? w.ref ?? "?";
    if (!byAction.has(key)) byAction.set(key, []);
    byAction.get(key)!.push(w);
  }
  const overrideLines: string[] = [];
  for (const [name, ws] of byAction) {
    for (const w of ws)
      overrideLines.push(`    // TODO ${w.ref ?? name}: ${w.code} — ${w.message}`);
    const fields = ws.map((w) => w.field).filter((f): f is string => !!f);
    const body =
      fields.length > 0
        ? fields.map((f) => `${f}: ${f === "risk" ? '"medium"' : '""'}`).join(", ")
        : "exclude: true";
    overrideLines.push(`    ${q(name)}: { ${body} },`);
  }
  if (overrideLines.length === 0) {
    overrideLines.push(
      `    // Every operation had what AXE needs. Add display hints and examples here as you review.`,
    );
  }
  const description = r.manifest.description;
  const descriptionLine =
    description.trim().length >= 40
      ? `  description: ${q(description)},`
      : `  // TODO: 40 to 400 characters, for an agent: what the site does and who can act.\n  description: ${q(description)},`;
  return `/**
 * Generated by \`${WIRE.cli.generate}\` from ${r.documentPath}. The document decides names, flags,
 * schemas, and the HTTP calls; the overrides below are yours. Review them, then run
 * \`${WIRE.cli.validate} <this file>\`.
 */
import { readFileSync } from "node:fs";
import { createAXE } from "@axe/core";
import { formatWarnings, fromOpenAPI, generate, registerGenerated } from "@axe/generate";
import type { OpenAPIDocument } from "@axe/generate";

const document = JSON.parse(
  readFileSync(new URL(${q(r.documentPath.startsWith(".") ? r.documentPath : `./${r.documentPath}`)}, import.meta.url), "utf8"),
) as OpenAPIDocument;

export const axe = createAXE({
  name: ${q(r.manifest.name)},
${descriptionLine}
  // TODO: the origin this AXE server is served from (the site), if it is not the API's own.
  baseUrl: ${q(r.baseUrl)},
  auth: {
${authLines.join("\n")}
  },
  secret: process.env.AXE_SECRET,
});

const generated = generate([fromOpenAPI(document, { baseUrl: ${q(r.baseUrl)} })], {
  overrides: {
${overrideLines.join("\n")}
  },
});

// Anything still left out is a gap in the document, not a decision the generator made for you.
const dropped = generated.warnings.filter((w) => w.dropped);
if (dropped.length > 0) console.warn(formatWarnings(dropped));

registerGenerated(axe, generated); // ${r.generatedNames.length} action(s): ${r.generatedNames.join(", ")}

export const handler = axe.fetchHandler(); // (Request) => Promise<Response>
`;
}
