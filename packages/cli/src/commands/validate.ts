import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ManifestSchema } from "@summationai/axe-core/schemas";
import { lintManifest, hasLintErrors } from "@summationai/axe-core/lint";
import type { Manifest } from "@summationai/axe-core/types";
import type { CommandContext } from "../index";
import { parse } from "./shared";

interface AxeLike {
  describe(): Manifest;
}

function isAxeLike(v: unknown): v is AxeLike {
  return !!v && typeof v === "object" && typeof (v as AxeLike).describe === "function";
}

/** Load a TypeScript or JavaScript module and find the AXE instance it exports. */
export async function loadAxeModule(file: string): Promise<{ axe: AxeLike; exportName: string }> {
  const path = resolve(file);
  let mod: Record<string, unknown>;
  if (/\.[cm]?ts$/.test(path)) {
    const { tsImport } = await import("tsx/esm/api");
    mod = (await tsImport(pathToFileURL(path).href, import.meta.url)) as Record<string, unknown>;
  } else {
    mod = (await import(pathToFileURL(path).href)) as Record<string, unknown>;
  }
  for (const name of ["axe", "default"]) {
    if (isAxeLike(mod[name])) return { axe: mod[name] as AxeLike, exportName: name };
  }
  for (const [name, value] of Object.entries(mod))
    if (isAxeLike(value)) return { axe: value, exportName: name };
  throw new Error(
    `${file} does not export an AXE instance. Export the result of createAXE() as \`axe\` or as the default export.`,
  );
}

export async function validate(ctx: CommandContext): Promise<number> {
  const { values, positionals } = parse(ctx.args, { json: { type: "boolean" } });
  const file = positionals[0];
  if (!file) throw new Error("Usage: axe validate <file.ts>");
  const { axe, exportName } = await loadAxeModule(file);
  const manifest = axe.describe();
  const schema = ManifestSchema.safeParse(manifest);
  const issues = lintManifest(manifest);
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  if (values.json) {
    ctx.stdout(
      JSON.stringify(
        {
          file,
          exportName,
          valid: schema.success,
          schemaIssues: schema.success ? [] : schema.error.issues,
          lint: issues,
        },
        null,
        2,
      ),
    );
    return schema.success && !hasLintErrors(issues) ? 0 : 1;
  }
  ctx.stdout(
    `${file} exports \`${exportName}\`: ${manifest.name}, ${manifest.actions.length} action(s)`,
  );
  if (schema.success) ctx.stdout("✓ Manifest validates against the schema");
  else {
    ctx.stdout("✗ Manifest does not validate:");
    for (const i of schema.error.issues) ctx.stdout(`    ${i.path.join(".") || "/"}: ${i.message}`);
  }
  for (const a of manifest.actions)
    ctx.stdout(
      `  • ${a.name} — ${a.title} [${a.readOnly ? "read" : "write"}, risk ${a.risk}, auth ${a.auth}]`,
    );
  if (issues.length === 0) ctx.stdout("✓ No lint findings");
  for (const i of errors)
    ctx.stdout(`✗ ${i.location}: ${i.message}${i.excerpt ? ` ("${i.excerpt}")` : ""}`);
  for (const i of warnings)
    ctx.stdout(`! ${i.location}: ${i.message}${i.excerpt ? ` ("${i.excerpt}")` : ""}`);
  ctx.stdout("");
  ctx.stdout(`${errors.length} error(s), ${warnings.length} warning(s).`);
  return schema.success && errors.length === 0 ? 0 : 1;
}
