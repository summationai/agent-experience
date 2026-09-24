/**
 * @axe/core/node: the pieces of `@axe/core` that need Node. Everything else in the package is
 * platform-neutral, so a browser bundle that imports `@axe/core` or `@axe/surface` never meets a
 * Node built-in; this entry is the one place that reaches for one.
 */
import type { AXEActionEvent, AXEEvent } from "./types";

/**
 * Sink: append JSON lines to a file. Node only. The file handle is opened lazily and
 * writes are serialized, so events never interleave. Accepts request events and action events.
 */
export function jsonlFileSink(path: string): (event: AXEEvent | AXEActionEvent) => Promise<void> {
  let queue: Promise<void> = Promise.resolve();
  return (event) => {
    queue = queue.then(async () => {
      const { appendFile } = await import("node:fs/promises");
      await appendFile(path, JSON.stringify(event) + "\n", "utf8");
    });
    return queue;
  };
}
