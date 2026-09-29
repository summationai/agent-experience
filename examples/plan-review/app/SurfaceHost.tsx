"use client";
// Publishes the page's browser-local surface at window.__surface for agents that run in the page.
import { useEffect } from "react";
import { exposePageSurface } from "../lib/browser-surface";

export function SurfaceHost() {
  useEffect(() => exposePageSurface(window), []);
  return null;
}
