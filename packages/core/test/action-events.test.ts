import { describe, expect, it } from "vitest";
import { action, createAXE, z } from "../src/index";
import { ActionEventSchema } from "../src/schemas";
import type { AXEActionEvent, AXEEvent } from "../src/types";

describe("action events [E-5..7]", () => {
  it("a handler's emit reaches onActionEvent sinks, stamped, and never the analytics onEvent sinks", async () => {
    const actionEvents: AXEActionEvent[] = [];
    const requestEvents: AXEEvent[] = [];
    const axe = createAXE({
      name: "Notes",
      description: "Keeps notes on a record and says who added each one.",
      baseUrl: "http://localhost:3000",
      auth: { modes: ["none"] },
      secret: "0123456789abcdef0123456789abcdef",
      onEvent: (e) => void requestEvents.push(e),
      onActionEvent: [(e) => void actionEvents.push(e)],
    });
    axe.register(
      action("notes.add", {
        title: "Add a note",
        description: "Adds a note to the record.",
        risk: "low",
        input: z.object({ text: z.string() }),
        output: z.object({ id: z.string() }),
        handler: ({ input, emit }) => {
          emit({
            event: "notes.added",
            actor: "dana",
            details: { id: "n1", length: input.text.length },
          });
          return { id: "n1" };
        },
      }),
    );
    const res = await axe.handle(
      new Request("http://localhost:3000/axe/actions/notes.add", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: { text: "hi" }, idempotencyKey: "k" }),
      }),
    );
    expect(((await res.json()) as { status: string }).status).toBe("ok");
    await new Promise((r) => setTimeout(r, 0));
    expect(actionEvents).toHaveLength(1);
    expect(actionEvents[0]).toEqual({
      schemaVersion: 1,
      ts: expect.any(String),
      action: "notes.add",
      event: "notes.added",
      status: "ok",
      errorCode: null,
      actor: "dana",
      details: { id: "n1", length: 2 },
      tenant: null,
    });
    expect(ActionEventSchema.safeParse(actionEvents[0]).success).toBe(true);
    // The request event is still exactly one, and carries no actor [E-2].
    expect(requestEvents).toHaveLength(1);
    expect(requestEvents[0]).not.toHaveProperty("actor");
  });
});
