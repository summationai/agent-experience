// Extra tools: tools answered by the embedding code (an image, say) beside the derived ones,
// listed with them, called with the caller's context, and refused when a name collides.
import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createAXE, action, z } from "../../core/src/index";
import { createMcpServer } from "../src/index";
import type { ExtraTool } from "../src/index";

function site() {
  const axe = createAXE({
    name: "Extra",
    description: "Extra tools test site.",
    baseUrl: "http://localhost",
  });
  axe.register(
    action("items.list", {
      title: "List items",
      description: "Lists the items in the test catalog.",
      readOnly: true,
      risk: "none",
      input: z.object({}).strict(),
      output: z.object({ items: z.array(z.string()) }),
      examples: [{ input: {}, output: { items: ["a"] } }],
      handler: () => ({ items: ["a"] }),
    }),
  );
  return axe;
}

const picture: ExtraTool = {
  definition: {
    name: "picture",
    description: "Returns a one-pixel picture.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  call: async (_args, context) => ({
    content: [
      { type: "image", data: "iVBORw0KGgo=", mimeType: "image/png" },
      { type: "text", text: `caller: ${context.authInfo ? "verified" : "none"}` },
    ],
  }),
};

describe("extraTools", () => {
  it("lists and calls an extra tool beside the derived ones", async () => {
    const derived = await createMcpServer(site(), { extraTools: [picture] });
    const [clientT, serverT] = InMemoryTransport.createLinkedPair();
    await derived.server.connect(serverT);
    const client = new Client({ name: "t", version: "0" });
    await client.connect(clientT);
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names).toContain("items_list");
    expect(names).toContain("picture");
    const r = (await client.callTool({ name: "picture", arguments: {} })) as {
      content: { type: string; text?: string; mimeType?: string }[];
    };
    expect(r.content[0]).toMatchObject({ type: "image", mimeType: "image/png" });
    expect(r.content[1]!.text).toBe("caller: none");
    await client.close();
  });

  it("refuses an extra tool whose name a derived tool already uses", async () => {
    await expect(
      createMcpServer(site(), {
        extraTools: [{ ...picture, definition: { ...picture.definition, name: "items_list" } }],
      }),
    ).rejects.toThrow(/already a tool name/);
  });
});
