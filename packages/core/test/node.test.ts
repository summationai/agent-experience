import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { jsonlFileSink } from "../src/node";
import type { AXEActionEvent } from "../src/types";

describe("@summationai/axe-core/node", () => {
  it("jsonlFileSink appends one JSON line per event, in order", async () => {
    const dir = await mkdtemp(join(tmpdir(), "axe-node-"));
    const path = join(dir, "events.jsonl");
    const sink = jsonlFileSink(path);
    const event = (seq: number): AXEActionEvent => ({
      schemaVersion: 1,
      ts: "2026-01-01T00:00:00.000Z",
      action: "surface.pick",
      event: "surface.act",
      status: "ok",
      errorCode: null,
      actor: "dana",
      details: { seq },
      tenant: null,
    });
    await Promise.all([sink(event(1)), sink(event(2)), sink(event(3))]);
    const lines = (await readFile(path, "utf8")).trim().split("\n");
    expect(lines.map((l) => (JSON.parse(l) as AXEActionEvent).details.seq)).toEqual([1, 2, 3]);
    await rm(dir, { recursive: true, force: true });
  });
});
