// React: start the derivation when the app mounts. Written with createElement so the docs
// typecheck without JSX; in an app it is <SurfaceProvider config={surfaceConfig} flag={on} expose>.
// #region provider
import { createElement } from "react";
import type { ReactNode } from "react";
import { SurfaceProvider } from "@summationai/axe-surface/react";
import { surfaceConfig } from "./config";

export function AgentReady({ children, on }: { children: ReactNode; on: boolean }) {
  return createElement(
    SurfaceProvider,
    { config: surfaceConfig, flag: on, expose: true },
    children,
  );
}
// #endregion provider
