"use client";
// Publishes the page's browser-local surface at window.__surface for agents that run in the page,
// and offers it through WebMCP where the browser has it (a headless bridge included:
// `axe host --dev --webmcp --stdio`). Without WebMCP, exposeWebMcp registers nothing.
import { useEffect } from "react";
import { exposeWebMcp } from "@summationai/axe-surface/webmcp";
import { exposePageSurface, pageSurface } from "../lib/browser-surface";

export function SurfaceHost() {
  useEffect(() => {
    const unexpose = exposePageSurface(window);
    const webmcp = exposeWebMcp(pageSurface, { actor: "webmcp agent" });
    return () => {
      webmcp.close();
      unexpose();
    };
  }, []);
  return null;
}
