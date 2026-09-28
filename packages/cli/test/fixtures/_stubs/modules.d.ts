// Type stubs for typechecking the code `axe surface init` generates, in a fixture copied to a
// temporary directory. The @axe/surface/auto, @axe/surface/react (SurfaceProvider) and
// @axe/relay/client blocks pin the API shapes packages/cli/src/surface/api.ts guesses;
// Kept in step with the real packages by hand (checked against @axe/surface and @axe/relay at merge).

declare module "@axe/surface/auto" {
  export type Risk = "none" | "low" | "medium" | "high";
  export interface SurfaceMatch {
    key?: string;
    id?: string;
    selector?: string;
    route?: string;
    role?: string;
    name?: string | RegExp;
  }
  export interface SurfaceRule {
    match: SurfaceMatch;
    name?: string;
    reason?: string;
    effect?: { mutates?: string; risk?: Risk; reversible?: boolean; idempotent?: boolean };
    hide?: boolean;
    handler?: (...args: unknown[]) => unknown;
    approval?: boolean;
    group?: string;
    sensitive?: boolean;
    editable?: boolean;
  }
  export interface SurfaceConfig {
    rules?: SurfaceRule[];
  }
  export interface AutoSurfaceHandle {
    surface: unknown;
    refresh(): void;
    coverage(): unknown;
    stop(): void;
    configure(config: SurfaceConfig): void;
  }
  export function autoSurface(options?: {
    root?: Element;
    surface?: unknown;
    config?: SurfaceConfig;
    expose?: boolean | object;
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
    webMcp?: boolean;
    onReady?: (handle: AutoSurfaceHandle) => void | (() => void) | Promise<void | (() => void)>;
    children?: ReactNode;
  }): ReactNode;
}

declare module "@axe/surface/webmcp" {
  export function exposeWebMcp(surface: unknown): { close(): void };
}

declare module "@axe/relay/client" {
  export interface ConnectRelayOptions {
    url: string;
    token?: string;
    getToken?: () => Promise<string> | string;
    mode?: "attended" | "unattended";
    indicator?: boolean | Element;
  }
  export function connectRelay(
    surface: unknown,
    options: ConnectRelayOptions,
  ): { stop(): void; rekey(token?: string): void };
  export function devToken(relayUrl: string): () => Promise<string>;
  export function localMcpService(serviceUrl?: string): ConnectRelayOptions;
  export function injectedRelay(): ConnectRelayOptions | null;
  export function relayOptions(fallback: ConnectRelayOptions): ConnectRelayOptions;
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
