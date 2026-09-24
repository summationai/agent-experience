import { parseArgs } from "node:util";
import type { ParseArgsConfig } from "node:util";

type Options = NonNullable<ParseArgsConfig["options"]>;

/** Strict `parseArgs` with positionals, preserving the option literal types for `values`. */
export function parse<T extends Options>(
  args: string[],
  options: T,
): ReturnType<
  typeof parseArgs<{ args: string[]; options: T; allowPositionals: true; strict: true }>
> {
  return parseArgs({ args, options, allowPositionals: true, strict: true });
}

export function requireUrl(value: string | undefined, usage: string): string {
  if (!value) throw new Error(`Missing <url>.\nUsage: ${usage}`);
  const u = value.includes("://") ? value : `https://${value}`;
  try {
    return new URL(u).toString();
  } catch {
    throw new Error(`"${value}" is not a URL.`);
  }
}

export function parseJsonArg(value: string | undefined, name: string): unknown {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`--${name} must be valid JSON, received: ${value}`);
  }
}
