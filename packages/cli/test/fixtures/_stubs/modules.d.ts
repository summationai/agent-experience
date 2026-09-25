// Type stubs for typechecking the code `axe surface init` generates, in a fixture copied to a
// temporary directory. The @axe/surface/auto, @axe/surface/react (SurfaceProvider) and
// @axe/relay/client blocks pin the API shapes packages/cli/src/surface/api.ts guesses;
// TODO(merge): replace them with the real packages' declarations when those land.

declare module "@axe/surface/auto" {
  export type Risk = "low" | "medium" | "high";
  export interface ControlConfig {
    name?: string;
    reason?: string;
    risk?: Risk;
    hide?: boolean;
    handler?: () => unknown;
    approval?: boolean;
    group?: string;
    sensitive?: boolean;
  }
  export interface SurfaceConfig {
    controls?: Record<string, ControlConfig>;
  }
  export interface AutoSurfaceHandle {
    surface: { expose(host?: unknown): void };
    refresh(): void;
    coverage(): unknown;
    stop(): void;
    configure(config: SurfaceConfig): void;
  }
  export function autoSurface(options: {
    root: Element;
    surface?: unknown;
    config?: SurfaceConfig;
  }): AutoSurfaceHandle;
  export function formatCoverage(report: unknown): string;
}

declare module "@axe/surface/react" {
  import type { ReactNode } from "react";
  import type { AutoSurfaceHandle, SurfaceConfig } from "@axe/surface/auto";
  export function SurfaceProvider(props: {
    config?: SurfaceConfig;
    flag?: boolean;
    expose?: boolean;
    onReady?: (handle: AutoSurfaceHandle) => unknown;
    children?: ReactNode;
  }): ReactNode;
}

declare module "@axe/relay/client" {
  export function connectRelay(
    surface: unknown,
    options: { url: string; token?: string },
  ): { close(): void };
}

declare module "react-router" {
  import type { ReactNode } from "react";
  export function Outlet(): ReactNode;
  export function Links(): ReactNode;
  export function Meta(): ReactNode;
  export function Scripts(): ReactNode;
  export function ScrollRestoration(): ReactNode;
  export function isRouteErrorResponse(error: unknown): error is { status: number };
}

declare module "*.css";

interface ImportMeta {
  readonly env: {
    readonly DEV: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readonly [key: string]: any;
  };
}

declare const process: { env: Record<string, string | undefined> };
