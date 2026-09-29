// @vitest-environment jsdom
/**
 * The Apps view itself, in an iframe under jsdom with a stand-in host in the parent window that
 * speaks the extension's postMessage protocol: answer `ui/initialize`, wait for
 * `ui/notifications/initialized`, send `ui/notifications/tool-result`. The view must render the
 * escaped presentation and run nothing from the result.
 */
import { afterEach, describe, expect, it } from "vitest";
import { PRESENTATION_VIEW_HTML, formatResult } from "../src/index";
import type { ActionDefinition, OkResult } from "../../core/src/types";

const action = {
  name: "products.search",
  title: "Search products",
  description: "Finds products.",
  input: { type: "object" },
  output: { type: "object" },
  readOnly: true,
  idempotent: true,
  reversible: true,
  risk: "none",
  auth: "none",
  display: {
    kind: "list",
    items: "/items",
    item: { id: "/id", title: "/title", url: "/url" },
    disclaimer: "Prices change.",
  },
} as unknown as ActionDefinition;

function waitFor(check: () => boolean, ms = 2000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (check()) return resolve();
      if (Date.now() - start > ms) return reject(new Error("timed out"));
      setTimeout(tick, 10);
    };
    tick();
  });
}

afterEach(() => {
  document.body.replaceChildren();
});

/**
 * A stand-in host around the view. jsdom does not load `srcdoc` and does not set
 * `MessageEvent.source` as browsers do, so the view's head and body are copied into a blank
 * frame, its inline script is re-created there (jsdom runs it as a browser runs the page's own
 * script), the frame's `parent` is the test window, and host messages are dispatched with that
 * window as their `source`, which is what the view checks.
 */
function hostFrame(
  onMessage: (m: { id?: number; method?: string }, reply: (msg: unknown) => void) => void,
) {
  const frame = document.createElement("iframe");
  document.body.appendChild(frame);
  const win = frame.contentWindow as unknown as Window & typeof globalThis;
  Object.defineProperty(win, "parent", { value: window, configurable: true });
  const reply = (data: unknown) =>
    win.dispatchEvent(new win.MessageEvent("message", { data, source: window }));
  const listener = (e: MessageEvent) =>
    onMessage(e.data as { id?: number; method?: string }, reply);
  window.addEventListener("message", listener);
  const doc = frame.contentDocument!;
  const parsed = new DOMParser().parseFromString(PRESENTATION_VIEW_HTML, "text/html");
  const scripts = [...parsed.querySelectorAll("script")].map((el) => el.textContent ?? "");
  for (const el of parsed.querySelectorAll("script")) el.remove();
  doc.head.innerHTML = parsed.head.innerHTML;
  doc.body.innerHTML = parsed.body.innerHTML;
  for (const code of scripts) {
    const el = doc.createElement("script");
    el.textContent = code;
    doc.body.appendChild(el);
  }
  return { doc, close: () => window.removeEventListener("message", listener) };
}

describe("MCP Apps view in a host frame", () => {
  it("the view initializes with the host, renders the escaped presentation, and runs nothing from the result", async () => {
    const injected = `<img src=x onerror="window.top.__pwned=1">`;
    const result = formatResult(
      {
        status: "ok",
        output: {
          items: [{ id: "p1", title: `Lamp ${injected}`, url: "https://shop.example/p1" }],
        },
      } as OkResult,
      action,
      undefined,
      { presentation: true },
    );
    const seen: string[] = [];
    const view = hostFrame((m, reply) => {
      seen.push(m.method ?? "response");
      if (m.method === "ui/initialize")
        reply({
          jsonrpc: "2.0",
          id: m.id,
          result: { protocolVersion: "2026-01-26", hostCapabilities: {} },
        });
      if (m.method === "ui/notifications/initialized")
        reply({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params: result });
    });
    await waitFor(() => !!view.doc.querySelector("#axe-root main"));
    const root = view.doc.getElementById("axe-root")!;
    expect(seen).toEqual(["ui/initialize", "ui/notifications/initialized"]);
    expect(root.textContent).toContain(`Lamp ${injected}`);
    expect(root.textContent).toContain("Prices change.");
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector("script")).toBeNull();
    expect(root.querySelector("a")!.getAttribute("href")).toBe("https://shop.example/p1");
    expect((window as { __pwned?: number }).__pwned).toBeUndefined();
    view.close();
  });

  it("without a presentation in the result, the view shows the text content", async () => {
    const view = hostFrame((m, reply) => {
      if (m.method === "ui/initialize")
        reply({ jsonrpc: "2.0", id: m.id, result: { hostCapabilities: {} } });
      if (m.method === "ui/notifications/initialized")
        reply({
          jsonrpc: "2.0",
          method: "ui/notifications/tool-result",
          params: { content: [{ type: "text", text: "<b>plain</b> result" }] },
        });
    });
    await waitFor(() => !!view.doc.querySelector("#axe-root pre"));
    const pre = view.doc.querySelector("#axe-root pre")!;
    expect(pre.textContent).toBe("<b>plain</b> result");
    expect(pre.querySelector("b")).toBeNull();
    view.close();
  });
});
