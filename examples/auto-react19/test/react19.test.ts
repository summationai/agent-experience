/**
 * The easy-mode integration on React 19 (the version the first target application runs):
 * `SurfaceProvider` starts on mount, an act on a derived entry fires React 19's `onChange` and
 * `onClick`, and unmount leaves the table empty.
 */
import { describe, expect, it } from "vitest";
import { act as reactAct, createElement as h, useState, version } from "react";
import { createRoot } from "react-dom/client";
import { createSurface } from "@axe/surface";
import type { Surface } from "@axe/surface";
import { SurfaceProvider } from "@axe/surface/react";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Form({ log }: { log: string[] }) {
  const [email, setEmail] = useState("");
  return h(
    "form",
    { "aria-label": "Invite", onSubmit: (e: { preventDefault: () => void }) => e.preventDefault() },
    h("label", { htmlFor: "e" }, "Email"),
    h("input", {
      id: "e",
      value: email,
      onChange: (e: { target: { value: string } }) => (
        log.push(`email:${e.target.value}`),
        setEmail(e.target.value)
      ),
    }),
    h(
      "button",
      { type: "button", disabled: !email, onClick: () => log.push(`add:${email}`) },
      "Add to list",
    ),
  );
}

const find = (s: Surface, name: string) => s.observe().entries.find((r) => r.name === name)!;
async function run(s: Surface, id: string, text?: string) {
  const env = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  env.IS_REACT_ACT_ENVIRONMENT = false;
  try {
    const row = s.observe().entries.find((r) => r.id === id)!;
    return await s.act({
      op: row.kind === "field" ? "TYPE_TEXT" : "CLICK",
      target: id,
      expectedRev: s.currentRev(),
      ...(text !== undefined ? { text } : {}),
    });
  } finally {
    env.IS_REACT_ACT_ENVIRONMENT = true;
  }
}

describe("SurfaceProvider on React 19", () => {
  it("runs on React 19", () => {
    expect(version.startsWith("19.")).toBe(true);
  });

  it("derives on mount, acts through React's handlers, and stops on unmount", async () => {
    const log: string[] = [];
    const surface = createSurface();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    reactAct(() =>
      root.render(
        h(
          SurfaceProvider,
          { surface, observe: { debounceMs: 0, settle: { quietMs: 5, timeoutMs: 100 } } },
          h(Form, { log }),
        ),
      ),
    );
    expect(find(surface, "Add to list").state?.available).toBe(false);
    expect((await run(surface, find(surface, "Email").id, "ada@example.com")).status).toBe("ok");
    expect(find(surface, "Add to list").state?.available).toBe(true);
    expect((await run(surface, find(surface, "Add to list").id)).status).toBe("ok");
    expect(log).toEqual(["email:ada@example.com", "add:ada@example.com"]);
    reactAct(() => root.unmount());
    expect(surface.entries()).toEqual([]);
  });
});
