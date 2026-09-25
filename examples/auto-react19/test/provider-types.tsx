// Typecheck only (`pnpm typecheck`): SurfaceProvider in JSX with React 19's types, while the SDK is
// built against React 18's. Its children come from the application's own @types/react copy.
import type { ReactNode } from "react";
import { SurfaceProvider } from "@axe/surface/react";

export function AgentSurface({ children }: { children: ReactNode }) {
  return (
    <SurfaceProvider flag expose={false} onReady={() => undefined}>
      {children}
    </SurfaceProvider>
  );
}
