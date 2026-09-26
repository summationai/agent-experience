// @vitest-environment jsdom
/**
 * `autoSurface` over a mounted React tree: an agent's act on a derived entry fires React's own
 * `onChange` and `onClick` (the native value setter defeats React's value tracker the way typing
 * does), and `SurfaceProvider` starts on mount, re-scans on a History API route change, exposes
 * `window.__surface`, and stops on unmount. Runs on the package's React (18); the React 19 run is
 * examples/auto-react19.
 */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { act as reactAct, createElement as h, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { createSurface } from "../src/index";
import type { Surface } from "../src/index";
import { autoSurface } from "../src/auto";
import type { AutoSurfaceHandle } from "../src/auto";
import { SurfaceProvider, useAutoSurfaceHandle } from "../src/react";

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let roots: Root[] = [];
let handles: AutoSurfaceHandle[] = [];
afterEach(() => {
  for (const hd of handles) hd.stop();
  handles = [];
  for (const r of roots) reactAct(() => r.unmount());
  roots = [];
  document.body.innerHTML = "";
  delete (document as { modelContext?: unknown }).modelContext;
  window.history.replaceState({}, "", "/");
});

function mount(el: ReturnType<typeof h>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  reactAct(() => root.render(el));
  return root;
}

function Profile({ log }: { log: string[] }) {
  const [name, setName] = useState("Ada");
  const [plan, setPlan] = useState("free");
  const [agree, setAgree] = useState(false);
  const [saved, setSaved] = useState(0);
  return h(
    "main",
    null,
    h("h1", null, "Profile"),
    h("label", { htmlFor: "n" }, "Display name"),
    h("input", {
      id: "n",
      value: name,
      onChange: (e: { target: { value: string } }) => {
        log.push(`name:${e.target.value}`);
        setName(e.target.value);
      },
    }),
    h(
      "select",
      {
        "aria-label": "Plan",
        value: plan,
        onChange: (e: { target: { value: string } }) => (
          log.push(`plan:${e.target.value}`),
          setPlan(e.target.value)
        ),
      },
      h("option", { value: "free" }, "Free"),
      h("option", { value: "pro" }, "Pro"),
    ),
    h(
      "label",
      null,
      h("input", {
        type: "checkbox",
        checked: agree,
        onChange: () => (log.push("agree"), setAgree(!agree)),
      }),
      "I agree to the terms",
    ),
    h(
      "button",
      { disabled: !agree, onClick: () => (log.push(`save:${name}`), setSaved(saved + 1)) },
      "Save profile",
    ),
    h("p", { role: "status" }, saved ? `Saved ${saved}` : ""),
  );
}

const find = (s: Surface, name: string) => s.observe().entries.find((r) => r.name === name)!;
/**
 * An act as an agent makes it: outside React's test `act()`, so React schedules and commits the
 * handler's updates as it does in a browser, while the surface waits for the page to settle.
 */
const run = async (s: Surface, id: string, text?: string) => {
  const row = s.observe().entries.find((r) => r.id === id)!;
  const op = row.kind === "field" ? "TYPE_TEXT" : "CLICK";
  const env = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  env.IS_REACT_ACT_ENVIRONMENT = false;
  try {
    return await s.act({
      op,
      target: id,
      expectedRev: s.currentRev(),
      ...(text !== undefined ? { text } : {}),
    });
  } finally {
    env.IS_REACT_ACT_ENVIRONMENT = true;
  }
};

describe("acting on a mounted React tree [S-AUTO-4]", () => {
  it("TYPE_TEXT fires onChange with the new value; CLICK fires onClick; availability follows React state", async () => {
    const log: string[] = [];
    mount(h(Profile, { log }));
    const hd = autoSurface({ observe: { debounceMs: 0, settle: { quietMs: 5, timeoutMs: 100 } } });
    handles.push(hd);
    const s = hd.surface;
    expect(find(s, "Save profile").state?.available).toBe(false);
    expect((await run(s, find(s, "Display name").id, "Grace")).status).toBe("ok");
    expect(find(s, "Display name").value).toBe("Grace");
    expect((await run(s, find(s, "Plan").id, "Pro")).status).toBe("ok");
    expect(find(s, "Plan").value).toBe("Pro");
    const agree = await run(s, find(s, "I agree to the terms").id);
    expect(agree.status).toBe("ok");
    expect(find(s, "Save profile").state?.available).toBe(true);
    const save = await run(s, find(s, "Save profile").id);
    expect(save.status).toBe("ok");
    if (save.status === "ok") expect(save.output.notices).toEqual(["Saved 1"]);
    expect(log).toEqual(["name:Grace", "plan:pro", "agree", "save:Grace"]);
  });
});

describe("SurfaceProvider [S-AUTO-12]", () => {
  function Pages() {
    const [path, setPath] = useState("/");
    const hd = useAutoSurfaceHandle();
    return h(
      "div",
      null,
      h("span", { "data-started": hd ? "yes" : "no" }),
      h(
        "a",
        {
          href: "/reports",
          onClick: (e: { preventDefault: () => void }) => (
            e.preventDefault(),
            window.history.pushState({}, "", "/reports"),
            setPath("/reports")
          ),
        },
        "Reports",
      ),
      path === "/" ? h("button", null, "Refresh home") : h("button", null, "Export report"),
    );
  }

  it("starts on mount, exposes window.__surface, keys follow a pushState route change, stops on unmount", async () => {
    const surface = createSurface();
    const root = mount(
      h(
        SurfaceProvider,
        {
          surface,
          expose: true,
          observe: { debounceMs: 0, settle: { quietMs: 5, timeoutMs: 100 } },
        },
        h(Pages),
      ),
    );
    expect(document.querySelector("[data-started]")!.getAttribute("data-started")).toBe("yes");
    const pub = (window as unknown as { __surface: { coverage: () => { route: string } } })
      .__surface;
    expect(pub.coverage().route).toBe("/");
    expect(find(surface, "Refresh home").id.startsWith("/#")).toBe(true);
    const link = find(surface, "Reports");
    expect((await run(surface, link.id)).status).toBe("ok");
    expect(find(surface, "Export report").id.startsWith("/reports#")).toBe(true);
    expect(surface.observe().entries.some((r) => r.name === "Refresh home")).toBe(false);
    reactAct(() => root.unmount());
    roots = roots.filter((r) => r !== root);
    expect(surface.entries()).toEqual([]);
  });

  it("onReady gets the started handle in an effect, and its cleanup (sync or async) runs on unmount", async () => {
    const surface = createSurface();
    const seen: string[] = [];
    const root = mount(
      h(
        SurfaceProvider,
        {
          surface,
          onReady: (handle: { surface: unknown }) => {
            seen.push(handle.surface === surface ? "ready" : "wrong surface");
            return Promise.resolve(() => void seen.push("cleaned"));
          },
        },
        h("button", null, "Refresh"),
      ),
    );
    await reactAct(async () => {
      await Promise.resolve();
    });
    expect(seen).toEqual(["ready"]);
    reactAct(() => root.unmount());
    roots = roots.filter((r) => r !== root);
    expect(seen).toEqual(["ready", "cleaned"]);
    // flag={false}: onReady never runs.
    const off: string[] = [];
    mount(
      h(
        SurfaceProvider,
        { surface: createSurface(), flag: false, onReady: () => void off.push("x") },
        h("i"),
      ),
    );
    expect(off).toEqual([]);
  });

  it("flag={false} starts nothing", () => {
    const surface = createSurface();
    mount(h(SurfaceProvider, { surface, flag: false }, h("button", null, "Refresh")));
    expect(surface.entries()).toEqual([]);
  });

  it("webMcp registers the package-held surface with a supporting browser and cleans up", async () => {
    const tools = new Map<string, { title?: string }>();
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: {
        registerTool(tool: { name: string; title?: string }, options?: { signal?: AbortSignal }) {
          tools.set(tool.name, tool);
          options?.signal?.addEventListener("abort", () => tools.delete(tool.name));
        },
      },
    });
    const surface = createSurface();
    const root = mount(
      h(SurfaceProvider, { surface, webMcp: true }, h("button", null, "Refresh dashboard")),
    );
    await reactAct(async () => {
      await Promise.resolve();
    });
    expect([...tools.keys()]).toContain("surface_observe");
    expect([...tools.values()].some((tool) => tool.title === "Refresh dashboard")).toBe(true);
    reactAct(() => root.unmount());
    roots = roots.filter((r) => r !== root);
    expect(tools.size).toBe(0);
  });
});
