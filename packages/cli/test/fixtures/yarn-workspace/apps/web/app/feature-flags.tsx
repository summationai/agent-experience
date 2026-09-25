import type { ReactNode } from "react";

export function FeatureFlagProvider({ children }: { children: ReactNode }) {
    return <>{children}</>;
}

export function useFeatureFlag(key: string): boolean {
    return key.length > 0;
}
